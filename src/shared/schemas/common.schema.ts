// =====================================================
// TIS TIS PLATFORM - Common Zod Schemas
// Reusable schemas for validation across API routes
// =====================================================

import { z } from 'zod';

// ======================
// UUID VALIDATION
// ======================

/**
 * UUID v4 schema with length pre-check to prevent ReDoS
 */
export const uuidSchema = z
  .string()
  .length(36, 'UUID debe tener exactamente 36 caracteres')
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'UUID invalido'
  );

/**
 * Optional UUID schema
 */
export const optionalUuidSchema = uuidSchema.optional();

/**
 * UUID path parameter schema
 */
export const uuidPathParamSchema = z.object({
  id: uuidSchema,
});

// ======================
// PAGINATION
// ======================

/**
 * Standard pagination query params
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().min(1).max(1000).default(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().min(1).max(100).default(20)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Pagination with limit/offset style
 */
export const limitOffsetSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().min(1).max(200).default(20)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 0))
    .pipe(z.number().min(0).default(0)),
});

export type LimitOffsetParams = z.infer<typeof limitOffsetSchema>;

// ======================
// DATE/TIME
// ======================

/**
 * ISO date string schema (YYYY-MM-DD)
 */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido. Use YYYY-MM-DD')
  .refine(
    (date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    },
    { message: 'Fecha invalida' }
  );

/**
 * ISO datetime string schema
 */
export const datetimeSchema = z
  .string()
  .datetime({ message: 'Formato de fecha/hora invalido. Use ISO 8601' });

/**
 * Optional date schema
 */
export const optionalDateSchema = dateSchema.optional().nullable();

/**
 * Date range schema for filtering (without refine for merge compatibility)
 */
export const dateRangeSchema = z.object({
  date_from: dateSchema.optional(),
  date_to: dateSchema.optional(),
});

export type DateRangeParams = z.infer<typeof dateRangeSchema>;

/**
 * Date range schema with validation (use when not merging)
 */
export const dateRangeWithValidationSchema = dateRangeSchema.refine(
  (data) => {
    if (data.date_from && data.date_to) {
      return new Date(data.date_from) <= new Date(data.date_to);
    }
    return true;
  },
  { message: 'date_from debe ser anterior o igual a date_to' }
);

// ======================
// TEXT FIELDS
// ======================

/**
 * Non-empty string with configurable limits
 */
export const textSchema = (
  minLength = 1,
  maxLength = 255,
  fieldName = 'Campo'
) =>
  z
    .string()
    .min(minLength, `${fieldName} debe tener al menos ${minLength} caracteres`)
    .max(maxLength, `${fieldName} no puede exceder ${maxLength} caracteres`)
    .transform((v) => v.trim());

/**
 * Short name field (2-100 chars)
 */
export const nameSchema = textSchema(2, 100, 'Nombre');

/**
 * Short text field (1-255 chars)
 */
export const shortTextSchema = textSchema(1, 255, 'Texto');

/**
 * Medium text field (1-500 chars)
 */
export const mediumTextSchema = textSchema(1, 500, 'Texto');

/**
 * Long text field (1-2000 chars)
 */
export const longTextSchema = textSchema(1, 2000, 'Texto');

/**
 * Notes/description field (optional, max 2000)
 */
export const notesSchema = z
  .string()
  .max(2000, 'Las notas no pueden exceder 2000 caracteres')
  .optional()
  .nullable()
  .transform((v) => v?.trim() || null);

// ======================
// CONTACT INFO
// ======================

/**
 * Email schema with normalization
 */
export const emailSchema = z
  .string()
  .email('Email invalido')
  .max(254, 'Email demasiado largo')
  .transform((v) => v.toLowerCase().trim());

/**
 * Optional email
 */
export const optionalEmailSchema = z
  .string()
  .email('Email invalido')
  .max(254)
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase().trim() : null));

/**
 * Phone number schema (E.164 format)
 */
export const phoneSchema = z
  .string()
  .min(8, 'Telefono debe tener al menos 8 digitos')
  .max(20, 'Telefono demasiado largo')
  .regex(/^\+?[0-9\s\-()]+$/, 'Formato de telefono invalido')
  .transform((v) => v.replace(/[\s\-()]/g, '')); // Normalize

/**
 * Optional phone
 */
export const optionalPhoneSchema = z
  .string()
  .min(8)
  .max(20)
  .regex(/^\+?[0-9\s\-()]+$/, 'Formato de telefono invalido')
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(/[\s\-()]/g, '') : null));

// ======================
// NUMERIC FIELDS
// ======================

/**
 * Positive integer schema
 */
export const positiveIntSchema = z
  .number()
  .int('Debe ser un numero entero')
  .positive('Debe ser un numero positivo');

/**
 * Non-negative integer schema (0 or positive)
 */
export const nonNegativeIntSchema = z
  .number()
  .int('Debe ser un numero entero')
  .nonnegative('No puede ser negativo');

/**
 * Price schema (2 decimal places, max 999999.99)
 */
export const priceSchema = z
  .number()
  .nonnegative('El precio no puede ser negativo')
  .max(999999.99, 'Precio excede el maximo permitido')
  .transform((v) => Math.round(v * 100) / 100);

/**
 * Percentage schema (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Porcentaje debe ser mayor o igual a 0')
  .max(100, 'Porcentaje no puede exceder 100');

/**
 * Quantity schema (positive integer with max)
 */
export const quantitySchema = (max = 9999) =>
  z
    .number()
    .int('Cantidad debe ser un numero entero')
    .positive('Cantidad debe ser mayor a 0')
    .max(max, `Cantidad no puede exceder ${max}`);

// ======================
// ENUMS & OPTIONS
// ======================

/**
 * Status enum factory
 */
export const statusEnumSchema = <T extends [string, ...string[]]>(values: T) =>
  z.enum(values);

/**
 * Common lead statuses
 */
export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'appointment_scheduled',
  'won',
  'lost',
  'inactive',
]);

export type LeadStatus = z.infer<typeof leadStatusSchema>;

/**
 * Common lead classifications
 */
export const leadClassificationSchema = z.enum(['hot', 'warm', 'cold']);

export type LeadClassification = z.infer<typeof leadClassificationSchema>;

/**
 * Appointment statuses
 */
export const appointmentStatusSchema = z.enum([
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/**
 * Message direction
 */
export const messageDirectionSchema = z.enum(['inbound', 'outbound']);

export type MessageDirection = z.infer<typeof messageDirectionSchema>;

/**
 * Channel types
 */
export const channelTypeSchema = z.enum([
  'whatsapp',
  'instagram',
  'facebook',
  'sms',
  'email',
  'voice',
  'web',
]);

export type ChannelType = z.infer<typeof channelTypeSchema>;

// ======================
// ARRAYS
// ======================

/**
 * Array of UUIDs with limit
 */
export const uuidArraySchema = (maxItems = 50) =>
  z.array(uuidSchema).max(maxItems, `Maximo ${maxItems} elementos permitidos`);

/**
 * Array of strings with limit
 */
export const stringArraySchema = (maxItems = 100, maxLength = 255) =>
  z
    .array(z.string().max(maxLength))
    .max(maxItems, `Maximo ${maxItems} elementos permitidos`);

// ======================
// BRANCH FILTERING
// ======================

/**
 * Optional branch_id parameter for multi-branch filtering
 */
export const branchFilterSchema = z.object({
  branch_id: uuidSchema.optional(),
});

export type BranchFilterParams = z.infer<typeof branchFilterSchema>;

// ======================
// SEARCH & FILTERS
// ======================

/**
 * Search query parameter
 */
export const searchSchema = z.object({
  search: z
    .string()
    .max(200, 'Busqueda muy larga')
    .optional()
    .transform((v) => v?.trim() || undefined),
});

export type SearchParams = z.infer<typeof searchSchema>;

/**
 * Common list query combining pagination, search, and branch filter
 */
export const listQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(branchFilterSchema)
  .merge(dateRangeSchema);

export type ListQueryParams = z.infer<typeof listQuerySchema>;

// ======================
// JSON/JSONB FIELDS
// ======================

/**
 * Generic JSONB field (validated as object)
 */
export const jsonbSchema = z.record(z.unknown()).optional().nullable();

/**
 * Metadata field
 */
export const metadataSchema = z
  .record(z.unknown())
  .optional()
  .nullable()
  .default(null);

// ======================
// URL VALIDATION
// ======================

/**
 * URL schema with protocol validation
 */
export const urlSchema = z
  .string()
  .url('URL invalida')
  .max(2000, 'URL muy larga')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'URL debe usar protocolo http o https' }
  );

/**
 * Optional URL
 */
export const optionalUrlSchema = urlSchema.optional().nullable();

// ======================
// COERCIONS (for query params)
// ======================

/**
 * Boolean from query string ('true', '1', etc.)
 */
export const booleanQuerySchema = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

/**
 * Number from query string
 */
export const numberQuerySchema = z
  .string()
  .optional()
  .transform((v) => (v ? parseFloat(v) : undefined))
  .pipe(z.number().optional());

/**
 * Integer from query string
 */
export const integerQuerySchema = z
  .string()
  .optional()
  .transform((v) => (v ? parseInt(v, 10) : undefined))
  .pipe(z.number().int().optional());
