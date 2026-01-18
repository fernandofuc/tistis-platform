// =====================================================
// TIS TIS PLATFORM - Dismiss Security Alert API
// POST: Dismiss a specific security alert
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

// ======================
// POST - Dismiss alert
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: alertId } = await params;

    // Validate alertId format (alphanumeric with underscores, for generated alert IDs)
    if (!alertId || !/^[a-zA-Z0-9_-]+$/.test(alertId)) {
      return NextResponse.json(
        { error: 'ID de alerta inválido' },
        { status: 400 }
      );
    }

    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, user, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para descartar alertas' },
        { status: 403 }
      );
    }

    // Parse alert ID to extract type and key_id
    // Alert IDs follow pattern: alert_{timestamp}_{random}
    // We need to store which type of alert was dismissed for which key
    // For now, we'll parse request body for alert details
    let alertType: string | undefined;
    let keyId: string | undefined;

    try {
      const body = await request.json();
      alertType = body.alert_type;
      keyId = body.key_id;
    } catch {
      // Body is optional
    }

    // Store the dismissal using upsert to handle duplicates gracefully
    // The table has UNIQUE constraint on (tenant_id, alert_type, key_id)
    const { error: upsertError } = await supabase
      .from('api_key_dismissed_alerts')
      .upsert(
        {
          tenant_id: tenantId,
          alert_id: alertId,
          alert_type: alertType || 'unknown',
          key_id: keyId || null,
          dismissed_by: user.id,
          dismissed_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,alert_type,key_id',
          ignoreDuplicates: true, // If already dismissed, just ignore
        }
      );

    if (upsertError) {
      // Log error but don't fail - table might not exist yet
      console.error('[Dismiss Alert API] Upsert error:', upsertError.message);
      // Return error if it's not a table-not-found error
      if (!upsertError.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Error al guardar descarte de alerta' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Alerta descartada',
    });
  } catch (error) {
    console.error('[Dismiss Alert API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al descartar la alerta' },
      { status: 500 }
    );
  }
}
