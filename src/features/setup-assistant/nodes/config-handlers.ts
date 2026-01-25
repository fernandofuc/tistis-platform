// =====================================================
// TIS TIS PLATFORM - Setup Assistant Config Handlers
// Specialized nodes for each configuration type
// Now powered by Gemini 2.5 Flash for unified AI
// =====================================================

import { geminiService } from '../services/gemini.service';
import type { SetupAssistantStateType } from '../state/setup-state';
import type { MessageAction, ActionType } from '../types';

// Valid action types for validation
const VALID_ACTION_TYPES: ActionType[] = ['create', 'update', 'delete', 'configure'];

// =====================================================
// HELPER: Parse LLM Response
// =====================================================

interface ParsedResponse {
  response: string;
  actions: Array<{
    type: string;
    entityType: string;
    field?: string;
    value?: unknown;
    data?: Record<string, unknown>;
  }>;
}

function parseModelResponse(content: string): ParsedResponse {
  const parsed = geminiService.parseJsonResponse<ParsedResponse>(content);
  if (parsed) {
    return parsed;
  }
  return { response: content, actions: [] };
}

function mapActions(
  parsedActions: ParsedResponse['actions'],
  module: string
): MessageAction[] {
  return parsedActions
    .filter((a) => {
      // Validate action type
      const actionType = a.type || 'create';
      return VALID_ACTION_TYPES.includes(actionType as ActionType);
    })
    .map((a) => ({
      type: (a.type || 'create') as ActionType,
      module,
      entityType: a.entityType || 'unknown',
      status: 'pending' as const,
      details: a.data || { field: a.field, value: a.value },
    }));
}

// =====================================================
// GENERAL SETUP HANDLER
// =====================================================

const GENERAL_SETUP_PROMPT = `Eres un asistente de configuración para {vertical}.

El usuario quiere configurar aspectos generales de su negocio.

CONFIGURACIÓN ACTUAL:
- Nombre: {tenant_name}
- Horarios: {business_hours}
- Políticas: {policies}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}

Genera:
1. Una respuesta amigable confirmando lo que entendiste
2. Las acciones a ejecutar

Responde con JSON (sin markdown):
{
  "response": "Tu respuesta al usuario...",
  "actions": [
    {
      "type": "update",
      "entityType": "tenant_config",
      "field": "campo_a_actualizar",
      "value": "nuevo_valor"
    }
  ]
}`;

export async function generalSetupNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      response: 'No tengo contexto del negocio. ¿Podrías intentar de nuevo?',
      pendingActions: [],
    };
  }

  const prompt = GENERAL_SETUP_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{tenant_name}', context.tenantConfig.name)
    .replace('{business_hours}', JSON.stringify(context.tenantConfig.businessHours || {}))
    .replace('{policies}', JSON.stringify(context.tenantConfig.policies || {}))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 1500,
    });

    const parsed = parseModelResponse(response.text);
    const actions = mapActions(parsed.actions, 'general');

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] General setup error:', error);
    return {
      response: 'Lo siento, hubo un error procesando tu solicitud. ¿Podrías reformular?',
      pendingActions: [],
      errors: [error instanceof Error ? error.message : 'General setup error'],
    };
  }
}

// =====================================================
// LOYALTY CONFIG HANDLER
// =====================================================

const LOYALTY_CONFIG_PROMPT = `Eres un experto en sistemas de lealtad para {vertical}.

El usuario quiere configurar su programa de fidelización.

PROGRAMA ACTUAL: {existing_program}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}

Puedes ayudar a:
- Crear un nuevo programa de lealtad
- Definir niveles/tiers (Bronce, Plata, Oro, etc.)
- Configurar cómo se ganan puntos
- Definir recompensas canjeables

Responde con JSON (sin markdown):
{
  "response": "Tu respuesta explicativa...",
  "actions": [
    {
      "type": "create",
      "entityType": "loyalty_program",
      "data": {
        "name": "Nombre del programa",
        "pointsPerCurrency": 1,
        "description": "Descripción"
      }
    }
  ]
}`;

export async function loyaltyConfigNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      response: 'No tengo contexto del negocio. ¿Podrías intentar de nuevo?',
      pendingActions: [],
    };
  }

  const prompt = LOYALTY_CONFIG_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{existing_program}', JSON.stringify(context.existingLoyaltyProgram || 'ninguno'))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 1500,
    });

    const parsed = parseModelResponse(response.text);
    const actions = mapActions(parsed.actions, 'loyalty');

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] Loyalty config error:', error);
    return {
      response: 'Hubo un problema configurando el programa de lealtad. ¿Intentamos de nuevo?',
      pendingActions: [],
      errors: [error instanceof Error ? error.message : 'Loyalty config error'],
    };
  }
}

// =====================================================
// SERVICES CONFIG HANDLER
// =====================================================

const SERVICES_CONFIG_PROMPT = `Eres un asistente de configuración de {vertical_type} para {vertical}.

{vertical_context}

SERVICIOS/PRODUCTOS ACTUALES (últimos 10): {existing_services}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}
ANÁLISIS DE IMAGEN: {vision_analysis}

Ayuda a:
- Agregar nuevos servicios/productos
- Actualizar precios
- Configurar duraciones
- Categorizar items

Responde con JSON (sin markdown):
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "create",
      "entityType": "service",
      "data": {
        "name": "Nombre del servicio",
        "price": 100,
        "duration": 30,
        "category": "categoría"
      }
    }
  ]
}`;

export async function servicesConfigNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      response: 'No tengo contexto del negocio. ¿Podrías intentar de nuevo?',
      pendingActions: [],
    };
  }

  const verticalContext = context.vertical === 'restaurant'
    ? 'Para restaurantes, maneja: platillos, bebidas, postres, combos.'
    : context.vertical === 'dental'
      ? 'Para clínicas dentales, maneja: procedimientos, consultas, tratamientos.'
      : 'Maneja servicios y productos del negocio.';

  const verticalType = context.vertical === 'restaurant' ? 'menú' : 'catálogo de servicios';

  const prompt = SERVICES_CONFIG_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{vertical_type}', verticalType)
    .replace('{vertical_context}', verticalContext)
    .replace('{existing_services}', JSON.stringify(context.existingServices.slice(0, 10)))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData))
    .replace('{vision_analysis}', state.visionAnalysis
      ? JSON.stringify(state.visionAnalysis)
      : 'No hay imagen analizada');

  try {
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 2000, // Higher for services with many items
    });

    const parsed = parseModelResponse(response.text);
    const actions = mapActions(parsed.actions, 'services');

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] Services config error:', error);
    return {
      response: 'Hubo un problema configurando los servicios. ¿Podrías dar más detalles?',
      pendingActions: [],
      errors: [error instanceof Error ? error.message : 'Services config error'],
    };
  }
}

// =====================================================
// KNOWLEDGE BASE HANDLER
// =====================================================

const KNOWLEDGE_BASE_PROMPT = `Eres un asistente para configurar la base de conocimiento de {vertical}.

El usuario quiere agregar información que el bot de IA usará para responder preguntas.

FAQs EXISTENTES (últimas 10): {existing_faqs}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}

Puedes ayudar a:
- Crear FAQs (preguntas frecuentes)
- Definir respuestas predeterminadas
- Agregar documentos informativos

Responde con JSON (sin markdown):
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "create",
      "entityType": "faq",
      "data": {
        "question": "¿Pregunta?",
        "answer": "Respuesta...",
        "category": "general"
      }
    }
  ]
}`;

export async function knowledgeBaseNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      response: 'No tengo contexto del negocio. ¿Podrías intentar de nuevo?',
      pendingActions: [],
    };
  }

  const prompt = KNOWLEDGE_BASE_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{existing_faqs}', JSON.stringify(context.existingFaqs.slice(0, 10)))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 1500,
    });

    const parsed = parseModelResponse(response.text);
    const actions = mapActions(parsed.actions, 'knowledge_base');

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] Knowledge base error:', error);
    return {
      response: 'Hubo un problema agregando la información. ¿Podrías reformular?',
      pendingActions: [],
      errors: [error instanceof Error ? error.message : 'Knowledge base error'],
    };
  }
}

// =====================================================
// AGENTS CONFIG HANDLER
// =====================================================

const AGENTS_CONFIG_PROMPT = `Eres un experto en configuración de asistentes IA para {vertical}.

El usuario quiere personalizar cómo responde su bot de IA.

CONFIGURACIÓN ACTUAL:
- Agentes configurados: {agents_configured}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}

Puedes ayudar a:
- Definir la personalidad del bot (formal, amigable, profesional)
- Configurar saludos y despedidas
- Definir cuándo escalar a humano
- Ajustar el tono por canal (WhatsApp vs Web)

Responde con JSON (sin markdown):
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "configure",
      "entityType": "ai_personality",
      "data": {
        "tone": "friendly",
        "greeting": "¡Hola! ¿En qué puedo ayudarte?"
      }
    }
  ]
}`;

export async function agentsConfigNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      response: 'No tengo contexto del negocio. ¿Podrías intentar de nuevo?',
      pendingActions: [],
    };
  }

  const prompt = AGENTS_CONFIG_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{agents_configured}', context.agentsConfigured ? 'Sí' : 'No')
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 1500,
    });

    const parsed = parseModelResponse(response.text);
    const actions = mapActions(parsed.actions, 'agents');

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] Agents config error:', error);
    return {
      response: 'Hubo un problema configurando el agente. ¿Intentamos de nuevo?',
      pendingActions: [],
      errors: [error instanceof Error ? error.message : 'Agents config error'],
    };
  }
}

// =====================================================
// PROMOTIONS CONFIG HANDLER
// =====================================================

const PROMOTIONS_CONFIG_PROMPT = `Eres un experto en marketing y promociones para {vertical}.

El usuario quiere configurar promociones y descuentos.

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}
ANÁLISIS DE IMAGEN: {vision_analysis}

Puedes ayudar a:
- Crear promociones (% de descuento, 2x1, etc.)
- Definir condiciones (días específicos, mínimo de compra)
- Establecer fechas de validez

Responde con JSON (sin markdown):
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "create",
      "entityType": "promotion",
      "data": {
        "title": "Nombre de la promoción",
        "discountType": "percentage",
        "discountValue": 10,
        "conditions": "Válido de lunes a viernes"
      }
    }
  ]
}`;

export async function promotionsConfigNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;

  if (!context) {
    return {
      response: 'No tengo contexto del negocio. ¿Podrías intentar de nuevo?',
      pendingActions: [],
    };
  }

  const prompt = PROMOTIONS_CONFIG_PROMPT
    .replace('{vertical}', context.vertical)
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData))
    .replace('{vision_analysis}', state.visionAnalysis
      ? JSON.stringify(state.visionAnalysis)
      : 'No hay imagen analizada');

  try {
    const response = await geminiService.generateText({
      prompt,
      temperature: 0.4,
      maxOutputTokens: 1500,
    });

    const parsed = parseModelResponse(response.text);
    const actions = mapActions(parsed.actions, 'promotions');

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    };
  } catch (error) {
    console.error('[SetupAssistant] Promotions config error:', error);
    return {
      response: 'Hubo un problema configurando la promoción. ¿Intentamos de nuevo?',
      pendingActions: [],
      errors: [error instanceof Error ? error.message : 'Promotions config error'],
    };
  }
}

// =====================================================
// HELP HANDLER (No LLM call)
// =====================================================

export async function helpNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const context = state.context;
  const vertical = context?.vertical || 'restaurant';

  const verticalHelp = vertical === 'restaurant'
    ? `Para tu restaurante puedo ayudarte a:
- **Menú**: Agrega platillos, bebidas y precios. Puedes subir una foto de tu menú.
- **Lealtad**: Crea un programa de puntos para tus clientes frecuentes.
- **FAQs**: Define respuestas a preguntas comunes (horarios, reservaciones).
- **Bot IA**: Personaliza cómo responde tu asistente de WhatsApp.
- **Promociones**: Crea ofertas y descuentos especiales.`
    : vertical === 'dental'
      ? `Para tu clínica dental puedo ayudarte a:
- **Servicios**: Agrega tratamientos, consultas y precios.
- **Lealtad**: Crea un programa de beneficios para pacientes recurrentes.
- **FAQs**: Define respuestas sobre procedimientos, seguros, etc.
- **Bot IA**: Personaliza cómo responde tu asistente de WhatsApp.
- **Promociones**: Crea ofertas especiales para nuevos pacientes.`
      : `Puedo ayudarte a configurar tu negocio completo:
- **Servicios**: Agrega tu catálogo con precios.
- **Lealtad**: Crea programas de fidelización.
- **FAQs**: Define respuestas automáticas.
- **Bot IA**: Personaliza tu asistente virtual.`;

  const response = `¡Hola! Soy tu asistente de configuración de TIS TIS.

${verticalHelp}

**¿Por dónde quieres empezar?** Puedes decirme algo como:
- "Quiero agregar mis servicios"
- "Configurar un programa de lealtad"
- "Crear FAQs para el bot"
- "Configurar una promoción del 10%"

También puedes subir imágenes (como tu menú) y las analizaré automáticamente.`;

  return {
    response,
    pendingActions: [],
  };
}
