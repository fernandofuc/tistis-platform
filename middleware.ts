import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ======================
// SECURITY HEADERS
// ======================

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Build Content Security Policy based on environment
 * Production: Stricter policy (still needs unsafe-inline for Next.js)
 * Development: More permissive for hot reload
 */
function buildCSP(): string {
  const policies: string[] = [
    "default-src 'self'",
  ];

  // Script sources
  if (isProduction) {
    // Production: Next.js requires 'unsafe-inline' for hydration scripts
    // Nonces would require changes to _document.tsx which is complex with App Router
    // This is the recommended production CSP for Next.js 14+
    policies.push(
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://vercel.live"
    );
  } else {
    // Development: Allow unsafe-eval for hot reload
    policies.push(
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://vercel.live"
    );
  }

  // Style sources - unsafe-inline needed for styled-jsx and CSS-in-JS
  policies.push("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");

  // Font sources
  policies.push("font-src 'self' https://fonts.gstatic.com data:");

  // Image sources
  policies.push(
    "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.stripe.com"
  );

  // Connect sources (API calls, WebSockets)
  policies.push(
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live https://api.stripe.com https://api.openai.com https://api.anthropic.com https://api.vapi.ai wss://*.vapi.ai"
  );

  // Frame sources (for Stripe checkout, etc.)
  policies.push("frame-src 'self' https://js.stripe.com https://hooks.stripe.com");

  // Prevent embedding in iframes
  policies.push("frame-ancestors 'none'");

  // Form action
  policies.push("form-action 'self'");

  // Base URI
  policies.push("base-uri 'self'");

  // Upgrade insecure requests in production
  if (isProduction) {
    policies.push("upgrade-insecure-requests");
  }

  // Object sources (prevent plugins)
  policies.push("object-src 'none'");

  // Worker sources
  policies.push("worker-src 'self' blob:");

  // Manifest
  policies.push("manifest-src 'self'");

  return policies.join('; ');
}

function setSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // XSS Protection (legacy, CSP is primary protection)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self "https://js.stripe.com")'
  );

  // HSTS (Strict Transport Security) - only in production
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy
  response.headers.set('Content-Security-Policy', buildCSP());
}

// ======================
// MAIN MIDDLEWARE
// ======================
export async function middleware(req: NextRequest) {
  // Create response
  const res = NextResponse.next();

  // Note: Nonces disabled - Next.js App Router doesn't easily support CSP nonces
  // without custom _document.tsx modifications. Using 'unsafe-inline' for now.
  // See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

  // Set security headers
  setSecurityHeaders(res);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ [Middleware] Missing Supabase credentials');
    return res;
  }

  try {
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
    const { error } = await supabase.auth.getUser();

    if (error) {
      console.debug('[Middleware] Auth error (non-critical):', error.message);
    }
  } catch (error) {
    console.error('🔴 [Middleware] Exception:', error);
  }

  return res;
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!_next/static|_next/image|favicon.ico|public|api|.*\\..*$).*)',
  ],
};
