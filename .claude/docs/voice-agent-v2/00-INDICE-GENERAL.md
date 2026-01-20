# TIS TIS PLATFORM - VOICE AGENT v2.0
# DOCUMENTACION MAESTRA COMPLETA

---

## INDICE GENERAL DE DOCUMENTACION

**Fecha de Creacion:** 2026-01-19
**Version:** 2.0.0
**Estado:** Propuesta Aprobada - Pendiente Implementacion
**Autor:** Claude AI Assistant

---

## ESTRUCTURA DE DOCUMENTOS

```
voice-agent-v2/
|
+-- 00-INDICE-GENERAL.md              <- ESTE DOCUMENTO
|
+-- SECCION I: CONTEXTO Y ANALISIS
|   +-- 01-RESUMEN-EJECUTIVO.md       <- Vision general y decisiones clave
|   +-- 02-ANALISIS-ESTADO-ACTUAL.md  <- Arquitectura actual detallada
|   +-- 03-INVESTIGACION-INDUSTRIA.md <- Best practices y estandares
|
+-- SECCION II: ARQUITECTURA
|   +-- 04-ARQUITECTURA-PROPUESTA.md  <- Arquitectura v2.0 completa
|   +-- 05-MODELO-DATOS.md            <- Esquema de base de datos
|   +-- 06-SEGURIDAD-RESILIENCIA.md   <- Security Gate y Circuit Breaker
|
+-- SECCION III: FUNCIONALIDADES
|   +-- 07-TIPOS-ASISTENTE.md         <- Tipos por vertical
|   +-- 08-TOOL-CALLING.md            <- Sistema unificado de herramientas
|   +-- 09-PROMPTS-TEMPLATES.md       <- Plantillas de prompts
|   +-- 10-UX-COMPONENTES.md          <- Interfaz de usuario
|
+-- SECCION IV: IMPLEMENTACION
|   +-- 11-PLAN-IMPLEMENTACION.md     <- Sprints y tareas detalladas
|   +-- 12-TESTING-QA.md              <- Estrategia de pruebas
|   +-- 13-MIGRACION-ROLLOUT.md       <- Plan de migracion y despliegue
```

---

## RESUMEN DE CONTENIDO POR DOCUMENTO

### SECCION I: CONTEXTO Y ANALISIS

#### 01-RESUMEN-EJECUTIVO.md
- Vision general del proyecto Voice Agent v2.0
- Objetivos principales y KPIs
- Decisiones arquitectonicas clave
- Comparativa Before/After
- Riesgos identificados y mitigaciones
- Timeline de alto nivel

#### 02-ANALISIS-ESTADO-ACTUAL.md
- Estructura completa del voice-agent actual
- Flujo de llamadas entrantes paso a paso
- Analisis de webhook handler
- Integracion con LangGraph actual
- Modelo de datos existente (tablas)
- 15+ problemas identificados con severidad
- Gaps vs requerimientos de PDFs
- Gaps vs estandares de industria

#### 03-INVESTIGACION-INDUSTRIA.md
- Mejores practicas VAPI (Server-Side Response Mode)
- Optimizacion de latencia (target p50 < 500ms)
- VoiceRAG patterns
- VAPI Squads para multi-asistente
- Structured Data Extraction
- Seguridad de webhooks (HMAC, IP whitelist)
- Multi-tenant phone provisioning
- Dynamic prompt generation
- Fuentes y referencias

---

### SECCION II: ARQUITECTURA

#### 04-ARQUITECTURA-PROPUESTA.md
- Principios fundamentales de diseno
- Diagrama de arquitectura completo
- Voice Orchestration Layer
- Webhook Handler v2.0
- Unified AI Brain (LangGraph)
- Integracion con RAG existente
- Flujo detallado de llamada
- Configuracion VAPI Server-Side Mode

#### 05-MODELO-DATOS.md
- Nuevas tablas (voice_assistant_types, voice_catalog, etc.)
- Modificaciones a tablas existentes
- Indices optimizados
- RLS Policies
- Funciones SQL helpers
- Seed data completo
- Scripts de migracion

#### 06-SEGURIDAD-RESILIENCIA.md
- WebhookSecurityGate completo
- Validacion de IP (whitelist VAPI)
- Validacion de firma (HMAC-SHA256)
- Validacion de timestamp (anti-replay)
- Rate limiting por tenant
- VoiceCircuitBreaker completo
- Estados: CLOSED, OPEN, HALF_OPEN
- Fallback responses por idioma
- Persistencia de estado en Supabase

---

### SECCION III: FUNCIONALIDADES

#### 07-TIPOS-ASISTENTE.md
- Matriz de tipos por vertical
- Restaurant: Basico, Estandar, Completo
- Dental: Basico, Estandar, Completo
- Capacidades por tipo
- Configuracion de cada tipo
- Structured data schemas por tipo
- Flujos de conversacion por tipo

#### 08-TOOL-CALLING.md
- Sistema unificado Voice + Chat
- Catalogo completo de tools
- check_availability
- create_reservation
- get_business_hours
- get_menu (solo restaurant_complete)
- create_order (solo restaurant_complete)
- transfer_to_human
- Flujo de ejecucion con confirmacion
- Tool Registry por tipo de asistente

#### 09-PROMPTS-TEMPLATES.md
- Estructura del prompt base para voz
- Reglas criticas para voz
- Frases de transicion (filler phrases)
- Templates por vertical y tipo
- restaurant_reservations_v1
- restaurant_standard_v1
- restaurant_complete_v1
- dental_appointments_v1
- dental_standard_v1
- dental_complete_v1
- Variantes de personalidad
- Inyeccion de contexto dinamico

#### 10-UX-COMPONENTES.md
- Wizard de configuracion simplificado
- Paso 1: Seleccion de tipo
- Paso 2: Personalidad
- Paso 3: Seleccion de voz
- Paso 4: Escalacion
- Paso 5: Probar y activar
- Catalogo de voces (VoicePreviewCard)
- Testing Web (WebRTC)
- Testing Telefono
- Dashboard de metricas

---

### SECCION IV: IMPLEMENTACION

#### 11-PLAN-IMPLEMENTACION.md
- Sprint 1: Fundamentos (Semana 1-2)
  - 1.1 Modelo de datos v2.0
  - 1.2 Security Gate
  - 1.3 Circuit Breaker
  - 1.4 Logging estructurado
- Sprint 2: Tipos de Asistente (Semana 3-4)
  - 2.1 Catalogo de voces
  - 2.2 Tipos de asistente
  - 2.3 Prompt templates
  - 2.4 Tool calling unificado
- Sprint 3: UX & Testing (Semana 5-6)
  - 3.1 Wizard de configuracion
  - 3.2 Testing Web
  - 3.3 Testing Telefono
  - 3.4 Dashboard de metricas
- Sprint 4: Hardening (Semana 7-8)
  - 4.1 Load testing
  - 4.2 Migracion de datos
  - 4.3 Documentacion
  - 4.4 Rollout gradual

#### 12-TESTING-QA.md
- Estrategia de testing
- Unit tests requeridos
- Integration tests
- E2E tests con llamadas reales
- Load testing con k6
- Scripts de prueba
- Metricas de calidad
- Criterios de aceptacion

#### 13-MIGRACION-ROLLOUT.md
- Estrategia de migracion de datos
- Scripts SQL de migracion
- Validacion pre/post migracion
- Feature flags
- Plan de rollout por fases
- Fase 1: Internal testing
- Fase 2: Beta limitada
- Fase 3: Rollout general
- Fase 4: Cleanup
- Rollback plan
- Checklist de go-live

---

## CONVENCIONES DE DOCUMENTACION

### Formato de Codigo

```
- SQL: Bloques con ```sql
- TypeScript: Bloques con ```typescript
- JSON: Bloques con ```json
- Bash: Bloques con ```bash
```

### Niveles de Prioridad

```
P0 - Critico (bloqueante para MVP)
P1 - Alto (importante pero no bloqueante)
P2 - Medio (nice to have)
P3 - Bajo (futuro)
```

### Estados de Tareas

```
[ ] Pendiente
[~] En progreso
[x] Completado
[-] Cancelado/Descartado
```

### Severidad de Problemas

```
CRITICO  - Afecta funcionamiento core, debe resolverse antes de produccion
MAYOR    - Afecta UX significativamente, debe resolverse en Sprint 1-2
MENOR    - Mejora incremental, puede esperar a Sprint 3-4
```

---

## COMO USAR ESTA DOCUMENTACION

### Para Desarrolladores

1. Comenzar con **01-RESUMEN-EJECUTIVO** para entender el contexto
2. Revisar **02-ANALISIS-ESTADO-ACTUAL** para conocer que existe
3. Estudiar **04-ARQUITECTURA-PROPUESTA** para la vision completa
4. Consultar documentos especificos segun la tarea asignada
5. Seguir **11-PLAN-IMPLEMENTACION** para el orden de trabajo

### Para Product Managers

1. Leer **01-RESUMEN-EJECUTIVO** para vision y KPIs
2. Revisar **07-TIPOS-ASISTENTE** para entender funcionalidades
3. Ver **10-UX-COMPONENTES** para flujos de usuario
4. Consultar **11-PLAN-IMPLEMENTACION** para timeline

### Para QA

1. Estudiar **04-ARQUITECTURA-PROPUESTA** para entender el sistema
2. Revisar **12-TESTING-QA** para estrategia de pruebas
3. Consultar **06-SEGURIDAD-RESILIENCIA** para casos edge
4. Usar **13-MIGRACION-ROLLOUT** para plan de validacion

---

## HISTORIAL DE CAMBIOS

| Version | Fecha      | Autor    | Cambios                                    |
|---------|------------|----------|-------------------------------------------|
| 2.0.0   | 2026-01-19 | Claude   | Documentacion inicial completa            |

---

## CONTACTO Y SOPORTE

- **Repositorio:** tistis-platform
- **Documentacion Path:** .claude/docs/voice-agent-v2/
- **Issues:** GitHub Issues del proyecto

---

*Este documento es el indice maestro. Consultar los documentos individuales para detalles completos de cada seccion.*
