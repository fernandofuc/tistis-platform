// =====================================================
// TIS TIS PLATFORM - Voice Minute Alerts Service
// Servicio para envío de alertas de uso de minutos
// =====================================================

import { Resend } from 'resend';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AlertThreshold,
  MinuteAlert,
  OveragePolicy,
} from '../types';
import { ALERT_SUBJECTS } from '../types';

// =====================================================
// CONFIGURACIÓN
// =====================================================

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** URL base de la app (usa env var o fallback) */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';

/**
 * Sanitiza texto para evitar XSS en emails HTML
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

function createServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================================================
// MENSAJES DE ALERTA
// =====================================================

const ALERT_BODY_TEMPLATES: Record<AlertThreshold, (alert: MinuteAlert) => string> = {
  70: (alert) => `
    <h2>Has usado el 70% de tus minutos de Voice Agent</h2>
    <p>Hola,</p>
    <p>Te informamos que has utilizado <strong>${alert.current_usage} de ${alert.included_minutes} minutos</strong> incluidos en tu plan.</p>
    <p><strong>Minutos restantes:</strong> ${alert.remaining_minutes} min</p>
    <p>Si necesitas más minutos, puedes revisar tu configuración de uso en el dashboard.</p>
  `,
  85: (alert) => `
    <h2>⚠️ Has usado el 85% de tus minutos de Voice Agent</h2>
    <p>Hola,</p>
    <p>Te informamos que has utilizado <strong>${alert.current_usage} de ${alert.included_minutes} minutos</strong> incluidos en tu plan.</p>
    <p><strong>Minutos restantes:</strong> ${alert.remaining_minutes} min</p>
    <p>Cuando excedas el límite, ${getOveragePolicyMessage(alert.overage_policy, alert.overage_price_pesos)}</p>
  `,
  95: (alert) => `
    <h2>🚨 ¡Atención! Solo te quedan ${alert.remaining_minutes} minutos</h2>
    <p>Hola,</p>
    <p>Has utilizado el 95% de tus minutos de Voice Agent (<strong>${alert.current_usage} de ${alert.included_minutes} minutos</strong>).</p>
    <p>Cuando excedas el límite, ${getOveragePolicyMessage(alert.overage_policy, alert.overage_price_pesos)}</p>
    <p>Te recomendamos revisar tu configuración de política de excedentes en el dashboard.</p>
  `,
  100: (alert) => `
    <h2>🔴 Has alcanzado el límite de minutos de Voice Agent</h2>
    <p>Hola,</p>
    <p>Has utilizado todos los <strong>${alert.included_minutes} minutos</strong> incluidos en tu plan este mes.</p>
    <p>${getOveragePolicyMessage(alert.overage_policy, alert.overage_price_pesos)}</p>
    <p>Tus minutos se reiniciarán el primer día del próximo mes.</p>
  `,
};

function getOveragePolicyMessage(policy: OveragePolicy, price: number): string {
  switch (policy) {
    case 'block':
      return 'las llamadas serán rechazadas hasta que reinicie tu ciclo de facturación.';
    case 'charge':
      return `se te cobrará $${price.toFixed(2)} MXN por cada minuto adicional.`;
    case 'notify_only':
      return 'las llamadas continuarán sin cargo adicional (modo solo notificación).';
    default:
      return 'las llamadas podrían ser afectadas.';
  }
}

// =====================================================
// ENVÍO DE ALERTAS
// =====================================================

/**
 * Enviar alerta de uso de minutos por email
 *
 * Esta función:
 * 1. Obtiene datos del tenant y configuración
 * 2. Construye el contenido del email
 * 3. Envía usando Resend
 * 4. Retorna true si fue exitoso
 */
export async function sendMinuteAlert(
  tenantId: string,
  threshold: AlertThreshold
): Promise<boolean> {
  if (!resend) {
    console.error('[MinuteAlertService] Resend not configured - RESEND_API_KEY missing');
    return false;
  }

  const supabase = createServerClient();

  try {
    // Obtener datos del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, owner_email')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[MinuteAlertService] Error fetching tenant:', tenantError);
      return false;
    }

    if (!tenant.owner_email) {
      console.error('[MinuteAlertService] No owner email found for tenant:', tenantId);
      return false;
    }

    // Obtener configuración de límites
    const { data: limits, error: limitsError } = await supabase
      .from('voice_minute_limits')
      .select('included_minutes, overage_policy, overage_price_centavos')
      .eq('tenant_id', tenantId)
      .single();

    if (limitsError || !limits) {
      console.error('[MinuteAlertService] Error fetching limits:', limitsError);
      return false;
    }

    // Obtener uso actual
    const currentPeriodStart = new Date();
    currentPeriodStart.setUTCDate(1);
    currentPeriodStart.setUTCHours(0, 0, 0, 0);

    const { data: usage, error: usageError } = await supabase
      .from('voice_minute_usage')
      .select('included_minutes_used')
      .eq('tenant_id', tenantId)
      .gte('billing_period_start', currentPeriodStart.toISOString())
      .single();

    if (usageError || !usage) {
      console.error('[MinuteAlertService] Error fetching usage:', usageError);
      return false;
    }

    const alert: MinuteAlert = {
      threshold,
      tenant_id: tenantId,
      tenant_name: tenant.name || 'Tu Negocio',
      email: tenant.owner_email,
      current_usage: Math.round(usage.included_minutes_used),
      included_minutes: limits.included_minutes,
      remaining_minutes: Math.max(0, limits.included_minutes - Math.round(usage.included_minutes_used)),
      overage_policy: limits.overage_policy as OveragePolicy,
      overage_price_pesos: limits.overage_price_centavos / 100,
    };

    // Enviar email
    const { error: emailError } = await resend.emails.send({
      from: 'TIS TIS <alertas@tistis.com>',
      to: alert.email,
      subject: ALERT_SUBJECTS[threshold],
      html: generateEmailHTML(alert, threshold),
    });

    if (emailError) {
      console.error('[MinuteAlertService] Error sending email:', emailError);
      return false;
    }

    console.log('[MinuteAlertService] Alert sent successfully:', {
      tenantId,
      threshold,
      email: alert.email,
    });

    return true;
  } catch (error) {
    console.error('[MinuteAlertService] Unexpected error:', error);
    return false;
  }
}

/**
 * Generar HTML del email
 */
function generateEmailHTML(alert: MinuteAlert, threshold: AlertThreshold): string {
  const bodyContent = ALERT_BODY_TEMPLATES[threshold](alert);
  // Prevenir división por cero
  const progressPercent = alert.included_minutes > 0
    ? Math.min(100, (alert.current_usage / alert.included_minutes) * 100)
    : 100;
  const progressColor = threshold >= 95 ? '#ef4444' : threshold >= 85 ? '#f59e0b' : '#22c55e';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h2 {
          color: #1a1a1a;
          border-bottom: 2px solid #DF7373;
          padding-bottom: 10px;
          margin-top: 0;
        }
        .stats {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .progress-bar {
          background: #e0e0e0;
          border-radius: 4px;
          height: 20px;
          overflow: hidden;
          margin: 10px 0;
        }
        .progress-fill {
          background: ${progressColor};
          height: 100%;
          width: ${progressPercent}%;
          transition: width 0.3s ease;
        }
        .btn {
          display: inline-block;
          background: #DF7373;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          text-decoration: none;
          margin-top: 20px;
          font-weight: 500;
        }
        .btn:hover {
          background: #C23350;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          font-size: 12px;
          color: #666;
          text-align: center;
        }
        .logo {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo-text {
          font-size: 24px;
          font-weight: bold;
          color: #DF7373;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <span class="logo-text">TIS TIS</span>
        </div>

        ${bodyContent}

        <div class="stats">
          <strong>Resumen de uso:</strong>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p style="margin: 5px 0; font-size: 14px;">
            ${alert.current_usage} / ${alert.included_minutes} minutos
            (${Math.round(progressPercent)}%)
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${APP_URL}/dashboard/ai-agents/voz" class="btn">
            Ver Dashboard de Voice Agent
          </a>
        </div>

        <div class="footer">
          <p>Este email fue enviado automáticamente por TIS TIS Platform.</p>
          <p><strong>${escapeHtml(alert.tenant_name)}</strong> - Voice Agent</p>
          <p style="font-size: 11px; color: #999;">
            Si no deseas recibir estas alertas, puedes desactivarlas en la configuración de tu Voice Agent.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Verificar si se debe enviar alerta y enviarla
 * Se llama después de record_minute_usage si hay un threshold triggered
 */
export async function checkAndSendAlert(
  tenantId: string,
  triggeredThreshold: number | null,
  emailAlertsEnabled: boolean
): Promise<void> {
  if (!triggeredThreshold || !emailAlertsEnabled) {
    return;
  }

  // Validar que es un threshold válido
  const validThresholds: AlertThreshold[] = [70, 85, 95, 100];
  if (!validThresholds.includes(triggeredThreshold as AlertThreshold)) {
    console.warn('[MinuteAlertService] Invalid threshold:', triggeredThreshold);
    return;
  }

  console.log('[MinuteAlertService] Sending alert for threshold:', triggeredThreshold);

  const sent = await sendMinuteAlert(tenantId, triggeredThreshold as AlertThreshold);

  if (!sent) {
    console.error('[MinuteAlertService] Failed to send alert for threshold:', triggeredThreshold);
  }
}

/**
 * Enviar alerta de bloqueo por max_overage_charge alcanzado
 */
export async function sendBlockedAlert(
  tenantId: string,
  reason: string
): Promise<boolean> {
  if (!resend) {
    console.error('[MinuteAlertService] Resend not configured');
    return false;
  }

  const supabase = createServerClient();

  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, owner_email')
      .eq('id', tenantId)
      .single();

    if (!tenant?.owner_email) {
      return false;
    }

    const { error } = await resend.emails.send({
      from: 'TIS TIS <alertas@tistis.com>',
      to: tenant.owner_email,
      subject: '🚫 Voice Agent: Llamadas bloqueadas',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .alert-box {
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .btn {
              display: inline-block;
              background: #DF7373;
              color: white;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <h2>🚫 Tus llamadas de Voice Agent han sido bloqueadas</h2>
          <div class="alert-box">
            <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
          </div>
          <p>Para reactivar tu Voice Agent, puedes:</p>
          <ul>
            <li>Esperar al inicio del próximo ciclo de facturación</li>
            <li>Cambiar tu política de excedentes a "Cobrar"</li>
            <li>Contactar a soporte para asistencia</li>
          </ul>
          <p>
            <a href="${APP_URL}/dashboard/settings/billing" class="btn">
              Ver Configuración de Facturación
            </a>
          </p>
          <p style="font-size: 12px; color: #666; margin-top: 30px;">
            ${escapeHtml(tenant.name || 'Tu Negocio')} - TIS TIS Platform
          </p>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[MinuteAlertService] Error sending blocked alert:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[MinuteAlertService] Error:', error);
    return false;
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const MinuteAlertService = {
  sendMinuteAlert,
  checkAndSendAlert,
  sendBlockedAlert,
};
