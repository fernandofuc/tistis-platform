# Implementación V7 Unificada - Completada

**Fecha:** 2026-01-16
**Estado:** IMPLEMENTADO

---

## RESUMEN

Se implementó la **Arquitectura V7 Unificada** que garantiza que Preview y Producción usen exactamente el mismo código path, eliminando la inconsistencia donde el usuario podía probar algo en Preview y ver respuestas diferentes en Producción.

---

## ARCHIVOS CREADOS

### 1. Servicio Principal V7
**Archivo:** `src/features/ai/services/ai-v7.service.ts`

```typescript
// Función principal unificada
export async function generateAIResponseV7(
  tenantId: string,
  message: string,
  options: AIResponseV7Options
): Promise<AIResponseV7Result>

// Verificar si tenant usa V7
export async function shouldUseV7(tenantId: string): Promise<boolean>
```

**Características:**
- Una sola función para Preview y Producción
- Parámetro `isPreview` determina comportamiento (guardar DB, etc.)
- Carga contextos en paralelo (tenant, business, learning, loyalty)
- Sanitización de mensajes integrada
- Soporte completo para Tools y RAG

### 2. Circuit Breaker
**Archivo:** `src/features/ai/services/ai-circuit-breaker.ts`

```typescript
// Ejecutar con fallback automático
export async function executeWithCircuitBreaker<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<{ result: T; usedFallback: boolean }>

// Estadísticas de salud
export function getCircuitBreakerStats(): CircuitBreakerStats
```

**Estados:**
- `closed`: Operación normal
- `open`: V7 falló, usando Legacy
- `half-open`: Probando recuperación

### 3. Migración SQL
**Archivo:** `supabase/migrations/128_V7_UNIFIED_ARCHITECTURE.sql`

**Cambios:**
- Columna `use_v7_unified` en `ai_tenant_config`
- Función `tenant_uses_v7(uuid)`
- Vista `v_ai_v7_adoption_stats`
- Tabla `ai_circuit_breaker_events` para monitoreo
- Vista `v_ai_system_health`

---

## ARCHIVOS MODIFICADOS

### 1. langgraph-ai.service.ts

**`generateAIResponseSmart()`:**
- Ahora verifica `shouldUseV7()` primero
- Si V7 activo, usa `generateAIResponseV7` con `isPreview: false`
- Fallback a sistema anterior si V7 no activo

**`generatePreviewResponse()`:**
- Ahora usa `generateAIResponseV7` con `isPreview: true`
- Código legacy movido a `_legacyGeneratePreviewResponse()`

### 2. index.ts

**Nuevos exports:**
```typescript
// V7 UNIFIED ARCHITECTURE
export { AIV7Service, generateAIResponseV7, shouldUseV7 } from './services/ai-v7.service';
export type { AIResponseV7Options, AIResponseV7Result } from './services/ai-v7.service';
export { AICircuitBreaker, getAICircuitBreaker, executeWithCircuitBreaker, getCircuitBreakerStats } from './services/ai-circuit-breaker';
```

---

## FLUJO DE ACTIVACIÓN

### Para Habilitar V7 en un Tenant

```sql
-- Opción 1: SQL directo
UPDATE ai_tenant_config
SET use_v7_unified = true
WHERE tenant_id = 'UUID-del-tenant';

-- Opción 2: Si ya tiene LangGraph, V7 se activa automáticamente
-- (fallback de compatibilidad)
```

### Variables de Entorno

```bash
# Override global para todos los tenants
USE_V7_UNIFIED=true  # o false

# Override para minimal prompt
USE_MINIMAL_PROMPT=true
```

---

## DIAGRAMA DE FLUJO

```
┌─────────────────────────────────────────────────────────────────┐
│                     ANTES (Inconsistente)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Preview:    generatePreviewResponse() ─► SIEMPRE LangGraph    │
│                                                                 │
│  Producción: generateAIResponseSmart() ─► shouldUseLangGraph() │
│                                          ├─► LangGraph (flag)  │
│                                          └─► Legacy (default)  │
│                                                                 │
│  PROBLEMA: Usuario prueba algo en Preview, ve otra cosa en     │
│            producción si no tiene flag activo.                  │
└─────────────────────────────────────────────────────────────────┘

                              ▼

┌─────────────────────────────────────────────────────────────────┐
│                     DESPUÉS (V7 Unificado)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Preview:    generatePreviewResponse()                          │
│                    │                                            │
│                    └──► generateAIResponseV7(isPreview: TRUE)   │
│                                       │                         │
│  Producción: generateAIResponseSmart()                          │
│                    │                                            │
│                    ├──► shouldUseV7()?                          │
│                    │         │                                  │
│                    │         └──► generateAIResponseV7(false)   │
│                    │                    │                       │
│                    │                    ▼                       │
│                    │         ┌─────────────────────┐            │
│                    │         │  MISMO CÓDIGO PATH  │            │
│                    │         │  - Tools            │            │
│                    │         │  - RAG              │            │
│                    │         │  - Multi-agente     │            │
│                    │         │  - Prompts          │            │
│                    │         └─────────────────────┘            │
│                    │                                            │
│                    └──► Fallback a LangGraph/Legacy si no V7    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## ROLLOUT RECOMENDADO

### Fase 1: Piloto (5% de tenants)
1. Seleccionar 5-10 tenants más activos
2. Activar V7: `UPDATE ai_tenant_config SET use_v7_unified = true WHERE tenant_id IN (...)`
3. Monitorear por 24-48 horas
4. Revisar `v_ai_system_health` y logs

### Fase 2: Expansión (25-50%)
1. Activar para más tenants
2. Monitorear métricas
3. Ajustar circuit breaker si necesario

### Fase 3: General Availability (100%)
1. Cambiar default: `ALTER TABLE ai_tenant_config ALTER COLUMN use_v7_unified SET DEFAULT true;`
2. Migrar tenants existentes: `UPDATE ai_tenant_config SET use_v7_unified = true WHERE use_v7_unified IS NULL;`

### Fase 4: Cleanup
1. Eliminar flags obsoletos (`use_langgraph`, `use_minimal_prompt_v6`)
2. Eliminar código legacy
3. Simplificar `generateAIResponseSmart()`

---

## MONITOREO

### Vista de Adopción
```sql
SELECT * FROM v_ai_v7_adoption_stats;
-- Muestra: v7_enabled, langgraph_only, legacy_only, total, percentage
```

### Vista de Salud
```sql
SELECT * FROM v_ai_system_health WHERE health_status != 'healthy';
-- Muestra: tenant_id, successes, failures, avg_latency, health_status
```

### Logs
```
[AI V7] PREVIEW - Tenant: xxx, Profile: business
[AI V7] PRODUCTION - Tenant: xxx, Profile: business
[AI Router] Using V7 UNIFIED system (same as Preview)
[AICircuitBreaker] Circuit HALF-OPEN, testing primary function
```

---

## VERIFICACIÓN

### Build Status
```bash
✓ TypeScript: Sin errores
✓ Next.js Build: Exitoso
✓ Exports: Todos disponibles
```

### Archivos de Documentación
- [AUDITORIA-ARQUITECTURA-AI-V7.md](.claude/docs/AUDITORIA-ARQUITECTURA-AI-V7.md)
- [DISENO-ARQUITECTURA-V7-UNIFICADA.md](.claude/docs/DISENO-ARQUITECTURA-V7-UNIFICADA.md)
- Este archivo

---

*Implementación completada el 2026-01-16*
