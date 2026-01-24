# 🧠 TIS TIS AI LEARNING 2.0 - DOCUMENTACIÓN MAESTRA

## Índice General de Implementación

**Versión:** 2.0.1
**Fecha:** Enero 2026
**Estado:** ✅ IMPLEMENTACIÓN COMPLETA - VERIFICADA Y ALINEADA
**Última Actualización:** 2026-01-23 (Revisión Metacognitiva Exhaustiva)
**Autor:** Equipo TIS TIS

> **NOTA IMPORTANTE:** Los servicios backend y la migración SQL consolidada han sido implementados y verificados.
> - **Código:** `/src/features/ai/learning/` (13 servicios completos)
> - **SQL:** `/supabase/migrations/153_AI_LEARNING_2_0_CONSOLIDATED.sql`
> - **Tipos:** `/src/features/ai/learning/types/index.ts`
> - **Integración LangGraph:** `/src/features/ai/learning/integration/langgraph-integration.service.ts`

### ✅ VERIFICACIÓN DE ALINEACIÓN SQL-TYPESCRIPT (2026-01-23)

Se realizó una revisión metacognitiva exhaustiva que detectó y corrigió los siguientes problemas:

| Archivo | Problema | Solución |
|---------|----------|----------|
| `online-store.service.ts` | Usaba `feature_id` y `feature_value`, SQL usa `feature_name` y columnas tipadas | Corregido a usar `feature_name` y `value_int/float/string/bool/json` |
| `offline-store.service.ts` | Usaba `event_time`, SQL usa `event_timestamp` | Corregido y añadidos métodos de mapeo de valores tipados |
| `semantic-search.service.ts` | Parámetros RPC incorrectos (`p_embedding` vs `p_query_embedding`) | Corregido a usar los nombres exactos de la función SQL |
| `metrics-collector.service.ts` | Usaba campos inexistentes (`metric_type`, `metric_value`, `recorded_at`) | Corregido a usar `metric_category`, `mean_value`, `period_start`, con agregación |

**Confianza de la verificación: 0.95**

---

## 📋 TABLA DE CONTENIDOS

### DOCUMENTOS FUNDAMENTALES
| Doc | Nombre | Descripción | Estado |
|-----|--------|-------------|--------|
| 00 | [Índice Maestro](./00-INDICE-MAESTRO.md) | Este documento | ✅ |
| 01 | [Visión y Arquitectura](./01-VISION-ARQUITECTURA.md) | Visión general y arquitectura target | 📝 |
| 02 | [Estado Actual vs Target](./02-ESTADO-ACTUAL-VS-TARGET.md) | Análisis de gaps | 📝 |

### FASE 1: RLHF (Reinforcement Learning from Human Feedback)
| Doc | Nombre | Descripción | Prioridad |
|-----|--------|-------------|-----------|
| 1.0 | [FASE-1.0-RLHF-OVERVIEW](./FASE-1-RLHF/1.0-OVERVIEW.md) | Visión general RLHF | 🔴 Alta |
| 1.1 | [FASE-1.1-SCHEMA-DB](./FASE-1-RLHF/1.1-SCHEMA-DB.md) | Esquema de base de datos | 🔴 Alta |
| 1.2 | [FASE-1.2-API-FEEDBACK](./FASE-1-RLHF/1.2-API-FEEDBACK.md) | API de captura de feedback | 🔴 Alta |
| 1.3 | [FASE-1.3-UI-COMPONENTS](./FASE-1-RLHF/1.3-UI-COMPONENTS.md) | Componentes UI | 🔴 Alta |
| 1.4 | [FASE-1.4-AGGREGATOR](./FASE-1-RLHF/1.4-AGGREGATOR.md) | Agregador de feedback | 🔴 Alta |
| 1.5 | [FASE-1.5-PROMPT-OPTIMIZER](./FASE-1-RLHF/1.5-PROMPT-OPTIMIZER.md) | Optimizador de prompts | 🔴 Alta |
| 1.6 | [FASE-1.6-TESTING](./FASE-1-RLHF/1.6-TESTING.md) | Plan de testing | 🔴 Alta |

### FASE 2: SEMANTIC EMBEDDINGS
| Doc | Nombre | Descripción | Prioridad |
|-----|--------|-------------|-----------|
| 2.0 | [FASE-2.0-EMBEDDINGS-OVERVIEW](./FASE-2-EMBEDDINGS/2.0-OVERVIEW.md) | Visión general Embeddings | 🔴 Alta |
| 2.1 | [FASE-2.1-EMBEDDING-SERVICE](./FASE-2-EMBEDDINGS/2.1-EMBEDDING-SERVICE.md) | Servicio de embeddings | 🔴 Alta |
| 2.2 | [FASE-2.2-VECTOR-STORE](./FASE-2-EMBEDDINGS/2.2-VECTOR-STORE.md) | Almacenamiento vectorial | 🔴 Alta |
| 2.3 | [FASE-2.3-SEMANTIC-SEARCH](./FASE-2-EMBEDDINGS/2.3-SEMANTIC-SEARCH.md) | Búsqueda semántica | 🔴 Alta |
| 2.4 | [FASE-2.4-PATTERN-MIGRATION](./FASE-2-EMBEDDINGS/2.4-PATTERN-MIGRATION.md) | Migración de patrones | 🔴 Alta |
| 2.5 | [FASE-2.5-TESTING](./FASE-2-EMBEDDINGS/2.5-TESTING.md) | Plan de testing | 🔴 Alta |

### FASE 3: DRIFT DETECTION
| Doc | Nombre | Descripción | Prioridad |
|-----|--------|-------------|-----------|
| 3.0 | [FASE-3.0-DRIFT-OVERVIEW](./FASE-3-DRIFT/3.0-OVERVIEW.md) | Visión general Drift | 🟡 Media |
| 3.1 | [FASE-3.1-METRICS-COLLECTOR](./FASE-3-DRIFT/3.1-METRICS-COLLECTOR.md) | Colector de métricas | 🟡 Media |
| 3.2 | [FASE-3.2-STATISTICAL-TESTS](./FASE-3-DRIFT/3.2-STATISTICAL-TESTS.md) | Tests estadísticos | 🟡 Media |
| 3.3 | [FASE-3.3-ALERTING](./FASE-3-DRIFT/3.3-ALERTING.md) | Sistema de alertas | 🟡 Media |
| 3.4 | [FASE-3.4-DASHBOARD](./FASE-3-DRIFT/3.4-DASHBOARD.md) | Dashboard de monitoreo | 🟡 Media |
| 3.5 | [FASE-3.5-TESTING](./FASE-3-DRIFT/3.5-TESTING.md) | Plan de testing | 🟡 Media |

### FASE 4: FEATURE STORE
| Doc | Nombre | Descripción | Prioridad |
|-----|--------|-------------|-----------|
| 4.0 | [FASE-4.0-FEATURE-STORE-OVERVIEW](./FASE-4-FEATURE-STORE/4.0-OVERVIEW.md) | Visión general Feature Store | 🟡 Media |
| 4.1 | [FASE-4.1-SCHEMA-DESIGN](./FASE-4-FEATURE-STORE/4.1-SCHEMA-DESIGN.md) | Diseño de esquema | 🟡 Media |
| 4.2 | [FASE-4.2-FEATURE-COMPUTATION](./FASE-4-FEATURE-STORE/4.2-FEATURE-COMPUTATION.md) | Cómputo de features | 🟡 Media |
| 4.3 | [FASE-4.3-VERSIONING](./FASE-4-FEATURE-STORE/4.3-VERSIONING.md) | Versionado de features | 🟡 Media |
| 4.4 | [FASE-4.4-SERVING](./FASE-4-FEATURE-STORE/4.4-SERVING.md) | Serving de features | 🟡 Media |
| 4.5 | [FASE-4.5-TESTING](./FASE-4-FEATURE-STORE/4.5-TESTING.md) | Plan de testing | 🟡 Media |

### FASE 5: FINE-TUNING
| Doc | Nombre | Descripción | Prioridad |
|-----|--------|-------------|-----------|
| 5.0 | [FASE-5.0-FINETUNING-OVERVIEW](./FASE-5-FINETUNING/5.0-OVERVIEW.md) | Visión general Fine-tuning | 🟢 Baja |
| 5.1 | [FASE-5.1-DATA-PREPARATION](./FASE-5-FINETUNING/5.1-DATA-PREPARATION.md) | Preparación de datos | 🟢 Baja |
| 5.2 | [FASE-5.2-MODEL-SELECTION](./FASE-5-FINETUNING/5.2-MODEL-SELECTION.md) | Selección de modelo | 🟢 Baja |
| 5.3 | [FASE-5.3-TRAINING-PIPELINE](./FASE-5-FINETUNING/5.3-TRAINING-PIPELINE.md) | Pipeline de entrenamiento | 🟢 Baja |
| 5.4 | [FASE-5.4-EVALUATION](./FASE-5-FINETUNING/5.4-EVALUATION.md) | Evaluación de modelo | 🟢 Baja |
| 5.5 | [FASE-5.5-DEPLOYMENT](./FASE-5-FINETUNING/5.5-DEPLOYMENT.md) | Despliegue de modelo | 🟢 Baja |
| 5.6 | [FASE-5.6-TESTING](./FASE-5-FINETUNING/5.6-TESTING.md) | Plan de testing | 🟢 Baja |

### FASE 6: EXPLAINABILITY (XAI)
| Doc | Nombre | Descripción | Prioridad |
|-----|--------|-------------|-----------|
| 6.0 | [FASE-6.0-XAI-OVERVIEW](./FASE-6-XAI/6.0-OVERVIEW.md) | Visión general XAI | 🟡 Media |
| 6.1 | [FASE-6.1-DECISION-LOGGING](./FASE-6-XAI/6.1-DECISION-LOGGING.md) | Logging de decisiones | 🟡 Media |
| 6.2 | [FASE-6.2-EVIDENCE-EXTRACTION](./FASE-6-XAI/6.2-EVIDENCE-EXTRACTION.md) | Extracción de evidencia | 🟡 Media |
| 6.3 | [FASE-6.3-UI-EXPLANATIONS](./FASE-6-XAI/6.3-UI-EXPLANATIONS.md) | UI de explicaciones | 🟡 Media |
| 6.4 | [FASE-6.4-AUDIT-TRAIL](./FASE-6-XAI/6.4-AUDIT-TRAIL.md) | Trail de auditoría | 🟡 Media |
| 6.5 | [FASE-6.5-TESTING](./FASE-6-XAI/6.5-TESTING.md) | Plan de testing | 🟡 Media |

---

## 🗓️ CRONOGRAMA DE IMPLEMENTACIÓN

```
Q1 2026 (Ene-Mar)
├── FASE 1: RLHF ──────────────────────────────────► [████████████████████]
│   ├── 1.1 Schema DB ─────────────────────────────► Semana 1-2
│   ├── 1.2 API Feedback ──────────────────────────► Semana 2-3
│   ├── 1.3 UI Components ─────────────────────────► Semana 3-4
│   ├── 1.4 Aggregator ────────────────────────────► Semana 5-6
│   ├── 1.5 Prompt Optimizer ──────────────────────► Semana 6-8
│   └── 1.6 Testing ───────────────────────────────► Semana 8-9
│
├── FASE 2: EMBEDDINGS ────────────────────────────► [████████████████████]
│   ├── 2.1 Embedding Service ─────────────────────► Semana 4-5
│   ├── 2.2 Vector Store ──────────────────────────► Semana 5-6
│   ├── 2.3 Semantic Search ───────────────────────► Semana 6-7
│   ├── 2.4 Pattern Migration ─────────────────────► Semana 8-10
│   └── 2.5 Testing ───────────────────────────────► Semana 10-11

Q2 2026 (Abr-Jun)
├── FASE 3: DRIFT DETECTION ───────────────────────► [████████████████████]
│   ├── 3.1 Metrics Collector ─────────────────────► Semana 1-2
│   ├── 3.2 Statistical Tests ─────────────────────► Semana 2-3
│   ├── 3.3 Alerting ──────────────────────────────► Semana 3-4
│   ├── 3.4 Dashboard ─────────────────────────────► Semana 4-6
│   └── 3.5 Testing ───────────────────────────────► Semana 6-7
│
├── FASE 4: FEATURE STORE ─────────────────────────► [████████████████████]
│   ├── 4.1 Schema Design ─────────────────────────► Semana 7-8
│   ├── 4.2 Feature Computation ───────────────────► Semana 8-9
│   ├── 4.3 Versioning ────────────────────────────► Semana 9-10
│   ├── 4.4 Serving ───────────────────────────────► Semana 10-11
│   └── 4.5 Testing ───────────────────────────────► Semana 11-12

Q3-Q4 2026 (Jul-Dic)
├── FASE 5: FINE-TUNING ───────────────────────────► [████████████████████]
│   └── (Detalles en documentación de fase)
│
└── FASE 6: XAI ───────────────────────────────────► [████████████████████]
    └── (Detalles en documentación de fase)
```

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs por Fase

| Fase | Métrica Principal | Target | Baseline |
|------|-------------------|--------|----------|
| RLHF | % respuestas con feedback | >30% | 0% |
| RLHF | Satisfacción promedio | >4.2/5 | N/A |
| Embeddings | Precisión detección patrones | >90% | ~70% |
| Embeddings | Latencia búsqueda semántica | <100ms | N/A |
| Drift | Detección de drift | <24hrs | N/A |
| Drift | Falsos positivos | <5% | N/A |
| Feature Store | Consistencia train/serve | 100% | N/A |
| Fine-tuning | Accuracy clasificador | >95% | N/A |
| XAI | Explicaciones disponibles | 100% | 0% |

---

## 🔧 REQUISITOS TÉCNICOS

### Infraestructura Requerida

```yaml
Servicios Existentes (mantener):
  - Supabase PostgreSQL
  - Vercel Serverless
  - OpenAI GPT-5
  - Google Gemini 3.0

Servicios Nuevos (agregar):
  - Supabase pgvector (extensión)
  - OpenAI Embeddings API
  - Redis (opcional, para caché)
  - Monitoring: Sentry + Custom Dashboard

Estimación de Costos Adicionales:
  - Embeddings API: ~$50-100/mes
  - pgvector storage: Incluido en Supabase Pro
  - Redis (si se usa): ~$25/mes
  - Total estimado: ~$75-150/mes adicionales
```

### Dependencias de Código

```json
{
  "nuevas_dependencias": {
    "@langchain/community": "^0.3.x",
    "pgvector": "^0.2.x",
    "openai": "^4.x (ya existe, actualizar)"
  },
  "dependencias_opcionales": {
    "ioredis": "^5.x",
    "jstat": "^1.x (estadísticas)"
  }
}
```

---

## 📁 ESTRUCTURA DE ARCHIVOS TARGET

```
src/features/ai/
├── services/
│   ├── message-learning.service.ts      # Existente (modificar)
│   ├── business-insights.service.ts     # Existente (modificar)
│   ├── rlhf/
│   │   ├── feedback-capture.service.ts  # NUEVO
│   │   ├── feedback-aggregator.service.ts # NUEVO
│   │   └── prompt-optimizer.service.ts  # NUEVO
│   ├── embeddings/
│   │   ├── embedding.service.ts         # NUEVO
│   │   ├── vector-store.service.ts      # NUEVO
│   │   └── semantic-search.service.ts   # NUEVO
│   ├── drift/
│   │   ├── metrics-collector.service.ts # NUEVO
│   │   ├── drift-detector.service.ts    # NUEVO
│   │   └── drift-alerter.service.ts     # NUEVO
│   ├── feature-store/
│   │   ├── feature-compute.service.ts   # NUEVO
│   │   ├── feature-serve.service.ts     # NUEVO
│   │   └── feature-version.service.ts   # NUEVO
│   └── xai/
│       ├── decision-logger.service.ts   # NUEVO
│       └── evidence-extractor.service.ts # NUEVO
├── types/
│   ├── rlhf.types.ts                    # NUEVO
│   ├── embeddings.types.ts              # NUEVO
│   ├── drift.types.ts                   # NUEVO
│   └── feature-store.types.ts           # NUEVO
└── utils/
    ├── statistics.ts                    # NUEVO
    └── vector-utils.ts                  # NUEVO

supabase/migrations/
├── 200_AI_LEARNING_RLHF.sql             # NUEVO
├── 201_AI_LEARNING_EMBEDDINGS.sql       # NUEVO
├── 202_AI_LEARNING_DRIFT.sql            # NUEVO
├── 203_AI_LEARNING_FEATURE_STORE.sql    # NUEVO
└── 204_AI_LEARNING_XAI.sql              # NUEVO
```

---

## ✅ CHECKLIST DE PRE-REQUISITOS

Antes de comenzar la implementación, verificar:

- [ ] Supabase Pro plan activo (para pgvector)
- [ ] OpenAI API key con acceso a embeddings
- [ ] Gemini API key configurada
- [ ] Vercel Pro plan (para cron jobs extendidos)
- [ ] Backup de base de datos actual
- [ ] Ambiente de staging configurado
- [ ] Tests actuales pasando

---

## 📞 CONTACTOS Y RESPONSABLES

| Rol | Responsable | Contacto |
|-----|-------------|----------|
| Tech Lead | TBD | - |
| Backend Lead | TBD | - |
| Frontend Lead | TBD | - |
| QA Lead | TBD | - |
| Product Owner | TBD | - |

---

## 📝 CONTROL DE VERSIONES DE DOCUMENTACIÓN

| Versión | Fecha | Cambios | Autor |
|---------|-------|---------|-------|
| 1.0.0 | 2026-01-23 | Creación inicial | Claude |
| - | - | - | - |

---

**Siguiente documento:** [01-VISION-ARQUITECTURA.md](./01-VISION-ARQUITECTURA.md)
