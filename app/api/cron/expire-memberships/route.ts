// =====================================================
// TIS TIS PLATFORM - Expire Memberships CRON Job
// Expires memberships that have passed their end_date
// =====================================================
// This endpoint should be called by a cron job daily
// to mark expired memberships as 'expired' status
//
// Recommended frequency: Daily at 00:05 UTC
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

// Timeout of 60 seconds
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Timing-safe comparison for CRON_SECRET
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without auth if CRON_SECRET not configured
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON: Expire Memberships] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON: Expire Memberships] Running without authentication in development mode');
    return true;
  }

  // Verify authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Use crypto.timingSafeEqual for timing-safe comparison
  try {
    // Pad both to fixed length to prevent length-based timing attacks
    const FIXED_LENGTH = 64;
    const paddedToken = token.padEnd(FIXED_LENGTH, '\0').slice(0, FIXED_LENGTH);
    const paddedSecret = cronSecret.padEnd(FIXED_LENGTH, '\0').slice(0, FIXED_LENGTH);

    const tokenBuffer = Buffer.from(paddedToken, 'utf-8');
    const secretBuffer = Buffer.from(paddedSecret, 'utf-8');
    return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

/**
 * GET /api/cron/expire-memberships
 *
 * Expires memberships that have passed their end_date.
 * Updates status from 'active' to 'expired'.
 *
 * Headers required:
 * - Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();

    console.log(`[CRON: Expire Memberships] Starting at ${now}`);

    // Find active memberships with expired end_date
    const { data: expiredMemberships, error: selectError } = await supabase
      .from('loyalty_memberships')
      .select('id, lead_id, program_id, end_date, plan:loyalty_membership_plans(name)')
      .eq('status', 'active')
      .lt('end_date', now)
      .limit(500);

    if (selectError) {
      console.error('[CRON: Expire Memberships] Select error:', selectError);
      throw selectError;
    }

    if (!expiredMemberships || expiredMemberships.length === 0) {
      console.log('[CRON: Expire Memberships] No memberships to expire');
      return NextResponse.json({
        success: true,
        expired: 0,
        processing_time_ms: Date.now() - startTime,
        timestamp: now,
      });
    }

    console.log(`[CRON: Expire Memberships] Found ${expiredMemberships.length} memberships to expire`);

    // Update memberships to expired status
    const membershipIds = expiredMemberships.map(m => m.id);
    const { error: updateError, count } = await supabase
      .from('loyalty_memberships')
      .update({
        status: 'expired',
        updated_at: now,
      })
      .in('id', membershipIds);

    if (updateError) {
      console.error('[CRON: Expire Memberships] Update error:', updateError);
      throw updateError;
    }

    // Log each expired membership for audit
    for (const membership of expiredMemberships) {
      // Handle plan as either single object or array depending on DB schema
      const planObj = membership.plan;
      const planName = planObj && typeof planObj === 'object' && 'name' in planObj
        ? (planObj as { name: string }).name
        : 'unknown';
      console.log(`[CRON: Expire Memberships] Expired membership ${membership.id} (lead: ${membership.lead_id}, plan: ${planName})`);
    }

    // Optional: Create audit log entries
    const auditEntries = expiredMemberships.map(m => ({
      membership_id: m.id,
      action: 'status_change',
      old_status: 'active',
      new_status: 'expired',
      reason: 'end_date_passed',
      metadata: {
        end_date: m.end_date,
        expired_at: now,
      },
      created_at: now,
    }));

    // Try to insert audit entries (ignore if table doesn't exist)
    try {
      await supabase
        .from('loyalty_membership_audit')
        .insert(auditEntries);
    } catch (auditError) {
      // Audit table might not exist, that's ok
      console.log('[CRON: Expire Memberships] Audit log skipped (table may not exist)');
    }

    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON: Expire Memberships] Completed in ${processingTime}ms. ` +
      `Expired: ${count || expiredMemberships.length} memberships`
    );

    return NextResponse.json({
      success: true,
      expired: count || expiredMemberships.length,
      memberships: expiredMemberships.map(m => ({
        id: m.id,
        lead_id: m.lead_id,
        end_date: m.end_date,
      })),
      processing_time_ms: processingTime,
      timestamp: now,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON: Expire Memberships] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/expire-memberships
 *
 * Alternative for cron services that use POST.
 * Identical functionality to GET.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
