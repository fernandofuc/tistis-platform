import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error_description || error)}`, request.url)
    );
  }

  if (code) {
    try {
      const cookieStore = cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error('Exchange error:', exchangeError);
        return NextResponse.redirect(
          new URL(`/?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        );
      }

      // Redirect to dashboard after successful auth
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch (error) {
      console.error('Callback error:', error);
      return NextResponse.redirect(
        new URL('/?error=authentication_failed', request.url)
      );
    }
  }

  // No code provided
  return NextResponse.redirect(new URL('/?error=no_code', request.url));
}
