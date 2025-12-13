// =====================================================
// TIS TIS PLATFORM - TikTok Messaging Types
// Types for TikTok Business API Direct Messages
// Note: TikTok Business API is different from Meta Graph API
// =====================================================

// ======================
// WEBHOOK PAYLOAD TYPES
// ======================

export interface TikTokWebhookPayload {
  event: TikTokEventType;
  client_key: string;
  create_time: number; // Unix timestamp
  content: TikTokWebhookContent;
}

export type TikTokEventType =
  | 'direct_message.receive'
  | 'direct_message.send'
  | 'direct_message.read'
  | 'user.follow'
  | 'user.unfollow'
  | 'comment.create';

export interface TikTokWebhookContent {
  // For direct_message events
  open_id?: string; // User's open ID
  message_id?: string;
  message_type?: TikTokMessageType;
  message_content?: TikTokMessageContent;
  create_time?: number;

  // For user events
  from_user_open_id?: string;
  to_user_open_id?: string;

  // For comment events
  comment_id?: string;
  video_id?: string;
  comment_text?: string;
}

export type TikTokMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'sticker'
  | 'share'; // Shared TikTok video

export interface TikTokMessageContent {
  text?: string;
  media_id?: string;
  media_url?: string;
  sticker_id?: string;
  shared_video_id?: string;
  shared_video_url?: string;
}

// ======================
// OUTBOUND MESSAGE TYPES
// ======================

export interface TikTokOutboundMessage {
  open_id: string; // Recipient's open ID
  message_type: 'text' | 'image' | 'video';
  message_content: TikTokOutboundContent;
}

export interface TikTokOutboundContent {
  text?: string;
  media_id?: string; // For image/video, must be uploaded first
}

// ======================
// USER PROFILE
// ======================

export interface TikTokUserProfile {
  open_id: string;
  union_id?: string;
  display_name?: string;
  avatar_url?: string;
  avatar_large_url?: string;
  follower_count?: number;
  following_count?: number;
  likes_count?: number;
  video_count?: number;
  is_verified?: boolean;
  bio_description?: string;
  profile_deep_link?: string;
}

// ======================
// PARSED MESSAGE (Internal)
// ======================

export interface ParsedTikTokMessage {
  platform: 'tiktok';
  openId: string; // TikTok uses open_id instead of phone/email
  messageId: string;
  timestamp: Date;
  type: TikTokMessageType;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  metadata: {
    clientKey: string;
    isSharedVideo: boolean;
    sharedVideoId?: string;
  };
}

// ======================
// CHANNEL CONNECTION
// ======================

export interface TikTokChannelConnection {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  channel: 'tiktok';
  status: 'pending' | 'configuring' | 'connected' | 'disconnected' | 'error' | 'suspended';
  ai_enabled: boolean;
  tiktok_client_key: string;
  tiktok_client_secret?: string; // Encrypted
  tiktok_access_token?: string; // OAuth token
  tiktok_refresh_token?: string;
  tiktok_open_id?: string; // Business account open_id
  webhook_secret?: string;
}

// ======================
// API RESPONSE TYPES
// ======================

export interface TikTokAPIResponse<T = unknown> {
  error: {
    code: number;
    message: string;
    log_id?: string;
  };
  data: T;
}

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}

// ======================
// JOB PAYLOADS
// ======================

export interface TikTokSendMessageJobPayload {
  conversation_id: string;
  message_id: string;
  tenant_id: string;
  channel: 'tiktok';
  recipient_open_id: string;
  content: string;
  channel_connection_id: string;
}

// ======================
// RATE LIMITS & QUOTAS
// TikTok has strict rate limits
// ======================

export interface TikTokRateLimits {
  // Per user per day
  messages_per_user_per_day: 10;
  // Per business account per day
  total_messages_per_day: 1000;
  // API calls per minute
  api_calls_per_minute: 600;
}

// Note: TikTok has a 24-hour window for responding to user messages
// After 24 hours, you cannot send messages unless user initiates again
export const TIKTOK_MESSAGE_WINDOW_HOURS = 24;
