// =====================================================
// TIS TIS PLATFORM - Setup Assistant Usage
// GET: Get current usage and limits
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type { UsageInfo, DetailedUsageInfo } from '@/src/features/setup-assistant';
import { getLimitPercentage } from '@/src/features/setup-assistant';

// ======================
// GET - Get usage with limits
// ======================
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    // Call RPC function to get usage with limits
    const { data, error } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('[SetupAssistant] Error getting usage:', error);
      return NextResponse.json(
        { error: 'Failed to get usage' },
        { status: 500 }
      );
    }

    // Handle case where no usage record exists yet
    const usageRow = data?.[0] || {
      messages_count: 0,
      messages_limit: 20,
      files_uploaded: 0,
      files_limit: 3,
      vision_requests: 0,
      vision_limit: 2,
      total_tokens: 0,
      tokens_limit: 10000,
      plan_id: 'starter',
      plan_name: 'Starter',
      is_at_limit: false,
      reset_at: null,
    };

    // Build base usage response
    const baseUsage: UsageInfo = {
      messagesCount: usageRow.messages_count,
      messagesLimit: usageRow.messages_limit,
      filesUploaded: usageRow.files_uploaded,
      filesLimit: usageRow.files_limit,
      visionRequests: usageRow.vision_requests,
      visionLimit: usageRow.vision_limit,
      totalTokens: usageRow.total_tokens,
      tokensLimit: usageRow.tokens_limit,
      planId: usageRow.plan_id,
      planName: usageRow.plan_name,
      isAtLimit: usageRow.is_at_limit,
      resetAt: usageRow.reset_at ? new Date(usageRow.reset_at) : undefined,
    };

    // If detailed view requested, add percentages
    if (detailed) {
      const detailedUsage: DetailedUsageInfo = {
        ...baseUsage,
        tokensUsed: usageRow.total_tokens,
        tokensLimit: usageRow.tokens_limit,
        percentages: {
          messages: getLimitPercentage(usageRow.messages_count, usageRow.messages_limit),
          files: getLimitPercentage(usageRow.files_uploaded, usageRow.files_limit),
          vision: getLimitPercentage(usageRow.vision_requests, usageRow.vision_limit),
          tokens: getLimitPercentage(usageRow.total_tokens, usageRow.tokens_limit),
        },
      };
      return NextResponse.json(detailedUsage);
    }

    return NextResponse.json(baseUsage);
  } catch (error) {
    console.error('[SetupAssistant] Usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
