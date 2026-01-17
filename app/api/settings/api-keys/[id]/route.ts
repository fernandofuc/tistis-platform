// =====================================================
// TIS TIS PLATFORM - API Key Detail API
// GET: Get API key details
// PATCH: Update API key (name, description, scopes, limits)
// DELETE: Revoke API key (soft delete)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type {
  APIKeyDetailResponse,
  APIKeyWithCreator,
  UpdateAPIKeyRequest,
  UpdateAPIKeyResponse,
  RevokeAPIKeyRequest,
  RevokeAPIKeyResponse,
} from '@/src/features/api-settings/types';
import { filterValidScopes } from '@/src/features/api-settings/utils';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Validate scopes using the official scope validator
 * Returns null if scopes not provided (for PATCH operations)
 */
function validateScopesForUpdate(scopes: unknown): string[] | null {
  if (scopes === undefined) {
    return null; // Not provided, don't update
  }
  if (!Array.isArray(scopes)) {
    return [];
  }
  return filterValidScopes(scopes);
}

/**
 * Validate IP whitelist format (supports IPv4, IPv6, and CIDR notation)
 * Returns undefined if not provided, null to clear, or array of valid IPs
 */
function validateIPWhitelist(ips: unknown): string[] | null | undefined {
  if (ips === undefined) {
    return undefined; // Not provided, don't update
  }
  if (ips === null || (Array.isArray(ips) && ips.length === 0)) {
    return null; // Explicitly clear whitelist
  }
  if (!Array.isArray(ips)) {
    return undefined;
  }

  // IPv4 with optional CIDR
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:3[0-2]|[12]?[0-9]))?$/;

  // IPv6 with optional CIDR (simplified)
  const ipv6Regex = /^([a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}(?:\/(?:12[0-8]|1[01][0-9]|[1-9]?[0-9]))?$/;

  const validIps = ips.filter(
    (ip): ip is string =>
      typeof ip === 'string' && (ipv4Regex.test(ip) || ipv6Regex.test(ip))
  );
  return validIps.length > 0 ? validIps : null;
}

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// ======================
// GET - Get API key details
// ======================
export async function GET(
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

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver esta API Key' },
        { status: 403 }
      );
    }

    // Fetch the API key with creator info
    const { data: key, error } = await supabase
      .from('api_keys')
      .select(
        `
        id,
        tenant_id,
        created_by,
        name,
        description,
        key_hint,
        key_prefix,
        environment,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        ip_whitelist,
        expires_at,
        is_active,
        last_used_at,
        last_used_ip,
        usage_count,
        created_at,
        updated_at,
        revoked_at,
        revoked_by,
        revoke_reason
      `
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !key) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'API Key no encontrada' },
          { status: 404 }
        );
      }
      console.error('[API Key Detail API] GET error:', error);
      return NextResponse.json(
        { error: 'Error al obtener la API Key' },
        { status: 500 }
      );
    }

    // Fetch creator info
    let creatorInfo: { email: string; full_name?: string } | undefined;
    if (key.created_by) {
      const { data: creator } = await supabase
        .from('staff')
        .select('email, first_name, last_name')
        .eq('user_id', key.created_by)
        .single();

      if (creator) {
        creatorInfo = {
          email: creator.email,
          full_name:
            creator.first_name || creator.last_name
              ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim()
              : undefined,
        };
      }
    }

    // Build response
    const keyWithCreator: APIKeyWithCreator = {
      id: key.id,
      tenant_id: key.tenant_id,
      created_by: key.created_by,
      name: key.name,
      description: key.description,
      key_hint: key.key_hint,
      key_prefix: key.key_prefix,
      environment: key.environment,
      scopes: key.scopes || [],
      rate_limit_rpm: key.rate_limit_rpm,
      rate_limit_daily: key.rate_limit_daily,
      ip_whitelist: key.ip_whitelist,
      expires_at: key.expires_at,
      is_active: key.is_active,
      last_used_at: key.last_used_at,
      last_used_ip: key.last_used_ip,
      usage_count: key.usage_count || 0,
      created_at: key.created_at,
      updated_at: key.updated_at,
      revoked_at: key.revoked_at,
      revoked_by: key.revoked_by,
      revoke_reason: key.revoke_reason,
      created_by_user: creatorInfo,
    };

    const response: APIKeyDetailResponse = {
      key: keyWithCreator,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Key Detail API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener la API Key' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update API key
// ======================
export async function PATCH(
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

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar esta API Key' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: UpdateAPIKeyRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de la solicitud inválido' },
        { status: 400 }
      );
    }

    // Check if key exists and is active
    const { data: existingKey, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, is_active, name')
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
        { error: 'No se puede modificar una API Key revocada' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'El nombre de la API Key es requerido' },
          { status: 400 }
        );
      }
      if (body.name.length > 100) {
        return NextResponse.json(
          { error: 'El nombre no puede exceder 100 caracteres' },
          { status: 400 }
        );
      }

      // Check for duplicate name (excluding current key)
      if (body.name.trim() !== existingKey.name) {
        const { data: duplicateKey } = await supabase
          .from('api_keys')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', body.name.trim())
          .neq('id', id)
          .single();

        if (duplicateKey) {
          return NextResponse.json(
            { error: 'Ya existe una API Key con este nombre' },
            { status: 400 }
          );
        }
      }

      updateData.name = body.name.trim();
    }

    // Add description if provided
    if (body.description !== undefined) {
      updateData.description = body.description?.trim() || null;
    }

    // Validate and add scopes if provided (only allow defined scopes)
    const scopes = validateScopesForUpdate(body.scopes);
    if (scopes !== null) {
      updateData.scopes = scopes;
    }

    // Validate and add rate limits if provided
    if (body.rate_limit_rpm !== undefined) {
      const rpm = Math.min(Math.max(Number(body.rate_limit_rpm) || 1, 1), 1000);
      updateData.rate_limit_rpm = rpm;
    }

    if (body.rate_limit_daily !== undefined) {
      const daily = Math.min(
        Math.max(Number(body.rate_limit_daily) || 100, 100),
        1000000
      );
      updateData.rate_limit_daily = daily;
    }

    // Validate and add IP whitelist if provided
    const ipWhitelist = validateIPWhitelist(body.ip_whitelist);
    if (ipWhitelist !== undefined) {
      updateData.ip_whitelist = ipWhitelist;
    }

    // Validate and add expiration if provided
    if (body.expires_at !== undefined) {
      if (body.expires_at === null) {
        updateData.expires_at = null;
      } else {
        const expirationDate = new Date(body.expires_at);
        if (isNaN(expirationDate.getTime())) {
          return NextResponse.json(
            { error: 'Fecha de expiración inválida' },
            { status: 400 }
          );
        }
        if (expirationDate <= new Date()) {
          return NextResponse.json(
            { error: 'La fecha de expiración debe ser en el futuro' },
            { status: 400 }
          );
        }
        updateData.expires_at = expirationDate.toISOString();
      }
    }

    // Update the API key
    const { data: updatedKey, error: updateError } = await supabase
      .from('api_keys')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(
        `
        id,
        tenant_id,
        created_by,
        name,
        description,
        key_hint,
        key_prefix,
        environment,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        ip_whitelist,
        expires_at,
        is_active,
        last_used_at,
        last_used_ip,
        usage_count,
        created_at,
        updated_at
      `
      )
      .single();

    if (updateError) {
      console.error('[API Key Detail API] PATCH error:', updateError);

      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una API Key con este nombre' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Error al actualizar la API Key' },
        { status: 500 }
      );
    }

    const response: UpdateAPIKeyResponse = {
      key: {
        ...updatedKey,
        scopes: updatedKey.scopes || [],
        usage_count: updatedKey.usage_count || 0,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Key Detail API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la API Key' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Revoke API key (soft delete)
// ======================
export async function DELETE(
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
        { error: 'No tienes permisos para revocar esta API Key' },
        { status: 403 }
      );
    }

    // Parse request body (optional reason)
    let body: RevokeAPIKeyRequest = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Ignore parse errors, reason is optional
    }

    // Check if key exists
    const { data: existingKey, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, is_active')
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
        { error: 'Esta API Key ya ha sido revocada' },
        { status: 400 }
      );
    }

    // Soft delete - set is_active to false and record revocation
    const { error: revokeError } = await supabase
      .from('api_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoke_reason: body.reason?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (revokeError) {
      console.error('[API Key Detail API] DELETE error:', revokeError);
      return NextResponse.json(
        { error: 'Error al revocar la API Key' },
        { status: 500 }
      );
    }

    const response: RevokeAPIKeyResponse = {
      success: true,
      message: 'API Key revocada exitosamente',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Key Detail API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al revocar la API Key' },
      { status: 500 }
    );
  }
}
