// =====================================================
// TIS TIS PLATFORM - WhatsApp Business API Client
// Ready for integration - requires API credentials
// =====================================================

const WHATSAPP_API_VERSION = 'v18.0';
const WHATSAPP_API_BASE_URL = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`;

// These will be set via environment variables
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

// ======================
// Types
// ======================
export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'audio' | 'location' | 'interactive';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: { code: string };
    components?: WhatsAppTemplateComponent[];
  };
  image?: {
    link?: string;
    id?: string;
    caption?: string;
  };
  document?: {
    link?: string;
    id?: string;
    filename?: string;
    caption?: string;
  };
  interactive?: {
    type: 'button' | 'list';
    header?: { type: string; text?: string };
    body: { text: string };
    footer?: { text: string };
    action: WhatsAppInteractiveAction;
  };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
    document?: { link: string };
  }>;
  sub_type?: string;
  index?: number;
}

export interface WhatsAppInteractiveAction {
  button?: string;
  buttons?: Array<{ type: 'reply'; reply: { id: string; title: string } }>;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

// ======================
// Client Class
// ======================
class WhatsAppClient {
  private phoneNumberId: string;
  private accessToken: string;
  private baseUrl: string;

  constructor() {
    this.phoneNumberId = WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = WHATSAPP_ACCESS_TOKEN;
    this.baseUrl = `${WHATSAPP_API_BASE_URL}/${this.phoneNumberId}`;
  }

  isConfigured(): boolean {
    return !!(this.phoneNumberId && this.accessToken);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('WhatsApp API is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp API Error]', error);
      throw new Error(error.error?.message || 'WhatsApp API request failed');
    }

    return response.json();
  }

  // ======================
  // Send Text Message
  // ======================
  async sendTextMessage(to: string, text: string): Promise<WhatsAppResponse> {
    const message: WhatsAppMessage = {
      to: this.normalizePhone(to),
      type: 'text',
      text: {
        body: text,
        preview_url: true,
      },
    };

    return this.sendMessage(message);
  }

  // ======================
  // Send Template Message
  // ======================
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'es_MX',
    components?: WhatsAppTemplateComponent[]
  ): Promise<WhatsAppResponse> {
    const message: WhatsAppMessage = {
      to: this.normalizePhone(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this.sendMessage(message);
  }

  // ======================
  // Send Interactive Buttons
  // ======================
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ): Promise<WhatsAppResponse> {
    const message: WhatsAppMessage = {
      to: this.normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: 'reply' as const,
            reply: { id: btn.id, title: btn.title.slice(0, 20) },
          })),
        },
      },
    };

    return this.sendMessage(message);
  }

  // ======================
  // Send Interactive List
  // ======================
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string
  ): Promise<WhatsAppResponse> {
    const message: WhatsAppMessage = {
      to: this.normalizePhone(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          button: buttonText.slice(0, 20),
          sections: sections.map((section) => ({
            title: section.title.slice(0, 24),
            rows: section.rows.slice(0, 10).map((row) => ({
              id: row.id,
              title: row.title.slice(0, 24),
              description: row.description?.slice(0, 72),
            })),
          })),
        },
      },
    };

    return this.sendMessage(message);
  }

  // ======================
  // Send Image
  // ======================
  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppResponse> {
    const message: WhatsAppMessage = {
      to: this.normalizePhone(to),
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    };

    return this.sendMessage(message);
  }

  // ======================
  // Send Document
  // ======================
  async sendDocument(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ): Promise<WhatsAppResponse> {
    const message: WhatsAppMessage = {
      to: this.normalizePhone(to),
      type: 'document',
      document: {
        link: documentUrl,
        filename,
        caption,
      },
    };

    return this.sendMessage(message);
  }

  // ======================
  // Send Location
  // ======================
  async sendLocation(
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<WhatsAppResponse> {
    const message = {
      to: this.normalizePhone(to),
      type: 'location',
      location: {
        latitude,
        longitude,
        name,
        address,
      },
    };

    return this.sendMessage(message as unknown as WhatsAppMessage);
  }

  // ======================
  // Core Send Message
  // ======================
  private async sendMessage(message: WhatsAppMessage): Promise<WhatsAppResponse> {
    return this.request<WhatsAppResponse>('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...message,
      }),
    });
  }

  // ======================
  // Mark Message as Read
  // ======================
  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/messages', {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  }

  // ======================
  // Get Media URL
  // ======================
  async getMediaUrl(mediaId: string): Promise<{ url: string }> {
    return this.request<{ url: string }>(`/${mediaId}`, {
      method: 'GET',
    });
  }

  // ======================
  // Helper: Normalize Phone
  // ======================
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Remove + if present
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }

    // Add Mexico country code if 10 digits
    if (normalized.length === 10) {
      normalized = `52${normalized}`;
    }

    return normalized;
  }
}

// ======================
// Export singleton instance
// ======================
export const whatsappClient = new WhatsAppClient();

// ======================
// ESVA-Specific Templates
// ======================
export const ESVA_TEMPLATES = {
  // Appointment confirmation
  APPOINTMENT_CONFIRMATION: 'cita_confirmada',

  // Appointment reminder (24h before)
  APPOINTMENT_REMINDER: 'recordatorio_cita',

  // Welcome message for new leads
  WELCOME_MESSAGE: 'bienvenida_esva',

  // Quote sent notification
  QUOTE_SENT: 'cotizacion_enviada',

  // Follow-up after no response
  FOLLOW_UP: 'seguimiento',
} as const;

// ======================
// Pre-built message helpers for ESVA
// ======================
export async function sendAppointmentConfirmation(
  phone: string,
  patientName: string,
  date: string,
  time: string,
  branchName: string,
  branchAddress: string
): Promise<WhatsAppResponse | null> {
  if (!whatsappClient.isConfigured()) {
    console.log('[WhatsApp] Not configured, skipping appointment confirmation');
    return null;
  }

  // Option 1: Use template
  // return whatsappClient.sendTemplateMessage(phone, ESVA_TEMPLATES.APPOINTMENT_CONFIRMATION, 'es_MX', [
  //   { type: 'body', parameters: [
  //     { type: 'text', text: patientName },
  //     { type: 'text', text: date },
  //     { type: 'text', text: time },
  //     { type: 'text', text: branchName },
  //   ]},
  // ]);

  // Option 2: Use text message (for development)
  const message = `✅ ¡Cita Confirmada!

Hola ${patientName},

Tu cita ha sido programada para:
📅 ${date}
🕐 ${time}
📍 ${branchName}
   ${branchAddress}

Si necesitas reagendar, responde a este mensaje.

ESVA Dental Clinic 🦷`;

  return whatsappClient.sendTextMessage(phone, message);
}

export async function sendAppointmentReminder(
  phone: string,
  patientName: string,
  date: string,
  time: string,
  branchName: string
): Promise<WhatsAppResponse | null> {
  if (!whatsappClient.isConfigured()) {
    console.log('[WhatsApp] Not configured, skipping appointment reminder');
    return null;
  }

  const message = `⏰ Recordatorio de Cita

Hola ${patientName},

Te recordamos tu cita mañana:
📅 ${date}
🕐 ${time}
📍 ${branchName}

¿Confirmas tu asistencia?`;

  return whatsappClient.sendButtonMessage(
    phone,
    message,
    [
      { id: 'confirm_yes', title: '✅ Confirmo' },
      { id: 'confirm_reschedule', title: '📅 Reagendar' },
      { id: 'confirm_cancel', title: '❌ Cancelar' },
    ]
  );
}

export async function sendServicesMenu(
  phone: string,
  patientName: string
): Promise<WhatsAppResponse | null> {
  if (!whatsappClient.isConfigured()) {
    console.log('[WhatsApp] Not configured, skipping services menu');
    return null;
  }

  return whatsappClient.sendListMessage(
    phone,
    `Hola ${patientName}, ¿en qué podemos ayudarte?`,
    'Ver servicios',
    [
      {
        title: '🦷 Servicios Dentales',
        rows: [
          { id: 'svc_general', title: 'Consulta General', description: 'Revisión y diagnóstico' },
          { id: 'svc_cleaning', title: 'Limpieza Dental', description: 'Profilaxis profesional' },
          { id: 'svc_whitening', title: 'Blanqueamiento', description: 'Dientes más blancos' },
          { id: 'svc_implants', title: 'Implantes', description: 'Soluciones permanentes' },
        ],
      },
      {
        title: '📅 Citas',
        rows: [
          { id: 'apt_schedule', title: 'Agendar Cita', description: 'Nueva cita' },
          { id: 'apt_reschedule', title: 'Reagendar', description: 'Cambiar fecha' },
          { id: 'apt_cancel', title: 'Cancelar', description: 'Cancelar cita' },
        ],
      },
      {
        title: '💰 Cotizaciones',
        rows: [
          { id: 'quote_request', title: 'Solicitar Cotización', description: 'Precios y opciones' },
        ],
      },
    ],
    '🦷 ESVA Dental',
    'Responde para más información'
  );
}
