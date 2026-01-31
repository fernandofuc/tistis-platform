// =====================================================
// TIS TIS PLATFORM - Vertical Configuration
// Multi-vertical architecture for different business types
// =====================================================

/**
 * ARQUITECTURA MULTI-VERTICAL
 *
 * TIS TIS soporta múltiples verticales de negocio con:
 * 1. Terminología adaptada (Pacientes vs Clientes vs Miembros)
 * 2. Módulos específicos (Historial Clínico vs Reservaciones)
 * 3. Flujos de trabajo personalizados
 * 4. UI/UX optimizada por vertical
 *
 * Verticales soportadas:
 * - dental: Clínicas dentales
 * - clinic: Clínicas médicas generales
 * - restaurant: Restaurantes y cafeterías
 * - gym: Gimnasios y centros fitness
 * - beauty: Salones de belleza y spas
 * - veterinary: Clínicas veterinarias
 */

// ======================
// TYPES
// ======================
export type VerticalType = 'dental' | 'clinic' | 'restaurant' | 'gym' | 'beauty' | 'veterinary';

export interface VerticalConfig {
  id: VerticalType;
  name: string;
  description: string;
  icon: string;
  color: string;
  terminology: VerticalTerminology;
  modules: string[];
  defaultFeatures: string[];
}

export interface VerticalTerminology {
  // Entity names
  patient: string;
  patients: string;
  appointment: string;
  appointments: string;
  quote: string;
  quotes: string;

  // Action labels
  newPatient: string;
  newAppointment: string;
  newQuote: string;

  // UI labels
  patientList: string;
  appointmentCalendar: string;
  todayAppointments: string;

  // Status
  patientActive: string;
  patientInactive: string;
}

// ======================
// VERTICAL CONFIGURATIONS
// ======================
export const VERTICALS: Record<VerticalType, VerticalConfig> = {
  dental: {
    id: 'dental',
    name: 'Dental',
    description: 'Clínicas dentales y consultorios odontológicos',
    icon: '🦷',
    color: '#4F46E5',
    terminology: {
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
    },
    modules: [
      'dashboard',
      'leads',
      'patients',
      'appointments',
      'quotes',
      'clinical_history',
      'treatment_plans',
      'inbox',
      'analytics',
      'settings',
    ],
    defaultFeatures: [
      'leads_enabled',
      'patients_enabled',
      'appointments_enabled',
      'quotes_enabled',
      'clinical_history_enabled',
      'conversations_enabled',
    ],
  },

  clinic: {
    id: 'clinic',
    name: 'Consultorios',
    description: 'Consultorios médicos, estéticos, de belleza y especialidades',
    icon: '✨',
    color: '#059669',
    terminology: {
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
    },
    modules: [
      'dashboard',
      'leads',
      'patients',
      'appointments',
      'quotes',
      'clinical_history',
      'inbox',
      'analytics',
      'settings',
    ],
    defaultFeatures: [
      'leads_enabled',
      'patients_enabled',
      'appointments_enabled',
      'quotes_enabled',
      'clinical_history_enabled',
      'conversations_enabled',
    ],
  },

  restaurant: {
    id: 'restaurant',
    name: 'Restaurante',
    description: 'Restaurantes, cafeterías y bares',
    icon: '🍽️',
    color: '#DC2626',
    terminology: {
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
    },
    modules: [
      'dashboard',
      'leads',
      'reservations',
      'inventory',
      'inbox',
      'analytics',
      'settings',
    ],
    defaultFeatures: [
      'leads_enabled',
      'reservations_enabled',
      'conversations_enabled',
    ],
  },

  gym: {
    id: 'gym',
    name: 'Gimnasio',
    description: 'Gimnasios y centros de fitness',
    icon: '💪',
    color: '#7C3AED',
    terminology: {
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
    },
    modules: [
      'dashboard',
      'leads',
      'members',
      'classes',
      'memberships',
      'inbox',
      'analytics',
      'settings',
    ],
    defaultFeatures: [
      'leads_enabled',
      'patients_enabled',
      'appointments_enabled',
      'conversations_enabled',
    ],
  },

  beauty: {
    id: 'beauty',
    name: 'Belleza & Spa',
    description: 'Salones de belleza, spas y estéticas',
    icon: '💅',
    color: '#EC4899',
    terminology: {
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
    },
    modules: [
      'dashboard',
      'leads',
      'clients',
      'appointments',
      'services',
      'inbox',
      'analytics',
      'settings',
    ],
    defaultFeatures: [
      'leads_enabled',
      'patients_enabled',
      'appointments_enabled',
      'conversations_enabled',
    ],
  },

  veterinary: {
    id: 'veterinary',
    name: 'Veterinaria',
    description: 'Clínicas veterinarias y hospitales de mascotas',
    icon: '🐾',
    color: '#10B981',
    terminology: {
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
    },
    modules: [
      'dashboard',
      'leads',
      'patients',
      'appointments',
      'clinical_history',
      'inbox',
      'analytics',
      'settings',
    ],
    defaultFeatures: [
      'leads_enabled',
      'patients_enabled',
      'appointments_enabled',
      'clinical_history_enabled',
      'conversations_enabled',
    ],
  },
};

// ======================
// HELPERS
// ======================

/**
 * Get vertical configuration by ID
 */
export function getVerticalConfig(vertical: string): VerticalConfig {
  return VERTICALS[vertical as VerticalType] || VERTICALS.dental;
}

/**
 * Get terminology for a specific vertical
 */
export function getTerminology(vertical: string): VerticalTerminology {
  return getVerticalConfig(vertical).terminology;
}

/**
 * Get a specific term for a vertical
 */
export function getTerm(vertical: string, key: keyof VerticalTerminology): string {
  return getTerminology(vertical)[key];
}

/**
 * Check if a module is available for a vertical
 */
export function hasModule(vertical: string, module: string): boolean {
  const config = getVerticalConfig(vertical);
  return config.modules.includes(module);
}

/**
 * Get all available verticals for selection
 */
export function getAvailableVerticals(): VerticalConfig[] {
  return Object.values(VERTICALS);
}

// ======================
// HOOK
// ======================
// See: src/hooks/useVertical.ts for React hook implementation
