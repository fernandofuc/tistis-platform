// =====================================================
// TIS TIS PLATFORM - Loyalty Messages Cron Job
// Daily processing of automated loyalty messages
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  processExpiringMemberships,
  processInactivePatients,
} from '@/src/features/loyalty/services/loyalty-messaging.service';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

// Process token expirations
async function processTokenExpirations(): Promise<{
  expired_count: number;
  total_tokens: number;
  errors: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.rpc('expire_tokens');

    if (error) {
      console.error('[Loyalty Cron] Error expiring tokens:', error);
      return { expired_count: 0, total_tokens: 0, errors: 1 };
    }

    const result = data?.[0] || { expired_count: 0, total_tokens_expired: 0 };
    return {
      expired_count: result.expired_count || 0,
      total_tokens: result.total_tokens_expired || 0,
      errors: 0,
    };
  } catch (error) {
    console.error('[Loyalty Cron] Token expiration error:', error);
    return { expired_count: 0, total_tokens: 0, errors: 1 };
  }
}

// Process membership expirations
async function processMembershipExpirations(): Promise<{
  expired_count: number;
  errors: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase.rpc('expire_memberships');

    if (error) {
      console.error('[Loyalty Cron] Error expiring memberships:', error);
      return { expired_count: 0, errors: 1 };
    }

    const result = data?.[0] || { expired_count: 0 };
    return {
      expired_count: result.expired_count || 0,
      errors: 0,
    };
  } catch (error) {
    console.error('[Loyalty Cron] Membership expiration error:', error);
    return { expired_count: 0, errors: 1 };
  }
}

// Process expiring tokens notifications (30 days before)
async function processExpiringTokensNotifications(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    // Get leads with tokens expiring in 30 days
    const { data: expiringLeads, error } = await supabase.rpc('get_expiring_tokens', {
      p_days_before: 30,
    });

    if (error) {
      console.error('[Loyalty Cron] Error getting expiring tokens:', error);
      return { processed: 0, sent: 0, errors: 1 };
    }

    if (!expiringLeads || expiringLeads.length === 0) {
      return { processed: 0, sent: 0, errors: 0 };
    }

    // Get tokens_expiring template
    for (const lead of expiringLeads) {
      processed++;

      try {
        // Get message template
        const { data: template } = await supabase
          .from('loyalty_message_templates')
          .select('template_content, whatsapp_template')
          .eq('program_id', lead.program_id)
          .eq('message_type', 'tokens_expiring')
          .eq('is_active', true)
          .single();

        if (!template) {
          continue;
        }

        // Format message
        const daysUntilExpiry = Math.ceil(
          (new Date(lead.earliest_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const message = (template.whatsapp_template || template.template_content)
          .replace('{tokens}', lead.tokens_expiring.toString())
          .replace('{dias}', daysUntilExpiry.toString())
          .replace('{nombre}', lead.lead_name || 'Cliente');

        // Log the notification
        await supabase.from('loyalty_reactivation_logs').insert({
          tenant_id: lead.tenant_id,
          lead_id: lead.lead_id,
          message_type: 'tokens_expiring',
          message_sent: message,
          channel: 'whatsapp',
          was_sent: true,
        });

        sent++;
      } catch (leadError) {
        console.error(`[Loyalty Cron] Error processing lead ${lead.lead_id}:`, leadError);
        errors++;
      }
    }

    return { processed, sent, errors };
  } catch (error) {
    console.error('[Loyalty Cron] Expiring tokens notification error:', error);
    return { processed, sent, errors: errors + 1 };
  }
}

// Process birthday tokens
async function processBirthdayTokens(): Promise<{
  processed: number;
  awarded: number;
  errors: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let processed = 0;
  let awarded = 0;
  let errors = 0;

  try {
    // Get leads with birthdays today
    const { data: birthdayLeads, error } = await supabase.rpc('get_birthday_leads');

    if (error) {
      console.error('[Loyalty Cron] Error getting birthday leads:', error);
      return { processed: 0, awarded: 0, errors: 1 };
    }

    if (!birthdayLeads || birthdayLeads.length === 0) {
      return { processed: 0, awarded: 0, errors: 0 };
    }

    for (const lead of birthdayLeads) {
      processed++;

      try {
        // Award birthday tokens
        const { data: result, error: awardError } = await supabase.rpc('award_birthday_tokens', {
          p_lead_id: lead.lead_id,
          p_program_id: lead.program_id,
        });

        if (awardError) {
          console.error(`[Loyalty Cron] Error awarding birthday tokens to ${lead.lead_id}:`, awardError);
          errors++;
          continue;
        }

        const awardResult = result?.[0];
        if (awardResult?.success) {
          awarded++;

          // Get birthday template and send notification
          const { data: template } = await supabase
            .from('loyalty_message_templates')
            .select('template_content, whatsapp_template')
            .eq('program_id', lead.program_id)
            .eq('message_type', 'birthday')
            .eq('is_active', true)
            .single();

          if (template) {
            const message = (template.whatsapp_template || template.template_content)
              .replace('{tokens}', lead.birthday_tokens.toString())
              .replace('{nombre}', lead.lead_name || 'Cliente');

            await supabase.from('loyalty_reactivation_logs').insert({
              tenant_id: lead.tenant_id,
              lead_id: lead.lead_id,
              message_type: 'birthday',
              message_sent: message,
              channel: 'whatsapp',
              was_sent: true,
            });
          }
        }
      } catch (leadError) {
        console.error(`[Loyalty Cron] Error processing birthday for ${lead.lead_id}:`, leadError);
        errors++;
      }
    }

    return { processed, awarded, errors };
  } catch (error) {
    console.error('[Loyalty Cron] Birthday tokens error:', error);
    return { processed, awarded, errors: errors + 1 };
  }
}

// Process reward availability notifications
async function processRewardAvailableNotifications(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    // Get leads who can redeem rewards
    const { data: eligibleLeads, error } = await supabase.rpc('get_leads_with_redeemable_rewards');

    if (error) {
      console.error('[Loyalty Cron] Error getting redeemable rewards:', error);
      return { processed: 0, sent: 0, errors: 1 };
    }

    if (!eligibleLeads || eligibleLeads.length === 0) {
      return { processed: 0, sent: 0, errors: 0 };
    }

    for (const lead of eligibleLeads) {
      processed++;

      try {
        // Get reward_available template
        const { data: template } = await supabase
          .from('loyalty_message_templates')
          .select('template_content, whatsapp_template')
          .eq('program_id', lead.program_id)
          .eq('message_type', 'reward_available')
          .eq('is_active', true)
          .single();

        if (!template) {
          continue;
        }

        const message = (template.whatsapp_template || template.template_content)
          .replace('{recompensa}', lead.cheapest_reward_name)
          .replace('{tokens}', lead.current_balance.toString())
          .replace('{tokens_requeridos}', lead.tokens_required.toString())
          .replace('{nombre}', lead.lead_name || 'Cliente');

        // Log the notification
        await supabase.from('loyalty_reactivation_logs').insert({
          tenant_id: lead.tenant_id,
          lead_id: lead.lead_id,
          message_type: 'reward_available',
          message_sent: message,
          channel: 'whatsapp',
          was_sent: true,
        });

        sent++;
      } catch (leadError) {
        console.error(`[Loyalty Cron] Error notifying reward to ${lead.lead_id}:`, leadError);
        errors++;
      }
    }

    return { processed, sent, errors };
  } catch (error) {
    console.error('[Loyalty Cron] Reward available notification error:', error);
    return { processed, sent, errors: errors + 1 };
  }
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Loyalty Cron] Starting daily loyalty processing...');

  const startTime = Date.now();
  const results = {
    token_expiration: { expired_count: 0, total_tokens: 0, errors: 0 },
    membership_expiration: { expired_count: 0, errors: 0 },
    expiring_tokens_notifications: { processed: 0, sent: 0, errors: 0 },
    membership_reminders: { processed: 0, sent: 0, errors: 0 },
    reactivation: { processed: 0, sent: 0, errors: 0 },
    birthdays: { processed: 0, awarded: 0, errors: 0 },
    reward_notifications: { processed: 0, sent: 0, errors: 0 },
  };

  try {
    // 1. Expire tokens that have passed their expiration date
    console.log('[Loyalty Cron] 1/7 Expiring tokens...');
    results.token_expiration = await processTokenExpirations();
    console.log('[Loyalty Cron] Token expiration:', results.token_expiration);

    // 2. Expire memberships that have passed their end date
    console.log('[Loyalty Cron] 2/7 Expiring memberships...');
    results.membership_expiration = await processMembershipExpirations();
    console.log('[Loyalty Cron] Membership expiration:', results.membership_expiration);

    // 3. Send notifications for tokens expiring in 30 days
    console.log('[Loyalty Cron] 3/7 Processing expiring tokens notifications...');
    results.expiring_tokens_notifications = await processExpiringTokensNotifications();
    console.log('[Loyalty Cron] Expiring tokens notifications:', results.expiring_tokens_notifications);

    // 4. Send membership renewal reminders (7 days before)
    console.log('[Loyalty Cron] 4/7 Processing membership reminders...');
    results.membership_reminders = await processExpiringMemberships();
    console.log('[Loyalty Cron] Membership reminders:', results.membership_reminders);

    // 5. Send reactivation messages to inactive patients
    console.log('[Loyalty Cron] 5/7 Processing reactivation messages...');
    results.reactivation = await processInactivePatients();
    console.log('[Loyalty Cron] Reactivation:', results.reactivation);

    // 6. Award birthday tokens
    console.log('[Loyalty Cron] 6/7 Processing birthday tokens...');
    results.birthdays = await processBirthdayTokens();
    console.log('[Loyalty Cron] Birthdays:', results.birthdays);

    // 7. Notify leads about available rewards
    console.log('[Loyalty Cron] 7/7 Processing reward notifications...');
    results.reward_notifications = await processRewardAvailableNotifications();
    console.log('[Loyalty Cron] Reward notifications:', results.reward_notifications);

    const duration = Date.now() - startTime;

    const totalSent =
      results.expiring_tokens_notifications.sent +
      results.membership_reminders.sent +
      results.reactivation.sent +
      results.reward_notifications.sent;

    const totalErrors =
      results.token_expiration.errors +
      results.membership_expiration.errors +
      results.expiring_tokens_notifications.errors +
      results.membership_reminders.errors +
      results.reactivation.errors +
      results.birthdays.errors +
      results.reward_notifications.errors;

    console.log(`[Loyalty Cron] Completed in ${duration}ms`);
    console.log(`[Loyalty Cron] Total messages: ${totalSent}, Errors: ${totalErrors}`);

    return NextResponse.json({
      success: totalErrors === 0,
      duration_ms: duration,
      summary: {
        tokens_expired: results.token_expiration.total_tokens,
        memberships_expired: results.membership_expiration.expired_count,
        messages_sent: totalSent,
        birthdays_awarded: results.birthdays.awarded,
        total_errors: totalErrors,
      },
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
