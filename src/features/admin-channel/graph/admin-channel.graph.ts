/**
 * TIS TIS PLATFORM - Admin Channel LangGraph
 *
 * Grafo principal de procesamiento de mensajes del Admin Channel.
 * Conecta todos los nodos y define el flujo de conversación.
 *
 * @module admin-channel/graph/admin-channel.graph
 */

import { END, StateGraph } from '@langchain/langgraph';
import { AdminChannelState, type AdminChannelStateType } from './state';

// Import nodes
import { supervisorNode } from './nodes/supervisor.node';
import { analyticsHandlerNode } from './nodes/analytics-handler.node';
import { greetingHandlerNode } from './nodes/greeting-handler.node';
import { helpHandlerNode } from './nodes/help-handler.node';
import { configHandlerNode } from './nodes/config-handler.node';
import { operationHandlerNode } from './nodes/operation-handler.node';
import { notificationHandlerNode } from './nodes/notification-handler.node';
import { confirmHandlerNode } from './nodes/confirm-handler.node';
import { cancelHandlerNode } from './nodes/cancel-handler.node';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Graph]';

// =====================================================
// BUILD GRAPH
// =====================================================

/**
 * Construye y compila el grafo de LangGraph para el Admin Channel.
 * El flujo es:
 *   START -> supervisor -> [handler según intent] -> END
 *
 * @returns CompiledGraph listo para invocar
 */
export function buildAdminChannelGraph() {
  console.log(`${LOG_PREFIX} Building graph...`);

  const workflow = new StateGraph(AdminChannelState)
    // === NODOS ===
    .addNode('supervisor', supervisorNode)
    .addNode('analytics_handler', analyticsHandlerNode)
    .addNode('greeting_handler', greetingHandlerNode)
    .addNode('help_handler', helpHandlerNode)
    .addNode('config_handler', configHandlerNode)
    .addNode('operation_handler', operationHandlerNode)
    .addNode('notification_handler', notificationHandlerNode)
    .addNode('confirm_handler', confirmHandlerNode)
    .addNode('cancel_handler', cancelHandlerNode)

    // === EDGES ===
    // Siempre empezar en supervisor
    .addEdge('__start__', 'supervisor')

    // Router condicional desde supervisor
    .addConditionalEdges(
      'supervisor',
      routeFromSupervisor,
      {
        analytics_handler: 'analytics_handler',
        greeting_handler: 'greeting_handler',
        help_handler: 'help_handler',
        config_handler: 'config_handler',
        operation_handler: 'operation_handler',
        notification_handler: 'notification_handler',
        confirm_handler: 'confirm_handler',
        cancel_handler: 'cancel_handler',
        __end__: END,
      }
    )

    // Todos los handlers terminan
    .addEdge('analytics_handler', END)
    .addEdge('greeting_handler', END)
    .addEdge('help_handler', END)
    .addEdge('config_handler', END)
    .addEdge('operation_handler', END)
    .addEdge('notification_handler', END)
    .addEdge('confirm_handler', END)
    .addEdge('cancel_handler', END);

  const graph = workflow.compile();
  console.log(`${LOG_PREFIX} Graph compiled successfully`);

  return graph;
}

// =====================================================
// ROUTING FUNCTION
// =====================================================

/**
 * Determina el siguiente nodo basado en el estado del supervisor.
 * Si shouldEnd es true o hay una respuesta lista, termina.
 * De lo contrario, enruta al handler correspondiente.
 */
function routeFromSupervisor(
  state: AdminChannelStateType
): string {
  // P0: Check iteration limit to prevent infinite loops
  if (state.iterationCount >= state.maxIterations) {
    console.warn(`${LOG_PREFIX} Max iterations (${state.maxIterations}) reached, forcing end`);
    return '__end__';
  }

  // Si el supervisor ya generó una respuesta (ej: permiso denegado)
  if (state.shouldEnd && state.response) {
    return '__end__';
  }

  // Si hay error, ir a help
  if (state.error) {
    return 'help_handler';
  }

  // Enrutar según currentNode (set by supervisor)
  const currentNode = state.currentNode || 'help_handler';

  // Validar que el nodo existe
  const validNodes = [
    'analytics_handler',
    'greeting_handler',
    'help_handler',
    'config_handler',
    'operation_handler',
    'notification_handler',
    'confirm_handler',
    'cancel_handler',
  ];

  if (validNodes.includes(currentNode)) {
    return currentNode;
  }

  // Default a help si el nodo no es válido
  console.warn(`${LOG_PREFIX} Unknown node: ${currentNode}, defaulting to help_handler`);
  return 'help_handler';
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let graphInstance: ReturnType<typeof buildAdminChannelGraph> | null = null;

/**
 * Obtiene la instancia singleton del grafo compilado.
 * Lazy initialization para evitar compilar hasta que se necesite.
 */
export function getAdminChannelGraph() {
  if (!graphInstance) {
    graphInstance = buildAdminChannelGraph();
  }
  return graphInstance;
}

/**
 * Reinicia el grafo (útil para hot reload en desarrollo).
 */
export function resetAdminChannelGraph() {
  graphInstance = null;
}

// =====================================================
// EXPORTS
// =====================================================

export { routeFromSupervisor };
export type { AdminChannelStateType };
