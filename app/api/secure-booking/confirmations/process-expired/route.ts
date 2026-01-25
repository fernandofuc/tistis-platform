// =====================================================
// TIS TIS PLATFORM - Process Expired Confirmations API
// POST: Process all expired confirmations (CRON job)
// =====================================================
//
// SINCRONIZADO CON:
// - Service: src/features/secure-booking/services/confirmation-sender.service.ts
// - Types: src/features/secure-booking/types/index.ts
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
} from '@/src/lib/api/auth-helper';
import { confirmationSenderService } from '@/src/features/secure-booking/services/confirmation-sender.service';

// CRON secret for automated calls
const CRON_SECRET = process.env.CRON_SECRET;

// ======================
// SECURITY: Timing-safe CRON secret verification
// ======================
function verifyCronSecret(providedToken: string | null): boolean {
  if (!CRON_SECRET || !providedToken) {
    return false;
  }

  try {
    const expectedBuffer = Buffer.from(CRON_SECRET, 'utf8');
    const providedBuffer = Buffer.from(providedToken, 'utf8');

    // Lengths must match for timingSafeEqual
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

// ======================
// POST - Process Expired Confirmations
// ======================
export async function POST(request: NextRequest) {
  try {
    // Check for CRON authorization using timing-safe comparison
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const isCronCall = verifyCronSecret(token);

    if (isCronCall) {
      // CRON job - process globally
      console.log('[confirmations/process-expired] CRON job triggered');

      const result = await confirmationSenderService.processExpired();

      return NextResponse.json({
        success: true,
        data: result,
        source: 'cron',
      });
    }

    // Manual trigger - requires authentication
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole } = auth;

    // Only manager+ can trigger this manually
    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para procesar confirmaciones expiradas', 403);
    }

    // Use the service to process expired confirmations
    const result = await confirmationSenderService.processExpired();

    console.log(
      `[confirmations/process-expired] Processed for tenant ${userRole.tenant_id}:`,
      result
    );

    return successResponse({
      ...result,
      source: 'manual',
      tenant_id: userRole.tenant_id,
    });

  } catch (error) {
    console.error('[confirmations/process-expired] POST error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
