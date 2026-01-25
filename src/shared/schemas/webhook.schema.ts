// =====================================================
// TIS TIS PLATFORM - Webhook Zod Schemas
// Validation schemas for Webhook API endpoints
// =====================================================

import { z } from 'zod';
import {
  uuidSchema,
  phoneSchema,
  optionalEmailSchema,
  channelTypeSchema,
} from './common.schema';

// ======================
// WEBHOOK EVENT TYPES
// ======================

export const webhookEventTypeSchema = z.enum([
  'message.received',
  'message.delivered',
  'message.read',
  'message.failed',
  'conversation.started',
  'conversation.ended',
  'lead.created',
  'lead.updated',
  'appointment.created',
  'appointment.updated',
  'appointment.cancelled',
  'payment.received',
  'custom',
]);

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

// ======================
// INBOUND MESSAGE (from external channels)
// ======================

/**
 * Schema for inbound message webhooks (WhatsApp, Instagram, etc.)
 */
export const inboundMessageSchema = z.object({
  // Message identification
  message_id: z.string().max(255),
  timestamp: z.union([z.string().datetime(), z.number()]),

  // Sender info
  from: phoneSchema,
  from_name: z.string().max(255).optional().nullable(),

  // Content
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'reaction', 'interactive']),
  text: z.string().max(4096).optional().nullable(),

  // Media (for non-text messages)
  media: z
    .object({
      url: z.string().url().max(2000).optional(),
      mime_type: z.string().max(100).optional(),
      file_name: z.string().max(255).optional(),
      file_size: z.number().nonnegative().optional(),
      caption: z.string().max(1024).optional(),
    })
    .optional()
    .nullable(),

  // Location (for location messages)
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().max(255).optional(),
      address: z.string().max(500).optional(),
    })
    .optional()
    .nullable(),

  // Context (for replies)
  context: z
    .object({
      message_id: z.string().max(255).optional(),
      from: z.string().max(50).optional(),
    })
    .optional()
    .nullable(),

  // Interactive responses
  interactive: z
    .object({
      type: z.enum(['button_reply', 'list_reply']).optional(),
      button_reply: z
        .object({
          id: z.string().max(255),
          title: z.string().max(255),
        })
        .optional(),
      list_reply: z
        .object({
          id: z.string().max(255),
          title: z.string().max(255),
          description: z.string().max(500).optional(),
        })
        .optional(),
    })
    .optional()
    .nullable(),

  // Raw payload for debugging
  raw: z.record(z.unknown()).optional().nullable(),
});

export type InboundMessageInput = z.infer<typeof inboundMessageSchema>;

// ======================
// MESSAGE STATUS UPDATE
// ======================

/**
 * Schema for message status webhooks
 */
export const messageStatusSchema = z.object({
  message_id: z.string().max(255),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.union([z.string().datetime(), z.number()]),
  recipient: phoneSchema,
  error: z
    .object({
      code: z.string().max(50).optional(),
      message: z.string().max(500).optional(),
    })
    .optional()
    .nullable(),
});

export type MessageStatusInput = z.infer<typeof messageStatusSchema>;

// ======================
// WHATSAPP CLOUD API WEBHOOK
// ======================

/**
 * Schema for WhatsApp Cloud API webhook payload
 */
export const whatsappWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal('whatsapp'),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string(),
            }),
            contacts: z
              .array(
                z.object({
                  profile: z.object({
                    name: z.string().optional(),
                  }),
                  wa_id: z.string(),
                })
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                  image: z
                    .object({
                      mime_type: z.string().optional(),
                      sha256: z.string().optional(),
                      id: z.string().optional(),
                      caption: z.string().optional(),
                    })
                    .optional(),
                  audio: z.object({ id: z.string() }).optional(),
                  video: z.object({ id: z.string() }).optional(),
                  document: z
                    .object({
                      id: z.string(),
                      filename: z.string().optional(),
                    })
                    .optional(),
                  location: z
                    .object({
                      latitude: z.number(),
                      longitude: z.number(),
                      name: z.string().optional(),
                      address: z.string().optional(),
                    })
                    .optional(),
                  interactive: z
                    .object({
                      type: z.string(),
                      button_reply: z
                        .object({
                          id: z.string(),
                          title: z.string(),
                        })
                        .optional(),
                      list_reply: z
                        .object({
                          id: z.string(),
                          title: z.string(),
                        })
                        .optional(),
                    })
                    .optional(),
                  context: z
                    .object({
                      from: z.string().optional(),
                      id: z.string().optional(),
                    })
                    .optional(),
                })
              )
              .optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.enum(['sent', 'delivered', 'read', 'failed']),
                  timestamp: z.string(),
                  recipient_id: z.string(),
                  errors: z
                    .array(
                      z.object({
                        code: z.number(),
                        title: z.string().optional(),
                      })
                    )
                    .optional(),
                })
              )
              .optional(),
          }),
          field: z.literal('messages'),
        })
      ),
    })
  ),
});

export type WhatsAppWebhookInput = z.infer<typeof whatsappWebhookSchema>;

// ======================
// V1 API WEBHOOK (Public API)
// ======================

/**
 * Schema for public V1 API webhook events
 */
export const v1WebhookEventSchema = z.object({
  event: webhookEventTypeSchema,
  timestamp: z.string().datetime(),

  // Event data (varies by event type)
  data: z.object({
    // Lead events
    lead: z
      .object({
        id: uuidSchema.optional(),
        name: z.string().max(255).optional(),
        phone: phoneSchema.optional(),
        email: optionalEmailSchema,
        source: z.string().max(100).optional(),
      })
      .optional(),

    // Message events
    message: z
      .object({
        id: z.string().max(255).optional(),
        content: z.string().max(4096).optional(),
        direction: z.enum(['inbound', 'outbound']).optional(),
        channel: channelTypeSchema.optional(),
      })
      .optional(),

    // Appointment events
    appointment: z
      .object({
        id: uuidSchema.optional(),
        scheduled_at: z.string().datetime().optional(),
        status: z.string().max(50).optional(),
      })
      .optional(),

    // Custom payload
    custom: z.record(z.unknown()).optional(),
  }),

  // Optional metadata
  metadata: z.record(z.unknown()).optional(),
});

export type V1WebhookEventInput = z.infer<typeof v1WebhookEventSchema>;

// ======================
// PATH PARAMS
// ======================

/**
 * Schema for tenant ID path parameter in webhooks
 */
export const webhookTenantParamSchema = z.object({
  tenantId: uuidSchema,
});

export type WebhookTenantParam = z.infer<typeof webhookTenantParamSchema>;
