# Admin Channel System - API Reference

**Version:** 4.7.0 - FASE 1
**Tipo:** API Documentation
**Scope:** RPCs y funciones del servicio core

---

## Remote Procedure Calls (RPCs)

Los RPCs estan implementados directamente en PostgreSQL para maxima performance y seguridad (transaccional).

### generate_admin_link_code

**Descripcion:** Genera un codigo de vinculacion (6 digitos) para un nuevo usuario admin.

**Parametros:**
```sql
p_tenant_id UUID         -- ID del cliente
p_staff_id UUID (NULL)  -- ID del staff (opcional)
```

**Retorna:**
```json
{
  "link_code": "123456",
  "user_id": "uuid",
  "expires_at": "2026-01-25T10:45:00Z"
}
```

**Ejemplo TypeScript:**
```typescript
const { data, error } = await supabase.rpc('generate_admin_link_code', {
  p_tenant_id: 'tenant-uuid',
  p_staff_id: 'staff-uuid' // opcional
});

if (error) {
  console.error('Error:', error.message);
} else {
  const result = data[0];
  console.log('Link Code:', result.link_code);
  // Enviar via SMS: "Tu codigo: 123456"
}
```

**Logica:**
1. Valida que tenant existe
2. Crea registro en `admin_channel_users` (status='pending')
3. Genera codigo aleatorio (6 digitos)
4. Establece TTL (15 minutos)
5. Retorna resultado
6. Log en audit_log

**Timeout:** 15 minutos desde creacion

---

### verify_admin_link_code

**Descripcion:** Verifica un codigo de vinculacion y activa la cuenta del usuario.

**Parametros:**
```sql
p_link_code VARCHAR          -- El codigo a verificar
p_phone_normalized VARCHAR   -- Numero WhatsApp (opcional)
p_telegram_user_id VARCHAR   -- ID Telegram (opcional)
p_telegram_username VARCHAR  -- Username Telegram (opcional)
```

**Retorna:**
```json
{
  "success": true,
  "tenant_id": "uuid",
  "user_id": "uuid",
  "error_message": null
}
```

**Ejemplo TypeScript:**
```typescript
// Caso 1: WhatsApp
const { data, error } = await supabase.rpc('verify_admin_link_code', {
  p_link_code: '123456',
  p_phone_normalized: '52555123456',
  p_telegram_user_id: null,
  p_telegram_username: null
});

if (data[0].success) {
  console.log('Usuario activado!', data[0].user_id);
} else {
  console.error('Error:', data[0].error_message);
}

// Caso 2: Telegram
const { data: telegramResult } = await supabase.rpc('verify_admin_link_code', {
  p_link_code: '123456',
  p_phone_normalized: null,
  p_telegram_user_id: '123456789',
  p_telegram_username: '@juanperez'
});
```

**Logica:**
1. Busca codigo en tabla (no expirado)
2. Valida que al menos phone_normalized O telegram_user_id se proporciona
3. Si es WhatsApp: valida numero, normaliza, verifica uniqueness
4. Si es Telegram: valida ID y username
5. Actualiza `admin_channel_users`:
   - status = 'active'
   - linked_at = NOW()
   - phone_normalized O telegram_user_id segun caso
6. Elimina link_code
7. Log en audit_log
8. Retorna success=true

**Errores Posibles:**
```
"Codigo invalido o expirado"
"Numero ya vinculado a otro usuario"
"Usuario de Telegram ya existe"
"Deberas proporcionar al menos WhatsApp o Telegram"
```

---

### get_admin_channel_user

**Descripcion:** Obtiene datos del usuario admin con informacion del tenant.

**Parametros:**
```sql
p_tenant_id UUID     -- ID del cliente
p_phone_or_telegram VARCHAR  -- Numero o Telegram ID
```

**Retorna:**
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "staff_id": "uuid-or-null",
  "status": "active",
  "can_view_analytics": true,
  "can_configure": true,
  "can_receive_notifications": true,
  "preferred_language": "es",
  "timezone": "America/Mexico_City",
  "tenant_name": "ESVA Dental",
  "tenant_vertical": "dental"
}
```

**Ejemplo TypeScript:**
```typescript
// Buscar por numero WhatsApp
const { data, error } = await supabase.rpc('get_admin_channel_user', {
  p_tenant_id: 'tenant-uuid',
  p_phone_or_telegram: '52555123456'  // Normalizado (sin +)
});

if (data && data.length > 0) {
  const user = data[0];
  console.log(`Usuario: ${user.tenant_name} (${user.tenant_vertical})`);
  console.log(`Permisos: analytics=${user.can_view_analytics}, config=${user.can_configure}`);
} else {
  console.log('Usuario no encontrado');
}
```

**Logica:**
1. Busca en admin_channel_users por (tenant_id, phone_normalized) O (tenant_id, telegram_user_id)
2. JOIN con tenants para obtener tenant_name, vertical
3. Retorna si existe, NULL si no

---

### update_admin_rate_limit

**Descripcion:** Incrementa los contadores de rate limit y verifica si usuario esta limitado.

**Parametros:**
```sql
p_user_id UUID  -- ID del usuario admin
```

**Retorna:**
```json
{
  "can_send": true,
  "messages_remaining_hour": 45,
  "messages_remaining_day": 150,
  "reset_at": "2026-01-25T11:00:00Z"
}
```

**Ejemplo TypeScript:**
```typescript
// Verificar ANTES de procesar
const { data: checkResult } = await supabase.rpc('check_admin_rate_limit', {
  p_user_id: user_id
});

if (!checkResult[0].can_send) {
  console.log('Limite alcanzado!');
  console.log(`Reintentar en: ${checkResult[0].reset_at}`);
  return;
}

// Procesar mensaje...

// Incrementar contador DESPUES
await supabase.rpc('update_admin_rate_limit', {
  p_user_id: user_id
});
```

**Limites:**
- 60 mensajes por hora
- 200 mensajes por dia
- Reset cada hora (00:00 UTC)

**Logica:**
1. Get usuario
2. Si rate_limit_reset_at ha pasado:
   - Reset messages_today, messages_this_hour
   - Actualiza rate_limit_reset_at al proximo reset
3. Incrementa messages_today
4. Incrementa messages_this_hour
5. Actualiza last_message_at
6. Verifica limites
7. Retorna resultado

---

### get_or_create_admin_conversation

**Descripcion:** Obtiene conversacion activa o crea una nueva.

**Parametros:**
```sql
p_user_id UUID                -- ID del usuario admin
p_channel admin_channel_type  -- 'whatsapp' o 'telegram'
```

**Retorna:**
```json
{
  "conversation_id": "uuid",
  "is_new": false,
  "current_intent": "analytics_daily_summary",
  "pending_action": null,
  "context": {
    "lastIntent": "analytics_daily_summary",
    "mentionedEntities": {},
    "sessionPreferences": {}
  }
}
```

**Ejemplo TypeScript:**
```typescript
const { data } = await supabase.rpc('get_or_create_admin_conversation', {
  p_user_id: 'user-uuid',
  p_channel: 'whatsapp'
});

const convResult = data[0];
console.log(`Conversacion: ${convResult.conversation_id} (nueva: ${convResult.is_new})`);

if (convResult.pending_action) {
  console.log('Accion pendiente:', convResult.pending_action);
}
```

**Logica:**
1. Busca conversacion activa (status='active') para ese usuario y canal
2. Si existe:
   - Retorna datos
   - is_new = false
3. Si no existe:
   - Crea conversacion con status='active'
   - context = {} (vacio)
   - pending_action = null
   - Retorna datos
   - is_new = true

**Nota:** Solo retorna UNA conversacion activa por usuario/canal. Si usuario tenia conversacion resuelta/archivada, crea nueva.

---

### save_admin_message

**Descripcion:** Guarda un mensaje en la conversacion y detecta intent.

**Parametros:**
```sql
p_conversation_id UUID           -- Conversacion destino
p_role admin_message_role        -- 'user', 'assistant', 'system'
p_content TEXT                   -- Contenido del mensaje
p_detected_intent VARCHAR        -- Intent detectado (opcional)
p_extracted_data JSONB           -- Datos extraidos (opcional)
p_status admin_message_status    -- 'pending' (default)
```

**Retorna:**
```json
{
  "message_id": "uuid",
  "conversation_id": "uuid",
  "role": "user",
  "content": "Cuantos leads hoy?",
  "detected_intent": "analytics_daily_summary",
  "intent_confidence": 0.85,
  "extracted_data": {},
  "status": "pending",
  "created_at": "2026-01-25T10:30:00Z"
}
```

**Ejemplo TypeScript:**
```typescript
// Guardar mensaje de usuario
const { data: userMsg } = await supabase.rpc('save_admin_message', {
  p_conversation_id: 'conv-uuid',
  p_role: 'user',
  p_content: 'Cuantos leads hoy?',
  p_detected_intent: null,  // FASE 2: sera detectado por LangGraph
  p_extracted_data: null,
  p_status: 'pending'
});

const msgId = userMsg[0].message_id;
console.log('Mensaje guardado:', msgId);

// Guardar respuesta del bot
const { data: botMsg } = await supabase.rpc('save_admin_message', {
  p_conversation_id: 'conv-uuid',
  p_role: 'assistant',
  p_content: 'Hoy tienes 5 leads nuevos. Score promedio: 72/100',
  p_detected_intent: 'analytics_daily_summary',
  p_extracted_data: { leads_count: 5, avg_score: 72 },
  p_status: 'pending'
});
```

**Logica:**
1. Valida que conversacion existe
2. Crea mensaje con status='pending'
3. Si intent detectado, valida que es intent valido
4. Si extracted_data, valida que es JSON valido
5. Incrementa conversation.message_count
6. Si role='user', actualiza conversation.last_user_message_at
7. Si role='assistant', actualiza conversation.last_bot_message_at
8. Retorna mensaje creado

---

## Service Methods

Los RPCs anteriores estan envueltos por el `AdminChannelService` para facilitar uso.

### Generales

```typescript
import { adminChannelService } from '@/src/features/admin-channel';

const service = adminChannelService.getInstance();
```

### User Management Methods

#### generateLinkCode

```typescript
async generateLinkCode(
  tenantId: string,
  staffId?: string
): Promise<GenerateLinkCodeResult>
```

Wrapper para RPC `generate_admin_link_code`.

```typescript
const result = await service.generateLinkCode('tenant-uuid');
// { linkCode: '123456', expiresAt: Date, userId: 'uuid' }
```

#### verifyLinkCode

```typescript
async verifyLinkCode(
  linkCode: string,
  phoneNormalized?: string,
  telegramUserId?: string,
  telegramUsername?: string
): Promise<VerifyLinkCodeResult>
```

Wrapper para RPC `verify_admin_link_code`.

```typescript
const result = await service.verifyLinkCode(
  '123456',
  '+52555123456'
);
// { success: true, tenantId: 'uuid', userId: 'uuid', errorMessage: null }
```

#### getAdminChannelUser

```typescript
async getAdminChannelUser(
  tenantId: string,
  phoneOrTelegram: string
): Promise<AdminChannelUserWithTenant | null>
```

Wrapper para RPC `get_admin_channel_user`.

```typescript
const user = await service.getAdminChannelUser(
  'tenant-uuid',
  '52555123456'
);
// { userId, tenantId, status, tenantName, tenantVertical, ... }
```

### Conversation Methods

#### getOrCreateConversation

```typescript
async getOrCreateConversation(
  userId: string,
  channel: AdminChannelType
): Promise<GetOrCreateConversationResult>
```

Wrapper para RPC `get_or_create_admin_conversation`.

```typescript
const conv = await service.getOrCreateConversation('user-uuid', 'whatsapp');
// { conversationId, isNew, currentIntent, pendingAction, context }
```

#### getConversationMessages

```typescript
async getConversationMessages(
  conversationId: string,
  limit?: number
): Promise<AdminChannelMessage[]>
```

Obtiene historial de mensajes.

```typescript
const messages = await service.getConversationMessages('conv-uuid', 20);
// Array<AdminChannelMessage>
```

### Message Methods

#### saveMessage

```typescript
async saveMessage(
  conversationId: string,
  role: AdminMessageRole,
  content: string,
  detectedIntent?: AdminIntent,
  extractedData?: Record<string, unknown>
): Promise<AdminChannelMessage>
```

Wrapper para RPC `save_admin_message`.

```typescript
const msg = await service.saveMessage(
  'conv-uuid',
  'user',
  'Cuantos leads hoy?'
);
// { id, conversationId, role, content, status, ... }
```

### Rate Limiting Methods

#### updateRateLimit

```typescript
async updateRateLimit(
  userId: string
): Promise<RateLimitResult>
```

Incrementa contador y retorna resultado.

```typescript
const result = await service.updateRateLimit('user-uuid');
// { canSend, messagesRemainingHour, messagesRemainingDay, resetAt }
```

#### checkRateLimit

```typescript
async checkRateLimit(
  userId: string
): Promise<RateLimitResult>
```

Verifica limite sin incrementar.

```typescript
const result = await service.checkRateLimit('user-uuid');

if (!result.canSend) {
  console.log('Limitado hasta:', result.resetAt);
}
```

### Notification Methods

#### createNotification

```typescript
async createNotification(
  tenantId: string,
  userId: string | null,
  type: AdminNotificationType,
  content: string,
  channel: AdminChannelType | 'both',
  templateData?: Record<string, unknown>
): Promise<void>
```

Crea notificacion programada.

```typescript
await service.createNotification(
  'tenant-uuid',
  'user-uuid',
  'daily_summary',
  'Resumen de hoy: 5 leads, $1500 en ventas',
  'whatsapp'
);
```

#### getNotifications

```typescript
async getNotifications(
  userId: string,
  limit?: number
): Promise<AdminChannelNotification[]>
```

Obtiene notificaciones pendientes.

```typescript
const notifications = await service.getNotifications('user-uuid', 10);
```

### Audit Methods

#### logAction

```typescript
async logAction(
  tenantId: string,
  userId: string,
  action: string,
  category: AdminAuditCategory,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void>
```

Log de auditoria.

```typescript
await service.logAction(
  'tenant-uuid',
  'user-uuid',
  'update_price',
  'config',
  'service',
  'service-uuid',
  { old_price: 400, new_price: 500 }
);
```

---

## Error Handling

### Patrones de Error

```typescript
try {
  const result = await service.verifyLinkCode(code);

  if (!result.success) {
    // Codigo invalido
    console.error('Error:', result.errorMessage);
    return;
  }

  // Exito
  const { tenantId, userId } = result;

} catch (err) {
  // Error en la llamada RPC/BD
  console.error('Exception:', err);
}
```

### Errores Comunes

| Codigo | Mensaje | Causa |
|--------|---------|-------|
| `23505` | "duplicate key" | Usuario ya vinculado |
| `23503` | "foreign key violation" | Tenant/staff no existe |
| `P0001` | RPC error | Validacion fallida en BD |
| `PGRST301` | "Conflicting request" | RLS violation |

---

## Performance Notas

### Query Plans

Los RPCs estan optimizados con indices:

```sql
-- admin_channel_users
CREATE INDEX idx_admin_users_tenant_phone
  ON admin_channel_users(tenant_id, phone_normalized);

CREATE INDEX idx_admin_users_tenant_telegram
  ON admin_channel_users(tenant_id, telegram_user_id);

-- admin_channel_conversations
CREATE INDEX idx_admin_conv_user_channel
  ON admin_channel_conversations(user_id, channel)
  WHERE status = 'active';

-- admin_channel_messages
CREATE INDEX idx_admin_msg_conversation
  ON admin_channel_messages(conversation_id, created_at DESC);
```

### Conexiones Recomendadas

- Connection pool: 10-20 (Supabase default es 15)
- Query timeout: 5000ms
- Retry strategy: exponential backoff

---

## Rate Limits de API

**FASE 2:** Aplicar limits en API routes

```
GET /api/admin-channel/user         - 100 req/min
POST /api/admin-channel/message     - 60 req/min
POST /api/admin-channel/link-code   - 10 req/min
POST /api/admin-channel/webhook     - 1000 req/min
```

---

## Changelog

### v4.7.0 (Enero 25, 2026)
- Initial release - FASE 1
- 6 RPCs implementados
- Service wrapper con metodos principales
- Tipos TypeScript completos
- RLS policies
- Auditoria completa

### v4.8.0 (Proximamente - FASE 2)
- API routes con webhooks
- LangGraph integration
- Action execution
- WhatsApp/Telegram delivery

---

**Ultima actualizacion:** Enero 25, 2026
**Mantener sincronizado con:** `/supabase/migrations/177_ADMIN_CHANNEL_SYSTEM.sql`
