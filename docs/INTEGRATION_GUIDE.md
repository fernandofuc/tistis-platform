# TIS TIS Platform - Integration Guide

**Versión:** 2.1.0
**Última actualización:** 8 de Diciembre, 2024

## 🔌 Overview

This document describes how to complete the WhatsApp Business API and n8n workflow integrations for the TIS TIS Platform (ESVA Dental Clinic Pilot).

The platform is **ready to assemble** - all code, hooks, and endpoints are in place. You only need to:
1. Set up WhatsApp Business API credentials
2. Create n8n workflows
3. Configure environment variables

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
2. Set Webhook URL: `https://your-domain.vercel.app/api/webhook`
3. Set Verify Token: Same as `WHATSAPP_VERIFY_TOKEN` in env
4. Subscribe to: `messages`, `message_templates`

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

## ⚡ n8n Workflow Integration

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

Add all variables to Vercel Dashboard:
- Settings → Environment Variables
- Add for Production environment

### n8n Deployment

If self-hosting n8n:
1. Use Docker: `docker run -it --name n8n -p 5678:5678 n8nio/n8n`
2. Set up SSL with reverse proxy
3. Configure persistent storage for workflows

### WhatsApp Webhook

Update webhook URL in Meta Developer Portal after deployment:
`https://your-app.vercel.app/api/webhook`

---

## 📞 Support

For integration support:
- WhatsApp API: [Meta Business Help Center](https://business.facebook.com/help/)
- n8n: [n8n Documentation](https://docs.n8n.io/)
- Platform Issues: Check `/api/webhook` logs in Vercel

---

*This platform is ready to assemble. Just add credentials and connect workflows!*
