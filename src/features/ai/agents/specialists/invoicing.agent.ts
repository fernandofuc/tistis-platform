// =====================================================
// TIS TIS PLATFORM - Restaurant Invoicing Agent
// Agente especializado en facturación CFDI vía WhatsApp
// Usa Gemini 2.0 Flash para extracción de tickets
// =====================================================

import { BaseAgent, type AgentResult } from './base.agent';
import type { TISTISAgentStateType } from '../../state';
import { createServerClient } from '@/src/shared/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ======================
// TYPES
// ======================

interface TicketData {
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  tax_amount: number;
  total: number;
  ticket_number?: string;
  date?: string;
  table_number?: string;
  server_name?: string;
  payment_method?: string;
  confidence: number;
}

interface FiscalData {
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  uso_cfdi: string;
  email: string;
  domicilio_fiscal?: string;
  codigo_postal: string;
}

interface InvoicingState {
  step: 'awaiting_ticket' | 'extracting' | 'awaiting_rfc' | 'awaiting_email' | 'awaiting_uso_cfdi' | 'confirming' | 'generating' | 'complete' | 'error';
  ticket_data?: TicketData;
  fiscal_data?: Partial<FiscalData>;
  media_id?: string;
  error_message?: string;
}

// ======================
// CFDI CONSTANTS
// ======================

const REGIMEN_FISCAL_OPTIONS: Record<string, string> = {
  '601': 'General de Ley Personas Morales',
  '603': 'Personas Morales con Fines no Lucrativos',
  '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606': 'Arrendamiento',
  '607': 'Régimen de Enajenación o Adquisición de Bienes',
  '608': 'Demás ingresos',
  '610': 'Residentes en el Extranjero sin EP en México',
  '611': 'Ingresos por Dividendos',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '614': 'Ingresos por intereses',
  '615': 'Régimen de los ingresos por obtención de premios',
  '616': 'Sin obligaciones fiscales',
  '620': 'Sociedades Cooperativas de Producción',
  '621': 'Incorporación Fiscal',
  '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  '623': 'Opcional para Grupos de Sociedades',
  '624': 'Coordinados',
  '625': 'Régimen de las ACES',
  '626': 'Régimen Simplificado de Confianza',
};

const USO_CFDI_OPTIONS: Record<string, string> = {
  'G01': 'Adquisición de mercancías',
  'G02': 'Devoluciones, descuentos o bonificaciones',
  'G03': 'Gastos en general',
  'I01': 'Construcciones',
  'I02': 'Mobiliario y equipo de oficina',
  'I03': 'Equipo de transporte',
  'I04': 'Equipo de cómputo',
  'I05': 'Dados, troqueles, moldes, matrices y herramental',
  'I06': 'Comunicaciones telefónicas',
  'I07': 'Comunicaciones satelitales',
  'I08': 'Otra maquinaria y equipo',
  'D01': 'Honorarios médicos, dentales y gastos hospitalarios',
  'D02': 'Gastos médicos por incapacidad o discapacidad',
  'D03': 'Gastos funerales',
  'D04': 'Donativos',
  'D05': 'Intereses reales pagados por créditos hipotecarios',
  'D06': 'Aportaciones voluntarias al SAR',
  'D07': 'Primas por seguros de gastos médicos',
  'D08': 'Gastos de transportación escolar obligatoria',
  'D09': 'Depósitos en cuentas para el ahorro',
  'D10': 'Pagos por servicios educativos',
  'S01': 'Sin efectos fiscales',
  'CP01': 'Pagos',
};

// ======================
// RFC VALIDATION
// ======================

function validateRFC(rfc: string): { valid: boolean; type: 'persona_fisica' | 'persona_moral' | null; error?: string } {
  const rfcUpper = rfc.toUpperCase().trim();

  // RFC Persona Física: 13 caracteres
  // RFC Persona Moral: 12 caracteres
  const personaFisicaRegex = /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/;
  const personaMoralRegex = /^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/;

  if (personaFisicaRegex.test(rfcUpper)) {
    return { valid: true, type: 'persona_fisica' };
  }

  if (personaMoralRegex.test(rfcUpper)) {
    return { valid: true, type: 'persona_moral' };
  }

  // RFC Genérico para público en general
  if (rfcUpper === 'XAXX010101000') {
    return { valid: true, type: 'persona_fisica' };
  }

  // RFC Extranjero
  if (rfcUpper === 'XEXX010101000') {
    return { valid: true, type: 'persona_fisica' };
  }

  return {
    valid: false,
    type: null,
    error: 'RFC inválido. Debe tener 12 caracteres (persona moral) o 13 caracteres (persona física).'
  };
}

// ======================
// GEMINI EXTRACTION
// ======================

async function extractTicketWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<TicketData> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `Analiza esta imagen de un ticket/recibo de restaurante y extrae los siguientes datos en formato JSON:

{
  "items": [
    {
      "description": "nombre del platillo/producto",
      "quantity": número,
      "unit_price": precio unitario en número,
      "total": precio total del item en número
    }
  ],
  "subtotal": número (suma antes de impuestos),
  "tax_amount": número (IVA u otros impuestos),
  "total": número (total final),
  "ticket_number": "número de ticket si visible",
  "date": "fecha en formato YYYY-MM-DD si visible",
  "table_number": "número de mesa si visible",
  "server_name": "nombre del mesero si visible",
  "payment_method": "método de pago si visible (efectivo, tarjeta, etc.)",
  "confidence": número entre 0 y 1 indicando qué tan seguro estás de la extracción
}

IMPORTANTE:
- Si no puedes leer algún valor, usa null
- Los precios deben ser números sin símbolo de moneda
- Si hay propinas incluidas, inclúyelas en el total pero no como item separado
- La confianza debe reflejar la legibilidad del ticket

Responde SOLO con el JSON, sin explicaciones adicionales.`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se pudo extraer información del ticket');
    }

    const parsed = JSON.parse(jsonMatch[0]) as TicketData;

    // Validate and sanitize
    return {
      items: parsed.items || [],
      subtotal: parsed.subtotal || 0,
      tax_amount: parsed.tax_amount || 0,
      total: parsed.total || 0,
      ticket_number: parsed.ticket_number || undefined,
      date: parsed.date || undefined,
      table_number: parsed.table_number || undefined,
      server_name: parsed.server_name || undefined,
      payment_method: parsed.payment_method || undefined,
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    console.error('[Invoicing Agent] Gemini extraction error:', error);
    throw new Error('No se pudo procesar la imagen del ticket. Por favor envía una foto más clara.');
  }
}

// ======================
// WHATSAPP MEDIA DOWNLOAD
// ======================

async function downloadWhatsAppMedia(
  mediaId: string,
  accessToken: string
): Promise<{ data: string; mimeType: string }> {
  // Get media URL
  const urlResponse = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!urlResponse.ok) {
    throw new Error('No se pudo obtener la URL del archivo');
  }

  const urlData = await urlResponse.json();
  const mediaUrl = urlData.url;
  const mimeType = urlData.mime_type || 'image/jpeg';

  // Download media
  const mediaResponse = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!mediaResponse.ok) {
    throw new Error('No se pudo descargar el archivo');
  }

  const buffer = await mediaResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return { data: base64, mimeType };
}

// ======================
// PDF GENERATION (Text-based for WhatsApp)
// ======================

function formatInvoiceText(
  ticketData: TicketData,
  fiscalData: FiscalData,
  emisorConfig: {
    rfc: string;
    razon_social: string;
    regimen_fiscal: string;
    domicilio: string;
  }
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX');
  const timeStr = now.toLocaleTimeString('es-MX');

  const itemsText = ticketData.items
    .map(i => `${i.quantity}x ${i.description}: $${i.total.toFixed(2)}`)
    .join('\n');

  return `
FACTURA
================

EMISOR:
RFC: ${emisorConfig.rfc}
${emisorConfig.razon_social}
Régimen: ${emisorConfig.regimen_fiscal}
${emisorConfig.domicilio}

RECEPTOR:
RFC: ${fiscalData.rfc}
${fiscalData.razon_social}
C.P.: ${fiscalData.codigo_postal}
Régimen: ${REGIMEN_FISCAL_OPTIONS[fiscalData.regimen_fiscal] || fiscalData.regimen_fiscal}
Uso CFDI: ${USO_CFDI_OPTIONS[fiscalData.uso_cfdi] || fiscalData.uso_cfdi}

Fecha: ${dateStr} ${timeStr}
Folio: ${ticketData.ticket_number || 'N/A'}

CONCEPTOS:
${itemsText}

----------------
Subtotal: $${ticketData.subtotal.toFixed(2)}
IVA (16%): $${ticketData.tax_amount.toFixed(2)}
TOTAL: $${ticketData.total.toFixed(2)} MXN

📧 El CFDI timbrado será enviado a: ${fiscalData.email}
`.trim();
}

// ======================
// CONVERSATION STATE MANAGEMENT
// Using secure RPCs that validate tenant ownership
// ======================

async function getInvoicingState(conversationId: string): Promise<InvoicingState | null> {
  const supabase = createServerClient();

  // Use secure RPC that validates conversation exists
  const { data, error } = await supabase.rpc('get_invoicing_state', {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.warn('[Invoicing Agent] Error getting state:', error.message);
    return null;
  }

  return data || null;
}

async function setInvoicingState(
  conversationId: string,
  state: InvoicingState
): Promise<void> {
  const supabase = createServerClient();

  // Use secure RPC that validates conversation exists
  const { error } = await supabase.rpc('set_invoicing_state', {
    p_conversation_id: conversationId,
    p_state: state,
  });

  if (error) {
    console.error('[Invoicing Agent] Error setting state:', error.message);
    throw new Error('Failed to save invoicing state');
  }
}

async function clearInvoicingState(conversationId: string): Promise<void> {
  const supabase = createServerClient();

  // Use secure RPC that validates conversation exists
  const { error } = await supabase.rpc('clear_invoicing_state', {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.error('[Invoicing Agent] Error clearing state:', error.message);
  }
}

// ======================
// INVOICING AGENT
// ======================

class InvoicingRestaurantAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'invoicing_restaurant',
      description: 'Agente de facturación CFDI para restaurantes vía WhatsApp',
      systemPromptTemplate: `Eres el asistente de facturación de {{TENANT_NAME}}.

# TU ROL
Ayudas a los clientes a obtener su factura CFDI a partir de su ticket de consumo.
El proceso es 100% por WhatsApp: el cliente envía foto del ticket y tú generas la factura.

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé claro y conciso
- Guía al cliente paso a paso

# PROCESO DE FACTURACIÓN
1. El cliente envía foto del ticket
2. Extraes los datos automáticamente
3. Solicitas RFC y datos fiscales
4. Generas y envías la factura por WhatsApp

# DATOS FISCALES REQUERIDOS
- RFC (12 o 13 caracteres)
- Razón Social
- Régimen Fiscal
- Uso CFDI
- Código Postal del domicilio fiscal
- Email para enviar el CFDI timbrado

# INSTRUCCIONES IMPORTANTES
- Valida el RFC antes de continuar
- Si el RFC es inválido, pide que lo corrija
- Para uso CFDI, sugiere G03 (Gastos en general) como opción común
- Si la imagen no es legible, pide otra foto más clara
- NUNCA almacenes datos fiscales, solo úsalos para generar la factura`,
      temperature: 0.3,
      maxTokens: 400,
      canHandoffTo: ['general', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const conversationId = state.conversation?.conversation_id;
    if (!conversationId) {
      return {
        response: 'Lo siento, no puedo procesar facturas en este momento. Por favor intenta más tarde.',
        tokens_used: 0,
      };
    }

    // Get or initialize invoicing state
    let invState = await getInvoicingState(conversationId);
    const message = state.current_message.toLowerCase();

    // Check if user wants to cancel
    if (message.includes('cancelar') || message.includes('olvidalo') || message.includes('no quiero')) {
      await clearInvoicingState(conversationId);
      return {
        response: 'Entendido, he cancelado el proceso de facturación. Si necesitas facturar más tarde, solo envíame la foto de tu ticket.',
        tokens_used: 0,
      };
    }

    // Initialize if no state
    if (!invState) {
      invState = { step: 'awaiting_ticket' };
    }

    // Route based on current step
    switch (invState.step) {
      case 'awaiting_ticket':
        return await this.handleAwaitingTicket(state, invState, conversationId);

      case 'awaiting_rfc':
        return await this.handleAwaitingRFC(state, invState, conversationId);

      case 'awaiting_email':
        return await this.handleAwaitingEmail(state, invState, conversationId);

      case 'awaiting_uso_cfdi':
        return await this.handleAwaitingUsoCFDI(state, invState, conversationId);

      case 'confirming':
        return await this.handleConfirming(state, invState, conversationId);

      default:
        // Reset and start over
        await setInvoicingState(conversationId, { step: 'awaiting_ticket' });
        return {
          response: 'Para comenzar con tu factura, por favor envíame una foto clara de tu ticket de consumo.',
          tokens_used: 0,
        };
    }
  }

  private async handleAwaitingTicket(
    state: TISTISAgentStateType,
    invState: InvoicingState,
    conversationId: string
  ): Promise<AgentResult> {
    // Check if there's an image in the message
    const supabase = createServerClient();

    // Get the latest message to check for media
    const { data: messageData } = await supabase
      .from('messages')
      .select('media_url, message_type, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!messageData || messageData.message_type !== 'image') {
      return {
        response: 'Para facturar tu consumo, por favor envíame una foto clara de tu ticket. Asegúrate de que se vean bien todos los conceptos y el total.',
        tokens_used: 0,
      };
    }

    // Get media ID from metadata
    const mediaId = messageData.media_url || messageData.metadata?.whatsapp_message_id;
    if (!mediaId) {
      return {
        response: 'No pude acceder a la imagen. Por favor envía nuevamente la foto de tu ticket.',
        tokens_used: 0,
      };
    }

    // Update state to extracting
    invState.step = 'extracting';
    invState.media_id = mediaId;
    await setInvoicingState(conversationId, invState);

    try {
      // Get WhatsApp access token from channel connection
      const { data: connection } = await supabase
        .from('channel_connections')
        .select('whatsapp_access_token')
        .eq('tenant_id', state.tenant?.tenant_id)
        .eq('channel', 'whatsapp')
        .eq('status', 'connected')
        .limit(1)
        .single();

      if (!connection?.whatsapp_access_token) {
        throw new Error('WhatsApp not configured');
      }

      // Download and process image
      const { data: imageBase64, mimeType } = await downloadWhatsAppMedia(
        mediaId,
        connection.whatsapp_access_token
      );

      // Extract ticket data with Gemini
      const ticketData = await extractTicketWithGemini(imageBase64, mimeType);

      if (ticketData.confidence < 0.3) {
        invState.step = 'awaiting_ticket';
        await setInvoicingState(conversationId, invState);
        return {
          response: 'No pude leer bien el ticket. Por favor envía una foto más clara donde se vean todos los conceptos y el total.',
          tokens_used: 0,
        };
      }

      // Save ticket data and move to next step
      invState.step = 'awaiting_rfc';
      invState.ticket_data = ticketData;
      await setInvoicingState(conversationId, invState);

      // Format items for confirmation
      const itemsList = ticketData.items
        .map(i => `• ${i.quantity}x ${i.description}: $${i.total.toFixed(2)}`)
        .join('\n');

      return {
        response: `He leído tu ticket:\n\n${itemsList}\n\nSubtotal: $${ticketData.subtotal.toFixed(2)}\nIVA: $${ticketData.tax_amount.toFixed(2)}\nTotal: $${ticketData.total.toFixed(2)}\n\nPara generar tu factura necesito tus datos fiscales. Por favor envíame tu RFC:`,
        tokens_used: 0,
      };
    } catch (error) {
      console.error('[Invoicing Agent] Extraction error:', error);
      invState.step = 'awaiting_ticket';
      await setInvoicingState(conversationId, invState);

      return {
        response: 'Hubo un problema al procesar la imagen. Por favor envía nuevamente una foto clara de tu ticket.',
        tokens_used: 0,
      };
    }
  }

  private async handleAwaitingRFC(
    state: TISTISAgentStateType,
    invState: InvoicingState,
    conversationId: string
  ): Promise<AgentResult> {
    const message = state.current_message.toUpperCase().trim();

    // Try to extract RFC from message
    const rfcMatch = message.match(/[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/);

    if (!rfcMatch) {
      return {
        response: 'No pude identificar un RFC válido. Por favor envíame solo tu RFC (ejemplo: XAXX010101000 o ABC123456XYZ).',
        tokens_used: 0,
      };
    }

    const rfc = rfcMatch[0];
    const validation = validateRFC(rfc);

    if (!validation.valid) {
      return {
        response: validation.error || 'RFC inválido. Por favor verifica y envíalo nuevamente.',
        tokens_used: 0,
      };
    }

    // Save RFC and ask for razón social
    invState.fiscal_data = invState.fiscal_data || {};
    invState.fiscal_data.rfc = rfc;

    // For persona física, ask for name. For moral, ask for razón social
    if (validation.type === 'persona_fisica') {
      invState.step = 'awaiting_email';
      await setInvoicingState(conversationId, invState);

      return {
        response: `RFC registrado: ${rfc}\n\nAhora envíame tu nombre completo como aparece en tu constancia de situación fiscal:`,
        tokens_used: 0,
      };
    } else {
      invState.step = 'awaiting_email';
      await setInvoicingState(conversationId, invState);

      return {
        response: `RFC registrado: ${rfc}\n\nAhora envíame la razón social de tu empresa como aparece en tu constancia de situación fiscal:`,
        tokens_used: 0,
      };
    }
  }

  private async handleAwaitingEmail(
    state: TISTISAgentStateType,
    invState: InvoicingState,
    conversationId: string
  ): Promise<AgentResult> {
    const message = state.current_message.trim();

    // Check if we're receiving razón social or email
    if (!invState.fiscal_data?.razon_social) {
      // This is the razón social
      if (message.length < 3) {
        return {
          response: 'Por favor envía tu nombre o razón social completo.',
          tokens_used: 0,
        };
      }

      invState.fiscal_data!.razon_social = message.toUpperCase();
      await setInvoicingState(conversationId, invState);

      return {
        response: 'Ahora necesito tu código postal del domicilio fiscal (5 dígitos):',
        tokens_used: 0,
      };
    }

    // Check if we're receiving código postal
    if (!invState.fiscal_data?.codigo_postal) {
      const cpMatch = message.match(/\d{5}/);
      if (!cpMatch) {
        return {
          response: 'Por favor envía un código postal válido de 5 dígitos.',
          tokens_used: 0,
        };
      }

      invState.fiscal_data!.codigo_postal = cpMatch[0];
      await setInvoicingState(conversationId, invState);

      return {
        response: '¿Cuál es tu régimen fiscal? Puedes decirme el número o nombre:\n\n• 612 - Actividades Empresariales y Profesionales\n• 621 - Incorporación Fiscal\n• 626 - Régimen Simplificado de Confianza (RESICO)\n• 601 - General de Ley Personas Morales',
        tokens_used: 0,
      };
    }

    // Check if we're receiving régimen fiscal
    if (!invState.fiscal_data?.regimen_fiscal) {
      // Try to match regime number
      const regimenMatch = message.match(/\d{3}/);
      if (regimenMatch && REGIMEN_FISCAL_OPTIONS[regimenMatch[0]]) {
        invState.fiscal_data!.regimen_fiscal = regimenMatch[0];
      } else if (message.toLowerCase().includes('resico') || message.includes('626')) {
        invState.fiscal_data!.regimen_fiscal = '626';
      } else if (message.toLowerCase().includes('empresarial') || message.includes('612')) {
        invState.fiscal_data!.regimen_fiscal = '612';
      } else if (message.toLowerCase().includes('moral') || message.includes('601')) {
        invState.fiscal_data!.regimen_fiscal = '601';
      } else {
        return {
          response: 'No reconocí el régimen fiscal. Por favor envía el número (ej: 612, 626) o menciona "RESICO", "empresarial", etc.',
          tokens_used: 0,
        };
      }

      invState.step = 'awaiting_uso_cfdi';
      await setInvoicingState(conversationId, invState);

      return {
        response: '¿Para qué usarás esta factura?\n\n• G03 - Gastos en general (más común)\n• G01 - Adquisición de mercancías\n• D01 - Gastos médicos\n• S01 - Sin efectos fiscales',
        tokens_used: 0,
      };
    }

    // Receiving email
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/i);
    if (!emailMatch) {
      return {
        response: 'Por favor envía una dirección de correo electrónico válida donde recibirás tu CFDI.',
        tokens_used: 0,
      };
    }

    invState.fiscal_data!.email = emailMatch[0].toLowerCase();
    invState.step = 'confirming';
    await setInvoicingState(conversationId, invState);

    // Show confirmation
    const fiscal = invState.fiscal_data!;
    return {
      response: `Por favor confirma tus datos:\n\n• RFC: ${fiscal.rfc}\n• Nombre: ${fiscal.razon_social}\n• C.P.: ${fiscal.codigo_postal}\n• Régimen: ${REGIMEN_FISCAL_OPTIONS[fiscal.regimen_fiscal!]}\n• Uso CFDI: ${USO_CFDI_OPTIONS[fiscal.uso_cfdi!]}\n• Email: ${fiscal.email}\n\n¿Son correctos? Responde "sí" para generar tu factura o indica qué dato corregir.`,
      tokens_used: 0,
    };
  }

  private async handleAwaitingUsoCFDI(
    state: TISTISAgentStateType,
    invState: InvoicingState,
    conversationId: string
  ): Promise<AgentResult> {
    const message = state.current_message.toLowerCase();

    // Match uso CFDI
    let usoCfdi: string | null = null;

    if (message.includes('g03') || message.includes('gastos en general') || message.includes('general')) {
      usoCfdi = 'G03';
    } else if (message.includes('g01') || message.includes('mercancías') || message.includes('mercancias')) {
      usoCfdi = 'G01';
    } else if (message.includes('d01') || message.includes('médico') || message.includes('medico')) {
      usoCfdi = 'D01';
    } else if (message.includes('s01') || message.includes('sin efectos')) {
      usoCfdi = 'S01';
    } else {
      // Try to match code directly
      const codeMatch = message.toUpperCase().match(/[GIDS]\d{2}/);
      if (codeMatch && USO_CFDI_OPTIONS[codeMatch[0]]) {
        usoCfdi = codeMatch[0];
      }
    }

    if (!usoCfdi) {
      return {
        response: 'No reconocí el uso de CFDI. Por favor responde con el código (G03, G01, D01, S01) o describe el uso.',
        tokens_used: 0,
      };
    }

    invState.fiscal_data!.uso_cfdi = usoCfdi;
    await setInvoicingState(conversationId, invState);

    return {
      response: 'Por último, envíame tu correo electrónico donde recibirás el CFDI timbrado:',
      tokens_used: 0,
    };
  }

  private async handleConfirming(
    state: TISTISAgentStateType,
    invState: InvoicingState,
    conversationId: string
  ): Promise<AgentResult> {
    const message = state.current_message.toLowerCase();

    // Check for confirmation
    if (message.includes('sí') || message.includes('si') || message.includes('correcto') || message.includes('ok') || message.includes('confirmo')) {
      // Generate invoice
      invState.step = 'generating';
      await setInvoicingState(conversationId, invState);

      try {
        // Get emisor config
        const supabase = createServerClient();
        const { data: config } = await supabase
          .from('restaurant_invoice_config')
          .select('*')
          .eq('tenant_id', state.tenant?.tenant_id)
          .single();

        if (!config) {
          throw new Error('Configuración de facturación no encontrada');
        }

        // Generate invoice text (for WhatsApp message)
        const invoiceText = formatInvoiceText(
          invState.ticket_data!,
          invState.fiscal_data as FiscalData,
          {
            rfc: (config as Record<string, unknown>).rfc as string || '',
            razon_social: (config as Record<string, unknown>).razon_social as string || '',
            regimen_fiscal: (config as Record<string, unknown>).regimen_fiscal as string || '',
            domicilio: (config as Record<string, unknown>).domicilio_fiscal as string || '',
          }
        );

        // Clear state
        await clearInvoicingState(conversationId);

        // Return the invoice as a formatted text message
        // In production, you would also:
        // 1. Queue for actual CFDI timbrado via PAC
        // 2. Send PDF via WhatsApp document API
        // 3. Send CFDI to customer email

        return {
          response: `¡Tu pre-factura ha sido generada!\n\n${invoiceText}\n\n📧 El CFDI timbrado será enviado a tu correo en los próximos minutos.\n\nSi necesitas otra factura, solo envíame la foto del ticket.`,
          tokens_used: 0,
        };
      } catch (error) {
        console.error('[Invoicing Agent] PDF generation error:', error);
        invState.step = 'confirming';
        await setInvoicingState(conversationId, invState);

        return {
          response: 'Hubo un problema al generar tu factura. Por favor intenta nuevamente respondiendo "sí" para confirmar.',
          tokens_used: 0,
        };
      }
    }

    // Check for corrections
    if (message.includes('rfc') || message.includes('corregir')) {
      invState.step = 'awaiting_rfc';
      invState.fiscal_data = {};
      await setInvoicingState(conversationId, invState);

      return {
        response: 'Entendido, empecemos de nuevo. Por favor envíame tu RFC:',
        tokens_used: 0,
      };
    }

    return {
      response: 'Por favor responde "sí" para confirmar y generar tu factura, o indica qué dato deseas corregir.',
      tokens_used: 0,
    };
  }
}

// Singleton instance
export const InvoicingRestaurantAgent = new InvoicingRestaurantAgentClass();

// LangGraph node
export const invoicingRestaurantNode = InvoicingRestaurantAgent.toNode();
