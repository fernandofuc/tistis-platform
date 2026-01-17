# Auditoría Completa de la Arquitectura AI - TIS TIS Platform

**Fecha:** 2026-01-16
**Versión:** 1.0
**Estado:** FASE 1 - En Progreso

---

## 1. RESUMEN EJECUTIVO

### 1.1 Problema Identificado
El sistema AI de TIS TIS Platform tiene **múltiples arquitecturas coexistentes** que pueden generar inconsistencias entre lo que el usuario prueba en Preview y lo que se ejecuta en producción.

### 1.2 Arquitecturas Coexistentes

| Arquitectura | Ubicación | Características | Estado |
|--------------|-----------|-----------------|--------|
| **Legacy** | `ai.service.ts` | Llamada directa a GPT-5-mini, sin Tools, sin RAG | Activa (default) |
| **LangGraph V5.5** | `langgraph-ai.service.ts` + `tistis-graph.ts` | Multi-agente, Tools, RAG opcional, prompts cacheados | Feature flag |
| **V6 Minimal** | Mismos archivos + flag | Prompt minimal (~1,200 tokens) + Tools dinámicos | Feature flag |

### 1.3 Riesgo Principal
> **Preview SIEMPRE usa LangGraph**, pero **Producción puede usar Legacy** si el tenant no tiene el flag habilitado. Esto significa que el usuario puede probar una respuesta perfecta en Preview y luego ver algo completamente diferente en producción.

---

## 2. MAPEO DE PUNTOS DE ENTRADA

### 2.1 Puntos de Entrada Identificados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PUNTOS DE ENTRADA AL SISTEMA AI                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐     ┌─────────────────────────────────────┐   │
│  │  1. PREVIEW EN VIVO     │     │  2. PRODUCCIÓN (Job Processor)      │   │
│  │  /api/ai-preview        │     │  /api/jobs/process                  │   │
│  │                         │     │                                     │   │
│  │  ↓                      │     │  ↓                                  │   │
│  │  generatePreviewResponse│     │  processAIResponseJob()             │   │
│  │  (SIEMPRE LangGraph)    │     │                                     │   │
│  │                         │     │  ↓                                  │   │
│  │  ↓                      │     │  generateAIResponseSmart()          │   │
│  │  executeGraph()         │     │                                     │   │
│  │                         │     │  ↓                                  │   │
│  └─────────────────────────┘     │  shouldUseLangGraph()?              │   │
│                                  │                                     │   │
│                                  │  YES → generateAIResponseWithGraph()│   │
│                                  │  NO  → generateAIResponse() [LEGACY]│   │
│                                  │                                     │   │
│                                  └─────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    3. OTROS ENDPOINTS (Menor uso)                    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  /api/ai-config/generate-prompt   → Solo genera prompts, no responde │   │
│  │  /api/agent-profiles/prompt       → Solo genera prompts por perfil   │   │
│  │  /api/channels/[id]/ai-config     → Solo configuración de canal      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Detalle de Cada Punto de Entrada

#### A) `/api/ai-preview/route.ts` (Preview en Vivo)
- **Archivo:** `app/api/ai-preview/route.ts`
- **Función:** `generatePreviewResponse()` (línea 249)
- **Ruta de Código:**
  1. Llama `generatePreviewResponse()` en `langgraph-ai.service.ts:1266`
  2. **SIEMPRE** usa LangGraph via `executeGraph()`
  3. **NO** verifica `shouldUseLangGraph()` - bypassa el check
- **Arquitectura Usada:** LangGraph V5.5 o V6 (dependiendo de `shouldUseMinimalPromptV6`)

#### B) `/api/jobs/process/route.ts` (Producción)
- **Archivo:** `app/api/jobs/process/route.ts`
- **Función:** `processAIResponseJob()` (línea 267)
- **Ruta de Código:**
  1. Llama `generateAIResponseSmart()` en `langgraph-ai.service.ts:1189`
  2. Verifica `shouldUseLangGraph(tenantId)` (línea 1195)
  3. Si `true` → `generateAIResponseWithGraph()` (LangGraph)
  4. Si `false` → `generateAIResponse()` (Legacy en `ai.service.ts:830`)
- **Arquitectura Usada:** DEPENDE DEL FLAG del tenant

---

## 3. ESTADO DE FEATURE FLAGS

### 3.1 Flags en Base de Datos

```sql
-- Tabla: ai_tenant_config
-- Migración: 064_LANGGRAPH_FEATURE_FLAG.sql + 126_MINIMAL_PROMPT_ARCHITECTURE_V6.sql

┌─────────────────────────────────────────────────────────────────────────┐
│                           ai_tenant_config                               │
├─────────────────────────┬────────────────────┬──────────────────────────┤
│ Columna                 │ Default            │ Efecto                   │
├─────────────────────────┼────────────────────┼──────────────────────────┤
│ use_langgraph           │ false              │ true = LangGraph V5.5    │
│                         │                    │ false = Legacy           │
├─────────────────────────┼────────────────────┼──────────────────────────┤
│ use_minimal_prompt_v6   │ false              │ true = Prompt minimal    │
│                         │                    │ false = Prompt completo  │
├─────────────────────────┼────────────────────┼──────────────────────────┤
│ langgraph_config        │ {max_iterations:5} │ Configuración avanzada   │
└─────────────────────────┴────────────────────┴──────────────────────────┘
```

### 3.2 Flags en Variables de Entorno

```bash
# Variables de entorno que pueden override los flags de DB:
USE_LANGGRAPH=true|false     # Override global para LangGraph
USE_MINIMAL_PROMPT=true|false # Override global para V6
```

### 3.3 Lógica de Prioridad

```typescript
// En shouldUseLangGraph() - langgraph-ai.service.ts:1160
1. Si USE_LANGGRAPH === 'true' → return true (override global)
2. Si USE_LANGGRAPH === 'false' → return false (override global)
3. Si ai_tenant_config.use_langgraph === true → return true
4. Default → return false (LEGACY)

// En shouldUseMinimalPromptV6() - langgraph-ai.service.ts:1126
1. Si USE_MINIMAL_PROMPT === 'true' → return true (override global)
2. Si USE_MINIMAL_PROMPT === 'false' → return false (override global)
3. Si ai_tenant_config.use_minimal_prompt_v6 === true → return true
4. Default → return false (Prompt completo)
```

---

## 4. DIFERENCIAS ENTRE ARQUITECTURAS

### 4.1 Legacy (`ai.service.ts`)

```typescript
// Línea 830-1083
async function generateAIResponse(tenantId, conversationId, currentMessage)

Características:
- Llamada DIRECTA a OpenAI (gpt-5-mini)
- System prompt ESTÁTICO construido con buildSystemPrompt()
- NO tiene Tool Calling
- NO tiene RAG (búsqueda semántica)
- NO tiene multi-agente
- Detección de intent por keywords simples
- ~4,000 tokens en prompt
- NO soporta conversaciones multi-turn sofisticadas
```

### 4.2 LangGraph V5.5 (`langgraph-ai.service.ts` + `tistis-graph.ts`)

```typescript
// Línea 968-1106
async function generateAIResponseWithGraph(tenantId, conversationId, currentMessage, leadId?, channel?)

Características:
- Sistema MULTI-AGENTE con StateGraph de LangChain
- Tools dinámicos: get_service_info, search_knowledge_base, create_appointment, etc.
- RAG via EmbeddingService (text-embedding-3-small)
- Prompts CACHEADOS en ai_generated_prompts
- ~4,000 tokens en prompt (legacy) o ~1,200 tokens (V6)
- Sanitización de mensajes (G-I4)
- Learning context (retroalimentación de patrones)
- Loyalty context (puntos, membresías)
- Conversation context REAL con historial
```

### 4.3 V6 Minimal (Extensión de V5.5)

```
Activado por: shouldUseMinimalPromptV6() === true

Diferencias con V5.5:
- Prompt inicial ~1,200-1,500 tokens (vs ~4,000)
- Datos del negocio se obtienen via Tools dinámicamente
- Solo instrucciones con include_in_prompt=true van al prompt
- Máximo 5 instrucciones críticas por tenant
```

---

## 5. MATRIZ DE RIESGOS

### 5.1 Riesgos Identificados

| # | Riesgo | Impacto | Probabilidad | Severidad |
|---|--------|---------|--------------|-----------|
| R1 | Usuario prueba en Preview (LangGraph) pero producción usa Legacy | ALTO | ALTA | **CRÍTICO** |
| R2 | Inconsistencia en respuestas entre canales | MEDIO | MEDIA | ALTO |
| R3 | Tool Calling disponible en Preview pero no en Legacy | ALTO | ALTA | **CRÍTICO** |
| R4 | RAG funciona en Preview pero no en Legacy | ALTO | ALTA | **CRÍTICO** |
| R5 | Multi-turn conversation mal manejada en Legacy | MEDIO | MEDIA | ALTO |
| R6 | Configuración de perfil ignorada en Legacy | MEDIO | ALTA | ALTO |
| R7 | Learning context no afecta Legacy | BAJO | ALTA | MEDIO |
| R8 | Loyalty context no disponible en Legacy | BAJO | ALTA | MEDIO |

### 5.2 Descripción Detallada de Riesgos Críticos

#### R1: Inconsistencia Preview vs Producción
- **Escenario:** Usuario configura su asistente en Business IA, prueba en "Preview en vivo" y obtiene respuestas perfectas. Cuando un cliente real escribe por WhatsApp, recibe respuestas diferentes/peores.
- **Causa:** Preview bypassa `shouldUseLangGraph()` mientras producción lo verifica.
- **Impacto:** Pérdida de confianza del usuario, cancelaciones.

#### R3: Tools no disponibles en Legacy
- **Escenario:** Usuario entrena a su asistente para buscar en la base de conocimiento. Preview funciona. En producción (Legacy), el asistente no puede buscar y da respuestas genéricas.
- **Causa:** Legacy no tiene Tool Calling implementado.
- **Impacto:** Respuestas incorrectas, escalaciones innecesarias.

#### R4: RAG no disponible en Legacy
- **Escenario:** Usuario sube documentos a Knowledge Base. Preview los encuentra via RAG. Legacy simplemente no tiene acceso a ellos.
- **Causa:** Legacy usa keywords, no embeddings semánticos.
- **Impacto:** Base de conocimiento inútil para usuarios en Legacy.

---

## 6. DEPENDENCIAS ENTRE COMPONENTES

### 6.1 Diagrama de Dependencias

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DEPENDENCIAS DEL SISTEMA AI                         │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │    tistis-graph.ts      │
                    │    (Orquestador)        │
                    └───────────┬─────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ base.agent.ts    │  │ embedding.      │  │ prompt-generator│
│ (Agentes)        │  │ service.ts      │  │ .service.ts     │
│                  │  │ (RAG)           │  │ (Prompts)       │
└────────┬─────────┘  └────────┬────────┘  └────────┬────────┘
         │                     │                    │
         │                     │                    │
         ▼                     ▼                    ▼
┌──────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ LangChain Tools  │  │ OpenAI          │  │ ai_generated_   │
│ - get_service    │  │ Embeddings      │  │ prompts (cache) │
│ - search_kb      │  │ text-embedding- │  │                 │
│ - create_appt    │  │ 3-small         │  │                 │
└──────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                    │
         └─────────────────────┼────────────────────┘
                               │
                               ▼
                    ┌─────────────────────────┐
                    │  langgraph-ai.service   │
                    │  - generatePreviewResp  │
                    │  - generateWithGraph    │
                    │  - generateSmart        │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
   ┌─────────────────────┐             ┌─────────────────────┐
   │   ai.service.ts     │             │ Supabase RPC        │
   │   (LEGACY)          │             │ - get_tenant_ai_    │
   │   generateAIResponse│             │   context           │
   │   - NO Tools        │             │ - ai_tenant_config  │
   │   - NO RAG          │             │                     │
   │   - OpenAI directo  │             │                     │
   └─────────────────────┘             └─────────────────────┘
```

### 6.2 Servicios de Soporte

| Servicio | Archivo | Usado por | Función |
|----------|---------|-----------|---------|
| `PromptSanitizer` | `prompt-sanitizer.service.ts` | LangGraph | Sanitiza mensajes (G-I4) |
| `MessageLearning` | `message-learning.service.ts` | LangGraph | Patrones aprendidos |
| `AgentProfile` | `agent-profile.service.ts` | LangGraph | Perfiles business/personal |
| `EmbeddingService` | `embedding.service.ts` | LangGraph | RAG semántico |
| `AppointmentBooking` | `appointment-booking.service.ts` | Ambos | Crear citas |
| `DataExtraction` | `data-extraction.service.ts` | Ambos | Extraer datos del lead |

---

## 7. ARCHIVOS CRÍTICOS

### 7.1 Lista de Archivos Principales

```
src/features/ai/
├── index.ts                           # Exports públicos
├── graph/
│   ├── index.ts                       # Exports del grafo
│   └── tistis-graph.ts               # Orquestador LangGraph (500+ líneas)
├── state/
│   ├── index.ts
│   └── tistis-state.ts               # Estado del grafo
├── agents/
│   └── specialists/
│       ├── base.agent.ts             # Clase base de agentes (550+ líneas)
│       ├── general.agent.ts          # Agente general
│       ├── booking.agent.ts          # Agente de citas
│       ├── info.agent.ts             # Agente de información
│       └── escalation.agent.ts       # Agente de escalación
├── tools/
│   └── agent-tools.ts                # Tools dinámicos
└── services/
    ├── ai.service.ts                 # LEGACY (1,258 líneas)
    ├── langgraph-ai.service.ts       # LangGraph (1,428 líneas)
    ├── prompt-generator.service.ts   # Generador de prompts
    ├── embedding.service.ts          # RAG
    └── [otros servicios de soporte]
```

### 7.2 Archivos de Configuración

```
supabase/migrations/
├── 064_LANGGRAPH_FEATURE_FLAG.sql    # Flag use_langgraph
├── 126_MINIMAL_PROMPT_ARCHITECTURE_V6.sql # Flag use_minimal_prompt_v6
├── 071_AI_GENERATED_PROMPTS_CACHE.sql # Sistema de caché
└── 023_knowledge_base_system.sql     # Knowledge Base

app/api/
├── ai-preview/route.ts               # Preview endpoint
└── jobs/process/route.ts             # Job processor
```

---

## 8. PRÓXIMOS PASOS

### 8.1 Fase 2: Diseño de Arquitectura V7 Unificada

**Objetivo:** Crear una arquitectura única donde Preview y Producción usen el mismo código path.

**Propuesta:**
1. Eliminar el sistema Legacy como opción por defecto
2. Hacer que `generateAIResponseSmart()` SIEMPRE use LangGraph
3. Mantener Legacy solo como fallback de emergencia (si LangGraph falla)
4. Unificar `generatePreviewResponse()` y `generateAIResponseWithGraph()`

### 8.2 Fase 3: Implementación

1. Migrar todos los tenants a LangGraph gradualmente
2. Actualizar `shouldUseLangGraph()` para retornar `true` por defecto
3. Deprecar `generateAIResponse()` en Legacy
4. Agregar circuit breaker para fallback a Legacy

### 8.3 Fase 4: Testing

1. Tests E2E que verifiquen Preview === Producción
2. Tests de regresión para respuestas AI
3. Tests de carga con LangGraph

---

## 9. CONCLUSIÓN

El sistema actual tiene una **deuda técnica significativa** en forma de múltiples arquitecturas que pueden diverger. La solución propuesta es **unificar a una sola arquitectura (V7)** basada en LangGraph que sea usada tanto por Preview como por Producción.

**Prioridad:** CRÍTICA
**Esfuerzo Estimado:** Medio-Alto
**Riesgo de No Actuar:** Usuarios insatisfechos, pérdida de confianza, cancelaciones

---

*Documento generado como parte de la Fase 1 de la migración a V7*
