# TIS TIS Platform - ESVA Dental Clinic

Sistema completo de gestión dental con IA, WhatsApp Business API y automatización de procesos.

**Versión:** 2.1.0
**Estado:** 95% Fase 2 Completada
**Última actualización:** 8 de Diciembre, 2024

---

## 🎯 Descripción

TIS TIS Platform es una solución SaaS multi-tenant para gestión de clínicas dentales que integra:

- Gestión de leads con scoring automático
- WhatsApp Business API para comunicación
- Sistema de citas y calendario
- Historiales clínicos con odontograma
- Cotizaciones y planes de pago
- Notificaciones en tiempo real
- Integración con IA (Claude, n8n workflows)

## 🚀 Quick Start

### Prerrequisitos

- Node.js 18+
- PostgreSQL (vía Supabase)
- npm o pnpm

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd tistis-platform

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Ejecutar migraciones en Supabase
# Ver /supabase/migrations/README.md

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

```
tistis-platform/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas de autenticación
│   ├── (dashboard)/              # Rutas del dashboard
│   └── api/                      # API Routes
├── src/
│   ├── features/                 # Features por funcionalidad
│   │   ├── auth/
│   │   ├── leads/
│   │   ├── appointments/
│   │   ├── patients/
│   │   └── conversations/
│   └── shared/                   # Código compartido
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── types/
├── supabase/
│   └── migrations/               # 9 migraciones SQL
├── public/
└── docs/                         # Documentación técnica
```

## 🗄️ Base de Datos

### Schema v2.1

- **18 tablas** principales (tenants, leads, patients, quotes, etc.)
- **10 funciones** PostgreSQL optimizadas con advisory locks
- **3 views** para queries complejas
- **3 buckets** de Storage (patient-files, quotes-pdf, temp-uploads)
- **RLS policies** por rol en todas las tablas
- **20+ índices** optimizados

### Migraciones Aplicadas

1. `001_initial_schema.sql` - Schema base
2. `002_rls_policies.sql` - Row Level Security
3. `003_functions.sql` - Funciones PostgreSQL
4. `004_views.sql` - Views útiles
5. `005_patients_module.sql` - Módulo de pacientes
6. `006_quotes_module.sql` - Módulo de cotizaciones
7. `007_files_storage_setup.sql` - Storage buckets
8. `008_notifications_module.sql` - Sistema de notificaciones
9. `009_critical_fixes.sql` - **NUEVO** - 14 fixes críticos

### Migración 009: Fixes Críticos

**Seguridad:**
- Advisory locks en generación de números (prevención de race conditions)
- Validación de tenant en storage policies
- RLS policies reforzadas para notificaciones
- Constraints de integridad mejorados

**Performance:**
- Índice único para email por tenant
- Índice compuesto para notificaciones (user_id + created_at)
- Cleanup functions con límites

**Correcciones:**
- Cálculo de totales en quotes corregido
- Trigger para subtotal de items
- Validación de JSON en dental_chart
- Columna converted_at en leads

Ver detalles completos en `/supabase/migrations/009_critical_fixes.sql`

## 🔌 API Routes

### Endpoints Disponibles

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET/POST | `/api/leads` | Lista y crea leads | ✅ |
| GET/PATCH/DELETE | `/api/leads/[id]` | CRUD de lead específico | ✅ |
| GET/POST | `/api/appointments` | Gestión de citas | ✅ |
| GET/POST | `/api/patients` | Gestión de pacientes | ✅ |
| GET/PATCH/DELETE | `/api/patients/[id]` | CRUD de paciente | ✅ |
| GET/POST | `/api/conversations` | Conversaciones WhatsApp | ✅ |
| POST | `/api/webhook` | Webhook WhatsApp + n8n | ⚠️ |

Todas las rutas validan:
- Autenticación vía header `Authorization`
- Pertenencia al tenant correcto
- Formato de UUID
- Validaciones de datos específicas

## 🔐 Seguridad

### Implementado

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Validación de tenant en todas las operaciones
- ✅ Advisory locks para prevenir race conditions
- ✅ Prevención de acceso cross-tenant
- ✅ Autenticación en API routes
- ✅ Validación de permisos por rol
- ✅ Storage policies con validación de path

### Roles Disponibles

- `super_admin` - Acceso total multi-tenant
- `admin` - Gestión completa de su tenant
- `receptionist` - Gestión de leads, citas, pacientes
- `dentist` - Acceso a pacientes y citas
- `specialist` - Similar a dentist

## 🎨 Frontend

### Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- React Query
- date-fns

### Componentes Clave

- `/dashboard` - Overview con stats
- `/dashboard/leads` - Gestión de leads con scoring
- `/dashboard/calendario` - Calendario de citas
- `/dashboard/inbox` - Conversaciones WhatsApp
- `/dashboard/patients` - Gestión de pacientes
- `/dashboard/analytics` - Métricas y reportes

### Optimizaciones Implementadas

- ✅ Debounce en búsquedas (300ms)
- ✅ AbortController para cancelar requests
- ✅ Memory leaks corregidos en hooks
- ✅ Realtime subscriptions optimizadas
- ✅ Refs estables para prevenir stale closures

## 📚 Documentación

- `STATUS_PROYECTO.md` - Estado completo del proyecto
- `INTEGRATION_GUIDE.md` - Guía de integraciones (WhatsApp, n8n)
- `supabase/migrations/README.md` - Guía de migraciones
- `.claude/docs/` - Documentación técnica adicional

## 🧪 Testing

```bash
npm run test              # Ejecutar tests (pendiente)
npm run lint              # ESLint
npm run typecheck         # TypeScript check
```

## 📊 Estado del Proyecto

### Fase 2 - Core Features: 95% Completa

**Completado:**
- ✅ Módulo de pacientes (100%)
- ✅ Sistema de archivos (100%)
- ✅ Sistema de notificaciones (100%)
- ✅ Módulo de cotizaciones - DB (100%)
- ✅ Seguridad (100%)
- ✅ API Routes (100%)

**Pendiente:**
- ⏸️ Módulo de cotizaciones - API/UI
- ⏸️ Upload UI component
- ⏸️ Testing

Ver detalles completos en `STATUS_PROYECTO.md`

## 🚀 Deploy

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Variables de Entorno

Configurar en Vercel Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `N8N_WEBHOOK_URL`

## 🤝 Contribuir

Este proyecto sigue arquitectura Feature-First optimizada para desarrollo con IA.

### Guidelines

1. Una feature por carpeta en `/src/features/`
2. RLS policies obligatorias en nuevas tablas
3. Validación de tenant en todos los endpoints
4. Tests para funcionalidad crítica
5. Documentación actualizada

## 📞 Soporte

Para reportar issues o solicitar features, ver `STATUS_PROYECTO.md` para estado actual.

---

**Powered by Next.js, Supabase & Claude AI**
