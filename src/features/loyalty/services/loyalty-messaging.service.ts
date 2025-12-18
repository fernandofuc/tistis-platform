// =====================================================
// TIS TIS PLATFORM - Loyalty Messaging Service
// AI-powered automated messaging for loyalty system
// =====================================================

import OpenAI from 'openai';
import { createServerClient } from '@/src/shared/lib/supabase';
import { DEFAULT_MODELS } from '@/src/shared/config/ai-models';

// ======================
// CONFIGURATION
// ======================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ======================
// TYPES
// ======================
interface LoyaltyMessageContext {
  patient: {
    name: string;
    phone: string;
    email?: string;
  };
  program: {
    name: string;
    tokens_name: string;
    tokens_name_plural: string;
  };
  tenant: {
    name: string;
    vertical: string;
  };
}

interface MembershipReminderData extends LoyaltyMessageContext {
  plan_name: string;
  end_date: string;
  days_remaining: number;
}

interface TokensEarnedData extends LoyaltyMessageContext {
  tokens_earned: number;
  reason: string;
  new_balance: number;
}

interface ReactivationData extends LoyaltyMessageContext {
  months_inactive: number;
  last_visit_date: string;
  special_offer?: string;
}

interface RedemptionData extends LoyaltyMessageContext {
  reward_name: string;
  redemption_code: string;
  valid_until: string;
  terms?: string;
}

// ======================
// AI MESSAGE PERSONALIZATION
// ======================
async function personalizeMessage(
  template: string,
  context: Record<string, unknown>,
  tenantName: string
): Promise<string> {
  // Replace template variables
  let message = template;
  for (const [key, value] of Object.entries(context)) {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  }

  // If message is already personalized enough, return it
  if (message.length > 50) {
    return message;
  }

  // Use AI to enhance the message
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODELS.MESSAGING,
      messages: [
        {
          role: 'system',
          content: `Eres el asistente de ${tenantName}. Personaliza este mensaje de manera amigable y profesional.
          Mantén el mensaje corto (máximo 3 oraciones). No uses emojis excesivos.
          El mensaje debe sonar natural y personal.`
        },
        {
          role: 'user',
          content: `Personaliza este mensaje: "${message}"`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || message;
  } catch (error) {
    console.error('[Loyalty Messaging] AI personalization error:', error);
    return message;
  }
}

// ======================
// MESSAGE GENERATORS
// ======================

/**
 * Generate membership reminder message
 * Sent 7 days before membership expires
 */
export async function generateMembershipReminderMessage(
  data: MembershipReminderData,
  template?: string
): Promise<string> {
  const defaultTemplate = `Hola {{nombre}}, tu membresía {{plan}} vence en {{dias_restantes}} días ({{fecha_vencimiento}}). Renuévala para seguir disfrutando tus beneficios exclusivos.`;

  const context = {
    nombre: data.patient.name.split(' ')[0],
    plan: data.plan_name,
    fecha_vencimiento: new Date(data.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
    dias_restantes: data.days_remaining,
  };

  return personalizeMessage(
    template || defaultTemplate,
    context,
    data.tenant.name
  );
}

/**
 * Generate tokens earned notification
 */
export async function generateTokensEarnedMessage(
  data: TokensEarnedData,
  template?: string
): Promise<string> {
  const defaultTemplate = `{{nombre}}, ganaste {{tokens}} {{tokens_name}}. {{motivo}}. Tu balance actual es {{balance}} {{tokens_name_plural}}.`;

  const context = {
    nombre: data.patient.name.split(' ')[0],
    tokens: data.tokens_earned,
    motivo: data.reason,
    balance: data.new_balance,
    tokens_name: data.program.tokens_name,
    tokens_name_plural: data.program.tokens_name_plural,
  };

  return personalizeMessage(
    template || defaultTemplate,
    context,
    data.tenant.name
  );
}

/**
 * Generate reactivation message for inactive patients
 * Only sent once per patient
 */
export async function generateReactivationMessage(
  data: ReactivationData,
  template?: string
): Promise<string> {
  const defaultTemplate = `Hola {{nombre}}, te extrañamos. Han pasado {{meses}} meses desde tu última visita. {{oferta}}`;

  // Use AI for more personalized reactivation
  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODELS.MESSAGING,
      messages: [
        {
          role: 'system',
          content: `Eres el asistente de ${data.tenant.name}, una clínica ${data.tenant.vertical}.
          Genera un mensaje de reactivación para un paciente inactivo.
          - Sé cálido pero no invasivo
          - El mensaje debe ser corto (máximo 3 oraciones)
          - No uses emojis excesivos
          - Si hay oferta especial, menciónala sutilmente
          - El tono debe ser personal, como si recordaras al paciente`
        },
        {
          role: 'user',
          content: `Genera un mensaje para ${data.patient.name.split(' ')[0]} que no ha visitado en ${data.months_inactive} meses.
          ${data.special_offer ? `Oferta especial: ${data.special_offer}` : 'Sin oferta especial.'}`
        }
      ],
      max_tokens: 150,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content ||
      personalizeMessage(template || defaultTemplate, {
        nombre: data.patient.name.split(' ')[0],
        meses: data.months_inactive,
        oferta: data.special_offer || 'Agenda tu próxima cita.',
      }, data.tenant.name);
  } catch (error) {
    console.error('[Loyalty Messaging] Reactivation AI error:', error);
    return personalizeMessage(template || defaultTemplate, {
      nombre: data.patient.name.split(' ')[0],
      meses: data.months_inactive,
      oferta: data.special_offer || 'Agenda tu próxima cita.',
    }, data.tenant.name);
  }
}

/**
 * Generate redemption confirmation message
 */
export async function generateRedemptionMessage(
  data: RedemptionData,
  template?: string
): Promise<string> {
  const defaultTemplate = `{{nombre}}, canjeaste "{{recompensa}}". Tu código es: {{codigo}}. Válido hasta {{validez}}.`;

  const context = {
    nombre: data.patient.name.split(' ')[0],
    recompensa: data.reward_name,
    codigo: data.redemption_code,
    validez: new Date(data.valid_until).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
  };

  return personalizeMessage(
    template || defaultTemplate,
    context,
    data.tenant.name
  );
}

// ======================
// SCHEDULED JOBS
// ======================

/**
 * Check for expiring memberships and send reminders
 * Run daily via cron job
 */
export async function processExpiringMemberships(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const supabase = createServerClient();
  const results = { processed: 0, sent: 0, errors: 0 };

  try {
    // Get programs with reminder days setting
    const { data: programs } = await supabase
      .from('loyalty_programs')
      .select(`
        id,
        program_name,
        tokens_name,
        tokens_name_plural,
        membership_reminder_days,
        tenants (
          id,
          name,
          vertical
        )
      `)
      .eq('is_active', true);

    if (!programs) return results;

    for (const program of programs) {
      // Handle tenant from nested relation (can be array or object)
      const tenantsRaw = program.tenants as unknown;
      const programTenant = (Array.isArray(tenantsRaw) ? tenantsRaw[0] : tenantsRaw) as { id: string; name: string; vertical: string } | null;
      if (!programTenant?.id) continue;

      const reminderDate = new Date();
      reminderDate.setDate(reminderDate.getDate() + program.membership_reminder_days);
      const reminderDateStr = reminderDate.toISOString().split('T')[0];

      // Get memberships expiring on reminder date that haven't been reminded
      const { data: memberships } = await supabase
        .from('loyalty_memberships')
        .select(`
          id,
          end_date,
          leads (
            id,
            full_name,
            first_name,
            last_name,
            phone,
            email
          ),
          loyalty_membership_plans (
            plan_name
          )
        `)
        .eq('program_id', program.id)
        .eq('status', 'active')
        .gte('end_date', reminderDateStr)
        .lte('end_date', reminderDateStr + 'T23:59:59');

      if (!memberships) continue;

      for (const membership of memberships) {
        results.processed++;

        // Extract lead from nested relation (can be array or object)
        const leadsRaw = membership.leads as unknown;
        const leadData = Array.isArray(leadsRaw) ? leadsRaw[0] : leadsRaw;
        const typedLead = leadData as { id: string; full_name?: string; first_name?: string; last_name?: string; phone: string; email?: string } | null;

        if (!typedLead?.id) continue;

        // Compute lead name from available fields
        const leadName = typedLead.full_name || `${typedLead.first_name || ''} ${typedLead.last_name || ''}`.trim() || 'Paciente';

        // Check if already reminded
        const { data: existingLog } = await supabase
          .from('loyalty_reactivation_logs')
          .select('id')
          .eq('lead_id', typedLead.id)
          .eq('message_type', 'membership_reminder')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .single();

        if (existingLog) continue;

        try {
          // Get template (DB uses message_type, not template_type)
          const { data: template } = await supabase
            .from('loyalty_message_templates')
            .select('template_content')
            .eq('program_id', program.id)
            .eq('message_type', 'membership_reminder')
            .eq('is_active', true)
            .single();

          const plansRaw = membership.loyalty_membership_plans as unknown;
          const plan = (Array.isArray(plansRaw) ? plansRaw[0] : plansRaw) as { plan_name: string } | null;

          const message = await generateMembershipReminderMessage({
            patient: { name: leadName, phone: typedLead.phone, email: typedLead.email },
            program: {
              name: program.program_name,
              tokens_name: program.tokens_name,
              tokens_name_plural: program.tokens_name_plural,
            },
            tenant: { name: programTenant.name, vertical: programTenant.vertical },
            plan_name: plan?.plan_name || 'Plan',
            end_date: membership.end_date,
            days_remaining: program.membership_reminder_days,
          }, template?.template_content);

          // Log the message (actual sending would be done by WhatsApp service)
          await supabase.from('loyalty_reactivation_logs').insert({
            program_id: program.id,
            lead_id: typedLead.id,
            message_type: 'membership_reminder',
            message_sent: message,
            channel: 'whatsapp',
            was_sent: true,
          });

          results.sent++;
          console.log(`[Loyalty] Membership reminder queued for ${leadName}`);
        } catch (err) {
          results.errors++;
          console.error('[Loyalty] Error processing membership reminder:', err);
        }
      }
    }
  } catch (error) {
    console.error('[Loyalty] processExpiringMemberships error:', error);
  }

  return results;
}

/**
 * Check for inactive patients and send reactivation messages
 * Run daily via cron job
 */
export async function processInactivePatients(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const supabase = createServerClient();
  const results = { processed: 0, sent: 0, errors: 0 };

  try {
    // Get programs with reactivation settings
    const { data: programs } = await supabase
      .from('loyalty_programs')
      .select(`
        id,
        program_name,
        tokens_name,
        tokens_name_plural,
        reactivation_months,
        tenants (
          id,
          name,
          vertical
        )
      `)
      .eq('is_active', true);

    if (!programs) return results;

    for (const program of programs) {
      const inactiveDate = new Date();
      inactiveDate.setMonth(inactiveDate.getMonth() - program.reactivation_months);

      // Handle tenant from nested relation (can be array or object)
      const tenantsRaw = program.tenants as unknown;
      const tenant = (Array.isArray(tenantsRaw) ? tenantsRaw[0] : tenantsRaw) as { id: string; name: string; vertical: string } | null;
      if (!tenant?.id) continue;

      // Get inactive leads that haven't been contacted for reactivation
      const { data: inactiveLeads } = await supabase
        .from('leads')
        .select(`
          id,
          full_name,
          first_name,
          last_name,
          phone,
          email,
          last_interaction_at,
          loyalty_balances!left (
            current_balance
          )
        `)
        .eq('tenant_id', tenant.id)
        .lte('last_interaction_at', inactiveDate.toISOString())
        .limit(50); // Process in batches

      if (!inactiveLeads) continue;

      for (const leadData of inactiveLeads) {
        // Compute lead name from available fields
        const leadName = leadData.full_name || `${leadData.first_name || ''} ${leadData.last_name || ''}`.trim() || 'Paciente';
        results.processed++;

        // Check if already sent reactivation (only send once)
        const { data: existingLog } = await supabase
          .from('loyalty_reactivation_logs')
          .select('id')
          .eq('lead_id', leadData.id)
          .eq('message_type', 'reactivation')
          .single();

        if (existingLog) continue; // Skip - already sent

        try {
          // Get template (DB uses message_type, not template_type)
          const { data: template } = await supabase
            .from('loyalty_message_templates')
            .select('template_content')
            .eq('program_id', program.id)
            .eq('message_type', 'reactivation')
            .eq('is_active', true)
            .single();

          const monthsInactive = Math.floor(
            (Date.now() - new Date(leadData.last_interaction_at).getTime()) / (30 * 24 * 60 * 60 * 1000)
          );

          const message = await generateReactivationMessage({
            patient: { name: leadName, phone: leadData.phone, email: leadData.email || undefined },
            program: {
              name: program.program_name,
              tokens_name: program.tokens_name,
              tokens_name_plural: program.tokens_name_plural,
            },
            tenant: { name: tenant.name, vertical: tenant.vertical },
            months_inactive: monthsInactive,
            last_visit_date: leadData.last_interaction_at,
          }, template?.template_content);

          // Log the reactivation message
          await supabase.from('loyalty_reactivation_logs').insert({
            program_id: program.id,
            lead_id: leadData.id,
            message_type: 'reactivation',
            message_sent: message,
            channel: 'whatsapp',
            was_sent: true,
          });

          results.sent++;
          console.log(`[Loyalty] Reactivation message queued for ${leadName} (${monthsInactive} months inactive)`);
        } catch (err) {
          results.errors++;
          console.error('[Loyalty] Error processing reactivation:', err);
        }
      }
    }
  } catch (error) {
    console.error('[Loyalty] processInactivePatients error:', error);
  }

  return results;
}

// ======================
// EXPORTS
// ======================
export const LoyaltyMessagingService = {
  generateMembershipReminderMessage,
  generateTokensEarnedMessage,
  generateReactivationMessage,
  generateRedemptionMessage,
  processExpiringMemberships,
  processInactivePatients,
};
