/**
 * TIS TIS PLATFORM - Admin Channel Supervisor Node
 *
 * Detecta intent y enruta a handlers especializados.
 * Usa keyword matching rápido para intents simples y LLM para complejos.
 *
 * @module admin-channel/graph/nodes/supervisor
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AdminChannelStateType } from '../state';
import type { AdminIntent, AdminChannelContext } from '../../types';
import { AI_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';

// =====================================================
// CONFIGURATION
// =====================================================

const LOG_PREFIX = '[AdminChannel/Supervisor]';

/**
 * Modelo para detección de intents en Admin Channel.
 * Usa GPT-5 Mini para balance óptimo entre velocidad y precisión.
 * @see ai-models.ts para configuración centralizada
 */
const model = new ChatOpenAI({
  modelName: AI_MODELS.GPT_5_MINI,
  temperature: 0.1,
  maxTokens: OPENAI_CONFIG.defaultMaxTokens,
});

// =====================================================
// SYSTEM PROMPT
// =====================================================

const SUPERVISOR_PROMPT = `Eres el asistente administrativo de TIS TIS Platform.
Tu trabajo es detectar la intención del usuario y extraer entidades relevantes.

## Intenciones disponibles:

### Analytics (reportes y métricas)
- analytics_daily_summary: Resumen del día actual
- analytics_weekly_summary: Resumen de la semana
- analytics_monthly_summary: Resumen del mes
- analytics_sales: Específicamente ventas
- analytics_leads: Leads y prospectos
- analytics_orders: Pedidos/órdenes (restaurantes)
- analytics_inventory: Inventario/stock
- analytics_ai_performance: Rendimiento del bot/IA

### Configuración
- config_services: Agregar/editar servicios
- config_prices: Cambiar precios
- config_hours: Modificar horarios
- config_staff: Gestionar personal
- config_ai_settings: Configurar IA
- config_promotions: Promociones y descuentos

### Operaciones
- operation_inventory_check: Revisar inventario bajo
- operation_pending_orders: Pedidos pendientes
- operation_escalations: Escalaciones y quejas

### Notificaciones
- notification_settings: Configurar alertas
- notification_pause: Pausar notificaciones
- notification_resume: Reanudar notificaciones

### Meta
- help: Ayuda y comandos
- greeting: Saludos
- confirm: Confirmación de acción
- cancel: Cancelar acción
- unknown: No identificado

## Contexto del negocio:
- Negocio: {tenant_name}
- Vertical: {vertical}
- Permisos del usuario:
  - Ver analytics: {can_view_analytics}
  - Configurar: {can_configure}

## Responde SIEMPRE en formato JSON:
{
  "intent": "nombre_del_intent",
  "confidence": 0.95,
  "entities": {
    "period": "today|week|month",
    "entity_type": "service|staff|etc",
    "value": "valor extraído"
  },
  "reasoning": "Breve explicación"
}`;

// =====================================================
// SUPERVISOR NODE
// =====================================================

export async function supervisorNode(
  state: AdminChannelStateType
): Promise<Partial<AdminChannelStateType>> {
  const startTime = Date.now();

  try {
    const { context, userMessage, conversationHistory } = state;

    // 1. Quick keyword matching para intents simples
    const quickIntent = detectQuickIntent(userMessage);
    if (quickIntent) {
      console.log(
        `${LOG_PREFIX} Quick intent: ${quickIntent.intent} (${quickIntent.confidence})`
      );
      return {
        detectedIntent: quickIntent.intent,
        intentConfidence: quickIntent.confidence,
        extractedEntities: quickIntent.entities,
        currentNode: getNextNode(quickIntent.intent),
        tokens: { input: 0, output: 0 },
      };
    }

    // 2. LLM para intents complejos
    const systemPrompt = SUPERVISOR_PROMPT.replace(
      '{tenant_name}',
      context.tenantName
    )
      .replace('{vertical}', context.vertical)
      .replace('{can_view_analytics}', String(context.user.canViewAnalytics))
      .replace('{can_configure}', String(context.user.canConfigure));

    // Construir historial para contexto
    const recentHistory = conversationHistory
      .slice(-6)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = recentHistory
      ? `Historial reciente:\n${recentHistory}\n\nMensaje actual: ${userMessage}`
      : `Mensaje: ${userMessage}`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // 3. Parsear respuesta (con protección contra ReDoS y errores)
    const content = response.content as string;

    // Usar búsqueda de índices en lugar de regex greedy para evitar ReDoS
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      console.error(`${LOG_PREFIX} Invalid JSON response - no valid JSON object found`);
      return {
        detectedIntent: 'unknown',
        intentConfidence: 0,
        currentNode: 'help_handler',
        error: 'Error detectando intención',
      };
    }

    const jsonString = content.slice(firstBrace, lastBrace + 1);

    // Parsear con try/catch para seguridad
    let parsed: { intent?: string; confidence?: number; entities?: Record<string, unknown> };
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`${LOG_PREFIX} JSON parse error:`, parseError);
      return {
        detectedIntent: 'unknown',
        intentConfidence: 0,
        currentNode: 'help_handler',
        error: 'Error parseando respuesta de IA',
      };
    }

    // Validar estructura del objeto parseado
    if (!parsed.intent || typeof parsed.intent !== 'string') {
      console.error(`${LOG_PREFIX} Invalid parsed structure - missing intent`);
      return {
        detectedIntent: 'unknown',
        intentConfidence: 0,
        currentNode: 'help_handler',
        error: 'Respuesta de IA inválida',
      };
    }

    // 4. Validar permisos
    const intent = parsed.intent as AdminIntent;
    if (!validatePermissions(intent, context)) {
      return {
        detectedIntent: intent,
        intentConfidence: parsed.confidence,
        response: getPermissionDeniedMessage(intent),
        shouldEnd: true,
      };
    }

    // 5. Calcular tokens (aproximación)
    const inputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    const outputTokens = Math.ceil(content.length / 4);

    console.log(
      `${LOG_PREFIX} Intent: ${intent} (${parsed.confidence}) in ${Date.now() - startTime}ms`
    );

    return {
      detectedIntent: intent,
      intentConfidence: parsed.confidence,
      extractedEntities: parsed.entities || {},
      currentNode: getNextNode(intent),
      tokens: { input: inputTokens, output: outputTokens },
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return {
      detectedIntent: 'unknown',
      intentConfidence: 0,
      currentNode: 'help_handler',
      error: 'Error en supervisor',
    };
  }
}

// =====================================================
// QUICK INTENT DETECTION (sin LLM)
// =====================================================

function detectQuickIntent(
  message: string
): { intent: AdminIntent; confidence: number; entities: Record<string, unknown> } | null {
  const lowerMessage = message.toLowerCase().trim();

  // Comandos de Telegram
  if (
    lowerMessage === '/start' ||
    lowerMessage === '/ayuda' ||
    lowerMessage === '/help'
  ) {
    return { intent: 'help', confidence: 1.0, entities: {} };
  }

  if (lowerMessage === '/reporte') {
    return {
      intent: 'analytics_daily_summary',
      confidence: 1.0,
      entities: { period: 'today' },
    };
  }

  if (lowerMessage === '/ventas') {
    return {
      intent: 'analytics_sales',
      confidence: 1.0,
      entities: { period: 'today' },
    };
  }

  if (lowerMessage === '/leads') {
    return {
      intent: 'analytics_leads',
      confidence: 1.0,
      entities: { period: 'today' },
    };
  }

  // Saludos simples
  const greetings = [
    'hola',
    'buenos días',
    'buenas tardes',
    'buenas noches',
    'hey',
    'hi',
  ];
  if (greetings.some((g) => lowerMessage === g || lowerMessage.startsWith(g + ' '))) {
    return { intent: 'greeting', confidence: 1.0, entities: {} };
  }

  // Confirmaciones
  if (['sí', 'si', 'ok', 'dale', 'confirmar', 'adelante'].includes(lowerMessage)) {
    return { intent: 'confirm', confidence: 1.0, entities: {} };
  }

  // Cancelaciones
  if (['no', 'cancelar', 'olvídalo', 'mejor no'].includes(lowerMessage)) {
    return { intent: 'cancel', confidence: 1.0, entities: {} };
  }

  return null;
}

// =====================================================
// ROUTING
// =====================================================

function getNextNode(intent: AdminIntent): string {
  const routeMap: Record<string, string> = {
    // Analytics
    analytics_daily_summary: 'analytics_handler',
    analytics_weekly_summary: 'analytics_handler',
    analytics_monthly_summary: 'analytics_handler',
    analytics_sales: 'analytics_handler',
    analytics_leads: 'analytics_handler',
    analytics_orders: 'analytics_handler',
    analytics_inventory: 'analytics_handler',
    analytics_ai_performance: 'analytics_handler',
    analytics_appointments: 'analytics_handler',
    analytics_revenue: 'analytics_handler',

    // Config
    config_services: 'config_handler',
    config_prices: 'config_handler',
    config_hours: 'config_handler',
    config_staff: 'config_handler',
    config_ai_settings: 'config_handler',
    config_promotions: 'config_handler',
    config_notifications: 'config_handler',

    // Operations
    operation_inventory_check: 'operation_handler',
    operation_pending_orders: 'operation_handler',
    operation_escalations: 'operation_handler',

    // Notifications
    notification_settings: 'notification_handler',
    notification_pause: 'notification_handler',
    notification_resume: 'notification_handler',

    // Meta
    help: 'help_handler',
    greeting: 'greeting_handler',
    confirm: 'confirm_handler',
    cancel: 'cancel_handler',
    unknown: 'help_handler',
  };

  return routeMap[intent] || 'help_handler';
}

// =====================================================
// PERMISSION VALIDATION
// =====================================================

function validatePermissions(
  intent: AdminIntent,
  context: AdminChannelContext
): boolean {
  // Analytics requiere canViewAnalytics
  if (intent.startsWith('analytics_')) {
    return context.user.canViewAnalytics;
  }

  // Config requiere canConfigure
  if (intent.startsWith('config_')) {
    return context.user.canConfigure;
  }

  return true;
}

function getPermissionDeniedMessage(intent: AdminIntent): string {
  if (intent.startsWith('analytics_')) {
    return '⚠️ No tienes permisos para ver analytics.\n\nContacta al administrador para solicitar acceso.';
  }

  if (intent.startsWith('config_')) {
    return '⚠️ No tienes permisos para configurar.\n\nContacta al administrador para solicitar acceso.';
  }

  return '⚠️ No tienes permisos para esta acción.';
}

// =====================================================
// EXPORTS
// =====================================================

export { getNextNode, validatePermissions, detectQuickIntent };
