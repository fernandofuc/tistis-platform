import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// SIMPLIFIED MIDDLEWARE - Let client-side handle auth redirects
// This prevents RSC payload fetch issues in Safari
export async function middleware(req: NextRequest) {
  // Create response
  const res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  // Only refresh the session - don't do any redirects in middleware
  // Redirects in middleware cause RSC payload issues in Safari
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Just refresh the session to keep it alive
  // Auth protection is handled client-side in ProtectedRoute component
  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|public|api|.*\\..*$).*)',
  ],
};
