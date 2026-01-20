# VOICE AGENT v2.0 - ANALISIS DEL ESTADO ACTUAL

**Documento:** 02-ANALISIS-ESTADO-ACTUAL.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Analisis Completado

---

## 1. RESUMEN DEL ANALISIS

El Voice Agent actual de TIS TIS es un sistema **semi-integrado pero incompleto** que combina:
- **VAPI** (proveedor de telefonia y STT/TTS)
- **LangGraph** (procesamiento de IA)
- **Supabase** (almacenamiento de llamadas y configuracion)

El sistema usa **Server-Side Response Mode** donde VAPI solo maneja transcripcion y sintesis de voz, mientras que TIS TIS LangGraph genera todas las respuestas.

**Calificacion General: 6/10** - Funcional para demos, no listo para produccion a escala.

---

## 2. ESTRUCTURA DE ARCHIVOS

### 2.1 Arbol Completo

```
src/features/voice-agent/
|
+-- types/
|   +-- index.ts                    (766 lineas)
|       +-- VoiceAgentConfig        Configuracion principal
|       +-- VoicePhoneNumber        Numeros de telefono
|       +-- VoiceCall               Registro de llamadas
|       +-- VoiceCallMessage        Mensajes individuales
|       +-- VoiceUsageLog           Logs de uso/billing
|       +-- VoiceUsageSummary       Resumen de uso
|       +-- VAPIAssistantConfig     Config para VAPI
|       +-- TwilioVoiceWebhook      (Definido pero NO usado)
|       +-- TestCallRequest         Para testing web
|       +-- TestCallSession         Sesion de prueba
|
+-- services/
|   +-- voice-agent.service.ts      (844 lineas) [CRITICO]
|   |   +-- getOrCreateVoiceConfig()
|   |   +-- updateVoiceConfig()
|   |   +-- toggleVoiceAgent()
|   |   +-- generatePrompt()         Llama RPC de Gemini
|   |   +-- getVoiceAgentContext()
|   |   +-- requestPhoneNumber()     PROVISIONING
|   |   +-- releasePhoneNumber()
|   |   +-- getRecentCalls()
|   |   +-- getCallDetails()
|   |   +-- getUsageSummary()
|   |   +-- generateVAPIConfig()     Server-Side Mode config
|   |   +-- canAccessVoiceAgent()    Plan check (Growth only)
|   |
|   +-- vapi-api.service.ts         (574 lineas) [CRITICO]
|   |   +-- createAssistant()        Crea asistente en VAPI
|   |   +-- updateAssistant()
|   |   +-- deleteAssistant()
|   |   +-- createPhoneNumber()      Compra numero a VAPI
|   |   +-- updatePhoneNumber()
|   |   +-- deletePhoneNumber()
|   |   +-- provisionPhoneNumberForTenant()   ORQUESTACION
|   |   +-- releasePhoneNumberForTenant()     CLEANUP CON ROLLBACK
|   |
|   +-- voice-langgraph.service.ts  (501 lineas) [CRITICO]
|       +-- processVoiceMessage()    PROCESAMIENTO DE IA
|       +-- generateVoiceInstructions()   Inyeccion de prompt
|       +-- saveVoiceMessage()
|       +-- updateCallAnalysis()
|       +-- analyzeCallConversation()
|       +-- extractCustomerInfo()    EXTRACCION DE DATOS
|
+-- components/
|   +-- VoiceAgentWizard.tsx        UI setup principal
|   +-- VoiceAgentSetupProgress.tsx
|   +-- TalkToAssistant.tsx         Testing web/phone (INCOMPLETO)
|   +-- VoicePreviewCard.tsx        Preview de voces
|   +-- CallDetailModal.tsx         Detalle de llamada
|   +-- CustomInstructionsSection.tsx
|   +-- BusinessKnowledgeSection.tsx
|   +-- EscalationSection.tsx
|   +-- AdvancedSettingsSection.tsx
|   +-- GuidedInstructionsSection.tsx
|   +-- SectionGroup.tsx
|   +-- VoiceAgentIcons.tsx
|
+-- index.ts                        Exports
```

### 2.2 API Routes

```
app/api/voice-agent/
|
+-- route.ts                        (338 lineas)
|   +-- GET    Obtener config + numeros + usage
|   +-- POST   Actualizar config
|   +-- PATCH  Toggle o regenerate_prompt
|
+-- webhook/
|   +-- route.ts                    (735 lineas) [MAS CRITICO]
|       +-- handleAssistantRequest()     Inicializa llamada
|       +-- handleConversationUpdate()   CORAZON DEL SISTEMA
|       +-- handleEndOfCallReport()      Analisis final
|       +-- handleStatusUpdate()
|       +-- handleTranscript()
|
+-- phone-numbers/
|   +-- route.ts
|   |   +-- GET    Listar numeros
|   |   +-- POST   Solicitar numero
|   +-- [id]/
|       +-- route.ts
|           +-- DELETE   Liberar numero
|
+-- calls/
|   +-- route.ts
|   |   +-- GET    Listar llamadas recientes
|   +-- [callId]/
|       +-- messages/
|           +-- route.ts
|               +-- GET    Obtener mensajes de llamada
|
+-- generate-prompt/
|   +-- route.ts
|       +-- POST   Generar prompt con Gemini
|
+-- preview/
    +-- route.ts
        +-- POST   Preview de prompt
```

---

## 3. FLUJO DE LLAMADA ENTRANTE

### 3.1 Fase 1: Provisioning (Setup Inicial)

```
ADMINISTRADOR
     |
     | Click "Solicitar Numero"
     v
POST /api/voice-agent/phone-numbers
     |
     v
voice-agent.service.requestPhoneNumber()
     |
     +-- 1. Verificar plan (Solo Growth)
     +-- 2. Verificar limite (max = sucursales activas)
     +-- 3. Obtener voice_config
     +-- 4. Obtener tenant data
     |
     v
VAPIApiService.provisionPhoneNumberForTenant()
     |
     +-- 5.1 createAssistant() [Sin model - Server-Side Mode]
     +-- 5.2 createPhoneNumber() [VAPI usa Twilio internamente]
     +-- 5.3 Rollback si falla 5.2
     |
     v
GUARDAR EN SUPABASE
     |
     +-- voice_phone_numbers (nuevo registro)
     +-- vapi_assistant_id (linkeo)
     +-- provider_phone_sid (linkeo)
     |
     v
RESULTADO: Numero listo en ~2 minutos
```

### 3.2 Fase 2: Llamada Entrante (assistant-request)

```
CLIENTE MARCA +52 55 1234 5678
     |
     v
VAPI RECIBE LLAMADA
     |
     | Busca webhook configurado
     v
POST /api/voice-agent/webhook
{
  "type": "assistant-request",
  "call": { "id": "call_xyz", "phoneNumber": {...} }
}
     |
     v
handleAssistantRequest()
     |
     +-- Obtener tenant_id del numero
     +-- Obtener voice_config (check enabled=true)
     +-- Crear registro en voice_calls
     |
     v
RETORNAR CONFIG A VAPI (Server-Side Response Mode)
{
  assistant: {
    name: "Sofia",
    firstMessage: "Hola! En que te ayudo?",
    firstMessageMode: "assistant-speaks-first",
    voice: { voiceId, provider, stability, ... },
    transcriber: { model: "nova-2", language: "es", ... },
    startSpeakingPlan: { waitSeconds: 0.6, ... },
    endCallPhrases: ["adios", "bye", ...],
    serverUrl: "https://tistis.com/api/voice-agent/webhook",
    serverUrlSecret: "secret123"
    // NOTA: NO HAY "model" - Server-Side Response Mode
  }
}
```

### 3.3 Fase 3: Conversacion (conversation-update)

```
CLIENTE DICE: "Hola, quiero agendar una cita"
     |
     v
VAPI STT (Deepgram nova-2)
     |
     | Transcribe a texto
     v
POST /api/voice-agent/webhook
{
  "type": "conversation-update",
  "call": { "id": "call_xyz" },
  "messages": [
    { "role": "assistant", "content": "Hola! En que puedo ayudarte?" },
    { "role": "user", "content": "Hola, quiero agendar una cita" }
  ]
}
     |
     v
handleConversationUpdate()
     |
     +-- 1. Validar transcripcion (V3 FIX: no vacia, no corrupta)
     +-- 2. Obtener llamada actual
     +-- 3. Obtener voice_config
     +-- 4. Obtener historial previo de BD
     |
     v
VoiceLangGraphService.processVoiceMessage()
     |
     +-- Obtener prompt cacheado para canal 'voice'
     +-- Cargar contexto del negocio
     +-- Inyectar instrucciones especificas de voz
     +-- Ejecutar grafo LangGraph
     |   {
     |     channel: 'voice',
     |     max_response_length: 150,
     |     personality,
     |     filler_phrases
     |   }
     |
     v
RESULTADO DE LANGGRAPH
{
  response: "Que servicio necesitas?",
  intent: "BOOK_APPOINTMENT",
  signals: [{ signal: "booking_intent", points: 85 }],
  should_escalate: false,
  booking_result: null
}
     |
     v
GUARDAR EN BD
     |
     +-- voice_call_messages (usuario)
     +-- voice_call_messages (asistente)
     +-- Actualizar stats: latency_avg_ms, turns_count
     |
     v
RETORNAR A VAPI
{ assistantResponse: "Que servicio necesitas?" }
     |
     v
VAPI TTS (ElevenLabs)
     |
     | Sintetiza audio
     v
CLIENTE ESCUCHA: "Que servicio necesitas?"
```

### 3.4 Fase 4: Fin de Llamada (end-of-call-report)

```
CLIENTE CUELGA
     |
     v
VAPI ENVIA REPORTE FINAL
POST /api/voice-agent/webhook
{
  "type": "end-of-call-report",
  "call": { "id": "call_xyz" },
  "endedReason": "customer-ended-call",
  "transcript": "Hola, quiero agendar una cita...",
  "durationSeconds": 180,
  "recordingUrl": "https://..."
}
     |
     v
handleEndOfCallReport()
     |
     +-- Obtener llamada de BD
     +-- Analizar conversacion completa
     |   +-- Detectar nombre cliente
     |   +-- Detectar intencion principal
     |   +-- Detectar sentimiento
     |   +-- Detectar servicios solicitados
     |   +-- Extraer topicos clave
     |
     v
ACTUALIZAR voice_calls
     |
     +-- status: 'completed'
     +-- ended_at
     +-- duration_seconds
     +-- transcription (completa)
     +-- analysis (JSON estructurado)
     +-- outcome (appointment_booked, information_given, etc)
     +-- recording_url
     |
     v
REGISTRAR EN voice_usage_logs
     |
     +-- call_minutes
     +-- tts_characters
     +-- ai_tokens
```

---

## 4. MODELO DE DATOS ACTUAL

### 4.1 Tabla: voice_agent_config

```sql
CREATE TABLE voice_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Estado
  voice_enabled BOOLEAN DEFAULT false,
  voice_status TEXT DEFAULT 'inactive',

  -- Asistente
  assistant_name TEXT DEFAULT 'Asistente',
  assistant_personality TEXT DEFAULT 'professional',

  -- Voz
  voice_provider TEXT DEFAULT 'elevenlabs',
  voice_id TEXT,
  voice_model TEXT,
  voice_stability DECIMAL,
  voice_similarity_boost DECIMAL,

  -- Transcripcion
  transcriber_provider TEXT DEFAULT 'deepgram',
  transcriber_model TEXT DEFAULT 'nova-2',
  transcriber_language TEXT DEFAULT 'es',

  -- Comportamiento
  first_message TEXT,
  first_message_mode TEXT DEFAULT 'assistant-speaks-first',
  use_filler_phrases BOOLEAN DEFAULT true,
  filler_phrases TEXT[],
  response_speed TEXT DEFAULT 'balanced',

  -- Prompt
  system_prompt TEXT,
  system_prompt_generated_at TIMESTAMPTZ,
  custom_instructions TEXT,

  -- Escalacion
  escalation_enabled BOOLEAN DEFAULT true,
  escalation_phone TEXT,
  escalation_triggers TEXT[],

  -- VAPI IDs
  vapi_assistant_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id)
);
```

### 4.2 Tabla: voice_phone_numbers

```sql
CREATE TABLE voice_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),

  -- Numero
  phone_number TEXT NOT NULL,
  phone_number_formatted TEXT,
  country_code TEXT DEFAULT 'MX',

  -- Provider IDs
  provider TEXT DEFAULT 'vapi',
  provider_phone_id TEXT,      -- ID en VAPI
  provider_phone_sid TEXT,     -- SID de Twilio (via VAPI)
  vapi_assistant_id TEXT,      -- Asistente vinculado

  -- Estado
  status TEXT DEFAULT 'active',
  is_primary BOOLEAN DEFAULT false,

  -- Costos
  monthly_cost_usd DECIMAL,

  -- Timestamps
  provisioned_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Tabla: voice_calls

```sql
CREATE TABLE voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identificadores
  vapi_call_id TEXT UNIQUE,

  -- Telefonos
  caller_phone TEXT,
  called_phone TEXT,
  call_direction TEXT DEFAULT 'inbound',

  -- Estado
  status TEXT DEFAULT 'initiated',
  -- Estados: initiated, ringing, in_progress, completed, failed, escalated

  -- Tiempos
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  billable_seconds INTEGER,

  -- Recording
  recording_url TEXT,

  -- Transcripcion
  transcription TEXT,
  transcription_segments JSONB,

  -- Analisis
  analysis JSONB,
  primary_intent TEXT,
  detected_intents TEXT[],
  detected_signals JSONB,

  -- Resultado
  outcome TEXT,
  -- Outcomes: appointment_booked, information_given, escalated_human,
  --           no_action, abandoned, failed

  -- Escalacion
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  escalated_reason TEXT,
  escalated_to_staff_id UUID,

  -- Metricas
  cost_usd DECIMAL,
  ai_tokens_used INTEGER,
  latency_avg_ms INTEGER,
  turns_count INTEGER,

  -- Errores
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 Tabla: voice_call_messages

```sql
CREATE TABLE voice_call_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES voice_calls(id) ON DELETE CASCADE,

  -- Mensaje
  role TEXT NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  audio_url TEXT,

  -- Tiempos
  start_time_seconds DECIMAL,
  end_time_seconds DECIMAL,
  duration_seconds DECIMAL,

  -- Analisis
  detected_intent TEXT,
  confidence DECIMAL,

  -- Metricas
  response_latency_ms INTEGER,
  tokens_used INTEGER,

  -- Orden
  sequence_number INTEGER,

  -- Validacion (V3 FIX)
  is_valid_transcription BOOLEAN DEFAULT true,
  transcription_error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Tabla: voice_usage_logs

```sql
CREATE TABLE voice_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  call_id UUID REFERENCES voice_calls(id),

  -- Tipo de uso
  usage_type TEXT NOT NULL,
  -- Tipos: call_minutes, transcription, tts, ai_tokens, recording_storage

  -- Cantidad
  quantity DECIMAL NOT NULL,
  unit TEXT NOT NULL,

  -- Costo
  unit_cost_usd DECIMAL,
  total_cost_usd DECIMAL,

  -- Provider
  provider TEXT,

  -- Billing period
  billing_period_start DATE,
  billing_period_end DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. PROBLEMAS IDENTIFICADOS

### 5.1 CRITICOS (P0) - Bloquean Produccion

#### P0-1: Sin Circuit Breaker para LangGraph

**Problema:** Si LangGraph tarda mas de 10s (timeout de VAPI), la llamada se cuelga sin respuesta.

**Ubicacion:** `webhook/route.ts` linea ~400

**Codigo actual:**
```typescript
// NO HAY TIMEOUT NI CIRCUIT BREAKER
const result = await VoiceLangGraphService.processVoiceMessage(params);
```

**Impacto:** Llamadas se desconectan sin motivo aparente. Cliente frustrado.

**Solucion requerida:** Implementar VoiceCircuitBreaker con timeout de 8s y fallback.

---

#### P0-2: Webhook Security Incompleta

**Problema:** Solo valida secret, no IP ni timestamp.

**Ubicacion:** `webhook/route.ts` linea ~50

**Codigo actual:**
```typescript
function verifyWebhookSecret(request: Request): boolean {
  const secret = request.headers.get('x-vapi-secret');
  if (!process.env.VAPI_WEBHOOK_SECRET) return true; // DANGER!
  return crypto.timingSafeEqual(...);
}
```

**Impacto:** Vulnerable a replay attacks. Cualquier IP puede enviar webhooks falsos.

**Solucion requerida:** Implementar Security Gate con 5 capas.

---

#### P0-3: Race Condition en Bookings

**Problema:** Voice y WhatsApp pueden intentar agendar la misma cita simultaneamente.

**Ubicacion:** Booking atomico parcialmente implementado.

**Contexto:** Migracion 115 agrego `pg_advisory_xact_lock()` pero es un parche.

**Impacto:** Posibles citas duplicadas o conflictos.

**Solucion requerida:** Validar que `create_appointment_atomic()` se usa en TODOS los paths.

---

#### P0-4: Config Deshabilitado Mid-Call

**Problema:** Si admin deshabilita voice_agent_config mientras hay llamadas activas, el webhook falla.

**Ubicacion:** `webhook/route.ts` handleConversationUpdate

**Codigo problematico:**
```typescript
const config = await getVoiceConfig(tenantId);
if (!config || !config.voice_enabled) {
  return { error: 'Voice agent not enabled' }; // Llamada activa falla!
}
```

**Solucion requerida:** Usar `get_voice_config_for_active_call()` que ignora enabled flag.

---

### 5.2 MAYORES (P1) - Afectan UX Significativamente

#### P1-1: Sin Tool Calling Real

**Problema:** LangGraph solo detecta intenciones, no ejecuta acciones.

**Ubicacion:** `voice-langgraph.service.ts`

**Flujo actual:**
```
Usuario: "Quiero reservar"
LangGraph: { intent: "BOOK_APPOINTMENT" }  // Solo intent
Webhook: Guarda intent, no ejecuta nada
Usuario: "Y mi cita?"
```

**Impacto:** El agente no puede realmente hacer reservaciones por voz.

**Solucion requerida:** Implementar tool calling unificado con confirmacion.

---

#### P1-2: Prompts No Se Auto-Invalidan

**Problema:** Si cambian servicios/FAQs, el prompt cacheado no se regenera automaticamente.

**Ubicacion:** `voice_agent_config.system_prompt`

**Mecanismo actual:** Depende de `calculate_source_data_hash()` pero no siempre se ejecuta.

**Impacto:** Asistente da informacion desactualizada.

**Solucion requerida:** Triggers en tablas de servicios/FAQs para marcar prompt como stale.

---

#### P1-3: Historia de Conversacion Ilimitada

**Problema:** Se pasan TODOS los mensajes previos al LLM sin limite.

**Ubicacion:** `voice-langgraph.service.ts`

```typescript
const conversationHistory = context.conversation_history
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join('\n');
// NO HAY LIMITE - si hay 50 turnos, todos van al LLM
```

**Impacto:** Costos excesivos, posible timeout por contexto largo.

**Solucion requerida:** Limitar a ultimos 10 mensajes.

---

#### P1-4: Transcripcion Corrupta (V3 Fix Incompleto)

**Problema:** Deepgram a veces retorna caracteres corruptos.

**Ubicacion:** `webhook/route.ts`

**Fix actual:**
```typescript
const validTextRatio = (transcription.match(/[a-zA-Z0-9\s]/g) || []).length / transcription.length;
if (validTextRatio < 0.5) {
  return { assistantResponse: 'Disculpa, hubo interferencia...' };
}
```

**Problema con el fix:** Heuristica muy simple. Falla con abreviaturas o numeros.

**Solucion requerida:** Validacion mas robusta o retry con backoff.

---

#### P1-5: Sin Rate Limiting en Webhook

**Problema:** No hay limite de requests por tenant/IP.

**Ubicacion:** `webhook/route.ts`

**Impacto:** Vulnerable a DDoS. Un tenant malicioso puede saturar el sistema.

**Solucion requerida:** Rate limiter por tenant (100 req/min).

---

### 5.3 MENORES (P2) - Mejoras Incrementales

#### P2-1: Logging con console.log

**Problema:** Logs se pierden, no son queryables.

**Ubicacion:** Todo el feature.

```typescript
console.log('[Voice Webhook] Received event:', body.type);
```

**Solucion requerida:** Logger estructurado (Winston/Pino).

---

#### P2-2: Testing UI Incompleto

**Problema:** `TalkToAssistant.tsx` tiene codigo para WebSocket pero no funciona.

**Ubicacion:** `components/TalkToAssistant.tsx`

```typescript
test_mode: 'web' | 'phone',
websocket_url?: string  // NUNCA SE USA
```

**Solucion requerida:** Implementar testing con VAPI Web SDK.

---

#### P2-3: Nomenclatura Inconsistente

**Ejemplos:**
- `vapi_call_id` vs `provider_call_sid`
- `voice_enabled` vs `voice_status`
- `escalation_enabled` vs `escalated`

**Solucion requerida:** Estandarizar nomenclatura en v2.0.

---

#### P2-4: Billing Hardcodeado

**Ubicacion:** `voice-usage-logs`

```typescript
cost_usd: Math.ceil(event.durationSeconds / 60) * 0.05
// 0.05 esta hardcodeado, no viene de config
```

**Solucion requerida:** Tabla de precios configurable.

---

## 6. GAPS VS REQUERIMIENTOS DE PDFs

### 6.1 Requerimientos de PDFs

Basado en los documentos "AI AGENT VOZ parte 1, 2, 3":

| Requerimiento | Estado Actual | Gap |
|---------------|---------------|-----|
| Solo plan Growth | ✅ Implementado | 0% |
| Ubicacion en menu (bajo AI Agent) | ✅ Implementado | 0% |
| Seleccion de voces ElevenLabs | ⚠️ Manual con IDs | 40% |
| "Hablar con asistente" para probar | ⚠️ UI existe pero no funciona | 80% |
| Structured data extraction | ⚠️ analysisPlan basico | 50% |
| checkAvailability tool | ❌ Solo intent, no tool | 100% |
| Frases de relleno configurables | ✅ Implementado | 0% |
| Personalidad configurable | ✅ Implementado | 10% |
| Escalacion a humano | ⚠️ Flag pero no transfer real | 60% |

### 6.2 Configuracion de VAPI del PDF (parte 2)

**Lo que muestra el PDF:**
```json
{
  "voice": {
    "model": "eleven_turbo_v2_5",
    "voiceId": "LegCbmbXKbT5PUp3QFWv",
    "provider": "11labs",
    "stability": 0.5,
    "similarityBoost": 0.75
  },
  "transcriber": {
    "model": "nova-2",
    "language": "es",
    "provider": "deepgram"
  },
  "analysisPlan": {
    "structuredDataPlan": {
      "schema": {
        "properties": {
          "Reserva": {"type": "boolean"},
          "reserva_hora": {"type": "string"},
          "reserva_fecha": {"type": "string"},
          "reserva_nombre": {"type": "string"},
          "reserva_invitados": {"type": "string"}
        }
      }
    }
  }
}
```

**Estado actual:** Parcialmente implementado. Falta multi-schema y schemas por tipo.

---

## 7. GAPS VS ESTANDARES DE INDUSTRIA

### 7.1 Comparacion con Twilio Voice

| Aspecto | TIS TIS Actual | Twilio IVR | Gap |
|---------|----------------|------------|-----|
| IVR/Menu | No hay | Si, con DTMF | 100% |
| Voice Recognition | Deepgram via VAPI | Twilio Media Streams | 0% |
| Call Recording | URL estatica | Stream + storage | 30% |
| Call Analytics | Manual | Automatico | 70% |
| Call Routing | Basico | Sofisticado (queues) | 80% |
| Compliance | Parcial (HIPAA flag) | Total | 60% |
| Webhooks tipos | 6 tipos | 12+ tipos | 50% |
| Error Handling | Try/catch generico | Granular per event | 70% |

### 7.2 Comparacion con Latencia de Industria

| Metrica | TIS TIS Actual | Target Industria | Gap |
|---------|----------------|------------------|-----|
| p50 latencia | ~800ms | <500ms | 60% |
| p95 latencia | ~1500ms | <800ms | 87% |
| Timeout rate | ~3% | <0.5% | 500% |

### 7.3 Comparacion con AI Voice Agents

| Aspecto | TIS TIS Actual | OpenAI Voice | Gap |
|---------|----------------|--------------|-----|
| Live Agent Handoff | Flag de escalacion | Native transfer | 70% |
| Multi-turn Memory | Sin limite | 32K tokens gestionado | 50% |
| Function Calling | Via LangGraph (delayed) | Native tools | 60% |
| Latency SLA | None | 500-1000ms | 100% |
| Debugging | Logs basicos | Traces completos | 80% |

---

## 8. MATRIZ DE MADUREZ

```
VOICE AGENT MATURITY ASSESSMENT (v1.0 Actual)

Aspecto              | Puntaje | Notas
---------------------|---------|--------------------------------------------
Provisioning         | 80%     | Funciona pero sin validaciones extras
Llamadas Entrantes   | 70%     | Falla mid-call si config se deshabilita
Processing (LLM)     | 60%     | Usa LangGraph pero sin tools reales
Call Recording       | 85%     | Se almacena URL pero sin validacion
Analytics            | 40%     | Solo logging basico, sin dashboards
Escalation           | 50%     | Flag de escalacion pero sin routing real
Billing              | 30%     | Hardcoded price, sin validacion
Error Handling       | 55%     | Try/catch generico, sin granularidad
Compliance           | 20%     | Banderas HIPAA pero sin implementacion
Security             | 45%     | Secret basico, sin IP/rate limit
---------------------|---------|--------------------------------------------
PROMEDIO GENERAL     | 53.5%   | DEMO-READY, NO PRODUCTION-READY
```

---

## 9. CONCLUSION

El Voice Agent actual es **funcional para demos y tenants de bajo volumen**, pero tiene multiples problemas que lo hacen **no apto para produccion a escala**:

1. **Sin resiliencia:** Fallas en LangGraph causan llamadas colgadas
2. **Seguridad incompleta:** Vulnerable a varios vectores de ataque
3. **Sin tools reales:** Solo detecta intenciones, no ejecuta acciones
4. **Observabilidad pobre:** Dificil debuggear problemas en produccion
5. **UX de admin compleja:** Requiere conocimientos tecnicos

**Recomendacion:** Implementar Voice Agent v2.0 siguiendo la arquitectura propuesta antes de escalar a mas tenants.

---

*Este documento es parte de la documentacion de Voice Agent v2.0. Ver 04-ARQUITECTURA-PROPUESTA.md para la solucion.*
