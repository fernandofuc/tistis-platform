/**
 * TIS TIS PLATFORM - Admin Channel Message Processor
 *
 * Procesa mensajes entrantes del Admin Channel usando LangGraph
 * para detección de intents y generación de respuestas inteligentes.
 *
 * CHANGELOG v4.9.1:
 * - Integración con get_tenant_ai_context RPC para contexto de negocio
 * - BusinessContext disponible para todos los handlers
 * - Servicios, FAQs, sucursales y promociones en el estado del grafo
 *
 * CHANGELOG v4.9.0:
 * - Conectado al grafo LangGraph existente
 * - Respuestas reales de analytics usando AnalyticsService
 * - Integración completa con nodos especializados
 *
 * @module admin-channel/services/message-processor
 */

import type {
  AdminIntent,
  AdminChannelUserWithTenant,
  AdminExecutedAction,
  AdminChannelContext,
  AdminChannelType,
  AdminBusinessContext,
} from '../types';

import { getAdminChannelGraph } from '../graph/admin-channel.graph';
import type { AdminChannelStateType } from '../graph/state';
import {
  businessContextService,
  type BusinessContext,
} from '@/src/shared/services/business-context.service';

// =====================================================
// TYPES
// =====================================================

export interface ProcessMessageInput {
  /** Contexto del usuario (tenant, permisos, etc) */
  user: AdminChannelUserWithTenant;
  /** ID de la conversacion */
  conversationId: string;
  /** Contenido del mensaje */
  message: string;
  /** ID del mensaje guardado */
  messageId: string;
  /** Canal de comunicación */
  channel?: AdminChannelType;
  /** Historial de conversación (últimos mensajes) */
  conversationHistory?: Array<{ role: string; content: string }>;
  /** Datos de callback (para botones de Telegram) */
  callbackData?: {
    action: string;
    actionId: string;
  };
}

export interface ProcessMessageResult {
  /** Respuesta generada para el usuario */
  response: string;
  /** Intent detectado */
  intent: AdminIntent;
  /** Confianza de la deteccion (0-1) */
  confidence: number;
  /** Datos extraidos del mensaje */
  extractedData: Record<string, unknown>;
  /** Acciones ejecutadas */
  actionsExecuted: AdminExecutedAction[];
  /** Tokens consumidos */
  tokens: {
    input: number;
    output: number;
  };
  /** Teclado para Telegram (opcional) */
  keyboard?: Array<Array<{ text: string; callback_data: string }>> | null;
}

// =====================================================
// LOGGING
// =====================================================

const LOG_PREFIX = '[Admin Channel Processor]';

// =====================================================
// BUILD CONTEXT FOR LANGGRAPH
// =====================================================

/**
 * Transforma BusinessContext del servicio compartido a AdminBusinessContext.
 * Convierte snake_case a camelCase y adapta tipos.
 */
function transformBusinessContext(
  businessContext: BusinessContext | null
): AdminBusinessContext | null {
  if (!businessContext) {
    return null;
  }

  return {
    services: businessContext.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      durationMinutes: s.duration_minutes,
      category: s.category,
      isPopular: s.is_popular,
      isActive: true, // Assuming all services from context are active
    })),
    branches: businessContext.branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      hours: b.hours as Record<string, { open: string; close: string }> | null,
      isMain: b.is_main,
    })),
    faqs: businessContext.faqs.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
    })),
    promotions: businessContext.promotions.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      discountType: p.discount_type,
      discountValue: p.discount_value,
      validFrom: p.valid_from,
      validTo: p.valid_to,
      conditions: p.conditions,
    })),
    knowledgeDocs: businessContext.knowledge_docs.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      type: d.type,
    })),
    aiConfig: businessContext.ai_config
      ? {
          systemPrompt: businessContext.ai_config.system_prompt,
          model: businessContext.ai_config.model,
          temperature: businessContext.ai_config.temperature,
          responseStyle: businessContext.ai_config.response_style,
          maxResponseLength: businessContext.ai_config.max_response_length,
          autoEscalateKeywords: businessContext.ai_config.auto_escalate_keywords,
        }
      : null,
    loadedAt: new Date(),
  };
}

/**
 * Construye el contexto necesario para el grafo LangGraph
 */
function buildGraphContext(
  user: AdminChannelUserWithTenant,
  conversationId: string,
  channel: AdminChannelType,
  businessContext: AdminBusinessContext | null
): AdminChannelContext {
  return {
    user: {
      userId: user.userId,
      tenantId: user.tenantId,
      staffId: user.staffId,
      status: user.status,
      canViewAnalytics: user.canViewAnalytics,
      canConfigure: user.canConfigure,
      canReceiveNotifications: user.canReceiveNotifications,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
      tenantName: user.tenantName,
      tenantVertical: user.tenantVertical,
    },
    conversationId,
    tenantId: user.tenantId,
    tenantName: user.tenantName,
    vertical: user.tenantVertical,
    channel,
    conversationContext: null,
    businessContext,
  };
}

/**
 * Construye el estado inicial para el grafo
 */
function buildInitialState(
  input: ProcessMessageInput,
  businessContext: AdminBusinessContext | null
): Partial<AdminChannelStateType> {
  const channel = input.channel || 'whatsapp';

  return {
    context: buildGraphContext(input.user, input.conversationId, channel, businessContext),
    userMessage: input.message,
    messageId: input.messageId,
    conversationHistory: input.conversationHistory || [],
    // Reset state for new message
    detectedIntent: 'unknown',
    intentConfidence: 0,
    extractedEntities: {},
    response: '',
    keyboard: null,
    shouldEnd: false,
    error: null,
    iterationCount: 0,
    maxIterations: 10,
    analyticsData: null,
    pendingAction: null,
    executedActions: [],
    tokens: { input: 0, output: 0 },
    currentNode: 'supervisor',
  };
}

// =====================================================
// FALLBACK RESPONSES
// =====================================================

/**
 * Respuesta de fallback cuando hay errores
 */
function getFallbackResponse(error: unknown): ProcessMessageResult {
  console.error(`${LOG_PREFIX} Fallback triggered:`, error);

  return {
    response:
      '⚠️ Ocurrió un error procesando tu mensaje.\n\n' +
      'Por favor intenta de nuevo en unos momentos.\n' +
      'Si el problema persiste, escribe "ayuda" para ver las opciones disponibles.',
    intent: 'unknown',
    confidence: 0,
    extractedData: { error: String(error) },
    actionsExecuted: [],
    tokens: { input: 0, output: 0 },
    keyboard: null,
  };
}

/**
 * Respuesta cuando el usuario no tiene permisos
 */
function getPermissionDeniedResponse(
  intent: AdminIntent,
  user: AdminChannelUserWithTenant
): ProcessMessageResult | null {
  // Verificar permisos según el tipo de intent
  if (intent.startsWith('analytics_') && !user.canViewAnalytics) {
    return {
      response:
        '⚠️ No tienes permisos para ver analytics.\n\n' +
        'Contacta al administrador de tu cuenta para solicitar acceso.',
      intent,
      confidence: 1,
      extractedData: { permissionDenied: true },
      actionsExecuted: [],
      tokens: { input: 0, output: 0 },
      keyboard: null,
    };
  }

  if (intent.startsWith('config_') && !user.canConfigure) {
    return {
      response:
        '⚠️ No tienes permisos para modificar la configuración.\n\n' +
        'Contacta al administrador de tu cuenta para solicitar acceso.',
      intent,
      confidence: 1,
      extractedData: { permissionDenied: true },
      actionsExecuted: [],
      tokens: { input: 0, output: 0 },
      keyboard: null,
    };
  }

  return null;
}

// =====================================================
// MAIN PROCESSOR
// =====================================================

/**
 * Procesa un mensaje entrante del Admin Channel usando LangGraph.
 *
 * El flujo es:
 * 1. Cargar contexto de negocio via get_tenant_ai_context RPC
 *    - Servicios, sucursales, FAQs, promociones, documentos de conocimiento
 * 2. Construir estado inicial con contexto del usuario y negocio
 * 3. Invocar el grafo LangGraph
 * 4. El grafo detecta intent (supervisor) y enruta al handler apropiado
 * 5. El handler genera la respuesta con datos reales del contexto
 * 6. Extraer y retornar la respuesta del estado final
 *
 * @param input - Datos del mensaje a procesar
 * @returns Resultado del procesamiento con respuesta real
 */
export async function processAdminMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageResult> {
  const startTime = Date.now();

  console.log(
    `${LOG_PREFIX} Processing message for tenant "${input.user.tenantName}" via ${input.channel || 'whatsapp'}`
  );
  console.log(`${LOG_PREFIX} Message: "${input.message.substring(0, 100)}${input.message.length > 100 ? '...' : ''}"`);

  try {
    // 1. Cargar contexto de negocio usando get_tenant_ai_context RPC
    console.log(`${LOG_PREFIX} Loading business context for tenant ${input.user.tenantId}...`);
    let businessContext: AdminBusinessContext | null = null;

    try {
      const rawContext = await businessContextService.loadContext(input.user.tenantId, {
        includeServices: true,
        includeBranches: true,
        includeFAQs: true,
        includePromotions: true,
        includeKnowledgeDocs: true,
        includeAIConfig: true,
        onlyPromptDocs: true,
        servicesLimit: 50,
        faqsLimit: 30,
      });

      if (rawContext) {
        businessContext = transformBusinessContext(rawContext);
        console.log(
          `${LOG_PREFIX} Business context loaded: ${businessContext?.services.length || 0} services, ` +
          `${businessContext?.branches.length || 0} branches, ${businessContext?.faqs.length || 0} FAQs`
        );
      } else {
        console.warn(`${LOG_PREFIX} No business context found for tenant`);
      }
    } catch (contextError) {
      console.error(`${LOG_PREFIX} Error loading business context:`, contextError);
      // Continue without business context - handlers will use fallback queries
    }

    // 2. Construir estado inicial con contexto de negocio
    const initialState = buildInitialState(input, businessContext);

    // 3. Obtener instancia del grafo (singleton)
    const graph = getAdminChannelGraph();

    // 4. Invocar el grafo
    console.log(`${LOG_PREFIX} Invoking LangGraph...`);
    const finalState = await graph.invoke(initialState);

    // 5. Extraer resultados del estado final
    const typedState = finalState as AdminChannelStateType;
    const {
      response,
      detectedIntent,
      intentConfidence,
      extractedEntities,
      executedActions,
      tokens,
      keyboard,
      error,
    } = typedState;

    // 6. Verificar si hubo error en el grafo
    if (error) {
      console.error(`${LOG_PREFIX} Graph error: ${error}`);
    }

    // 7. Verificar permisos post-detection (doble verificación)
    const permissionDenied = getPermissionDeniedResponse(detectedIntent, input.user);
    if (permissionDenied) {
      console.log(`${LOG_PREFIX} Permission denied for intent: ${detectedIntent}`);
      return permissionDenied;
    }

    // 8. Log de éxito
    const processingTime = Date.now() - startTime;
    console.log(
      `${LOG_PREFIX} Processed in ${processingTime}ms - Intent: ${detectedIntent} (${(intentConfidence * 100).toFixed(0)}%)`
    );

    return {
      response: response || 'No se pudo generar una respuesta. Intenta con "ayuda".',
      intent: detectedIntent,
      confidence: intentConfidence,
      extractedData: extractedEntities,
      actionsExecuted: executedActions || [],
      tokens: tokens || { input: 0, output: 0 },
      keyboard,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Processing error:`, error);
    return getFallbackResponse(error);
  }
}

// =====================================================
// CALLBACK HANDLER (para botones de Telegram)
// =====================================================

/**
 * Procesa callbacks de botones de Telegram.
 * Convierte el callback_data en un mensaje y lo procesa normalmente.
 */
export async function processCallback(
  input: ProcessMessageInput
): Promise<ProcessMessageResult> {
  if (!input.callbackData) {
    return getFallbackResponse(new Error('No callback data provided'));
  }

  const { action } = input.callbackData;

  // Mapear callback a mensaje
  const callbackToMessage: Record<string, string> = {
    // Analytics
    analytics_sales: '/ventas',
    analytics_leads: '/leads',
    analytics_daily_summary: '/reporte',
    analytics_ai_performance: 'rendimiento de la IA',

    // Config
    config_services: 'configurar servicios',
    config_prices: 'cambiar precios',
    config_hours: 'modificar horarios',
    config_staff: 'gestionar personal',
    config_promotions: 'crear promocion',

    // Notifications
    pause_notifications: 'pausar alertas',
    resume_notifications: 'reanudar alertas',
    config_notification_hours: 'configurar horario de alertas',

    // Confirmations
    confirm_create_service: 'si',
    cancel_action: 'cancelar',
  };

  const mappedMessage = callbackToMessage[action] || action;

  console.log(
    `${LOG_PREFIX} Processing callback: ${action} -> "${mappedMessage}"`
  );

  return processAdminMessage({
    ...input,
    message: mappedMessage,
  });
}

// =====================================================
// EXPORTS
// =====================================================

export default processAdminMessage;
export { buildGraphContext, buildInitialState };
