// =====================================================
// TIS TIS PLATFORM - Terminology Helper Functions
// Dynamic constant generators based on vertical terminology
// =====================================================

import type { ExtendedTerminology } from '@/src/hooks/useVerticalTerminology';

// ======================
// LEAD STATUS HELPERS
// ======================

export interface LeadStatus {
  value: string;
  label: string;
  color: string;
}

/**
 * Get dynamic lead statuses based on vertical terminology
 * Used in lead management UI components
 */
export function getLeadStatuses(terminology: ExtendedTerminology): LeadStatus[] {
  return [
    { value: 'new', label: 'Nuevo', color: 'blue' },
    { value: 'contacted', label: 'Contactado', color: 'cyan' },
    { value: 'qualified', label: 'Calificado', color: 'green' },
    { value: 'appointment_scheduled', label: terminology.appointmentScheduledStatus, color: 'purple' },
    { value: 'converted', label: 'Convertido', color: 'emerald' },
    { value: 'lost', label: 'Perdido', color: 'red' },
    { value: 'inactive', label: 'Inactivo', color: 'gray' },
  ];
}

/**
 * Get a specific lead status label
 */
export function getLeadStatusLabel(status: string, terminology: ExtendedTerminology): string {
  const statuses = getLeadStatuses(terminology);
  return statuses.find(s => s.value === status)?.label || status;
}

// ======================
// NOTIFICATION HELPERS
// ======================

export interface NotificationType {
  value: string;
  label: string;
  priority: string;
}

/**
 * Get dynamic notification types based on vertical terminology
 */
export function getNotificationTypes(terminology: ExtendedTerminology): NotificationType[] {
  return [
    { value: 'new_lead', label: 'Nuevo Lead', priority: 'high' },
    { value: 'new_message', label: 'Nuevo Mensaje', priority: 'high' },
    { value: 'new_appointment', label: terminology.newAppointmentNotification, priority: 'medium' },
    { value: 'appointment_reminder', label: `Recordatorio de ${terminology.appointment}`, priority: 'medium' },
    { value: 'lead_converted', label: 'Lead Convertido', priority: 'low' },
    { value: 'system_alert', label: 'Alerta del Sistema', priority: 'high' },
  ];
}

// ======================
// BADGE CONFIG HELPERS
// ======================

export interface BadgeConfig {
  variant: 'default' | 'info' | 'success' | 'warning' | 'danger';
  label: string;
}

/**
 * Get dynamic badge configurations based on vertical terminology
 */
export function getBadgeConfigs(terminology: ExtendedTerminology): Record<string, BadgeConfig> {
  return {
    // Lead statuses
    new: { variant: 'info', label: 'Nuevo' },
    contacted: { variant: 'info', label: 'Contactado' },
    qualified: { variant: 'success', label: 'Calificado' },
    appointment_scheduled: { variant: 'info', label: terminology.appointmentScheduledStatus },
    converted: { variant: 'success', label: 'Convertido' },
    lost: { variant: 'danger', label: 'Perdido' },
    inactive: { variant: 'default', label: 'Inactivo' },

    // Appointment statuses
    scheduled: { variant: 'info', label: 'Programada' },
    confirmed: { variant: 'success', label: 'Confirmada' },
    in_progress: { variant: 'warning', label: 'En Progreso' },
    completed: { variant: 'success', label: 'Completada' },
    cancelled: { variant: 'danger', label: 'Cancelada' },
    no_show: { variant: 'warning', label: 'No Asistió' },
    rescheduled: { variant: 'info', label: 'Reagendada' },

    // Conversation statuses
    active: { variant: 'success', label: 'Activa' },
    waiting_response: { variant: 'warning', label: 'Esperando' },
    escalated: { variant: 'danger', label: 'Escalada' },
    resolved: { variant: 'success', label: 'Resuelta' },

    // Call outcomes (Voice Agent)
    appointment_booked: { variant: 'success', label: `${terminology.appointment} agendada` },
    callback_requested: { variant: 'info', label: 'Callback solicitado' },
    information_provided: { variant: 'info', label: 'Información proporcionada' },
    no_answer: { variant: 'warning', label: 'Sin respuesta' },
    voicemail: { variant: 'default', label: 'Buzón de voz' },
  };
}

/**
 * Get a specific badge config
 */
export function getBadgeConfig(status: string, terminology: ExtendedTerminology): BadgeConfig {
  const configs = getBadgeConfigs(terminology);
  return configs[status] || { variant: 'default', label: status };
}

// ======================
// INTEGRATION HELPERS
// ======================

export interface IntegrationCapability {
  key: string;
  label: string;
  available: boolean;
}

/**
 * Get sync capabilities with dynamic labels
 */
export function getSyncCapabilities(
  terminology: ExtendedTerminology,
  capabilities: { leads?: boolean; appointments?: boolean; patients?: boolean }
): IntegrationCapability[] {
  return [
    { key: 'sync_leads', label: 'Leads', available: capabilities.leads ?? false },
    { key: 'sync_appointments', label: terminology.syncAppointments, available: capabilities.appointments ?? false },
    { key: 'sync_patients', label: terminology.patients, available: capabilities.patients ?? false },
  ];
}

// ======================
// SEARCH HELPERS
// ======================

/**
 * Get search placeholder based on vertical
 */
export function getSearchPlaceholder(terminology: ExtendedTerminology): string {
  return terminology.searchPlaceholder;
}

// ======================
// APPOINTMENT HELPERS
// ======================

/**
 * Get appointment-related labels for modals and forms
 */
export function getAppointmentLabels(terminology: ExtendedTerminology) {
  return {
    title: terminology.newAppointment,
    subtitle: `Agenda ${terminology.appointment.toLowerCase()} con todos los detalles`,
    createButton: `Crear ${terminology.appointment}`,
    errorMessage: terminology.createAppointmentError,
    detailTitle: terminology.appointmentDetail,
    summaryTitle: terminology.appointmentSummary,
    notesPlaceholder: terminology.appointmentNotes,
  };
}

