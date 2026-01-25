// =====================================================
// TIS TIS PLATFORM - Setup Assistant Supervisor
// Detects user intent and routes to appropriate handler
// Now powered by Gemini 3.0 Flash for unified AI
// =====================================================

import { geminiService } from '../services/gemini.service';
import type { SetupAssistantStateType, SetupIntent } from '../state/setup-state';
import { getConfiguredModules } from '../state/setup-state';

// =====================================================
// INTENT DETECTION PROMPT
// =====================================================

const INTENT_DETECTION_PROMPT = `Eres un detector de intenciones para un asistente de configuración de negocio TIS TIS.

Analiza el mensaje del usuario y determina qué quiere configurar:

INTENCIONES POSIBLES:
- general_setup: Configuración general del negocio (nombre, horarios, contacto)
- loyalty_config: Sistema de lealtad, puntos, recompensas
- agents_config: Configuración de agentes IA, personalidad, comportamiento
- services_config: Servicios, productos, menú, precios
- knowledge_base: FAQs, documentos, base de conocimiento
- promotions_config: Promociones, descuentos, ofertas
- staff_config: Empleados, roles, permisos
- branches_config: Sucursales, ubicaciones
- help: El usuario pide ayuda o no sabe qué hacer
- confirm: El usuario confirma una acción propuesta
- cancel: El usuario cancela o rechaza una acción
- unknown: No se puede determinar la intención

CONTEXTO DEL NEGOCIO:
- Vertical: {vertical}
- Nombre: {tenant_name}
- Módulos configurados: {configured_modules}

MENSAJE DEL USUARIO:
{user_message}

Responde SOLO con un JSON válido (sin markdown):
{
  "intent": "nombre_de_intencion",
  "confidence": 0.0-1.0,
  "extracted_entities": {
    // Datos extraídos del mensaje (nombres, precios, etc.)
  },
  "reasoning": "Breve explicación"
}`;

// =====================================================
// SUPERVISOR NODE
// =====================================================

export async function supervisorNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      detectedIntent: 'help',
      intentConfidence: 0.5,
      extractedData: {},
      errors: ['No context provided to supervisor'],
    };
  }

  const configuredModules = getConfiguredModules(context);

  const prompt = INTENT_DETECTION_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{tenant_name}', context.tenantConfig.name)
    .replace('{configured_modules}', configuredModules.length > 0 ? configuredModules.join(', ') : 'ninguno')
    .replace('{user_message}', state.currentMessage);

  try {
    // Use Gemini 2.5 Flash for intent detection
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.2, // Low temperature for consistent classification
      maxOutputTokens: 500,
    });

    // Parse JSON response
    const parsed = geminiService.parseJsonResponse<{
      intent: string;
      confidence: number;
      extracted_entities: Record<string, unknown>;
      reasoning: string;
    }>(response.text);

    if (!parsed) {
      throw new Error('Failed to parse intent detection response');
    }

    // Validate intent is a known type
    const validIntents: SetupIntent[] = [
      'general_setup', 'loyalty_config', 'agents_config', 'services_config',
      'knowledge_base', 'promotions_config', 'staff_config', 'branches_config',
      'help', 'confirm', 'cancel', 'unknown',
    ];

    const detectedIntent = validIntents.includes(parsed.intent as SetupIntent)
      ? parsed.intent as SetupIntent
      : 'unknown';

    return {
      detectedIntent,
      intentConfidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      extractedData: parsed.extracted_entities || {},
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] Supervisor error:', error);
    return {
      detectedIntent: 'help',
      intentConfidence: 0.5,
      extractedData: {},
      errors: [error instanceof Error ? error.message : 'Supervisor error'],
    };
  }
}
