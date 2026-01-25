/**
 * TIS TIS Platform - Voice Agent
 * Capability Display Constants
 *
 * Defines display names, icons, and categories for capabilities
 * Used by UI components to show human-readable information
 */

import type { Capability } from '@/lib/voice-agent/types';

// =====================================================
// DISPLAY NAMES
// =====================================================

export const CAPABILITY_DISPLAY_NAMES: Record<Capability, string> = {
  // Shared
  business_hours: 'Horarios',
  business_info: 'Info del negocio',
  human_transfer: 'Transferir a humano',
  faq: 'Preguntas frecuentes',
  invoicing: 'Facturación',

  // Restaurant
  reservations: 'Reservaciones',
  menu_info: 'Información del menú',
  recommendations: 'Recomendaciones',
  orders: 'Pedidos',
  order_status: 'Estado de pedidos',
  promotions: 'Promociones',
  delivery: 'Delivery',

  // Dental
  appointments: 'Citas',
  services_info: 'Servicios',
  doctor_info: 'Doctores',
  insurance_info: 'Seguros',
  appointment_management: 'Gestión de citas',
  emergencies: 'Emergencias',
};

export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  // Shared
  business_hours: 'Consultar horarios de atención del negocio',
  business_info: 'Proporcionar información general del negocio',
  human_transfer: 'Transferir la llamada a un agente humano',
  faq: 'Responder preguntas frecuentes de clientes',
  invoicing: 'Solicitar y gestionar facturas fiscales',

  // Restaurant
  reservations: 'Crear, modificar y cancelar reservaciones de mesa',
  menu_info: 'Consultar el menú, platillos y precios',
  recommendations: 'Dar recomendaciones personalizadas según preferencias',
  orders: 'Tomar pedidos telefónicos para llevar o delivery',
  order_status: 'Consultar el estado de pedidos en curso',
  promotions: 'Informar sobre ofertas y promociones activas',
  delivery: 'Gestionar entregas a domicilio y rastreo',

  // Dental
  appointments: 'Agendar nuevas citas dentales',
  services_info: 'Informar sobre servicios y tratamientos disponibles',
  doctor_info: 'Proporcionar información de doctores y especialidades',
  insurance_info: 'Manejar consultas sobre seguros dentales',
  appointment_management: 'Modificar o cancelar citas existentes',
  emergencies: 'Evaluar y manejar urgencias dentales',
};

// =====================================================
// ICON NAMES (Lucide Icons)
// =====================================================

export const CAPABILITY_ICONS: Record<Capability, string> = {
  // Shared
  business_hours: 'Clock',
  business_info: 'Building2',
  human_transfer: 'UserCheck',
  faq: 'HelpCircle',
  invoicing: 'Receipt',

  // Restaurant
  reservations: 'CalendarCheck',
  menu_info: 'UtensilsCrossed',
  recommendations: 'Sparkles',
  orders: 'ShoppingBag',
  order_status: 'Package',
  promotions: 'Tag',
  delivery: 'Truck',

  // Dental
  appointments: 'Calendar',
  services_info: 'Stethoscope',
  doctor_info: 'UserCircle',
  insurance_info: 'Shield',
  appointment_management: 'CalendarCog',
  emergencies: 'AlertTriangle',
};

// =====================================================
// CATEGORIES
// =====================================================

export interface CapabilityCategory {
  id: string;
  name: string;
  icon: string;
  capabilities: Capability[];
}

export const RESTAURANT_CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  {
    id: 'business',
    name: 'Negocio',
    icon: 'Building2',
    capabilities: ['business_hours', 'business_info', 'faq'],
  },
  {
    id: 'reservations',
    name: 'Reservaciones',
    icon: 'CalendarCheck',
    capabilities: ['reservations'],
  },
  {
    id: 'menu',
    name: 'Menú',
    icon: 'UtensilsCrossed',
    capabilities: ['menu_info', 'recommendations'],
  },
  {
    id: 'orders',
    name: 'Pedidos',
    icon: 'ShoppingBag',
    capabilities: ['orders', 'order_status', 'promotions', 'delivery'],
  },
  {
    id: 'support',
    name: 'Soporte',
    icon: 'Headphones',
    capabilities: ['human_transfer', 'invoicing'],
  },
];

export const DENTAL_CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  {
    id: 'business',
    name: 'Negocio',
    icon: 'Building2',
    capabilities: ['business_hours', 'business_info', 'faq'],
  },
  {
    id: 'appointments',
    name: 'Citas',
    icon: 'Calendar',
    capabilities: ['appointments', 'appointment_management'],
  },
  {
    id: 'services',
    name: 'Servicios',
    icon: 'Stethoscope',
    capabilities: ['services_info', 'doctor_info'],
  },
  {
    id: 'insurance',
    name: 'Seguros',
    icon: 'Shield',
    capabilities: ['insurance_info'],
  },
  {
    id: 'emergencies',
    name: 'Emergencias',
    icon: 'AlertTriangle',
    capabilities: ['emergencies'],
  },
  {
    id: 'support',
    name: 'Soporte',
    icon: 'Headphones',
    capabilities: ['human_transfer', 'invoicing'],
  },
];

export function getCategoriesForVertical(
  vertical: 'restaurant' | 'dental'
): CapabilityCategory[] {
  return vertical === 'restaurant'
    ? RESTAURANT_CAPABILITY_CATEGORIES
    : DENTAL_CAPABILITY_CATEGORIES;
}

export function getCategoryForCapability(
  capability: Capability,
  vertical: 'restaurant' | 'dental'
): CapabilityCategory | undefined {
  const categories = getCategoriesForVertical(vertical);
  return categories.find((cat) => cat.capabilities.includes(capability));
}

// =====================================================
// LEVEL COLORS (TIS TIS Style)
// =====================================================

export const LEVEL_COLORS = {
  basic: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    gradient: 'from-slate-400 to-slate-500',
    ring: 'ring-slate-200',
  },
  standard: {
    bg: 'bg-gradient-to-r from-coral-50 to-pink-50',
    text: 'text-coral-600',
    border: 'border-coral-300',
    gradient: 'from-coral-500 to-pink-500',
    ring: 'ring-coral-200',
  },
  complete: {
    bg: 'bg-gradient-to-r from-violet-50 to-indigo-50',
    text: 'text-violet-600',
    border: 'border-violet-300',
    gradient: 'from-violet-500 to-indigo-500',
    ring: 'ring-violet-200',
  },
} as const;

// =====================================================
// BADGE VARIANTS
// =====================================================

export const CAPABILITY_BADGE_VARIANTS = {
  included: {
    container: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    icon: 'text-emerald-500',
  },
  'not-included': {
    container: 'bg-slate-50 border-slate-200',
    text: 'text-slate-400 line-through',
    icon: 'text-slate-300',
  },
  new: {
    container: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: 'text-amber-500',
  },
  default: {
    container: 'bg-slate-100 border-slate-200',
    text: 'text-slate-600',
    icon: 'text-slate-400',
  },
} as const;

export type CapabilityBadgeVariant = keyof typeof CAPABILITY_BADGE_VARIANTS;
