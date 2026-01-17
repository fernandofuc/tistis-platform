// =====================================================
// TIS TIS PLATFORM - API Scope Types
// Type definitions for the API Key permissions system
// =====================================================

// ======================
// VERTICAL TYPES
// ======================

/**
 * Supported verticals in TIS TIS Platform
 */
export type Vertical = 'dental' | 'restaurant';

// ======================
// SCOPE CATEGORIES
// ======================

/**
 * Categories for organizing scopes in the UI
 */
export type ScopeCategory =
  // Common categories (all verticals)
  | 'leads'
  | 'conversations'
  | 'appointments'
  | 'webhooks'
  | 'analytics'
  | 'ai'
  // Dental-specific
  | 'patients'
  | 'treatments'
  | 'quotes'
  | 'services'
  // Restaurant-specific
  | 'menu'
  | 'orders'
  | 'inventory'
  | 'tables'
  | 'kitchen'
  | 'reservations';

// ======================
// COMMON SCOPES
// ======================

/**
 * Common scopes available to all verticals
 */
export type CommonScope =
  // Leads
  | 'leads:read'
  | 'leads:write'
  // Conversations
  | 'conversations:read'
  | 'conversations:write'
  // Appointments
  | 'appointments:read'
  | 'appointments:write'
  // Webhooks
  | 'webhooks:manage'
  | 'webhook:read'
  | 'webhook:write'
  // Analytics
  | 'analytics:read'
  // AI
  | 'ai:chat'
  | 'ai:chat:read'
  | 'ai:config:read'
  | 'ai:config:write'
  | 'ai:knowledge:read'
  | 'ai:knowledge:write';

// ======================
// DENTAL SCOPES
// ======================

/**
 * Scopes specific to dental vertical
 */
export type DentalScope =
  // Patients
  | 'patients:read'
  | 'patients:write'
  // Treatments
  | 'treatments:read'
  | 'treatments:write'
  // Quotes
  | 'quotes:read'
  | 'quotes:write'
  // Services
  | 'services:read'
  | 'services:write';

// ======================
// RESTAURANT SCOPES
// ======================

/**
 * Scopes specific to restaurant vertical
 */
export type RestaurantScope =
  // Menu
  | 'menu:read'
  | 'menu:write'
  // Orders
  | 'orders:read'
  | 'orders:write'
  // Inventory
  | 'inventory:read'
  | 'inventory:write'
  // Tables
  | 'tables:read'
  | 'tables:write'
  // Kitchen
  | 'kitchen:read'
  | 'kitchen:write'
  // Reservations
  | 'reservations:read'
  | 'reservations:write';

// ======================
// ALL SCOPES UNION
// ======================

/**
 * All possible API scopes
 */
export type APIScope = CommonScope | DentalScope | RestaurantScope;

// ======================
// SCOPE DEFINITION
// ======================

/**
 * Definition of a single scope
 */
export interface ScopeDefinition {
  /** Unique scope identifier (e.g., "leads:read") */
  key: APIScope;
  /** Human-readable name */
  name: string;
  /** Detailed description of what this scope allows */
  description: string;
  /** Category for UI grouping */
  category: ScopeCategory;
  /** Vertical restriction (undefined = common to all) */
  vertical?: Vertical;
  /** Icon for UI display */
  icon?: string;
  /** Whether this scope requires another scope */
  requires?: APIScope[];
  /** Whether this scope implies other scopes */
  implies?: APIScope[];
}

// ======================
// GROUPED SCOPES
// ======================

/**
 * Scopes grouped by category for UI display
 */
export interface GroupedScopes {
  [category: string]: ScopeDefinition[];
}

/**
 * Scope group with metadata
 */
export interface ScopeGroup {
  category: ScopeCategory;
  name: string;
  icon: string;
  scopes: ScopeDefinition[];
}

// ======================
// SCOPE SELECTION
// ======================

/**
 * State for scope selection UI
 */
export interface ScopeSelectionState {
  selected: APIScope[];
  available: ScopeDefinition[];
  grouped: ScopeGroup[];
}

// ======================
// SCOPE VALIDATION
// ======================

/**
 * Result of scope validation
 */
export interface ScopeValidationResult {
  valid: boolean;
  invalidScopes: string[];
  missingDependencies: {
    scope: APIScope;
    requires: APIScope[];
  }[];
}

// ======================
// PERMISSION CHECK
// ======================

/**
 * Result of checking if a key has permission for an action
 */
export interface PermissionCheckResult {
  allowed: boolean;
  missing_scope?: APIScope;
  message?: string;
}

// ======================
// CATEGORY METADATA
// ======================

/**
 * Metadata for a scope category (for UI)
 */
export interface ScopeCategoryMetadata {
  key: ScopeCategory;
  name: string;
  icon: string;
  description: string;
  vertical?: Vertical;
}
