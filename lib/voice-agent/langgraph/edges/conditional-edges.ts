/**
 * TIS TIS Platform - Voice Agent v2.0
 * Conditional Edges
 *
 * Defines the routing logic between nodes in the voice agent graph.
 * These edges determine the flow based on state conditions.
 *
 * Graph Flow:
 * 1. START -> router (always)
 * 2. router -> rag | tool_executor | response_generator | confirmation
 * 3. rag -> response_generator
 * 4. tool_executor -> confirmation | response_generator
 * 5. confirmation -> tool_executor | response_generator
 * 6. response_generator -> END
 */

import type { VoiceAgentState } from '../state';

// =====================================================
// TYPES
// =====================================================

/**
 * Node names in the graph
 */
export type NodeName =
  | 'router'
  | 'rag'
  | 'tool_executor'
  | 'confirmation'
  | 'response_generator'
  | '__end__';

/**
 * Edge routing result
 */
export interface EdgeRoutingResult {
  /** Next node to execute */
  next: NodeName;

  /** Reason for routing decision */
  reason?: string;
}

// =====================================================
// ROUTER EDGE
// =====================================================

/**
 * Routes from router to the appropriate node based on intent
 *
 * Logic:
 * - tool intent -> tool_executor
 * - rag intent -> rag
 * - confirm intent -> confirmation (if pending) or response_generator
 * - transfer intent -> tool_executor (to handle transfer)
 * - direct/unknown -> response_generator
 */
export function routerEdge(state: VoiceAgentState): NodeName {
  const { intent, confirmationStatus, confidence } = state;

  console.log(
    `[RouterEdge] Routing from router: intent=${intent}, confidence=${(confidence ?? 0).toFixed(2)}, confirmationStatus=${confirmationStatus}`
  );

  // Handle confirmation response first (if confirmation is pending)
  if (confirmationStatus === 'pending' && intent === 'confirm') {
    console.log('[RouterEdge] -> confirmation (pending confirmation response)');
    return 'confirmation';
  }

  // Route based on intent
  switch (intent) {
    case 'tool':
      console.log('[RouterEdge] -> tool_executor (tool intent)');
      return 'tool_executor';

    case 'rag':
      console.log('[RouterEdge] -> rag (information query)');
      return 'rag';

    case 'transfer':
      // Transfer is handled as a tool
      console.log('[RouterEdge] -> tool_executor (transfer request)');
      return 'tool_executor';

    case 'confirm':
      // Confirmation response but no pending confirmation
      // This means user said something like "yes" or "no" without context
      console.log('[RouterEdge] -> response_generator (orphan confirmation)');
      return 'response_generator';

    case 'direct':
    case 'unknown':
    default:
      console.log('[RouterEdge] -> response_generator (direct/unknown)');
      return 'response_generator';
  }
}

// =====================================================
// TOOL EXECUTOR EDGE
// =====================================================

/**
 * Routes from tool executor to next node
 *
 * Logic:
 * - If tool requires confirmation and not yet confirmed -> confirmation
 * - If tool executed -> response_generator
 */
export function toolExecutorEdge(state: VoiceAgentState): NodeName {
  const { confirmationStatus, pendingTool, toolResult } = state;

  console.log(
    `[ToolExecutorEdge] Routing from tool_executor: confirmationStatus=${confirmationStatus}, hasPendingTool=${!!pendingTool}, hasResult=${!!toolResult}`
  );

  // If confirmation is now pending, go to confirmation node
  if (confirmationStatus === 'pending' && pendingTool) {
    console.log('[ToolExecutorEdge] -> response_generator (needs confirmation prompt)');
    // Note: We go to response_generator to deliver the confirmation message
    // The confirmation node will be visited on the next turn when user responds
    return 'response_generator';
  }

  // Tool executed, generate response
  console.log('[ToolExecutorEdge] -> response_generator (tool completed)');
  return 'response_generator';
}

// =====================================================
// CONFIRMATION EDGE
// =====================================================

/**
 * Routes from confirmation node to next node
 *
 * Logic:
 * - If confirmed -> tool_executor (to execute the tool)
 * - If denied -> response_generator (to deliver denial message)
 * - If still pending -> response_generator (to ask for clarification)
 */
export function confirmationEdge(state: VoiceAgentState): NodeName {
  const { confirmationStatus, pendingTool } = state;

  console.log(
    `[ConfirmationEdge] Routing from confirmation: status=${confirmationStatus}, hasPendingTool=${!!pendingTool}`
  );

  if (confirmationStatus === 'confirmed' && pendingTool) {
    console.log('[ConfirmationEdge] -> tool_executor (user confirmed)');
    return 'tool_executor';
  }

  // Denied or still pending - generate response
  console.log('[ConfirmationEdge] -> response_generator (denied or unclear)');
  return 'response_generator';
}

// =====================================================
// RAG EDGE
// =====================================================

/**
 * Routes from RAG node (always goes to response generator)
 */
export function ragEdge(state: VoiceAgentState): NodeName {
  console.log('[RAGEdge] -> response_generator (RAG complete)');
  return 'response_generator';
}

// =====================================================
// RESPONSE GENERATOR EDGE
// =====================================================

/**
 * Routes from response generator (always ends)
 */
export function responseGeneratorEdge(state: VoiceAgentState): NodeName {
  console.log('[ResponseGeneratorEdge] -> __end__ (response complete)');
  return '__end__';
}

// =====================================================
// CONDITIONAL EDGE FACTORY
// =====================================================

/**
 * Create a conditional edge with logging and error handling
 */
export function createConditionalEdge(
  edgeFn: (state: VoiceAgentState) => NodeName,
  edgeName: string
): (state: VoiceAgentState) => NodeName {
  return (state: VoiceAgentState): NodeName => {
    try {
      const result = edgeFn(state);
      return result;
    } catch (error) {
      console.error(`[${edgeName}] Error in edge routing:`, error);
      // Default to response_generator on error
      return 'response_generator';
    }
  };
}

// =====================================================
// EDGE MAP
// =====================================================

/**
 * Map of all conditional edges
 */
export const CONDITIONAL_EDGES = {
  router: createConditionalEdge(routerEdge, 'RouterEdge'),
  tool_executor: createConditionalEdge(toolExecutorEdge, 'ToolExecutorEdge'),
  confirmation: createConditionalEdge(confirmationEdge, 'ConfirmationEdge'),
  rag: createConditionalEdge(ragEdge, 'RAGEdge'),
  response_generator: createConditionalEdge(responseGeneratorEdge, 'ResponseGeneratorEdge'),
};

// =====================================================
// ROUTING UTILITIES
// =====================================================

/**
 * Get all possible next nodes from a given node
 */
export function getPossibleNextNodes(fromNode: NodeName): NodeName[] {
  switch (fromNode) {
    case 'router':
      return ['rag', 'tool_executor', 'confirmation', 'response_generator'];
    case 'rag':
      return ['response_generator'];
    case 'tool_executor':
      return ['confirmation', 'response_generator'];
    case 'confirmation':
      return ['tool_executor', 'response_generator'];
    case 'response_generator':
      return ['__end__'];
    default:
      return [];
  }
}

/**
 * Check if a routing path is valid
 */
export function isValidPath(from: NodeName, to: NodeName): boolean {
  const possibleNodes = getPossibleNextNodes(from);
  return possibleNodes.includes(to);
}

/**
 * Get the edge function for a node
 */
export function getEdgeForNode(
  nodeName: NodeName
): ((state: VoiceAgentState) => NodeName) | undefined {
  return CONDITIONAL_EDGES[nodeName as keyof typeof CONDITIONAL_EDGES];
}

// =====================================================
// ROUTING DECISION HELPERS
// =====================================================

/**
 * Should route to RAG based on state
 */
export function shouldRouteToRAG(state: VoiceAgentState): boolean {
  return (
    state.intent === 'rag' &&
    !state.ragResult // Haven't done RAG yet
  );
}

/**
 * Should route to tool executor based on state
 */
export function shouldRouteToToolExecutor(state: VoiceAgentState): boolean {
  return (
    (state.intent === 'tool' || state.intent === 'transfer') &&
    !state.toolResult // Haven't executed tool yet
  );
}

/**
 * Should route to confirmation based on state
 */
export function shouldRouteToConfirmation(state: VoiceAgentState): boolean {
  return (
    state.confirmationStatus === 'pending' &&
    state.intent === 'confirm'
  );
}

/**
 * Is the graph processing complete
 */
export function isProcessingComplete(state: VoiceAgentState): boolean {
  return state.isComplete || Boolean(state.response);
}

// =====================================================
// GRAPH STRUCTURE DEFINITION
// =====================================================

/**
 * Graph structure for documentation and validation
 */
export const GRAPH_STRUCTURE = {
  nodes: [
    'router',
    'rag',
    'tool_executor',
    'confirmation',
    'response_generator',
  ] as const,

  edges: {
    __start__: ['router'],
    router: ['rag', 'tool_executor', 'confirmation', 'response_generator'],
    rag: ['response_generator'],
    tool_executor: ['response_generator'],
    confirmation: ['tool_executor', 'response_generator'],
    response_generator: ['__end__'],
  } as const,

  entryPoint: 'router' as const,

  conditionalEdges: [
    'router',
    'tool_executor',
    'confirmation',
  ] as const,
};

/**
 * Validate graph structure
 */
export function validateGraphStructure(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all edges point to valid nodes
  for (const [from, targets] of Object.entries(GRAPH_STRUCTURE.edges)) {
    for (const to of targets) {
      const specialNodes = ['__end__', '__start__'];
      if (
        !specialNodes.includes(to) &&
        !GRAPH_STRUCTURE.nodes.includes(to as (typeof GRAPH_STRUCTURE.nodes)[number])
      ) {
        errors.push(`Invalid edge: ${from} -> ${to} (node doesn't exist)`);
      }
    }
  }

  // Check entry point exists
  if (!GRAPH_STRUCTURE.nodes.includes(GRAPH_STRUCTURE.entryPoint)) {
    errors.push(`Invalid entry point: ${GRAPH_STRUCTURE.entryPoint}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
