/**
 * TIS TIS Platform - Voice Agent v2.0
 * Voice Agent Graph
 *
 * Constructs and exports the complete LangGraph voice agent.
 *
 * Graph Structure:
 *
 *        ┌─────────┐
 *        │  START  │
 *        └────┬────┘
 *             │
 *             ▼
 *        ┌─────────┐
 *        │ Router  │
 *        └────┬────┘
 *             │
 *     ┌───────┼───────┬────────────┐
 *     │       │       │            │
 *     ▼       ▼       ▼            ▼
 *  ┌─────┐ ┌─────┐ ┌──────┐ ┌────────────┐
 *  │ RAG │ │Tool │ │Confir│ │  Response  │
 *  │     │ │Exec │ │mation│ │  Generator │
 *  └──┬──┘ └──┬──┘ └──┬───┘ └─────┬──────┘
 *     │       │       │           │
 *     │       │   ┌───┴───┐       │
 *     │       │   │       │       │
 *     │       ▼   ▼       ▼       │
 *     │    ┌──────────────────┐   │
 *     └───►│ Response         │◄──┘
 *          │ Generator        │
 *          └────────┬─────────┘
 *                   │
 *                   ▼
 *              ┌─────────┐
 *              │   END   │
 *              └─────────┘
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { SupabaseClient } from '@supabase/supabase-js';

// State
import {
  VoiceAgentStateAnnotation,
  type VoiceAgentState,
  createInitialState,
  createToolExecutionState,
} from './state';

// Nodes
import { routerNode, createRouterNode, type RouterConfig } from './nodes/router';
import { ragNode, createRAGNode, type RAGConfig } from './nodes/rag';
import { toolExecutorNode, createToolExecutorNode, type ToolExecutorConfig, type ToolRegistry } from './nodes/tool-executor';
import { confirmationNode, createConfirmationNode, type ConfirmationConfig } from './nodes/confirmation';
import { responseGeneratorNode, createResponseGeneratorNode, type ResponseGeneratorConfig, formatVoiceResponse } from './nodes/response-generator';

// Edges
import {
  routerEdge,
  toolExecutorEdge,
  confirmationEdge,
  ragEdge,
  responseGeneratorEdge,
  GRAPH_STRUCTURE,
  validateGraphStructure,
} from './edges';

// =====================================================
// TYPES
// =====================================================

/**
 * Voice Agent Graph Configuration
 */
export interface VoiceAgentGraphConfig {
  /** Router node configuration */
  router?: RouterConfig;

  /** RAG node configuration */
  rag?: RAGConfig;

  /** Tool executor configuration */
  toolExecutor?: ToolExecutorConfig;

  /** Confirmation node configuration */
  confirmation?: ConfirmationConfig;

  /** Response generator configuration */
  responseGenerator?: ResponseGeneratorConfig;

  /** Shared Supabase client */
  supabaseClient?: SupabaseClient;

  /** Custom tool registry */
  toolRegistry?: ToolRegistry;

  /** Default locale */
  defaultLocale?: string;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Voice Agent Graph instance
 */
export interface VoiceAgentGraph {
  /** Invoke the graph with input */
  invoke: (input: VoiceAgentState) => Promise<VoiceAgentState>;

  /** Stream graph execution */
  stream: (input: VoiceAgentState) => AsyncIterable<VoiceAgentState>;

  /** Get graph structure info */
  getStructure: () => typeof GRAPH_STRUCTURE;

  /** Validate graph configuration */
  validate: () => { valid: boolean; errors: string[] };
}

/**
 * Graph execution result
 */
export interface GraphExecutionResult {
  /** Final state after execution */
  state: VoiceAgentState;

  /** Response formatted for VAPI */
  response: ReturnType<typeof formatVoiceResponse>;

  /** Execution metrics */
  metrics: {
    totalLatencyMs: number;
    nodeLatencies: Record<string, number>;
    nodesVisited: string[];
  };
}

// =====================================================
// GRAPH BUILDER
// =====================================================

/**
 * Build the voice agent graph
 */
export function buildVoiceAgentGraph(config?: VoiceAgentGraphConfig): VoiceAgentGraph {
  const graphConfig = {
    defaultLocale: config?.defaultLocale ?? 'es',
    debug: config?.debug ?? false,
  };

  // Validate graph structure
  const validation = validateGraphStructure();
  if (!validation.valid) {
    console.error('[VoiceAgentGraph] Invalid graph structure:', validation.errors);
    throw new Error(`Invalid graph structure: ${validation.errors.join(', ')}`);
  }

  // Create the state graph
  const workflow = new StateGraph(VoiceAgentStateAnnotation);

  // Add nodes
  workflow.addNode('router', createRouterNode({
    ...config?.router,
    useLLM: config?.router?.useLLM ?? false,
  }));

  workflow.addNode('rag', createRAGNode({
    ...config?.rag,
    supabaseClient: config?.supabaseClient,
  }));

  workflow.addNode('tool_executor', createToolExecutorNode({
    ...config?.toolExecutor,
    supabaseClient: config?.supabaseClient,
    toolRegistry: config?.toolRegistry,
    locale: config?.defaultLocale,
  }));

  workflow.addNode('confirmation', createConfirmationNode({
    ...config?.confirmation,
    locale: config?.defaultLocale,
  }));

  workflow.addNode('response_generator', createResponseGeneratorNode({
    ...config?.responseGenerator,
    locale: config?.defaultLocale,
  }));

  // Add entry point
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (workflow as any).addEdge(START, 'router');

  // Add conditional edges from router
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (workflow as any).addConditionalEdges('router', routerEdge, {
    rag: 'rag',
    tool_executor: 'tool_executor',
    confirmation: 'confirmation',
    response_generator: 'response_generator',
  });

  // Add edge from RAG to response generator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (workflow as any).addEdge('rag', 'response_generator');

  // Add conditional edges from tool executor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (workflow as any).addConditionalEdges('tool_executor', toolExecutorEdge, {
    confirmation: 'confirmation',
    response_generator: 'response_generator',
  });

  // Add conditional edges from confirmation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (workflow as any).addConditionalEdges('confirmation', confirmationEdge, {
    tool_executor: 'tool_executor',
    response_generator: 'response_generator',
  });

  // Add edge from response generator to end
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (workflow as any).addEdge('response_generator', END);

  // Compile the graph
  const compiledGraph = workflow.compile();

  // Return the graph interface
  return {
    async invoke(input: VoiceAgentState): Promise<VoiceAgentState> {
      if (graphConfig.debug) {
        console.log('[VoiceAgentGraph] Invoking with input:', {
          callId: input.callId,
          currentInput: input.currentInput,
          intent: input.intent,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await compiledGraph.invoke(input as any);

      if (graphConfig.debug) {
        console.log('[VoiceAgentGraph] Execution complete:', {
          response: (result as any).response?.substring(0, 100),
          nodesVisited: Object.keys((result as any).nodeLatencies || {}),
          totalLatency: Object.values((result as any).nodeLatencies || {}).reduce((a: number, b: unknown) => a + (b as number), 0),
        });
      }

      return result as unknown as VoiceAgentState;
    },

    async *stream(input: VoiceAgentState): AsyncIterable<VoiceAgentState> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const chunk of await compiledGraph.stream(input as any)) {
        yield chunk as unknown as VoiceAgentState;
      }
    },

    getStructure() {
      return GRAPH_STRUCTURE;
    },

    validate() {
      return validateGraphStructure();
    },
  };
}

// =====================================================
// EXECUTION HELPERS
// =====================================================

/**
 * Execute the voice agent graph and return formatted result
 */
export async function executeVoiceAgentGraph(
  graph: VoiceAgentGraph,
  params: {
    callId: string;
    vapiCallId: string;
    tenantId: string;
    voiceConfigId: string;
    assistantType: string;
    currentInput: string;
    locale?: string;
    existingMessages?: VoiceAgentState['messages'];
    turnCount?: number;
  }
): Promise<GraphExecutionResult> {
  const startTime = Date.now();

  // Create initial state
  const initialState = createInitialState({
    callId: params.callId,
    vapiCallId: params.vapiCallId,
    tenantId: params.tenantId,
    voiceConfigId: params.voiceConfigId,
    assistantType: params.assistantType,
    currentInput: params.currentInput,
    locale: params.locale,
    existingMessages: params.existingMessages,
    turnCount: params.turnCount,
  });

  // Execute graph
  const finalState = await graph.invoke(initialState);

  // Calculate metrics
  const totalLatencyMs = Date.now() - startTime;
  const nodesVisited = Object.keys(finalState.nodeLatencies || {});

  return {
    state: finalState,
    response: formatVoiceResponse(finalState),
    metrics: {
      totalLatencyMs,
      nodeLatencies: finalState.nodeLatencies || {},
      nodesVisited,
    },
  };
}

/**
 * Execute the voice agent graph for a direct tool call
 */
export async function executeToolCall(
  graph: VoiceAgentGraph,
  params: {
    callId: string;
    vapiCallId: string;
    tenantId: string;
    voiceConfigId: string;
    assistantType: string;
    toolName: string;
    toolParameters: Record<string, unknown>;
    locale?: string;
    existingMessages?: VoiceAgentState['messages'];
  }
): Promise<GraphExecutionResult> {
  const startTime = Date.now();

  // Create tool execution state
  const initialState = createToolExecutionState({
    callId: params.callId,
    vapiCallId: params.vapiCallId,
    tenantId: params.tenantId,
    voiceConfigId: params.voiceConfigId,
    assistantType: params.assistantType,
    toolName: params.toolName,
    toolParameters: params.toolParameters,
    locale: params.locale,
    existingMessages: params.existingMessages,
  });

  // Execute graph (will skip router and go directly to tool_executor)
  const finalState = await graph.invoke(initialState);

  const totalLatencyMs = Date.now() - startTime;
  const nodesVisited = Object.keys(finalState.nodeLatencies || {});

  return {
    state: finalState,
    response: formatVoiceResponse(finalState),
    metrics: {
      totalLatencyMs,
      nodeLatencies: finalState.nodeLatencies || {},
      nodesVisited,
    },
  };
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let defaultGraphInstance: VoiceAgentGraph | null = null;
let graphInitPromise: Promise<VoiceAgentGraph> | null = null;

/**
 * Get or create the default voice agent graph instance
 * Note: Uses a promise-based initialization to prevent race conditions
 */
export function getVoiceAgentGraph(config?: VoiceAgentGraphConfig): VoiceAgentGraph {
  if (defaultGraphInstance) {
    return defaultGraphInstance;
  }

  // Synchronous initialization (graph building is synchronous)
  // The graph compilation is CPU-bound, not async, so this is safe
  defaultGraphInstance = buildVoiceAgentGraph(config);
  return defaultGraphInstance;
}

/**
 * Get or create the default voice agent graph instance (async-safe version)
 * Use this when multiple concurrent calls may try to initialize the graph
 */
export async function getVoiceAgentGraphAsync(config?: VoiceAgentGraphConfig): Promise<VoiceAgentGraph> {
  if (defaultGraphInstance) {
    return defaultGraphInstance;
  }

  if (graphInitPromise) {
    return graphInitPromise;
  }

  graphInitPromise = Promise.resolve().then(() => {
    if (!defaultGraphInstance) {
      defaultGraphInstance = buildVoiceAgentGraph(config);
    }
    graphInitPromise = null;
    return defaultGraphInstance;
  });

  return graphInitPromise;
}

/**
 * Reset the default graph instance (useful for testing)
 */
export function resetVoiceAgentGraph(): void {
  defaultGraphInstance = null;
  graphInitPromise = null;
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a voice agent graph with custom configuration
 */
export function createVoiceAgentGraph(config?: VoiceAgentGraphConfig): VoiceAgentGraph {
  return buildVoiceAgentGraph(config);
}

/**
 * Create a minimal voice agent graph (no LLM, keyword-only)
 */
export function createMinimalVoiceAgentGraph(
  supabaseClient?: SupabaseClient
): VoiceAgentGraph {
  return buildVoiceAgentGraph({
    router: { useLLM: false },
    responseGenerator: { model: 'gpt-4o-mini', maxTokens: 100 },
    supabaseClient,
  });
}

/**
 * Create a full-featured voice agent graph
 */
export function createFullVoiceAgentGraph(
  supabaseClient?: SupabaseClient,
  toolRegistry?: ToolRegistry
): VoiceAgentGraph {
  return buildVoiceAgentGraph({
    router: { useLLM: true },
    rag: { rerank: true },
    responseGenerator: { model: 'gpt-4o', maxTokens: 300 },
    supabaseClient,
    toolRegistry,
    debug: process.env.NODE_ENV === 'development',
  });
}
