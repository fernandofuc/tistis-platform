/**
 * TIS TIS Platform - Rate Limit Migration Wrapper
 *
 * Este wrapper permite migrar gradualmente de rate-limit.ts a rate-limit-unified.ts.
 * Soporta "shadow mode" para comparar ambos sistemas sin afectar usuarios.
 */

import {
  checkRateLimit as checkOldRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from './rate-limit';

import {
  checkUnifiedRateLimit,
  type UnifiedRateLimitResult,
} from './rate-limit-unified';

import { getLogger } from './structured-logger';

const logger = getLogger();

// Flags de control (configurables via env)
const USE_NEW_RATE_LIMIT = process.env.USE_UNIFIED_RATE_LIMIT === 'true';
const SHADOW_MODE = process.env.RATE_LIMIT_SHADOW_MODE === 'true';
const LOG_COMPARISONS = process.env.RATE_LIMIT_LOG_COMPARISONS === 'true';

/**
 * Rate limit con soporte de migración gradual
 *
 * Comportamiento según flags:
 * - Default: Usa rate-limit.ts (antiguo)
 * - SHADOW_MODE=true: Ejecuta ambos, compara, usa resultado del antiguo
 * - USE_UNIFIED_RATE_LIMIT=true: Usa rate-limit-unified.ts (nuevo)
 */
export async function checkRateLimitMigration(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Si está activado el nuevo, usarlo directamente
  if (USE_NEW_RATE_LIMIT && !SHADOW_MODE) {
    const newResult = await checkUnifiedRateLimit(key, {
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      identifier: config.identifier,
    });
    return convertUnifiedToOld(newResult);
  }

  // Ejecutar el rate limiter antiguo (source of truth por ahora)
  const oldResult = checkOldRateLimit(key, config);

  // Si shadow mode está activo, ejecutar también el nuevo y comparar
  if (SHADOW_MODE) {
    try {
      const newResult = await checkUnifiedRateLimit(key, {
        limit: config.limit,
        windowSeconds: config.windowSeconds,
        identifier: config.identifier,
      });

      // Comparar resultados
      compareResults(key, config.identifier, oldResult, newResult);
    } catch (error) {
      // Si el nuevo falla, solo loggear, no afectar al usuario
      logger.warn('Shadow rate limit failed', {
        key: key.substring(0, 20) + '...', // No loggear key completa (puede contener IP)
        identifier: config.identifier,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Retornar resultado del antiguo (source of truth)
  return oldResult;
}

/**
 * Convierte resultado del nuevo formato al antiguo para compatibilidad
 */
function convertUnifiedToOld(result: UnifiedRateLimitResult): RateLimitResult {
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Compara resultados y loggea diferencias
 */
function compareResults(
  key: string,
  identifier: string,
  oldResult: RateLimitResult,
  newResult: UnifiedRateLimitResult
): void {
  const hasMismatch = oldResult.success !== newResult.success;

  if (hasMismatch) {
    logger.warn('Rate limit mismatch detected', {
      key: key.substring(0, 20) + '...', // No loggear key completa
      identifier,
      oldSuccess: oldResult.success,
      newSuccess: newResult.success,
      oldRemaining: oldResult.remaining,
      newRemaining: newResult.remaining,
      newSource: newResult.source,
    });
  } else if (LOG_COMPARISONS) {
    // Log exitoso solo si LOG_COMPARISONS está activo
    logger.debug('Rate limit comparison OK', {
      identifier,
      success: oldResult.success,
      source: newResult.source,
    });
  }
}

/**
 * Helper para migración: obtener resultado de ambos sin modificar estado
 * Útil para pruebas manuales
 */
export async function compareRateLimiters(
  key: string,
  config: RateLimitConfig
): Promise<{
  old: RateLimitResult;
  new: UnifiedRateLimitResult;
  match: boolean;
}> {
  const oldResult = checkOldRateLimit(key, config);
  const newResult = await checkUnifiedRateLimit(key, {
    limit: config.limit,
    windowSeconds: config.windowSeconds,
    identifier: config.identifier,
  });

  return {
    old: oldResult,
    new: newResult,
    match: oldResult.success === newResult.success,
  };
}

// Re-exportar tipos para compatibilidad
export type { RateLimitConfig, RateLimitResult };
