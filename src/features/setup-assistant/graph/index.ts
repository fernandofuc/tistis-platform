// =====================================================
// TIS TIS PLATFORM - Setup Assistant Graph
// LangGraph workflow for the setup assistant
// Now with checkpointing for session recovery
// =====================================================

import { StateGraph, END, START } from '@langchain/langgraph';
import { SetupAssistantState, type SetupAssistantStateType } from '../state/setup-state';
import { supervisorNode } from '../nodes/supervisor';
import {
  generalSetupNode,
  loyaltyConfigNode,
  servicesConfigNode,
  knowledgeBaseNode,
  agentsConfigNode,
  promotionsConfigNode,
  helpNode,
} from '../nodes/config-handlers';
import { executorNode } from '../nodes/executor';
import { getCheckpointer } from '../services/checkpointer.service';

// =====================================================
// ROUTING FUNCTIONS
// =====================================================

/**
 * Routes from supervisor to the appropriate config handler
 */
function routeAfterSupervisor(state: SetupAssistantStateType): string {
  const { detectedIntent, intentConfidence } = state;

  // If confidence is low, ask for help
  if (intentConfidence < 0.5) {
    return 'help';
  }

  switch (detectedIntent) {
    case 'general_setup':
      return 'general_setup';
    case 'loyalty_config':
      return 'loyalty_config';
    case 'services_config':
      return 'services_config';
    case 'knowledge_base':
      return 'knowledge_base';
    case 'agents_config':
      return 'agents_config';
    case 'promotions_config':
      return 'promotions_config';
    case 'staff_config':
      return 'general_setup'; // Fallback to general for now
    case 'branches_config':
      return 'general_setup'; // Fallback to general for now
    case 'confirm':
      return 'help'; // Let help handler deal with confirmations
    case 'cancel':
      return 'help'; // Let help handler deal with cancellations
    case 'help':
    case 'unknown':
    default:
      return 'help';
  }
}

/**
 * Determines if actions should be executed after a config handler
 */
function routeAfterHandler(state: SetupAssistantStateType): string {
  if (state.pendingActions.length > 0) {
    return 'executor';
  }
  return 'end';
}

// =====================================================
// BUILD GRAPH
// =====================================================

export function buildSetupAssistantGraph() {
  // Build the graph using fluent API for proper type inference
  const workflow = new StateGraph(SetupAssistantState)
    // =====================================================
    // NODES
    // =====================================================
    .addNode('supervisor', supervisorNode)
    .addNode('general_setup', generalSetupNode)
    .addNode('loyalty_config', loyaltyConfigNode)
    .addNode('services_config', servicesConfigNode)
    .addNode('knowledge_base', knowledgeBaseNode)
    .addNode('agents_config', agentsConfigNode)
    .addNode('promotions_config', promotionsConfigNode)
    .addNode('help', helpNode)
    .addNode('executor', executorNode)

    // =====================================================
    // EDGES
    // =====================================================

    // START -> supervisor
    .addEdge(START, 'supervisor')

    // supervisor -> handler (conditional)
    .addConditionalEdges('supervisor', routeAfterSupervisor, {
      general_setup: 'general_setup',
      loyalty_config: 'loyalty_config',
      services_config: 'services_config',
      knowledge_base: 'knowledge_base',
      agents_config: 'agents_config',
      promotions_config: 'promotions_config',
      help: 'help',
    })

    // Each handler -> executor or END (conditional)
    .addConditionalEdges('general_setup', routeAfterHandler, {
      executor: 'executor',
      end: END,
    })
    .addConditionalEdges('loyalty_config', routeAfterHandler, {
      executor: 'executor',
      end: END,
    })
    .addConditionalEdges('services_config', routeAfterHandler, {
      executor: 'executor',
      end: END,
    })
    .addConditionalEdges('knowledge_base', routeAfterHandler, {
      executor: 'executor',
      end: END,
    })
    .addConditionalEdges('agents_config', routeAfterHandler, {
      executor: 'executor',
      end: END,
    })
    .addConditionalEdges('promotions_config', routeAfterHandler, {
      executor: 'executor',
      end: END,
    })

    // help -> END
    .addEdge('help', END)

    // executor -> END
    .addEdge('executor', END);

  // Compile with checkpointer for session recovery
  const checkpointer = getCheckpointer();
  return workflow.compile({ checkpointer });
}

// =====================================================
// GRAPH INSTANCE (Lazy initialization)
// =====================================================

let _setupAssistantGraph: ReturnType<typeof buildSetupAssistantGraph> | null = null;

export function getSetupAssistantGraph() {
  if (!_setupAssistantGraph) {
    console.log('[SetupAssistant] Compiling graph with checkpointing...');
    _setupAssistantGraph = buildSetupAssistantGraph();
  }
  return _setupAssistantGraph;
}

/**
 * Invalidates the graph cache (for development hot reload)
 */
export function invalidateSetupGraphCache(): void {
  _setupAssistantGraph = null;
  console.log('[SetupAssistant] Graph cache invalidated');
}

// =====================================================
// GRAPH INVOCATION WITH CHECKPOINTING
// =====================================================

export interface InvokeConfig {
  /** Conversation ID - used as thread_id for checkpointing */
  conversationId: string;
  /** Optional checkpoint ID to resume from */
  checkpointId?: string;
}

/**
 * Export graph with checkpointing support
 * Uses conversationId as thread_id for state persistence
 */
export const setupAssistantGraph = {
  /**
   * Invoke the graph with automatic checkpointing
   * State is persisted to Supabase after each node execution
   */
  invoke: async (
    initialState: Partial<SetupAssistantStateType>,
    config?: InvokeConfig
  ) => {
    const graph = getSetupAssistantGraph();

    // If no config provided, invoke without checkpointing
    if (!config) {
      return graph.invoke(initialState);
    }

    // Invoke with thread configuration for checkpointing
    return graph.invoke(initialState, {
      configurable: {
        thread_id: config.conversationId,
        checkpoint_id: config.checkpointId,
      },
    });
  },

  /**
   * Get the latest state for a conversation from checkpoint
   * Returns null if no checkpoint exists
   */
  getState: async (conversationId: string) => {
    const graph = getSetupAssistantGraph();
    try {
      const state = await graph.getState({
        configurable: {
          thread_id: conversationId,
        },
      });
      return state;
    } catch {
      return null;
    }
  },

  /**
   * Get state history for a conversation
   */
  getStateHistory: async function* (conversationId: string, limit = 10) {
    const graph = getSetupAssistantGraph();
    const config = {
      configurable: {
        thread_id: conversationId,
      },
    };

    let count = 0;
    for await (const state of graph.getStateHistory(config)) {
      if (count >= limit) break;
      yield state;
      count++;
    }
  },
};
