// =====================================================
// TIS TIS PLATFORM - Process Expired Confirmations CRON Job
// Processes expired booking confirmations and executes auto-actions
// Schedule: Every 15 minutes (*/15 * * * *)
// =====================================================
//
// SINCRONIZADO CON:
// - Service: src/features/secure-booking/services/confirmation-sender.service.ts
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret, logTimeoutWarningIfNeeded } from '@/src/shared/lib/cron-auth';
import { confirmationSenderService } from '@/src/features/secure-booking/services/confirmation-sender.service';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Vercel serverless timeout (Pro plan: 60s, Hobby: 10s)
export const maxDuration = 60;

// Job name for logging
const JOB_NAME = 'Process Confirmations';

// ======================
// MAIN HANDLER
// ======================

export async function GET(request: NextRequest) {
  // Verify authorization using shared utility
  if (!verifyCronSecret(request, JOB_NAME)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[${JOB_NAME}] Starting processing of expired confirmations...`);

  const startTime = Date.now();

  try {
    // Call the service method that handles all the processing logic
    // This method:
    // 1. Finds confirmations past expires_at with auto_action_executed=false
    // 2. Marks them as 'expired' status
    // 3. Executes auto_action_on_expire: 'cancel' | 'notify_staff' | 'keep'
    // 4. Updates the referenced appointment/order status if cancelled
    // 5. Returns stats for logging
    const result = await confirmationSenderService.processExpired();

    const duration = Date.now() - startTime;

    // Check for timeout warning
    logTimeoutWarningIfNeeded(JOB_NAME, duration, maxDuration * 1000);

    console.log(
      `[${JOB_NAME}] Completed in ${duration}ms - ` +
        `${result.processed} processed, ${result.cancelled} cancelled, ${result.notified} notified`
    );

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      confirmations_processed: result.processed,
      bookings_cancelled: result.cancelled,
      staff_notified: result.notified,
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
