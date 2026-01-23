// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Webhook API
// Receives sale data from SoftRestaurant POS system
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  SRWebhookSale,
} from '@/src/features/integrations/types/integration.types';
import type {
  SRSaleEntity,
  SRSaleItemEntity,
  SRPaymentEntity,
  SRValidationResult,
  SRRegistrationResult,
  SRWebhookProcessingResult,
} from '@/src/features/integrations/types/soft-restaurant.types';
import { SRJobQueueService } from '@/src/features/integrations/services/sr-job-queue.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ========================================
// CONSTANTS
// ========================================

const DUPLICATE_DETECTION_MINUTES = 5; // Window for duplicate detection
const MAX_RETRY_COUNT = 3;

// ========================================
// VALIDATION FUNCTIONS
// ========================================

/**
 * Validate SR webhook payload structure and required fields
 */
function validateSRPayload(payload: any): SRValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if payload exists
  if (!payload || typeof payload !== 'object') {
    errors.push('Invalid payload: must be a JSON object');
    return { isValid: false, errors, warnings };
  }

  // Required fields
  if (!payload.FolioVenta || typeof payload.FolioVenta !== 'string') {
    errors.push('FolioVenta (ticket number) is required and must be a string');
  } else if (payload.FolioVenta.length > 100) {
    errors.push('FolioVenta (ticket number) must be 100 characters or less');
  }

  if (!payload.FechaApertura || typeof payload.FechaApertura !== 'string') {
    errors.push('FechaApertura (opened date) is required and must be a string');
  }

  if (!Array.isArray(payload.Productos) || payload.Productos.length === 0) {
    errors.push('Productos (items) must be a non-empty array');
  }

  if (typeof payload.SubtotalSinImpuestos !== 'number') {
    errors.push('SubtotalSinImpuestos (subtotal) is required and must be a number');
  } else if (payload.SubtotalSinImpuestos < 0 || payload.SubtotalSinImpuestos > 10000000) {
    errors.push('SubtotalSinImpuestos must be between 0 and 10,000,000');
  }

  if (typeof payload.TotalImpuestos !== 'number') {
    errors.push('TotalImpuestos (total tax) is required and must be a number');
  } else if (payload.TotalImpuestos < 0 || payload.TotalImpuestos > 10000000) {
    errors.push('TotalImpuestos must be between 0 and 10,000,000');
  }

  if (typeof payload.Total !== 'number') {
    errors.push('Total is required and must be a number');
  } else if (payload.Total < 0 || payload.Total > 10000000) {
    errors.push('Total must be between 0 and 10,000,000');
  }

  // Validate array size limit (DoS protection)
  if (Array.isArray(payload.Productos) && payload.Productos.length > 500) {
    errors.push('Productos array is too large (max 500 items per sale)');
  }

  // Validate each product
  if (Array.isArray(payload.Productos)) {
    payload.Productos.forEach((item: any, index: number) => {
      if (!item.Codigo || typeof item.Codigo !== 'string') {
        errors.push(`Item ${index + 1}: Codigo (product code) is required`);
      } else if (item.Codigo.length > 100) {
        errors.push(`Item ${index + 1}: Codigo must be 100 characters or less`);
      }

      if (!item.Descripcion || typeof item.Descripcion !== 'string') {
        errors.push(`Item ${index + 1}: Descripcion (product name) is required`);
      } else if (item.Descripcion.length > 500) {
        errors.push(`Item ${index + 1}: Descripcion must be 500 characters or less`);
      }

      if (typeof item.Cantidad !== 'number' || item.Cantidad <= 0) {
        errors.push(`Item ${index + 1}: Cantidad (quantity) must be a positive number`);
      } else if (item.Cantidad > 10000) {
        errors.push(`Item ${index + 1}: Cantidad is unrealistically high (max 10000)`);
      }

      if (typeof item.Precio !== 'number') {
        errors.push(`Item ${index + 1}: Precio (price) is required`);
      } else if (item.Precio < 0 || item.Precio > 1000000) {
        errors.push(`Item ${index + 1}: Precio must be between 0 and 1,000,000`);
      }

      if (typeof item.Importe !== 'number') {
        errors.push(`Item ${index + 1}: Importe (subtotal) is required`);
      } else if (item.Importe < 0 || item.Importe > 10000000) {
        errors.push(`Item ${index + 1}: Importe must be between 0 and 10,000,000`);
      }
    });
  }

  // Warnings (non-critical)
  if (!payload.CodigoMesero && !payload.NombreMesero) {
    warnings.push('No server/waiter information provided (CodigoMesero/NombreMesero)');
  }

  if (!payload.NumeroMesa) {
    warnings.push('No table number provided (NumeroMesa)');
  }

  if (!payload.Pagos || payload.Pagos.length === 0) {
    warnings.push('No payment information provided (Pagos)');
  }

  // Validate date format (ISO 8601)
  if (payload.FechaApertura) {
    const date = new Date(payload.FechaApertura);
    if (isNaN(date.getTime())) {
      errors.push('FechaApertura must be a valid ISO 8601 date');
    }
  }

  if (payload.FechaCierre) {
    const date = new Date(payload.FechaCierre);
    if (isNaN(date.getTime())) {
      errors.push('FechaCierre must be a valid ISO 8601 date');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

/**
 * Authenticate SR webhook request using API key
 * Returns integration connection if valid
 */
async function authenticateSRWebhook(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');

  // Accept API key from either Authorization header or x-api-key header
  const key = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : apiKey;

  if (!key) {
    return {
      error: 'Authentication required. Provide API key in Authorization or x-api-key header',
      status: 401,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find integration connection by API key
  const { data: integration, error } = await supabase
    .from('integration_connections')
    .select('id, tenant_id, branch_id, integration_type, status')
    .eq('api_key', key)
    .in('integration_type', ['softrestaurant', 'softrestaurant_import'])
    .single();

  if (error || !integration) {
    return {
      error: 'Invalid API key or integration not found',
      status: 401,
    };
  }

  if (integration.status !== 'connected') {
    return {
      error: `Integration status is ${integration.status}. Must be 'connected'`,
      status: 403,
    };
  }

  if (!integration.branch_id) {
    return {
      error: 'Integration is not associated with a branch. Contact administrator.',
      status: 500,
    };
  }

  return {
    integration,
  };
}

// ========================================
// REGISTRATION FUNCTIONS (PHASE 1)
// ========================================

/**
 * Check for duplicate sale within time window
 */
async function checkDuplicateSale(
  supabase: any,
  tenantId: string,
  branchId: string,
  folioVenta: string
): Promise<string | null> {
  const windowStart = new Date(
    Date.now() - DUPLICATE_DETECTION_MINUTES * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('sr_sales')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('folio_venta', folioVenta)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[SR Webhook] Error checking duplicate:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Register SR sale (PHASE 1: No processing, just store raw data)
 */
async function registerSRSale(
  supabase: any,
  payload: SRWebhookSale,
  integrationId: string,
  tenantId: string,
  branchId: string
): Promise<SRRegistrationResult> {
  // Check for duplicate
  const existingSaleId = await checkDuplicateSale(
    supabase,
    tenantId,
    branchId,
    payload.FolioVenta
  );

  if (existingSaleId) {
    console.log(`[SR Webhook] Duplicate sale detected: ${payload.FolioVenta}`);
    return {
      success: true,
      saleId: existingSaleId,
      isDuplicate: true,
    };
  }

  // Prepare sale entity
  const saleEntity: Omit<SRSaleEntity, 'id'> = {
    tenant_id: tenantId,
    branch_id: branchId,
    integration_id: integrationId,
    folio_venta: payload.FolioVenta,
    store_code: payload.CodigoTienda || null,
    customer_code: payload.CodigoCliente || null,
    table_number: payload.NumeroMesa || null,
    user_code: payload.CodigoMesero || null,
    opened_at: payload.FechaApertura,
    closed_at: payload.FechaCierre || null,
    subtotal_without_tax: payload.SubtotalSinImpuestos,
    total_tax: payload.TotalImpuestos,
    total_discounts: payload.TotalDescuentos || 0,
    total_tips: payload.TotalPropinas || 0,
    total: payload.Total,
    currency: payload.Moneda || 'MXN',
    guest_count: payload.NumeroComensales || null,
    sale_type: payload.TipoVenta || null,
    notes: payload.Observaciones || null,
    status: 'pending',
    processed_at: null,
    restaurant_order_id: null,
    error_message: null,
    retry_count: 0,
    raw_payload: payload as unknown as Record<string, unknown>,
    metadata: payload.Metadata || {},
  };

  // Insert sale
  const { data: sale, error: saleError } = await supabase
    .from('sr_sales')
    .insert(saleEntity)
    .select('id')
    .single();

  if (saleError) {
    console.error('[SR Webhook] Error inserting sale:', saleError);
    return {
      success: false,
      isDuplicate: false,
      error: `Failed to register sale: ${saleError.message}`,
    };
  }

  const saleId = sale.id;

  // Prepare sale items
  const saleItems: Omit<SRSaleItemEntity, 'id'>[] = payload.Productos.map((item) => ({
    sale_id: saleId,
    tenant_id: tenantId,
    branch_id: branchId,
    product_code: item.Codigo,
    product_name: item.Descripcion,
    quantity: item.Cantidad,
    unit_price: item.Precio,
    subtotal_without_tax: item.Importe,
    discount_amount: item.Descuento || 0,
    tax_amount: 0, // Will be calculated by trigger if tax_details present
    tax_details: item.Impuestos
      ? { Impuestos: item.Impuestos }
      : null,
    modifiers: item.Modificadores || null,
    notes: item.Notas || null,
    user_code: item.CodigoMesero || payload.CodigoMesero || null,
    item_timestamp: item.Timestamp || null,
    mapped_menu_item_id: null,
  }));

  // Insert sale items
  const { error: itemsError } = await supabase
    .from('sr_sale_items')
    .insert(saleItems);

  if (itemsError) {
    console.error('[SR Webhook] Error inserting sale items:', itemsError);
    // Delete sale to maintain consistency
    await supabase.from('sr_sales').delete().eq('id', saleId);
    return {
      success: false,
      isDuplicate: false,
      error: `Failed to register sale items: ${itemsError.message}`,
    };
  }

  // Prepare payments (if provided)
  let paymentsRegistered = 0;
  if (payload.Pagos && payload.Pagos.length > 0) {
    const payments: Omit<SRPaymentEntity, 'id'>[] = payload.Pagos.map((payment) => ({
      sale_id: saleId,
      tenant_id: tenantId,
      branch_id: branchId,
      payment_method: payment.FormaPago,
      amount: payment.Monto,
      currency: payment.Moneda || payload.Moneda || 'MXN',
      payment_reference: payment.Referencia || null,
      card_last_four: payment.NumeroTarjeta || null,
      tip_amount: payment.Propina || 0,
      payment_timestamp: payment.Timestamp || null,
    }));

    const { error: paymentsError } = await supabase
      .from('sr_payments')
      .insert(payments);

    if (paymentsError) {
      console.error('[SR Webhook] Error inserting payments:', paymentsError);
      // Don't fail the entire registration, just log warning
    } else {
      paymentsRegistered = payments.length;
    }
  }

  console.log(`[SR Webhook] Sale registered: ${saleId} (${payload.FolioVenta})`);

  return {
    success: true,
    saleId,
    isDuplicate: false,
    details: {
      itemsRegistered: saleItems.length,
      paymentsRegistered,
    },
  };
}

// ========================================
// LOGGING FUNCTIONS
// ========================================

/**
 * Create sync log entry
 */
async function createSyncLog(
  supabase: any,
  tenantId: string,
  branchId: string,
  integrationId: string,
  result: SRRegistrationResult,
  validationResult: SRValidationResult,
  durationMs: number
) {
  await supabase.from('sr_sync_logs').insert({
    tenant_id: tenantId,
    branch_id: branchId,
    integration_id: integrationId,
    sync_type: 'webhook_sale',
    direction: 'sr_to_tistis',
    status: result.success ? 'success' : 'failed',
    records_received: 1,
    records_registered: result.success ? 1 : 0,
    records_processed: 0, // Processing happens in Phase 2
    records_failed: result.success ? 0 : 1,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: durationMs,
    error_message: result.error || null,
    error_details: validationResult.errors.length > 0
      ? { validationErrors: validationResult.errors }
      : null,
    sale_id: result.saleId || null,
    metadata: {
      warnings: validationResult.warnings,
      isDuplicate: result.isDuplicate,
    },
  });
}

// ========================================
// POST HANDLER
// ========================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate request
    const authResult = await authenticateSRWebhook(request);

    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { integration } = authResult;
    const { id: integrationId, tenant_id: tenantId, branch_id: branchId } = integration;

    // Parse payload
    let payload: SRWebhookSale;
    try {
      payload = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate payload
    const validationResult = validateSRPayload(payload);

    if (!validationResult.isValid) {
      console.error('[SR Webhook] Validation failed:', validationResult.errors);
      return NextResponse.json(
        {
          error: 'Validation failed',
          validationErrors: validationResult.errors,
          warnings: validationResult.warnings,
        },
        { status: 400 }
      );
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn('[SR Webhook] Validation warnings:', validationResult.warnings);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Set session variable for branch isolation
    try {
      await supabase.rpc('set_session_branch_id', {
        p_branch_id: branchId,
      });
    } catch (error) {
      // Log warning but continue - RLS policies have fallback
      console.warn('[SR Webhook] Could not set session variable app.current_branch_id:', error);
    }

    // PHASE 1: Register sale (store raw data)
    const registrationResult = await registerSRSale(
      supabase,
      payload,
      integrationId,
      tenantId,
      branchId
    );

    // Create sync log
    const durationMs = Date.now() - startTime;
    await createSyncLog(
      supabase,
      tenantId,
      branchId,
      integrationId,
      registrationResult,
      validationResult,
      durationMs
    );

    if (!registrationResult.success) {
      return NextResponse.json(
        {
          error: registrationResult.error,
          phase: 'registration',
        },
        { status: 500 }
      );
    }

    // Return success response
    const response: SRWebhookProcessingResult = {
      success: true,
      saleId: registrationResult.saleId,
      phase: 'registration',
      details: {
        itemsRegistered: registrationResult.details?.itemsRegistered || 0,
        paymentsRegistered: registrationResult.details?.paymentsRegistered || 0,
        itemsMapped: 0, // Phase 2
        inventoryDeducted: false, // Phase 2
      },
    };

    // If duplicate, indicate in response
    if (registrationResult.isDuplicate) {
      return NextResponse.json(
        {
          ...response,
          message: 'Duplicate sale detected. Sale already registered.',
          isDuplicate: true,
        },
        { status: 200 }
      );
    }

    // FASE 2: Encolar para procesamiento asíncrono
    // Pattern: Fire-and-forget con catch (no bloquea respuesta al POS)
    // El cron job recupera ventas que fallan en encolar
    if (!registrationResult.isDuplicate && registrationResult.saleId) {
      // Encolar asíncronamente - no bloquear respuesta HTTP
      SRJobQueueService.queueForProcessing(registrationResult.saleId)
        .then(queueResult => {
          if (queueResult.success) {
            console.log(`[SR Webhook] Sale ${registrationResult.saleId} queued for FASE 2`);
          } else {
            // Log warning pero no fallar - el cron recuperará ventas en 'pending'
            console.warn(`[SR Webhook] Queue failed for ${registrationResult.saleId}: ${queueResult.error}`);
          }
        })
        .catch(err => {
          // Log pero no fallar - la venta está registrada (FASE 1 completada)
          // El cron job puede recuperar ventas en status='pending'
          console.error('[SR Webhook] Queue exception (recoverable):', err);
        });
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('[SR Webhook] Unexpected error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        phase: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
