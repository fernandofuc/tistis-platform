// =====================================================
// TIS TIS PLATFORM - Supabase Server Client
// Server-only functions that use next/headers
// =====================================================

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ======================
// SERVER CLIENT WITH COOKIES (API Routes with auth)
// ======================
// For user-authenticated operations in API routes using @supabase/ssr
export async function createServerClientWithCookies() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

// ======================
// GET USER FROM REQUEST (API Routes - supports both header and cookies)
// ======================
// This is the PREFERRED method for API routes
// It tries Authorization header first (from client-side fetch), then falls back to cookies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserFromRequest(request: NextRequest): Promise<{
  user: { id: string; email?: string } | null;
  supabase: any;
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');

  // Method 1: Try Authorization Bearer token (sent from client-side fetch)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Create a client and set the session from the token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (user && !error) {
      return { user, supabase };
    }

    // Token was invalid
    console.log('🔴 Auth header token invalid:', error?.message);
  }

  // Method 2: Try cookies (for SSR or middleware-refreshed sessions)
  try {
    const supabase = await createServerClientWithCookies();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (user && !error) {
      return { user, supabase };
    }

    console.log('🔴 Cookie auth failed:', error?.message);
  } catch (cookieError) {
    console.log('🔴 Cookie read error:', cookieError);
  }

  // Neither method worked
  return {
    user: null,
    supabase: createClient(supabaseUrl, supabaseAnonKey),
    error: 'No valid authentication found',
  };
}
