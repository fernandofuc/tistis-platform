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

    // Default values for when RPC fails or returns no data
    const defaultUsage = {
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

    // Call RPC function to get usage with limits
    let usageRow = defaultUsage;
    try {
      const { data, error } = await supabase.rpc('get_setup_usage_with_limits', {
        p_tenant_id: tenantId,
      });

      if (error) {
        // Log but don't fail - use defaults instead
        console.warn('[SetupAssistant] RPC error, using defaults:', error.message);
      } else if (data && data.length > 0) {
        usageRow = data[0];
      }
    } catch (rpcError) {
      // RPC completely failed - use defaults
      console.warn('[SetupAssistant] RPC exception, using defaults:', rpcError);
    }

    // Build base usage response
    const baseUsage: UsageInfo = {
      messagesCount: usageRow.messages_count ?? 0,
      messagesLimit: usageRow.messages_limit ?? 20,
      filesUploaded: usageRow.files_uploaded ?? 0,
      filesLimit: usageRow.files_limit ?? 3,
      visionRequests: usageRow.vision_requests ?? 0,
      visionLimit: usageRow.vision_limit ?? 2,
      totalTokens: usageRow.total_tokens ?? 0,
      tokensLimit: usageRow.tokens_limit ?? 10000,
      planId: usageRow.plan_id ?? 'starter',
      planName: usageRow.plan_name ?? 'Starter',
      isAtLimit: usageRow.is_at_limit ?? false,
      resetAt: usageRow.reset_at ? new Date(usageRow.reset_at) : undefined,
    };

    // If detailed view requested, add percentages
    if (detailed) {
      const detailedUsage: DetailedUsageInfo = {
        ...baseUsage,
        tokensUsed: usageRow.total_tokens ?? 0,
        tokensLimit: usageRow.tokens_limit ?? 10000,
        percentages: {
          messages: getLimitPercentage(baseUsage.messagesCount, baseUsage.messagesLimit),
          files: getLimitPercentage(baseUsage.filesUploaded, baseUsage.filesLimit),
          vision: getLimitPercentage(baseUsage.visionRequests, baseUsage.visionLimit),
          tokens: getLimitPercentage(baseUsage.totalTokens ?? 0, baseUsage.tokensLimit ?? 10000),
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
