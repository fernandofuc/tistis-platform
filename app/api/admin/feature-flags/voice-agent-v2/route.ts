/**
 * TIS TIS Platform - Voice Agent Feature Flags Admin API v2.0
 *
 * Admin endpoint for managing Voice Agent feature flags.
 * Arquitectura simplificada - Solo v2 (on/off toggle)
 *
 * Requires admin role authentication.
 *
 * @module app/api/admin/feature-flags/voice-agent-v2
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getVoiceAgentFlags,
  enableVoiceAgent,
  disableVoiceAgent,
  enableTenantVoiceAgent,
  disableTenantVoiceAgent,
  resetTenantVoiceOverride,
  getVoiceAgentAuditLog,
  getTenantVoiceStatusList,
  clearVoiceStatusCache,
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

    // Get flag status (simplified v2-only architecture)
    const flags = await getVoiceAgentFlags();

    const response: Record<string, unknown> = {
      flags,
      // In v2-only architecture, status is simply enabled/disabled
      status: {
        enabled: flags.enabled,
        enabledTenantsCount: flags.enabledTenants.length,
        disabledTenantsCount: flags.disabledTenants.length,
      },
    };

    // Optionally include audit log
    if (includeAudit) {
      response.auditLog = await getVoiceAgentAuditLog(20);
    }

    // Optionally include tenant list
    if (includeTenants) {
      response.tenants = await getTenantVoiceStatusList();
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
        await enableVoiceAgent(updatedBy);
        break;

      case 'disable':
        await disableVoiceAgent(updatedBy);
        break;

      case 'enableTenant':
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
        await enableTenantVoiceAgent(params.tenantId, updatedBy);
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
        await disableTenantVoiceAgent(params.tenantId, updatedBy);
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
        await resetTenantVoiceOverride(params.tenantId, updatedBy);
        break;

      case 'clearCache':
        clearVoiceStatusCache();
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Return updated status
    const flags = await getVoiceAgentFlags();

    return NextResponse.json({
      success: true,
      action,
      flags,
      status: {
        enabled: flags.enabled,
        enabledTenantsCount: flags.enabledTenants.length,
        disabledTenantsCount: flags.disabledTenants.length,
      },
    });
  } catch (error) {
    console.error('[Admin API] Failed to update feature flags:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update feature flags' },
      { status: 500 }
    );
  }
}
