# Changelog - TIS TIS Platform

Todos los cambios notables del proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
| Essentials | **5** | $1,850/mes |
| Growth | **8** | $2,450/mes |
| Scale | **15** | $2,990/mes |

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
| Scale | $5,999/mes | **$19,990/mes** | $0 (antes $5,000) |

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

**Última actualización:** 10 de Diciembre, 2024
