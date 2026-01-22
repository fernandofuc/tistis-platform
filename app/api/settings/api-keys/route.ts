// =====================================================
// TIS TIS PLATFORM - API Keys Settings API
// GET: List all API keys for tenant
// POST: Create new API key
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import type {
  APIKeysListResponse,
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
  APIKeyListItem,
} from '@/src/features/api-settings/types';
import {
  generateAPIKey,
  filterValidScopes,
  validateIPWhitelist,
  validateExpirationDate,
} from '@/src/features/api-settings/utils';
import { getPlanRateLimits } from '@/src/features/api-settings/constants';
import { logKeyCreated } from '@/src/features/api-settings/services/auditLog.service';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

// ======================
// GET - List all API keys
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
        { error: 'No tienes permisos para ver las API Keys' },
        { status: 403 }
      );
    }

    // Fetch API keys for this tenant with branch info (FASE 2)
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select(
        `
        id,
        name,
        description,
        key_hint,
        key_prefix,
        environment,
        branch_id,
        scope_type,
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        is_active,
        last_used_at,
        usage_count,
        created_at,
        expires_at,
        branches!api_keys_branch_id_fkey (
          name
        )
      `
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API Keys API] GET error:', error);
      return NextResponse.json(
        { error: 'Error al obtener las API Keys' },
        { status: 500 }
      );
    }

    // Transform to list items (FASE 2: include branch info)
    const keysList: APIKeyListItem[] = (keys || []).map((key: any) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      key_hint: key.key_hint,
      key_prefix: key.key_prefix,
      environment: key.environment,
      branch_id: key.branch_id || null,
      scope_type: key.scope_type || 'tenant',
      branch_name: key.branches?.name || undefined,
      scopes: key.scopes || [],
      is_active: key.is_active,
      last_used_at: key.last_used_at,
      usage_count: key.usage_count || 0,
      created_at: key.created_at,
      expires_at: key.expires_at,
    }));

    const response: APIKeysListResponse = {
      keys: keysList,
      total: keysList.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Keys API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener las API Keys' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create new API key
// ======================
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, user, tenantId, role } = authResult;

    // Check permissions
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para crear API Keys' },
        { status: 403 }
      );
    }

    // Parse request body
    let body: CreateAPIKeyRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Cuerpo de la solicitud inválido' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
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

    // Validate environment
    const environment = body.environment === 'test' ? 'test' : 'live';

    // ✅ FASE 2: Validate scope_type and branch_id
    const scopeType = body.scope_type === 'tenant' ? 'tenant' : 'branch';
    const branchId = scopeType === 'branch' ? body.branch_id : null;

    // If scope is branch, branch_id is required
    if (scopeType === 'branch' && !branchId) {
      return NextResponse.json(
        { error: 'branch_id es requerido cuando scope_type es "branch"' },
        { status: 400 }
      );
    }

    // If branch_id is provided, validate it belongs to this tenant
    if (branchId) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id, tenant_id')
        .eq('id', branchId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (branchError || !branch) {
        return NextResponse.json(
          { error: 'La sucursal especificada no existe o no pertenece a tu tenant' },
          { status: 400 }
        );
      }
    }

    // Check max keys limit
    const { count: existingKeysCount } = await supabase
      .from('api_keys')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // Get tenant plan for limits
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan')
      .eq('id', tenantId)
      .single();

    const plan = tenant?.plan || 'starter';
    const limits = getPlanRateLimits(plan);

    if ((existingKeysCount || 0) >= limits.max_keys) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de ${limits.max_keys} API Keys para tu plan ${plan}. Actualiza tu plan para crear más.`,
        },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', body.name.trim())
      .single();

    if (existingKey) {
      return NextResponse.json(
        { error: 'Ya existe una API Key con este nombre' },
        { status: 400 }
      );
    }

    // Generate the API key
    const generatedKey = generateAPIKey(environment);

    // Validate and sanitize scopes (only allow defined scopes)
    const scopes = filterValidScopes(body.scopes || []);

    // Validate IP whitelist
    const ipWhitelist = validateIPWhitelist(body.ip_whitelist);

    // Validate rate limits (using plan max values)
    const rateLimitRpm = Math.min(
      Math.max(body.rate_limit_rpm || limits.default_rpm, 1),
      limits.max_rpm
    );
    const rateLimitDaily = Math.min(
      Math.max(body.rate_limit_daily || limits.default_daily, 100),
      limits.max_daily
    );

    // Validate expiration date
    const expirationResult = validateExpirationDate(body.expires_at);
    if (!expirationResult.valid) {
      return NextResponse.json(
        { error: expirationResult.error },
        { status: 400 }
      );
    }
    const expiresAt = expirationResult.value ?? null;

    // Insert the new API key (FASE 2: with branch context)
    const { data: newKey, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        key_hash: generatedKey.hash,
        key_hint: generatedKey.hint,
        key_prefix: generatedKey.prefix,
        environment,
        scope_type: scopeType,
        branch_id: branchId,
        scopes,
        rate_limit_rpm: rateLimitRpm,
        rate_limit_daily: rateLimitDaily,
        ip_whitelist: ipWhitelist,
        expires_at: expiresAt,
        is_active: true,
        usage_count: 0,
      })
      .select(
        `
        id,
        name,
        description,
        key_hint,
        key_prefix,
        environment,
        branch_id,
        scope_type,
        scopes,
        is_active,
        created_at,
        expires_at
      `
      )
      .single();

    if (insertError) {
      console.error('[API Keys API] POST insert error:', insertError);

      // Check for unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Ya existe una API Key con este nombre' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Error al crear la API Key' },
        { status: 500 }
      );
    }

    // Get user email for audit log
    const { data: staffData } = await supabase
      .from('staff')
      .select('email')
      .eq('user_id', user.id)
      .single();

    // Log the creation event
    await logKeyCreated(newKey.id, newKey.name, {
      tenantId,
      actorId: user.id,
      actorEmail: staffData?.email,
      supabase,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    // Build response with the secret key (shown only once) - FASE 2
    const keyListItem: APIKeyListItem = {
      id: newKey.id,
      name: newKey.name,
      description: newKey.description,
      key_hint: newKey.key_hint,
      key_prefix: newKey.key_prefix,
      environment: newKey.environment,
      branch_id: newKey.branch_id || null,
      scope_type: newKey.scope_type || 'tenant',
      scopes: newKey.scopes || [],
      is_active: newKey.is_active,
      usage_count: 0,
      created_at: newKey.created_at,
      expires_at: newKey.expires_at,
    };

    const response: CreateAPIKeyResponse = {
      key: keyListItem,
      api_key_secret: generatedKey.key,
      message: 'Guarda esta key de forma segura. No la volverás a ver.',
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[API Keys API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al crear la API Key' },
      { status: 500 }
    );
  }
}
