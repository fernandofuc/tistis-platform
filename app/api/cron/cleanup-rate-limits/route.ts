// =====================================================
// TIS TIS PLATFORM - Cleanup Rate Limits CRON Job
// Cleans up expired rate limit entries from database
// =====================================================
// This endpoint should be called by a cron job every 5 minutes
// to prevent the rate_limit_entries table from growing indefinitely.
//
// Recommended frequency: Every 5 minutes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

// Timeout of 30 seconds
export const maxDuration = 30;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Fixed length for timing-safe comparison
const FIXED_LENGTH = 64;

/**
 * Timing-safe comparison for CRON_SECRET
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without auth if CRON_SECRET not configured
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON: Cleanup Rate Limits] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON: Cleanup Rate Limits] Running without authentication in development mode');
    return true;
  }

  // Verify authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Use crypto.timingSafeEqual for timing-safe comparison
  try {
    const paddedToken = token.padEnd(FIXED_LENGTH, '\0').slice(0, FIXED_LENGTH);
    const paddedSecret = cronSecret.padEnd(FIXED_LENGTH, '\0').slice(0, FIXED_LENGTH);

    const tokenBuffer = Buffer.from(paddedToken, 'utf-8');
    const secretBuffer = Buffer.from(paddedSecret, 'utf-8');
    return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

/**
 * GET /api/cron/cleanup-rate-limits
 *
 * Cleans up expired rate limit entries from the database.
 * Prevents the rate_limit_entries table from growing indefinitely.
 *
 * Headers required:
 * - Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[CRON: Cleanup Rate Limits] Starting cleanup...');

    // Call the cleanup RPC function
    const { data, error } = await supabase.rpc('cleanup_expired_rate_limits');

    if (error) {
      console.error('[CRON: Cleanup Rate Limits] RPC error:', error);
      throw error;
    }

    const deletedCount = data as number || 0;
    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON: Cleanup Rate Limits] Completed in ${processingTime}ms. ` +
      `Deleted: ${deletedCount} expired entries`
    );

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON: Cleanup Rate Limits] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/cleanup-rate-limits
 *
 * Alternative for cron services that use POST.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
