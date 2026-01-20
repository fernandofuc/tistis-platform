/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Types
 *
 * Defines all types for the VAPI webhook system including:
 * - Event payloads from VAPI
 * - Response formats for VAPI
 * - Handler interfaces
 * - Error types
 */

// =====================================================
// VAPI EVENT TYPES
// =====================================================

/**
 * All supported VAPI webhook event types
 */
export type VapiEventType =
  | 'assistant-request'
  | 'function-call'
  | 'conversation-update'
  | 'end-of-call-report'
  | 'transcript'
  | 'status-update'
  | 'speech-update'
  | 'hang'
  | 'tool-calls'
  | 'transfer-destination-request';

/**
 * All valid VAPI event types as array (for validation)
 */
export const VAPI_EVENT_TYPES: VapiEventType[] = [
  'assistant-request',
  'function-call',
  'conversation-update',
  'end-of-call-report',
  'transcript',
  'status-update',
  'speech-update',
  'hang',
  'tool-calls',
  'transfer-destination-request',
];

/**
 * Check if a string is a valid VAPI event type
 */
export function isValidVapiEventType(type: string): type is VapiEventType {
  return VAPI_EVENT_TYPES.includes(type as VapiEventType);
}

// =====================================================
// BASE PAYLOAD TYPES
// =====================================================

/**
 * Phone number information from VAPI
 */
export interface VapiPhoneNumber {
  id?: string;
  number: string;
  name?: string;
}

/**
 * Customer information from VAPI
 */
export interface VapiCustomer {
  number: string;
  name?: string;
  numberE164CheckEnabled?: boolean;
}

/**
 * Call information included in most VAPI events
 */
export interface VapiCallInfo {
  id: string;
  orgId?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  status?: VapiCallStatus;
  type?: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  phoneNumber?: VapiPhoneNumber;
  phoneNumberId?: string;
  customer?: VapiCustomer;
  assistantId?: string;
  squadId?: string;
  phoneCallProvider?: string;
  phoneCallProviderId?: string;
  phoneCallTransport?: string;
  endedReason?: string;
  cost?: number;
  costBreakdown?: VapiCostBreakdown;
  artifact?: VapiArtifact;
  analysis?: VapiAnalysis;
  monitor?: VapiMonitor;
  [key: string]: unknown;
}

/**
 * Call status values from VAPI
 */
export type VapiCallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'forwarding'
  | 'ended';

/**
 * Cost breakdown from VAPI
 */
export interface VapiCostBreakdown {
  transport?: number;
  stt?: number;
  llm?: number;
  tts?: number;
  vapi?: number;
  total?: number;
  analysisCostBreakdown?: {
    summary?: number;
    structuredData?: number;
    successEvaluation?: number;
  };
}

/**
 * Artifact (recording, video, etc) from VAPI
 */
export interface VapiArtifact {
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  videoRecordingUrl?: string;
  videoRecordingStartDelaySeconds?: number;
  transcript?: string;
  messages?: VapiMessage[];
  messagesOpenAIFormatted?: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * Analysis result from VAPI
 */
export interface VapiAnalysis {
  summary?: string;
  structuredData?: Record<string, unknown>;
  successEvaluation?: string;
}

/**
 * Monitor information from VAPI
 */
export interface VapiMonitor {
  listenUrl?: string;
  controlUrl?: string;
}

/**
 * Single message in conversation
 */
export interface VapiMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'function';
  content?: string;
  name?: string;
  time?: number;
  endTime?: number;
  secondsFromStart?: number;
  duration?: number;
  toolCalls?: VapiToolCall[];
}

/**
 * Tool call in a message
 */
export interface VapiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// =====================================================
// EVENT PAYLOADS
// =====================================================

/**
 * Base payload structure for all VAPI webhooks
 */
export interface VapiWebhookPayloadBase {
  type: VapiEventType;
  call?: VapiCallInfo;
  timestamp?: string;
}

/**
 * Assistant request payload - Sent when a call starts
 * VAPI asks for assistant configuration
 */
export interface AssistantRequestPayload extends VapiWebhookPayloadBase {
  type: 'assistant-request';
  call: VapiCallInfo;
  phoneNumber?: VapiPhoneNumber;
  customer?: VapiCustomer;
}

/**
 * Conversation update payload - Sent after each turn
 * Contains the full conversation for server-side response mode
 */
export interface ConversationUpdatePayload extends VapiWebhookPayloadBase {
  type: 'conversation-update';
  call: VapiCallInfo;
  messages: VapiMessage[];
  messagesOpenAIFormatted?: Array<{
    role: string;
    content: string;
  }>;
}

/**
 * Function call payload - When VAPI wants to execute a function
 */
export interface FunctionCallPayload extends VapiWebhookPayloadBase {
  type: 'function-call';
  call: VapiCallInfo;
  functionCall: {
    id: string;
    name: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool calls payload - When VAPI wants to execute multiple tools
 */
export interface ToolCallsPayload extends VapiWebhookPayloadBase {
  type: 'tool-calls';
  call: VapiCallInfo;
  toolCallList: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * End of call report payload - Sent when call ends
 */
export interface EndOfCallPayload extends VapiWebhookPayloadBase {
  type: 'end-of-call-report';
  call: VapiCallInfo;
  endedReason: string;
  transcript?: string;
  summary?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  durationSeconds?: number;
  cost?: number;
  costBreakdown?: VapiCostBreakdown;
  analysis?: VapiAnalysis;
  artifact?: VapiArtifact;
  messages?: VapiMessage[];
}

/**
 * Transcript payload - Sent during conversation for real-time transcription
 */
export interface TranscriptPayload extends VapiWebhookPayloadBase {
  type: 'transcript';
  call: VapiCallInfo;
  transcript: {
    text: string;
    role: 'user' | 'assistant';
    isFinal: boolean;
    timestamp?: number;
  };
}

/**
 * Status update payload - Sent when call status changes
 */
export interface StatusUpdatePayload extends VapiWebhookPayloadBase {
  type: 'status-update';
  call: VapiCallInfo;
  status: VapiCallStatus;
  messages?: VapiMessage[];
  inboundPhoneCallDebuggingArtifacts?: {
    assistantRequestStarted: string;
    assistantRequestCompleted: string;
    assistantRequestFailed?: string;
  };
}

/**
 * Speech update payload - Sent during speech events
 */
export interface SpeechUpdatePayload extends VapiWebhookPayloadBase {
  type: 'speech-update';
  call: VapiCallInfo;
  status: 'started' | 'stopped';
  role: 'user' | 'assistant';
}

/**
 * Hang payload - Sent when call should be terminated
 */
export interface HangPayload extends VapiWebhookPayloadBase {
  type: 'hang';
  call: VapiCallInfo;
}

/**
 * Transfer destination request payload
 */
export interface TransferDestinationRequestPayload extends VapiWebhookPayloadBase {
  type: 'transfer-destination-request';
  call: VapiCallInfo;
  customer?: VapiCustomer;
}

/**
 * Union type of all possible VAPI webhook payloads
 */
export type VapiWebhookPayload =
  | AssistantRequestPayload
  | ConversationUpdatePayload
  | FunctionCallPayload
  | ToolCallsPayload
  | EndOfCallPayload
  | TranscriptPayload
  | StatusUpdatePayload
  | SpeechUpdatePayload
  | HangPayload
  | TransferDestinationRequestPayload;

// =====================================================
// RESPONSE TYPES
// =====================================================

/**
 * Voice configuration for VAPI assistant
 */
export interface VapiVoiceConfig {
  provider: 'elevenlabs' | 'deepgram' | 'playht' | 'rime-ai' | 'azure';
  voiceId: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

/**
 * Transcriber configuration for VAPI
 */
export interface VapiTranscriberConfig {
  provider: 'deepgram' | 'talkscriber' | 'gladia' | 'assembly';
  model?: string;
  language?: string;
  keywords?: string[];
  smartFormat?: boolean;
}

/**
 * Model configuration for VAPI
 */
export interface VapiModelConfig {
  provider: 'openai' | 'anthropic' | 'groq' | 'together-ai' | 'custom-llm';
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  functions?: VapiFunctionDefinition[];
  tools?: VapiToolDefinition[];
}

/**
 * Function definition for VAPI
 */
export interface VapiFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  async?: boolean;
}

/**
 * Tool definition for VAPI
 */
export interface VapiToolDefinition {
  type: 'function';
  function: VapiFunctionDefinition;
  async?: boolean;
  messages?: Array<{
    type: 'request-start' | 'request-complete' | 'request-failed' | 'request-response-delayed';
    content?: string;
    timing?: {
      timing: 'early' | 'normal' | 'late';
      offset?: number;
    };
  }>;
  server?: {
    url: string;
    secret?: string;
    timeoutSeconds?: number;
  };
}

/**
 * Start speaking plan configuration
 */
export interface VapiStartSpeakingPlan {
  waitSeconds?: number;
  smartEndpointingEnabled?: boolean;
  transcriptionEndpointingPlan?: {
    onPunctuationSeconds?: number;
    onNoPunctuationSeconds?: number;
    onNumberSeconds?: number;
  };
}

/**
 * Stop speaking plan configuration
 */
export interface VapiStopSpeakingPlan {
  numWords?: number;
  voiceSeconds?: number;
  backoffSeconds?: number;
}

/**
 * Complete assistant configuration for VAPI response
 */
export interface VapiAssistantConfig {
  name?: string;
  firstMessage?: string;
  firstMessageMode?: 'assistant-speaks-first' | 'assistant-waits-for-user' | 'assistant-speaks-first-with-model-generated-message';
  voice?: VapiVoiceConfig;
  transcriber?: VapiTranscriberConfig;
  model?: VapiModelConfig;
  serverUrl?: string;
  serverUrlSecret?: string;
  startSpeakingPlan?: VapiStartSpeakingPlan;
  stopSpeakingPlan?: VapiStopSpeakingPlan;
  endCallPhrases?: string[];
  endCallMessage?: string;
  recordingEnabled?: boolean;
  hipaaEnabled?: boolean;
  silenceTimeoutSeconds?: number;
  maxDurationSeconds?: number;
  backgroundSound?: 'off' | 'office';
  backgroundDenoisingEnabled?: boolean;
  modelOutputInMessagesEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Response for assistant-request event
 */
export interface AssistantRequestResponse {
  assistant?: VapiAssistantConfig;
  assistantId?: string;
  squadId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response for conversation-update event (server-side response mode)
 */
export interface ConversationUpdateResponse {
  assistantResponse?: string;
  endCall?: boolean;
  error?: string;
}

/**
 * Response for function-call event
 */
export interface FunctionCallResponse {
  result?: unknown;
  error?: string;
  forwardToClientEnabled?: boolean;
}

/**
 * Response for tool-calls event
 */
export interface ToolCallsResponse {
  results: Array<{
    toolCallId: string;
    result?: unknown;
    error?: string;
  }>;
}

/**
 * Response for transfer-destination-request event
 */
export interface TransferDestinationResponse {
  destination?: {
    type: 'number' | 'sip';
    number?: string;
    sipUri?: string;
    message?: string;
    description?: string;
  };
  error?: string;
}

/**
 * Generic acknowledgment response
 */
export interface AckResponse {
  status: 'ok';
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Union type of all possible VAPI webhook responses
 */
export type VapiWebhookResponse =
  | AssistantRequestResponse
  | ConversationUpdateResponse
  | FunctionCallResponse
  | ToolCallsResponse
  | TransferDestinationResponse
  | AckResponse
  | ErrorResponse;

// =====================================================
// HANDLER TYPES
// =====================================================

/**
 * Context passed to all webhook handlers
 */
export interface WebhookHandlerContext {
  /** Unique request ID for tracing */
  requestId: string;

  /** Client IP address */
  clientIp: string;

  /** Tenant ID if resolved */
  tenantId?: string;

  /** Internal call ID if resolved */
  callId?: string;

  /** Voice config ID if resolved */
  voiceConfigId?: string;

  /** Start time for latency tracking */
  startTime: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from a webhook handler
 */
export interface HandlerResult<T = VapiWebhookResponse> {
  /** The response to send to VAPI */
  response: T;

  /** HTTP status code to return */
  statusCode: number;

  /** Whether to log this result */
  shouldLog?: boolean;

  /** Additional metadata for logging */
  metadata?: Record<string, unknown>;
}

/**
 * Generic webhook handler function type
 */
export type WebhookHandler<
  TPayload extends VapiWebhookPayload = VapiWebhookPayload,
  TResponse extends VapiWebhookResponse = VapiWebhookResponse
> = (
  payload: TPayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<TResponse>>;

// =====================================================
// WEBHOOK ERROR TYPES
// =====================================================

/**
 * Error codes for webhook processing
 */
export type WebhookErrorCode =
  | 'INVALID_PAYLOAD'
  | 'UNKNOWN_EVENT_TYPE'
  | 'HANDLER_NOT_FOUND'
  | 'HANDLER_ERROR'
  | 'TENANT_NOT_FOUND'
  | 'CALL_NOT_FOUND'
  | 'CONFIG_NOT_FOUND'
  | 'FUNCTION_NOT_FOUND'
  | 'FUNCTION_EXECUTION_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'TIMEOUT_ERROR';

/**
 * Custom webhook error class
 */
export class WebhookError extends Error {
  constructor(
    public readonly code: WebhookErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WebhookError';
  }

  /**
   * Convert to error response
   */
  toResponse(): ErrorResponse {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Check if payload is an assistant request
 */
export function isAssistantRequestPayload(
  payload: VapiWebhookPayload
): payload is AssistantRequestPayload {
  return payload.type === 'assistant-request';
}

/**
 * Check if payload is a conversation update
 */
export function isConversationUpdatePayload(
  payload: VapiWebhookPayload
): payload is ConversationUpdatePayload {
  return payload.type === 'conversation-update';
}

/**
 * Check if payload is a function call
 */
export function isFunctionCallPayload(
  payload: VapiWebhookPayload
): payload is FunctionCallPayload {
  return payload.type === 'function-call';
}

/**
 * Check if payload is tool calls
 */
export function isToolCallsPayload(
  payload: VapiWebhookPayload
): payload is ToolCallsPayload {
  return payload.type === 'tool-calls';
}

/**
 * Check if payload is an end of call report
 */
export function isEndOfCallPayload(
  payload: VapiWebhookPayload
): payload is EndOfCallPayload {
  return payload.type === 'end-of-call-report';
}

/**
 * Check if payload is a transcript
 */
export function isTranscriptPayload(
  payload: VapiWebhookPayload
): payload is TranscriptPayload {
  return payload.type === 'transcript';
}

/**
 * Check if payload is a status update
 */
export function isStatusUpdatePayload(
  payload: VapiWebhookPayload
): payload is StatusUpdatePayload {
  return payload.type === 'status-update';
}

/**
 * Check if payload is a speech update
 */
export function isSpeechUpdatePayload(
  payload: VapiWebhookPayload
): payload is SpeechUpdatePayload {
  return payload.type === 'speech-update';
}

/**
 * Check if payload is a hang event
 */
export function isHangPayload(
  payload: VapiWebhookPayload
): payload is HangPayload {
  return payload.type === 'hang';
}

/**
 * Check if payload is a transfer destination request
 */
export function isTransferDestinationRequestPayload(
  payload: VapiWebhookPayload
): payload is TransferDestinationRequestPayload {
  return payload.type === 'transfer-destination-request';
}
