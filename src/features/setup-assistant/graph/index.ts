// =====================================================
// TIS TIS PLATFORM - Setup Assistant Graph
// LangGraph workflow for the setup assistant
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

  return workflow.compile();
}

// =====================================================
// GRAPH INSTANCE (Lazy initialization)
// =====================================================

let _setupAssistantGraph: ReturnType<typeof buildSetupAssistantGraph> | null = null;

export function getSetupAssistantGraph() {
  if (!_setupAssistantGraph) {
    console.log('[SetupAssistant] Compiling graph (first time)...');
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

// Export graph directly for convenience
export const setupAssistantGraph = {
  invoke: async (initialState: Partial<SetupAssistantStateType>) => {
    const graph = getSetupAssistantGraph();
    return graph.invoke(initialState);
  },
};
