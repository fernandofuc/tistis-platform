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
  // POS Systems
  | 'square'
  | 'toast'
  | 'clover'
  | 'lightspeed'
  | 'softrestaurant_import'
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
