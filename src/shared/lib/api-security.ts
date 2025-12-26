// =====================================================
// TIS TIS PLATFORM - API Security Utilities
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIdentifier, createRateLimitResponse, RATE_LIMIT_PRESETS } from './rate-limiter';

// ======================
// TYPES
// ======================
export interface SecurityConfig {
  /** Enable rate limiting */
  rateLimit?: keyof typeof RATE_LIMIT_PRESETS | false;
  /** Require authentication */
  requireAuth?: boolean;
  /** Custom rate limit identifier (default: IP) */
  rateLimitIdentifier?: (request: NextRequest) => string;
}

export interface SecurityContext {
  ip: string;
  userAgent: string;
  origin: string | null;
  referer: string | null;
}

// ======================
// SECURITY HEADERS
// ======================
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ======================
// INPUT SANITIZATION
// ======================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map(item =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    }
  }

  return sanitized;
}

// ======================
// VALIDATION HELPERS
// ======================

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone (Mexican format)
 */
export function isValidPhone(phone: string): boolean {
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Mexican phones: 10 digits, optionally with country code
  return digits.length === 10 || digits.length === 12 || digits.length === 13;
}

// ======================
// API SECURITY WRAPPER
// ======================

/**
 * Apply security checks to an API route handler
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const security = applyApiSecurity(request, { rateLimit: 'standard' });
 *   if (security.blocked) return security.response;
 *
 *   // Your API logic here...
 * }
 */
export function applyApiSecurity(
  request: NextRequest,
  config: SecurityConfig = {}
): { blocked: boolean; response?: NextResponse; context: SecurityContext } {
  const context: SecurityContext = {
    ip: getClientIdentifier(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
  };

  // Rate limiting
  if (config.rateLimit !== false) {
    const preset = config.rateLimit || 'standard';
    const identifier = config.rateLimitIdentifier
      ? config.rateLimitIdentifier(request)
      : `${context.ip}:${request.nextUrl.pathname}`;

    const rateLimitResult = rateLimit(identifier, RATE_LIMIT_PRESETS[preset]);

    if (!rateLimitResult.success) {
      return {
        blocked: true,
        response: createRateLimitResponse(rateLimitResult),
        context,
      };
    }
  }

  return { blocked: false, context };
}

// ======================
// ERROR RESPONSES
// ======================

export function createErrorResponse(
  error: string,
  status: number = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      details,
    },
    {
      status,
      headers: SECURITY_HEADERS,
    }
  );
}

export function createUnauthorizedResponse(message = 'No autorizado'): NextResponse {
  return createErrorResponse(message, 401);
}

export function createForbiddenResponse(message = 'Acceso denegado'): NextResponse {
  return createErrorResponse(message, 403);
}

export function createNotFoundResponse(message = 'Recurso no encontrado'): NextResponse {
  return createErrorResponse(message, 404);
}

export function createValidationErrorResponse(
  message: string,
  fields?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      validation: fields,
    },
    {
      status: 400,
      headers: SECURITY_HEADERS,
    }
  );
}

// ======================
// SUCCESS RESPONSES
// ======================

export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status,
      headers: SECURITY_HEADERS,
    }
  );
}

const apiSecurity = {
  applyApiSecurity,
  sanitizeString,
  sanitizeObject,
  isValidUUID,
  isValidEmail,
  isValidPhone,
  createErrorResponse,
  createSuccessResponse,
};

export default apiSecurity;
