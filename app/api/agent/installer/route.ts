// =====================================================
// TIS TIS PLATFORM - Agent Installer Generator Endpoint
// POST /api/agent/installer
// Generates installer with pre-configured credentials
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedContext, isAuthError, createAuthErrorResponse } from '@/src/shared/lib/auth-helper';
import { getAgentManagerService } from '@/src/features/integrations';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// ======================
// UUID VALIDATION
// ======================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// ======================
// TYPES
// ======================

interface InstallerRequestBody {
  integration_id: string;
  branch_id?: string;
  store_code?: string;  // SR CodigoTienda for multi-branch SQL filtering
  sync_menu: boolean;
  sync_inventory: boolean;
  sync_sales: boolean;
  sync_tables: boolean;
  sync_interval_seconds?: number;
}

// ======================
// VALIDATION
// ======================

function validateBody(body: unknown): { valid: boolean; error?: string; data?: InstallerRequestBody } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const data = body as Record<string, unknown>;

  if (!data.integration_id || typeof data.integration_id !== 'string') {
    return { valid: false, error: 'integration_id is required' };
  }

  if (!isValidUUID(data.integration_id)) {
    return { valid: false, error: 'integration_id must be a valid UUID' };
  }

  if (data.branch_id && typeof data.branch_id === 'string' && !isValidUUID(data.branch_id)) {
    return { valid: false, error: 'branch_id must be a valid UUID' };
  }

  // Validate store_code format if provided (alphanumeric, underscores, hyphens only)
  let storeCode: string | undefined;
  if (data.store_code && typeof data.store_code === 'string') {
    const trimmed = data.store_code.trim();
    if (trimmed.length > 50) {
      return { valid: false, error: 'store_code must be 50 characters or less' };
    }
    if (!/^[a-zA-Z0-9_-]*$/.test(trimmed)) {
      return { valid: false, error: 'store_code can only contain letters, numbers, underscores, and hyphens' };
    }
    storeCode = trimmed || undefined;
  }

  // At least one sync option must be enabled
  const syncMenu = data.sync_menu === true;
  const syncInventory = data.sync_inventory === true;
  const syncSales = data.sync_sales === true;
  const syncTables = data.sync_tables === true;

  if (!syncMenu && !syncInventory && !syncSales && !syncTables) {
    return { valid: false, error: 'At least one sync option must be enabled' };
  }

  // Validate sync interval if provided
  const syncInterval = data.sync_interval_seconds as number | undefined;
  if (syncInterval !== undefined) {
    if (typeof syncInterval !== 'number' || syncInterval < 60 || syncInterval > 86400) {
      return { valid: false, error: 'sync_interval_seconds must be between 60 and 86400' };
    }
  }

  return {
    valid: true,
    data: {
      integration_id: data.integration_id as string,
      branch_id: data.branch_id as string | undefined,
      store_code: storeCode,  // For multi-branch SQL filtering
      sync_menu: syncMenu,
      sync_inventory: syncInventory,
      sync_sales: syncSales,
      sync_tables: syncTables,
      sync_interval_seconds: syncInterval,
    },
  };
}

// ======================
// POST - Generate Installer
// ======================

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedContext(request);

    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    const { tenantId, role } = authResult;

    // Only owners and admins can generate installers
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can generate agent installers' },
        { status: 403 }
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', errorCode: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Validate body
    const validation = validateBody(body);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error, errorCode: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { integration_id, branch_id, store_code, ...syncConfig } = validation.data;

    // Verify integration exists and belongs to tenant
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: integration, error: integrationError } = await supabase
      .from('integration_connections')
      .select('id, integration_type, status')
      .eq('id', integration_id)
      .eq('tenant_id', tenantId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found', errorCode: 'INTEGRATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify it's a Soft Restaurant integration
    if (integration.integration_type !== 'softrestaurant') {
      return NextResponse.json(
        { error: 'Local agent is only available for Soft Restaurant integrations', errorCode: 'INVALID_INTEGRATION_TYPE' },
        { status: 400 }
      );
    }

    // Verify branch exists if provided
    if (branch_id) {
      const { data: branch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('tenant_id', tenantId)
        .single();

      if (branchError || !branch) {
        return NextResponse.json(
          { error: 'Branch not found', errorCode: 'BRANCH_NOT_FOUND' },
          { status: 404 }
        );
      }
    }

    // Check if an agent already exists for this integration
    const { data: existingAgent } = await supabase
      .from('agent_instances')
      .select('id, agent_id, status')
      .eq('integration_id', integration_id)
      .eq('tenant_id', tenantId)
      .single();

    if (existingAgent && existingAgent.status !== 'offline') {
      return NextResponse.json(
        {
          error: 'An active agent already exists for this integration',
          errorCode: 'AGENT_EXISTS',
          existing_agent_id: existingAgent.agent_id,
        },
        { status: 409 }
      );
    }

    // Delete existing offline agent if present
    if (existingAgent) {
      await supabase
        .from('agent_instances')
        .delete()
        .eq('id', existingAgent.id);
    }

    // Create new agent
    const agentService = getAgentManagerService();
    const createResult = await agentService.createAgent({
      tenantId,
      integrationId: integration_id,
      branchId: branch_id,
      storeCode: store_code,  // For multi-branch SQL filtering
      syncMenu: syncConfig.sync_menu,
      syncInventory: syncConfig.sync_inventory,
      syncSales: syncConfig.sync_sales,
      syncTables: syncConfig.sync_tables,
      syncIntervalSeconds: syncConfig.sync_interval_seconds,
    });

    if (!createResult.success || !createResult.credentials) {
      return NextResponse.json(
        {
          error: createResult.error || 'Failed to create agent',
          errorCode: createResult.errorCode || 'CREATION_FAILED',
        },
        { status: 500 }
      );
    }

    // Update integration metadata to indicate local_agent method
    await supabase
      .from('integration_connections')
      .update({
        metadata: {
          integration_method: 'local_agent',
          agent_id: createResult.credentials.agent_id,
          agent_sync_interval_seconds: syncConfig.sync_interval_seconds || 300,
        },
      })
      .eq('id', integration_id);

    // Generate download URL (placeholder - would be actual MSI download in production)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';
    const downloadUrl = `${baseUrl}/downloads/TIS-TIS-Agent-SR-${createResult.credentials.agent_id.slice(-8)}.msi`;

    // Return credentials and download info
    return NextResponse.json({
      success: true,
      agent_id: createResult.credentials.agent_id,
      auth_token: createResult.credentials.auth_token, // Shown only once!
      webhook_url: createResult.credentials.webhook_url,
      expires_at: createResult.credentials.expires_at,
      download_url: downloadUrl,
      filename: `TIS-TIS-Agent-SR-${createResult.credentials.agent_id.slice(-8)}.msi`,
      instructions: {
        step1: 'Descarga e instala el archivo MSI en el servidor donde está Soft Restaurant',
        step2: 'Durante la instalación, ingresa el token de autenticación que se muestra arriba',
        step3: 'El agente se conectará automáticamente y comenzará a sincronizar datos',
        step4: 'Puedes monitorear el estado del agente desde el dashboard de TIS TIS',
      },
      warning: 'El token de autenticación solo se muestra una vez. Guárdalo de forma segura.',
    });

  } catch (error) {
    console.error('[Agent Installer] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
