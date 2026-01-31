# TIS TIS Platform - Guia Completa de Desarrollo

## Descripcion del Proyecto

TIS TIS Platform es un sistema SaaS multi-tenant de gestion empresarial con IA conversacional multi-agente, agente de voz con telefonia, WhatsApp Business API, y automatizacion de procesos multi-canal. Especializado en verticales como clinicas dentales, restaurantes, y consultorios medicos.

**Version:** 4.8.4
**Estado:** Produccion
**Ultima actualizacion:** 30 de Enero, 2026

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
│   ├── api/                      # API Routes (40+ endpoints)
│   │   ├── leads/                # CRUD leads
│   │   ├── appointments/         # CRUD citas
│   │   ├── conversations/        # Conversaciones
│   │   ├── integrations/         # Integration Hub
│   │   ├── agent/                # TIS TIS Local Agent (v4.8.3)
│   │   │   ├── installer/        # POST: genera credenciales
│   │   │   ├── sync/             # POST: recibe datos de sync
│   │   │   ├── heartbeat/        # POST: registra estado
│   │   │   ├── register/         # POST: registra agente
│   │   │   ├── validate-schema/  # POST: valida schema SR (NUEVO v4.8.3)
│   │   │   └── status/           # GET: obtiene estado del agente (NUEVO v4.8.3)
│   │   ├── reports/              # Generacion de reportes PDF (v4.8.0)
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
│   │   ├── integrations/         # Integration Hub + Local Agent + SR Cloud
│   │   │   ├── components/       # IntegrationHub, LocalAgentSetupWizard, AgentStatusCard,
│   │   │   │                     # SchemaValidationStatus, CredentialsGuide, SRDeploymentSelector
│   │   │   ├── services/         # agent-manager.service.ts, schema-validator.service.ts,
│   │   │   │                     # soft-restaurant-cloud.service.ts (v4.8.4)
│   │   │   └── types/            # integration.types.ts, schema-validation.types.ts
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
│   │   ├── reports/              # Sistema de Reportes PDF (NUEVO v4.8.0)
│   │   │   ├── components/       # UI de flujo multi-paso
│   │   │   ├── hooks/            # useReportGeneration
│   │   │   ├── services/         # ReportGeneratorService (PDFShift + Handlebars)
│   │   │   └── types/            # ReportPeriod, ReportType, etc.
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
│   │   │   ├── restaurantDataStore.ts # Cache centralizado para datos de restaurante
│   │   │   └── index.ts          # Barrel exports
│   │   ├── utils/                # Utilidades
│   │   │   └── terminologyHelpers.ts # Factory functions para terminologia
│   │   └── config/
│   │       └── verticals.ts      # Configuracion base de verticales
│   │
│   └── lib/                      # Librerias adicionales
│
├── supabase/
│   └── migrations/               # 181+ migraciones SQL
│       ├── 001_initial_schema.sql
│       ├── ...
│       ├── 180_AGENT_INSTANCES.sql
│       └── 181_AGENT_INSTANCES_STORE_CODE.sql
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

## Sistema de Reportes PDF (v4.8.0 - NUEVO)

### Descripcion

Sistema completo de generacion de reportes PDF con flujo multi-paso estilo Claude Cowork. Permite a los usuarios generar reportes de diferentes tipos y periodos con una interfaz intuitiva y animaciones fluidas.

### Arquitectura del Sistema

```
                    +----------------------+
                    |  AI Setup Assistant  |
                    |  QuickActionsGrid    |
                    +----------+-----------+
                               │
                    (Trigger: __TRIGGER_REPORT_FLOW__)
                               │
                    +----------▼-----------+
                    |  ReportFlowOverlay   |
                    |  (Modal multi-paso)  |
                    +----------+-----------+
                               │
          +--------------------+--------------------+
          │                    │                    │
+---------▼--------+  +--------▼--------+  +-------▼--------+
| PeriodSelector   |  | ReportTypeSelect|  | GeneratingState|
| (7d, 30d, 90d)   |  | (6 tipos)       |  | (Progreso)     |
+------------------+  +-----------------+  +-------+--------+
                                                   │
                                          +--------▼--------+
                                          | API /reports/   |
                                          | generate        |
                                          +--------+--------+
                                                   │
                                          +--------▼--------+
                                          | ReportGenerator |
                                          | Service         |
                                          +--------+--------+
                                                   │
                         +-------------------------+-------------------------+
                         │                         │                         │
              +----------▼----------+   +----------▼----------+   +----------▼----------+
              | Supabase Queries    |   | Handlebars Template |   | PDFShift API        |
              | (Data fetching)     |   | (HTML generation)   |   | (PDF conversion)    |
              +---------------------+   +---------------------+   +----------+----------+
                                                                             │
                                                                  +----------▼----------+
                                                                  | Supabase Storage    |
                                                                  | (PDF upload)        |
                                                                  +----------+----------+
                                                                             │
                                                                  +----------▼----------+
                                                                  | DownloadReady       |
                                                                  | (Success state)     |
                                                                  +---------------------+
```

### Tipos de Reportes Soportados

| Tipo | ID | Descripcion | Metricas Incluidas |
|------|----|-------------|-------------------|
| **Resumen General** | `resumen` | KPIs principales y tendencias | Leads, citas, conversiones |
| **Ventas** | `ventas` | Ingresos, tickets y metodos de pago | Revenue, ordenes, ticket promedio |
| **Operaciones** | `operaciones` | Ordenes, tiempos y eficiencia | Citas completadas, cancelaciones, no-shows |
| **Inventario** | `inventario` | Stock, movimientos y alertas | Items totales, stock bajo, valor |
| **Clientes** | `clientes` | Leads, conversiones y retencion | Leads por temperatura, conversiones |
| **AI Insights** | `ai_insights` | Analisis inteligente con IA | Conversaciones, resoluciones, escalaciones |

### Periodos Soportados

| Periodo | ID | Descripcion |
|---------|----|-----------  |
| **Semanal** | `7d` | Ultimos 7 dias |
| **Mensual** | `30d` | Ultimos 30 dias |
| **Trimestral** | `90d` | Ultimos 90 dias |

### Feature Folder Structure

```
src/features/reports/
├── types/
│   └── index.ts              # ReportPeriod, ReportType, ReportFlowState, etc.
├── hooks/
│   ├── useReportGeneration.ts # Hook principal para estado y API calls
│   └── index.ts              # Barrel export
├── components/
│   ├── PeriodSelector.tsx    # Paso 1: Selector de periodo
│   ├── ReportTypeSelector.tsx # Paso 2: Selector de tipo de reporte
│   ├── GeneratingState.tsx   # Paso 3: Estado de generacion con progreso
│   ├── DownloadReady.tsx     # Paso 4: Estado de descarga listo
│   ├── ReportFlowOverlay.tsx # Modal principal del flujo
│   └── index.ts              # Barrel export
├── services/
│   ├── report-generator.service.ts # Servicio de generacion (singleton)
│   └── index.ts              # Barrel export
└── index.ts                  # Feature barrel export
```

### Hook Principal: useReportGeneration

```typescript
import { useReportGeneration } from '@/src/features/reports';

function MyComponent() {
  const {
    state,           // ReportFlowState
    isGenerating,    // boolean
    selectPeriod,    // (period: ReportPeriod) => void
    selectType,      // (type: ReportType) => void
    generate,        // () => Promise<void>
    goBack,          // () => void
    reset,           // () => void
  } = useReportGeneration({
    branchId: 'optional-branch-id',
    onSuccess: (url, filename) => console.log('PDF ready:', url),
    onError: (error) => console.error('Error:', error),
  });

  return (
    // ...
  );
}
```

### API Endpoint

```
POST /api/reports/generate
```

**Request Body:**
```typescript
{
  period: '7d' | '30d' | '90d';
  type: 'resumen' | 'ventas' | 'operaciones' | 'inventario' | 'clientes' | 'ai_insights';
  branchId?: string;  // Opcional: filtrar por sucursal
}
```

**Response (Success):**
```typescript
{
  success: true;
  pdfUrl: string;     // URL publica del PDF en Supabase Storage
  filename: string;   // Nombre del archivo (e.g., "reporte-ventas-30d-1706390400000.pdf")
}
```

**Response (Error):**
```typescript
{
  error: string;
  message: string;
}
```

### Servicio de Generacion

El `ReportGeneratorService` es un singleton que:

1. **Obtiene datos** del tenant via Supabase queries
2. **Genera HTML** usando Handlebars templates
3. **Convierte a PDF** usando PDFShift API
4. **Sube a Storage** en Supabase (bucket `reports`)
5. **Retorna URL publica** del PDF

```typescript
import { getReportGeneratorService } from '@/src/features/reports';

const service = getReportGeneratorService();
const result = await service.generateReport(tenantId, {
  period: '30d',
  type: 'ventas',
  branchId: 'optional',
});

if (result.success) {
  console.log('PDF URL:', result.pdfUrl);
}
```

### Handlebars Helpers Registrados

| Helper | Descripcion | Ejemplo |
|--------|-------------|---------|
| `formatCurrency` | Formato moneda MXN | `$1,234.56` |
| `formatNumber` | Formato numerico con separadores | `1,234` |
| `formatDate` | Fecha en espanol | `27 de enero de 2026` |
| `formatPercent` | Porcentaje | `45.5%` |
| `eq` | Comparacion de igualdad | `{{#if (eq status "active")}}` |

### Flujo de Usuario

1. Usuario navega a Dashboard > AI Setup Assistant
2. Hace clic en "Crear reporte" en Quick Actions
3. Se abre modal `ReportFlowOverlay`
4. **Paso 1**: Selecciona periodo (7d, 30d, 90d)
5. **Paso 2**: Selecciona tipo de reporte y confirma
6. **Paso 3**: Visualiza progreso de generacion
7. **Paso 4**: Descarga o abre PDF

### Componentes UI del Flujo

| Componente | Responsabilidad |
|------------|-----------------|
| `ReportFlowOverlay` | Modal principal con animaciones Framer Motion |
| `PeriodSelector` | Cards seleccionables para 7d/30d/90d |
| `ReportTypeSelector` | Grid 2x3 con 6 tipos de reporte + boton confirmar |
| `GeneratingState` | Loader animado con barra de progreso |
| `DownloadReady` | Animacion de exito + botones descarga/abrir |

### Integracion con AI Setup Assistant

El flujo se activa desde `QuickActionsGrid` usando un token especial:

```typescript
// En QuickActionsGrid.tsx
{
  id: 'report',
  icon: FileBarChart,
  label: 'Crear reporte',
  description: 'Genera reportes PDF',
  href: '__TRIGGER_REPORT_FLOW__',  // Token especial
  color: 'purple',
}

// En ai-setup/page.tsx
const handleActionClick = (href: string) => {
  if (href === '__TRIGGER_REPORT_FLOW__') {
    setShowReportFlow(true);
  }
};
```

### Variables de Entorno Requeridas

```env
# PDFShift API (para conversion HTML -> PDF)
PDFSHIFT_API_URL=https://api.pdfshift.io/v3/convert/pdf
PDFSHIFT_API_KEY=your_api_key
```

### Estilos del PDF Generado

El PDF usa estilos inline con:

- **Colores TIS TIS**: Coral (#DF7373), Pink (#C23350)
- **Gradientes**: Para headers y cards primarias
- **Grid responsive**: 3 columnas para stats
- **Tipografia**: Helvetica Neue, Arial
- **Print-friendly**: Estilos optimizados para `@media print`

---

## TIS TIS Local Agent - Soft Restaurant (v4.8.1 - NUEVO)

### Descripcion

Sistema de sincronizacion local para Soft Restaurant que permite conectar el POS con TIS TIS sin necesidad de APIs de terceros. Un servicio Windows lee directamente la base de datos SQL Server de Soft Restaurant y envia los datos a TIS TIS.

### Soporte Multi-Sucursal (v4.8.1)

El Local Agent soporta configuraciones multi-sucursal, permitiendo que cada agente se asocie a una sucursal especifica de TIS TIS y filtre datos por `store_code` (CodigoTienda/Almacen) en Soft Restaurant.

### Arquitectura del Sistema

```
+-------------------+     +-------------------+     +-------------------+
|   Dashboard UI    |     |  Windows Agent    |     |  Soft Restaurant  |
|  LocalAgentSetup  |     |  TIS TIS Agent    |     |  SQL Server DB    |
|     Wizard        |     |                   |     |                   |
+--------+----------+     +--------+----------+     +--------+----------+
         │                         │                         │
         │ POST /api/agent/installer                         │
         │ (branchId, storeCode)                             │
         ├────────────────────────>│                         │
         │                         │                         │
         │ Credentials + Config    │                         │
         │<────────────────────────│                         │
         │                         │                         │
         │                         │ SQL Query               │
         │                         │ WHERE CodigoTienda=X    │
         │                         ├────────────────────────>│
         │                         │                         │
         │                         │ Filtered Records        │
         │                         │<────────────────────────│
         │                         │                         │
         │                         │ POST /api/agent/sync    │
         │                         │ (records + branch_id)   │
         │<────────────────────────│                         │
         │                         │                         │
    sr_sales (with branch_id)      │                         │
         │                         │                         │
```

### Migraciones

| Migracion | Descripcion |
|-----------|-------------|
| `180_AGENT_INSTANCES.sql` | Tabla base y funciones para agentes |
| `181_AGENT_INSTANCES_STORE_CODE.sql` | Soporte multi-sucursal con `store_code` |

### Tabla: agent_instances

```sql
agent_instances
├── id (UUID PK)
├── tenant_id (FK tenants)
├── integration_id (FK integration_connections)
├── branch_id (FK branches, nullable)     -- TIS TIS branch
├── store_code (VARCHAR 50, nullable)     -- SR CodigoTienda for SQL filtering
├── agent_id (VARCHAR 64, unique)         -- e.g., "tis-agent-abc123"
├── agent_version (VARCHAR 20)
├── machine_name (VARCHAR 255)
├── status (ENUM: pending, registered, connected, syncing, error, offline)
├── auth_token_hash (VARCHAR 64)          -- SHA-256 hash
├── token_expires_at (TIMESTAMPTZ)
├── sync_interval_seconds (INT, default 300)
├── sync_menu, sync_inventory, sync_sales, sync_tables (BOOLEAN)
├── last_heartbeat_at, last_sync_at (TIMESTAMPTZ)
└── total_records_synced, consecutive_errors (INT)
```

### RPCs Implementados

| RPC | Proposito |
|-----|-----------|
| `validate_agent_token(agent_id, token_hash)` | Valida credenciales y retorna contexto con `store_code` |
| `update_agent_store_code(agent_id, store_code, branch_id?, tenant_id?)` | Actualiza store_code con validacion de tenant |
| `record_agent_heartbeat(agent_id, status, records?, error?)` | Registra heartbeat del agente |
| `complete_agent_sync(log_id, status, counts...)` | Completa registro de sync |
| `get_agent_stats(tenant_id)` | Estadisticas agregadas |

### API Endpoints

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/agent/installer` | POST | Genera credenciales y config para nuevo agente |
| `/api/agent/sync` | POST | Recibe datos de sincronizacion del agente |
| `/api/agent/heartbeat` | POST | Registra estado del agente |
| `/api/agent/register` | POST | Registra agente despues de instalacion |
| `/api/agent/validate-schema` | POST | Valida schema de BD Soft Restaurant (v4.8.3) |
| `/api/agent/status` | GET | Obtiene estado del agente con validacion de schema (v4.8.3) |

### Flujo de Datos Multi-Branch

```
Dashboard UI → LocalAgentSetupWizard
    ↓ (branchId + storeCode validation)
POST /api/agent/installer
    ↓ (validates format: alphanumeric, hyphens, max 50 chars)
AgentManagerService.createAgent()
    ↓ (stores branch_id + store_code)
agent_instances (DB)
    ↓
validate_agent_token RPC → sync_config.store_code
    ↓
Windows Agent → SQL WHERE CodigoTienda = store_code
    ↓
POST /api/agent/sync → sr_sales (with branch_id, NOT NULL)
    ↓
SoftRestaurantProcessor.processSale() [Background]
    ↓
restaurant_orders + restaurant_order_items (UI-ready data)
```

### Flujo de Procesamiento sr_sales → restaurant_orders (v4.8.5)

**IMPORTANTE:** Los datos de Soft Restaurant se almacenan en dos niveles:
1. **Tablas SR (datos crudos):** `sr_sales`, `sr_sale_items`, `sr_payments`
2. **Tablas UI (datos procesados):** `restaurant_orders`, `restaurant_order_items`

El `SoftRestaurantProcessor` convierte automaticamente los datos SR a formato UI.

**Arquitectura del Procesamiento:**

```
sr_sales (status: 'pending')
    │
    ├─ [Inmediato] /api/agent/sync dispara background processing
    │   └─ processCreatedSalesInBackground() → SoftRestaurantProcessor
    │
    └─ [Fallback] /api/cron/process-sr-sales cada 5 minutos
        └─ /api/internal/sr-process → SoftRestaurantProcessor
            │
            ▼
    ┌───────────────────────────────────────────┐
    │       SoftRestaurantProcessor             │
    │                                           │
    │ 1. ProductMappingService                  │
    │    - Mapea productos SR → menu items      │
    │    - Fuzzy matching por nombre            │
    │    - Registra productos sin mapear        │
    │                                           │
    │ 2. RestaurantOrderService                 │
    │    - Crea restaurant_orders               │
    │    - Crea restaurant_order_items          │
    │    - Mapea table_number → table_id        │
    │    - Mapea sale_type → order_type         │
    │                                           │
    │ 3. RecipeDeductionService                 │
    │    - Explota recetas de platillos         │
    │    - Deduce inventario automaticamente    │
    │                                           │
    │ 4. LowStockAlertService                   │
    │    - Verifica niveles de stock            │
    │    - Genera alertas si necesario          │
    └───────────────────────────────────────────┘
            │
            ▼
    sr_sales (status: 'processed', restaurant_order_id: UUID)
    restaurant_orders (visible en Dashboard)
    inventory_movements (deducciones registradas)
```

**Mapeo de Tipos de Orden:**

| SR sale_type | TIS TIS order_type |
|--------------|-------------------|
| mesa, comedor, local | dine_in |
| llevar, para llevar, pll | takeout |
| domicilio, delivery, envio | delivery |
| autoservicio, drive | drive_thru |
| catering, evento, banquete | catering |

**Servicios Involucrados:**

| Servicio | Ubicacion | Responsabilidad |
|----------|-----------|-----------------|
| `SoftRestaurantProcessor` | `/src/features/integrations/services/soft-restaurant-processor.ts` | Orquesta todo el procesamiento |
| `ProductMappingService` | Interno en el procesador | Mapea productos SR a menu items |
| `RestaurantOrderService` | Interno en el procesador | Crea ordenes y items |
| `RecipeDeductionService` | `/src/features/integrations/services/recipe-deduction.service.ts` | Deduce inventario |
| `LowStockAlertService` | `/src/features/integrations/services/low-stock-alert.service.ts` | Alertas de stock bajo |
| `SRJobQueueService` | `/src/features/integrations/services/sr-job-queue.service.ts` | Manejo de cola de procesamiento |

**Invocacion del Procesador:**

```typescript
import { SoftRestaurantProcessor } from '@/src/features/integrations';

const processor = new SoftRestaurantProcessor();
const result = await processor.processSale(saleId);

// Resultado
{
  success: true,
  saleId: 'uuid',
  restaurantOrderId: 'uuid', // ID de la orden creada
  inventoryDeducted: true,
  details: {
    itemsMapped: 5,
    itemsUnmapped: 1,
    inventoryMovements: 12
  }
}
```

### Servicio: AgentManagerService

Ubicacion: `/src/features/integrations/services/agent-manager.service.ts`

```typescript
// Crear agente con soporte multi-sucursal
const result = await agentService.createAgent({
  tenantId: 'uuid',
  integrationId: 'uuid',
  branchId: 'uuid',           // TIS TIS branch
  storeCode: 'TIENDA01',      // SR CodigoTienda for SQL filtering
  syncMenu: true,
  syncInventory: true,
  syncSales: true,
  syncTables: false,
});

// Actualizar configuracion
await agentService.updateAgentConfig(agentId, {
  storeCode: 'SUC_CENTRO',    // Validates format
  branchId: 'new-uuid',       // Validates UUID format
}, tenantId);                 // Optional: for RLS validation
```

### Componente: LocalAgentSetupWizard

Ubicacion: `/src/features/integrations/components/LocalAgentSetupWizard.tsx`

Wizard de 5 pasos para configurar el Local Agent:

| Paso | Descripcion |
|------|-------------|
| 1. Informacion | Explicacion del agente y requisitos |
| 2. Configuracion | Seleccion de branch, storeCode, opciones de sync |
| 3. Descarga | Generacion de credenciales y descarga de instalador |
| 4. Instalacion | Instrucciones paso a paso |
| 5. Verificacion | Confirmacion de conexion exitosa |

**Validaciones en UI:**
- `storeCode`: alfanumerico, guiones, guiones bajos, max 50 caracteres
- Error visual si formato invalido
- Boton "Continuar" deshabilitado si storeCode invalido o no hay credentials

### Optimizaciones de Performance

**Batch Processing en `/api/agent/sync`:**

```typescript
// ANTES (N+1 queries):
for (const record of records) {
  const { data: existing } = await supabase
    .from('sr_sales')
    .select('id')
    .eq('folio_venta', folio);
  // ...insert or skip
}

// DESPUES (2 queries):
// 1. Extract all folios
const folios = salesWithFolio.map(s => s.folio);

// 2. Batch query existing
const { data: existingSales } = await supabase
  .from('sr_sales')
  .select('folio_venta')
  .eq('tenant_id', tenantId)
  .in('folio_venta', folios);

// 3. Set for O(1) lookup
const existingFolios = new Set(existingSales.map(s => s.folio_venta));

// 4. Filter and batch insert new
const newSales = salesWithFolio.filter(s => !existingFolios.has(s.folio));
await supabase.from('sr_sales').insert(newSales);
```

### Mejoras de Seguridad

**Validacion de tenant_id en RPC:**

```sql
-- update_agent_store_code ahora valida tenant
CREATE OR REPLACE FUNCTION update_agent_store_code(
    p_agent_id VARCHAR(64),
    p_store_code VARCHAR(50),
    p_branch_id UUID DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL  -- Required for security
)
-- Solo actualiza si agent pertenece al tenant especificado
UPDATE agent_instances
SET store_code = p_store_code
WHERE agent_id = p_agent_id
  AND tenant_id = v_tenant_id;  -- Tenant isolation
```

### Tipos Relacionados

```typescript
// integration.types.ts
interface AgentInstance {
  id: string;
  tenant_id: string;
  integration_id: string;
  branch_id?: string;         // TIS TIS branch
  store_code?: string;        // SR CodigoTienda
  agent_id: string;
  status: AgentStatus;
  // ...
}

interface ValidateTokenResult {
  isValid: boolean;
  context?: {
    tenantId: string;
    integrationId: string;
    branchId?: string;
    syncConfig: {
      storeCode: string;      // From validate_agent_token RPC
      // ...
    };
  };
}
```

### Archivos Relacionados

| Archivo | Proposito |
|---------|-----------|
| `supabase/migrations/180_AGENT_INSTANCES.sql` | Tabla base |
| `supabase/migrations/181_AGENT_INSTANCES_STORE_CODE.sql` | Multi-branch support |
| `app/api/agent/installer/route.ts` | Genera credenciales |
| `app/api/agent/sync/route.ts` | Recibe datos con batch processing |
| `src/features/integrations/services/agent-manager.service.ts` | Servicio singleton |
| `src/features/integrations/components/LocalAgentSetupWizard.tsx` | UI wizard |
| `src/features/integrations/components/IntegrationHub.tsx` | Hub principal |

---

## TIS TIS Local Agent - Mejoras v4.8.3 (NUEVO)

### Descripcion General

Conjunto de mejoras criticas al TIS TIS Local Agent para Soft Restaurant que incluyen: validacion automatica de schema de base de datos, guia interactiva de credenciales SQL Server, y soporte para fallbacks por version de Soft Restaurant.

### FASE 1: Sistema de Validacion de Schema

Sistema que valida automaticamente la compatibilidad del schema de la base de datos Soft Restaurant antes de la primera sincronizacion. Detecta tablas faltantes, columnas requeridas y determina que funcionalidades de sincronizacion estan disponibles.

#### Arquitectura del Sistema

```
+------------------+     +--------------------+     +------------------+
|  Windows Agent   |     |  TIS TIS Cloud     |     |  Dashboard UI    |
|  SchemaValidator |     |  /api/agent/       |     |  Schema Status   |
+--------+---------+     |  validate-schema   |     +--------+---------+
         │               +----------+---------+              │
         │                          │                        │
         │ 1. Query INFORMATION_    │                        │
         │    SCHEMA tables         │                        │
         │                          │                        │
         │ 2. POST schema data      │                        │
         ├─────────────────────────>│                        │
         │                          │                        │
         │ 3. Validation result     │ 4. Store in metadata   │
         │<─────────────────────────│                        │
         │                          │                        │
         │                          │ 5. GET /api/agent/     │
         │                          │    status              │
         │                          │<───────────────────────│
         │                          │                        │
         │                          │ 6. Schema validation   │
         │                          │    results             │
         │                          │───────────────────────>│
```

#### Schema Esperado (12 Tablas)

| Tabla | Requerida | Modulo | Descripcion |
|-------|-----------|--------|-------------|
| `Ventas` | Si | sales | Tabla principal de ventas/tickets |
| `DetalleVentas` | Si | sales | Detalle de productos por venta |
| `PagosVenta` | No | sales | Pagos asociados a ventas |
| `FormasPago` | No | sales | Catalogo de formas de pago |
| `Productos` | Si | menu, sales | Catalogo de productos/platillos |
| `Categorias` | No | menu | Categorias de productos |
| `Inventario` | No | inventory | Inventario de insumos |
| `CategoriasInventario` | No | inventory | Categorias de inventario |
| `Proveedores` | No | inventory | Catalogo de proveedores |
| `Mesas` | No | tables | Configuracion de mesas |
| `Clientes` | No | sales | Catalogo de clientes |
| `Empleados` | No | sales | Catalogo de empleados/meseros |

#### API Endpoint: POST /api/agent/validate-schema

**Request Body:**
```typescript
{
  agent_id: string;
  database_name: string;
  sql_server_version?: string;
  tables: Array<{
    table_name: string;
    schema_name: string;
    columns: Array<{
      column_name: string;
      data_type: string;
      is_nullable: boolean;
    }>;
  }>;
}
```

**Response:**
```typescript
{
  success: boolean;
  validation: {
    validatedAt: string;
    databaseName: string;
    sqlServerVersion?: string;
    srVersionDetected?: string;
    tablesFound: number;
    tablesMissing: number;
    totalTablesExpected: number;
    requiredTablesMissing: string[];
    canSyncSales: boolean;
    canSyncMenu: boolean;
    canSyncInventory: boolean;
    canSyncTables: boolean;
    errors: string[];
    warnings: string[];
    tables: Array<{
      tableName: string;
      exists: boolean;
      required: boolean;
      usedFor: string[];
      missingRequiredColumns: string[];
      presentOptionalColumns: string[];
    }>;
  };
  summary: {
    status: 'success' | 'warning' | 'error';
    title: string;
    description: string;
    features: Array<{ name: string; enabled: boolean; reason?: string }>;
  };
  recommendations?: string[];
  processingTimeMs: number;
}
```

#### API Endpoint: GET /api/agent/status

**Query Parameters:**
- `agent_id` (required): ID del agente

**Response:**
```typescript
{
  success: boolean;
  agent_id: string;
  status: 'pending' | 'registered' | 'connected' | 'syncing' | 'error' | 'offline';
  machine_name: string;
  agent_version: string;
  last_heartbeat_at: string;
  last_sync_at: string;
  total_records_synced: number;
  consecutive_errors: number;
  sync_config: {
    sync_menu: boolean;
    sync_inventory: boolean;
    sync_sales: boolean;
    sync_tables: boolean;
  };
  branch_id: string;
  store_code: string;
  schema_validation: {
    success: boolean;
    validated_at: string;
    database_name: string;
    sr_version: string;
    tables_found: number;
    tables_missing: number;
    total_tables_expected: number;
    can_sync_sales: boolean;
    can_sync_menu: boolean;
    can_sync_inventory: boolean;
    can_sync_tables: boolean;
    errors: string[];
    warnings: string[];
    missing_required_tables: string[];
  } | null;
}
```

#### Componente UI: SchemaValidationStatus

Ubicacion: `/src/features/integrations/components/SchemaValidationStatus.tsx`

Componente React que muestra el estado de validacion del schema en el Step 5 del LocalAgentSetupWizard.

**Estados Visuales:**

| Estado | Descripcion | Color |
|--------|-------------|-------|
| `isValidating` | Spinner con "Validando schema de base de datos..." | Azul |
| `no validation` | "Validacion de schema pendiente" | Gris |
| `success` | "Schema validado correctamente" con features habilitados | Verde |
| `error` | "Validacion de schema fallida" con tablas faltantes | Rojo |

**Props:**
```typescript
interface SchemaValidationStatusProps {
  validation: SchemaValidationData | null;
  isValidating: boolean;
  onRetry?: () => void;
}
```

#### Servicio: SchemaValidatorService (Next.js)

Ubicacion: `/src/features/integrations/services/schema-validator.service.ts`

Servicio singleton que valida el schema enviado por el agente contra el schema esperado de Soft Restaurant.

**Metodos:**
```typescript
// Valida schema y retorna resultado detallado
validateSchema(request: ValidateSchemaRequest): ValidateSchemaResponse

// Genera resumen para UI
generateSummary(validation: SchemaValidationResult): {
  status: 'success' | 'warning' | 'error';
  title: string;
  description: string;
  features: { name: string; enabled: boolean; reason?: string }[];
}
```

#### Servicio: SchemaValidator (C# Windows Agent)

Ubicacion: `/TisTis.Agent.SoftRestaurant/src/TisTis.Agent.Core/Database/SchemaValidator.cs`

Implementacion en C# que valida el schema de SQL Server y envia los resultados al API de TIS TIS.

**Metodos:**
```csharp
// Valida schema completo de la BD
Task<SchemaValidationResult> ValidateSchemaAsync(CancellationToken ct);

// Obtiene nombre de la base de datos
string GetDatabaseName();

// Obtiene version de SQL Server
Task<string?> GetSqlServerVersionAsync(CancellationToken ct);

// Envia resultados al API de TIS TIS
Task<SchemaValidationApiResponse> SendValidationToApiAsync(
    SchemaValidationResult result, CancellationToken ct);
```

#### Tipos del Schema

Ubicacion: `/src/features/integrations/types/schema-validation.types.ts`

**Constantes:**
- `SR_EXPECTED_SCHEMA`: Array de 12 definiciones de tabla con columnas esperadas
- `SR_KNOWN_VERSIONS`: Array con caracteristicas de versiones SR 10.x, 9.x, 8.x

**Helper Functions:**
```typescript
// Tablas requeridas para un tipo de sync
getRequiredTablesForSync(syncType: 'sales' | 'menu' | 'inventory' | 'tables')

// Todas las tablas para un tipo de sync
getTablesForSync(syncType: 'sales' | 'menu' | 'inventory' | 'tables')

// Verificar si un tipo de dato coincide
isTypeMatch(actualType: string, expectedTypes: string[]): boolean
```

### FASE 2: Guia de Credenciales SQL Server

Componente interactivo que guia al usuario para obtener las credenciales de SQL Server necesarias para conectar el agente a la base de datos de Soft Restaurant.

#### Componente: CredentialsGuide

Ubicacion: `/src/features/integrations/components/CredentialsGuide.tsx`

**Metodos de Autenticacion Soportados:**

| Metodo | ID | Descripcion | Recomendado |
|--------|-----|-------------|-------------|
| SQL Server Authentication | `sql` | Usuario y contraseña de SQL Server | Si |
| Windows Authentication | `windows` | Credenciales del usuario de Windows | No |
| No se que metodo tengo | `unknown` | Guia para identificar el metodo | - |

**Caracteristicas:**

- Selector de tipo de autenticacion con radio buttons
- Secciones expandibles con instrucciones detalladas
- Bloques de codigo SQL copiables con boton de copiar
- Scripts SQL para:
  - Crear usuario de solo lectura para TIS TIS
  - Encontrar el nombre de la base de datos
  - Verificar la conexion
- Instrucciones para Windows Authentication
- Guia para identificar el tipo de autenticacion

**Integracion en LocalAgentSetupWizard:**

El componente se integra en el Step 1 (Informacion) del wizard como una seccion expandible opcional:

```typescript
// Step 1 del wizard
<ExpandableSection
  title="¿Necesitas ayuda con las credenciales?"
  icon={KeyIcon}
  defaultOpen={false}
>
  <CredentialsGuide compact />
</ExpandableSection>
```

**Props:**
```typescript
interface CredentialsGuideProps {
  onClose?: () => void;
  compact?: boolean;  // Para integracion en wizard
}
```

**Scripts SQL Incluidos:**

```sql
-- Crear usuario con permisos de solo lectura
USE master;
GO

CREATE LOGIN TisTisAgent
WITH PASSWORD = 'TuContrasenaSegura123!';
GO

USE SoftRestaurant;
GO

CREATE USER TisTisAgent FOR LOGIN TisTisAgent;
EXEC sp_addrolemember 'db_datareader', 'TisTisAgent';
GO
```

```sql
-- Encontrar la base de datos de Soft Restaurant
SELECT name
FROM sys.databases
WHERE name LIKE '%Soft%'
   OR name LIKE '%Restaurant%'
   OR name LIKE '%SR%';
```

### FASE 3: Fallbacks por Version de Soft Restaurant

Sistema que detecta automaticamente la version de Soft Restaurant y adapta las queries SQL segun las capacidades del schema.

#### Versiones Detectadas

| Version | Identificador | Soportado | Caracteristicas |
|---------|---------------|-----------|-----------------|
| SR 10.x | `V10` | Si | Full feature set: Moneda, TipoOrden, NumeroComensales, PagosVenta |
| SR 9.x | `V9` | Si | Sin Moneda ni TipoOrden, con NumeroComensales y PagosVenta |
| SR 8.x | `V8` | No | Legacy - Sin NumeroComensales ni PagosVenta |
| Unknown | `Unknown` | Si | Queries conservadoras |

#### Servicio: SRVersionQueryProvider

Ubicacion: `/TisTis.Agent.SoftRestaurant/src/TisTis.Agent.Core/Database/SRVersionQueryProvider.cs`

**Deteccion de Version:**
```csharp
public static SRVersion DetectVersion(
    bool hasMoneda,
    bool hasTipoOrden,
    bool hasNumeroComensales,
    bool hasPagosVenta)
{
    // V10: Has all modern columns
    if (hasMoneda && hasTipoOrden && hasNumeroComensales && hasPagosVenta)
        return SRVersion.V10;

    // V9: Missing Moneda and TipoOrden but has NumeroComensales
    if (!hasMoneda && !hasTipoOrden && hasNumeroComensales && hasPagosVenta)
        return SRVersion.V9;

    // V8: Legacy - missing many columns
    if (!hasNumeroComensales && !hasPagosVenta)
        return SRVersion.V8;

    return SRVersion.Unknown;
}
```

**Queries Adaptativas:**

El proveedor genera queries SQL que se adaptan automaticamente a las capacidades del schema:

```csharp
// Constructor con version y store_code para multi-sucursal
public SRVersionQueryProvider(SRVersion version, string? storeCode = null)

// Queries disponibles
string GetVentasQuery();           // Full query con JOINs
string GetVentasQuerySimplified(); // Sin JOINs (fallback)
string GetProductosQuery(bool includeInactive);
string? GetInventarioQuery();      // null si no soportado
string? GetMesasQuery();           // null si no soportado
string? GetPagosQuery();           // null si no soportado
string GetDetallesQuery();
string GetDetallesQuerySimplified();
```

**Ejemplo de Query Adaptativa:**
```csharp
// Para V10: Incluye todas las columnas
var monedaColumn = _capabilities.HasMonedaColumn
    ? "ISNULL(v.Moneda, 'MXN') AS Moneda"
    : "'MXN' AS Moneda";

var tipoOrdenColumn = _capabilities.HasTipoOrdenColumn
    ? "ISNULL(v.TipoOrden, 1) AS TipoOrden"
    : "1 AS TipoOrden";
```

#### Interface: ISchemaValidator Actualizada

```csharp
public class SchemaValidationResult
{
    // ... campos existentes ...

    /// <summary>
    /// Detected Soft Restaurant version based on schema analysis
    /// </summary>
    public SRVersion DetectedVersion { get; set; } = SRVersion.Unknown;

    /// <summary>
    /// Detected version as display string
    /// </summary>
    public string DetectedVersionDisplay => DetectedVersion switch
    {
        SRVersion.V10 => "SR 10.x",
        SRVersion.V9 => "SR 9.x",
        SRVersion.V8 => "SR 8.x",
        _ => "Version desconocida"
    };
}
```

### Archivos del Sistema v4.8.3

| Archivo | Proposito |
|---------|-----------|
| `src/features/integrations/types/schema-validation.types.ts` | Tipos y constantes del schema esperado |
| `src/features/integrations/services/schema-validator.service.ts` | Servicio de validacion Next.js |
| `app/api/agent/validate-schema/route.ts` | Endpoint API para validacion |
| `app/api/agent/status/route.ts` | Endpoint para obtener estado del agente |
| `src/features/integrations/components/SchemaValidationStatus.tsx` | UI de estado de validacion |
| `src/features/integrations/components/CredentialsGuide.tsx` | Guia de credenciales SQL |
| `TisTis.Agent.SoftRestaurant/.../ISchemaValidator.cs` | Interface del validador C# |
| `TisTis.Agent.SoftRestaurant/.../SchemaValidator.cs` | Implementacion del validador C# |
| `TisTis.Agent.SoftRestaurant/.../SRVersionQueryProvider.cs` | Proveedor de queries por version |

### Flujo de Validacion Completo

```
1. Usuario completa wizard de setup
    ↓
2. Descarga e instala el agente Windows
    ↓
3. Agente se conecta a SQL Server
    ↓
4. SchemaValidator.cs ejecuta query en INFORMATION_SCHEMA
    ↓
5. Detecta version de SR basado en columnas presentes
    ↓
6. POST /api/agent/validate-schema con schema completo
    ↓
7. SchemaValidatorService valida contra SR_EXPECTED_SCHEMA
    ↓
8. Resultado almacenado en agent_instances.metadata
    ↓
9. Dashboard muestra SchemaValidationStatus en Step 5
    ↓
10. AgentWorker usa SRVersionQueryProvider para queries adaptadas
```

---

## Soft Restaurant Cloud Integration (v4.8.4 - NUEVO)

### Descripcion

Soporte para Soft Restaurant Cloud (SaaS), la version hospedada por National Soft. A diferencia de SR Local que usa un agente Windows con acceso directo a SQL Server, SR Cloud se integra via API REST oficial con limitaciones significativas en las funcionalidades disponibles.

### Comparacion SR Local vs SR Cloud

| Caracteristica | SR Local | SR Cloud |
|---------------|----------|----------|
| **Base de datos** | SQL Server local | Nube (National Soft) |
| **Menu y Productos** | Disponible | Disponible |
| **Inventario** | Disponible | NO disponible |
| **Ventas detalladas** | Disponible | NO disponible |
| **Mesas/Plano** | Disponible | NO disponible |
| **Recetas/Gramaje** | Disponible | NO disponible |
| **Reservaciones** | Disponible | NO disponible |
| **Metodo integracion** | TIS TIS Local Agent | API REST oficial |
| **Conexion internet** | No requerida | Obligatoria |
| **Tiempo offline max** | Ilimitado | 48 horas |
| **Requiere licencia** | SQL Server | ERP/PMS National Soft |

### Arquitectura del Sistema

```
+-------------------+     +----------------------+     +------------------+
|   Dashboard UI    |     |  TIS TIS Cloud API   |     |  SR Cloud API    |
|  SRDeploymentSel  |     |  /api/integrations/  |     |  (National Soft) |
|                   |     |  softrestaurant/     |     |                  |
+--------+----------+     |  cloud               |     +--------+---------+
         │                +----------+-----------+              │
         │                           │                          │
         │ 1. Select SR Cloud        │                          │
         ├──────────────────────────>│                          │
         │                           │                          │
         │ 2. Enter API Key          │                          │
         ├──────────────────────────>│                          │
         │                           │                          │
         │                           │ 3. Test Connection       │
         │                           ├─────────────────────────>│
         │                           │                          │
         │                           │ 4. Account Info          │
         │                           │<─────────────────────────│
         │                           │                          │
         │ 5. Connection Result      │                          │
         │<──────────────────────────│                          │
         │                           │                          │
         │ 6. Sync Menu              │                          │
         ├──────────────────────────>│                          │
         │                           │                          │
         │                           │ 7. GET /v1/menu/items    │
         │                           ├─────────────────────────>│
         │                           │                          │
         │                           │ 8. Menu items            │
         │                           │<─────────────────────────│
         │                           │                          │
         │ 9. Menu synced            │                          │
         │<──────────────────────────│                          │
```

### Tipos de Deployment

```typescript
// integration.types.ts

/**
 * Soft Restaurant deployment type
 * - local: Traditional on-premise installation with SQL Server
 * - cloud: Soft Restaurant Cloud (SaaS) hosted by National Soft
 */
export type SRDeploymentType = 'local' | 'cloud';

/**
 * SR Cloud connection status
 */
export type SRCloudConnectionStatus =
  | 'pending'       // Waiting for API key configuration
  | 'validating'    // Testing API connection
  | 'connected'     // Successfully connected
  | 'error'         // Connection failed
  | 'suspended';    // Account suspended by National Soft
```

### Constante de Capacidades

```typescript
// integration.types.ts

export const SR_DEPLOYMENT_CAPABILITIES: Record<SRDeploymentType, SRDeploymentCapabilities> = {
  local: {
    deploymentType: 'local',
    displayName: 'Soft Restaurant Local',
    description: 'Instalacion on-premise con SQL Server local',
    capabilities: {
      syncMenu: true,
      syncInventory: true,
      syncSales: true,
      syncTables: true,
      syncReservations: false,
      syncRecipes: true,
    },
    integrationMethod: 'local_agent',
    notes: [
      'Requiere TIS TIS Local Agent instalado en el servidor',
      'Acceso directo a SQL Server con permisos de lectura',
      'Sincronizacion completa de datos',
      'Funciona sin conexion a internet',
    ],
    supportedVersions: ['SR 10.x', 'SR 11.x', 'SR 12.x'],
  },
  cloud: {
    deploymentType: 'cloud',
    displayName: 'Soft Restaurant Cloud',
    description: 'Version cloud hospedada por National Soft',
    capabilities: {
      syncMenu: true,          // Via API oficial
      syncInventory: false,    // NO DISPONIBLE en SR Cloud actualmente
      syncSales: false,        // Limitado via API oficial
      syncTables: false,       // NO DISPONIBLE en SR Cloud
      syncReservations: false, // NO DISPONIBLE en SR Cloud
      syncRecipes: false,      // NO DISPONIBLE en SR Cloud
    },
    integrationMethod: 'cloud_api',
    notes: [
      'Usa API REST oficial de National Soft',
      'Solo sincronizacion de menu disponible actualmente',
      'Inventario NO disponible en SR Cloud',
      'Requiere licencia ERP/PMS activa',
      'Conexion a internet obligatoria',
    ],
    supportedVersions: ['SR Cloud'],
  },
};
```

### Tipos de Respuesta API SR Cloud

```typescript
// integration.types.ts

export interface SRCloudConfig {
  apiKey: string;
  apiSecret?: string;
  accountId?: string;
  accountName?: string;
  apiBaseUrl: string;  // Default: https://api.softrestaurant.com.mx
  status: SRCloudConnectionStatus;
  lastValidatedAt?: string;
  syncMenuEnabled: boolean;
  syncFrequencyMinutes: number;
  metadata?: Record<string, unknown>;
}

export interface SRCloudMenuResponse {
  success: boolean;
  data?: {
    items: SRCloudMenuItem[];
    categories: SRCloudCategory[];
    lastUpdated: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface SRCloudMenuItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoriaId: string;
  categoriaNombre?: string;
  activo: boolean;
  imagen?: string;
  modificadores?: SRCloudModifier[];
}

export interface SRCloudCategory {
  id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  activa: boolean;
  imagen?: string;
}

export interface SRCloudModifier {
  id: string;
  nombre: string;
  precio: number;
  obligatorio: boolean;
}
```

### Servicio: SoftRestaurantCloudService

Ubicacion: `/src/features/integrations/services/soft-restaurant-cloud.service.ts`

Servicio singleton para conectar con la API oficial de SR Cloud.

**Metodos Disponibles:**

```typescript
import { getSoftRestaurantCloudService } from '@/src/features/integrations';

const srCloudService = getSoftRestaurantCloudService();

// Test connection with API key
const result = await srCloudService.testConnection(apiKey, apiBaseUrl?);
// Returns: SRCloudConnectionTestResult

// Validate API key
const { isValid, errorCode } = await srCloudService.validateApiKey(apiKey);

// Fetch menu from SR Cloud
const menuResult = await srCloudService.fetchMenu(apiKey, apiBaseUrl?);
// Returns: SRCloudMenuResponse

// Check feature availability
const canSyncInventory = srCloudService.isFeatureAvailable('inventory');
// Returns: false (not available in SR Cloud)

// Get list of limitations
const limitations = srCloudService.getCloudLimitations();
// Returns: string[] with limitation descriptions
```

**Codigos de Error:**

```typescript
export const SR_CLOUD_ERROR_CODES = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};
```

### API Endpoint: /api/integrations/softrestaurant/cloud

Ubicacion: `/app/api/integrations/softrestaurant/cloud/route.ts`

**POST Actions:**

| Action | Descripcion | Parametros |
|--------|-------------|------------|
| `test_connection` | Prueba conexion con SR Cloud | `apiKey`, `apiBaseUrl?` |
| `sync_menu` | Sincroniza menu desde SR Cloud | `apiKey`, `apiBaseUrl?`, `integrationId` |
| `get_limitations` | Obtiene limitaciones de SR Cloud | - |

**Ejemplo Request - Test Connection:**
```typescript
POST /api/integrations/softrestaurant/cloud
{
  "action": "test_connection",
  "apiKey": "your-sr-cloud-api-key"
}
```

**Ejemplo Response - Success:**
```typescript
{
  "success": true,
  "message": "Conexion exitosa con Soft Restaurant Cloud",
  "status": "connected",
  "details": {
    "apiVersion": "v1",
    "accountName": "Mi Restaurante",
    "accountId": "12345",
    "responseTimeMs": 234
  },
  "limitations": [
    "Inventario NO disponible - SR Cloud no incluye modulo de inventarios",
    "Ventas limitadas - Solo resumen basico disponible via API",
    // ... more limitations
  ]
}
```

**GET - Obtener Limitaciones:**
```typescript
GET /api/integrations/softrestaurant/cloud

Response:
{
  "success": true,
  "limitations": ["..."],
  "availableFeatures": {
    "menu": true,
    "inventory": false,
    "sales": false,
    "tables": false,
    "reservations": false,
    "recipes": false
  },
  "recommendation": "Para acceso completo a datos (inventario, ventas detalladas, mesas), recomendamos usar Soft Restaurant Local con el TIS TIS Local Agent."
}
```

### Componente: SRDeploymentSelector

Ubicacion: `/src/features/integrations/components/SRDeploymentSelector.tsx`

Componente React que permite al usuario seleccionar entre SR Local y SR Cloud durante el proceso de configuracion de integracion.

**Props:**
```typescript
interface SRDeploymentSelectorProps {
  onSelect: (type: SRDeploymentType) => void;
  selectedType?: SRDeploymentType;
  showBackButton?: boolean;
  onBack?: () => void;
}
```

**Caracteristicas:**

- Cards seleccionables para Local y Cloud
- Badge "Recomendado" en SR Local
- Indicador visual de funcionalidades disponibles (5/5 vs 1/5)
- Checkmarks verdes para funciones disponibles
- X grises tachadas para funciones no disponibles
- Warning box con limitaciones de SR Cloud
- Texto de ayuda para identificar tipo de instalacion
- Botones de navegacion (Atras/Continuar)
- Dark mode completo

**Estados Visuales:**

| Estado | Descripcion |
|--------|-------------|
| No seleccionado | Ambas tarjetas con borde gris |
| Local seleccionado | Tarjeta Local con borde coral y fondo gradiente |
| Cloud seleccionado | Tarjeta Cloud con borde coral, warning visible |

**Flujo de Usuario:**

1. Usuario llega al selector de tipo de deployment
2. Ve dos opciones: Local (recomendado) y Cloud
3. Puede ver funcionalidades disponibles para cada opcion
4. Al seleccionar Cloud, ve warning con limitaciones
5. Click en "Continuar" para proceder con la configuracion

### Limitaciones de SR Cloud (Importante)

Las siguientes funcionalidades NO estan disponibles cuando se usa SR Cloud:

1. **Inventario** - SR Cloud no incluye modulo de inventarios en su API
2. **Ventas Detalladas** - Solo resumen basico disponible via API
3. **Mesas/Plano** - Funcion no incluida en SR Cloud
4. **Reservaciones** - No soportado por API
5. **Recetas con Gramaje** - Requiere acceso directo a SQL Server
6. **Operacion Offline** - Requiere conexion a internet permanente

**Tiempo maximo offline:** 48 horas (segun politicas de National Soft)

**Requisito de licencia:** Licencia ERP/PMS activa con National Soft

### Archivos del Sistema v4.8.4

| Archivo | Proposito |
|---------|-----------|
| `src/features/integrations/types/integration.types.ts` | Tipos SRDeploymentType, SRCloudConfig, etc. |
| `src/features/integrations/services/soft-restaurant-cloud.service.ts` | Servicio singleton SR Cloud |
| `app/api/integrations/softrestaurant/cloud/route.ts` | API endpoint SR Cloud |
| `src/features/integrations/components/SRDeploymentSelector.tsx` | UI selector de deployment |

### Flujo de Decision de Integracion

```
Usuario quiere integrar Soft Restaurant
    |
    v
SRDeploymentSelector
    |
    +-- Selecciona "Local" --> LocalAgentSetupWizard --> Full features
    |
    +-- Selecciona "Cloud" --> SRCloudConfigModal --> Menu only
                                     |
                                     v
                              Enter API Key
                                     |
                                     v
                              Test Connection
                                     |
                              +------+------+
                              |             |
                           Success        Error
                              |             |
                              v             v
                         Sync Menu     Show Error
                              |
                              v
                         Integration Active
                         (Menu sync only)
```

### Recomendaciones para Usuarios

Siempre que sea posible, recomendar SR Local por las siguientes razones:

1. **Acceso completo a datos** - Inventario, ventas, mesas, recetas
2. **Operacion offline** - No depende de internet
3. **Sincronizacion en tiempo real** - Datos actualizados cada 5 minutos
4. **Sin limitaciones de API** - Acceso directo a SQL Server

SR Cloud solo se recomienda cuando:

1. El restaurante ya usa SR Cloud exclusivamente
2. No tienen servidor Windows para el Local Agent
3. Solo necesitan sincronizar el menu

---

## Restaurant Data Cache System (v4.8.2)

### Descripcion

Sistema de cache centralizado para datos de restaurante que implementa el patron stale-while-revalidate. Permite navegacion instantanea entre pestanas (Mesas, Inventario, Menu, Cocina) mostrando datos cacheados mientras se refrescan en background.

### Arquitectura del Sistema

```
+------------------+     +----------------------+     +------------------+
|   Restaurant     |     |  restaurantDataStore |     |   Supabase DB    |
|   Tab Components |     |  (Zustand + Cache)   |     |                  |
+--------+---------+     +----------+-----------+     +--------+---------+
         │                          │                          │
         │ useCachedTables()        │                          │
         ├─────────────────────────>│                          │
         │                          │                          │
         │ Cached Data (instant)    │                          │
         │<─────────────────────────│                          │
         │                          │                          │
         │                          │ Check staleness          │
         │                          │ (> 30s default)          │
         │                          │                          │
         │                          │ Background fetch         │
         │                          ├─────────────────────────>│
         │                          │                          │
         │                          │ Fresh data               │
         │                          │<─────────────────────────│
         │                          │                          │
         │ Updated Data (reactive)  │ Update cache             │
         │<─────────────────────────│                          │
         │                          │                          │
```

### Caracteristicas Principales

| Caracteristica | Descripcion |
|---------------|-------------|
| **Stale-While-Revalidate** | Muestra datos cacheados inmediatamente, refresca en background si estan stale |
| **Branch-Aware** | El cache se invalida automaticamente al cambiar de sucursal |
| **Configurable Staleness** | Tiempo de staleness configurable (default: 30 segundos) |
| **Real-time Compatible** | Las actualizaciones en tiempo real actualizan el cache |
| **Memory Efficient** | Limpia cache de sucursales no utilizadas |

### Store Principal: restaurantDataStore

Ubicacion: `/src/shared/stores/restaurantDataStore.ts`

```typescript
import { useRestaurantDataStore, useCachedTables, useCachedInventory, useCachedMenu, useCachedKitchen } from '@/src/shared/stores';

// Hooks de selector para datos cacheados
const { data: tables, lastFetch, isStale } = useCachedTables(branchId);
const { data: inventory } = useCachedInventory(branchId);
const { data: menu } = useCachedMenu(branchId);
const { data: kitchen } = useCachedKitchen(branchId);

// Acceso al store completo
const store = useRestaurantDataStore();

// Limpiar todo el cache
store.clearAllCache();

// Limpiar cache de una sucursal especifica
store.clearBranchCache(branchId);
```

### Tipos del Store

```typescript
interface CacheEntry<T> {
  data: T;
  lastFetch: number;        // timestamp
  isStale: boolean;         // calculado: Date.now() - lastFetch > STALE_TIME
}

interface BranchCache {
  tables?: CacheEntry<Table[]>;
  inventory?: CacheEntry<InventoryItem[]>;
  menu?: CacheEntry<MenuItem[]>;
  kitchen?: CacheEntry<KitchenOrder[]>;
}

interface RestaurantDataState {
  cache: Record<string, BranchCache>;  // branchId -> BranchCache

  // Setters
  setTables: (branchId: string, data: Table[]) => void;
  setInventory: (branchId: string, data: InventoryItem[]) => void;
  setMenu: (branchId: string, data: MenuItem[]) => void;
  setKitchen: (branchId: string, data: KitchenOrder[]) => void;

  // Getters con staleness check
  getTables: (branchId: string) => CacheEntry<Table[]> | undefined;
  getInventory: (branchId: string) => CacheEntry<InventoryItem[]> | undefined;
  getMenu: (branchId: string) => CacheEntry<MenuItem[]> | undefined;
  getKitchen: (branchId: string) => CacheEntry<KitchenOrder[]> | undefined;

  // Cache management
  clearBranchCache: (branchId: string) => void;
  clearAllCache: () => void;
}
```

### Hooks de Selector Disponibles

| Hook | Datos | Uso |
|------|-------|-----|
| `useCachedTables(branchId)` | Mesas del restaurante | Vista de mesas, estado de ocupacion |
| `useCachedInventory(branchId)` | Inventario de productos | Control de stock, alertas de bajo inventario |
| `useCachedMenu(branchId)` | Menu y platillos | Catalogo de productos, precios |
| `useCachedKitchen(branchId)` | Ordenes de cocina | Vista de cocina, ordenes pendientes |

### Integracion en Hooks de Feature

Cada hook de feature (useTables, useInventory, useMenu, useKitchen) fue actualizado para usar el cache:

```typescript
// src/features/restaurant-tables/hooks/useTables.ts
import { useCachedTables, useRestaurantDataStore } from '@/src/shared/stores';

export function useTables(branchId: string) {
  const cached = useCachedTables(branchId);
  const setTables = useRestaurantDataStore(state => state.setTables);

  const [tables, setLocalTables] = useState<Table[]>(cached?.data || []);
  const [isLoading, setIsLoading] = useState(!cached?.data);

  useEffect(() => {
    // Si hay cache y no esta stale, usar cache
    if (cached?.data && !cached.isStale) {
      setLocalTables(cached.data);
      setIsLoading(false);
      return;
    }

    // Si hay cache pero esta stale, mostrar cache y refrescar en background
    if (cached?.data && cached.isStale) {
      setLocalTables(cached.data);
      setIsLoading(false);
      // Background refresh (no blocking)
      fetchTables().then(data => {
        setTables(branchId, data);
        setLocalTables(data);
      });
      return;
    }

    // Sin cache, fetch blocking
    setIsLoading(true);
    fetchTables().then(data => {
      setTables(branchId, data);
      setLocalTables(data);
      setIsLoading(false);
    });
  }, [branchId, cached]);

  // Real-time updates tambien actualizan el cache
  useEffect(() => {
    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { ... }, payload => {
        // Update local state AND cache
        const updated = [...tables, payload.new];
        setLocalTables(updated);
        setTables(branchId, updated);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [branchId]);

  return { tables, isLoading, ... };
}
```

### Configuracion de Staleness

```typescript
// En restaurantDataStore.ts
const STALE_TIME_MS = 30 * 1000; // 30 segundos por defecto

// Para cambiar el tiempo de staleness, modificar esta constante
// o implementar configuracion por tipo de dato si es necesario
```

### Flujo de Navegacion entre Pestanas

```
Usuario en Tab "Mesas"
    ↓
Navega a Tab "Inventario"
    ↓
useCachedInventory(branchId) → Cache HIT → Datos instantaneos
    ↓
isStale check → true (> 30s desde ultimo fetch)
    ↓
Background fetch → Supabase query
    ↓
Cache update → UI reactivamente actualizada
    ↓
Usuario regresa a Tab "Mesas"
    ↓
useCachedTables(branchId) → Cache HIT → Datos instantaneos (< 30s)
    ↓
No background fetch (datos frescos)
```

### Cambio de Sucursal

```
Usuario cambia de sucursal (BranchSelector)
    ↓
branchId cambia
    ↓
Hooks detectan nuevo branchId
    ↓
Cache MISS para nueva sucursal
    ↓
Fetch inicial para nueva sucursal
    ↓
Cache poblado para nueva sucursal
```

### Archivos del Sistema

| Archivo | Proposito |
|---------|-----------|
| `src/shared/stores/restaurantDataStore.ts` | Store Zustand centralizado |
| `src/shared/stores/index.ts` | Barrel exports |
| `src/features/restaurant-tables/hooks/useTables.ts` | Hook de mesas con cache |
| `src/features/restaurant-inventory/hooks/useInventory.ts` | Hook de inventario con cache |
| `src/features/restaurant-menu/hooks/useMenu.ts` | Hook de menu con cache |
| `src/features/restaurant-kitchen/hooks/useKitchen.ts` | Hook de cocina con cache |

### Beneficios de Performance

| Metrica | Sin Cache | Con Cache |
|---------|-----------|-----------|
| **Tiempo de carga inicial** | 200-500ms | 200-500ms |
| **Navegacion entre tabs** | 200-500ms | < 10ms |
| **Cambio de sucursal** | 200-500ms | 200-500ms |
| **Re-render en background** | N/A | Sin bloqueo de UI |

### Consideraciones de Memoria

- El cache se mantiene en memoria mientras la aplicacion esta activa
- Se recomienda limpiar el cache al hacer logout (`clearAllCache()`)
- Para sucursales con muchos datos, considerar implementar limpieza automatica de sucursales no visitadas en X minutos

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

-- Local Agent System (NUEVO v4.8.1)
agent_instances, agent_sync_logs, sr_sales

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
| `180_AGENT_INSTANCES.sql` | TIS TIS Local Agent base |
| `181_AGENT_INSTANCES_STORE_CODE.sql` | Multi-branch store_code support |

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

# PDFShift (Report PDF Generation)
PDFSHIFT_API_URL=https://api.pdfshift.io/v3/convert/pdf
PDFSHIFT_API_KEY=
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
- `/supabase/migrations/180_AGENT_INSTANCES.sql` - TIS TIS Local Agent base
- `/supabase/migrations/181_AGENT_INSTANCES_STORE_CODE.sql` - Multi-branch store_code support
- `/src/features/admin-channel/` - Codigo fuente del feature backend
- `/src/features/settings/components/AdminChannelSection.tsx` - Componente UI (FASE 6)
- `/src/features/reports/` - Sistema de Reportes PDF (v4.8.0)
- `/src/features/integrations/services/agent-manager.service.ts` - Servicio de gestion de agentes
- `/src/features/integrations/services/schema-validator.service.ts` - Servicio de validacion de schema (v4.8.3)
- `/src/features/integrations/services/soft-restaurant-cloud.service.ts` - Servicio SR Cloud API (v4.8.4)
- `/src/features/integrations/types/schema-validation.types.ts` - Tipos del sistema de validacion (v4.8.3)
- `/src/features/integrations/components/LocalAgentSetupWizard.tsx` - Wizard de configuracion
- `/src/features/integrations/components/SchemaValidationStatus.tsx` - UI de estado de validacion (v4.8.3)
- `/src/features/integrations/components/CredentialsGuide.tsx` - Guia de credenciales SQL (v4.8.3)
- `/src/features/integrations/components/SRDeploymentSelector.tsx` - Selector Local vs Cloud (v4.8.4)
- `/app/api/agent/` - Endpoints del Local Agent (installer, sync, heartbeat, validate-schema, status)
- `/app/api/integrations/softrestaurant/cloud/` - Endpoint SR Cloud API (v4.8.4)
- `/TisTis.Agent.SoftRestaurant/` - Codigo fuente del agente Windows C#
- `/app/api/reports/generate/route.ts` - API endpoint de generacion
- `/src/shared/stores/restaurantDataStore.ts` - Cache centralizado para restaurante (v4.8.2)
- `/src/features/restaurant-tables/hooks/useTables.ts` - Hook de mesas con cache
- `/src/features/restaurant-inventory/hooks/useInventory.ts` - Hook de inventario con cache
- `/src/features/restaurant-menu/hooks/useMenu.ts` - Hook de menu con cache
- `/src/features/restaurant-kitchen/hooks/useKitchen.ts` - Hook de cocina con cache
- `/docs/API.md` - API general del proyecto
- `/docs/INTEGRATION_GUIDE.md` - Guia de integraciones

---

*Este archivo es la fuente de verdad para desarrollo en TIS TIS Platform. Todas las decisiones de codigo deben alinearse con estos principios.*

*Ultima actualizacion: 30 de Enero, 2026*
*Version: 4.8.4 - Soft Restaurant Cloud Integration: API REST, Deployment Selector, SR Local vs Cloud*
