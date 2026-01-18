// =====================================================
// TIS TIS PLATFORM - API Key Rotation API
// POST: Rotate an API key (create new key, schedule old key deactivation)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type {
  RotateAPIKeyRequest,
  RotateAPIKeyResponse,
} from '@/src/features/api-settings/types';
import {
  generateAPIKey,
  isValidUUID,
} from '@/src/features/api-settings/utils';
import { logKeyRotated } from '@/src/features/api-settings/services/auditLog.service';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];
const DEFAULT_GRACE_PERIOD_HOURS = 24;
const MAX_GRACE_PERIOD_HOURS = 168; // 7 days

// ======================
// POST - Rotate API key
// ======================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!id || !isValidUUID(id)) {
      return NextResponse.json(
        { error: 'ID de API Key inválido' },
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
        { error: 'No tienes permisos para rotar API Keys' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: RotateAPIKeyRequest = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Body is optional
    }

    // Validate grace period
    const gracePeriodHours = Math.min(
      Math.max(body.grace_period_hours ?? DEFAULT_GRACE_PERIOD_HOURS, 0),
      MAX_GRACE_PERIOD_HOURS
    );

    // Fetch the existing API key
    const { data: existingKey, error: fetchError } = await supabase
      .from('api_keys')
      .select(
        `
        id,
        tenant_id,
        name,
        description,
        environment,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        ip_whitelist,
        expires_at,
        is_active
      `
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existingKey) {
      return NextResponse.json(
        { error: 'API Key no encontrada' },
        { status: 404 }
      );
    }

    if (!existingKey.is_active) {
      return NextResponse.json(
        { error: 'No se puede rotar una API Key revocada' },
        { status: 400 }
      );
    }

    // Generate the new API key
    const generatedKey = generateAPIKey(existingKey.environment);

    // Calculate deactivation date for old key
    const deactivationDate = new Date();
    deactivationDate.setHours(deactivationDate.getHours() + gracePeriodHours);

    // Create new key name with rotation suffix
    const rotationSuffix = ` (rotada ${new Date().toLocaleDateString('es-ES')})`;
    const newKeyName = existingKey.name.includes('(rotada')
      ? existingKey.name.replace(/\(rotada.*\)/, rotationSuffix.trim())
      : existingKey.name + rotationSuffix;

    // Create the new API key
    const { data: newKey, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        name: newKeyName,
        description: existingKey.description
          ? `${existingKey.description} [Rotada desde ${existingKey.name}]`
          : `Rotada desde ${existingKey.name}`,
        key_hash: generatedKey.hash,
        key_hint: generatedKey.hint,
        key_prefix: generatedKey.prefix,
        environment: existingKey.environment,
        scopes: body.copy_settings !== false ? existingKey.scopes : [],
        rate_limit_rpm: body.copy_settings !== false ? existingKey.rate_limit_rpm : 60,
        rate_limit_daily: body.copy_settings !== false ? existingKey.rate_limit_daily : 1000,
        ip_whitelist: body.copy_settings !== false ? existingKey.ip_whitelist : null,
        expires_at: existingKey.expires_at, // Keep same expiration
        is_active: true,
        usage_count: 0,
        // Note: rotated_from stored in metadata instead of dedicated column
        metadata: { rotated_from: id },
      })
      .select('id, name')
      .single();

    if (insertError) {
      console.error('[Rotate API Key] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Error al crear la nueva API Key' },
        { status: 500 }
      );
    }

    // Schedule deactivation of old key (or deactivate immediately if grace period is 0)
    if (gracePeriodHours === 0) {
      // Immediate revocation
      await supabase
        .from('api_keys')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: `Rotación de key - Nueva key: ${newKey.id}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    } else {
      // Schedule deactivation - store in metadata since we don't have dedicated columns
      // A background job would need to check metadata.scheduled_deactivation_at
      await supabase
        .from('api_keys')
        .update({
          metadata: {
            scheduled_deactivation_at: deactivationDate.toISOString(),
            rotation_replacement_id: newKey.id,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    // Get user email for audit log
    const { data: staffData } = await supabase
      .from('staff')
      .select('email')
      .eq('user_id', user.id)
      .single();

    // Log the rotation event
    await logKeyRotated(id, newKey.id, existingKey.name, {
      tenantId,
      actorId: user.id,
      actorEmail: staffData?.email,
      supabase,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    // Build response
    const response: RotateAPIKeyResponse = {
      old_key: {
        id,
        name: existingKey.name,
        deactivation_scheduled_at: deactivationDate.toISOString(),
      },
      new_key: {
        id: newKey.id,
        name: newKey.name,
        api_key_secret: generatedKey.key,
      },
      message: gracePeriodHours > 0
        ? `API Key rotada. La key anterior seguirá activa durante ${gracePeriodHours} horas.`
        : 'API Key rotada. La key anterior ha sido desactivada inmediatamente.',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[Rotate API Key] Error:', error);
    return NextResponse.json(
      { error: 'Error al rotar la API Key' },
      { status: 500 }
    );
  }
}
