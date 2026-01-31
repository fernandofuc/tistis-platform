// =====================================================
// TIS TIS PLATFORM - Agent Sync Endpoint
// POST /api/agent/sync
// Receives sync data from TIS TIS Local Agent
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAgentManagerService, AGENT_ERROR_CODES } from '@/src/features/integrations';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  rateLimitExceeded,
  type RateLimitConfig,
} from '@/src/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';

// ======================
// SUPABASE CLIENT
// ======================

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// ======================
// RATE LIMITING CONFIG
// ======================

/** Agent sync: 1000 per minute per agent (high throughput) */
const agentSyncLimiter: RateLimitConfig = {
  limit: 1000,
  windowSeconds: 60, // 1 minute
  identifier: 'agent-sync',
};

// ======================
// TYPES
// ======================

interface SyncRequestBody {
  agent_id: string;
  auth_token: string;
  sync_type: 'menu' | 'inventory' | 'sales' | 'tables' | 'full';
  batch_id: string;
  batch_number: number;
  total_batches: number;
  records: unknown[];
  sync_started_at: string;
  last_record_id?: string;
}

interface ProcessResult {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ======================
// VALIDATION
// ======================

function validateBody(body: unknown): { valid: boolean; error?: string; data?: SyncRequestBody } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const data = body as Record<string, unknown>;

  if (!data.agent_id || typeof data.agent_id !== 'string') {
    return { valid: false, error: 'agent_id is required' };
  }

  if (!data.auth_token || typeof data.auth_token !== 'string') {
    return { valid: false, error: 'auth_token is required' };
  }

  const validSyncTypes = ['menu', 'inventory', 'sales', 'tables', 'full'];
  if (!data.sync_type || !validSyncTypes.includes(data.sync_type as string)) {
    return { valid: false, error: `sync_type must be one of: ${validSyncTypes.join(', ')}` };
  }

  if (!data.batch_id || typeof data.batch_id !== 'string') {
    return { valid: false, error: 'batch_id is required' };
  }

  if (typeof data.batch_number !== 'number' || data.batch_number < 1) {
    return { valid: false, error: 'batch_number must be a positive integer' };
  }

  if (typeof data.total_batches !== 'number' || data.total_batches < 1) {
    return { valid: false, error: 'total_batches must be a positive integer' };
  }

  // Validate batch_number is within valid range
  if ((data.batch_number as number) > (data.total_batches as number)) {
    return { valid: false, error: 'batch_number cannot exceed total_batches' };
  }

  if (!Array.isArray(data.records)) {
    return { valid: false, error: 'records must be an array' };
  }

  return {
    valid: true,
    data: {
      agent_id: data.agent_id as string,
      auth_token: data.auth_token as string,
      sync_type: data.sync_type as 'menu' | 'inventory' | 'sales' | 'tables' | 'full',
      batch_id: data.batch_id as string,
      batch_number: data.batch_number as number,
      total_batches: data.total_batches as number,
      records: data.records as unknown[],
      sync_started_at: (data.sync_started_at as string) || new Date().toISOString(),
      last_record_id: data.last_record_id as string | undefined,
    },
  };
}

// ======================
// PROCESSORS
// ======================

/**
 * Process sales sync from Soft Restaurant agent.
 * IMPORTANT: branch_id is REQUIRED because sr_sales.branch_id is NOT NULL.
 * Multi-branch filtering is done by the agent using store_code.
 *
 * OPTIMIZED: Uses batch queries to avoid N+1 problem.
 * - First: Extract all folio_venta from records
 * - Then: Single query to find existing folios
 * - Finally: Batch upsert for new sales
 */
async function processSalesSync(
  tenantId: string,
  integrationId: string,
  branchId: string,  // Required - sr_sales.branch_id is NOT NULL
  records: unknown[]
): Promise<ProcessResult> {
  const supabase = getServiceClient();
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // STEP 1: Extract and validate all folios from records
  const salesWithFolio: Array<{ folio: string; record: Record<string, unknown> }> = [];

  for (const record of records) {
    const sale = record as Record<string, unknown>;
    const folioVenta = (sale.FolioVenta as string) || (sale.folio_venta as string) || (sale.NumeroOrden as string);

    if (!folioVenta || typeof folioVenta !== 'string' || folioVenta.trim() === '') {
      result.skipped++;
      continue;
    }

    salesWithFolio.push({ folio: folioVenta.trim(), record: sale });
  }

  if (salesWithFolio.length === 0) {
    return result;  // Nothing to process
  }

  // STEP 2: Batch query to find existing folios (single DB call instead of N calls)
  const folios = salesWithFolio.map(s => s.folio);
  const { data: existingSales, error: queryError } = await supabase
    .from('sr_sales')
    .select('folio_venta')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .in('folio_venta', folios);

  if (queryError) {
    result.failed = salesWithFolio.length;
    result.errors.push(`Batch query error: ${queryError.message}`);
    return result;
  }

  // Create Set for O(1) lookup of existing folios
  const existingFolios = new Set((existingSales || []).map(s => s.folio_venta));

  // STEP 3: Filter out existing sales and prepare batch insert
  const newSales = salesWithFolio.filter(s => !existingFolios.has(s.folio));
  const existingCount = salesWithFolio.length - newSales.length;

  result.skipped += existingCount;
  result.processed += existingCount;

  if (newSales.length === 0) {
    return result;  // All sales already exist
  }

  // STEP 4: Batch insert new sales (single DB call)
  const syncedAt = new Date().toISOString();
  const insertData = newSales.map(({ folio, record: sale }) => ({
    tenant_id: tenantId,
    branch_id: branchId,  // Required - NOT NULL constraint
    integration_id: integrationId,
    folio_venta: folio,
    opened_at: (sale.FechaApertura as string) || (sale.fecha_apertura as string) || syncedAt,
    closed_at: (sale.FechaCierre as string) || (sale.fecha_cierre as string) || syncedAt,
    status: 'pending',
    raw_payload: sale,
    metadata: {
      source: 'local_agent',
      synced_at: syncedAt,
    },
  }));

  // Batch insert with error handling per-record using upsert
  const { error: insertError, data: insertedData } = await supabase
    .from('sr_sales')
    .insert(insertData)
    .select('id');

  if (insertError) {
    // If batch insert fails, try individual inserts as fallback
    console.error('[Sales Sync] Batch insert failed, falling back to individual:', insertError.message);

    for (const saleData of insertData) {
      try {
        const { error: singleError } = await supabase
          .from('sr_sales')
          .insert(saleData);

        if (singleError) {
          result.failed++;
          result.errors.push(`Error inserting sale ${saleData.folio_venta}: ${singleError.message}`);
        } else {
          result.created++;
        }
        result.processed++;
      } catch (err) {
        result.failed++;
        result.processed++;
        result.errors.push(err instanceof Error ? err.message : 'Unknown error in fallback insert');
      }
    }
  } else {
    // Batch insert succeeded
    result.created = insertedData?.length || insertData.length;
    result.processed += result.created;
  }

  return result;
}

async function processMenuSync(
  tenantId: string,
  integrationId: string,
  records: unknown[]
): Promise<ProcessResult> {
  const supabase = getServiceClient();
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const item = record as Record<string, unknown>;
      const externalId = (item.Codigo as string) || (item.codigo as string);

      if (!externalId) {
        result.skipped++;
        continue;
      }

      // Check if product exists
      const { data: existing } = await supabase
        .from('external_products')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_id', integrationId)
        .eq('external_id', externalId)
        .maybeSingle();

      const productData = {
        name: (item.Descripcion as string) || (item.descripcion as string) || 'Sin nombre',
        unit_price: (item.Precio as number) || (item.precio as number) || 0,
        category: (item.Categoria as string) || (item.categoria as string) || null,
        is_available: item.Activo !== false && item.activo !== false,
        raw_data: item,
        last_synced_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing
        const existingRecord = existing as { id: string };
        const { error } = await supabase
          .from('external_products')
          .update(productData)
          .eq('id', existingRecord.id);

        if (error) {
          result.failed++;
          result.errors.push(`Error updating product ${externalId}: ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('external_products')
          .insert({
            tenant_id: tenantId,
            integration_id: integrationId,
            external_id: externalId,
            external_source: 'softrestaurant_agent',
            ...productData,
          });

        if (error) {
          result.failed++;
          result.errors.push(`Error creating product ${externalId}: ${error.message}`);
        } else {
          result.created++;
        }
      }

      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push(err instanceof Error ? err.message : 'Unknown error processing menu item');
    }
  }

  return result;
}

async function processInventorySync(
  tenantId: string,
  integrationId: string,
  records: unknown[]
): Promise<ProcessResult> {
  const supabase = getServiceClient();
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const record of records) {
    try {
      const item = record as Record<string, unknown>;
      const externalId = (item.Codigo as string) || (item.codigo as string);

      if (!externalId) {
        result.skipped++;
        continue;
      }

      // Check if inventory item exists
      const { data: existing } = await supabase
        .from('external_inventory')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_id', integrationId)
        .eq('external_id', externalId)
        .maybeSingle();

      const quantity = (item.Existencia as number) || (item.existencia as number) || 0;
      const reorderPoint = (item.PuntoReorden as number) || (item.punto_reorden as number) || 10;
      const isLowStock = quantity < reorderPoint;

      const inventoryData = {
        name: (item.Descripcion as string) || (item.descripcion as string) || 'Sin nombre',
        quantity_on_hand: quantity,
        reorder_point: reorderPoint,
        is_low_stock: isLowStock,
        unit_cost: (item.Costo as number) || (item.costo as number) || null,
        raw_data: item,
        last_synced_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing
        const existingRecord = existing as { id: string };
        const { error } = await supabase
          .from('external_inventory')
          .update(inventoryData)
          .eq('id', existingRecord.id);

        if (error) {
          result.failed++;
          result.errors.push(`Error updating inventory ${externalId}: ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('external_inventory')
          .insert({
            tenant_id: tenantId,
            integration_id: integrationId,
            external_id: externalId,
            external_source: 'softrestaurant_agent',
            sku: externalId,
            ...inventoryData,
          });

        if (error) {
          result.failed++;
          result.errors.push(`Error creating inventory ${externalId}: ${error.message}`);
        } else {
          result.created++;
        }
      }

      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push(err instanceof Error ? err.message : 'Unknown error processing inventory item');
    }
  }

  return result;
}

async function processTablesSync(
  tenantId: string,
  branchId: string | undefined,
  records: unknown[]
): Promise<ProcessResult> {
  const supabase = getServiceClient();
  const result: ProcessResult = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // First check if restaurant_tables table exists
  // If not, skip table sync gracefully
  const { error: tableCheckError } = await supabase
    .from('restaurant_tables')
    .select('id')
    .limit(1);

  if (tableCheckError) {
    // Table doesn't exist, skip gracefully
    result.skipped = records.length;
    result.errors.push('Table sync skipped: restaurant_tables table not available');
    return result;
  }

  for (const record of records) {
    try {
      const item = record as Record<string, unknown>;
      const tableNumber = (item.NumeroMesa as number) || (item.numero_mesa as number);

      if (!tableNumber) {
        result.skipped++;
        continue;
      }

      // Check if table exists
      let query = supabase
        .from('restaurant_tables')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('table_number', tableNumber);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: existing } = await query.maybeSingle();

      const tableData = {
        name: (item.Nombre as string) || `Mesa ${tableNumber}`,
        capacity: (item.Capacidad as number) || 4,
        status: 'available',
        metadata: item,
      };

      if (existing) {
        // Update existing
        const existingRecord = existing as { id: string };
        const { error } = await supabase
          .from('restaurant_tables')
          .update(tableData)
          .eq('id', existingRecord.id);

        if (error) {
          result.failed++;
          result.errors.push(`Error updating table ${tableNumber}: ${error.message}`);
        } else {
          result.updated++;
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('restaurant_tables')
          .insert({
            tenant_id: tenantId,
            branch_id: branchId || null,
            table_number: tableNumber,
            ...tableData,
          });

        if (error) {
          result.failed++;
          result.errors.push(`Error creating table ${tableNumber}: ${error.message}`);
        } else {
          result.created++;
        }
      }

      result.processed++;
    } catch (err) {
      result.failed++;
      result.errors.push(err instanceof Error ? err.message : 'Unknown error processing table');
    }
  }

  return result;
}

// ======================
// POST - Receive Sync Data
// ======================

export async function POST(request: NextRequest) {
  try {
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

    const {
      agent_id,
      auth_token,
      sync_type,
      batch_id,
      batch_number,
      total_batches,
      records,
    } = validation.data;

    // Rate limit check (1000 requests per minute per agent)
    const rateLimitResult = checkRateLimit(agent_id, agentSyncLimiter);
    if (!rateLimitResult.success) {
      return rateLimitExceeded(rateLimitResult);
    }

    // Get service
    const agentService = getAgentManagerService();

    // Validate token
    const tokenResult = await agentService.validateToken(agent_id, auth_token);

    if (!tokenResult.isValid) {
      const statusCode = tokenResult.errorCode === AGENT_ERROR_CODES.TOKEN_EXPIRED ? 401 : 403;
      return NextResponse.json(
        {
          error: tokenResult.errorCode === AGENT_ERROR_CODES.TOKEN_EXPIRED
            ? 'Token has expired'
            : 'Invalid credentials',
          errorCode: tokenResult.errorCode,
        },
        { status: statusCode }
      );
    }

    const { tenantId, integrationId, branchId } = tokenResult.context!;

    // Create sync log entry
    const logResult = await agentService.createSyncLog(agent_id, tenantId, {
      agent_id,
      sync_type,
      batch_id,
      batch_number,
      total_batches,
      records,
      sync_started_at: new Date().toISOString(),
    });

    if (!logResult.success || !logResult.logId) {
      return NextResponse.json(
        {
          error: 'Failed to create sync log',
          errorCode: 'LOG_CREATION_FAILED',
        },
        { status: 500 }
      );
    }

    // Process based on sync type
    let processResult: ProcessResult;

    switch (sync_type) {
      case 'sales':
        // Sales sync requires branch_id (sr_sales.branch_id is NOT NULL)
        if (!branchId) {
          return NextResponse.json(
            {
              error: 'Sales sync requires branch_id. Configure the agent with a valid branch.',
              errorCode: 'MISSING_BRANCH_ID',
              hint: 'Associate this agent with a branch in the Integration Hub settings.',
            },
            { status: 400 }
          );
        }
        processResult = await processSalesSync(tenantId, integrationId, branchId, records);
        break;
      case 'menu':
        processResult = await processMenuSync(tenantId, integrationId, records);
        break;
      case 'inventory':
        processResult = await processInventorySync(tenantId, integrationId, records);
        break;
      case 'tables':
        processResult = await processTablesSync(tenantId, branchId, records);
        break;
      case 'full':
        // Full sync: process each type from the records
        // Records should be structured with type indicators
        processResult = {
          processed: records.length,
          created: 0,
          updated: 0,
          skipped: records.length,
          failed: 0,
          errors: ['Full sync not yet implemented - use individual sync types'],
        };
        break;
      default:
        processResult = {
          processed: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          failed: records.length,
          errors: [`Unknown sync type: ${sync_type}`],
        };
    }

    // Determine final status
    const finalStatus = processResult.failed > 0
      ? (processResult.processed > processResult.failed ? 'partial' : 'failed')
      : 'completed';

    // Complete sync log
    await agentService.completeSyncLog(logResult.logId, {
      status: finalStatus,
      recordsProcessed: processResult.processed,
      recordsCreated: processResult.created,
      recordsUpdated: processResult.updated,
      recordsSkipped: processResult.skipped,
      recordsFailed: processResult.failed,
      errorMessage: processResult.errors.length > 0 ? processResult.errors.join('; ') : undefined,
    });

    // Return result
    return NextResponse.json({
      success: finalStatus !== 'failed',
      batch_id,
      batch_number,
      status: finalStatus,
      records_processed: processResult.processed,
      records_created: processResult.created,
      records_updated: processResult.updated,
      records_skipped: processResult.skipped,
      records_failed: processResult.failed,
      errors: processResult.errors.slice(0, 10), // Limit errors in response
      server_time: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Agent Sync] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
