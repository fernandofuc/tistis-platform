/**
 * Dead Letter Queue Service
 * MEJORA-2.4: Gestión de mensajes fallidos
 *
 * Funcionalidades:
 * - Almacenar mensajes que fallaron para investigación
 * - Deduplicación automática de mensajes similares
 * - Sistema de retry con backoff
 * - Estadísticas y monitoreo
 * - Archivado automático de mensajes antiguos
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================
// TIPOS
// ============================================

export interface DLQMessage {
  id: string;
  tenantId: string;
  conversationId?: string;
  contactId?: string;
  originalMessage: string;
  originalPayload: Record<string, unknown>;
  errorMessage: string;
  errorCode?: string;
  errorStack?: string;
  failureCount: number;
  channel?: string;
  processingStage: ProcessingStage;
  status: DLQStatus;
  lastAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export type ProcessingStage =
  | 'webhook'
  | 'ai_processing'
  | 'response_sending'
  | 'tool_execution';

export type DLQStatus = 'pending' | 'retrying' | 'resolved' | 'archived';

export interface AddToDLQParams {
  tenantId: string;
  conversationId?: string;
  contactId?: string;
  originalMessage: string;
  originalPayload?: Record<string, unknown>;
  error: Error;
  channel?: string;
  processingStage: ProcessingStage;
}

export interface DLQStats {
  pending: number;
  retrying: number;
  resolved: number;
  archived: number;
  avgFailureCount: number;
  oldestPending?: Date;
  newestPending?: Date;
}

export interface RetryResult {
  success: boolean;
  messageId: string;
  error?: string;
}

// ============================================
// CONFIGURACIÓN
// ============================================

const DLQ_CONFIG = {
  maxRetries: 5,
  retryDelayMinutes: 5,
  archiveAfterDays: 30,
} as const;

// ============================================
// SERVICIO
// ============================================

export class DeadLetterQueueService {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    } else {
      // Crear cliente con service role para operaciones de sistema
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('[DLQ] Missing Supabase configuration');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Añade un mensaje a la DLQ
   * Implementa deduplicación automática para evitar duplicados
   */
  async addMessage(params: AddToDLQParams): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc('add_to_dead_letter_queue', {
        p_tenant_id: params.tenantId,
        p_conversation_id: params.conversationId || null,
        p_contact_id: params.contactId || null,
        p_original_message: params.originalMessage,
        p_original_payload: params.originalPayload || {},
        p_error_message: params.error.message,
        p_error_code: (params.error as NodeJS.ErrnoException).code || null,
        p_error_stack: params.error.stack || null,
        p_channel: params.channel || null,
        p_processing_stage: params.processingStage,
      });

      if (error) {
        console.error('[DLQ] Error adding message:', error);
        return null;
      }

      console.log('[DLQ] Message added:', {
        id: data,
        tenantId: params.tenantId,
        stage: params.processingStage,
        errorMessage: params.error.message.substring(0, 100),
      });

      return data as string;
    } catch (err) {
      console.error('[DLQ] Exception adding message:', err);
      return null;
    }
  }

  /**
   * Obtiene mensajes pendientes para retry
   * Usa locking para evitar procesamiento duplicado
   */
  async getMessagesForRetry(
    tenantId: string,
    limit: number = 10
  ): Promise<DLQMessage[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_dlq_messages_for_retry', {
        p_tenant_id: tenantId,
        p_limit: limit,
      });

      if (error) {
        console.error('[DLQ] Error getting messages for retry:', error);
        return [];
      }

      return (data || []).map(this.mapToMessage);
    } catch (err) {
      console.error('[DLQ] Exception getting messages for retry:', err);
      return [];
    }
  }

  /**
   * Obtiene un mensaje específico por ID
   */
  async getMessage(id: string): Promise<DLQMessage | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_dead_letter_queue')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        if (error) {
          console.warn('[DLQ] Error getting message by ID:', { id, error: error.message });
        }
        return null;
      }

      return this.mapToMessage(data);
    } catch (err) {
      console.error('[DLQ] Exception getting message:', { id, error: err });
      return null;
    }
  }

  /**
   * Lista mensajes con filtros
   */
  async listMessages(
    tenantId: string,
    options?: {
      status?: DLQStatus;
      processingStage?: ProcessingStage;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ messages: DLQMessage[]; total: number }> {
    try {
      let query = this.supabase
        .from('ai_dead_letter_queue')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      if (options?.status) {
        query = query.eq('status', options.status);
      }

      if (options?.processingStage) {
        query = query.eq('processing_stage', options.processingStage);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(
          options?.offset || 0,
          (options?.offset || 0) + (options?.limit || 50) - 1
        );

      const { data, error, count } = await query;

      if (error) {
        console.error('[DLQ] Error listing messages:', error);
        return { messages: [], total: 0 };
      }

      return {
        messages: (data || []).map(this.mapToMessage),
        total: count || 0,
      };
    } catch (err) {
      console.error('[DLQ] Exception listing messages:', err);
      return { messages: [], total: 0 };
    }
  }

  /**
   * Marca un mensaje como en proceso de retry
   */
  async markAsRetrying(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ai_dead_letter_queue')
        .update({
          status: 'retrying',
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.warn('[DLQ] Error marking as retrying:', { id, error: error.message });
      }
      return !error;
    } catch (err) {
      console.error('[DLQ] Exception marking as retrying:', { id, error: err });
      return false;
    }
  }

  /**
   * Marca un mensaje como resuelto
   */
  async markAsResolved(
    id: string,
    notes?: string,
    resolvedBy?: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ai_dead_letter_queue')
        .update({
          status: 'resolved',
          resolution_notes: notes || null,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy || null,
        })
        .eq('id', id);

      if (!error) {
        console.log('[DLQ] Message resolved:', { id, notes });
      } else {
        console.warn('[DLQ] Error resolving message:', { id, error: error.message });
      }

      return !error;
    } catch (err) {
      console.error('[DLQ] Exception resolving message:', { id, error: err });
      return false;
    }
  }

  /**
   * Incrementa contador de fallos y vuelve a pending
   * Se usa cuando un retry falla
   */
  async incrementFailureAndReset(id: string, newError: Error): Promise<boolean> {
    try {
      // Primero obtener el mensaje actual
      const message = await this.getMessage(id);
      if (!message) return false;

      // Si ya alcanzó el límite, archivar
      if (message.failureCount >= DLQ_CONFIG.maxRetries - 1) {
        return this.markAsArchived(id);
      }

      const { error } = await this.supabase
        .from('ai_dead_letter_queue')
        .update({
          status: 'pending',
          failure_count: message.failureCount + 1,
          error_message: newError.message,
          error_stack: newError.stack || null,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.warn('[DLQ] Error incrementing failure:', { id, error: error.message });
      }
      return !error;
    } catch (err) {
      console.error('[DLQ] Exception incrementing failure:', { id, error: err });
      return false;
    }
  }

  /**
   * Archiva un mensaje
   */
  async markAsArchived(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ai_dead_letter_queue')
        .update({ status: 'archived' })
        .eq('id', id);

      if (!error) {
        console.log('[DLQ] Message archived:', { id });
      } else {
        console.warn('[DLQ] Error archiving message:', { id, error: error.message });
      }

      return !error;
    } catch (err) {
      console.error('[DLQ] Exception archiving message:', { id, error: err });
      return false;
    }
  }

  /**
   * Archiva mensajes antiguos o con demasiados fallos
   */
  async archiveOldMessages(
    daysOld: number = DLQ_CONFIG.archiveAfterDays,
    maxFailures: number = DLQ_CONFIG.maxRetries
  ): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('archive_old_dlq_messages', {
        p_days_old: daysOld,
        p_max_failures: maxFailures,
      });

      if (error) {
        console.error('[DLQ] Error archiving messages:', error);
        return 0;
      }

      const archivedCount = data || 0;
      if (archivedCount > 0) {
        console.log('[DLQ] Archived messages:', { count: archivedCount });
      }

      return archivedCount;
    } catch (err) {
      console.error('[DLQ] Exception archiving messages:', err);
      return 0;
    }
  }

  /**
   * Obtiene estadísticas de la DLQ para un tenant
   */
  async getStats(tenantId: string): Promise<DLQStats> {
    try {
      const { data, error } = await this.supabase.rpc('get_dlq_stats', {
        p_tenant_id: tenantId,
      });

      if (error || !data) {
        return this.getEmptyStats();
      }

      const stats: DLQStats = {
        pending: 0,
        retrying: 0,
        resolved: 0,
        archived: 0,
        avgFailureCount: 0,
      };

      let totalAvgFailures = 0;
      let statusCount = 0;

      for (const row of data as Array<{
        status: string;
        count: number;
        avg_failures: number;
        oldest_created_at: string;
        newest_created_at: string;
      }>) {
        const count = Number(row.count);
        stats[row.status as keyof Pick<DLQStats, 'pending' | 'retrying' | 'resolved' | 'archived'>] = count;

        if (row.status === 'pending') {
          stats.oldestPending = row.oldest_created_at ? new Date(row.oldest_created_at) : undefined;
          stats.newestPending = row.newest_created_at ? new Date(row.newest_created_at) : undefined;
        }

        totalAvgFailures += Number(row.avg_failures || 0);
        statusCount++;
      }

      stats.avgFailureCount = statusCount > 0 ? totalAvgFailures / statusCount : 0;

      return stats;
    } catch (err) {
      console.error('[DLQ] Exception getting stats:', err);
      return this.getEmptyStats();
    }
  }

  /**
   * Elimina un mensaje de la DLQ (solo para testing/admin)
   */
  async deleteMessage(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ai_dead_letter_queue')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('[DLQ] Error deleting message:', { id, error: error.message });
      }
      return !error;
    } catch (err) {
      console.error('[DLQ] Exception deleting message:', { id, error: err });
      return false;
    }
  }

  /**
   * Mapea un registro de DB a DLQMessage
   */
  private mapToMessage(row: Record<string, unknown>): DLQMessage {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      conversationId: row.conversation_id as string | undefined,
      contactId: row.contact_id as string | undefined,
      originalMessage: row.original_message as string,
      originalPayload: (row.original_payload as Record<string, unknown>) || {},
      errorMessage: row.error_message as string,
      errorCode: row.error_code as string | undefined,
      errorStack: row.error_stack as string | undefined,
      failureCount: row.failure_count as number,
      channel: row.channel as string | undefined,
      processingStage: row.processing_stage as ProcessingStage,
      status: row.status as DLQStatus,
      lastAttemptAt: new Date(row.last_attempt_at as string),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      resolutionNotes: row.resolution_notes as string | undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
      resolvedBy: row.resolved_by as string | undefined,
    };
  }

  /**
   * Retorna estadísticas vacías
   */
  private getEmptyStats(): DLQStats {
    return {
      pending: 0,
      retrying: 0,
      resolved: 0,
      archived: 0,
      avgFailureCount: 0,
    };
  }
}

// ============================================
// SINGLETON
// ============================================

let dlqServiceInstance: DeadLetterQueueService | null = null;

/**
 * Obtiene la instancia singleton del servicio DLQ
 */
export function getDLQService(): DeadLetterQueueService {
  if (!dlqServiceInstance) {
    dlqServiceInstance = new DeadLetterQueueService();
  }
  return dlqServiceInstance;
}

/**
 * Crea una nueva instancia con cliente custom
 */
export function createDLQService(supabaseClient: SupabaseClient): DeadLetterQueueService {
  return new DeadLetterQueueService(supabaseClient);
}

/**
 * Helper para añadir mensaje a DLQ de forma sencilla
 * Uso: await addToDLQ({ tenantId, error, processingStage: 'ai_processing', ... })
 */
export async function addToDLQ(params: AddToDLQParams): Promise<string | null> {
  return getDLQService().addMessage(params);
}

export default DeadLetterQueueService;
