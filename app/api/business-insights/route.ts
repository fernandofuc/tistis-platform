// =====================================================
// TIS TIS PLATFORM - Business Insights API
// CRUD operations for Business IA insights
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import {
  getActiveInsights,
  canGenerateInsights,
  getUnseenInsightsCount,
} from '@/src/features/ai/services/business-insights.service';
import { checkRateLimitMigration } from '@/src/shared/lib/rate-limit-migration';
import {
  getClientIP,
  publicAPILimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Valid actions for PATCH
const VALID_ACTIONS = ['mark_seen', 'dismiss', 'acted_upon'] as const;
type ValidAction = typeof VALID_ACTIONS[number];

// ======================
// GET - Retrieve business insights for tenant
// ======================
export async function GET(request: NextRequest) {
  // Rate limiting: prevent excessive queries (100 per minute)
  const clientIP = getClientIP(request);
  const rateLimitResult = await checkRateLimitMigration(clientIP, publicAPILimiter);

  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

  try {
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    // Get tenant plan
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, name')
      .eq('id', tenantId)
      .single();

    // Check if can generate insights (for status)
    const eligibility = await canGenerateInsights(tenantId);

    // If starter plan, return blocked status
    if (tenant?.plan === 'starter') {
      return NextResponse.json({
        success: true,
        status: 'blocked',
        reason: 'Business IA no disponible en plan Starter',
        plan: 'starter',
        data: [],
        unseen_count: 0,
      });
    }

    // If not enough data, return onboarding status
    if (!eligibility.canGenerate) {
      return NextResponse.json({
        success: true,
        status: 'onboarding',
        reason: eligibility.reason,
        plan: tenant?.plan || 'essentials',
        progress: {
          current: eligibility.conversationCount,
          required: eligibility.requiredCount,
          percentage: Math.round((eligibility.conversationCount / eligibility.requiredCount) * 100),
        },
        data: [],
        unseen_count: 0,
      });
    }

    // Get active insights
    const insights = await getActiveInsights(tenantId);
    const unseenCount = await getUnseenInsightsCount(tenantId);

    return NextResponse.json({
      success: true,
      status: 'active',
      plan: tenant?.plan || 'essentials',
      data: insights,
      unseen_count: unseenCount,
      progress: {
        current: eligibility.conversationCount,
        required: eligibility.requiredCount,
        percentage: 100,
      },
    });
  } catch (error) {
    console.error('[Business Insights API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener insights' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update insight (mark as seen, dismiss, etc.)
// ======================
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId } = authResult;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    const { insight_id, action } = body;

    // Validate required fields
    if (!insight_id || !action) {
      return NextResponse.json(
        { error: 'insight_id y action son requeridos' },
        { status: 400 }
      );
    }

    // Validate insight_id is a valid UUID (security: prevent injection)
    if (typeof insight_id !== 'string' || !UUID_REGEX.test(insight_id)) {
      return NextResponse.json(
        { error: 'insight_id debe ser un UUID válido' },
        { status: 400 }
      );
    }

    // Validate action is one of allowed values
    if (!VALID_ACTIONS.includes(action as ValidAction)) {
      return NextResponse.json(
        { error: `Acción no válida. Usa: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify insight belongs to tenant (additional security layer)
    const { data: insight } = await supabase
      .from('ai_business_insights')
      .select('id')
      .eq('id', insight_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight no encontrado' },
        { status: 404 }
      );
    }

    // Process action
    let updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'mark_seen':
        // Update metadata to include seen_at
        const { data: currentInsight } = await supabase
          .from('ai_business_insights')
          .select('metadata')
          .eq('id', insight_id)
          .single();

        updateData.metadata = {
          ...(currentInsight?.metadata || {}),
          seen_at: new Date().toISOString(),
        };
        break;

      case 'dismiss':
        updateData.dismissed = true;
        break;

      case 'acted_upon':
        updateData.was_acted_upon = true;
        break;

      // No default needed - action was already validated above
    }

    const { error: updateError } = await supabase
      .from('ai_business_insights')
      .update(updateData)
      .eq('id', insight_id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[Business Insights API] PATCH error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      insight_id,
      action,
    });
  } catch (error) {
    console.error('[Business Insights API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar insight' },
      { status: 500 }
    );
  }
}
