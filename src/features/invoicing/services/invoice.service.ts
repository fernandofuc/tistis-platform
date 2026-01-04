// =====================================================
// TIS TIS PLATFORM - Invoice Service
// Core business logic for invoice generation
// =====================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Invoice,
  InvoiceItem,
  InvoiceConfig,
  CustomerFiscalData,
  TicketExtraction,
  CreateInvoiceRequest,
  InvoiceStatistics,
  InvoiceStatus,
  FormaPago,
  MetodoPago,
  UsoCFDI,
  RegimenFiscal,
} from '../types';
import { RFC_GENERICO_NACIONAL, CLAVE_PROD_SERV_RESTAURANT } from '../types';
import { validateRFC } from '../utils/rfc-validator';

// ======================
// SERVICE CLASS
// ======================

export class InvoiceService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private supabase: SupabaseClient<any>;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ======================
  // INVOICE CONFIG
  // ======================

  /**
   * Get invoice configuration for a tenant/branch
   */
  async getConfig(tenantId: string, branchId?: string): Promise<InvoiceConfig | null> {
    const { data, error } = await this.supabase
      .rpc('get_invoice_config', {
        p_tenant_id: tenantId,
        p_branch_id: branchId || null,
      })
      .single();

    if (error || !data) {
      return null;
    }

    return data as unknown as InvoiceConfig;
  }

  /**
   * Create or update invoice configuration
   */
  async upsertConfig(config: Partial<InvoiceConfig> & { tenant_id: string }): Promise<InvoiceConfig> {
    const { data, error } = await this.supabase
      .from('restaurant_invoice_config')
      .upsert(
        {
          ...config,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,branch_id',
        }
      )
      .select()
      .single();

    if (error) throw new Error(`Error saving invoice config: ${error.message}`);
    return data as InvoiceConfig;
  }

  // ======================
  // CUSTOMER FISCAL DATA
  // ======================

  /**
   * Get customer by RFC
   */
  async getCustomerByRFC(tenantId: string, rfc: string): Promise<CustomerFiscalData | null> {
    const { data, error } = await this.supabase
      .from('restaurant_customer_fiscal_data')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('rfc', rfc.toUpperCase())
      .single();

    if (error || !data) return null;
    return data as CustomerFiscalData;
  }

  /**
   * Get all customers for a tenant
   */
  async getCustomers(
    tenantId: string,
    options?: {
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ customers: CustomerFiscalData[]; total: number }> {
    let query = this.supabase
      .from('restaurant_customer_fiscal_data')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('last_invoice_at', { ascending: false, nullsFirst: false });

    if (options?.search) {
      query = query.or(
        `rfc.ilike.%${options.search}%,nombre_razon_social.ilike.%${options.search}%,email.ilike.%${options.search}%`
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Error fetching customers: ${error.message}`);

    return {
      customers: (data || []) as CustomerFiscalData[],
      total: count || 0,
    };
  }

  /**
   * Create or update customer fiscal data
   */
  async upsertCustomer(
    customer: Partial<CustomerFiscalData> & {
      tenant_id: string;
      rfc: string;
      nombre_razon_social: string;
      codigo_postal: string;
      email: string;
    }
  ): Promise<CustomerFiscalData> {
    // Validate RFC
    const rfcValidation = validateRFC(customer.rfc);
    if (!rfcValidation.valid && customer.rfc !== RFC_GENERICO_NACIONAL) {
      throw new Error(`RFC inválido: ${rfcValidation.errors?.join(', ')}`);
    }

    const { data, error } = await this.supabase
      .from('restaurant_customer_fiscal_data')
      .upsert(
        {
          ...customer,
          rfc: customer.rfc.toUpperCase(),
          rfc_validated: rfcValidation.valid,
          rfc_validated_at: rfcValidation.valid ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,rfc',
        }
      )
      .select()
      .single();

    if (error) throw new Error(`Error saving customer: ${error.message}`);
    return data as CustomerFiscalData;
  }

  // ======================
  // INVOICES
  // ======================

  /**
   * Create a new invoice
   */
  async createInvoice(tenantId: string, request: CreateInvoiceRequest): Promise<Invoice> {
    // Get config
    const config = await this.getConfig(tenantId, request.branch_id);
    if (!config) {
      throw new Error('No hay configuración de facturación para este negocio');
    }

    // Get or create customer
    let customerId: string | undefined;
    if (request.customer_rfc !== RFC_GENERICO_NACIONAL) {
      const customer = await this.upsertCustomer({
        tenant_id: tenantId,
        rfc: request.customer_rfc,
        nombre_razon_social: request.customer_nombre,
        codigo_postal: request.customer_codigo_postal,
        email: request.customer_email,
        regimen_fiscal: request.customer_regimen_fiscal || '616', // Sin obligaciones fiscales
        uso_cfdi_preferido: request.customer_uso_cfdi || 'G03', // Gastos en general
      });
      customerId = customer.id;
    }

    // Calculate amounts
    const items = request.items.map((item) => ({
      ...item,
      importe: item.cantidad * item.valor_unitario - (item.descuento || 0),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.importe, 0);
    const descuento = request.descuento || 0;
    const baseImponible = subtotal - descuento;
    const iva = baseImponible * config.tasa_iva;
    const ieps = baseImponible * config.tasa_ieps;
    const totalImpuestos = iva + ieps;
    const total = baseImponible + totalImpuestos;

    // Create invoice
    const { data: invoice, error: invoiceError } = await this.supabase
      .from('restaurant_invoices')
      .insert({
        tenant_id: tenantId,
        branch_id: request.branch_id,
        serie: config.serie,
        // folio is auto-incremented by trigger

        customer_fiscal_data_id: customerId,
        receptor_rfc: request.customer_rfc.toUpperCase(),
        receptor_nombre: request.customer_nombre,
        receptor_codigo_postal: request.customer_codigo_postal,
        receptor_regimen_fiscal: request.customer_regimen_fiscal || '616',
        receptor_uso_cfdi: request.customer_uso_cfdi || config.uso_cfdi_default,
        receptor_email: request.customer_email,

        subtotal,
        descuento,
        total_impuestos: totalImpuestos,
        total,

        iva_trasladado: iva,
        ieps_trasladado: ieps,

        forma_pago: request.forma_pago || config.forma_pago_default,
        metodo_pago: request.metodo_pago || config.metodo_pago_default,
        moneda: config.moneda_default,

        ticket_extraction_id: request.ticket_extraction_id,
        notas_internas: request.notas_internas,

        status: 'draft',
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Error creating invoice: ${invoiceError.message}`);
    }

    // Create invoice items
    const invoiceItems = items.map((item, index) => ({
      invoice_id: invoice.id,
      clave_prod_serv: item.clave_prod_serv || CLAVE_PROD_SERV_RESTAURANT,
      no_identificacion: item.no_identificacion,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      clave_unidad: 'ACT', // Actividad
      unidad: 'Servicio',
      valor_unitario: item.valor_unitario,
      importe: item.importe,
      descuento: item.descuento || 0,
      objeto_imp: '02', // Sí objeto de impuesto
      iva_tasa: config.tasa_iva,
      iva_importe: item.importe * config.tasa_iva,
      ieps_tasa: config.tasa_ieps,
      ieps_importe: item.importe * config.tasa_ieps,
      display_order: index,
    }));

    const { error: itemsError } = await this.supabase
      .from('restaurant_invoice_items')
      .insert(invoiceItems);

    if (itemsError) {
      // Rollback invoice
      await this.supabase.from('restaurant_invoices').delete().eq('id', invoice.id);
      throw new Error(`Error creating invoice items: ${itemsError.message}`);
    }

    // Link extraction if provided
    if (request.ticket_extraction_id) {
      await this.supabase
        .from('restaurant_ticket_extractions')
        .update({ invoice_id: invoice.id })
        .eq('id', request.ticket_extraction_id);
    }

    return invoice as Invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string, includeItems = true): Promise<Invoice | null> {
    let query = this.supabase
      .from('restaurant_invoices')
      .select(includeItems ? '*, items:restaurant_invoice_items(*)' : '*')
      .eq('id', invoiceId);

    const { data, error } = await query.single();

    if (error || !data) return null;
    return data as unknown as Invoice;
  }

  /**
   * Get invoices for a tenant
   */
  async getInvoices(
    tenantId: string,
    options?: {
      branch_id?: string;
      status?: InvoiceStatus;
      start_date?: string;
      end_date?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    let query = this.supabase
      .from('restaurant_invoices')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('fecha_emision', { ascending: false });

    if (options?.branch_id) {
      query = query.eq('branch_id', options.branch_id);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.start_date) {
      query = query.gte('fecha_emision', options.start_date);
    }

    if (options?.end_date) {
      query = query.lte('fecha_emision', options.end_date);
    }

    if (options?.search) {
      query = query.or(
        `receptor_rfc.ilike.%${options.search}%,receptor_nombre.ilike.%${options.search}%,folio::text.ilike.%${options.search}%`
      );
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Error fetching invoices: ${error.message}`);

    return {
      invoices: (data || []) as Invoice[],
      total: count || 0,
    };
  }

  /**
   * Update invoice status
   */
  async updateStatus(invoiceId: string, status: InvoiceStatus, errorMessage?: string): Promise<Invoice> {
    const updateData: Partial<Invoice> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'error' && errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (status === 'timbrada') {
      updateData.fecha_timbrado = new Date().toISOString();
    }

    if (status === 'enviada') {
      updateData.email_sent_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('restaurant_invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw new Error(`Error updating invoice status: ${error.message}`);
    return data as Invoice;
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(
    invoiceId: string,
    motivo: '01' | '02' | '03' | '04',
    folioSustitucion?: string
  ): Promise<Invoice> {
    const { data, error } = await this.supabase
      .from('restaurant_invoices')
      .update({
        status: 'cancelada',
        cancelada_at: new Date().toISOString(),
        cancelada_motivo: motivo,
        cancelada_folio_sustitucion: folioSustitucion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw new Error(`Error cancelling invoice: ${error.message}`);
    return data as Invoice;
  }

  // ======================
  // TICKET EXTRACTIONS
  // ======================

  /**
   * Save a ticket extraction
   */
  async saveExtraction(extraction: Partial<TicketExtraction> & { tenant_id: string; image_url: string }): Promise<TicketExtraction> {
    const { data, error } = await this.supabase
      .from('restaurant_ticket_extractions')
      .insert(extraction)
      .select()
      .single();

    if (error) throw new Error(`Error saving extraction: ${error.message}`);
    return data as TicketExtraction;
  }

  /**
   * Update a ticket extraction
   */
  async updateExtraction(extractionId: string, updates: Partial<TicketExtraction>): Promise<TicketExtraction> {
    const { data, error } = await this.supabase
      .from('restaurant_ticket_extractions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', extractionId)
      .select()
      .single();

    if (error) throw new Error(`Error updating extraction: ${error.message}`);
    return data as TicketExtraction;
  }

  /**
   * Get extraction by ID
   */
  async getExtraction(extractionId: string): Promise<TicketExtraction | null> {
    const { data, error } = await this.supabase
      .from('restaurant_ticket_extractions')
      .select('*')
      .eq('id', extractionId)
      .single();

    if (error || !data) return null;
    return data as TicketExtraction;
  }

  /**
   * Get pending extractions
   */
  async getPendingExtractions(tenantId: string): Promise<TicketExtraction[]> {
    const { data, error } = await this.supabase
      .from('restaurant_ticket_extractions')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['completed', 'reviewed'])
      .is('invoice_id', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Error fetching extractions: ${error.message}`);
    return (data || []) as TicketExtraction[];
  }

  // ======================
  // STATISTICS
  // ======================

  /**
   * Get invoice statistics
   */
  async getStatistics(
    tenantId: string,
    options?: {
      branch_id?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<InvoiceStatistics> {
    const { data, error } = await this.supabase.rpc('get_invoice_statistics', {
      p_tenant_id: tenantId,
      p_branch_id: options?.branch_id || null,
      p_start_date: options?.start_date || null,
      p_end_date: options?.end_date || null,
    });

    if (error) throw new Error(`Error fetching statistics: ${error.message}`);

    // Handle empty result
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        total_invoices: 0,
        total_amount: 0,
        invoices_timbradas: 0,
        invoices_canceladas: 0,
        invoices_pendientes: 0,
        avg_invoice_amount: 0,
        invoices_by_day: [],
        top_customers: [],
      };
    }

    const result = Array.isArray(data) ? data[0] : data;
    return result as InvoiceStatistics;
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: InvoiceService | null = null;

export function getInvoiceService(): InvoiceService {
  if (!instance) {
    instance = new InvoiceService();
  }
  return instance;
}
