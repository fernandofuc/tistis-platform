# Índice de Documentación - TIS TIS Platform

**Última actualización:** 10 de Diciembre, 2024
**Versión:** 2.2.0

Este documento centraliza toda la documentación del proyecto para facilitar su navegación.

---

## Documentación Principal

### Archivos Raíz

| Archivo | Descripción | Última Actualización |
|---------|-------------|----------------------|
| **README.md** | Overview del proyecto, Quick Start, Tech Stack | 10 Dic 2024 |
| **CHANGELOG.md** | Historial completo de cambios por versión | 10 Dic 2024 |
| **STATUS_PROYECTO.md** | Estado detallado del desarrollo | 10 Dic 2024 |
| **MIGRATION_011_SUMMARY.md** | Resumen ejecutivo de migración crítica | 10 Dic 2024 |
| **DOCUMENTATION_INDEX.md** | Este archivo - Índice de toda la documentación | 10 Dic 2024 |

---

## Documentación de Base de Datos

### Migraciones SQL

**Ubicación:** `/supabase/migrations/`

| Archivo | Descripción | Fecha |
|---------|-------------|-------|
| **MIGRATION_NOTES.md** | Guía completa de migración 011 con instrucciones | 10 Dic 2024 |
| **001_initial_schema.sql** | Schema base + discovery sessions | Oct 2024 |
| **002_add_session_token.sql** | Token de sesión para onboarding | Oct 2024 |
| **003_esva_schema_v2.sql** | Schema multi-tenant completo | Nov 2024 |
| **004_esva_seed_data.sql** | Datos de ESVA (tenant inicial) | Nov 2024 |
| **005_patients_module.sql** | Módulo de pacientes | Nov 2024 |
| **006_quotes_module.sql** | Módulo de cotizaciones | Nov 2024 |
| **007_files_storage_setup.sql** | Storage buckets configurados | Nov 2024 |
| **008_notifications_module.sql** | Sistema de notificaciones | Nov 2024 |
| **009_critical_fixes.sql** | Fixes de seguridad y performance | Dic 2024 |
| **010_assembly_engine.sql** | Motor de ensamblaje de propuestas | Dic 2024 |
| **011_master_correction.sql** | Corrección master crítica (NUEVO) | 10 Dic 2024 |

### Schema Reference

**Tablas principales (20 total):**

#### Core Multi-Tenant
- `tenants` - Configuración de organizaciones
- `branches` - Sucursales/locaciones
- `user_roles` - Roles de usuario por tenant (NUEVO - 011)
- `vertical_configs` - Configuración por industria (NUEVO - 011)

#### Operaciones
- `leads` - Gestión de prospectos
- `appointments` - Sistema de citas
- `patients` - Datos de pacientes
- `clinical_history` - Historiales clínicos
- `quotes` - Cotizaciones
- `quote_items` - Items de cotización
- `quote_payment_plans` - Planes de pago

#### Comunicaciones
- `conversations` - Conversaciones WhatsApp
- `messages` - Mensajes individuales
- `notifications` - Notificaciones del sistema
- `notification_preferences` - Preferencias de notificaciones

#### Configuración
- `staff` - Personal del tenant
- `services` - Catálogo de servicios
- `faqs` - Base de conocimiento
- `plans` - Planes de suscripción (ACTUALIZADO - 011)
- `addons` - Add-ons disponibles (ACTUALIZADO - 011)
- `patient_files` - Metadata de archivos

**Views (4 total):**
- `quotes_full` - Cotizaciones con joins (CORREGIDO - 011)
- `staff_members` - Alias de staff (NUEVO - 011)
- (2 views adicionales - ver migraciones)

**Funciones (11 total):**
- `get_user_tenant_id()` - Helper para obtener tenant (NUEVO - 011)
- `sync_staff_to_user_role()` - Sincronización automática (NUEVO - 011)
- `create_notification()` - Crear notificación
- `broadcast_notification()` - Enviar a múltiples usuarios
- (7 funciones adicionales - ver migraciones)

---

## Documentación de Código

### Arquitectura

**Estructura del proyecto:**
```
tistis-platform/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas de autenticación
│   ├── (dashboard)/              # Rutas del dashboard
│   ├── api/                      # API Routes
│   ├── proposal/                 # Propuesta personalizada
│   ├── checkout/                 # Checkout de pago
│   └── onboarding/               # Flujo de onboarding
│
├── src/
│   ├── features/                 # Feature-First Architecture
│   │   ├── auth/                 # Autenticación
│   │   ├── leads/                # Gestión de leads
│   │   ├── appointments/         # Sistema de citas
│   │   ├── patients/             # Gestión de pacientes
│   │   ├── conversations/        # WhatsApp Business
│   │   └── notifications/        # Sistema de notificaciones
│   │
│   └── shared/                   # Código compartido
│       ├── components/           # UI components genéricos
│       ├── hooks/                # Custom hooks
│       ├── lib/                  # Configuraciones (Supabase, etc.)
│       ├── types/                # TypeScript types
│       └── utils/                # Funciones utilitarias
│
├── supabase/
│   └── migrations/               # Migraciones SQL (11 total)
│
├── public/                       # Assets estáticos
│   └── pricing-tistis.html       # Página de pricing
│
└── docs/                         # Documentación adicional
```

### API Routes

**Ubicación:** `/app/api/`

| Endpoint | Métodos | Descripción | Auth |
|----------|---------|-------------|------|
| `/api/leads` | GET, POST | Gestión de leads | ✅ |
| `/api/leads/[id]` | GET, PATCH, DELETE | CRUD de lead específico | ✅ |
| `/api/appointments` | GET, POST | Sistema de citas | ✅ |
| `/api/appointments/[id]` | GET, PATCH, DELETE | CRUD de cita | ✅ |
| `/api/patients` | GET, POST | Gestión de pacientes | ✅ |
| `/api/patients/[id]` | GET, PATCH, DELETE | CRUD de paciente | ✅ |
| `/api/patients/[id]/clinical-history` | GET, POST | Historial clínico | ✅ |
| `/api/conversations` | GET, POST | Conversaciones WhatsApp | ✅ |
| `/api/conversations/[id]` | GET | Conversación específica | ✅ |
| `/api/conversations/[id]/messages` | POST | Enviar mensaje | ✅ |
| `/api/dashboard/stats` | GET | Estadísticas del dashboard | ✅ |
| `/api/branches` | GET | Listado de sucursales | ✅ |
| `/api/staff` | GET | Listado de personal | ✅ |
| `/api/services` | GET | Catálogo de servicios | ✅ |
| `/api/webhook` | POST | Webhook WhatsApp + n8n | ⚠️ Public |

**Total:** 19 endpoints activos

### Componentes Principales

**Dashboard Pages:**
- `/dashboard` - Overview con métricas
- `/dashboard/leads` - Gestión de leads con scoring
- `/dashboard/calendario` - Calendario de citas
- `/dashboard/inbox` - Conversaciones WhatsApp
- `/dashboard/patients` - Gestión de pacientes
- `/dashboard/analytics` - Analytics y reportes
- `/dashboard/settings` - Configuración del tenant

**Shared Components:**
- `Button` - Componente de botón genérico
- `Card` - Tarjeta de contenido
- `Modal` - Modal reutilizable
- `Table` - Tabla con sorting y filtering
- `Form` - Formularios con validación
- `DatePicker` - Selector de fechas
- `FileUpload` - Upload de archivos

---

## Documentación de Integraciones

### WhatsApp Business API

**Configuración:**
- Ver `INTEGRATION_GUIDE.md` (si existe)
- Webhook endpoint: `/api/webhook`
- Variables de entorno requeridas:
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_ACCESS_TOKEN`

### n8n Workflows

**Ubicación:** `/n8n-workflows/`

| Archivo | Descripción |
|---------|-------------|
| `ESVA_WhatsApp_Handler.json` | Handler principal de mensajes WhatsApp |
| `ESVA_Tool_Agendar_Cita.json` | Tool para agendar citas via IA |
| `ESVA_Tool_Consultar_Disponibilidad.json` | Consulta disponibilidad de horarios |
| `ESVA_Tool_Obtener_Ubicacion.json` | Envía ubicación de sucursales |
| `ESVA_Tool_Resolver_Duda.json` | Resuelve FAQs con IA |
| `ESVA_Appointment_Reminders.json` | Recordatorios automáticos de citas |
| `ESVA_Weekly_Report.json` | Reporte semanal automatizado |

**Nota:** Estos workflows son templates del vertical "dental" basados en ESVA. Se pueden clonar y adaptar para otros clientes.

### Supabase

**Configuración:**
- Proyecto ID: Ver `.env.local`
- URL: `NEXT_PUBLIC_SUPABASE_URL`
- Anon Key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Storage Buckets:**
- `patient-files` - 50MB, imágenes + documentos
- `quotes-pdf` - 10MB, solo PDFs
- `temp-uploads` - 20MB, auto-delete 24h

### Stripe

**Configuración:**
- Checkout integration en `/app/checkout/page.tsx`
- Productos configurados:
  - Starter: $3,490/mes
  - Essentials: $7,490/mes
  - Growth: $12,490/mes
  - Scale: $19,990/mes

---

## Documentación de Seguridad

### Row Level Security (RLS)

**Estado:** ✅ Completamente implementado en todas las tablas

**Políticas principales:**
- Super admin: Acceso completo multi-tenant
- Admin: Gestión de su tenant
- Usuarios regulares: Solo datos de su tenant

**Actualización crítica (Migración 011):**
- Políticas corregidas para usar `user_roles` en vez de JWT claims
- Ahora 100% funcionales y seguras

### Roles de Usuario

| Rol | Permisos | Acceso |
|-----|----------|--------|
| `super_admin` | Total | Todos los tenants |
| `admin` | Completo | Su tenant |
| `owner` | Completo | Su tenant |
| `manager` | Gestión operativa | Su tenant |
| `receptionist` | Leads, citas, pacientes | Su tenant |
| `dentist` | Pacientes, citas | Su tenant |
| `specialist` | Pacientes, citas | Su tenant |
| `assistant` | Vista limitada | Su tenant |

### Validaciones

**Backend:**
- Todas las API routes validan autenticación
- Validación de tenant en cada operación
- Formato UUID verificado
- Advisory locks en operaciones críticas

**Frontend:**
- Validación de formularios con Zod
- Sanitización de inputs
- CSRF protection (Next.js default)

---

## Documentación de Testing

### Testing Strategy

**Estado:** ⏸️ En desarrollo

**Plan:**
- Unit tests con Jest
- Integration tests con React Testing Library
- E2E tests con Playwright (planificado)

**Coverage goals:**
- Unit tests: 80%+
- Integration tests: Critical paths
- E2E tests: Main user journeys

---

## Documentación de Deploy

### Vercel (Recomendado)

**Pasos:**
```bash
npm install -g vercel
vercel
```

**Variables de entorno requeridas:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `N8N_WEBHOOK_URL`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`

### Database Migrations

**Ejecutar en Supabase Dashboard:**
1. Ir a SQL Editor
2. Ejecutar migraciones en orden (001 → 011)
3. Verificar ejecución exitosa
4. Validar datos con queries de prueba

---

## Documentación de Desarrollo

### Quick Start

```bash
# Instalación
npm install

# Configuración
cp .env.example .env.local
# Editar .env.local con credenciales

# Desarrollo
npm run dev

# Build
npm run build

# Producción
npm start
```

### Scripts Disponibles

```bash
npm run dev              # Servidor de desarrollo
npm run build            # Build para producción
npm run start            # Servidor de producción
npm run lint             # ESLint
npm run typecheck        # TypeScript check
npm run test             # Tests (cuando estén disponibles)
```

### Convenciones de Código

- **TypeScript:** Strict mode habilitado
- **Naming:** camelCase para variables, PascalCase para componentes
- **Imports:** Absolute paths (@/...) preferidos
- **Commits:** Conventional Commits

---

## Documentación Claude Code (.claude/)

**Ubicación:** `/.claude/`

### Estructura
```
.claude/
├── commands/          # Slash commands personalizados
├── agents/            # Agentes especializados
├── skills/            # Skills reutilizables
├── PRPs/              # Prompt Request Patterns
├── prompts/           # Metodologías
└── hooks/             # Logging infrastructure
```

**Nota:** Ver SaaS Factory setup para documentación completa de Claude Code.

---

## Archivos de Configuración

### TypeScript
- `tsconfig.json` - Configuración TypeScript
- Strict mode habilitado
- Absolute imports configurados

### Next.js
- `next.config.js` - Configuración Next.js
- App Router habilitado
- Optimizaciones de producción

### Tailwind CSS
- `tailwind.config.js` - Configuración de estilos
- Tema TIS TIS (gradient #667eea → #764ba2)
- Componentes personalizados

### ESLint
- `.eslintrc.json` - Reglas de linting
- TypeScript rules
- React hooks rules

---

## Recursos Externos

### Documentación Oficial
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs)

### Guías de Referencia
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Stripe Integration](https://stripe.com/docs)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

---

## Contacto y Soporte

**Para problemas técnicos:**
1. Revisar documentación relevante
2. Verificar logs de Supabase Dashboard
3. Consultar STATUS_PROYECTO.md para estado actual

**Para nuevas features:**
1. Revisar STATUS_PROYECTO.md para roadmap
2. Seguir arquitectura Feature-First
3. Actualizar documentación correspondiente

---

## Changelog de esta Documentación

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 10 Dic 2024 | Creación inicial del índice |

---

**Última actualización:** 10 de Diciembre, 2024
**Mantenido por:** Claude Code
**Versión del proyecto:** 2.2.0
