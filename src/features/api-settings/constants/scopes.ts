// =====================================================
// TIS TIS PLATFORM - API Scope Constants
// Complete definitions with metadata for UI display
// =====================================================

import type {
  APIScope,
  ScopeDefinition,
  ScopeCategory,
  ScopeCategoryMetadata,
  Vertical,
  ScopeGroup,
} from '../types';

// ======================
// SCOPE CATEGORY METADATA
// ======================

/**
 * Metadata for each scope category (for UI grouping)
 */
export const SCOPE_CATEGORIES: Record<ScopeCategory, ScopeCategoryMetadata> = {
  // Common categories
  leads: {
    key: 'leads',
    name: 'Leads',
    icon: 'Users',
    description: 'Gestión de leads y contactos',
  },
  conversations: {
    key: 'conversations',
    name: 'Conversaciones',
    icon: 'MessageSquare',
    description: 'Acceso a conversaciones y mensajes',
  },
  appointments: {
    key: 'appointments',
    name: 'Citas',
    icon: 'Calendar',
    description: 'Gestión de citas y reservaciones',
  },
  webhooks: {
    key: 'webhooks',
    name: 'Webhooks',
    icon: 'Webhook',
    description: 'Configuración de webhooks',
  },
  analytics: {
    key: 'analytics',
    name: 'Analytics',
    icon: 'BarChart3',
    description: 'Acceso a métricas y estadísticas',
  },
  ai: {
    key: 'ai',
    name: 'Agente AI',
    icon: 'Bot',
    description: 'Interacción con el agente de IA',
  },
  // Dental categories
  patients: {
    key: 'patients',
    name: 'Pacientes',
    icon: 'UserCircle',
    description: 'Gestión de pacientes',
    vertical: 'dental',
  },
  treatments: {
    key: 'treatments',
    name: 'Tratamientos',
    icon: 'Stethoscope',
    description: 'Tratamientos dentales',
    vertical: 'dental',
  },
  quotes: {
    key: 'quotes',
    name: 'Cotizaciones',
    icon: 'FileText',
    description: 'Cotizaciones de tratamientos',
    vertical: 'dental',
  },
  services: {
    key: 'services',
    name: 'Servicios',
    icon: 'Briefcase',
    description: 'Catálogo de servicios dentales',
    vertical: 'dental',
  },
  // Restaurant categories
  menu: {
    key: 'menu',
    name: 'Menú',
    icon: 'UtensilsCrossed',
    description: 'Gestión del menú',
    vertical: 'restaurant',
  },
  orders: {
    key: 'orders',
    name: 'Órdenes',
    icon: 'ClipboardList',
    description: 'Gestión de órdenes',
    vertical: 'restaurant',
  },
  inventory: {
    key: 'inventory',
    name: 'Inventario',
    icon: 'Package',
    description: 'Control de inventario',
    vertical: 'restaurant',
  },
  tables: {
    key: 'tables',
    name: 'Mesas',
    icon: 'LayoutGrid',
    description: 'Gestión de mesas',
    vertical: 'restaurant',
  },
  kitchen: {
    key: 'kitchen',
    name: 'Cocina',
    icon: 'ChefHat',
    description: 'Sistema de cocina',
    vertical: 'restaurant',
  },
  reservations: {
    key: 'reservations',
    name: 'Reservaciones',
    icon: 'CalendarCheck',
    description: 'Reservaciones de mesas',
    vertical: 'restaurant',
  },
};

// ======================
// COMPLETE SCOPE DEFINITIONS
// ======================

/**
 * Complete definitions for all scopes with metadata
 */
export const SCOPE_DEFINITIONS: Record<APIScope, ScopeDefinition> = {
  // ==================
  // COMMON SCOPES
  // ==================

  // Leads
  'leads:read': {
    key: 'leads:read',
    name: 'Leer Leads',
    description: 'Ver información de leads y contactos',
    category: 'leads',
    icon: 'Eye',
  },
  'leads:write': {
    key: 'leads:write',
    name: 'Escribir Leads',
    description: 'Crear, actualizar y eliminar leads',
    category: 'leads',
    icon: 'Pencil',
    requires: ['leads:read'],
  },

  // Conversations
  'conversations:read': {
    key: 'conversations:read',
    name: 'Leer Conversaciones',
    description: 'Ver historial de conversaciones y mensajes',
    category: 'conversations',
    icon: 'Eye',
  },
  'conversations:write': {
    key: 'conversations:write',
    name: 'Escribir Conversaciones',
    description: 'Enviar mensajes y modificar conversaciones',
    category: 'conversations',
    icon: 'Pencil',
    requires: ['conversations:read'],
  },

  // Appointments
  'appointments:read': {
    key: 'appointments:read',
    name: 'Leer Citas',
    description: 'Ver citas y disponibilidad',
    category: 'appointments',
    icon: 'Eye',
  },
  'appointments:write': {
    key: 'appointments:write',
    name: 'Escribir Citas',
    description: 'Crear, modificar y cancelar citas',
    category: 'appointments',
    icon: 'Pencil',
    requires: ['appointments:read'],
  },

  // Webhooks
  'webhooks:manage': {
    key: 'webhooks:manage',
    name: 'Gestionar Webhooks',
    description: 'Configurar y administrar webhooks',
    category: 'webhooks',
    icon: 'Settings',
  },
  'webhook:read': {
    key: 'webhook:read',
    name: 'Leer Webhooks',
    description: 'Ver eventos de webhook recibidos',
    category: 'webhooks',
    icon: 'Eye',
  },
  'webhook:write': {
    key: 'webhook:write',
    name: 'Enviar Webhooks',
    description: 'Enviar eventos via webhook entrante',
    category: 'webhooks',
    icon: 'Send',
    requires: ['webhook:read'],
  },

  // Analytics
  'analytics:read': {
    key: 'analytics:read',
    name: 'Leer Analytics',
    description: 'Acceder a métricas, reportes y estadísticas',
    category: 'analytics',
    icon: 'BarChart3',
  },

  // AI Agent
  'ai:chat': {
    key: 'ai:chat',
    name: 'Chat con AI',
    description: 'Enviar mensajes al agente de IA',
    category: 'ai',
    icon: 'MessageSquare',
  },
  'ai:chat:read': {
    key: 'ai:chat:read',
    name: 'Leer Chat AI',
    description: 'Ver historial de conversaciones con el agente',
    category: 'ai',
    icon: 'Eye',
  },
  'ai:config:read': {
    key: 'ai:config:read',
    name: 'Leer Config AI',
    description: 'Ver configuración del agente de IA',
    category: 'ai',
    icon: 'Settings',
  },
  'ai:config:write': {
    key: 'ai:config:write',
    name: 'Escribir Config AI',
    description: 'Modificar configuración del agente de IA',
    category: 'ai',
    icon: 'Pencil',
    requires: ['ai:config:read'],
  },
  'ai:knowledge:read': {
    key: 'ai:knowledge:read',
    name: 'Leer Knowledge Base',
    description: 'Acceder a la base de conocimiento del agente',
    category: 'ai',
    icon: 'BookOpen',
  },
  'ai:knowledge:write': {
    key: 'ai:knowledge:write',
    name: 'Escribir Knowledge Base',
    description: 'Modificar la base de conocimiento del agente',
    category: 'ai',
    icon: 'Pencil',
    requires: ['ai:knowledge:read'],
  },

  // ==================
  // DENTAL SCOPES
  // ==================

  'patients:read': {
    key: 'patients:read',
    name: 'Leer Pacientes',
    description: 'Ver información de pacientes',
    category: 'patients',
    vertical: 'dental',
    icon: 'Eye',
  },
  'patients:write': {
    key: 'patients:write',
    name: 'Escribir Pacientes',
    description: 'Crear y modificar pacientes',
    category: 'patients',
    vertical: 'dental',
    icon: 'Pencil',
    requires: ['patients:read'],
  },
  'treatments:read': {
    key: 'treatments:read',
    name: 'Leer Tratamientos',
    description: 'Ver tratamientos disponibles',
    category: 'treatments',
    vertical: 'dental',
    icon: 'Eye',
  },
  'treatments:write': {
    key: 'treatments:write',
    name: 'Escribir Tratamientos',
    description: 'Gestionar tratamientos',
    category: 'treatments',
    vertical: 'dental',
    icon: 'Pencil',
    requires: ['treatments:read'],
  },
  'quotes:read': {
    key: 'quotes:read',
    name: 'Leer Cotizaciones',
    description: 'Ver cotizaciones de tratamientos',
    category: 'quotes',
    vertical: 'dental',
    icon: 'Eye',
  },
  'quotes:write': {
    key: 'quotes:write',
    name: 'Escribir Cotizaciones',
    description: 'Crear y modificar cotizaciones',
    category: 'quotes',
    vertical: 'dental',
    icon: 'Pencil',
    requires: ['quotes:read'],
  },
  'services:read': {
    key: 'services:read',
    name: 'Leer Servicios',
    description: 'Ver catálogo de servicios dentales',
    category: 'services',
    vertical: 'dental',
    icon: 'Eye',
  },
  'services:write': {
    key: 'services:write',
    name: 'Escribir Servicios',
    description: 'Gestionar catálogo de servicios',
    category: 'services',
    vertical: 'dental',
    icon: 'Pencil',
    requires: ['services:read'],
  },

  // ==================
  // RESTAURANT SCOPES
  // ==================

  'menu:read': {
    key: 'menu:read',
    name: 'Leer Menú',
    description: 'Ver productos del menú',
    category: 'menu',
    vertical: 'restaurant',
    icon: 'Eye',
  },
  'menu:write': {
    key: 'menu:write',
    name: 'Escribir Menú',
    description: 'Gestionar productos del menú',
    category: 'menu',
    vertical: 'restaurant',
    icon: 'Pencil',
    requires: ['menu:read'],
  },
  'orders:read': {
    key: 'orders:read',
    name: 'Leer Órdenes',
    description: 'Ver órdenes y pedidos',
    category: 'orders',
    vertical: 'restaurant',
    icon: 'Eye',
  },
  'orders:write': {
    key: 'orders:write',
    name: 'Escribir Órdenes',
    description: 'Crear y modificar órdenes',
    category: 'orders',
    vertical: 'restaurant',
    icon: 'Pencil',
    requires: ['orders:read'],
  },
  'inventory:read': {
    key: 'inventory:read',
    name: 'Leer Inventario',
    description: 'Ver stock e inventario',
    category: 'inventory',
    vertical: 'restaurant',
    icon: 'Eye',
  },
  'inventory:write': {
    key: 'inventory:write',
    name: 'Escribir Inventario',
    description: 'Gestionar inventario',
    category: 'inventory',
    vertical: 'restaurant',
    icon: 'Pencil',
    requires: ['inventory:read'],
  },
  'tables:read': {
    key: 'tables:read',
    name: 'Leer Mesas',
    description: 'Ver estado de mesas',
    category: 'tables',
    vertical: 'restaurant',
    icon: 'Eye',
  },
  'tables:write': {
    key: 'tables:write',
    name: 'Escribir Mesas',
    description: 'Gestionar estado de mesas',
    category: 'tables',
    vertical: 'restaurant',
    icon: 'Pencil',
    requires: ['tables:read'],
  },
  'kitchen:read': {
    key: 'kitchen:read',
    name: 'Leer Cocina',
    description: 'Ver órdenes en cocina',
    category: 'kitchen',
    vertical: 'restaurant',
    icon: 'Eye',
  },
  'kitchen:write': {
    key: 'kitchen:write',
    name: 'Escribir Cocina',
    description: 'Actualizar estado de órdenes',
    category: 'kitchen',
    vertical: 'restaurant',
    icon: 'Pencil',
    requires: ['kitchen:read'],
  },
  'reservations:read': {
    key: 'reservations:read',
    name: 'Leer Reservaciones',
    description: 'Ver reservaciones de mesas',
    category: 'reservations',
    vertical: 'restaurant',
    icon: 'Eye',
  },
  'reservations:write': {
    key: 'reservations:write',
    name: 'Escribir Reservaciones',
    description: 'Gestionar reservaciones',
    category: 'reservations',
    vertical: 'restaurant',
    icon: 'Pencil',
    requires: ['reservations:read'],
  },
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Get scope definition by key
 */
export function getScopeDefinition(scope: APIScope): ScopeDefinition {
  return SCOPE_DEFINITIONS[scope];
}

/**
 * Get all scopes for a vertical, grouped by category
 */
export function getScopesGroupedByCategory(vertical: Vertical): ScopeGroup[] {
  const groups: Map<ScopeCategory, ScopeDefinition[]> = new Map();

  // Get scopes for this vertical
  Object.values(SCOPE_DEFINITIONS).forEach((scope) => {
    // Include if no vertical restriction or matches the vertical
    if (!scope.vertical || scope.vertical === vertical) {
      const existing = groups.get(scope.category) || [];
      existing.push(scope);
      groups.set(scope.category, existing);
    }
  });

  // Convert to ScopeGroup array
  const result: ScopeGroup[] = [];
  groups.forEach((scopes, category) => {
    const categoryMeta = SCOPE_CATEGORIES[category];
    if (categoryMeta) {
      result.push({
        category,
        name: categoryMeta.name,
        icon: categoryMeta.icon,
        scopes,
      });
    }
  });

  // Sort groups: common first, then vertical-specific
  return result.sort((a, b) => {
    const aVertical = SCOPE_CATEGORIES[a.category]?.vertical;
    const bVertical = SCOPE_CATEGORIES[b.category]?.vertical;
    if (!aVertical && bVertical) return -1;
    if (aVertical && !bVertical) return 1;
    return 0;
  });
}

/**
 * Get all common scopes (available to all verticals)
 */
export function getCommonScopes(): ScopeDefinition[] {
  return Object.values(SCOPE_DEFINITIONS).filter((scope) => !scope.vertical);
}

/**
 * Get scopes by vertical
 */
export function getVerticalScopes(vertical: Vertical): ScopeDefinition[] {
  return Object.values(SCOPE_DEFINITIONS).filter(
    (scope) => scope.vertical === vertical
  );
}

/**
 * Base presets (common scopes only)
 */
export const SCOPE_PRESETS: Record<string, { name: string; scopes: APIScope[] }> = {
  read_only: {
    name: 'Solo Lectura',
    scopes: ['leads:read', 'conversations:read', 'appointments:read', 'analytics:read'],
  },
  full_access: {
    name: 'Acceso Completo',
    scopes: [
      'leads:read',
      'leads:write',
      'conversations:read',
      'conversations:write',
      'appointments:read',
      'appointments:write',
      'analytics:read',
    ],
  },
  ai_integration: {
    name: 'Integración AI',
    scopes: ['ai:chat', 'ai:chat:read', 'conversations:read', 'conversations:write'],
  },
  webhooks_only: {
    name: 'Solo Webhooks',
    scopes: ['webhooks:manage'],
  },
};

/**
 * Get presets with vertical-specific scopes included
 * This ensures that "Acceso Completo" includes all read/write scopes for the vertical
 */
export function getScopePresetsForVertical(
  vertical: Vertical
): Record<string, { name: string; scopes: APIScope[] }> {
  // Get vertical-specific scopes
  const verticalScopes = getVerticalScopes(vertical);
  const verticalReadScopes = verticalScopes
    .filter((s) => s.key.endsWith(':read'))
    .map((s) => s.key);
  const verticalWriteScopes = verticalScopes
    .filter((s) => s.key.endsWith(':write'))
    .map((s) => s.key);

  return {
    read_only: {
      name: 'Solo Lectura',
      scopes: [
        ...SCOPE_PRESETS.read_only.scopes,
        ...verticalReadScopes,
      ],
    },
    full_access: {
      name: 'Acceso Completo',
      scopes: [
        ...SCOPE_PRESETS.full_access.scopes,
        ...verticalReadScopes,
        ...verticalWriteScopes,
      ],
    },
    ai_integration: {
      ...SCOPE_PRESETS.ai_integration,
    },
    webhooks_only: {
      ...SCOPE_PRESETS.webhooks_only,
    },
  };
}
