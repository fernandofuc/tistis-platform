// =====================================================
// TIS TIS PLATFORM - Shared Constants
// =====================================================

// ======================
// ESVA TENANT CONSTANTS
// ======================
export const ESVA = {
  TENANT_ID: 'a0000000-0000-0000-0000-000000000001',
  BRANCHES: {
    NOGALES: 'b0000000-0000-0000-0000-000000000001',
    TIJUANA: 'b0000000-0000-0000-0000-000000000002',
    HERMOSILLO: 'b0000000-0000-0000-0000-000000000003',
    LAB: 'b0000000-0000-0000-0000-000000000004',
  },
  STAFF: {
    DR_ALBERTO: 'c0000000-0000-0000-0000-000000000001',
    MARIA: 'c0000000-0000-0000-0000-000000000002',
    DR_CARLOS: 'c0000000-0000-0000-0000-000000000003',
  },
} as const;

// ======================
// LEAD SCORING THRESHOLDS
// ======================
export const LEAD_SCORING = {
  HOT: { min: 80, max: 100 },
  WARM: { min: 40, max: 79 },
  COLD: { min: 0, max: 39 },
} as const;

export const LEAD_SCORING_WEIGHTS = {
  positive: {
    urgency_pain: 35,
    wants_appointment: 30,
    date_defined: 25,
    usa_patient: 25,
    high_value_treatment: 20,
    budget_confirmed: 15,
    referral: 15,
    complete_info: 10,
    high_engagement: 10,
    returning_patient: 20,
  },
  negative: {
    just_browsing: -15,
    price_shopping: -10,
    comparing_options: -10,
    no_response_24h: -20,
    no_response_48h: -30,
    cancelled_appointment: -25,
  },
} as const;

// ======================
// LEAD STATUS & CLASSIFICATION
// NOTE: For dynamic terminology based on vertical, use getLeadStatuses() from
// '@/src/shared/utils/terminologyHelpers' in React components with useVerticalTerminology()
// ======================
export const LEAD_STATUSES = [
  { value: 'new', label: 'Nuevo', color: 'blue' },
  { value: 'contacted', label: 'Contactado', color: 'cyan' },
  { value: 'qualified', label: 'Calificado', color: 'green' },
  { value: 'appointment_scheduled', label: 'Cita Agendada', color: 'purple' },
  { value: 'converted', label: 'Convertido', color: 'emerald' },
  { value: 'lost', label: 'Perdido', color: 'red' },
  { value: 'inactive', label: 'Inactivo', color: 'gray' },
] as const;

export const LEAD_CLASSIFICATIONS = [
  { value: 'hot', label: 'Caliente', color: 'red', emoji: '🔥' },
  { value: 'warm', label: 'Tibio', color: 'orange', emoji: '🌡️' },
  { value: 'cold', label: 'Frío', color: 'blue', emoji: '❄️' },
] as const;

export const LEAD_SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { value: 'instagram', label: 'Instagram', icon: 'Instagram' },
  { value: 'facebook', label: 'Facebook', icon: 'Facebook' },
  { value: 'website', label: 'Sitio Web', icon: 'Globe' },
  { value: 'referral', label: 'Referido', icon: 'Users' },
  { value: 'walk_in', label: 'Walk-in', icon: 'Store' },
  { value: 'phone', label: 'Teléfono', icon: 'Phone' },
  { value: 'other', label: 'Otro', icon: 'MoreHorizontal' },
] as const;

// ======================
// APPOINTMENT STATUSES
// ======================
export const APPOINTMENT_STATUSES = [
  { value: 'scheduled', label: 'Programada', color: 'blue' },
  { value: 'confirmed', label: 'Confirmada', color: 'green' },
  { value: 'in_progress', label: 'En Progreso', color: 'yellow' },
  { value: 'completed', label: 'Completada', color: 'emerald' },
  { value: 'cancelled', label: 'Cancelada', color: 'red' },
  { value: 'no_show', label: 'No Asistió', color: 'orange' },
  { value: 'rescheduled', label: 'Reagendada', color: 'purple' },
] as const;

// ======================
// CONVERSATION STATUSES
// ======================
export const CONVERSATION_STATUSES = [
  { value: 'active', label: 'Activa', color: 'green' },
  { value: 'waiting_response', label: 'Esperando Respuesta', color: 'yellow' },
  { value: 'escalated', label: 'Escalada', color: 'red' },
  { value: 'resolved', label: 'Resuelta', color: 'gray' },
  { value: 'archived', label: 'Archivada', color: 'slate' },
] as const;

// ======================
// STAFF ROLES
// ======================
export const STAFF_ROLES = [
  { value: 'owner', label: 'Propietario', level: 5 },
  { value: 'admin', label: 'Administrador', level: 4 },
  { value: 'specialist', label: 'Especialista', level: 3 },
  { value: 'receptionist', label: 'Recepcionista', level: 2 },
  { value: 'assistant', label: 'Asistente', level: 1 },
] as const;

// ======================
// SERVICE CATEGORIES (ESVA)
// ======================
export const SERVICE_CATEGORIES = [
  { value: 'Estética Dental', label: 'Estética Dental', icon: 'Sparkles' },
  { value: 'Consulta', label: 'Consulta', icon: 'ClipboardList' },
  { value: 'Implantología', label: 'Implantología', icon: 'Bone' },
  { value: 'Preventivo', label: 'Preventivo', icon: 'Shield' },
  { value: 'Ortodoncia', label: 'Ortodoncia', icon: 'Grid' },
] as const;

// ======================
// TIME CONSTANTS
// ======================
export const BUSINESS_HOURS = {
  weekdays: { start: '09:30', end: '18:00' },
  saturday: { start: '10:00', end: '14:00' },
  sunday: null,
} as const;

export const APPOINTMENT_DURATIONS = [
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1.5 horas' },
  { value: 120, label: '2 horas' },
] as const;

// ======================
// NOTIFICATION TYPES
// NOTE: For dynamic terminology based on vertical, use getNotificationTypes() from
// '@/src/shared/utils/terminologyHelpers' in React components with useVerticalTerminology()
// ======================
export const NOTIFICATION_TYPES = [
  { value: 'hot_lead', label: 'Lead Caliente', priority: 'high' },
  { value: 'new_appointment', label: 'Nueva Cita', priority: 'medium' },
  { value: 'cancellation', label: 'Cancelación', priority: 'high' },
  { value: 'escalation', label: 'Escalación', priority: 'urgent' },
  { value: 'reminder', label: 'Recordatorio', priority: 'low' },
  { value: 'daily_report', label: 'Reporte Diario', priority: 'low' },
  { value: 'weekly_report', label: 'Reporte Semanal', priority: 'low' },
] as const;

// ======================
// UI CONSTANTS
// ======================
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

export const COLORS = {
  primary: '#0066CC',
  secondary: '#00AAFF',
  hot: '#EF4444',
  warm: '#F97316',
  cold: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

// ======================
// SECURE BOOKING STATES
// Phase 7: UI/Dashboard - Booking States System
// ======================

/**
 * Booking Hold Status - Temporary reservation during voice call/chat
 * Maps to: booking_holds.status in 167_SECURE_BOOKING_SYSTEM.sql
 */
export const BOOKING_HOLD_STATUSES = [
  { value: 'active', label: 'Hold Activo', color: 'amber', icon: 'clock', description: 'Reservación temporal en progreso' },
  { value: 'converted', label: 'Convertido', color: 'green', icon: 'check', description: 'Convertido a cita/reservación' },
  { value: 'expired', label: 'Expirado', color: 'gray', icon: 'timer-off', description: 'Hold expiró sin conversión' },
  { value: 'released', label: 'Liberado', color: 'slate', icon: 'x', description: 'Liberado manualmente' },
] as const;

/**
 * Confirmation Status - Customer confirmation state for bookings
 * Maps to: appointments.confirmation_status, restaurant_orders.confirmation_status
 */
export const CONFIRMATION_STATUSES = [
  { value: 'not_required', label: 'No Requerida', color: 'slate', icon: 'minus', description: 'Cliente de confianza' },
  { value: 'pending', label: 'Pendiente', color: 'amber', icon: 'clock', description: 'Esperando confirmación' },
  { value: 'confirmed', label: 'Confirmada', color: 'green', icon: 'check', description: 'Cliente confirmó' },
  { value: 'expired', label: 'Expirada', color: 'red', icon: 'alert', description: 'Expiró sin respuesta' },
] as const;

/**
 * Deposit Status - Payment deposit state for high-risk bookings
 * Maps to: booking_deposits.status
 */
export const DEPOSIT_STATUSES = [
  { value: 'not_required', label: 'No Requerido', color: 'slate', icon: 'minus', description: 'Sin depósito necesario' },
  { value: 'required', label: 'Requerido', color: 'amber', icon: 'dollar', description: 'Depósito pendiente' },
  { value: 'pending', label: 'Procesando', color: 'blue', icon: 'loader', description: 'Pago en proceso' },
  { value: 'paid', label: 'Pagado', color: 'green', icon: 'check', description: 'Depósito recibido' },
  { value: 'forfeited', label: 'Perdido', color: 'red', icon: 'x', description: 'No-show, depósito retenido' },
  { value: 'refunded', label: 'Reembolsado', color: 'purple', icon: 'refresh', description: 'Depósito devuelto' },
  { value: 'applied', label: 'Aplicado', color: 'emerald', icon: 'check-double', description: 'Aplicado al servicio' },
] as const;

/**
 * Customer Trust Levels - Based on trust_score thresholds
 * Used for visual indicators in UI
 */
export const TRUST_LEVELS = [
  { value: 'trusted', label: 'Cliente Confiable', minScore: 80, color: 'green', icon: 'shield-check' },
  { value: 'standard', label: 'Cliente Estándar', minScore: 50, color: 'blue', icon: 'user' },
  { value: 'cautious', label: 'Requiere Confirmación', minScore: 30, color: 'amber', icon: 'alert-triangle' },
  { value: 'high_risk', label: 'Alto Riesgo', minScore: 0, color: 'red', icon: 'shield-alert' },
] as const;

/**
 * Combined Booking State - For UI display purposes
 * Combines appointment/order status with confirmation and deposit status
 */
export const BOOKING_COMBINED_STATES = [
  { value: 'hold_active', label: 'En Proceso', color: 'amber', priority: 1, description: 'Reservación temporal activa' },
  { value: 'pending_confirmation', label: 'Pendiente Confirmar', color: 'orange', priority: 2, description: 'Esperando confirmación del cliente' },
  { value: 'pending_deposit', label: 'Pendiente Depósito', color: 'yellow', priority: 3, description: 'Esperando pago de depósito' },
  { value: 'confirmed', label: 'Confirmado', color: 'green', priority: 4, description: 'Reservación confirmada' },
  { value: 'scheduled', label: 'Programado', color: 'blue', priority: 5, description: 'Cita programada' },
  { value: 'in_progress', label: 'En Progreso', color: 'indigo', priority: 6, description: 'Servicio en curso' },
  { value: 'completed', label: 'Completado', color: 'emerald', priority: 7, description: 'Servicio completado' },
  { value: 'no_show', label: 'No Asistió', color: 'red', priority: 8, description: 'Cliente no se presentó' },
  { value: 'cancelled', label: 'Cancelado', color: 'gray', priority: 9, description: 'Reservación cancelada' },
] as const;

/**
 * Restaurant-specific Table Reservation States
 */
export const TABLE_RESERVATION_STATES = [
  { value: 'hold', label: 'Hold Temporal', color: 'amber', description: 'Mesa reservada temporalmente' },
  { value: 'reserved', label: 'Reservada', color: 'blue', description: 'Mesa reservada y confirmada' },
  { value: 'pending_confirmation', label: 'Sin Confirmar', color: 'orange', description: 'Reservación sin confirmación' },
  { value: 'seated', label: 'Ocupada', color: 'green', description: 'Clientes sentados' },
  { value: 'available', label: 'Disponible', color: 'slate', description: 'Mesa libre' },
] as const;
