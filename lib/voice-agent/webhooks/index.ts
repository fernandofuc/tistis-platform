/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhooks Module
 *
 * Exports for the VAPI webhook system including:
 * - Event types and payloads
 * - Event router
 * - Response formatters
 * - Error handler
 * - Individual event handlers
 */

// =====================================================
// TYPES
// =====================================================

export type {
  // Event types
  VapiEventType,
  VapiWebhookPayload,
  VapiWebhookPayloadBase,
  VapiWebhookResponse,

  // Specific payloads
  AssistantRequestPayload,
  ConversationUpdatePayload,
  FunctionCallPayload,
  ToolCallsPayload,
  EndOfCallPayload,
  TranscriptPayload,
  StatusUpdatePayload,
  SpeechUpdatePayload,
  HangPayload,
  TransferDestinationRequestPayload,

  // Response types
  AssistantRequestResponse,
  ConversationUpdateResponse,
  FunctionCallResponse,
  ToolCallsResponse,
  TransferDestinationResponse,
  AckResponse,
  ErrorResponse,

  // Configuration types
  VapiAssistantConfig,
  VapiVoiceConfig,
  VapiTranscriberConfig,
  VapiModelConfig,
  VapiToolDefinition,
  VapiFunctionDefinition,
  VapiStartSpeakingPlan,
  VapiStopSpeakingPlan,

  // Call info types
  VapiCallInfo,
  VapiCallStatus,
  VapiCustomer,
  VapiPhoneNumber,
  VapiMessage,
  VapiToolCall,
  VapiCostBreakdown,
  VapiArtifact,
  VapiAnalysis,

  // Handler types
  WebhookHandler,
  WebhookHandlerContext,
  HandlerResult,
  WebhookErrorCode,
} from './types';

export {
  // Type guards
  isValidVapiEventType,
  isAssistantRequestPayload,
  isConversationUpdatePayload,
  isFunctionCallPayload,
  isToolCallsPayload,
  isEndOfCallPayload,
  isTranscriptPayload,
  isStatusUpdatePayload,
  isSpeechUpdatePayload,
  isHangPayload,
  isTransferDestinationRequestPayload,

  // Constants
  VAPI_EVENT_TYPES,

  // Error class
  WebhookError,
} from './types';

// =====================================================
// EVENT ROUTER
// =====================================================

export type {
  EventHandlerMap,
  EventRouterConfig,
} from './event-router';

export {
  WebhookEventRouter,
  createEventRouter,
  createLoggingRouter,
  getEventPriority,
  requiresSyncProcessing,
  isInformationalEvent,
  DEFAULT_ROUTER_CONFIG,
} from './event-router';

// =====================================================
// RESPONSE FORMATTERS
// =====================================================

export type {
  VoiceConfigInput,
  TranscriberConfigInput,
  ModelConfigInput,
  SpeakingPlanInput,
  ToolParameter,
  ToolDefinitionInput,
  VoiceAgentConfigInput,
} from './response-formatters';

export {
  // Voice configuration
  formatVoiceConfig,
  formatTranscriberConfig,
  formatModelConfig,
  formatStartSpeakingPlan,

  // Tool/function formatting
  formatFunctionDefinition,
  formatToolDefinition,
  formatToolDefinitions,

  // Assistant configuration
  formatAssistantConfig,

  // Response formatting
  formatAssistantRequestResponse,
  formatAssistantRequestError,
  formatConversationUpdateResponse,
  formatConversationUpdateError,
  formatFunctionCallResponse,
  formatFunctionCallError,
  formatToolCallsResponse,
  formatAckResponse,
  formatErrorResponse,

  // Voice-specific formatting
  formatResultForVoice,
  formatErrorForVoice,
} from './response-formatters';

// =====================================================
// ERROR HANDLER
// =====================================================

export type {
  ErrorHandlerOptions,
} from './error-handler';

export {
  handleWebhookError,
  toWebhookError,
  DEFAULT_ERROR_HANDLER_OPTIONS,

  // Error factory functions
  invalidPayloadError,
  unknownEventTypeError,
  handlerNotFoundError,
  tenantNotFoundError,
  callNotFoundError,
  configNotFoundError,
  functionNotFoundError,
  functionExecutionError,
  databaseError,
  handlerError,

  // Helper functions
  createErrorResponse,
  createFallbackAssistantResponse,
  isRetryableError,
  getStatusText,
} from './error-handler';

// =====================================================
// HANDLERS
// =====================================================

export {
  // Assistant Request
  handleAssistantRequest,
  createAssistantRequestHandler,
  type AssistantRequestHandlerOptions,

  // Function Call
  handleFunctionCall,
  handleToolCalls,
  createFunctionCallHandler,
  createToolCallsHandler,
  type FunctionCallHandlerOptions,
  type FunctionExecutor,
  type FunctionExecutionContext,
  type FunctionExecutionResult,

  // End of Call
  handleEndOfCall,
  createEndOfCallHandler,
  type EndOfCallHandlerOptions,

  // Transcript
  handleTranscript,
  createTranscriptHandler,
  type TranscriptHandlerOptions,
  DEFAULT_TRANSCRIPT_HANDLER_OPTIONS,

  // Status Update
  handleStatusUpdate,
  handleSpeechUpdate,
  createStatusUpdateHandler,
  createSpeechUpdateHandler,
  mapVapiStatusToInternal,
  isActiveStatus,
  isTerminalStatus,
  getStatusDescription,
  type StatusUpdateHandlerOptions,
  type InternalCallStatus,
  DEFAULT_STATUS_UPDATE_OPTIONS,
} from './handlers';

// =====================================================
// CONVENIENCE EXPORTS
// =====================================================

/**
 * Create a fully configured event router with all handlers
 */
export function createConfiguredEventRouter(options: {
  serverUrl?: string;
  serverUrlSecret?: string;
  useServerSideResponse?: boolean;
  logEvents?: boolean;
} = {}) {
  // Using dynamic import to avoid circular dependency
  const { WebhookEventRouter: Router } = require('./event-router');
  const {
    createAssistantRequestHandler,
    createFunctionCallHandler,
    createToolCallsHandler,
    createEndOfCallHandler,
    createTranscriptHandler,
    createStatusUpdateHandler,
    createSpeechUpdateHandler,
  } = require('./handlers');

  return new Router(
    {
      'assistant-request': createAssistantRequestHandler({
        serverUrl: options.serverUrl,
        serverUrlSecret: options.serverUrlSecret,
        useServerSideResponse: options.useServerSideResponse ?? true,
      }),
      'function-call': createFunctionCallHandler(),
      'tool-calls': createToolCallsHandler(),
      'end-of-call-report': createEndOfCallHandler(),
      'transcript': createTranscriptHandler(),
      'status-update': createStatusUpdateHandler(),
      'speech-update': createSpeechUpdateHandler(),
    },
    {
      logEvents: options.logEvents ?? true,
      allowUnknownEvents: true,
    }
  );
}
