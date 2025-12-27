# Changelog - TIS TIS Platform

Todos los cambios notables del proyecto seran documentados en este archivo.

El formato esta basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [4.3.0] - 2024-12-27

### Resumen

**Actualizacion mayor de seguridad** con 25+ vulnerabilidades corregidas a traves de 6 auditorias
exhaustivas (#11-#16). Incluye rediseno de AI Agent Voz y optimizaciones arquitectonicas significativas.

### Seguridad (Auditorias #11-#16)

#### Prevencion de Timing Attacks
Se implemento `timingSafeEqual` de Node.js crypto para evitar ataques de timing:

| Archivo | Cambio |
|---------|--------|
| `app/api/webhook/route.ts` | Verificacion timing-safe del WhatsApp verify token |
| `app/api/email/send/route.ts` | API key verification timing-safe |
| `app/api/webhook/whatsapp/[tenantSlug]/route.ts` | Timing-safe para webhook secrets |
| `app/api/ai-config/generate-prompt/route.ts` | Timing-safe para CRON secrets |
| `app/api/voice-agent/generate-prompt/route.ts` | Timing-safe para secrets internos |

```typescript
import { timingSafeEqual } from 'crypto';

function verifyTokenTimingSafe(providedToken: string | null, expectedToken: string | undefined): boolean {
  if (!expectedToken || !providedToken) return false;
  try {
    const providedBuffer = Buffer.from(providedToken);
    const expectedBuffer = Buffer.from(expectedToken);
    if (providedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(providedBuffer, expectedBuffer);
  } catch { return false; }
}
```

#### Prevencion de IDOR (Insecure Direct Object Reference)

**NUEVO archivo:** `src/shared/lib/auth-helper.ts` - Sistema centralizado de autenticacion

```typescript
export async function getAuthenticatedContext(request: NextRequest): Promise<AuthContext | AuthError>
export function isAuthError(context: AuthContext | AuthError): context is AuthError
export function createAuthErrorResponse(error: AuthError): NextResponse
```

**Rutas migradas al nuevo patron:**
- `app/api/leads/[id]/route.ts`
- `app/api/appointments/[id]/route.ts`
- `app/api/conversations/[id]/route.ts`
- `app/api/conversations/[id]/messages/route.ts` (reescrito completamente)
- `app/api/admin/sync-tenant-metadata/route.ts`

#### Rate Limiting Expandido

**Nuevos limitadores en `src/shared/lib/rate-limit.ts`:**
- `publicAPILimiter` - 100 req/min para APIs publicas
- `webhookLimiter` - 1000 req/min para webhooks
- `aiLimiter` - 30 req/min para endpoints de IA
- `cronLimiter` - 10 req/min para jobs CRON

**Endpoints protegidos:**
- `app/api/onboarding/status/route.ts`
- `app/api/chat/discovery/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/voice-agent/preview/route.ts`
- `app/api/enterprise-contact/route.ts`
- Todos los webhooks multi-canal

#### Sanitizacion de Busquedas (Filter Injection Prevention)

```typescript
const sanitizedSearch = search.replace(/[%_*\\]/g, '\\$&');
const pattern = `*${sanitizedSearch}*`;
```

**Endpoints protegidos:**
- `app/api/leads/route.ts`
- `app/api/patients/route.ts`
- `app/api/search/route.ts`

#### Webhooks Multi-Canal Hardened

| Canal | Mejoras |
|-------|---------|
| Facebook | Validacion payload.object, X-Hub-Signature-256, background processing |
| Instagram | Validacion tipo, signature verification, rate limiting |
| TikTok | Event type validation, firma TikTok, rate limiting |
| WhatsApp | Timing-safe signatures, rate limiting por IP |

#### Headers de Seguridad (next.config.mjs)

```javascript
// Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
// Strict-Transport-Security, Referrer-Policy, Permissions-Policy
```

### UI/UX - AI Agent Voz

#### Rediseno Completo
- Cards de estadisticas con iconos y colores consistentes
- Panel de configuracion de voz con preview de ElevenLabs
- UI mejorada para gestion de numeros VAPI
- Panel de testing con logs en tiempo real
- Indicadores visuales de estado (conectado/desconectado)

### Arquitectura

#### Sistema de Autenticacion Centralizado
- Patron unificado `getAuthenticatedContext()` para todas las rutas API
- Extraccion automatica de tenantId del usuario autenticado
- Manejo consistente de errores de autenticacion

#### Rate Limiting Mejorado
- Factory function para limitadores personalizados
- Sliding window algorithm
- Respuestas con headers Retry-After

#### Nueva Migracion
- `076_voice_quotes_security.sql` - Indices y RLS actualizados

### Estadisticas de Cambios

```
68 archivos modificados
+1,910 lineas agregadas
-277 lineas eliminadas
```

**Archivos nuevos destacados:**
- `src/shared/lib/auth-helper.ts`
- `supabase/migrations/076_voice_quotes_security.sql`
- `.github/` (workflows)

### Notas de Upgrade

**Para nuevas rutas API:**
```typescript
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

export async function GET(request: NextRequest) {
  const authContext = await getAuthenticatedContext(request);
  if (isAuthError(authContext)) return createAuthErrorResponse(authContext);
  const { client: supabase, tenantId } = authContext;
  // ... logica
}
```

---

## [4.1.0] - 2024-12-21

### Anadido - Integracion LangGraph con Configuraciones del Cliente

#### Problema Resuelto
Los agentes de LangGraph no usaban las configuraciones personalizadas del cliente. Ahora los 11 agentes tienen acceso completo al contexto del negocio.

#### Contexto Disponible para Agentes

| Tipo de Datos | Descripcion |
|---------------|-------------|
| Instrucciones personalizadas | Identidad, tono, casos especiales |
| Politicas del negocio | Cancelaciones, pagos, garantias |
| Servicios y precios | Con promociones activas |
| FAQs personalizadas | Respuestas pre-configuradas |
| Knowledge Base | Documentos y conocimiento del negocio |
| Sucursales | Horarios y personal por ubicacion |
| Manejo de competencia | Respuestas ante menciones de competidores |
| Plantillas de respuesta | Templates configurados |
| Estilo de comunicacion | Configurado por tenant |

#### Archivos Modificados

- `src/features/ai/state/agent-state.ts` - BusinessContext extendido con campos de Knowledge Base
- `src/features/ai/services/langgraph-ai.service.ts` - Ahora usa el RPC `get_tenant_ai_context`
- `src/features/ai/agents/specialists/base.agent.ts` - Nueva funcion `buildFullBusinessContext()`

### Anadido - Sistema de Aprendizaje Automatico de Mensajes

#### Concepto
Sistema que analiza mensajes entrantes para extraer patrones y mejorar respuestas de IA con el tiempo.

#### Funcionalidades

- **Analisis de patrones** - Extrae patrones de mensajes entrantes
- **Vocabulario especifico** - Aprende terminos y jerga del negocio
- **Preferencias de horarios** - Detecta horarios preferidos por clientes
- **Objeciones comunes** - Identifica objeciones frecuentes
- **Insights automaticos** - Genera insights basados en datos
- **Especifico por vertical** - Dental, restaurant, medical tienen diferentes patrones

#### Disponibilidad
Solo disponible para planes **Essentials** y superiores.

#### Archivos Creados

**Migracion:**
- `supabase/migrations/065_AI_MESSAGE_LEARNING_SYSTEM.sql`

**Servicio:**
- `src/features/ai/services/message-learning.service.ts`

**Endpoint CRON:**
- `app/api/cron/process-learning/route.ts`

#### Tablas Nuevas

| Tabla | Proposito |
|-------|-----------|
| `ai_message_patterns` | Patrones extraidos de mensajes |
| `ai_learned_vocabulary` | Vocabulario especifico del negocio |
| `ai_business_insights` | Insights automaticos generados |
| `ai_learning_config` | Configuracion por tenant |
| `ai_learning_queue` | Cola de procesamiento |

---

## [4.0.0] - 2024-12-21

### Anadido - Sistema de IA Multi-Agente con LangGraph

#### Arquitectura LangGraph Multi-Agente
Se implemento un nuevo sistema de IA basado en LangGraph que reemplaza el enfoque de "cerebro unico" con un equipo de agentes especializados.

**Concepto:**
- **Antes:** Un solo servicio de IA procesaba todos los mensajes
- **Ahora:** Multiples agentes especializados trabajan en equipo con handoffs inteligentes

#### Agentes Implementados

| Agente | Archivo | Funcion |
|--------|---------|---------|
| Supervisor | `supervisor.agent.ts` | Orquestador principal, detecta intencion |
| Vertical Router | `vertical-router.agent.ts` | Enruta segun vertical del negocio |
| Greeting Agent | `greeting.agent.ts` | Saludos y bienvenidas |
| Pricing Agent | `pricing.agent.ts` | Precios y cotizaciones |
| Location Agent | `location.agent.ts` | Ubicaciones y direcciones |
| Hours Agent | `hours.agent.ts` | Horarios de atencion |
| FAQ Agent | `faq.agent.ts` | Preguntas frecuentes |
| Booking Agent | `booking.agent.ts` | Citas (+ variantes por vertical) |
| General Agent | `general.agent.ts` | Fallback general |
| Escalation Agent | `escalation.agent.ts` | Escalacion a humano |
| Urgent Care Agent | `urgent-care.agent.ts` | Emergencias y dolor |

#### Archivos Creados

**Estado del Grafo:**
- `src/features/ai/state/agent-state.ts` - Estado compartido con tipos completos
- `src/features/ai/state/index.ts` - Exports

**Agentes:**
- `src/features/ai/agents/supervisor/supervisor.agent.ts`
- `src/features/ai/agents/routing/vertical-router.agent.ts`
- `src/features/ai/agents/specialists/*.agent.ts` (9 agentes)
- `src/features/ai/agents/index.ts`

**Grafo Principal:**
- `src/features/ai/graph/tistis-graph.ts` - Grafo compilado con todos los nodos y edges
- `src/features/ai/graph/index.ts`

**Integracion:**
- `src/features/ai/services/langgraph-ai.service.ts` - Servicio que integra con el sistema existente

#### Migracion de Base de Datos

**064_LANGGRAPH_FEATURE_FLAG.sql:**
- Columna `use_langgraph` en `ai_tenant_config` (boolean, default: false)
- Columna `langgraph_config` (JSONB) para configuracion avanzada
- Indice `idx_ai_tenant_config_langgraph` para busquedas rapidas
- Funcion `tenant_uses_langgraph(tenant_id)` para verificacion

#### Feature Flag

```sql
-- Activar LangGraph para un tenant
UPDATE ai_tenant_config SET use_langgraph = true WHERE tenant_id = 'xxx';

-- Desactivar (rollback)
UPDATE ai_tenant_config SET use_langgraph = false WHERE tenant_id = 'xxx';
```

#### Beneficios

1. **Respuestas especializadas** - Cada agente es experto en su dominio
2. **Manejo de verticales** - Dental, Restaurant, Medical responden diferente
3. **Handoffs inteligentes** - Agentes pasan control entre si segun contexto
4. **Trazabilidad completa** - Log de que agente proceso cada mensaje
5. **Escalacion automatica** - Detecta cuando un humano debe intervenir
6. **Urgencias priorizadas** - Detecta dolor/emergencias automaticamente

#### Limpieza de Codigo

**Archivos Eliminados:**
- `n8n-workflows/` - Carpeta completa (reemplazado por sistema nativo)
- `tistis-platform-entrega-20251207/` - Backup obsoleto
- Documentos redundantes de entregas anteriores

### Cambiado

- Actualizacion de README.md con documentacion de LangGraph
- Actualizacion de DOCUMENTATION_INDEX.md
- Actualizacion de STATUS_PROYECTO.md a version 4.0.0

---

## [3.1.0] - 2024-12-21

### Anadido - Mejoras Completas de Produccion

- Validacion de pagos por transferencia con AI Vision
- Recordatorios automaticos de citas (1 semana, 24h, 4h)
- Configuracion de AI por canal conectado
- Rediseno de pagina Enterprise

---

## [2.3.0] - 2024-12-17

### Añadido - 6 Fixes Críticos en Stripe Webhook + Límites de Sucursales

#### Migraciones
- **048_WEBHOOK_EVENTS_IDEMPOTENCY.sql** - Sistema de idempotencia para webhooks
- **049_UPDATE_BRANCH_LIMITS.sql** - Nuevos límites de sucursales por plan

#### Límites de Sucursales Actualizados
| Plan | Sucursales | Precio Sucursal Extra |
|------|------------|----------------------|
| Starter | 1 | N/A |
| Essentials | **8** | $1,500/mes |
| Growth | **20** | $1,500/mes |

> **Nota:** El plan Scale fue descontinuado. Growth es ahora el plan de mayor capacidad.

#### Webhook Route: 6 Fixes Críticos

**FIX 1: Email Obligatorio (CRÍTICO)**
- BLOQUEA si falta email (throw error → Stripe reintenta)

**FIX 2: Cliente en handleSubscriptionCreated (Race Condition)**
- Crea cliente si no existe (fallback para race condition)

**FIX 3: STRIPE_WEBHOOK_SECRET Obligatorio**
- Retorna 500 en producción si falta

**FIX 4: Validación de Plan**
- `isValidPlan()` con fallback a 'essentials'

**FIX 5: Provisioning Bloqueante**
- Throw error si provisioning falla → Stripe reintenta

**FIX 6: Idempotencia**
- Tabla `webhook_events` previene duplicados

### Archivos Modificados
- `/app/api/stripe/webhook/route.ts` - 6 fixes
- `/supabase/migrations/048_WEBHOOK_EVENTS_IDEMPOTENCY.sql`
- `/supabase/migrations/049_UPDATE_BRANCH_LIMITS.sql`

---

## [2.2.0] - 2024-12-10

### Añadido - Migración 011_master_correction.sql

#### Base de Datos
- **Tabla `user_roles`** - Sistema multi-tenant corregido (CRÍTICO)
  - Vincula usuarios de auth.users con tenants y roles
  - Unique constraint (user_id, tenant_id)
  - 5 índices optimizados
  - RLS policies por nivel de acceso (super_admin, admin, user)
  - Trigger automático de sincronización con tabla `staff`

- **Tabla `vertical_configs`** - Configuración por tipo de negocio
  - 5 verticales pre-configurados: dental, restaurant, medical, retail, services
  - Configuración de sidebar personalizada por vertical
  - Módulos habilitados específicos por industria
  - Tablas de extensión requeridas por vertical

- **VIEW `staff_members`** - Alias de tabla `staff` para compatibilidad

- **Función `get_user_tenant_id()`** - Helper para obtener tenant del usuario

#### Seguridad (CRÍTICO)
- **RLS Policies corregidas en 7 tablas:**
  - `leads` - Ahora usa user_roles en vez de JWT claims
  - `appointments` - Ahora usa user_roles
  - `branches` - Ahora usa user_roles
  - `staff` - Ahora usa user_roles
  - `services` - Ahora usa user_roles
  - `conversations` - Ahora usa user_roles
  - `faqs` - Ahora usa user_roles
  - **ANTES:** Usaban `auth.jwt() -> 'tenant_id'` que NO EXISTE
  - **DESPUÉS:** Usan subconsulta a `user_roles` para obtener tenant_id

#### Precios Actualizados (CRÍTICO PARA NEGOCIO)

**Planes:**
| Plan | Precio Anterior | Precio Nuevo | Setup Fee |
|------|----------------|--------------|-----------|
| Starter | $799/mes | **$3,490/mes** | $0 (antes $1,500) |
| Essentials | $1,499/mes | **$7,490/mes** | $0 (antes $2,500) |
| Growth | $2,999/mes | **$12,490/mes** | $0 (antes $3,500) |

> **Nota:** El plan Scale fue descontinuado en Dic 2024.

**Addons:**
- Facturación Automática: $1,990/mes
- Cotizaciones Automáticas: $1,990/mes
- Reportes Diarios: $2,990/mes
- Marketing Personalizado: $1,490/mes
- Asistente de Voz IA: $2,290/mes
- Documentación Automática: $4,490/mes

#### Frontend
- `/app/proposal/page.tsx` - Precios actualizados
- `/app/proposal/page.tsx` - Eliminado `activation_fee` (línea 190)

### Corregido

- **VIEW `quotes_full`** - Columna `l.name` → `l.full_name`
- **Tabla `proposals`** - Default de `activation_fee` = 0
- **Sincronización automática** - Staff existente vinculado a user_roles

### Documentación
- **NUEVO:** `/supabase/migrations/MIGRATION_NOTES.md` - Guía completa de migración 011
- **ACTUALIZADO:** `README.md` - Versión 2.2.0, nueva sección de migración 011
- **ACTUALIZADO:** `STATUS_PROYECTO.md` - Estado actualizado a 98%

---

## [2.1.0] - 2024-12-08

### Añadido - Migración 009_critical_fixes.sql

#### Seguridad
- Advisory locks en funciones de generación de números
- Validación de tenant en storage policies
- RLS policies reforzadas para notificaciones
- Constraints de integridad mejorados

#### Performance
- Índice único para email por tenant
- Índice compuesto para notificaciones (user_id + created_at)
- Cleanup functions con límites (1000 archivos, 10k notificaciones)

#### Correcciones
- Cálculo de totales en quotes
- Trigger para subtotal de items
- Validación de JSON en dental_chart
- Columna `converted_at` en leads

### Añadido - Módulos Completos

#### Módulo de Pacientes (100%)
- Tabla `patients` con datos completos
- Tabla `clinical_history` con odontograma validado
- Tabla `patient_files` con metadata
- Generación automática de número (ESV-000001)
- Conversión automática desde leads
- API Routes completos
- UI Dashboard con búsqueda debounced

#### Sistema de Archivos (100%)
- 3 buckets configurados: patient-files, quotes-pdf, temp-uploads
- RLS policies por bucket con validación de tenant
- Path validation: {tenant_id}/{patient_id}/{filename}
- Función de cleanup automático

#### Sistema de Notificaciones (100%)
- Tabla `notifications` con 13 tipos
- Tabla `notification_preferences` por usuario
- Funciones create, broadcast, mark_as_read
- Hook `useNotifications` con realtime
- Prevención de memory leaks

#### Módulo de Cotizaciones - DB (100%)
- Tabla `quotes` con estados de workflow
- Tabla `quote_items` con precios y descuentos
- Tabla `quote_payment_plans` para financiamiento
- VIEW `quotes_full` con joins optimizados
- Generación automática de número (COT-000001)

---

## [2.0.0] - 2024-11-25

### Añadido - Schema Base Multi-Tenant

#### Core Tables
- `tenants` - Configuración multi-tenant
- `branches` - Multi-sucursal
- `services` - Catálogo de servicios
- `staff` - Equipo y roles
- `leads` - Gestión de prospectos con scoring
- `appointments` - Sistema de citas
- `conversations` - WhatsApp Business API
- `messages` - Mensajes de conversaciones
- `faqs` - Base de conocimiento

#### Funcionalidades
- Row Level Security (RLS) en todas las tablas
- Índices optimizados
- Triggers automáticos para updated_at
- Funciones PostgreSQL para lógica de negocio

#### Frontend
- Next.js 14 con App Router
- Dashboard completo con 7 páginas
- Feature-first architecture
- Zustand para state management
- Tailwind CSS con tema TIS TIS

#### API Routes
- 19 endpoints funcionales
- Autenticación en todas las rutas
- Validación de tenant
- Manejo de errores robusto

---

## [1.0.0] - 2024-10-15

### Añadido - Onboarding Flow

#### Discovery Sessions
- Cuestionario interactivo
- Análisis con IA (Claude)
- Generación de propuestas personalizadas
- Integración con Stripe para checkout

#### Landing Page
- Diseño responsive
- Pricing personalizado
- ROI Calculator
- Timeline de implementación

---

## Formato del Changelog

### Tipos de cambios
- **Añadido** - Para nuevas características
- **Cambiado** - Para cambios en funcionalidades existentes
- **Obsoleto** - Para características que serán eliminadas
- **Eliminado** - Para características eliminadas
- **Corregido** - Para corrección de bugs
- **Seguridad** - Para vulnerabilidades corregidas

### Esquema de Versionamiento
- **MAJOR.MINOR.PATCH** (ej: 2.2.0)
- **MAJOR** - Cambios incompatibles en la API
- **MINOR** - Nuevas funcionalidades compatibles
- **PATCH** - Correcciones de bugs compatibles

---

**Ultima actualizacion:** 27 de Diciembre, 2024
