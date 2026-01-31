// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Webhook Service
// Processes incoming webhook data from Soft Restaurant
// Based on: OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SRWebhookSale, SRWebhookSaleItem, SRWebhookPayment } from '../types/integration.types';

// ======================
// TYPES
// ======================

/**
 * Soft Restaurant webhook payload (from ERP/PMS module)
 * Structure based on official documentation
 */
export interface SRWebhookPayload {
  IdEmpresa: string;
  Ventas: SRVentaPayload[];
}

export interface SRVentaPayload {
  Estacion: string;
  Almacen: string;
  FechaVenta: string;
  NumeroOrden: string;
  Conceptos: SRConceptoPayload[];
  Pagos: SRPagoPayload[];
  // Optional fields
  NumeroMesa?: string;
  NombreCliente?: string;
  CodigoCliente?: string;
  CodigoMesero?: string;
  NombreMesero?: string;
  Observaciones?: string;
}

export interface SRConceptoPayload {
  Codigo: string;
  Descripcion: string;
  Cantidad: number;
  Precio: number;
  Importe: number;
  Descuento?: number;
  Impuesto?: number;
  Modificadores?: string[];
  Notas?: string;
}

export interface SRPagoPayload {
  FormaPago: string;
  Monto: number;
  Referencia?: string;
  Propina?: number;
}

/**
 * Result of processing a single sale
 */
export interface SaleProcessingResult {
  orderNumber: string;
  success: boolean;
  error?: string;
  saleId?: string;
}

/**
 * Result of processing the entire webhook payload
 */
export interface WebhookProcessingResult {
  success: boolean;
  totalSales: number;
  processedCount: number;
  errorCount: number;
  results: SaleProcessingResult[];
  errors?: string[];
}

/**
 * Webhook credentials for a tenant
 */
export interface SRWebhookCredentials {
  webhookUrl: string;
  webhookSecret: string;
  tenantId: string;
}

// ======================
// WEBHOOK SERVICE
// ======================

class SoftRestaurantWebhookService {
  private supabase: SupabaseClient | null = null;

  /**
   * Initialize Supabase admin client
   */
  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase configuration');
      }

      this.supabase = createClient(supabaseUrl, serviceRoleKey);
    }
    return this.supabase;
  }

  /**
   * Generate secure webhook credentials for a tenant
   */
  generateWebhookCredentials(tenantId: string): SRWebhookCredentials {
    // Generate a cryptographically secure random secret
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const webhookSecret = Array.from(secretBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Construct the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';
    const webhookUrl = `${baseUrl}/api/integrations/softrestaurant/webhook/${tenantId}`;

    return {
      webhookUrl,
      webhookSecret,
      tenantId,
    };
  }

  /**
   * Process incoming webhook payload from Soft Restaurant
   */
  async processWebhookPayload(
    tenantId: string,
    integrationId: string,
    payload: SRWebhookPayload
  ): Promise<WebhookProcessingResult> {
    const results: SaleProcessingResult[] = [];
    let processedCount = 0;
    let errorCount = 0;

    for (const venta of payload.Ventas) {
      const result = await this.processSingleSale(tenantId, integrationId, payload.IdEmpresa, venta);
      results.push(result);

      if (result.success) {
        processedCount++;
      } else {
        errorCount++;
      }
    }

    return {
      success: errorCount === 0,
      totalSales: payload.Ventas.length,
      processedCount,
      errorCount,
      results,
      errors: errorCount > 0 ? results.filter(r => !r.success).map(r => r.error || 'Unknown error') : undefined,
    };
  }

  /**
   * Process a single sale from the webhook
   */
  private async processSingleSale(
    tenantId: string,
    integrationId: string,
    srEmpresaId: string,
    venta: SRVentaPayload
  ): Promise<SaleProcessingResult> {
    try {
      const supabase = this.getSupabase();

      // Transform to internal format
      const saleData = this.transformSaleData(venta, srEmpresaId);

      // Calculate totals
      const subtotal = venta.Conceptos.reduce((sum, c) => sum + (c.Importe || 0), 0);
      const discounts = venta.Conceptos.reduce((sum, c) => sum + (c.Descuento || 0), 0);
      const taxes = venta.Conceptos.reduce((sum, c) => sum + (c.Impuesto || 0), 0);
      const tips = venta.Pagos.reduce((sum, p) => sum + (p.Propina || 0), 0);
      const total = venta.Pagos.reduce((sum, p) => sum + (p.Monto || 0), 0);

      // Log the sync
      const { error: logError } = await supabase
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_id: integrationId,
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
            sr_empresa_id: srEmpresaId,
            order_number: venta.NumeroOrden,
            station: venta.Estacion,
            warehouse: venta.Almacen,
            sale_date: venta.FechaVenta,
            table_number: venta.NumeroMesa,
            customer_name: venta.NombreCliente,
            server_name: venta.NombreMesero,
            subtotal,
            discounts,
            taxes,
            tips,
            total,
            items_count: venta.Conceptos.length,
            payment_methods: venta.Pagos.map(p => p.FormaPago),
            sale_data: saleData,
          },
        });

      if (logError) {
        throw new Error(`Failed to log sale: ${logError.message}`);
      }

      return {
        orderNumber: venta.NumeroOrden,
        success: true,
      };
    } catch (error) {
      console.error(`[SR Webhook Service] Error processing sale ${venta.NumeroOrden}:`, error);
      return {
        orderNumber: venta.NumeroOrden,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Transform SR payload to internal SRWebhookSale format
   */
  private transformSaleData(venta: SRVentaPayload, srEmpresaId: string): SRWebhookSale {
    // Transform items
    const productos: SRWebhookSaleItem[] = venta.Conceptos.map(c => ({
      Codigo: c.Codigo,
      Descripcion: c.Descripcion,
      Cantidad: c.Cantidad,
      Precio: c.Precio,
      Importe: c.Importe,
      Descuento: c.Descuento,
      Modificadores: c.Modificadores,
      Notas: c.Notas,
    }));

    // Transform payments
    const pagos: SRWebhookPayment[] = venta.Pagos.map(p => ({
      FormaPago: p.FormaPago,
      Monto: p.Monto,
      Referencia: p.Referencia,
      Propina: p.Propina,
    }));

    // Calculate totals
    const subtotal = venta.Conceptos.reduce((sum, c) => sum + (c.Importe || 0), 0);
    const discounts = venta.Conceptos.reduce((sum, c) => sum + (c.Descuento || 0), 0);
    const taxes = venta.Conceptos.reduce((sum, c) => sum + (c.Impuesto || 0), 0);
    const tips = venta.Pagos.reduce((sum, p) => sum + (p.Propina || 0), 0);
    const total = venta.Pagos.reduce((sum, p) => sum + (p.Monto || 0), 0);

    return {
      FolioVenta: venta.NumeroOrden,
      CodigoTienda: venta.Almacen,
      CodigoCliente: venta.CodigoCliente,
      NombreCliente: venta.NombreCliente,
      CodigoMesero: venta.CodigoMesero,
      NombreMesero: venta.NombreMesero,
      NumeroMesa: venta.NumeroMesa,
      FechaApertura: venta.FechaVenta,
      Productos: productos,
      SubtotalSinImpuestos: subtotal,
      TotalImpuestos: taxes,
      TotalDescuentos: discounts,
      TotalPropinas: tips,
      Total: total,
      Pagos: pagos,
      Observaciones: venta.Observaciones,
      Metadata: {
        sr_empresa_id: srEmpresaId,
        station: venta.Estacion,
        warehouse: venta.Almacen,
      },
    };
  }

  /**
   * Validate webhook secret against stored value
   */
  async validateWebhookSecret(tenantId: string, providedSecret: string): Promise<boolean> {
    const supabase = this.getSupabase();

    const { data: integration, error } = await supabase
      .from('integration_connections')
      .select('webhook_secret')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'softrestaurant')
      .single();

    if (error || !integration?.webhook_secret) {
      return false;
    }

    // Timing-safe comparison
    const { timingSafeEqual } = await import('crypto');
    const storedBuffer = Buffer.from(integration.webhook_secret);
    const providedBuffer = Buffer.from(providedSecret);

    if (storedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, providedBuffer);
  }

  /**
   * Get webhook stats for a tenant
   */
  async getWebhookStats(tenantId: string, integrationId: string): Promise<{
    totalSales: number;
    salesToday: number;
    lastSaleAt: string | null;
    errorCount: number;
  }> {
    const supabase = this.getSupabase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total sales count
    const { count: totalCount } = await supabase
      .from('integration_sync_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId)
      .eq('sync_type', 'orders')
      .eq('sync_trigger', 'webhook');

    // Get today's sales count
    const { count: todayCount } = await supabase
      .from('integration_sync_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId)
      .eq('sync_type', 'orders')
      .eq('sync_trigger', 'webhook')
      .gte('created_at', today.toISOString());

    // Get last sale
    const { data: lastSale } = await supabase
      .from('integration_sync_logs')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId)
      .eq('sync_type', 'orders')
      .eq('sync_trigger', 'webhook')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get error count
    const { count: errorCount } = await supabase
      .from('integration_sync_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('integration_id', integrationId)
      .eq('status', 'failed');

    return {
      totalSales: totalCount || 0,
      salesToday: todayCount || 0,
      lastSaleAt: lastSale?.created_at || null,
      errorCount: errorCount || 0,
    };
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let serviceInstance: SoftRestaurantWebhookService | null = null;

export function getSoftRestaurantWebhookService(): SoftRestaurantWebhookService {
  if (!serviceInstance) {
    serviceInstance = new SoftRestaurantWebhookService();
  }
  return serviceInstance;
}

export { SoftRestaurantWebhookService };
