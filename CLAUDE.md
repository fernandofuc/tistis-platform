# TIS TIS Platform - Guia Completa de Desarrollo

## Descripcion del Proyecto

TIS TIS Platform es un sistema SaaS multi-tenant de gestion empresarial con IA conversacional multi-agente, agente de voz con telefonia, WhatsApp Business API, y automatizacion de procesos multi-canal. Especializado en verticales como clinicas dentales, restaurantes, y consultorios medicos.

**Version:** 4.7.0
**Estado:** Produccion
**Ultima actualizacion:** 25 de Enero, 2026

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
│   │   │   ├── components/       # KnowledgeBase, ChannelConnections, AdminChannelSection
│   │   │   ├── services/         # notificationService, paymentsService
│   │   │   ├── hooks/            # useChannels
│   │   │   ├── types/            # channels.types
│   │   │   └── index.ts          # Barrel exports
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

## Admin Channel System (v4.7.0 - FASE 1-6)

### Descripcion

Sistema de comunicacion B2B que permite a clientes empresariales (ESVA Dental, cadenas de restaurantes, etc.) interactuar con sus instancias TIS TIS via WhatsApp y Telegram. Permite consultar analytics, configurar servicios, recibir alertas y ejecutar acciones operativas en tiempo real.

### Progreso de Implementacion

| FASE | Descripcion | Estado | Version |
|------|-------------|--------|---------|
| **FASE 1-5** | Backend: RPC, servicios, tipos, migraciones, API endpoints | Completado | v4.7.0 |
| **FASE 6** | UI Dashboard: Vinculacion de dispositivos en Notificaciones | Completado | v4.7.0 |
| **FASE 7** | Admin Chat Interface (Widget conversacional) | Pendiente | v4.8.0 |
| **FASE 8** | Alertas automáticas y notificaciones programadas | Pendiente | v4.8.0 |

### Casos de Uso

| Caso | Descripcion | Canal |
|------|-------------|-------|
| **Daily Summary** | Resumen diario de leads, citas y ventas | WhatsApp/Telegram |
| **Analytics Query** | "Cuantos leads hoy?" "Ventas de esta semana?" | WhatsApp/Telegram |
| **Configuration** | Cambiar horarios, precios, servicios | WhatsApp/Telegram |
| **Alerts** | Notificacion de leads calientes, inventario bajo | WhatsApp/Telegram |
| **Operations** | Ver citas de hoy, leads pendientes, escalaciones | WhatsApp/Telegram |

### Arquitectura de Datos (FASE 1)

```
admin_channel_users (Usuarios vinculados)
├── Link Code (vinculacion via SMS/codigo)
├── Status (pending, active, suspended, blocked)
├── Permissions (view_analytics, configure, receive_notifications)
└── Rate Limiting (mensajes/hora, mensajes/dia)

admin_channel_conversations (Flujos por usuario)
├── Current Intent (tipo de solicitud)
├── Pending Action (confirmacion pendiente)
├── Context (datos de negocio cargados)
└── LangGraph State

admin_channel_messages (Historial)
├── Detected Intent (analytics_daily_summary, config_prices, etc.)
├── Extracted Data (valores, servicios mencionados)
├── Actions Executed (cambios realizados)
└── Token Usage (para billing)

admin_channel_notifications (Alertas)
├── Type (daily_summary, weekly_digest, hot_lead, low_inventory, etc.)
├── Channel (WhatsApp, Telegram, o ambos)
├── Status (pending, sent, delivered, read, failed)
└── Scheduling (programadas, recurrentes)

admin_channel_audit_log (Auditoria completa)
├── Action (create_user, verify_code, send_message, etc.)
├── Status (success, error)
└── Metadata (IPs, cambios realizados, etc.)
```

### RPCs Implementados

| RPC | Proposito |
|-----|-----------|
| `generate_admin_link_code(tenant_id, staff_id?)` | Genera codigo vinculacion (6 digitos, 15 min TTL) |
| `verify_admin_link_code(code, phone?, telegram_id?, telegram_user?)` | Verifica codigo y activa usuario |
| `get_admin_channel_user(tenant_id, phone_or_telegram)` | Obtiene usuario con datos de tenant |
| `update_admin_rate_limit(user_id)` | Incrementa contadores rate limit |
| `get_or_create_admin_conversation(user_id, channel)` | Crea o recupera conversacion activa |
| `save_admin_message(conversation_id, role, content, intent, extracted_data)` | Guarda mensaje y detecta intent |

### Intents Detectables

**Analytics:**
- `analytics_daily_summary` - Resumen del dia
- `analytics_weekly_summary` - Resumen de la semana
- `analytics_monthly_summary` - Resumen del mes
- `analytics_sales` - Consultas de ventas
- `analytics_leads` - Metricas de leads
- `analytics_revenue` - Ingresos

**Configuration:**
- `config_services` - Gestionar servicios
- `config_prices` - Cambiar precios
- `config_hours` - Modificar horarios
- `config_staff` - Gestionar personal
- `config_promotions` - Crear promociones

**Operations:**
- `operation_appointments_today` - Citas de hoy
- `operation_pending_leads` - Leads pendientes
- `operation_escalations` - Escalaciones activas
- `operation_inventory_check` - Verificar inventario

**Notifications:**
- `notification_settings` - Configurar alertas
- `notification_pause` - Pausar notificaciones
- `notification_resume` - Reanudar notificaciones

### Feature Folder Structure

```
src/features/admin-channel/
├── types/
│   ├── db-rows.types.ts          # Tipos SQL (snake_case)
│   ├── application.types.ts      # Tipos app (camelCase)
│   ├── converters.ts             # DB ↔ App converters
│   ├── api.types.ts              # Request/Response types
│   ├── constants.ts              # Metadatos, errores
│   └── index.ts                  # Barrel exports
├── services/
│   ├── admin-channel.service.ts  # Logica core (singleton)
│   └── index.ts                  # Barrel exports
├── components/
│   ├── AdminChannelSection.tsx   # UI Vinculacion dispositivos (FASE 6)
│   ├── LinkCodeGenerator.tsx     # Generador de codigos (FASE 7)
│   ├── AdminChat.tsx             # Chat widget (FASE 7)
│   └── NotificationSettings.tsx  # Config alertas (FASE 8)
├── hooks/                        # (FASE 7)
│   ├── useAdminChannel.ts
│   └── useAdminNotifications.ts
└── index.ts                      # Public API exports
```

### Servicios Disponibles (v4.7.0)

```typescript
// User Management
generateLinkCode(tenantId, staffId?): Promise<GenerateLinkCodeResult>
verifyLinkCode(code, phone?, telegramId?, telegramUsername?): Promise<VerifyLinkCodeResult>
getAdminChannelUser(tenantId, phoneOrTelegram): Promise<AdminChannelUserWithTenant>

// Conversations
getOrCreateConversation(userId, channel): Promise<GetOrCreateConversationResult>

// Messages
saveMessage(conversationId, role, content, intent, extractedData): Promise<void>
getConversationMessages(conversationId, limit?): Promise<AdminChannelMessage[]>

// Rate Limiting
updateRateLimit(userId): Promise<RateLimitResult>
checkRateLimit(userId): Promise<RateLimitResult>

// Notifications
createNotification(tenantId, userId, type, content, channel): Promise<void>
getNotifications(userId, limit?): Promise<AdminChannelNotification[]>
```

### FASE 6 - UI Dashboard Admin Channel (v4.7.0)

#### Componente: AdminChannelSection

Ubicación: `/src/features/settings/components/AdminChannelSection.tsx`

Componente React que proporciona interfaz de usuario para vincular y gestionar dispositivos WhatsApp y Telegram personales en la sección de Notificaciones del Dashboard.

**Características:**

- Visualización de dispositivos vinculados por canal (WhatsApp/Telegram)
- Generación de códigos de vinculación (6 dígitos, 15 minutos TTL)
- Desvinculación de dispositivos con confirmación
- Visualización de permisos y estadísticas de usuario
- Mostrador de código con contador de tiempo restante
- Instrucciones contextuales para cada canal
- Dark mode completo
- Responsivo (mobile-first)
- Estado de carga e manejo de errores

**Sub-componentes Internos:**

| Componente | Responsabilidad |
|------------|-----------------|
| `LinkedAccountCard` | Tarjeta de dispositivo vinculado activo |
| `AddChannelCard` | Botón/tarjeta para agregar nuevo dispositivo |
| `LinkCodeDisplay` | Mostrador del código con instrucciones |
| `StatusBadge` | Badge de estado del usuario (active, pending, etc.) |

**Estados Visuales:**

```
- Loading: Spinner circular mientras se cargan dispositivos
- Empty: Tarjetas "Vincular WhatsApp/Telegram" cuando no hay dispositivos
- Active: Tarjeta de dispositivo con estatus "Activo"
- Generating: Mostrador de código con botón de refrescar
- Error: Banner rojo con mensaje de error y opción cerrar
```

**API Endpoints Utilizados:**

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/admin-channel/link` | POST | Genera nuevo código de vinculación |
| `/api/admin-channel/link` | GET | Obtiene lista de usuarios vinculados |
| `/api/admin-channel/link?userId=xxx` | DELETE | Desvincula dispositivo |

**Tipos Utilizados:**

```typescript
interface LinkedUser {
  id: string;
  phone_normalized: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  status: 'pending' | 'active' | 'suspended' | 'unlinked';
  linked_at: string | null;
  can_view_analytics: boolean;
  can_configure: boolean;
  can_receive_notifications: boolean;
  messages_today: number;
  last_message_at: string | null;
  staff?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface LinkCode {
  code: string;
  expiresAt: string;
  instructions: {
    whatsapp: string;
    telegram: string;
  };
}
```

**Integración en Página de Configuración:**

El componente se integra en el tab "Notificaciones" de `/app/(dashboard)/dashboard/settings/page.tsx`:

```typescript
{activeTab === 'notifications' && (
  <Card variant="bordered">
    {/* ... Secciones In-App, Email, WhatsApp ... */}

    {/* Admin Channel Section (nueva) */}
    <AdminChannelSection />

    {/* Save Button */}
    <div className="flex justify-center sm:justify-end pt-4 border-t">
      <Button onClick={handleSaveNotifications}>
        Guardar Preferencias
      </Button>
    </div>
  </Card>
)}
```

**Flujo de Usuario:**

1. Usuario navega a Settings > Notificaciones
2. Ve sección "Admin Channel" con opción de vincular WhatsApp/Telegram
3. Presiona botón "Vincular WhatsApp" o "Vincular Telegram"
4. Se genera código de 6 dígitos con expiración de 15 minutos
5. Se muestra código con instrucciones de envío
6. Usuario puede copiar código o regenerarlo
7. Una vez vinculado, aparece dispositivo activo en lista
8. Puede desvincularse con confirmación

**Estilos y Temas:**

- Usa colores de canal: Verde para WhatsApp, Azul para Telegram
- Color coral de TIS TIS para elementos interactivos
- Backgrounds adaptables al dark mode
- Animaciones suaves en hover y transiciones
- Bordes redondeados (border-radius: 0.5rem a 2rem)
- Espaciado consistente (gap-4, p-4, etc.)

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

### Tablas Principales (40+)

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

-- Integration Hub
integration_connections, external_contacts, external_appointments
external_inventory, external_products, integration_sync_logs
integration_actions

-- Admin Channel System (NUEVO v4.7.0)
admin_channel_users, admin_channel_conversations, admin_channel_messages
admin_channel_notifications, admin_channel_audit_log

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
| `177_ADMIN_CHANNEL_SYSTEM.sql` | Admin Channel System (B2B) |

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

## Recursos de Documentacion

### Documentacion Principal

Esta es la guia maestra de desarrollo. Para documentacion detallada por feature, consulta:

**NUEVA: Admin Channel Docs (FASE 6)**
- **[ADMIN_CHANNEL_DOCUMENTATION_INDEX.md](ADMIN_CHANNEL_DOCUMENTATION_INDEX.md)** - Indice maestro de toda documentacion Admin Channel
- **[FASE6_ADMIN_CHANNEL_UI.md](FASE6_ADMIN_CHANNEL_UI.md)** - Detalles completos de FASE 6 (UI Dashboard)
- **[ADMIN_CHANNEL_QUICK_REFERENCE.md](ADMIN_CHANNEL_QUICK_REFERENCE.md)** - Guia rapida para desarrolladores
- **[ADMIN_CHANNEL_ARCHITECTURE.md](ADMIN_CHANNEL_ARCHITECTURE.md)** - Diagramas de arquitectura y flujos
- **[ADMIN_CHANNEL_CODE_EXAMPLES.md](ADMIN_CHANNEL_CODE_EXAMPLES.md)** - Ejemplos y snippets de codigo

**Documentacion Existente:**
- **[docs/DOCUMENTATION_INDEX.md](docs/DOCUMENTATION_INDEX.md)** - Indice completo de toda documentacion disponible
- **[docs/ADMIN_CHANNEL_SYSTEM.md](docs/ADMIN_CHANNEL_SYSTEM.md)** - Documentacion completa del Admin Channel System (v4.7.0)
- **[docs/ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md](docs/ADMIN_CHANNEL_IMPLEMENTATION_GUIDE.md)** - Guia practica de implementacion
- **[docs/ADMIN_CHANNEL_API_REFERENCE.md](docs/ADMIN_CHANNEL_API_REFERENCE.md)** - API reference detallada con ejemplos

### Archivos relacionados

- `/supabase/migrations/177_ADMIN_CHANNEL_SYSTEM.sql` - Migration SQL completo
- `/src/features/admin-channel/` - Codigo fuente del feature backend
- `/src/features/settings/components/AdminChannelSection.tsx` - Componente UI (FASE 6)
- `/docs/API.md` - API general del proyecto
- `/docs/INTEGRATION_GUIDE.md` - Guia de integraciones

---

*Este archivo es la fuente de verdad para desarrollo en TIS TIS Platform. Todas las decisiones de codigo deben alinearse con estos principios.*

*Ultima actualizacion: 25 de Enero, 2026*
*Version: 4.7.0 - FASE 6 Admin Channel UI completada*
