# Diseño de Arquitectura V7 Unificada - TIS TIS Platform

**Fecha:** 2026-01-16
**Versión:** 1.0
**Estado:** FASE 2 - Diseño

---

## 1. OBJETIVO

Crear una arquitectura unificada donde **Preview y Producción usen exactamente el mismo código path**, eliminando la posibilidad de inconsistencias entre lo que el usuario prueba y lo que reciben sus clientes.

---

## 2. ARQUITECTURA PROPUESTA V7

### 2.1 Principios de Diseño

1. **Single Path:** Una sola función principal que procesa mensajes AI
2. **LangGraph First:** LangGraph es el sistema principal, no opcional
3. **Legacy as Fallback:** Sistema legacy solo como circuit breaker de emergencia
4. **Feature Flags Simplificados:** Un solo flag principal (`use_v7_unified`)
5. **Backward Compatible:** Migración gradual sin breaking changes

### 2.2 Diagrama de Flujo V7

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ARQUITECTURA V7 UNIFICADA                               │
└─────────────────────────────────────────────────────────────────────────────┘

   PREVIEW                                    PRODUCCIÓN
   /api/ai-preview                            /api/jobs/process
        │                                          │
        │                                          │
        ▼                                          ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                   generateAIResponseV7()                        │
   │                   (NUEVA FUNCIÓN UNIFICADA)                     │
   │                                                                 │
   │   Parámetros:                                                   │
   │   - tenantId: string                                            │
   │   - message: string                                             │
   │   - options: {                                                  │
   │       conversationId?: string    // null para preview           │
   │       leadId?: string            // null para preview           │
   │       channel: CacheChannel                                     │
   │       profileType: ProfileType                                  │
   │       conversationHistory?: Message[]  // para multi-turn       │
   │       isPreview: boolean         // determina si es preview     │
   │     }                                                           │
   └────────────────────────────────────┬───────────────────────────┘
                                        │
                                        ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                    PIPELINE DE PROCESAMIENTO                    │
   ├────────────────────────────────────────────────────────────────┤
   │                                                                 │
   │   1. SANITIZACIÓN                                               │
   │      └─► PromptSanitizer.sanitizeUserPrompt()                   │
   │                                                                 │
   │   2. CARGA DE CONTEXTO (en paralelo)                            │
   │      ├─► loadTenantContext()                                    │
   │      ├─► loadBusinessContext()                                  │
   │      ├─► loadLearningContext()                                  │
   │      ├─► loadLoyaltyContext()                                   │
   │      └─► loadConversationContext() // si !isPreview             │
   │                                                                 │
   │   3. ENRIQUECIMIENTO DEL PROMPT                                 │
   │      ├─► Learning enrichment                                    │
   │      └─► Loyalty enrichment                                     │
   │                                                                 │
   │   4. EJECUCIÓN DEL GRAFO                                        │
   │      └─► executeGraph(graphInput)                               │
   │           │                                                     │
   │           ├─► initializeNode                                    │
   │           ├─► routerNode (classify intent)                      │
   │           ├─► specialistNode (process)                          │
   │           │    ├─► Tools: get_service_info                      │
   │           │    ├─► Tools: search_knowledge_base (RAG)           │
   │           │    ├─► Tools: create_appointment                    │
   │           │    └─► Tools: [otros]                               │
   │           ├─► qualityNode (validate)                            │
   │           └─► finalizeNode (format response)                    │
   │                                                                 │
   │   5. POST-PROCESAMIENTO (solo si !isPreview)                    │
   │      ├─► queueForLearning()                                     │
   │      └─► saveMetrics()                                          │
   │                                                                 │
   └────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                     RESULTADO UNIFICADO                         │
   │   AIResponseV7Result {                                          │
   │     success: boolean                                            │
   │     response: string                                            │
   │     intent: string                                              │
   │     signals: AISignal[]                                         │
   │     agents_used: string[]                                       │
   │     processing_time_ms: number                                  │
   │     tokens_used: number                                         │
   │     model_used: string  // siempre 'langgraph-gpt-5-mini'       │
   │     escalated: boolean                                          │
   │     escalation_reason?: string                                  │
   │     profile_config: ProfileConfig  // para UI                   │
   │   }                                                             │
   └────────────────────────────────────────────────────────────────┘
```

### 2.3 Comparación V6 vs V7

| Aspecto | V6 (Actual) | V7 (Propuesto) |
|---------|-------------|----------------|
| Funciones de entrada | 3 (`generateAIResponse`, `generateAIResponseWithGraph`, `generatePreviewResponse`) | 1 (`generateAIResponseV7`) |
| Feature flags | 2 (`use_langgraph`, `use_minimal_prompt_v6`) | 1 (`use_v7_unified`) |
| Preview vs Producción | Código diferente | Mismo código |
| Legacy | Activo por defecto | Solo fallback |
| Consistencia | No garantizada | Garantizada |

---

## 3. ESTRATEGIA DE MIGRACIÓN

### 3.1 Fases de Migración

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FASES DE MIGRACIÓN V7                                │
└─────────────────────────────────────────────────────────────────────────────┘

 FASE A: Preparación (Sin cambios visibles)
 ───────────────────────────────────────────
 │
 ├─► Crear generateAIResponseV7() en nuevo archivo
 ├─► Crear tests para V7
 ├─► Agregar flag use_v7_unified a ai_tenant_config
 └─► Documentar nueva API

 FASE B: Rollout Gradual (5% → 25% → 50% → 100%)
 ────────────────────────────────────────────────
 │
 ├─► Modificar generateAIResponseSmart() para usar V7 si flag activo
 ├─► Modificar generatePreviewResponse() para usar V7
 ├─► Monitorear métricas (latencia, errores, tokens)
 └─► Ajustar según feedback

 FASE C: Deprecación Legacy
 ─────────────────────────────
 │
 ├─► Cambiar default de use_v7_unified a true
 ├─► Marcar generateAIResponse() como @deprecated
 ├─► Eliminar código legacy después de 30 días sin uso
 └─► Simplificar feature flags

 FASE D: Cleanup
 ───────────────
 │
 ├─► Eliminar use_langgraph (reemplazado por V7)
 ├─► Eliminar use_minimal_prompt_v6 (integrado en V7)
 ├─► Eliminar generateAIResponse() legacy
 └─► Actualizar documentación
```

### 3.2 Rollback Strategy

```typescript
// Circuit Breaker para fallback a Legacy
class AICircuitBreaker {
  private static failureCount = 0;
  private static lastFailure: Date | null = null;
  private static readonly THRESHOLD = 5;
  private static readonly RESET_TIMEOUT_MS = 60000; // 1 minuto

  static async executeWithFallback<T>(
    v7Function: () => Promise<T>,
    legacyFunction: () => Promise<T>
  ): Promise<T> {
    // Reset si pasó el timeout
    if (this.lastFailure && Date.now() - this.lastFailure.getTime() > this.RESET_TIMEOUT_MS) {
      this.failureCount = 0;
    }

    // Si hay muchas fallas, usar Legacy directamente
    if (this.failureCount >= this.THRESHOLD) {
      console.warn('[AICircuitBreaker] Using legacy fallback due to V7 failures');
      return legacyFunction();
    }

    try {
      const result = await v7Function();
      this.failureCount = 0; // Reset on success
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailure = new Date();
      console.error('[AICircuitBreaker] V7 failed, falling back to legacy:', error);
      return legacyFunction();
    }
  }
}
```

---

## 4. INTERFAZ DE LA NUEVA FUNCIÓN

### 4.1 Tipos TypeScript

```typescript
// =====================================================
// TIPOS V7 UNIFICADOS
// =====================================================

/**
 * Opciones para la generación de respuesta V7
 */
export interface AIResponseV7Options {
  /** ID de conversación (null para preview) */
  conversationId?: string;

  /** ID del lead (null para preview) */
  leadId?: string;

  /** Canal de comunicación */
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'webchat' | 'voice';

  /** Tipo de perfil del agente */
  profileType: 'business' | 'personal';

  /** Historial de conversación para multi-turn */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;

  /** Si es modo preview (no guarda en DB, no envía mensajes) */
  isPreview: boolean;
}

/**
 * Resultado unificado de la generación V7
 */
export interface AIResponseV7Result {
  success: boolean;
  response: string;
  intent: string;
  signals: Array<{ signal: string; points: number }>;
  score_change: number;
  agents_used: string[];
  processing_time_ms: number;
  tokens_used: number;
  model_used: string;
  escalated: boolean;
  escalation_reason?: string;
  booking_result?: BookingResult;
  profile_config: {
    profile_type: 'business' | 'personal';
    response_style: string;
    template_key: string;
    delay_minutes: number;
    delay_first_only: boolean;
  };
  prompt_source?: string;
  error?: string;
}

/**
 * Función principal V7
 */
export async function generateAIResponseV7(
  tenantId: string,
  message: string,
  options: AIResponseV7Options
): Promise<AIResponseV7Result>;
```

### 4.2 Firma Simplificada para Wrappers

```typescript
// Wrapper para Preview (mantiene compatibilidad)
export async function generatePreviewResponse(
  input: PreviewRequestInput
): Promise<PreviewResponseResult> {
  const result = await generateAIResponseV7(input.tenantId, input.message, {
    channel: input.channel || 'whatsapp',
    profileType: input.profileType,
    conversationHistory: input.conversationHistory,
    isPreview: true, // KEY: Siempre true para preview
  });

  // Mapear a formato esperado por UI
  return mapToPreviewResult(result);
}

// Wrapper para Producción (mantiene compatibilidad)
export async function generateAIResponseSmart(
  tenantId: string,
  conversationId: string,
  currentMessage: string,
  leadId?: string
): Promise<AIProcessingResult> {
  // Determinar canal desde la conversación
  const conversation = await loadConversationContext(conversationId);

  const result = await generateAIResponseV7(tenantId, currentMessage, {
    conversationId,
    leadId,
    channel: conversation?.channel || 'whatsapp',
    profileType: 'business', // Default para producción
    isPreview: false, // KEY: Siempre false para producción
  });

  // Mapear a formato esperado por job processor
  return mapToProcessingResult(result);
}
```

---

## 5. CAMBIOS EN BASE DE DATOS

### 5.1 Nueva Migración

```sql
-- =====================================================
-- TIS TIS PLATFORM - V7 Unified Architecture
-- Migration: XXX_V7_UNIFIED_ARCHITECTURE.sql
-- =====================================================

-- 1. Agregar flag use_v7_unified
ALTER TABLE ai_tenant_config
ADD COLUMN IF NOT EXISTS use_v7_unified BOOLEAN DEFAULT false;

COMMENT ON COLUMN ai_tenant_config.use_v7_unified IS
'Flag para usar arquitectura V7 unificada. Cuando true, tanto Preview como Producción
usan el mismo código path (LangGraph). Default: false para rollout gradual.';

-- 2. Función helper
CREATE OR REPLACE FUNCTION public.tenant_uses_v7(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT use_v7_unified
     FROM public.ai_tenant_config
     WHERE tenant_id = p_tenant_id
     LIMIT 1),
    false
  );
$$;

-- 3. Vista para monitoreo de adopción
CREATE OR REPLACE VIEW v_v7_adoption_stats AS
SELECT
    COUNT(*) FILTER (WHERE use_v7_unified = true) as v7_enabled,
    COUNT(*) FILTER (WHERE use_v7_unified = false OR use_v7_unified IS NULL) as legacy,
    COUNT(*) as total,
    ROUND(
      COUNT(*) FILTER (WHERE use_v7_unified = true)::numeric /
      NULLIF(COUNT(*)::numeric, 0) * 100, 2
    ) as v7_percentage
FROM ai_tenant_config;

-- 4. Índice para consultas
CREATE INDEX IF NOT EXISTS idx_ai_tenant_config_v7
ON public.ai_tenant_config(use_v7_unified)
WHERE use_v7_unified = true;
```

### 5.2 Plan de Deprecación de Flags Antiguos

```sql
-- FASE D: Después de migración completa (30+ días con 100% V7)

-- 1. Eliminar use_langgraph (reemplazado por V7)
ALTER TABLE ai_tenant_config DROP COLUMN IF EXISTS use_langgraph;

-- 2. Eliminar use_minimal_prompt_v6 (integrado en V7)
-- NOTA: V7 siempre usa el prompt óptimo según configuración
ALTER TABLE ai_tenant_config DROP COLUMN IF EXISTS use_minimal_prompt_v6;

-- 3. Eliminar langgraph_config (configuración movida a V7)
-- NOTA: La configuración de agentes ahora es parte de agent_profiles
ALTER TABLE ai_tenant_config DROP COLUMN IF EXISTS langgraph_config;
```

---

## 6. PLAN DE IMPLEMENTACIÓN DETALLADO

### 6.1 Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `src/features/ai/services/ai-v7.service.ts` | Nueva función unificada |
| `src/features/ai/services/ai-circuit-breaker.ts` | Circuit breaker para fallback |
| `supabase/migrations/XXX_V7_UNIFIED_ARCHITECTURE.sql` | Migración DB |

### 6.2 Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `langgraph-ai.service.ts` | Agregar wrapper que usa V7 |
| `app/api/ai-preview/route.ts` | Usar nueva función |
| `app/api/jobs/process/route.ts` | Usar nueva función |
| `src/features/ai/index.ts` | Exportar V7 |

### 6.3 Archivos a Deprecar (Fase D)

| Archivo | Estado Final |
|---------|--------------|
| `ai.service.ts:generateAIResponse()` | Eliminar (mantener otros métodos) |
| Funciones `shouldUseLangGraph()` | Eliminar |
| Funciones `shouldUseMinimalPromptV6()` | Eliminar |

---

## 7. MÉTRICAS DE ÉXITO

### 7.1 KPIs de Migración

| Métrica | Objetivo | Cómo Medir |
|---------|----------|------------|
| Consistencia Preview/Prod | 100% | Test E2E automatizado |
| Latencia P95 | < 3s | Logs de processing_time_ms |
| Error rate | < 0.1% | Logs de errores |
| Token efficiency | < 2000 tokens/request | ai_usage_logs |
| Adopción V7 | 100% en 30 días | v_v7_adoption_stats |

### 7.2 Dashboard de Monitoreo

```sql
-- Query para dashboard de monitoreo V7
SELECT
    date_trunc('hour', created_at) as hour,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE model_used LIKE 'langgraph%') as v7_requests,
    COUNT(*) FILTER (WHERE model_used NOT LIKE 'langgraph%') as legacy_requests,
    AVG(processing_time_ms) as avg_latency_ms,
    AVG(tokens_input + tokens_output) as avg_tokens,
    COUNT(*) FILTER (WHERE escalated = true) as escalations
FROM ai_usage_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 8. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| V7 tiene bugs no detectados | Media | Alto | Circuit breaker + rollback automático |
| Latencia mayor en V7 | Baja | Medio | Optimización de prompts, caché |
| Tenants no migrados | Baja | Bajo | Migración automática después de 30 días |
| Incompatibilidad con algún tenant | Baja | Medio | Testing exhaustivo pre-rollout |

---

## 9. CHECKLIST DE IMPLEMENTACIÓN

### Fase A: Preparación
- [ ] Crear `ai-v7.service.ts` con `generateAIResponseV7()`
- [ ] Crear `ai-circuit-breaker.ts`
- [ ] Crear migración SQL
- [ ] Agregar tests unitarios para V7
- [ ] Agregar tests E2E Preview === Producción
- [ ] Documentar nueva API

### Fase B: Rollout
- [ ] Desplegar a staging
- [ ] Activar para 5% de tenants (más activos)
- [ ] Monitorear por 24h
- [ ] Activar para 25%
- [ ] Monitorear por 48h
- [ ] Activar para 50%
- [ ] Monitorear por 48h
- [ ] Activar para 100%

### Fase C: Deprecación
- [ ] Cambiar default de `use_v7_unified` a `true`
- [ ] Agregar warnings en logs para código legacy
- [ ] Esperar 30 días

### Fase D: Cleanup
- [ ] Eliminar columnas obsoletas
- [ ] Eliminar funciones obsoletas
- [ ] Actualizar documentación
- [ ] Cerrar migración

---

*Documento generado como parte de la Fase 2 de la migración a V7*
