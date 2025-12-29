# TIS TIS Platform - Guia Completa de Desarrollo

## Descripcion del Proyecto

TIS TIS Platform es un sistema SaaS multi-tenant de gestion empresarial con IA conversacional multi-agente, agente de voz con telefonia, WhatsApp Business API, y automatizacion de procesos multi-canal. Especializado en verticales como clinicas dentales, restaurantes, y consultorios medicos.

**Version:** 4.6.0
**Estado:** Produccion
**Ultima actualizacion:** 29 de Diciembre, 2025

---

## Arquitectura del Proyecto

### Estructura de Directorios

```
tistis-platform/
├── app/                          # Next.js 14 App Router
│   ├── (dashboard)/              # Rutas del dashboard (autenticadas)
│   │   └── dashboard/
│   │       ├── page.tsx          # Vista principal
│   │       ├── leads/            # Gestion de leads
│   │       ├── calendario/       # Calendario de citas
│   │       ├── inbox/            # Conversaciones
│   │       ├── analytics/        # Metricas
│   │       ├── patients/         # Pacientes (vertical dental)
│   │       └── settings/         # Configuracion (incluye Integraciones)
│   ├── (marketing)/              # Paginas publicas (landing, pricing)
│   ├── api/                      # API Routes (35+ endpoints)
│   │   ├── leads/                # CRUD leads
│   │   ├── appointments/         # CRUD citas
│   │   ├── conversations/        # Conversaciones
│   │   ├── integrations/         # Integration Hub (NUEVO)
│   │   ├── webhook/              # Webhooks multi-canal
│   │   ├── voice-agent/          # AI Agent Voz (VAPI)
│   │   ├── stripe/               # Pagos y suscripciones
│   │   └── cron/                 # Jobs programados
│   ├── auth/                     # Autenticacion (Supabase Auth)
│   └── globals.css               # Estilos globales TIS TIS
│
├── src/
│   ├── hooks/                    # Hooks globales
│   │   ├── useTenant.ts          # Lee tenant de DB
│   │   ├── useVerticalTerminology.ts # Terminologia dinamica multi-vertical
│   │   ├── useFeatureFlags.ts    # Feature flags
│   │   └── index.ts              # Barrel exports
│   │
│   ├── features/                 # Feature-First Architecture
│   │   ├── ai/                   # LangGraph Multi-Agente
│   │   │   ├── agents/           # Agentes especializados
│   │   │   │   ├── supervisor/   # Orquestador principal
│   │   │   │   ├── routing/      # Vertical router
│   │   │   │   └── specialists/  # Greeting, Pricing, Booking, FAQ, etc.
│   │   │   ├── graph/            # Configuracion del grafo
│   │   │   ├── state/            # BusinessContext, AgentState
│   │   │   └── services/         # langgraph-ai.service.ts
│   │   │
│   │   ├── integrations/         # Integration Hub
│   │   │   ├── components/       # IntegrationHub.tsx
│   │   │   └── types/            # integration.types.ts
│   │   │
│   │   ├── voice-agent/          # AI Agent Voz
│   │   │   ├── components/       # VoiceAgentConfig, TalkToAssistant
│   │   │   └── types/            # voice-agent.types.ts
│   │   │
│   │   ├── auth/                 # Autenticacion
│   │   │   ├── components/       # LoginForm, AuthProvider
│   │   │   └── hooks/            # useAuthContext
│   │   │
│   │   ├── dashboard/            # Layout y navegacion
│   │   │   ├── components/       # Sidebar, Header, MobileNav
│   │   │   └── types/            # DashboardStats
│   │   │
│   │   ├── settings/             # Configuracion
│   │   │   └── components/       # KnowledgeBase, ChannelConnections, etc.
│   │   │
│   │   ├── leads/                # Gestion de leads
│   │   ├── appointments/         # Citas y calendario
│   │   ├── inbox/                # Conversaciones
│   │   ├── analytics/            # Metricas
│   │   ├── loyalty/              # Sistema de lealtad
│   │   ├── messaging/            # Envio de mensajes
│   │   └── subscriptions/        # Suscripciones y trials
│   │
│   ├── shared/                   # Codigo compartido
│   │   ├── components/ui/        # Componentes UI reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── BranchSelector.tsx
│   │   │
│   │   ├── hooks/                # Hooks globales
│   │   │   ├── useSupabase.ts
│   │   │   ├── useDebounce.ts
│   │   │   └── usePagination.ts
│   │   │
│   │   ├── lib/                  # Configuraciones
│   │   │   ├── supabase.ts       # Cliente Supabase
│   │   │   ├── auth-helper.ts    # Autenticacion centralizada (CRITICO)
│   │   │   ├── rate-limit.ts     # Rate limiting
│   │   │   └── stripe.ts         # Cliente Stripe
│   │   │
│   │   ├── types/                # Tipos globales
│   │   │   ├── database.types.ts # Tipos de Supabase
│   │   │   └── domain.ts         # Tipos de dominio
│   │   │
│   │   ├── stores/               # Estado global (Zustand)
│   │   ├── utils/                # Utilidades
│   │   │   └── terminologyHelpers.ts # Factory functions para terminologia
│   │   └── config/
│   │       └── verticals.ts      # Configuracion base de verticales
│   │
│   └── lib/                      # Librerias adicionales
│
├── supabase/
│   └── migrations/               # 78+ migraciones SQL
│       ├── 001_initial_schema.sql
│       ├── ...
│       └── 078_INTEGRATION_HUB.sql
│
└── public/                       # Archivos estaticos
```

---

## Sistema de IA Multi-Agente (LangGraph)

### Arquitectura del Grafo

```
                     +------------------+
                     |   SUPERVISOR     |
                     | (Detecta intent) |
                     +--------+---------+
                              │
                    +---------+---------+
                    │                   │
            +-------▼-------+   +-------▼-------+
            │ VERTICAL      │   │ ESCALATION    │
            │ ROUTER        │   │ (Humano)      │
            +-------+-------+   +---------------+
                    │
    +---------------+---------------+
    │       │       │       │       │
+---▼---+ +-▼---+ +-▼---+ +-▼---+ +-▼---+
│GREETING│ │PRICING│ │BOOKING│ │FAQ│ │GENERAL│
+---+---+ +--+--+ +--+--+ +-+-+ +--+--+
    │        │       │       │      │
    +--------+-------+-------+------+
                     │
              +------▼------+
              │  FINALIZE   │
              +-------------+
```

### Agentes Implementados

| Agente | Responsabilidad | Archivo |
|--------|-----------------|---------|
| **Supervisor** | Detecta intencion y enruta | `supervisor.agent.ts` |
| **Vertical Router** | Enruta segun vertical | `vertical-router.agent.ts` |
| **Greeting Agent** | Saludos y bienvenidas | `specialists/` |
| **Pricing Agent** | Precios y cotizaciones | `specialists/` |
| **Booking Agent** | Agenda citas | `specialists/` |
| **FAQ Agent** | Preguntas frecuentes | `specialists/` |
| **General Agent** | Fallback | `specialists/` |
| **Escalation Agent** | Escala a humano | `specialists/` |

### BusinessContext

Todos los agentes reciben el contexto completo del negocio via `get_tenant_ai_context()` RPC:

```typescript
interface BusinessContext {
  tenant_config: TenantConfig;      // Identidad, tono, instrucciones
  services: Service[];              // Catalogo con precios
  faqs: FAQ[];                      // Preguntas frecuentes
  policies: Policies;               // Cancelacion, pagos
  branches: Branch[];               // Sucursales con horarios
  promotions: Promotion[];          // Promociones activas
  knowledge_base: Document[];       // Documentos
  ai_learning: AILearning;          // Patrones aprendidos
  conversation_history: Message[];  // Ultimos 20 mensajes
  external_data?: ExternalData;     // Datos de CRM/POS (Integration Hub)
}
```

---

## Sistema de Terminologia Dinamica Multi-Vertical (NUEVO en v4.6.0)

### Descripcion

Sistema que adapta automaticamente todos los textos de la UI segun el tipo de negocio (vertical) del tenant. Permite que la misma plataforma se sienta nativa para diferentes industrias.

### Verticales Soportados

| Vertical | Paciente | Cita | Quote |
|----------|----------|------|-------|
| `dental` | Paciente | Cita | Presupuesto |
| `restaurant` | Cliente | Reservacion | Cotizacion |
| `clinic` | Paciente | Consulta | Cotizacion |
| `gym` | Miembro | Clase | Membresia |
| `beauty` | Cliente | Cita | Cotizacion |
| `veterinary` | Paciente | Consulta | Presupuesto |

### Hook Principal: useVerticalTerminology

```typescript
import { useVerticalTerminology } from '@/src/hooks';

function MyComponent() {
  const { terminology, t, vertical, isLoading } = useVerticalTerminology();

  return (
    <div>
      <h1>{t('dashboardTitle')}</h1>
      <button>{terminology.newAppointment}</button>
      <span>Total: {terminology.patients}</span>
    </div>
  );
}
```

### Campos de ExtendedTerminology (35+)

```typescript
interface ExtendedTerminology {
  // Base
  patient, patients, appointment, appointments, quote, quotes
  newPatient, newAppointment, newQuote, patientList, appointmentCalendar
  todayAppointments, patientActive, patientInactive

  // Dashboard
  dashboardTitle, dashboardSubtitle, calendarPageTitle
  newAppointmentButton, scheduleAction, viewAllAction
  totalActiveLabel, todayScheduledLabel

  // Empty states
  noAppointmentsToday, noRecentActivity, upcomingLabel, pastLabel

  // Lead/Notification labels
  appointmentScheduledStatus, newAppointmentNotification

  // Appointment details
  appointmentDetail, appointmentSummary, appointmentNotes, createAppointmentError

  // Integrations
  syncAppointments, calendarSyncDescription, schedulingDescription

  // Search
  searchPlaceholder
}
```

### Terminology Helpers (Factory Functions)

```typescript
import {
  getLeadStatuses,
  getNotificationTypes,
  getBadgeConfigs,
  getSyncCapabilities,
  getAppointmentLabels
} from '@/src/shared/utils/terminologyHelpers';

// Uso
const statuses = getLeadStatuses(terminology);
// [{ value: 'appointment_scheduled', label: 'Reservacion Confirmada', color: 'purple' }]

const labels = getAppointmentLabels(terminology);
// { title: 'Nueva Reservacion', createButton: 'Crear Reservacion', ... }
```

### Archivos del Sistema

| Archivo | Proposito |
|---------|-----------|
| `src/hooks/useVerticalTerminology.ts` | Hook principal con 6 verticales |
| `src/shared/utils/terminologyHelpers.ts` | Factory functions |
| `src/shared/config/verticals.ts` | Configuracion base |
| `src/hooks/useTenant.ts` | Lee vertical del tenant |

### Flujo de Determinacion

```
Discovery API → Pricing → Checkout → Provisioning → useTenant → useVerticalTerminology → UI
```

---

## Integration Hub (v4.4.0)

### Descripcion

Sistema universal de integraciones que permite conectar TIS TIS con cualquier sistema externo (CRM, POS, software dental, calendarios).

### Conectores Soportados

| Categoria | Conectores | Estado |
|-----------|------------|--------|
| **CRM** | HubSpot, Salesforce, Zoho, Pipedrive | HubSpot disponible |
| **Dental** | Dentrix, Open Dental, Eaglesoft | Proximamente |
| **POS** | Square, Toast, Clover | Proximamente |
| **Calendario** | Google Calendar, Calendly | Proximamente |
| **Generico** | Webhook, CSV Import, API Custom | Disponible |

### Arquitectura de Datos

```
integration_connections (conexiones)
├── external_contacts (contactos de CRM)
├── external_appointments (citas externas)
├── external_inventory (inventario POS)
├── external_products (productos/menu)
├── integration_sync_logs (auditoria)
└── integration_actions (acciones bidireccionales)
```

### API Endpoints

```
GET/POST /api/integrations           # Listar/Crear conexiones
GET/PATCH/DELETE /api/integrations/[id]  # CRUD por ID
POST /api/integrations/[id]/sync     # Trigger sync manual
```

### Componentes UI

- `IntegrationHub.tsx` - Vista principal en Settings > Integraciones
- `ConfigurationModal` - Modal de configuracion
- `DeleteConfirmationModal` - Confirmacion de eliminacion
- `IntegrationCard` - Tarjeta de integracion activa
- `AddConnectorCard` - Tarjeta para agregar integracion

---

## Base de Datos (Supabase)

### Tablas Principales (32+)

```sql
-- Core
tenants, branches, services, staff, user_roles

-- Leads & Patients
leads, patients, clinical_history, patient_files

-- Communication
conversations, messages, channel_connections

-- Appointments
appointments, quotes, quote_items, quote_payment_plans

-- AI System
ai_message_patterns, ai_learned_vocabulary, ai_business_insights
ai_learning_config, ai_learning_queue

-- Integration Hub (NUEVO)
integration_connections, external_contacts, external_appointments
external_inventory, external_products, integration_sync_logs
integration_actions

-- Loyalty
loyalty_programs, loyalty_tiers, loyalty_rewards
loyalty_members, loyalty_transactions, membership_tokens

-- Subscriptions
plans, addons, subscriptions, clients
```

### Migraciones Importantes

| Migracion | Descripcion |
|-----------|-------------|
| `011_master_correction.sql` | Correccion critica de RLS con user_roles |
| `015_ai_system_multichannel.sql` | Sistema AI multi-canal |
| `021_ai_context_rpc.sql` | RPC get_tenant_ai_context() |
| `023_knowledge_base_system.sql` | Base de conocimiento |
| `065_AI_MESSAGE_LEARNING_SYSTEM.sql` | Sistema de aprendizaje |
| `067_VOICE_AGENT_SYSTEM.sql` | Agente de voz (VAPI) |
| `078_INTEGRATION_HUB.sql` | Integration Hub |

### RLS (Row Level Security)

Todas las tablas usan RLS basado en `user_roles`:

```sql
-- Patron estandar
CREATE POLICY "tenant_isolation" ON tabla
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid()
  )
);
```

---

## Sistema de Diseno UI/UX

### Colores de Marca

```css
:root {
  /* TIS TIS Brand Colors */
  --tis-coral: rgb(223, 115, 115);   /* #DF7373 - Color principal */
  --tis-pink: rgb(194, 51, 80);      /* #C23350 - Acento */
  --tis-green: #9DB8A1;              /* Verde secundario */
  --tis-purple: #667eea;             /* Purpura para gradientes */
}
```

### Tipografia

```css
/* Plus Jakarta Sans - Premium Typography */
--font-display: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
--font-body: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
```

### Clases CSS Personalizadas

```css
/* Cards */
.card-premium     /* Card con sombra y hover */
.card-hero        /* Card oscura con gradiente */

/* Typography */
.metric-value     /* Numeros grandes (2rem, 800 weight) */
.metric-label     /* Labels uppercase (0.75rem) */
.heading-lg       /* Titulos (1.5rem, 700 weight) */
.heading-sm       /* Subtitulos uppercase */

/* Lead Scores */
.score-badge-hot  /* Gradiente coral para leads calientes */
.score-badge-warm /* Gradiente amber para leads tibios */
.score-badge-cold /* Gradiente gris para leads frios */

/* Loading */
.skeleton         /* Shimmer animation */
.alert-pulse      /* Pulso suave */
```

### Modo Oscuro

```css
.dark {
  --bg-primary: #2f2f2f;      /* Fondo principal */
  --bg-secondary: #262626;    /* Fondo secundario */
  --bg-tertiary: #1f1f1f;     /* Fondo terciario */
  --text-primary: #ececec;    /* Texto principal */
  --border-primary: #404040;  /* Bordes */
}
```

### Componentes UI Reutilizables

| Componente | Ubicacion | Uso |
|------------|-----------|-----|
| `Button` | `shared/components/ui/` | Botones con variantes |
| `Card` | `shared/components/ui/` | Cards con header/content/footer |
| `Badge` | `shared/components/ui/` | Badges de estado |
| `Modal` | `shared/components/ui/` | Modales |
| `Input` | `shared/components/ui/` | Inputs y textareas |
| `Avatar` | `shared/components/ui/` | Avatares |
| `FileUpload` | `shared/components/ui/` | Upload de archivos |
| `BranchSelector` | `shared/components/ui/` | Selector de sucursales |

---

## Patrones de Codigo

### Feature-First Architecture

Cada feature contiene TODO lo necesario:

```
src/features/[feature]/
├── components/     # Componentes React
├── hooks/          # Hooks especificos
├── services/       # Logica de negocio
├── types/          # Tipos TypeScript
├── store/          # Estado (Zustand)
└── index.ts        # Exports publicos
```

### API Routes Pattern

```typescript
// app/api/[resource]/route.ts
export const dynamic = 'force-dynamic';

import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedContext(request);

  if (isAuthError(authResult)) {
    return createAuthErrorResponse(authResult);
  }

  const { client: supabase, tenantId, role } = authResult;

  // Logica...
}
```

### Autenticacion Centralizada

SIEMPRE usar `auth-helper.ts`:

```typescript
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
```

### Rate Limiting

```typescript
import { publicAPILimiter, webhookLimiter } from '@/src/shared/lib/rate-limit';

// En API routes publicas
const limiterResult = await publicAPILimiter(request);
if (limiterResult) return limiterResult;
```

---

## Estilo de Copywriting

### Tono de Voz

- **Profesional pero cercano** - No demasiado formal ni informal
- **Claro y conciso** - Frases cortas, sin jerga tecnica innecesaria
- **Orientado a la accion** - CTAs claros

### Ejemplos

```
BIEN:
"Conecta TIS TIS con tus sistemas externos"
"Sincroniza contactos, deals y actividades"
"Continuar configuracion"

MAL:
"Integra nuestro sistema con tus herramientas de terceros"
"Realiza la sincronizacion de datos de contacto"
"Proceder con el siguiente paso de configuracion"
```

### Labels y Botones

- **Botones primarios**: Verbo en infinitivo ("Guardar", "Crear", "Sincronizar")
- **Botones secundarios**: Verbo o sustantivo ("Cancelar", "Configurar")
- **Destructivos**: Especificos ("Eliminar integracion", no solo "Eliminar")

---

## Seguridad

### Principios Criticos

1. **NUNCA confiar en datos del cliente** - Validar todo server-side
2. **Usar auth-helper.ts** - Nunca auth manual en API routes
3. **Rate limiting** - En todos los endpoints publicos
4. **Timing-safe comparisons** - Para tokens y secretos
5. **RLS siempre activo** - Verificar tenant_id en queries

### Headers de Seguridad (next.config.mjs)

```javascript
headers: [
  'Content-Security-Policy',
  'X-Frame-Options: DENY',
  'X-Content-Type-Options: nosniff',
  'Strict-Transport-Security',
  'Referrer-Policy',
  'Permissions-Policy'
]
```

---

## Comandos de Desarrollo

```bash
# Desarrollo
npm run dev           # Servidor desarrollo
npm run build         # Build produccion
npm run start         # Servidor produccion

# Calidad
npm run lint          # ESLint
npm run typecheck     # TypeScript check
npm run test          # Jest tests

# Git
git status && git diff  # Ver cambios
git add -A && git commit -m "mensaje"
git push origin main
```

---

## Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# AI
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# VAPI (Voice)
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=

# Meta (WhatsApp/Instagram)
META_VERIFY_TOKEN=
META_APP_SECRET=

# Resend (Email)
RESEND_API_KEY=
```

---

## Reglas Criticas

### NO HACER

- NO editar archivos en `node_modules/`
- NO hacer commits sin verificar typecheck y lint
- NO exponer secrets en codigo
- NO usar `any` en TypeScript (usar `unknown`)
- NO crear dependencias circulares entre features
- NO modificar RLS policies sin revision

### SIEMPRE HACER

- SIEMPRE usar `auth-helper.ts` para autenticacion
- SIEMPRE validar UUID con regex antes de queries
- SIEMPRE usar rate limiting en endpoints publicos
- SIEMPRE incluir tenant_id en queries de datos
- SIEMPRE manejar errores con try/catch
- SIEMPRE documentar cambios significativos

---

## Flujo de Trabajo

### Desarrollo de Nueva Feature

1. **Analizar requisitos** - Entender que se necesita
2. **Crear migracion** (si hay cambios de BD)
3. **Crear feature folder** en `src/features/`
4. **Implementar API routes** en `app/api/`
5. **Crear componentes UI**
6. **Validar typecheck y lint**
7. **Commit con mensaje descriptivo**
8. **Push a main**

### Commit Message Format

```
tipo(scope): descripcion corta

- Detalle 1
- Detalle 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

*Este archivo es la fuente de verdad para desarrollo en TIS TIS Platform. Todas las decisiones de codigo deben alinearse con estos principios.*
