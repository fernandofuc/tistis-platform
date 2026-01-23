// =====================================================
// TIS TIS PLATFORM - Internal SR Process API
// FASE 2: Process queued SR sales (CRON/Internal use)
// Endpoint: /api/internal/sr-process
//
// This endpoint is for internal use only (CRON jobs, service-to-service)
// For user-facing processing, use /api/soft-restaurant/process
//
// Pattern Reference:
// - api/jobs/process/route.ts (authentication, batch processing)
// - process-dlq/route.ts (status management)
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max (Vercel limit)

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { SRJobQueueService } from '@/src/features/integrations/services/sr-job-queue.service';
import { SoftRestaurantProcessor } from '@/src/features/integrations/services/soft-restaurant-processor';

// ======================
// AUTHENTICATION
// Pattern: api/jobs/process/route.ts:38-69
// ======================

function validateInternalRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const internalKey = process.env.INTERNAL_API_KEY;
  const authHeader = request.headers.get('authorization');

  // SECURITY: In production, at least one key must be configured
  if (!cronSecret && !internalKey) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SR Internal] CRITICAL: No auth configured in production');
      return false;
    }
    // Allow in development without secret
    console.warn('[SR Internal] Running without authentication in development mode');
    return true;
  }

  // Verify header format
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Timing-safe comparison to prevent timing attacks
  try {
    const tokenBuffer = Buffer.from(token);

    // Verify against CRON_SECRET
    if (cronSecret) {
      const secretBuffer = Buffer.from(cronSecret);
      if (tokenBuffer.length === secretBuffer.length &&
          timingSafeEqual(tokenBuffer, secretBuffer)) {
        return true;
      }
    }

    // Verify against INTERNAL_API_KEY
    if (internalKey) {
      const keyBuffer = Buffer.from(internalKey);
      if (tokenBuffer.length === keyBuffer.length &&
          timingSafeEqual(tokenBuffer, keyBuffer)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ======================
// GET - Health Check + Stats
// ======================

export async function GET(request: NextRequest) {
  if (!validateInternalRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await SRJobQueueService.getQueueStats();

    return NextResponse.json({
      status: 'healthy',
      queue_stats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SR Internal] Stats error:', error);
    return NextResponse.json(
      {
        error: 'Stats failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ======================
// POST - Process Sales Batch (Internal/CRON use)
// ======================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  if (!validateInternalRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const maxSales = Math.min(body.max_sales || 20, 50); // Max 50 per call
    // Validate sale_id if provided - must be non-empty string
    const saleId = typeof body.sale_id === 'string' && body.sale_id.trim()
      ? body.sale_id.trim()
      : undefined;
    const recoverStale = body.recover_stale !== false; // Default: true

    console.log(`[SR Internal] Starting processing (max: ${maxSales}, specific: ${saleId || 'none'})`);

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      recovered: 0,
      errors: [] as string[],
    };

    // Step 0: Recover stale sales if enabled
    if (recoverStale && !saleId) {
      try {
        results.recovered = await SRJobQueueService.recoverStaleSales(5);
      } catch (err) {
        console.warn('[SR Internal] Stale recovery failed:', err);
      }
    }

    // Create processor instance
    const processor = new SoftRestaurantProcessor();

    if (saleId) {
      // ======================
      // Process specific sale
      // ======================
      results.processed = 1;

      try {
        console.log(`[SR Internal] Processing specific sale ${saleId}`);

        const result = await processor.processSale(saleId);

        if (result.success) {
          await SRJobQueueService.markProcessed(saleId, result.restaurantOrderId);
          results.succeeded++;
          console.log(`[SR Internal] Sale ${saleId} processed successfully`);
        } else {
          // Get current retry count
          const saleInfo = await SRJobQueueService.getSaleInfo(saleId);
          const retryCount = saleInfo?.retry_count || 0;

          await SRJobQueueService.markFailed(
            saleId,
            result.error || 'Unknown error',
            retryCount
          );
          results.failed++;
          results.errors.push(`Sale ${saleId}: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SR Internal] Sale ${saleId} exception:`, errorMessage);

        // Get current retry count
        const saleInfo = await SRJobQueueService.getSaleInfo(saleId);
        const retryCount = saleInfo?.retry_count || 0;

        await SRJobQueueService.markFailed(saleId, errorMessage, retryCount);
        results.failed++;
        results.errors.push(`Sale ${saleId}: ${errorMessage}`);
      }
    } else {
      // ======================
      // Process batch
      // ======================
      const saleIds = await SRJobQueueService.claimNextBatch(maxSales);

      if (saleIds.length === 0) {
        console.log('[SR Internal] No pending sales to process');
      }

      for (const id of saleIds) {
        results.processed++;

        try {
          console.log(`[SR Internal] Processing sale ${id} (${results.processed}/${saleIds.length})`);

          const result = await processor.processSale(id);

          if (result.success) {
            await SRJobQueueService.markProcessed(id, result.restaurantOrderId);
            results.succeeded++;
          } else {
            // Get current retry count
            const saleInfo = await SRJobQueueService.getSaleInfo(id);
            const retryCount = saleInfo?.retry_count || 0;

            await SRJobQueueService.markFailed(
              id,
              result.error || 'Unknown error',
              retryCount
            );
            results.failed++;
            results.errors.push(`Sale ${id}: ${result.error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[SR Internal] Sale ${id} exception:`, errorMessage);

          // Get current retry count and mark as failed
          const saleInfo = await SRJobQueueService.getSaleInfo(id);
          const retryCount = saleInfo?.retry_count || 0;

          await SRJobQueueService.markFailed(id, errorMessage, retryCount);
          results.failed++;
          results.errors.push(`Sale ${id}: ${errorMessage}`);
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[SR Internal] Completed: ${results.succeeded}/${results.processed} succeeded in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
      recovered: results.recovered,
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[SR Internal] Processing error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
