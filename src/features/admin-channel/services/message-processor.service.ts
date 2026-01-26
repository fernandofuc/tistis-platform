/**
 * TIS TIS PLATFORM - Admin Channel Message Processor
 *
 * Procesa mensajes entrantes del Admin Channel usando deteccion de intents
 * y generacion de respuestas. Preparado para integracion futura con LangGraph.
 *
 * @module admin-channel/services/message-processor
 */

import type {
  AdminIntent,
  AdminChannelUserWithTenant,
  AdminExecutedAction,
} from '../types';

import { INTENT_KEYWORDS } from '../types';

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
  keyboard?: Array<Array<{ text: string; callback_data: string }>>;
}

// =====================================================
// LOGGING
// =====================================================

const LOG_PREFIX = '[Admin Channel Processor]';

// =====================================================
// INTENT DETECTION
// =====================================================

/**
 * Detecta el intent del mensaje usando keywords.
 * En el futuro sera reemplazado por LangGraph con LLM.
 */
function detectIntent(message: string): { intent: AdminIntent; confidence: number } {
  const normalizedMessage = message.toLowerCase().trim();

  // Buscar coincidencias en keywords
  let bestMatch: { intent: AdminIntent; score: number } = {
    intent: 'unknown',
    score: 0,
  };

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS) as [AdminIntent, string[]][]) {
    for (const keyword of keywords) {
      if (normalizedMessage.includes(keyword.toLowerCase())) {
        // Score basado en longitud del keyword (mas especifico = mejor match)
        const score = keyword.length / normalizedMessage.length;
        if (score > bestMatch.score) {
          bestMatch = { intent, score: Math.min(score * 2, 0.95) };
        }
      }
    }
  }

  // Si no hay match, intentar detectar patrones basicos
  if (bestMatch.intent === 'unknown') {
    if (/^\d{6}$/.test(normalizedMessage)) {
      return { intent: 'unknown', confidence: 0.1 }; // Codigo de vinculacion
    }
    if (normalizedMessage.length < 5) {
      return { intent: 'unknown', confidence: 0.2 };
    }
  }

  return {
    intent: bestMatch.intent,
    confidence: Math.max(bestMatch.score, 0.3),
  };
}

// =====================================================
// RESPONSE GENERATION
// =====================================================

/**
 * Genera una respuesta basada en el intent detectado.
 * En el futuro usara LangGraph para respuestas contextuales.
 */
async function generateResponse(
  intent: AdminIntent,
  user: AdminChannelUserWithTenant,
  message: string
): Promise<{
  response: string;
  extractedData: Record<string, unknown>;
  actionsExecuted: AdminExecutedAction[];
  keyboard?: Array<Array<{ text: string; callback_data: string }>>;
}> {
  const { tenantName } = user;

  switch (intent) {
    // =====================================================
    // ANALYTICS INTENTS
    // =====================================================
    case 'analytics_daily_summary':
      return {
        response:
          `📊 *Resumen del dia - ${tenantName}*\n\n` +
          `Esta funcion estara disponible pronto.\n\n` +
          `Mientras tanto, puedes acceder a tus analytics desde el dashboard web.`,
        extractedData: { period: 'daily' },
        actionsExecuted: [],
      };

    case 'analytics_sales':
      return {
        response:
          `💰 *Ventas - ${tenantName}*\n\n` +
          `Para ver tus ventas detalladas, visita el dashboard web.\n\n` +
          `Pronto podras consultar esto aqui directamente.`,
        extractedData: { metric: 'sales' },
        actionsExecuted: [],
      };

    case 'analytics_leads':
      return {
        response:
          `👥 *Leads - ${tenantName}*\n\n` +
          `La consulta de leads estara disponible pronto.\n\n` +
          `Por ahora, revisa tus leads en el dashboard web.`,
        extractedData: { metric: 'leads' },
        actionsExecuted: [],
      };

    // =====================================================
    // CONFIGURATION INTENTS
    // =====================================================
    case 'config_services':
      return {
        response:
          `⚙️ *Configuracion de Servicios*\n\n` +
          `La configuracion de servicios via chat estara disponible pronto.\n\n` +
          `Por ahora, puedes configurar tus servicios desde:\n` +
          `Dashboard > Configuracion > Servicios`,
        extractedData: { configType: 'services' },
        actionsExecuted: [],
      };

    case 'config_prices':
      return {
        response:
          `💵 *Configuracion de Precios*\n\n` +
          `Para actualizar precios, visita:\n` +
          `Dashboard > Configuracion > Servicios\n\n` +
          `La edicion via chat estara disponible pronto.`,
        extractedData: { configType: 'prices' },
        actionsExecuted: [],
      };

    case 'config_hours':
      return {
        response:
          `🕐 *Horarios de Atencion*\n\n` +
          `Para modificar tus horarios, visita:\n` +
          `Dashboard > Configuracion > Sucursales\n\n` +
          `Pronto podras hacer esto desde aqui.`,
        extractedData: { configType: 'hours' },
        actionsExecuted: [],
      };

    // =====================================================
    // OPERATION INTENTS
    // =====================================================
    case 'operation_inventory_check':
      return {
        response:
          `📦 *Inventario*\n\n` +
          `La revision de inventario estara disponible pronto.\n\n` +
          `Por ahora, revisa tu inventario en:\n` +
          `Dashboard > Inventario`,
        extractedData: { operation: 'inventory' },
        actionsExecuted: [],
      };

    case 'operation_escalations':
      return {
        response:
          `🚨 *Escalaciones*\n\n` +
          `No tienes escalaciones pendientes en este momento.\n\n` +
          `Te notificaremos automaticamente cuando haya una.`,
        extractedData: { operation: 'escalations' },
        actionsExecuted: [],
      };

    // =====================================================
    // NOTIFICATION INTENTS
    // =====================================================
    case 'notification_settings':
      return {
        response:
          `🔔 *Configuracion de Notificaciones*\n\n` +
          `Tus notificaciones actuales:\n` +
          `• Resumen diario: Activo\n` +
          `• Leads calientes: Activo\n` +
          `• Escalaciones: Activo\n\n` +
          `Para modificar, visita:\n` +
          `Dashboard > Configuracion > Notificaciones`,
        extractedData: { operation: 'notification_settings' },
        actionsExecuted: [],
        keyboard: [
          [
            { text: '🔕 Pausar todas', callback_data: 'pause_notifications' },
            { text: '⚙️ Configurar', callback_data: 'config_notifications' },
          ],
        ],
      };

    case 'notification_pause':
      return {
        response:
          `🔕 *Notificaciones Pausadas*\n\n` +
          `Tus notificaciones han sido pausadas.\n\n` +
          `Escribe "reanudar alertas" para activarlas de nuevo.`,
        extractedData: { action: 'pause' },
        actionsExecuted: [
          {
            type: 'notification_pause',
            entityType: 'notification_settings',
            success: true,
            executedAt: new Date(),
          },
        ],
      };

    case 'notification_resume':
      return {
        response:
          `🔔 *Notificaciones Activas*\n\n` +
          `Tus notificaciones han sido reactivadas.\n\n` +
          `Recibiras alertas segun tu configuracion.`,
        extractedData: { action: 'resume' },
        actionsExecuted: [
          {
            type: 'notification_resume',
            entityType: 'notification_settings',
            success: true,
            executedAt: new Date(),
          },
        ],
      };

    // =====================================================
    // META INTENTS
    // =====================================================
    case 'help':
      return {
        response:
          `❓ *Ayuda - Canal Administrativo*\n\n` +
          `Puedo ayudarte con:\n\n` +
          `📊 *Analytics*\n` +
          `• "resumen del dia"\n` +
          `• "ventas de hoy"\n` +
          `• "leads nuevos"\n\n` +
          `⚙️ *Configuracion*\n` +
          `• "ver servicios"\n` +
          `• "cambiar horarios"\n\n` +
          `🔔 *Notificaciones*\n` +
          `• "pausar alertas"\n` +
          `• "reanudar alertas"\n\n` +
          `Tambien puedes escribir en lenguaje natural.`,
        extractedData: {},
        actionsExecuted: [],
      };

    case 'greeting':
      return {
        response:
          `👋 ¡Hola! Soy tu asistente de ${tenantName}.\n\n` +
          `¿En que puedo ayudarte hoy?\n\n` +
          `Escribe "ayuda" para ver todas las opciones.`,
        extractedData: {},
        actionsExecuted: [],
      };

    case 'confirm':
      return {
        response:
          `✅ Confirmado.\n\n` +
          `¿Hay algo mas en lo que pueda ayudarte?`,
        extractedData: { confirmed: true },
        actionsExecuted: [],
      };

    case 'cancel':
      return {
        response:
          `❌ Operacion cancelada.\n\n` +
          `¿Necesitas algo mas?`,
        extractedData: { cancelled: true },
        actionsExecuted: [],
      };

    // =====================================================
    // DEFAULT / UNKNOWN
    // =====================================================
    case 'unknown':
    default:
      return {
        response:
          `🤔 No estoy seguro de como ayudarte con eso.\n\n` +
          `Intenta con:\n` +
          `• "resumen del dia" - Ver metricas\n` +
          `• "ayuda" - Ver todas las opciones\n\n` +
          `O describe lo que necesitas de otra forma.`,
        extractedData: { originalMessage: message },
        actionsExecuted: [],
      };
  }
}

// =====================================================
// MAIN PROCESSOR
// =====================================================

/**
 * Procesa un mensaje entrante del Admin Channel.
 *
 * @param input - Datos del mensaje a procesar
 * @returns Resultado del procesamiento
 */
export async function processAdminMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageResult> {
  const startTime = Date.now();

  console.log(
    `${LOG_PREFIX} Processing message for tenant ${input.user.tenantName}`
  );

  try {
    // 1. Detectar intent
    const { intent, confidence } = detectIntent(input.message);
    console.log(`${LOG_PREFIX} Detected intent: ${intent} (${(confidence * 100).toFixed(0)}%)`);

    // 2. Generar respuesta
    const { response, extractedData, actionsExecuted, keyboard } = await generateResponse(
      intent,
      input.user,
      input.message
    );

    // 3. Calcular tokens aproximados (para billing)
    const inputTokens = Math.ceil(input.message.length / 4);
    const outputTokens = Math.ceil(response.length / 4);

    const processingTime = Date.now() - startTime;
    console.log(`${LOG_PREFIX} Processed in ${processingTime}ms`);

    return {
      response,
      intent,
      confidence,
      extractedData,
      actionsExecuted,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
      keyboard,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Processing error:`, error);

    return {
      response:
        `⚠️ Ocurrio un error procesando tu mensaje.\n\n` +
        `Por favor intenta de nuevo o contacta a soporte.`,
      intent: 'unknown',
      confidence: 0,
      extractedData: { error: String(error) },
      actionsExecuted: [],
      tokens: { input: 0, output: 0 },
    };
  }
}

export default processAdminMessage;
