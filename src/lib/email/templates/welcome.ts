// =====================================================
// TIS TIS - Welcome Email Template
// Sent after successful payment/signup
// =====================================================

import { baseEmailTemplate, createButton, createFeatureList, createInfoBox } from '../base-template';
import type { WelcomeEmailData } from '../types';

export function welcomeEmailTemplate(data: WelcomeEmailData): string {
  const { customerName, planName, planPrice, dashboardUrl, supportEmail } = data;

  const firstName = customerName.split(' ')[0];

  const content = `
    <!-- Hero Section -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 32px;">
          <div style="font-size: 64px; line-height: 1;">🎉</div>
        </td>
      </tr>
    </table>

    <!-- Welcome Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      ¡Bienvenido a TIS TIS, ${firstName}!
    </h1>

    <p style="margin: 0 0 24px 0; font-size: 16px; color: #666666; text-align: center; line-height: 1.6;">
      Tu decisión de automatizar tu negocio es el primer paso hacia un crecimiento exponencial.
      Estamos emocionados de tenerte con nosotros.
    </p>

    <!-- Plan Info Box -->
    ${createInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td>
            <p style="margin: 0 0 4px 0; font-size: 14px; color: #666666;">Tu plan activo:</p>
            <p style="margin: 0; font-size: 20px; font-weight: 700; color: #1a1a2e;">
              Plan ${planName} — $${planPrice.toLocaleString('es-MX')} MXN/mes
            </p>
          </td>
        </tr>
      </table>
    `, '#f0fdf4', '#10B981')}

    <!-- What Happens Next -->
    <h2 style="margin: 32px 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">
      ¿Qué sigue ahora?
    </h2>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <!-- Step 1 -->
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 48px; vertical-align: top;">
                <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; line-height: 32px;">
                  1
                </div>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1a1a2e;">
                  Estamos configurando tu cerebro digital
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
                  Nuestro sistema está preparando tu dashboard personalizado y conectando todas las automatizaciones.
                  Esto toma entre 5-15 minutos.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Step 2 -->
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 48px; vertical-align: top;">
                <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; line-height: 32px;">
                  2
                </div>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1a1a2e;">
                  Recibirás otro correo cuando esté listo
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
                  Te notificaremos en cuanto tu cerebro digital esté 100% operativo
                  con el enlace directo a tu dashboard.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Step 3 -->
      <tr>
        <td style="padding: 16px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 48px; vertical-align: top;">
                <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; line-height: 32px;">
                  3
                </div>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1a1a2e;">
                  Agendaremos tu call de configuración
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
                  Un especialista te contactará para una sesión de 30 minutos donde
                  personalizaremos tu sistema según tus necesidades específicas.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
      <tr>
        <td align="center">
          ${createButton('Explorar mi Dashboard', dashboardUrl)}
        </td>
      </tr>
    </table>

    <!-- Support Note -->
    <p style="margin: 32px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      ¿Tienes alguna pregunta? Estamos aquí para ayudarte.<br>
      Escríbenos a <a href="mailto:${supportEmail}" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">${supportEmail}</a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `¡Bienvenido a TIS TIS, ${firstName}! Tu cerebro digital está siendo configurado.`,
    content,
  });
}

export const welcomeEmailSubject = (customerName: string) =>
  `¡Bienvenido a TIS TIS, ${customerName.split(' ')[0]}! 🧠`;
