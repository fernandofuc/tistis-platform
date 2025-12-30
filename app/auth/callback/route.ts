import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ======================
// TYPES
// ======================
interface TenantCheckResult {
  hasTenant: boolean;
  tenantId?: string;
  error?: string;
}

// ======================
// CONSTANTS
// ======================
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 365 * 7; // 7 years

// ======================
// ERROR MESSAGES
// ======================
const ERROR_MESSAGES = {
  MISSING_CREDENTIALS: 'missing_credentials',
  NO_SESSION: 'no_session',
  NO_CODE: 'no_code',
  AUTH_FAILED: 'authentication_failed',
  INVALID_STATE: 'invalid_state',
} as const;

// ======================
// HELPER: Check if user has a tenant/subscription
// ======================
async function checkUserHasTenant(userId: string): Promise<TenantCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('⚠️ [Callback] Missing service role key, cannot check tenant');
    return { hasTenant: true }; // Assume has tenant to avoid blocking
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check if user has a role assigned (which means they have a tenant)
    const { data: userRole, error } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .eq('is_active', true) // Only check active roles
      .single();

    if (error) {
      // PGRST116 = no rows found, user is new
      if (error.code === 'PGRST116') {
        console.log('🟡 [Callback] New user - no tenant assigned');
        return { hasTenant: false };
      }

      console.warn('⚠️ [Callback] Error checking user tenant:', error);
      return { hasTenant: true, error: error.message };
    }

    if (!userRole?.tenant_id) {
      console.warn('⚠️ [Callback] User role found but no tenant_id');
      return { hasTenant: false };
    }

    console.log('✅ [Callback] User has tenant:', userRole.tenant_id);
    return {
      hasTenant: true,
      tenantId: userRole.tenant_id
    };
  } catch (err) {
    console.error('🔴 [Callback] Exception checking user tenant:', err);
    return {
      hasTenant: true,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

// ======================
// HELPER: Set session cookies on response
// ======================
function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  // Set access token cookie
  response.cookies.set('sb-access-token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  // Set refresh token cookie
  response.cookies.set('sb-refresh-token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });

  console.log('✅ [Callback] Session cookies set successfully');
}

// ======================
// HELPER: Create error redirect
// ======================
function createErrorRedirect(request: NextRequest, error: string): NextResponse {
  const url = new URL('/auth/login', request.url);
  url.searchParams.set('error', encodeURIComponent(error));
  return NextResponse.redirect(url);
}

// ======================
// HELPER: Validate request parameters
// ======================
function validateRequestParams(
  code: string | null,
  error: string | null
): { valid: boolean; errorMessage?: string } {
  // Check for OAuth provider errors
  if (error) {
    return { valid: false, errorMessage: error };
  }

  // Check for authorization code
  if (!code) {
    return { valid: false, errorMessage: ERROR_MESSAGES.NO_CODE };
  }

  // Basic validation of code format
  if (code.length < 10 || code.length > 500) {
    console.warn('⚠️ [Callback] Suspicious code length:', code.length);
    return { valid: false, errorMessage: ERROR_MESSAGES.INVALID_STATE };
  }

  return { valid: true };
}

// ======================
// MAIN HANDLER
// ======================
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestUrl = new URL(request.url);

  // Extract parameters
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const errorUri = requestUrl.searchParams.get('error_uri');

  // Log request
  console.log('🔵 [Callback] OAuth callback received:', {
    hasCode: !!code,
    hasError: !!error,
    timestamp: new Date().toISOString(),
  });

  // Validate request parameters
  const validation = validateRequestParams(code, error);
  if (!validation.valid) {
    console.error('🔴 [Callback] Invalid request:', {
      error: validation.errorMessage,
      errorDescription,
      errorUri,
    });
    return createErrorRedirect(request, validation.errorMessage || ERROR_MESSAGES.AUTH_FAILED);
  }

  // Code is guaranteed to be non-null here due to validation
  const authCode = code!;

  try {
    console.log('🔄 [Callback] Exchanging authorization code for session');

    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('🔴 [Callback] Missing Supabase credentials:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      });
      return createErrorRedirect(request, ERROR_MESSAGES.MISSING_CREDENTIALS);
    }

    // Create server client with cookie management
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (e) {
            console.warn('⚠️ [Callback] Failed to set cookie:', name, e);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (e) {
            console.warn('⚠️ [Callback] Failed to remove cookie:', name, e);
          }
        },
      },
    });

    // Exchange authorization code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);

    if (exchangeError) {
      console.error('🔴 [Callback] Code exchange failed:', {
        message: exchangeError.message,
        status: exchangeError.status,
        name: exchangeError.name,
      });
      return createErrorRedirect(request, exchangeError.message);
    }

    // Validate session data
    if (!data?.session) {
      console.error('🔴 [Callback] No session in exchange response');
      return createErrorRedirect(request, ERROR_MESSAGES.NO_SESSION);
    }

    const { session, user } = data;

    if (!user?.id || !user?.email) {
      console.error('🔴 [Callback] Invalid user data:', {
        hasId: !!user?.id,
        hasEmail: !!user?.email,
      });
      return createErrorRedirect(request, ERROR_MESSAGES.AUTH_FAILED);
    }

    console.log('✅ [Callback] Session created successfully:', {
      userId: user.id,
      email: user.email,
      provider: user.app_metadata?.provider,
    });

    // Check if user has tenant (determines redirect destination)
    const tenantCheck = await checkUserHasTenant(user.id);

    // Determine redirect URL
    let redirectUrl: URL;

    if (tenantCheck.hasTenant) {
      // Existing user with tenant - redirect to dashboard
      console.log('✅ [Callback] Existing user - redirecting to dashboard');
      redirectUrl = new URL('/dashboard', request.url);
    } else {
      // New user without tenant - redirect to pricing/onboarding
      console.log('🆕 [Callback] New user - redirecting to pricing');
      redirectUrl = new URL('/pricing', request.url);
      redirectUrl.searchParams.set('new_user', 'true');
      redirectUrl.searchParams.set('email', user.email);

      // Preserve OAuth provider info
      if (user.app_metadata?.provider) {
        redirectUrl.searchParams.set('provider', user.app_metadata.provider);
      }
    }

    // Create redirect response
    const response = NextResponse.redirect(redirectUrl);

    // Set session cookies
    if (session.access_token && session.refresh_token) {
      setSessionCookies(response, session.access_token, session.refresh_token);
    } else {
      console.warn('⚠️ [Callback] Missing tokens in session');
    }

    // Log completion time
    const duration = Date.now() - startTime;
    console.log(`✅ [Callback] OAuth flow completed in ${duration}ms`);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('🔴 [Callback] Exception during OAuth callback:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    });
    return createErrorRedirect(request, ERROR_MESSAGES.AUTH_FAILED);
  }
}
