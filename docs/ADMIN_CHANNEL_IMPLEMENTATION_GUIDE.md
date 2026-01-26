# Admin Channel System - Guia de Implementacion Rapida

**Version:** 4.7.0 - FASE 1
**Tipo:** Developer Reference
**Objetivo:** Entender rapidamente como el sistema esta estructurado y como usarlo

---

## Quick Start

### 1. Migrar la BD

```bash
# Aplicar migracion
supabase migration up

# Verificar tablas
supabase db list-tables | grep admin_channel
```

**Tablas creadas:**
- `admin_channel_users` - Usuarios vinculados
- `admin_channel_conversations` - Conversaciones activas
- `admin_channel_messages` - Historial de mensajes
- `admin_channel_notifications` - Notificaciones programadas
- `admin_channel_audit_log` - Log de auditoria

### 2. Usar el Servicio

```typescript
import { AdminChannelService } from '@/src/features/admin-channel';

// Instancia singleton (auto-initialized)
const adminChannel = AdminChannelService.getInstance();

// Generar codigo vinculacion
const linkCode = await adminChannel.generateLinkCode(tenantId);
console.log(linkCode.linkCode); // "123456"

// Verificar codigo
const verified = await adminChannel.verifyLinkCode(
  "123456",
  "+52555123456"
);

// Crear conversacion
const conv = await adminChannel.getOrCreateConversation(userId, "whatsapp");
```

### 3. Procesar Mensaje

```typescript
// Guardar mensaje
const msg = await adminChannel.saveMessage(
  conversationId,
  "user",
  "Cuantos leads hoy?",
  "analytics_daily_summary" // intent
);

// Generar respuesta (placeholder FASE 1)
console.log(msg.detectedIntent); // "analytics_daily_summary"
console.log(msg.extractedData);  // {}
```

---

## Estructura de Tipos

### Row Types (SQL)

Mapean a columnas de BD exactamente:

```typescript
// src/features/admin-channel/types/db-rows.types.ts
import { Database } from '@/src/shared/types/database.types';

// Re-export tipos de Supabase
type AdminChannelUserRow = Database['public']['Tables']['admin_channel_users']['Row'];
```

### Application Types (Usar en componentes)

Usa camelCase, mas idiomatico en JS:

```typescript
// src/features/admin-channel/types/application.types.ts
interface AdminChannelUser {
  id: string;
  tenantId: string;       // NO tenant_id
  phoneNormalized: string | null;
  status: AdminUserStatus; // Union type
  // ... etc
}
```

### Converters (bidireccional)

```typescript
// src/features/admin-channel/types/converters.ts

// DB → App
function toAdminChannelUser(row: AdminChannelUserRow): AdminChannelUser {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    phoneNormalized: row.phone_normalized,
    // ...
  };
}

// App → DB
function fromAdminChannelUser(app: AdminChannelUser): AdminChannelUserRow {
  return {
    id: app.id,
    tenant_id: app.tenantId,
    phone_normalized: app.phoneNormalized,
    // ...
  };
}
```

---

## Patrones de Codigo

### Patern 1: Usar Servicio

```typescript
import { adminChannelService } from '@/src/features/admin-channel';

// El servicio es un singleton
const service = adminChannelService.getInstance();

// Llamar metodos
const result = await service.generateLinkCode(tenantId);
```

### Patron 2: Convertir Tipos

```typescript
// Cuando obtengas datos de BD directamente (RPC)
const { data, error } = await supabase.rpc('get_admin_channel_user', {
  p_tenant_id: tenantId,
  p_phone: "+52555123456"
});

// Convertir a tipo aplicacion
const user = toAdminChannelUserWithTenant(data[0]);

// Usar en componentes
<div>{user.tenantName}</div>
```

### Patron 3: Guardar Mensaje

```typescript
// Siempre guardar en BD
const message = await adminChannelService.saveMessage(
  conversationId,
  "user",
  content,
  detectedIntent, // puede ser null
  extractedData   // puede ser {}
);

// Resultado tiene status 'pending'
console.log(message.status); // "pending"
```

### Patron 4: Rate Limiting

```typescript
// Verificar ANTES de procesar
const rateLimitResult = await adminChannelService.checkRateLimit(userId);

if (!rateLimitResult.canSend) {
  return {
    error: `Limite alcanzado. Reintentar en ${rateLimitResult.resetAt}`,
    remaining: rateLimitResult.messagesRemainingHour
  };
}

// Procesar mensaje
// ...

// Incrementar contador
await adminChannelService.updateRateLimit(userId);
```

---

## Tipos Principales

### AdminChannelUser

```typescript
interface AdminChannelUser {
  id: string;                          // UUID
  tenantId: string;                    // Empresa
  staffId?: string;                    // Personal vinculado
  phoneNormalized?: string;            // "+525551234567"
  telegramUserId?: string;             // Telegram ID
  status: AdminUserStatus;             // 'active', 'pending', etc
  linkCode?: string;                   // "123456"
  canViewAnalytics: boolean;           // Permiso lectura
  canConfigure: boolean;               // Permiso escritura
  messagesToday: number;               // Rate limit contador
  createdAt: Date;
  updatedAt: Date;
}
```

### AdminChannelConversation

```typescript
interface AdminChannelConversation {
  id: string;                          // UUID
  tenantId: string;
  userId: string;                      // admin_channel_users.id
  channel: 'whatsapp' | 'telegram';
  status: 'active' | 'resolved' | 'archived';
  currentIntent?: AdminIntent;         // Intent detectado
  pendingAction?: AdminPendingAction;  // Confirmacion pendiente
  context: AdminConversationContext;   // JSONB state
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### AdminChannelMessage

```typescript
interface AdminChannelMessage {
  id: string;                          // UUID
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;                     // Texto del mensaje
  detectedIntent?: AdminIntent;        // null en FASE 1
  extractedData: Record<string, unknown>; // {}
  actionsExecuted: AdminExecutedAction[]; // []
  status: AdminMessageStatus;          // 'pending', 'sent', etc
  createdAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}
```

### AdminIntent

```typescript
type AdminIntent =
  // Analytics - Consultas
  | 'analytics_daily_summary'      // "Cuantos leads hoy?"
  | 'analytics_weekly_summary'     // "Resumen de la semana?"
  | 'analytics_monthly_summary'    // "Total del mes?"
  | 'analytics_sales'              // "Cuanto vendi?"
  | 'analytics_leads'              // "Mis leads?"
  | 'analytics_revenue'            // "Ingresos?"

  // Configuration - Cambios
  | 'config_prices'                // "Cambiar precio"
  | 'config_hours'                 // "Cambiar horarios"
  | 'config_services'              // "Agregar servicio"
  | 'config_staff'                 // "Agregar personal"
  | 'config_promotions'            // "Nueva promocion"

  // Operations - Estado actual
  | 'operation_appointments_today' // "Citas de hoy?"
  | 'operation_pending_leads'      // "Leads pendientes?"
  | 'operation_escalations'        // "Escalaciones?"

  // Notifications
  | 'notification_settings'        // "Cambiar alertas"
  | 'notification_pause'           // "Pausar notificaciones"
  | 'notification_resume'          // "Reanudar"

  // Meta
  | 'help'
  | 'greeting'
  | 'confirm'
  | 'cancel'
  | 'unknown';
```

---

## Flujos Comunes

### Flujo: Generar Link Code

```typescript
// 1. Admin solicita codigo para usuario
const result = await adminChannelService.generateLinkCode(
  tenantId,
  staffId // opcional
);

// Resultado
{
  linkCode: "123456",
  expiresAt: Date(15 min desde ahora),
  userId: "uuid"
}

// 2. Admin comparte codigo con usuario via SMS
// "Tu codigo TIS TIS: 123456 (valido 15 min)"

// 3. Usuario verifica codigo en WhatsApp
// User: "123456"

// 4. Sistema verifica
const verified = await adminChannelService.verifyLinkCode(
  "123456",
  "+52555123456" // phone normalisado
);

// Resultado
{
  success: true,
  tenantId: "uuid",
  userId: "uuid"
}

// 5. Usuario listo para usar
```

### Flujo: Consultar Analytics (Placeholder FASE 1)

```typescript
// 1. Usuario enviar mensaje
const userContent = "Cuantos leads hoy?";

// 2. Crear conversacion si no existe
const conv = await adminChannelService.getOrCreateConversation(
  userId,
  "whatsapp"
);

// 3. Guardar mensaje
const msg = await adminChannelService.saveMessage(
  conv.conversationId,
  "user",
  userContent,
  null, // intent (null, sera detectado en FASE 2)
  {}    // extracted_data
);

// 4. Detectar intent (simple en FASE 1)
const detectedIntent = detectIntentFASE1(userContent);
// "analytics_daily_summary"

// 5. En FASE 2: LangGraph agent generara respuesta
// Por ahora, respuesta hardcoded

const botResponse = generatePlaceholderResponse(detectedIntent);
// "Hoy tienes 5 leads nuevos. Score promedio: 72/100"

// 6. Guardar respuesta
await adminChannelService.saveMessage(
  conv.conversationId,
  "assistant",
  botResponse,
  detectedIntent,
  {} // extracted_data (analytics data aqui en FASE 2)
);

// 7. Enviar a usuario (FASE 2)
// sendToWhatsApp(phoneNormalized, botResponse)
```

### Flujo: Cambiar Configuracion (con Confirmacion)

```typescript
// 1. Usuario pide cambio
const userContent = "Cambiar precio de Cita a $500";

// 2. Guardar mensaje y detectar intent
const msg = await adminChannelService.saveMessage(
  conversationId,
  "user",
  userContent,
  "config_prices",
  {
    service_name: "Cita",
    new_price: 500
  }
);

// 3. Crear pending action (confirmacion)
const pendingAction = {
  type: "confirm_update",
  entityType: "service",
  data: {
    service_id: "uuid",
    new_price: 500
  },
  expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 min
};

// Guardar en conversation.pending_action (JSONB)
await db.update('admin_channel_conversations', {
  pending_action: pendingAction
}, { id: conversationId });

// 4. Responder pidiendo confirmacion
const confirmMsg = "Quieres cambiar Cita a MXN $500? Si/No";
await adminChannelService.saveMessage(
  conversationId,
  "assistant",
  confirmMsg,
  "confirm"
);

// 5. Usuario confirma (en siguiente mensaje)
// User: "Si"

// 6. Sistema valida confirmacion y ejecuta
if (userContent.toLowerCase().includes("si")) {
  // UPDATE services SET price = 500
  await executeConfigChange(pendingAction);

  // Log auditoria
  await adminChannelService.logAction(
    tenantId,
    userId,
    "update_price",
    "config",
    "service",
    "uuid",
    { new_price: 500, old_price: 400 }
  );

  // Responder exito
  await adminChannelService.saveMessage(
    conversationId,
    "assistant",
    "Cambio realizado: Cita = MXN $500"
  );

  // Limpiar pending action
  await db.update('admin_channel_conversations', {
    pending_action: null
  }, { id: conversationId });
}
```

---

## Testing Rapido

### Setup

```bash
# 1. Create test data
npm run test:seed-admin-channel

# 2. Run tests
npm run test -- admin-channel
```

### Test Manual en Supabase SQL

```sql
-- Ver usuarios
SELECT id, tenant_id, phone_normalized, status, created_at
FROM admin_channel_users
ORDER BY created_at DESC
LIMIT 10;

-- Ver conversaciones
SELECT id, user_id, channel, status, message_count, created_at
FROM admin_channel_conversations
ORDER BY created_at DESC
LIMIT 5;

-- Ver mensajes
SELECT id, conversation_id, role, content, detected_intent, created_at
FROM admin_channel_messages
ORDER BY created_at DESC
LIMIT 20;

-- Ver audit log
SELECT action, status, details, created_at
FROM admin_channel_audit_log
WHERE tenant_id = 'xxx'
ORDER BY created_at DESC
LIMIT 20;

-- Verificar RLS (debe retornar 0 si no autorizado)
SELECT COUNT(*) FROM admin_channel_users;
```

### Test con TypeScript

```typescript
import { adminChannelService } from '@/src/features/admin-channel';

async function testAdminChannelFlow() {
  try {
    // 1. Generate link code
    const linkResult = await adminChannelService.generateLinkCode('tenant-uuid');
    console.log('Link Code:', linkResult.linkCode);

    // 2. Verify link code
    const verifyResult = await adminChannelService.verifyLinkCode(
      linkResult.linkCode,
      '+52555123456'
    );
    console.log('Verified:', verifyResult.success);

    // 3. Get or create conversation
    const convResult = await adminChannelService.getOrCreateConversation(
      verifyResult.userId,
      'whatsapp'
    );
    console.log('Conversation:', convResult.conversationId);

    // 4. Save message
    const msg = await adminChannelService.saveMessage(
      convResult.conversationId,
      'user',
      'Cuantos leads hoy?'
    );
    console.log('Message:', msg.id);

    // 5. Check rate limit
    const rateLimitResult = await adminChannelService.checkRateLimit(
      verifyResult.userId
    );
    console.log('Can Send:', rateLimitResult.canSend);

    console.log('All tests passed!');
  } catch (err) {
    console.error('Test failed:', err);
  }
}
```

---

## Troubleshooting

### Error: "RLS policy violation"

**Problema:** Intentas acceder a tabla sin permisos

**Solucion:**
```typescript
// Asegurate que user_id esta en user_roles
SELECT * FROM user_roles
WHERE user_id = auth.uid() AND tenant_id = 'xxx';

// Si no existe, crearla
INSERT INTO user_roles (user_id, tenant_id, role)
VALUES (auth.uid(), 'xxx', 'admin');
```

### Error: "invalid UUID format"

**Problema:** UUID invalida en parametros

**Solucion:**
```typescript
// Validar UUID antes de pasar a servicio
import { v4 as uuidv4 } from 'uuid';

function validateUUID(id: string): boolean {
  try {
    return uuidv4(id) === id;
  } catch {
    return false;
  }
}

// O usar regex
function validateUUIDRegex(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
}
```

### Error: "Link code expired"

**Problema:** Usuario tarda mas de 15 minutos en verificar

**Solucion:**
```typescript
// Generar nuevo codigo
const newCode = await adminChannelService.generateLinkCode(tenantId);
// Enviar nuevamente al usuario
```

### Mensaje no aparece en WhatsApp

**Problema:** Status es 'pending', no 'delivered'

**Solucion:** En FASE 2 se implementara envio actual a WhatsApp/Telegram

```typescript
// FASE 1: Solo guardamos en BD
// FASE 2: Aqui enviaremos real

// const whatsappResult = await sendWhatsAppMessage(...)
// updateMessageStatus(messageId, 'delivered')
```

---

## Proximos Pasos

### FASE 2 - API Routes

```typescript
// app/api/admin-channel/webhook/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1. Validar webhook (Meta signature)
  if (!validateMetaSignature(req, body)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Procesar mensaje entrante
  const message = body.entry[0].changes[0].value.messages[0];
  const phoneNumber = message.from; // "52xxxxxxxxxx"
  const content = message.text.body;

  // 3. Buscar usuario
  const user = await adminChannelService.getAdminChannelUser(
    tenantId,
    phoneNumber
  );

  if (!user) {
    // Usuario no vinculado
    sendWhatsAppMessage(phoneNumber, 'Usuario no vinculado. Solicita un codigo');
    return new Response('OK');
  }

  // 4. Rate limiting
  const rateLimit = await adminChannelService.checkRateLimit(user.id);
  if (!rateLimit.canSend) {
    sendWhatsAppMessage(phoneNumber, 'Limite alcanzado. Reintentar mas tarde');
    return new Response('OK');
  }

  // 5. Procesar mensaje completo
  const result = await adminChannelService.processMessage(
    user.id,
    'whatsapp',
    content
  );

  // 6. Enviar respuesta
  sendWhatsAppMessage(phoneNumber, result.response);

  return new Response('OK');
}
```

---

## Referencias

- Documentacion completa: `/docs/ADMIN_CHANNEL_SYSTEM.md`
- Migracion SQL: `/supabase/migrations/177_ADMIN_CHANNEL_SYSTEM.sql`
- Tipos: `/src/features/admin-channel/types/`
- Servicio: `/src/features/admin-channel/services/admin-channel.service.ts`
- CLAUDE.md (seccion Admin Channel): `/CLAUDE.md`

---

**Actualizado:** Enero 25, 2026
