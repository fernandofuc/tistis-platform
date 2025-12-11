// =====================================================
// TIS TIS - Brain Ready Email Template
// Sent when the micro-app is fully provisioned
// =====================================================

import { baseEmailTemplate, createButton, createFeatureList, createInfoBox } from '../base-template';
import type { BrainReadyEmailData } from '../types';

export function brainReadyEmailTemplate(data: BrainReadyEmailData): string {
  const {
    customerName,
    businessName,
    planName,
    dashboardUrl,
    featuresEnabled,
    whatsappNumber,
    setupCallUrl,
  } = data;

  const firstName = customerName.split(' ')[0];

  const content = `
    <!-- Hero Section -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="font-size: 72px; line-height: 1;">🧠</div>
        </td>
      </tr>
    </table>

    <!-- Main Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      ¡Tu Cerebro Digital está listo, ${firstName}!
    </h1>

    <p style="margin: 0 0 8px 0; font-size: 18px; color: #666666; text-align: center; line-height: 1.6;">
      El sistema de <strong style="color: #1a1a2e;">${businessName}</strong> ya está configurado
      y listo para empezar a trabajar por ti.
    </p>

    <p style="margin: 0 0 32px 0; font-size: 16px; color: #7C5CFC; text-align: center; font-weight: 500;">
      Tu negocio ahora tiene un cerebro que nunca duerme. 🚀
    </p>

    <!-- Primary CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          ${createButton('🎯 Acceder a mi Dashboard', dashboardUrl, 'coral')}
        </td>
      </tr>
    </table>

    <!-- Features Enabled -->
    <h2 style="margin: 40px 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">
      Lo que ya tienes activo:
    </h2>

    ${createFeatureList(featuresEnabled)}

    <!-- WhatsApp Number (if applicable) -->
    ${whatsappNumber ? `
      ${createInfoBox(`
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width: 48px; vertical-align: middle;">
              <span style="font-size: 32px;">📱</span>
            </td>
            <td style="vertical-align: middle;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #666666;">Tu línea de WhatsApp Business:</p>
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #25D366;">
                ${whatsappNumber}
              </p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #666666;">
                Tu asistente IA ya está respondiendo mensajes 24/7
              </p>
            </td>
          </tr>
        </table>
      `, '#f0fdf4', '#25D366')}
    ` : ''}

    <!-- What to do now -->
    <h2 style="margin: 32px 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">
      Tus próximos pasos recomendados:
    </h2>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <!-- Step 1 -->
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 32px; vertical-align: top; padding-right: 12px;">
                <span style="font-size: 20px;">1️⃣</span>
              </td>
              <td style="color: #333333; font-size: 15px; line-height: 1.5;">
                <strong>Explora tu dashboard</strong> — Familiarízate con todas las herramientas disponibles
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Step 2 -->
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 32px; vertical-align: top; padding-right: 12px;">
                <span style="font-size: 20px;">2️⃣</span>
              </td>
              <td style="color: #333333; font-size: 15px; line-height: 1.5;">
                <strong>Agrega tu información</strong> — Completa los datos de tu negocio para personalizar las respuestas
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Step 3 -->
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 32px; vertical-align: top; padding-right: 12px;">
                <span style="font-size: 20px;">3️⃣</span>
              </td>
              <td style="color: #333333; font-size: 15px; line-height: 1.5;">
                <strong>Agenda tu call de configuración</strong> — Te guiaremos paso a paso en 30 minutos
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Setup Call CTA -->
    ${setupCallUrl ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px;">
        <tr>
          <td align="center">
            ${createButton('📅 Agendar mi Call de Configuración', setupCallUrl)}
          </td>
        </tr>
      </table>
    ` : ''}

    <!-- Motivational Close -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
      <tr>
        <td style="padding: 24px 32px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #ffffff;">
            A partir de hoy, tu negocio trabaja mientras tú descansas.
          </p>
          <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">
            Bienvenido al futuro de los negocios inteligentes.
          </p>
        </td>
      </tr>
    </table>

    <!-- Support -->
    <p style="margin: 32px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      ¿Necesitas ayuda? Nuestro equipo está disponible para ti.<br>
      <a href="mailto:soporte@tistis.com" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">soporte@tistis.com</a>
      · WhatsApp: <a href="https://wa.me/5216141234567" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">+52 614 123 4567</a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `🧠 ¡Tu cerebro digital para ${businessName} está listo! Accede ahora a tu dashboard.`,
    content,
  });
}

export const brainReadyEmailSubject = (businessName: string) =>
  `🧠 ¡Listo! Tu cerebro digital para ${businessName} ya está operando`;
