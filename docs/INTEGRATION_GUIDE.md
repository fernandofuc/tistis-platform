# TIS TIS Platform - Integration Guide

**Versión:** 3.0.0
**Última actualización:** 12 de Diciembre, 2024

## 🔌 Overview

This document describes how to complete the multi-channel messaging and AI integrations for the TIS TIS Platform.

The platform now includes a **complete AI multi-channel system** with:
1. WhatsApp Business Cloud API
2. Instagram Direct Messages (Meta Graph API)
3. Facebook Messenger (Meta Graph API)
4. TikTok Direct Messages (TikTok Business API)
5. Claude AI integration for automated responses
6. Job queue system for asynchronous processing

**Status:** All code, webhooks, and services are fully implemented and ready for configuration.

## 🔐 Security Updates (v2.1.0)

**Important:** Version 2.1.0 includes critical security fixes:

- ✅ All API routes now validate authentication and tenant ownership
- ✅ Race conditions eliminated with advisory locks
- ✅ Storage policies enforce tenant isolation
- ✅ Enhanced RLS policies prevent cross-tenant access

Make sure to apply migration `009_critical_fixes.sql` before integrating.

---

## 📱 WhatsApp Business API Integration

### Prerequisites

1. **Meta Business Account** with WhatsApp Business API access
2. **Phone Number** registered in WhatsApp Business Platform
3. **System User Token** with `whatsapp_business_messaging` permission

### Environment Variables

Add these to your `.env.local`:

```bash
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_system_user_token
WHATSAPP_VERIFY_TOKEN=tistis_verify_token  # Custom token for webhook verification
```

### Webhook Configuration

1. Go to Meta Developer Portal → Your App → WhatsApp → Configuration
2. Set Webhook URL: `https://your-domain.vercel.app/api/webhook/whatsapp/[your-tenant-slug]`
   - Replace `[your-tenant-slug]` with your actual tenant slug (e.g., `esva-dental`)
3. Set Verify Token: Same as `WHATSAPP_VERIFY_TOKEN` in env
4. Subscribe to: `messages`, `message_templates`

**Note:** Webhooks are now multi-tenant. Each tenant has a unique webhook URL with their slug.

### Message Templates (Required)

Create these templates in WhatsApp Business Manager:

| Template Name | Purpose | Variables |
|--------------|---------|-----------|
| `cita_confirmada` | Appointment confirmation | patient_name, date, time, branch |
| `recordatorio_cita` | 24h reminder | patient_name, date, time, branch |
| `bienvenida_esva` | Welcome message | patient_name |
| `cotizacion_enviada` | Quote sent | patient_name, services |
| `seguimiento` | Follow-up | patient_name |

### Available Functions

```typescript
import { whatsappClient } from '@/src/shared/lib/whatsapp';

// Send text message
await whatsappClient.sendTextMessage('+521234567890', 'Hello!');

// Send interactive buttons
await whatsappClient.sendButtonMessage(
  '+521234567890',
  'Please confirm your appointment',
  [
    { id: 'confirm', title: '✅ Confirm' },
    { id: 'reschedule', title: '📅 Reschedule' },
  ]
);

// Send list menu
await whatsappClient.sendListMessage(
  '+521234567890',
  'Select a service',
  'View Services',
  [{ title: 'Dental', rows: [{ id: 'cleaning', title: 'Cleaning' }] }]
);
```

### Pre-built ESVA Functions

```typescript
import {
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendServicesMenu,
} from '@/src/shared/lib/whatsapp';

// Send confirmation
await sendAppointmentConfirmation(
  '+521234567890',
  'María García',
  'Lunes 15 de Enero',
  '10:00 AM',
  'ESVA Nogales',
  'Av. Principal #123'
);
```

---

## 📱 Instagram Direct Messages Integration

### Prerequisites

1. **Instagram Business Account** connected to a Facebook Page
2. **Meta App** with Instagram permissions
3. **Access Token** with `pages_manage_metadata`, `pages_messaging`, `instagram_basic`, `instagram_manage_messages`

### Environment Variables

Add these to your `.env.local`:

```bash
# Instagram (uses Meta Graph API)
META_APP_SECRET=your_meta_app_secret
# Access token configured per tenant in channel_connections table
```

### Webhook Configuration

1. Go to Meta Developer Portal → Your App → Instagram → Configuration
2. Set Webhook URL: `https://your-domain.vercel.app/api/webhook/instagram/[your-tenant-slug]`
3. Set Verify Token: Same as in `channel_connections.verify_token`
4. Subscribe to: `messages`, `messaging_postbacks`

### Features

- Automatic lead creation from Instagram DMs
- AI-powered responses via Claude
- 24-hour messaging window (standard messages)
- Lead scoring based on conversation

---

## 📘 Facebook Messenger Integration

### Prerequisites

1. **Facebook Page** for your business
2. **Meta App** with Messenger permissions
3. **Page Access Token** with `pages_messaging`, `pages_manage_metadata`

### Environment Variables

```bash
# Facebook (uses Meta Graph API)
META_APP_SECRET=your_meta_app_secret
# Access token configured per tenant in channel_connections table
```

### Webhook Configuration

1. Go to Meta Developer Portal → Your App → Messenger → Configuration
2. Set Webhook URL: `https://your-domain.vercel.app/api/webhook/facebook/[your-tenant-slug]`
3. Set Verify Token: Same as in `channel_connections.verify_token`
4. Subscribe to: `messages`, `messaging_postbacks`, `message_deliveries`

### Features

- Automatic lead creation from Messenger
- AI-powered responses
- 24-hour messaging window
- Support for quick replies and buttons

---

## 🎵 TikTok Direct Messages Integration

### Prerequisites

1. **TikTok Business Account**
2. **TikTok Developer App**
3. **Client Key and Client Secret**

### Environment Variables

```bash
# TikTok
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
# Client key and access token configured per tenant in channel_connections table
```

### Webhook Configuration

1. Go to TikTok Developer Portal → Your App → Webhooks
2. Set Webhook URL: `https://your-domain.vercel.app/api/webhook/tiktok/[your-tenant-slug]`
3. Set Verify Token: Same as in `channel_connections.verify_token`
4. Subscribe to: `direct_message.receive`

### TikTok Limitations

- **10 messages per user per day** (platform limit)
- **24-hour response window**
- User must initiate conversation
- No support for media in automated responses (text only)

### Features

- Automatic lead creation from TikTok DMs
- AI-powered text responses
- Lead scoring
- Respects daily message limits

---

## 🤖 Claude AI Integration

### Prerequisites

1. **Anthropic API Key** from [console.anthropic.com](https://console.anthropic.com)

### Environment Variables

```bash
# Anthropic (Claude AI)
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### AI Configuration per Tenant

Each tenant can customize AI behavior in the `ai_tenant_context` table:

| Field | Description | Default |
|-------|-------------|---------|
| `system_prompt` | Base instructions for AI | Professional dental assistant |
| `temperature` | Creativity level (0.0-1.0) | 0.7 |
| `max_tokens` | Maximum response length | 500 |
| `response_style` | Tone of communication | 'professional' |
| `business_hours` | Operating hours (JSON) | 9am-6pm |
| `escalation_keywords` | Keywords to escalate to human | ['urgent', 'complaint'] |
| `auto_escalate_after_messages` | Auto-escalate after N messages | 5 |

### Lead Scoring Signals

The AI analyzes each message and updates lead scores based on:

| Signal | Points | Description |
|--------|--------|-------------|
| `interested` | +10 | Shows interest in services |
| `urgent` | +15 | Expresses urgency |
| `budget_mentioned` | +20 | Mentions budget/pricing |
| `decision_maker` | +15 | Is the decision maker |
| `comparing` | +5 | Comparing options |
| `not_interested` | -20 | Explicitly not interested |
| `spam` | -50 | Spam detected |

Leads are classified as:
- **HOT** (score >= 70)
- **WARM** (score >= 40)
- **COLD** (score < 40)

---

## ⚙️ Job Queue System

### Overview

All message processing happens asynchronously via a job queue stored in the `jobs` table.

### Job Types

| Type | Description | Triggered By |
|------|-------------|--------------|
| `ai_response` | Generate AI response | Incoming message |
| `send_whatsapp` | Send WhatsApp message | AI response complete |
| `send_instagram` | Send Instagram DM | AI response complete |
| `send_facebook` | Send Facebook message | AI response complete |
| `send_tiktok` | Send TikTok DM | AI response complete |

### Job Processor Configuration

The job processor runs via cron job:

```bash
# Environment variable for security
CRON_SECRET=your_secure_random_string
```

**Vercel cron configuration** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/jobs/process",
    "schedule": "*/1 * * * *"
  }]
}
```

For other hosting providers, set up a cron job to call:
```bash
curl -X POST https://your-domain.com/api/jobs/process \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"max_jobs": 10}'
```

---

## ⚡ n8n Workflow Integration (Legacy)

### Prerequisites

1. **n8n instance** (self-hosted or n8n.cloud)
2. **Webhook nodes** for receiving events
3. **HTTP Request nodes** for callbacks

### Environment Variables

```bash
# n8n Webhooks
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
N8N_API_KEY=your_optional_api_key
```

### Required Workflows

Create these workflows in n8n:

#### 1. AI Conversation Handler
**Webhook Path:** `/ai-conversation`

**Purpose:** Receives incoming WhatsApp messages, generates AI response, sends back via callback.

**Expected Input:**
```json
{
  "event": "ai-conversation",
  "timestamp": "2025-01-07T12:00:00Z",
  "tenant_id": "a0000000-0000-0000-0000-000000000001",
  "data": {
    "conversation": { "id": "uuid", "lead_id": "uuid" },
    "messages": [{ "content": "Hola, quiero una cita", "sender_type": "lead" }],
    "lead": { "name": "Juan", "interested_services": ["limpieza"] },
    "context": { "services": [...], "faqs": [...] }
  }
}
```

**Workflow Steps:**
1. Webhook trigger receives message
2. Fetch ESVA context (services, FAQs, business hours)
3. Call Claude/OpenAI API with conversation history
4. Parse response for actions (schedule_appointment, escalate, etc.)
5. HTTP Request back to `/api/webhook` with action:

```json
{
  "action": "ai_response",
  "conversation_id": "uuid",
  "content": "¡Hola Juan! Claro, podemos agendar tu cita...",
  "model": "claude-3-opus",
  "tokens": 150
}
```

#### 2. Lead Scorer
**Webhook Path:** `/score-lead`

**Purpose:** Calculates lead score based on interactions.

**Scoring Logic:**
```javascript
// Base score: 50
let score = 50;

// +10 for each message sent
score += messages.length * 2;

// +15 if interested in high-value services
if (interested_services.includes('implantes')) score += 15;

// +20 if has scheduled appointment
if (has_appointment) score += 20;

// +10 if responded within 24h
if (quick_response) score += 10;

// Classification
if (score >= 80) classification = 'hot';
else if (score >= 40) classification = 'warm';
else classification = 'cold';
```

**Callback:**
```json
{
  "action": "update_lead_score",
  "lead_id": "uuid",
  "score": 75,
  "reason": "High engagement, interested in implants"
}
```

#### 3. Appointment Scheduler
**Webhook Path:** `/schedule-appointment`

**Purpose:** AI-assisted appointment scheduling from chat.

**Input:**
```json
{
  "lead_id": "uuid",
  "service_id": "uuid",
  "preferred_dates": ["2025-01-15", "2025-01-16"],
  "branch_id": "uuid"
}
```

**Steps:**
1. Check available slots (query Supabase)
2. Find best match with preferences
3. Create appointment via callback
4. Send WhatsApp confirmation

#### 4. Appointment Reminders (Scheduled)
**Trigger:** Cron (daily at 9:00 AM)

**Steps:**
1. Query appointments for tomorrow
2. For each appointment:
   - Fetch lead phone
   - Send reminder via WhatsApp API
   - Update `reminder_sent = true`

#### 5. Follow-up Automation (Scheduled)
**Trigger:** Cron (every 4 hours)

**Steps:**
1. Query leads with no response in 48h
2. Send follow-up message
3. If no response after 3 attempts, mark as cold

---

## 🔄 Webhook Callback Actions

The `/api/webhook` endpoint accepts these actions from n8n:

| Action | Required Fields | Description |
|--------|----------------|-------------|
| `ai_response` | conversation_id, content | Save AI message to conversation |
| `update_lead_score` | lead_id, score | Update lead score and classification |
| `schedule_appointment` | lead_id, branch_id, scheduled_at | Create new appointment |
| `escalate_conversation` | conversation_id, reason | Escalate to human agent |

---

## 🎯 Integration Hook

Use the `useIntegrations` hook in React components:

```typescript
import { useIntegrations } from '@/src/shared/hooks';

function ConversationPanel() {
  const {
    status,
    isLoading,
    sendWhatsAppMessage,
    requestAIResponse,
    escalateConversation,
  } = useIntegrations();

  // Check if integrations are available
  if (!status.whatsapp) {
    return <div>WhatsApp not configured</div>;
  }

  const handleSend = async () => {
    await sendWhatsAppMessage({
      conversationId: 'uuid',
      leadPhone: '+521234567890',
      content: 'Hello!',
    });
  };

  const handleAI = async () => {
    await requestAIResponse(conversation, messages, lead);
  };

  const handleEscalate = async () => {
    await escalateConversation(conversationId, 'Customer requested human agent');
  };
}
```

---

## 📊 Realtime Updates

The platform includes realtime subscriptions for immediate updates:

```typescript
import { useRealtimeDashboard } from '@/src/shared/hooks';

function Dashboard() {
  const { newLeadsCount, newMessagesCount, escalatedConversations } = useRealtimeDashboard({
    onNewLead: (lead) => console.log('New lead:', lead),
    onNewMessage: (msg) => console.log('New message:', msg),
    onEscalation: (conv) => console.log('Escalated:', conv),
  });

  return (
    <div>
      <Badge>{newLeadsCount} new leads</Badge>
      <Badge>{newMessagesCount} unread messages</Badge>
    </div>
  );
}
```

---

## ✅ Testing Checklist

### WhatsApp Integration
- [ ] Webhook verification working
- [ ] Incoming messages saved to DB
- [ ] Outgoing messages delivered
- [ ] Templates approved and working
- [ ] Interactive buttons/lists functional

### n8n Integration
- [ ] AI conversation workflow connected
- [ ] Lead scoring automation running
- [ ] Appointment scheduling via chat working
- [ ] Reminders sent on schedule
- [ ] Follow-ups automated

### Realtime
- [ ] New leads appear instantly
- [ ] Messages update in real-time
- [ ] Escalations trigger notifications

---

## 🚀 Deployment

### Vercel Environment Variables

Add all required variables to Vercel Dashboard (Settings → Environment Variables):

**Multi-Channel Messaging:**
```bash
# WhatsApp Business
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_BUSINESS_ACCOUNT_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx
WHATSAPP_VERIFY_TOKEN=xxx

# Meta (Instagram + Facebook)
META_APP_SECRET=xxx

# TikTok
TIKTOK_CLIENT_SECRET=xxx

# AI Integration
ANTHROPIC_API_KEY=sk-ant-xxx

# Job Queue
CRON_SECRET=xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**Per-Tenant Configuration:**

Each tenant stores their own credentials in the `channel_connections` table:
- Instagram Page ID and Access Token
- Facebook Page ID and Access Token
- TikTok Client Key and Access Token
- Webhook verify tokens

This allows multi-tenant isolation with different credentials per customer.

### n8n Deployment

If self-hosting n8n:
1. Use Docker: `docker run -it --name n8n -p 5678:5678 n8nio/n8n`
2. Set up SSL with reverse proxy
3. Configure persistent storage for workflows

### Multi-Channel Webhooks

Update webhook URLs in respective developer portals after deployment:

**WhatsApp:**
- URL: `https://your-app.vercel.app/api/webhook/whatsapp/[tenant-slug]`
- Meta Developer Portal → WhatsApp → Configuration

**Instagram:**
- URL: `https://your-app.vercel.app/api/webhook/instagram/[tenant-slug]`
- Meta Developer Portal → Instagram → Configuration

**Facebook:**
- URL: `https://your-app.vercel.app/api/webhook/facebook/[tenant-slug]`
- Meta Developer Portal → Messenger → Configuration

**TikTok:**
- URL: `https://your-app.vercel.app/api/webhook/tiktok/[tenant-slug]`
- TikTok Developer Portal → Webhooks

Replace `[tenant-slug]` with each tenant's actual slug (e.g., `esva-dental`).

---

## 📞 Support

For integration support:
- **WhatsApp API:** [Meta Business Help Center](https://business.facebook.com/help/)
- **Instagram/Facebook:** [Meta for Developers](https://developers.facebook.com/)
- **TikTok API:** [TikTok for Developers](https://developers.tiktok.com/)
- **Claude AI:** [Anthropic Documentation](https://docs.anthropic.com/)
- **Platform Issues:** Check webhook logs in Vercel or `/docs/MULTI_CHANNEL_AI_SYSTEM.md`

## 📊 Testing Multi-Channel Integration

### Test Each Channel

**WhatsApp:**
```bash
curl -X POST http://localhost:3000/api/webhook/whatsapp/esva-dental \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "521234567890",
            "type": "text",
            "text": {"body": "Hola"}
          }]
        }
      }]
    }]
  }'
```

**Instagram:**
```bash
curl -X POST http://localhost:3000/api/webhook/instagram/esva-dental \
  -H "Content-Type: application/json" \
  -d '{
    "object": "instagram",
    "entry": [{
      "messaging": [{
        "sender": {"id": "12345"},
        "message": {"text": "Hola"}
      }]
    }]
  }'
```

**Job Queue:**
```bash
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"max_jobs": 5}'
```

---

## 🎯 Quick Start Checklist

- [ ] Configure all environment variables
- [ ] Set up channel credentials in `channel_connections` table
- [ ] Configure AI context in `ai_tenant_context` table
- [ ] Register webhook URLs in each platform
- [ ] Test webhook verification (GET requests)
- [ ] Send test messages to each channel
- [ ] Verify jobs are being processed
- [ ] Check AI responses are being generated
- [ ] Monitor lead scoring updates
- [ ] Set up cron job for job processor

---

*The AI multi-channel system is fully implemented and ready for production. For complete technical documentation, see `/docs/MULTI_CHANNEL_AI_SYSTEM.md`.*
