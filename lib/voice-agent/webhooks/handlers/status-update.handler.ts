/**
 * TIS TIS Platform - Voice Agent v2.0
 * Status Update Handler
 *
 * Handles status-update events from VAPI for call status changes.
 * These are informational events - no response content needed.
 *
 * Responsibilities:
 * 1. Receive call status changes (queued, ringing, in-progress, ended)
 * 2. Update call record with current status
 * 3. Log status transitions
 * 4. Return acknowledgment
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  StatusUpdatePayload,
  SpeechUpdatePayload,
  AckResponse,
  WebhookHandlerContext,
  HandlerResult,
  VapiCallStatus,
} from '../types';
import { formatAckResponse } from '../response-formatters';

// =====================================================
// TYPES
// =====================================================

/**
 * Internal call status
 */
export type InternalCallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no_answer'
  | 'canceled';

/**
 * Handler options
 */
export interface StatusUpdateHandlerOptions {
  /** Whether to log status changes */
  logStatusChanges?: boolean;

  /** Callback for status changes */
  onStatusChange?: (
    vapiCallId: string,
    oldStatus: string | null,
    newStatus: string,
    context: WebhookHandlerContext
  ) => Promise<void>;

  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;
}

/**
 * Default handler options
 */
export const DEFAULT_STATUS_UPDATE_OPTIONS: StatusUpdateHandlerOptions = {
  logStatusChanges: true,
};

// =====================================================
// STATUS MAPPING
// =====================================================

/**
 * Map VAPI status to internal status
 */
export function mapVapiStatusToInternal(vapiStatus: string): InternalCallStatus {
  const statusMap: Record<string, InternalCallStatus> = {
    'queued': 'initiated',
    'ringing': 'ringing',
    'in-progress': 'in_progress',
    'forwarding': 'in_progress',
    'ended': 'completed',
    'completed': 'completed',
    'busy': 'busy',
    'failed': 'failed',
    'no-answer': 'no_answer',
    'canceled': 'canceled',
    'cancelled': 'canceled', // Alternative spelling
  };

  return statusMap[vapiStatus.toLowerCase()] || 'initiated';
}

// =====================================================
// MAIN HANDLER FUNCTION
// =====================================================

/**
 * Handle status-update event
 */
export async function handleStatusUpdate(
  payload: StatusUpdatePayload,
  context: WebhookHandlerContext,
  options: StatusUpdateHandlerOptions = DEFAULT_STATUS_UPDATE_OPTIONS
): Promise<HandlerResult<AckResponse>> {
  const supabase = options.supabaseClient || createServiceClient();

  const vapiCallId = payload.call?.id || '';
  const vapiStatus = payload.status || 'unknown';

  // Map to internal status
  const internalStatus = mapVapiStatusToInternal(vapiStatus);

  // Log status change if enabled
  if (options.logStatusChanges) {
    console.log(
      `[Status Update] Call ${vapiCallId}: ${vapiStatus} -> ${internalStatus}`,
      JSON.stringify({ requestId: context.requestId })
    );
  }

  try {
    // Get current call status
    const { data: call, error: fetchError } = await supabase
      .from('voice_calls')
      .select('id, status')
      .eq('vapi_call_id', vapiCallId)
      .single();

    if (fetchError || !call) {
      // Call not found - might happen for outbound calls started externally
      console.warn(`[Status Update] Call not found: ${vapiCallId}`);
      return {
        response: formatAckResponse(),
        statusCode: 200,
        shouldLog: false,
        metadata: { warning: 'call_not_found', vapiCallId },
      };
    }

    const oldStatus = call.status;

    // Build update data
    const updateData: Record<string, unknown> = {
      status: internalStatus,
      updated_at: new Date().toISOString(),
    };

    // Set answered_at when call starts
    if (vapiStatus === 'in-progress' || internalStatus === 'in_progress') {
      updateData.answered_at = new Date().toISOString();
    }

    // Update call status
    const { error: updateError } = await supabase
      .from('voice_calls')
      .update(updateData)
      .eq('id', call.id);

    if (updateError) {
      console.error('[Status Update] Error updating call:', updateError);
      // Don't fail - we want to acknowledge the webhook
    }

    // Call callback if provided
    if (options.onStatusChange) {
      try {
        await options.onStatusChange(vapiCallId, oldStatus, internalStatus, context);
      } catch (error) {
        console.warn('[Status Update] Callback error:', error);
        // Don't fail the handler
      }
    }

    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: options.logStatusChanges,
      metadata: {
        callId: call.id,
        oldStatus,
        newStatus: internalStatus,
        vapiStatus,
      },
    };
  } catch (error) {
    console.error('[Status Update] Error:', error);

    // Still return success - we don't want VAPI to retry
    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        error: error instanceof Error ? error.message : 'unknown',
        vapiCallId,
      },
    };
  }
}

/**
 * Handle speech-update event
 * Fired when user or assistant starts/stops speaking
 */
export async function handleSpeechUpdate(
  payload: SpeechUpdatePayload,
  context: WebhookHandlerContext,
  options: StatusUpdateHandlerOptions = DEFAULT_STATUS_UPDATE_OPTIONS
): Promise<HandlerResult<AckResponse>> {
  const vapiCallId = payload.call?.id || '';
  const speechStatus = payload.status; // 'started' or 'stopped'
  const role = payload.role; // 'user' or 'assistant'

  // Log speech event if enabled
  if (options.logStatusChanges) {
    console.log(
      `[Speech Update] Call ${vapiCallId}: ${role} ${speechStatus} speaking`,
      JSON.stringify({ requestId: context.requestId })
    );
  }

  // Speech updates are purely informational - just acknowledge
  return {
    response: formatAckResponse(),
    statusCode: 200,
    shouldLog: false,
    metadata: {
      vapiCallId,
      role,
      speechStatus,
    },
  };
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create Supabase service client
 */
function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Check if status indicates an active call
 */
export function isActiveStatus(status: InternalCallStatus): boolean {
  return ['initiated', 'ringing', 'in_progress'].includes(status);
}

/**
 * Check if status indicates a completed call
 */
export function isTerminalStatus(status: InternalCallStatus): boolean {
  return ['completed', 'busy', 'failed', 'no_answer', 'canceled'].includes(status);
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(
  status: InternalCallStatus,
  locale: string = 'es'
): string {
  const descriptions: Record<string, Record<InternalCallStatus, string>> = {
    es: {
      initiated: 'Llamada iniciada',
      ringing: 'Llamando',
      in_progress: 'En progreso',
      completed: 'Completada',
      busy: 'Ocupado',
      failed: 'Fallida',
      no_answer: 'Sin respuesta',
      canceled: 'Cancelada',
    },
    en: {
      initiated: 'Call initiated',
      ringing: 'Ringing',
      in_progress: 'In progress',
      completed: 'Completed',
      busy: 'Busy',
      failed: 'Failed',
      no_answer: 'No answer',
      canceled: 'Canceled',
    },
  };

  const localeDescriptions = descriptions[locale] || descriptions['es'];
  return localeDescriptions[status] || status;
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a status update handler with options
 */
export function createStatusUpdateHandler(
  options: StatusUpdateHandlerOptions = {}
): (
  payload: StatusUpdatePayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<AckResponse>> {
  return (payload, context) => handleStatusUpdate(payload, context, {
    ...DEFAULT_STATUS_UPDATE_OPTIONS,
    ...options,
  });
}

/**
 * Create a speech update handler with options
 */
export function createSpeechUpdateHandler(
  options: StatusUpdateHandlerOptions = {}
): (
  payload: SpeechUpdatePayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<AckResponse>> {
  return (payload, context) => handleSpeechUpdate(payload, context, {
    ...DEFAULT_STATUS_UPDATE_OPTIONS,
    ...options,
  });
}
