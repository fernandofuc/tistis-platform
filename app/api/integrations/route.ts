// =====================================================
// TIS TIS PLATFORM - Integrations API Route
// CRUD operations for integration connections
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { SAFE_INTEGRATION_FIELDS } from '@/src/features/integrations/constants/api-fields';

// ======================
// GET - List integrations
// ======================
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions - only owner/admin can manage integrations
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can access integrations' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const integrationType = searchParams.get('type');
    const branchId = searchParams.get('branch_id');

    // Validate branch_id if provided
    if (branchId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(branchId)) {
        return NextResponse.json(
          { error: 'Invalid branch_id format' },
          { status: 400 }
        );
      }
    }

    // Build query - Use SAFE_INTEGRATION_FIELDS to exclude sensitive credentials
    let query = supabase
      .from('integration_connections')
      .select(SAFE_INTEGRATION_FIELDS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (integrationType) {
      query = query.eq('integration_type', integrationType);
    }
    // Filter by branch - if branch_id provided, show only that branch's integrations
    // If not provided, show all integrations (tenant-wide view)
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Integrations API] Error fetching integrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      connections: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('[Integrations API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create integration
// ======================
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { client: supabase, tenantId, role } = authResult;

    // Check permissions
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only administrators can create integrations' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const {
      integration_type,
      connection_name,
      branch_id,
      sync_direction = 'inbound',
      sync_contacts = true,
      sync_appointments = true,
      sync_products = false,
      sync_inventory = false,
      sync_orders = false,
      sync_frequency_minutes = 60,
      // Auth credentials (optional, depends on auth_type)
      api_key,
      api_secret,
      external_api_base_url,
      // Metadata (for sync_config and other custom settings)
      metadata = {},
    } = body;

    if (!integration_type) {
      return NextResponse.json(
        { error: 'integration_type is required' },
        { status: 400 }
      );
    }

    // Validate sync_direction
    const VALID_DIRECTIONS = ['inbound', 'outbound', 'bidirectional'];
    if (!VALID_DIRECTIONS.includes(sync_direction)) {
      return NextResponse.json(
        { error: 'Invalid sync_direction. Must be: inbound, outbound, or bidirectional' },
        { status: 400 }
      );
    }

    // Validate boolean fields
    const booleanFields = { sync_contacts, sync_appointments, sync_products, sync_inventory, sync_orders };
    for (const [field, value] of Object.entries(booleanFields)) {
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json(
          { error: `${field} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Validate sync_frequency_minutes
    if (sync_frequency_minutes !== undefined) {
      const freq = Number(sync_frequency_minutes);
      if (isNaN(freq) || freq < 5 || freq > 1440) {
        return NextResponse.json(
          { error: 'sync_frequency_minutes must be between 5 and 1440' },
          { status: 400 }
        );
      }
    }

    // Validate metadata is an object (if provided)
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return NextResponse.json(
          { error: 'metadata must be an object' },
          { status: 400 }
        );
      }
    }

    // Validate integration type
    // NOTE: 'softrestaurant' is the main type used by IntegrationHub
    // 'softrestaurant_import' is kept for legacy compatibility
    // 'dentalink' added for dental vertical in Latin America
    const VALID_TYPES = [
      'hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'freshsales',
      'dentrix', 'open_dental', 'eaglesoft', 'curve_dental', 'dentalink',
      'square', 'toast', 'clover', 'lightspeed', 'softrestaurant', 'softrestaurant_import',
      'google_calendar', 'calendly', 'acuity',
      'epic', 'cerner', 'athenahealth',
      'webhook_incoming', 'csv_import', 'api_custom',
    ];

    if (!VALID_TYPES.includes(integration_type)) {
      return NextResponse.json(
        { error: 'Invalid integration_type' },
        { status: 400 }
      );
    }

    // Validate branch_id belongs to tenant (if provided)
    let validatedBranchId: string | null = null;
    if (branch_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(branch_id)) {
        return NextResponse.json(
          { error: 'Invalid branch_id format' },
          { status: 400 }
        );
      }

      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('tenant_id', tenantId)
        .single();

      if (branchError || !branch) {
        return NextResponse.json(
          { error: 'Branch not found or does not belong to this tenant' },
          { status: 400 }
        );
      }

      validatedBranchId = branch_id;
    }

    // Determine auth type based on integration type
    const AUTH_TYPES: Record<string, string> = {
      hubspot: 'oauth2',
      salesforce: 'oauth2',
      zoho_crm: 'oauth2',
      pipedrive: 'oauth2',
      freshsales: 'oauth2',
      square: 'oauth2',
      toast: 'oauth2',
      clover: 'oauth2',
      google_calendar: 'oauth2',
      calendly: 'oauth2',
      acuity: 'oauth2',
      dentrix: 'api_key',
      open_dental: 'api_key',
      eaglesoft: 'api_key',
      curve_dental: 'api_key',
      dentalink: 'api_key',
      softrestaurant: 'api_key',
      softrestaurant_import: 'api_key',
      lightspeed: 'api_key',
      webhook_incoming: 'webhook_secret',
      csv_import: 'api_key',
      api_custom: 'api_key',
    };

    const authType = AUTH_TYPES[integration_type] || 'api_key';

    // Validate external_api_base_url format if provided
    if (external_api_base_url) {
      try {
        const url = new URL(external_api_base_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return NextResponse.json(
            { error: 'external_api_base_url must use http or https protocol' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'external_api_base_url must be a valid URL' },
          { status: 400 }
        );
      }
    }

    // Generate webhook URL and secret for incoming webhook type
    let webhookUrl: string | undefined;
    let webhookSecret: string | undefined;
    if (integration_type === 'webhook_incoming') {
      const webhookId = crypto.randomUUID().slice(0, 8);
      webhookUrl = `/api/integrations/webhook/${tenantId}/${webhookId}`;
      // Generate secure webhook secret for HMAC validation
      webhookSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }

    // Create the integration connection
    const { data, error } = await supabase
      .from('integration_connections')
      .insert({
        tenant_id: tenantId,
        branch_id: validatedBranchId,
        integration_type,
        status: api_key ? 'connected' : 'configuring', // If API key provided, mark as connected
        auth_type: authType,
        connection_name: connection_name || integration_type,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        // Auth credentials
        api_key: api_key || null,
        api_secret: api_secret || null,
        external_api_base_url: external_api_base_url || null,
        // Sync configuration
        sync_enabled: !!api_key, // Enable sync if credentials provided
        sync_direction,
        sync_frequency_minutes: Math.max(5, Math.min(1440, Number(sync_frequency_minutes))), // Clamp between 5 and 1440
        sync_contacts,
        sync_appointments,
        sync_products,
        sync_inventory,
        sync_orders,
        field_mapping: {},
        records_synced_total: 0,
        records_synced_today: 0,
        error_count: 0,
        consecutive_errors: 0,
        // Store metadata (e.g., sync_config for SoftRestaurant)
        metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      })
      .select(SAFE_INTEGRATION_FIELDS)
      .single();

    if (error) {
      console.error('[Integrations API] Error creating integration:', error);

      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'An integration of this type already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create integration' },
        { status: 500 }
      );
    }

    console.log('[Integrations API] Integration created:', data.id, integration_type);

    // For webhook_incoming, include the webhook_secret in the response
    // This is the ONLY time it will be shown to the user
    const responseData = {
      ...data,
      // Only include webhook_secret for webhook_incoming type on creation
      ...(integration_type === 'webhook_incoming' && webhookSecret
        ? { webhook_secret: webhookSecret }
        : {}),
    };

    return NextResponse.json({ connection: responseData }, { status: 201 });
  } catch (error) {
    console.error('[Integrations API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
