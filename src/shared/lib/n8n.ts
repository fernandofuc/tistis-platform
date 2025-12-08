// =====================================================
// TIS TIS PLATFORM - n8n Integration Client
// Ready for workflow automation integration
// =====================================================

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// ======================
// Types
// ======================
export interface N8nWebhookPayload {
  event: string;
  timestamp: string;
  tenant_id: string;
  data: Record<string, unknown>;
}

export interface N8nWorkflowTrigger {
  workflowId?: string;
  webhookPath: string;
  data: Record<string, unknown>;
}

// ======================
// Workflow Event Types
// ======================
export const N8N_EVENTS = {
  // Lead Events
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_SCORE_CHANGED: 'lead.score_changed',
  LEAD_HOT: 'lead.became_hot',

  // Conversation Events
  CONVERSATION_STARTED: 'conversation.started',
  CONVERSATION_ESCALATED: 'conversation.escalated',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',

  // Appointment Events
  APPOINTMENT_SCHEDULED: 'appointment.scheduled',
  APPOINTMENT_CONFIRMED: 'appointment.confirmed',
  APPOINTMENT_CANCELLED: 'appointment.cancelled',
  APPOINTMENT_COMPLETED: 'appointment.completed',
  APPOINTMENT_REMINDER_DUE: 'appointment.reminder_due',

  // AI Events
  AI_RESPONSE_NEEDED: 'ai.response_needed',
  AI_RESPONSE_GENERATED: 'ai.response_generated',
  AI_HANDOFF_REQUIRED: 'ai.handoff_required',

  // Quote Events
  QUOTE_REQUESTED: 'quote.requested',
  QUOTE_SENT: 'quote.sent',
  QUOTE_ACCEPTED: 'quote.accepted',
} as const;

// ======================
// n8n Client Class
// ======================
class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = N8N_WEBHOOK_URL;
    this.apiKey = N8N_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  // ======================
  // Trigger Webhook
  // ======================
  async triggerWebhook(
    path: string,
    data: Record<string, unknown>,
    tenantId: string = process.env.NEXT_PUBLIC_ESVA_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    if (!this.isConfigured()) {
      console.log('[n8n] Not configured, skipping webhook trigger');
      return { success: false, error: 'n8n not configured' };
    }

    try {
      const url = `${this.baseUrl}${path}`;
      const payload: N8nWebhookPayload = {
        event: path.replace(/^\//, ''),
        timestamp: new Date().toISOString(),
        tenant_id: tenantId,
        data,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[n8n] Webhook error:', error);
        return { success: false, error };
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('[n8n] Webhook request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ======================
  // Event-Specific Triggers
  // ======================

  // Lead Events
  async onLeadCreated(lead: Record<string, unknown>) {
    return this.triggerWebhook('/lead-created', { lead });
  }

  async onLeadScoreChanged(lead: Record<string, unknown>, previousScore: number) {
    return this.triggerWebhook('/lead-score-changed', {
      lead,
      previous_score: previousScore,
      new_score: lead.score,
    });
  }

  async onLeadBecameHot(lead: Record<string, unknown>) {
    return this.triggerWebhook('/lead-hot', { lead });
  }

  // Conversation Events
  async onMessageReceived(
    conversation: Record<string, unknown>,
    message: Record<string, unknown>,
    lead: Record<string, unknown>
  ) {
    return this.triggerWebhook('/message-received', {
      conversation,
      message,
      lead,
    });
  }

  async onConversationEscalated(
    conversation: Record<string, unknown>,
    reason: string
  ) {
    return this.triggerWebhook('/conversation-escalated', {
      conversation,
      reason,
    });
  }

  // AI Events
  async requestAIResponse(
    conversation: Record<string, unknown>,
    messages: Record<string, unknown>[],
    lead: Record<string, unknown>,
    context: Record<string, unknown> = {}
  ) {
    return this.triggerWebhook('/ai-response-needed', {
      conversation,
      messages,
      lead,
      context: {
        ...context,
        tenant_id: lead.tenant_id,
        branch_id: lead.branch_id,
      },
    });
  }

  // Appointment Events
  async onAppointmentScheduled(appointment: Record<string, unknown>) {
    return this.triggerWebhook('/appointment-scheduled', { appointment });
  }

  async onAppointmentReminderDue(appointment: Record<string, unknown>) {
    return this.triggerWebhook('/appointment-reminder', { appointment });
  }

  async onAppointmentCancelled(
    appointment: Record<string, unknown>,
    reason?: string
  ) {
    return this.triggerWebhook('/appointment-cancelled', {
      appointment,
      reason,
    });
  }

  // Quote Events
  async onQuoteRequested(
    lead: Record<string, unknown>,
    services: string[],
    notes?: string
  ) {
    return this.triggerWebhook('/quote-requested', {
      lead,
      services,
      notes,
    });
  }

  async onQuoteSent(quote: Record<string, unknown>) {
    return this.triggerWebhook('/quote-sent', { quote });
  }
}

// ======================
// Export singleton instance
// ======================
export const n8nClient = new N8nClient();

// ======================
// Utility: Trigger with Retry
// ======================
export async function triggerN8nWithRetry(
  path: string,
  data: Record<string, unknown>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await n8nClient.triggerWebhook(path, data);

    if (result.success) {
      return result;
    }

    lastError = result.error;
    console.log(`[n8n] Attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`);

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2; // Exponential backoff
    }
  }

  return { success: false, error: lastError };
}

// ======================
// Workflow Templates for ESVA
// ======================
export const ESVA_WORKFLOWS = {
  // Main AI conversation handler
  AI_CONVERSATION: {
    path: '/ai-conversation',
    description: 'Handles incoming WhatsApp messages, generates AI responses',
  },

  // Appointment scheduling via AI
  APPOINTMENT_SCHEDULER: {
    path: '/schedule-appointment',
    description: 'AI-assisted appointment scheduling from chat',
  },

  // Lead scoring automation
  LEAD_SCORER: {
    path: '/score-lead',
    description: 'Automatically scores leads based on interactions',
  },

  // Appointment reminders
  APPOINTMENT_REMINDERS: {
    path: '/send-reminders',
    description: 'Sends 24h appointment reminders via WhatsApp',
  },

  // Quote generator
  QUOTE_GENERATOR: {
    path: '/generate-quote',
    description: 'Generates and sends service quotes',
  },

  // Follow-up automation
  FOLLOW_UP: {
    path: '/follow-up',
    description: 'Sends follow-up messages to unresponsive leads',
  },
} as const;

// ======================
// n8n Workflow Configuration Interface
// For documenting expected workflows
// ======================
export interface N8nWorkflowConfig {
  name: string;
  webhookPath: string;
  expectedInput: {
    field: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  expectedOutput: {
    field: string;
    type: string;
    description: string;
  }[];
  callbackUrl?: string;
}

// Document expected workflows for n8n setup
export const REQUIRED_WORKFLOWS: N8nWorkflowConfig[] = [
  {
    name: 'AI Conversation Handler',
    webhookPath: '/ai-conversation',
    expectedInput: [
      { field: 'conversation', type: 'object', required: true, description: 'Conversation object with id, lead_id' },
      { field: 'messages', type: 'array', required: true, description: 'Array of message objects' },
      { field: 'lead', type: 'object', required: true, description: 'Lead object with name, interested_services' },
      { field: 'context', type: 'object', required: false, description: 'Additional context (services, FAQs)' },
    ],
    expectedOutput: [
      { field: 'response', type: 'string', description: 'AI-generated response text' },
      { field: 'action', type: 'string', description: 'Optional: schedule_appointment, escalate, etc.' },
      { field: 'data', type: 'object', description: 'Action-specific data' },
    ],
    callbackUrl: '/api/webhook',
  },
  {
    name: 'Lead Scorer',
    webhookPath: '/score-lead',
    expectedInput: [
      { field: 'lead', type: 'object', required: true, description: 'Lead object to score' },
      { field: 'interactions', type: 'array', required: false, description: 'Recent interactions' },
    ],
    expectedOutput: [
      { field: 'score', type: 'number', description: 'Calculated score 0-100' },
      { field: 'classification', type: 'string', description: 'hot, warm, or cold' },
      { field: 'reason', type: 'string', description: 'Explanation of score' },
    ],
    callbackUrl: '/api/webhook',
  },
  {
    name: 'Appointment Scheduler',
    webhookPath: '/schedule-appointment',
    expectedInput: [
      { field: 'lead_id', type: 'string', required: true, description: 'Lead UUID' },
      { field: 'service_id', type: 'string', required: false, description: 'Service UUID' },
      { field: 'preferred_dates', type: 'array', required: false, description: 'Preferred dates/times' },
      { field: 'branch_id', type: 'string', required: false, description: 'Branch UUID' },
    ],
    expectedOutput: [
      { field: 'appointment', type: 'object', description: 'Created appointment object' },
      { field: 'confirmation_sent', type: 'boolean', description: 'Whether WhatsApp confirmation was sent' },
    ],
    callbackUrl: '/api/webhook',
  },
];
