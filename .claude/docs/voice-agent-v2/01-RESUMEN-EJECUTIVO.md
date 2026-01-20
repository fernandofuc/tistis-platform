# VOICE AGENT v2.0 - RESUMEN EJECUTIVO

**Documento:** 01-RESUMEN-EJECUTIVO.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Propuesta Final

---

## 1. VISION GENERAL

### 1.1 Que es Voice Agent v2.0

Voice Agent v2.0 es una reingenieria completa del sistema de agente de voz de TIS TIS Platform. El objetivo es transformar el sistema actual (funcional pero fragil) en una solucion de grado empresarial que cumpla con los mas altos estandares de la industria de Voice AI.

### 1.2 Problema que Resuelve

**Situacion Actual:**
- El cliente debe entender conceptos tecnicos (VAPI, proveedores de voz)
- Solo existe un tipo generico de asistente para todos los casos
- Sin circuit breaker - fallas en LangGraph causan llamadas colgadas
- Seguridad de webhooks incompleta
- Tool calling solo detecta intenciones, no ejecuta acciones
- Sin testing integrado en la plataforma

**Situacion Deseada:**
- El cliente configura su asistente sin ver tecnologia subyacente
- Tipos especializados por vertical y necesidad de negocio
- Sistema resiliente con fallbacks automaticos
- Seguridad empresarial (HMAC, IP whitelist, rate limiting)
- Tool calling real con confirmacion antes de ejecutar
- Testing web y telefonico integrado

### 1.3 Alcance del Proyecto

```
INCLUIDO EN v2.0:
[x] Abstraccion completa de VAPI/Deepgram/ElevenLabs
[x] 3 tipos de asistente por vertical (6 total)
[x] Security Gate con 5 capas de validacion
[x] Circuit Breaker con fallback automatico
[x] Tool calling unificado Voice + Chat
[x] Catalogo de voces pre-configurado
[x] Testing Web (WebRTC) y Telefono
[x] Dashboard basico de metricas
[x] Logging estructurado

NO INCLUIDO EN v2.0 (Futuro):
[ ] IVR Menu con DTMF
[ ] Multi-idioma (solo ES en v2.0)
[ ] Voicemail-to-email
[ ] CRM integrations (HubSpot, Salesforce)
[ ] Real-time sentiment analysis
[ ] A/B testing de prompts
```

---

## 2. OBJETIVOS Y KPIs

### 2.1 Objetivos de Negocio

| Objetivo | Metrica | Target |
|----------|---------|--------|
| Reducir tiempo de configuracion | Tiempo wizard completo | < 5 minutos |
| Aumentar adoption rate | Tenants con voice activo | +40% en 3 meses |
| Reducir support tickets | Tickets relacionados a voice | -60% |
| Mejorar satisfaccion | NPS de llamadas | > 40 |

### 2.2 Objetivos Tecnicos

| Objetivo | Metrica | Target |
|----------|---------|--------|
| Latencia de respuesta | p50 | < 500ms |
| Latencia de respuesta | p95 | < 800ms |
| Disponibilidad | Uptime | 99.9% |
| Tasa de exito | Llamadas completadas sin error | > 98% |
| Fallback rate | Uso de respuesta de fallback | < 2% |

### 2.3 Criterios de Exito

**MVP (Sprint 4 completado):**
- [ ] Wizard de configuracion funcional para los 6 tipos de asistente
- [ ] Security Gate bloqueando 100% de requests invalidos
- [ ] Circuit Breaker funcionando con recovery automatico
- [ ] Al menos 10 tenants migrados sin incidentes
- [ ] Cero data loss en migracion

**Post-Launch (1 mes):**
- [ ] 50+ tenants usando Voice Agent v2.0
- [ ] < 5 bugs criticos reportados
- [ ] Metricas de latencia dentro de targets
- [ ] Documentacion de usuario completada

---

## 3. DECISIONES ARQUITECTONICAS CLAVE

### 3.1 Server-Side Response Mode (Mantener)

**Decision:** Mantener el patron Server-Side Response Mode de VAPI donde TIS TIS genera todas las respuestas.

**Justificacion:**
- Control total sobre la IA (LangGraph)
- Prompts unificados con canal de chat
- Costos de IA en nuestra infraestructura (predecibles)
- Capacidad de usar RAG propio

**Trade-off:** +100-200ms de latencia vs direct VAPI.

### 3.2 Abstraccion Total de Proveedores

**Decision:** El cliente NUNCA vera menciones a VAPI, Deepgram, ElevenLabs, Twilio.

**Justificacion:**
- UX simplificada
- Flexibilidad para cambiar proveedores sin afectar UX
- Evita confusion con terminologia tecnica

**Implementacion:**
- Catalogo de voces con nombres amigables ("Sofia", "Carlos")
- Configuracion interna de provider IDs
- Errores traducidos a lenguaje de usuario

### 3.3 Tipos de Asistente Predefinidos

**Decision:** Crear tipos de asistente predefinidos en lugar de configuracion libre.

**Justificacion:**
- Reduce complejidad de configuracion
- Garantiza prompts optimizados por caso de uso
- Previene configuraciones invalidas
- Facilita el soporte

**Tipos definidos:**
| Vertical | Basico | Estandar | Completo |
|----------|--------|----------|----------|
| Restaurant | Reservaciones | +Menu | +Pedidos |
| Dental | Citas | +Servicios | +Urgencias |

### 3.4 Circuit Breaker Obligatorio

**Decision:** Implementar circuit breaker en TODAS las llamadas a LangGraph.

**Justificacion:**
- VAPI timeout es ~10 segundos
- LangGraph puede exceder ese tiempo
- Sin circuit breaker = llamadas colgadas
- Fallback garantiza UX aceptable

**Configuracion:**
- Timeout: 8 segundos (antes del timeout de VAPI)
- Threshold: 5 fallas consecutivas para abrir
- Recovery: 30 segundos en estado OPEN

### 3.5 Security Gate Multi-Capa

**Decision:** Implementar 5 capas de validacion para webhooks.

**Capas:**
1. IP Whitelist (rangos de VAPI)
2. Firma HMAC-SHA256
3. Timestamp validation (anti-replay)
4. Rate limiting por tenant
5. Content-Type validation

**Justificacion:**
- Webhooks son superficie de ataque publica
- VAPI envia datos sensibles (transcripciones)
- Compliance con mejores practicas de seguridad

---

## 4. COMPARATIVA BEFORE/AFTER

### 4.1 Experiencia del Administrador

| Aspecto | BEFORE (v1) | AFTER (v2) |
|---------|-------------|------------|
| Tiempo de setup | 15-20 min | 3-5 min |
| Conocimiento requerido | Alto (VAPI, prompts) | Bajo (wizard guiado) |
| Tipos de asistente | 1 generico | 6 especializados |
| Seleccion de voz | IDs tecnicos | Preview con nombres |
| Testing | Ninguno integrado | Web + Telefono |
| Errores vistos | Tecnicos | Amigables |

### 4.2 Arquitectura Tecnica

| Aspecto | BEFORE (v1) | AFTER (v2) |
|---------|-------------|------------|
| Security | Secret basico | 5 capas de validacion |
| Resiliencia | Ninguna | Circuit Breaker |
| Tool calling | Solo intents | Ejecucion real |
| Logging | console.log | Estructurado/queryable |
| Metricas | Basicas | Dashboard completo |
| Prompts | Texto libre | Templates versionados |

### 4.3 Rendimiento

| Metrica | BEFORE (v1) | AFTER (v2) Target |
|---------|-------------|-------------------|
| Latencia p50 | ~800ms | <500ms |
| Latencia p95 | ~1500ms | <800ms |
| Tasa de error | ~5% | <2% |
| Timeout rate | ~3% | <0.5% |

---

## 5. RIESGOS Y MITIGACIONES

### 5.1 Riesgos Tecnicos

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| VAPI API changes | Media | Alto | Abstraction layer, versionar config |
| Latencia > 1s | Alta | Alto | Circuit breaker, cache de prompts |
| ElevenLabs voice IDs cambian | Baja | Medio | Catalogo con fallbacks |
| LangGraph timeout | Alta | Alto | Circuit breaker, timeout 8s |
| Webhook DDoS | Baja | Alto | Rate limiting, IP whitelist |

### 5.2 Riesgos de Proyecto

| Riesgo | Probabilidad | Impacto | Mitigacion |
|--------|--------------|---------|------------|
| Migracion data loss | Baja | Critico | Backup, dry-run, rollback plan |
| Scope creep | Media | Medio | Documentacion clara, feature freeze |
| Regresion en features existentes | Media | Alto | Test suite E2E |
| Adopcion lenta | Media | Medio | Comunicacion, training |

### 5.3 Plan de Contingencia

**Si Circuit Breaker falla en produccion:**
1. Revertir a modo directo (sin circuit breaker)
2. Aumentar timeout de LangGraph
3. Hotfix en < 4 horas

**Si migracion de datos falla:**
1. Restaurar backup inmediato
2. Voice v1 sigue funcionando
3. Analizar y reintentar en off-peak

**Si VAPI tiene outage:**
1. Fallback response automatico
2. Notificacion a tenants afectados
3. Cola de callbacks para post-recovery

---

## 6. TIMELINE DE ALTO NIVEL

```
SEMANA 1-2: SPRINT 1 - FUNDAMENTOS
|----|----|----|----|----|----|----|----|----|----|
[=========== Modelo de Datos ===========]
     [======= Security Gate =======]
          [===== Circuit Breaker =====]
               [==== Logging ====]

SEMANA 3-4: SPRINT 2 - TIPOS DE ASISTENTE
|----|----|----|----|----|----|----|----|----|----|
[======= Catalogo Voces =======]
     [========= Tipos Asistente =========]
          [======= Prompt Templates =======]
               [===== Tool Calling =====]

SEMANA 5-6: SPRINT 3 - UX & TESTING
|----|----|----|----|----|----|----|----|----|----|
[========== Wizard Config ==========]
     [======= Testing Web =======]
          [====== Testing Phone ======]
               [===== Dashboard =====]

SEMANA 7-8: SPRINT 4 - HARDENING
|----|----|----|----|----|----|----|----|----|----|
[====== Load Testing ======]
     [======== Migracion ========]
          [======= Docs =======]
               [======== Rollout ========]
```

---

## 7. EQUIPO Y RESPONSABILIDADES

### 7.1 Roles Necesarios

| Rol | Responsabilidad Principal | Sprints |
|-----|--------------------------|---------|
| Backend Dev | Security Gate, Circuit Breaker, APIs | 1, 2, 4 |
| Backend Dev | Modelo datos, Tool calling, LangGraph | 1, 2 |
| Frontend Dev | Wizard, Testing UI, Dashboard | 2, 3 |
| QA Engineer | Test suite, Load testing | 3, 4 |
| DevOps | Logging, Monitoring, Deploy | 1, 4 |

### 7.2 Estimacion de Esfuerzo

| Sprint | Esfuerzo Backend | Esfuerzo Frontend | Esfuerzo QA |
|--------|-----------------|-------------------|-------------|
| Sprint 1 | 80 hrs | 0 hrs | 8 hrs |
| Sprint 2 | 60 hrs | 40 hrs | 16 hrs |
| Sprint 3 | 20 hrs | 60 hrs | 24 hrs |
| Sprint 4 | 40 hrs | 20 hrs | 40 hrs |
| **Total** | **200 hrs** | **120 hrs** | **88 hrs** |

---

## 8. DEPENDENCIAS EXTERNAS

### 8.1 Servicios de Terceros

| Servicio | Uso | Criticidad | Fallback |
|----------|-----|------------|----------|
| VAPI | Telefonia, STT/TTS orchestration | Critica | Mensaje de error amigable |
| Deepgram | Speech-to-Text | Critica | Via VAPI |
| ElevenLabs | Text-to-Speech | Critica | Via VAPI |
| Twilio | Phone numbers (via VAPI) | Critica | Via VAPI |
| OpenAI/Anthropic | LLM para LangGraph | Critica | Fallback response |

### 8.2 Dependencias Internas

| Componente | Dependencia | Estado |
|------------|-------------|--------|
| Voice Agent v2 | LangGraph Tool Calling V7 | Existente |
| Voice Agent v2 | RAG / Knowledge Base | Existente |
| Voice Agent v2 | Supabase Auth + RLS | Existente |
| Voice Agent v2 | Tenant multi-vertical | Existente |

---

## 9. APROBACIONES REQUERIDAS

### 9.1 Antes de Iniciar Implementacion

- [ ] Revision de arquitectura por Tech Lead
- [ ] Aprobacion de presupuesto (costos VAPI)
- [ ] Aprobacion de timeline por Product

### 9.2 Antes de Ir a Produccion

- [ ] Code review completo de Security Gate
- [ ] Load test exitoso (100 calls/min)
- [ ] Dry-run de migracion exitoso
- [ ] Sign-off de QA
- [ ] Comunicacion a tenants preparada

---

## 10. SIGUIENTE PASO

1. **Leer este documento completo**
2. **Revisar 02-ANALISIS-ESTADO-ACTUAL.md** para entender el punto de partida
3. **Estudiar 04-ARQUITECTURA-PROPUESTA.md** para la vision completa
4. **Comenzar con 11-PLAN-IMPLEMENTACION.md** Sprint 1

---

*Documento preparado como parte de la propuesta Voice Agent v2.0 para TIS TIS Platform.*
