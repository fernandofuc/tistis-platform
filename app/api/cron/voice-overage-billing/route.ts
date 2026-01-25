export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos máximo

// =====================================================
// TIS TIS PLATFORM - Voice Overage Billing Cron
// Procesa facturación diaria de excedentes de voz
// FASE 5.2: Stripe Integration
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { voiceBillingService } from '@/src/features/voice-agent/services/voice-billing.service';
import { createComponentLogger } from '@/src/shared/lib';

const logger = createComponentLogger('cron-voice-billing');

// ======================
// CRON SECRET VALIDATION
// ======================

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Compare anyway to maintain constant time
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // En desarrollo, permitir sin secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    logger.warn('Running without CRON_SECRET in development');
    return true;
  }

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured');
    return false;
  }

  const expectedHeader = `Bearer ${cronSecret}`;
  return authHeader ? timingSafeCompare(authHeader, expectedHeader) : false;
}

// ======================
// CRON HANDLER
// ======================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Validate cron secret
  if (!validateCronSecret(request)) {
    logger.warn('Unauthorized cron request attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  logger.info('Voice overage billing cron started');

  try {
    // También resetear uso mensual si es necesario
    const resetResult = await voiceBillingService.resetMonthlyUsage();
    if (resetResult.tenantsProcessed > 0) {
      logger.info('Monthly usage reset', {
        tenantsProcessed: resetResult.tenantsProcessed,
      });
    }

    // Process monthly billing
    const report = await voiceBillingService.processMonthlyBilling();

    const durationMs = Date.now() - startTime;

    // Log summary
    logger.info('Cron job completed', {
      durationMs,
      tenantsProcessed: report.tenantsProcessed,
      tenantsWithOverage: report.tenantsWithOverage,
      totalAmount: report.totalOverageAmount,
      errors: report.errors.length,
    });

    // Return report
    return NextResponse.json({
      success: true,
      durationMs,
      report: {
        processedAt: report.processedAt,
        tenantsProcessed: report.tenantsProcessed,
        tenantsWithOverage: report.tenantsWithOverage,
        totalOverageMinutes: report.totalOverageMinutes,
        totalOverageAmount: report.totalOverageAmount,
        successCount: report.results.filter((r) => r.success).length,
        errorCount: report.errors.length,
        resetTenantsProcessed: resetResult.tenantsProcessed,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Cron job failed', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// POST para testing manual (solo desarrollo)
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'POST method only available in development' },
      { status: 405 }
    );
  }

  return GET(request);
}
