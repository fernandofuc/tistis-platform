/**
 * TIS TIS Platform - Voice Agent v2.0
 * End of Call Report Handler
 *
 * Handles end-of-call-report events from VAPI when a call ends.
 *
 * Responsibilities:
 * 1. Extract call data from the report
 * 2. Update call record with final information
 * 3. Save transcript and analysis
 * 4. Extract structured data (reservations, appointments)
 * 5. Update metrics and usage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  EndOfCallPayload,
  AckResponse,
  WebhookHandlerContext,
  HandlerResult,
} from '../types';
import { formatAckResponse } from '../response-formatters';
import { databaseError } from '../error-handler';

// =====================================================
// TYPES
// =====================================================

/**
 * Call analysis result
 */
interface CallAnalysis {
  /** Summary of the call */
  summary?: string;

  /** Primary intent detected */
  primaryIntent?: string;

  /** Whether an appointment was requested */
  appointmentRequested?: boolean;

  /** Whether an appointment was booked */
  appointmentBooked?: boolean;

  /** Whether a reservation was requested */
  reservationRequested?: boolean;

  /** Whether a reservation was made */
  reservationMade?: boolean;

  /** Customer sentiment */
  sentiment?: 'positive' | 'neutral' | 'negative';

  /** Topics discussed */
  topics?: string[];

  /** Whether the call was escalated */
  escalated?: boolean;

  /** Escalation reason if escalated */
  escalationReason?: string;

  /** Whether the call achieved its purpose */
  successfulResolution?: boolean;
}

/**
 * Handler options
 */
export interface EndOfCallHandlerOptions {
  /** Whether to analyze the transcript */
  analyzeTranscript?: boolean;

  /** Whether to log usage */
  logUsage?: boolean;

  /** Cost per minute (in USD) */
  costPerMinute?: number;

  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;
}

// =====================================================
// MAIN HANDLER FUNCTION
// =====================================================

/**
 * Handle end-of-call-report event
 */
export async function handleEndOfCall(
  payload: EndOfCallPayload,
  context: WebhookHandlerContext,
  options: EndOfCallHandlerOptions = {}
): Promise<HandlerResult<AckResponse>> {
  const supabase = options.supabaseClient || createServiceClient();

  const vapiCallId = payload.call?.id || '';
  const endedReason = payload.endedReason || 'unknown';
  const durationSeconds = payload.durationSeconds || 0;
  const transcript = payload.transcript || payload.artifact?.transcript || '';
  const recordingUrl = payload.recordingUrl || payload.artifact?.recordingUrl || '';
  const stereoRecordingUrl = payload.stereoRecordingUrl || payload.artifact?.stereoRecordingUrl || '';
  const summary = payload.summary || payload.analysis?.summary || '';
  const cost = payload.cost || 0;
  const costBreakdown = payload.costBreakdown;
  const vapiAnalysis = payload.analysis;

  console.log(
    `[End of Call] Processing report for call: ${vapiCallId}`,
    JSON.stringify({
      endedReason,
      durationSeconds,
      hasTranscript: !!transcript,
      hasRecording: !!recordingUrl,
      hasSummary: !!summary,
      requestId: context.requestId,
    })
  );

  try {
    // Get call from database
    const { data: call, error: callError } = await supabase
      .from('voice_calls')
      .select('id, tenant_id, primary_intent, escalated, outcome')
      .eq('vapi_call_id', vapiCallId)
      .single();

    if (callError || !call) {
      console.warn(`[End of Call] Call not found: ${vapiCallId}`);
      // Still return success - we don't want to fail the webhook
      return {
        response: formatAckResponse(),
        statusCode: 200,
        shouldLog: true,
        metadata: { warning: 'call_not_found', vapiCallId },
      };
    }

    // Analyze transcript if enabled and available
    let analysis: CallAnalysis = {};

    if (options.analyzeTranscript !== false && transcript) {
      analysis = analyzeTranscript(transcript, vapiAnalysis);
    }

    // Determine final outcome
    const outcome = determineCallOutcome(
      call.outcome,
      call.primary_intent,
      analysis,
      endedReason
    );

    // Update call record
    const updateData: Record<string, unknown> = {
      status: 'completed',
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      ended_reason: endedReason,
      transcription: transcript,
      recording_url: recordingUrl,
      stereo_recording_url: stereoRecordingUrl,
      summary,
      analysis: {
        ...analysis,
        vapiAnalysis,
      },
      outcome,
      updated_at: new Date().toISOString(),
    };

    // Add cost info if available
    if (cost > 0) {
      updateData.cost = cost;
      updateData.cost_breakdown = costBreakdown;
    }

    const { error: updateError } = await supabase
      .from('voice_calls')
      .update(updateData)
      .eq('id', call.id);

    if (updateError) {
      console.error('[End of Call] Error updating call:', updateError);
      // Don't fail - we want to acknowledge the webhook
    }

    // Log usage if enabled
    if (options.logUsage !== false && durationSeconds > 0) {
      await logCallUsage(
        supabase,
        call.id,
        call.tenant_id,
        durationSeconds,
        cost,
        options.costPerMinute
      );
    }

    // Update tenant metrics
    await updateTenantMetrics(supabase, call.tenant_id, durationSeconds, outcome);

    console.log(
      `[End of Call] Report processed successfully`,
      JSON.stringify({
        callId: call.id,
        outcome,
        durationSeconds,
        processingTimeMs: Date.now() - context.startTime,
      })
    );

    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        callId: call.id,
        tenantId: call.tenant_id,
        outcome,
        durationSeconds,
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  } catch (error) {
    console.error('[End of Call] Error processing report:', error);

    // Still return success - we don't want VAPI to retry
    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        error: error instanceof Error ? error.message : 'unknown',
        vapiCallId,
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  }
}

// =====================================================
// ANALYSIS FUNCTIONS
// =====================================================

/**
 * Analyze transcript to extract insights
 * In a production system, this might use an LLM
 */
function analyzeTranscript(
  transcript: string,
  vapiAnalysis?: { summary?: string; structuredData?: Record<string, unknown>; successEvaluation?: string }
): CallAnalysis {
  const analysis: CallAnalysis = {};

  // Use VAPI's analysis if available
  if (vapiAnalysis) {
    analysis.summary = vapiAnalysis.summary;

    if (vapiAnalysis.successEvaluation) {
      analysis.successfulResolution = vapiAnalysis.successEvaluation.toLowerCase().includes('success');
    }

    if (vapiAnalysis.structuredData) {
      // Extract any structured data VAPI provided
      const sd = vapiAnalysis.structuredData;
      if (sd.appointmentBooked) analysis.appointmentBooked = true;
      if (sd.reservationMade) analysis.reservationMade = true;
      if (sd.intent) analysis.primaryIntent = String(sd.intent);
    }
  }

  // Simple keyword-based analysis
  const lowerTranscript = transcript.toLowerCase();

  // Detect appointment-related intents
  if (
    lowerTranscript.includes('cita') ||
    lowerTranscript.includes('appointment') ||
    lowerTranscript.includes('consulta')
  ) {
    analysis.appointmentRequested = true;

    if (
      lowerTranscript.includes('confirmad') ||
      lowerTranscript.includes('agendad') ||
      lowerTranscript.includes('reserved')
    ) {
      analysis.appointmentBooked = true;
    }
  }

  // Detect reservation-related intents
  if (
    lowerTranscript.includes('reserv') ||
    lowerTranscript.includes('mesa') ||
    lowerTranscript.includes('table')
  ) {
    analysis.reservationRequested = true;

    if (
      lowerTranscript.includes('confirmad') ||
      lowerTranscript.includes('listo') ||
      lowerTranscript.includes('confirmed')
    ) {
      analysis.reservationMade = true;
    }
  }

  // Detect escalation
  if (
    lowerTranscript.includes('agente') ||
    lowerTranscript.includes('human') ||
    lowerTranscript.includes('transferir') ||
    lowerTranscript.includes('transfer')
  ) {
    analysis.escalated = true;
    analysis.escalationReason = 'Customer requested human agent';
  }

  // Simple sentiment analysis
  const positiveWords = ['gracias', 'perfecto', 'excelente', 'genial', 'thank'];
  const negativeWords = ['problema', 'queja', 'molest', 'mal', 'terrible', 'angry'];

  const positiveCount = positiveWords.filter(w => lowerTranscript.includes(w)).length;
  const negativeCount = negativeWords.filter(w => lowerTranscript.includes(w)).length;

  if (positiveCount > negativeCount) {
    analysis.sentiment = 'positive';
  } else if (negativeCount > positiveCount) {
    analysis.sentiment = 'negative';
  } else {
    analysis.sentiment = 'neutral';
  }

  // Extract topics (very simple approach)
  const topics: string[] = [];
  if (lowerTranscript.includes('horario') || lowerTranscript.includes('hours')) topics.push('business_hours');
  if (lowerTranscript.includes('precio') || lowerTranscript.includes('cost')) topics.push('pricing');
  if (lowerTranscript.includes('menú') || lowerTranscript.includes('menu')) topics.push('menu');
  if (lowerTranscript.includes('servicio') || lowerTranscript.includes('service')) topics.push('services');
  if (lowerTranscript.includes('ubicación') || lowerTranscript.includes('location')) topics.push('location');

  analysis.topics = topics;

  return analysis;
}

/**
 * Determine the final call outcome
 */
function determineCallOutcome(
  existingOutcome: string | null,
  primaryIntent: string | null,
  analysis: CallAnalysis,
  endedReason: string
): string {
  // If outcome already set (e.g., from booking), keep it
  if (existingOutcome && existingOutcome !== 'unknown') {
    return existingOutcome;
  }

  // Based on analysis
  if (analysis.appointmentBooked) return 'appointment_booked';
  if (analysis.reservationMade) return 'reservation_made';
  if (analysis.escalated) return 'transferred_to_human';

  // Based on ended reason
  const endedLower = endedReason.toLowerCase();
  if (endedLower.includes('hangup') || endedLower.includes('customer-ended')) {
    if (analysis.successfulResolution) return 'completed_successfully';
    if (analysis.sentiment === 'positive') return 'information_given';
    return 'customer_hangup';
  }

  if (endedLower.includes('assistant-ended') || endedLower.includes('assistant-hangup')) {
    return 'completed_successfully';
  }

  if (endedLower.includes('error') || endedLower.includes('failed')) {
    return 'technical_error';
  }

  if (endedLower.includes('silence') || endedLower.includes('timeout')) {
    return 'silence_timeout';
  }

  // Based on primary intent
  if (primaryIntent) {
    if (primaryIntent.includes('BOOK') || primaryIntent.includes('RESERVE')) {
      return analysis.appointmentBooked || analysis.reservationMade
        ? 'completed_successfully'
        : 'incomplete_booking';
    }
    if (primaryIntent.includes('INFO') || primaryIntent.includes('FAQ')) {
      return 'information_given';
    }
  }

  return 'completed_other';
}

// =====================================================
// DATABASE FUNCTIONS
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
 * Log call usage to database
 */
async function logCallUsage(
  supabase: SupabaseClient,
  callId: string,
  tenantId: string,
  durationSeconds: number,
  vapiCost: number,
  costPerMinute: number = 0.05
): Promise<void> {
  try {
    const minutes = Math.ceil(durationSeconds / 60);
    const calculatedCost = minutes * costPerMinute;
    const actualCost = vapiCost > 0 ? vapiCost : calculatedCost;

    await supabase.from('voice_usage_logs').insert({
      tenant_id: tenantId,
      call_id: callId,
      usage_type: 'call_minutes',
      quantity: minutes,
      unit: 'minutes',
      unit_cost_usd: costPerMinute,
      total_cost_usd: actualCost,
      provider: 'vapi',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[End of Call] Failed to log usage:', error);
    // Don't fail the handler
  }
}

/**
 * Update tenant metrics
 */
async function updateTenantMetrics(
  supabase: SupabaseClient,
  tenantId: string,
  durationSeconds: number,
  outcome: string
): Promise<void> {
  try {
    // Get current day for metrics
    const today = new Date().toISOString().split('T')[0];

    // Try to update existing metrics for today
    const { data: existingMetrics } = await supabase
      .from('voice_metrics_daily')
      .select('id, total_calls, total_duration_seconds, successful_calls, failed_calls')
      .eq('tenant_id', tenantId)
      .eq('date', today)
      .single();

    const isSuccessful = [
      'completed_successfully',
      'appointment_booked',
      'reservation_made',
      'information_given',
    ].includes(outcome);

    if (existingMetrics) {
      // Update existing
      await supabase
        .from('voice_metrics_daily')
        .update({
          total_calls: existingMetrics.total_calls + 1,
          total_duration_seconds: existingMetrics.total_duration_seconds + durationSeconds,
          successful_calls: existingMetrics.successful_calls + (isSuccessful ? 1 : 0),
          failed_calls: existingMetrics.failed_calls + (isSuccessful ? 0 : 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMetrics.id);
    } else {
      // Create new
      await supabase.from('voice_metrics_daily').insert({
        tenant_id: tenantId,
        date: today,
        total_calls: 1,
        total_duration_seconds: durationSeconds,
        successful_calls: isSuccessful ? 1 : 0,
        failed_calls: isSuccessful ? 0 : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn('[End of Call] Failed to update metrics:', error);
    // Don't fail the handler
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create an end of call handler with options
 */
export function createEndOfCallHandler(
  options: EndOfCallHandlerOptions = {}
): (
  payload: EndOfCallPayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<AckResponse>> {
  return (payload, context) => handleEndOfCall(payload, context, options);
}
