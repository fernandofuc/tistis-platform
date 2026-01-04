// =====================================================
// TIS TIS PLATFORM - PDF Generator Service
// Generates PDF invoices from HTML templates
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Invoice, InvoiceItem, InvoiceConfig } from '../types';
import Handlebars from 'handlebars';

// ======================
// TYPES
// ======================

interface PDFGeneratorConfig {
  apiUrl?: string;
  apiKey?: string;
}

interface PDFGenerationResult {
  success: boolean;
  pdfUrl?: string;
  pdfBuffer?: Buffer;
  error?: string;
}

// ======================
// HELPERS
// ======================

/**
 * Format currency for display
 */
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '$0.00';
  return `$${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date for display
 */
function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get forma de pago description
 */
function getFormaPagoDesc(code: string): string {
  const descriptions: Record<string, string> = {
    '01': 'Efectivo',
    '02': 'Cheque nominativo',
    '03': 'Transferencia electrónica de fondos',
    '04': 'Tarjeta de crédito',
    '28': 'Tarjeta de débito',
    '99': 'Por definir',
  };
  return descriptions[code] || code;
}

/**
 * Get método de pago description
 */
function getMetodoPagoDesc(code: string): string {
  const descriptions: Record<string, string> = {
    'PUE': 'Pago en una sola exhibición',
    'PPD': 'Pago en parcialidades o diferido',
  };
  return descriptions[code] || code;
}

// Register Handlebars helpers
Handlebars.registerHelper('formatCurrency', formatCurrency);
Handlebars.registerHelper('formatDate', formatDate);

// ======================
// SERVICE CLASS
// ======================

export class PDFGeneratorService {
  private supabase: SupabaseClient<unknown>;
  private pdfApiUrl: string;
  private pdfApiKey: string;

  constructor(config?: PDFGeneratorConfig) {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // PDFShift API (same as N8N workflow)
    this.pdfApiUrl = config?.apiUrl || process.env.PDFSHIFT_API_URL || 'https://api.pdfshift.io/v3/convert/pdf';
    this.pdfApiKey = config?.apiKey || process.env.PDFSHIFT_API_KEY || '';
  }

  /**
   * Generate PDF from invoice
   */
  async generateInvoicePDF(
    invoice: Invoice & { items?: InvoiceItem[] },
    config: InvoiceConfig
  ): Promise<PDFGenerationResult> {
    try {
      // Get template
      const template = await this.getTemplate(config.pdf_template);

      // Prepare template data
      const templateData = this.prepareTemplateData(invoice, config);

      // Compile and render HTML
      const compiledTemplate = Handlebars.compile(template.html);
      const html = compiledTemplate(templateData);

      // Add CSS
      const fullHtml = this.wrapWithStyles(html, template.css);

      // Convert to PDF
      const pdfBuffer = await this.htmlToPDF(fullHtml);

      // Upload to storage
      const pdfUrl = await this.uploadPDF(
        pdfBuffer,
        invoice.tenant_id,
        `${invoice.serie}-${invoice.folio}.pdf`
      );

      // Update invoice with PDF URL
      await this.supabase
        .from('restaurant_invoices')
        .update({ pdf_url: pdfUrl })
        .eq('id', invoice.id);

      return {
        success: true,
        pdfUrl,
        pdfBuffer,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Get PDF template from database or use default
   */
  private async getTemplate(
    templateId: string
  ): Promise<{ html: string; css: string }> {
    // Try to get custom template
    const { data: template } = await this.supabase
      .from('restaurant_invoice_templates')
      .select('html_template, css_styles')
      .or(`id.eq.${templateId},name.eq.${templateId}`)
      .eq('is_active', true)
      .single();

    if (template) {
      return {
        html: template.html_template,
        css: template.css_styles || '',
      };
    }

    // Get default template
    const { data: defaultTemplate } = await this.supabase
      .from('restaurant_invoice_templates')
      .select('html_template, css_styles')
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (defaultTemplate) {
      return {
        html: defaultTemplate.html_template,
        css: defaultTemplate.css_styles || '',
      };
    }

    // Fallback to embedded default
    return {
      html: this.getDefaultTemplate(),
      css: this.getDefaultStyles(),
    };
  }

  /**
   * Prepare data for template rendering
   */
  private prepareTemplateData(
    invoice: Invoice & { items?: InvoiceItem[] },
    config: InvoiceConfig
  ): Record<string, unknown> {
    return {
      // Invoice info
      serie: invoice.serie,
      folio: invoice.folio,
      folio_fiscal: invoice.folio_fiscal,
      fecha_emision: formatDate(invoice.fecha_emision),
      fecha_timbrado: invoice.fecha_timbrado ? formatDate(invoice.fecha_timbrado) : null,

      // Emisor (restaurant)
      emisor_rfc: config.rfc,
      emisor_nombre: config.razon_social,
      emisor_regimen: config.regimen_fiscal,
      emisor_cp: config.codigo_postal,
      logo_url: config.logo_url,

      // Receptor (customer)
      receptor_rfc: invoice.receptor_rfc,
      receptor_nombre: invoice.receptor_nombre,
      receptor_codigo_postal: invoice.receptor_codigo_postal,
      receptor_regimen_fiscal: invoice.receptor_regimen_fiscal,
      receptor_uso_cfdi: invoice.receptor_uso_cfdi,

      // Items
      items: (invoice.items || []).map((item) => ({
        clave_prod_serv: item.clave_prod_serv,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        valor_unitario: formatCurrency(item.valor_unitario),
        importe: formatCurrency(item.importe),
        descuento: item.descuento > 0 ? formatCurrency(item.descuento) : null,
      })),

      // Amounts
      subtotal: formatCurrency(invoice.subtotal),
      descuento: invoice.descuento > 0 ? formatCurrency(invoice.descuento) : null,
      iva_trasladado: formatCurrency(invoice.iva_trasladado),
      ieps_trasladado: invoice.ieps_trasladado > 0 ? formatCurrency(invoice.ieps_trasladado) : null,
      total: formatCurrency(invoice.total),
      moneda: invoice.moneda,

      // Payment
      forma_pago: invoice.forma_pago,
      forma_pago_desc: getFormaPagoDesc(invoice.forma_pago),
      metodo_pago: invoice.metodo_pago,
      metodo_pago_desc: getMetodoPagoDesc(invoice.metodo_pago),

      // CFDI stamps (if timbrada)
      sello_emisor: invoice.sello_emisor,
      sello_sat: invoice.sello_sat,
      cadena_original: invoice.cadena_original,
      certificado_sat: invoice.certificado_sat,

      // Status
      status: invoice.status,
      is_timbrada: invoice.status === 'timbrada',
      is_cancelada: invoice.status === 'cancelada',
    };
  }

  /**
   * Wrap HTML content with full document structure and styles
   */
  private wrapWithStyles(html: string, css: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura</title>
  <style>
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
  }

  /**
   * Convert HTML to PDF using PDFShift API
   */
  private async htmlToPDF(html: string): Promise<Buffer> {
    if (!this.pdfApiKey) {
      throw new Error('PDF API key not configured');
    }

    const response = await fetch(this.pdfApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${this.pdfApiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: html,
        landscape: false,
        format: 'Letter',
        margin: '20mm',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDF generation failed: ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Upload PDF to Supabase Storage
   */
  private async uploadPDF(
    pdfBuffer: Buffer,
    tenantId: string,
    filename: string
  ): Promise<string> {
    const path = `${tenantId}/invoices/${filename}`;

    const { error } = await this.supabase.storage
      .from('invoices')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    // Get public URL
    const { data } = this.supabase.storage
      .from('invoices')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Default HTML template (fallback)
   */
  private getDefaultTemplate(): string {
    return `
<div class="invoice-container">
  <div class="header">
    {{#if logo_url}}
    <img src="{{logo_url}}" alt="Logo" class="logo" />
    {{/if}}
    <div class="company-info">
      <h1>{{emisor_nombre}}</h1>
      <p>RFC: {{emisor_rfc}}</p>
      <p>Régimen Fiscal: {{emisor_regimen}}</p>
      <p>C.P.: {{emisor_cp}}</p>
    </div>
  </div>

  <div class="invoice-info">
    <h2>FACTURA</h2>
    <table>
      <tr><td>Serie:</td><td>{{serie}}</td></tr>
      <tr><td>Folio:</td><td>{{folio}}</td></tr>
      <tr><td>Fecha:</td><td>{{fecha_emision}}</td></tr>
      {{#if folio_fiscal}}
      <tr><td>UUID:</td><td class="uuid">{{folio_fiscal}}</td></tr>
      {{/if}}
    </table>
  </div>

  <div class="customer-info">
    <h3>DATOS DEL RECEPTOR</h3>
    <p><strong>{{receptor_nombre}}</strong></p>
    <p>RFC: {{receptor_rfc}}</p>
    <p>C.P.: {{receptor_codigo_postal}}</p>
    <p>Uso CFDI: {{receptor_uso_cfdi}}</p>
  </div>

  <div class="items">
    <table class="items-table">
      <thead>
        <tr>
          <th>Cantidad</th>
          <th>Descripción</th>
          <th>P. Unitario</th>
          <th>Importe</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{cantidad}}</td>
          <td>{{descripcion}}</td>
          <td>{{valor_unitario}}</td>
          <td>{{importe}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </div>

  <div class="totals">
    <table>
      <tr><td>Subtotal:</td><td>{{subtotal}}</td></tr>
      {{#if descuento}}
      <tr><td>Descuento:</td><td>-{{descuento}}</td></tr>
      {{/if}}
      <tr><td>IVA (16%):</td><td>{{iva_trasladado}}</td></tr>
      {{#if ieps_trasladado}}
      <tr><td>IEPS:</td><td>{{ieps_trasladado}}</td></tr>
      {{/if}}
      <tr class="total"><td>TOTAL:</td><td>{{total}} {{moneda}}</td></tr>
    </table>
  </div>

  <div class="payment-info">
    <p><strong>Forma de Pago:</strong> {{forma_pago_desc}}</p>
    <p><strong>Método de Pago:</strong> {{metodo_pago_desc}}</p>
  </div>

  {{#if is_timbrada}}
  <div class="sellos">
    <p class="small"><strong>Sello del Emisor:</strong></p>
    <p class="sello-text">{{sello_emisor}}</p>
    <p class="small"><strong>Sello del SAT:</strong></p>
    <p class="sello-text">{{sello_sat}}</p>
  </div>
  {{/if}}

  <div class="footer">
    <p>Este documento es una representación impresa de un CFDI</p>
    {{#if is_cancelada}}
    <p class="cancelled">FACTURA CANCELADA</p>
    {{/if}}
  </div>
</div>`;
  }

  /**
   * Default CSS styles (fallback)
   */
  private getDefaultStyles(): string {
    return `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; }
.invoice-container { max-width: 800px; margin: 0 auto; padding: 30px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e74c3c; }
.logo { max-height: 80px; max-width: 200px; }
.company-info h1 { font-size: 20px; color: #333; margin-bottom: 5px; }
.company-info p { font-size: 11px; color: #666; margin: 2px 0; }
.invoice-info { text-align: right; margin-bottom: 25px; }
.invoice-info h2 { font-size: 24px; color: #e74c3c; margin-bottom: 10px; }
.invoice-info table { margin-left: auto; }
.invoice-info td { padding: 3px 10px; font-size: 11px; }
.uuid { font-family: 'Courier New', monospace; font-size: 9px; word-break: break-all; max-width: 200px; }
.customer-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
.customer-info h3 { font-size: 12px; color: #666; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
.customer-info p { margin: 3px 0; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
.items-table th { background: #e74c3c; color: white; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.items-table td { padding: 10px; border-bottom: 1px solid #eee; }
.items-table tbody tr:nth-child(even) { background: #fafafa; }
.items-table tbody tr:hover { background: #f5f5f5; }
.totals { margin-left: auto; width: 300px; margin-bottom: 25px; }
.totals table { width: 100%; }
.totals td { padding: 8px 10px; }
.totals td:first-child { color: #666; }
.totals td:last-child { text-align: right; font-weight: 500; }
.totals .total { background: #333; color: white; font-size: 16px; }
.totals .total td { padding: 12px 10px; }
.payment-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 25px; }
.payment-info p { margin: 5px 0; }
.sellos { margin-top: 25px; padding-top: 20px; border-top: 1px dashed #ddd; }
.small { font-size: 9px; color: #666; margin-bottom: 3px; }
.sello-text { font-family: 'Courier New', monospace; font-size: 8px; background: #f5f5f5; padding: 8px; word-break: break-all; overflow-wrap: break-word; margin-bottom: 10px; border-radius: 4px; }
.footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 10px; }
.cancelled { color: #e74c3c; font-weight: bold; font-size: 14px; margin-top: 10px; }
@media print {
  body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .invoice-container { padding: 0; }
}`;
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: PDFGeneratorService | null = null;

export function getPDFGeneratorService(): PDFGeneratorService {
  if (!instance) {
    instance = new PDFGeneratorService();
  }
  return instance;
}
