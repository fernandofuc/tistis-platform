/**
 * TIS TIS Platform - Voice Agent v2.0
 * Nodes Index
 *
 * Exports all node implementations and their types.
 */

// Router Node
export {
  routerNode,
  createRouterNode,
  type RouterConfig,
} from './router';

// RAG Node
export {
  ragNode,
  createRAGNode,
  createVoiceOptimizedRAGNode,
  resetVoiceRAGInstance,
  getBusinessHours,
  getMenuOrServices,
  getLocationInfo,
  type RAGConfig,
} from './rag';

// Tool Executor Node
export {
  toolExecutorNode,
  createToolExecutorNode,
  createToolRegistry,
  mergeTools,
  getAvailableTools,
  toolRequiresConfirmation,
  type ToolExecutorConfig,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolRegistry,
  type ParameterDefinition,
} from './tool-executor';

// Confirmation Node
export {
  confirmationNode,
  createConfirmationNode,
  parseConfirmationResponse,
  isPositiveResponse,
  isNegativeResponse,
  getConfirmationConfidence,
  generateConfirmationPrompt,
  type ConfirmationConfig,
  type ConfirmationResult,
} from './confirmation';

// Response Generator Node
export {
  responseGeneratorNode,
  createResponseGeneratorNode,
  formatVoiceResponse,
  getResponseTemplate,
  type ResponseGeneratorConfig,
  type VoiceResponse,
} from './response-generator';
