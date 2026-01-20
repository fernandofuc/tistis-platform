/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Handlers Index
 *
 * Exports all webhook event handlers.
 */

// Assistant Request Handler
export {
  handleAssistantRequest,
  createAssistantRequestHandler,
  type AssistantRequestHandlerOptions,
} from './assistant-request.handler';

// Function Call Handler
export {
  handleFunctionCall,
  handleToolCalls,
  createFunctionCallHandler,
  createToolCallsHandler,
  type FunctionCallHandlerOptions,
  type FunctionExecutor,
  type FunctionExecutionContext,
  type FunctionExecutionResult,
} from './function-call.handler';

// End of Call Handler
export {
  handleEndOfCall,
  createEndOfCallHandler,
  type EndOfCallHandlerOptions,
} from './end-of-call.handler';

// Transcript Handler
export {
  handleTranscript,
  createTranscriptHandler,
  type TranscriptHandlerOptions,
  DEFAULT_TRANSCRIPT_HANDLER_OPTIONS,
} from './transcript.handler';

// Status Update Handler
export {
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
} from './status-update.handler';

// LangGraph Integration Handler
export {
  handleFunctionCallWithLangGraph,
  handleToolCallsWithLangGraph,
  handleAssistantRequestWithLangGraph,
  handleTranscriptWithLangGraph,
  createLangGraphFunctionCallHandler,
  createLangGraphToolCallsHandler,
  createLangGraphAssistantRequestHandler,
  createLangGraphTranscriptHandler,
  clearConversationState,
  type LangGraphHandlerOptions,
} from './langgraph-integration.handler';
