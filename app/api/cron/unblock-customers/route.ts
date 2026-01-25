// =====================================================
// TIS TIS PLATFORM - Unblock Customers CRON Job
// Automatically unblocks customers whose block period has expired
// Schedule: Every hour (0 * * * *)
// =====================================================
//
// SINCRONIZADO CON:
// - RPC: unblock_expired_customers(p_batch_limit) en 167_SECURE_BOOKING_SYSTEM.sql
// - Service: src/features/secure-booking/services/customer-trust.service.ts
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret, logTimeoutWarningIfNeeded } from '@/src/shared/lib/cron-auth';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Vercel serverless timeout (Pro plan: 60s, Hobby: 10s)
export const maxDuration = 60;

// Job name for logging
const JOB_NAME = 'Unblock Customers';

// ======================
// CONFIGURATION
// ======================

// Batch size for processing (matches RPC default, prevents timeout)
const BATCH_SIZE = 1000;

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

  console.log(`[${JOB_NAME}] Starting automatic unblock of expired blocks...`);

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    // Call the optimized RPC function that handles all the unblock logic
    // This function (using CTEs for O(1) vs O(2n) performance):
    // 1. Finds all blocks with is_active=true AND unblock_at <= now()
    // 2. Updates them to is_active=false with unblock_reason='auto_expired'
    // 3. Also updates customer_trust_scores to:
    //    - Set is_blocked=false
    //    - Reset trust_score to 50 (neutral, second chance)
    // 4. Returns the count of unblocked customers
    const { data, error } = await supabase.rpc('unblock_expired_customers', {
      p_batch_limit: BATCH_SIZE,
    });

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

    const unblockedCount = data ?? 0;
    const duration = Date.now() - startTime;

    // Check for timeout warning
    logTimeoutWarningIfNeeded(JOB_NAME, duration, maxDuration * 1000);

    console.log(
      `[${JOB_NAME}] Completed in ${duration}ms - ${unblockedCount} customers unblocked`
    );

    // If we processed the full batch, there might be more
    const moreRemaining = unblockedCount === BATCH_SIZE;
    if (moreRemaining) {
      console.log(`[${JOB_NAME}] Batch limit reached - more customers may need unblocking`);
    }

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      customers_unblocked: unblockedCount,
      more_remaining: moreRemaining,
      batch_size: BATCH_SIZE,
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
