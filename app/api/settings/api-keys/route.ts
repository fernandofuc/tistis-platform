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
} from '@/src/features/api-settings/utils';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// CONSTANTS
// ======================

const ALLOWED_ROLES = ['owner', 'admin'];

// Rate limits by plan (can be moved to constants file later)
const PLAN_LIMITS = {
  starter: { max_keys: 2, default_rpm: 30, default_daily: 1000 },
  growth: { max_keys: 10, default_rpm: 60, default_daily: 10000 },
  enterprise: { max_keys: 50, default_rpm: 100, default_daily: 100000 },
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Validate IP whitelist format (supports IPv4, IPv6, and CIDR notation)
 * Returns null if empty or no valid IPs (null means "allow all")
 */
function validateIPWhitelist(ips: unknown): string[] | null {
  if (!Array.isArray(ips) || ips.length === 0) {
    return null;
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

  // Return null if no valid IPs (allow all) instead of empty array
  return validIps.length > 0 ? validIps : null;
}

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

    // Fetch API keys for this tenant
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
        scopes,
        rate_limit_rpm,
        rate_limit_daily,
        is_active,
        last_used_at,
        usage_count,
        created_at,
        expires_at
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

    const plan = (tenant?.plan || 'starter') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

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

    // Validate rate limits
    const rateLimitRpm = Math.min(
      Math.max(body.rate_limit_rpm || limits.default_rpm, 1),
      limits.default_rpm * 2
    );
    const rateLimitDaily = Math.min(
      Math.max(body.rate_limit_daily || limits.default_daily, 100),
      limits.default_daily * 2
    );

    // Validate expiration date
    let expiresAt: string | null = null;
    if (body.expires_at) {
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
      expiresAt = expirationDate.toISOString();
    }

    // Insert the new API key
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

    // Build response with the secret key (shown only once)
    const keyListItem: APIKeyListItem = {
      id: newKey.id,
      name: newKey.name,
      description: newKey.description,
      key_hint: newKey.key_hint,
      key_prefix: newKey.key_prefix,
      environment: newKey.environment,
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
