// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Webhook Receiver
// Receives sales data pushed from Soft Restaurant ERP/PMS module
// Based on: OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  addRateLimitHeaders,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';
import { timingSafeEqual } from 'crypto';

// ======================
// RATE LIMITER CONFIG
// ======================

const SR_WEBHOOK_LIMITER = {
  limit: 100,          // 100 requests
  windowSeconds: 60,   // per minute
  identifier: 'sr-webhook',
};

// ======================
// TYPES (from SR documentation)
// ======================

/**
 * Soft Restaurant webhook payload structure
 * As defined in OPE.ANA.SR11 documentation
 */
interface SRWebhookPayload {
  IdEmpresa: string;      // SR company identifier (e.g., "SR10.002MX12345")
  Ventas: SRVenta[];      // Array of sales
}

interface SRVenta {
  Estacion: string;       // Terminal/station code
  Almacen: string;        // Warehouse/branch code
  FechaVenta: string;     // Sale date (ISO 8601)
  NumeroOrden: string;    // Order/ticket number
  Conceptos: SRConcepto[]; // Line items
  Pagos: SRPago[];        // Payments
}

interface SRConcepto {
  Codigo: string;         // Product code
  Descripcion: string;    // Product name
  Cantidad: number;       // Quantity
  Precio: number;         // Unit price
  Importe: number;        // Line total
  Descuento?: number;     // Discount amount
  Impuesto?: number;      // Tax amount
}

interface SRPago {
  FormaPago: string;      // Payment method (Efectivo, Tarjeta, etc.)
  Monto: number;          // Payment amount
  Referencia?: string;    // Reference/authorization code
}

// ======================
// ERROR CODES
// ======================

const WEBHOOK_ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_TENANT: 'INVALID_TENANT',
  MISSING_AUTH: 'MISSING_AUTHORIZATION',
  INVALID_AUTH: 'INVALID_AUTHORIZATION',
  NO_INTEGRATION: 'NO_INTEGRATION_FOUND',
  INTEGRATION_DISABLED: 'INTEGRATION_DISABLED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  MISSING_FIELDS: 'MISSING_REQUIRED_FIELDS',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  DB_ERROR: 'DATABASE_ERROR',
} as const;

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Timing-safe comparison of secrets to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    const paddedB = b.padEnd(a.length, '0');
    timingSafeEqual(Buffer.from(a), Buffer.from(paddedB));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validate the webhook payload structure
 */
function validatePayload(payload: unknown): payload is SRWebhookPayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;

  // IdEmpresa is required
  if (!p.IdEmpresa || typeof p.IdEmpresa !== 'string') return false;

  // Ventas array is required
  if (!Array.isArray(p.Ventas)) return false;

  // Validate each sale
  for (const venta of p.Ventas) {
    if (!venta || typeof venta !== 'object') return false;
    if (!venta.NumeroOrden || typeof venta.NumeroOrden !== 'string') return false;
    if (!venta.FechaVenta || typeof venta.FechaVenta !== 'string') return false;
    if (!Array.isArray(venta.Conceptos)) return false;
    if (!Array.isArray(venta.Pagos)) return false;
  }

  return true;
}

/**
 * Create Supabase admin client for webhook processing
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// ======================
// POST - Receive webhook from Soft Restaurant
// ======================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  try {
    // 1. Rate limiting by IP
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(clientIP, SR_WEBHOOK_LIMITER);

    if (!rateLimitResult.success) {
      console.warn('[SR Webhook] Rate limited:', clientIP);
      return rateLimitExceeded(rateLimitResult);
    }

    // 2. Validate tenant ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      console.warn('[SR Webhook] Invalid tenant ID format:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'ID de empresa invalido',
          errorCode: WEBHOOK_ERROR_CODES.INVALID_TENANT,
        },
        { status: 400 }
      );
    }

    // 3. Extract Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[SR Webhook] Missing Authorization header for tenant:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'Falta encabezado de autorizacion',
          errorCode: WEBHOOK_ERROR_CODES.MISSING_AUTH,
        },
        { status: 401 }
      );
    }

    // Support both "Bearer <token>" and raw token formats
    const secret = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    // 4. Create admin client and look up integration
    const supabase = createAdminClient();

    const { data: integration, error: integrationError } = await supabase
      .from('integration_connections')
      .select('id, webhook_secret, status, sync_enabled, metadata')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'softrestaurant')
      .single();

    if (integrationError || !integration) {
      console.warn('[SR Webhook] No integration found for tenant:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'No se encontro integracion de Soft Restaurant para esta empresa',
          errorCode: WEBHOOK_ERROR_CODES.NO_INTEGRATION,
        },
        { status: 404 }
      );
    }

    // 5. Validate webhook secret
    if (!integration.webhook_secret || !secureCompare(secret, integration.webhook_secret)) {
      console.warn('[SR Webhook] Invalid secret for tenant:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'Secret de autorizacion invalido',
          errorCode: WEBHOOK_ERROR_CODES.INVALID_AUTH,
        },
        { status: 401 }
      );
    }

    // 6. Check if integration is enabled
    if (integration.status === 'disconnected' || integration.status === 'paused') {
      console.info('[SR Webhook] Integration disabled for tenant:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'La integracion esta deshabilitada',
          errorCode: WEBHOOK_ERROR_CODES.INTEGRATION_DISABLED,
        },
        { status: 403 }
      );
    }

    // 7. Parse and validate payload
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      console.warn('[SR Webhook] Invalid JSON payload for tenant:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'Payload JSON invalido',
          errorCode: WEBHOOK_ERROR_CODES.INVALID_PAYLOAD,
        },
        { status: 400 }
      );
    }

    if (!validatePayload(payload)) {
      console.warn('[SR Webhook] Invalid payload structure for tenant:', tenantId);
      return NextResponse.json(
        {
          success: false,
          message: 'Estructura de payload invalida. Campos requeridos: IdEmpresa, Ventas (array con NumeroOrden, FechaVenta, Conceptos, Pagos)',
          errorCode: WEBHOOK_ERROR_CODES.MISSING_FIELDS,
        },
        { status: 400 }
      );
    }

    // 8. Process the sales data
    console.log('[SR Webhook] Processing', payload.Ventas.length, 'sales for tenant:', tenantId);

    const processedSales = [];
    const errors = [];

    for (const venta of payload.Ventas) {
      try {
        // Calculate totals
        const subtotal = venta.Conceptos.reduce((sum, c) => sum + (c.Importe || 0), 0);
        const discounts = venta.Conceptos.reduce((sum, c) => sum + (c.Descuento || 0), 0);
        const taxes = venta.Conceptos.reduce((sum, c) => sum + (c.Impuesto || 0), 0);
        const total = venta.Pagos.reduce((sum, p) => sum + (p.Monto || 0), 0);

        // Insert into external_products (sales) or a dedicated table
        // For now, we'll use integration_sync_logs to record the sale
        const saleRecord = {
          tenant_id: tenantId,
          integration_id: integration.id,
          sync_type: 'orders',
          sync_direction: 'inbound',
          sync_trigger: 'webhook',
          status: 'completed',
          records_processed: venta.Conceptos.length,
          records_created: 1,
          records_updated: 0,
          records_skipped: 0,
          records_failed: 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
          metadata: {
            sr_empresa_id: payload.IdEmpresa,
            order_number: venta.NumeroOrden,
            station: venta.Estacion,
            warehouse: venta.Almacen,
            sale_date: venta.FechaVenta,
            subtotal,
            discounts,
            taxes,
            total,
            items_count: venta.Conceptos.length,
            payment_methods: venta.Pagos.map(p => p.FormaPago),
            raw_data: venta,
          },
        };

        const { error: insertError } = await supabase
          .from('integration_sync_logs')
          .insert(saleRecord);

        if (insertError) {
          errors.push({
            order: venta.NumeroOrden,
            error: insertError.message,
          });
        } else {
          processedSales.push(venta.NumeroOrden);
        }
      } catch (err) {
        errors.push({
          order: venta.NumeroOrden,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // 9. Update integration stats
    await supabase
      .from('integration_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        records_synced_total: integration.metadata?.records_synced_total
          ? Number(integration.metadata.records_synced_total) + processedSales.length
          : processedSales.length,
        records_synced_today: integration.metadata?.records_synced_today
          ? Number(integration.metadata.records_synced_today) + processedSales.length
          : processedSales.length,
        consecutive_errors: errors.length > 0 ? 1 : 0,
        error_count: errors.length > 0
          ? (integration.metadata?.error_count || 0) + 1
          : integration.metadata?.error_count || 0,
        last_error_at: errors.length > 0 ? new Date().toISOString() : undefined,
        last_error_message: errors.length > 0 ? errors[0].error : undefined,
      })
      .eq('id', integration.id);

    // 10. Return success response
    console.log('[SR Webhook] Processed', processedSales.length, 'sales,', errors.length, 'errors for tenant:', tenantId);

    const response = NextResponse.json(
      {
        success: true,
        message: `Procesadas ${processedSales.length} ventas`,
        processed: processedSales.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );

    return addRateLimitHeaders(response, rateLimitResult);

  } catch (error) {
    console.error('[SR Webhook] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Error interno del servidor',
        errorCode: WEBHOOK_ERROR_CODES.PROCESSING_ERROR,
      },
      { status: 500 }
    );
  }
}

// ======================
// GET - Health check / Webhook info
// ======================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  return NextResponse.json({
    status: 'active',
    message: 'Webhook de Soft Restaurant activo',
    tenant_id: tenantId,
    accepts: 'POST',
    documentation: 'https://api.softrestaurant.com.mx',
    expected_payload: {
      IdEmpresa: 'string (identificador de empresa en SR)',
      Ventas: [
        {
          Estacion: 'string (codigo de terminal)',
          Almacen: 'string (codigo de almacen/sucursal)',
          FechaVenta: 'string (ISO 8601)',
          NumeroOrden: 'string (numero de ticket)',
          Conceptos: '[ { Codigo, Descripcion, Cantidad, Precio, Importe, Descuento?, Impuesto? } ]',
          Pagos: '[ { FormaPago, Monto, Referencia? } ]',
        },
      ],
    },
  });
}
