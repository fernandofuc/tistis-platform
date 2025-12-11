// =====================================================
// TIS TIS - Payment Confirmed Email Template
// Sent after each successful payment (receipt)
// =====================================================

import { baseEmailTemplate, createButton, createInfoBox } from '../base-template';
import type { PaymentConfirmedEmailData } from '../types';

export function paymentConfirmedEmailTemplate(data: PaymentConfirmedEmailData): string {
  const {
    customerName,
    planName,
    amount,
    currency,
    invoiceNumber,
    nextBillingDate,
    dashboardUrl,
  } = data;

  const firstName = customerName.split(' ')[0];
  const formattedAmount = amount.toLocaleString('es-MX');
  const formattedDate = nextBillingDate
    ? new Date(nextBillingDate).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const content = `
    <!-- Success Icon -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <div style="width: 64px; height: 64px; background-color: #10B981; border-radius: 50%; display: inline-block;">
            <span style="font-size: 32px; line-height: 64px; display: block;">✓</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Main Message -->
    <h1 style="margin: 0 0 16px 0; font-size: 28px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.3;">
      Pago Confirmado
    </h1>

    <p style="margin: 0 0 32px 0; font-size: 16px; color: #666666; text-align: center; line-height: 1.6;">
      ¡Gracias, ${firstName}! Hemos recibido tu pago correctamente.
    </p>

    <!-- Payment Details Card -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border-radius: 12px; margin-bottom: 32px;">
      <tr>
        <td style="padding: 24px;">
          <!-- Header -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 16px;">
            <tr>
              <td>
                <p style="margin: 0; font-size: 12px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
                  Recibo de Pago
                </p>
                ${invoiceNumber ? `
                  <p style="margin: 4px 0 0 0; font-size: 14px; color: #333333; font-weight: 500;">
                    #${invoiceNumber}
                  </p>
                ` : ''}
              </td>
              <td align="right">
                <p style="margin: 0; font-size: 12px; color: #666666;">
                  ${new Date().toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </td>
            </tr>
          </table>

          <!-- Line Items -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <p style="margin: 0; font-size: 15px; color: #333333;">
                  Plan ${planName} — Suscripción Mensual
                </p>
              </td>
              <td align="right" style="padding: 8px 0;">
                <p style="margin: 0; font-size: 15px; color: #333333; font-weight: 500;">
                  $${formattedAmount} ${currency}
                </p>
              </td>
            </tr>
          </table>

          <!-- Total -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 2px solid #e5e7eb; margin-top: 16px; padding-top: 16px;">
            <tr>
              <td>
                <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">
                  Total Pagado
                </p>
              </td>
              <td align="right">
                <p style="margin: 0; font-size: 20px; font-weight: 700; color: #10B981;">
                  $${formattedAmount} ${currency}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Next Billing Date -->
    ${formattedDate ? `
      ${createInfoBox(`
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width: 40px; vertical-align: middle;">
              <span style="font-size: 24px;">📅</span>
            </td>
            <td style="vertical-align: middle;">
              <p style="margin: 0; font-size: 14px; color: #666666;">
                Próximo cobro: <strong style="color: #333333;">${formattedDate}</strong>
              </p>
            </td>
          </tr>
        </table>
      `, '#f0f9ff', '#0ea5e9')}
    ` : ''}

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          ${createButton('Ver mi Dashboard', dashboardUrl)}
        </td>
      </tr>
    </table>

    <!-- Billing Info -->
    <p style="margin: 32px 0 0 0; font-size: 13px; color: #999999; text-align: center; line-height: 1.6;">
      Este recibo se generó automáticamente. Puedes descargar tu factura
      desde la sección de Configuración → Facturación en tu dashboard.
    </p>

    <!-- Support -->
    <p style="margin: 16px 0 0 0; font-size: 14px; color: #666666; text-align: center; line-height: 1.6;">
      ¿Preguntas sobre tu facturación?<br>
      <a href="mailto:facturacion@tistis.com" style="color: #7C5CFC; text-decoration: none; font-weight: 500;">facturacion@tistis.com</a>
    </p>
  `;

  return baseEmailTemplate({
    previewText: `✓ Pago confirmado: $${formattedAmount} ${currency} — Plan ${planName}`,
    content,
  });
}

export const paymentConfirmedEmailSubject = (amount: number, currency: string) =>
  `✓ Pago confirmado: $${amount.toLocaleString('es-MX')} ${currency}`;
