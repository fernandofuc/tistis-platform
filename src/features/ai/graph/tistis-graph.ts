// =====================================================
// TIS TIS PLATFORM - Main LangGraph
// Grafo principal que orquesta todos los agentes
// =====================================================

import { StateGraph, END, START } from '@langchain/langgraph';
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages';
import {
  TISTISAgentState,
  type TISTISAgentStateType,
  createInitialState,
  getProcessingTimeMs,
} from '../state';
import { supervisorNode } from '../agents/supervisor';
import { verticalRouterNode } from '../agents/routing';
import {
  greetingNode,
  pricingNode,
  locationNode,
  hoursNode,
  faqNode,
  bookingNode,
  bookingDentalNode,
  bookingRestaurantNode,
  bookingMedicalNode,
  orderingRestaurantNode,
  invoicingRestaurantNode,
  generalNode,
  escalationNode,
  urgentCareNode,
} from '../agents/specialists';

// ======================
// GRAPH CONFIGURATION
// ======================

const MAX_ITERATIONS = 5;

// ======================
// HELPER NODES
// ======================

/**
 * Nodo de inicialización
 * Prepara el estado inicial con el mensaje del usuario
 * IMPORTANTE: Preserva mensajes previos para conversaciones multi-turn
 */
async function initializeNode(
  state: TISTISAgentStateType
): Promise<Partial<TISTISAgentStateType>> {
  console.log('[Graph] Initializing...');

  // Preservar mensajes previos (de conversaciones multi-turn) y agregar el mensaje actual
  const existingMessages = state.messages || [];
  const updatedMessages = [...existingMessages, new HumanMessage(state.current_message)];

  console.log(`[Graph] Messages: ${existingMessages.length} previous + 1 current = ${updatedMessages.length} total`);

  return {
    messages: updatedMessages,
    processing_started_at: new Date().toISOString(),
    control: {
      ...state.control,
      iteration_count: 0,
    },
  };
}

/**
 * Nodo de finalización
 * Prepara la respuesta final y limpia el estado
 */
async function finalizeNode(
  state: TISTISAgentStateType
): Promise<Partial<TISTISAgentStateType>> {
  const processingTime = getProcessingTimeMs(state);

  console.log(`[Graph] Finalizing. Total time: ${processingTime}ms`);
  console.log(`[Graph] Final response: "${state.final_response?.substring(0, 50)}..."`);
  console.log(`[Graph] Agents used: ${state.agent_trace.map((t) => t.agent_name).join(' -> ')}`);

  return {
    control: {
      ...state.control,
      response_ready: true,
    },
  };
}

// ======================
// CONDITIONAL ROUTING
// ======================

/**
 * Router principal después del supervisor
 * Decide si ir al vertical router o directamente al agente
 */
function mainRouter(state: TISTISAgentStateType): string {
  // Si debe escalar, ir directo a escalación
  if (state.control.should_escalate) {
    return 'escalation';
  }

  // Si alcanzó límite de iteraciones
  if (state.control.iteration_count >= MAX_ITERATIONS) {
    console.log('[Graph] Max iterations reached, escalating');
    return 'escalation';
  }

  // Si ya tiene respuesta lista, finalizar
  if (state.control.response_ready && state.final_response) {
    return 'finalize';
  }

  // Ir al vertical router para routing especializado
  return 'vertical_router';
}

/**
 * Router después del vertical router
 * Dirige al agente especializado correcto
 */
function agentRouter(state: TISTISAgentStateType): string {
  const nextAgent = state.next_agent || 'general';

  // Mapear nombres de agentes a nodos del grafo
  const agentMapping: Record<string, string> = {
    greeting: 'greeting',
    pricing: 'pricing',
    location: 'location',
    hours: 'hours',
    faq: 'faq',
    booking: 'booking',
    booking_dental: 'booking_dental',
    booking_restaurant: 'booking_restaurant',
    booking_medical: 'booking_medical',
    booking_services: 'booking', // fallback
    booking_retail: 'booking', // fallback
    booking_general: 'booking', // fallback
    ordering_restaurant: 'ordering_restaurant', // Restaurant pickup/delivery
    invoicing_restaurant: 'invoicing_restaurant', // Restaurant invoicing (CFDI)
    general: 'general',
    escalation: 'escalation',
    urgent_care: 'urgent_care',
  };

  const targetNode = agentMapping[nextAgent] || 'general';
  console.log(`[Graph] Routing to: ${targetNode}`);

  return targetNode;
}

/**
 * Router post-agente
 * Decide si finalizar, hacer handoff, o escalar
 */
function postAgentRouter(state: TISTISAgentStateType): string {
  // Si debe escalar
  if (state.control.should_escalate) {
    return 'escalation';
  }

  // Si tiene respuesta lista, finalizar
  if (state.final_response && state.control.response_ready) {
    return 'finalize';
  }

  // Si hay handoff pendiente
  if (state.next_agent && state.next_agent !== state.current_agent) {
    // Verificar límite de iteraciones
    if (state.control.iteration_count >= MAX_ITERATIONS) {
      return 'escalation';
    }
    return agentRouter(state);
  }

  // Por defecto, finalizar si hay respuesta
  if (state.final_response) {
    return 'finalize';
  }

  // Si no hay respuesta, usar general
  return 'general';
}

// ======================
// BUILD GRAPH
// ======================

/**
 * Construye el grafo principal de TIS TIS
 */
export function buildTISTISGraph() {
  // Crear el StateGraph con el estado definido
  const workflow = new StateGraph(TISTISAgentState)
    // =====================================================
    // NODOS DE CONTROL
    // =====================================================
    .addNode('initialize', initializeNode)
    .addNode('finalize', finalizeNode)

    // =====================================================
    // NODOS DE ORQUESTACIÓN
    // =====================================================
    .addNode('supervisor', supervisorNode)
    .addNode('vertical_router', verticalRouterNode)

    // =====================================================
    // NODOS DE AGENTES ESPECIALISTAS
    // =====================================================
    .addNode('greeting', greetingNode)
    .addNode('pricing', pricingNode)
    .addNode('location', locationNode)
    .addNode('hours', hoursNode)
    .addNode('faq', faqNode)
    .addNode('booking', bookingNode)
    .addNode('booking_dental', bookingDentalNode)
    .addNode('booking_restaurant', bookingRestaurantNode)
    .addNode('booking_medical', bookingMedicalNode)
    .addNode('ordering_restaurant', orderingRestaurantNode)
    .addNode('invoicing_restaurant', invoicingRestaurantNode)
    .addNode('general', generalNode)
    .addNode('escalation', escalationNode)
    .addNode('urgent_care', urgentCareNode)

    // =====================================================
    // EDGES - FLUJO PRINCIPAL
    // =====================================================

    // START -> initialize
    .addEdge(START, 'initialize')

    // initialize -> supervisor
    .addEdge('initialize', 'supervisor')

    // supervisor -> mainRouter (conditional)
    .addConditionalEdges('supervisor', mainRouter, {
      vertical_router: 'vertical_router',
      escalation: 'escalation',
      finalize: 'finalize',
    })

    // vertical_router -> agentRouter (conditional)
    .addConditionalEdges('vertical_router', agentRouter, {
      greeting: 'greeting',
      pricing: 'pricing',
      location: 'location',
      hours: 'hours',
      faq: 'faq',
      booking: 'booking',
      booking_dental: 'booking_dental',
      booking_restaurant: 'booking_restaurant',
      booking_medical: 'booking_medical',
      ordering_restaurant: 'ordering_restaurant',
      invoicing_restaurant: 'invoicing_restaurant',
      general: 'general',
      escalation: 'escalation',
      urgent_care: 'urgent_care',
    })

    // =====================================================
    // EDGES - POST-AGENTE (cada agente puede hacer handoff)
    // =====================================================

    // Greeting -> postAgentRouter
    .addConditionalEdges('greeting', postAgentRouter, {
      pricing: 'pricing',
      booking: 'booking',
      booking_dental: 'booking_dental',
      booking_restaurant: 'booking_restaurant',
      booking_medical: 'booking_medical',
      faq: 'faq',
      location: 'location',
      hours: 'hours',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // Pricing -> postAgentRouter
    .addConditionalEdges('pricing', postAgentRouter, {
      booking: 'booking',
      booking_dental: 'booking_dental',
      booking_restaurant: 'booking_restaurant',
      booking_medical: 'booking_medical',
      faq: 'faq',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // Location -> postAgentRouter
    .addConditionalEdges('location', postAgentRouter, {
      booking: 'booking',
      hours: 'hours',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // Hours -> postAgentRouter
    .addConditionalEdges('hours', postAgentRouter, {
      booking: 'booking',
      location: 'location',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // FAQ -> postAgentRouter
    .addConditionalEdges('faq', postAgentRouter, {
      pricing: 'pricing',
      booking: 'booking',
      booking_dental: 'booking_dental',
      booking_restaurant: 'booking_restaurant',
      booking_medical: 'booking_medical',
      location: 'location',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // Booking agents -> postAgentRouter
    .addConditionalEdges('booking', postAgentRouter, {
      pricing: 'pricing',
      location: 'location',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    .addConditionalEdges('booking_dental', postAgentRouter, {
      pricing: 'pricing',
      location: 'location',
      escalation: 'escalation',
      urgent_care: 'urgent_care',
      general: 'general',
      finalize: 'finalize',
    })

    .addConditionalEdges('booking_restaurant', postAgentRouter, {
      pricing: 'pricing',
      location: 'location',
      ordering_restaurant: 'ordering_restaurant',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // Ordering Restaurant -> postAgentRouter
    .addConditionalEdges('ordering_restaurant', postAgentRouter, {
      pricing: 'pricing',
      location: 'location',
      booking_restaurant: 'booking_restaurant',
      escalation: 'escalation',
      general: 'general',
      finalize: 'finalize',
    })

    // Invoicing Restaurant -> postAgentRouter
    .addConditionalEdges('invoicing_restaurant', postAgentRouter, {
      general: 'general',
      escalation: 'escalation',
      finalize: 'finalize',
    })

    .addConditionalEdges('booking_medical', postAgentRouter, {
      pricing: 'pricing',
      location: 'location',
      escalation: 'escalation',
      urgent_care: 'urgent_care',
      general: 'general',
      finalize: 'finalize',
    })

    // General -> postAgentRouter
    .addConditionalEdges('general', postAgentRouter, {
      pricing: 'pricing',
      booking: 'booking',
      faq: 'faq',
      location: 'location',
      escalation: 'escalation',
      finalize: 'finalize',
    })

    // Urgent Care -> postAgentRouter
    .addConditionalEdges('urgent_care', postAgentRouter, {
      booking: 'booking',
      booking_dental: 'booking_dental',
      booking_medical: 'booking_medical',
      escalation: 'escalation',
      finalize: 'finalize',
    })

    // Escalation -> finalize (siempre termina)
    .addEdge('escalation', 'finalize')

    // Finalize -> END
    .addEdge('finalize', END);

  return workflow;
}

// ======================
// COMPILED GRAPH (SINGLETON)
// ======================

// U6 FIX: Cache the compiled graph to prevent memory leak
// Compiling on every request creates new objects that accumulate
let _compiledGraph: ReturnType<ReturnType<typeof buildTISTISGraph>['compile']> | null = null;
let _graphVersion = 0;

/**
 * Compila el grafo para ejecución (singleton)
 * FIXED: Uses singleton pattern to prevent memory leak from repeated compilation
 */
export function compileTISTISGraph() {
  if (!_compiledGraph) {
    console.log('[Graph] Compiling graph (first time)...');
    const workflow = buildTISTISGraph();
    _compiledGraph = workflow.compile();
    _graphVersion++;
    console.log(`[Graph] Graph compiled, version ${_graphVersion}`);
  }
  return _compiledGraph;
}

/**
 * Forces recompilation of the graph (use after code changes in dev)
 */
export function invalidateGraphCache(): void {
  _compiledGraph = null;
  console.log('[Graph] Graph cache invalidated, will recompile on next execution');
}

// ======================
// EXECUTION INTERFACE
// ======================

export interface GraphExecutionInput {
  tenant_id: string;
  conversation_id: string;
  lead_id: string;
  current_message: string;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat' | 'voice';
  tenant_context: TISTISAgentStateType['tenant'];
  lead_context: TISTISAgentStateType['lead'];
  conversation_context: TISTISAgentStateType['conversation'];
  business_context: TISTISAgentStateType['business_context'];
  /** Historial de mensajes previos (para preview multi-turn) */
  previous_messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface GraphExecutionResult {
  success: boolean;
  response: string;
  intent: string;
  signals: Array<{ signal: string; points: number }>;
  score_change: number;
  escalated: boolean;
  escalation_reason?: string;
  tokens_used: number;
  processing_time_ms: number;
  agents_used: string[];
  booking_result?: TISTISAgentStateType['booking_result'];
  errors?: string[];
}

/**
 * Ejecuta el grafo completo con el input proporcionado
 */
export async function executeGraph(
  input: GraphExecutionInput
): Promise<GraphExecutionResult> {
  const startTime = Date.now();

  console.log(`[Graph] Starting execution for conversation ${input.conversation_id}`);

  try {
    // Compilar el grafo
    const graph = compileTISTISGraph();

    // Construir historial de mensajes previos si existe (para preview multi-turn)
    const previousMessages: BaseMessage[] = [];
    if (input.previous_messages && input.previous_messages.length > 0) {
      for (const msg of input.previous_messages) {
        if (msg.role === 'user') {
          previousMessages.push(new HumanMessage(msg.content));
        } else {
          previousMessages.push(new AIMessage(msg.content));
        }
      }
      console.log(`[Graph] Loaded ${previousMessages.length} previous messages for context`);
    }

    // Preparar estado inicial
    const initialState: Partial<TISTISAgentStateType> = {
      ...createInitialState(),
      messages: previousMessages, // Inyectar historial previo
      tenant: input.tenant_context,
      lead: input.lead_context,
      conversation: input.conversation_context,
      business_context: input.business_context,
      current_message: input.current_message,
      channel: input.channel,
      vertical: input.tenant_context?.vertical || 'dental', // Default to dental (active vertical)
    };

    // Ejecutar el grafo
    const finalState = await graph.invoke(initialState);

    const processingTime = Date.now() - startTime;

    console.log(`[Graph] Execution completed in ${processingTime}ms`);

    return {
      success: true,
      response: finalState.final_response || 'Lo siento, no pude procesar tu mensaje.',
      intent: finalState.detected_intent || 'UNKNOWN',
      signals: finalState.detected_signals || [],
      score_change: finalState.score_change || 0,
      escalated: finalState.control?.should_escalate || false,
      escalation_reason: finalState.control?.escalation_reason,
      tokens_used: finalState.tokens_used || 0,
      processing_time_ms: processingTime,
      agents_used: finalState.agent_trace?.map((t) => t.agent_name) || [],
      booking_result: finalState.booking_result,
      errors: finalState.errors,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[Graph] Execution error:', error);

    return {
      success: false,
      response: 'Disculpa, estoy experimentando dificultades técnicas. Un asesor te atenderá pronto.',
      intent: 'UNKNOWN',
      signals: [],
      score_change: 0,
      escalated: true,
      escalation_reason: `Error en el grafo: ${error instanceof Error ? error.message : 'Unknown'}`,
      tokens_used: 0,
      processing_time_ms: processingTime,
      agents_used: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// ======================
// EXPORTS
// ======================

export const TISTISGraph = {
  build: buildTISTISGraph,
  compile: compileTISTISGraph,
  execute: executeGraph,
  invalidateCache: invalidateGraphCache,
};
