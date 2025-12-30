// =====================================================
// TIS TIS PLATFORM - Auth Validation Schemas
// =====================================================

import { z } from 'zod';

// ======================
// PASSWORD VALIDATION
// ======================
const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede exceder 72 caracteres') // bcrypt limit
  .regex(/[a-z]/, 'Debe incluir al menos una letra minúscula')
  .regex(/[A-Z]/, 'Debe incluir al menos una letra mayúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número')
  .regex(/[^a-zA-Z0-9]/, 'Debe incluir al menos un carácter especial');

// ======================
// EMAIL VALIDATION
// ======================
const emailSchema = z
  .string()
  .email('Email inválido')
  .min(1, 'Email requerido')
  .max(254, 'Email demasiado largo') // RFC 5321
  .toLowerCase()
  .trim();

// ======================
// LOGIN SCHEMA
// ======================
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Contraseña requerida'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ======================
// SIGNUP SCHEMA
// ======================
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/, 'El nombre contiene caracteres inválidos'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Número de teléfono inválido')
    .optional()
    .or(z.literal('')),
  terms: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar los términos y condiciones',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type SignUpFormData = z.infer<typeof signUpSchema>;

// ======================
// RESET PASSWORD SCHEMA
// ======================
export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// ======================
// UPDATE PASSWORD SCHEMA
// ======================
export const updatePasswordSchema = z.object({
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check password strength
 */
export function checkPasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string;
  color: string;
} {
  let score = 0;

  // Length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Common patterns (reduce score)
  if (/^[a-zA-Z]+$/.test(password) || /^[0-9]+$/.test(password)) score = Math.max(0, score - 1);

  const feedback = [
    'Muy débil',
    'Débil',
    'Regular',
    'Fuerte',
    'Muy fuerte',
  ][Math.min(score, 4)];

  const colors = [
    'text-red-600',
    'text-orange-600',
    'text-yellow-600',
    'text-green-600',
    'text-emerald-600',
  ][Math.min(score, 4)];

  return { score, feedback, color: colors };
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  // E.164 format: +[country code][number]
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Check if email is from a disposable email provider
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'tempmail.com',
    'guerrillamail.com',
    '10minutemail.com',
    'throwaway.email',
    'mailinator.com',
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? disposableDomains.includes(domain) : false;
}
