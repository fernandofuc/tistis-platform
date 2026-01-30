// =====================================================
// TIS TIS PLATFORM - Vertical Terminology Hook
// Provides dynamic terminology based on current vertical
// With localStorage persistence to prevent flash on reload
// =====================================================

'use client';

import { useMemo, useEffect } from 'react';
import { useTenant } from './useTenant';
import { getVerticalConfig, type VerticalType, type VerticalTerminology } from '@/src/shared/config/verticals';

// ======================
// CONSTANTS
// ======================
const VERTICAL_CACHE_KEY = 'tistis_vertical_cache';

// ======================
// EXTENDED TERMINOLOGY
// Includes additional UI labels beyond base terminology
// ======================
export interface ExtendedTerminology extends VerticalTerminology {
  // Dashboard labels
  dashboardTitle: string;
  dashboardSubtitle: string;

  // Calendar/Reservations
  calendarPageTitle: string;
  newAppointmentButton: string;

  // Quick actions
  scheduleAction: string;
  viewAllAction: string;

  // Stats labels
  totalActiveLabel: string;
  todayScheduledLabel: string;

  // Empty states
  noAppointmentsToday: string;
  noRecentActivity: string;

  // Time-based
  upcomingLabel: string;
  pastLabel: string;

  // Lead status labels
  appointmentScheduledStatus: string;
  newAppointmentNotification: string;

  // Appointment detail labels
  appointmentDetail: string;
  appointmentSummary: string;
  appointmentNotes: string;
  createAppointmentError: string;

  // Integration labels
  syncAppointments: string;
  calendarSyncDescription: string;
  schedulingDescription: string;

  // Search placeholder
  searchPlaceholder: string;
}

// ======================
// VERTICAL TERMINOLOGY MAPPINGS
// ======================
const EXTENDED_TERMINOLOGY: Record<VerticalType, ExtendedTerminology> = {
  dental: {
    // Base terminology
    patient: 'Paciente',
    patients: 'Pacientes',
    appointment: 'Cita',
    appointments: 'Citas',
    quote: 'Presupuesto',
    quotes: 'Presupuestos',
    newPatient: 'Nuevo Paciente',
    newAppointment: 'Nueva Cita',
    newQuote: 'Nuevo Presupuesto',
    patientList: 'Lista de Pacientes',
    appointmentCalendar: 'Calendario de Citas',
    todayAppointments: 'Citas de Hoy',
    patientActive: 'Activo',
    patientInactive: 'Inactivo',

    // Extended terminology
    dashboardTitle: 'Centro de control de tu clínica',
    dashboardSubtitle: 'Gestiona pacientes, citas y operaciones',
    calendarPageTitle: 'Calendario',
    newAppointmentButton: 'Nueva Cita',
    scheduleAction: 'Agendar Cita',
    viewAllAction: 'Ver todas',
    totalActiveLabel: 'Pacientes activos',
    todayScheduledLabel: 'Citas programadas',
    noAppointmentsToday: 'Sin citas hoy',
    noRecentActivity: 'Sin actividad reciente',
    upcomingLabel: 'Próximas',
    pastLabel: 'Pasadas',

    // Lead status labels
    appointmentScheduledStatus: 'Cita Agendada',
    newAppointmentNotification: 'Nueva Cita',

    // Appointment detail labels
    appointmentDetail: 'Detalle de Cita',
    appointmentSummary: 'Resumen de la cita',
    appointmentNotes: 'Información adicional sobre la cita, síntomas, indicaciones especiales...',
    createAppointmentError: 'Error al crear la cita',

    // Integration labels
    syncAppointments: 'Citas',
    calendarSyncDescription: 'Sincroniza citas con tu calendario',
    schedulingDescription: 'Programación de citas automatizada',

    // Search placeholder
    searchPlaceholder: 'Buscar leads, citas, pacientes...',
  },

  clinic: {
    // Base terminology
    patient: 'Paciente',
    patients: 'Pacientes',
    appointment: 'Consulta',
    appointments: 'Consultas',
    quote: 'Cotización',
    quotes: 'Cotizaciones',
    newPatient: 'Nuevo Paciente',
    newAppointment: 'Nueva Consulta',
    newQuote: 'Nueva Cotización',
    patientList: 'Lista de Pacientes',
    appointmentCalendar: 'Agenda de Consultas',
    todayAppointments: 'Consultas de Hoy',
    patientActive: 'En Tratamiento',
    patientInactive: 'Alta',

    // Extended terminology
    dashboardTitle: 'Centro de control de tu clínica',
    dashboardSubtitle: 'Gestiona pacientes, consultas y operaciones',
    calendarPageTitle: 'Agenda',
    newAppointmentButton: 'Nueva Consulta',
    scheduleAction: 'Agendar Consulta',
    viewAllAction: 'Ver todas',
    totalActiveLabel: 'Pacientes activos',
    todayScheduledLabel: 'Consultas programadas',
    noAppointmentsToday: 'Sin consultas hoy',
    noRecentActivity: 'Sin actividad reciente',
    upcomingLabel: 'Próximas',
    pastLabel: 'Pasadas',

    // Lead status labels
    appointmentScheduledStatus: 'Consulta Agendada',
    newAppointmentNotification: 'Nueva Consulta',

    // Appointment detail labels
    appointmentDetail: 'Detalle de Consulta',
    appointmentSummary: 'Resumen de la consulta',
    appointmentNotes: 'Información adicional sobre la consulta, síntomas, indicaciones especiales...',
    createAppointmentError: 'Error al crear la consulta',

    // Integration labels
    syncAppointments: 'Consultas',
    calendarSyncDescription: 'Sincroniza consultas con tu calendario',
    schedulingDescription: 'Programación de consultas automatizada',

    // Search placeholder
    searchPlaceholder: 'Buscar leads, consultas, pacientes...',
  },

  restaurant: {
    // Base terminology
    patient: 'Cliente',
    patients: 'Clientes',
    appointment: 'Reservación',
    appointments: 'Reservaciones',
    quote: 'Cotización',
    quotes: 'Cotizaciones',
    newPatient: 'Nuevo Cliente',
    newAppointment: 'Nueva Reservación',
    newQuote: 'Nueva Cotización',
    patientList: 'Lista de Clientes',
    appointmentCalendar: 'Reservaciones',
    todayAppointments: 'Reservaciones de Hoy',
    patientActive: 'Frecuente',
    patientInactive: 'Inactivo',

    // Extended terminology
    dashboardTitle: 'Centro de control de tu restaurante',
    dashboardSubtitle: 'Gestiona clientes, reservaciones y operaciones',
    calendarPageTitle: 'Reservaciones',
    newAppointmentButton: 'Nueva Reservación',
    scheduleAction: 'Reservar Mesa',
    viewAllAction: 'Ver todas',
    totalActiveLabel: 'Clientes frecuentes',
    todayScheduledLabel: 'Reservaciones de hoy',
    noAppointmentsToday: 'Sin reservaciones hoy',
    noRecentActivity: 'Sin actividad reciente',
    upcomingLabel: 'Próximas',
    pastLabel: 'Pasadas',

    // Lead status labels
    appointmentScheduledStatus: 'Reservación Confirmada',
    newAppointmentNotification: 'Nueva Reservación',

    // Appointment detail labels
    appointmentDetail: 'Detalle de Reservación',
    appointmentSummary: 'Resumen de la reservación',
    appointmentNotes: 'Información adicional sobre la reservación, preferencias, ocasión especial...',
    createAppointmentError: 'Error al crear la reservación',

    // Integration labels
    syncAppointments: 'Reservaciones',
    calendarSyncDescription: 'Sincroniza reservaciones con tu calendario',
    schedulingDescription: 'Reservaciones automatizadas',

    // Search placeholder
    searchPlaceholder: 'Buscar leads, reservaciones, clientes...',
  },

  gym: {
    // Base terminology
    patient: 'Miembro',
    patients: 'Miembros',
    appointment: 'Clase',
    appointments: 'Clases',
    quote: 'Membresía',
    quotes: 'Membresías',
    newPatient: 'Nuevo Miembro',
    newAppointment: 'Nueva Clase',
    newQuote: 'Nueva Membresía',
    patientList: 'Lista de Miembros',
    appointmentCalendar: 'Horario de Clases',
    todayAppointments: 'Clases de Hoy',
    patientActive: 'Activo',
    patientInactive: 'Inactivo',

    // Extended terminology
    dashboardTitle: 'Centro de control de tu gimnasio',
    dashboardSubtitle: 'Gestiona miembros, clases y operaciones',
    calendarPageTitle: 'Clases',
    newAppointmentButton: 'Nueva Clase',
    scheduleAction: 'Programar Clase',
    viewAllAction: 'Ver todas',
    totalActiveLabel: 'Miembros activos',
    todayScheduledLabel: 'Clases programadas',
    noAppointmentsToday: 'Sin clases hoy',
    noRecentActivity: 'Sin actividad reciente',
    upcomingLabel: 'Próximas',
    pastLabel: 'Pasadas',

    // Lead status labels
    appointmentScheduledStatus: 'Clase Reservada',
    newAppointmentNotification: 'Nueva Clase',

    // Appointment detail labels
    appointmentDetail: 'Detalle de Clase',
    appointmentSummary: 'Resumen de la clase',
    appointmentNotes: 'Información adicional sobre la clase, nivel, equipamiento necesario...',
    createAppointmentError: 'Error al crear la clase',

    // Integration labels
    syncAppointments: 'Clases',
    calendarSyncDescription: 'Sincroniza clases con tu calendario',
    schedulingDescription: 'Programación de clases automatizada',

    // Search placeholder
    searchPlaceholder: 'Buscar leads, clases, miembros...',
  },

  beauty: {
    // Base terminology
    patient: 'Cliente',
    patients: 'Clientes',
    appointment: 'Cita',
    appointments: 'Citas',
    quote: 'Cotización',
    quotes: 'Cotizaciones',
    newPatient: 'Nuevo Cliente',
    newAppointment: 'Nueva Cita',
    newQuote: 'Nueva Cotización',
    patientList: 'Lista de Clientes',
    appointmentCalendar: 'Agenda de Citas',
    todayAppointments: 'Citas de Hoy',
    patientActive: 'Activo',
    patientInactive: 'Inactivo',

    // Extended terminology
    dashboardTitle: 'Centro de control de tu salón',
    dashboardSubtitle: 'Gestiona clientes, citas y servicios',
    calendarPageTitle: 'Agenda',
    newAppointmentButton: 'Nueva Cita',
    scheduleAction: 'Agendar Cita',
    viewAllAction: 'Ver todas',
    totalActiveLabel: 'Clientes activos',
    todayScheduledLabel: 'Citas programadas',
    noAppointmentsToday: 'Sin citas hoy',
    noRecentActivity: 'Sin actividad reciente',
    upcomingLabel: 'Próximas',
    pastLabel: 'Pasadas',

    // Lead status labels
    appointmentScheduledStatus: 'Cita Agendada',
    newAppointmentNotification: 'Nueva Cita',

    // Appointment detail labels
    appointmentDetail: 'Detalle de Cita',
    appointmentSummary: 'Resumen de la cita',
    appointmentNotes: 'Información adicional sobre la cita, servicios deseados, preferencias...',
    createAppointmentError: 'Error al crear la cita',

    // Integration labels
    syncAppointments: 'Citas',
    calendarSyncDescription: 'Sincroniza citas con tu calendario',
    schedulingDescription: 'Programación de citas automatizada',

    // Search placeholder
    searchPlaceholder: 'Buscar leads, citas, clientes...',
  },

  veterinary: {
    // Base terminology
    patient: 'Paciente',
    patients: 'Pacientes',
    appointment: 'Consulta',
    appointments: 'Consultas',
    quote: 'Presupuesto',
    quotes: 'Presupuestos',
    newPatient: 'Nuevo Paciente',
    newAppointment: 'Nueva Consulta',
    newQuote: 'Nuevo Presupuesto',
    patientList: 'Lista de Pacientes',
    appointmentCalendar: 'Agenda de Consultas',
    todayAppointments: 'Consultas de Hoy',
    patientActive: 'Activo',
    patientInactive: 'Inactivo',

    // Extended terminology
    dashboardTitle: 'Centro de control de tu veterinaria',
    dashboardSubtitle: 'Gestiona pacientes, consultas y tratamientos',
    calendarPageTitle: 'Agenda',
    newAppointmentButton: 'Nueva Consulta',
    scheduleAction: 'Agendar Consulta',
    viewAllAction: 'Ver todas',
    totalActiveLabel: 'Pacientes activos',
    todayScheduledLabel: 'Consultas programadas',
    noAppointmentsToday: 'Sin consultas hoy',
    noRecentActivity: 'Sin actividad reciente',
    upcomingLabel: 'Próximas',
    pastLabel: 'Pasadas',

    // Lead status labels
    appointmentScheduledStatus: 'Consulta Agendada',
    newAppointmentNotification: 'Nueva Consulta',

    // Appointment detail labels
    appointmentDetail: 'Detalle de Consulta',
    appointmentSummary: 'Resumen de la consulta',
    appointmentNotes: 'Información adicional sobre la consulta, síntomas de la mascota, indicaciones...',
    createAppointmentError: 'Error al crear la consulta',

    // Integration labels
    syncAppointments: 'Consultas',
    calendarSyncDescription: 'Sincroniza consultas con tu calendario',
    schedulingDescription: 'Programación de consultas automatizada',

    // Search placeholder
    searchPlaceholder: 'Buscar leads, consultas, pacientes...',
  },
};

// Default to dental terminology (used only as absolute fallback)
const DEFAULT_TERMINOLOGY = EXTENDED_TERMINOLOGY.dental;

// ======================
// CACHE HELPERS
// ======================

/**
 * Get cached vertical from localStorage
 * Returns null if not found or on server
 */
function getCachedVertical(): VerticalType | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(VERTICAL_CACHE_KEY);
    if (cached && cached in EXTENDED_TERMINOLOGY) {
      return cached as VerticalType;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

/**
 * Save vertical to localStorage for future loads
 */
function setCachedVertical(vertical: VerticalType): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VERTICAL_CACHE_KEY, vertical);
  } catch {
    // localStorage not available
  }
}

// ======================
// HOOK
// ======================
export interface UseVerticalTerminologyReturn {
  terminology: ExtendedTerminology;
  vertical: VerticalType;
  isLoading: boolean;
  /** True when terminology is ready (either from cache or tenant data) */
  isReady: boolean;

  // Helper to get specific term
  t: (key: keyof ExtendedTerminology) => string;

  // Get vertical-specific icon
  verticalIcon: string;
  verticalColor: string;
  verticalName: string;
}

export function useVerticalTerminology(): UseVerticalTerminologyReturn {
  const { tenant, isLoading } = useTenant();

  // Get vertical: prefer tenant data, fallback to cache, then default
  const cachedVertical = useMemo(() => getCachedVertical(), []);
  const vertical = (tenant?.vertical as VerticalType) || cachedVertical || 'dental';

  // Cache the vertical when tenant loads
  useEffect(() => {
    if (tenant?.vertical) {
      setCachedVertical(tenant.vertical as VerticalType);
    }
  }, [tenant?.vertical]);

  // isReady when: tenant loaded OR we have a cached vertical
  const isReady = !isLoading || cachedVertical !== null;

  const terminology = useMemo(() => {
    return EXTENDED_TERMINOLOGY[vertical] || DEFAULT_TERMINOLOGY;
  }, [vertical]);

  const verticalConfig = useMemo(() => {
    return getVerticalConfig(vertical);
  }, [vertical]);

  const t = useMemo(() => {
    return (key: keyof ExtendedTerminology): string => {
      return terminology[key] || DEFAULT_TERMINOLOGY[key] || key;
    };
  }, [terminology]);

  return {
    terminology,
    vertical,
    isLoading,
    isReady,
    t,
    verticalIcon: verticalConfig.icon,
    verticalColor: verticalConfig.color,
    verticalName: verticalConfig.name,
  };
}

// ======================
// EXPORTS
// ======================
export { EXTENDED_TERMINOLOGY, DEFAULT_TERMINOLOGY };
