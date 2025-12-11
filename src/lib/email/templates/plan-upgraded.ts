// =====================================================
// TIS TIS - Plan Upgraded Email Template
// Sent when customer upgrades their subscription
// =====================================================

import { baseEmailTemplate, createButton, createFeatureList, createInfoBox } from '../base-template';
import type { PlanUpgradedEmailData } from '../types';

export function planUpgradedEmailTemplate(data: PlanUpgradedEmailData): string {
  const {
    customerName,
    previousPlan,
    newPlan,
    newPrice,
    currency,
    newFeatures,
    dashboardUrl,
    effectiveDate,
  } = data;

  const firstName = customerName.split(' ')[0];
  const formattedPrice = newPrice.toLocaleString('es-MX');
  const formattedDate = effectiveDate
    ? new Date(effectiveDate).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Inmediatamente';

  const content = `
    <!-- Celebration Icon -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <span style="font-size: 64px;">🚀</span>
        </td>
      </tr>
    </table>

    <!-- Main Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      ¡Tu negocio acaba de subir de nivel!
    </h1>

    <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666; text-align: center; line-height: 1.6;">
      ${firstName}, has actualizado exitosamente tu plan de TIS TIS.
      Ahora tienes acceso a herramientas más poderosas para crecer tu negocio.
    </p>

    <!-- Plan Change Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin-bottom: 32px;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="text-align: center;">
                <!-- Previous Plan -->
                <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px;">
                  Plan anterior
                </p>
                <p style="margin: 4px 0 16px 0; font-size: 18px; color: rgba(255,255,255,0.9); text-decoration: line-through;">
                  ${previousPlan}
                </p>

                <!-- Arrow -->
                <p style="margin: 0 0 16px 0; font-size: 24px; color: #ffffff;">↓</p>

                <!-- New Plan -->
                <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px;">
                  Tu nuevo plan
                </p>
                <p style="margin: 4px 0 0 0; font-size: 28px; font-weight: 700; color: #ffffff;">
                  ${newPlan}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">
                  $${formattedPrice} ${currency}/mes
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Effective Date -->
    ${createInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <span style="font-size: 24px;">📅</span>
          </td>
          <td style="vertical-align: middle;">
            <p style="margin: 0; font-size: 14px; color: #333333;">
              <strong>Activo desde:</strong> ${formattedDate}
            </p>
          </td>
        </tr>
      </table>
    `, '#f0fdf4', '#10B981')}

    <!-- New Features -->
    <h2 style="margin: 32px 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">
      Lo nuevo que tienes disponible:
    </h2>

    ${createFeatureList(newFeatures)}

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px;">
      <tr>
        <td align="center">
          ${createButton('Explorar mis Nuevas Funciones', dashboardUrl)}
        </td>
      </tr>
    </table>

    <!-- Tips Box -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px; background-color: #f8f9fa; border-radius: 12px;">
      <tr>
        <td style="padding: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a1a2e;">
            💡 Próximos pasos recomendados
          </h3>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #7C5CFC; margin-right: 8px;">1.</span>
                <span style="color: #666666; font-size: 14px;">Explora las nuevas secciones en tu dashboard</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #7C5CFC; margin-right: 8px;">2.</span>
                <span style="color: #666666; font-size: 14px;">Configura las automatizaciones avanzadas</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0;">
                <span style="color: #7C5CFC; margin-right: 8px;">3.</span>
                <span style="color: #666666; font-size: 14px;">Agenda una sesión con nuestro equipo para aprovechar al máximo tu plan</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Thank You -->
    <p style="margin: 32px 0 0 0; font-size: 16px; color: #1a1a2e; text-align: center; font-weight: 500;">
      Gracias por confiar en TIS TIS para hacer crecer tu negocio 💜
    </p>

    <!-- Support -->
    <p style="margin: 16px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      ¿Tienes dudas sobre tu nuevo plan?<br>
      <a href="mailto:soporte@tistis.com" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">soporte@tistis.com</a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `🚀 ${firstName}, tu plan ha sido actualizado a ${newPlan}`,
    content,
  });
}

export const planUpgradedEmailSubject = (newPlan: string) =>
  `🚀 ¡Felicidades! Tu plan ha sido actualizado a ${newPlan}`;
