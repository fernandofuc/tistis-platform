# 11. Plan de Implementacion Voice Agent v2.0

## Tabla de Contenidos

1. [Vision General](#1-vision-general)
2. [Sprint 1: Fundamentos](#2-sprint-1-fundamentos)
3. [Sprint 2: Integracion VAPI](#3-sprint-2-integracion-vapi)
4. [Sprint 3: UX y Testing](#4-sprint-3-ux-y-testing)
5. [Sprint 4: Produccion](#5-sprint-4-produccion)
6. [Dependencias y Riesgos](#6-dependencias-y-riesgos)

---

## 1. Vision General

### 1.1 Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    TIMELINE DE IMPLEMENTACION                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Semana 1-2          Semana 3-4         Semana 5-6    Semana 7-8│
│  ┌─────────┐        ┌─────────┐        ┌─────────┐   ┌─────────┐│
│  │ SPRINT  │        │ SPRINT  │        │ SPRINT  │   │ SPRINT  ││
│  │    1    │───────▶│    2    │───────▶│    3    │──▶│    4    ││
│  │Fundament│        │  VAPI   │        │ UX/Test │   │  Prod   ││
│  └─────────┘        └─────────┘        └─────────┘   └─────────┘│
│                                                                 │
│  Entregables:       Entregables:       Entregables:  Entregables│
│  - DB Schema        - Webhooks         - Wizard UI   - Migracion│
│  - Security Gate    - LangGraph        - Testing     - Rollout  │
│  - Circuit Breaker  - Tool System      - Dashboard   - Monitor  │
│  - Types System     - RAG Voice        - Simulator   - Docs     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Equipo Requerido

| Rol | Dedicacion | Responsabilidades |
|-----|------------|-------------------|
| Tech Lead | 100% | Arquitectura, Code Review, Integraciones |
| Backend Dev | 100% | APIs, LangGraph, Webhooks |
| Frontend Dev | 75% | UI Wizard, Dashboard, Componentes |
| QA Engineer | 50% | Testing, Validacion, Documentacion |

---

## 2. Sprint 1: Fundamentos (Semanas 1-2)

### 2.1 Objetivos del Sprint

- Establecer nueva estructura de base de datos
- Implementar Security Gate completo
- Implementar Circuit Breaker
- Crear sistema de tipos de asistente

### 2.2 Tareas Detalladas

#### Semana 1

**Dia 1-2: Base de Datos**

```
TAREA 1.1: Crear nuevas tablas
├── Archivo: supabase/migrations/20240115_voice_agent_v2.sql
├── Tablas:
│   ├── voice_assistant_types
│   ├── voice_catalog
│   ├── voice_assistant_configs
│   ├── voice_assistant_metrics
│   └── voice_circuit_breaker_state
├── Criterio de aceptacion:
│   ├── Migracion ejecuta sin errores
│   ├── RLS policies aplicadas
│   └── Seed data insertado
└── Tiempo estimado: 8 horas

TAREA 1.2: Crear funciones SQL helper
├── Archivo: supabase/migrations/20240115_voice_functions.sql
├── Funciones:
│   ├── get_voice_config_for_call()
│   ├── update_circuit_breaker_state()
│   └── aggregate_voice_metrics()
├── Criterio de aceptacion:
│   ├── Funciones retornan datos correctos
│   └── Performance < 50ms
└── Tiempo estimado: 4 horas
```

**Dia 3-4: Security Gate**

```
TAREA 1.3: Implementar WebhookSecurityGate
├── Archivo: lib/voice-agent/security/webhook-security-gate.ts
├── Componentes:
│   ├── IPWhitelist class
│   ├── RateLimiter class
│   ├── HMAC validation
│   ├── Timestamp validation
│   └── Content validation
├── Criterio de aceptacion:
│   ├── Bloquea IPs no autorizadas
│   ├── Valida HMAC correctamente
│   ├── Rate limit funcional
│   └── Logs de seguridad
└── Tiempo estimado: 12 horas

TAREA 1.4: Tests de Security Gate
├── Archivo: __tests__/voice-agent/security-gate.test.ts
├── Tests:
│   ├── IP whitelist tests
│   ├── HMAC validation tests
│   ├── Rate limiting tests
│   └── Integration tests
├── Criterio de aceptacion:
│   ├── Coverage > 90%
│   └── Todos los tests pasan
└── Tiempo estimado: 6 horas
```

**Dia 5: Circuit Breaker**

```
TAREA 1.5: Implementar VoiceCircuitBreaker
├── Archivo: lib/voice-agent/resilience/circuit-breaker.ts
├── Componentes:
│   ├── CircuitBreaker class
│   ├── SupabaseCircuitBreakerStore
│   ├── State management (CLOSED/OPEN/HALF_OPEN)
│   └── Fallback responses
├── Criterio de aceptacion:
│   ├── Abre despues de 5 fallos
│   ├── Half-open despues de 30s
│   ├── Persiste estado en Supabase
│   └── Fallback responses funcionan
└── Tiempo estimado: 8 horas
```

#### Semana 2

**Dia 1-2: Sistema de Tipos**

```
TAREA 1.6: Crear TypeScript types
├── Archivo: lib/voice-agent/types/index.ts
├── Types:
│   ├── VoiceAssistantType
│   ├── VoiceAssistantConfig
│   ├── VoiceCall
│   ├── VoiceMetrics
│   ├── VoiceWebhookPayload
│   └── ToolDefinition
├── Criterio de aceptacion:
│   ├── Types completos y documentados
│   └── Exportados correctamente
└── Tiempo estimado: 4 horas

TAREA 1.7: Implementar AssistantTypeManager
├── Archivo: lib/voice-agent/types/assistant-type-manager.ts
├── Metodos:
│   ├── getAvailableTypes()
│   ├── getTypeById()
│   ├── getCapabilitiesForType()
│   ├── getToolsForType()
│   └── validateTypeConfig()
├── Criterio de aceptacion:
│   ├── Retorna tipos correctamente
│   └── Validacion funciona
└── Tiempo estimado: 6 horas
```

**Dia 3-4: Template Engine**

```
TAREA 1.8: Implementar PromptTemplateEngine
├── Archivo: lib/voice-agent/prompts/template-engine.ts
├── Componentes:
│   ├── Handlebars setup
│   ├── Template loading
│   ├── Helper registration
│   └── Render method
├── Criterio de aceptacion:
│   ├── Carga templates correctamente
│   ├── Helpers funcionan
│   └── Renderiza sin errores
└── Tiempo estimado: 8 horas

TAREA 1.9: Crear templates base
├── Archivos:
│   ├── templates/restaurant/rest_basic_v1.hbs
│   ├── templates/restaurant/rest_standard_v1.hbs
│   ├── templates/dental/dental_basic_v1.hbs
│   └── templates/dental/dental_standard_v1.hbs
├── Criterio de aceptacion:
│   ├── Templates siguen estructura
│   └── Renderizan correctamente
└── Tiempo estimado: 8 horas
```

**Dia 5: Integracion y Review**

```
TAREA 1.10: Integracion Sprint 1
├── Actividades:
│   ├── Code review completo
│   ├── Merge a develop
│   ├── Verificar migraciones
│   └── Documentar APIs
├── Criterio de aceptacion:
│   ├── Todo el codigo merged
│   ├── CI/CD pasa
│   └── Documentacion actualizada
└── Tiempo estimado: 8 horas
```

### 2.3 Entregables Sprint 1

| Entregable | Descripcion | Verificacion |
|------------|-------------|--------------|
| DB Schema v2 | Nuevas tablas y funciones | Migration exitosa |
| Security Gate | Validacion de webhooks | Tests pasan |
| Circuit Breaker | Resiliencia LangGraph | Tests pasan |
| Type System | Types y manager | Compilacion OK |
| Template Engine | Motor de prompts | Renderizado OK |

---

## 3. Sprint 2: Integracion VAPI (Semanas 3-4)

### 3.1 Objetivos del Sprint

- Implementar webhook handlers completos
- Integrar LangGraph con VAPI
- Crear sistema de Tool Calling unificado
- Implementar VoiceRAG

### 3.2 Tareas Detalladas

#### Semana 3

**Dia 1-2: Webhook Infrastructure**

```
TAREA 2.1: Crear endpoint de webhook
├── Archivo: app/api/voice-agent/webhook/route.ts
├── Componentes:
│   ├── POST handler
│   ├── Security Gate integration
│   ├── Event router
│   └── Error handling
├── Criterio de aceptacion:
│   ├── Acepta webhooks de VAPI
│   ├── Rechaza requests invalidos
│   └── Logs completos
└── Tiempo estimado: 8 horas

TAREA 2.2: Implementar event handlers
├── Archivo: lib/voice-agent/webhooks/handlers/
├── Handlers:
│   ├── assistant-request.handler.ts
│   ├── function-call.handler.ts
│   ├── end-of-call.handler.ts
│   ├── transcript.handler.ts
│   └── status-update.handler.ts
├── Criterio de aceptacion:
│   ├── Cada handler procesa su evento
│   └── Retorna respuesta VAPI-compatible
└── Tiempo estimado: 12 horas
```

**Dia 3-4: LangGraph Integration**

```
TAREA 2.3: Crear VoiceAgentGraph
├── Archivo: lib/voice-agent/langgraph/voice-agent-graph.ts
├── Nodos:
│   ├── router_node
│   ├── rag_node
│   ├── tool_executor_node
│   ├── confirmation_node
│   └── response_generator_node
├── Criterio de aceptacion:
│   ├── Graph ejecuta correctamente
│   ├── Transiciones funcionan
│   └── State se mantiene
└── Tiempo estimado: 16 horas

TAREA 2.4: Implementar nodos individuales
├── Archivos:
│   ├── lib/voice-agent/langgraph/nodes/router.ts
│   ├── lib/voice-agent/langgraph/nodes/rag.ts
│   ├── lib/voice-agent/langgraph/nodes/tool-executor.ts
│   └── lib/voice-agent/langgraph/nodes/response-generator.ts
├── Criterio de aceptacion:
│   ├── Cada nodo tiene su logica
│   └── Tests unitarios pasan
└── Tiempo estimado: 12 horas
```

**Dia 5: Tool System**

```
TAREA 2.5: Implementar ToolRegistry
├── Archivo: lib/voice-agent/tools/registry.ts
├── Metodos:
│   ├── registerTool()
│   ├── getTool()
│   ├── getToolsForType()
│   ├── executeTool()
│   └── validateToolResult()
├── Criterio de aceptacion:
│   ├── Registro funciona
│   └── Ejecucion correcta
└── Tiempo estimado: 6 horas
```

#### Semana 4

**Dia 1-2: Tools Implementation**

```
TAREA 2.6: Implementar tools de restaurante
├── Archivos:
│   ├── lib/voice-agent/tools/restaurant/check-availability.ts
│   ├── lib/voice-agent/tools/restaurant/create-reservation.ts
│   ├── lib/voice-agent/tools/restaurant/get-menu.ts
│   └── lib/voice-agent/tools/restaurant/create-order.ts
├── Criterio de aceptacion:
│   ├── Cada tool funciona
│   ├── Confirmacion implementada
│   └── Formateo para voz
└── Tiempo estimado: 12 horas

TAREA 2.7: Implementar tools dentales
├── Archivos:
│   ├── lib/voice-agent/tools/dental/check-availability.ts
│   ├── lib/voice-agent/tools/dental/create-appointment.ts
│   ├── lib/voice-agent/tools/dental/get-services.ts
│   └── lib/voice-agent/tools/dental/transfer-to-human.ts
├── Criterio de aceptacion:
│   ├── Cada tool funciona
│   └── Integracion con DB
└── Tiempo estimado: 10 horas
```

**Dia 3-4: VoiceRAG**

```
TAREA 2.8: Implementar VoiceRAG
├── Archivo: lib/voice-agent/rag/voice-rag.ts
├── Componentes:
│   ├── Query optimization para voz
│   ├── Context retrieval
│   ├── Response formatting
│   └── Cache integration
├── Criterio de aceptacion:
│   ├── Retrieval < 200ms
│   ├── Respuestas relevantes
│   └── Cache funcional
└── Tiempo estimado: 12 horas

TAREA 2.9: Structured Data Extraction
├── Archivo: lib/voice-agent/extraction/structured-extractor.ts
├── Schemas:
│   ├── Reservation schema
│   ├── Order schema
│   ├── Appointment schema
│   └── Contact info schema
├── Criterio de aceptacion:
│   ├── Extrae datos correctamente
│   └── Envia a webhooks
└── Tiempo estimado: 8 horas
```

**Dia 5: Testing e Integracion**

```
TAREA 2.10: Integration tests Sprint 2
├── Archivo: __tests__/voice-agent/integration/
├── Tests:
│   ├── full-call-flow.test.ts
│   ├── tool-execution.test.ts
│   ├── rag-integration.test.ts
│   └── error-handling.test.ts
├── Criterio de aceptacion:
│   ├── Coverage > 80%
│   └── Todos pasan
└── Tiempo estimado: 8 horas
```

### 3.3 Entregables Sprint 2

| Entregable | Descripcion | Verificacion |
|------------|-------------|--------------|
| Webhook System | Handlers completos | Tests pasan |
| LangGraph | Voice Agent Graph | Ejecucion OK |
| Tool System | 8 tools implementados | Tests pasan |
| VoiceRAG | RAG optimizado voz | Latency < 200ms |

---

## 4. Sprint 3: UX y Testing (Semanas 5-6)

### 4.1 Objetivos del Sprint

- Implementar Wizard de configuracion
- Crear Dashboard de metricas
- Implementar simulador de testing
- QA completo

### 4.2 Tareas Detalladas

#### Semana 5

**Dia 1-2: Wizard UI**

```
TAREA 3.1: Crear VoiceAgentWizard
├── Archivo: components/voice-agent/wizard/VoiceAgentWizard.tsx
├── Steps:
│   ├── StepSelectType.tsx
│   ├── StepSelectVoice.tsx
│   ├── StepCustomize.tsx
│   ├── StepTest.tsx
│   └── StepActivate.tsx
├── Criterio de aceptacion:
│   ├── Navegacion fluida
│   ├── Validacion por paso
│   └── Persistencia de datos
└── Tiempo estimado: 16 horas

TAREA 3.2: Implementar selector de voz
├── Archivo: components/voice-agent/wizard/steps/StepSelectVoice.tsx
├── Features:
│   ├── Lista de voces
│   ├── Preview de audio
│   ├── Control de velocidad
│   └── Seleccion visual
├── Criterio de aceptacion:
│   ├── Previews funcionan
│   └── UX intuitiva
└── Tiempo estimado: 8 horas
```

**Dia 3-4: Simulador**

```
TAREA 3.3: Crear CallSimulator
├── Archivo: components/voice-agent/testing/CallSimulator.tsx
├── Features:
│   ├── UI de telefono
│   ├── Mensajes en tiempo real
│   ├── Escenarios de prueba
│   └── Metricas de llamada
├── Criterio de aceptacion:
│   ├── Simula llamadas
│   ├── Muestra latencias
│   └── Escenarios funcionan
└── Tiempo estimado: 12 horas

TAREA 3.4: Implementar ValidationChecklist
├── Archivo: components/voice-agent/testing/ValidationChecklist.tsx
├── Validaciones:
│   ├── Prompt valido
│   ├── Voz configurada
│   ├── Datos de negocio
│   ├── Tools activos
│   └── Latencia aceptable
├── Criterio de aceptacion:
│   ├── Validaciones ejecutan
│   └── Feedback claro
└── Tiempo estimado: 6 horas
```

**Dia 5: Dashboard**

```
TAREA 3.5: Crear MetricsDashboard
├── Archivo: components/voice-agent/dashboard/MetricsDashboard.tsx
├── Componentes:
│   ├── Summary cards
│   ├── Calls chart
│   ├── Latency chart
│   ├── Outcomes chart
│   └── Recent calls table
├── Criterio de aceptacion:
│   ├── Datos en tiempo real
│   ├── Charts interactivos
│   └── Filtros funcionan
└── Tiempo estimado: 10 horas
```

#### Semana 6

**Dia 1-2: APIs de Gestion**

```
TAREA 3.6: API de configuracion
├── Archivos:
│   ├── app/api/voice-agent/config/route.ts
│   ├── app/api/voice-agent/config/[id]/route.ts
│   └── app/api/voice-agent/types/route.ts
├── Endpoints:
│   ├── GET /config - Lista configs
│   ├── POST /config - Crear config
│   ├── PUT /config/[id] - Actualizar
│   └── GET /types - Lista tipos
├── Criterio de aceptacion:
│   ├── CRUD funcional
│   └── Validacion correcta
└── Tiempo estimado: 8 horas

TAREA 3.7: API de metricas
├── Archivo: app/api/voice-agent/metrics/route.ts
├── Endpoints:
│   ├── GET /metrics - Metricas agregadas
│   ├── GET /metrics/calls - Lista llamadas
│   └── GET /metrics/realtime - Tiempo real
├── Criterio de aceptacion:
│   ├── Datos correctos
│   └── Performance OK
└── Tiempo estimado: 6 horas
```

**Dia 3-4: Testing Completo**

```
TAREA 3.8: E2E Tests
├── Archivo: __tests__/e2e/voice-agent/
├── Tests:
│   ├── wizard-flow.spec.ts
│   ├── call-simulation.spec.ts
│   ├── dashboard.spec.ts
│   └── config-management.spec.ts
├── Criterio de aceptacion:
│   ├── Flujos completos
│   └── Todos pasan
└── Tiempo estimado: 12 horas

TAREA 3.9: Performance Tests
├── Archivo: __tests__/performance/voice-agent/
├── Tests:
│   ├── webhook-latency.test.ts
│   ├── langgraph-throughput.test.ts
│   └── rag-response-time.test.ts
├── Criterio de aceptacion:
│   ├── p50 < 500ms
│   └── p95 < 800ms
└── Tiempo estimado: 8 horas
```

**Dia 5: QA y Fixes**

```
TAREA 3.10: QA Sprint 3
├── Actividades:
│   ├── Testing manual completo
│   ├── Bug fixes
│   ├── UX improvements
│   └── Documentation
├── Criterio de aceptacion:
│   ├── Sin bugs criticos
│   └── UX aprobada
└── Tiempo estimado: 8 horas
```

### 4.3 Entregables Sprint 3

| Entregable | Descripcion | Verificacion |
|------------|-------------|--------------|
| Wizard UI | Configuracion guiada | E2E tests pasan |
| Simulador | Testing de llamadas | Funcional |
| Dashboard | Metricas visuales | Datos correctos |
| APIs | Gestion completa | Tests pasan |

---

## 5. Sprint 4: Produccion (Semanas 7-8)

### 5.1 Objetivos del Sprint

- Migrar datos existentes
- Configurar monitoreo
- Rollout gradual
- Documentacion final

### 5.2 Tareas Detalladas

#### Semana 7

**Dia 1-2: Migracion**

```
TAREA 4.1: Script de migracion
├── Archivo: scripts/migrate-voice-agent-v2.ts
├── Pasos:
│   ├── Backup datos actuales
│   ├── Mapear a nuevo schema
│   ├── Validar integridad
│   └── Rollback plan
├── Criterio de aceptacion:
│   ├── Migracion reversible
│   └── Datos intactos
└── Tiempo estimado: 12 horas

TAREA 4.2: Migrar configuraciones
├── Actividades:
│   ├── Ejecutar en staging
│   ├── Verificar datos
│   ├── Ajustar mappings
│   └── Ejecutar en prod
├── Criterio de aceptacion:
│   ├── 100% configs migradas
│   └── Sin perdida de datos
└── Tiempo estimado: 8 horas
```

**Dia 3-4: Monitoreo**

```
TAREA 4.3: Setup observabilidad
├── Componentes:
│   ├── Prometheus metrics
│   ├── Grafana dashboards
│   ├── Alert rules
│   └── Log aggregation
├── Metricas:
│   ├── voice_calls_total
│   ├── voice_latency_seconds
│   ├── voice_errors_total
│   └── circuit_breaker_state
├── Criterio de aceptacion:
│   ├── Dashboards funcionan
│   └── Alertas configuradas
└── Tiempo estimado: 10 horas

TAREA 4.4: Setup alertas
├── Alertas:
│   ├── Latencia > 1s
│   ├── Error rate > 5%
│   ├── Circuit breaker open
│   └── Webhook failures
├── Criterio de aceptacion:
│   ├── Notificaciones llegan
│   └── Escalation path claro
└── Tiempo estimado: 4 horas
```

**Dia 5: Staging Deploy**

```
TAREA 4.5: Deploy a staging
├── Actividades:
│   ├── Deploy codigo
│   ├── Ejecutar migraciones
│   ├── Verificar integracion
│   └── Load testing
├── Criterio de aceptacion:
│   ├── Todo funciona
│   └── Performance OK
└── Tiempo estimado: 6 horas
```

#### Semana 8

**Dia 1-2: Rollout Gradual**

```
TAREA 4.6: Feature flags
├── Flags:
│   ├── voice_agent_v2_enabled
│   ├── voice_agent_v2_percentage
│   └── voice_agent_v2_tenants
├── Criterio de aceptacion:
│   ├── Rollout controlable
│   └── Rollback inmediato
└── Tiempo estimado: 4 horas

TAREA 4.7: Rollout 10% -> 50% -> 100%
├── Fases:
│   ├── Dia 1: 10% de tenants
│   ├── Dia 2: 50% de tenants
│   ├── Dia 3: 100% de tenants
├── Monitorear:
│   ├── Error rates
│   ├── Latencias
│   └── Feedback usuarios
├── Criterio de aceptacion:
│   ├── Sin degradacion
│   └── Metricas estables
└── Tiempo estimado: 24 horas (3 dias)
```

**Dia 3-4: Documentacion**

```
TAREA 4.8: Documentacion tecnica
├── Documentos:
│   ├── API Reference
│   ├── Architecture Guide
│   ├── Troubleshooting Guide
│   └── Runbook
├── Criterio de aceptacion:
│   ├── Completa y clara
│   └── Ejemplos incluidos
└── Tiempo estimado: 8 horas

TAREA 4.9: Documentacion usuario
├── Documentos:
│   ├── User Guide
│   ├── Quick Start
│   ├── FAQ
│   └── Video tutorials
├── Criterio de aceptacion:
│   ├── Facil de seguir
│   └── Screenshots actuales
└── Tiempo estimado: 8 horas
```

**Dia 5: Cierre**

```
TAREA 4.10: Cierre de proyecto
├── Actividades:
│   ├── Retrospectiva
│   ├── Knowledge transfer
│   ├── Cleanup codigo legacy
│   └── Celebracion
├── Criterio de aceptacion:
│   ├── Proyecto cerrado
│   └── Equipo alineado
└── Tiempo estimado: 4 horas
```

### 5.3 Entregables Sprint 4

| Entregable | Descripcion | Verificacion |
|------------|-------------|--------------|
| Migracion | Datos migrados | 100% completado |
| Monitoreo | Observabilidad | Dashboards OK |
| Rollout | 100% tenants | Sin errores |
| Docs | Completa | Review aprobado |

---

## 6. Dependencias y Riesgos

### 6.1 Dependencias Criticas

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAPA DE DEPENDENCIAS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EXTERNAS:                                                      │
│  ├── VAPI API Stability                                         │
│  ├── ElevenLabs Voice Availability                              │
│  ├── Supabase Edge Functions                                    │
│  └── LangGraph Library Updates                                  │
│                                                                 │
│  INTERNAS:                                                      │
│  ├── Sprint 1 → Sprint 2 (DB, Security, Types)                  │
│  ├── Sprint 2 → Sprint 3 (Webhooks, LangGraph)                  │
│  └── Sprint 3 → Sprint 4 (UI, Testing)                          │
│                                                                 │
│  EQUIPO:                                                        │
│  ├── Backend Dev disponible 100%                                │
│  ├── Frontend Dev disponible 75%                                │
│  └── QA disponible Sprint 3-4                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Matriz de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| VAPI API changes | Media | Alto | Versionado, abstraccion |
| Latencia alta | Media | Alto | Cache, optimizacion |
| Bugs en migracion | Baja | Alto | Backup, rollback plan |
| Scope creep | Alta | Medio | Scope fijo por sprint |
| Team availability | Media | Medio | Buffer de tiempo |

### 6.3 Plan de Contingencia

**Si Sprint se atrasa:**
1. Reducir scope no-critico
2. Extender 2-3 dias maximo
3. Mover features a siguiente sprint

**Si hay bugs criticos en prod:**
1. Feature flag OFF inmediato
2. Rollback a v1
3. Hotfix y re-deploy

**Si VAPI tiene outage:**
1. Circuit breaker activa
2. Fallback responses
3. Notificar clientes afectados

---

**Documento creado:** Enero 2024
**Ultima actualizacion:** Enero 2024
**Version:** 1.0.0
