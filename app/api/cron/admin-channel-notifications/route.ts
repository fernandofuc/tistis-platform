/**
 * TIS TIS PLATFORM - Admin Channel Notifications Cron
 *
 * Procesa notificaciones pendientes del Admin Channel.
 * Ejecuta cada 5 minutos via Vercel Cron.
 *
 * @module api/cron/admin-channel-notifications
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationService } from '@/src/features/admin-channel/services/notification.service';
import { getNotificationSenderService } from '@/src/features/admin-channel/services/notification-sender.service';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Cron]';

// Maximum notifications to process per run
const MAX_BATCH_SIZE = 20;

// =====================================================
// CRON HANDLER
// =====================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify authorization (Vercel Cron or API key)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow Vercel internal cron calls (no auth header needed in prod)
    const isVercelCron = request.headers.get('x-vercel-cron') === 'true';

    if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn(`${LOG_PREFIX} Unauthorized cron attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get pending notifications
    const notificationService = getNotificationService();
    const senderService = getNotificationSenderService();

    const pending = await notificationService.getPendingNotifications(MAX_BATCH_SIZE);

    if (pending.length === 0) {
      console.log(`${LOG_PREFIX} No pending notifications`);
      return NextResponse.json({
        success: true,
        processed: 0,
        duration: Date.now() - startTime,
      });
    }

    console.log(`${LOG_PREFIX} Processing ${pending.length} notifications...`);

    // 3. Process notifications in parallel (with limit)
    const results = await Promise.allSettled(
      pending.map((notification) => senderService.sendNotification(notification))
    );

    // 4. Count results
    let sent = 0;
    let failed = 0;
    let rescheduled = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          if (result.value.rescheduled) {
            rescheduled++;
          } else {
            sent++;
          }
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    }

    console.log(
      `${LOG_PREFIX} Processed ${pending.length}: ${sent} sent, ${rescheduled} rescheduled, ${failed} failed in ${Date.now() - startTime}ms`
    );

    return NextResponse.json({
      success: true,
      processed: pending.length,
      sent,
      rescheduled,
      failed,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// POST HANDLER (for manual triggers)
// =====================================================

export async function POST(request: NextRequest) {
  // Reuse GET logic for manual triggers
  return GET(request);
}
