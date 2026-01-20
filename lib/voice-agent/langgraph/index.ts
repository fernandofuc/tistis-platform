/**
 * TIS TIS Platform - Voice Agent v2.0
 * LangGraph Module Index
 *
 * This module provides a LangGraph-based voice agent for processing
 * voice conversations. It includes:
 *
 * - State management for conversation flow
 * - Intent routing with keyword and LLM classification
 * - RAG integration for business knowledge retrieval
 * - Tool execution with confirmation workflow
 * - Voice-optimized response generation
 *
 * @example
 * ```typescript
 * import {
 *   getVoiceAgentGraph,
 *   executeVoiceAgentGraph,
 *   createInitialState,
 * } from '@/lib/voice-agent/langgraph';
 *
 * const graph = getVoiceAgentGraph();
 * const result = await executeVoiceAgentGraph(graph, {
 *   callId: 'call-123',
 *   vapiCallId: 'vapi-123',
 *   tenantId: 'tenant-123',
 *   voiceConfigId: 'config-123',
 *   assistantType: 'rest_basic',
 *   currentInput: 'Quiero hacer una reservación',
 * });
 *
 * console.log(result.response.text);
 * ```
 */

// =====================================================
// STATE
// =====================================================

export {
  // State types
  type VoiceAgentState,
  type VoiceIntent,
  type PendingTool,
  type ToolExecutionResult,
  type RAGResult,
  type ResponseType,
  type ConfirmationStatus,
  type GraphError,

  // State annotation for LangGraph
  VoiceAgentStateAnnotation,
  type VoiceAgentGraphState,

  // State factory functions
  createInitialState,
  createToolExecutionState,

  // State helpers
  requiresConfirmation,
  addError,
  recordLatency,
  getTotalLatency,
  hasCriticalError,
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
} from './state';

// =====================================================
// NODES
// =====================================================

export {
  // Router
  routerNode,
  createRouterNode,
  type RouterConfig,

  // RAG
  ragNode,
  createRAGNode,
  getBusinessHours,
  getMenuOrServices,
  getLocationInfo,
  type RAGConfig,

  // Tool Executor
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

  // Confirmation
  confirmationNode,
  createConfirmationNode,
  parseConfirmationResponse,
  isPositiveResponse,
  isNegativeResponse,
  getConfirmationConfidence,
  generateConfirmationPrompt,
  type ConfirmationConfig,
  type ConfirmationResult,

  // Response Generator
  responseGeneratorNode,
  createResponseGeneratorNode,
  formatVoiceResponse,
  getResponseTemplate,
  type ResponseGeneratorConfig,
  type VoiceResponse,
} from './nodes';

// =====================================================
// EDGES
// =====================================================

export {
  // Edge functions
  routerEdge,
  toolExecutorEdge,
  confirmationEdge,
  ragEdge,
  responseGeneratorEdge,

  // Edge utilities
  CONDITIONAL_EDGES,
  createConditionalEdge,
  getPossibleNextNodes,
  isValidPath,
  getEdgeForNode,

  // Decision helpers
  shouldRouteToRAG,
  shouldRouteToToolExecutor,
  shouldRouteToConfirmation,
  isProcessingComplete,

  // Graph structure
  GRAPH_STRUCTURE,
  validateGraphStructure,

  // Types
  type NodeName,
  type EdgeRoutingResult,
} from './edges';

// =====================================================
// GRAPH
// =====================================================

export {
  // Graph builder
  buildVoiceAgentGraph,
  createVoiceAgentGraph,
  createMinimalVoiceAgentGraph,
  createFullVoiceAgentGraph,

  // Graph singleton
  getVoiceAgentGraph,
  getVoiceAgentGraphAsync,
  resetVoiceAgentGraph,

  // Execution helpers
  executeVoiceAgentGraph,
  executeToolCall,

  // Types
  type VoiceAgentGraph,
  type VoiceAgentGraphConfig,
  type GraphExecutionResult,
} from './voice-agent-graph';
