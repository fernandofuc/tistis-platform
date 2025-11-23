import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
      new URL(`/?error=${encodeURIComponent(errorMessage)}&error_code=${encodeURIComponent(error)}`, request.url)
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
          new URL('/?error=missing_credentials', request.url)
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
          new URL(`/?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        );
      }

      if (data?.session) {
        console.log('🟢 Session created successfully:', {
          userId: data.session.user.id,
          email: data.session.user.email,
          timestamp: new Date().toISOString(),
        });

        // CRITICAL: Set response cookies to persist session
        const response = NextResponse.redirect(new URL('/dashboard', request.url));

        // Set session cookies in response headers
        if (data.session.access_token) {
          response.cookies.set('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365, // 1 year
            path: '/',
          });
        }

        if (data.session.refresh_token) {
          response.cookies.set('sb-refresh-token', data.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365 * 7, // 7 years
            path: '/',
          });
        }

        return response;
      }

      console.warn('⚠️ No session returned from code exchange');
      return NextResponse.redirect(
        new URL('/?error=no_session', request.url)
      );
    } catch (error) {
      console.error('🔴 Callback Handler Exception:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.redirect(
        new URL('/?error=authentication_failed', request.url)
      );
    }
  }

  // No code provided
  console.warn('⚠️ No authorization code provided in callback URL');
  return NextResponse.redirect(new URL('/?error=no_code', request.url));
}
