# TIS TIS Platform

Sistema completo de gestion con IA conversacional multi-agente, WhatsApp Business API y automatizacion de procesos multi-canal.

**Version:** 4.1.0
**Estado:** Produccion - Sistema Completo con LangGraph + AI Learning
**Ultima actualizacion:** 21 de Diciembre, 2024

---

## 🎯 Descripcion

TIS TIS Platform es una solucion SaaS multi-tenant para gestion de negocios que integra:

- **Sistema de IA Multi-Agente con LangGraph** - Agentes especializados que colaboran para respuestas inteligentes
- Gestion de leads con scoring automatico basado en IA
- Sistema de mensajeria multi-canal (WhatsApp, Instagram, Facebook, TikTok)
- **Configuracion de AI por canal** - Personaliza el comportamiento del AI para cada canal
- Sistema de citas y calendario con **recordatorios automaticos** (1 semana, 24h, 4h)
- Sistema de **membresias con validacion de pagos por transferencia** (AI Vision)
- Historiales clinicos con odontograma
- Cotizaciones y planes de pago con Stripe
- Notificaciones en tiempo real
- Cola de trabajos asincronos para procesamiento de mensajes

## 🤖 Nueva Arquitectura de IA Multi-Agente (LangGraph)

### Que es LangGraph?

LangGraph es un framework para construir sistemas de IA multi-agente. En lugar de un solo "cerebro" de IA que responde todo, TIS TIS ahora tiene un **equipo de agentes especializados** que trabajan juntos:

```
                     +------------------+
                     |   SUPERVISOR     |
                     | (Detecta intent) |
                     +--------+---------+
                              |
                    +---------+---------+
                    |                   |
            +-------v-------+   +-------v-------+
            | VERTICAL      |   | ESCALATION    |
            | ROUTER        |   | (Humano)      |
            +-------+-------+   +---------------+
                    |
    +---------------+---------------+
    |       |       |       |       |
+---v---+ +-v---+ +-v---+ +-v---+ +-v---+
|GREETING| |PRICING| |BOOKING| |FAQ| |GENERAL|
+---+---+ +--+--+ +--+--+ +-+-+ +--+--+
    |        |       |       |      |
    +--------+-------+-------+------+
                     |
              +------v------+
              |  FINALIZE   |
              +-------------+
```

### Agentes Implementados

| Agente | Responsabilidad | Especialidad |
|--------|-----------------|--------------|
| **Supervisor** | Detecta intencion del mensaje y enruta | Orquestacion |
| **Vertical Router** | Enruta segun el tipo de negocio | Dental, Restaurant, Medical, etc. |
| **Greeting Agent** | Maneja saludos y bienvenidas | Primer contacto |
| **Pricing Agent** | Responde sobre precios y cotizaciones | Consultas economicas |
| **Location Agent** | Informacion de ubicaciones | Direcciones y sucursales |
| **Hours Agent** | Horarios de atencion | Disponibilidad |
| **FAQ Agent** | Preguntas frecuentes | Base de conocimiento |
| **Booking Agent** | Agenda citas (con variantes por vertical) | Dental, Medical, Restaurant |
| **General Agent** | Fallback para consultas generales | Todo lo demas |
| **Escalation Agent** | Escala a humano | Casos complejos |
| **Urgent Care Agent** | Emergencias y urgencias | Dolor, accidentes |

### Integracion con Configuraciones del Cliente

Todos los agentes tienen acceso completo al contexto del negocio:

- **Instrucciones personalizadas** - Identidad, tono, casos especiales
- **Politicas del negocio** - Cancelaciones, pagos, garantias
- **Servicios y precios** - Con promociones activas
- **FAQs personalizadas** - Respuestas pre-configuradas
- **Knowledge Base completo** - Documentos y conocimiento del negocio
- **Sucursales** - Horarios y personal por ubicacion
- **Manejo de competencia** - Respuestas ante menciones de competidores
- **Plantillas de respuesta** - Templates configurados
- **Estilo de comunicacion** - Configurado por tenant

### Beneficios del Sistema Multi-Agente

1. **Respuestas mas especializadas** - Cada agente es experto en su area
2. **Mejor manejo de verticales** - Una clinica dental responde diferente a un restaurante
3. **Sistema de handoffs** - Los agentes pueden pasarse el control entre si
4. **Trazabilidad completa** - Se sabe exactamente que agente proceso cada mensaje
5. **Escalacion inteligente** - Detecta cuando escalar a humano automaticamente
6. **Deteccion de urgencias** - Prioriza emergencias medicas/dentales

### Arquitectura de Archivos LangGraph

```
src/features/ai/
├── state/
│   └── agent-state.ts          # Estado compartido del grafo (BusinessContext extendido)
├── agents/
│   ├── supervisor/
│   │   └── supervisor.agent.ts # Orquestador principal
│   ├── routing/
│   │   └── vertical-router.agent.ts # Enrutador por vertical
│   └── specialists/
│       ├── base.agent.ts       # Clase base con buildFullBusinessContext()
│       ├── greeting.agent.ts   # Saludos
│       ├── pricing.agent.ts    # Precios
│       ├── location.agent.ts   # Ubicaciones
│       ├── hours.agent.ts      # Horarios
│       ├── faq.agent.ts        # FAQs
│       ├── booking.agent.ts    # Citas (+ variantes)
│       ├── general.agent.ts    # General
│       ├── escalation.agent.ts # Escalacion
│       └── urgent-care.agent.ts # Urgencias
├── graph/
│   └── tistis-graph.ts         # Grafo principal compilado
└── services/
    ├── langgraph-ai.service.ts # Servicio de integracion (usa get_tenant_ai_context RPC)
    └── message-learning.service.ts # Sistema de aprendizaje automatico
```

## 🧠 Sistema de Aprendizaje Automatico de IA (Nuevo)

### Que es?

El sistema de aprendizaje automatico analiza mensajes entrantes para extraer patrones y mejorar las respuestas de la IA con el tiempo.

### Caracteristicas

- **Analisis de patrones** - Extrae patrones de mensajes entrantes
- **Vocabulario especifico** - Aprende terminos y jerga del negocio
- **Preferencias de horarios** - Detecta horarios preferidos por clientes
- **Objeciones comunes** - Identifica objeciones frecuentes
- **Insights automaticos** - Genera insights basados en datos
- **Especifico por vertical** - Dental, restaurant, medical tienen diferentes patrones

### Disponibilidad

Solo disponible para planes **Essentials** y superiores.

### Tablas de Base de Datos

```sql
-- Patrones extraidos de mensajes
ai_message_patterns

-- Vocabulario especifico del negocio
ai_learned_vocabulary

-- Insights automaticos generados
ai_business_insights

-- Configuracion por tenant
ai_learning_config

-- Cola de procesamiento
ai_learning_queue
```

### Endpoint CRON

```
POST /api/cron/process-learning
```

Procesa la cola de mensajes pendientes para extraccion de patrones.

### Configuracion del Feature Flag

LangGraph esta controlado por un feature flag por tenant:

```sql
-- Ver estado actual
SELECT tenant_id, use_langgraph FROM ai_tenant_config;

-- Activar LangGraph para un tenant
UPDATE ai_tenant_config
SET use_langgraph = true
WHERE tenant_id = 'tu-tenant-id';

-- Desactivar (volver al sistema legacy)
UPDATE ai_tenant_config
SET use_langgraph = false
WHERE tenant_id = 'tu-tenant-id';
```

La migracion `064_LANGGRAPH_FEATURE_FLAG.sql` agrega:
- Columna `use_langgraph` (boolean, default: false)
- Columna `langgraph_config` (JSONB para configuracion avanzada)
- Indice optimizado para busqueda rapida
- Funcion helper `tenant_uses_langgraph(tenant_id)`

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

### Schema v2.2

- **25+ tablas** principales (tenants, leads, patients, quotes, user_roles, vertical_configs, ai_learning_*, etc.)
- **11 funciones** PostgreSQL optimizadas con advisory locks
- **4 views** para queries complejas (incluye staff_members)
- **3 buckets** de Storage (patient-files, quotes-pdf, temp-uploads)
- **RLS policies** corregidas usando user_roles (multi-tenant seguro)
- **25+ índices** optimizados

### Migraciones Aplicadas

1. `001_initial_schema.sql` - Schema base + discovery sessions
2. `002_add_session_token.sql` - Token de sesion para onboarding
3. `003_esva_schema_v2.sql` - Schema multi-tenant completo
4. `004_esva_seed_data.sql` - Datos de ESVA (tenant inicial)
5. `005_patients_module.sql` - Modulo de pacientes
6. `006_quotes_module.sql` - Modulo de cotizaciones
7. `007_files_storage_setup.sql` - Storage buckets
8. `008_notifications_module.sql` - Sistema de notificaciones
9. `009_critical_fixes.sql` - 14 fixes criticos (seguridad + performance)
10. `010_assembly_engine.sql` - Motor de ensamblaje de propuestas
11. `011_master_correction.sql` - Correccion master critica
12. ... (migraciones 012-063) - Mejoras incrementales
13. `064_LANGGRAPH_FEATURE_FLAG.sql` - Feature flag para LangGraph multi-agente
14. `065_AI_MESSAGE_LEARNING_SYSTEM.sql` - **NUEVO** - Sistema de aprendizaje automatico de mensajes

### Migración 011: Corrección Master (10 Dic 2024)

**CRÍTICO - Cambios de negocio y seguridad:**

**Precios actualizados:**
- Starter: **$3,490/mes** (1 sucursal)
- Essentials: **$7,490/mes** (hasta 8 sucursales)
- Growth: **$12,490/mes** (hasta 20 sucursales)

**Seguridad multi-tenant:**
- ✅ Tabla `user_roles` creada (era referenciada pero no existía)
- ✅ RLS policies corregidas: ahora usan `user_roles` en vez de JWT claims inexistentes
- ✅ Prevención de acceso cross-tenant mejorada
- ✅ Sincronización automática staff → user_roles

**Nuevas features:**
- ✅ Tabla `vertical_configs` para configuración por tipo de negocio (dental, restaurant, etc.)
- ✅ VIEW `staff_members` como alias de `staff` (compatibilidad)
- ✅ Función helper `get_user_tenant_id()` para queries
- ✅ 6 addons actualizados con precios 2025

**Correcciones:**
- ✅ VIEW `quotes_full` corregida (l.name → l.full_name)
- ✅ Tabla `proposals` actualizada (activation_fee = 0)

Ver detalles completos en `/supabase/migrations/MIGRATION_NOTES.md`

## 🔌 API Routes

### Endpoints Disponibles

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET/POST | `/api/leads` | Lista y crea leads | ✅ |
| GET/PATCH/DELETE | `/api/leads/[id]` | CRUD de lead específico | ✅ |
| GET/POST | `/api/appointments` | Gestión de citas | ✅ |
| GET/POST | `/api/patients` | Gestión de pacientes | ✅ |
| GET/PATCH/DELETE | `/api/patients/[id]` | CRUD de paciente | ✅ |
| GET/POST | `/api/conversations` | Conversaciones multi-canal | ✅ |
| POST | `/api/webhook/whatsapp/[tenantSlug]` | Webhook WhatsApp | ⚠️ |
| POST | `/api/webhook/instagram/[tenantSlug]` | Webhook Instagram | ⚠️ |
| POST | `/api/webhook/facebook/[tenantSlug]` | Webhook Facebook | ⚠️ |
| POST | `/api/webhook/tiktok/[tenantSlug]` | Webhook TikTok | ⚠️ |
| POST | `/api/jobs/process` | Procesador de cola de trabajos | ⚠️ |

Todas las rutas validan:
- Autenticación vía header `Authorization`
- Pertenencia al tenant correcto
- Formato de UUID
- Validaciones de datos específicas

### Sistema de Webhooks Multi-Canal

Los webhooks multi-tenant soportan:
- **WhatsApp Business Cloud API** - Mensajes y estados
- **Instagram Direct Messages** - Mensajes vía Meta Graph API
- **Facebook Messenger** - Mensajes vía Meta Graph API
- **TikTok Direct Messages** - Mensajes vía TikTok Business API

Cada webhook verifica firmas criptográficas y procesa mensajes de forma asíncrona mediante cola de trabajos.

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
- `docs/INTEGRATION_GUIDE.md` - Guía de integraciones (WhatsApp, Stripe, AI)
- `docs/MULTI_CHANNEL_AI_SYSTEM.md` - Sistema de AI multi-canal completo
- `supabase/migrations/MIGRATION_NOTES.md` - Guía completa de migraciones
- `.claude/docs/` - Documentación técnica adicional

### Documentacion Tecnica AI Multi-Canal

El archivo `docs/MULTI_CHANNEL_AI_SYSTEM.md` contiene:
- **Arquitectura LangGraph Multi-Agente** - Sistema de agentes especializados
- Arquitectura completa del sistema de mensajeria
- Especificacion de webhooks para cada plataforma (WhatsApp, Instagram, Facebook, TikTok)
- Sistema de cola de trabajos (jobs queue) con procesamiento asincrono
- Integracion con sistema de agentes para respuestas especializadas
- Lead scoring automatico basado en senales del AI
- **Configuracion de AI por canal** - Personalizacion por canal conectado
- Sistema de **recordatorios automaticos de citas**
- **Validacion de pagos por transferencia** con OpenAI Vision
- Variables de entorno requeridas
- Flujo completo de procesamiento de mensajes

### Documentacion Sistema Multi-Agente

La arquitectura LangGraph se documenta en:
- `src/features/ai/state/agent-state.ts` - Definicion del estado compartido
- `src/features/ai/graph/tistis-graph.ts` - Grafo principal con todos los nodos
- `src/features/ai/agents/` - Implementacion de cada agente especializado
- `supabase/migrations/064_LANGGRAPH_FEATURE_FLAG.sql` - Feature flag y configuracion

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
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` - Para Claude AI
- `OPENAI_API_KEY` - Para validación de comprobantes (Vision)
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET` - Para cron jobs seguros

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

