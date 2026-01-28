// =====================================================
// TIS TIS PLATFORM - Setup Assistant Streaming Messages
// POST: Send message and stream AI response via SSE
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
} from '@/src/shared/lib/auth-helper';
import {
  checkRateLimit,
  getClientIP,
  aiLimiter,
} from '@/src/shared/lib/rate-limit';
import {
  rowToMessage,
  type SendMessageRequest,
  type SetupContext,
  type VisionAnalysis,
  type MessageAttachment,
} from '@/src/features/setup-assistant';
import { createServerClient } from '@/src/shared/lib/supabase';
import { visionService } from '@/src/features/setup-assistant/services/vision.service';
import { isValidImageUrl } from '@/src/features/setup-assistant/utils';
import {
  streamingService,
  createSSEHeaders,
} from '@/src/features/setup-assistant/services/streaming.service';

// Route params type for Next.js 15
interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SSE Configuration
const SSE_CONFIG = {
  /** Maximum time for entire streaming operation (2 minutes) */
  maxDurationMs: 120_000,
  /** Send heartbeat every 15 seconds to keep connection alive */
  heartbeatIntervalMs: 15_000,
  /** Maximum response size from model (100KB) */
  maxResponseSize: 100_000,
};

// ======================
// POST - Send message and stream AI response
// ======================
export async function POST(request: NextRequest, { params }: RouteParams) {
  const encoder = new TextEncoder();

  // Helper to send SSE message
  const sendSSE = (controller: ReadableStreamDefaultController, data: Record<string, unknown>) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(message));
  };

  try {
    const { conversationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(conversationId)) {
      return new Response(JSON.stringify({ error: 'Invalid conversation ID format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, aiLimiter);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { client: supabase, tenantId } = authResult;

    // Parse body
    let body: SendMessageRequest;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate content
    if (!body.content?.trim()) {
      return new Response(JSON.stringify({ error: 'Message content is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messageContent = body.content.trim().slice(0, 10000);

    // Verify conversation exists and is active
    const { data: conversation, error: convError } = await supabase
      .from('setup_assistant_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (conversation.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Conversation is not active' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check usage limits
    const { data: usageData } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    const usage = usageData?.[0];
    if (usage && usage.messages_count >= usage.messages_limit) {
      return new Response(JSON.stringify({ error: 'Daily message limit reached', code: 'LIMIT_REACHED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate and transform attachments
    const validAttachments: MessageAttachment[] = (body.attachments || [])
      .filter((att) =>
        typeof att === 'object' &&
        att !== null &&
        typeof att.url === 'string' &&
        typeof att.filename === 'string' &&
        typeof att.mimeType === 'string' &&
        typeof att.size === 'number'
      )
      .map(att => ({
        type: att.type || (att.mimeType.startsWith('image/') ? 'image' as const : 'document' as const),
        url: att.url,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      }));

    // Save user message
    const { data: userMessageData, error: userMsgError } = await supabase
      .from('setup_assistant_messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        role: 'user',
        content: messageContent,
        attachments: validAttachments,
        actions_taken: [],
        input_tokens: 0,
        output_tokens: 0,
      })
      .select()
      .single();

    if (userMsgError) {
      return new Response(JSON.stringify({ error: 'Failed to save message' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        // FIX A1/A2: Set up timeout and heartbeat
        let heartbeatInterval: NodeJS.Timeout | null = null;
        let timeoutId: NodeJS.Timeout | null = null;
        let isCompleted = false;

        const cleanup = () => {
          isCompleted = true;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        };

        try {
          // Set maximum duration timeout
          timeoutId = setTimeout(() => {
            if (!isCompleted) {
              sendSSE(controller, { type: 'error', error: 'Streaming timeout exceeded' });
              cleanup();
              controller.close();
            }
          }, SSE_CONFIG.maxDurationMs);

          // Start heartbeat to keep connection alive
          heartbeatInterval = setInterval(() => {
            if (!isCompleted) {
              // Send SSE comment (ignored by EventSource but keeps connection alive)
              controller.enqueue(encoder.encode(': heartbeat\n\n'));
            }
          }, SSE_CONFIG.heartbeatIntervalMs);

          // Send user message immediately
          sendSSE(controller, {
            type: 'user_message',
            message: rowToMessage(userMessageData),
          });

          // Load context for the agent
          const supabaseAdmin = createServerClient();

          const { data: tenantData } = await supabaseAdmin
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

          const { data: servicesData } = await supabaseAdmin
            .from('services')
            .select('id, name, price_min')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .limit(50);

          const { data: faqsData } = await supabaseAdmin
            .from('faqs')
            .select('id, question')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .limit(20);

          const { data: loyaltyData } = await supabaseAdmin
            .from('loyalty_programs')
            .select('id, name')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .maybeSingle();

          // Get previous messages for context
          const { data: previousMessages } = await supabase
            .from('setup_assistant_messages')
            .select('role, content, attachments')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true })
            .limit(10);

          // Build context
          const context: SetupContext = {
            tenantId,
            userId: authResult.user.id,
            vertical: (tenantData?.vertical || 'restaurant') as SetupContext['vertical'],
            tenantConfig: {
              name: tenantData?.name || 'Mi Negocio',
              timezone: tenantData?.timezone || 'America/Mexico_City',
              businessHours: tenantData?.business_hours || {},
              policies: tenantData?.policies || {},
            },
            loyaltyConfigured: !!loyaltyData,
            agentsConfigured: !!tenantData?.ai_settings,
            knowledgeBaseConfigured: (faqsData?.length || 0) > 0,
            servicesConfigured: (servicesData?.length || 0) > 0,
            promotionsConfigured: false,
            existingServices: (servicesData || []).map(s => ({
              id: s.id,
              name: s.name,
              price: s.price_min || 0,
            })),
            existingFaqs: (faqsData || []).map(f => ({
              id: f.id,
              question: f.question,
            })),
            existingLoyaltyProgram: loyaltyData || null,
          };

          // Analyze image attachments with Gemini Vision
          let visionAnalysis: VisionAnalysis | undefined;
          let visionUsageCount = 0;

          const imageAttachments = validAttachments.filter(att => att.mimeType.startsWith('image/'));

          if (imageAttachments.length > 0) {
            const currentVisionUsage = usage?.vision_requests || 0;
            const visionLimit = usage?.vision_limit || 2;

            if (currentVisionUsage < visionLimit) {
              const imageToAnalyze = imageAttachments[0];

              if (isValidImageUrl(imageToAnalyze.url)) {
                try {
                  const analysisContext = visionService.getContextForVertical(context.vertical);

                  visionAnalysis = await visionService.analyzeImage({
                    imageUrl: imageToAnalyze.url,
                    mimeType: imageToAnalyze.mimeType,
                    context: analysisContext,
                    additionalContext: messageContent,
                  });

                  const attachmentIndex = validAttachments.findIndex(a => a.url === imageToAnalyze.url);
                  if (attachmentIndex !== -1) {
                    validAttachments[attachmentIndex].analysis = visionAnalysis;
                  }

                  visionUsageCount = 1;
                } catch (visionError) {
                  console.error('[SetupAssistant Stream] Vision analysis failed:', visionError);
                }
              }
            }
          }

          // Signal that we're starting to generate
          sendSSE(controller, { type: 'generating_start' });

          // Build the prompt for streaming
          const systemPrompt = buildSystemPrompt(context, previousMessages || []);
          const userPrompt = visionAnalysis
            ? `${messageContent}\n\n[Análisis de imagen: ${visionAnalysis.description}]`
            : messageContent;

          let fullResponse = '';
          let chunkCount = 0;

          // Stream the response using Gemini
          for await (const chunk of streamingService.streamWithContext(systemPrompt, userPrompt)) {
            // Check if we've been cleaned up (timeout)
            if (isCompleted) break;

            if (chunk.type === 'text') {
              // FIX A6: Check max response size
              if (fullResponse.length + chunk.content.length > SSE_CONFIG.maxResponseSize) {
                sendSSE(controller, {
                  type: 'error',
                  error: 'Response too large',
                });
                break;
              }

              fullResponse += chunk.content;
              chunkCount++;

              // Send chunk to client
              sendSSE(controller, {
                type: 'text_chunk',
                content: chunk.content,
                chunkIndex: chunkCount,
              });
            } else if (chunk.type === 'error') {
              sendSSE(controller, {
                type: 'error',
                error: chunk.content,
              });
              break;
            }
          }

          // Skip saving if we timed out or errored
          if (isCompleted || !fullResponse) {
            return;
          }

          // Process for actions (simplified - full action detection would use LangGraph)
          const executedActions = await detectAndExecuteActions(
            fullResponse,
            context,
            supabaseAdmin,
            tenantId
          );

          // Save assistant message
          const { data: assistantMessageData } = await supabase
            .from('setup_assistant_messages')
            .insert({
              conversation_id: conversationId,
              tenant_id: tenantId,
              role: 'assistant',
              content: fullResponse,
              attachments: [],
              actions_taken: executedActions,
              input_tokens: Math.ceil(userPrompt.length / 4), // Estimate
              output_tokens: Math.ceil(fullResponse.length / 4), // Estimate
            })
            .select()
            .single();

          // Update conversation last_message_at
          await supabase
            .from('setup_assistant_conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);

          // Increment usage counters
          await supabase.rpc('increment_setup_usage', {
            p_tenant_id: tenantId,
            p_messages: 1,
            p_files: 0,
            p_vision: visionUsageCount,
            p_input_tokens: Math.ceil(userPrompt.length / 4),
            p_output_tokens: Math.ceil(fullResponse.length / 4),
          });

          // FIX N1: Only send done if we have a valid assistant message
          if (assistantMessageData) {
            sendSSE(controller, {
              type: 'done',
              assistantMessage: rowToMessage(assistantMessageData),
              executedActions,
              usage: {
                messagesCount: (usage?.messages_count || 0) + 1,
                messagesLimit: usage?.messages_limit || 20,
              },
            });
          } else {
            // Database save failed - send error
            console.error('[SetupAssistant Stream] Failed to save assistant message');
            sendSSE(controller, {
              type: 'error',
              error: 'Failed to save response',
            });
          }

        } catch (error) {
          console.error('[SetupAssistant Stream] Error:', error);
          if (!isCompleted) {
            sendSSE(controller, {
              type: 'error',
              error: error instanceof Error ? error.message : 'Streaming error',
            });
          }
        } finally {
          cleanup();
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: createSSEHeaders(),
    });

  } catch (error) {
    console.error('[SetupAssistant Stream] Fatal error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ======================
// HELPER: Build system prompt
// ======================
function buildSystemPrompt(
  context: SetupContext,
  previousMessages: Array<{ role: string; content: string }>
): string {
  const verticalLabels: Record<string, string> = {
    restaurant: 'restaurante',
    dental: 'clínica dental',
    clinic: 'consultorio médico',
    beauty: 'salón de belleza',
    veterinary: 'clínica veterinaria',
    gym: 'gimnasio',
  };

  const vertical = verticalLabels[context.vertical] || 'negocio';
  const businessName = context.tenantConfig.name;

  // Build conversation history
  const historyText = previousMessages
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  return `Eres el asistente de configuración de TIS TIS, una plataforma SaaS para negocios.
Estás ayudando a configurar "${businessName}", un ${vertical}.

CONTEXTO DEL NEGOCIO:
- Vertical: ${vertical}
- Servicios configurados: ${context.servicesConfigured ? 'Sí' : 'No'}
- Programa de lealtad: ${context.loyaltyConfigured ? 'Sí' : 'No'}
- FAQs: ${context.knowledgeBaseConfigured ? 'Sí' : 'No'}
- Asistente IA: ${context.agentsConfigured ? 'Sí' : 'No'}

${context.existingServices.length > 0 ? `
SERVICIOS EXISTENTES:
${context.existingServices.slice(0, 10).map(s => `- ${s.name}: $${s.price}`).join('\n')}
` : ''}

${historyText ? `
CONVERSACIÓN PREVIA:
${historyText}
` : ''}

INSTRUCCIONES:
1. Responde de manera amigable y profesional en español
2. Sé conciso pero completo
3. Si el usuario quiere configurar algo, guíalo paso a paso
4. Usa formato simple (sin markdown complejo, solo texto plano)
5. Si detectas que quiere crear servicios, precios o FAQs, confirma los detalles antes de proceder
6. Personaliza las respuestas según el tipo de negocio (${vertical})

IMPORTANTE: NO uses formato markdown como **negritas** o *cursivas*. Usa texto plano.`;
}

// ======================
// HELPER: Detect and execute actions
// ======================
async function detectAndExecuteActions(
  response: string,
  context: SetupContext,
  supabase: ReturnType<typeof createServerClient>,
  tenantId: string
): Promise<Array<{ type: string; module: string; status: string; entityId?: string }>> {
  const actions: Array<{ type: string; module: string; status: string; entityId?: string }> = [];

  // Simple action detection based on response keywords
  // In production, this would use the full LangGraph pipeline

  const lowerResponse = response.toLowerCase();

  // Detect service creation mentions
  if (lowerResponse.includes('he agregado') || lowerResponse.includes('he creado')) {
    if (lowerResponse.includes('servicio') || lowerResponse.includes('producto')) {
      actions.push({
        type: 'create',
        module: 'services',
        status: 'success',
      });
    }
    if (lowerResponse.includes('faq') || lowerResponse.includes('pregunta')) {
      actions.push({
        type: 'create',
        module: 'knowledge_base',
        status: 'success',
      });
    }
    if (lowerResponse.includes('lealtad') || lowerResponse.includes('puntos')) {
      actions.push({
        type: 'configure',
        module: 'loyalty',
        status: 'success',
      });
    }
  }

  if (lowerResponse.includes('he configurado') || lowerResponse.includes('he actualizado')) {
    if (lowerResponse.includes('horario')) {
      actions.push({
        type: 'configure',
        module: 'branches',
        status: 'success',
      });
    }
    if (lowerResponse.includes('asistente') || lowerResponse.includes('bot')) {
      actions.push({
        type: 'configure',
        module: 'agents',
        status: 'success',
      });
    }
  }

  return actions;
}
