// =====================================================
// TIS TIS PLATFORM - Appointment Reminders Cron Job
// Sends automatic appointment reminders via WhatsApp
// Schedule: Every hour
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify cron secret for security (timing-safe)
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Appointment Reminders] CRON_SECRET not set in production');
      return false;
    }
    console.warn('[Appointment Reminders] CRON_SECRET not set');
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

// Types
interface Appointment {
  id: string;
  tenant_id: string;
  branch_id: string;
  lead_id: string;
  scheduled_at: string;
  status: string;
  reminder_1week_sent: boolean;
  reminder_24h_sent: boolean;
  reminder_4h_sent: boolean;
  leads: {
    id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  services: {
    name: string;
  } | null;
  staff: {
    first_name: string;
    last_name: string;
    display_name: string;
  } | null;
  branches: {
    name: string;
    phone: string;
    whatsapp_number: string;
    address: string;
  } | null;
  tenants: {
    name: string;
  } | null;
}

interface ReminderResult {
  type: '1_week' | '24_hours' | '4_hours';
  processed: number;
  sent: number;
  errors: number;
  details: Array<{
    appointment_id: string;
    success: boolean;
    error?: string;
  }>;
}

// Format date for WhatsApp message
function formatDateTime(dateStr: string): { date: string; time: string } {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  return {
    date: date.toLocaleDateString('es-MX', options),
    time: date.toLocaleTimeString('es-MX', timeOptions),
  };
}

// Get patient name from lead
function getPatientName(lead: Appointment['leads']): string {
  if (!lead) return 'Paciente';
  return lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Paciente';
}

// Generate reminder message
function generateReminderMessage(
  appointment: Appointment,
  reminderType: '1_week' | '24_hours' | '4_hours'
): string {
  const patientName = getPatientName(appointment.leads);
  const { date, time } = formatDateTime(appointment.scheduled_at);
  const clinicName = appointment.tenants?.name || 'la clínica';
  const doctorName = appointment.staff?.display_name ||
    `${appointment.staff?.first_name || ''} ${appointment.staff?.last_name || ''}`.trim() ||
    'tu doctor';
  const serviceName = appointment.services?.name || 'tu cita';
  const branchName = appointment.branches?.name || '';
  const branchAddress = appointment.branches?.address || '';

  const timeLabel = {
    '1_week': 'en 1 semana',
    '24_hours': 'mañana',
    '4_hours': 'en 4 horas',
  }[reminderType];

  const urgencyPrefix = {
    '1_week': '',
    '24_hours': '',
    '4_hours': 'Recordatorio urgente: ',
  }[reminderType];

  const messages = {
    '1_week': `Hola ${patientName}, te recordamos que tienes una cita programada ${timeLabel}.

📅 *Fecha:* ${date}
🕐 *Hora:* ${time}
${appointment.staff ? `👨‍⚕️ *Doctor:* ${doctorName}` : ''}
${appointment.services ? `💊 *Servicio:* ${serviceName}` : ''}
${branchName ? `📍 *Sucursal:* ${branchName}` : ''}
${branchAddress ? `🏠 *Dirección:* ${branchAddress}` : ''}

Por favor, confirma tu asistencia respondiendo a este mensaje.

Saludos,
${clinicName}`,

    '24_hours': `Hola ${patientName}, te recordamos que *mañana* tienes tu cita.

📅 *Fecha:* ${date}
🕐 *Hora:* ${time}
${appointment.staff ? `👨‍⚕️ *Doctor:* ${doctorName}` : ''}
${appointment.services ? `💊 *Servicio:* ${serviceName}` : ''}
${branchName ? `📍 *Sucursal:* ${branchName}` : ''}

Te esperamos puntual. Si necesitas reagendar, contáctanos lo antes posible.

Saludos,
${clinicName}`,

    '4_hours': `${urgencyPrefix}Hola ${patientName}, tu cita es *hoy ${timeLabel}*.

🕐 *Hora:* ${time}
${appointment.staff ? `👨‍⚕️ *Doctor:* ${doctorName}` : ''}
${branchName ? `📍 *Sucursal:* ${branchName}` : ''}

Te esperamos pronto.

${clinicName}`,
  };

  return messages[reminderType];
}

// Send WhatsApp message via API
async function sendWhatsAppReminder(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  appointment: Appointment,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!appointment.leads?.phone) {
      return { success: false, error: 'No phone number for lead' };
    }

    // Get channel connection for this tenant
    const { data: channel } = await supabase
      .from('channel_connections')
      .select('*')
      .eq('tenant_id', appointment.tenant_id)
      .eq('channel', 'whatsapp')
      .eq('status', 'connected')
      .limit(1)
      .single();

    if (!channel) {
      return { success: false, error: 'No WhatsApp channel connected' };
    }

    // Format phone number (remove non-digits, ensure country code)
    let phone = appointment.leads.phone.replace(/\D/g, '');
    if (phone.startsWith('52') && phone.length === 12) {
      // Already has Mexico country code
    } else if (phone.length === 10) {
      phone = '52' + phone;
    }

    // Send via WhatsApp Cloud API
    const whatsappApiUrl = `https://graph.facebook.com/v18.0/${channel.whatsapp_phone_number_id}/messages`;

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channel.whatsapp_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Appointment Reminders] WhatsApp API error:', errorData);
      return { success: false, error: errorData.error?.message || 'WhatsApp API error' };
    }

    // Log the sent message (ignore errors)
    try {
      await supabase
        .from('whatsapp_messages')
        .insert({
          tenant_id: appointment.tenant_id,
          channel_connection_id: channel.id,
          lead_id: appointment.lead_id,
          direction: 'outbound',
          message_type: 'text',
          content: message,
          status: 'sent',
          metadata: {
            type: 'appointment_reminder',
            appointment_id: appointment.id,
          },
        });
    } catch {
      // Ignore logging errors
    }

    return { success: true };
  } catch (error) {
    console.error('[Appointment Reminders] Error sending WhatsApp:', error);
    return { success: false, error: String(error) };
  }
}

// Process reminders for a specific time window
async function processReminders(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  reminderType: '1_week' | '24_hours' | '4_hours'
): Promise<ReminderResult> {
  const result: ReminderResult = {
    type: reminderType,
    processed: 0,
    sent: 0,
    errors: 0,
    details: [],
  };

  const now = new Date();
  let minTime: Date;
  let maxTime: Date;
  let sentColumn: string;

  switch (reminderType) {
    case '1_week':
      // Appointments between 6 days 23 hours and 7 days 1 hour from now
      minTime = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000);
      maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000);
      sentColumn = 'reminder_1week_sent';
      break;
    case '24_hours':
      // Appointments between 23 and 25 hours from now
      minTime = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      maxTime = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      sentColumn = 'reminder_24h_sent';
      break;
    case '4_hours':
      // Appointments between 3 and 5 hours from now
      minTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      maxTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      sentColumn = 'reminder_4h_sent';
      break;
  }

  // Query appointments that need reminders
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      tenant_id,
      branch_id,
      lead_id,
      scheduled_at,
      status,
      reminder_1week_sent,
      reminder_24h_sent,
      reminder_4h_sent,
      leads (
        id,
        full_name,
        first_name,
        last_name,
        phone
      ),
      services (
        name
      ),
      staff (
        first_name,
        last_name,
        display_name
      ),
      branches (
        name,
        phone,
        whatsapp_number,
        address
      ),
      tenants (
        name
      )
    `)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', minTime.toISOString())
    .lte('scheduled_at', maxTime.toISOString())
    .eq(sentColumn, false)
    .not('lead_id', 'is', null)
    .limit(100); // Process in batches

  if (error) {
    console.error(`[Appointment Reminders] Error querying ${reminderType} appointments:`, error);
    return result;
  }

  if (!appointments || appointments.length === 0) {
    console.log(`[Appointment Reminders] No ${reminderType} reminders to send`);
    return result;
  }

  console.log(`[Appointment Reminders] Processing ${appointments.length} ${reminderType} reminders`);

  for (const apt of appointments) {
    result.processed++;
    const appointment = apt as unknown as Appointment;

    try {
      // Generate message
      const message = generateReminderMessage(appointment, reminderType);

      // Send WhatsApp
      const sendResult = await sendWhatsAppReminder(supabase, appointment, message);

      if (sendResult.success) {
        result.sent++;

        // Mark reminder as sent
        await supabase
          .from('appointments')
          .update({ [sentColumn]: true })
          .eq('id', appointment.id);

        result.details.push({ appointment_id: appointment.id, success: true });
      } else {
        result.errors++;
        result.details.push({
          appointment_id: appointment.id,
          success: false,
          error: sendResult.error,
        });
      }
    } catch (error) {
      result.errors++;
      result.details.push({
        appointment_id: appointment.id,
        success: false,
        error: String(error),
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return result;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Appointment Reminders] Starting reminder processing...');

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  const results = {
    '1_week': { processed: 0, sent: 0, errors: 0 } as ReminderResult,
    '24_hours': { processed: 0, sent: 0, errors: 0 } as ReminderResult,
    '4_hours': { processed: 0, sent: 0, errors: 0 } as ReminderResult,
  };

  try {
    // Process all reminder types in parallel
    const [weekResult, dayResult, hoursResult] = await Promise.all([
      processReminders(supabase, '1_week'),
      processReminders(supabase, '24_hours'),
      processReminders(supabase, '4_hours'),
    ]);

    results['1_week'] = weekResult;
    results['24_hours'] = dayResult;
    results['4_hours'] = hoursResult;

    const totalSent = weekResult.sent + dayResult.sent + hoursResult.sent;
    const totalErrors = weekResult.errors + dayResult.errors + hoursResult.errors;
    const duration = Date.now() - startTime;

    console.log(`[Appointment Reminders] Completed in ${duration}ms`);
    console.log(`[Appointment Reminders] Total: ${totalSent} sent, ${totalErrors} errors`);

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      results: {
        '1_week': {
          processed: weekResult.processed,
          sent: weekResult.sent,
          errors: weekResult.errors,
        },
        '24_hours': {
          processed: dayResult.processed,
          sent: dayResult.sent,
          errors: dayResult.errors,
        },
        '4_hours': {
          processed: hoursResult.processed,
          sent: hoursResult.sent,
          errors: hoursResult.errors,
        },
      },
      totals: {
        processed: weekResult.processed + dayResult.processed + hoursResult.processed,
        sent: totalSent,
        errors: totalErrors,
      },
    });
  } catch (error) {
    console.error('[Appointment Reminders] Error:', error);
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
