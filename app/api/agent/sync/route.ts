// =====================================================
// TIS TIS PLATFORM - Agent Sync Endpoint
// POST /api/agent/sync
// Receives sync data from TIS TIS Local Agent
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAgentManagerService, AGENT_ERROR_CODES, SoftRestaurantProcessor } from '@/src/features/integrations';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  rateLimitExceeded,
  type RateLimitConfig,
} from '@/src/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';

// ======================
// SR PROCESSOR INSTANCE
// ======================

/**
 * Singleton processor instance for background processing.
 * Initialized lazily on first use.
 */
let srProcessor: SoftRestaurantProcessor | null = null;

function getSRProcessor(): SoftRestaurantProcessor {
  if (!srProcessor) {
    srProcessor = new SoftRestaurantProcessor();
  }
  return srProcessor;
}

/**
 * Process SR sales in background (non-blocking).
 * This runs after the sync response is sent to the agent.
 *
 * @param saleIds - Array of sr_sales IDs to process
 */
async function processCreatedSalesInBackground(saleIds: string[]): Promise<void> {
  if (saleIds.length === 0) return;

  const processor = getSRProcessor();
  const startTime = Date.now();

  console.log(`[SR Background] Starting processing of ${saleIds.length} sales...`);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const saleId of saleIds) {
    try {
      const result = await processor.processSale(saleId);

      if (result.success) {
        succeeded++;
        console.log(`[SR Background] Processed sale ${saleId} -> order ${result.restaurantOrderId}`);
      } else {
        failed++;
        console.warn(`[SR Background] Failed to process sale ${saleId}: ${result.error}`);
      }
      processed++;
    } catch (error) {
      failed++;
      console.error(`[SR Background] Error processing sale ${saleId}:`, error);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[SR Background] Completed: ${succeeded}/${processed} succeeded, ${failed} failed (${elapsed}ms)`
  );
}

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
  createdIds?: string[]; // IDs of newly created records (for background processing)
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
  // Extract more fields from the SR payload for better data quality
  const syncedAt = new Date().toISOString();
  const createdIds: string[] = [];

  const insertData = newSales.map(({ folio, record: sale }) => ({
    tenant_id: tenantId,
    branch_id: branchId,  // Required - NOT NULL constraint
    integration_id: integrationId,
    folio_venta: folio,
    // Store code for multi-branch filtering
    store_code: (sale.CodigoTienda as string) || (sale.Almacen as string) || null,
    // Customer and server identification
    customer_code: (sale.CodigoCliente as string) || (sale.cliente_codigo as string) || null,
    table_number: (sale.NumeroMesa as string) || (sale.Mesa as string) || (sale.numero_mesa as string) || null,
    user_code: (sale.CodigoMesero as string) || (sale.CodigoUsuario as string) || (sale.mesero as string) || null,
    // Dates
    opened_at: (sale.FechaApertura as string) || (sale.fecha_apertura as string) || syncedAt,
    closed_at: (sale.FechaCierre as string) || (sale.fecha_cierre as string) || syncedAt,
    // Financial data (with proper number coercion)
    subtotal_without_tax: Number((sale.Subtotal as number) || (sale.SubtotalSinImpuestos as number) || 0),
    total_tax: Number((sale.TotalImpuestos as number) || (sale.Impuestos as number) || 0),
    total_discounts: Number((sale.TotalDescuentos as number) || (sale.Descuento as number) || 0),
    total_tips: Number((sale.TotalPropinas as number) || (sale.Propina as number) || 0),
    total: Number((sale.Total as number) || (sale.total as number) || 0),
    currency: (sale.Moneda as string) || 'MXN',
    // Additional info
    guest_count: Number((sale.NumeroComensales as number) || (sale.Comensales as number) || 1),
    sale_type: (sale.TipoOrden as string) || (sale.TipoVenta as string) || (sale.tipo_venta as string) || null,
    notes: (sale.Notas as string) || (sale.Observaciones as string) || null,
    // Processing status
    status: 'pending',
    // Raw payload for full data access
    raw_payload: sale,
    metadata: {
      source: 'local_agent',
      synced_at: syncedAt,
      sr_version: (sale.Version as string) || null,
    },
  }));

  // Batch insert with error handling per-record using upsert
  const { error: insertError, data: insertedData } = await supabase
    .from('sr_sales')
    .insert(insertData)
    .select('id, folio_venta');

  // Track which folios were successfully inserted for item/payment insertion
  const insertedFolioToId: Map<string, string> = new Map();

  if (insertError) {
    // If batch insert fails, try individual inserts as fallback
    console.error('[Sales Sync] Batch insert failed, falling back to individual:', insertError.message);

    for (let i = 0; i < insertData.length; i++) {
      const saleData = insertData[i];
      try {
        const { data: singleData, error: singleError } = await supabase
          .from('sr_sales')
          .insert(saleData)
          .select('id')
          .single();

        if (singleError) {
          result.failed++;
          result.errors.push(`Error inserting sale ${saleData.folio_venta}: ${singleError.message}`);
        } else {
          result.created++;
          if (singleData?.id) {
            createdIds.push(singleData.id);
            insertedFolioToId.set(saleData.folio_venta, singleData.id);
          }
        }
        result.processed++;
      } catch (err) {
        result.failed++;
        result.processed++;
        result.errors.push(err instanceof Error ? err.message : 'Unknown error in fallback insert');
      }
    }
  } else {
    // Batch insert succeeded - collect all created IDs
    result.created = insertedData?.length || insertData.length;
    result.processed += result.created;

    if (insertedData) {
      for (const row of insertedData) {
        if (row.id) {
          createdIds.push(row.id);
          if (row.folio_venta) {
            insertedFolioToId.set(row.folio_venta, row.id);
          }
        }
      }
    }
  }

  // ======================
  // STEP 5: Insert sale items (sr_sale_items)
  // CRITICAL FIX: Agent sends Items[] array with each sale
  // ======================
  if (insertedFolioToId.size > 0) {
    const allItems: Array<{
      sale_id: string;
      tenant_id: string;
      branch_id: string;
      product_code: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      subtotal_without_tax: number;
      discount_amount: number;
      tax_amount: number;
      tax_details: Record<string, unknown> | null;
      modifiers: string[] | null;
      notes: string | null;
      user_code: string | null;
      item_timestamp: string | null;
      mapped_menu_item_id: string | null;
    }> = [];

    const allPayments: Array<{
      sale_id: string;
      tenant_id: string;
      branch_id: string;
      payment_method: string;
      amount: number;
      currency: string;
      payment_reference: string | null;
      card_last_four: string | null;
      tip_amount: number;
      payment_timestamp: string | null;
    }> = [];

    // Extract items and payments from original records
    for (const { folio, record: sale } of newSales) {
      const saleId = insertedFolioToId.get(folio);
      if (!saleId) continue;

      // Extract items from sale record
      // Agent sends: Items[] (transformed) or Productos[] (raw webhook)
      const items = (sale.Items as unknown[]) || (sale.Productos as unknown[]) || [];

      for (const itemRaw of items) {
        const item = itemRaw as Record<string, unknown>;
        if (!item) continue;

        // Map agent field names (TisTisSaleItem format)
        const productCode = (item.ProductCode as string) || (item.Codigo as string) || '';
        const productName = (item.ProductName as string) || (item.Descripcion as string) || 'Unknown';

        if (!productCode && !productName) continue; // Skip invalid items

        allItems.push({
          sale_id: saleId,
          tenant_id: tenantId,
          branch_id: branchId,
          product_code: productCode || productName.substring(0, 50), // Use name as fallback code
          product_name: productName,
          quantity: Number((item.Quantity as number) || (item.Cantidad as number) || 1),
          unit_price: Number((item.UnitPrice as number) || (item.Precio as number) || 0),
          subtotal_without_tax: Number((item.LineTotal as number) || (item.Importe as number) || 0),
          discount_amount: Number((item.Discount as number) || (item.Descuento as number) || 0),
          tax_amount: Number((item.Tax as number) || (item.Impuesto as number) || 0),
          tax_details: (item.TaxDetails as Record<string, unknown>) || null,
          modifiers: (item.Modifiers as string[]) || (item.Modificadores as string[]) || null,
          notes: (item.Notes as string) || (item.Notas as string) || null,
          user_code: (item.ServerId as string) || (item.CodigoMesero as string) || null,
          item_timestamp: (item.Timestamp as string) || null,
          mapped_menu_item_id: null, // Will be set by processor
        });
      }

      // Extract payments from sale record
      // Agent sends: Payments[] (transformed) or Pagos[] (raw webhook)
      const payments = (sale.Payments as unknown[]) || (sale.Pagos as unknown[]) || [];

      for (const paymentRaw of payments) {
        const payment = paymentRaw as Record<string, unknown>;
        if (!payment) continue;

        const method = (payment.Method as string) || (payment.FormaPago as string) || 'other';
        const amount = Number((payment.Amount as number) || (payment.Monto as number) || 0);

        if (amount <= 0) continue; // Skip zero/negative payments

        allPayments.push({
          sale_id: saleId,
          tenant_id: tenantId,
          branch_id: branchId,
          payment_method: method,
          amount,
          currency: (payment.Currency as string) || (payment.Moneda as string) || 'MXN',
          payment_reference: (payment.Reference as string) || (payment.Referencia as string) || null,
          card_last_four: (payment.LastFourDigits as string) || (payment.Ultimos4Digitos as string) || null,
          tip_amount: Number((payment.Tip as number) || (payment.Propina as number) || 0),
          payment_timestamp: (payment.Timestamp as string) || null,
        });
      }
    }

    // Batch insert items
    if (allItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('sr_sale_items')
        .insert(allItems);

      if (itemsError) {
        console.error('[Sales Sync] Error inserting sale items:', itemsError.message);
        result.errors.push(`Items insert error: ${itemsError.message}`);
      } else {
        console.log(`[Sales Sync] Inserted ${allItems.length} sale items for ${insertedFolioToId.size} sales`);
      }
    }

    // Batch insert payments
    if (allPayments.length > 0) {
      const { error: paymentsError } = await supabase
        .from('sr_payments')
        .insert(allPayments);

      if (paymentsError) {
        console.error('[Sales Sync] Error inserting payments:', paymentsError.message);
        result.errors.push(`Payments insert error: ${paymentsError.message}`);
      } else {
        console.log(`[Sales Sync] Inserted ${allPayments.length} payments for ${insertedFolioToId.size} sales`);
      }
    }
  }

  // Return IDs of created sales for background processing
  result.createdIds = createdIds;
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

    // IMPORTANT: Trigger background processing for newly created sales
    // This runs asynchronously and doesn't block the response to the agent.
    // The processor will:
    // 1. Map SR products to menu items
    // 2. Create restaurant_orders from sr_sales
    // 3. Deduce inventory based on recipes
    // 4. Check for low stock alerts
    if (sync_type === 'sales' && processResult.createdIds && processResult.createdIds.length > 0) {
      console.log(`[Agent Sync] Scheduling background processing for ${processResult.createdIds.length} new sales`);

      // Fire-and-forget: Don't await - let the response return immediately
      // The processing continues in the background after the response is sent
      processCreatedSalesInBackground(processResult.createdIds).catch((err) => {
        console.error('[Agent Sync] Background processing error:', err);
      });
    }

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
      // Indicate that background processing was scheduled
      background_processing_scheduled: sync_type === 'sales' && (processResult.createdIds?.length || 0) > 0,
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
