// =====================================================
// TIS TIS PLATFORM - Loyalty Messages Cron Job
// Daily processing of automated loyalty messages
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  processExpiringMemberships,
  processInactivePatients,
} from '@/src/features/loyalty/services/loyalty-messaging.service';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Verify cron secret for security (timing-safe)
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Loyalty Cron] CRON_SECRET not set in production');
      return false;
    }
    console.warn('[Loyalty Cron] CRON_SECRET not set');
    return true; // Allow in development
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
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

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Loyalty Cron] Starting daily loyalty messages processing...');

  const startTime = Date.now();
  const results = {
    memberships: { processed: 0, sent: 0, errors: 0 },
    reactivation: { processed: 0, sent: 0, errors: 0 },
  };

  try {
    // Process expiring memberships
    console.log('[Loyalty Cron] Processing expiring memberships...');
    results.memberships = await processExpiringMemberships();
    console.log('[Loyalty Cron] Memberships:', results.memberships);

    // Process inactive patients for reactivation
    console.log('[Loyalty Cron] Processing inactive patients...');
    results.reactivation = await processInactivePatients();
    console.log('[Loyalty Cron] Reactivation:', results.reactivation);

    const duration = Date.now() - startTime;

    console.log(`[Loyalty Cron] Completed in ${duration}ms`);
    console.log(`[Loyalty Cron] Total: ${results.memberships.sent + results.reactivation.sent} messages queued`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results,
    });
  } catch (error) {
    console.error('[Loyalty Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results,
    }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
