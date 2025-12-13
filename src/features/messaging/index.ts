// =====================================================
// TIS TIS PLATFORM - Messaging Feature
// Multi-channel messaging services
// Supports: WhatsApp, Instagram, Facebook, TikTok
// =====================================================

// ======================
// WHATSAPP SERVICE
// ======================
export { WhatsAppService } from './services/whatsapp.service';
export {
  verifyWhatsAppSignature,
  normalizePhoneNumber,
  parseWhatsAppMessage,
  getTenantContext as getWhatsAppTenantContext,
  findOrCreateLead as findOrCreateWhatsAppLead,
  findOrCreateConversation as findOrCreateWhatsAppConversation,
  saveIncomingMessage as saveWhatsAppIncomingMessage,
  processStatusUpdate as processWhatsAppStatusUpdate,
  enqueueAIResponseJob as enqueueWhatsAppAIJob,
  enqueueSendMessageJob as enqueueWhatsAppSendJob,
  sendWhatsAppMessage,
  processWhatsAppWebhook,
} from './services/whatsapp.service';

// ======================
// META SERVICE (Instagram + Facebook)
// ======================
export { MetaService } from './services/meta.service';
export {
  verifyMetaSignature,
  parseMetaMessage,
  getMetaTenantContext,
  getMetaUserProfile,
  findOrCreateMetaLead,
  findOrCreateMetaConversation,
  saveMetaIncomingMessage,
  enqueueMetaAIJob,
  sendMetaMessage,
  processMetaWebhook,
} from './services/meta.service';

// ======================
// TIKTOK SERVICE
// ======================
export { TikTokService } from './services/tiktok.service';
export {
  verifyTikTokSignature,
  parseTikTokMessage,
  getTikTokTenantContext,
  getTikTokUserProfile,
  findOrCreateTikTokLead,
  findOrCreateTikTokConversation,
  saveTikTokIncomingMessage,
  enqueueTikTokAIJob,
  enqueueTikTokSendJob,
  sendTikTokMessage,
  processTikTokWebhook,
} from './services/tiktok.service';

// ======================
// WHATSAPP TYPES
// ======================
export type {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppContact,
  WhatsAppStatus,
  ParsedWhatsAppMessage,
  WhatsAppOutboundMessage,
  AIResponseJobPayload,
  SendMessageJobPayload,
  ChannelConnection,
} from '@/src/shared/types/whatsapp';

// ======================
// META TYPES (Instagram + Facebook)
// ======================
export type {
  MetaWebhookPayload,
  MetaWebhookEntry,
  MetaMessagingEvent,
  MetaMessage,
  MetaAttachment,
  ParsedMetaMessage,
  MetaMessageType,
  MetaUserProfile,
  MetaOutboundMessage,
  MetaSendMessageJobPayload,
  InstagramChannelConnection,
  FacebookChannelConnection,
} from '@/src/shared/types/meta-messaging';

// ======================
// TIKTOK TYPES
// ======================
export type {
  TikTokWebhookPayload,
  TikTokWebhookContent,
  TikTokMessageType,
  TikTokMessageContent,
  ParsedTikTokMessage,
  TikTokOutboundMessage,
  TikTokUserProfile,
  TikTokSendMessageJobPayload,
  TikTokChannelConnection,
  TikTokRateLimits,
} from '@/src/shared/types/tiktok-messaging';

// TIKTOK CONSTANTS
export { TIKTOK_MESSAGE_WINDOW_HOURS } from '@/src/shared/types/tiktok-messaging';
