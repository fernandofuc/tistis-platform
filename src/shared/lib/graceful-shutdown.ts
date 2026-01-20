/**
 * Graceful Shutdown Handler
 * MEJORA-2.5: Cierre ordenado del servidor
 *
 * Permite completar operaciones en progreso antes de terminar el proceso.
 * Registra handlers que se ejecutan en orden de prioridad cuando el
 * servidor recibe señales de terminación (SIGTERM, SIGINT, SIGUSR2).
 *
 * Uso:
 * gracefulShutdown.register('database', async () => await db.close(), 100);
 * gracefulShutdown.register('cache', async () => await cache.close(), 90);
 * gracefulShutdown.init();
 */

// ============================================
// TIPOS
// ============================================

export type ShutdownHandler = () => Promise<void>;

export interface RegisteredHandler {
  name: string;
  handler: ShutdownHandler;
  priority: number; // Mayor prioridad = ejecuta primero
}

export interface ShutdownConfig {
  /** Tiempo máximo para completar shutdown (ms) */
  timeoutMs: number;
  /** Si true, fuerza exit aunque fallen handlers */
  forceExitOnError: boolean;
  /** Señales a escuchar */
  signals: NodeJS.Signals[];
}

export interface ShutdownStatus {
  isShuttingDown: boolean;
  startedAt?: Date;
  handlersExecuted: string[];
  handlersFailed: string[];
  signal?: string;
}

// ============================================
// CONFIGURACIÓN POR DEFECTO
// ============================================

const DEFAULT_CONFIG: ShutdownConfig = {
  timeoutMs: 30000, // 30 segundos
  forceExitOnError: true,
  signals: ['SIGTERM', 'SIGINT', 'SIGUSR2'],
};

// ============================================
// CLASE PRINCIPAL
// ============================================

class GracefulShutdown {
  private handlers: RegisteredHandler[] = [];
  private config: ShutdownConfig;
  private status: ShutdownStatus = {
    isShuttingDown: false,
    handlersExecuted: [],
    handlersFailed: [],
  };
  private isInitialized = false;

  constructor(config?: Partial<ShutdownConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Registra un handler para ejecutar durante shutdown
   * @param name Nombre descriptivo para logging
   * @param handler Función async que realiza la limpieza
   * @param priority Prioridad de ejecución (mayor = primero)
   */
  register(name: string, handler: ShutdownHandler, priority: number = 0): void {
    // Evitar duplicados
    const existing = this.handlers.findIndex((h) => h.name === name);
    if (existing !== -1) {
      console.warn(`[Shutdown] Handler "${name}" already registered, replacing`);
      this.handlers.splice(existing, 1);
    }

    this.handlers.push({ name, handler, priority });
    // Ordenar por prioridad descendente
    this.handlers.sort((a, b) => b.priority - a.priority);

    console.log(`[Shutdown] Handler registered: ${name} (priority: ${priority})`);
  }

  /**
   * Desregistra un handler
   */
  unregister(name: string): boolean {
    const index = this.handlers.findIndex((h) => h.name === name);
    if (index !== -1) {
      this.handlers.splice(index, 1);
      console.log(`[Shutdown] Handler unregistered: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Ejecuta el shutdown
   */
  async shutdown(signal: string): Promise<void> {
    if (this.status.isShuttingDown) {
      console.log('[Shutdown] Already shutting down...');
      return;
    }

    this.status.isShuttingDown = true;
    this.status.startedAt = new Date();
    this.status.signal = signal;

    console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
    console.log(`[Shutdown] ${this.handlers.length} handlers to execute`);

    // Timeout de seguridad
    const timeoutId = setTimeout(() => {
      console.error(`[Shutdown] Timeout exceeded (${this.config.timeoutMs}ms), forcing exit`);
      this.logStatus();
      process.exit(1);
    }, this.config.timeoutMs);

    // Ejecutar handlers en orden de prioridad
    for (const { name, handler } of this.handlers) {
      try {
        console.log(`[Shutdown] Running handler: ${name}`);
        const startTime = Date.now();

        await handler();

        const duration = Date.now() - startTime;
        console.log(`[Shutdown] Completed: ${name} (${duration}ms)`);
        this.status.handlersExecuted.push(name);
      } catch (error) {
        console.error(`[Shutdown] Error in handler ${name}:`, error);
        this.status.handlersFailed.push(name);

        if (!this.config.forceExitOnError) {
          clearTimeout(timeoutId);
          throw error;
        }
      }
    }

    clearTimeout(timeoutId);
    this.logStatus();

    console.log('[Shutdown] Graceful shutdown complete');
    process.exit(0);
  }

  /**
   * Inicializa los listeners de señales
   * Debe llamarse una vez al inicio del servidor
   */
  init(): void {
    if (this.isInitialized) {
      console.warn('[Shutdown] Already initialized');
      return;
    }

    for (const signal of this.config.signals) {
      process.on(signal, () => {
        this.shutdown(signal).catch((err) => {
          console.error(`[Shutdown] Fatal error during shutdown:`, err);
          process.exit(1);
        });
      });
    }

    // Handler para uncaughtException
    process.on('uncaughtException', (error) => {
      console.error('[Shutdown] Uncaught exception:', error);
      this.shutdown('uncaughtException').catch(() => {
        process.exit(1);
      });
    });

    // Handler para unhandledRejection
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Shutdown] Unhandled rejection:', reason);
      console.error('[Shutdown] Promise:', promise);
    });

    this.isInitialized = true;
    console.log(`[Shutdown] Initialized, listening for: ${this.config.signals.join(', ')}`);
  }

  /**
   * Obtiene el estado actual
   */
  getStatus(): ShutdownStatus {
    return { ...this.status };
  }

  /**
   * Obtiene la lista de handlers registrados
   */
  getHandlers(): Array<{ name: string; priority: number }> {
    return this.handlers.map(({ name, priority }) => ({ name, priority }));
  }

  /**
   * Log del estado final
   */
  private logStatus(): void {
    const duration = this.status.startedAt
      ? Date.now() - this.status.startedAt.getTime()
      : 0;

    console.log('[Shutdown] Status:', {
      signal: this.status.signal,
      durationMs: duration,
      executed: this.status.handlersExecuted.length,
      failed: this.status.handlersFailed.length,
      handlersExecuted: this.status.handlersExecuted,
      handlersFailed: this.status.handlersFailed,
    });
  }
}

// ============================================
// INSTANCIA SINGLETON
// ============================================

export const gracefulShutdown = new GracefulShutdown();

// ============================================
// REGISTRO AUTOMÁTICO DE SERVICIOS CORE
// ============================================

/**
 * Inicializa el graceful shutdown con handlers por defecto
 * Llama a esta función en el entry point del servidor
 *
 * Usa import() dinámicos para evitar dependencias circulares
 * y solo cargar módulos si existen.
 */
export async function initGracefulShutdown(): Promise<void> {
  // Handler para checkpoint service (si está disponible)
  try {
    const checkpointModule = await import(
      /* webpackIgnore: true */
      '../../features/ai/services/checkpoint.service'
    );
    if (checkpointModule.shutdownCheckpointService) {
      gracefulShutdown.register(
        'checkpoint',
        checkpointModule.shutdownCheckpointService,
        100 // Alta prioridad - guardar estado primero
      );
    }
  } catch (err) {
    // Checkpoint service no disponible, ignorar
    console.log('[Shutdown] Checkpoint service not available for shutdown handler');
  }

  // Handler para Redis (si está disponible)
  try {
    const redisModule = await import(
      /* webpackIgnore: true */
      './redis-rate-limiter'
    );
    if (redisModule.closeAllRedisConnections) {
      gracefulShutdown.register(
        'redis',
        redisModule.closeAllRedisConnections,
        90
      );
    }
  } catch (err) {
    // Redis no disponible, ignorar
    console.log('[Shutdown] Redis module not available for shutdown handler');
  }

  // Inicializar listeners
  gracefulShutdown.init();
}

/**
 * Versión síncrona para registro manual de handlers
 * Usa esta si ya tienes los módulos importados
 */
export function initGracefulShutdownSync(): void {
  gracefulShutdown.init();
}

// ============================================
// HELPERS
// ============================================

/**
 * Wrapper para ejecutar una operación con timeout
 * Útil para handlers que podrían bloquearse
 */
export async function withShutdownTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Shutdown operation "${operationName}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Verifica si el proceso está en shutdown
 */
export function isShuttingDown(): boolean {
  return gracefulShutdown.getStatus().isShuttingDown;
}

export default gracefulShutdown;
