# TIS TIS Platform - Sistema AI Multi-Canal

## Descripcion General

El sistema de AI multi-canal de TIS TIS permite responder automaticamente a mensajes de clientes a traves de multiples plataformas:
- **WhatsApp Business API**
- **Instagram Direct Messages**
- **Facebook Messenger**
- **TikTok Direct Messages**

Cada canal tiene su propio webhook endpoint multi-tenant que procesa mensajes entrantes, crea leads automaticamente, y encola trabajos de AI para generar respuestas personalizadas.

---

## Arquitectura del Sistema

```
                                   ┌─────────────────────────────────┐
                                   │       PLATAFORMAS EXTERNAS      │
                                   ├─────────┬─────────┬─────────────┤
                                   │WhatsApp │  Meta   │   TikTok    │
                                   │ Cloud   │Graph API│Business API │
                                   └────┬────┴────┬────┴──────┬──────┘
                                        │         │           │
                                        ▼         ▼           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            WEBHOOK ENDPOINTS                                  │
│  /api/webhook/whatsapp/[tenantSlug]                                          │
│  /api/webhook/instagram/[tenantSlug]                                         │
│  /api/webhook/facebook/[tenantSlug]                                          │
│  /api/webhook/tiktok/[tenantSlug]                                            │
└─────────────────────────────────────┬────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌───────────┐     ┌───────────┐     ┌───────────┐
            │ WhatsApp  │     │   Meta    │     │  TikTok   │
            │  Service  │     │  Service  │     │  Service  │
            └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
                  │                 │                 │
                  └─────────────────┼─────────────────┘
                                    ▼
                          ┌─────────────────┐
                          │   JOB QUEUE     │
                          │  (Supabase)     │
                          │                 │
                          │ • ai_response   │
                          │ • send_whatsapp │
                          │ • send_instagram│
                          │ • send_facebook │
                          │ • send_tiktok   │
                          └────────┬────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  JOB PROCESSOR  │
                          │/api/jobs/process│
                          │                 │
                          │ Llamado por CRON│
                          │ cada 30 segundos│
                          └────────┬────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌───────────┐  ┌───────────┐  ┌───────────┐
            │AI Service │  │Lead Score │  │  Send     │
            │ (Claude)  │  │  Update   │  │ Messages  │
            └───────────┘  └───────────┘  └───────────┘
```

---

## Endpoints de Webhook

### WhatsApp: `/api/webhook/whatsapp/[tenantSlug]`

**GET** - Verificacion del webhook (requerido por Meta/WhatsApp Cloud API)
```
GET /api/webhook/whatsapp/mi-empresa?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
```

**POST** - Recepcion de mensajes y estados
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "PHONE_ID" },
        "messages": [{
          "from": "521234567890",
          "id": "wamid.XXX",
          "timestamp": "1234567890",
          "type": "text",
          "text": { "body": "Hola, quiero informacion" }
        }]
      }
    }]
  }]
}
```

### Instagram: `/api/webhook/instagram/[tenantSlug]`

**GET** - Verificacion del webhook
```
GET /api/webhook/instagram/mi-empresa?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
```

**POST** - Recepcion de mensajes directos
```json
{
  "object": "instagram",
  "entry": [{
    "id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    "time": 1234567890,
    "messaging": [{
      "sender": { "id": "PSID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1234567890,
      "message": {
        "mid": "MESSAGE_ID",
        "text": "Hola!"
      }
    }]
  }]
}
```

### Facebook: `/api/webhook/facebook/[tenantSlug]`

**GET** - Verificacion del webhook
```
GET /api/webhook/facebook/mi-empresa?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
```

**POST** - Recepcion de mensajes de Messenger
```json
{
  "object": "page",
  "entry": [{
    "id": "PAGE_ID",
    "time": 1234567890,
    "messaging": [{
      "sender": { "id": "PSID" },
      "recipient": { "id": "PAGE_ID" },
      "timestamp": 1234567890,
      "message": {
        "mid": "MESSAGE_ID",
        "text": "Hola!"
      }
    }]
  }]
}
```

### TikTok: `/api/webhook/tiktok/[tenantSlug]`

**GET** - Verificacion del webhook
```
GET /api/webhook/tiktok/mi-empresa?challenge=XXX&verify_token=YYY
```

**POST** - Recepcion de mensajes directos
```json
{
  "event": "direct_message.receive",
  "client_key": "CLIENT_KEY",
  "create_time": 1234567890,
  "content": {
    "open_id": "USER_OPEN_ID",
    "message_id": "MESSAGE_ID",
    "message_type": "text",
    "message_content": {
      "text": "Hola!"
    }
  }
}
```

---

## Verificacion de Firmas

Cada plataforma tiene su propio metodo de verificacion:

### WhatsApp & Meta (Instagram/Facebook)
- Header: `X-Hub-Signature-256`
- Algoritmo: HMAC SHA256
- Secret: App Secret de Meta

```typescript
const expectedSignature = crypto
  .createHmac('sha256', appSecret)
  .update(payload)
  .digest('hex');
```

### TikTok
- Header: `X-Tiktok-Signature`
- Algoritmo: SHA256
- Formula: `SHA256(client_secret + timestamp + payload)`

```typescript
const signatureBase = `${clientSecret}${timestamp}${payload}`;
const expectedSignature = crypto
  .createHash('sha256')
  .update(signatureBase)
  .digest('hex');
```

---

## Sistema de Leads

Cuando llega un mensaje, el sistema automaticamente:

1. **Identifica el lead** usando:
   - WhatsApp: Numero de telefono normalizado
   - Instagram: Page-Scoped ID (PSID)
   - Facebook: Page-Scoped ID (PSID)
   - TikTok: Open ID

2. **Crea el lead si no existe** con:
   - Nombre del perfil (si esta disponible)
   - Foto de perfil
   - Canal de origen
   - Score inicial: 50 puntos
   - Clasificacion: WARM

3. **Obtiene informacion del perfil** via API cuando es posible

---

## Sistema de Conversaciones

Cada conversacion:
- Pertenece a un tenant y opcionalmente a una sucursal
- Esta asociada a un lead especifico
- Tiene un canal (whatsapp, instagram, facebook, tiktok)
- Puede estar manejada por AI o por humano
- Estados: `active`, `pending`, `resolved`, `closed`

---

## Cola de Trabajos (Job Queue)

### Tipos de Trabajos

| Tipo | Descripcion |
|------|-------------|
| `ai_response` | Generar respuesta con Claude AI |
| `send_whatsapp` | Enviar mensaje por WhatsApp |
| `send_instagram` | Enviar mensaje por Instagram DM |
| `send_facebook` | Enviar mensaje por Facebook Messenger |
| `send_tiktok` | Enviar mensaje por TikTok DM |

### Estructura del Job

```typescript
interface Job {
  id: string;
  tenant_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_for: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  result?: Record<string, unknown>;
}
```

### Procesamiento

El endpoint `/api/jobs/process` es llamado por un cron job cada 30 segundos:

```bash
# Ejemplo con curl
curl -X POST https://tu-dominio.com/api/jobs/process \
  -H "Authorization: Bearer CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"max_jobs": 10}'
```

---

## Servicio de AI

### Integracion con Claude (Anthropic)

El sistema usa Claude 3.5 Sonnet para generar respuestas:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 500,
  system: tenantContext.system_prompt,
  messages: conversationHistory,
});
```

### Contexto del Tenant

Cada tenant puede configurar:
- **System Prompt**: Instrucciones base para el AI
- **Business Hours**: Horario de atencion
- **Response Style**: Tono de comunicacion
- **Temperature**: Creatividad del modelo (0.0 - 1.0)
- **Keywords**: Palabras clave para deteccion de intents

### Lead Scoring

El AI analiza cada mensaje y ajusta el score del lead:

| Signal | Puntos | Descripcion |
|--------|--------|-------------|
| `interested` | +10 | Muestra interes en productos/servicios |
| `urgent` | +15 | Necesidad urgente |
| `budget_mentioned` | +20 | Menciona presupuesto |
| `decision_maker` | +15 | Es quien toma decisiones |
| `comparing` | +5 | Comparando opciones |
| `not_interested` | -20 | Explicitamente no interesado |
| `spam` | -50 | Mensaje spam detectado |

### Clasificacion Automatica

| Score | Clasificacion |
|-------|---------------|
| >= 70 | HOT |
| >= 40 | WARM |
| < 40 | COLD |

---

## Configuracion por Tenant

### Channel Connections

Cada tenant configura sus canales en `channel_connections`:

```sql
CREATE TABLE channel_connections (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  branch_id UUID REFERENCES branches(id),
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  ai_enabled BOOLEAN DEFAULT true,

  -- WhatsApp
  whatsapp_phone_number_id VARCHAR(100),
  whatsapp_business_account_id VARCHAR(100),
  whatsapp_access_token TEXT,

  -- Instagram
  instagram_page_id VARCHAR(100),
  instagram_account_id VARCHAR(100),
  instagram_access_token TEXT,

  -- Facebook
  facebook_page_id VARCHAR(100),
  facebook_access_token TEXT,

  -- TikTok
  tiktok_client_key VARCHAR(100),
  tiktok_client_secret TEXT,
  tiktok_access_token TEXT,

  -- Verificacion
  webhook_secret TEXT,
  verify_token VARCHAR(100)
);
```

### AI Context

Cada tenant configura su contexto de AI en `ai_tenant_context`:

```sql
CREATE TABLE ai_tenant_context (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  system_prompt TEXT NOT NULL,
  business_hours JSONB,
  response_style VARCHAR(50) DEFAULT 'professional',
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 500,
  escalation_keywords TEXT[],
  auto_escalate_after_messages INTEGER DEFAULT 5
);
```

---

## Limites y Consideraciones

### TikTok
- **10 mensajes por usuario por dia**
- **Ventana de 24 horas** para responder
- Requiere que el usuario inicie la conversacion

### Instagram/Facebook
- **Ventana de 24 horas** para mensajes normales
- Despues de 24h requiere `MESSAGE_TAG`
- Limits de rate de Meta Graph API

### WhatsApp
- **Ventana de 24 horas** para mensajes regulares
- Requiere templates aprobados fuera de ventana
- Tiered throughput basado en quality rating

---

## Flujo Completo de un Mensaje

```
1. Usuario envia mensaje en Instagram
   │
2. Instagram notifica webhook
   │ POST /api/webhook/instagram/mi-empresa
   │
3. Webhook valida firma y responde 200 OK
   │
4. Proceso en background:
   │ a. Parsear mensaje
   │ b. Identificar/crear lead
   │ c. Identificar/crear conversacion
   │ d. Guardar mensaje
   │ e. Encolar job ai_response
   │
5. Job Processor (cada 30s):
   │ a. Toma job ai_response
   │ b. Obtiene contexto del tenant
   │ c. Obtiene historial de conversacion
   │ d. Llama a Claude AI
   │ e. Guarda respuesta
   │ f. Actualiza score del lead
   │ g. Encola job send_instagram
   │
6. Job Processor (siguiente iteracion):
   │ a. Toma job send_instagram
   │ b. Obtiene access_token del canal
   │ c. Envia mensaje via Meta Graph API
   │ d. Actualiza estado del mensaje
   │
7. Usuario recibe respuesta en Instagram
```

---

## Variables de Entorno Requeridas

```env
# Anthropic (AI)
ANTHROPIC_API_KEY=sk-ant-xxx

# Meta (WhatsApp, Instagram, Facebook)
META_APP_SECRET=xxx

# TikTok
TIKTOK_CLIENT_SECRET=xxx

# Job Processor
CRON_SECRET=xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## Archivos Principales

```
src/
├── features/
│   ├── ai/
│   │   ├── services/
│   │   │   ├── ai.service.ts          # Integracion Claude
│   │   │   └── job-processor.service.ts
│   │   └── index.ts
│   │
│   ├── messaging/
│   │   ├── services/
│   │   │   ├── whatsapp.service.ts
│   │   │   ├── meta.service.ts        # Instagram + Facebook
│   │   │   └── tiktok.service.ts
│   │   └── index.ts
│   │
│   └── settings/
│       └── components/
│           ├── AIConfiguration.tsx
│           └── ChannelConnections.tsx
│
├── shared/
│   └── types/
│       ├── whatsapp.ts
│       ├── meta-messaging.ts
│       └── tiktok-messaging.ts
│
app/
├── api/
│   ├── jobs/
│   │   └── process/
│   │       └── route.ts
│   └── webhook/
│       ├── whatsapp/
│       │   └── [tenantSlug]/
│       │       └── route.ts
│       ├── instagram/
│       │   └── [tenantSlug]/
│       │       └── route.ts
│       ├── facebook/
│       │   └── [tenantSlug]/
│       │       └── route.ts
│       └── tiktok/
│           └── [tenantSlug]/
│               └── route.ts
```

---

## Configuracion de Cron Job (Vercel)

```json
// vercel.json
{
  "crons": [{
    "path": "/api/jobs/process",
    "schedule": "*/1 * * * *"
  }]
}
```

Para otros proveedores, configurar llamada HTTP cada 30-60 segundos con:
```
Authorization: Bearer CRON_SECRET
```

---

## Testing

### Simular Webhook de WhatsApp
```bash
curl -X POST http://localhost:3000/api/webhook/whatsapp/mi-empresa \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {"phone_number_id": "123"},
          "messages": [{
            "from": "521234567890",
            "type": "text",
            "text": {"body": "Test message"}
          }]
        }
      }]
    }]
  }'
```

### Procesar Jobs Manualmente
```bash
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{"max_jobs": 5}'
```

### Ver Estado de la Cola
```bash
curl http://localhost:3000/api/jobs/process
```
