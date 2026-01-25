// =====================================================
// TIS TIS PLATFORM - Error Reporting Endpoint
// FASE 9 - Production Error Tracking (Bucle Agéntico v2)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ======================
// CONSTANTS
// ======================
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;
const MAX_URL_LENGTH = 500;
const MAX_USER_AGENT_LENGTH = 300;
const MAX_ERRORS_PER_DIGEST = 5; // Max errors per unique digest in sliding window
const DIGEST_WINDOW_MS = 60 * 1000; // 1 minute window

// ======================
// TYPES
// ======================
interface ErrorReport {
  message: string;
  digest?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
}

interface SanitizedReport {
  message: string;
  digest?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
  clientIp?: string;
}

// ======================
// RATE LIMITING BY DIGEST
// Simple deduplication - limit repeated errors with same digest
// Note: In serverless, this is per-instance only. For production,
// consider storing in KV/Redis for cross-instance deduplication.
// ======================
const digestCounts = new Map<string, { count: number; firstSeen: number }>();

function isDuplicateError(digest: string | undefined): boolean {
  if (!digest) return false; // No digest = allow

  const now = Date.now();
  const record = digestCounts.get(digest);

  // Clean old entries (simple cleanup on access)
  if (record && now - record.firstSeen > DIGEST_WINDOW_MS) {
    digestCounts.delete(digest);
    return false;
  }

  if (!record) {
    digestCounts.set(digest, { count: 1, firstSeen: now });
    return false;
  }

  if (record.count >= MAX_ERRORS_PER_DIGEST) {
    return true;
  }

  record.count++;
  return false;
}

// ======================
// VALIDATION
// ======================
function isValidErrorReport(body: unknown): body is ErrorReport {
  if (!body || typeof body !== 'object') return false;

  const report = body as Record<string, unknown>;

  return (
    typeof report.message === 'string' &&
    report.message.length > 0 &&
    typeof report.timestamp === 'string' &&
    report.timestamp.length > 0
  );
}

// ======================
// SANITIZATION
// ======================
function sanitizeReport(body: ErrorReport, clientIp: string | undefined): SanitizedReport {
  return {
    message: String(body.message).slice(0, MAX_MESSAGE_LENGTH),
    digest: body.digest ? String(body.digest).slice(0, 100) : undefined,
    stack: body.stack ? String(body.stack).slice(0, MAX_STACK_LENGTH) : undefined,
    url: body.url ? sanitizeUrl(String(body.url)) : undefined,
    userAgent: body.userAgent ? String(body.userAgent).slice(0, MAX_USER_AGENT_LENGTH) : undefined,
    timestamp: String(body.timestamp).slice(0, 50),
    clientIp: clientIp && clientIp !== 'unknown' ? clientIp : undefined,
  };
}

function sanitizeUrl(url: string): string {
  // Remove potential sensitive query params
  try {
    const parsed = new URL(url);
    // Remove common sensitive params
    const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth', 'session'];
    sensitiveParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    });
    return parsed.toString().slice(0, MAX_URL_LENGTH);
  } catch {
    // If URL parsing fails, just truncate
    return url.slice(0, MAX_URL_LENGTH);
  }
}

// ======================
// ORIGIN VALIDATION
// ======================
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');

  // No origin header = same-origin request (allowed)
  if (!origin) return true;

  // Get allowed origins from env or use defaults
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tistis.app';
  const allowedOrigins = [
    appUrl,
    'https://tistis.app',
    'https://www.tistis.app',
    // Vercel preview deployments
    /^https:\/\/.*\.vercel\.app$/,
  ];

  // Check against allowed origins
  for (const allowed of allowedOrigins) {
    if (typeof allowed === 'string' && origin === allowed) {
      return true;
    }
    if (allowed instanceof RegExp && allowed.test(origin)) {
      return true;
    }
  }

  // In development, allow localhost
  if (process.env.NODE_ENV !== 'production') {
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
  }

  return false;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ======================
// MAIN HANDLER
// ======================
export async function POST(request: NextRequest) {
  // Validate origin to prevent abuse
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { status: 'error', reason: 'invalid_origin' },
      { status: 403 }
    );
  }

  // In development, just acknowledge without processing
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json(
      { status: 'ignored', reason: 'development' },
      { status: 200 }
    );
  }

  try {
    const body = await request.json();

    // Validate request body
    if (!isValidErrorReport(body)) {
      return NextResponse.json(
        { status: 'error', reason: 'invalid_payload' },
        { status: 400 }
      );
    }

    // Check for duplicate errors (same digest in short window)
    if (isDuplicateError(body.digest)) {
      return NextResponse.json(
        { status: 'deduplicated' },
        { status: 200 }
      );
    }

    // Sanitize and prepare report
    const clientIp = getClientIp(request);
    const sanitizedReport = sanitizeReport(body, clientIp);

    // Log to server (structured JSON for log aggregation)
    console.error(
      JSON.stringify({
        type: 'CLIENT_ERROR',
        level: 'error',
        ...sanitizedReport,
        reportedAt: new Date().toISOString(),
      })
    );

    // TODO: Send to external error tracking service
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureMessage(sanitizedReport.message, {
    //     level: 'error',
    //     extra: sanitizedReport,
    //   });
    // }

    return NextResponse.json({ status: 'reported' }, { status: 200 });
  } catch (error) {
    // Log parsing errors but don't expose details
    console.error('[ErrorReport] Failed to process:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}

// ======================
// OPTIONS HANDLER
// ======================
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');

  // Only return CORS headers if origin is allowed
  if (!isAllowedOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin || 'https://tistis.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
