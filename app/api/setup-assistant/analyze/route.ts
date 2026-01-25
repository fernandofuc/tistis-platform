// =====================================================
// TIS TIS PLATFORM - Setup Assistant Image Analysis
// POST: Analyze image using Gemini Vision
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { createServerClient } from '@/src/shared/lib/supabase';
import {
  checkRateLimit,
  getClientIP,
  aiLimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';
import { visionService, type AnalysisContext } from '@/src/features/setup-assistant/services/vision.service';
import { isValidImageUrl } from '@/src/features/setup-assistant/utils';
import type {
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  VisionAnalysis,
  UsageInfo,
  SetupModule,
} from '@/src/features/setup-assistant';

// Valid analysis contexts
const VALID_CONTEXTS: AnalysisContext[] = ['menu', 'services', 'promotion', 'general'];

// Map SetupModule to AnalysisContext
function moduleToContext(module?: SetupModule): AnalysisContext {
  if (!module) return 'general';
  switch (module) {
    case 'services':
      return 'services';
    case 'promotions':
      return 'promotion';
    default:
      return 'general';
  }
}

// Detect mimeType from URL extension
function getMimeTypeFromUrl(url: string): string {
  const lowercaseUrl = url.toLowerCase();
  if (lowercaseUrl.includes('.png') || lowercaseUrl.includes('image/png')) return 'image/png';
  if (lowercaseUrl.includes('.gif') || lowercaseUrl.includes('image/gif')) return 'image/gif';
  if (lowercaseUrl.includes('.webp') || lowercaseUrl.includes('image/webp')) return 'image/webp';
  // Default to JPEG for unknown
  return 'image/jpeg';
}

// ======================
// POST - Analyze image
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

    const { tenantId } = authResult;

    // Parse request body
    let body: AnalyzeImageRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { imageUrl, context, module } = body;

    // Validate required fields
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      );
    }

    // Validate URL is from allowed sources (security)
    if (!isValidImageUrl(imageUrl)) {
      return NextResponse.json(
        { error: 'Invalid image URL. Must be from authorized storage.' },
        { status: 400 }
      );
    }

    // Check vision usage limit
    const supabaseAdmin = createServerClient();
    const { data: usageData, error: usageError } = await supabaseAdmin.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (usageError) {
      console.error('[SetupAssistant] Error checking usage:', usageError);
    }

    const usageRow = usageData?.[0];
    if (usageRow && usageRow.vision_requests >= usageRow.vision_limit) {
      return NextResponse.json(
        {
          error: 'Daily vision analysis limit reached',
          code: 'LIMIT_REACHED',
          usage: {
            visionRequests: usageRow.vision_requests,
            visionLimit: usageRow.vision_limit,
            planId: usageRow.plan_id,
            resetAt: usageRow.reset_at,
          },
        },
        { status: 429 }
      );
    }

    // Determine analysis context
    let analysisContext: AnalysisContext = 'general';

    // Priority: explicit context > module mapping > general
    if (context && VALID_CONTEXTS.includes(context as AnalysisContext)) {
      analysisContext = context as AnalysisContext;
    } else if (module) {
      analysisContext = moduleToContext(module);
    }

    // Detect MIME type from URL
    const mimeType = getMimeTypeFromUrl(imageUrl);

    // Perform vision analysis
    let analysis: VisionAnalysis;
    try {
      analysis = await visionService.analyzeImage({
        imageUrl,
        mimeType,
        context: analysisContext,
      });
    } catch (visionError) {
      console.error('[SetupAssistant] Vision analysis error:', visionError);
      return NextResponse.json(
        {
          error: 'Failed to analyze image',
          details: visionError instanceof Error ? visionError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Increment vision usage counter
    const { error: incrementError } = await supabaseAdmin.rpc('increment_setup_usage', {
      p_tenant_id: tenantId,
      p_messages: 0,
      p_files: 0,
      p_vision: 1,
      p_input_tokens: 0,
      p_output_tokens: 0,
    });

    if (incrementError) {
      console.error('[SetupAssistant] Error incrementing vision usage:', incrementError);
    }

    // Build usage info (defaults match starter plan from limits.ts)
    const usage: UsageInfo = {
      messagesCount: usageRow?.messages_count || 0,
      messagesLimit: usageRow?.messages_limit || 20,
      filesUploaded: usageRow?.files_uploaded || 0,
      filesLimit: usageRow?.files_limit || 3,
      visionRequests: (usageRow?.vision_requests || 0) + 1,
      visionLimit: usageRow?.vision_limit || 2,
      planId: usageRow?.plan_id || 'starter',
      isAtLimit: false,
    };

    // Check if any limit is now at max
    usage.isAtLimit =
      usage.messagesCount >= usage.messagesLimit ||
      usage.filesUploaded >= usage.filesLimit ||
      usage.visionRequests >= usage.visionLimit;

    const response: AnalyzeImageResponse = {
      analysis,
      usage,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[SetupAssistant] Analyze error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
