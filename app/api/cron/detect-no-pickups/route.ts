// =====================================================
// TIS TIS PLATFORM - Detect No-Pickups CRON Job
// Detects takeout orders that weren't picked up past deadline
// Schedule: Every 10 minutes (*/10 * * * *)
// =====================================================
//
// SINCRONIZADO CON:
// - Trigger: update_trust_on_order_status() registra penalizaciones
// - RPC: record_customer_penalty() para penalización manual si trigger falla
// - SQL: supabase/migrations/167_SECURE_BOOKING_SYSTEM.sql
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronSecret, logTimeoutWarningIfNeeded } from '@/src/shared/lib/cron-auth';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// Vercel serverless timeout (Pro plan: 60s, Hobby: 10s)
export const maxDuration = 60;

// Job name for logging
const JOB_NAME = 'Detect No-Pickups';

// ======================
// CONFIGURATION
// ======================

// Process in batches to prevent timeout in serverless
const BATCH_SIZE = 100;

// Grace period after deadline before marking as no-pickup (minutes)
const GRACE_PERIOD_MINUTES = 30;

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
// TYPES
// ======================

interface PendingPickupOrder {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string | null;
  customer_phone: string | null;
  pickup_deadline: string;
  total_amount: number;
  order_number: string;
}

interface ProcessResult {
  processed: number;
  marked_no_pickup: number;
  errors: number;
  error_details: Array<{
    order_id: string;
    error: string;
  }>;
}

// ======================
// MAIN HANDLER
// ======================

export async function GET(request: NextRequest) {
  // Verify authorization using shared utility
  if (!verifyCronSecret(request, JOB_NAME)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[${JOB_NAME}] Starting detection of missed pickups...`);

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  const result: ProcessResult = {
    processed: 0,
    marked_no_pickup: 0,
    errors: 0,
    error_details: [],
  };

  try {
    // Calculate cutoff time (deadline + grace period)
    const cutoffTime = new Date(Date.now() - GRACE_PERIOD_MINUTES * 60 * 1000);

    // Find takeout orders that:
    // 1. Have a pickup_deadline set
    // 2. pickup_deadline + grace period has passed
    // 3. Status is 'ready' (waiting for pickup)
    // 4. Not already marked as no_pickup
    const { data: pendingOrders, error: queryError } = await supabase
      .from('restaurant_orders')
      .select(`
        id,
        tenant_id,
        branch_id,
        customer_id,
        customer_phone,
        pickup_deadline,
        total_amount,
        order_number
      `)
      .eq('order_type', 'takeout')
      .eq('status', 'ready')
      .eq('is_no_pickup', false)
      .not('pickup_deadline', 'is', null)
      .lt('pickup_deadline', cutoffTime.toISOString())
      .order('pickup_deadline', { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error(`[${JOB_NAME}] Query error:`, queryError);
      return NextResponse.json(
        {
          success: false,
          error: queryError.message,
        },
        { status: 500 }
      );
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      console.log(`[${JOB_NAME}] No missed pickups found`);
      return NextResponse.json({
        success: true,
        duration_ms: Date.now() - startTime,
        orders_processed: 0,
        orders_marked_no_pickup: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[${JOB_NAME}] Found ${pendingOrders.length} orders past pickup deadline`);

    // Process each order
    for (const order of pendingOrders as PendingPickupOrder[]) {
      result.processed++;

      try {
        // Mark order as no_pickup
        // NOTE: The trigger update_trust_on_order_status() will automatically:
        // 1. Call record_customer_penalty() if customer_id is present
        // 2. Update trust score
        // 3. Auto-block if threshold reached
        // SECURITY: Include tenant_id in WHERE clause for defense-in-depth
        const { error: updateError } = await supabase
          .from('restaurant_orders')
          .update({
            is_no_pickup: true,
            status: 'cancelled', // Cancel the order
            cancelled_reason: 'no_pickup_auto',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)
          .eq('tenant_id', order.tenant_id) // SECURITY: Defense-in-depth tenant isolation
          .eq('is_no_pickup', false); // Double-check to prevent race conditions

        if (updateError) {
          result.errors++;
          result.error_details.push({
            order_id: order.id,
            error: updateError.message,
          });
          console.error(`[${JOB_NAME}] Error updating order ${order.id}:`, updateError);
          continue;
        }

        result.marked_no_pickup++;
        console.log(
          `[${JOB_NAME}] Marked order ${order.order_number} as no_pickup ` +
            `(deadline was ${order.pickup_deadline})`
        );

        // Small delay to avoid overwhelming the database
        // NOTE: 50ms balances rate limiting vs serverless timeout (60s max)
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        result.errors++;
        result.error_details.push({
          order_id: order.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`[${JOB_NAME}] Error processing order ${order.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    // Check for timeout warning using shared utility
    logTimeoutWarningIfNeeded(JOB_NAME, duration, maxDuration * 1000);

    console.log(
      `[${JOB_NAME}] Completed in ${duration}ms - ` +
        `${result.processed} processed, ${result.marked_no_pickup} marked, ${result.errors} errors`
    );

    return NextResponse.json({
      success: result.errors === 0,
      duration_ms: duration,
      orders_processed: result.processed,
      orders_marked_no_pickup: result.marked_no_pickup,
      errors: result.errors,
      error_details: result.error_details.length > 0 ? result.error_details : undefined,
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
