import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = ['/dashboard'];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ['/auth/login', '/auth/signup'];

// Routes that should bypass middleware (OAuth callbacks, etc)
const bypassRoutes = ['/auth/callback'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CRITICAL: Bypass middleware for OAuth callback to allow session exchange
  const isBypassRoute = bypassRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isBypassRoute) {
    console.log('🟡 Middleware: Bypassing auth check for callback route:', pathname);
    return NextResponse.next();
  }

  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth check if env vars not available
  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          res.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  // Check if it's an auth route
  const isAuthRoute = authRoutes.some(route =>
    pathname.startsWith(route)
  );

  // Debug logging for dashboard access
  if (isProtectedRoute) {
    console.log('🔐 Middleware: Protected route access:', {
      pathname,
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
    });
  }

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !session) {
    console.log('🔴 Middleware: No session, redirecting to login');
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  // Redirect to dashboard if accessing auth routes while logged in
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api|.*\\..*$).*)',
  ],
};
