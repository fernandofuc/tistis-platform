// =====================================================
// TIS TIS PLATFORM - Appointments Zod Schemas
// Validation schemas for Appointment API endpoints
// =====================================================

import { z } from 'zod';
import {
  uuidSchema,
  notesSchema,
  appointmentStatusSchema,
  paginationSchema,
  searchSchema,
  branchFilterSchema,
  dateSchema,
  datetimeSchema,
  positiveIntSchema,
} from './common.schema';

// ======================
// CREATE APPOINTMENT
// ======================

/**
 * Schema for creating a new appointment
 */
export const appointmentCreateSchema = z.object({
  // Required fields
  lead_id: uuidSchema,
  branch_id: uuidSchema,
  scheduled_at: datetimeSchema,
  duration_minutes: positiveIntSchema.max(480, 'Duracion maxima 8 horas'),

  // Optional fields
  staff_id: uuidSchema.optional().nullable(),
  service_id: uuidSchema.optional().nullable(),
  status: appointmentStatusSchema.optional().default('scheduled'),
  notes: notesSchema,

  // For patient-related verticals
  patient_id: uuidSchema.optional().nullable(),

  // Reminder settings
  send_reminder: z.boolean().optional().default(true),
  reminder_hours_before: positiveIntSchema.max(72).optional().default(24),

  // Additional metadata
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

// ======================
// UPDATE APPOINTMENT
// ======================

/**
 * Schema for updating an appointment
 */
export const appointmentUpdateSchema = z.object({
  branch_id: uuidSchema.optional(),
  scheduled_at: datetimeSchema.optional(),
  duration_minutes: positiveIntSchema.max(480).optional(),
  staff_id: uuidSchema.optional().nullable(),
  service_id: uuidSchema.optional().nullable(),
  status: appointmentStatusSchema.optional(),
  notes: notesSchema,
  patient_id: uuidSchema.optional().nullable(),
  send_reminder: z.boolean().optional(),
  reminder_hours_before: positiveIntSchema.max(72).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),

  // Cancellation reason (when status = cancelled)
  cancellation_reason: z
    .string()
    .max(500, 'Razon de cancelacion muy larga')
    .optional()
    .nullable(),
});

export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;

// ======================
// LIST/FILTER APPOINTMENTS
// ======================

/**
 * Schema for appointment list query parameters
 */
export const appointmentListQuerySchema = paginationSchema
  .merge(searchSchema)
  .merge(branchFilterSchema)
  .extend({
    status: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',') : undefined))
      .pipe(z.array(appointmentStatusSchema).optional()),
    staff_id: uuidSchema.optional(),
    service_id: uuidSchema.optional(),
    lead_id: uuidSchema.optional(),
    patient_id: uuidSchema.optional(),

    // Date filtering
    date: dateSchema.optional(),
    date_from: dateSchema.optional(),
    date_to: dateSchema.optional(),

    // Range views
    view: z.enum(['day', 'week', 'month']).optional(),
  })
  .refine(
    (data) => {
      if (data.date_from && data.date_to) {
        return new Date(data.date_from) <= new Date(data.date_to);
      }
      return true;
    },
    { message: 'date_from debe ser anterior o igual a date_to' }
  );

export type AppointmentListQueryInput = z.infer<typeof appointmentListQuerySchema>;

// ======================
// RESCHEDULE
// ======================

/**
 * Schema for rescheduling an appointment
 */
export const appointmentRescheduleSchema = z.object({
  scheduled_at: datetimeSchema,
  duration_minutes: positiveIntSchema.max(480).optional(),
  staff_id: uuidSchema.optional().nullable(),
  notify_customer: z.boolean().optional().default(true),
  reschedule_reason: z
    .string()
    .max(500, 'Razon de reprogramacion muy larga')
    .optional(),
});

export type AppointmentRescheduleInput = z.infer<typeof appointmentRescheduleSchema>;

// ======================
// CONFIRM/CANCEL
// ======================

/**
 * Schema for confirming an appointment
 */
export const appointmentConfirmSchema = z.object({
  confirmed_by: z.enum(['customer', 'staff', 'system']).optional().default('staff'),
  notes: notesSchema,
});

export type AppointmentConfirmInput = z.infer<typeof appointmentConfirmSchema>;

/**
 * Schema for cancelling an appointment
 */
export const appointmentCancelSchema = z.object({
  cancellation_reason: z
    .string()
    .min(3, 'Ingrese una razon para la cancelacion')
    .max(500, 'Razon muy larga'),
  cancelled_by: z.enum(['customer', 'staff', 'system']).optional().default('staff'),
  notify_customer: z.boolean().optional().default(true),
});

export type AppointmentCancelInput = z.infer<typeof appointmentCancelSchema>;

// ======================
// AVAILABILITY CHECK
// ======================

/**
 * Schema for checking availability
 */
export const availabilityCheckSchema = z.object({
  branch_id: uuidSchema,
  date: dateSchema,
  staff_id: uuidSchema.optional(),
  service_id: uuidSchema.optional(),
  duration_minutes: positiveIntSchema.max(480).optional().default(60),
});

export type AvailabilityCheckInput = z.infer<typeof availabilityCheckSchema>;

// ======================
// PATH PARAMS
// ======================

/**
 * Schema for appointment ID path parameter
 */
export const appointmentIdParamSchema = z.object({
  id: uuidSchema,
});

export type AppointmentIdParam = z.infer<typeof appointmentIdParamSchema>;
