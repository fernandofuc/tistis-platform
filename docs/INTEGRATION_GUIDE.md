# TIS TIS Platform - Integration Guide

**Version:** 4.8.5
**Ultima actualizacion:** 30 de Enero, 2026

## Overview

This document describes how to complete the multi-channel messaging, Voice Agent, AI integrations, and External System integrations for the TIS TIS Platform.

The platform now includes a **complete AI multi-channel system** with:
1. WhatsApp Business Cloud API
2. Instagram Direct Messages (Meta Graph API)
3. Facebook Messenger (Meta Graph API)
4. TikTok Direct Messages (TikTok Business API)
5. Voice Agent with VAPI (inbound/outbound calls)
6. Claude AI integration for automated responses
7. Job queue system for asynchronous processing
8. **Integration Hub** for CRM, POS, and external systems (NEW v4.4.0)

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

## 📞 Voice Agent Integration (VAPI)

### Prerequisites

1. **VAPI Account** from [vapi.ai](https://vapi.ai)
2. **VAPI API Key** with webhook access
3. **11Labs Account** for voice synthesis (optional but recommended)
4. **Deepgram Account** for transcription (optional, defaults to Deepgram free tier)

### Environment Variables

Add these to your `.env.local`:

```bash
# VAPI
VAPI_AUTH_TOKEN=your_vapi_api_key
VAPI_WEBHOOK_SECRET=your_webhook_secret

# 11Labs (Voice)
ELEVENLABS_API_KEY=your_elevenlabs_key

# Anthropic (Claude for Voice)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Deepgram (Transcription - optional)
DEEPGRAM_API_KEY=your_deepgram_key
```

### Phone Number Setup

1. **Request Phone Numbers** via dashboard or API
   - Requires Growth plan
   - Creates pending phone number request
   - Provisioning happens asynchronously

2. **Activate Phone Numbers**
   - Once provisioned, activate in voice_phone_numbers table
   - Associate with branch (optional)

```typescript
import { requestPhoneNumber } from '@/src/features/voice-agent/services/voice-agent.service';

const result = await requestPhoneNumber('tenant-uuid', '664', 'branch-uuid');
if (result.success) {
  console.log('Phone number requested:', result.phoneNumber.id);
}
```

### Voice Agent Configuration

Each tenant configures their Voice Agent:

```typescript
import { updateVoiceConfig } from '@/src/features/voice-agent/services/voice-agent.service';

await updateVoiceConfig('tenant-uuid', {
  voice_enabled: true,
  assistant_name: 'María',

  // AI Model
  ai_model: 'claude-3-5-sonnet-20241022',
  ai_temperature: 0.7,
  ai_max_tokens: 500,

  // Voice (11Labs)
  voice_id: 'EXAVITQu4vr4xnSDxMaL',  // Default: Bella
  voice_stability: 0.75,
  voice_similarity_boost: 0.75,

  // Greeting
  first_message: 'Hola, soy {assistant_name} de {business_name}. ¿En qué puedo ayudarte?',
  first_message_mode: 'assistant_speaks_first',

  // Timing
  wait_seconds: 0,
  on_punctuation_seconds: 0.1,
  on_no_punctuation_seconds: 1.5,
}, 'staff-uuid');
```

### Auto-Generate Prompt

The system automatically generates prompts based on tenant data:

```typescript
import { generatePrompt } from '@/src/features/voice-agent/services/voice-agent.service';

const prompt = await generatePrompt('tenant-uuid');
// Automatically includes:
// - Business name and contact info
// - All services with prices
// - Staff with specialties
// - Branches with hours
// - Knowledge base (custom instructions)
// - And more...
```

### Webhook Configuration

1. Configure webhook URL in VAPI dashboard
2. URL format: `https://your-domain.com/api/voice-agent/webhook`
3. Add `VAPI_WEBHOOK_SECRET` to environment

**Supported VAPI Events:**
- `assistant-request` - VAPI requests assistant config
- `transcript` - Conversation transcript
- `function-call` - LLM function calls
- `end-of-call-report` - Call ended
- `status-update` - Call status changes

### Available Functions in System Prompt

The Voice Agent can call these functions:

```typescript
// In system prompt, include:
{
  "functions": [
    {
      "name": "schedule_appointment",
      "description": "Agendar una cita",
      "parameters": {
        "service": "string",
        "date": "string (YYYY-MM-DD)",
        "time": "string (HH:MM)",
        "customer_name": "string",
        "customer_phone": "string"
      }
    },
    {
      "name": "transfer_to_agent",
      "description": "Transferir a agente humano",
      "parameters": {
        "reason": "string"
      }
    },
    {
      "name": "get_business_info",
      "description": "Obtener información del negocio",
      "parameters": {}
    }
  ]
}
```

### Plan Restrictions

Voice Agent is only available for **Growth** plan tenants:

```typescript
import { canAccessVoiceAgent } from '@/src/features/voice-agent/services/voice-agent.service';

const access = await canAccessVoiceAgent('tenant-uuid');
if (!access.canAccess) {
  console.error(access.reason); // "Voice Agent solo está disponible en el plan Growth"
}
```

### Call Analytics

Get call statistics and performance metrics:

```typescript
import { getUsageSummary, getRecentCalls } from '@/src/features/voice-agent/services/voice-agent.service';

// Get calls (last 20)
const calls = await getRecentCalls('tenant-uuid', 20, 0);

// Get detailed metrics (last 30 days)
const summary = await getUsageSummary('tenant-uuid');
// Returns: {
//   total_calls,
//   total_minutes,
//   total_cost_usd,
//   avg_call_duration_seconds,
//   appointment_booking_rate (%),
//   escalation_rate (%),
//   by_day: [{date, calls, minutes, cost_usd}]
// }
```

### Call Details & Transcripts

Retrieve call information and conversation transcripts:

```typescript
import { getCallDetails, getCallMessages } from '@/src/features/voice-agent/services/voice-agent.service';

const call = await getCallDetails('call-uuid', 'tenant-uuid');
// Returns: {
//   id, tenant_id, vapi_call_id,
//   customer_phone, customer_name,
//   status, duration_seconds, cost_usd,
//   outcome, escalated,
//   transcript, recording_url,
//   started_at, ended_at
// }

const messages = await getCallMessages('call-uuid');
// Returns: [{
//   id, role: 'user'|'assistant'|'system',
//   content, sequence_number, created_at
// }]
```

### Voice ID Options (11Labs)

Popular voice IDs for Spanish:
- `EXAVITQu4vr4xnSDxMaL` - Bella (Default, warm & friendly)
- `TxGEqnHWrfncoIPqAKQe` - Adam (Professional, male)
- `FGthdsQc5BLike5CT8zO` - Liam (Conversational, young)
- `piTKgcLEGmPE4e6mEKli` - Charlotte (Warm, female)

### Database Tables

Voice Agent uses these tables:
- `voice_calls` - Call metadata
- `voice_call_messages` - Transcripts
- `voice_agent_config` - Tenant configuration
- `voice_phone_numbers` - Phone numbers
- `voice_prompt_templates` - System prompt templates

See `/docs/VOICE_AGENT_SYSTEM.md` for detailed schema documentation.

### Testing Voice Agent

1. **Verify Setup:**
```sql
-- Check tenant config
SELECT * FROM voice_agent_config WHERE tenant_id = 'tenant-uuid';

-- Check phone numbers
SELECT * FROM voice_phone_numbers WHERE tenant_id = 'tenant-uuid';

-- Generate prompt
SELECT public.generate_voice_agent_prompt('tenant-uuid'::UUID);
```

2. **Simulate Webhook:**
```bash
curl -X POST http://localhost:3000/api/voice-agent/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VAPI_SECRET" \
  -d '{
    "type": "assistant-request",
    "call": {
      "id": "call-123",
      "phoneNumber": { "number": "+52 664 123 4567" },
      "customer": { "number": "+52 664 999 8888" }
    }
  }'
```

### Voice Agent Checklist

- [ ] VAPI account created and API key added to env
- [ ] 11Labs account created (for voice quality)
- [ ] Phone number(s) requested and provisioned
- [ ] Phone number(s) associated with tenant
- [ ] Voice Agent config created
- [ ] System prompt generated and customized
- [ ] Voice settings configured (voice_id, stability, etc)
- [ ] Webhook URL registered in VAPI
- [ ] Test call received and logged
- [ ] Transcripts being saved to voice_call_messages
- [ ] Analytics available in dashboard

---

## Integration Hub - External Systems (NEW v4.4.0)

### Overview

Integration Hub allows connecting TIS TIS with external systems (CRMs, POS, dental software, calendars) bidirectionally. External data is stored in separate tables (`external_*`) and is optionally available to the AI agents.

### Supported Systems

| Category | Systems | Status |
|----------|---------|--------|
| **CRM** | HubSpot, Salesforce, Zoho CRM, Pipedrive, Freshsales | HubSpot ready, others coming soon |
| **Dental Software** | Dentrix, Open Dental, Eaglesoft, Curve Dental | Coming soon |
| **POS** | Square, Toast, Clover, Lightspeed, SoftRestaurant | Coming soon |
| **Calendar** | Google Calendar, Calendly, Acuity | Coming soon |
| **Medical** | Epic, Cerner, Athenahealth | Coming soon |
| **Generic** | Incoming Webhook, CSV Import, Custom API | Available |

### Authentication Types

| Type | Description | Systems |
|------|-------------|---------|
| `oauth2` | OAuth 2.0 flow with refresh tokens | HubSpot, Salesforce, Square, Google Calendar |
| `api_key` | Simple API key authentication | Dentrix, Open Dental, Custom API |
| `basic_auth` | Username + Password | Legacy systems |
| `webhook_secret` | HMAC signature verification | Incoming Webhook |

### Sync Configuration

**Sync Direction:**
- `inbound` - External system to TIS TIS only
- `outbound` - TIS TIS to external system only
- `bidirectional` - Both directions

**Sync Frequency Options:**
- 5, 15, 30, 60 minutes (configurable per integration)

**Data Types:**
- Contacts (customers, leads)
- Appointments (calendar events)
- Products (menu items, catalog)
- Inventory (stock levels with low-stock alerts)
- Orders (sales, transactions)

### Database Tables

```sql
-- Main integration connection table
integration_connections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  branch_id UUID,                    -- Optional: branch-specific integration
  integration_type TEXT NOT NULL,    -- 'hubspot', 'dentrix', 'square', etc.
  status TEXT NOT NULL,              -- 'pending', 'connected', 'error', etc.
  auth_type TEXT NOT NULL,           -- 'oauth2', 'api_key', 'basic_auth'

  -- Credentials (encrypted at rest)
  credentials_encrypted BYTEA,

  -- Sync configuration
  sync_enabled BOOLEAN DEFAULT false,
  sync_direction TEXT DEFAULT 'inbound',
  sync_frequency_minutes INTEGER DEFAULT 60,
  sync_contacts BOOLEAN DEFAULT true,
  sync_appointments BOOLEAN DEFAULT true,
  sync_products BOOLEAN DEFAULT false,
  sync_inventory BOOLEAN DEFAULT false,

  -- Statistics
  last_sync_at TIMESTAMPTZ,
  records_synced_total INTEGER DEFAULT 0,
  records_synced_today INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- External contacts with deduplication
external_contacts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL,
  external_id TEXT NOT NULL,         -- ID from external system

  -- Contact data
  full_name TEXT,
  email TEXT,
  phone TEXT,
  phone_normalized TEXT,             -- Normalized for matching

  -- Deduplication links
  linked_lead_id UUID,               -- FK to leads table
  linked_patient_id UUID,            -- FK to patients table
  dedup_status TEXT DEFAULT 'pending',

  raw_data JSONB,                    -- Original external data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- External inventory with low-stock alerts
external_inventory (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  connection_id UUID NOT NULL,

  name TEXT NOT NULL,
  sku TEXT,
  quantity NUMERIC DEFAULT 0,
  reorder_point NUMERIC,
  is_low_stock BOOLEAN DEFAULT false,  -- quantity <= reorder_point
  category TEXT,

  raw_data JSONB,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync audit logs
integration_sync_logs (
  id UUID PRIMARY KEY,
  connection_id UUID NOT NULL,
  sync_started_at TIMESTAMPTZ DEFAULT NOW(),
  sync_ended_at TIMESTAMPTZ,
  status TEXT NOT NULL,              -- 'success', 'partial', 'error'
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT
);
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List tenant integrations |
| POST | `/api/integrations` | Create new integration |
| GET | `/api/integrations/[id]` | Get integration details |
| PATCH | `/api/integrations/[id]` | Update integration |
| DELETE | `/api/integrations/[id]` | Delete integration |
| POST | `/api/integrations/[id]/sync` | Trigger manual sync |

### RPC Functions

```sql
-- Normalize phone number for deduplication matching
SELECT normalize_phone_number('+52 (555) 123-4567');
-- Returns: 525551234567

-- Find existing lead for deduplication
SELECT * FROM find_matching_lead_for_dedup(
  'tenant-uuid',
  '+521234567890',
  'email@example.com'
);
-- Returns: lead_id, match_type ('phone'|'email'), confidence (0.90-0.95)

-- Get external data for AI context
SELECT get_tenant_external_data('tenant-uuid');
-- Returns JSONB:
-- {
--   "has_integrations": true,
--   "source_systems": ["hubspot", "square"],
--   "low_stock_items": [...],
--   "external_products": [...],
--   "external_appointments_count": 15,
--   "last_sync_at": "2024-12-27T10:00:00Z"
-- }
```

### AI Integration

External data is loaded via `get_tenant_external_data()` and included in the `external_data` field of the `BusinessContext` for LangGraph agents.

```typescript
// In agent-state.ts, BusinessContext includes:
interface BusinessContext {
  // ... other fields ...

  external_data?: {
    has_integrations: boolean;
    source_systems: string[];
    low_stock_items?: Array<{
      name: string;
      sku?: string;
      quantity: number;
      reorder_point?: number;
      category?: string;
    }>;
    external_products?: Array<{
      name: string;
      price?: number;
      category?: string;
      is_available: boolean;
      preparation_time?: number;
    }>;
    external_appointments_count?: number;
    last_sync_at?: string;
  };
}
```

This allows AI agents to:
- Alert about low-stock items
- Reference external product catalogs (menus, etc.)
- Know about upcoming external appointments
- Provide more informed responses

### Dashboard Access

Users access Integration Hub at **Settings > Integrations** tab:

1. **View Active Integrations** - Cards showing sync status and statistics
2. **Add New Integration** - Catalog of available connectors by category
3. **Configure Sync** - Select data types and frequency
4. **View Logs** - Audit trail of sync operations
5. **Manual Sync** - Trigger immediate synchronization

### Setup Example: HubSpot

1. **Create Integration:**
```bash
POST /api/integrations
{
  "integration_type": "hubspot",
  "connection_name": "HubSpot CRM",
  "sync_contacts": true,
  "sync_appointments": true
}
```

2. **Complete OAuth:**
   - User is redirected to HubSpot authorization
   - On callback, credentials are stored encrypted

3. **Configure Sync:**
```bash
PATCH /api/integrations/[id]
{
  "sync_enabled": true,
  "sync_frequency_minutes": 15,
  "sync_direction": "bidirectional"
}
```

4. **Monitor:**
   - Check `last_sync_at` and `records_synced_total`
   - Review `integration_sync_logs` for any errors

### Setup Example: Incoming Webhook

For systems that can push data via webhook:

1. **Create Integration:**
```bash
POST /api/integrations
{
  "integration_type": "webhook_incoming",
  "connection_name": "Custom CRM Webhook"
}
```

2. **Get Webhook URL:**
   - Response includes `webhook_url`: `/api/integrations/webhook/{tenant_id}/{webhook_id}`

3. **Configure External System:**
   - Point external system to webhook URL
   - Include `X-Webhook-Secret` header for verification

4. **Receive Data:**
   - Webhook validates signature
   - Data is stored in `external_contacts`, `external_appointments`, etc.
   - Deduplication runs automatically

### Integration Hub Checklist

- [ ] Integration connection created via API or dashboard
- [ ] OAuth flow completed (for OAuth2 systems) or API key configured
- [ ] Sync settings configured (direction, frequency, data types)
- [ ] Initial sync completed successfully
- [ ] Deduplication reviewed (linked_lead_id, linked_patient_id)
- [ ] AI context loading verified (external_data in BusinessContext)
- [ ] Monitoring set up for sync errors

### Migration

Apply migration `078_INTEGRATION_HUB.sql` to create all required tables, functions, and RLS policies.

---

## Soft Restaurant Integration (v4.8.5+)

### Overview

The Soft Restaurant integration enables real-time synchronization of sales data from Soft Restaurant POS to TIS TIS Platform. Sales are automatically processed to create restaurant orders, map products, and deduce inventory.

### Integration Methods

| Method | Description | Recommended |
|--------|-------------|-------------|
| **TIS TIS Local Agent** | Windows service that reads SR database directly | Yes |
| **SR Cloud API** | REST API for SR Cloud users (limited features) | Only for SR Cloud |

### Architecture

```
Soft Restaurant POS (SQL Server)
       ↓
TIS TIS Local Agent (Windows Service)
       ↓ POST /api/agent/sync
TIS TIS Cloud
       ↓
sr_sales (pending)
       ↓ Background processing
restaurant_orders + inventory_movements
```

### Data Flow (v4.8.5+)

1. **Agent Sync**: TIS TIS Local Agent sends sales via `/api/agent/sync`
2. **Immediate Insert**: Sales inserted to `sr_sales` with status `pending`
3. **Background Processing**: `processCreatedSalesInBackground()` fires automatically
4. **Product Mapping**: SR products matched to TIS TIS menu items via fuzzy search
5. **Order Creation**: `restaurant_orders` created with correct schema mapping
6. **Inventory Deduction**: Recipes exploded and inventory deducted
7. **Low Stock Alerts**: Alerts generated for items below minimum stock

### Key Services

| Service | Purpose |
|---------|---------|
| `SoftRestaurantProcessor` | Main orchestrator for sale processing |
| `ProductMappingService` | Maps SR products to TIS TIS menu items |
| `RecipeDeductionService` | Explodes recipes and deducts inventory |
| `LowStockAlertService` | Checks and creates low stock alerts |
| `RestaurantOrderService` | Creates restaurant_orders from SR sales |

### Order Type Mapping

| SR Sale Type | TIS TIS Order Type |
|--------------|-------------------|
| `mesa`, `comedor`, `local`, `1` | `dine_in` |
| `llevar`, `para llevar`, `2` | `takeout` |
| `domicilio`, `delivery`, `3` | `delivery` |
| `autoservicio`, `drive`, `4` | `drive_thru` |
| `catering`, `evento`, `5` | `catering` |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/sync` | POST | Receive sales from Local Agent |
| `/api/agent/heartbeat` | POST | Agent status updates |
| `/api/agent/status` | GET | Get agent status with schema validation |
| `/api/internal/sr-process` | POST | Cron fallback for processing |

### Database Tables

```sql
sr_sales           -- Raw sales from Soft Restaurant
sr_sale_items      -- Line items per sale
sr_payments        -- Payment details
sr_product_mappings -- SR product ↔ TIS TIS menu item
agent_instances    -- TIS TIS Local Agent instances
```

### Processing Features

- **Automatic processing**: Sales processed immediately after sync
- **Cron fallback**: Every 5 minutes for missed sales
- **Batch optimization**: N+1 queries eliminated
- **Unmapped item support**: Items appear with `[SR]` prefix
- **Metadata preservation**: All SR data stored in JSONB

### Documentation

For detailed documentation, see:
- `/docs/integrations/SOFT_RESTAURANT_API.md` - API reference
- `/docs/integrations/SOFT_RESTAURANT_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `/docs/SOFT_RESTAURANT_LOCAL_AGENT_MASTER_SPEC.md` - Local Agent specification

### Soft Restaurant Checklist

- [ ] TIS TIS Local Agent installed on SR server
- [ ] Agent registered and authenticated
- [ ] Branch and store_code configured
- [ ] Initial sync completed
- [ ] Product mappings reviewed
- [ ] Inventory deduction verified
- [ ] Restaurant orders appearing correctly

---

*The multi-channel AI system and Integration Hub are fully implemented and ready for production. For Voice Agent technical details, see `/docs/VOICE_AGENT_SYSTEM.md`. For messaging integration details, see `/docs/MULTI_CHANNEL_AI_SYSTEM.md`.*
