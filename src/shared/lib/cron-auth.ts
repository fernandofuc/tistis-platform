// =====================================================
// TIS TIS PLATFORM - CRON Authentication Utilities
// Shared utilities for CRON job authentication
// =====================================================

import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

/**
 * Verify CRON job authorization using timing-safe comparison
 *
 * @param request - The incoming NextRequest
 * @param jobName - Name of the CRON job for logging (e.g., 'Cleanup Holds')
 * @returns boolean indicating if the request is authorized
 *
 * @example
 * ```typescript
 * import { verifyCronSecret } from '@/src/shared/lib/cron-auth';
 *
 * export async function GET(request: NextRequest) {
 *   if (!verifyCronSecret(request, 'My CRON Job')) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... process CRON job
 * }
 * ```
 */
export function verifyCronSecret(request: NextRequest, jobName: string): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`[${jobName}] CRON_SECRET not set in production`);
      return false;
    }
    console.warn(`[${jobName}] CRON_SECRET not set - allowing in development`);
    return true;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);
  try {
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(cronSecret);

    // Timing-safe length comparison
    if (tokenBuffer.length !== secretBuffer.length) {
      return false;
    }

    // Timing-safe value comparison (prevents timing attacks)
    return timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

/**
 * Log timeout warning if duration approaches Vercel limit
 *
 * @param jobName - Name of the CRON job for logging
 * @param durationMs - Current duration in milliseconds
 * @param maxDurationMs - Maximum allowed duration (default: 60000ms for Vercel Pro)
 * @param warningThreshold - Percentage of maxDuration to trigger warning (default: 0.83 = 50s/60s)
 */
export function logTimeoutWarningIfNeeded(
  jobName: string,
  durationMs: number,
  maxDurationMs: number = 60000,
  warningThreshold: number = 0.83
): void {
  const thresholdMs = maxDurationMs * warningThreshold;

  if (durationMs > thresholdMs) {
    console.warn(
      `[${jobName}] WARNING: Approaching timeout threshold (${durationMs}ms / ${maxDurationMs}ms)`
    );
  }
}
