// =====================================================
// TIS TIS PLATFORM - Trial Schemas (Zod Validation)
// Schemas de validación para el sistema de trials
// =====================================================

import { z } from 'zod';

// ======================
// BASE SCHEMAS
// ======================

/**
 * Schema para UUID válido
 */
export const UUIDSchema = z.string().uuid('Debe ser un UUID válido');

/**
 * Schema para timestamp ISO 8601
 * Accepts both formats:
 * - With Z suffix: 2025-12-31T07:26:12.273Z
 * - With timezone offset: 2025-12-31T07:26:12.273116+00:00
 */
export const TimestampSchema = z.string().refine(
  (val) => {
    // Accept ISO 8601 with Z or with timezone offset (+00:00, -05:00, etc.)
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
    return iso8601Regex.test(val);
  },
  { message: 'Debe ser un timestamp ISO 8601 válido' }
);

/**
 * Schema para plan
 * Values must match database CHECK constraint in 003_esva_schema_v2.sql
 */
export const PlanSchema = z.enum(['starter', 'essentials', 'growth', 'scale'], {
  errorMap: () => ({ message: 'Plan inválido' }),
});

/**
 * Schema para trial_status
 *
 * Máquina de estados:
 * - NULL: Subscription sin trial
 * - 'active': Trial en curso (usuario puede usar el servicio)
 * - 'converted': Trial expiró y se convirtió a suscripción paga (cobro exitoso)
 * - 'ended': Trial expiró sin conversión (usuario canceló o no tenía payment method)
 * - 'cancelled': (DEPRECADO - usar 'ended' en su lugar)
 *
 * Transiciones válidas:
 * NULL → 'active' (activateFreeTrial)
 * 'active' → 'converted' (convertTrialToPaid)
 * 'active' → 'ended' (endTrialWithoutConversion)
 */
export const TrialStatusSchema = z.enum(['active', 'ended', 'converted', 'cancelled'], {
  errorMap: () => ({ message: 'Estado de trial inválido' }),
});

/**
 * Schema para subscription status
 */
export const SubscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'cancelled',
  'past_due',
  'unpaid',
], {
  errorMap: () => ({ message: 'Estado de suscripción inválido' }),
});

// ======================
// ENTITY SCHEMAS
// ======================

/**
 * Schema para TrialSubscription (response de DB)
 */
export const TrialSubscriptionSchema = z.object({
  id: UUIDSchema,
  client_id: UUIDSchema,
  plan: PlanSchema,
  monthly_amount: z.number().positive('monthly_amount debe ser positivo'),
  currency: z.string().length(3, 'currency debe ser código ISO 4217 (3 letras)'),
  status: SubscriptionStatusSchema,
  trial_start: TimestampSchema.nullable().optional(),
  trial_end: TimestampSchema.nullable().optional(),
  trial_status: TrialStatusSchema.nullable().optional(),
  will_convert_to_paid: z.boolean().nullable().optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  stripe_subscription_id: z.string().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  current_period_start: TimestampSchema.nullable().optional(),
  current_period_end: TimestampSchema.nullable().optional(),
  cancel_at: TimestampSchema.nullable().optional(),
  cancelled_at: TimestampSchema.nullable().optional(),
}).refine(
  (data) => {
    // Validar que trial_end > trial_start SOLO si ambos existen
    if (data.trial_start && data.trial_end) {
      const start = new Date(data.trial_start);
      const end = new Date(data.trial_end);
      return end > start;
    }
    return true; // Si no hay trial dates, skip validation
  },
  {
    message: 'trial_end debe ser posterior a trial_start',
  }
);

/**
 * Schema para TrialExpiringToday (response de get_trials_expiring_today)
 * NOTE: stripe_customer_id added in migration 082 for optimized billing
 */
export const TrialExpiringTodaySchema = z.object({
  subscription_id: UUIDSchema,
  client_id: UUIDSchema,
  trial_end: TimestampSchema,
  will_convert_to_paid: z.boolean(),
  client_email: z.string().email('Email de cliente inválido'),
  client_name: z.string().min(1, 'Nombre de cliente no puede estar vacío'),
  stripe_customer_id: z.string().nullable().optional(), // Added in migration 082
});

// ======================
// REQUEST SCHEMAS (API Input Validation)
// ======================

/**
 * Schema para activar trial (interno - requiere client_id)
 */
export const ActivateTrialRequestSchema = z.object({
  client_id: UUIDSchema,
  plan: z.literal('starter', {
    errorMap: () => ({ message: 'Solo el plan Starter puede tener prueba gratuita' }),
  }).default('starter'),
});

/**
 * Schema para activar trial desde checkout (público - sin client_id)
 * El cliente se crea en el endpoint si no existe
 */
export const ActivateTrialCheckoutRequestSchema = z.object({
  plan: z.literal('starter', {
    errorMap: () => ({ message: 'Solo el plan Starter puede tener prueba gratuita' }),
  }),
  customerEmail: z.string().email('Email inválido'),
  customerName: z.string().min(1, 'Nombre es requerido').max(100, 'Nombre demasiado largo'),
  customerPhone: z.string().optional(),
  // Currently active verticals: dental, restaurant (more will be added later)
  vertical: z.enum(['dental', 'restaurant'], {
    errorMap: () => ({ message: 'Vertical inválida' }),
  }).optional(),
});

/**
 * Schema para cancelar trial
 */
export const CancelTrialRequestSchema = z.object({
  subscription_id: UUIDSchema,
});

/**
 * Schema para convertir trial a pago
 */
export const ConvertTrialToPaidRequestSchema = z.object({
  subscription_id: UUIDSchema,
  stripe_subscription_id: z.string().optional(),
  stripe_customer_id: z.string().optional(),
});

// ======================
// RESPONSE SCHEMAS
// ======================

/**
 * Schema para TrialActivationResult
 * Nota: daysRemaining es opcional porque convertTrialToPaid no lo retorna
 */
export const TrialActivationResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    subscription: TrialSubscriptionSchema,
    daysRemaining: z.number().int().min(0).max(10).optional(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

/**
 * Schema para TrialCancellationResult
 */
export const TrialCancellationResultSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    subscription: TrialSubscriptionSchema,
    message: z.string().optional(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

// ======================
// TYPE EXPORTS
// ======================

export type TrialSubscription = z.infer<typeof TrialSubscriptionSchema>;
export type TrialExpiringToday = z.infer<typeof TrialExpiringTodaySchema>;
export type ActivateTrialRequest = z.infer<typeof ActivateTrialRequestSchema>;
export type ActivateTrialCheckoutRequest = z.infer<typeof ActivateTrialCheckoutRequestSchema>;
export type CancelTrialRequest = z.infer<typeof CancelTrialRequestSchema>;
export type ConvertTrialToPaidRequest = z.infer<typeof ConvertTrialToPaidRequestSchema>;
export type TrialActivationResult = z.infer<typeof TrialActivationResultSchema>;
export type TrialCancellationResult = z.infer<typeof TrialCancellationResultSchema>;

// ======================
// VALIDATION HELPERS
// ======================

/**
 * Valida y parsea una suscripción de trial de forma segura
 * @throws ZodError si la validación falla
 */
export function validateTrialSubscription(data: unknown): TrialSubscription {
  return TrialSubscriptionSchema.parse(data);
}

/**
 * Valida y parsea una suscripción de trial de forma segura (sin throw)
 * @returns { success: true, data } o { success: false, error }
 */
export function safeValidateTrialSubscription(data: unknown) {
  return TrialSubscriptionSchema.safeParse(data);
}

/**
 * Valida y parsea un array de trials expirando hoy
 * @throws ZodError si la validación falla
 */
export function validateTrialsExpiringToday(data: unknown): TrialExpiringToday[] {
  return z.array(TrialExpiringTodaySchema).parse(data);
}

/**
 * Valida request de activación de trial
 * @throws ZodError si la validación falla
 */
export function validateActivateTrialRequest(data: unknown): ActivateTrialRequest {
  return ActivateTrialRequestSchema.parse(data);
}

/**
 * Valida request de cancelación de trial
 * @throws ZodError si la validación falla
 */
export function validateCancelTrialRequest(data: unknown): CancelTrialRequest {
  return CancelTrialRequestSchema.parse(data);
}

/**
 * Valida request de activación de trial desde checkout (público)
 * @throws ZodError si la validación falla
 */
export function validateActivateTrialCheckoutRequest(data: unknown): ActivateTrialCheckoutRequest {
  return ActivateTrialCheckoutRequestSchema.parse(data);
}
