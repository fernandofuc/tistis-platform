# VOICE AGENT v2.0 - INVESTIGACION DE MEJORES PRACTICAS DE LA INDUSTRIA

**Documento:** 03-INVESTIGACION-INDUSTRIA.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Investigacion Completada

---

## 1. RESUMEN DE INVESTIGACION

Se investigo exhaustivamente las mejores practicas de la industria para Voice AI agents, incluyendo:

- Arquitectura de VAPI y patrones de integracion
- Optimizacion de latencia para conversaciones en tiempo real
- Patrones VoiceRAG (Voice + Retrieval Augmented Generation)
- VAPI Squads para multi-asistente
- Structured Data Extraction
- Seguridad de webhooks
- Multi-tenant phone provisioning
- Dynamic prompt generation

**Fuentes consultadas:** 15+ articulos tecnicos, documentacion oficial, y case studies.

---

## 2. ARQUITECTURA DE VAPI

### 2.1 Pipeline de Voice AI

VAPI ejecuta un loop en tiempo real de tres pasos:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VAPI REAL-TIME LOOP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐                │
│   │ LISTEN  │ ---> │  THINK  │ ---> │  SPEAK  │                │
│   │  (STT)  │      │  (LLM)  │      │  (TTS)  │                │
│   └─────────┘      └─────────┘      └─────────┘                │
│       │                │                │                       │
│       v                v                v                       │
│   Deepgram         OpenAI/         ElevenLabs                  │
│   AssemblyAI       Claude/          Google                     │
│   Whisper          Gemini           Azure                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Componentes Principales

| Componente | Funcion | Proveedores Soportados |
|------------|---------|------------------------|
| **Speech-to-Text (STT)** | Convierte voz a texto | Deepgram, AssemblyAI, OpenAI Whisper, Google |
| **Language Model (LLM)** | Genera respuestas | OpenAI, Claude, Gemini, Groq, custom |
| **Text-to-Speech (TTS)** | Convierte texto a voz | ElevenLabs, Deepgram, Cartesia, OpenAI, Azure |

### 2.3 Server-Side Response Mode

**Dos modos de operacion:**

| Modo | Descripcion | Uso Recomendado |
|------|-------------|-----------------|
| **Client-Side** | VAPI maneja LLM directamente | Casos simples, prototipado |
| **Server-Side** | Tu servidor genera respuestas | Control total, RAG, logica compleja |

**Para TIS TIS:** Server-Side Response Mode es el correcto porque:
- Usamos LangGraph para orquestacion multi-agente
- Tenemos RAG propio con knowledge base
- Necesitamos control total sobre costos de IA

**Configuracion Server-Side:**
```json
{
  "assistant": {
    "name": "Sofia",
    "serverUrl": "https://tu-servidor.com/webhook",
    "serverUrlSecret": "tu-secret-seguro"
    // NOTA: NO hay campo "model" - eso activa server-side mode
  }
}
```

### 2.4 Features Avanzadas de VAPI

#### Squads (Multi-Asistente)

Permite crear equipos de asistentes especializados:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SQUAD ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌──────────────┐                             │
│                    │   ROUTER     │                             │
│                    │  (Recepcion) │                             │
│                    └──────┬───────┘                             │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         v                 v                 v                    │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐               │
│   │ BOOKING  │     │  SALES   │     │ SUPPORT  │               │
│   │  Agent   │     │  Agent   │     │  Agent   │               │
│   └──────────┘     └──────────┘     └──────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Handoff Context Options:**
- `none`: Fresh start (para cambios sensibles como pagos)
- `last_n`: Ultimos N mensajes
- `all`: Historial completo

**Caso real:** Fleetworks procesa 240,000 llamadas/dia con Squads.

#### Flow Studio

Editor visual para disenar flujos conversacionales:
- Branching prompts
- Error fallback
- Conditional paths
- Webhook triggers

**Para TIS TIS:** No usaremos Flow Studio, mantendremos control en LangGraph.

---

## 3. OPTIMIZACION DE LATENCIA

### 3.1 Umbrales Criticos

```
LATENCIA Y PERCEPCION DEL USUARIO

0ms ────────── 300ms ────────── 500ms ────────── 800ms ────────── 1000ms+
    │              │               │               │               │
    │   IDEAL      │   NATURAL     │   ACEPTABLE   │   NOTORIO     │
    │              │               │               │               │
    │ Conversacion │ Pausa normal  │ Usuario nota  │ Experiencia   │
    │ muy fluida   │ no molesta    │ pero tolera   │ degradada     │
```

**Targets recomendados:**
- **p50:** < 500ms
- **p95:** < 800ms

**Impacto de negocio:**
- Reducir latencia 200ms = +15% engagement
- Optimizar flujos = +25% conversion rate
- Sistemas optimizados = +30-40% task completion

### 3.2 Desglose de Latencia Tipica

```
PIPELINE DE LATENCIA (Tipico)

Componente                    Latencia
─────────────────────────────────────────
Network (routers)             < 10ms cada
Telephony (SIP/carrier)       200-800ms
Speech Recognition (STT)      40-300ms (streaming)
LLM Processing                100-400ms (first token)
Text-to-Speech (TTS)          50-200ms (first chunk)
─────────────────────────────────────────
TOTAL TIPICO                  400-1500ms
```

### 3.3 Estrategias de Optimizacion

#### 3.3.1 Streaming vs Batch

| Enfoque | Latencia | Descripcion |
|---------|----------|-------------|
| **Batch** | +200-500ms | Espera mensaje completo antes de procesar |
| **Streaming** | 100-200ms | Procesa mientras usuario habla |

**Recomendacion:** Usar streaming ASR (Automatic Speech Recognition).

#### 3.3.2 Regional/Edge Deployment

```
DEPLOYMENT OPTIMO

┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   MALO: Componentes distribuidos globalmente                    │
│   ──────────────────────────────────────────                    │
│   STT (Virginia) -> LLM (London) -> TTS (Tokyo)                 │
│   = +300-500ms de latencia de red                               │
│                                                                  │
│   BUENO: Todo en la misma region/VPC                           │
│   ──────────────────────────────────────────                    │
│   STT, LLM, TTS en US-West                                      │
│   = <10ms entre componentes                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3.3 Model Selection

| Modelo | Latencia | Calidad | Uso Recomendado |
|--------|----------|---------|-----------------|
| GPT-4 | Alto | Excelente | Razonamiento complejo |
| GPT-3.5-turbo | Bajo | Buena | Respuestas rapidas |
| Claude Haiku | Muy bajo | Buena | Tiempo real |
| Custom fine-tuned | Variable | Especifica | Casos especificos |

**Estrategia hibrida:**
- Modelo ligero para respuestas inmediatas
- Modelo grande para analisis post-llamada

#### 3.3.4 Voice Activity Detection (VAD)

El VAD determina cuando el usuario termina de hablar.

**Configuracion en VAPI:**
```json
{
  "startSpeakingPlan": {
    "waitSeconds": 0.6,           // Espera inicial
    "onPunctuationSeconds": 0.2,  // Pausa tras puntuacion
    "onNoPunctuationSeconds": 1.2 // Pausa sin puntuacion
  }
}
```

**Presets recomendados:**
| Preset | waitSeconds | onPunctuation | onNoPunctuation | Uso |
|--------|-------------|---------------|-----------------|-----|
| Fast | 0.4 | 0.1 | 0.8 | Respuestas rapidas |
| Balanced | 0.6 | 0.2 | 1.2 | General (default) |
| Patient | 1.0 | 0.4 | 1.8 | Usuarios que hablan lento |

---

## 4. VOICERAG: VOZ + RAG

### 4.1 Arquitectura VoiceRAG

```
┌─────────────────────────────────────────────────────────────────┐
│                    VOICERAG PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   VOICE INPUT                                                    │
│       │                                                          │
│       v                                                          │
│   ┌─────────┐                                                   │
│   │   STT   │ Deepgram/Whisper                                  │
│   └────┬────┘                                                   │
│        │ Texto                                                   │
│        v                                                         │
│   ┌─────────────────┐                                           │
│   │  RAG RETRIEVAL  │                                           │
│   │  ─────────────  │                                           │
│   │  1. Embedding   │                                           │
│   │  2. Vector Search                                           │
│   │  3. Reranking   │                                           │
│   └────────┬────────┘                                           │
│            │ Contexto relevante                                  │
│            v                                                     │
│   ┌─────────────────┐                                           │
│   │   LLM + CONTEXT │                                           │
│   │   ─────────────  │                                           │
│   │   Prompt +       │                                           │
│   │   Retrieved docs │                                           │
│   └────────┬────────┘                                           │
│            │ Respuesta                                           │
│            v                                                     │
│   ┌─────────┐                                                   │
│   │   TTS   │ ElevenLabs                                        │
│   └────┬────┘                                                   │
│        │                                                         │
│        v                                                         │
│   VOICE OUTPUT                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Metricas de Latencia VoiceRAG

| Componente | Latencia Tipica | Optimizado |
|------------|-----------------|------------|
| STT | 200-400ms | 100-200ms |
| RAG Retrieval + LLM | 800-1200ms | 300-600ms |
| TTS | 300-600ms | 100-300ms |
| **Total E2E** | **1.3-2.2s** | **0.5-1.1s** |

**ElevenLabs reporta:** Su nueva arquitectura redujo latencia RAG de 326ms a 155ms (50% mejora).

### 4.3 Integracion con Function Calling

Microsoft VoiceRAG pattern usa function calling:

```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "search_knowledge_base",
        "description": "Search the knowledge base for relevant information",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "The search query"
            }
          }
        }
      }
    }
  ]
}
```

El modelo invoca tools para buscar en la knowledge base antes de responder.

---

## 5. STRUCTURED DATA EXTRACTION

### 5.1 VAPI analysisPlan

VAPI permite extraer datos estructurados de llamadas automaticamente:

```json
{
  "analysisPlan": {
    "structuredDataPlan": {
      "schema": {
        "type": "object",
        "properties": {
          "reservation_made": { "type": "boolean" },
          "reservation_date": { "type": "string" },
          "reservation_time": { "type": "string" },
          "guest_count": { "type": "integer" },
          "customer_name": { "type": "string" }
        }
      }
    },
    "summaryPlan": {
      "enabled": true,
      "maxLength": 500
    },
    "successEvaluationPlan": {
      "enabled": true
    }
  }
}
```

### 5.2 Multi-Schema Support

VAPI soporta multiples schemas por llamada:

```json
{
  "analysisPlan": {
    "structuredDataMultiPlan": [
      {
        "name": "reservation_data",
        "schema": { ... }
      },
      {
        "name": "lead_data",
        "schema": { ... }
      },
      {
        "name": "sentiment_data",
        "schema": { ... }
      }
    ]
  }
}
```

### 5.3 Best Practices

| Practica | Descripcion |
|----------|-------------|
| **Schemas especificos** | Disenar schemas estrechos para datos no sensibles |
| **Test thoroughly** | Verificar que outputs no contengan PII/PHI |
| **Reusabilidad** | Definir schemas una vez, usar en multiples asistentes |
| **Webhook handling** | Extraer datos del `end-of-call-report` |

---

## 6. SEGURIDAD DE WEBHOOKS

### 6.1 Metodos de Autenticacion VAPI

| Metodo | Header | Descripcion |
|--------|--------|-------------|
| **Bearer Token** | `Authorization: Bearer <token>` | Token en header |
| **X-Vapi-Signature** | `X-Vapi-Signature: <hmac>` | HMAC-SHA256 del body |
| **X-Vapi-Secret** | `X-Vapi-Secret: <secret>` | Secret directo (legacy) |

### 6.2 Verificacion de Firma HMAC

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Overhead:** < 5ms por validacion.

### 6.3 Best Practices de Seguridad

| Practica | Importancia | Implementacion |
|----------|-------------|----------------|
| **HMAC Validation** | Critica | Verificar X-Vapi-Signature |
| **IP Whitelist** | Alta | Solo permitir IPs de VAPI |
| **Timestamp Check** | Alta | Rechazar requests viejos (>5min) |
| **Rate Limiting** | Alta | Max 100-200 req/min por tenant |
| **HTTPS Only** | Critica | Nunca HTTP en produccion |
| **Secret Rotation** | Media | Rotar cada 90 dias |
| **Logging** | Alta | Log failed verifications (no secrets) |

### 6.4 IP Ranges de VAPI

```typescript
const VAPI_IP_RANGES = [
  '34.212.0.0/16',    // US-West-2
  '52.40.0.0/16',     // US-West-2
  '44.242.0.0/16',    // US-West-2
  // Verificar documentacion oficial para lista completa
];
```

**Nota:** Siempre verificar con documentacion oficial de VAPI para IPs actualizadas.

---

## 7. MULTI-TENANT PHONE PROVISIONING

### 7.1 Comparacion de Proveedores

| Aspecto | Telnyx | Twilio |
|---------|--------|--------|
| **Modelo** | Full-stack (red propia) | CPaaS (terceros) |
| **Cobertura** | 30+ paises con licencia | 180+ paises |
| **Provisioning** | API nativa, segundos | API, minutos |
| **AI Integration** | Nativa (Voice AI Agents) | Via terceros |
| **Latencia** | Menor (red propia) | Mayor (routing externo) |
| **Costo** | Generalmente menor | Premium |
| **White-label** | Soporte nativo | Requiere config |

### 7.2 VAPI Phone Provisioning

VAPI abstrae la complejidad:

```typescript
// Crear numero via VAPI (usa Twilio internamente)
const phoneNumber = await vapiClient.phoneNumbers.create({
  provider: 'twilio',
  assistantId: 'asst_xxx',
  fallbackDestination: {
    type: 'number',
    number: '+15551234567'
  }
});
```

### 7.3 Consideraciones Multi-Tenant

| Aspecto | Recomendacion |
|---------|---------------|
| **Aislamiento** | Un numero por tenant (minimo) |
| **Limite** | Max numeros = branches activos |
| **Billing** | Tracking separado por tenant |
| **Release** | Proceso de liberacion con cleanup |

---

## 8. DYNAMIC PROMPT GENERATION

### 8.1 Los 4 Pilares del Prompting para Voz

```
┌─────────────────────────────────────────────────────────────────┐
│                    4 PILLARS OF VOICE PROMPTING                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐    ┌─────────────┐                           │
│   │   PERSONA   │    │   CONTEXT   │                           │
│   │             │    │             │                           │
│   │ Quien es    │    │ Situacion   │                           │
│   │ el agente   │    │ actual      │                           │
│   └─────────────┘    └─────────────┘                           │
│                                                                  │
│   ┌─────────────┐    ┌─────────────┐                           │
│   │   RULES     │    │  KNOWLEDGE  │                           │
│   │             │    │             │                           │
│   │ Que puede   │    │ Que sabe    │                           │
│   │ y no puede  │    │ el agente   │                           │
│   └─────────────┘    └─────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Inyeccion de Contexto Dinamico

```typescript
// Datos inyectados en tiempo real
const dynamicContext = {
  customer_name: "Juan Perez",
  customer_history: "3 visitas previas",
  current_time: "14:30",
  business_status: "ABIERTO",
  available_slots: ["15:00", "15:30", "16:00"],
  active_promotions: ["2x1 en bebidas"]
};

// Inyeccion en prompt
const prompt = `
## CLIENTE ACTUAL
Nombre: ${dynamicContext.customer_name}
Historial: ${dynamicContext.customer_history}

## DISPONIBILIDAD AHORA
Horarios disponibles: ${dynamicContext.available_slots.join(', ')}

## PROMOCIONES ACTIVAS
${dynamicContext.active_promotions.join('\n')}
`;
```

### 8.3 Optimizacion de Tokens

| Enfoque | Tokens | Latencia | Calidad |
|---------|--------|----------|---------|
| Prompt detallado (2000 tokens) | Alto | 1200ms | Variable |
| Prompt conciso (300 tokens) | Bajo | 400ms | Alta |
| **Diferencia** | **-85%** | **-67%** | **+10%** |

**Best practice:** 300 tokens de instrucciones focalizadas + 500 tokens max de RAG context.

### 8.4 Reglas Especificas para Voz

```markdown
## REGLAS PARA RESPUESTAS DE VOZ

1. BREVEDAD: Maximo 2-3 oraciones por respuesta
2. NUMEROS: Di uno por uno (dos-cuatro-cinco, no doscientos cuarenta y cinco)
3. CONFIRMACION: Siempre repite datos criticos
4. NO TEXTO: Nunca digas "te envio un link" o "escribeme"
5. PAUSAS: Usa frases de transicion para evitar silencios
6. ERRORES: Si no entiendes, pide que repitan amablemente
```

---

## 9. FUENTES Y REFERENCIAS

### 9.1 Documentacion Oficial

| Fuente | URL | Contenido |
|--------|-----|-----------|
| VAPI Docs | docs.vapi.ai | Documentacion completa |
| VAPI Squads | docs.vapi.ai/squads | Multi-asistente |
| VAPI Structured Outputs | docs.vapi.ai/assistants/structured-outputs | Extraccion datos |
| VAPI Authentication | docs.vapi.ai/server-url/server-authentication | Seguridad |

### 9.2 Articulos Tecnicos

| Titulo | Fuente | Tema |
|--------|--------|------|
| Speech Latency Solutions | vapi.ai/blog | Optimizacion latencia |
| The 300ms Rule | assemblyai.com/blog | Latencia voice AI |
| Engineering RAG | elevenlabs.io/blog | Optimizacion RAG |
| VoiceRAG Pattern | Microsoft Tech Community | Arquitectura |
| Voice AI Stack 2025 | assemblyai.com/blog | Stack tecnologico |

### 9.3 Comparativas y Reviews

| Titulo | Fuente | Tema |
|--------|--------|------|
| VAPI AI Review 2025 | retellai.com/blog | Pros/cons VAPI |
| Deepgram vs ElevenLabs | deepgram.com/learn | Comparacion proveedores |
| Telnyx vs Twilio | telnyx.com/resources | Phone provisioning |
| Best AI Voice Agents | dialora.ai/blog | Comparativa plataformas |

### 9.4 Case Studies

| Empresa | Volumen | Tecnologia |
|---------|---------|------------|
| Fleetworks | 240,000 calls/dia | VAPI Squads |
| OpenTable Voice AI | Enterprise | VAPI + custom |
| Loman AI | Restaurants | VAPI + RAG |

---

## 10. CONCLUSIONES PARA TIS TIS

### 10.1 Que Adoptar

| Practica | Prioridad | Razon |
|----------|-----------|-------|
| Server-Side Response Mode | Mantener | Ya implementado, correcto |
| Circuit Breaker (8s timeout) | P0 | Evita llamadas colgadas |
| HMAC + IP Whitelist | P0 | Seguridad empresarial |
| Multi-schema extraction | P1 | Datos estructurados por tipo |
| Prompt optimizado (300 tokens) | P1 | Reducir latencia 60% |
| VAD presets configurables | P2 | UX personalizable |

### 10.2 Que No Adoptar (Por Ahora)

| Practica | Razon |
|----------|-------|
| VAPI Squads | Complejidad innecesaria, LangGraph ya maneja multi-agente |
| Flow Studio | Perdemos control, mejor mantener logica en LangGraph |
| VAPI LLM directo | Necesitamos RAG y tool calling propio |

### 10.3 Metricas Target

| Metrica | Actual | Target v2.0 | Industria |
|---------|--------|-------------|-----------|
| p50 Latencia | ~800ms | <500ms | <500ms |
| p95 Latencia | ~1500ms | <800ms | <800ms |
| Error Rate | ~5% | <2% | <1% |
| Fallback Rate | N/A | <2% | <2% |

---

*Este documento es parte de la documentacion de Voice Agent v2.0. Ver 04-ARQUITECTURA-PROPUESTA.md para como aplicamos estas practicas.*
