/**
 * TIS TIS Platform - Voice Agent v2 Feature Flags Admin API
 *
 * Admin endpoint for managing Voice Agent v2 feature flags.
 * Requires admin role authentication.
 *
 * @module app/api/admin/feature-flags/voice-agent-v2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getVoiceAgentV2Flags,
  getRolloutStatus,
  updateRolloutPercentage,
  enableVoiceAgentV2,
  disableVoiceAgentV2,
  enableTenantForV2,
  disableTenantForV2,
  resetTenantOverride,
  getVoiceAgentV2AuditLog,
  getTenantV2StatusList,
  batchUpdateTenantV2Status,
  clearV2StatusCache,
} from '@/lib/feature-flags';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Create Supabase client with service role
 */
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Verify admin access from JWT
 */
async function verifyAdminAccess(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const token = authHeader.substring(7);
  const supabase = createServiceClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { valid: false, error: 'Invalid token' };
  }

  // Check if user is platform admin
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['platform_admin', 'super_admin'])
    .single();

  if (!role) {
    return { valid: false, error: 'Admin access required' };
  }

  return {
    valid: true,
    userId: user.id,
    email: user.email,
  };
}

// =====================================================
// GET - Get current feature flag status
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const url = new URL(request.url);
    const includeAudit = url.searchParams.get('includeAudit') === 'true';
    const includeTenants = url.searchParams.get('includeTenants') === 'true';

    // Get flag status and rollout metrics
    const [flags, status] = await Promise.all([
      getVoiceAgentV2Flags(),
      getRolloutStatus(),
    ]);

    const response: Record<string, unknown> = {
      flags,
      status,
    };

    // Optionally include audit log
    if (includeAudit) {
      response.auditLog = await getVoiceAgentV2AuditLog(20);
    }

    // Optionally include tenant list
    if (includeTenants) {
      response.tenants = await getTenantV2StatusList();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Admin API] Failed to get feature flags:', error);
    return NextResponse.json(
      { error: 'Failed to get feature flags' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Update feature flag settings
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.valid) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action parameter' },
        { status: 400 }
      );
    }

    const updatedBy = auth.email || auth.userId;

    switch (action) {
      case 'enable':
        await enableVoiceAgentV2(updatedBy);
        break;

      case 'disable':
        await disableVoiceAgentV2(updatedBy);
        break;

      case 'updatePercentage':
        if (typeof params.percentage !== 'number') {
          return NextResponse.json(
            { error: 'Missing percentage parameter' },
            { status: 400 }
          );
        }
        await updateRolloutPercentage(params.percentage, updatedBy);
        break;

      case 'enableTenant':
        if (!params.tenantId) {
          return NextResponse.json(
            { error: 'Missing tenantId parameter' },
            { status: 400 }
          );
        }
        // Validate tenantId format (UUID or non-empty string)
        if (typeof params.tenantId !== 'string' || params.tenantId.trim() === '') {
          return NextResponse.json(
            { error: 'Invalid tenantId format' },
            { status: 400 }
          );
        }
        await enableTenantForV2(params.tenantId, updatedBy);
        break;

      case 'disableTenant':
        if (!params.tenantId) {
          return NextResponse.json(
            { error: 'Missing tenantId parameter' },
            { status: 400 }
          );
        }
        if (typeof params.tenantId !== 'string' || params.tenantId.trim() === '') {
          return NextResponse.json(
            { error: 'Invalid tenantId format' },
            { status: 400 }
          );
        }
        await disableTenantForV2(params.tenantId, updatedBy);
        break;

      case 'resetTenant':
        if (!params.tenantId) {
          return NextResponse.json(
            { error: 'Missing tenantId parameter' },
            { status: 400 }
          );
        }
        if (typeof params.tenantId !== 'string' || params.tenantId.trim() === '') {
          return NextResponse.json(
            { error: 'Invalid tenantId format' },
            { status: 400 }
          );
        }
        await resetTenantOverride(params.tenantId, updatedBy);
        break;

      case 'batchUpdate':
        if (!Array.isArray(params.updates)) {
          return NextResponse.json(
            { error: 'Missing updates array' },
            { status: 400 }
          );
        }
        const result = await batchUpdateTenantV2Status(params.updates, updatedBy);
        if (!result.success) {
          return NextResponse.json(
            { error: 'Some updates failed', errors: result.errors },
            { status: 207 } // Multi-Status
          );
        }
        break;

      case 'clearCache':
        clearV2StatusCache();
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Return updated status
    const [flags, status] = await Promise.all([
      getVoiceAgentV2Flags(),
      getRolloutStatus(),
    ]);

    return NextResponse.json({
      success: true,
      action,
      flags,
      status,
    });
  } catch (error) {
    console.error('[Admin API] Failed to update feature flags:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update feature flags' },
      { status: 500 }
    );
  }
}
