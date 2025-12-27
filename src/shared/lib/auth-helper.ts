// =====================================================
// TIS TIS PLATFORM - Authentication Helper
// Reusable authentication context for API routes
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
 * Returns error if not authenticated or unauthorized
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
  const { data: userRole, error: roleError } = await serviceClient
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (roleError || !userRole) {
    return { error: 'User has no assigned role', status: 403 };
  }

  return {
    client: serviceClient,
    user: { id: user.id, email: user.email },
    tenantId: userRole.tenant_id,
    role: userRole.role,
  };
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
