# REVISIÓN 5.3 - Auditoría Profunda de Business IA (Segunda Ronda)

**Fecha:** 2026-01-09
**Autor:** Claude Opus 4.5
**Estado:** IMPLEMENTADO - FASE 1 COMPLETA

---

## 1. RESUMEN EJECUTIVO

Esta es la segunda ronda de auditoría exhaustiva del sistema Business IA, realizada después de implementar los gaps críticos en REVISIÓN 5.2. El objetivo es identificar escenarios hipotéticos adicionales que puedan comprometer la seguridad, integridad o funcionamiento del sistema.

### Gaps Implementados en REVISIÓN 5.2 (Ya Resueltos)
- G-B1: Lock de concurrencia en CRON ✅
- G-B2: Sanitización de PII ✅
- G-B3: Validación data_points mínimos ✅
- G-B4: Circuit breaker Gemini ✅
- G-B6: Fallback RPC notificaciones ✅
- G-B7: Expiración en lectura ✅
- G-B8: Snapshot de vertical ✅
- G-B9: Limpieza de cola ✅
- G-B10: Validación longitud pre-regex ✅

---

## 2. DIFERENCIAS CRÍTICAS ENTRE VERTICALES

### 2.1 Dental vs Restaurant: Análisis Comparativo

| Aspecto | DENTAL | RESTAURANT |
|---------|--------|------------|
| **Urgencia Típica** | MUY ALTA (dolor físico) | BAJA-MEDIA (excepto eventos) |
| **Tiempo de Respuesta** | Minutos | Horas |
| **Riesgo de Salud** | ALTO (infecciones, dolor) | MEDIO (alergias) |
| **Patrones Críticos** | `pain_point`, `urgency_indicator` | `complaint`, `preference` |
| **Vocabulario Técnico** | Anatómico (molar, endodoncia) | Culinario (entrada, postre) |
| **Compliance** | Historia clínica, consentimiento | Alergias, facturación |
| **Escalamiento** | A dentista/especialista | A manager/gerente |

### 2.2 Flujos de Alta Prioridad por Vertical

**DENTAL:**
```
Usuario: "Urgencia, me duele mucho la muela desde ayer"
    ↓
HIGH PRIORITY PATTERNS:
├─ urgency_indicator: "urgencia"
├─ pain_point: "duele mucho la muela"
├─ urgency (vocabulary): "desde ayer" (duración)
    ↓
ACTION: urgent_booking
├─ Alerta inmediata a staff
├─ Notificación: "Solicitud de cita URGENTE"
└─ Escalamiento automático
```

**RESTAURANT:**
```
Usuario: "La comida llegó fría y el mesero fue grosero"
    ↓
HIGH PRIORITY PATTERNS:
├─ complaint: "llegó fría"
├─ complaint: "mesero grosero"
    ↓
ACTION: escalation
├─ Alerta a manager
├─ Notificación: "Queja detectada - Requiere atención"
└─ NO escalamiento automático a externo
```

---

## 3. ESCENARIOS HIPOTÉTICOS CRÍTICOS - SEGUNDA RONDA

### Escenario B11: Cross-Tenant Pattern Leakage via Vocabulary

**Descripción:** Un patrón de vocabulario aprendido de un tenant podría potencialmente influir en las respuestas de otro tenant si hay sharing de vocabulario a nivel de modelo.

**Flujo del problema:**
```
Tenant A (Restaurant): Aprende "ceviche peruano" como specialty
Tenant B (Restaurant): Usa mismo modelo de aprendizaje

                                │
                                ▼
Si hay sharing de embeddings o vocabulario común:
Tenant B recibe pregunta "¿tienen ceviche?"
                                │
                                ▼
Sistema podría sugerir "ceviche peruano" aunque
Tenant B no lo tenga en menú → INFORMACIÓN INCORRECTA
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas
**Gap identificado:** G-B11 - No hay aislamiento explícito en vocabulario aprendido

---

### Escenario B12: Sentiment Manipulation via Repetition

**Descripción:** Un actor malicioso podría manipular el sentiment_avg de un patrón enviando múltiples mensajes con sentimiento específico.

**Flujo del problema:**
```
Atacante detecta patrón popular: "limpieza dental"
                                │
                                ▼
Envía 100 mensajes:
"La limpieza dental es horrible, muy caro, mal servicio"
                                │
                                ▼
sentiment_avg para "limpieza dental" baja de +0.5 a -0.8
                                │
                                ▼
Insight generado: "Satisfacción negativa en limpieza dental"
                                │
                                ▼
FALSO NEGATIVO → Decisiones de negocio incorrectas
```

**Severidad:** ALTA
**Vertical afectada:** Ambas
**Gap identificado:** G-B12 - No hay rate limiting por lead/IP para patrones

---

### Escenario B13: Vocabulary Injection Attack

**Descripción:** Un atacante inyecta vocabulario malicioso que luego aparece en insights o respuestas AI.

**Flujo del problema:**
```
Atacante envía: "Quiero [SCRIPT_INJECTION] para mi cita"
                                │
                                ▼
extractVocabulary():
  - term: "[SCRIPT_INJECTION]"
  - category: "other"
                                │
                                ▼
Guardado en ai_learned_vocabulary
                                │
                                ▼
Insight generado: "Término popular: [SCRIPT_INJECTION]"
                                │
                                ▼
Dashboard muestra término malicioso → XSS potencial
```

**Severidad:** ALTA
**Vertical afectada:** Ambas
**Gap identificado:** G-B13 - No hay validación/sanitización de vocabulario aprendido

---

### Escenario B14: Temporal Pattern Poisoning

**Descripción:** Patrones detectados en períodos cortos de promoción distorsionan insights de largo plazo.

**Flujo del problema:**
```
Dental: Promoción "Blanqueamiento 50% OFF" por 1 semana
                                │
                                ▼
1000 mensajes mencionan "blanqueamiento"
                                │
                                ▼
Insight (3 días después): "Blanqueamiento es tu servicio #1"
confidence_score: 0.95
                                │
                                ▼
1 mes después (sin promoción):
Solo 20 menciones de blanqueamiento
                                │
                                ▼
Insight histórico sigue sugiriendo "blanqueamiento popular"
aunque la tendencia ya cambió → DECISIÓN INCORRECTA
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas
**Gap identificado:** G-B14 - No hay detección de anomalías temporales

---

### Escenario B15: Learning Queue Starvation

**Descripción:** Un tenant de alto volumen acapara la cola de aprendizaje, dejando a otros tenants sin procesar.

**Flujo del problema:**
```
Tenant A: 50,000 mensajes/día
Tenant B: 100 mensajes/día
                                │
                                ▼
ai_learning_queue (FIFO):
[A, A, A, A, A, A, A, A, ..., B, A, A, A, A, ...]
                                │
                                ▼
CRON procesa 100 mensajes:
99 de Tenant A, 1 de Tenant B
                                │
                                ▼
Tenant B: Patrones NUNCA se procesan completamente
Insights de Tenant B basados en datos incompletos
```

**Severidad:** ALTA
**Vertical afectada:** Ambas (tenants de alto volumen)
**Gap identificado:** G-B15 - No hay fairness/quota por tenant en cola

---

### Escenario B16: Insight Generation During Vertical Migration

**Descripción:** Un tenant cambia de vertical (dental→restaurant) durante la generación de insights.

**Flujo del problema:**
```
Tenant: vertical = "dental" (original)
CRON inicia: collectTenantAnalytics(tenantId)
                                │
Recopilando datos...           │ Admin cambia vertical a "restaurant"
                                │
                                ▼
generateInsightsWithGemini():
  - data.vertical = "dental" (cached)
  - Pero BD ya dice "restaurant"
                                │
                                ▼
Insight generado: "Tu servicio de endodoncia..."
vertical_at_generation: "dental"
                                │
                                ▼
Usuario ve insight de dental en dashboard de restaurant
INCONSISTENCIA VISUAL
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas (durante migración)
**Gap identificado:** G-B16 - No hay lock durante generación de insights por tenant

---

### Escenario B17: High Priority Alert Flooding

**Descripción:** Sistema genera demasiadas alertas de alta prioridad, causando "alert fatigue".

**Flujo del problema:**
```
Restaurant con 500 mensajes/hora
20% menciona "esperé" (normal en conversación)
                                │
                                ▼
complaint pattern detecta "esperé" 100 veces/hora
                                │
                                ▼
100 alertas "Queja detectada" por hora
                                │
                                ▼
Staff ignora TODAS las alertas (alert fatigue)
                                │
                                ▼
Queja REAL crítica pasa desapercibida
"La comida tenía un insecto" → NO ATENDIDA
```

**Severidad:** ALTA
**Vertical afectada:** Restaurant principalmente
**Gap identificado:** G-B17 - No hay deduplicación/throttling de alertas

---

### Escenario B18: Gemini Context Window Overflow

**Descripción:** Datos analíticos de un tenant muy grande exceden el context window de Gemini.

**Flujo del problema:**
```
Tenant Growth: 10,000 patrones, 5,000 vocabulario, 500 objeciones
                                │
                                ▼
collectTenantAnalytics():
  - topServiceRequests: [500 items]
  - commonObjections: [300 items]
  - schedulingPreferences: [200 items]
                                │
                                ▼
Prompt a Gemini: ~100,000 tokens
Context window de Gemini: 32,000 tokens
                                │
                                ▼
Gemini trunca o falla silenciosamente
Insights generados incompletos o incorrectos
```

**Severidad:** MEDIA
**Vertical afectada:** Tenants grandes (Growth plan)
**Gap identificado:** G-B18 - No hay límite/sampling de datos para prompt

---

### Escenario B19: Pattern Type Confusion Between Verticals

**Descripción:** Un patrón detectado tiene significado diferente según la vertical.

**Flujo del problema:**
```
Mensaje: "Quiero algo para el dolor"
                                │
DENTAL:                        RESTAURANT:
├─ pain_point: "dolor"         ├─ NO debería detectar
│  → urgent_booking            │  (no es dolor físico)
│  → Alerta de emergencia      │
                                │
Pero si vertical está mal configurada:
Restaurant detecta "dolor" como pain_point
                                │
                                ▼
Alerta falsa: "Solicitud de cita URGENTE"
En contexto de restaurant → CONFUSIÓN
```

**Severidad:** MEDIA
**Vertical afectada:** Ambas (con config incorrecta)
**Gap identificado:** G-B19 - Patrones no filtrados por vertical en extracción

---

### Escenario B20: Stale Learning Config Cache

**Descripción:** Cambios en ai_learning_config no se reflejan inmediatamente.

**Flujo del problema:**
```
Admin desactiva: learning_enabled = false
                                │
                                ▼
CRON (en ejecución): Usa config cacheada
                                │
                                ▼
Procesa 100 mensajes más después de desactivar
                                │
                                ▼
Patrones guardados aunque admin no quería
                                │
                                ▼
Compliance issue: "Pedí que no guardaran mis datos"
```

**Severidad:** MEDIA (compliance)
**Vertical afectada:** Ambas
**Gap identificado:** G-B20 - No hay invalidación de cache de config

---

## 4. TABLA DE NUEVOS GAPS IDENTIFICADOS

| ID | Gap | Severidad | Escenario | Vertical | Estado |
|----|-----|-----------|-----------|----------|--------|
| **G-B11** | No hay aislamiento de vocabulario por tenant | MEDIA | B11 | Ambas | PENDIENTE |
| **G-B12** | No hay rate limiting para patrones | ALTA | B12 | Ambas | ✅ IMPLEMENTADO |
| **G-B13** | No hay validación de vocabulario | ALTA | B13 | Ambas | ✅ IMPLEMENTADO |
| **G-B14** | No hay detección de anomalías temporales | MEDIA | B14 | Ambas | PENDIENTE |
| **G-B15** | No hay fairness en cola por tenant | ALTA | B15 | Ambas | ✅ IMPLEMENTADO |
| **G-B16** | No hay lock por tenant en generación | MEDIA | B16 | Ambas | PENDIENTE |
| **G-B17** | No hay throttling de alertas | ALTA | B17 | Restaurant | ✅ IMPLEMENTADO |
| **G-B18** | No hay límite de datos para prompt | MEDIA | B18 | Growth | PENDIENTE |
| **G-B19** | Patrones no filtrados por vertical | MEDIA | B19 | Ambas | PENDIENTE |
| **G-B20** | Config learning sin invalidación cache | MEDIA | B20 | Ambas | PENDIENTE |

---

## 5. PRIORIZACIÓN DE SOLUCIONES

### 5.1 CRÍTICOS (Implementar ahora)

1. **G-B12: Rate Limiting para Patrones**
   - Limitar inserciones de patrones por lead_id/hora
   - Evitar sentiment manipulation

2. **G-B13: Validación de Vocabulario**
   - Sanitizar términos antes de guardar
   - Filtrar caracteres especiales/scripts

3. **G-B15: Fairness en Cola por Tenant**
   - Round-robin o quota por tenant
   - Evitar starvation

4. **G-B17: Throttling de Alertas**
   - Máximo N alertas por tipo/hora
   - Deduplicación de alertas similares

### 5.2 ALTOS (Implementar después)

5. **G-B18: Límite de Datos para Prompt**
   - Sampling inteligente de patrones
   - Top N por relevancia

6. **G-B19: Filtrado de Patrones por Vertical**
   - pain_point solo para dental/medical
   - complaint con contexto por vertical

### 5.3 MEDIOS (Siguiente sprint)

7. **G-B11: Aislamiento de Vocabulario**
   - Verificar que no hay sharing
   - Tests de aislamiento

8. **G-B14: Detección de Anomalías**
   - Flag para patrones de promoción
   - Weighted scoring temporal

9. **G-B16: Lock por Tenant en Generación**
   - Snapshot de vertical al inicio
   - Validar consistencia al final

10. **G-B20: Invalidación de Cache Config**
    - Check de config actualizada antes de procesar

---

## 6. SOLUCIONES PROPUESTAS

### 6.1 G-B12: Rate Limiting para Patrones

```typescript
// En message-learning.service.ts
const PATTERN_RATE_LIMITS = {
  max_patterns_per_lead_per_hour: 50,
  max_same_pattern_per_hour: 10,
  cooldown_after_limit_ms: 60000,
};

async function checkPatternRateLimit(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string,
  patternType: string,
  patternValue: string
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Contar patrones del lead en la última hora
  const { count: leadPatternCount } = await supabase
    .from('ai_message_patterns')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('metadata->>lead_id', leadId)
    .gte('last_occurrence', oneHourAgo);

  if ((leadPatternCount || 0) >= PATTERN_RATE_LIMITS.max_patterns_per_lead_per_hour) {
    console.warn(`[Learning] Rate limit reached for lead ${leadId}`);
    return false; // No procesar
  }

  return true;
}
```

### 6.2 G-B13: Validación de Vocabulario

```typescript
// En message-learning.service.ts
const VOCABULARY_VALIDATION = {
  max_term_length: 100,
  forbidden_patterns: [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\{\{/,
    /\$\{/,
  ],
  allowed_chars: /^[\w\sáéíóúüñÁÉÍÓÚÜÑ.,;:!?¿¡'"()-]+$/,
};

function validateVocabularyTerm(term: string): { valid: boolean; reason?: string } {
  if (!term || term.length > VOCABULARY_VALIDATION.max_term_length) {
    return { valid: false, reason: 'Term too long or empty' };
  }

  for (const pattern of VOCABULARY_VALIDATION.forbidden_patterns) {
    if (pattern.test(term)) {
      return { valid: false, reason: 'Forbidden pattern detected' };
    }
  }

  if (!VOCABULARY_VALIDATION.allowed_chars.test(term)) {
    return { valid: false, reason: 'Invalid characters' };
  }

  return { valid: true };
}
```

### 6.3 G-B15: Fairness en Cola por Tenant

```typescript
// En process-learning CRON
async function processLearningQueueFair(limit: number): Promise<ProcessingResult> {
  const supabase = createServerClient();

  // 1. Obtener tenants con items pendientes
  const { data: tenantCounts } = await supabase
    .from('ai_learning_queue')
    .select('tenant_id')
    .eq('status', 'pending')
    .limit(1000);

  // Contar por tenant
  const tenantIds = [...new Set(tenantCounts?.map(t => t.tenant_id) || [])];
  const itemsPerTenant = Math.max(1, Math.floor(limit / tenantIds.length));

  let totalProcessed = 0;

  // 2. Procesar round-robin
  for (const tenantId of tenantIds) {
    const { data: items } = await supabase
      .from('ai_learning_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(itemsPerTenant);

    for (const item of items || []) {
      await processLearningMessage(supabase, item);
      totalProcessed++;
    }
  }

  return { processed: totalProcessed, ... };
}
```

### 6.4 G-B17: Throttling de Alertas

```typescript
// En message-learning.service.ts
const ALERT_THROTTLE_CONFIG = {
  max_alerts_per_type_per_hour: 10,
  dedup_window_minutes: 15,
  similar_threshold: 0.8,
};

interface AlertThrottleState {
  type: string;
  count: number;
  lastReset: number;
  recentPatterns: string[];
}

const alertThrottleCache = new Map<string, AlertThrottleState>();

function shouldSendAlert(
  tenantId: string,
  actionType: string,
  patternValue: string
): boolean {
  const key = `${tenantId}:${actionType}`;
  const now = Date.now();

  let state = alertThrottleCache.get(key);

  // Reset si pasó 1 hora
  if (!state || now - state.lastReset > 3600000) {
    state = {
      type: actionType,
      count: 0,
      lastReset: now,
      recentPatterns: [],
    };
  }

  // Check límite por hora
  if (state.count >= ALERT_THROTTLE_CONFIG.max_alerts_per_type_per_hour) {
    console.log(`[Alerts] Throttled: ${actionType} for tenant ${tenantId}`);
    return false;
  }

  // Check deduplicación
  if (state.recentPatterns.includes(patternValue)) {
    console.log(`[Alerts] Deduped: ${patternValue}`);
    return false;
  }

  // Actualizar estado
  state.count++;
  state.recentPatterns.push(patternValue);
  if (state.recentPatterns.length > 20) {
    state.recentPatterns.shift();
  }

  alertThrottleCache.set(key, state);
  return true;
}
```

### 6.5 G-B18: Límite de Datos para Prompt

```typescript
// En business-insights.service.ts
const PROMPT_DATA_LIMITS = {
  max_service_requests: 20,
  max_objections: 10,
  max_scheduling_prefs: 10,
  max_peak_hours: 5,
  max_peak_days: 7,
  max_prompt_chars: 20000,
};

function limitAnalyticsForPrompt(data: TenantAnalyticsData): TenantAnalyticsData {
  return {
    ...data,
    topServiceRequests: data.topServiceRequests.slice(0, PROMPT_DATA_LIMITS.max_service_requests),
    commonObjections: data.commonObjections.slice(0, PROMPT_DATA_LIMITS.max_objections),
    schedulingPreferences: data.schedulingPreferences.slice(0, PROMPT_DATA_LIMITS.max_scheduling_prefs),
    peakHours: data.peakHours.slice(0, PROMPT_DATA_LIMITS.max_peak_hours),
    peakDays: data.peakDays.slice(0, PROMPT_DATA_LIMITS.max_peak_days),
  };
}
```

### 6.6 G-B19: Filtrado de Patrones por Vertical

```typescript
// En message-learning.service.ts
const VERTICAL_SPECIFIC_PATTERNS: Record<string, string[]> = {
  dental: ['pain_point', 'urgency_indicator'],
  restaurant: ['complaint', 'preference', 'occasion'],
  medical: ['pain_point', 'urgency_indicator', 'symptom'],
};

const UNIVERSAL_PATTERNS = [
  'service_request',
  'scheduling_preference',
  'objection',
  'satisfaction',
  'referral',
];

function filterPatternsByVertical(
  patterns: ExtractedPattern[],
  vertical: string
): ExtractedPattern[] {
  const allowedTypes = [
    ...UNIVERSAL_PATTERNS,
    ...(VERTICAL_SPECIFIC_PATTERNS[vertical] || []),
  ];

  return patterns.filter(p => allowedTypes.includes(p.type));
}
```

---

## 7. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

### Fase 1: Seguridad Crítica ✅ COMPLETADO
1. ✅ G-B13: Validación de vocabulario (XSS prevention) - IMPLEMENTADO
   - `sanitizeVocabularyTermInternal()` en message-learning.service.ts
   - Valida y sanitiza términos antes de guardar
   - Bloquea XSS, inyección de scripts, caracteres maliciosos
2. ✅ G-B17: Throttling de alertas (alert fatigue) - IMPLEMENTADO
   - `shouldSendAlertInternal()` en message-learning.service.ts
   - Máximo 10 alertas/tipo/hora, 50 alertas/tenant/hora
   - Deduplicación de patrones similares
3. ✅ G-B12: Rate limiting para patrones (manipulation) - IMPLEMENTADO
   - `checkPatternRateLimitInternal()` en message-learning.service.ts
   - Máximo 50 patrones/lead/hora, 5 del mismo patrón/hora
   - Cooldown automático al exceder límites
4. ✅ G-B15: Fairness en cola por tenant - IMPLEMENTADO
   - `processLearningQueue()` modificado con round-robin
   - Distribución equitativa de procesamiento entre tenants

### Fase 2: Estabilidad (Siguiente sesión)
5. G-B18: Límite de datos para prompt
6. G-B19: Filtrado de patrones por vertical

### Fase 3: Optimizaciones (Backlog)
7. G-B11: Aislamiento de vocabulario
8. G-B14: Detección de anomalías temporales
9. G-B16: Lock por tenant en generación
10. G-B20: Invalidación de cache config

---

## 8. NOTAS FINALES

Esta auditoría identifica 10 nuevos escenarios hipotéticos que van más allá de los gaps resueltos en REVISIÓN 5.2. Los más críticos están relacionados con:

1. **Manipulación de datos** (B12, B14) - Actores maliciosos pueden distorsionar insights
2. **Seguridad** (B13) - XSS potencial vía vocabulario
3. **Fairness** (B15, B17) - Algunos tenants/patrones pueden dominar
4. **Consistencia** (B16, B19) - Cambios de configuración durante procesamiento

La implementación de las soluciones propuestas elevará significativamente la robustez del sistema Business IA.

---

**Fin del documento REVISIÓN 5.3**
