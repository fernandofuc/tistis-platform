// =====================================================
// TIS TIS PLATFORM - Invoice Email Service
// Sends invoice PDFs to customers via email
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Invoice, InvoiceConfig } from '../types';

// ======================
// TYPES
// ======================

interface EmailConfig {
  resendApiKey?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface EmailTemplateData {
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  total: string;
  restaurant_name: string;
  restaurant_email?: string;
  pdf_url: string;
  xml_url?: string;
}

// ======================
// SERVICE CLASS
// ======================

export class InvoiceEmailService {
  private supabase: SupabaseClient<unknown>;
  private resendApiKey: string;
  private fromEmail: string;

  constructor(config?: EmailConfig) {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.resendApiKey = config?.resendApiKey || process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'facturas@tistis.com';
  }

  /**
   * Send invoice email to customer
   */
  async sendInvoiceEmail(
    invoice: Invoice,
    config: InvoiceConfig
  ): Promise<SendEmailResult> {
    try {
      if (!this.resendApiKey) {
        throw new Error('Email API key not configured');
      }

      if (!invoice.receptor_email) {
        throw new Error('Customer email not provided');
      }

      if (!invoice.pdf_url) {
        throw new Error('Invoice PDF not generated');
      }

      // Prepare email data
      const emailData = this.prepareEmailData(invoice, config);
      const htmlContent = this.generateEmailHTML(emailData);

      // Send via Resend API
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.email_from_name
            ? `${config.email_from_name} <${this.fromEmail}>`
            : this.fromEmail,
          to: invoice.receptor_email,
          bcc: config.email_bcc || undefined,
          reply_to: config.email_reply_to || undefined,
          subject: `Factura ${invoice.serie}-${invoice.folio} - ${config.razon_social}`,
          html: htmlContent,
          attachments: [
            {
              filename: `Factura-${invoice.serie}-${invoice.folio}.pdf`,
              path: invoice.pdf_url,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send email');
      }

      const result = await response.json();

      // Update invoice with email sent timestamp
      await this.supabase
        .from('restaurant_invoices')
        .update({
          email_sent_at: new Date().toISOString(),
          status: invoice.status === 'timbrada' ? 'enviada' : invoice.status,
        })
        .eq('id', invoice.id);

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Log the error
      await this.supabase.from('restaurant_invoice_audit_log').insert({
        invoice_id: invoice.id,
        action: 'email_failed',
        new_values: { error: message },
      });

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Prepare email template data
   */
  private prepareEmailData(
    invoice: Invoice,
    config: InvoiceConfig
  ): EmailTemplateData {
    return {
      customer_name: invoice.receptor_nombre,
      invoice_number: `${invoice.serie}-${invoice.folio}`,
      invoice_date: new Date(invoice.fecha_emision).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      total: `$${invoice.total.toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${invoice.moneda}`,
      restaurant_name: config.razon_social,
      restaurant_email: config.email_reply_to || undefined,
      pdf_url: invoice.pdf_url!,
      xml_url: invoice.xml_url || undefined,
    };
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(data: EmailTemplateData): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu Factura</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #DF7373 0%, #e74c3c 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Tu Factura Electrónica</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">${data.restaurant_name}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px; line-height: 1.6;">
                Hola <strong>${data.customer_name}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 15px; line-height: 1.6;">
                Gracias por tu preferencia. Adjunto encontrarás tu factura electrónica (CFDI) correspondiente a tu consumo.
              </p>

              <!-- Invoice Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #666; font-size: 13px;">Número de Factura</span>
                          <br>
                          <strong style="color: #333; font-size: 16px;">${data.invoice_number}</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #666; font-size: 13px;">Fecha</span>
                          <br>
                          <strong style="color: #333; font-size: 16px;">${data.invoice_date}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 15px; border-top: 1px solid #e0e0e0;">
                          <span style="color: #666; font-size: 13px;">Total</span>
                          <br>
                          <strong style="color: #DF7373; font-size: 24px;">${data.total}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Download Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="${data.pdf_url}"
                       style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #DF7373 0%, #e74c3c 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(223, 115, 115, 0.3);">
                      Descargar Factura PDF
                    </a>
                  </td>
                </tr>
              </table>

              ${data.xml_url ? `
              <p style="margin: 20px 0 0; text-align: center;">
                <a href="${data.xml_url}" style="color: #DF7373; text-decoration: none; font-size: 14px;">
                  Descargar XML
                </a>
              </p>
              ` : ''}

              <!-- Info -->
              <p style="margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 13px; line-height: 1.6;">
                Este comprobante fiscal digital fue generado de acuerdo a las disposiciones del SAT.
                Puedes verificar su autenticidad en
                <a href="https://verificacfdi.facturaelectronica.sat.gob.mx" style="color: #DF7373;">verificacfdi.facturaelectronica.sat.gob.mx</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px; color: #333; font-size: 15px; font-weight: 600;">
                ${data.restaurant_name}
              </p>
              ${data.restaurant_email ? `
              <p style="margin: 0; color: #666; font-size: 13px;">
                <a href="mailto:${data.restaurant_email}" style="color: #DF7373; text-decoration: none;">${data.restaurant_email}</a>
              </p>
              ` : ''}
              <p style="margin: 20px 0 0; color: #999; font-size: 12px;">
                Powered by <a href="https://tistis.com" style="color: #DF7373; text-decoration: none;">TIS TIS</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Track email open (webhook handler)
   */
  async trackEmailOpen(invoiceId: string): Promise<void> {
    await this.supabase
      .from('restaurant_invoices')
      .update({ email_opened_at: new Date().toISOString() })
      .eq('id', invoiceId);
  }

  /**
   * Handle email bounce (webhook handler)
   */
  async handleEmailBounce(invoiceId: string): Promise<void> {
    await this.supabase
      .from('restaurant_invoices')
      .update({ email_bounced: true })
      .eq('id', invoiceId);

    await this.supabase.from('restaurant_invoice_audit_log').insert({
      invoice_id: invoiceId,
      action: 'email_bounced',
    });
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: InvoiceEmailService | null = null;

export function getInvoiceEmailService(): InvoiceEmailService {
  if (!instance) {
    instance = new InvoiceEmailService();
  }
  return instance;
}
