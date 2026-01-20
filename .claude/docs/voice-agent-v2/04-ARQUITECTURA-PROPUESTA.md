# VOICE AGENT v2.0 - ARQUITECTURA PROPUESTA

**Documento:** 04-ARQUITECTURA-PROPUESTA.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Propuesta Final

---

## 1. PRINCIPIOS FUNDAMENTALES

### 1.1 Filosofia de Diseno

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PRINCIPIOS FUNDAMENTALES                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. ABSTRACCION TOTAL                                                    │
│     Cliente NUNCA ve VAPI, Deepgram, ElevenLabs                         │
│     Todo se presenta como "TIS TIS Voice"                               │
│                                                                           │
│  2. TIPOS DE ASISTENTE                                                   │
│     Configuracion guiada segun vertical + necesidad                     │
│     3 tipos por vertical (Basico/Estandar/Completo)                    │
│                                                                           │
│  3. RESILIENCIA                                                          │
│     Circuit breakers, fallbacks, graceful degradation                   │
│     Nunca una llamada sin respuesta                                     │
│                                                                           │
│  4. UNIFIED BRAIN                                                        │
│     Mismo LangGraph para Voice y Chat                                   │
│     Tool Calling V7 compartido                                          │
│                                                                           │
│  5. OBSERVABILITY                                                        │
│     Metricas, logs estructurados, tracing                              │
│     Debugging facil en produccion                                       │
│                                                                           │
│  6. LATENCY-FIRST                                                        │
│     Target: p50 < 500ms, p95 < 800ms                                   │
│     Optimizar en cada capa                                              │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Decisiones de Arquitectura

| Decision | Elegido | Alternativa | Razon |
|----------|---------|-------------|-------|
| Response Mode | Server-Side | Client-Side | Control total sobre IA |
| Orquestacion | LangGraph | VAPI Squads | Ya tenemos LangGraph |
| Tool Calling | Unificado V7 | Separado Voice/Chat | Consistencia |
| Prompts | Templates versionados | Texto libre | Mantenibilidad |
| Circuit Breaker | Custom | Ninguno | Resiliencia critica |
| Logging | Estructurado | console.log | Debugging produccion |

---

## 2. DIAGRAMA DE ARQUITECTURA COMPLETO

```
                                    ┌─────────────────────┐
                                    │   ADMINISTRADOR     │
                                    │   TIS TIS           │
                                    └──────────┬──────────┘
                                               │ Configura
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              TIS TIS PLATFORM (Next.js)                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           PRESENTATION LAYER                                 │   │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐           │   │
│  │  │ Voice Agent     │   │ Voice Agent     │   │ Voice Agent     │           │   │
│  │  │ Wizard (UI)     │   │ Testing (Web)   │   │ Analytics       │           │   │
│  │  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘           │   │
│  │           │                     │                     │                     │   │
│  └───────────┼─────────────────────┼─────────────────────┼─────────────────────┘   │
│              │                     │                     │                          │
│              └─────────────────────┴─────────────────────┘                          │
│                                    │                                                 │
│  ┌─────────────────────────────────┴────────────────────────────────────────────┐   │
│  │                        VOICE ORCHESTRATION LAYER                              │   │
│  │                                                                               │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │   │
│  │  │ Assistant        │  │ Phone Number     │  │ Call             │           │   │
│  │  │ Type Manager     │  │ Provisioner      │  │ Manager          │           │   │
│  │  │ ──────────────   │  │ ──────────────   │  │ ──────────────   │           │   │
│  │  │ - Get types      │  │ - Request number │  │ - Get calls      │           │   │
│  │  │ - Validate       │  │ - Release number │  │ - Get details    │           │   │
│  │  │ - Build config   │  │ - List numbers   │  │ - Analytics      │           │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘           │   │
│  │                                                                               │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                                  │   │
│  │  │ Voice Catalog    │  │ Analytics        │                                  │   │
│  │  │ Service          │  │ Engine           │                                  │   │
│  │  │ ──────────────   │  │ ──────────────   │                                  │   │
│  │  │ - List voices    │  │ - Aggregate      │                                  │   │
│  │  │ - Get preview    │  │ - Dashboard      │                                  │   │
│  │  │ - Validate       │  │ - Export         │                                  │   │
│  │  └──────────────────┘  └──────────────────┘                                  │   │
│  │                                                                               │   │
│  └───────────────────────────────────┬──────────────────────────────────────────┘   │
│                                      │                                               │
│  ┌───────────────────────────────────┴──────────────────────────────────────────┐   │
│  │                           WEBHOOK HANDLER v2.0                                │   │
│  │                                                                               │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ SECURITY GATE  │  │ CIRCUIT        │  │ REQUEST        │                 │   │
│  │  │ ────────────── │  │ BREAKER        │  │ ROUTER         │                 │   │
│  │  │ 1. IP Whitelist│  │ ────────────── │  │ ────────────── │                 │   │
│  │  │ 2. HMAC Verify │  │ - State mgmt   │  │ - assistant-req│                 │   │
│  │  │ 3. Timestamp   │  │ - Timeout 8s   │  │ - conv-update  │                 │   │
│  │  │ 4. Rate Limit  │  │ - Fallback     │  │ - end-of-call  │                 │   │
│  │  │ 5. Content-Type│  │ - Recovery     │  │ - status       │                 │   │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘                 │   │
│  │          │                   │                   │                           │   │
│  │          └───────────────────┴───────────────────┘                           │   │
│  │                              │                                                │   │
│  └──────────────────────────────┼────────────────────────────────────────────────┘   │
│                                 │                                                     │
│  ┌──────────────────────────────┴────────────────────────────────────────────────┐   │
│  │                         UNIFIED AI BRAIN (LangGraph)                          │   │
│  │                                                                               │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    TOOL CALLING V7 (Unified)                            │  │   │
│  │  │                                                                         │  │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐           │  │   │
│  │  │  │ Booking   │  │ Menu/     │  │ FAQ       │  │ Escalate  │           │  │   │
│  │  │  │ Tools     │  │ Order     │  │ Tools     │  │ Tools     │           │  │   │
│  │  │  │           │  │ Tools     │  │           │  │           │           │  │   │
│  │  │  │ check_    │  │           │  │ search_   │  │ transfer_ │           │  │   │
│  │  │  │ availability│ │ get_menu │  │ knowledge │  │ to_human  │           │  │   │
│  │  │  │ create_   │  │ create_   │  │ get_hours │  │ request_  │           │  │   │
│  │  │  │ reservation│ │ order    │  │ get_info  │  │ callback  │           │  │   │
│  │  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘           │  │   │
│  │  │                                                                         │  │   │
│  │  └────────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                               │   │
│  │  ┌────────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                       RAG / Knowledge Base                              │  │   │
│  │  │                                                                         │  │   │
│  │  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │  │   │
│  │  │  │ Services KB     │  │ FAQs KB         │  │ Policies KB     │        │  │   │
│  │  │  │ (Embeddings)    │  │ (Embeddings)    │  │ (Embeddings)    │        │  │   │
│  │  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │  │   │
│  │  │                                                                         │  │   │
│  │  │  Hybrid Search: Semantic + BM25 + RRF Fusion                           │  │   │
│  │  │                                                                         │  │   │
│  │  └────────────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                               │   │
│  └───────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │                              SUPABASE (Data Layer)                            │   │
│  │                                                                               │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ voice_         │  │ voice_         │  │ voice_         │                 │   │
│  │  │ assistant_     │  │ calls          │  │ assistant_     │                 │   │
│  │  │ types          │  │                │  │ configs        │                 │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘                 │   │
│  │                                                                               │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │   │
│  │  │ voice_         │  │ voice_         │  │ voice_circuit_ │                 │   │
│  │  │ catalog        │  │ call_messages  │  │ breaker_state  │                 │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘                 │   │
│  │                                                                               │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
            │    VAPI      │      │  DEEPGRAM    │      │  ELEVENLABS  │
            │  (Telefonia) │      │    (STT)     │      │    (TTS)     │
            │              │      │              │      │              │
            │ Server-Side  │      │  nova-2      │      │ multilingual │
            │ Response Mode│      │  Spanish     │      │    v2        │
            └──────────────┘      └──────────────┘      └──────────────┘
                    │
                    │ PSTN
                    ▼
            ┌──────────────┐
            │   CLIENTE    │
            │ (Llamada)    │
            └──────────────┘
```

---

## 3. FLUJO DETALLADO DE LLAMADA v2.0

### 3.1 Fase 1: Llamada Entrante (assistant-request)

```
CLIENTE MARCA: +52 55 1234 5678
         │
         ▼
    ┌─────────┐
    │  VAPI   │ Recibe llamada, busca webhook
    └────┬────┘
         │
         ▼
POST /api/voice-agent/webhook
{
  "type": "assistant-request",
  "call": {
    "id": "call_abc123",
    "phoneNumber": {
      "id": "pn_xyz",
      "number": "+525512345678"
    }
  }
}
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY GATE                               │
├─────────────────────────────────────────────────────────────────┤
│  [✓] 1. IP in VAPI whitelist                                    │
│  [✓] 2. X-Vapi-Signature valid (HMAC-SHA256)                   │
│  [✓] 3. Timestamp within 5 minutes                             │
│  [✓] 4. Rate limit not exceeded                                │
│  [✓] 5. Content-Type is application/json                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST ROUTER                                │
├─────────────────────────────────────────────────────────────────┤
│  Event Type: assistant-request                                  │
│  Handler: handleAssistantRequest()                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│               handleAssistantRequest()                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Get tenant_id from phone number                            │
│  2. Get voice_assistant_config (type, personality, voice)      │
│  3. Get voice_assistant_type (capabilities, tools, schemas)    │
│  4. Create voice_calls record (status: 'initiated')            │
│  5. Build VAPI assistant config (Server-Side Mode)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
RESPONSE TO VAPI:
{
  "assistant": {
    "name": "Sofia",
    "firstMessage": "Hola! Gracias por llamar a Mariscos El Caracol...",
    "firstMessageMode": "assistant-speaks-first",

    "voice": {
      "provider": "elevenlabs",
      "voiceId": "LegCbmbXKbT5PUp3QFWv",
      "model": "eleven_multilingual_v2",
      "stability": 0.5,
      "similarityBoost": 0.75
    },

    "transcriber": {
      "provider": "deepgram",
      "model": "nova-2",
      "language": "es"
    },

    "startSpeakingPlan": {
      "waitSeconds": 0.6,
      "onPunctuationSeconds": 0.2,
      "onNoPunctuationSeconds": 1.2
    },

    "serverUrl": "https://tistis.com/api/voice-agent/webhook",
    "serverUrlSecret": "secret_xxx",

    "analysisPlan": {
      "structuredDataPlan": { ... },
      "structuredDataMultiPlan": [ ... ],
      "summaryPlan": { "enabled": true }
    }

    // NOTA: NO HAY "model" - Activa Server-Side Response Mode
  }
}
```

### 3.2 Fase 2: Conversacion (conversation-update)

```
CLIENTE DICE: "Quiero hacer una reservacion para manana a las 8"
         │
         ▼
    ┌─────────┐
    │ VAPI STT│ Deepgram nova-2 transcribe
    └────┬────┘
         │
         ▼
POST /api/voice-agent/webhook
{
  "type": "conversation-update",
  "call": { "id": "call_abc123" },
  "messages": [
    { "role": "assistant", "content": "Hola! Gracias por llamar..." },
    { "role": "user", "content": "Quiero hacer una reservacion para manana a las 8" }
  ]
}
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY GATE                               │
│                      (mismas validaciones)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CIRCUIT BREAKER                              │
├─────────────────────────────────────────────────────────────────┤
│  State: CLOSED                                                  │
│  Failures: 0                                                    │
│  Action: Execute with 8s timeout                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              handleConversationUpdate()                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Validate transcription (not empty, not corrupted)          │
│  2. Get call record                                             │
│  3. Get voice_assistant_config                                  │
│  4. Get conversation history (last 10 messages)                │
│  5. Inject voice-specific instructions                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                LANGGRAPH EXECUTION                               │
├─────────────────────────────────────────────────────────────────┤
│  Input:                                                         │
│  {                                                              │
│    channel: 'voice',                                            │
│    tenant_id: 'xxx',                                            │
│    message: 'Quiero hacer una reservacion...',                 │
│    conversation_history: [...],                                 │
│    max_response_length: 150,                                    │
│    tools_enabled: ['check_availability', 'create_reservation'] │
│  }                                                              │
│                                                                  │
│  Processing:                                                     │
│  1. Intent detection -> BOOK_APPOINTMENT                        │
│  2. Entity extraction -> date: tomorrow, time: 20:00           │
│  3. Tool call -> check_availability(date, time)                │
│  4. Tool result -> { available: true, slots: [...] }           │
│  5. Generate response                                           │
│                                                                  │
│  Output:                                                         │
│  {                                                              │
│    response: "Claro! Tengo disponible a las 8. Para cuantas   │
│               personas seria la reservacion?",                  │
│    intent: "BOOK_APPOINTMENT",                                  │
│    tool_calls: [{ name: "check_availability", result: {...} }],│
│    signals: [{ signal: "booking_intent", points: 90 }]         │
│  }                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SAVE TO DATABASE                              │
├─────────────────────────────────────────────────────────────────┤
│  1. voice_call_messages (user message)                         │
│  2. voice_call_messages (assistant response)                   │
│  3. Update voice_calls (turns_count, latency_avg)              │
│  4. Log structured data                                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
RESPONSE TO VAPI:
{
  "assistantResponse": "Claro! Tengo disponible a las 8. Para cuantas personas seria la reservacion?"
}
         │
         ▼
    ┌─────────┐
    │ VAPI TTS│ ElevenLabs sintetiza audio
    └────┬────┘
         │
         ▼
CLIENTE ESCUCHA: "Claro! Tengo disponible a las 8..."
```

### 3.3 Fase 3: Circuit Breaker en Accion

```
ESCENARIO: LangGraph tarda mas de 8 segundos

┌─────────────────────────────────────────────────────────────────┐
│                     CIRCUIT BREAKER                              │
├─────────────────────────────────────────────────────────────────┤
│  State: CLOSED                                                  │
│  Timeout: 8000ms                                                │
│                                                                  │
│  LangGraph execution...                                         │
│  [=====                    ] 2s                                 │
│  [==========               ] 4s                                 │
│  [===============          ] 6s                                 │
│  [====================     ] 8s                                 │
│  [!] TIMEOUT REACHED                                            │
│                                                                  │
│  Action: Return fallback response                               │
│  Failures: 1 (of 5 threshold)                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
FALLBACK RESPONSE:
{
  "assistantResponse": "Disculpa, estoy teniendo dificultades tecnicas. Podrias intentar de nuevo en unos segundos, o si prefieres puedo transferirte con alguien del equipo?"
}
```

### 3.4 Fase 4: Fin de Llamada (end-of-call-report)

```
CLIENTE CUELGA
         │
         ▼
POST /api/voice-agent/webhook
{
  "type": "end-of-call-report",
  "call": { "id": "call_abc123" },
  "endedReason": "customer-ended-call",
  "durationSeconds": 180,
  "recordingUrl": "https://...",
  "transcript": "...",
  "analysis": {
    "structuredData": {
      "reservation_made": true,
      "reservation_date": "2026-01-20",
      "reservation_time": "20:00",
      "guest_count": 4,
      "customer_name": "Juan Perez"
    },
    "summary": "Cliente llamo para hacer reservacion...",
    "successEvaluation": { "success": true }
  }
}
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│               handleEndOfCallReport()                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Update voice_calls:                                         │
│     - status: 'completed'                                       │
│     - ended_at: now()                                           │
│     - duration_seconds: 180                                     │
│     - transcription: full transcript                            │
│     - analysis: structured data + summary                       │
│     - outcome: 'appointment_booked'                             │
│     - recording_url                                             │
│                                                                  │
│  2. Update voice_usage_logs:                                    │
│     - call_minutes: 3                                           │
│     - tts_characters: estimated                                 │
│     - ai_tokens: from LangGraph                                │
│                                                                  │
│  3. Update lead scoring (if applicable)                        │
│                                                                  │
│  4. Trigger post-call actions:                                  │
│     - Send confirmation SMS (optional)                          │
│     - Update CRM (future)                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. CONFIGURACION VAPI SERVER-SIDE MODE

### 4.1 Estructura Completa de Assistant Config

```typescript
interface VAPIAssistantConfig {
  // Identificacion
  name: string;                    // "Sofia"

  // Mensaje inicial
  firstMessage: string;            // "Hola! Gracias por llamar..."
  firstMessageMode: 'assistant-speaks-first' | 'assistant-waits-for-user';

  // Voz (ElevenLabs)
  voice: {
    provider: 'elevenlabs';
    voiceId: string;               // ID de voz en ElevenLabs
    model: string;                 // "eleven_multilingual_v2"
    stability: number;             // 0-1 (0.5 default)
    similarityBoost: number;       // 0-1 (0.75 default)
    optimizeStreamingLatency?: number;  // 0-4
  };

  // Transcripcion (Deepgram)
  transcriber: {
    provider: 'deepgram';
    model: string;                 // "nova-2"
    language: string;              // "es"
    smartFormat?: boolean;         // true
    keywords?: string[];           // Palabras especiales
  };

  // Timing de respuesta
  startSpeakingPlan: {
    waitSeconds: number;           // 0.6 default
    onPunctuationSeconds: number;  // 0.2 default
    onNoPunctuationSeconds: number;// 1.2 default
    smartEndpointingEnabled?: boolean;
  };

  // Grabacion
  recordingEnabled: boolean;       // true

  // Frases de fin de llamada
  endCallPhrases: string[];        // ["adios", "bye", ...]

  // Server URL (CRITICO - Activa Server-Side Mode)
  serverUrl: string;               // "https://tistis.com/api/voice-agent/webhook"
  serverUrlSecret: string;         // Secret para HMAC

  // Analisis post-llamada
  analysisPlan: {
    structuredDataPlan: {
      enabled: boolean;
      schema: JSONSchema;          // Schema de datos a extraer
    };
    structuredDataMultiPlan?: Array<{
      name: string;
      enabled: boolean;
      schema: JSONSchema;
    }>;
    summaryPlan: {
      enabled: boolean;
      maxLength?: number;
    };
    successEvaluationPlan: {
      enabled: boolean;
      rubric?: string;
    };
  };

  // NOTA: NO incluir "model" - eso activa Server-Side Response Mode
}
```

### 4.2 Presets de Response Speed

```typescript
const RESPONSE_SPEED_PRESETS = {
  fast: {
    waitSeconds: 0.4,
    onPunctuationSeconds: 0.1,
    onNoPunctuationSeconds: 0.8,
    description: 'Respuestas rapidas, ideal para consultas simples'
  },
  balanced: {
    waitSeconds: 0.6,
    onPunctuationSeconds: 0.2,
    onNoPunctuationSeconds: 1.2,
    description: 'Balance entre velocidad y precision (recomendado)'
  },
  patient: {
    waitSeconds: 1.0,
    onPunctuationSeconds: 0.4,
    onNoPunctuationSeconds: 1.8,
    description: 'Espera mas, ideal para usuarios que hablan lento'
  }
};
```

---

## 5. INTEGRACION CON RAG EXISTENTE

### 5.1 Flujo de RAG en Voice

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE + RAG INTEGRATION                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   USER QUERY (Voice)                                            │
│   "Cuanto cuesta una limpieza dental?"                          │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              LANGGRAPH ROUTER                            │   │
│   │  Intent: FAQ_QUERY                                       │   │
│   │  Action: Search Knowledge Base                           │   │
│   └────────────────────────┬────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              RAG RETRIEVAL                               │   │
│   │                                                          │   │
│   │  1. Generate embedding for query                        │   │
│   │  2. Semantic search in vector store                     │   │
│   │  3. BM25 keyword search                                 │   │
│   │  4. RRF fusion of results                               │   │
│   │  5. Return top 3 relevant chunks                        │   │
│   │                                                          │   │
│   │  Results:                                                │   │
│   │  - services.dental: "Limpieza dental: $500-800 MXN"     │   │
│   │  - faqs: "Incluye revision completa..."                 │   │
│   │  - policies: "Aceptamos pagos en..."                    │   │
│   └────────────────────────┬────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              LLM GENERATION                              │   │
│   │                                                          │   │
│   │  Prompt:                                                 │   │
│   │  - System: Voice assistant instructions                 │   │
│   │  - Context: RAG results (500 tokens max)                │   │
│   │  - History: Last 10 messages                            │   │
│   │  - User: "Cuanto cuesta una limpieza dental?"          │   │
│   │                                                          │   │
│   │  Response (max 150 chars for voice):                    │   │
│   │  "La limpieza dental tiene un costo de 500 a 800       │   │
│   │   pesos, e incluye revision completa. Te gustaria      │   │
│   │   agendar una cita?"                                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Diferencias Voice vs Chat en RAG

| Aspecto | Chat | Voice |
|---------|------|-------|
| Max response length | 2000+ chars | 150-200 chars |
| Context window | 4000 tokens | 2000 tokens |
| RAG chunks | Top 5 | Top 3 |
| Response style | Can include lists, formatting | Plain text, conversational |
| Links/URLs | Can include | Never include |

---

## 6. LOGGING Y OBSERVABILIDAD

### 6.1 Estructura de Logs

```typescript
// Log estructurado para voice events
interface VoiceLogEntry {
  timestamp: string;           // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;               // 'webhook_received', 'langgraph_response', etc.

  // Contexto
  request_id: string;          // UUID unico por request
  call_id?: string;            // VAPI call ID
  tenant_id?: string;

  // Metricas
  latency_ms?: number;
  tokens_used?: number;

  // Datos adicionales
  data?: Record<string, unknown>;

  // Error info
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}
```

### 6.2 Eventos a Loggear

| Evento | Level | Cuando |
|--------|-------|--------|
| `webhook_received` | info | Cada request al webhook |
| `security_check_passed` | debug | Todas las validaciones OK |
| `security_check_failed` | warn | Alguna validacion falla |
| `circuit_breaker_state_change` | warn | CLOSED->OPEN, etc |
| `langgraph_start` | debug | Inicio de procesamiento |
| `langgraph_response` | info | Respuesta generada |
| `langgraph_timeout` | error | Timeout de 8s alcanzado |
| `tool_executed` | info | Tool call completado |
| `fallback_used` | warn | Se uso respuesta fallback |
| `call_started` | info | Nueva llamada iniciada |
| `call_ended` | info | Llamada terminada |

### 6.3 Dashboard de Metricas

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOICE METRICS DASHBOARD                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TODAY'S SUMMARY                                                │
│  ────────────────────────────────────────────────────────────   │
│  Total Calls: 47          Avg Duration: 3.2 min                │
│  Success Rate: 94%        Fallback Rate: 2.1%                  │
│                                                                  │
│  LATENCY (p50 / p95)                                           │
│  ────────────────────────────────────────────────────────────   │
│  Response: 423ms / 712ms  ████████░░ Target: <500ms/<800ms     │
│  LangGraph: 312ms / 598ms ███████░░░                           │
│  Total E2E: 856ms / 1.2s  ██████████                           │
│                                                                  │
│  OUTCOMES                                                        │
│  ────────────────────────────────────────────────────────────   │
│  ██████████████░░░░░░ Appointment Booked (68%)                 │
│  ████░░░░░░░░░░░░░░░░ Information Given (21%)                  │
│  ██░░░░░░░░░░░░░░░░░░ Escalated (8%)                          │
│  █░░░░░░░░░░░░░░░░░░░ Abandoned (3%)                          │
│                                                                  │
│  CIRCUIT BREAKER STATUS                                         │
│  ────────────────────────────────────────────────────────────   │
│  State: CLOSED ✓          Failures: 0/5                        │
│  Last Trip: Never         Recovery Time: N/A                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. COMPARATIVA ARQUITECTURA v1 vs v2

| Aspecto | v1 (Actual) | v2 (Propuesto) |
|---------|-------------|----------------|
| **Security Gate** | Secret basico | 5 capas validacion |
| **Circuit Breaker** | No existe | Timeout 8s + fallback |
| **Request Routing** | Switch case simple | Router con handlers |
| **LangGraph Integration** | Directo, sin timeout | Con timeout y fallback |
| **RAG Integration** | Compartido sin optimizar | Optimizado para voz |
| **Logging** | console.log | Estructurado + metricas |
| **Tipos Asistente** | 1 generico | 6 especializados |
| **Tool Calling** | Solo intents | Ejecucion real |
| **Prompts** | Texto libre | Templates versionados |
| **Testing** | Manual | Web + Telefono integrado |

---

## 8. PROXIMOS PASOS

1. **Revisar 05-MODELO-DATOS.md** para esquema de base de datos
2. **Revisar 06-SEGURIDAD-RESILIENCIA.md** para implementacion detallada
3. **Revisar 11-PLAN-IMPLEMENTACION.md** para orden de trabajo

---

*Este documento es parte de la documentacion de Voice Agent v2.0.*
