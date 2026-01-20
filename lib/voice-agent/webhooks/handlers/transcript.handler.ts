/**
 * TIS TIS Platform - Voice Agent v2.0
 * Transcript Handler
 *
 * Handles transcript events from VAPI for real-time transcription.
 * These are informational events - no response content needed.
 *
 * Responsibilities:
 * 1. Receive partial and final transcriptions
 * 2. Log transcriptions for debugging
 * 3. Optionally store in cache/database
 * 4. Return acknowledgment
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  TranscriptPayload,
  AckResponse,
  WebhookHandlerContext,
  HandlerResult,
} from '../types';
import { formatAckResponse } from '../response-formatters';

// =====================================================
// TYPES
// =====================================================

/**
 * Transcript entry for storage
 */
interface TranscriptEntry {
  text: string;
  role: 'user' | 'assistant';
  timestamp: number;
  isFinal: boolean;
}

/**
 * Handler options
 */
export interface TranscriptHandlerOptions {
  /** Whether to log partial transcripts */
  logPartial?: boolean;

  /** Whether to log final transcripts */
  logFinal?: boolean;

  /** Whether to store transcripts in database */
  storeInDatabase?: boolean;

  /** Maximum text length to log (for privacy) */
  maxLogLength?: number;

  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;

  /** Callback for processing transcripts */
  onTranscript?: (entry: TranscriptEntry, context: WebhookHandlerContext) => Promise<void>;
}

/**
 * Default handler options
 */
export const DEFAULT_TRANSCRIPT_HANDLER_OPTIONS: TranscriptHandlerOptions = {
  logPartial: false,
  logFinal: true,
  storeInDatabase: false,
  maxLogLength: 100,
};

// =====================================================
// MAIN HANDLER FUNCTION
// =====================================================

/**
 * Handle transcript event
 *
 * Note: This handler is informational - we just acknowledge receipt.
 * In Server-Side Response mode, messages are typically saved in
 * the conversation-update handler to avoid duplicates.
 */
export async function handleTranscript(
  payload: TranscriptPayload,
  context: WebhookHandlerContext,
  options: TranscriptHandlerOptions = DEFAULT_TRANSCRIPT_HANDLER_OPTIONS
): Promise<HandlerResult<AckResponse>> {
  const supabase = options.supabaseClient || createServiceClient();

  // Extract transcript info
  const transcript = payload.transcript;
  const vapiCallId = payload.call?.id || '';

  // Skip if no transcript data
  if (!transcript) {
    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: false,
    };
  }

  const text = transcript.text || '';
  const role = transcript.role || 'user';
  const isFinal = transcript.isFinal ?? true;
  const timestamp = transcript.timestamp || Date.now();

  // Skip partial transcripts if logging disabled
  if (!isFinal && !options.logPartial) {
    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: false,
    };
  }

  // Log transcript if enabled
  if ((isFinal && options.logFinal) || (!isFinal && options.logPartial)) {
    logTranscript(text, role, isFinal, vapiCallId, options.maxLogLength);
  }

  // Create transcript entry
  const entry: TranscriptEntry = {
    text,
    role,
    timestamp,
    isFinal,
  };

  // Call custom callback if provided
  if (options.onTranscript) {
    try {
      await options.onTranscript(entry, context);
    } catch (error) {
      console.warn('[Transcript Handler] Callback error:', error);
      // Don't fail the handler
    }
  }

  // Store in database if enabled (only final transcripts)
  if (options.storeInDatabase && isFinal && context.callId) {
    await storeTranscript(supabase, context.callId, entry);
  }

  return {
    response: formatAckResponse(),
    statusCode: 200,
    shouldLog: options.logFinal && isFinal,
    metadata: {
      role,
      isFinal,
      textLength: text.length,
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
 * Log transcript to console
 */
function logTranscript(
  text: string,
  role: string,
  isFinal: boolean,
  callId: string,
  maxLength: number = 100
): void {
  const truncatedText = text.length > maxLength
    ? `${text.substring(0, maxLength)}...`
    : text;

  const status = isFinal ? 'FINAL' : 'partial';

  console.log(
    `[Transcript] ${status} (${role}): "${truncatedText}"`,
    JSON.stringify({ callId, length: text.length })
  );
}

/**
 * Store transcript in database
 */
async function storeTranscript(
  supabase: SupabaseClient,
  callId: string,
  entry: TranscriptEntry
): Promise<void> {
  try {
    // Get current message count for sequence number
    const { count } = await supabase
      .from('voice_call_messages')
      .select('id', { count: 'exact', head: true })
      .eq('call_id', callId);

    const sequenceNumber = (count || 0) + 1;

    // Insert transcript as message
    await supabase.from('voice_call_messages').insert({
      call_id: callId,
      role: entry.role,
      content: entry.text,
      sequence_number: sequenceNumber,
      message_type: 'transcript',
      metadata: {
        isFinal: entry.isFinal,
        timestamp: entry.timestamp,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[Transcript Handler] Failed to store transcript:', error);
    // Don't fail the handler
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create a transcript handler with options
 */
export function createTranscriptHandler(
  options: TranscriptHandlerOptions = {}
): (
  payload: TranscriptPayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<AckResponse>> {
  return (payload, context) => handleTranscript(payload, context, {
    ...DEFAULT_TRANSCRIPT_HANDLER_OPTIONS,
    ...options,
  });
}
