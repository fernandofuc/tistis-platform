// =====================================================
// TIS TIS PLATFORM - Main LangGraph
// Grafo principal que orquesta todos los agentes
// MEJORA-2.1: Soporte para checkpointing y persistencia
// =====================================================

import { StateGraph, END, START } from '@langchain/langgraph';
// MEJORA-2.1: Importar servicio de checkpoints
import {
  getCheckpointService,
  isCheckpointServiceReady,
  type CheckpointData,
  type CheckpointMetadata,
} from '../services/checkpoint.service';
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

// Valor por defecto si no hay configuración del tenant
const DEFAULT_MAX_ITERATIONS = 5;

/**
 * Obtiene el límite de iteraciones desde la configuración del tenant
 * o usa el valor por defecto si no está disponible
 */
function getMaxIterations(state: TISTISAgentStateType): number {
  return state.tenant?.ai_config?.max_turns_before_escalation ?? DEFAULT_MAX_ITERATIONS;
}

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

  // Si alcanzó límite de iteraciones (usar configuración del tenant)
  const maxIterations = getMaxIterations(state);
  if (state.control.iteration_count >= maxIterations) {
    console.log(`[Graph] Max iterations (${maxIterations}) reached, escalating`);
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
    // Verificar límite de iteraciones (usar configuración del tenant)
    const maxIterations = getMaxIterations(state);
    if (state.control.iteration_count >= maxIterations) {
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

// ============================================
// MEJORA-2.1: CHECKPOINT HELPERS
// ============================================

/**
 * Genera un ID de checkpoint único
 */
function generateCheckpointId(): string {
  return `cp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convierte el estado del grafo a formato de checkpoint
 */
function stateToCheckpoint(
  state: TISTISAgentStateType,
  checkpointId: string
): CheckpointData {
  return {
    id: checkpointId,
    ts: new Date().toISOString(),
    channel_values: {
      messages: state.messages?.map((m) => ({
        type: m._getType(),
        content: m.content,
      })) || [],
      current_message: state.current_message,
      final_response: state.final_response,
      detected_intent: state.detected_intent,
      detected_signals: state.detected_signals,
      score_change: state.score_change,
      next_agent: state.next_agent,
      current_agent: state.current_agent,
      agent_trace: state.agent_trace,
      control: state.control,
      errors: state.errors,
    },
    channel_versions: {},
    versions_seen: {},
    pending_sends: [],
  };
}

/**
 * Guarda checkpoint después de cada nodo (si está habilitado)
 */
async function saveCheckpointAfterNode(
  threadId: string,
  state: TISTISAgentStateType,
  nodeName: string,
  parentCheckpointId?: string
): Promise<string | undefined> {
  if (!isCheckpointServiceReady()) {
    return undefined;
  }

  try {
    const checkpointService = await getCheckpointService();
    const checkpointId = generateCheckpointId();
    const checkpoint = stateToCheckpoint(state, checkpointId);
    const metadata: CheckpointMetadata = {
      source: nodeName,
      step: state.control?.iteration_count || 0,
      writes: {},
      parents: parentCheckpointId ? { '': parentCheckpointId } : {},
    };

    await checkpointService.putCheckpoint(
      threadId,
      '', // default namespace
      checkpoint,
      metadata,
      parentCheckpointId
    );

    return checkpointId;
  } catch (error) {
    console.error('[Graph] Error saving checkpoint:', error);
    return undefined;
  }
}

/**
 * Type guard para validar mensaje serializado
 */
function isSerializedMessage(value: unknown): value is { type: string; content: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'content' in value &&
    typeof (value as Record<string, unknown>).type === 'string' &&
    typeof (value as Record<string, unknown>).content === 'string'
  );
}

/**
 * Intenta recuperar el estado de un checkpoint
 */
export async function getCheckpointState(
  threadId: string
): Promise<Partial<TISTISAgentStateType> | null> {
  if (!isCheckpointServiceReady()) {
    return null;
  }

  try {
    const checkpointService = await getCheckpointService();
    const tuple = await checkpointService.getLatestCheckpoint(threadId);

    if (!tuple) {
      return null;
    }

    console.log('[Graph] Retrieved checkpoint for thread:', {
      threadId,
      checkpointId: tuple.checkpoint.id,
      step: tuple.metadata?.step,
    });

    // Reconstruir estado desde checkpoint
    const channelValues = tuple.checkpoint.channel_values;

    // Reconstruir mensajes con validación de tipo
    const messages: BaseMessage[] = [];
    const rawMessages = channelValues.messages;

    if (Array.isArray(rawMessages)) {
      for (const msg of rawMessages) {
        if (isSerializedMessage(msg)) {
          if (msg.type === 'human') {
            messages.push(new HumanMessage(msg.content));
          } else if (msg.type === 'ai') {
            messages.push(new AIMessage(msg.content));
          }
        }
      }
    }

    // Extraer valores con validación segura
    const safeString = (val: unknown): string | undefined =>
      typeof val === 'string' ? val : undefined;
    const safeNumber = (val: unknown): number | undefined =>
      typeof val === 'number' ? val : undefined;
    const safeStringArray = (val: unknown): string[] | undefined =>
      Array.isArray(val) && val.every(item => typeof item === 'string') ? val : undefined;

    // Type guard para AgentTraceEntry
    const isAgentTraceEntry = (val: unknown): val is { agent_name: string; started_at: string } =>
      typeof val === 'object' &&
      val !== null &&
      'agent_name' in val &&
      'started_at' in val &&
      typeof (val as Record<string, unknown>).agent_name === 'string' &&
      typeof (val as Record<string, unknown>).started_at === 'string';

    const safeAgentTrace = (val: unknown): TISTISAgentStateType['agent_trace'] | undefined => {
      if (!Array.isArray(val)) return undefined;
      const validEntries = val.filter(isAgentTraceEntry);
      return validEntries.length > 0 ? validEntries as TISTISAgentStateType['agent_trace'] : undefined;
    };

    // Type guard para control object
    const isValidControl = (val: unknown): val is TISTISAgentStateType['control'] =>
      typeof val === 'object' &&
      val !== null &&
      'iteration_count' in val &&
      typeof (val as Record<string, unknown>).iteration_count === 'number';

    // Type guard para detected_signals
    const isSignalArray = (val: unknown): val is Array<{ signal: string; points: number }> =>
      Array.isArray(val) &&
      val.every(item =>
        typeof item === 'object' &&
        item !== null &&
        'signal' in item &&
        'points' in item &&
        typeof (item as Record<string, unknown>).signal === 'string' &&
        typeof (item as Record<string, unknown>).points === 'number'
      );

    const safeSignals = (val: unknown): Array<{ signal: string; points: number }> | undefined =>
      isSignalArray(val) ? val : undefined;

    return {
      messages,
      current_message: safeString(channelValues.current_message) || '',
      final_response: safeString(channelValues.final_response),
      detected_intent: safeString(channelValues.detected_intent),
      detected_signals: safeSignals(channelValues.detected_signals),
      score_change: safeNumber(channelValues.score_change),
      next_agent: safeString(channelValues.next_agent),
      current_agent: safeString(channelValues.current_agent),
      agent_trace: safeAgentTrace(channelValues.agent_trace),
      control: isValidControl(channelValues.control) ? channelValues.control : undefined,
      errors: safeStringArray(channelValues.errors),
    };
  } catch (error) {
    console.error('[Graph] Error retrieving checkpoint:', error);
    return null;
  }
}

/**
 * Verifica si hay un checkpoint que puede ser resumido
 */
export async function hasResumableCheckpoint(threadId: string): Promise<boolean> {
  if (!isCheckpointServiceReady()) {
    return false;
  }

  try {
    const checkpointService = await getCheckpointService();
    const tuple = await checkpointService.getLatestCheckpoint(threadId);
    return tuple !== null;
  } catch {
    return false;
  }
}

/**
 * Limpia checkpoints de un thread específico
 */
export async function clearThreadCheckpoints(threadId: string): Promise<void> {
  if (!isCheckpointServiceReady()) {
    return;
  }

  try {
    const checkpointService = await getCheckpointService();
    await checkpointService.deleteThread(threadId);
    console.log('[Graph] Cleared checkpoints for thread:', threadId);
  } catch (error) {
    console.error('[Graph] Error clearing checkpoints:', error);
  }
}
// MEJORA-2.1: FIN CHECKPOINT HELPERS

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
 * MEJORA-2.1: Soporte para checkpointing y recuperación
 */
export async function executeGraph(
  input: GraphExecutionInput,
  options?: {
    enableCheckpointing?: boolean;
    resumeFromCheckpoint?: boolean;
  }
): Promise<GraphExecutionResult> {
  const startTime = Date.now();
  const threadId = input.conversation_id; // Usamos conversation_id como thread_id
  const enableCheckpointing = options?.enableCheckpointing ?? true;
  const resumeFromCheckpoint = options?.resumeFromCheckpoint ?? false;

  console.log(`[Graph] Starting execution for conversation ${threadId}`, {
    checkpointing: enableCheckpointing,
    resume: resumeFromCheckpoint,
  });

  try {
    // Compilar el grafo
    const graph = compileTISTISGraph();

    // MEJORA-2.1: Intentar resumir desde checkpoint si está habilitado
    let initialState: Partial<TISTISAgentStateType>;

    if (resumeFromCheckpoint && enableCheckpointing) {
      const checkpointState = await getCheckpointState(threadId);

      if (checkpointState && checkpointState.final_response) {
        // Ya tiene respuesta final, retornar directamente
        console.log('[Graph] Checkpoint has final response, returning cached result');
        return {
          success: true,
          response: checkpointState.final_response,
          intent: checkpointState.detected_intent || 'UNKNOWN',
          signals: checkpointState.detected_signals || [],
          score_change: checkpointState.score_change || 0,
          escalated: checkpointState.control?.should_escalate || false,
          escalation_reason: checkpointState.control?.escalation_reason,
          tokens_used: 0,
          processing_time_ms: Date.now() - startTime,
          agents_used: checkpointState.agent_trace?.map((t) => t.agent_name) || [],
          errors: checkpointState.errors,
        };
      }

      if (checkpointState) {
        // Tenemos un checkpoint parcial, continuar desde ahí
        console.log('[Graph] Resuming from checkpoint');
        initialState = {
          ...createInitialState(),
          ...checkpointState,
          tenant: input.tenant_context,
          lead: input.lead_context,
          conversation: input.conversation_context,
          business_context: input.business_context,
          // Actualizar mensaje actual si es diferente
          current_message: input.current_message,
          channel: input.channel,
          vertical: input.tenant_context?.vertical || 'dental',
        };
      } else {
        // No hay checkpoint, iniciar desde cero
        initialState = buildInitialState(input);
      }
    } else {
      // Sin resumir, iniciar desde cero
      initialState = buildInitialState(input);
    }

    // Ejecutar el grafo
    const finalState = await graph.invoke(initialState);

    const processingTime = Date.now() - startTime;

    // MEJORA-2.1: Guardar checkpoint final si está habilitado
    if (enableCheckpointing && finalState) {
      saveCheckpointAfterNode(
        threadId,
        finalState as TISTISAgentStateType,
        'finalize'
      ).catch((err) => {
        console.error('[Graph] Error saving final checkpoint:', err);
      });
    }

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

    // MEJORA-2.1: Intentar recuperar desde checkpoint en caso de error
    if (enableCheckpointing) {
      try {
        const checkpointState = await getCheckpointState(threadId);
        if (checkpointState?.final_response) {
          console.log('[Graph] Recovered response from checkpoint after error');
          return {
            success: true,
            response: checkpointState.final_response,
            intent: checkpointState.detected_intent || 'UNKNOWN',
            signals: checkpointState.detected_signals || [],
            score_change: checkpointState.score_change || 0,
            escalated: checkpointState.control?.should_escalate || false,
            tokens_used: 0,
            processing_time_ms: processingTime,
            agents_used: checkpointState.agent_trace?.map((t) => t.agent_name) || [],
            errors: ['Recovered from checkpoint after error'],
          };
        }
      } catch (recoveryError) {
        console.error('[Graph] Checkpoint recovery failed:', recoveryError);
      }
    }

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

/**
 * Construye el estado inicial del grafo
 * MEJORA-2.1: Función helper para evitar duplicación
 */
function buildInitialState(input: GraphExecutionInput): Partial<TISTISAgentStateType> {
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

  return {
    ...createInitialState(),
    messages: previousMessages,
    tenant: input.tenant_context,
    lead: input.lead_context,
    conversation: input.conversation_context,
    business_context: input.business_context,
    current_message: input.current_message,
    channel: input.channel,
    vertical: input.tenant_context?.vertical || 'dental',
  };
}

/**
 * Intenta resumir una conversación interrumpida
 * MEJORA-2.1: Función pública para resumir desde checkpoint
 */
export async function resumeConversation(
  input: GraphExecutionInput
): Promise<GraphExecutionResult | null> {
  const threadId = input.conversation_id;

  // Verificar si hay un checkpoint
  const hasCheckpoint = await hasResumableCheckpoint(threadId);
  if (!hasCheckpoint) {
    console.log('[Graph] No resumable checkpoint found for thread:', threadId);
    return null;
  }

  console.log('[Graph] Attempting to resume conversation:', threadId);

  // Ejecutar con flag de resume
  return executeGraph(input, {
    enableCheckpointing: true,
    resumeFromCheckpoint: true,
  });
}

// ======================
// EXPORTS
// ======================

export const TISTISGraph = {
  build: buildTISTISGraph,
  compile: compileTISTISGraph,
  execute: executeGraph,
  invalidateCache: invalidateGraphCache,
  // MEJORA-2.1: Nuevas funciones de checkpointing
  resumeConversation,
  getCheckpointState,
  hasResumableCheckpoint,
  clearThreadCheckpoints,
};
