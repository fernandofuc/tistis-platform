# TIS TIS PLATFORM - ARQUITECTURA DE AGENTES DE CONTESTACION V3.0

**Fecha:** 2026-01-20
**Version:** 3.0.0
**Estado:** IMPLEMENTADO Y VALIDADO
**Ultima Actualizacion:** Commit `de92953`

---

## RESUMEN EJECUTIVO

Este documento describe la arquitectura unificada de los dos agentes de contestacion de TIS TIS Platform:

1. **Voice Agent** - Maneja llamadas telefonicas via VAPI
2. **Messaging Agent** - Maneja conversaciones de WhatsApp/Instagram via Meta

Ambos agentes comparten:
- Sistema de Tool Calling unificado
- RAG/Knowledge Base compartido
- Sistema de Capabilities por vertical y nivel

---

## 1. VOICE AGENT - ARQUITECTURA COMPLETA

### 1.1 Flujo de Procesamiento

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VOICE AGENT FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   LLAMADA ENTRANTE (PSTN)                                                       │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────┐                                                               │
│   │    VAPI     │  Telephony Provider                                           │
│   │  (Twilio)   │  STT: Deepgram nova-2                                        │
│   └──────┬──────┘  TTS: ElevenLabs multilingual_v2                             │
│          │                                                                       │
│          │ POST /api/voice-agent/webhook                                        │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    WEBHOOK HANDLER                                       │   │
│   │   lib/voice-agent/webhooks/                                             │   │
│   │                                                                          │   │
│   │   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │   │
│   │   │  Security Gate  │───▶│  Circuit Breaker│───▶│  Event Router   │    │   │
│   │   │  - IP Whitelist │    │  - 8s timeout   │    │  - assistant-req│    │   │
│   │   │  - HMAC Verify  │    │  - 5 failures   │    │  - conv-update  │    │   │
│   │   │  - Rate Limit   │    │  - Fallback     │    │  - end-of-call  │    │   │
│   │   └─────────────────┘    └─────────────────┘    └────────┬────────┘    │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                        │                         │
│                              ┌────────────────────────┘                         │
│                              │                                                   │
│          ┌───────────────────┼───────────────────┐                              │
│          ▼                   ▼                   ▼                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                      │
│   │ assistant-  │     │conversation-│     │ end-of-call │                      │
│   │ request     │     │ update      │     │ -report     │                      │
│   │             │     │             │     │             │                      │
│   │ Retorna:    │     │ Ejecuta:    │     │ Guarda:     │                      │
│   │ - System    │     │ - LangGraph │     │ - Analytics │                      │
│   │   Prompt    │     │ - Tools     │     │ - Recording │                      │
│   │ - Voice     │     │ - RAG       │     │ - Structured│                      │
│   │ - First Msg │     │             │     │   Data      │                      │
│   └─────────────┘     └──────┬──────┘     └─────────────┘                      │
│                              │                                                   │
│                              ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     LANGGRAPH VOICE                                      │   │
│   │   lib/voice-agent/langgraph/                                            │   │
│   │                                                                          │   │
│   │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐        │   │
│   │   │  Router  │───▶│Tool Exec │───▶│   RAG    │───▶│ Response │        │   │
│   │   │          │    │          │    │          │    │ Generator│        │   │
│   │   │ Detecta  │    │ Ejecuta  │    │ Busca KB │    │ Genera   │        │   │
│   │   │ intent   │    │ tool     │    │ context  │    │ respuesta│        │   │
│   │   └──────────┘    └──────────┘    └──────────┘    └──────────┘        │   │
│   │        │               │               │               │               │   │
│   │        └───────────────┴───────────────┴───────────────┘               │   │
│   │                              │                                          │   │
│   │                     VoiceAgentState                                     │   │
│   │   - compiledPrompt, availableTools, enabledCapabilities                │   │
│   │   - conversationHistory, currentInput, ragContext                      │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                              │                                                   │
│                              ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      TOOL SYSTEM                                         │   │
│   │   lib/voice-agent/tools/                                                │   │
│   │                                                                          │   │
│   │   RESTAURANT                  DENTAL                     COMMON         │   │
│   │   ────────────                ──────                     ──────         │   │
│   │   check_availability          check_appointment_avail    get_business_  │   │
│   │   create_reservation          create_appointment           hours        │   │
│   │   modify_reservation          modify_appointment         get_business_  │   │
│   │   cancel_reservation          cancel_appointment           info         │   │
│   │   get_menu                    get_services               transfer_to_   │   │
│   │   get_menu_item               get_service_info             human        │   │
│   │   search_menu                 get_service_prices         request_       │   │
│   │   get_recommendations         get_doctors                  invoice      │   │
│   │   create_order                get_doctor_info            end_call       │   │
│   │   modify_order                get_insurance_info                        │   │
│   │   cancel_order                check_insurance_coverage                  │   │
│   │   get_order_status            handle_emergency                          │   │
│   │   calculate_delivery_time     send_reminder                             │   │
│   │   get_promotions                                                        │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Archivos Clave del Voice Agent

| Directorio/Archivo | Responsabilidad |
|-------------------|-----------------|
| `lib/voice-agent/webhooks/` | Punto de entrada para VAPI |
| `lib/voice-agent/webhooks/security/` | Security Gate (IP, HMAC, Rate Limit) |
| `lib/voice-agent/webhooks/handlers/` | Handlers por tipo de evento |
| `lib/voice-agent/langgraph/` | Grafo de LangGraph para voz |
| `lib/voice-agent/langgraph/nodes/` | Nodos: router, tool-executor, rag, response-generator |
| `lib/voice-agent/tools/` | Sistema de tools |
| `lib/voice-agent/tools/restaurant/` | Tools de restaurante (11 tools) |
| `lib/voice-agent/tools/dental/` | Tools de dental (13 tools) |
| `lib/voice-agent/tools/common/` | Tools compartidos (5 tools) |
| `lib/voice-agent/types/` | Tipos y definiciones de capabilities |
| `lib/voice-agent/services/` | Template Prompt Compiler |
| `templates/prompts/restaurant/` | Templates HBS para restaurante |
| `templates/prompts/dental/` | Templates HBS para dental |

### 1.3 Sistema de Capabilities (Voice)

```typescript
// lib/voice-agent/types/types.ts
export type Capability =
  // Shared capabilities
  | 'business_hours'
  | 'business_info'
  | 'human_transfer'
  | 'faq'
  | 'invoicing'
  // Restaurant capabilities
  | 'reservations'
  | 'menu_info'
  | 'recommendations'
  | 'orders'
  | 'order_status'
  | 'promotions'
  // Dental capabilities
  | 'appointments'
  | 'services_info'
  | 'doctor_info'
  | 'insurance_info'
  | 'appointment_management'
  | 'emergencies';
```

### 1.4 Matriz de Capabilities por Nivel

| Capability | rest_basic | rest_standard | rest_complete | dental_basic | dental_standard | dental_complete |
|------------|:----------:|:-------------:|:-------------:|:------------:|:---------------:|:---------------:|
| business_hours | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| business_info | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| human_transfer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| faq | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| reservations | ✅ | ✅ | ✅ | - | - | - |
| menu_info | ❌ | ✅ | ✅ | - | - | - |
| recommendations | ❌ | ✅ | ✅ | - | - | - |
| orders | ❌ | ❌ | ✅ | - | - | - |
| order_status | ❌ | ❌ | ✅ | - | - | - |
| promotions | ❌ | ❌ | ✅ | - | - | - |
| appointments | - | - | - | ✅ | ✅ | ✅ |
| services_info | - | - | - | ❌ | ✅ | ✅ |
| doctor_info | - | - | - | ❌ | ✅ | ✅ |
| insurance_info | - | - | - | ❌ | ❌ | ✅ |
| appointment_management | - | - | - | ❌ | ❌ | ✅ |
| emergencies | - | - | - | ❌ | ❌ | ✅ |

---

## 2. MESSAGING AGENT - ARQUITECTURA COMPLETA

### 2.1 Flujo de Procesamiento

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MESSAGING AGENT FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   MENSAJE ENTRANTE (WhatsApp / Instagram)                                       │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────┐                                                               │
│   │    META     │  WhatsApp Business API                                        │
│   │  Webhooks   │  Instagram Messaging API                                      │
│   └──────┬──────┘                                                               │
│          │                                                                       │
│          │ POST /api/webhooks/meta                                              │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    META WEBHOOK HANDLER                                  │   │
│   │   src/app/api/webhooks/meta/route.ts                                    │   │
│   │                                                                          │   │
│   │   1. Verify webhook signature                                           │   │
│   │   2. Parse message (text/image/audio/video)                             │   │
│   │   3. Find/create lead & conversation                                    │   │
│   │   4. Queue AI processing job                                            │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     AI JOB QUEUE                                         │   │
│   │   src/features/ai/services/ai-job-processor.service.ts                  │   │
│   │                                                                          │   │
│   │   Procesa mensajes de forma asincrona con retry logic                   │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │               HYBRID PROMPT GENERATION                                   │   │
│   │   src/features/ai/services/prompt-generator.service.ts                  │   │
│   │   src/features/ai/services/hybrid-voice-prompt.service.ts               │   │
│   │                                                                          │   │
│   │   1. Cargar template Handlebars (channel-specific)                      │   │
│   │   2. Compilar con variables del negocio                                 │   │
│   │   3. Enriquecer con Gemini (Knowledge Base)                             │   │
│   │   4. Cachear en Supabase (ai_prompt_cache)                              │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                  LANGGRAPH MESSAGING                                     │   │
│   │   src/features/messaging-agent/services/                                │   │
│   │                                                                          │   │
│   │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐        │   │
│   │   │  Router  │───▶│Tool Exec │───▶│   RAG    │───▶│ Response │        │   │
│   │   │          │    │          │    │          │    │ Generator│        │   │
│   │   │ Detecta  │    │ Ejecuta  │    │ Hybrid   │    │ Genera   │        │   │
│   │   │ intent   │    │ tool     │    │ Search   │    │ respuesta│        │   │
│   │   └──────────┘    └──────────┘    └──────────┘    └──────────┘        │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                  RESPONSE FORMATTING                                     │   │
│   │                                                                          │   │
│   │   MESSAGING (WhatsApp/Instagram):                                       │   │
│   │   ────────────────────────────                                          │   │
│   │   - Emojis permitidos (✅ 📍 📞)                                        │   │
│   │   - Markdown (negrita, listas)                                          │   │
│   │   - Links clicables                                                     │   │
│   │   - Respuestas mas largas (hasta 2000 chars)                           │   │
│   │   - Botones interactivos (WhatsApp)                                     │   │
│   │                                                                          │   │
│   │   VOICE (comparacion):                                                  │   │
│   │   ────────────────────                                                  │   │
│   │   - SIN emojis                                                          │   │
│   │   - Texto plano conversacional                                          │   │
│   │   - Muletillas naturales ("Mmm...", "Bueno...")                        │   │
│   │   - Respuestas cortas (150 chars max)                                  │   │
│   │   - SIN links                                                           │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    OUTBOUND JOB                                          │   │
│   │   src/features/ai/services/outbound-message.service.ts                  │   │
│   │                                                                          │   │
│   │   1. Format message for channel                                         │   │
│   │   2. Send via Meta API (WhatsApp/Instagram)                             │   │
│   │   3. Save to conversation_messages                                      │   │
│   │   4. Update conversation state                                          │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Archivos Clave del Messaging Agent

| Directorio/Archivo | Responsabilidad |
|-------------------|-----------------|
| `src/app/api/webhooks/meta/route.ts` | Punto de entrada para Meta webhooks |
| `src/features/ai/services/prompt-generator.service.ts` | Generacion de prompts hibridos |
| `src/features/ai/services/hybrid-voice-prompt.service.ts` | Enriquecimiento con Gemini |
| `src/features/ai/services/ai-job-processor.service.ts` | Cola de procesamiento AI |
| `src/features/messaging-agent/services/` | Servicios del agente de mensajes |
| `templates/prompts/messaging/` | Templates HBS para mensajeria |

### 2.3 Diferencias Voice vs Messaging

| Aspecto | Voice Agent | Messaging Agent |
|---------|-------------|-----------------|
| **Latencia objetivo** | p50 < 500ms | p50 < 2s |
| **Max respuesta** | 150 chars | 2000 chars |
| **Emojis** | Nunca | Si (✅ 📍 📞) |
| **Markdown** | No | Si |
| **Links** | Nunca | Si |
| **Muletillas** | Si ("Mmm...", "Bueno...") | No |
| **Botones** | No | Si (WhatsApp) |
| **Multimedia** | No | Si (imagenes, docs) |
| **Contexto RAG** | 2000 tokens | 4000 tokens |

---

## 3. SISTEMA DE TOOLS UNIFICADO

### 3.1 Estructura de Tool Definition

```typescript
// lib/voice-agent/tools/types.ts
export interface ToolDefinition<TParams = Record<string, unknown>> {
  name: Tool;
  description: string;
  category: 'booking' | 'info' | 'order' | 'transfer' | 'utility';

  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };

  requiredCapabilities: ToolCapability[];
  requiresConfirmation: boolean;
  enabledFor: AssistantTypeId[];
  timeout: number;

  confirmationMessage?: (params: TParams) => string;
  handler: (params: TParams, context: ToolContext) => Promise<ToolResult>;
}
```

### 3.2 Capability to Tools Mapping

```typescript
// lib/voice-agent/types/capability-definitions.ts
export const CAPABILITY_TOOLS: Record<Capability, Tool[]> = {
  // Shared
  business_hours: ['get_business_hours'],
  business_info: ['get_business_info'],
  human_transfer: ['transfer_to_human'],
  faq: [], // Handled by prompt, no specific tool
  invoicing: ['request_invoice'],

  // Restaurant
  reservations: [
    'check_availability',
    'create_reservation',
    'modify_reservation',
    'cancel_reservation',
  ],
  menu_info: ['get_menu', 'get_menu_item', 'search_menu'],
  recommendations: ['get_recommendations'],
  orders: ['create_order', 'modify_order', 'cancel_order'],
  order_status: ['get_order_status', 'calculate_delivery_time'],
  promotions: ['get_promotions'],

  // Dental
  appointments: ['check_appointment_availability', 'create_appointment'],
  services_info: ['get_services', 'get_service_info', 'get_service_prices'],
  doctor_info: ['get_doctors', 'get_doctor_info'],
  insurance_info: ['get_insurance_info', 'check_insurance_coverage'],
  appointment_management: ['modify_appointment', 'cancel_appointment'],
  emergencies: ['handle_emergency', 'send_reminder'],
};
```

### 3.3 Total de Tools Implementados

| Categoria | Cantidad | Tools |
|-----------|:--------:|-------|
| **Restaurant** | 14 | check_availability, create_reservation, modify_reservation, cancel_reservation, get_menu, get_menu_item, search_menu, get_recommendations, create_order, modify_order, cancel_order, get_order_status, calculate_delivery_time, get_promotions |
| **Dental** | 13 | check_appointment_availability, create_appointment, modify_appointment, cancel_appointment, get_services, get_service_info, get_service_prices, get_doctors, get_doctor_info, get_insurance_info, check_insurance_coverage, handle_emergency, send_reminder |
| **Common** | 5 | get_business_hours, get_business_info, transfer_to_human, request_invoice, end_call |
| **TOTAL** | **32** | |

---

## 4. SISTEMA DE PROMPTS HIBRIDOS

### 4.1 Flujo de Generacion de Prompt

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    HYBRID PROMPT GENERATION FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   1. TEMPLATE COMPILATION (Handlebars)                                          │
│   ────────────────────────────────────                                          │
│                                                                                  │
│   templates/prompts/{vertical}/{type}.hbs                                       │
│          │                                                                       │
│          │  Variables:                                                           │
│          │  - assistant_name                                                     │
│          │  - business_name                                                      │
│          │  - business_type                                                      │
│          │  - personality_tone                                                   │
│          │  - current_date/time                                                  │
│          │  - business_hours                                                     │
│          │  - special_instructions                                               │
│          ▼                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    TemplatePromptCompilerService                         │   │
│   │   lib/voice-agent/services/template-prompt-compiler.service.ts          │   │
│   │                                                                          │   │
│   │   - Load template by vertical + type                                    │   │
│   │   - Load business context from Supabase                                 │   │
│   │   - Render template with Handlebars                                     │   │
│   │   - Generate first_message                                              │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          │  basePrompt (structured)                                             │
│          ▼                                                                       │
│   2. GEMINI ENRICHMENT                                                          │
│   ────────────────────                                                          │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                   HybridVoicePromptService                               │   │
│   │   src/features/ai/services/hybrid-voice-prompt.service.ts               │   │
│   │                                                                          │   │
│   │   Input:                                                                 │   │
│   │   - basePrompt (from template)                                          │   │
│   │   - knowledgeBase (from business_knowledge table)                       │   │
│   │                                                                          │   │
│   │   Process:                                                               │   │
│   │   - Send to Gemini with enrichment meta-prompt                          │   │
│   │   - Gemini ONLY adds KB info, never modifies structure                  │   │
│   │                                                                          │   │
│   │   Output:                                                                │   │
│   │   - enrichedPrompt (template + KB info)                                 │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│          │                                                                       │
│          │  enrichedPrompt                                                      │
│          ▼                                                                       │
│   3. CACHE & USE                                                                │
│   ──────────────                                                                │
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     ai_prompt_cache (Supabase)                           │   │
│   │                                                                          │   │
│   │   - tenant_id                                                            │   │
│   │   - channel ('voice' | 'messaging')                                     │   │
│   │   - prompt_content (the enriched prompt)                                │   │
│   │   - first_message                                                        │   │
│   │   - capabilities[] (enabled for this type)                              │   │
│   │   - tools[] (available for this type)                                   │   │
│   │   - expires_at (cache TTL)                                              │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Templates Disponibles

| Vertical | Tipo | Template | Descripcion |
|----------|------|----------|-------------|
| restaurant | rest_basic | `restaurant/rest_basic.hbs` | Solo reservaciones y horarios |
| restaurant | rest_standard | `restaurant/rest_standard.hbs` | Reservaciones + menu + recomendaciones |
| restaurant | rest_complete | `restaurant/rest_complete.hbs` | Todo + pedidos + promociones |
| dental | dental_basic | `dental/dental_basic.hbs` | Solo citas y horarios |
| dental | dental_standard | `dental/dental_standard.hbs` | Citas + servicios + doctores |
| dental | dental_complete | `dental/dental_complete.hbs` | Todo + emergencias + seguros |
| general | general_basic | `general/general_basic.hbs` | Verticales no soportadas |

### 4.3 Personalidades Disponibles

| Personalidad | Archivo | Caracteristicas |
|--------------|---------|-----------------|
| professional | `personalities/professional.hbs` | Formal, cortés, eficiente |
| friendly | `personalities/friendly.hbs` | Cercano, amable, casual |
| energetic | `personalities/energetic.hbs` | Entusiasta, dinamico |
| calm | `personalities/calm.hbs` | Tranquilo, paciente, sereno |

---

## 5. BASE DE DATOS - TABLAS PRINCIPALES

### 5.1 Voice Agent Tables

```sql
-- Tipos de asistente disponibles
voice_assistant_types (
  id, vertical, name, display_name,
  enabled_capabilities, available_tools, tier, is_active
)

-- Configuracion por tenant
voice_configs (
  id, tenant_id, assistant_type_id, voice_id, personality,
  custom_greeting, transfer_config, is_active
)

-- Llamadas
voice_calls (
  id, tenant_id, vapi_call_id, phone_number,
  status, duration_seconds, transcription, analysis, outcome
)

-- Mensajes de llamada
voice_call_messages (
  id, call_id, role, content, timestamp
)

-- Catalogo de voces
voice_catalog (
  id, provider, voice_id, name, gender, language, accent, preview_url
)
```

### 5.2 Messaging Agent Tables

```sql
-- Conversaciones
conversations (
  id, tenant_id, lead_id, channel, status, last_message_at
)

-- Mensajes
conversation_messages (
  id, conversation_id, role, content, message_type, metadata
)

-- Cache de prompts
ai_prompt_cache (
  id, tenant_id, channel, prompt_content, first_message,
  capabilities, tools, expires_at
)
```

### 5.3 Shared Tables

```sql
-- Knowledge Base
business_knowledge (
  id, tenant_id, category, content, metadata, embedding, active
)

-- Leads
leads (
  id, tenant_id, name, phone, email, source, channel, status
)
```

---

## 6. SEGURIDAD Y RESILIENCIA

### 6.1 Voice Agent Security Gate

```typescript
// lib/voice-agent/webhooks/security/security-gate.ts
export class WebhookSecurityGate {
  static async validate(request: Request): Promise<SecurityResult> {
    // 1. IP Whitelist (VAPI IPs)
    const ip = getClientIP(request);
    if (!VAPI_IP_WHITELIST.includes(ip)) {
      return { valid: false, reason: 'IP not whitelisted' };
    }

    // 2. HMAC Signature Verification
    const signature = request.headers.get('x-vapi-signature');
    if (!verifyHMAC(signature, body, secret)) {
      return { valid: false, reason: 'Invalid signature' };
    }

    // 3. Timestamp Validation (anti-replay)
    const timestamp = request.headers.get('x-vapi-timestamp');
    if (!isTimestampValid(timestamp, 300)) { // 5 min window
      return { valid: false, reason: 'Timestamp expired' };
    }

    // 4. Rate Limiting
    const tenantId = extractTenantId(body);
    if (await isRateLimited(tenantId)) {
      return { valid: false, reason: 'Rate limited' };
    }

    return { valid: true };
  }
}
```

### 6.2 Circuit Breaker

```typescript
// lib/voice-agent/webhooks/circuit-breaker.ts
export class VoiceCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private readonly threshold = 5;
  private readonly timeout = 8000; // 8 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      return this.getFallbackResponse();
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeoutPromise()
      ]);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      return this.getFallbackResponse();
    }
  }

  private getFallbackResponse(): T {
    return {
      assistantResponse: "Disculpa, estoy teniendo dificultades. " +
        "Podrias intentar de nuevo o transferirte con alguien del equipo?"
    } as T;
  }
}
```

---

## 7. MEJORAS IMPLEMENTADAS (Enero 2026)

### 7.1 Fixes de Capabilities

| Archivo | Antes | Despues |
|---------|-------|---------|
| `transfer-to-human.ts` | `requiredCapabilities: ['transfers']` | `requiredCapabilities: ['human_transfer']` |
| `get-doctors.ts` | `requiredCapabilities: ['doctors']` | `requiredCapabilities: ['doctor_info']` |
| `get-insurance-info.ts` | `requiredCapabilities: ['insurance']` | `requiredCapabilities: ['insurance_info']` |
| `get-menu.ts` | `requiredCapabilities: ['menu']` | `requiredCapabilities: ['menu_info']` |

### 7.2 Nuevas Capabilities y Tools

```typescript
// Agregado a types.ts
export type Capability =
  // ... existentes ...
  | 'invoicing'; // NUEVO: Para facturacion CFDI

export type Tool =
  // ... existentes ...
  | 'request_invoice'  // NUEVO: Solicitar factura
  | 'end_call';        // NUEVO: Finalizar llamada
```

### 7.3 Sincronizacion de Tipos

```typescript
// lib/voice-agent/tools/types.ts - SINCRONIZADO
export type ToolCapability =
  // Shared capabilities
  | 'business_hours'
  | 'business_info'
  | 'human_transfer'
  | 'faq'
  | 'invoicing'        // AGREGADO
  // Restaurant capabilities
  | 'reservations'
  | 'menu_info'
  | 'recommendations'
  | 'orders'
  | 'order_status'
  | 'promotions'
  // Dental capabilities
  | 'appointments'
  | 'services_info'
  | 'doctor_info'
  | 'insurance_info'
  | 'appointment_management'
  | 'emergencies';
```

---

## 8. VERIFICACION Y TESTING

### 8.1 Compilacion TypeScript

```bash
# Verificar que no hay errores de tipos
npx tsc --noEmit

# Archivos verificados sin errores:
# - lib/voice-agent/**/*.ts
# - src/features/messaging-agent/**/*.ts
# - src/features/ai/**/*.ts
```

### 8.2 Tests Recomendados

| Test | Descripcion | Comando |
|------|-------------|---------|
| Unit: Tools | Cada tool retorna ToolResult valido | `npm test tools` |
| Unit: Capabilities | Mapping capability → tools correcto | `npm test capabilities` |
| Integration: Voice | Webhook → LangGraph → Response | `npm test:voice` |
| Integration: Messaging | Meta → AI → Response | `npm test:messaging` |
| E2E: Voice | Llamada real via VAPI | Manual |
| E2E: Messaging | Mensaje real via WhatsApp | Manual |

---

## 9. PROXIMOS PASOS

1. **Implementar request_invoice tool** - Para facturacion CFDI mexicana
2. **Implementar end_call tool** - Para finalizar llamadas programaticamente
3. **Agregar invoicing a assistant types** - Habilitar en tipos que lo requieran
4. **Dashboard de monitoreo** - Metricas en tiempo real de ambos agentes
5. **A/B testing de prompts** - Comparar efectividad de diferentes personalidades

---

*Este documento es parte de la documentacion tecnica de TIS TIS Platform v3.0*
*Ultima actualizacion: 2026-01-20 - Commit de92953*
