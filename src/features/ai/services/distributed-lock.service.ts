// =====================================================
// TIS TIS PLATFORM - Distributed Lock Service
// REVISIÓN 5.2 G-B1 - Sistema de Locks Distribuidos
// =====================================================
// Este servicio proporciona locks distribuidos usando la base
// de datos para evitar condiciones de carrera en CRON jobs.
//
// Usa una tabla system_locks con locks advisory de PostgreSQL
// para garantizar atomicidad y TTL automático.
// =====================================================

import { createClient } from '@supabase/supabase-js';

// ======================
// TYPES
// ======================

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  alreadyLockedBy?: string;
  expiresAt?: Date;
}

export interface LockConfig {
  ttlMinutes?: number;      // Default: 10 minutes
  waitTimeMs?: number;      // Time to wait if lock exists (default: 0 = don't wait)
  retryIntervalMs?: number; // Interval between retries (default: 1000ms)
}

const DEFAULT_CONFIG: Required<LockConfig> = {
  ttlMinutes: 10,
  waitTimeMs: 0,
  retryIntervalMs: 1000,
};

// ======================
// LOCK SERVICE
// ======================

/**
 * REVISIÓN 5.2 G-B1: Servicio de locks distribuidos
 *
 * Usa la tabla system_locks (creada por migración) para coordinar
 * acceso exclusivo a recursos entre múltiples instancias.
 *
 * Características:
 * - TTL automático (locks expiran si no se liberan)
 * - Detección de locks huérfanos
 * - Operaciones atómicas usando transacciones
 * - Identificación del holder del lock
 */
export class DistributedLockService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('[DistributedLock] Supabase credentials not configured');
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey);
  }

  /**
   * Intenta adquirir un lock para el recurso especificado
   *
   * @param lockName - Nombre único del lock (ej: 'cron-generate-insights')
   * @param acquiredBy - Identificador del proceso que adquiere (ej: 'cron-instance-1')
   * @param config - Configuración del lock
   * @returns Resultado de la operación
   */
  async acquireLock(
    lockName: string,
    acquiredBy: string,
    config: LockConfig = {}
  ): Promise<LockResult> {
    const { ttlMinutes, waitTimeMs, retryIntervalMs } = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();

    while (true) {
      const result = await this.tryAcquireLock(lockName, acquiredBy, ttlMinutes);

      if (result.acquired) {
        return result;
      }

      // Si no debemos esperar, retornar inmediatamente
      if (waitTimeMs === 0 || Date.now() - startTime >= waitTimeMs) {
        return result;
      }

      // Esperar antes de reintentar
      await this.sleep(retryIntervalMs);
    }
  }

  /**
   * Intento único de adquirir el lock (sin retry)
   */
  private async tryAcquireLock(
    lockName: string,
    acquiredBy: string,
    ttlMinutes: number
  ): Promise<LockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    try {
      // 1. Intentar insertar el lock
      const { data: insertData, error: insertError } = await this.supabase
        .from('system_locks')
        .insert({
          lock_name: lockName,
          acquired_by: acquiredBy,
          acquired_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single();

      if (!insertError && insertData) {
        // Lock adquirido exitosamente
        console.log(`[DistributedLock] Lock '${lockName}' acquired by '${acquiredBy}'`);
        return {
          acquired: true,
          lockId: insertData.id,
          expiresAt,
        };
      }

      // 2. Si falla por constraint único, verificar si el lock existente expiró
      if (insertError?.code === '23505') {
        const expiredLock = await this.tryClaimExpiredLock(lockName, acquiredBy, ttlMinutes);
        if (expiredLock.acquired) {
          return expiredLock;
        }

        // Lock activo existe, obtener info
        const { data: existingLock } = await this.supabase
          .from('system_locks')
          .select('acquired_by, expires_at')
          .eq('lock_name', lockName)
          .single();

        return {
          acquired: false,
          alreadyLockedBy: existingLock?.acquired_by,
          expiresAt: existingLock?.expires_at ? new Date(existingLock.expires_at) : undefined,
        };
      }

      // Otro tipo de error
      console.error(`[DistributedLock] Error acquiring lock '${lockName}':`, insertError);
      return { acquired: false };

    } catch (error) {
      console.error(`[DistributedLock] Exception acquiring lock '${lockName}':`, error);
      return { acquired: false };
    }
  }

  /**
   * Intenta reclamar un lock expirado
   */
  private async tryClaimExpiredLock(
    lockName: string,
    acquiredBy: string,
    ttlMinutes: number
  ): Promise<LockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    // Operación optimista: DELETE + INSERT
    // Si otro proceso reclamó el lock entre DELETE e INSERT,
    // el INSERT fallará por constraint único (23505) y retornaremos acquired: false
    const { data: deleted, error: deleteError } = await this.supabase
      .from('system_locks')
      .delete()
      .eq('lock_name', lockName)
      .lt('expires_at', now.toISOString())
      .select('id');

    if (deleteError || !deleted || deleted.length === 0) {
      // No había lock expirado para reclamar
      return { acquired: false };
    }

    // Lock expirado eliminado, intentar insertar el nuevo
    const { data: insertData, error: insertError } = await this.supabase
      .from('system_locks')
      .insert({
        lock_name: lockName,
        acquired_by: acquiredBy,
        acquired_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (!insertError && insertData) {
      console.log(`[DistributedLock] Lock '${lockName}' claimed from expired holder by '${acquiredBy}'`);
      return {
        acquired: true,
        lockId: insertData.id,
        expiresAt,
      };
    }

    return { acquired: false };
  }

  /**
   * Libera un lock previamente adquirido
   *
   * @param lockName - Nombre del lock a liberar
   * @param acquiredBy - Debe coincidir con quien lo adquirió (seguridad)
   */
  async releaseLock(lockName: string, acquiredBy: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('system_locks')
        .delete()
        .eq('lock_name', lockName)
        .eq('acquired_by', acquiredBy)
        .select('id');

      if (error) {
        console.error(`[DistributedLock] Error releasing lock '${lockName}':`, error);
        return false;
      }

      const released = data && data.length > 0;
      if (released) {
        console.log(`[DistributedLock] Lock '${lockName}' released by '${acquiredBy}'`);
      } else {
        console.warn(`[DistributedLock] Lock '${lockName}' not found or not owned by '${acquiredBy}'`);
      }

      return released;
    } catch (error) {
      console.error(`[DistributedLock] Exception releasing lock '${lockName}':`, error);
      return false;
    }
  }

  /**
   * Extiende el TTL de un lock existente
   * Útil para operaciones largas que necesitan más tiempo
   *
   * @param lockName - Nombre del lock
   * @param acquiredBy - Debe coincidir con quien lo adquirió
   * @param additionalMinutes - Minutos adicionales a añadir
   */
  async extendLock(
    lockName: string,
    acquiredBy: string,
    additionalMinutes: number
  ): Promise<boolean> {
    try {
      const newExpiresAt = new Date(Date.now() + additionalMinutes * 60 * 1000);

      const { data, error } = await this.supabase
        .from('system_locks')
        .update({
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('lock_name', lockName)
        .eq('acquired_by', acquiredBy)
        .gt('expires_at', new Date().toISOString()) // Solo si no ha expirado
        .select('id');

      if (error) {
        console.error(`[DistributedLock] Error extending lock '${lockName}':`, error);
        return false;
      }

      const extended = data && data.length > 0;
      if (extended) {
        console.log(`[DistributedLock] Lock '${lockName}' extended until ${newExpiresAt.toISOString()}`);
      }

      return extended;
    } catch (error) {
      console.error(`[DistributedLock] Exception extending lock '${lockName}':`, error);
      return false;
    }
  }

  /**
   * Verifica si un lock está activo (no expirado)
   */
  async isLocked(lockName: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('system_locks')
        .select('id')
        .eq('lock_name', lockName)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error?.code === 'PGRST116') {
        // No rows found = not locked
        return false;
      }

      return !!data;
    } catch (error) {
      console.error(`[DistributedLock] Exception checking lock '${lockName}':`, error);
      return false; // Assume not locked on error
    }
  }

  /**
   * Limpia locks expirados (mantenimiento)
   * Llamar periódicamente para limpiar locks huérfanos
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('system_locks')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('[DistributedLock] Error cleaning up expired locks:', error);
        return 0;
      }

      const count = data?.length || 0;
      if (count > 0) {
        console.log(`[DistributedLock] Cleaned up ${count} expired locks`);
      }

      return count;
    } catch (error) {
      console.error('[DistributedLock] Exception cleaning up locks:', error);
      return 0;
    }
  }

  /**
   * Helper: Ejecutar función con lock automático
   * Adquiere lock, ejecuta función, libera lock
   */
  async withLock<T>(
    lockName: string,
    acquiredBy: string,
    fn: () => Promise<T>,
    config: LockConfig = {}
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const lockResult = await this.acquireLock(lockName, acquiredBy, config);

    if (!lockResult.acquired) {
      return {
        success: false,
        error: `Could not acquire lock '${lockName}'. Already held by: ${lockResult.alreadyLockedBy}`,
      };
    }

    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    } finally {
      await this.releaseLock(lockName, acquiredBy);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ======================
// LOCK NAMES CONSTANTS
// ======================

export const LOCK_NAMES = {
  CRON_GENERATE_INSIGHTS: 'cron-generate-insights',
  CRON_PROCESS_LEARNING: 'cron-process-learning',
  CRON_APPOINTMENT_REMINDERS: 'cron-appointment-reminders',
  CRON_LOYALTY_MESSAGES: 'cron-loyalty-messages',
  CRON_PROCESS_TRIALS: 'cron-process-trials',
} as const;

// ======================
// SINGLETON INSTANCE
// ======================

let _instance: DistributedLockService | null = null;

export function getDistributedLockService(): DistributedLockService {
  if (!_instance) {
    _instance = new DistributedLockService();
  }
  return _instance;
}

// ======================
// EXPORTS
// ======================

export const DistributedLock = {
  getInstance: getDistributedLockService,
  LOCK_NAMES,
};
