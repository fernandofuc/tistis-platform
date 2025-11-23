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

      const cookieStore = cookies();
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
              cookieStore.set({ name, value, ...options });
            },
            remove(name: string, options: CookieOptions) {
              cookieStore.set({ name, value: '', ...options });
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
      }

      // Redirect to dashboard after successful auth
      return NextResponse.redirect(new URL('/dashboard', request.url));
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
