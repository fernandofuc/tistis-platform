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

    // Build query
    let query = supabase
      .from('integration_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (integrationType) {
      query = query.eq('integration_type', integrationType);
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
    const booleanFields = { sync_contacts, sync_appointments, sync_products, sync_inventory };
    for (const [field, value] of Object.entries(booleanFields)) {
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json(
          { error: `${field} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Validate integration type
    const VALID_TYPES = [
      'hubspot', 'salesforce', 'zoho_crm', 'pipedrive', 'freshsales',
      'dentrix', 'open_dental', 'eaglesoft', 'curve_dental',
      'square', 'toast', 'clover', 'lightspeed', 'softrestaurant_import',
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
      dentrix: 'api_key',
      open_dental: 'api_key',
      eaglesoft: 'api_key',
      curve_dental: 'api_key',
      webhook_incoming: 'webhook_secret',
      csv_import: 'api_key',
      api_custom: 'api_key',
    };

    const authType = AUTH_TYPES[integration_type] || 'api_key';

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
        status: 'configuring',
        auth_type: authType,
        connection_name: connection_name || integration_type,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        sync_enabled: false,
        sync_direction,
        sync_frequency_minutes: 60,
        sync_contacts,
        sync_appointments,
        sync_products,
        sync_inventory,
        sync_orders: false,
        field_mapping: {},
        records_synced_total: 0,
        records_synced_today: 0,
        error_count: 0,
        consecutive_errors: 0,
        metadata: {},
      })
      .select()
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

    return NextResponse.json({ connection: data }, { status: 201 });
  } catch (error) {
    console.error('[Integrations API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
