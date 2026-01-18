// =====================================================
// TIS TIS PLATFORM - Mark Alert as Read API
// POST: Mark a specific security alert as read
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
// POST - Mark alert as read
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
        { error: 'No tienes permisos para marcar alertas' },
        { status: 403 }
      );
    }

    // Parse alert details from body
    let alertType: string | undefined;
    let keyId: string | undefined;

    try {
      const body = await request.json();
      alertType = body.alert_type;
      keyId = body.key_id;
    } catch {
      // Body is optional
    }

    // Store the read status using upsert
    // First try to insert, if it already exists (duplicate key), that's OK
    const { error: upsertError } = await supabase
      .from('api_key_read_alerts')
      .upsert(
        {
          tenant_id: tenantId,
          alert_id: alertId,
          alert_type: alertType || 'unknown',
          key_id: keyId || null,
          read_by: user.id,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,alert_id',
          ignoreDuplicates: false, // Update if exists
        }
      );

    if (upsertError) {
      // Log error but don't fail - table might not exist yet
      console.error('[Mark Read API] Upsert error:', upsertError.message);
      // Return error if it's not a table-not-found error
      if (!upsertError.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Error al guardar estado de lectura' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Alerta marcada como leída',
    });
  } catch (error) {
    console.error('[Mark Read API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al marcar la alerta como leída' },
      { status: 500 }
    );
  }
}
