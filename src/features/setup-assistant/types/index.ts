// =====================================================
// TIS TIS PLATFORM - Setup Assistant Types
// Sprint 5: AI-powered configuration assistant
// =====================================================

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

export type ConversationStatus = 'active' | 'completed' | 'archived';

export type MessageRole = 'user' | 'assistant' | 'system';

export type SetupModule =
  | 'general'
  | 'loyalty'
  | 'agents'
  | 'knowledge_base'
  | 'services'
  | 'promotions'
  | 'staff'
  | 'branches';

export type ModuleProgress = 'pending' | 'in_progress' | 'completed';

export type ActionType = 'create' | 'update' | 'delete' | 'configure';

export type ActionStatus = 'pending' | 'success' | 'failure';

export type AttachmentType = 'image' | 'document' | 'file';

// =====================================================
// DATABASE TYPES (matching Supabase schema)
// =====================================================

/**
 * Represents a conversation session in the setup assistant
 * Maps to: setup_assistant_conversations table
 */
export interface SetupConversation {
  id: string;
  tenantId: string;
  userId: string;
  status: ConversationStatus;
  currentModule: SetupModule | null;
  setupProgress: Record<SetupModule, ModuleProgress>;
  title: string | null;
  summary: string | null;
  startedAt: string;
  lastMessageAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents a single message in a conversation
 * Maps to: setup_assistant_messages table
 */
export interface SetupMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  role: MessageRole;
  content: string;
  attachments: MessageAttachment[];
  actionsTaken: MessageAction[];
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

/**
 * Represents a file attachment on a message
 */
export interface MessageAttachment {
  type: AttachmentType;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  analysis?: VisionAnalysis;
}

/**
 * Represents an action executed by the assistant
 */
export interface MessageAction {
  type: ActionType;
  module: SetupModule | string;
  entityType: string;
  entityId?: string;
  status: ActionStatus;
  details?: Record<string, unknown>;
}

/**
 * Represents the result of Gemini Vision analysis
 */
export interface VisionAnalysis {
  description: string;
  extractedData: Record<string, unknown>;
  confidence: number;
  suggestions: string[];
}

/**
 * Daily usage record for a tenant
 * Maps to: setup_assistant_usage table
 */
export interface SetupUsage {
  id: string;
  tenantId: string;
  usageDate: string;
  messagesCount: number;
  filesUploaded: number;
  visionRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

/**
 * Request to create a new conversation
 */
export interface CreateConversationRequest {
  initialMessage?: string;
  module?: SetupModule;
}

/**
 * Response when creating a conversation
 */
export interface CreateConversationResponse {
  conversation: SetupConversation;
  initialResponse?: SetupMessage;
}

/**
 * Simplified attachment for request (from UploadResponse)
 */
export interface SendMessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type?: AttachmentType;
}

/**
 * Request to send a message
 */
export interface SendMessageRequest {
  content: string;
  attachments?: SendMessageAttachment[];  // Objects from /upload response
}

/**
 * Response after sending a message
 */
export interface SendMessageResponse {
  userMessage: SetupMessage;
  assistantMessage: SetupMessage;
  usage: UsageInfo;
}

/**
 * Request to analyze an image
 */
export interface AnalyzeImageRequest {
  imageUrl: string;
  context?: string;
  module?: SetupModule;
}

/**
 * Response from image analysis
 */
export interface AnalyzeImageResponse {
  analysis: VisionAnalysis;
  usage: UsageInfo;
}

/**
 * Response from file upload
 */
export interface UploadResponse {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Usage information with limits
 * Returned by get_setup_usage_with_limits RPC
 */
export interface UsageInfo {
  messagesCount: number;
  messagesLimit: number;
  filesUploaded: number;
  filesLimit: number;
  visionRequests: number;
  visionLimit: number;
  totalTokens?: number;
  tokensLimit?: number;
  planId: string;
  planName?: string;
  isAtLimit: boolean;
  /** Note: Serialized as ISO string in JSON responses, converted to Date on server */
  resetAt?: Date | string;
}

/**
 * Detailed usage info with percentages and tokens
 * Extended from UsageInfo for UI display
 */
export interface DetailedUsageInfo extends UsageInfo {
  tokensUsed: number;
  tokensLimit: number;
  percentages: {
    messages: number;
    files: number;
    vision: number;
    tokens: number;
  };
}

// =====================================================
// LANGGRAPH STATE TYPES
// =====================================================

/**
 * Business context loaded for the agent
 */
export interface SetupContext {
  tenantId: string;
  userId: string;
  vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym';
  tenantConfig: {
    name: string;
    timezone: string;
    businessHours: Record<string, { open: string; close: string }>;
    policies: Record<string, string>;
  };
  loyaltyConfigured: boolean;
  agentsConfigured: boolean;
  knowledgeBaseConfigured: boolean;
  servicesConfigured: boolean;
  promotionsConfigured: boolean;
  existingServices: Array<{ id: string; name: string; price: number }>;
  existingFaqs: Array<{ id: string; question: string }>;
  existingLoyaltyProgram: { id: string; name: string } | null;
}

/**
 * Intent detected by the supervisor agent
 */
export type SetupIntent =
  | 'general_setup'
  | 'loyalty_config'
  | 'agents_config'
  | 'services_config'
  | 'knowledge_base'
  | 'promotions_config'
  | 'staff_config'
  | 'branches_config'
  | 'help'
  | 'confirm'
  | 'cancel'
  | 'unknown';

// =====================================================
// DATABASE ROW TYPES (snake_case for Supabase)
// =====================================================

/**
 * Raw database row type for conversations
 */
export interface SetupConversationRow {
  id: string;
  tenant_id: string;
  user_id: string;
  status: ConversationStatus;
  current_module: SetupModule | null;
  setup_progress: Record<string, ModuleProgress>;
  title: string | null;
  summary: string | null;
  started_at: string;
  last_message_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Raw database row type for messages
 */
export interface SetupMessageRow {
  id: string;
  conversation_id: string;
  tenant_id: string;
  role: MessageRole;
  content: string;
  attachments: MessageAttachment[];
  actions_taken: MessageAction[];
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

/**
 * Raw database row type for usage
 */
export interface SetupUsageRow {
  id: string;
  tenant_id: string;
  usage_date: string;
  messages_count: number;
  files_uploaded: number;
  vision_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  updated_at: string;
}

// =====================================================
// TYPE CONVERTERS
// =====================================================

/**
 * Convert database row to application type (conversation)
 */
export function rowToConversation(row: SetupConversationRow): SetupConversation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    status: row.status,
    currentModule: row.current_module,
    setupProgress: row.setup_progress as Record<SetupModule, ModuleProgress>,
    title: row.title,
    summary: row.summary,
    startedAt: row.started_at,
    lastMessageAt: row.last_message_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to application type (message)
 */
export function rowToMessage(row: SetupMessageRow): SetupMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tenantId: row.tenant_id,
    role: row.role,
    content: row.content,
    attachments: row.attachments || [],
    actionsTaken: row.actions_taken || [],
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at,
  };
}

/**
 * Convert database row to application type (usage)
 */
export function rowToUsage(row: SetupUsageRow): SetupUsage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    usageDate: row.usage_date,
    messagesCount: row.messages_count,
    filesUploaded: row.files_uploaded,
    visionRequests: row.vision_requests,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
