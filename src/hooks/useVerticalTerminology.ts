// =====================================================
// TIS TIS PLATFORM - Vertical Terminology Hook
// Provides dynamic terminology based on current vertical
// =====================================================

'use client';

import { useMemo } from 'react';
import { useTenant } from './useTenant';
import { getVerticalConfig, type VerticalType, type VerticalTerminology } from '@/src/shared/config/verticals';

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
  },
};

// Default to dental terminology
const DEFAULT_TERMINOLOGY = EXTENDED_TERMINOLOGY.dental;

// ======================
// HOOK
// ======================
export interface UseVerticalTerminologyReturn {
  terminology: ExtendedTerminology;
  vertical: VerticalType;
  isLoading: boolean;

  // Helper to get specific term
  t: (key: keyof ExtendedTerminology) => string;

  // Get vertical-specific icon
  verticalIcon: string;
  verticalColor: string;
  verticalName: string;
}

export function useVerticalTerminology(): UseVerticalTerminologyReturn {
  const { tenant, isLoading } = useTenant();

  const vertical = (tenant?.vertical as VerticalType) || 'dental';

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
