/**
 * TIS TIS Platform - Voice Agent v2.0
 * Common Tool: Request Invoice (Facturación)
 *
 * Handles invoice (CFDI) requests for Mexican businesses.
 * Critical for compliance with SAT regulations.
 *
 * CFDI Use Codes Reference:
 * - G01: Adquisición de mercancías
 * - G02: Devoluciones, descuentos o bonificaciones
 * - G03: Gastos en general
 * - P01: Por definir
 * - D01-D10: Deducciones personales
 * - I01-I08: Inversiones
 * - CP01: Pagos
 * - CN01: Nómina
 * - S01: Sin efectos fiscales
 */

import type {
  ToolDefinition,
  ToolContext,
  InvoiceResult,
  RequestInvoiceParams,
} from '../types';

// =====================================================
// CFDI USE CODES MAPPING
// =====================================================

const CFDI_USE_NAMES: Record<string, { es: string; en: string }> = {
  G01: { es: 'Adquisición de mercancías', en: 'Merchandise acquisition' },
  G02: { es: 'Devoluciones, descuentos o bonificaciones', en: 'Returns, discounts or bonuses' },
  G03: { es: 'Gastos en general', en: 'General expenses' },
  P01: { es: 'Por definir', en: 'To be defined' },
  D01: { es: 'Honorarios médicos, dentales y gastos hospitalarios', en: 'Medical and dental fees' },
  D02: { es: 'Gastos médicos por incapacidad o discapacidad', en: 'Medical expenses for disability' },
  D03: { es: 'Gastos funerales', en: 'Funeral expenses' },
  D04: { es: 'Donativos', en: 'Donations' },
  D05: { es: 'Intereses reales efectivamente pagados por créditos hipotecarios', en: 'Mortgage interest' },
  D06: { es: 'Aportaciones voluntarias al SAR', en: 'Voluntary SAR contributions' },
  D07: { es: 'Primas por seguros de gastos médicos', en: 'Medical insurance premiums' },
  D08: { es: 'Gastos de transportación escolar obligatoria', en: 'School transportation expenses' },
  D09: { es: 'Depósitos en cuentas para el ahorro', en: 'Savings account deposits' },
  D10: { es: 'Pagos por servicios educativos', en: 'Educational services payments' },
  I01: { es: 'Construcciones', en: 'Constructions' },
  I02: { es: 'Mobiliario y equipo de oficina', en: 'Office furniture and equipment' },
  I03: { es: 'Equipo de transporte', en: 'Transportation equipment' },
  I04: { es: 'Equipo de cómputo y accesorios', en: 'Computer equipment and accessories' },
  I05: { es: 'Dados, troqueles, moldes, matrices y herramental', en: 'Dies, molds, and tooling' },
  I06: { es: 'Comunicaciones telefónicas', en: 'Telephone communications' },
  I07: { es: 'Comunicaciones satelitales', en: 'Satellite communications' },
  I08: { es: 'Otra maquinaria y equipo', en: 'Other machinery and equipment' },
  CP01: { es: 'Pagos', en: 'Payments' },
  CN01: { es: 'Nómina', en: 'Payroll' },
  S01: { es: 'Sin efectos fiscales', en: 'No tax effects' },
};

// =====================================================
// TOOL DEFINITION
// =====================================================

export const requestInvoice: ToolDefinition<RequestInvoiceParams> = {
  name: 'request_invoice',
  description: 'Solicita una factura (CFDI) para una compra realizada',
  category: 'billing',

  parameters: {
    type: 'object',
    properties: {
      rfc: {
        type: 'string',
        description: 'RFC del cliente (13 caracteres para persona física, 12 para moral)',
        minLength: 12,
        maxLength: 13,
      },
      businessName: {
        type: 'string',
        description: 'Razón social del cliente',
        minLength: 3,
      },
      cfdiUse: {
        type: 'string',
        description: 'Uso del CFDI (ej: G03 para gastos en general)',
        enum: [
          'G01', 'G02', 'G03', 'P01',
          'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
          'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08',
          'CP01', 'CN01', 'S01',
        ],
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Correo electrónico para enviar la factura',
      },
      fiscalPostalCode: {
        type: 'string',
        description: 'Código postal del domicilio fiscal',
        minLength: 5,
        maxLength: 5,
      },
      fiscalRegime: {
        type: 'string',
        description: 'Régimen fiscal del cliente',
      },
      ticketNumber: {
        type: 'string',
        description: 'Número de ticket o folio de la compra',
      },
      purchaseDate: {
        type: 'string',
        format: 'date',
        description: 'Fecha de la compra (YYYY-MM-DD)',
      },
      totalAmount: {
        type: 'number',
        description: 'Monto total de la compra',
        minimum: 0,
      },
    },
    required: ['rfc', 'businessName', 'cfdiUse', 'email'],
  },

  requiredCapabilities: ['invoicing'],
  requiresConfirmation: true,
  enabledFor: ['rest_basic', 'rest_standard', 'rest_complete', 'dental_basic', 'dental_standard', 'dental_complete'],
  timeout: 15000,

  confirmationMessage: (params) => {
    const cfdiName = CFDI_USE_NAMES[params.cfdiUse]?.es || params.cfdiUse;
    return `Voy a solicitar una factura a nombre de ${params.businessName} con RFC ${params.rfc}, uso de CFDI "${cfdiName}", y se enviará a ${params.email}. ¿Es correcto?`;
  },

  handler: async (params, context): Promise<InvoiceResult> => {
    const {
      rfc,
      businessName,
      cfdiUse,
      email,
      fiscalPostalCode,
      fiscalRegime,
      ticketNumber,
      purchaseDate,
      totalAmount,
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      // Validate RFC format
      const rfcValidation = validateRFC(rfc);
      if (!rfcValidation.valid) {
        return {
          success: false,
          error: 'Invalid RFC',
          errorCode: 'INVALID_RFC',
          voiceMessage: locale === 'en'
            ? `The RFC ${rfc} appears to be invalid. ${rfcValidation.message} Could you please verify it?`
            : `El RFC ${rfc} parece no ser válido. ${rfcValidation.message} ¿Podría verificarlo por favor?`,
        };
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return {
          success: false,
          error: 'Invalid email',
          errorCode: 'INVALID_EMAIL',
          voiceMessage: locale === 'en'
            ? 'The email address appears to be invalid. Could you please verify it?'
            : 'El correo electrónico parece no ser válido. ¿Podría verificarlo por favor?',
        };
      }

      // Generate request ID
      const requestId = generateInvoiceRequestId();

      // Store invoice request in database
      const { data: invoiceRequest, error: insertError } = await supabase
        .from('invoice_requests')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId || null,
          request_id: requestId,
          rfc: rfc.toUpperCase().trim(),
          business_name: businessName.trim(),
          cfdi_use: cfdiUse,
          email: email.toLowerCase().trim(),
          fiscal_postal_code: fiscalPostalCode || null,
          fiscal_regime: fiscalRegime || null,
          ticket_number: ticketNumber || null,
          purchase_date: purchaseDate || null,
          total_amount: totalAmount || null,
          status: 'pending',
          source: channel,
          source_call_id: callId,
          created_at: new Date().toISOString(),
        })
        .select('id, request_id, status')
        .single();

      if (insertError) {
        console.error('[RequestInvoice] Insert error:', insertError);

        // Check for specific errors
        if (insertError.message?.includes('duplicate')) {
          return {
            success: false,
            error: 'Duplicate request',
            errorCode: 'DUPLICATE',
            voiceMessage: locale === 'en'
              ? 'It looks like an invoice request for this ticket already exists. Would you like me to check its status?'
              : 'Parece que ya existe una solicitud de factura para este ticket. ¿Le gustaría que verifique su estatus?',
          };
        }

        return {
          success: false,
          error: insertError.message,
          errorCode: 'INSERT_ERROR',
          voiceMessage: locale === 'en'
            ? 'There was a problem submitting your invoice request. Please try again.'
            : 'Hubo un problema al enviar su solicitud de factura. Por favor intente de nuevo.',
        };
      }

      // Get CFDI use name for voice message
      const cfdiUseName = CFDI_USE_NAMES[cfdiUse]?.[locale === 'en' ? 'en' : 'es'] || cfdiUse;

      // Format success message
      const voiceMessage = locale === 'en'
        ? `Your invoice request has been submitted successfully. The invoice will be sent to ${email} within the next 24 to 48 hours. Your request number is ${requestId}. Is there anything else I can help you with?`
        : `Su solicitud de factura ha sido enviada exitosamente. La factura será enviada a ${email} dentro de las próximas 24 a 48 horas. Su número de solicitud es ${requestId}. ¿Hay algo más en que pueda ayudarle?`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          invoiceRequestId: invoiceRequest.id,
          status: 'pending',
          estimatedTime: '24-48 horas',
          ticketNumber: ticketNumber || undefined,
        },
        metadata: {
          requestId,
          rfc: rfc.toUpperCase(),
          businessName,
          cfdiUse,
          cfdiUseName,
          email,
        },
      };
    } catch (error) {
      console.error('[RequestInvoice] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't process your invoice request. Please try again or contact us directly."
          : 'Lo siento, no pude procesar su solicitud de factura. Por favor intente de nuevo o contáctenos directamente.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Validate Mexican RFC format
 */
function validateRFC(rfc: string): { valid: boolean; message: string } {
  const cleanRFC = rfc.toUpperCase().trim();

  // RFC length must be 12 (moral) or 13 (física)
  if (cleanRFC.length !== 12 && cleanRFC.length !== 13) {
    return {
      valid: false,
      message: 'El RFC debe tener 12 o 13 caracteres.',
    };
  }

  // RFC pattern: 3-4 letters + 6 digits (date) + 3 alphanumeric (homoclave)
  // Persona moral: XXX000000XXX (12 chars)
  // Persona física: XXXX000000XXX (13 chars)
  const rfcPattern = cleanRFC.length === 13
    ? /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/
    : /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;

  if (!rfcPattern.test(cleanRFC)) {
    return {
      valid: false,
      message: 'El formato del RFC no es válido.',
    };
  }

  // Validate date portion (positions vary by type)
  const dateStart = cleanRFC.length === 13 ? 4 : 3;
  const dateStr = cleanRFC.substring(dateStart, dateStart + 6);
  const year = parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);

  if (month < 1 || month > 12) {
    return {
      valid: false,
      message: 'El mes en el RFC no es válido.',
    };
  }

  if (day < 1 || day > 31) {
    return {
      valid: false,
      message: 'El día en el RFC no es válido.',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Generate unique invoice request ID
 */
function generateInvoiceRequestId(): string {
  const prefix = 'FAC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${timestamp}${random}`;
}

export default requestInvoice;
