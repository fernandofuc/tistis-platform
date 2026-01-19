/**
 * CheckpointService - Gestión de persistencia LangGraph
 * MEJORA-2.1: Implementación completa
 *
 * Funcionalidades:
 * - Persistencia de estado del grafo
 * - Recuperación de conversaciones interrumpidas
 * - Limpieza automática de checkpoints antiguos
 * - Estadísticas y monitoreo
 *
 * Uso:
 * - Cada conversación usa su conversation_id como thread_id
 * - Los checkpoints se guardan automáticamente en cada paso del grafo
 * - Si el servidor falla, se puede resumir desde el último checkpoint
 */

import { Pool } from 'pg';

// ============================================
// TIPOS
// ============================================

export interface CheckpointConfig {
  connectionString: string;
  poolSize: number;
  cleanupIntervalMs: number;
  maxCheckpointAgeMs: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface CheckpointData {
  id: string;
  ts: string;
  channel_values: Record<string, unknown>;
  channel_versions: Record<string, number>;
  versions_seen: Record<string, Record<string, number>>;
  pending_sends: unknown[];
}

export interface CheckpointMetadata {
  source: string;
  step: number;
  writes: Record<string, unknown>;
  parents: Record<string, string>;
}

export interface ThreadState {
  threadId: string;
  lastCheckpointId: string;
  lastUpdated: Date;
  metadata: Record<string, unknown>;
}

export interface CheckpointTuple {
  config: { configurable: { thread_id: string; checkpoint_ns?: string; checkpoint_id?: string } };
  checkpoint: CheckpointData;
  metadata: CheckpointMetadata;
  parentConfig?: { configurable: { thread_id: string; checkpoint_id: string } };
}

export interface CheckpointStats {
  totalCheckpoints: number;
  totalThreads: number;
  oldestCheckpoint: Date | null;
  newestCheckpoint: Date | null;
  storageBytes: number;
}

// ============================================
// CONFIGURACIÓN POR DEFECTO
// ============================================

const DEFAULT_CONFIG: CheckpointConfig = {
  connectionString: process.env.DATABASE_URL || '',
  poolSize: 10,
  cleanupIntervalMs: 6 * 60 * 60 * 1000, // 6 horas
  maxCheckpointAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 días
  idleTimeoutMs: 30000,
  connectionTimeoutMs: 10000,
};

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class CheckpointService {
  private config: CheckpointConfig;
  private pool: Pool | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config?: Partial<CheckpointConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Inicializa el servicio y conexión a la base de datos
   * Thread-safe: múltiples llamadas concurrentes esperan la misma inicialización
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Si ya hay una inicialización en progreso, esperar
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    if (!this.config.connectionString) {
      console.warn('[Checkpoint] DATABASE_URL not configured, checkpointing disabled');
      return;
    }

    try {
      // Crear pool de conexiones
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.poolSize,
        idleTimeoutMillis: this.config.idleTimeoutMs,
        connectionTimeoutMillis: this.config.connectionTimeoutMs,
      });

      // Manejar errores del pool
      this.pool.on('error', (err) => {
        console.error('[Checkpoint] Pool error:', err);
      });

      // Verificar conexión
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        console.log('[Checkpoint] Database connection verified');
      } finally {
        client.release();
      }

      // Verificar que las tablas existen
      await this.verifyTables();

      // Iniciar limpieza periódica
      this.startCleanupSchedule();

      this.isInitialized = true;
      console.log('[Checkpoint] Service initialized successfully');
    } catch (error) {
      console.error('[Checkpoint] Initialization failed:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Verifica que las tablas de checkpoint existen
   */
  private async verifyTables(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'langgraph_checkpoints'
        ) as exists
      `);

      if (!result.rows[0]?.exists) {
        console.warn('[Checkpoint] Tables not found. Run migration 139_LANGGRAPH_CHECKPOINTS.sql');
      }
    } finally {
      client.release();
    }
  }

  /**
   * Verifica si el servicio está listo
   */
  isReady(): boolean {
    return this.isInitialized && this.pool !== null;
  }

  /**
   * Guarda un checkpoint
   */
  async putCheckpoint(
    threadId: string,
    checkpointNs: string,
    checkpoint: CheckpointData,
    metadata: CheckpointMetadata,
    parentCheckpointId?: string
  ): Promise<void> {
    if (!this.isReady()) {
      console.warn('[Checkpoint] Service not ready, skipping checkpoint save');
      return;
    }

    const client = await this.pool!.connect();
    try {
      await client.query(
        `INSERT INTO langgraph_checkpoints
         (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id)
         DO UPDATE SET checkpoint = $6, metadata = $7, created_at = NOW()`,
        [
          threadId,
          checkpointNs || '',
          checkpoint.id,
          parentCheckpointId || null,
          'checkpoint',
          JSON.stringify(checkpoint),
          JSON.stringify(metadata),
        ]
      );

      console.log('[Checkpoint] Saved:', { threadId, checkpointId: checkpoint.id });
    } catch (error) {
      console.error('[Checkpoint] Error saving:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Recupera el checkpoint más reciente de un thread
   */
  async getLatestCheckpoint(
    threadId: string,
    checkpointNs: string = ''
  ): Promise<CheckpointTuple | null> {
    if (!this.isReady()) {
      return null;
    }

    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `SELECT checkpoint_id, parent_checkpoint_id, checkpoint, metadata
         FROM langgraph_checkpoints
         WHERE thread_id = $1 AND checkpoint_ns = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [threadId, checkpointNs]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const checkpoint = typeof row.checkpoint === 'string'
        ? JSON.parse(row.checkpoint)
        : row.checkpoint;
      const metadata = typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata;

      console.log('[Checkpoint] Retrieved:', { threadId, checkpointId: row.checkpoint_id });

      return {
        config: {
          configurable: {
            thread_id: threadId,
            checkpoint_ns: checkpointNs,
            checkpoint_id: row.checkpoint_id,
          },
        },
        checkpoint,
        metadata,
        parentConfig: row.parent_checkpoint_id
          ? {
              configurable: {
                thread_id: threadId,
                checkpoint_id: row.parent_checkpoint_id,
              },
            }
          : undefined,
      };
    } catch (error) {
      console.error('[Checkpoint] Error retrieving:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Lista checkpoints de un thread
   */
  async listCheckpoints(
    threadId: string,
    limit: number = 10
  ): Promise<CheckpointTuple[]> {
    if (!this.isReady()) {
      return [];
    }

    const client = await this.pool!.connect();
    try {
      const result = await client.query(
        `SELECT checkpoint_ns, checkpoint_id, parent_checkpoint_id, checkpoint, metadata
         FROM langgraph_checkpoints
         WHERE thread_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [threadId, limit]
      );

      return result.rows.map((row) => {
        const checkpoint = typeof row.checkpoint === 'string'
          ? JSON.parse(row.checkpoint)
          : row.checkpoint;
        const metadata = typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata;

        return {
          config: {
            configurable: {
              thread_id: threadId,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.checkpoint_id,
            },
          },
          checkpoint,
          metadata,
          parentConfig: row.parent_checkpoint_id
            ? {
                configurable: {
                  thread_id: threadId,
                  checkpoint_id: row.parent_checkpoint_id,
                },
              }
            : undefined,
        };
      });
    } catch (error) {
      console.error('[Checkpoint] Error listing:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Guarda writes pendientes
   */
  async putWrites(
    threadId: string,
    checkpointNs: string,
    checkpointId: string,
    taskId: string,
    writes: Array<{ channel: string; value: unknown }>
  ): Promise<void> {
    if (!this.isReady() || writes.length === 0) {
      return;
    }

    const client = await this.pool!.connect();
    try {
      for (let idx = 0; idx < writes.length; idx++) {
        const write = writes[idx];
        await client.query(
          `INSERT INTO langgraph_checkpoint_writes
           (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
           DO UPDATE SET value = $8`,
          [
            threadId,
            checkpointNs || '',
            checkpointId,
            taskId,
            idx,
            write.channel,
            'write',
            JSON.stringify(write.value),
          ]
        );
      }
    } catch (error) {
      console.error('[Checkpoint] Error saving writes:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Elimina todos los checkpoints de un thread
   */
  async deleteThread(threadId: string): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'DELETE FROM langgraph_checkpoint_writes WHERE thread_id = $1',
        [threadId]
      );
      await client.query(
        'DELETE FROM langgraph_checkpoint_blobs WHERE thread_id = $1',
        [threadId]
      );
      await client.query(
        'DELETE FROM langgraph_checkpoints WHERE thread_id = $1',
        [threadId]
      );

      await client.query('COMMIT');
      console.log('[Checkpoint] Deleted thread:', threadId);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Checkpoint] Error deleting thread:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtiene threads activos (con checkpoints recientes)
   */
  async getActiveThreads(limit: number = 100): Promise<ThreadState[]> {
    if (!this.isReady()) {
      return [];
    }

    const client = await this.pool!.connect();
    try {
      // Subquery para obtener el checkpoint más reciente de cada thread,
      // luego ordenar por created_at para obtener los threads más activos
      const result = await client.query(
        `SELECT thread_id, checkpoint_id, created_at, metadata
         FROM (
           SELECT DISTINCT ON (thread_id)
             thread_id,
             checkpoint_id,
             created_at,
             metadata
           FROM langgraph_checkpoints
           ORDER BY thread_id, created_at DESC
         ) AS latest_per_thread
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map((row) => ({
        threadId: row.thread_id,
        lastCheckpointId: row.checkpoint_id,
        lastUpdated: new Date(row.created_at),
        metadata: typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata || {},
      }));
    } catch (error) {
      console.error('[Checkpoint] Error getting active threads:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Limpia checkpoints antiguos
   */
  async cleanupOldCheckpoints(): Promise<number> {
    if (!this.isReady()) {
      return 0;
    }

    const client = await this.pool!.connect();
    try {
      const result = await client.query('SELECT cleanup_old_checkpoints()');
      const deletedCount = result.rows[0]?.cleanup_old_checkpoints || 0;

      console.log('[Checkpoint] Cleanup completed:', { deletedCount });
      return deletedCount;
    } catch (error) {
      console.error('[Checkpoint] Error during cleanup:', error);
      return 0;
    } finally {
      client.release();
    }
  }

  /**
   * Inicia schedule de limpieza periódica
   */
  private startCleanupSchedule(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldCheckpoints().catch((err) => {
          console.error('[Checkpoint] Scheduled cleanup failed:', err);
        });
      },
      this.config.cleanupIntervalMs
    );

    // No prevenir que el proceso termine
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }

    console.log('[Checkpoint] Cleanup schedule started:', {
      intervalMs: this.config.cleanupIntervalMs,
    });
  }

  /**
   * Obtiene estadísticas del servicio
   */
  async getStats(): Promise<CheckpointStats> {
    if (!this.isReady()) {
      return {
        totalCheckpoints: 0,
        totalThreads: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
        storageBytes: 0,
      };
    }

    const client = await this.pool!.connect();
    try {
      const [countResult, dateResult, sizeResult] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) as total_checkpoints,
            COUNT(DISTINCT thread_id) as total_threads
          FROM langgraph_checkpoints
        `),
        client.query(`
          SELECT
            MIN(created_at) as oldest,
            MAX(created_at) as newest
          FROM langgraph_checkpoints
        `),
        client.query(`
          SELECT
            COALESCE(pg_total_relation_size('langgraph_checkpoints'), 0) +
            COALESCE(pg_total_relation_size('langgraph_checkpoint_writes'), 0) +
            COALESCE(pg_total_relation_size('langgraph_checkpoint_blobs'), 0) as size
        `),
      ]);

      return {
        totalCheckpoints: parseInt(countResult.rows[0]?.total_checkpoints || '0'),
        totalThreads: parseInt(countResult.rows[0]?.total_threads || '0'),
        oldestCheckpoint: dateResult.rows[0]?.oldest
          ? new Date(dateResult.rows[0].oldest)
          : null,
        newestCheckpoint: dateResult.rows[0]?.newest
          ? new Date(dateResult.rows[0].newest)
          : null,
        storageBytes: parseInt(sizeResult.rows[0]?.size || '0'),
      };
    } catch (error) {
      console.error('[Checkpoint] Error getting stats:', error);
      return {
        totalCheckpoints: 0,
        totalThreads: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
        storageBytes: 0,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Cierra todas las conexiones
   */
  async shutdown(): Promise<void> {
    console.log('[Checkpoint] Shutting down...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    this.isInitialized = false;
    this.initializationPromise = null;

    console.log('[Checkpoint] Shutdown complete');
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let checkpointServiceInstance: CheckpointService | null = null;

/**
 * Obtiene la instancia singleton del servicio de checkpoints
 * Inicializa automáticamente si es necesario
 */
export async function getCheckpointService(
  config?: Partial<CheckpointConfig>
): Promise<CheckpointService> {
  if (!checkpointServiceInstance) {
    checkpointServiceInstance = new CheckpointService(config);
  }

  // Inicializar si aún no está listo
  if (!checkpointServiceInstance.isReady()) {
    await checkpointServiceInstance.initialize();
  }

  return checkpointServiceInstance;
}

/**
 * Cierra el servicio de checkpoints (para graceful shutdown)
 */
export async function shutdownCheckpointService(): Promise<void> {
  if (checkpointServiceInstance) {
    await checkpointServiceInstance.shutdown();
    checkpointServiceInstance = null;
  }
}

/**
 * Verifica si el servicio está disponible sin inicializarlo
 */
export function isCheckpointServiceReady(): boolean {
  return checkpointServiceInstance?.isReady() ?? false;
}

export default CheckpointService;
