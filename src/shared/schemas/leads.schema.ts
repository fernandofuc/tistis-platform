// =====================================================
// TIS TIS PLATFORM - Leads Zod Schemas
// Validation schemas for Lead API endpoints
// =====================================================

import { z } from 'zod';
import {
  uuidSchema,
  nameSchema,
  optionalEmailSchema,
  phoneSchema,
  optionalPhoneSchema,
  notesSchema,
  leadStatusSchema,
  leadClassificationSchema,
  paginationSchema,
  searchSchema,
  branchFilterSchema,
  dateRangeSchema,
  stringArraySchema,
} from './common.schema';

// ======================
// CREATE LEAD
// ======================

/**
 * Schema for creating a new lead
 */
export const leadCreateSchema = z.object({
  // Name fields (flexible - can use name or first_name/last_name)
  name: z.string().max(200).optional(), // Full name (will be parsed)
  full_name: z.string().max(200).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),

  // Required field
  phone: phoneSchema,

  // Optional fields
  email: optionalEmailSchema,
  source: z
    .string()
    .max(50, 'Source muy largo')
    .optional()
    .default('website'),
  classification: leadClassificationSchema.optional().default('warm'),
  status: leadStatusSchema.optional().default('new'),
  branch_id: uuidSchema.optional().nullable(),
  assigned_staff_id: uuidSchema.optional().nullable(),
  interested_services: stringArraySchema(20, 100).optional(),
  notes: notesSchema,
  tags: stringArraySchema(50, 100).optional(),

  // Custom fields
  custom_fields: z.record(z.unknown()).optional().nullable(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

// ======================
// UPDATE LEAD
// ======================

/**
 * Schema for updating a lead (all fields optional)
 */
export const leadUpdateSchema = z.object({
  name: nameSchema.optional(),
  phone: optionalPhoneSchema,
  email: optionalEmailSchema,
  source: z.string().max(50).optional().nullable(),
  classification: leadClassificationSchema.optional(),
  status: leadStatusSchema.optional(),
  branch_id: uuidSchema.optional().nullable(),
  assigned_staff_id: uuidSchema.optional().nullable(),
  interested_services: stringArraySchema(20, 100).optional().nullable(),
  notes: notesSchema,
  custom_fields: z.record(z.unknown()).optional().nullable(),

  // Additional update fields
  last_contact_at: z.string().datetime().optional().nullable(),
  next_followup_at: z.string().datetime().optional().nullable(),
});

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

// ======================
// LIST/FILTER LEADS
// ======================

/**
 * Schema for lead list query parameters
 */
export const leadListQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(branchFilterSchema)
  .merge(dateRangeSchema)
  .extend({
    status: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(leadStatusSchema).optional()),
    classification: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(leadClassificationSchema).optional()),
    source: z
      .string()
      .max(200)
      .optional()
      .transform((v) => (v ? v.split(',') : undefined)),
    assigned_staff_id: uuidSchema.optional(),
    has_appointment: z
      .string()
      .optional()
      .transform((v) => v === 'true' || v === '1'),
  });

export type LeadListQueryInput = z.infer<typeof leadListQuerySchema>;

// ======================
// BULK OPERATIONS
// ======================

/**
 * Schema for bulk lead update
 */
export const leadBulkUpdateSchema = z.object({
  lead_ids: z
    .array(uuidSchema)
    .min(1, 'Debe seleccionar al menos un lead')
    .max(100, 'Maximo 100 leads por operacion'),
  updates: leadUpdateSchema.partial(),
});

export type LeadBulkUpdateInput = z.infer<typeof leadBulkUpdateSchema>;

/**
 * Schema for bulk lead assignment
 */
export const leadBulkAssignSchema = z.object({
  lead_ids: z
    .array(uuidSchema)
    .min(1, 'Debe seleccionar al menos un lead')
    .max(100, 'Maximo 100 leads por operacion'),
  assigned_staff_id: uuidSchema.nullable(),
});

export type LeadBulkAssignInput = z.infer<typeof leadBulkAssignSchema>;

// ======================
// PATH PARAMS
// ======================

/**
 * Schema for lead ID path parameter
 */
export const leadIdParamSchema = z.object({
  id: uuidSchema,
});

export type LeadIdParam = z.infer<typeof leadIdParamSchema>;
