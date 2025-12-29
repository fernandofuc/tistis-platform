import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ======================
// HELPER: Check if user has a tenant/subscription
// ======================
async function checkUserHasTenant(userId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('⚠️ Missing service role key, cannot check tenant');
    return true; // Assume has tenant to avoid blocking
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Check if user has a role assigned (which means they have a tenant)
    const { data: userRole, error } = await supabaseAdmin
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows found, user is new
      if (error.code === 'PGRST116') {
        console.log('🟡 User has no tenant assigned - new user');
        return false;
      }
      console.warn('⚠️ Error checking user tenant:', error);
      return true; // Assume has tenant on error
    }

    console.log('🟢 User has tenant:', userRole?.tenant_id);
    return !!userRole?.tenant_id;
  } catch (err) {
    console.error('🔴 Exception checking user tenant:', err);
    return true; // Assume has tenant on error
  }
}

// ======================
// HELPER: Set session cookies on response
// ======================
function setSessionCookies(
  response: NextResponse,
  accessToken: string | undefined,
  refreshToken: string | undefined
): void {
  if (accessToken) {
    response.cookies.set('sb-access-token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
  }

  if (refreshToken) {
    response.cookies.set('sb-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 * 7, // 7 years
      path: '/',
    });
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  const error_uri = requestUrl.searchParams.get('error_uri');

  // Enhanced logging for debugging
  console.log('🔵 OAuth Callback Handler - Request received');
  console.log('URL:', requestUrl.toString());
  console.log('Has code:', !!code);
  console.log('Has error:', !!error);

  // Handle OAuth errors from provider
  if (error) {
    console.error('🔴 OAuth Provider Error:', {
      error,
      error_description,
      error_uri,
      timestamp: new Date().toISOString(),
    });

    const errorMessage = error_description || error;
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }

  if (code) {
    try {
      console.log('🟡 Exchanging authorization code for session...');

      const cookieStore = await cookies();
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('🔴 Missing Supabase credentials:', {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseAnonKey,
        });
        return NextResponse.redirect(
          new URL('/auth/login?error=missing_credentials', request.url)
        );
      }

      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value, ...options });
              } catch (e) {
                // Cookie setting might fail in some contexts, log but continue
                console.warn('⚠️ Failed to set cookie in request:', name);
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value: '', ...options });
              } catch (e) {
                console.warn('⚠️ Failed to remove cookie in request:', name);
              }
            },
          },
        }
      );

      // Exchange code for session
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('🔴 Code Exchange Error:', {
          message: exchangeError.message,
          status: exchangeError.status,
          timestamp: new Date().toISOString(),
        });
        return NextResponse.redirect(
          new URL(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        );
      }

      if (data?.session) {
        console.log('🟢 Session created successfully:', {
          userId: data.session.user.id,
          email: data.session.user.email,
          timestamp: new Date().toISOString(),
        });

        // Check if this is a new user (no tenant assigned)
        const hasTenant = await checkUserHasTenant(data.session.user.id);

        let redirectUrl: URL;

        if (hasTenant) {
          // Existing user with tenant - go to dashboard
          console.log('🟢 Existing user - redirecting to dashboard');
          redirectUrl = new URL('/dashboard', request.url);
        } else {
          // New user - redirect to onboarding/pricing flow
          console.log('🟡 New user - redirecting to pricing for plan selection');
          redirectUrl = new URL('/pricing', request.url);
          redirectUrl.searchParams.set('new_user', 'true');
          redirectUrl.searchParams.set('email', data.session.user.email || '');
        }

        const response = NextResponse.redirect(redirectUrl);

        // Set session cookies
        setSessionCookies(
          response,
          data.session.access_token,
          data.session.refresh_token
        );

        return response;
      }

      console.warn('⚠️ No session returned from code exchange');
      return NextResponse.redirect(
        new URL('/auth/login?error=no_session', request.url)
      );
    } catch (error) {
      console.error('🔴 Callback Handler Exception:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.redirect(
        new URL('/auth/login?error=authentication_failed', request.url)
      );
    }
  }

  // No code provided
  console.warn('⚠️ No authorization code provided in callback URL');
  return NextResponse.redirect(new URL('/auth/login?error=no_code', request.url));
}
