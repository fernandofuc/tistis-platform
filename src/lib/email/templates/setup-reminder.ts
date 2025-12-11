// =====================================================
// TIS TIS - Setup Reminder Email Template
// Sent 24/48/72 hours after signup if setup incomplete
// =====================================================

import { baseEmailTemplate, createButton, createInfoBox } from '../base-template';
import type { SetupReminderEmailData } from '../types';

export function setupReminderEmailTemplate(data: SetupReminderEmailData): string {
  const {
    customerName,
    pendingSteps,
    completedSteps,
    dashboardUrl,
    setupCallUrl,
    daysRemaining,
  } = data;

  const firstName = customerName.split(' ')[0];
  const totalSteps = pendingSteps.length + completedSteps;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const content = `
    <!-- Friendly Reminder Header -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <span style="font-size: 48px;">👋</span>
        </td>
      </tr>
    </table>

    <!-- Main Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      ${firstName}, tu cerebro digital te espera
    </h1>

    <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666; text-align: center; line-height: 1.6;">
      Notamos que aún no has completado la configuración de tu cuenta.
      ¡Solo te faltan unos pasos para desbloquear todo el potencial de TIS TIS!
    </p>

    <!-- Progress Bar -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
      <tr>
        <td>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">
            Progreso de configuración: <strong style="color: #1a1a2e;">${progressPercent}%</strong>
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #e5e7eb; border-radius: 8px; height: 12px;">
            <tr>
              <td style="width: ${progressPercent}%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px;"></td>
              <td></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Pending Steps -->
    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1a1a2e;">
      Te falta completar:
    </h2>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      ${pendingSteps.map((step, index) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width: 32px; vertical-align: top;">
                  <div style="width: 24px; height: 24px; border: 2px solid #e5e7eb; border-radius: 50%; display: inline-block;"></div>
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0; font-size: 15px; color: #333333;">
                    ${step}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `).join('')}
    </table>

    <!-- Urgency Box -->
    ${daysRemaining && daysRemaining <= 7 ? `
      ${createInfoBox(`
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width: 40px; vertical-align: middle;">
              <span style="font-size: 24px;">⏰</span>
            </td>
            <td style="vertical-align: middle;">
              <p style="margin: 0; font-size: 14px; color: #333333;">
                <strong>Tu período de configuración guiada termina en ${daysRemaining} día${daysRemaining > 1 ? 's' : ''}.</strong>
                Completa tu setup para aprovechar al máximo tu inversión.
              </p>
            </td>
          </tr>
        </table>
      `, '#fff7ed', '#f97316')}
    ` : ''}

    <!-- CTA Buttons -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
      <tr>
        <td align="center">
          ${createButton('Completar mi Configuración', dashboardUrl)}
        </td>
      </tr>
    </table>

    ${setupCallUrl ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <a href="${setupCallUrl}" style="color: #7C5CFC; font-size: 15px; font-weight: 500; text-decoration: none;">
              ¿Prefieres que te ayudemos? Agenda una llamada →
            </a>
          </td>
        </tr>
      </table>
    ` : ''}

    <!-- Why Complete Setup -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px; background-color: #f8f9fa; border-radius: 12px;">
      <tr>
        <td style="padding: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a1a2e;">
            ¿Por qué completar la configuración?
          </h3>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #10B981; margin-right: 8px;">✓</span>
                <span style="color: #666666; font-size: 14px;">Activar las automatizaciones que ahorran tiempo</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #10B981; margin-right: 8px;">✓</span>
                <span style="color: #666666; font-size: 14px;">Conectar tu WhatsApp Business para respuestas 24/7</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #10B981; margin-right: 8px;">✓</span>
                <span style="color: #666666; font-size: 14px;">Comenzar a capturar leads automáticamente</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #10B981; margin-right: 8px;">✓</span>
                <span style="color: #666666; font-size: 14px;">Desbloquear reportes y métricas de tu negocio</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Help Footer -->
    <p style="margin: 32px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      ¿Necesitas ayuda? Responde a este correo o escríbenos a<br>
      <a href="mailto:soporte@tistis.com" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">soporte@tistis.com</a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `${firstName}, solo te faltan ${pendingSteps.length} pasos para activar tu cerebro digital`,
    content,
  });
}

export const setupReminderEmailSubject = (customerName: string, pendingStepsCount: number) =>
  `👋 ${customerName.split(' ')[0]}, te faltan ${pendingStepsCount} pasos para activar tu negocio`;
