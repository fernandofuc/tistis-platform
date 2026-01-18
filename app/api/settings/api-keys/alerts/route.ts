// =====================================================
// TIS TIS PLATFORM - API Keys Security Alerts API
// GET: Get security alerts for tenant's API keys
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type { SecurityAlert, APIKeyListItem } from '@/src/features/api-settings/types';
import { generateAllAlerts } from '@/src/features/api-settings/utils/securityAlerts';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

// ======================
// GET - Get security alerts
// ======================
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver las alertas de seguridad' },
        { status: 403 }
      );
    }

    // Fetch all active API keys for this tenant
    const { data: keys, error: keysError } = await supabase
      .from('api_keys')
      .select(
        `
        id,
        name,
        description,
        key_hint,
        key_prefix,
        environment,
        scopes,
        is_active,
        last_used_at,
        usage_count,
        created_at,
        expires_at
      `
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (keysError) {
      console.error('[Security Alerts API] GET keys error:', keysError);
      return NextResponse.json(
        { error: 'Error al obtener las API Keys' },
        { status: 500 }
      );
    }

    // Transform to list items
    const keysList: APIKeyListItem[] = (keys || []).map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      key_hint: key.key_hint,
      key_prefix: key.key_prefix,
      environment: key.environment,
      scopes: key.scopes || [],
      is_active: key.is_active,
      last_used_at: key.last_used_at,
      usage_count: key.usage_count || 0,
      created_at: key.created_at,
      expires_at: key.expires_at,
    }));

    // Fetch dismissed alert IDs from database (if table exists)
    let dismissedAlertIds: string[] = [];
    try {
      const { data: dismissedAlerts } = await supabase
        .from('api_key_dismissed_alerts')
        .select('alert_type, key_id')
        .eq('tenant_id', tenantId);

      // Create composite IDs for dismissed alerts
      dismissedAlertIds = (dismissedAlerts || []).map(
        (a) => `${a.alert_type}_${a.key_id || 'global'}`
      );
    } catch {
      // Table might not exist yet, that's okay
    }

    // Generate all alerts based on current key states
    const allAlerts = generateAllAlerts(keysList, tenantId);

    // Filter out dismissed alerts
    const activeAlerts: SecurityAlert[] = allAlerts.filter((alert) => {
      const compositeId = `${alert.type}_${alert.key_id || 'global'}`;
      return !dismissedAlertIds.includes(compositeId);
    });

    return NextResponse.json({
      alerts: activeAlerts,
      total: activeAlerts.length,
    });
  } catch (error) {
    console.error('[Security Alerts API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener las alertas de seguridad' },
      { status: 500 }
    );
  }
}
