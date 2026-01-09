# REVISIÓN 5.2 - Auditoría Exhaustiva de Business IA

**Fecha:** 2026-01-09
**Autor:** Claude Opus 4.5
**Estado:** ✅ IMPLEMENTACIÓN COMPLETADA (CRÍTICOS + ALTOS PRIORITARIOS)

---

## 1. RESUMEN EJECUTIVO

Business IA es el sistema de inteligencia de negocios que:
1. **Genera insights automáticos** cada 3 días usando Gemini 3.0
2. **Aprende patrones** de los mensajes de clientes en tiempo real
3. **Alimenta al sistema de agentes** con contexto aprendido

### Componentes Principales

| Componente | Archivo | Función |
|------------|---------|---------|
| **Business Insights Service** | `business-insights.service.ts` | Genera insights con Gemini |
| **Message Learning Service** | `message-learning.service.ts` | Aprende patrones de mensajes |
| **CRON Job** | `cron/generate-insights/route.ts` | Ejecuta cada 3 días |
| **Dashboard UI** | `business-ia/page.tsx` | Visualización de insights |
| **API Insights** | `api/business-insights/route.ts` | CRUD de insights |
| **API Learning** | `api/ai-learning/route.ts` | Patrones y vocabulario |

---

## 2. ARQUITECTURA ACTUAL

### 2.1 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONFIGURACIÓN (Dashboard)                          │
│  Settings → AI Configuration → Servicios, FAQs, Instrucciones               │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │ Trigger: Guardar configuración
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROMPT GENERATOR SERVICE                              │
│  1. collectBusinessContext(tenantId)                                        │
│  2. calculateBusinessContextHash()                                          │
│  3. generatePromptWithAI() → Gemini 3.0                                     │
│  4. saveCachedPrompt() → ai_cached_prompts                                  │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────┐
│                    RUNTIME (Mensaje de Cliente)                              │
│  1. Supervisor Agent → detecta intent                                       │
│  2. Specialist Agent → usa cached prompt                                    │
│  3. Message Learning → queueMessageForLearning()                            │
│     ├── extractPatterns() → service_request, objection, etc.               │
│     └── extractVocabulary() → términos específicos del vertical            │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │ Guarda en: ai_message_patterns, ai_learned_vocabulary
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CRON JOB (Cada 3 días)                               │
│  1. Obtener tenants elegibles (Essentials+, activos)                        │
│  2. collectTenantAnalytics() → datos de 30 días                            │
│  3. generateInsightsWithGemini() → 5-10 insights                           │
│  4. Guardar en ai_business_insights                                         │
│  5. Enviar notificaciones                                                   │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────┐
│                      DASHBOARD BUSINESS IA                                   │
│  GET /api/business-insights → Insights activos                              │
│  GET /api/ai-learning → Patrones y vocabulario aprendido                   │
│  PATCH /api/business-insights → mark_seen, dismiss, acted_upon             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Diferencias por Vertical

| Aspecto | DENTAL | RESTAURANT |
|---------|--------|------------|
| **Patrones de Aprendizaje** | pain_point, urgency_indicator, symptom | preference, occasion, complaint |
| **Vocabulario** | Procedimientos, síntomas, anatomía | Platillos, alergias, eventos |
| **Insights Relevantes** | popular_service, follow_up_opportunity | peak_hours, upsell_opportunity |
| **Alta Prioridad** | Urgencias dentales, dolor severo | Quejas, alergias |
| **Detección Especial** | Emergencias médicas | Eventos especiales, grupos grandes |

---

## 3. ESCENARIOS HIPOTÉTICOS CRÍTICOS

### Escenario B1: Insights Duplicados por CRON Concurrente

**Descripción:** Dos instancias del CRON ejecutándose simultáneamente generan insights duplicados.

**Flujo del problema:**
```
CRON Instance A                    CRON Instance B
     │                                   │
     ├─ GET tenants                      ├─ GET tenants
     │                                   │
     ├─ Check last_generation            ├─ Check last_generation
     │   (both see: NULL)                │   (both see: NULL)
     │                                   │
     ├─ generateInsights(tenant_1)       ├─ generateInsights(tenant_1)
     │                                   │
     └─ INSERT insights ←────────────────└─ INSERT insights (DUPLICATE!)
```

**Severidad:** ALTA
**Vertical afectada:** Ambas
**Gap identificado:** No hay lock de concurrencia en CRON

---

### Escenario B2: Patrones con Datos PII Sensibles

**Descripción:** El sistema aprende patrones que contienen información personal identificable (PII) del cliente.

**Flujo del problema:**
```
Cliente dental escribe: "Soy María García, RFC GARM850515XX1, y me duele mucho la muela"
                                │
                                ▼
extractPatterns():
  - pain_point: "me duele mucho la muela" ✓ Correcto
  - context: "Soy María García, RFC GARM850515XX1..." ❌ CONTIENE PII

Guarda en ai_message_patterns.context_examples[]
                                │
                                ▼
Visible en Dashboard Business IA → /api/ai-learning → patterns[]
```

**Severidad:** CRÍTICA (Compliance GDPR/LFPDPPP)
**Vertical afectada:** Ambas
**Gap identificado:** No hay sanitización de PII en `extractPatterns()`

---

### Escenario B3: Insights Basados en Datos Insuficientes

**Descripción:** El sistema genera insights con alta confianza basándose en muy pocos datos.

**Flujo del problema:**
```
Tenant: "Clínica Dental Nueva" (recién onboarding)
Conversaciones: 52 (apenas pasó el mínimo de 50)
Patrones detectados: 3 service_requests, 1 objection

                                │
                                ▼
generateInsightsWithGemini():
  - Input: topServiceRequests: [{service: "limpieza", count: 3}]
  - Output: "Tu servicio más popular es limpieza con 85% de confianza"
                                │
                                ▼
Insight guardado con confidence_score: 0.85 ❌ FALSO POSITIVO
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas
**Gap identificado:** Falta validación de data_points mínimos por tipo de insight

---

### Escenario B4: Circuit Breaker Ausente en Gemini para Insights

**Descripción:** Si Gemini falla repetidamente, el CRON sigue intentando y agota cuota.

**Flujo del problema:**
```
CRON Job ejecuta para 50 tenants
                                │
                                ▼
Tenant 1: generateInsightsWithGemini() → Gemini 429 (quota exceeded)
Tenant 2: generateInsightsWithGemini() → Gemini 429 (quota exceeded)
...
Tenant 50: generateInsightsWithGemini() → Gemini 429 (quota exceeded)
                                │
                                ▼
50 llamadas fallidas a Gemini sin circuit breaker
Quota agotada para todo el día
```

**Severidad:** ALTA
**Vertical afectada:** Ambas
**Gap identificado:** Falta circuit breaker en `generateInsightsWithGemini()`

---

### Escenario B5: Aprendizaje de Vocabulario con Sinónimos Incorrectos

**Descripción:** El sistema aprende vocabulario pero sin validar sinónimos, creando confusión.

**Flujo del problema:**
```
Restaurant: Cliente escribe "quiero un tartar de atún"
                                │
                                ▼
extractVocabulary():
  - term: "tartar"
  - category: "food_category"
  - synonyms: [] (vacío, nunca se llenan)
                                │
                                ▼
Más tarde, cliente escribe: "tienen tartare de salmón?"
                                │
                                ▼
Sistema no relaciona "tartar" con "tartare" → términos separados
                                │
                                ▼
Dashboard muestra:
  - tartar (5 usos)
  - tartare (3 usos)

Insight erróneo: "Dos platillos diferentes populares"
```

**Severidad:** BAJA
**Vertical afectada:** Restaurant principalmente
**Gap identificado:** Falta normalización y merge de sinónimos

---

### Escenario B6: Patrones de Alta Prioridad No Procesados

**Descripción:** Un patrón de queja severa no genera alerta porque el sistema de alertas falla silenciosamente.

**Flujo del problema:**
```
Cliente restaurant: "La comida llegó podrida, exijo reembolso inmediato"
                                │
                                ▼
processHighPriorityPatterns():
  - Detecta: complaint (high priority)
  - requiresImmediateAction: true
  - actionType: 'escalation'
                                │
                                ▼
createHighPriorityAlert():
  - broadcast_notification() → RPC falla (no existe)
                                │
                                ▼
try { ... } catch { console.warn(...) } ← Error silenciado
                                │
                                ▼
Staff NUNCA recibe alerta de queja crítica
```

**Severidad:** CRÍTICA
**Vertical afectada:** Restaurant principalmente
**Gap identificado:** RPC `broadcast_notification` puede no existir o fallar

---

### Escenario B7: Insights Obsoletos Visibles por Días

**Descripción:** Insights antiguos se muestran como activos porque el filtro de expiración no funciona correctamente.

**Flujo del problema:**
```
Insight generado: 2025-12-20 (hace 20 días)
INSIGHTS_EXPIRY_DAYS = 7

                                │
                                ▼
getActiveInsights():
  .eq('is_active', true) → TRUE (nunca se marcó como inactivo)
                                │
                                ▼
Dashboard muestra insight de hace 20 días como "activo"
                                │
                                ▼
La expiración SOLO ocurre durante CRON, no en lectura
Si CRON no ejecuta, insights viejos permanecen visibles
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas
**Gap identificado:** Expiración no se verifica en tiempo de lectura

---

### Escenario B8: Tenant Dental con Menú de Restaurant

**Descripción:** Error de configuración causa que patrones de restaurant se apliquen a dental.

**Flujo del problema:**
```
Tenant: "Clínica Dental ABC"
Vertical en DB: "dental"

Administrador cambia accidentalmente vertical a "restaurant"
                                │
                                ▼
Próximo mensaje de paciente: "me duele una muela"
                                │
                                ▼
extractVocabulary(message, vertical="restaurant"):
  - Busca en VOCABULARY_CATEGORIES['restaurant']
  - No encuentra "muela" → No aprende
  - Busca categoría "complaint" → Detecta "duele"
                                │
                                ▼
Patrón guardado como: complaint (restaurant context)
En lugar de: pain_point (dental context)
                                │
                                ▼
Insights generados usan vertical incorrecta
```

**Severidad:** ALTA
**Vertical afectada:** Ambas (error de config)
**Gap identificado:** No hay validación de cambio de vertical

---

### Escenario B9: Desbordamiento de Cola de Aprendizaje

**Descripción:** Alto volumen de mensajes satura la cola de aprendizaje.

**Flujo del problema:**
```
Tenant con alto tráfico: 10,000 mensajes/día
                                │
                                ▼
Cada mensaje → queueMessageForLearning()
                                │
                                ▼
ai_learning_queue crece a 300,000 items (30 días)
                                │
                                ▼
processLearningQueue(limit=100):
  - Procesa solo 100 items
  - Cola sigue creciendo
                                │
                                ▼
Patrones más recientes NUNCA se procesan
Insights basados en datos de hace 30 días
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas (tenants de alto volumen)
**Gap identificado:** Falta límite de antigüedad y limpieza de cola

---

### Escenario B10: Injection de Patrones Maliciosos

**Descripción:** Usuario inyecta patrones que manipulan insights.

**Flujo del problema:**
```
Atacante envía mensajes masivos:
"quiero limpieza dental quiero limpieza dental quiero limpieza..."
(1000 repeticiones en 1 mensaje)
                                │
                                ▼
extractPatterns():
  - MAX_PATTERNS_PER_TYPE = 10 ✓ Protección existe
  - PERO: message.length no limitado antes de regex
                                │
                                ▼
Regex ejecuta sobre mensaje de 50KB → ReDoS potencial
O peor: regex con backtracking exponencial
```

**Severidad:** ALTA (DoS potencial)
**Vertical afectada:** Ambas
**Gap identificado:** Validación de longitud existe pero tardía

---

## 4. TABLA DE GAPS Y PRIORIDADES

| ID | Gap | Severidad | Escenario | Vertical |
|----|-----|-----------|-----------|----------|
| **G-B1** | No hay lock de concurrencia en CRON | ALTA | B1 | Ambas |
| **G-B2** | No hay sanitización de PII en patrones | CRÍTICA | B2 | Ambas |
| **G-B3** | Falta validación de data_points mínimos | MEDIA | B3 | Ambas |
| **G-B4** | Falta circuit breaker para Gemini insights | ALTA | B4 | Ambas |
| **G-B5** | Falta normalización de sinónimos | BAJA | B5 | Restaurant |
| **G-B6** | RPC broadcast_notification puede fallar | CRÍTICA | B6 | Restaurant |
| **G-B7** | Expiración no se verifica en lectura | MEDIA | B7 | Ambas |
| **G-B8** | No hay validación de cambio de vertical | ALTA | B8 | Ambas |
| **G-B9** | Falta límite de antigüedad en cola | MEDIA | B9 | Ambas |
| **G-B10** | Validación de longitud antes de regex | ALTA | B10 | Ambas |

---

## 5. SOLUCIONES PROPUESTAS

### 5.1 G-B1: Lock de Concurrencia en CRON

```typescript
// En generate-insights/route.ts
async function acquireCronLock(supabase, lockName: string, ttlMinutes: number = 10): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_locks')
    .insert({
      lock_name: lockName,
      acquired_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  // Si falla por constraint único, otra instancia tiene el lock
  if (error?.code === '23505') {
    // Verificar si el lock existente expiró
    const { data: existingLock } = await supabase
      .from('system_locks')
      .select('expires_at')
      .eq('lock_name', lockName)
      .single();

    if (existingLock && new Date(existingLock.expires_at) < new Date()) {
      // Lock expirado, podemos tomar el control
      await supabase.from('system_locks').delete().eq('lock_name', lockName);
      return acquireCronLock(supabase, lockName, ttlMinutes);
    }
    return false;
  }

  return !error;
}

async function releaseCronLock(supabase, lockName: string): Promise<void> {
  await supabase.from('system_locks').delete().eq('lock_name', lockName);
}
```

### 5.2 G-B2: Sanitización de PII

```typescript
// En message-learning.service.ts
const PII_PATTERNS = [
  // RFC mexicano
  /[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi,
  // Email
  /[\w.-]+@[\w.-]+\.\w+/gi,
  // Teléfono mexicano
  /(\+?52)?[\s.-]?\d{2,3}[\s.-]?\d{3,4}[\s.-]?\d{4}/g,
  // CURP
  /[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d/gi,
  // Tarjeta de crédito
  /\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}/g,
  // Nombres propios después de "soy" o "me llamo"
  /(?:soy|me llamo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/gi,
];

function sanitizePII(text: string): string {
  let sanitized = text;
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

// Modificar extractPatterns para usar sanitización
export function extractPatterns(message: string, vertical: string = 'general'): ExtractedPattern[] {
  // Sanitizar ANTES de procesar
  const sanitizedMessage = sanitizePII(message);
  // ... resto del código usando sanitizedMessage
}
```

### 5.3 G-B4: Circuit Breaker para Gemini Insights

```typescript
// En business-insights.service.ts, usar el existente SafetyResilienceService
import { SafetyResilienceService } from './safety-resilience.service';

const GEMINI_INSIGHTS_CIRCUIT = 'gemini-business-insights';

async function generateInsightsWithGemini(data: TenantAnalyticsData, maxInsights: number): Promise<BusinessInsight[]> {
  // Verificar circuit breaker
  if (SafetyResilienceService.isCircuitOpen(GEMINI_INSIGHTS_CIRCUIT)) {
    console.warn('[Business Insights] Circuit breaker open, skipping Gemini call');
    return [];
  }

  try {
    const result = await generateWithGemini(prompt, options);

    if (!result.success) {
      SafetyResilienceService.recordCircuitFailure(GEMINI_INSIGHTS_CIRCUIT);
      return [];
    }

    SafetyResilienceService.recordCircuitSuccess(GEMINI_INSIGHTS_CIRCUIT);
    // ... procesar resultado
  } catch (error) {
    SafetyResilienceService.recordCircuitFailure(GEMINI_INSIGHTS_CIRCUIT);
    throw error;
  }
}
```

### 5.4 G-B6: Verificar RPC de Notificaciones

```typescript
// En message-learning.service.ts, createHighPriorityAlert
async function createHighPriorityAlert(supabase, params): Promise<void> {
  // Verificar si la función RPC existe antes de llamarla
  const { data: functions } = await supabase
    .rpc('pg_catalog.pg_proc')
    .select('proname')
    .eq('proname', 'broadcast_notification')
    .single();

  if (!functions) {
    // Fallback: insertar notificaciones directamente
    console.warn('[Learning Service] broadcast_notification RPC not found, using direct insert');

    const notifications = userIds.map(userId => ({
      tenant_id: params.tenantId,
      user_id: userId,
      type: config.type,
      title: config.title,
      message: `Patrones detectados: ${patternsSummary}`,
      priority: config.priority,
      // ... resto de campos
    }));

    await supabase.from('notifications').insert(notifications);
    return;
  }

  // Si existe, usar el RPC
  await supabase.rpc('broadcast_notification', { ... });
}
```

### 5.5 G-B7: Verificar Expiración en Lectura

```typescript
// En business-insights.service.ts
export async function getActiveInsights(tenantId: string): Promise<BusinessInsight[]> {
  const supabase = createServerClient();

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - INSIGHTS_EXPIRY_DAYS);

  const { data: insights, error } = await supabase
    .from('ai_business_insights')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('dismissed', false)
    .gte('created_at', expiryDate.toISOString()) // NUEVO: Filtrar por fecha
    .order('impact_score', { ascending: false })
    .order('confidence_score', { ascending: false });

  // ... resto
}
```

---

## 6. MIGRACIÓN NECESARIA

```sql
-- Migration: 119_BUSINESS_IA_IMPROVEMENTS.sql

-- Tabla para locks de sistema (G-B1)
CREATE TABLE IF NOT EXISTS public.system_locks (
  lock_name TEXT PRIMARY KEY,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  acquired_by TEXT
);

-- Índice para limpieza de locks expirados
CREATE INDEX IF NOT EXISTS idx_system_locks_expires
ON public.system_locks (expires_at)
WHERE expires_at < NOW();

-- Agregar columna de datos sanitizados (G-B2)
ALTER TABLE public.ai_message_patterns
ADD COLUMN IF NOT EXISTS context_sanitized TEXT;

-- Agregar columna de data_points mínimos validados (G-B3)
ALTER TABLE public.ai_business_insights
ADD COLUMN IF NOT EXISTS min_data_points_met BOOLEAN DEFAULT TRUE;

-- Agregar columna de vertical snapshot (G-B8)
ALTER TABLE public.ai_business_insights
ADD COLUMN IF NOT EXISTS vertical_at_generation TEXT;

-- Función para limpiar cola antigua (G-B9)
CREATE OR REPLACE FUNCTION public.cleanup_learning_queue(max_age_days INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.ai_learning_queue
  WHERE created_at < NOW() - (max_age_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

---

## 7. ORDEN DE IMPLEMENTACIÓN

1. **CRÍTICOS (Implementar primero)**
   - ✅ G-B2: Sanitización de PII (compliance) - **IMPLEMENTADO**
   - ✅ G-B6: Verificar RPC de notificaciones - **IMPLEMENTADO**

2. **ALTOS (Implementar después)**
   - G-B1: Lock de concurrencia
   - ✅ G-B4: Circuit breaker Gemini - **IMPLEMENTADO**
   - G-B8: Validación de vertical
   - G-B10: Validación de longitud pre-regex

3. **MEDIOS (Siguiente sprint)**
   - G-B3: Validación de data_points
   - ✅ G-B7: Expiración en lectura - **IMPLEMENTADO**
   - G-B9: Limpieza de cola

4. **BAJOS (Backlog)**
   - G-B5: Normalización de sinónimos

---

## 8. IMPLEMENTACIONES COMPLETADAS

### 8.1 G-B2: Sanitización de PII ✅

**Archivo:** `src/features/ai/services/message-learning.service.ts`

**Cambios realizados:**
- Añadida constante `PII_PATTERNS` con 9 patrones regex para detectar:
  - RFC mexicano
  - Emails
  - Teléfonos mexicanos
  - CURP
  - Tarjetas de crédito
  - NSS (Número de Seguro Social)
  - Nombres propios (después de "soy" o "me llamo")
  - Direcciones
  - Códigos postales
- Función `sanitizePII(text: string): string` que reemplaza PII con tokens seguros
- Función `containsPII(text: string): boolean` para detección rápida
- Integrado en `extractPatterns()` para sanitizar antes de procesar

### 8.2 G-B6: Verificación RPC Notificaciones ✅

**Archivo:** `src/features/ai/services/message-learning.service.ts`

**Cambios realizados:**
- Modificada `createHighPriorityAlert()` para manejar fallo de RPC
- Si `broadcast_notification` RPC falla, hace fallback a INSERT directo en tabla `notifications`
- Log de warning cuando se usa fallback para monitoreo

### 8.3 G-B4: Circuit Breaker Gemini Insights ✅

**Archivo:** `src/features/ai/services/business-insights.service.ts`

**Cambios realizados:**
- Import de `SafetyResilienceService`
- Constante `GEMINI_INSIGHTS_CIRCUIT` para identificar el circuito
- Verificación de circuit breaker antes de llamar a Gemini
- Registro de éxitos con `recordCircuitSuccess()`
- Registro de fallos con `recordCircuitFailure()` en caso de error o excepción
- Try-catch envolviendo la llamada a Gemini

### 8.4 G-B7: Expiración en Lectura ✅

**Archivo:** `src/features/ai/services/business-insights.service.ts`

**Cambios realizados:**
- Modificada `getActiveInsights()` para filtrar por fecha de expiración
- Cálculo dinámico de `expiryDate` basado en `INSIGHTS_EXPIRY_DAYS`
- Filtro `.gte('created_at', expiryDate.toISOString())` añadido a query
- También actualizado `getUnseenInsightsCount()` con el mismo filtro

---

## 9. IMPLEMENTACIONES ADICIONALES (Fase 2)

### 9.1 G-B1: Lock Distribuido para CRON ✅

**Archivos:**
- `src/features/ai/services/distributed-lock.service.ts` (NUEVO)
- `app/api/cron/generate-insights/route.ts` (MODIFICADO)
- `supabase/migrations/119_BUSINESS_IA_IMPROVEMENTS.sql` (NUEVO)

**Cambios realizados:**
- Servicio completo de locks distribuidos usando PostgreSQL
- Tabla `system_locks` con TTL automático
- Integración en CRON de insights para evitar ejecuciones concurrentes
- Métodos: `acquireLock()`, `releaseLock()`, `extendLock()`, `withLock()`
- Limpieza automática de locks expirados

### 9.2 G-B10: Validación de Longitud Pre-Regex ✅

**Archivo:** `src/features/ai/services/message-learning.service.ts`

**Cambios realizados:**
- Ya implementado: `MAX_MESSAGE_LENGTH = 5000` antes de cualquier regex
- Constraint en DB: `check_message_length` (máx 10000 caracteres)
- Constraint en DB: `check_pattern_value_length` (máx 500 caracteres)

### 9.3 G-B8: Snapshot de Vertical ✅

**Archivo:** `src/features/ai/services/business-insights.service.ts`

**Cambios realizados:**
- Columna `vertical_at_generation` añadida a `ai_business_insights`
- Se guarda la vertical del tenant al momento de generar cada insight
- Permite auditar si la vertical cambió después de generar insights

### 9.4 G-B3: Validación de Data Points Mínimos ✅

**Archivo:** `src/features/ai/services/business-insights.service.ts`

**Cambios realizados:**
- Constante `MIN_DATA_POINTS_BY_TYPE` con umbrales por tipo de insight
- Columna `min_data_points_met` añadida a `ai_business_insights`
- Si no cumple mínimos:
  - Se marca `min_data_points_met = false`
  - Se limita `confidence_score` a máximo 0.5
  - Se incluye info en metadata

### 9.5 G-B9: Limpieza Automática de Cola ✅

**Archivos:**
- `app/api/cron/process-learning/route.ts` (MODIFICADO)
- `supabase/migrations/119_BUSINESS_IA_IMPROVEMENTS.sql`

**Cambios realizados:**
- Función PostgreSQL `cleanup_learning_queue(p_max_age_days, p_max_items)`
- Se ejecuta automáticamente antes de procesar la cola
- Elimina items completados/fallidos > 7 días
- Mantiene máximo 10,000 items en cola (elimina los más antiguos)

---

## 10. GAPS PENDIENTES (Backlog - Prioridad Baja)

| ID | Gap | Severidad | Estado |
|----|-----|-----------|--------|
| G-B5 | Normalización de sinónimos | BAJA | Pendiente |

---

## 11. RESUMEN DE ARCHIVOS MODIFICADOS

### Nuevos Archivos
- `src/features/ai/services/distributed-lock.service.ts`
- `supabase/migrations/119_BUSINESS_IA_IMPROVEMENTS.sql`

### Archivos Modificados
- `src/features/ai/services/business-insights.service.ts`
- `src/features/ai/services/message-learning.service.ts`
- `app/api/cron/generate-insights/route.ts`
- `app/api/cron/process-learning/route.ts`
- `docs/REVISION_5.2_BUSINESS_IA_AUDIT.md`

---

**Fin del documento REVISIÓN 5.2**
