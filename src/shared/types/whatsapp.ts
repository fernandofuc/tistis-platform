// =====================================================
// TIS TIS PLATFORM - WhatsApp Types
// Types for WhatsApp Business API integration
// =====================================================

// ======================
// WEBHOOK PAYLOAD TYPES
// ======================

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: 'messages' | 'message_template_status_update';
}

export interface WhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

// ======================
// MESSAGE TYPES
// ======================

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: WhatsAppTextMessage;
  image?: WhatsAppMediaMessage;
  audio?: WhatsAppMediaMessage;
  video?: WhatsAppMediaMessage;
  document?: WhatsAppDocumentMessage;
  location?: WhatsAppLocationMessage;
  contacts?: WhatsAppContactMessage[];
  interactive?: WhatsAppInteractiveMessage;
  button?: WhatsAppButtonMessage;
  context?: WhatsAppMessageContext;
}

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'sticker'
  | 'unknown';

export interface WhatsAppTextMessage {
  body: string;
}

export interface WhatsAppMediaMessage {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppDocumentMessage extends WhatsAppMediaMessage {
  filename?: string;
}

export interface WhatsAppLocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppContactMessage {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: Array<{
    phone: string;
    type: string;
  }>;
}

export interface WhatsAppInteractiveMessage {
  type: 'button_reply' | 'list_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface WhatsAppButtonMessage {
  text: string;
  payload: string;
}

export interface WhatsAppMessageContext {
  from: string;
  id: string;
}

// ======================
// STATUS TYPES
// ======================

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: {
      type: string;
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: WhatsAppError[];
}

export interface WhatsAppError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
  };
}

// ======================
// OUTBOUND MESSAGE TYPES
// ======================

export interface WhatsAppOutboundMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'image' | 'document' | 'template' | 'interactive';
  text?: {
    preview_url?: boolean;
    body: string;
  };
  template?: WhatsAppTemplateMessage;
  interactive?: WhatsAppInteractiveOutbound;
}

export interface WhatsAppTemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: Array<{
    type: 'text' | 'image' | 'document';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename: string };
  }>;
  sub_type?: 'quick_reply' | 'url';
  index?: string;
}

export interface WhatsAppInteractiveOutbound {
  type: 'button' | 'list';
  header?: {
    type: 'text' | 'image';
    text?: string;
    image?: { link: string };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons?: Array<{
      type: 'reply';
      reply: {
        id: string;
        title: string;
      };
    }>;
    button?: string;
    sections?: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
}

// ======================
// PARSED MESSAGE (Internal)
// ======================

export interface ParsedWhatsAppMessage {
  phone: string;
  phoneNormalized: string;
  messageId: string;
  timestamp: Date;
  type: WhatsAppMessageType;
  content: string;
  mediaId?: string;
  mediaType?: string;
  contactName?: string;
  metadata: {
    phoneNumberId: string;
    displayPhoneNumber: string;
    isReply: boolean;
    replyToMessageId?: string;
  };
}

// ======================
// AI RESPONSE FORMAT
// ======================

export interface AIResponseFormat {
  response: string;
  intent: AIIntent;
  signals: AISignal[];
  escalate: boolean;
  escalateReason?: string;
}

export type AIIntent =
  | 'GREETING'
  | 'PRICE_INQUIRY'
  | 'BOOK_APPOINTMENT'
  | 'PAIN_URGENT'
  | 'HUMAN_REQUEST'
  | 'LOCATION'
  | 'HOURS'
  | 'FAQ'
  | 'INVOICE_REQUEST'
  | 'UNKNOWN';

export interface AISignal {
  signal: string;
  points: number;
}

// ======================
// JOB QUEUE TYPES
// ======================

export interface AIResponseJobPayload {
  conversation_id: string;
  message_id: string;
  lead_id: string;
  tenant_id: string;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
  channel_connection_id?: string;
  // Per-channel AI configuration
  ai_personality_override?: 'professional' | 'professional_friendly' | 'casual' | 'formal' | null;
  custom_instructions_override?: string | null;
  is_first_message?: boolean; // To determine which delay to use
}

export interface SendMessageJobPayload {
  conversation_id: string;
  message_id: string;
  tenant_id: string;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok';
  recipient_phone: string;
  content: string;
  channel_connection_id: string;
}

// ======================
// CHANNEL CONNECTION TYPES
// ======================

export interface ChannelConnection {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat';
  status: 'pending' | 'configuring' | 'connected' | 'disconnected' | 'error' | 'suspended';
  ai_enabled: boolean;

  // Multi-account support
  account_number?: 1 | 2;
  account_name?: string;
  is_personal_brand?: boolean;

  // Per-channel AI configuration
  ai_personality_override?: 'professional' | 'professional_friendly' | 'casual' | 'formal' | null;
  first_message_delay_seconds?: number;
  subsequent_message_delay_seconds?: number;
  custom_instructions_override?: string | null;

  // WhatsApp specific
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_access_token?: string;
  whatsapp_verify_token?: string;
  webhook_secret?: string;

  // Instagram specific
  instagram_page_id?: string;
  instagram_account_id?: string;
  instagram_access_token?: string;

  // Facebook specific
  facebook_page_id?: string;
  facebook_access_token?: string;

  // TikTok specific
  tiktok_client_key?: string;
  tiktok_client_secret?: string;
  tiktok_access_token?: string;
}
