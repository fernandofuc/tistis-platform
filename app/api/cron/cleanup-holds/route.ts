// =====================================================
// TIS TIS PLATFORM - Cleanup Expired Holds CRON Job
// Releases expired booking holds to free up time slots
// Schedule: Every 5 minutes (*/5 * * * *)
// =====================================================
//
// SINCRONIZADO CON:
// - RPC: cleanup_expired_holds() en 167_SECURE_BOOKING_SYSTEM.sql
// - Service: src/features/secure-booking/services/booking-hold.service.ts
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret, logTimeoutWarningIfNeeded } from '@/src/shared/lib/cron-auth';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Vercel serverless timeout (Pro plan: 60s, Hobby: 10s)
export const maxDuration = 60;

// Job name for logging
const JOB_NAME = 'Cleanup Holds';

// ======================
// SUPABASE ADMIN CLIENT
// ======================

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(`[${JOB_NAME}] Missing Supabase environment variables`);
  }

  return createClient(url, key);
}

// ======================
// MAIN HANDLER
// ======================

export async function GET(request: NextRequest) {
  // Verify authorization using shared utility
  if (!verifyCronSecret(request, JOB_NAME)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[${JOB_NAME}] Starting cleanup of expired holds...`);

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    // Call the RPC function that handles all the cleanup logic
    // This function:
    // 1. Finds all holds with status='active' AND expires_at < now()
    // 2. Updates them to status='expired' with release_reason='auto_expired'
    // 3. Returns the count of cleaned up holds
    const { data, error } = await supabase.rpc('cleanup_expired_holds');

    if (error) {
      console.error(`[${JOB_NAME}] RPC error:`, error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const cleanedCount = data ?? 0;
    const duration = Date.now() - startTime;

    // Check for timeout warning
    logTimeoutWarningIfNeeded(JOB_NAME, duration, maxDuration * 1000);

    console.log(`[${JOB_NAME}] Completed in ${duration}ms - ${cleanedCount} holds cleaned up`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      holds_cleaned: cleanedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[${JOB_NAME}] Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering via webhooks
export async function POST(request: NextRequest) {
  return GET(request);
}
