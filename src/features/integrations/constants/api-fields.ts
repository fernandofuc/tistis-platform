// =====================================================
// TIS TIS PLATFORM - Integration API Field Constants
// Centralized definition of safe fields for API responses
// =====================================================

/**
 * SECURITY: Safe fields to return in API responses
 *
 * NEVER include these sensitive fields:
 * - api_key
 * - api_secret
 * - access_token
 * - refresh_token
 * - webhook_secret
 * - db_connection_string
 * - db_query_template
 *
 * These fields contain credentials that should NEVER be exposed
 * to the frontend or in API responses.
 */
export const SAFE_INTEGRATION_FIELDS = `
  id,
  tenant_id,
  branch_id,
  integration_type,
  status,
  auth_type,
  connection_name,
  webhook_url,
  external_account_id,
  external_account_name,
  external_api_base_url,
  sync_enabled,
  sync_direction,
  sync_frequency_minutes,
  sync_contacts,
  sync_appointments,
  sync_products,
  sync_inventory,
  sync_orders,
  field_mapping,
  records_synced_total,
  records_synced_today,
  last_sync_at,
  next_sync_at,
  last_error_at,
  last_error_message,
  error_count,
  consecutive_errors,
  token_expires_at,
  connected_at,
  created_at,
  updated_at,
  metadata
`;

/**
 * List of sensitive credential fields that must NEVER be exposed
 */
export const SENSITIVE_CREDENTIAL_FIELDS = [
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'webhook_secret',
  'db_connection_string',
  'db_query_template',
] as const;
