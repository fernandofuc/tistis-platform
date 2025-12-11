// =====================================================
// TIS TIS - Subscription Cancelled Email Template
// Sent when subscription is cancelled
// =====================================================

import { baseEmailTemplate, createButton, createInfoBox } from '../base-template';
import type { SubscriptionCancelledEmailData } from '../types';

export function subscriptionCancelledEmailTemplate(data: SubscriptionCancelledEmailData): string {
  const {
    customerName,
    planName,
    endDate,
    reactivateUrl,
    feedbackUrl,
  } = data;

  const firstName = customerName.split(' ')[0];
  const formattedEndDate = new Date(endDate).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const content = `
    <!-- Sad Icon -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <span style="font-size: 48px;">😢</span>
        </td>
      </tr>
    </table>

    <!-- Main Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      Lamentamos verte partir, ${firstName}
    </h1>

    <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666; text-align: center; line-height: 1.6;">
      Tu suscripción a TIS TIS ha sido cancelada.
      Gracias por confiar en nosotros durante este tiempo.
    </p>

    <!-- Cancellation Details -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border-radius: 12px; margin-bottom: 32px;">
      <tr>
        <td style="padding: 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
                <p style="margin: 0; font-size: 14px; color: #666666;">Plan cancelado</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; color: #1a1a2e; font-weight: 600;">
                  ${planName}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 16px;">
                <p style="margin: 0; font-size: 14px; color: #666666;">Acceso hasta</p>
                <p style="margin: 4px 0 0 0; font-size: 18px; color: #1a1a2e; font-weight: 600;">
                  ${formattedEndDate}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- What You'll Lose -->
    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1a1a2e;">
      Lo que dejarás de tener:
    </h2>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0;">
          <span style="color: #ef4444; margin-right: 8px;">✕</span>
          <span style="color: #666666; font-size: 15px;">Respuestas automáticas 24/7 en WhatsApp</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <span style="color: #ef4444; margin-right: 8px;">✕</span>
          <span style="color: #666666; font-size: 15px;">Captura y seguimiento automático de leads</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <span style="color: #ef4444; margin-right: 8px;">✕</span>
          <span style="color: #666666; font-size: 15px;">Calendario inteligente y recordatorios</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <span style="color: #ef4444; margin-right: 8px;">✕</span>
          <span style="color: #666666; font-size: 15px;">Reportes y métricas de tu negocio</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 0;">
          <span style="color: #ef4444; margin-right: 8px;">✕</span>
          <span style="color: #666666; font-size: 15px;">Soporte prioritario</span>
        </td>
      </tr>
    </table>

    <!-- Data Retention Notice -->
    ${createInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <span style="font-size: 24px;">💾</span>
          </td>
          <td style="vertical-align: middle;">
            <p style="margin: 0; font-size: 14px; color: #333333;">
              <strong>Tus datos están seguros.</strong> Conservaremos tu información por 30 días
              después de la fecha de finalización, por si decides regresar.
            </p>
          </td>
        </tr>
      </table>
    `, '#f0f9ff', '#0ea5e9')}

    <!-- Win-back Offer -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; margin: 24px 0;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: rgba(255,255,255,0.9);">
            ¿Cambiaste de opinión?
          </p>
          <p style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
            Reactiva tu cuenta hoy y obtén 20% de descuento
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tr>
              <td style="border-radius: 8px; background-color: #ffffff;">
                <a href="${reactivateUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: #7C5CFC; text-decoration: none; border-radius: 8px;">
                  Reactivar con Descuento
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Feedback Request -->
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1a1a2e; text-align: center; font-weight: 500;">
      Tu opinión nos ayuda a mejorar
    </p>

    <p style="margin: 0 0 24px 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      Nos encantaría saber por qué decidiste cancelar.
      Tu feedback es invaluable para crear un mejor producto.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${feedbackUrl}" style="color: #7C5CFC; font-size: 15px; font-weight: 500; text-decoration: none;">
            Compartir mi experiencia (2 minutos) →
          </a>
        </td>
      </tr>
    </table>

    <!-- Farewell -->
    <p style="margin: 32px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      Gracias por ser parte de TIS TIS.<br>
      Las puertas siempre están abiertas si decides volver. 💜
    </p>
  `;

  return baseEmailTemplate({
    previewText: `${firstName}, tu suscripción a TIS TIS ha sido cancelada`,
    content,
  });
}

export const subscriptionCancelledEmailSubject = (customerName: string) =>
  `Confirmación de cancelación — Gracias, ${customerName.split(' ')[0]}`;
