// =====================================================
// TIS TIS PLATFORM - Process SR Sales CRON Job
// FASE 2: Cron job to process pending Soft Restaurant sales
// Endpoint: /api/cron/process-sr-sales
//
// Called by Vercel Cron every 5 minutes (configurable in vercel.json)
// This is a backup mechanism - webhook should queue sales immediately
//
// Pattern Reference:
// - api/cron/process-dlq/route.ts (cron authentication, processing)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

// Disable caching
export const dynamic = 'force-dynamic';

// Use Node.js runtime for crypto operations
export const runtime = 'nodejs';

// 60 second timeout for cron processing
export const maxDuration = 60;

// ======================
// AUTHENTICATION
// Pattern: api/cron/process-dlq/route.ts:34-66
// ======================

function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without auth if no CRON_SECRET configured
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON SR] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON SR] Running without authentication in development mode');
    return true;
  }

  // Verify authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Use timing-safe comparison
  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }
    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

// ======================
// GET - Cron Handler (Vercel Cron uses GET)
// ======================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron authentication
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON SR] Starting SR sales processing');

    // Call internal processing endpoint
    // Priority: NEXT_PUBLIC_APP_URL > NEXT_PUBLIC_URL > VERCEL_URL > localhost
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || process.env.NEXT_PUBLIC_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    const internalUrl = `${baseUrl}/api/internal/sr-process`;
    const cronSecret = process.env.CRON_SECRET;

    // In development without CRON_SECRET, internal API also allows no auth
    // So we can proceed (both endpoints have matching development mode behavior)
    // In production, we already verified CRON_SECRET exists in verifyCronAuth()

    // Build headers - in development without CRON_SECRET, both endpoints allow no auth
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization if we have a secret
    if (cronSecret) {
      headers['Authorization'] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(internalUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        max_sales: 20, // Conservative batch size for cron
        recover_stale: true, // Recover stuck sales
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[CRON SR] Internal API returned ${response.status}: ${errorText}`);

      return NextResponse.json(
        {
          success: false,
          error: `Internal API error: ${response.status}`,
          cron_duration_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const result = await response.json();
    const duration = Date.now() - startTime;

    console.log(
      `[CRON SR] Completed in ${duration}ms: ` +
      `${result.succeeded || 0}/${result.processed || 0} processed` +
      (result.recovered ? `, ${result.recovered} recovered` : '')
    );

    return NextResponse.json({
      success: true,
      processed: result.processed || 0,
      succeeded: result.succeeded || 0,
      failed: result.failed || 0,
      recovered: result.recovered || 0,
      errors: result.errors,
      cron_duration_ms: duration,
      internal_duration_ms: result.duration_ms,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CRON SR] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cron_duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ======================
// POST - Alternative handler (for cron services that use POST)
// ======================

export async function POST(request: NextRequest) {
  return GET(request);
}
