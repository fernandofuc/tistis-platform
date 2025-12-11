// =====================================================
// TIS TIS - Payment Failed Email Template
// Sent when a payment attempt fails
// =====================================================

import { baseEmailTemplate, createButton, createInfoBox } from '../base-template';
import type { PaymentFailedEmailData } from '../types';

export function paymentFailedEmailTemplate(data: PaymentFailedEmailData): string {
  const {
    customerName,
    planName,
    amount,
    currency,
    failureReason,
    retryDate,
    updatePaymentUrl,
    supportUrl,
  } = data;

  const firstName = customerName.split(' ')[0];
  const formattedAmount = amount.toLocaleString('es-MX');
  const formattedRetryDate = retryDate
    ? new Date(retryDate).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // User-friendly failure reasons
  const getFailureMessage = (reason?: string): string => {
    const reasons: Record<string, string> = {
      card_declined: 'Tu tarjeta fue declinada por el banco emisor.',
      insufficient_funds: 'Fondos insuficientes en la cuenta.',
      expired_card: 'La tarjeta ha expirado.',
      incorrect_cvc: 'El código de seguridad (CVC) es incorrecto.',
      processing_error: 'Error temporal de procesamiento. Por favor, intenta de nuevo.',
      default: 'No pudimos procesar el pago con tu método de pago actual.',
    };
    return reasons[reason || 'default'] || reasons.default;
  };

  const content = `
    <!-- Alert Icon -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="width: 64px; height: 64px; background-color: #fee2e2; border-radius: 50%; display: inline-block;">
            <span style="font-size: 32px; line-height: 64px; display: block;">⚠️</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Main Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      Hubo un problema con tu pago
    </h1>

    <p style="margin: 0 0 24px 0; font-size: 16px; color: #666666; text-align: center; line-height: 1.6;">
      ${firstName}, no pudimos procesar el pago de tu suscripción a TIS TIS.
      No te preocupes, esto es fácil de resolver.
    </p>

    <!-- Failure Reason Box -->
    ${createInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="vertical-align: middle;">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
              Motivo del problema
            </p>
            <p style="margin: 0; font-size: 15px; color: #dc2626; font-weight: 500;">
              ${getFailureMessage(failureReason)}
            </p>
          </td>
        </tr>
      </table>
    `, '#fef2f2', '#ef4444')}

    <!-- Payment Details -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <p style="margin: 0; font-size: 14px; color: #666666;">Plan</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; color: #333333; font-weight: 500;">
                  ${planName}
                </p>
              </td>
              <td align="right">
                <p style="margin: 0; font-size: 14px; color: #666666;">Monto</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; color: #333333; font-weight: 500;">
                  $${formattedAmount} ${currency}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- What Happens Next -->
    <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1a1a2e;">
      ¿Qué puedes hacer?
    </h2>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <!-- Option 1 -->
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 40px; vertical-align: top;">
                <div style="width: 28px; height: 28px; background-color: #7C5CFC; border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; line-height: 28px;">
                  1
                </div>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a2e;">
                  Actualiza tu método de pago
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
                  Agrega una tarjeta válida o actualiza los datos de la existente.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Option 2 -->
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 40px; vertical-align: top;">
                <div style="width: 28px; height: 28px; background-color: #7C5CFC; border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; line-height: 28px;">
                  2
                </div>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a2e;">
                  Verifica con tu banco
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
                  A veces los bancos bloquean transacciones por seguridad. Autoriza el cargo o intenta con otra tarjeta.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Option 3 -->
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 40px; vertical-align: top;">
                <div style="width: 28px; height: 28px; background-color: #7C5CFC; border-radius: 50%; color: #ffffff; font-weight: 700; font-size: 14px; text-align: center; line-height: 28px;">
                  3
                </div>
              </td>
              <td style="vertical-align: top;">
                <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: #1a1a2e;">
                  Espera el reintento automático
                </p>
                <p style="margin: 0; font-size: 14px; color: #666666; line-height: 1.5;">
                  ${formattedRetryDate
                    ? `Intentaremos cobrar nuevamente el <strong>${formattedRetryDate}</strong>.`
                    : 'Intentaremos cobrar nuevamente en unos días.'}
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
          ${createButton('Actualizar Método de Pago', updatePaymentUrl, 'coral')}
        </td>
      </tr>
    </table>

    <!-- Service Continuity Warning -->
    ${createInfoBox(`
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="width: 40px; vertical-align: middle;">
            <span style="font-size: 24px;">⚡</span>
          </td>
          <td style="vertical-align: middle;">
            <p style="margin: 0; font-size: 14px; color: #333333;">
              <strong>Tu servicio sigue activo.</strong> Tienes un período de gracia para actualizar tu pago.
              Después de 3 intentos fallidos, tu cuenta entrará en modo limitado.
            </p>
          </td>
        </tr>
      </table>
    `, '#f0fdf4', '#10B981')}

    <!-- Support -->
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      ¿Problemas para actualizar? Estamos aquí para ayudarte.<br>
      <a href="${supportUrl || 'mailto:facturacion@tistis.com'}" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">
        Contactar a facturación
      </a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `⚠️ ${firstName}, hubo un problema con tu pago de TIS TIS`,
    content,
  });
}

export const paymentFailedEmailSubject = () =>
  '⚠️ Acción requerida: Problema con tu pago';
