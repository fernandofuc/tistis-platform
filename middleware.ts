import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes: string[] = ['/dashboard'];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ['/auth/login', '/auth/signup'];

// Routes that should bypass middleware completely
const bypassRoutes = ['/auth/callback'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CRITICAL: Bypass middleware for OAuth callback
  if (bypassRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Create response early - this is important for cookie handling
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  // Track if cookies were modified
  let cookiesModified = false;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookiesModified = true;
          // Set on request for subsequent middleware/route handlers
          req.cookies.set({ name, value, ...options });
          // Set on response to send to browser
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookiesModified = true;
          req.cookies.set({ name, value: '', ...options });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Use getUser() instead of getSession() - more secure and reliable
  // getSession() is deprecated and can return stale data
  const { data: { user }, error } = await supabase.auth.getUser();

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Redirect to login if accessing protected route without valid user
  if (isProtectedRoute && (!user || error)) {
    // Create redirect response and copy any cookies that were set
    const redirectUrl = new URL('/auth/login', req.url);
    const redirectRes = NextResponse.redirect(redirectUrl);

    // Copy cookies from res to redirect response
    res.cookies.getAll().forEach(cookie => {
      redirectRes.cookies.set(cookie);
    });

    return redirectRes;
  }

  // Redirect to dashboard if accessing auth routes while logged in
  if (isAuthRoute && user && !error) {
    const redirectUrl = new URL('/dashboard', req.url);
    const redirectRes = NextResponse.redirect(redirectUrl);

    // Copy cookies from res to redirect response
    res.cookies.getAll().forEach(cookie => {
      redirectRes.cookies.set(cookie);
    });

    return redirectRes;
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api|.*\\..*$).*)',
  ],
};
