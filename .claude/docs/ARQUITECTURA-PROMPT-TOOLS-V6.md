# Arquitectura Prompt + Tools v6.0
## Sistema de Agentes Conversacionales TIS TIS

**Versión:** 6.0.0
**Fecha:** 2026-01-15
**Estado:** En Implementación
**Prioridad:** CALIDAD sobre costos

---

## 1. RESUMEN EJECUTIVO

### Problema Identificado

El sistema actual tiene una **discrepancia crítica** entre la arquitectura documentada y la implementación:

| Aspecto | Documentado | Implementado |
|---------|-------------|--------------|
| Prompt inicial | ~800 tokens | ~3,500-4,000 tokens |
| Datos del negocio | Via Tools | Incrustados en prompt |
| KB | Via RAG | Todo en prompt |
| Regeneración | Solo al cambiar config | Al cambiar cualquier dato |

### Solución: Arquitectura "Prompt Minimal + Tools Dinámicos"

```
┌─────────────────────────────────────────────────────────────┐
│              PROMPT INICIAL CACHEADO                         │
│              (~1,200-1,500 tokens)                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Identidad del Agente (~100 tokens)                       │
│ 2. Personalidad Compilada (~600-800 tokens)                 │
│ 3. Instrucciones Críticas KB (~200-300 tokens)              │
│ 4. Declaración de Tools (~100 tokens)                       │
│ 5. Reglas de Seguridad (~100 tokens)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TOOLS DINÁMICOS                           │
│              (Acceso Just-In-Time)                           │
├─────────────────────────────────────────────────────────────┤
│ Información:  get_clinic_info, get_branches, get_staff      │
│ Catálogo:     get_service_catalog, get_service_details      │
│ KB:           search_knowledge_base, get_policy, get_faq    │
│ Acciones:     create_appointment, update_lead               │
│ Loyalty:      get_loyalty_balance, redeem_reward            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. ARQUITECTURA DETALLADA

### 2.1 Estructura del Prompt Inicial

```typescript
interface CorePrompt {
  // SECCIÓN 1: Identidad (~100 tokens)
  identity: {
    assistantName: string;      // "Maya"
    businessName: string;       // "Clínica Dental Sonrisa"
    vertical: VerticalType;     // "dental"
    channel: ChannelType;       // "whatsapp" | "voice"
  };

  // SECCIÓN 2: Personalidad Compilada (~600-800 tokens)
  personality: {
    styleKey: ResponseStyleKey;     // "professional_friendly"
    typeKey: AssistantTypeKey;      // "full"
    compiledRules: string;          // Instrucciones pre-compiladas
  };

  // SECCIÓN 3: Instrucciones Críticas (~200-300 tokens)
  criticalInstructions: {
    items: CriticalInstruction[];   // Solo las marcadas include_in_prompt
    maxTokens: 300;                 // Límite estricto
  };

  // SECCIÓN 4: Tools Disponibles (~100 tokens)
  toolsDeclaration: {
    available: string[];            // Lista de tools
    usage: string;                  // Cuándo usar cada una
  };

  // SECCIÓN 5: Seguridad (~100 tokens)
  safety: {
    verticalRules: string[];        // "Nunca diagnosticar" (dental)
    escalationRules: string[];      // Cuándo escalar
  };
}
```

### 2.2 Separación de Datos: Prompt vs Tools

| Categoría | ¿En Prompt? | ¿En Tool? | Razón |
|-----------|-------------|-----------|-------|
| Nombre asistente | ✅ | ❌ | Identidad core, nunca cambia |
| Estilo respuesta | ✅ | ❌ | Define CÓMO habla, nunca cambia |
| Tipo asistente | ✅ | ❌ | Define capacidades, nunca cambia |
| Instrucciones críticas | ✅ | ❌ | Reglas que NUNCA debe olvidar |
| Servicios/Precios | ❌ | ✅ | Cambian frecuentemente |
| Sucursales | ❌ | ✅ | Pueden agregar/quitar |
| Doctores/Staff | ❌ | ✅ | Rotación de personal |
| FAQs | ❌ | ✅ | Muchas, solo necesita la relevante |
| Políticas | ❌ | ✅ | Solo cuando pregunta específicamente |
| Artículos KB | ❌ | ✅ | Extensos, usar RAG |
| Templates | ❌ | ✅ | Solo cuando aplica trigger |
| Competidores | ❌ | ✅ | Solo cuando se menciona |

### 2.3 Nuevo Campo: `include_in_prompt`

```typescript
// Tabla: ai_custom_instructions
interface CustomInstruction {
  id: string;
  tenant_id: string;
  type: 'behavior' | 'rule' | 'restriction' | 'tone';
  title: string;
  content: string;
  priority: number;           // 1-10
  is_active: boolean;

  // NUEVO CAMPO
  include_in_prompt: boolean; // true = va al prompt inicial

  // Metadata
  branch_id: string | null;
  created_at: string;
}
```

**Reglas para `include_in_prompt: true`:**
- Solo instrucciones que el agente SIEMPRE debe recordar
- Máximo 5 instrucciones con este flag por tenant
- Total máximo: 300 tokens
- Ejemplos válidos:
  - "Nunca mencionar precios de ortodoncia sin valoración"
  - "Siempre confirmar la cita antes de terminar"
  - "Si el cliente menciona dolor, priorizar urgencia"

---

## 3. INTEGRACIÓN CON LANGGRAPH

### 3.1 Flujo Actual vs Nuevo

**ACTUAL:**
```
loadTenantContext()
  └─ Carga ai_config.system_prompt (~4000 tokens)
  └─ Enriquece con learning, loyalty
  └─ Total: ~4500 tokens

executeGraph()
  └─ Cada nodo recibe el prompt completo
  └─ Tools acceden a business_context (ya cargado)
  └─ Pero datos también están en el prompt (duplicación)
```

**NUEVO:**
```
loadTenantContext()
  └─ Carga ai_config.system_prompt (~1200 tokens)
  └─ Solo: identidad + personalidad + instrucciones críticas
  └─ Enriquece con learning si relevante
  └─ Total: ~1500 tokens

executeGraph()
  └─ Cada nodo recibe prompt ligero
  └─ Tools acceden a business_context bajo demanda
  └─ LLM decide cuándo necesita datos → llama tool
```

### 3.2 Modificación en `langgraph-ai.service.ts`

```typescript
// ANTES (línea ~320)
const finalSystemPrompt = cachedPrompt || generateFullPrompt(context)

// DESPUÉS
const finalSystemPrompt = cachedPrompt || await generateMinimalPrompt(context)

// Nueva función
async function generateMinimalPrompt(context: TenantContext): Promise<string> {
  // 1. Identidad (~100 tokens)
  const identity = buildIdentitySection(context);

  // 2. Personalidad compilada (~700 tokens)
  const personality = getCompiledInstructions(
    context.response_style,
    context.assistant_type,
    context.channel
  );

  // 3. Instrucciones críticas (~200 tokens)
  const critical = await getCriticalInstructions(context.tenant_id);

  // 4. Tools (~100 tokens)
  const tools = buildToolsDeclaration(context.assistant_type);

  // 5. Seguridad (~100 tokens)
  const safety = buildSafetyRules(context.vertical);

  return `${identity}\n\n${personality}\n\n${critical}\n\n${tools}\n\n${safety}`;
}
```

### 3.3 Tools Modificadas/Nuevas

```typescript
// tools/definitions.ts - NUEVAS TOOLS

// Tool para obtener todo el catálogo de servicios
export const GET_SERVICE_CATALOG = z.object({
  category: z.string().optional().describe('Filtrar por categoría'),
  include_promotions: z.boolean().default(true),
});

// Tool para buscar en Knowledge Base (RAG real)
export const SEARCH_KNOWLEDGE_BASE_V2 = z.object({
  query: z.string().describe('Pregunta o tema a buscar'),
  category: z.enum(['articles', 'policies', 'templates', 'competitors']).optional(),
  top_k: z.number().default(3).describe('Número de resultados'),
});

// Tool para obtener política específica
export const GET_POLICY = z.object({
  policy_type: z.enum([
    'cancellation', 'payment', 'guarantee',
    'privacy', 'refund', 'general'
  ]),
});

// Tool para obtener template de respuesta
export const GET_RESPONSE_TEMPLATE = z.object({
  trigger_type: z.enum([
    'greeting', 'farewell', 'confirmation',
    'appointment_reminder', 'promotion'
  ]),
  variables: z.record(z.string()).optional(),
});

// Tool para manejo de competidores
export const GET_COMPETITOR_STRATEGY = z.object({
  competitor_name: z.string().describe('Nombre del competidor mencionado'),
});
```

### 3.4 Modificación en Tool Handlers

```typescript
// handlers.ts - MODIFICADO

// ANTES: Busca en business_context que ya está en estado
export async function handleSearchKnowledgeBase(
  params: { query: string },
  context: ToolContext
): Promise<KBSearchResult[]> {
  // Búsqueda local en business_context
  return filterKBByQuery(context.business_context.articles, params.query);
}

// DESPUÉS: Búsqueda semántica real via embedding
export async function handleSearchKnowledgeBase(
  params: { query: string; category?: string; top_k?: number },
  context: ToolContext
): Promise<KBSearchResult[]> {
  // 1. Generar embedding del query
  const queryEmbedding = await generateEmbedding(params.query);

  // 2. Buscar en pgvector
  const results = await supabase.rpc('search_knowledge_base_semantic', {
    p_tenant_id: context.tenant_id,
    p_query_embedding: queryEmbedding,
    p_category: params.category,
    p_limit: params.top_k || 3,
    p_similarity_threshold: 0.7
  });

  return results.data;
}
```

---

## 4. PLAN DE IMPLEMENTACIÓN

### FASE 1: Análisis y Documentación (Este documento) ✅ COMPLETADA
- [x] Analizar arquitectura LangGraph actual
- [x] Documentar flujo de datos
- [x] Diseñar nueva arquitectura
- [x] Crear documento de migración

### FASE 2: Refactorizar Sistema de Prompts ✅ COMPLETADA (2026-01-15)
**Implementado en `prompt-generator.service.ts`:**
1. [x] `generateMinimalPrompt()` - Genera prompts de ~1,200-1,500 tokens
2. [x] `buildIdentitySection()` - Identidad del agente (~100 tokens)
3. [x] `buildToolsDeclaration()` - Lista de tools disponibles (~150 tokens)
4. [x] `buildSafetyRules()` - Reglas de seguridad por vertical (~100 tokens)
5. [x] `getCriticalInstructions()` - Solo instrucciones con include_in_prompt=true
6. [x] `calculateMinimalPromptHash()` - Hash que excluye datos dinámicos
7. [x] `generateAndCacheMinimalPrompt()` - Caché del prompt minimal

### FASE 3: Migración SQL ✅ COMPLETADA (2026-01-15)
**Creado `126_MINIMAL_PROMPT_ARCHITECTURE_V6.sql`:**
1. [x] Columna `include_in_prompt` en `ai_custom_instructions`
2. [x] Trigger para validar máximo 5 instrucciones críticas por tenant
3. [x] Función `get_critical_instructions()` para consulta rápida
4. [x] Vista `v_critical_instructions_stats` para estadísticas
5. [x] Migración automática de instrucciones con priority >= 8

### FASE 4: Migrar Knowledge Base UI ✅ COMPLETADA (2026-01-15)
**Modificados:**
1. [x] `KnowledgeBase.tsx` - Tipo `CustomInstruction` con `include_in_prompt`
2. [x] `KBItemCard.tsx` - Badge "En Prompt" y botón toggle
3. [x] Props para `includeInPrompt`, `onToggleIncludeInPrompt`, `canEnableIncludeInPrompt`

### FASE 5: Integración con LangGraph ✅ COMPLETADA (2026-01-15)
**Modificado `langgraph-ai.service.ts`:**
1. [x] `shouldUseMinimalPromptV6()` - Feature flag para activar arquitectura v6
2. [x] Modificado `loadTenantContext()` - Nuevo parámetro `useMinimalPrompt`
3. [x] Integración con `generateMinimalPrompt()` cuando v6 está activo
4. [x] Fallback automático a prompt legacy si v6 falla
5. [x] Logging de tipo de prompt usado: `prompt_source` en TenantInfo

**Modificado `KnowledgeBase.tsx`:**
1. [x] `handleToggleIncludeInPrompt()` - Handler para toggle via API PATCH
2. [x] `criticalInstructionsCount` - Conteo de instrucciones críticas
3. [x] `canEnableIncludeInPrompt` - Validación de límite de 5
4. [x] Props pasadas a `KBItemCard` para UI interactiva

**Actualizado `126_MINIMAL_PROMPT_ARCHITECTURE_V6.sql`:**
1. [x] Columna `use_minimal_prompt_v6` en `ai_tenant_config`

### FASE 6: Deploy y Activación 🔄 PENDIENTE
**Próximos pasos:**
1. [ ] Ejecutar migración SQL en Supabase
2. [ ] Deploy a staging
3. [ ] Activar `use_minimal_prompt_v6` para tenant de prueba
4. [ ] Monitoreo de métricas (tokens, latencia, calidad)
5. [ ] Deploy a producción (rollout gradual)

---

## 5. MÉTRICAS DE ÉXITO

| Métrica | Actual | Objetivo | Medición |
|---------|--------|----------|----------|
| Tokens por request | ~4,000 | ~1,500 | Logging |
| Latencia respuesta | 2-3s | <2s | P95 |
| Regeneraciones/hora | ~50 | <10 | Logs de caché |
| Calidad respuesta | Baseline | >= Baseline | User feedback |
| Tool calls por request | 0-1 | 1-3 | Logging |

---

## 6. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| LLM no llama tools cuando debe | Media | Alto | Instrucciones explícitas en prompt |
| Latencia por tool calls | Media | Medio | Paralelizar calls cuando posible |
| Datos inconsistentes | Baja | Alto | business_context siempre actualizado |
| Regresión en calidad | Media | Alto | A/B testing antes de full deploy |

---

## 7. ARCHIVOS MODIFICADOS

```
src/features/ai/services/
├── prompt-generator.service.ts    ✅ MODIFICADO - generateMinimalPrompt(), buildIdentitySection(), etc.
├── langgraph-ai.service.ts        ✅ MODIFICADO - shouldUseMinimalPromptV6(), loadTenantContext()
└── embedding.service.ts           [VERIFICAR] - RAG funcional

src/features/ai/state/
└── agent-state.ts                 ✅ MODIFICADO - Campo prompt_source en TenantInfo

src/features/ai/tools/
├── definitions.ts                 [PENDIENTE] - Nuevas tools para KB dinámico
└── handlers.ts                    [PENDIENTE] - Nuevos handlers

src/features/ai/graph/
└── tistis-graph.ts               [SIN CAMBIOS] - No requiere modificación

src/shared/config/
├── prompt-instruction-compiler.ts [SIN CAMBIOS] - Ya funcional
└── response-style-instructions.ts [SIN CAMBIOS] - Ya funcional

supabase/migrations/
└── 126_MINIMAL_PROMPT_ARCHITECTURE_V6.sql  ✅ CREADO
    - Columna include_in_prompt
    - Columna use_minimal_prompt_v6
    - Trigger de validación (máx 5)
    - Función get_critical_instructions()
    - Vista v_critical_instructions_stats

src/features/settings/components/
├── KnowledgeBase.tsx              ✅ MODIFICADO - handleToggleIncludeInPrompt, props
└── kb/KBItemCard.tsx              ✅ MODIFICADO - Badge "En Prompt", botón toggle
```

---

## 8. EJEMPLO DE PROMPT GENERADO

### Antes (~4,000 tokens):
```
Eres Maya, asistente virtual de Clínica Dental Sonrisa...

## SERVICIOS
- Limpieza Dental: $800, 45 min
- Blanqueamiento: $1,500, 60 min
- Ortodoncia: Consultar, variable
[... 20 servicios más ...]

## SUCURSALES
- Matriz: Av. Principal 123, Tel: 555-1234
- Sucursal Norte: Calle 456, Tel: 555-5678
[... más sucursales ...]

## POLÍTICAS
[... 500 tokens de políticas ...]

## BASE DE CONOCIMIENTO
[... 1000 tokens de artículos ...]

## INSTRUCCIONES
[... 700 tokens de instrucciones compiladas ...]
```

### Después (~1,200 tokens):
```
# IDENTIDAD
Eres Maya, asistente virtual de Clínica Dental Sonrisa.
Canal: WhatsApp | Vertical: Dental

# PERSONALIDAD (Profesional Cálido + Asistente Completo)
[Instrucciones compiladas de estilo y tipo - 600 tokens]

# INSTRUCCIONES CRÍTICAS
- Nunca mencionar precio de ortodoncia sin valoración previa
- Siempre confirmar la cita antes de terminar la conversación
- Si el cliente menciona dolor severo, priorizar urgencia

# HERRAMIENTAS DISPONIBLES
Tienes acceso a estas tools para obtener información:
- get_service_catalog: Lista de servicios y precios
- get_branches: Información de sucursales
- search_knowledge_base: Buscar en base de conocimiento
- get_policy: Políticas específicas (cancelación, pago, etc.)
- create_appointment: Agendar cita

Usa las tools cuando necesites información específica.
NO inventes datos - siempre consulta via tools.

# SEGURIDAD
- NUNCA des diagnósticos dentales
- Siempre sugiere valoración presencial para casos complejos
- Si hay emergencia dental, prioriza atención urgente
```

---

**Documento creado:** 2026-01-15
**Próxima revisión:** Al completar Fase 2
