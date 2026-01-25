// =====================================================
// TIS TIS PLATFORM - Setup Assistant Messages
// GET: List messages with pagination
// POST: Send new message (triggers AI response)
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import {
  checkRateLimit,
  getClientIP,
  aiLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';
import {
  rowToMessage,
  setupAssistantService,
  type SendMessageRequest,
  type SendMessageResponse,
  type UsageInfo,
  type SetupContext,
  type SetupStateMessage,
  type VisionAnalysis,
  type MessageAttachment,
} from '@/src/features/setup-assistant';
import { createServerClient } from '@/src/shared/lib/supabase';
import { visionService } from '@/src/features/setup-assistant/services/vision.service';
import { isValidImageUrl } from '@/src/features/setup-assistant/utils';

// Route params type for Next.js 15
interface RouteParams {
  params: Promise<{ conversationId: string }>;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ======================
// GET - List messages with cursor pagination
// ======================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID format' },
        { status: 400 }
      );
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;
    const { searchParams } = new URL(request.url);

    // Parse pagination params
    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit, 100);
    const before = searchParams.get('before'); // Cursor: created_at timestamp

    // Verify conversation exists and belongs to tenant
    const { data: conversation, error: convError } = await supabase
      .from('setup_assistant_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = supabase
      .from('setup_assistant_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply cursor if provided
    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SetupAssistant] Error listing messages:', error);
      return NextResponse.json(
        { error: 'Failed to list messages' },
        { status: 500 }
      );
    }

    // Transform and reverse to chronological order
    const messages = (data || []).map(rowToMessage).reverse();

    return NextResponse.json({
      messages,
      hasMore: (data?.length || 0) === limit,
      nextCursor: data?.[data.length - 1]?.created_at || null,
    });
  } catch (error) {
    console.error('[SetupAssistant] List messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Send message and get AI response
// ======================
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params;

    // Validate UUID format
    if (!UUID_REGEX.test(conversationId)) {
      return NextResponse.json(
        { error: 'Invalid conversation ID format' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, aiLimiter);
    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    // Parse body
    let body: SendMessageRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate content
    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    const messageContent = body.content.trim().slice(0, 10000); // Limit message length

    // 1. Verify conversation exists and is active
    const { data: conversation, error: convError } = await supabase
      .from('setup_assistant_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (conversation.status !== 'active') {
      return NextResponse.json(
        { error: 'Conversation is not active', code: 'CONVERSATION_INACTIVE' },
        { status: 400 }
      );
    }

    // 2. Check usage limits
    const { data: usageData, error: usageError } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (usageError) {
      console.error('[SetupAssistant] Error checking usage:', usageError);
    }

    const usage = usageData?.[0];
    if (usage && usage.messages_count >= usage.messages_limit) {
      return NextResponse.json(
        {
          error: 'Daily message limit reached',
          code: 'LIMIT_REACHED',
          usage: {
            messagesCount: usage.messages_count,
            messagesLimit: usage.messages_limit,
            planId: usage.plan_id,
            resetAt: usage.reset_at,
          },
        },
        { status: 429 }
      );
    }

    // 3. Validate and transform attachments
    // Attachments should be MessageAttachment objects from /upload response
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

    // 4. Save user message
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
      console.error('[SetupAssistant] Error saving user message:', userMsgError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // 5. Load context for the LangGraph agent
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

    // 6. Get previous messages for context
    const { data: previousMessages } = await supabase
      .from('setup_assistant_messages')
      .select('role, content, attachments')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    // 7. Build context for the agent
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

    // 8. Analyze image attachments with Gemini Vision
    let visionAnalysis: VisionAnalysis | undefined;
    let visionUsageCount = 0;

    const imageAttachments = validAttachments.filter(att => att.mimeType.startsWith('image/'));

    if (imageAttachments.length > 0) {
      // Check vision usage limit before analyzing
      const currentVisionUsage = usage?.vision_requests || 0;
      const visionLimit = usage?.vision_limit || 2; // Default: starter plan

      if (currentVisionUsage < visionLimit) {
        // Analyze first image attachment (to limit API calls)
        const imageToAnalyze = imageAttachments[0];

        // Security: Validate URL is from allowed sources (SSRF prevention)
        if (!isValidImageUrl(imageToAnalyze.url)) {
          console.warn('[SetupAssistant] Skipping vision analysis - invalid URL source:', imageToAnalyze.url);
        } else {
          try {
            // Get context-appropriate analysis based on vertical
            const analysisContext = visionService.getContextForVertical(context.vertical);

            visionAnalysis = await visionService.analyzeImage({
              imageUrl: imageToAnalyze.url,
              mimeType: imageToAnalyze.mimeType,
              context: analysisContext,
              additionalContext: messageContent, // User's message provides context
            });

            // Update attachment with analysis result
            const attachmentIndex = validAttachments.findIndex(a => a.url === imageToAnalyze.url);
            if (attachmentIndex !== -1) {
              validAttachments[attachmentIndex].analysis = visionAnalysis;
            }

            visionUsageCount = 1;

            console.log('[SetupAssistant] Vision analysis completed:', {
              confidence: visionAnalysis.confidence,
              type: visionAnalysis.extractedData?.type,
              itemCount: Array.isArray(visionAnalysis.extractedData?.items)
                ? visionAnalysis.extractedData.items.length
                : 0,
            });
          } catch (visionError) {
            console.error('[SetupAssistant] Vision analysis failed:', visionError);
            // Continue without vision analysis - non-blocking
          }
        }
      } else {
        console.warn('[SetupAssistant] Vision limit reached, skipping analysis');
      }
    }

    // 9. Process with LangGraph Agent
    const agentResult = await setupAssistantService.processMessage({
      conversationId,
      context,
      messages: (previousMessages || []).map(m => ({
        role: m.role as SetupStateMessage['role'],
        content: m.content,
        attachments: m.attachments,
      })),
      currentMessage: messageContent,
      attachments: validAttachments.map(a => a.url),
      visionAnalysis,
    });

    const assistantResponse = {
      content: agentResult.response,
      actionsTaken: agentResult.executedActions,
      inputTokens: agentResult.inputTokens,
      outputTokens: agentResult.outputTokens,
    };

    // 10. Update user message with vision analysis if available
    if (visionAnalysis) {
      await supabase
        .from('setup_assistant_messages')
        .update({ attachments: validAttachments })
        .eq('id', userMessageData.id);
    }

    // 12. Save assistant message
    const { data: assistantMessageData, error: assistantMsgError } = await supabase
      .from('setup_assistant_messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        role: 'assistant',
        content: assistantResponse.content,
        attachments: [],
        actions_taken: assistantResponse.actionsTaken,
        input_tokens: assistantResponse.inputTokens,
        output_tokens: assistantResponse.outputTokens,
      })
      .select()
      .single();

    if (assistantMsgError) {
      console.error('[SetupAssistant] Error saving assistant message:', assistantMsgError);
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      );
    }

    // Update conversation last_message_at
    await supabase
      .from('setup_assistant_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // 13. Increment usage counters (including vision if used)
    await supabase.rpc('increment_setup_usage', {
      p_tenant_id: tenantId,
      p_messages: 1,
      p_files: 0,
      p_vision: visionUsageCount,
      p_input_tokens: assistantResponse.inputTokens,
      p_output_tokens: assistantResponse.outputTokens,
    });

    // 14. Build response with complete usage info
    const currentTokens = (usage?.total_tokens || 0);
    const newTokens = assistantResponse.inputTokens + assistantResponse.outputTokens;
    const newUsage: UsageInfo = {
      messagesCount: (usage?.messages_count || 0) + 1,
      messagesLimit: usage?.messages_limit || 20,
      filesUploaded: usage?.files_uploaded || 0,
      filesLimit: usage?.files_limit || 3,
      visionRequests: (usage?.vision_requests || 0) + visionUsageCount,
      visionLimit: usage?.vision_limit || 2,
      totalTokens: currentTokens + newTokens,
      tokensLimit: usage?.tokens_limit || 10000,
      planId: usage?.plan_id || 'starter',
      planName: usage?.plan_name || 'Starter',
      isAtLimit: (usage?.messages_count || 0) + 1 >= (usage?.messages_limit || 20),
      resetAt: usage?.reset_at ? new Date(usage.reset_at) : undefined,
    };

    const response: SendMessageResponse = {
      userMessage: rowToMessage(userMessageData),
      assistantMessage: rowToMessage(assistantMessageData),
      usage: newUsage,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SetupAssistant] Send message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

