/**
 * Bulkhead Pattern Implementation
 * MEJORA-2.3: Aislamiento de recursos
 *
 * El patrón Bulkhead limita la concurrencia de operaciones para prevenir
 * que un componente agote todos los recursos del sistema.
 *
 * Beneficios:
 * - Si RAG falla, no bloquea las llamadas LLM
 * - Si tool calls fallan, no afectan las respuestas
 * - Aislamiento entre componentes para mayor resiliencia
 *
 * Uso:
 * const llmBulkhead = getBulkhead('llm');
 * const result = await llmBulkhead.execute(async () => {
 *   return await openai.chat.completions.create(...);
 * });
 */

// ============================================
// TIPOS
// ============================================

export interface BulkheadConfig {
  /** Máximo de operaciones concurrentes */
  maxConcurrent: number;
  /** Máximo de operaciones en cola de espera */
  maxQueue: number;
  /** Timeout para operaciones esperando en cola (ms) */
  timeoutMs: number;
  /** Nombre descriptivo para logging */
  name?: string;
}

export interface BulkheadStats {
  /** Operaciones actualmente en ejecución */
  active: number;
  /** Operaciones en cola de espera */
  queued: number;
  /** Total de operaciones completadas exitosamente */
  completed: number;
  /** Total de operaciones rechazadas (cola llena) */
  rejected: number;
  /** Total de operaciones que expiraron en cola */
  timedOut: number;
  /** Total de operaciones que fallaron */
  failed: number;
}

export class BulkheadRejectedError extends Error {
  public readonly bulkheadName: string;
  public readonly reason: 'full' | 'timeout';

  constructor(bulkheadName: string, reason: 'full' | 'timeout') {
    super(`Bulkhead "${bulkheadName}" rejected: ${reason === 'full' ? 'queue is full' : 'timeout waiting for slot'}`);
    this.name = 'BulkheadRejectedError';
    this.bulkheadName = bulkheadName;
    this.reason = reason;
  }
}

interface QueuedOperation {
  resolve: (value: void) => void;
  reject: (reason: Error) => void;
  timeoutId: NodeJS.Timeout;
  enqueuedAt: number;
}

// ============================================
// BULKHEAD CLASS
// ============================================

export class Bulkhead {
  private name: string;
  private config: BulkheadConfig;
  private active: number = 0;
  private queue: QueuedOperation[] = [];
  private stats: BulkheadStats = {
    active: 0,
    queued: 0,
    completed: 0,
    rejected: 0,
    timedOut: 0,
    failed: 0,
  };

  constructor(name: string, config: Partial<BulkheadConfig> = {}) {
    this.name = name;
    this.config = {
      maxConcurrent: 10,
      maxQueue: 100,
      timeoutMs: 30000,
      name,
      ...config,
    };
  }

  /**
   * Ejecuta una operación dentro del bulkhead
   * @throws BulkheadRejectedError si la cola está llena o hay timeout
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      const result = await operation();
      this.stats.completed++;
      return result;
    } catch (error) {
      this.stats.failed++;
      throw error;
    } finally {
      this.release();
    }
  }

  /**
   * Intenta ejecutar sin esperar en cola
   * Retorna null si no hay slot disponible inmediatamente
   */
  async tryExecute<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.active >= this.config.maxConcurrent) {
      return null;
    }

    return this.execute(operation);
  }

  /**
   * Adquiere un slot de ejecución
   */
  private async acquire(): Promise<void> {
    // Si hay espacio, ejecutar inmediatamente
    if (this.active < this.config.maxConcurrent) {
      this.active++;
      this.stats.active = this.active;
      return;
    }

    // Si la cola está llena, rechazar
    if (this.queue.length >= this.config.maxQueue) {
      this.stats.rejected++;
      throw new BulkheadRejectedError(this.name, 'full');
    }

    // Encolar y esperar
    return new Promise<void>((resolve, reject) => {
      const enqueuedAt = Date.now();

      const timeoutId = setTimeout(() => {
        // Remover de la cola
        const index = this.queue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.stats.queued = this.queue.length;
          this.stats.timedOut++;
          reject(new BulkheadRejectedError(this.name, 'timeout'));
        }
      }, this.config.timeoutMs);

      const queuedOp: QueuedOperation = {
        resolve,
        reject,
        timeoutId,
        enqueuedAt,
      };

      this.queue.push(queuedOp);
      this.stats.queued = this.queue.length;
    });
  }

  /**
   * Libera un slot de ejecución
   */
  private release(): void {
    this.active--;
    this.stats.active = this.active;

    // Si hay operaciones en cola, activar la siguiente
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      clearTimeout(next.timeoutId);
      this.stats.queued = this.queue.length;

      // Log si estuvo mucho tiempo en cola
      const waitTime = Date.now() - next.enqueuedAt;
      if (waitTime > this.config.timeoutMs * 0.5) {
        console.warn(`[Bulkhead:${this.name}] Long queue wait: ${waitTime}ms`);
      }

      this.active++;
      this.stats.active = this.active;
      next.resolve();
    }
  }

  /**
   * Obtiene estadísticas del bulkhead
   */
  getStats(): BulkheadStats & { name: string; config: BulkheadConfig } {
    return {
      ...this.stats,
      name: this.name,
      config: this.config,
    };
  }

  /**
   * Resetea estadísticas (mantiene active y queued actuales)
   */
  resetStats(): void {
    this.stats = {
      active: this.active,
      queued: this.queue.length,
      completed: 0,
      rejected: 0,
      timedOut: 0,
      failed: 0,
    };
  }

  /**
   * Obtiene el porcentaje de uso actual
   */
  getUtilization(): number {
    return (this.active / this.config.maxConcurrent) * 100;
  }

  /**
   * Verifica si el bulkhead está saturado
   */
  isSaturated(): boolean {
    return this.active >= this.config.maxConcurrent;
  }

  /**
   * Verifica si la cola está llena
   */
  isQueueFull(): boolean {
    return this.queue.length >= this.config.maxQueue;
  }
}

// ============================================
// BULKHEADS PREDEFINIDOS
// ============================================

export const BULKHEAD_CONFIGS: Record<string, BulkheadConfig> = {
  // Para llamadas a LLM (OpenAI, Anthropic, etc.)
  llm: {
    maxConcurrent: 20,    // Máximo 20 llamadas LLM simultáneas
    maxQueue: 50,         // Hasta 50 en cola
    timeoutMs: 60000,     // 1 minuto máximo en cola
    name: 'llm',
  },

  // Para operaciones RAG (embeddings, búsqueda vectorial)
  rag: {
    maxConcurrent: 30,    // Más concurrencia para RAG (son más rápidas)
    maxQueue: 100,
    timeoutMs: 30000,     // 30 segundos
    name: 'rag',
  },

  // Para tool calls
  tools: {
    maxConcurrent: 50,    // Tools son generalmente rápidos
    maxQueue: 200,
    timeoutMs: 15000,     // 15 segundos
    name: 'tools',
  },

  // Para operaciones de base de datos
  database: {
    maxConcurrent: 100,   // Pool de conexiones
    maxQueue: 500,
    timeoutMs: 10000,     // 10 segundos
    name: 'database',
  },

  // Para webhooks entrantes
  webhooks: {
    maxConcurrent: 100,
    maxQueue: 1000,
    timeoutMs: 5000,      // 5 segundos (webhooks deben ser rápidos)
    name: 'webhooks',
  },

  // Para operaciones de embeddings específicamente
  embeddings: {
    maxConcurrent: 40,
    maxQueue: 150,
    timeoutMs: 45000,     // 45 segundos (batches pueden ser lentos)
    name: 'embeddings',
  },

  // Para envío de mensajes (WhatsApp, etc.)
  messaging: {
    maxConcurrent: 50,
    maxQueue: 300,
    timeoutMs: 20000,     // 20 segundos
    name: 'messaging',
  },
} as const;

// ============================================
// REGISTRO GLOBAL DE BULKHEADS
// ============================================

const bulkheads = new Map<string, Bulkhead>();

/**
 * Obtiene o crea un bulkhead por nombre
 * Los bulkheads predefinidos usan configuración optimizada
 */
export function getBulkhead(
  name: keyof typeof BULKHEAD_CONFIGS | string,
  customConfig?: Partial<BulkheadConfig>
): Bulkhead {
  const key = customConfig ? `${name}:${JSON.stringify(customConfig)}` : name;

  if (!bulkheads.has(key)) {
    const baseConfig = name in BULKHEAD_CONFIGS
      ? BULKHEAD_CONFIGS[name as keyof typeof BULKHEAD_CONFIGS]
      : { maxConcurrent: 10, maxQueue: 100, timeoutMs: 30000, name };

    const config = { ...baseConfig, ...customConfig };
    bulkheads.set(key, new Bulkhead(name, config));

    console.log(`[Bulkhead] Created: ${name}`, {
      maxConcurrent: config.maxConcurrent,
      maxQueue: config.maxQueue,
      timeoutMs: config.timeoutMs,
    });
  }

  return bulkheads.get(key)!;
}

/**
 * Obtiene estadísticas de todos los bulkheads
 */
export function getAllBulkheadStats(): Array<BulkheadStats & { name: string }> {
  return Array.from(bulkheads.values()).map((b) => b.getStats());
}

/**
 * Resetea estadísticas de todos los bulkheads
 */
export function resetAllBulkheadStats(): void {
  for (const bulkhead of bulkheads.values()) {
    bulkhead.resetStats();
  }
}

/**
 * Obtiene resumen de salud de todos los bulkheads
 */
export function getBulkheadHealthSummary(): {
  total: number;
  saturated: number;
  queuesFull: number;
  healthy: number;
} {
  const stats = {
    total: bulkheads.size,
    saturated: 0,
    queuesFull: 0,
    healthy: 0,
  };

  for (const bulkhead of bulkheads.values()) {
    if (bulkhead.isQueueFull()) {
      stats.queuesFull++;
    } else if (bulkhead.isSaturated()) {
      stats.saturated++;
    } else {
      stats.healthy++;
    }
  }

  return stats;
}

// ============================================
// DECORADOR (Para uso con clases)
// ============================================

/**
 * Decorador para ejecutar métodos dentro de un bulkhead
 *
 * @example
 * class AIService {
 *   @withBulkhead('llm')
 *   async generateResponse() { ... }
 * }
 */
export function withBulkhead(bulkheadName: keyof typeof BULKHEAD_CONFIGS | string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const bulkhead = getBulkhead(bulkheadName);
      return bulkhead.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Wrapper funcional para usar bulkhead con funciones
 *
 * @example
 * const protectedFetch = wrapWithBulkhead('rag', async () => {
 *   return fetch(url);
 * });
 */
export function wrapWithBulkhead<T>(
  bulkheadName: keyof typeof BULKHEAD_CONFIGS | string,
  operation: () => Promise<T>
): () => Promise<T> {
  return () => {
    const bulkhead = getBulkhead(bulkheadName);
    return bulkhead.execute(operation);
  };
}

export default Bulkhead;
