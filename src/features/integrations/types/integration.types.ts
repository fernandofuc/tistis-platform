// =====================================================
// TIS TIS PLATFORM - Integration Types
// Type definitions for the Integration Hub feature
// =====================================================

// ======================
// ENUMS
// ======================

export type IntegrationType =
  // CRMs
  | 'hubspot'
  | 'salesforce'
  | 'zoho_crm'
  | 'pipedrive'
  | 'freshsales'
  // Dental Software
  | 'dentrix'
  | 'open_dental'
  | 'eaglesoft'
  | 'curve_dental'
  | 'dentalink'             // Popular in Latin America
  // POS Systems (Restaurant)
  | 'square'
  | 'toast'
  | 'clover'
  | 'lightspeed'
  | 'softrestaurant'        // Main SoftRestaurant integration
  | 'softrestaurant_import' // Legacy import type
  // Calendar
  | 'google_calendar'
  | 'calendly'
  | 'acuity'
  // Medical
  | 'epic'
  | 'cerner'
  | 'athenahealth'
  // Generic
  | 'webhook_incoming'
  | 'csv_import'
  | 'api_custom';

export type IntegrationStatus =
  | 'pending'
  | 'configuring'
  | 'connected'
  | 'syncing'
  | 'paused'
  | 'error'
  | 'disconnected';

export type AuthType =
  | 'oauth2'
  | 'api_key'
  | 'basic_auth'
  | 'webhook_secret';

export type SyncDirection =
  | 'inbound'
  | 'outbound'
  | 'bidirectional';

export type SyncType =
  | 'contacts'
  | 'appointments'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'full';

export type SyncTrigger =
  | 'scheduled'
  | 'manual'
  | 'webhook'
  | 'realtime';

export type SyncLogStatus =
  | 'started'
  | 'in_progress'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type DedupStatus =
  | 'pending'
  | 'matched'
  | 'no_match'
  | 'manual_review';

// ======================
// INTEGRATION CONNECTION
// ======================

export interface IntegrationConnection {
  id: string;
  tenant_id: string;
  branch_id?: string;

  // Type and status
  integration_type: IntegrationType;
  status: IntegrationStatus;
  connection_name?: string;

  // Auth (tokens are NOT exposed to frontend)
  auth_type: AuthType;
  token_expires_at?: string;

  // Webhook config (for incoming webhooks)
  webhook_url?: string;
  webhook_secret?: string;

  // Sync configuration
  sync_enabled: boolean;
  sync_direction: SyncDirection;
  sync_frequency_minutes: number;
  last_sync_at?: string;
  next_sync_at?: string;

  // What to sync
  sync_contacts: boolean;
  sync_appointments: boolean;
  sync_products: boolean;
  sync_inventory: boolean;
  sync_orders: boolean;

  // Field mapping
  field_mapping: Record<string, Record<string, string>>;

  // External account info
  external_account_id?: string;
  external_account_name?: string;
  external_api_base_url?: string;

  // Stats
  records_synced_total: number;
  records_synced_today: number;
  last_error_at?: string;
  last_error_message?: string;
  error_count: number;
  consecutive_errors: number;

  // Metadata
  metadata: Record<string, unknown>;
  connected_at?: string;
  created_at: string;
  updated_at: string;
}

// ======================
// EXTERNAL CONTACTS
// ======================

export interface ExternalContact {
  id: string;
  tenant_id: string;
  integration_id: string;

  // External IDs
  external_id: string;
  external_source: string;

  // Linked TIS TIS entities
  linked_lead_id?: string;
  linked_patient_id?: string;

  // Deduplication
  dedup_status: DedupStatus;
  dedup_checked_at?: string;
  dedup_match_confidence?: number;

  // Contact data
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  phone_normalized?: string;

  // Additional data
  company?: string;
  job_title?: string;
  address_line1?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;

  // External system data
  external_score?: number;
  external_status?: string;
  external_stage?: string;
  external_owner?: string;
  external_tags?: string[];
  custom_fields: Record<string, unknown>;

  // Sync metadata
  raw_data: Record<string, unknown>;
  first_synced_at: string;
  last_synced_at: string;
  sync_hash?: string;
  sync_version: number;

  external_created_at?: string;
  external_updated_at?: string;
}

// ======================
// EXTERNAL APPOINTMENTS
// ======================

export interface ExternalAppointment {
  id: string;
  tenant_id: string;
  integration_id: string;

  // External IDs
  external_id: string;
  external_source: string;

  // Linked entities
  linked_appointment_id?: string;
  linked_contact_id?: string;

  // Appointment data
  scheduled_at: string;
  ends_at?: string;
  duration_minutes?: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

  // Service info
  service_name?: string;
  service_external_id?: string;

  // Provider info
  provider_name?: string;
  provider_external_id?: string;

  // Location
  location_name?: string;
  location_external_id?: string;
  location_address?: string;

  // Contact info
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;

  // Notes
  notes?: string;
  internal_notes?: string;

  // Sync metadata
  raw_data: Record<string, unknown>;
  last_synced_at: string;
  sync_hash?: string;

  external_created_at?: string;
  external_updated_at?: string;
}

// ======================
// EXTERNAL INVENTORY
// ======================

export interface ExternalInventoryItem {
  id: string;
  tenant_id: string;
  integration_id: string;

  // External IDs
  external_id: string;
  external_source: string;

  // Item data
  sku?: string;
  name: string;
  description?: string;
  category?: string;

  // Stock levels
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point?: number;
  reorder_quantity?: number;

  // Pricing
  unit_cost?: number;
  unit_price?: number;
  price_currency: string;

  // Status
  is_active: boolean;
  is_low_stock: boolean;

  // Location
  warehouse_name?: string;
  warehouse_external_id?: string;

  // Sync metadata
  raw_data: Record<string, unknown>;
  last_synced_at: string;
  sync_hash?: string;

  external_updated_at?: string;
}

// ======================
// EXTERNAL PRODUCTS
// ======================

export interface ExternalProduct {
  id: string;
  tenant_id: string;
  integration_id: string;

  // External IDs
  external_id: string;
  external_source: string;

  // Linked entity
  linked_service_id?: string;

  // Product data
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;

  // Pricing
  price?: number;
  compare_at_price?: number;
  price_currency: string;

  // Restaurant-specific
  is_available: boolean;
  preparation_time_minutes?: number;
  calories?: number;
  allergens?: string[];

  // Images
  image_url?: string;
  image_urls?: string[];

  // Variants
  has_variants: boolean;
  variants: Array<{ name: string; price: number; sku?: string }>;
  modifiers: Array<{ name: string; options: string[]; required: boolean }>;

  // Sync metadata
  raw_data: Record<string, unknown>;
  last_synced_at: string;
  sync_hash?: string;

  external_updated_at?: string;
}

// ======================
// SYNC LOGS
// ======================

export interface IntegrationSyncLog {
  id: string;
  tenant_id: string;
  integration_id: string;

  // Sync info
  sync_type: SyncType;
  sync_direction: SyncDirection;
  sync_trigger: SyncTrigger;

  // Results
  status: SyncLogStatus;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;

  // Timing
  started_at: string;
  completed_at?: string;
  duration_ms?: number;

  // Errors
  error_message?: string;
  error_details?: Record<string, unknown>;
  failed_records?: string[];

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
}

// ======================
// INTEGRATION ACTIONS
// ======================

export interface IntegrationAction {
  id: string;
  tenant_id: string;
  integration_id: string;

  // Action definition
  action_name: string;
  action_type: 'create' | 'update' | 'delete' | 'sync' | 'notify' | 'custom';

  // Trigger
  trigger_event: string;
  trigger_conditions: Record<string, unknown>;

  // Direction
  direction: 'tistis_to_external' | 'external_to_tistis';

  // Config
  action_config: Record<string, unknown>;
  field_mapping: Record<string, string>;

  // Status
  is_enabled: boolean;

  // Stats
  executions_total: number;
  executions_success: number;
  executions_failed: number;
  last_executed_at?: string;
  last_error_message?: string;

  // Metadata
  description?: string;
  created_at: string;
  updated_at: string;
}

// ======================
// CONNECTOR DEFINITIONS
// ======================

export interface ConnectorDefinition {
  type: IntegrationType;
  name: string;
  description: string;
  icon: string;
  category: 'crm' | 'pos' | 'dental' | 'calendar' | 'medical' | 'generic';
  auth_type: AuthType;
  supports_oauth: boolean;
  oauth_url?: string;
  supports_webhook: boolean;
  supports_csv_import: boolean;
  sync_capabilities: {
    contacts: boolean;
    appointments: boolean;
    products: boolean;
    inventory: boolean;
    orders: boolean;
  };
  coming_soon?: boolean;
}

// ======================
// API RESPONSES
// ======================

export interface IntegrationsListResponse {
  connections: IntegrationConnection[];
  total: number;
}

export interface CreateIntegrationRequest {
  integration_type: IntegrationType;
  connection_name?: string;
  branch_id?: string;
  sync_direction?: SyncDirection;
  sync_contacts?: boolean;
  sync_appointments?: boolean;
  sync_products?: boolean;
  sync_inventory?: boolean;
  // Auth credentials (depends on auth_type)
  api_key?: string;
  api_secret?: string;
  external_api_base_url?: string;
}

export interface UpdateIntegrationRequest {
  connection_name?: string;
  sync_enabled?: boolean;
  sync_direction?: SyncDirection;
  sync_frequency_minutes?: number;
  sync_contacts?: boolean;
  sync_appointments?: boolean;
  sync_products?: boolean;
  sync_inventory?: boolean;
  field_mapping?: Record<string, Record<string, string>>;
}

// ======================
// EXTERNAL DATA FOR AI
// ======================

export interface TenantExternalData {
  has_integrations: boolean;
  source_systems: IntegrationType[];
  low_stock_items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    reorder_point?: number;
    category?: string;
  }>;
  external_products: Array<{
    name: string;
    price?: number;
    category?: string;
    is_available: boolean;
    preparation_time?: number;
  }>;
  external_appointments_count: number;
  last_sync_at?: string;
}

// ======================
// SOFTRESTAURANT SPECIFIC TYPES
// ======================

// ========================================
// SR DEPLOYMENT TYPES (Local vs Cloud)
// ========================================

/**
 * Soft Restaurant deployment type
 * - local: Traditional on-premise installation with SQL Server
 * - cloud: Soft Restaurant Cloud (SaaS) hosted by National Soft
 */
export type SRDeploymentType = 'local' | 'cloud';

/**
 * SR Cloud connection status
 */
export type SRCloudConnectionStatus =
  | 'pending'       // Waiting for API key configuration
  | 'validating'    // Testing API connection
  | 'connected'     // Successfully connected
  | 'error'         // Connection failed
  | 'suspended';    // Account suspended by National Soft

/**
 * Capabilities available for each deployment type
 * Based on National Soft documentation and API limitations
 */
export interface SRDeploymentCapabilities {
  deploymentType: SRDeploymentType;
  displayName: string;
  description: string;

  // Available features (true = available, false = not available)
  capabilities: {
    syncMenu: boolean;
    syncInventory: boolean;
    syncSales: boolean;
    syncTables: boolean;
    syncReservations: boolean;
    syncRecipes: boolean;
  };

  // Integration method
  integrationMethod: 'local_agent' | 'cloud_api' | 'webhook';

  // Notes about limitations
  notes: string[];

  // Supported SR versions
  supportedVersions: string[];
}

/**
 * Known SR deployment configurations
 */
export const SR_DEPLOYMENT_CAPABILITIES: Record<SRDeploymentType, SRDeploymentCapabilities> = {
  local: {
    deploymentType: 'local',
    displayName: 'Soft Restaurant Local',
    description: 'Instalación on-premise con SQL Server local',
    capabilities: {
      syncMenu: true,
      syncInventory: true,
      syncSales: true,
      syncTables: true,
      syncReservations: false,  // Not implemented yet
      syncRecipes: true,
    },
    integrationMethod: 'local_agent',
    notes: [
      'Requiere TIS TIS Local Agent instalado en el servidor',
      'Acceso directo a SQL Server con permisos de lectura',
      'Sincronización completa de datos',
      'Funciona sin conexión a internet',
    ],
    supportedVersions: ['SR 10.x', 'SR 11.x', 'SR 12.x'],
  },
  cloud: {
    deploymentType: 'cloud',
    displayName: 'Soft Restaurant Cloud',
    description: 'Versión cloud hospedada por National Soft',
    capabilities: {
      syncMenu: true,          // Via API oficial
      syncInventory: false,    // NO DISPONIBLE en SR Cloud actualmente
      syncSales: false,        // Limitado via API oficial
      syncTables: false,       // NO DISPONIBLE en SR Cloud
      syncReservations: false, // NO DISPONIBLE en SR Cloud
      syncRecipes: false,      // NO DISPONIBLE en SR Cloud
    },
    integrationMethod: 'cloud_api',
    notes: [
      'Usa API REST oficial de National Soft',
      'Solo sincronización de menú disponible actualmente',
      'Inventario NO disponible en SR Cloud',
      'Requiere licencia ERP/PMS activa',
      'Conexión a internet obligatoria',
    ],
    supportedVersions: ['SR Cloud'],
  },
};

/**
 * SR Cloud API configuration
 */
export interface SRCloudConfig {
  // API credentials
  apiKey: string;
  apiSecret?: string;

  // Account info
  accountId?: string;
  accountName?: string;

  // Endpoint configuration
  apiBaseUrl: string;  // Default: https://api.softrestaurant.com.mx

  // Connection status
  status: SRCloudConnectionStatus;
  lastValidatedAt?: string;

  // Sync configuration
  syncMenuEnabled: boolean;
  syncFrequencyMinutes: number;

  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * SR Cloud API response for menu items
 */
export interface SRCloudMenuResponse {
  success: boolean;
  data?: {
    items: SRCloudMenuItem[];
    categories: SRCloudCategory[];
    lastUpdated: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * SR Cloud menu item from API
 */
export interface SRCloudMenuItem {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  categoriaId: string;
  categoriaNombre?: string;
  activo: boolean;
  imagen?: string;
  modificadores?: SRCloudModifier[];
}

/**
 * SR Cloud category from API
 */
export interface SRCloudCategory {
  id: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  activa: boolean;
  imagen?: string;
}

/**
 * SR Cloud modifier/extra
 */
export interface SRCloudModifier {
  id: string;
  nombre: string;
  precio: number;
  obligatorio: boolean;
}

// ========================================
// WEBHOOK PAYLOAD TYPES (SR → TIS TIS)
// ========================================

/**
 * SoftRestaurant Webhook Sale Item
 * Received from SR POST webhook for individual sale items
 */
export interface SRWebhookSaleItem {
  Codigo: string;              // Product code in SR
  Descripcion: string;         // Product name
  Cantidad: number;            // Quantity sold
  Precio: number;              // Unit price
  Importe: number;             // Subtotal without tax
  Descuento?: number;          // Discount amount
  Impuestos?: Array<{          // Tax breakdown
    CodigoImpuesto: string;
    NombreImpuesto: string;
    Tasa: number;              // Tax rate %
    Importe: number;           // Tax amount
  }>;
  Modificadores?: string[];    // Modifiers applied
  Notas?: string;              // Special instructions
  Timestamp?: string;          // Item created timestamp
  CodigoMesero?: string;       // Waiter/server code
}

/**
 * SoftRestaurant Webhook Payment
 * Received from SR POST webhook for payment information
 */
export interface SRWebhookPayment {
  FormaPago: string;           // Payment method (Efectivo, Tarjeta, etc.)
  Monto: number;               // Payment amount
  Moneda?: string;             // Currency (MXN, USD, etc.)
  Referencia?: string;         // Payment reference/authorization
  NumeroTarjeta?: string;      // Last 4 digits of card (if card payment)
  Propina?: number;            // Tip amount
  Timestamp?: string;          // Payment timestamp
}

/**
 * SoftRestaurant Webhook Sale
 * Main payload received from SR POST webhook
 */
export interface SRWebhookSale {
  // Sale identification
  FolioVenta: string;          // Sale/Ticket number (REQUIRED)
  CodigoTienda?: string;       // Store/branch code in SR

  // Customer info
  CodigoCliente?: string;      // Customer code in SR
  NombreCliente?: string;      // Customer name

  // Server/Waiter
  CodigoMesero?: string;       // Waiter code in SR
  NombreMesero?: string;       // Waiter name

  // Table info
  NumeroMesa?: string;         // Table number

  // Timing
  FechaApertura: string;       // Sale opened date (ISO 8601)
  FechaCierre?: string;        // Sale closed date (ISO 8601)

  // Sale items (REQUIRED)
  Productos: SRWebhookSaleItem[];

  // Totals (REQUIRED)
  SubtotalSinImpuestos: number; // Subtotal before tax
  TotalImpuestos: number;       // Total tax amount
  TotalDescuentos?: number;     // Total discounts
  TotalPropinas?: number;       // Total tips
  Total: number;                // Grand total
  Moneda?: string;              // Currency (default: MXN)

  // Payment info
  Pagos?: SRWebhookPayment[];   // Payment breakdown

  // Sale type
  TipoVenta?: string;           // Sale type (Mesa, Para Llevar, Domicilio)

  // Additional metadata
  NumeroComensales?: number;    // Guest count
  Observaciones?: string;       // General notes
  Metadata?: Record<string, unknown>; // Additional custom fields
}

/**
 * SoftRestaurant Recipe Ingredient with gramaje (weight/portion)
 * Maps to SR's "explosión de insumos" feature
 */
export interface SRRecipeIngredient {
  id: string;
  name: string;
  quantity: number;        // Amount needed
  unit: string;            // g, kg, ml, L, pz, etc.
  unit_cost: number;       // Cost per unit
  total_cost: number;      // quantity * unit_cost
  category?: string;       // Ingredient category
  sku?: string;            // External SKU
  is_primary: boolean;     // Main ingredient flag
  waste_percentage?: number; // Merma %
}

/**
 * SoftRestaurant Product/Menu Item with full recipe
 */
export interface SRMenuItem {
  id: string;
  external_id: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;

  // Pricing
  price: number;
  cost: number;            // Calculated from recipe
  profit_margin: number;   // (price - cost) / price * 100
  currency: string;

  // Recipe with gramaje
  has_recipe: boolean;
  recipe_yield: number;    // Portions per recipe
  recipe_yield_unit: string;
  ingredients: SRRecipeIngredient[];
  total_recipe_cost: number;
  cost_per_portion: number;

  // Attributes
  is_available: boolean;
  preparation_time_minutes?: number;
  calories?: number;
  allergens?: string[];

  // Modifiers (extras, sizes)
  modifiers: Array<{
    name: string;
    options: Array<{
      name: string;
      price_adjustment: number;
    }>;
    required: boolean;
    max_selections?: number;
  }>;

  // Images
  image_url?: string;

  // Metadata
  display_order: number;
  is_featured: boolean;
  tags?: string[];
}

/**
 * SoftRestaurant Table for floor plan sync
 */
export interface SRTable {
  id: string;
  external_id: string;
  table_number: string;
  name?: string;
  zone: string;            // Terraza, Interior, Barra, etc.
  capacity: number;
  min_capacity?: number;

  // Position for floor plan
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  shape?: 'square' | 'round' | 'rectangle';
  rotation?: number;

  // Status (from SR)
  status: 'available' | 'occupied' | 'reserved' | 'blocked';
  current_ticket_id?: string;
  current_ticket_total?: number;
  occupied_since?: string;

  // Features
  features: string[];      // window, outdoor, booth, etc.
  is_active: boolean;
}

/**
 * SoftRestaurant Reservation sync
 */
export interface SRReservation {
  id: string;
  external_id: string;

  // Guest info
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  party_size: number;

  // Timing
  scheduled_at: string;
  duration_minutes: number;

  // Table assignment
  table_id?: string;
  table_number?: string;
  zone?: string;

  // Status
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  confirmation_code?: string;

  // Notes
  special_requests?: string;
  internal_notes?: string;

  // Source
  source: 'sr_direct' | 'sr_online' | 'tistis' | 'phone' | 'walkin';
}

/**
 * SoftRestaurant Inventory Item with stock levels
 */
export interface SRInventoryItem {
  id: string;
  external_id: string;
  sku?: string;
  name: string;
  description?: string;
  category: string;

  // Stock
  quantity_on_hand: number;
  unit: string;
  minimum_stock: number;
  maximum_stock?: number;
  reorder_point: number;
  reorder_quantity?: number;

  // Cost
  unit_cost: number;
  total_value: number;     // quantity * unit_cost
  currency: string;

  // Status
  is_low_stock: boolean;
  is_critical: boolean;    // Below 25% of minimum
  last_purchase_date?: string;
  last_purchase_cost?: number;

  // Supplier
  preferred_supplier_id?: string;
  preferred_supplier_name?: string;

  // Storage
  storage_type: 'dry' | 'refrigerated' | 'frozen';
  expiration_tracking: boolean;
  default_shelf_life_days?: number;
}

/**
 * SoftRestaurant Sale/Order for analytics
 */
export interface SRSale {
  id: string;
  external_id: string;
  ticket_number: string;

  // Table info
  table_id?: string;
  table_number?: string;

  // Timing
  opened_at: string;
  closed_at?: string;
  duration_minutes?: number;

  // Totals
  subtotal: number;
  tax: number;
  tip?: number;
  discount?: number;
  total: number;
  currency: string;

  // Payment
  payment_method?: string;
  is_paid: boolean;

  // Items
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    modifiers?: string[];
    subtotal: number;
  }>;

  // Staff
  server_id?: string;
  server_name?: string;

  // Guest count
  guest_count: number;
  per_person_average: number;

  // Metadata
  source: 'dine_in' | 'takeout' | 'delivery';
  delivery_platform?: string; // Rappi, Uber Eats, etc.
}

/**
 * SoftRestaurant sync configuration
 */
export interface SRSyncConfig {
  // What to sync
  sync_menu: boolean;
  sync_recipes: boolean;      // Include gramaje/ingredients
  sync_inventory: boolean;
  sync_tables: boolean;
  sync_reservations: boolean;
  sync_sales: boolean;

  // Direction
  menu_direction: 'sr_to_tistis' | 'tistis_to_sr' | 'bidirectional';
  inventory_direction: 'sr_to_tistis' | 'tistis_to_sr' | 'bidirectional';
  reservations_direction: 'sr_to_tistis' | 'tistis_to_sr' | 'bidirectional';

  // Frequency
  sync_frequency_minutes: number;

  // Filters
  include_inactive_products: boolean;
  sales_history_days: number;  // How many days of sales to sync

  // Mapping
  default_branch_id?: string;
  category_mapping: Record<string, string>;  // SR category -> TIS TIS category

  // Features
  auto_create_categories: boolean;
  auto_update_prices: boolean;
  alert_on_low_stock: boolean;
  alert_on_price_change: boolean;
}

// ======================
// SOFT RESTAURANT LOCAL AGENT TYPES
// TIS TIS Local Agent for Soft Restaurant Integration
// ======================

/**
 * Integration method for Soft Restaurant
 * - webhook_official: Uses National Soft's ERP/PMS module (requires purchase)
 * - local_agent: Uses TIS TIS Local Agent installed on customer's server
 */
export type SRIntegrationMethod = 'webhook_official' | 'local_agent';

/**
 * Agent instance status lifecycle
 */
export type AgentStatus =
  | 'pending'      // Waiting for installation
  | 'registered'   // Agent registered, not yet connected
  | 'connected'    // Connected and healthy
  | 'syncing'      // Currently synchronizing data
  | 'error'        // Connection or sync error
  | 'offline';     // No heartbeat received

/**
 * Agent instance representing a local TIS TIS Agent for SR
 */
export interface AgentInstance {
  id: string;
  tenant_id: string;
  integration_id: string;
  branch_id?: string;

  // Agent identification
  agent_id: string;              // Unique hash identifier
  agent_version: string;         // e.g., "1.0.0"
  machine_name?: string;         // Windows hostname

  // Status
  status: AgentStatus;

  // Soft Restaurant connection info
  sr_version?: string;           // e.g., "Soft Restaurant 10.5.2"
  sr_database_name?: string;     // e.g., "DVSOFT_RESTAURANTE"
  sr_sql_instance?: string;      // e.g., "SQLEXPRESS"
  sr_empresa_id?: string;        // SR company ID

  // Multi-branch filtering
  store_code?: string;           // CodigoTienda/Almacen for multi-branch SQL filtering

  // Sync configuration
  sync_interval_seconds: number;
  sync_menu: boolean;
  sync_inventory: boolean;
  sync_sales: boolean;
  sync_tables: boolean;

  // Statistics
  last_heartbeat_at?: string;
  last_sync_at?: string;
  last_sync_records: number;
  total_records_synced: number;
  consecutive_errors: number;
  last_error_message?: string;
  last_error_at?: string;

  // Security
  token_expires_at?: string;
  allowed_ips?: string[];

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Agent credentials generated during setup
 * Only shown once to the user, then must be stored securely
 */
export interface AgentCredentials {
  agent_id: string;
  auth_token: string;           // Bearer token for API authentication
  webhook_url: string;          // TIS TIS sync endpoint
  expires_at: string;           // Token expiration
}

/**
 * Agent registration request from Windows Agent
 */
export interface AgentRegistrationRequest {
  agent_id: string;
  agent_version: string;
  machine_name: string;
  sr_version?: string;
  sr_database_name?: string;
  sr_sql_instance?: string;
  sr_empresa_id?: string;
}

/**
 * Agent heartbeat request
 */
export interface AgentHeartbeatRequest {
  agent_id: string;
  status: 'healthy' | 'degraded' | 'error';
  last_sync_at?: string;
  records_since_last_heartbeat: number;
  cpu_usage?: number;
  memory_usage?: number;
  error_message?: string;
}

/**
 * Agent sync batch request
 */
export interface AgentSyncRequest {
  agent_id: string;
  sync_type: 'sales' | 'menu' | 'inventory' | 'tables' | 'full';
  batch_id: string;
  batch_number: number;
  total_batches: number;
  records: unknown[];           // Transformed SR data
  sync_started_at: string;
  last_record_id?: string;      // For incremental sync
}

/**
 * Installer download configuration
 * Contains pre-configured credentials embedded in the MSI
 */
export interface AgentInstallerConfig {
  tenant_id: string;
  integration_id: string;
  agent_id: string;
  auth_token: string;
  api_base_url: string;
  sync_config: {
    sync_menu: boolean;
    sync_inventory: boolean;
    sync_sales: boolean;
    sync_tables: boolean;
    sync_interval_seconds: number;
  };
  download_url: string;
  filename: string;
  file_size_bytes: number;
  generated_at: string;
  expires_at: string;
}

/**
 * Extended SR sync config for Local Agent
 */
export interface SRAgentSyncConfig extends SRSyncConfig {
  // Integration method
  integration_method: SRIntegrationMethod;

  // Agent-specific settings (only used when integration_method === 'local_agent')
  agent_sync_interval_seconds: number;
  agent_batch_size: number;
  agent_retry_attempts: number;
  agent_retry_delay_seconds: number;

  // Data selection for agent
  agent_sync_modified_only: boolean;    // Only sync modified records
  agent_full_sync_interval_hours: number; // Force full sync every N hours
}
