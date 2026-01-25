// =====================================================
// TIS TIS PLATFORM - CORS Configuration
// Centralized Cross-Origin Resource Sharing headers
// =====================================================
//
// This module provides consistent CORS configuration across
// all API routes. It handles:
// - Allowed origins configuration
// - Preflight (OPTIONS) requests
// - Security headers for cross-origin requests
//
// USAGE:
// ```ts
// import { cors, handleCors, CorsOptions } from '@/src/shared/lib/cors';
//
// // In API route:
// export async function GET(request: NextRequest) {
//   // Handle preflight
//   const corsResponse = handleCors(request);
//   if (corsResponse) return corsResponse;
//
//   // Your logic...
//   return cors(request, NextResponse.json({ data }));
// }
//
// // Handle OPTIONS request
// export async function OPTIONS(request: NextRequest) {
//   return handleCors(request);
// }
// ```
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

// ======================
// TYPES
// ======================

export interface CorsOptions {
  /** Allowed origins. Use '*' for all (not recommended for production) */
  allowedOrigins?: string[];
  /** Allowed HTTP methods */
  allowedMethods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Allow credentials (cookies, authorization headers) */
  credentials?: boolean;
  /** Max age for preflight cache (seconds) */
  maxAge?: number;
}

// ======================
// DEFAULT CONFIGURATION
// ======================

/**
 * Environment-aware allowed origins
 * - Production: Only specific domains
 * - Development: Localhost variants
 */
function getDefaultAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';

  // Base allowed origins (always allowed)
  const origins: string[] = [];

  // Production domains
  if (isProduction) {
    // Main production domain
    if (process.env.NEXT_PUBLIC_APP_URL) {
      origins.push(process.env.NEXT_PUBLIC_APP_URL);
    }

    // Vercel preview deployments
    if (process.env.VERCEL_URL) {
      origins.push(`https://${process.env.VERCEL_URL}`);
    }

    // Vercel project domain
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
    }

    // Custom domains from env
    const customDomains = process.env.CORS_ALLOWED_ORIGINS?.split(',').filter(Boolean);
    if (customDomains) {
      origins.push(...customDomains.map(d => d.trim()));
    }
  } else {
    // Development: Allow localhost variants
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://0.0.0.0:3000',
    );
  }

  return origins;
}

const DEFAULT_CORS_OPTIONS: Required<CorsOptions> = {
  allowedOrigins: getDefaultAllowedOrigins(),
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Accept-Language',
    'X-Internal-API-Key',
    'X-Health-Token',
    'X-Request-ID',
    'X-Correlation-ID',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// ======================
// WEBHOOK ORIGINS
// ======================

/**
 * Special origins for webhook endpoints
 * These are trusted external services that call our webhooks
 */
const WEBHOOK_ALLOWED_ORIGINS: string[] = [
  // Stripe
  'https://stripe.com',
  'https://api.stripe.com',
  // Meta (WhatsApp/Instagram)
  'https://graph.facebook.com',
  'https://facebook.com',
  'https://www.facebook.com',
  // VAPI (Voice Agent)
  'https://api.vapi.ai',
  // Resend
  'https://resend.com',
  'https://api.resend.com',
];

// ======================
// CORE FUNCTIONS
// ======================

/**
 * Checks if an origin is allowed
 */
function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string[],
  isWebhook: boolean = false
): boolean {
  // No origin header (same-origin request)
  if (!origin) return true;

  // Check direct match
  if (allowedOrigins.includes(origin)) return true;

  // Check wildcard
  if (allowedOrigins.includes('*')) return true;

  // Check webhook origins
  if (isWebhook && WEBHOOK_ALLOWED_ORIGINS.includes(origin)) return true;

  // Check wildcard patterns (e.g., https://*.vercel.app)
  for (const pattern of allowedOrigins) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(origin)) return true;
    }
  }

  // In development, be more permissive
  if (process.env.NODE_ENV !== 'production') {
    // Allow any localhost origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return true;
    }
  }

  return false;
}

/**
 * Gets the allowed origin to return in the header
 * Returns the actual origin if allowed, or null if not allowed
 */
function getAllowedOrigin(
  origin: string | null,
  allowedOrigins: string[]
): string | null {
  if (!origin) return null;

  // If wildcard is allowed, return the requesting origin
  if (allowedOrigins.includes('*')) return origin;

  // If origin is specifically allowed, return it
  if (isOriginAllowed(origin, allowedOrigins)) return origin;

  return null;
}

/**
 * Sets CORS headers on a response
 */
export function setCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  options: CorsOptions = {}
): NextResponse {
  const opts = { ...DEFAULT_CORS_OPTIONS, ...options };
  const origin = request.headers.get('origin');
  const path = request.nextUrl.pathname;

  // Check if this is a webhook endpoint
  const isWebhook = path.includes('/webhook');

  // Determine if origin is allowed
  const allowedOrigin = getAllowedOrigin(
    origin,
    isWebhook ? [...opts.allowedOrigins, ...WEBHOOK_ALLOWED_ORIGINS] : opts.allowedOrigins
  );

  // Set Access-Control-Allow-Origin
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  } else if (origin) {
    // Origin not allowed - log in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[CORS] Origin not allowed: ${origin}`);
    }
  }

  // Set Access-Control-Allow-Methods
  response.headers.set(
    'Access-Control-Allow-Methods',
    opts.allowedMethods.join(', ')
  );

  // Set Access-Control-Allow-Headers
  response.headers.set(
    'Access-Control-Allow-Headers',
    opts.allowedHeaders.join(', ')
  );

  // Set Access-Control-Expose-Headers
  if (opts.exposedHeaders.length > 0) {
    response.headers.set(
      'Access-Control-Expose-Headers',
      opts.exposedHeaders.join(', ')
    );
  }

  // Set Access-Control-Allow-Credentials
  if (opts.credentials && allowedOrigin) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Set Access-Control-Max-Age for preflight caching
  response.headers.set('Access-Control-Max-Age', String(opts.maxAge));

  // Vary header for proper caching
  response.headers.set('Vary', 'Origin');

  return response;
}

/**
 * Handles OPTIONS preflight requests
 * Returns a response for OPTIONS, or null if not an OPTIONS request
 */
export function handleCors(
  request: NextRequest,
  options: CorsOptions = {}
): NextResponse | null {
  // Only handle OPTIONS (preflight) requests
  if (request.method !== 'OPTIONS') {
    return null;
  }

  // Create empty response for preflight
  const response = new NextResponse(null, { status: 204 });

  // Set CORS headers
  setCorsHeaders(response, request, options);

  return response;
}

/**
 * Wraps a response with CORS headers
 * Use this for non-preflight requests
 */
export function cors<T extends NextResponse>(
  request: NextRequest,
  response: T,
  options: CorsOptions = {}
): T {
  setCorsHeaders(response, request, options);
  return response;
}

/**
 * Creates a CORS-enabled JSON response
 */
export function corsJson(
  request: NextRequest,
  data: unknown,
  init?: ResponseInit,
  options: CorsOptions = {}
): NextResponse {
  const response = NextResponse.json(data, init);
  return cors(request, response, options);
}

/**
 * Higher-order function to wrap an API handler with CORS
 *
 * Usage:
 * ```ts
 * export const GET = withCors(async (request) => {
 *   return NextResponse.json({ data: 'hello' });
 * });
 *
 * export const OPTIONS = withCors.options;
 * ```
 */
export function withCors(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: CorsOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    // Handle preflight
    const preflightResponse = handleCors(request, options);
    if (preflightResponse) return preflightResponse;

    // Execute handler
    const response = await handler(request);

    // Add CORS headers to response
    return cors(request, response, options);
  };
}

// Convenience method for OPTIONS handler
withCors.options = (options: CorsOptions = {}) => (request: NextRequest) => {
  const response = handleCors(request, options);
  return response || new NextResponse(null, { status: 204 });
};

// ======================
// PRESET CONFIGURATIONS
// ======================

/**
 * Strict CORS - Only same-origin requests
 * Use for sensitive internal APIs
 */
export const strictCorsOptions: CorsOptions = {
  allowedOrigins: [],
  credentials: false,
};

/**
 * Public CORS - Allow all origins
 * Use for truly public APIs (with caution)
 */
export const publicCorsOptions: CorsOptions = {
  allowedOrigins: ['*'],
  credentials: false,
};

/**
 * Webhook CORS - For external service webhooks
 * Allows webhook service origins
 */
export const webhookCorsOptions: CorsOptions = {
  allowedOrigins: WEBHOOK_ALLOWED_ORIGINS,
  allowedMethods: ['POST', 'OPTIONS'],
  credentials: false,
};

// ======================
// EXPORTS
// ======================

export const CorsService = {
  setCorsHeaders,
  handleCors,
  cors,
  corsJson,
  withCors,
  isOriginAllowed,
  strictCorsOptions,
  publicCorsOptions,
  webhookCorsOptions,
};

export default CorsService;
