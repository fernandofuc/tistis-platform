# Admin Channel System - Documentacion Completa

**Version:** 4.7.0
**Fase:** 1 - Foundation + Database
**Estado:** Implementado y listo para testing
**Ultima actualizacion:** Enero 25, 2026

---

## Tabla de Contenidos

1. [Descripcion General](#descripcion-general)
2. [Arquitectura](#arquitectura)
3. [Base de Datos](#base-de-datos)
4. [Tipos de Datos](#tipos-de-datos)
5. [Servicios](#servicios)
6. [Flujos de Trabajo](#flujos-de-trabajo)
7. [Intents y Acciones](#intents-y-acciones)
8. [Seguridad](#seguridad)
9. [Rate Limiting](#rate-limiting)
10. [Auditoria](#auditoria)
11. [Testing](#testing-guia)
12. [Proximas Fases](#proximas-fases)

---

## Descripcion General

El **Admin Channel System** es un sistema de comunicacion bidireccional que permite a clientes empresariales (B2B) de TIS TIS interactuar con sus instancias via WhatsApp y Telegram.

### Proposito

Proporcionar a administradores y gerentes de negocios una interfaz conversacional para:
- Consultar metricas y analytics en tiempo real
- Configurar parametros del negocio sin entrar al dashboard
- Recibir alertas y notificaciones proactivas
- Ejecutar acciones operativas rapidas

### Usuarios Objetivo

- **Propietarios de negocios** - Consultan ventas, leads, reservaciones
- **Gerentes de sucursales** - Gestionan horarios, personal, inventario
- **Administradores** - Configuran servicios, precios, promociones
- **Emprendedores** - Monitorean negocio mientras estan en campo

### Beneficios

- **Accesibilidad** - Sin necesidad de acceder a dashboard
- **Velocidad** - Acciones en segundos via chat
- **Notificaciones** - Alertas proactivas de eventos importantes
- **Control** - Cambios configurables desde cualquier lugar
- **Auditoria** - Log completo de todas las acciones

---

## Arquitectura

### Flujo de Componentes

```
Usuario (WhatsApp/Telegram)
    ↓
Webhook de Canal (Meta/Telegram)
    ↓
API Routes (app/api/admin-channel/*) [FASE 2]
    ↓
Admin Channel Service (singleton)
    ├→ User Manager
    ├→ Conversation Manager
    ├→ Message Processor
    ├→ Notification Manager
    └→ Audit Logger
    ↓
Database (Supabase PostgreSQL)
    ├→ admin_channel_users
    ├→ admin_channel_conversations
    ├→ admin_channel_messages
    ├→ admin_channel_notifications
    └→ admin_channel_audit_log
```

### Flujo de Mensajes

```
1. VINCULACION (Link Code)
   Usuario: "Hola"
   Sistema: "Bienvenido a TIS TIS Admin Channel"
             "Tu codigo de vinculacion es: 123456"
             "Valido por 15 minutos"

2. VERIFICACION (Link Code)
   Usuario: "123456"
   Sistema: "Codigo verificado! Tu cuenta esta activa"
            "Que necesitas hoy?"

3. CONVERSA (Intent Detection)
   Usuario: "Cuantos leads hoy?"
   Sistema: [Detecta intent: analytics_daily_summary]
            [Carga datos de tenant]
            [Consulta BD]
            [Responde con analytics]
            "Hoy tienes 5 leads nuevos
             3 conversiones
             Total: MXN $1,500"

4. ACCION (Confirm + Execute)
   Usuario: "Cambia el precio de la cita a $500"
   Sistema: [Detecta intent: config_prices]
            [Pide confirmacion]
            "Quieres cambiar Cita a MXN $500? S/N"

   Usuario: "Si"
   Sistema: [Ejecuta cambio]
            "Precio actualizado: Cita = MXN $500"
            [Log en audit_log]
```

### Estados de Conversacion

```
PENDING (pendiente verificacion)
  └→ usuario creado, link_code generado
  └→ esperando verify_admin_link_code

ACTIVE (conversacion en curso)
  └→ usuario verificado, conversacion activa
  └→ puede enviar mensajes
  └→ sistema procesa intents

PENDING_ACTION (esperando confirmacion)
  └→ usuario solicito cambio (config)
  └→ sistema espera confirmacion
  └→ timeout: 5 minutos

RESOLVED (conversacion completada)
  └→ objetivo de conversacion logrado
  └→ usuario puede continuar o cerrar

ARCHIVED (historial)
  └→ conversacion cerrada/archivada
  └→ acceso solo lectura
```

---

## Base de Datos

### Migracion SQL

Archivo: `/supabase/migrations/177_ADMIN_CHANNEL_SYSTEM.sql`

Incluye:
- 8 ENUMS (tipos de datos)
- 5 Tablas principales
- RLS Policies con tenant isolation
- 6 RPCs (Remote Procedure Calls)
- Triggers para updated_at
- Indices optimizados

### Diagrama ER (Simplificado)

```
tenants (1)
   ↓
   ├→ (1) admin_channel_users (*)
   │       ├→ (1) admin_channel_conversations (*)
   │       │       ├→ (1) admin_channel_messages (*)
   │       │       └→ pendingAction (JSON)
   │       │
   │       └→ (1) admin_channel_notifications (*)
   │
   └→ (1) admin_channel_audit_log (*)
```

### Tablas Detalladas

#### admin_channel_users

Usuarios vinculados al sistema admin channel.

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `id` | UUID | Identificador unico |
| `tenant_id` | UUID | Cliente (FK) |
| `staff_id` | UUID | Personal vinculado (opcional) |
| `phone_normalized` | VARCHAR | Numero normalizado WhatsApp |
| `telegram_user_id` | VARCHAR | ID de usuario Telegram |
| `status` | ENUM | pending, active, suspended, blocked |
| `link_code` | VARCHAR | Codigo de 6 digitos |
| `link_code_expires_at` | TIMESTAMPTZ | Expiracion de codigo |
| `linked_at` | TIMESTAMPTZ | Cuando se verifico |
| `can_view_analytics` | BOOLEAN | Permiso de lectura |
| `can_configure` | BOOLEAN | Permiso de cambios |
| `can_receive_notifications` | BOOLEAN | Recibir alertas |
| `messages_today` | INTEGER | Contador rate limit (dia) |
| `messages_this_hour` | INTEGER | Contador rate limit (hora) |
| `rate_limit_reset_at` | TIMESTAMPTZ | Cuando resetear |

**Unique Constraints:**
- `(tenant_id, phone_normalized)`
- `(tenant_id, telegram_user_id)`

**Check Constraints:**
- At least one of: `phone_normalized`, `telegram_user_id`

#### admin_channel_conversations

Conversaciones activas entre usuario y sistema.

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `id` | UUID | Identificador unico |
| `tenant_id` | UUID | Cliente (FK) |
| `user_id` | UUID | Usuario (FK) |
| `channel` | ENUM | whatsapp, telegram |
| `channel_conversation_id` | VARCHAR | ID externo del canal |
| `status` | ENUM | active, resolved, archived |
| `current_intent` | VARCHAR | Ultimo intent procesado |
| `pending_action` | JSONB | Confirmacion pendiente |
| `context` | JSONB | Estado LangGraph |
| `message_count` | INTEGER | Cantidad de mensajes |
| `last_user_message_at` | TIMESTAMPTZ | Actividad usuario |
| `last_bot_message_at` | TIMESTAMPTZ | Actividad sistema |

**Context JSONB Structure:**
```json
{
  "lastIntent": "analytics_daily_summary",
  "mentionedEntities": {
    "services": ["Cita", "Limpieza"],
    "dates": ["hoy", "esta semana"],
    "amounts": [500, 1000]
  },
  "sessionPreferences": {
    "verboseMode": false,
    "language": "es"
  },
  "businessData": {
    "tenantName": "ESVA Dental",
    "vertical": "dental",
    "branchCount": 3
  }
}
```

#### admin_channel_messages

Historial de mensajes.

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `id` | UUID | Identificador unico |
| `conversation_id` | UUID | Conversacion (FK) |
| `role` | ENUM | user, assistant, system |
| `content` | TEXT | Contenido del mensaje |
| `content_type` | ENUM | text, image, document, template |
| `channel_message_id` | VARCHAR | ID externo del canal |
| `detected_intent` | VARCHAR | Intent detectado |
| `intent_confidence` | NUMERIC | Confianza (0-1) |
| `extracted_data` | JSONB | Datos extraidos (entidades) |
| `actions_executed` | JSONB[] | Cambios realizados |
| `status` | ENUM | pending, sent, delivered, read, failed |

**Extracted Data JSONB:**
```json
{
  "service_name": "Cita",
  "new_price": 500,
  "service_id": "uuid",
  "branch_id": "uuid",
  "user_mentioned": "Dr. Perez"
}
```

**Actions Executed JSONB:**
```json
[
  {
    "type": "update_price",
    "entityType": "service",
    "entityId": "uuid",
    "success": true,
    "executedAt": "2026-01-25T10:30:00Z"
  }
]
```

#### admin_channel_notifications

Alertas y notificaciones programadas.

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `id` | UUID | Identificador unico |
| `tenant_id` | UUID | Cliente (FK) |
| `user_id` | UUID | Usuario destino (FK) |
| `notification_type` | ENUM | daily_summary, hot_lead, low_inventory, etc. |
| `title` | VARCHAR | Titulo de notificacion |
| `content` | TEXT | Contenido |
| `template_data` | JSONB | Variables para template |
| `scheduled_for` | TIMESTAMPTZ | Cuando enviar |
| `is_recurring` | BOOLEAN | Se repite? |
| `recurrence_rule` | VARCHAR | RRULE (iCalendar) |
| `channel` | ENUM | whatsapp, telegram, both |
| `status` | ENUM | pending, sent, failed, cancelled |
| `priority` | ENUM | low, normal, high, urgent |

#### admin_channel_audit_log

Log de auditoria para compliance y debugging.

| Campo | Tipo | Proposito |
|-------|------|-----------|
| `id` | UUID | Identificador unico |
| `tenant_id` | UUID | Cliente (FK) |
| `user_id` | UUID | Usuario (FK) |
| `action` | VARCHAR | Tipo de accion |
| `category` | ENUM | auth, analytics, config, notification, system |
| `resource_type` | VARCHAR | Entidad afectada |
| `resource_id` | UUID | ID de la entidad |
| `status` | ENUM | success, error, warning |
| `details` | JSONB | Detalles de la accion |
| `error_message` | TEXT | Mensaje de error (si aplica) |
| `ip_address` | INET | IP de origen |
| `user_agent` | TEXT | User agent del cliente |

**Audit Actions:**
- `generate_link_code` - Generar codigo de vinculacion
- `verify_link_code` - Verificar codigo
- `send_message` - Enviar mensaje
- `execute_action` - Ejecutar cambio
- `update_config` - Cambiar configuracion
- `create_notification` - Crear alerta
- `update_permissions` - Cambiar permisos
- `suspend_user` - Suspender usuario

---

## Tipos de Datos

### Tipos SQL (snake_case)

**Ubicacion:** `src/features/admin-channel/types/db-rows.types.ts`

Mapean directamente a columnas de BD:
```typescript
interface AdminChannelUserRow {
  id: string;
  tenant_id: string;
  phone_normalized: string | null;
  telegram_user_id: string | null;
  status: 'pending' | 'active' | 'suspended' | 'blocked';
  link_code: string | null;
  // ... otros campos
}
```

### Tipos Aplicacion (camelCase)

**Ubicacion:** `src/features/admin-channel/types/application.types.ts`

Usados en servicios y componentes:
```typescript
interface AdminChannelUser {
  id: string;
  tenantId: string;
  phoneNormalized: string | null;
  telegramUserId: string | null;
  status: AdminUserStatus;
  linkCode: string | null;
  // ... otros campos
}
```

### Converters

**Ubicacion:** `src/features/admin-channel/types/converters.ts`

Funciones de conversion bidireccional:
```typescript
// DB Row → Application
function toAdminChannelUser(row: AdminChannelUserRow): AdminChannelUser

// Application → DB Row
function fromAdminChannelUser(app: AdminChannelUser): AdminChannelUserRow
```

### Enums Principales

```typescript
type AdminChannelType = 'whatsapp' | 'telegram';

type AdminUserStatus = 'pending' | 'active' | 'suspended' | 'blocked';

type AdminConversationStatus = 'active' | 'resolved' | 'archived';

type AdminMessageRole = 'user' | 'assistant' | 'system';

type AdminIntent =
  // Analytics
  | 'analytics_daily_summary'
  | 'analytics_weekly_summary'
  | 'analytics_monthly_summary'
  | 'analytics_sales'
  | 'analytics_leads'
  | 'analytics_revenue'
  // Configuration
  | 'config_services'
  | 'config_prices'
  | 'config_hours'
  | 'config_staff'
  | 'config_promotions'
  // Operations
  | 'operation_appointments_today'
  | 'operation_pending_leads'
  | 'operation_escalations'
  // Notifications
  | 'notification_settings'
  | 'notification_pause'
  | 'notification_resume'
  // Meta
  | 'help' | 'greeting' | 'confirm' | 'cancel' | 'unknown';
```

---

## Servicios

### Admin Channel Service (Singleton)

**Ubicacion:** `src/features/admin-channel/services/admin-channel.service.ts`

Servicio core que maneja toda la logica del sistema.

#### User Management

```typescript
// Genera codigo de vinculacion
generateLinkCode(
  tenantId: string,
  staffId?: string
): Promise<GenerateLinkCodeResult>

// Verifica codigo y activa usuario
verifyLinkCode(
  linkCode: string,
  phoneNormalized?: string,
  telegramUserId?: string,
  telegramUsername?: string
): Promise<VerifyLinkCodeResult>

// Obtiene usuario con datos de tenant
getAdminChannelUser(
  tenantId: string,
  phoneOrTelegram: string
): Promise<AdminChannelUserWithTenant>

// Actualiza permisos de usuario
updateUserPermissions(
  userId: string,
  permissions: Partial<UserPermissions>
): Promise<void>

// Suspende o bloquea usuario
suspendUser(userId: string, reason: string): Promise<void>
```

#### Conversation Management

```typescript
// Crea o recupera conversacion activa
getOrCreateConversation(
  userId: string,
  channel: AdminChannelType
): Promise<GetOrCreateConversationResult>

// Obtiene historial de conversacion
getConversationMessages(
  conversationId: string,
  limit?: number
): Promise<AdminChannelMessage[]>

// Cierra conversacion
closeConversation(
  conversationId: string,
  status: 'resolved' | 'archived'
): Promise<void>
```

#### Message Processing

```typescript
// Guarda mensaje y detecta intent
saveMessage(
  conversationId: string,
  role: AdminMessageRole,
  content: string,
  detectedIntent?: AdminIntent,
  extractedData?: Record<string, unknown>
): Promise<AdminChannelMessage>

// Procesa mensaje completo (end-to-end)
processMessage(
  userId: string,
  channel: AdminChannelType,
  content: string
): Promise<{
  message: AdminChannelMessage;
  response: string;
  actions: AdminExecutedAction[];
}>
```

#### Rate Limiting

```typescript
// Incrementa contador y verifica limite
updateRateLimit(userId: string): Promise<RateLimitResult>

// Verifica limite sin incrementar
checkRateLimit(userId: string): Promise<RateLimitResult>

// Reset manual de limites (admin)
resetRateLimit(userId: string): Promise<void>
```

#### Notification Management

```typescript
// Crea nueva notificacion
createNotification(
  tenantId: string,
  userId: string | null,
  type: AdminNotificationType,
  content: string,
  channel: AdminChannelType | 'both',
  templateData?: Record<string, unknown>
): Promise<void>

// Obtiene notificaciones pendientes
getNotifications(
  userId: string,
  limit?: number
): Promise<AdminChannelNotification[]>

// Marca como entregada/leida
updateNotificationStatus(
  notificationId: string,
  status: AdminMessageStatus
): Promise<void>
```

#### Audit Logging

```typescript
// Log automatico de acciones
logAction(
  tenantId: string,
  userId: string,
  action: string,
  category: AdminAuditCategory,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void>
```

---

## Flujos de Trabajo

### Flujo 1: Vinculacion Inicial

```
1. Usuario solicita codigo
   User: "Hola"

2. Sistema genera codigo
   generateLinkCode(tenant_id, staff_id)
   → admin_channel_users.link_code = "123456"
   → admin_channel_users.status = "pending"

3. Sistema envia codigo via SMS/Telegram
   "Tu codigo: 123456 (valido 15 min)"

4. Usuario verifica codigo
   User: "123456"

5. Sistema activa usuario
   verifyLinkCode("123456", phone="+52555123456")
   → admin_channel_users.status = "active"
   → admin_channel_users.linked_at = NOW()

6. Conversacion iniciada
   getOrCreateConversation(user_id, "whatsapp")
   → admin_channel_conversations creada
   → status = "active"
```

### Flujo 2: Consultar Analytics

```
1. Usuario pregunta
   User: "Cuantos leads tengo hoy?"

2. Sistema procesa
   saveMessage(conv_id, "user", "Cuantos leads...", null)
   → detected_intent = "analytics_daily_summary"
   → intent_confidence = 0.95

3. Sistema carga contexto
   get_tenant_ai_context(tenant_id)
   → tenantName, services, branches, etc.

4. Sistema consulta metricas
   SELECT COUNT(*) FROM leads
   WHERE tenant_id = X AND DATE(created_at) = TODAY

5. Sistema responde
   Bot: "Hoy tienes 5 leads nuevos
         3 conversiones
         Score promedio: 72/100
         Top servicio: Cita (3 leads)"

6. Mensaje guardado
   saveMessage(conv_id, "assistant", response, "analytics_daily_summary")
   → role = "assistant"
   → status = "delivered"
```

### Flujo 3: Cambiar Configuracion (con Confirmacion)

```
1. Usuario solicita cambio
   User: "Cambia precio de Cita a $500"

2. Sistema detecta intent
   saveMessage(conv_id, "user", "Cambia precio...")
   → detected_intent = "config_prices"
   → extracted_data = { service_name: "Cita", new_price: 500 }

3. Sistema pide confirmacion
   pending_action = {
     type: "confirm_update",
     entityType: "service",
     data: { service_id: "...", new_price: 500 }
   }

   Bot: "Quieres cambiar Cita a MXN $500? S/N"

4. Usuario confirma
   User: "Si"

5. Sistema ejecuta cambio
   UPDATE services SET price = 500
   WHERE id = "..." AND tenant_id = X

6. Log de auditoria
   logAction(tenant_id, user_id, "update_price", "config", ...)

7. Respuesta de exito
   Bot: "Cambio realizado
         Cita: MXN $500"
```

### Flujo 4: Recibir Notificacion

```
1. Evento disparador (cron job o webhook)
   - Nuevo lead caliente detectado
   - Inventario bajo en rama
   - Cita de mañana a confirmar

2. Sistema crea notificacion
   createNotification(
     tenantId,
     userId,
     "hot_lead",
     "Nuevo lead: Juan Perez (score: 85)",
     "whatsapp"
   )
   → admin_channel_notifications.status = "pending"

3. Worker envia notificacion
   POST https://api.whatsapp.com/send
   {
     to: "+52555123456",
     text: "Nuevo lead: Juan Perez..."
   }

4. Actualiza estado
   updateNotificationStatus(notification_id, "sent")
   → sent_at = NOW()

5. Usuario ve en WhatsApp/Telegram
   (es una notificacion proactiva)
```

---

## Intents y Acciones

### Intent Detection

El sistema usa un clasificador ligero (regex + keywords) para detectar intents:

```typescript
// Pseudocodigo
function detectIntent(content: string): AdminIntent {
  const lower = content.toLowerCase();

  if (lower.includes('hoy') && lower.includes('lead'))
    return 'analytics_daily_summary';

  if (lower.includes('precio') || lower.includes('$'))
    return 'config_prices';

  if (lower.includes('cita') && lower.includes('hoy'))
    return 'operation_appointments_today';

  return 'unknown';
}
```

FASE 2 upgrade a LangGraph agent.

### Extraccion de Datos

```typescript
// Extrae entidades del mensaje
function extractData(content: string): Record<string, unknown> {
  return {
    service_name: extractServiceName(content),
    new_price: extractNumber(content),
    staff_name: extractPerson(content),
    date: extractDate(content),
    branch_name: extractBranch(content),
  };
}
```

### Acciones Ejecutables

**FASE 1:** Sin ejecucion real, solo logging

**FASE 2:** Acciones reales via API routes:

| Intent | Accion | Ejecutor |
|--------|--------|----------|
| `config_prices` | UPDATE services.price | Servicio |
| `config_hours` | UPDATE branches.opening_hours | Servicio |
| `config_services` | CREATE/UPDATE/DELETE services | Servicio |
| `config_staff` | CREATE/UPDATE staff | Servicio |
| `config_promotions` | CREATE/UPDATE promotions | Servicio |
| `operation_*` | SELECT/aggregation | Servicio (lectura) |
| `analytics_*` | SELECT reportes | Servicio (lectura) |

---

## Seguridad

### Principios

1. **Tenant Isolation** - Datos de un tenant nunca se mezclan
2. **User Permissions** - Cada usuario tiene permisos granulares
3. **Rate Limiting** - Prevenir abuso
4. **Audit Logging** - Todo queda registrado
5. **Input Validation** - Validar todos los inputs

### RLS Policies

```sql
-- Ejemplo: admin_channel_users
CREATE POLICY "tenant_isolation" ON admin_channel_users
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles
    WHERE user_id = auth.uid()
  )
);

-- Usuarios no pueden ver otros usuarios del tenant
CREATE POLICY "users_can_not_see_others" ON admin_channel_users
FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid())
);
```

### Validaciones

```typescript
// Phone normalization (WhatsApp)
function normalizePhone(phone: string): string {
  // Ej: "+525551234567" → "525551234567"
  return phone.replace(/[^\d]/g, '');
}

// Telegram ID validation
function validateTelegramId(id: string): boolean {
  return /^\d+$/.test(id);
}

// Link code format (6 digitos)
function generateLinkCode(): string {
  return Math.random().toString().substring(2, 8).padStart(6, '0');
}

// Intent validation
function isValidIntent(intent: string): intent is AdminIntent {
  const validIntents = [
    'analytics_daily_summary',
    'config_prices',
    // ... etc
  ];
  return validIntents.includes(intent);
}
```

### Tokens y Secretos

- Link codes: **6 digitos, TTL 15 minutos**
- Rate limit reset: **Cada hora (00:00 UTC)**
- Max messages/hour: **60 mensajes**
- Max messages/day: **200 mensajes**

---

## Rate Limiting

### Limites Implementados

| Recurso | Limite | Ventana | Reset |
|---------|--------|---------|-------|
| Mensajes | 60 | 1 hora | Cada hora |
| Mensajes | 200 | 1 dia | Medianoche UTC |
| Link codes | 5 intentos | 1 hora | Cada hora |
| Configuracion | 20 | 1 dia | Medianoche UTC |

### Implementacion

```typescript
async function updateRateLimit(userId: string): Promise<RateLimitResult> {
  // 1. Get user
  const user = await db.query('admin_channel_users', { id: userId });

  // 2. Check if reset needed
  if (isPastResetTime(user.rate_limit_reset_at)) {
    await db.update('admin_channel_users', {
      messages_today: 0,
      messages_this_hour: 0,
      rate_limit_reset_at: getNextResetTime()
    });
  }

  // 3. Increment counters
  const updated = await db.update('admin_channel_users', {
    messages_today: user.messages_today + 1,
    messages_this_hour: user.messages_this_hour + 1
  });

  // 4. Check limits
  const canSend = updated.messages_this_hour <= 60 &&
                  updated.messages_today <= 200;

  return {
    canSend,
    messagesRemainingHour: 60 - updated.messages_this_hour,
    messagesRemainingDay: 200 - updated.messages_today,
    resetAt: getNextResetTime()
  };
}
```

---

## Auditoria

### Eventos Auditados

| Evento | Categoria | Detalles |
|--------|-----------|---------|
| `generate_link_code` | auth | tenant_id, staff_id |
| `verify_link_code` | auth | link_code, phone, telegram_id |
| `send_message` | analytics/config/operation | intent, extracted_data, response |
| `execute_action` | config | action_type, entity_id, old_value, new_value |
| `create_notification` | notification | notification_type, channel |
| `suspend_user` | auth | reason, admin_user_id |
| `update_permissions` | auth | permission_type, old_value, new_value |

### Retention Policy

- **90 dias** - Logs de auditoria (por defecto)
- **1 año** - Logs de compliance (GDPR, regulatorio)
- **Indefinido** - Si regla custom

### Consultas Auditoria

```sql
-- Ultimos cambios de precios
SELECT * FROM admin_channel_audit_log
WHERE action = 'update_price'
  AND tenant_id = 'xxx'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Acciones de usuario X
SELECT * FROM admin_channel_audit_log
WHERE user_id = 'xxx'
ORDER BY created_at DESC
LIMIT 100;

-- Cambios configuracion (ultimo mes)
SELECT * FROM admin_channel_audit_log
WHERE category = 'config'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

---

## Testing Guia

### Setup para Testing

```bash
# 1. Migrar BD
supabase migration up

# 2. Seed test data
npx ts-node scripts/seed-admin-channel-test.ts

# 3. Run tests
npm run test -- admin-channel
```

### Test Cases (FASE 2)

#### User Management

```typescript
describe('Admin Channel User Management', () => {
  test('generateLinkCode creates 6-digit code', async () => {
    const result = await generateLinkCode(TENANT_ID);
    expect(result.linkCode).toMatch(/^\d{6}$/);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('verifyLinkCode with valid code activates user', async () => {
    const generated = await generateLinkCode(TENANT_ID);
    const verified = await verifyLinkCode(generated.linkCode, '+52555123456');
    expect(verified.success).toBe(true);
  });

  test('verifyLinkCode rejects expired code', async () => {
    // ... create old code
    const verified = await verifyLinkCode(oldCode);
    expect(verified.success).toBe(false);
  });
});
```

#### Message Processing

```typescript
describe('Admin Channel Message Processing', () => {
  test('detectIntent identifies analytics_daily_summary', async () => {
    const intent = detectIntent('Cuantos leads hoy?');
    expect(intent).toBe('analytics_daily_summary');
  });

  test('extractData finds service names and prices', async () => {
    const data = extractData('Cambiar Cita a $500');
    expect(data.service_name).toBe('Cita');
    expect(data.new_price).toBe(500);
  });
});
```

#### Rate Limiting

```typescript
describe('Admin Channel Rate Limiting', () => {
  test('allows 60 messages per hour', async () => {
    for (let i = 0; i < 60; i++) {
      const result = await updateRateLimit(USER_ID);
      expect(result.canSend).toBe(true);
    }

    const blocked = await updateRateLimit(USER_ID);
    expect(blocked.canSend).toBe(false);
  });

  test('resets daily counter at midnight UTC', async () => {
    // ... simulate day change
    const result = await updateRateLimit(USER_ID);
    expect(result.messagesRemainingDay).toBe(200);
  });
});
```

### Manual Testing Checklist

- [ ] Generar codigo de vinculacion
- [ ] Verificar codigo valido
- [ ] Verificar codigo expirado (esperar 15 min)
- [ ] Verificar codigo invalido
- [ ] Enviar "Hola" antes de verificar (rechazar)
- [ ] Consultar analytics (analytics_daily_summary)
- [ ] Pedir cambio de precio
- [ ] Confirmar cambio
- [ ] Cancelar cambio
- [ ] Rate limit (enviar 61 mensajes en 1 hora)
- [ ] Verificar audit log
- [ ] Probar suspension de usuario
- [ ] Probar diferentes idiomas

---

## Proximas Fases

### FASE 2 - API Routes y Webhooks

**Deliverables:**
- [ ] API routes para webhooks (Meta, Telegram)
- [ ] Intent detection via LangGraph
- [ ] Action execution (crear/actualizar servicios)
- [ ] Notification sending (WhatsApp/Telegram)
- [ ] Response templates

**Archivos nuevos:**
- `app/api/admin-channel/webhook/route.ts` (Meta)
- `app/api/admin-channel/telegram/route.ts` (Telegram)
- `src/features/admin-channel/agents/` (LangGraph agents)
- `src/features/admin-channel/templates/` (Response templates)

### FASE 3 - Componentes UI

**Deliverables:**
- [ ] Interfaz de configuracion en Settings
- [ ] Link code generator (admin)
- [ ] Admin chat viewer
- [ ] Notification settings
- [ ] User management panel

**Archivos nuevos:**
- `src/features/admin-channel/components/LinkCodeGenerator.tsx`
- `src/features/admin-channel/components/AdminChat.tsx`
- `src/features/admin-channel/components/NotificationSettings.tsx`
- `src/features/admin-channel/components/AdminUserList.tsx`

### FASE 4 - Integracion LangGraph Completa

**Deliverables:**
- [ ] Multi-agent system para intents complejos
- [ ] Context persistence entre mensajes
- [ ] Action confirmation workflows
- [ ] Analytics generation
- [ ] Report generation

**Archivos nuevos:**
- `src/features/admin-channel/agents/supervisor.agent.ts`
- `src/features/admin-channel/agents/analytics.agent.ts`
- `src/features/admin-channel/agents/config.agent.ts`
- `src/features/admin-channel/services/langgraph.service.ts`

### FASE 5 - Notificaciones Proactivas

**Deliverables:**
- [ ] Scheduler de notificaciones
- [ ] Templates personalizables
- [ ] Recurrence rules (RRULE)
- [ ] A/B testing de notificaciones
- [ ] Delivery tracking

### FASE 6 - Analytics Avanzados

**Deliverables:**
- [ ] Reportes personalizados
- [ ] Exportar a PDF/Excel
- [ ] Comparativas (vs mes anterior, vs goal)
- [ ] Dashboards por canal

### FASE 7 - Monetizacion

**Deliverables:**
- [ ] Billing por mensajes
- [ ] Usage tracking
- [ ] Alerts costosos (premium)
- [ ] Tiering de features

---

## Recursos y Referencias

### Archivos del Proyecto

| Archivo | Proposito |
|---------|-----------|
| `CLAUDE.md` (seccion Admin Channel) | Referencia rapida |
| `supabase/migrations/177_...sql` | Schema completo |
| `src/features/admin-channel/types/*` | Tipos TS |
| `src/features/admin-channel/services/*` | Logica core |

### Migraciones de Referencia

- `015_ai_system_multichannel.sql` - Arquitectura multi-canal
- `021_ai_context_rpc.sql` - RPC patterns
- `078_INTEGRATION_HUB.sql` - Multi-tenant queries

### Externos

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)

---

**Documento Actualizado:** Enero 25, 2026
**Proximo Review:** Cuando se complete FASE 2
