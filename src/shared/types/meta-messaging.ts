// =====================================================
// TIS TIS PLATFORM - Meta Messaging Types
// Types for Instagram Direct & Facebook Messenger APIs
// Both use Meta Graph API with similar structures
// =====================================================

// ======================
// WEBHOOK PAYLOAD TYPES (Shared between IG and FB)
// ======================

export interface MetaWebhookPayload {
  object: 'instagram' | 'page'; // 'instagram' for IG, 'page' for FB Messenger
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // Page ID or Instagram Business Account ID
  time: number; // Unix timestamp
  messaging?: MetaMessagingEvent[];
  changes?: MetaChangeEvent[]; // For some webhook types
}

export interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: MetaMessage;
  postback?: MetaPostback;
  referral?: MetaReferral;
  reaction?: MetaReaction;
  read?: MetaRead;
  delivery?: MetaDelivery;
}

export interface MetaChangeEvent {
  field: string;
  value: Record<string, unknown>;
}

// ======================
// MESSAGE TYPES
// ======================

export interface MetaMessage {
  mid: string; // Message ID
  text?: string;
  attachments?: MetaAttachment[];
  quick_reply?: MetaQuickReply;
  reply_to?: {
    mid: string;
  };
  is_echo?: boolean;
  is_deleted?: boolean;
  is_unsupported?: boolean;
}

export interface MetaAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'location' | 'fallback' | 'story_mention' | 'story_reply';
  payload: MetaAttachmentPayload;
}

export interface MetaAttachmentPayload {
  url?: string;
  sticker_id?: number;
  coordinates?: {
    lat: number;
    long: number;
  };
  title?: string;
  // Story-specific fields (Instagram)
  story_url?: string;
  story_id?: string;
}

export interface MetaQuickReply {
  payload: string;
}

export interface MetaPostback {
  mid: string;
  title: string;
  payload: string;
  referral?: MetaReferral;
}

export interface MetaReferral {
  ref?: string;
  source?: string;
  type?: string;
  ad_id?: string;
}

export interface MetaReaction {
  mid: string;
  action: 'react' | 'unreact';
  reaction?: string; // Emoji or reaction type
  emoji?: string;
}

export interface MetaRead {
  watermark: number; // All messages before this timestamp were read
}

export interface MetaDelivery {
  mids: string[]; // Message IDs that were delivered
  watermark: number;
}

// ======================
// OUTBOUND MESSAGE TYPES
// ======================

export interface MetaOutboundMessage {
  recipient: {
    id: string;
  };
  messaging_type: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  message: MetaOutboundMessageContent;
  tag?: string; // Required if messaging_type is MESSAGE_TAG
}

export interface MetaOutboundMessageContent {
  text?: string;
  attachment?: MetaOutboundAttachment;
  quick_replies?: MetaOutboundQuickReply[];
}

export interface MetaOutboundAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'template';
  payload: {
    url?: string;
    is_reusable?: boolean;
    template_type?: string;
    elements?: Record<string, unknown>[];
  };
}

export interface MetaOutboundQuickReply {
  content_type: 'text' | 'user_phone_number' | 'user_email';
  title?: string;
  payload?: string;
  image_url?: string;
}

// ======================
// PARSED MESSAGE (Internal)
// ======================

export interface ParsedMetaMessage {
  platform: 'instagram' | 'facebook';
  senderId: string; // PSID (Page-Scoped ID)
  recipientId: string; // Page or IG Account ID
  messageId: string;
  timestamp: Date;
  type: MetaMessageType;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  isEcho: boolean;
  isReply: boolean;
  replyToMessageId?: string;
  metadata: {
    pageId: string;
    isStoryReply?: boolean;
    isStoryMention?: boolean;
    storyUrl?: string;
  };
}

export type MetaMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'sticker'
  | 'story_mention'
  | 'story_reply'
  | 'quick_reply'
  | 'postback'
  | 'reaction'
  | 'unsupported';

// ======================
// USER PROFILE (for getting user info)
// ======================

export interface MetaUserProfile {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  profile_pic?: string;
  username?: string; // Instagram only
}

// ======================
// INSTAGRAM SPECIFIC
// ======================

export interface InstagramIcebreaker {
  question: string;
  payload: string;
}

export interface InstagramStoryInsight {
  story_id: string;
  impressions: number;
  reach: number;
  replies: number;
}

// ======================
// FACEBOOK SPECIFIC
// ======================

export interface FacebookPersistentMenu {
  locale: string;
  composer_input_disabled: boolean;
  call_to_actions: FacebookMenuAction[];
}

export interface FacebookMenuAction {
  type: 'postback' | 'web_url' | 'nested';
  title: string;
  payload?: string;
  url?: string;
  webview_height_ratio?: 'compact' | 'tall' | 'full';
  call_to_actions?: FacebookMenuAction[];
}

// ======================
// CHANNEL CONNECTION EXTENSIONS
// ======================

export interface InstagramChannelConnection {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  channel: 'instagram';
  status: 'pending' | 'configuring' | 'connected' | 'disconnected' | 'error' | 'suspended';
  ai_enabled: boolean;
  instagram_page_id: string;
  instagram_account_id: string;
  instagram_username?: string;
  access_token: string;
  webhook_secret?: string;
}

export interface FacebookChannelConnection {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  channel: 'facebook';
  status: 'pending' | 'configuring' | 'connected' | 'disconnected' | 'error' | 'suspended';
  ai_enabled: boolean;
  facebook_page_id: string;
  facebook_page_name?: string;
  access_token: string;
  webhook_secret?: string;
}

// ======================
// JOB PAYLOADS
// ======================

export interface MetaSendMessageJobPayload {
  conversation_id: string;
  message_id: string;
  tenant_id: string;
  channel: 'instagram' | 'facebook';
  recipient_psid: string; // Page-Scoped User ID
  content: string;
  channel_connection_id: string;
}
