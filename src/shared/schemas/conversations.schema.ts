// =====================================================
// TIS TIS PLATFORM - Conversations Zod Schemas
// Validation schemas for Conversation/Message API endpoints
// =====================================================

import { z } from 'zod';
import {
  uuidSchema,
  notesSchema,
  longTextSchema,
  paginationSchema,
  searchSchema,
  branchFilterSchema,
  dateRangeSchema,
  channelTypeSchema,
  messageDirectionSchema,
  booleanQuerySchema,
} from './common.schema';

// ======================
// CONVERSATION STATUS
// ======================

export const conversationStatusSchema = z.enum([
  'active',
  'resolved',
  'escalated',
  'pending',
  'closed',
]);

export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

// ======================
// CREATE CONVERSATION
// ======================

/**
 * Schema for creating a new conversation
 */
export const conversationCreateSchema = z.object({
  // Required fields
  lead_id: uuidSchema,
  channel: channelTypeSchema,

  // Optional fields
  channel_conversation_id: z.string().max(255).optional(),
  status: conversationStatusSchema.optional().default('active'),
  ai_handling: z.boolean().optional().default(true),
  branch_id: uuidSchema.optional().nullable(),
  assigned_staff_id: uuidSchema.optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;

// ======================
// UPDATE CONVERSATION
// ======================

/**
 * Schema for updating a conversation
 */
export const conversationUpdateSchema = z.object({
  status: conversationStatusSchema.optional(),
  ai_handling: z.boolean().optional(),
  assigned_staff_id: uuidSchema.optional().nullable(),
  resolved_at: z.string().datetime().optional().nullable(),
  escalated_at: z.string().datetime().optional().nullable(),
  escalation_reason: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type ConversationUpdateInput = z.infer<typeof conversationUpdateSchema>;

// ======================
// LIST/FILTER CONVERSATIONS
// ======================

/**
 * Schema for conversation list query parameters
 */
export const conversationListQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(branchFilterSchema)
  .merge(dateRangeSchema)
  .extend({
    status: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(conversationStatusSchema).optional()),
    channel: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(channelTypeSchema).optional()),
    ai_handling: booleanQuerySchema,
    lead_id: uuidSchema.optional(),
    assigned_staff_id: uuidSchema.optional(),
    unread: booleanQuerySchema,
  });

export type ConversationListQueryInput = z.infer<typeof conversationListQuerySchema>;

// ======================
// SEND MESSAGE
// ======================

/**
 * Schema for sending a message
 */
export const messageSendSchema = z.object({
  // Required
  content: longTextSchema,

  // Optional
  conversation_id: uuidSchema.optional(), // If not provided, creates new conversation
  lead_id: uuidSchema.optional(), // Required if no conversation_id
  channel: channelTypeSchema.optional(), // Required if creating new conversation
  direction: messageDirectionSchema.optional().default('outbound'),

  // Media attachment
  media_url: z.string().url().max(2000).optional().nullable(),
  media_type: z.string().max(50).optional().nullable(),

  // AI context
  ai_generated: z.boolean().optional().default(false),
  ai_agent: z.string().max(100).optional().nullable(),

  // Metadata
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type MessageSendInput = z.infer<typeof messageSendSchema>;

// ======================
// MESSAGE LIST
// ======================

/**
 * Schema for message list query parameters
 */
export const messageListQuerySchema = paginationSchema.extend({
  conversation_id: uuidSchema,
  direction: messageDirectionSchema.optional(),
  before: z.string().datetime().optional(), // Cursor pagination
  after: z.string().datetime().optional(),
});

export type MessageListQueryInput = z.infer<typeof messageListQuerySchema>;

// ======================
// ESCALATE
// ======================

/**
 * Schema for escalating a conversation
 */
export const conversationEscalateSchema = z.object({
  reason: z
    .string()
    .min(3, 'Ingrese una razon para la escalacion')
    .max(500, 'Razon muy larga'),
  assign_to_staff_id: uuidSchema.optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  notes: notesSchema,
});

export type ConversationEscalateInput = z.infer<typeof conversationEscalateSchema>;

// ======================
// RESOLVE
// ======================

/**
 * Schema for resolving a conversation
 */
export const conversationResolveSchema = z.object({
  resolution_notes: notesSchema,
  resolution_type: z
    .enum(['answered', 'appointment_booked', 'sale', 'not_interested', 'other'])
    .optional(),
});

export type ConversationResolveInput = z.infer<typeof conversationResolveSchema>;

// ======================
// TRANSFER
// ======================

/**
 * Schema for transferring a conversation
 */
export const conversationTransferSchema = z.object({
  to_staff_id: uuidSchema,
  reason: z.string().max(500).optional(),
  notify_customer: z.boolean().optional().default(false),
});

export type ConversationTransferInput = z.infer<typeof conversationTransferSchema>;

// ======================
// PATH PARAMS
// ======================

/**
 * Schema for conversation ID path parameter
 */
export const conversationIdParamSchema = z.object({
  id: uuidSchema,
});

export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;
