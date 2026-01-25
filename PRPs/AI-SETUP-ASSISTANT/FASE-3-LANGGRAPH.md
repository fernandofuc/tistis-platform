# FASE 3: LangGraph Setup Assistant Agent

## Objetivo
Implementar el agente de IA que procesa los mensajes del usuario y ejecuta acciones de configuracion, utilizando la arquitectura LangGraph existente y Gemini 3.0 Flash.

---

## Arquitectura del Agente

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SETUP ASSISTANT AGENT                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                               │
│  │    ENTRADA      │                                               │
│  │  (User Message) │                                               │
│  └────────┬────────┘                                               │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────┐                                               │
│  │   SUPERVISOR    │ ◄── Detecta intención de configuración        │
│  │   (Gemini)      │                                               │
│  └────────┬────────┘                                               │
│           │                                                         │
│     ┌─────┴─────┬──────────┬──────────┬──────────┐                │
│     ▼           ▼          ▼          ▼          ▼                │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│ │GENERAL │ │LOYALTY │ │AGENTS  │ │SERVICES│ │KNOWLEDGE│           │
│ │ Setup  │ │ Config │ │ Config │ │ Config │ │  Base   │           │
│ └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘ └────┬───┘           │
│      │          │          │          │          │                │
│      └──────────┴──────────┴──────────┴──────────┘                │
│                            │                                       │
│                            ▼                                       │
│                   ┌─────────────────┐                              │
│                   │   EXECUTOR      │                              │
│                   │ (Apply Changes) │                              │
│                   └────────┬────────┘                              │
│                            │                                       │
│                            ▼                                       │
│                   ┌─────────────────┐                              │
│                   │   RESPONDER     │                              │
│                   │ (Format Reply)  │                              │
│                   └─────────────────┘                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Microfases

### 3.1 State Definition

**Archivo:** `src/features/setup-assistant/state/setup-state.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant State
// =====================================================

import { Annotation } from '@langchain/langgraph';
import type { SetupModule, MessageAction, VisionAnalysis } from '../types';

// =====================================================
// STATE TYPES
// =====================================================

export interface SetupContext {
  tenantId: string;
  userId: string;
  vertical: 'restaurant' | 'dental' | 'clinic' | 'beauty' | 'veterinary' | 'gym';

  // Current tenant configuration
  tenantConfig: {
    name: string;
    timezone: string;
    businessHours: Record<string, { open: string; close: string }>;
    policies: Record<string, string>;
  };

  // Module states
  loyaltyConfigured: boolean;
  agentsConfigured: boolean;
  knowledgeBaseConfigured: boolean;
  servicesConfigured: boolean;
  promotionsConfigured: boolean;

  // Existing data for context
  existingServices: Array<{ id: string; name: string; price: number }>;
  existingFaqs: Array<{ id: string; question: string }>;
  existingLoyaltyProgram: { id: string; name: string } | null;
}

export interface SetupMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<{
    type: string;
    url: string;
    analysis?: VisionAnalysis;
  }>;
}

export type SetupIntent =
  | 'general_setup'
  | 'loyalty_config'
  | 'agents_config'
  | 'services_config'
  | 'knowledge_base'
  | 'promotions_config'
  | 'staff_config'
  | 'branches_config'
  | 'help'
  | 'confirm'
  | 'cancel'
  | 'unknown';

// =====================================================
// LANGGRAPH STATE ANNOTATION
// =====================================================

export const SetupAssistantState = Annotation.Root({
  // Conversation context
  conversationId: Annotation<string>,
  context: Annotation<SetupContext>,
  messages: Annotation<SetupMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Current processing state
  currentMessage: Annotation<string>,
  currentAttachments: Annotation<string[]>({
    default: () => [],
  }),

  // Intent detection
  detectedIntent: Annotation<SetupIntent>({
    default: () => 'unknown',
  }),
  intentConfidence: Annotation<number>({
    default: () => 0,
  }),

  // Extracted data from user message
  extractedData: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),

  // Vision analysis results (if applicable)
  visionAnalysis: Annotation<VisionAnalysis | null>({
    default: () => null,
  }),

  // Actions to execute
  pendingActions: Annotation<MessageAction[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  executedActions: Annotation<MessageAction[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Response
  response: Annotation<string>({
    default: () => '',
  }),

  // Flow control
  currentNode: Annotation<string>({
    default: () => 'supervisor',
  }),
  shouldEnd: Annotation<boolean>({
    default: () => false,
  }),

  // Token tracking
  inputTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  outputTokens: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
});

export type SetupAssistantStateType = typeof SetupAssistantState.State;
```

**Criterios de aceptación:**
- [ ] State type definido con todos los campos necesarios
- [ ] Reducers para arrays configurados
- [ ] Defaults definidos

---

### 3.2 Supervisor Node

**Archivo:** `src/features/setup-assistant/nodes/supervisor.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Supervisor
// Detects user intent and routes to appropriate handler
// =====================================================

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { SetupAssistantStateType, SetupIntent } from '../state/setup-state';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash-exp',  // Will be gemini-3-flash when available
  temperature: 0.3,
  maxOutputTokens: 500,
});

const INTENT_DETECTION_PROMPT = `Eres un detector de intenciones para un asistente de configuración de negocio.

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

Responde SOLO con un JSON:
{
  "intent": "nombre_de_intencion",
  "confidence": 0.0-1.0,
  "extracted_entities": {
    // Datos extraídos del mensaje (nombres, precios, etc.)
  },
  "reasoning": "Breve explicación"
}`;

export async function supervisorNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const configuredModules = [];
  if (state.context.loyaltyConfigured) configuredModules.push('loyalty');
  if (state.context.agentsConfigured) configuredModules.push('agents');
  if (state.context.knowledgeBaseConfigured) configuredModules.push('knowledge_base');
  if (state.context.servicesConfigured) configuredModules.push('services');

  const prompt = INTENT_DETECTION_PROMPT
    .replace('{vertical}', state.context.vertical)
    .replace('{tenant_name}', state.context.tenantConfig.name)
    .replace('{configured_modules}', configuredModules.join(', ') || 'ninguno')
    .replace('{user_message}', state.currentMessage);

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      detectedIntent: parsed.intent as SetupIntent,
      intentConfidence: parsed.confidence,
      extractedData: parsed.extracted_entities || {},
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    };
  } catch (error) {
    console.error('[SetupAssistant] Supervisor error:', error);
    return {
      detectedIntent: 'help',
      intentConfidence: 0.5,
      extractedData: {},
    };
  }
}
```

**Criterios de aceptación:**
- [ ] Detecta correctamente las intenciones
- [ ] Extrae entidades del mensaje
- [ ] Maneja errores gracefully

---

### 3.3 Configuration Nodes

**Archivo:** `src/features/setup-assistant/nodes/config-handlers.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Config Handlers
// Specialized nodes for each configuration type
// =====================================================

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { SetupAssistantStateType } from '../state/setup-state';
import type { MessageAction } from '../types';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash-exp',
  temperature: 0.4,
  maxOutputTokens: 1500,
});

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

Responde con JSON:
{
  "response": "Tu respuesta al usuario...",
  "actions": [
    {
      "type": "update",
      "module": "general",
      "entityType": "tenant_config",
      "field": "campo_a_actualizar",
      "value": "nuevo_valor"
    }
  ],
  "follow_up_questions": ["¿Pregunta adicional si falta información?"]
}`;

export async function generalSetupNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const prompt = GENERAL_SETUP_PROMPT
    .replace('{vertical}', state.context.vertical)
    .replace('{tenant_name}', state.context.tenantConfig.name)
    .replace('{business_hours}', JSON.stringify(state.context.tenantConfig.businessHours))
    .replace('{policies}', JSON.stringify(state.context.tenantConfig.policies))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: content, actions: [] };

    const actions: MessageAction[] = (parsed.actions || []).map((a: Record<string, unknown>) => ({
      type: a.type as MessageAction['type'],
      module: 'general',
      entityType: a.entityType as string,
      status: 'pending' as const,
      details: { field: a.field, value: a.value },
    }));

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    };
  } catch (error) {
    console.error('[SetupAssistant] General setup error:', error);
    return {
      response: 'Lo siento, hubo un error procesando tu solicitud. ¿Podrías reformular?',
      pendingActions: [],
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
- Definir niveles/tiers (Bronze, Silver, Gold, etc.)
- Configurar cómo se ganan puntos
- Definir recompensas canjeables

Responde con JSON:
{
  "response": "Tu respuesta explicativa...",
  "actions": [
    {
      "type": "create",
      "module": "loyalty",
      "entityType": "loyalty_program|loyalty_tier|loyalty_reward",
      "data": { /* datos de la entidad */ }
    }
  ],
  "summary": "Resumen de lo que se configurará"
}`;

export async function loyaltyConfigNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const prompt = LOYALTY_CONFIG_PROMPT
    .replace('{vertical}', state.context.vertical)
    .replace('{existing_program}', JSON.stringify(state.context.existingLoyaltyProgram || 'ninguno'))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: content, actions: [] };

    const actions: MessageAction[] = (parsed.actions || []).map((a: Record<string, unknown>) => ({
      type: a.type as MessageAction['type'],
      module: 'loyalty',
      entityType: a.entityType as string,
      status: 'pending' as const,
      details: a.data as Record<string, unknown>,
    }));

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    };
  } catch (error) {
    console.error('[SetupAssistant] Loyalty config error:', error);
    return {
      response: 'Hubo un problema configurando el programa de lealtad. ¿Intentamos de nuevo?',
      pendingActions: [],
    };
  }
}

// =====================================================
// SERVICES CONFIG HANDLER
// =====================================================

const SERVICES_CONFIG_PROMPT = `Eres un asistente de configuración de {vertical_type} para {vertical}.

{vertical_context}

SERVICIOS/PRODUCTOS ACTUALES: {existing_services}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}
ANÁLISIS DE IMAGEN: {vision_analysis}

Ayuda a:
- Agregar nuevos servicios/productos
- Actualizar precios
- Configurar duraciones
- Categorizar items

Responde con JSON:
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "create|update",
      "module": "services",
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
  const verticalContext = state.context.vertical === 'restaurant'
    ? 'Para restaurantes, maneja: platillos, bebidas, postres, combos.'
    : state.context.vertical === 'dental'
    ? 'Para clínicas dentales, maneja: procedimientos, consultas, tratamientos.'
    : 'Maneja servicios y productos del negocio.';

  const verticalType = state.context.vertical === 'restaurant' ? 'menú' : 'catálogo de servicios';

  const prompt = SERVICES_CONFIG_PROMPT
    .replace('{vertical}', state.context.vertical)
    .replace('{vertical_type}', verticalType)
    .replace('{vertical_context}', verticalContext)
    .replace('{existing_services}', JSON.stringify(state.context.existingServices.slice(0, 10)))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData))
    .replace('{vision_analysis}', state.visionAnalysis
      ? JSON.stringify(state.visionAnalysis)
      : 'No hay imagen analizada');

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: content, actions: [] };

    const actions: MessageAction[] = (parsed.actions || []).map((a: Record<string, unknown>) => ({
      type: a.type as MessageAction['type'],
      module: 'services',
      entityType: a.entityType as string,
      status: 'pending' as const,
      details: a.data as Record<string, unknown>,
    }));

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    };
  } catch (error) {
    console.error('[SetupAssistant] Services config error:', error);
    return {
      response: 'Hubo un problema configurando los servicios. ¿Podrías dar más detalles?',
      pendingActions: [],
    };
  }
}

// =====================================================
// KNOWLEDGE BASE HANDLER
// =====================================================

const KNOWLEDGE_BASE_PROMPT = `Eres un asistente para configurar la base de conocimiento de {vertical}.

El usuario quiere agregar información que el bot de IA usará para responder preguntas.

FAQs EXISTENTES: {existing_faqs}

MENSAJE DEL USUARIO: {user_message}
DATOS EXTRAÍDOS: {extracted_data}

Puedes ayudar a:
- Crear FAQs (preguntas frecuentes)
- Definir respuestas predeterminadas
- Agregar documentos informativos

Responde con JSON:
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "create",
      "module": "knowledge_base",
      "entityType": "faq|document|default_response",
      "data": {
        "question": "...",
        "answer": "...",
        "category": "..."
      }
    }
  ]
}`;

export async function knowledgeBaseNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const prompt = KNOWLEDGE_BASE_PROMPT
    .replace('{vertical}', state.context.vertical)
    .replace('{existing_faqs}', JSON.stringify(state.context.existingFaqs.slice(0, 10)))
    .replace('{user_message}', state.currentMessage)
    .replace('{extracted_data}', JSON.stringify(state.extractedData));

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: content, actions: [] };

    const actions: MessageAction[] = (parsed.actions || []).map((a: Record<string, unknown>) => ({
      type: a.type as MessageAction['type'],
      module: 'knowledge_base',
      entityType: a.entityType as string,
      status: 'pending' as const,
      details: a.data as Record<string, unknown>,
    }));

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    };
  } catch (error) {
    console.error('[SetupAssistant] Knowledge base error:', error);
    return {
      response: 'Hubo un problema agregando la información. ¿Podrías reformular?',
      pendingActions: [],
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

Puedes ayudar a:
- Definir la personalidad del bot (formal, amigable, profesional)
- Configurar saludos y despedidas
- Definir cuándo escalar a humano
- Ajustar el tono por canal (WhatsApp vs Web)

Responde con JSON:
{
  "response": "Tu respuesta...",
  "actions": [
    {
      "type": "configure",
      "module": "agents",
      "entityType": "ai_personality|escalation_rules|channel_config",
      "data": { /* configuración */ }
    }
  ]
}`;

export async function agentsConfigNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const prompt = AGENTS_CONFIG_PROMPT
    .replace('{vertical}', state.context.vertical)
    .replace('{agents_configured}', state.context.agentsConfigured ? 'Sí' : 'No')
    .replace('{user_message}', state.currentMessage);

  try {
    const response = await model.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { response: content, actions: [] };

    const actions: MessageAction[] = (parsed.actions || []).map((a: Record<string, unknown>) => ({
      type: a.type as MessageAction['type'],
      module: 'agents',
      entityType: a.entityType as string,
      status: 'pending' as const,
      details: a.data as Record<string, unknown>,
    }));

    return {
      response: parsed.response,
      pendingActions: actions,
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    };
  } catch (error) {
    console.error('[SetupAssistant] Agents config error:', error);
    return {
      response: 'Hubo un problema configurando el agente. ¿Intentamos de nuevo?',
      pendingActions: [],
    };
  }
}

// =====================================================
// HELP HANDLER
// =====================================================

export async function helpNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  const verticalHelp = state.context.vertical === 'restaurant'
    ? `Para tu restaurante puedo ayudarte a:
- **Menú**: Agrega platillos, bebidas y precios. Puedes subir una foto de tu menú.
- **Lealtad**: Crea un programa de puntos para tus clientes frecuentes.
- **FAQs**: Define respuestas a preguntas comunes (horarios, reservaciones).
- **Bot IA**: Personaliza cómo responde tu asistente de WhatsApp.`
    : state.context.vertical === 'dental'
    ? `Para tu clínica dental puedo ayudarte a:
- **Servicios**: Agrega tratamientos, consultas y precios.
- **Lealtad**: Crea un programa de beneficios para pacientes recurrentes.
- **FAQs**: Define respuestas sobre procedimientos, seguros, etc.
- **Bot IA**: Personaliza cómo responde tu asistente de WhatsApp.`
    : `Puedo ayudarte a configurar tu negocio completo.`;

  const response = `¡Hola! Soy tu asistente de configuración de TIS TIS.

${verticalHelp}

**¿Por dónde quieres empezar?** Puedes decirme algo como:
- "Quiero agregar mis servicios"
- "Configurar un programa de lealtad"
- "Crear FAQs para el bot"

También puedes subir imágenes (como tu menú) y las analizaré automáticamente.`;

  return {
    response,
    pendingActions: [],
  };
}
```

**Criterios de aceptación:**
- [ ] Handler para cada tipo de configuración
- [ ] Prompts especializados por vertical
- [ ] Extracción de acciones del LLM
- [ ] Manejo de errores

---

### 3.4 Action Executor Node

**Archivo:** `src/features/setup-assistant/nodes/executor.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Action Executor
// Executes pending actions against the database
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import type { SetupAssistantStateType } from '../state/setup-state';
import type { MessageAction } from '../types';

export async function executorNode(
  state: SetupAssistantStateType
): Promise<Partial<SetupAssistantStateType>> {
  if (state.pendingActions.length === 0) {
    return { executedActions: [] };
  }

  const supabase = createServiceClient();
  const executedActions: MessageAction[] = [];

  for (const action of state.pendingActions) {
    try {
      const result = await executeAction(
        supabase,
        state.context.tenantId,
        action
      );

      executedActions.push({
        ...action,
        status: result.success ? 'success' : 'failure',
        entityId: result.entityId,
        details: {
          ...action.details,
          error: result.error,
        },
      });
    } catch (error) {
      console.error(`[SetupAssistant] Error executing action:`, error);
      executedActions.push({
        ...action,
        status: 'failure',
        details: {
          ...action.details,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return {
    executedActions,
    pendingActions: [], // Clear pending
  };
}

async function executeAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  action: MessageAction
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  const { module, entityType, type, details } = action;

  switch (module) {
    case 'services':
      return executeServicesAction(supabase, tenantId, type, entityType, details);

    case 'loyalty':
      return executeLoyaltyAction(supabase, tenantId, type, entityType, details);

    case 'knowledge_base':
      return executeKnowledgeBaseAction(supabase, tenantId, type, entityType, details);

    case 'general':
      return executeGeneralAction(supabase, tenantId, type, details);

    case 'agents':
      return executeAgentsAction(supabase, tenantId, type, details);

    default:
      return { success: false, error: `Unknown module: ${module}` };
  }
}

// =====================================================
// MODULE-SPECIFIC EXECUTORS
// =====================================================

async function executeServicesAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (type === 'create' && entityType === 'service') {
    const { data, error } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        name: details?.name as string,
        price: details?.price as number,
        duration: details?.duration as number || 30,
        category: details?.category as string || 'general',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'update' && entityType === 'service') {
    const { error } = await supabase
      .from('services')
      .update({
        name: details?.name as string,
        price: details?.price as number,
        duration: details?.duration as number,
      })
      .eq('id', details?.id as string)
      .eq('tenant_id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: details?.id as string };
  }

  return { success: false, error: 'Unknown services action' };
}

async function executeLoyaltyAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (type === 'create' && entityType === 'loyalty_program') {
    const { data, error } = await supabase
      .from('loyalty_programs')
      .insert({
        tenant_id: tenantId,
        name: details?.name as string || 'Programa de Lealtad',
        description: details?.description as string,
        points_per_currency: details?.pointsPerCurrency as number || 1,
        currency_symbol: '$',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  if (type === 'create' && entityType === 'loyalty_tier') {
    const { data, error } = await supabase
      .from('loyalty_tiers')
      .insert({
        program_id: details?.programId as string,
        name: details?.name as string,
        min_points: details?.minPoints as number || 0,
        benefits: details?.benefits || {},
        sort_order: details?.sortOrder as number || 0,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  return { success: false, error: 'Unknown loyalty action' };
}

async function executeKnowledgeBaseAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  type: string,
  entityType: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (type === 'create' && entityType === 'faq') {
    const { data, error } = await supabase
      .from('faqs')
      .insert({
        tenant_id: tenantId,
        question: details?.question as string,
        answer: details?.answer as string,
        category: details?.category as string || 'general',
        is_active: true,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: data.id };
  }

  return { success: false, error: 'Unknown knowledge base action' };
}

async function executeGeneralAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  type: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (type === 'update') {
    const field = details?.field as string;
    const value = details?.value;

    if (!field) return { success: false, error: 'No field specified' };

    const { error } = await supabase
      .from('tenants')
      .update({ [field]: value })
      .eq('id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: tenantId };
  }

  return { success: false, error: 'Unknown general action' };
}

async function executeAgentsAction(
  supabase: ReturnType<typeof createServiceClient>,
  tenantId: string,
  type: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  if (type === 'configure') {
    // Update AI configuration in tenant settings
    const { error } = await supabase
      .from('tenants')
      .update({
        ai_settings: details,
      })
      .eq('id', tenantId);

    if (error) return { success: false, error: error.message };
    return { success: true, entityId: tenantId };
  }

  return { success: false, error: 'Unknown agents action' };
}
```

**Criterios de aceptación:**
- [ ] Ejecutor genérico para todas las acciones
- [ ] Ejecutores específicos por módulo
- [ ] Manejo de errores por acción
- [ ] Retorno de entityId para tracking

---

### 3.5 Graph Builder

**Archivo:** `src/features/setup-assistant/graph/index.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Graph
// =====================================================

import { StateGraph, END } from '@langchain/langgraph';
import { SetupAssistantState, type SetupAssistantStateType } from '../state/setup-state';
import { supervisorNode } from '../nodes/supervisor';
import {
  generalSetupNode,
  loyaltyConfigNode,
  servicesConfigNode,
  knowledgeBaseNode,
  agentsConfigNode,
  helpNode,
} from '../nodes/config-handlers';
import { executorNode } from '../nodes/executor';

// =====================================================
// ROUTING FUNCTION
// =====================================================

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
      return 'general_setup'; // TODO: Create dedicated node
    case 'staff_config':
      return 'general_setup'; // TODO: Create dedicated node
    case 'branches_config':
      return 'general_setup'; // TODO: Create dedicated node
    case 'help':
    case 'unknown':
    default:
      return 'help';
  }
}

function shouldExecuteActions(state: SetupAssistantStateType): string {
  if (state.pendingActions.length > 0) {
    return 'executor';
  }
  return END;
}

// =====================================================
// BUILD GRAPH
// =====================================================

export function buildSetupAssistantGraph() {
  const builder = new StateGraph(SetupAssistantState);

  // Add nodes
  builder.addNode('supervisor', supervisorNode);
  builder.addNode('general_setup', generalSetupNode);
  builder.addNode('loyalty_config', loyaltyConfigNode);
  builder.addNode('services_config', servicesConfigNode);
  builder.addNode('knowledge_base', knowledgeBaseNode);
  builder.addNode('agents_config', agentsConfigNode);
  builder.addNode('help', helpNode);
  builder.addNode('executor', executorNode);

  // Set entry point
  builder.setEntryPoint('supervisor');

  // Add conditional edges from supervisor
  builder.addConditionalEdges('supervisor', routeAfterSupervisor, {
    general_setup: 'general_setup',
    loyalty_config: 'loyalty_config',
    services_config: 'services_config',
    knowledge_base: 'knowledge_base',
    agents_config: 'agents_config',
    help: 'help',
  });

  // Add edges from handlers to executor (conditional)
  const handlerNodes = [
    'general_setup',
    'loyalty_config',
    'services_config',
    'knowledge_base',
    'agents_config',
  ];

  for (const node of handlerNodes) {
    builder.addConditionalEdges(node, shouldExecuteActions, {
      executor: 'executor',
      [END]: END,
    });
  }

  // Help always ends
  builder.addEdge('help', END);

  // Executor always ends
  builder.addEdge('executor', END);

  return builder.compile();
}

// =====================================================
// GRAPH INSTANCE
// =====================================================

export const setupAssistantGraph = buildSetupAssistantGraph();
```

**Criterios de aceptación:**
- [ ] Grafo compilado sin errores
- [ ] Routing condicional funciona
- [ ] Todos los nodos conectados

---

### 3.6 Service Wrapper

**Archivo:** `src/features/setup-assistant/services/setup-assistant.service.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Service
// High-level service for processing messages
// =====================================================

import { setupAssistantGraph } from '../graph';
import type { SetupAssistantStateType, SetupContext } from '../state/setup-state';
import type { SetupMessage, MessageAction, VisionAnalysis } from '../types';

export interface ProcessMessageInput {
  conversationId: string;
  context: SetupContext;
  messages: SetupMessage[];
  currentMessage: string;
  attachments?: string[];
  visionAnalysis?: VisionAnalysis;
}

export interface ProcessMessageOutput {
  response: string;
  executedActions: MessageAction[];
  inputTokens: number;
  outputTokens: number;
}

export class SetupAssistantService {
  private static instance: SetupAssistantService;

  private constructor() {}

  static getInstance(): SetupAssistantService {
    if (!SetupAssistantService.instance) {
      SetupAssistantService.instance = new SetupAssistantService();
    }
    return SetupAssistantService.instance;
  }

  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const initialState: Partial<SetupAssistantStateType> = {
      conversationId: input.conversationId,
      context: input.context,
      messages: input.messages,
      currentMessage: input.currentMessage,
      currentAttachments: input.attachments || [],
      visionAnalysis: input.visionAnalysis || null,
    };

    try {
      const result = await setupAssistantGraph.invoke(initialState);

      return {
        response: result.response || 'Lo siento, no pude procesar tu mensaje.',
        executedActions: result.executedActions || [],
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
      };
    } catch (error) {
      console.error('[SetupAssistantService] Error processing message:', error);

      return {
        response: 'Hubo un error procesando tu mensaje. Por favor intenta de nuevo.',
        executedActions: [],
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }
}

export const setupAssistantService = SetupAssistantService.getInstance();
```

**Criterios de aceptación:**
- [ ] Singleton service
- [ ] Invoca el grafo correctamente
- [ ] Maneja errores gracefully

---

### 3.7 Integration with API

**Actualizar:** `app/api/setup-assistant/[conversationId]/messages/route.ts`

```typescript
// En la sección POST, reemplazar el TODO con:

import { setupAssistantService } from '@/src/features/setup-assistant/services/setup-assistant.service';
import { createServiceClient } from '@/src/shared/lib/supabase';

// ... dentro del POST handler, después de guardar el mensaje del usuario:

// 4. Load context for the agent
const supabaseAdmin = createServiceClient();

const { data: tenantData } = await supabaseAdmin
  .from('tenants')
  .select('*')
  .eq('id', tenantId)
  .single();

const { data: servicesData } = await supabaseAdmin
  .from('services')
  .select('id, name, price')
  .eq('tenant_id', tenantId)
  .eq('is_active', true)
  .limit(50);

const { data: faqsData } = await supabaseAdmin
  .from('faqs')
  .select('id, question')
  .eq('tenant_id', tenantId)
  .eq('is_active', true)
  .limit(20);

const { data: loyaltyData } = await supabaseAdmin
  .from('loyalty_programs')
  .select('id, name')
  .eq('tenant_id', tenantId)
  .eq('is_active', true)
  .single();

// 5. Get previous messages for context
const { data: previousMessages } = await supabase
  .from('setup_assistant_messages')
  .select('role, content, attachments')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true })
  .limit(10);

// 6. Process with LangGraph Agent
const context: SetupContext = {
  tenantId,
  userId,
  vertical: tenantData?.vertical || 'restaurant',
  tenantConfig: {
    name: tenantData?.name || 'Mi Negocio',
    timezone: tenantData?.timezone || 'America/Mexico_City',
    businessHours: tenantData?.business_hours || {},
    policies: tenantData?.policies || {},
  },
  loyaltyConfigured: !!loyaltyData,
  agentsConfigured: !!tenantData?.ai_settings,
  knowledgeBaseConfigured: (faqsData?.length || 0) > 0,
  servicesConfigured: (servicesData?.length || 0) > 0,
  promotionsConfigured: false,
  existingServices: servicesData || [],
  existingFaqs: faqsData || [],
  existingLoyaltyProgram: loyaltyData || null,
};

const agentResult = await setupAssistantService.processMessage({
  conversationId,
  context,
  messages: (previousMessages || []).map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
    attachments: m.attachments,
  })),
  currentMessage: body.content,
  attachments: body.attachments,
  visionAnalysis: undefined, // TODO: Add from Phase 4
});

// 7. Save assistant message with actual response
const { data: assistantMessage, error: assistantMsgError } = await supabase
  .from('setup_assistant_messages')
  .insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    role: 'assistant',
    content: agentResult.response,
    actions_taken: agentResult.executedActions,
    input_tokens: agentResult.inputTokens,
    output_tokens: agentResult.outputTokens,
  })
  .select()
  .single();
```

**Criterios de aceptación:**
- [ ] API integrada con servicio
- [ ] Contexto cargado correctamente
- [ ] Respuesta del agente guardada

---

## Validación de Fase 3

```bash
# Verificar tipos
npm run typecheck

# Test manual del grafo
# Crear un script de test o usar la API

# Verificar que el grafo compila
node -e "require('./src/features/setup-assistant/graph').setupAssistantGraph"
```

---

## Checklist de Fase 3

- [ ] 3.1 State definido con Annotation
- [ ] 3.2 Supervisor node funcional
- [ ] 3.3 Config handlers implementados (5 handlers)
- [ ] 3.4 Executor node funcional
- [ ] 3.5 Graph compilado correctamente
- [ ] 3.6 Service wrapper funcional
- [ ] 3.7 API integrada con service
- [ ] Typecheck pasa sin errores
- [ ] Prueba manual funciona

---

## Siguiente Fase

→ [FASE-4-VISION.md](./FASE-4-VISION.md)
