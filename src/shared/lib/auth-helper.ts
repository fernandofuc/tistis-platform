// =====================================================
// TIS TIS PLATFORM - Authentication Helper
// Reusable authentication context for API routes
// Multi-tenant aware with fallback strategies
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface AuthenticatedContext {
  client: SupabaseClient;
  user: { id: string; email?: string };
  tenantId: string;
  role: string;
}

export interface AuthError {
  error: string;
  status: number;
}

export type AuthResult = AuthenticatedContext | AuthError;

/**
 * Get authenticated context from request
 * Returns user, tenant, and role info if authenticated
 * Uses multiple fallback strategies to find tenant:
 * 1. user_roles table (primary)
 * 2. user_metadata.tenant_id (fallback)
 * 3. staff table by email (last resort)
 */
export async function getAuthenticatedContext(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  // Strategy 1: Try user_roles table (primary method)
  const { data: userRole } = await serviceClient
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (userRole?.tenant_id) {
    return {
      client: serviceClient,
      user: { id: user.id, email: user.email },
      tenantId: userRole.tenant_id,
      role: userRole.role || 'user',
    };
  }

  // Strategy 2: Try user_metadata.tenant_id (fallback for OAuth/social login)
  const metadataTenantId = user.user_metadata?.tenant_id;
  if (metadataTenantId) {
    // Get role from staff table or default to 'user'
    const { data: staff } = await serviceClient
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', metadataTenantId)
      .single();

    return {
      client: serviceClient,
      user: { id: user.id, email: user.email },
      tenantId: metadataTenantId,
      role: staff?.role || user.user_metadata?.role || 'user',
    };
  }

  // Strategy 3: Find tenant via staff table by email (last resort)
  if (user.email) {
    const { data: staffByEmail } = await serviceClient
      .from('staff')
      .select('tenant_id, role')
      .eq('email', user.email)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (staffByEmail?.tenant_id) {
      return {
        client: serviceClient,
        user: { id: user.id, email: user.email },
        tenantId: staffByEmail.tenant_id,
        role: staffByEmail.role || 'user',
      };
    }
  }

  // No tenant found - user not properly provisioned
  console.error('[auth-helper] No tenant found for user:', user.id, user.email);
  return { error: 'User has no assigned tenant. Please contact support.', status: 403 };
}

/**
 * Check if result is an error
 */
export function isAuthError(result: AuthResult): result is AuthError {
  return 'error' in result;
}

/**
 * Create error response from auth error
 */
export function createAuthErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json({ error: error.error }, { status: error.status });
}
