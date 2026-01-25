// =====================================================
// TIS TIS PLATFORM - Setup Assistant API
// GET: List conversations
// POST: Create new conversation
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
  rowToConversation,
  type CreateConversationRequest,
  type SetupModule,
} from '@/src/features/setup-assistant';

// ======================
// GET - List user's conversations
// ======================
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, user } = authResult;
    const { searchParams } = new URL(request.url);

    // Parse query params with security limits
    const status = searchParams.get('status') || 'active';
    const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(isNaN(parsedLimit) || parsedLimit < 1 ? 20 : parsedLimit, 50);
    const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

    // Validate status
    const validStatuses = ['active', 'completed', 'archived'];
    const safeStatus = validStatuses.includes(status) ? status : 'active';

    const { data, error, count } = await supabase
      .from('setup_assistant_conversations')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('status', safeStatus)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[SetupAssistant] Error listing conversations:', error);
      return NextResponse.json(
        { error: 'Failed to list conversations' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const conversations = (data || []).map(rowToConversation);

    return NextResponse.json({
      conversations,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (data?.length || 0) === limit,
      },
    });
  } catch (error) {
    console.error('[SetupAssistant] Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create new conversation
// ======================
export async function POST(request: NextRequest) {
  try {
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

    const { client: supabase, tenantId, user } = authResult;

    // Parse body
    let body: CreateConversationRequest = {};
    try {
      const parsed = await request.json();
      // Ensure body is an object (not array, string, etc.)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed;
      }
    } catch {
      // Empty body is OK - will use defaults
    }

    // Validate module if provided
    const validModules: SetupModule[] = [
      'general', 'loyalty', 'agents', 'knowledge_base',
      'services', 'promotions', 'staff', 'branches'
    ];
    const selectedModule = body.module && validModules.includes(body.module) ? body.module : null;

    // Check usage limits before creating
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

    // Create conversation
    const { data: conversation, error: createError } = await supabase
      .from('setup_assistant_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        current_module: selectedModule,
        setup_progress: {},
        status: 'active',
      })
      .select()
      .single();

    if (createError) {
      console.error('[SetupAssistant] Error creating conversation:', createError);
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    // Transform to camelCase
    const transformedConversation = rowToConversation(conversation);

    // TODO: If initialMessage provided, process with LangGraph agent (Phase 3)
    // For now, return conversation only

    return NextResponse.json(
      {
        conversation: transformedConversation,
        initialResponse: null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[SetupAssistant] Create conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
