// =====================================================
// TIS TIS PLATFORM - AI Circuit Breaker
// Maneja fallback automático de V7 a Legacy en caso de errores
// =====================================================
// Este circuit breaker implementa el patrón de protección:
// - Si V7 falla repetidamente, cambia automáticamente a Legacy
// - Después de un tiempo, intenta volver a V7
// - Provee métricas de monitoreo
// =====================================================

// ======================
// CONFIGURATION
// ======================

interface CircuitBreakerConfig {
  /** Número de fallos consecutivos antes de abrir el circuito */
  failureThreshold: number;
  /** Tiempo en ms antes de intentar cerrar el circuito (half-open state) */
  resetTimeoutMs: number;
  /** Nombre del circuito para logs */
  name: string;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minuto
  name: 'AICircuitBreaker',
};

// ======================
// CIRCUIT STATES
// ======================

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitMetrics {
  state: CircuitState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  lastError: string | null;
  openedAt: Date | null;
  halfOpenAttempts: number;
}

// ======================
// CIRCUIT BREAKER CLASS
// ======================

/**
 * Circuit Breaker para proteger el sistema AI
 *
 * Estados:
 * - CLOSED: Operación normal, V7 se usa
 * - OPEN: V7 falló repetidamente, usando Legacy directamente
 * - HALF-OPEN: Probando si V7 se recuperó
 *
 * Flujo:
 * 1. CLOSED: V7 se ejecuta normalmente
 * 2. Si V7 falla N veces consecutivas -> OPEN
 * 3. OPEN: Legacy se usa directamente (sin intentar V7)
 * 4. Después de timeout -> HALF-OPEN
 * 5. HALF-OPEN: Intenta V7 una vez
 *    - Si éxito -> CLOSED
 *    - Si falla -> OPEN (reinicia timer)
 */
export class AICircuitBreaker {
  private config: CircuitBreakerConfig;
  private metrics: CircuitMetrics;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      state: 'closed',
      consecutiveFailures: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastError: null,
      openedAt: null,
      halfOpenAttempts: 0,
    };
  }

  /**
   * Obtiene el estado actual del circuito
   */
  getState(): CircuitState {
    // Verificar si debemos pasar de OPEN a HALF-OPEN
    if (this.metrics.state === 'open' && this.metrics.openedAt) {
      const timeSinceOpen = Date.now() - this.metrics.openedAt.getTime();
      if (timeSinceOpen >= this.config.resetTimeoutMs) {
        console.log(`[${this.config.name}] Transitioning from OPEN to HALF-OPEN after ${timeSinceOpen}ms`);
        this.metrics.state = 'half-open';
        this.metrics.halfOpenAttempts = 0;
      }
    }
    return this.metrics.state;
  }

  /**
   * Obtiene métricas completas del circuito
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * Registra un éxito
   */
  recordSuccess(): void {
    this.metrics.consecutiveFailures = 0;
    this.metrics.totalSuccesses++;
    this.metrics.lastSuccessTime = new Date();

    if (this.metrics.state === 'half-open') {
      console.log(`[${this.config.name}] Success in HALF-OPEN state, closing circuit`);
      this.metrics.state = 'closed';
      this.metrics.openedAt = null;
    }
  }

  /**
   * Registra un fallo
   */
  recordFailure(error: Error | string): void {
    this.metrics.consecutiveFailures++;
    this.metrics.totalFailures++;
    this.metrics.lastFailureTime = new Date();
    this.metrics.lastError = error instanceof Error ? error.message : error;

    if (this.metrics.state === 'half-open') {
      console.log(`[${this.config.name}] Failure in HALF-OPEN state, reopening circuit`);
      this.metrics.state = 'open';
      this.metrics.openedAt = new Date();
      this.metrics.halfOpenAttempts++;
    } else if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
      console.log(
        `[${this.config.name}] Failure threshold reached (${this.metrics.consecutiveFailures}), opening circuit`
      );
      this.metrics.state = 'open';
      this.metrics.openedAt = new Date();
    }
  }

  /**
   * Verifica si se puede intentar la operación principal
   */
  canAttemptPrimary(): boolean {
    const state = this.getState();
    return state === 'closed' || state === 'half-open';
  }

  /**
   * Reinicia el circuito (para testing o recuperación manual)
   */
  reset(): void {
    console.log(`[${this.config.name}] Circuit manually reset`);
    this.metrics = {
      state: 'closed',
      consecutiveFailures: 0,
      totalFailures: this.metrics.totalFailures, // Mantener histórico
      totalSuccesses: this.metrics.totalSuccesses,
      lastFailureTime: this.metrics.lastFailureTime,
      lastSuccessTime: this.metrics.lastSuccessTime,
      lastError: null,
      openedAt: null,
      halfOpenAttempts: 0,
    };
  }

  /**
   * Ejecuta una operación con fallback automático
   *
   * @param primaryFn - Función principal (V7)
   * @param fallbackFn - Función de fallback (Legacy)
   * @returns Resultado de la función que se ejecutó
   */
  async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<{ result: T; usedFallback: boolean }> {
    const state = this.getState();

    // Si el circuito está abierto, usar fallback directamente
    if (state === 'open') {
      console.log(`[${this.config.name}] Circuit OPEN, using fallback directly`);
      const result = await fallbackFn();
      return { result, usedFallback: true };
    }

    // Intentar función principal
    try {
      if (state === 'half-open') {
        console.log(`[${this.config.name}] Circuit HALF-OPEN, testing primary function`);
      }

      const result = await primaryFn();
      this.recordSuccess();
      return { result, usedFallback: false };
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : String(error));

      console.warn(
        `[${this.config.name}] Primary function failed, using fallback. ` +
        `Consecutive failures: ${this.metrics.consecutiveFailures}/${this.config.failureThreshold}`
      );

      // Intentar fallback
      try {
        const result = await fallbackFn();
        return { result, usedFallback: true };
      } catch (fallbackError) {
        // Si el fallback también falla, propagar el error
        console.error(`[${this.config.name}] Fallback also failed:`, fallbackError);
        throw fallbackError;
      }
    }
  }
}

// ======================
// SINGLETON INSTANCE
// ======================

let _instance: AICircuitBreaker | null = null;

/**
 * Obtiene la instancia singleton del circuit breaker
 */
export function getAICircuitBreaker(): AICircuitBreaker {
  if (!_instance) {
    _instance = new AICircuitBreaker({
      failureThreshold: parseInt(process.env.AI_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
      resetTimeoutMs: parseInt(process.env.AI_CIRCUIT_BREAKER_RESET_MS || '60000', 10),
      name: 'AICircuitBreaker',
    });
  }
  return _instance;
}

/**
 * Reinicia el circuit breaker (para testing)
 */
export function resetAICircuitBreaker(): void {
  if (_instance) {
    _instance.reset();
  }
}

// ======================
// CONVENIENCE FUNCTION
// ======================

/**
 * Ejecuta una función AI con circuit breaker y fallback automático
 *
 * Uso:
 * ```typescript
 * const { result, usedFallback } = await executeWithCircuitBreaker(
 *   () => generateAIResponseV7(tenantId, message, options),
 *   () => generateAIResponseLegacy(tenantId, conversationId, message)
 * );
 * ```
 */
export async function executeWithCircuitBreaker<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<{ result: T; usedFallback: boolean }> {
  const circuitBreaker = getAICircuitBreaker();
  return circuitBreaker.executeWithFallback(primaryFn, fallbackFn);
}

// ======================
// MONITORING HELPERS
// ======================

/**
 * Obtiene estadísticas del circuit breaker para monitoreo
 */
export function getCircuitBreakerStats(): {
  state: CircuitState;
  healthPercentage: number;
  metrics: CircuitMetrics;
} {
  const circuitBreaker = getAICircuitBreaker();
  const metrics = circuitBreaker.getMetrics();

  const total = metrics.totalSuccesses + metrics.totalFailures;
  const healthPercentage = total > 0 ? (metrics.totalSuccesses / total) * 100 : 100;

  return {
    state: circuitBreaker.getState(),
    healthPercentage: Math.round(healthPercentage * 100) / 100,
    metrics,
  };
}
