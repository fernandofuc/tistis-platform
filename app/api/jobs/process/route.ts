// =====================================================
// TIS TIS PLATFORM - Job Processor API
// Endpoint: /api/jobs/process
// Processes pending jobs from the queue
// Supports: WhatsApp, Instagram, Facebook, TikTok
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for Vercel

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServerClient } from '@/src/shared/lib/supabase';
import { JobProcessor } from '@/src/features/ai/services/job-processor.service';
import {
  saveAIResponse,
  logAIUsage,
  updateLeadScore,
  escalateConversation,
} from '@/src/features/ai/services/ai.service';
import { generateAIResponseSmart } from '@/src/features/ai/services/langgraph-ai.service';
import { WhatsAppService } from '@/src/features/messaging/services/whatsapp.service';
import { MetaService } from '@/src/features/messaging/services/meta.service';
import { TikTokService } from '@/src/features/messaging/services/tiktok.service';
import {
  processExpiringMemberships,
  processInactivePatients,
} from '@/src/features/loyalty/services/loyalty-messaging.service';
import type { AIResponseJobPayload, SendMessageJobPayload } from '@/src/shared/types/whatsapp';
import type { MetaSendMessageJobPayload } from '@/src/shared/types/meta-messaging';
import type { TikTokSendMessageJobPayload } from '@/src/shared/types/tiktok-messaging';

// ======================
// AUTHENTICATION
// ======================

function validateRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  // SECURITY: In production, CRON_SECRET is required
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Jobs API] CRITICAL: CRON_SECRET not configured in production');
      return false;
    }
    // Allow in development without secret
    console.warn('[Jobs API] CRON_SECRET not configured - allowing in development');
    return true;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  // Timing-safe comparison to prevent timing attacks
  const token = authHeader.substring(7);
  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

// ======================
// GET - Daily Cron Job (Health Check + Loyalty Messages)
// ======================
export async function GET(request: NextRequest) {
  if (!validateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[Jobs API] Starting daily cron job...');

    // 1. Get queue stats
    const stats = await JobProcessor.getQueueStats();

    // 2. Process loyalty messages (memberships & reactivation)
    console.log('[Jobs API] Processing loyalty messages...');
    const loyaltyResults = {
      memberships: { processed: 0, sent: 0, errors: 0 },
      reactivation: { processed: 0, sent: 0, errors: 0 },
    };

    try {
      loyaltyResults.memberships = await processExpiringMemberships();
      console.log('[Jobs API] Membership reminders:', loyaltyResults.memberships);
    } catch (error) {
      console.error('[Jobs API] Membership processing error:', error);
    }

    try {
      loyaltyResults.reactivation = await processInactivePatients();
      console.log('[Jobs API] Reactivation messages:', loyaltyResults.reactivation);
    } catch (error) {
      console.error('[Jobs API] Reactivation processing error:', error);
    }

    const duration = Date.now() - startTime;
    console.log(`[Jobs API] Daily cron completed in ${duration}ms`);

    return NextResponse.json({
      status: 'healthy',
      queue_stats: stats,
      loyalty_messages: loyaltyResults,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Jobs API] Daily cron error:', error);
    return NextResponse.json(
      { error: 'Daily cron failed' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Process Jobs
// ======================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!validateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxJobs = Math.min(body.max_jobs || 10, 50); // Máximo 50 trabajos por llamada
    const jobType = body.job_type; // Filtrar por tipo opcional

    console.log(`[Jobs API] Starting job processing (max: ${maxJobs})`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Procesar trabajos en secuencia
    for (let i = 0; i < maxJobs; i++) {
      // Obtener próximo trabajo
      const job = await JobProcessor.getNextPendingJob();

      if (!job) {
        console.log('[Jobs API] No more pending jobs');
        break;
      }

      // Filtrar por tipo si se especificó
      if (jobType && job.job_type !== jobType) {
        continue;
      }

      console.log(`[Jobs API] Processing job ${job.id} (${job.job_type})`);
      results.processed++;

      try {
        // Marcar como en procesamiento
        await JobProcessor.markJobProcessing(job.id);

        // Procesar según tipo
        let result: Record<string, unknown>;

        // Type assertion for job_type to support all channels
        const jobType = job.job_type as string;

        switch (jobType) {
          case 'ai_response':
            // U1 FIX: Pass job_id and cached_result for retry optimization
            result = await processAIResponseJob({
              ...(job.payload as AIResponseJobPayload),
              job_id: job.id,
              cached_result: (job as { cached_result?: { ai_response: string; metadata: Record<string, unknown> } }).cached_result,
            });
            break;

          case 'send_whatsapp':
            // U4/U7 FIX: Pass job_id for connection validation and rate limiting
            result = await processSendWhatsAppJob({
              ...(job.payload as SendMessageJobPayload),
              job_id: job.id,
            } as SendMessageJobPayload & { job_id: string });
            break;

          case 'send_instagram':
            // SECURITY: Pass job_id for connection validation
            result = await processSendInstagramJob({
              ...(job.payload as unknown as MetaSendMessageJobPayload),
              job_id: job.id,
            });
            break;

          case 'send_facebook':
            // SECURITY: Pass job_id for connection validation
            result = await processSendFacebookJob({
              ...(job.payload as unknown as MetaSendMessageJobPayload),
              job_id: job.id,
            });
            break;

          case 'send_tiktok':
            // SECURITY: Pass job_id for connection validation
            result = await processSendTikTokJob({
              ...(job.payload as unknown as TikTokSendMessageJobPayload),
              job_id: job.id,
            });
            break;

          default:
            throw new Error(`Unknown job type: ${jobType}`);
        }

        // Marcar como completado
        await JobProcessor.completeJob(job.id, result);
        results.succeeded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Jobs API] Job ${job.id} failed:`, errorMessage);

        await JobProcessor.failJob(job.id, errorMessage);
        results.failed++;
        results.errors.push(`Job ${job.id}: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[Jobs API] Completed: ${results.succeeded}/${results.processed} jobs in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      ...results,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Jobs API] Processing error:', error);
    return NextResponse.json(
      { error: 'Job processing failed' },
      { status: 500 }
    );
  }
}

// ======================
// JOB HANDLERS
// ======================

/**
 * Procesa un trabajo de respuesta AI
 * FIXED: Caches AI response before DB operations to prevent token waste on retry (U1)
 * SECURITY: Validates tenant is still active before processing
 */
async function processAIResponseJob(
  payload: AIResponseJobPayload & { job_id?: string; cached_result?: { ai_response: string; metadata: Record<string, unknown> } }
): Promise<Record<string, unknown>> {
  const { tenant_id, conversation_id, message_id, lead_id, channel, channel_connection_id } = payload;

  console.log(`[Jobs API] Processing AI response for conversation ${conversation_id}`);

  const supabase = createServerClient();

  // SECURITY: Re-validate tenant is still active before processing
  // This handles the case where tenant was suspended/deactivated between job creation and processing
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenant_id)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant ${tenant_id} not found - aborting job`);
  }

  if (tenant.status !== 'active') {
    console.warn(`[Jobs API] Tenant ${tenant_id} is ${tenant.status} - skipping AI processing`);
    return {
      skipped: true,
      reason: `Tenant status is ${tenant.status}`,
    };
  }

  // U1 FIX: Check if we have a cached AI response from a previous failed attempt
  let aiResult: Awaited<ReturnType<typeof generateAIResponseSmart>>;
  let usedCachedResponse = false;

  if (payload.cached_result?.ai_response) {
    // Retry case: Use cached response to avoid regenerating (saves tokens)
    console.log('[Jobs API] Using cached AI response from previous attempt');
    const cachedIntent = (payload.cached_result.metadata?.intent as string) || 'UNKNOWN';
    aiResult = {
      response: payload.cached_result.ai_response,
      // Cast to same type that generateAIResponseSmart returns
      intent: cachedIntent as Awaited<ReturnType<typeof generateAIResponseSmart>>['intent'],
      signals: (payload.cached_result.metadata?.signals as Array<{ signal: string; points: number }>) || [],
      score_change: (payload.cached_result.metadata?.score_change as number) || 0,
      escalate: (payload.cached_result.metadata?.escalate as boolean) || false,
      escalate_reason: payload.cached_result.metadata?.escalate_reason as string | undefined,
      tokens_used: (payload.cached_result.metadata?.tokens_used as number) || 0,
      model_used: (payload.cached_result.metadata?.model_used as string) || 'cached',
      processing_time_ms: 0,
    };
    usedCachedResponse = true;
  } else {
    // 1. Obtener el mensaje actual
    const { data: message } = await supabase
      .from('messages')
      .select('content')
      .eq('id', message_id)
      .single();

    if (!message) {
      throw new Error(`Message ${message_id} not found`);
    }

    // 2. Generar respuesta AI (usa LangGraph o legacy según configuración del tenant)
    aiResult = await generateAIResponseSmart(tenant_id, conversation_id, message.content, lead_id);

    console.log(
      `[Jobs API] AI response generated: intent=${aiResult.intent}, ` +
      `escalate=${aiResult.escalate}, tokens=${aiResult.tokens_used}`
    );

    // U1 FIX: Cache the AI response BEFORE attempting DB operations
    // If DB insert fails and job retries, we'll use this cached response
    if (payload.job_id) {
      try {
        await supabase.rpc('cache_job_ai_response', {
          p_job_id: payload.job_id,
          p_ai_response: aiResult.response,
          p_metadata: {
            intent: aiResult.intent,
            signals: aiResult.signals,
            score_change: aiResult.score_change,
            escalate: aiResult.escalate,
            escalate_reason: aiResult.escalate_reason,
            tokens_used: aiResult.tokens_used,
            model_used: aiResult.model_used,
          },
        });
      } catch (cacheError) {
        // Non-critical: continue even if caching fails
        console.warn('[Jobs API] Failed to cache AI response:', cacheError);
      }
    }
  }

  // 3. Guardar respuesta (SECURITY: Pass tenant_id to validate ownership)
  const responseMessageId = await saveAIResponse(conversation_id, aiResult.response, {
    intent: aiResult.intent,
    signals: aiResult.signals,
    model: usedCachedResponse ? 'cached-' + aiResult.model_used : aiResult.model_used,
    tokens: aiResult.tokens_used,
    processing_time_ms: aiResult.processing_time_ms,
  }, tenant_id);

  // 4. Actualizar score del lead (SECURITY: Pass tenant_id to validate ownership)
  if (aiResult.signals.length > 0) {
    await updateLeadScore(lead_id, aiResult.signals, conversation_id, tenant_id);
  }

  // 5. Registrar uso de AI (skip if using cached response to avoid double counting)
  if (!usedCachedResponse) {
    await logAIUsage(tenant_id, conversation_id, aiResult);
  }

  // 6. Escalar si es necesario (SECURITY: Pass tenant_id to validate ownership)
  if (aiResult.escalate && aiResult.escalate_reason) {
    await escalateConversation(conversation_id, aiResult.escalate_reason, tenant_id);
  } else if (channel_connection_id) {
    // 7. Encolar envío del mensaje según canal
    await enqueueOutboundMessage({
      channel,
      conversation_id,
      message_id: responseMessageId,
      tenant_id,
      lead_id,
      content: aiResult.response,
      channel_connection_id,
    });
  } else {
    console.warn(`[Jobs API] No channel_connection_id for conversation ${conversation_id}, skipping outbound message`);
  }

  return {
    response_message_id: responseMessageId,
    intent: aiResult.intent,
    escalated: aiResult.escalate,
    score_change: aiResult.score_change,
    tokens_used: aiResult.tokens_used,
    used_cached_response: usedCachedResponse,
  };
}

// ======================
// MULTI-CHANNEL OUTBOUND ROUTER
// ======================

interface OutboundMessageParams {
  channel: string;
  conversation_id: string;
  message_id: string;
  tenant_id: string;
  lead_id: string;
  content: string;
  channel_connection_id: string;
}

/**
 * Encola un mensaje de salida según el canal
 */
async function enqueueOutboundMessage(params: OutboundMessageParams): Promise<void> {
  const {
    channel,
    conversation_id,
    message_id,
    tenant_id,
    lead_id,
    content,
    channel_connection_id,
  } = params;

  const supabase = createServerClient();

  // Obtener información del lead según canal
  const { data: lead } = await supabase
    .from('leads')
    .select('phone_normalized, instagram_psid, facebook_psid, tiktok_open_id')
    .eq('id', lead_id)
    .single();

  if (!lead) {
    console.error(`[Jobs API] Lead ${lead_id} not found for outbound message`);
    return;
  }

  switch (channel) {
    case 'whatsapp':
      if (lead.phone_normalized) {
        await WhatsAppService.enqueueSendMessageJob({
          conversation_id,
          message_id,
          tenant_id,
          channel: 'whatsapp',
          recipient_phone: lead.phone_normalized,
          content,
          channel_connection_id,
        });
      }
      break;

    case 'instagram':
      if (lead.instagram_psid) {
        await enqueueMetaSendJob({
          conversation_id,
          message_id,
          tenant_id,
          channel: 'instagram',
          recipient_psid: lead.instagram_psid,
          content,
          channel_connection_id,
        });
      }
      break;

    case 'facebook':
      if (lead.facebook_psid) {
        await enqueueMetaSendJob({
          conversation_id,
          message_id,
          tenant_id,
          channel: 'facebook',
          recipient_psid: lead.facebook_psid,
          content,
          channel_connection_id,
        });
      }
      break;

    case 'tiktok':
      if (lead.tiktok_open_id) {
        await TikTokService.enqueueSendJob({
          conversation_id,
          message_id,
          tenant_id,
          channel: 'tiktok',
          recipient_open_id: lead.tiktok_open_id,
          content,
          channel_connection_id,
        });
      }
      break;

    default:
      console.warn(`[Jobs API] Unknown channel for outbound: ${channel}`);
  }
}

/**
 * Encola trabajo de envío para Meta (Instagram/Facebook)
 */
async function enqueueMetaSendJob(payload: MetaSendMessageJobPayload): Promise<string> {
  const supabase = createServerClient();

  const { data: job, error } = await supabase
    .from('job_queue')
    .insert({
      tenant_id: payload.tenant_id,
      job_type: `send_${payload.channel}`,
      payload,
      status: 'pending',
      priority: 1,
      max_attempts: 3,
      scheduled_for: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[Jobs API] Error enqueueing ${payload.channel} send job:`, error);
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  return job.id;
}

// ======================
// CHANNEL-SPECIFIC HANDLERS
// ======================

/**
 * Procesa un trabajo de envío de mensaje WhatsApp
 * FIXED: Validates connection status and checks rate limits (U4, U7)
 */
async function processSendWhatsAppJob(
  payload: SendMessageJobPayload & { job_id?: string }
): Promise<Record<string, unknown>> {
  const { message_id, channel_connection_id, recipient_phone, content, job_id } = payload;

  // Log without exposing phone number
  console.log(`[Jobs API] Sending WhatsApp message, message_id: ${message_id}`);

  const supabase = createServerClient();

  // U4 FIX: Validate connection is still active before sending
  const { data: validation } = await supabase.rpc('validate_channel_connection_for_job', {
    p_job_id: job_id || null,
    p_channel_connection_id: channel_connection_id,
  });

  if (validation && validation.length > 0 && !validation[0].is_valid) {
    throw new Error(`Channel connection invalid: ${validation[0].error_reason}`);
  }

  // U7 FIX: Check rate limit before sending
  const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
    p_channel_connection_id: channel_connection_id,
    p_channel: 'whatsapp',
  });

  if (rateLimit && rateLimit.length > 0 && !rateLimit[0].allowed) {
    const retryAfter = rateLimit[0].retry_after_seconds || 60;
    throw new Error(`Rate limited. Retry after ${retryAfter} seconds. Current: ${rateLimit[0].current_count}/${rateLimit[0].limit_count}`);
  }

  // 1. Obtener channel connection
  const { data: connection, error } = await supabase
    .from('channel_connections')
    .select('*')
    .eq('id', channel_connection_id)
    .eq('status', 'connected') // U4: Only use connected channels
    .single();

  if (error || !connection) {
    throw new Error(`Channel connection ${channel_connection_id} not found or disconnected`);
  }

  // 2. Enviar mensaje por WhatsApp
  const result = await WhatsAppService.sendMessage(
    connection,
    recipient_phone,
    content
  );

  // 3. Actualizar mensaje con ID externo
  await supabase
    .from('messages')
    .update({
      status: 'sent',
      external_id: result.messageId,
      sent_at: new Date().toISOString(),
    })
    .eq('id', message_id);

  console.log(`[Jobs API] WhatsApp message sent: ${result.messageId}`);

  return {
    whatsapp_message_id: result.messageId,
    success: result.success,
  };
}

/**
 * Procesa un trabajo de envío de mensaje Instagram
 * SECURITY: Validates connection is still active before sending
 */
async function processSendInstagramJob(
  payload: MetaSendMessageJobPayload & { job_id?: string }
): Promise<Record<string, unknown>> {
  const { message_id, channel_connection_id, recipient_psid, content, job_id } = payload;

  console.log(`[Jobs API] Sending Instagram message, message_id: ${message_id}`);

  const supabase = createServerClient();

  // SECURITY: Validate connection is still active before sending
  const { data: validation } = await supabase.rpc('validate_channel_connection_for_job', {
    p_job_id: job_id || null,
    p_channel_connection_id: channel_connection_id,
  });

  if (validation && validation.length > 0 && !validation[0].is_valid) {
    throw new Error(`Instagram connection invalid: ${validation[0].error_reason}`);
  }

  // 1. Obtener channel connection
  const { data: connection, error } = await supabase
    .from('channel_connections')
    .select('instagram_page_id, instagram_access_token')
    .eq('id', channel_connection_id)
    .eq('channel', 'instagram')
    .eq('status', 'connected') // SECURITY: Only use connected channels
    .single();

  if (error || !connection) {
    throw new Error(`Instagram connection ${channel_connection_id} not found or disconnected`);
  }

  if (!connection.instagram_access_token) {
    throw new Error('Instagram access token not configured');
  }

  // 2. Enviar mensaje por Instagram
  const result = await MetaService.sendMessage(
    'instagram',
    connection.instagram_access_token,
    recipient_psid,
    content
  );

  // 3. Actualizar mensaje
  await supabase
    .from('messages')
    .update({
      status: result.success ? 'sent' : 'failed',
      external_id: result.messageId,
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error,
    })
    .eq('id', message_id);

  console.log(`[Jobs API] Instagram message ${result.success ? 'sent' : 'failed'}: ${result.messageId || result.error}`);

  return {
    instagram_message_id: result.messageId,
    success: result.success,
    error: result.error,
  };
}

/**
 * Procesa un trabajo de envío de mensaje Facebook
 * SECURITY: Validates connection is still active before sending
 */
async function processSendFacebookJob(
  payload: MetaSendMessageJobPayload & { job_id?: string }
): Promise<Record<string, unknown>> {
  const { message_id, channel_connection_id, recipient_psid, content, job_id } = payload;

  console.log(`[Jobs API] Sending Facebook message, message_id: ${message_id}`);

  const supabase = createServerClient();

  // SECURITY: Validate connection is still active before sending
  const { data: validation } = await supabase.rpc('validate_channel_connection_for_job', {
    p_job_id: job_id || null,
    p_channel_connection_id: channel_connection_id,
  });

  if (validation && validation.length > 0 && !validation[0].is_valid) {
    throw new Error(`Facebook connection invalid: ${validation[0].error_reason}`);
  }

  // 1. Obtener channel connection
  const { data: connection, error } = await supabase
    .from('channel_connections')
    .select('facebook_page_id, facebook_access_token')
    .eq('id', channel_connection_id)
    .eq('channel', 'facebook')
    .eq('status', 'connected') // SECURITY: Only use connected channels
    .single();

  if (error || !connection) {
    throw new Error(`Facebook connection ${channel_connection_id} not found or disconnected`);
  }

  if (!connection.facebook_access_token) {
    throw new Error('Facebook access token not configured');
  }

  // 2. Enviar mensaje por Facebook
  const result = await MetaService.sendMessage(
    'facebook',
    connection.facebook_access_token,
    recipient_psid,
    content
  );

  // 3. Actualizar mensaje
  await supabase
    .from('messages')
    .update({
      status: result.success ? 'sent' : 'failed',
      external_id: result.messageId,
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error,
    })
    .eq('id', message_id);

  console.log(`[Jobs API] Facebook message ${result.success ? 'sent' : 'failed'}: ${result.messageId || result.error}`);

  return {
    facebook_message_id: result.messageId,
    success: result.success,
    error: result.error,
  };
}

/**
 * Procesa un trabajo de envío de mensaje TikTok
 * SECURITY: Validates connection is still active before sending
 */
async function processSendTikTokJob(
  payload: TikTokSendMessageJobPayload & { job_id?: string }
): Promise<Record<string, unknown>> {
  const { message_id, channel_connection_id, recipient_open_id, content, job_id } = payload;

  console.log(`[Jobs API] Sending TikTok message, message_id: ${message_id}`);

  const supabase = createServerClient();

  // SECURITY: Validate connection is still active before sending
  const { data: validation } = await supabase.rpc('validate_channel_connection_for_job', {
    p_job_id: job_id || null,
    p_channel_connection_id: channel_connection_id,
  });

  if (validation && validation.length > 0 && !validation[0].is_valid) {
    throw new Error(`TikTok connection invalid: ${validation[0].error_reason}`);
  }

  // 1. Obtener channel connection
  const { data: connection, error } = await supabase
    .from('channel_connections')
    .select('tiktok_access_token')
    .eq('id', channel_connection_id)
    .eq('channel', 'tiktok')
    .eq('status', 'connected') // SECURITY: Only use connected channels
    .single();

  if (error || !connection) {
    throw new Error(`TikTok connection ${channel_connection_id} not found or disconnected`);
  }

  if (!connection.tiktok_access_token) {
    throw new Error('TikTok access token not configured');
  }

  // 2. Enviar mensaje por TikTok
  // NOTA: TikTok tiene límite de 10 mensajes por usuario por día
  // y ventana de 24 horas para responder
  const result = await TikTokService.sendMessage(
    connection.tiktok_access_token,
    recipient_open_id,
    content
  );

  // 3. Actualizar mensaje
  await supabase
    .from('messages')
    .update({
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      error_message: result.error,
    })
    .eq('id', message_id);

  console.log(`[Jobs API] TikTok message ${result.success ? 'sent' : 'failed'}: ${result.error || 'OK'}`);

  return {
    success: result.success,
    error: result.error,
  };
}
