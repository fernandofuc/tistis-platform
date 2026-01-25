// =====================================================
// TIS TIS PLATFORM - Voice Billing Service
// Servicio de facturación para minutos de voz excedentes
// FASE 5.1: Stripe Integration
// With Retry Logic (Exponential Backoff) for reliability
// =====================================================

import Stripe from 'stripe';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createComponentLogger, withStripeRetry } from '@/src/shared/lib';

// ======================
// LOGGER
// ======================

const logger = createComponentLogger('voice-billing');

// ======================
// CONSTANTS
// ======================

const OVERAGE_PRICE_PER_MINUTE_MXN = 3.50;
const OVERAGE_PRICE_PER_MINUTE_CENTS = 350; // $3.50 MXN en centavos

// ======================
// TYPES
// ======================

export interface TenantBillingInfo {
  tenantId: string;
  tenantName: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  overageMinutes: number;
  overageChargesCentavos: number;
  overageAmount: number; // en MXN
  periodStart: Date;
  periodEnd: Date;
}

export interface BillingResult {
  success: boolean;
  tenantId: string;
  invoiceItemId?: string;
  amount?: number;
  error?: string;
}

export interface MonthlyBillingReport {
  processedAt: Date;
  tenantsProcessed: number;
  tenantsWithOverage: number;
  totalOverageMinutes: number;
  totalOverageAmount: number;
  results: BillingResult[];
  errors: string[];
}

export interface BillingHistoryItem {
  usageId: string;
  periodStart: Date;
  periodEnd: Date;
  includedMinutesUsed: number;
  overageMinutesUsed: number;
  totalMinutesUsed: number;
  overageChargesCentavos: number;
  overageChargesPesos: number;
  totalCalls: number;
  isBilled: boolean;
  stripeInvoiceId: string | null;
  createdAt: Date;
}

export interface OveragePreview {
  currentOverageMinutes: number;
  currentOverageAmount: number;
  currentOverageChargesCentavos: number;
  projectedEndOfMonth: number;
  projectedAmount: number;
  daysElapsed: number;
  daysTotal: number;
  periodStart: Date | null;
  periodEnd: Date | null;
}

// ======================
// STRIPE CLIENT (Lazy)
// ======================

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// ======================
// SUPABASE CLIENT (Service Role - Lazy Singleton)
// ======================

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
    }

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for billing operations');
    }

    _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  }
  return _supabaseAdmin;
}

// ======================
// VALIDATION HELPERS
// ======================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ======================
// MAIN SERVICE CLASS
// ======================

export class VoiceBillingService {
  private static instance: VoiceBillingService;

  private constructor() {}

  static getInstance(): VoiceBillingService {
    if (!VoiceBillingService.instance) {
      VoiceBillingService.instance = new VoiceBillingService();
    }
    return VoiceBillingService.instance;
  }

  // =====================================================
  // GET TENANTS WITH OVERAGE
  // =====================================================

  /**
   * Obtiene todos los tenants con excedentes pendientes de facturar
   * Solo considera tenants con política 'charge' activa
   */
  async getTenantsWithPendingOverage(periodEnd?: Date): Promise<TenantBillingInfo[]> {
    const supabase = getSupabaseAdmin();
    const checkDate = periodEnd || new Date();

    logger.info('Fetching tenants with pending overage', {
      checkDate: checkDate.toISOString(),
    });

    // Query usando RPC
    const { data, error } = await supabase.rpc('get_tenants_pending_overage_billing', {
      p_check_date: checkDate.toISOString(),
    });

    if (error) {
      logger.error('Error fetching tenants with overage', { error: error.message });
      throw new Error(`Failed to fetch overage data: ${error.message}`);
    }

    if (!data || data.length === 0) {
      logger.info('No tenants with pending overage found');
      return [];
    }

    // Map to billing info
    return data.map((row: {
      tenant_id: string;
      tenant_name: string | null;
      stripe_customer_id: string;
      stripe_subscription_id: string;
      overage_minutes: number;
      overage_charges_centavos: number;
      period_start: string;
      period_end: string;
    }) => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name || 'Tenant',
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      overageMinutes: Number(row.overage_minutes),
      overageChargesCentavos: row.overage_charges_centavos,
      // Usar el valor calculado de la DB en lugar de recalcular con precio hardcodeado
      overageAmount: row.overage_charges_centavos / 100,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
    }));
  }

  // =====================================================
  // CREATE INVOICE ITEM FOR OVERAGE
  // =====================================================

  /**
   * Crea un Invoice Item en Stripe para los minutos excedentes
   * El item se agregará a la siguiente factura del cliente
   * Incluye retry logic con exponential backoff para resiliencia
   */
  async createOverageInvoiceItem(billing: TenantBillingInfo): Promise<BillingResult> {
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();

    logger.info('Creating overage invoice item', {
      tenantId: billing.tenantId,
      overageMinutes: billing.overageMinutes,
      amount: billing.overageAmount,
    });

    try {
      // Validar que el customer existe en Stripe (with retry)
      const customerResult = await withStripeRetry(
        () => stripe.customers.retrieve(billing.stripeCustomerId),
        'retrieveCustomer'
      );

      if (!customerResult.success) {
        throw customerResult.error || new Error('Failed to retrieve customer');
      }

      const customer = customerResult.data;
      if ((customer as Stripe.DeletedCustomer).deleted) {
        throw new Error('Stripe customer has been deleted');
      }

      // Calcular monto usando los cargos ya calculados o recalcular
      const amountCentavos = billing.overageChargesCentavos > 0
        ? billing.overageChargesCentavos
        : Math.round(billing.overageMinutes * OVERAGE_PRICE_PER_MINUTE_CENTS);

      // Crear el Invoice Item (with retry)
      // Este se agregará automáticamente a la siguiente factura del subscription
      const invoiceItemResult = await withStripeRetry(
        () => stripe.invoiceItems.create({
          customer: billing.stripeCustomerId,
          subscription: billing.stripeSubscriptionId,
          amount: amountCentavos,
          currency: 'mxn',
          description: `Minutos de voz excedentes: ${billing.overageMinutes.toFixed(1)} minutos @ $${OVERAGE_PRICE_PER_MINUTE_MXN}/min`,
          metadata: {
            tenant_id: billing.tenantId,
            overage_minutes: billing.overageMinutes.toString(),
            period_start: billing.periodStart.toISOString(),
            period_end: billing.periodEnd.toISOString(),
            type: 'voice_overage',
          },
        }),
        'createInvoiceItem'
      );

      if (!invoiceItemResult.success) {
        throw invoiceItemResult.error || new Error('Failed to create invoice item');
      }

      const invoiceItem = invoiceItemResult.data;

      if (!invoiceItem) {
        throw new Error('Invoice item data is undefined');
      }

      logger.info('Invoice item created successfully', {
        invoiceItemId: invoiceItem.id,
        tenantId: billing.tenantId,
        amount: billing.overageAmount,
        attempts: invoiceItemResult.attempts,
        totalTimeMs: invoiceItemResult.totalTimeMs,
      });

      // Marcar como facturado usando RPC
      const { data: markResult, error: markError } = await supabase.rpc('mark_overage_as_billed', {
        p_tenant_id: billing.tenantId,
        p_period_start: billing.periodStart.toISOString(),
        p_stripe_invoice_item_id: invoiceItem.id,
      });

      if (markError) {
        logger.warn('Error marking overage as billed', {
          tenantId: billing.tenantId,
          error: markError.message,
        });
        // No lanzamos error aquí porque el invoice item ya se creó
      } else {
        logger.debug('Overage marked as billed', { result: markResult });
      }

      return {
        success: true,
        tenantId: billing.tenantId,
        invoiceItemId: invoiceItem.id,
        amount: billing.overageAmount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create invoice item', {
        tenantId: billing.tenantId,
        error: errorMessage,
      });

      return {
        success: false,
        tenantId: billing.tenantId,
        error: errorMessage,
      };
    }
  }

  // =====================================================
  // PROCESS MONTHLY BILLING
  // =====================================================

  /**
   * Procesa la facturación mensual de todos los tenants con excedentes
   * Llamado por el cron job diario
   */
  async processMonthlyBilling(): Promise<MonthlyBillingReport> {
    const startTime = Date.now();
    logger.info('Starting monthly overage billing process');

    const report: MonthlyBillingReport = {
      processedAt: new Date(),
      tenantsProcessed: 0,
      tenantsWithOverage: 0,
      totalOverageMinutes: 0,
      totalOverageAmount: 0,
      results: [],
      errors: [],
    };

    try {
      // Obtener tenants con excedentes
      const tenantsWithOverage = await this.getTenantsWithPendingOverage();
      report.tenantsWithOverage = tenantsWithOverage.length;

      if (tenantsWithOverage.length === 0) {
        logger.info('No tenants with pending overage to bill');
        return report;
      }

      // Procesar cada tenant
      for (const tenant of tenantsWithOverage) {
        report.tenantsProcessed++;
        report.totalOverageMinutes += tenant.overageMinutes;

        const result = await this.createOverageInvoiceItem(tenant);
        report.results.push(result);

        if (result.success) {
          report.totalOverageAmount += result.amount || 0;
        } else {
          report.errors.push(`${tenant.tenantId}: ${result.error}`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const duration = Date.now() - startTime;
      logger.info('Monthly billing process completed', {
        duration: `${duration}ms`,
        tenantsProcessed: report.tenantsProcessed,
        tenantsWithOverage: report.tenantsWithOverage,
        totalAmount: report.totalOverageAmount,
        errors: report.errors.length,
      });

      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Monthly billing process failed', { error: errorMessage });
      report.errors.push(`Process error: ${errorMessage}`);
      return report;
    }
  }

  // =====================================================
  // GET BILLING HISTORY
  // =====================================================

  /**
   * Obtiene el historial de facturación de un tenant
   */
  async getBillingHistory(
    tenantId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    items: BillingHistoryItem[];
    total: number;
  }> {
    // Validar UUID
    if (!isValidUUID(tenantId)) {
      logger.error('Invalid tenantId format in getBillingHistory', { tenantId });
      throw new Error('Invalid tenant ID format');
    }

    const supabase = getSupabaseAdmin();
    const { limit = 12, offset = 0 } = options;

    const { data, error } = await supabase.rpc('get_voice_billing_history', {
      p_tenant_id: tenantId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      logger.error('Error fetching billing history', { error: error.message });
      throw new Error(`Failed to fetch billing history: ${error.message}`);
    }

    const items: BillingHistoryItem[] = (data || []).map((row: {
      usage_id: string;
      period_start: string;
      period_end: string;
      included_minutes_used: number;
      overage_minutes_used: number;
      total_minutes_used: number;
      overage_charges_centavos: number;
      overage_charges_pesos: number;
      total_calls: number;
      is_billed: boolean;
      stripe_invoice_id: string | null;
      created_at: string;
    }) => ({
      usageId: row.usage_id,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      includedMinutesUsed: Number(row.included_minutes_used),
      overageMinutesUsed: Number(row.overage_minutes_used),
      totalMinutesUsed: Number(row.total_minutes_used),
      overageChargesCentavos: row.overage_charges_centavos,
      overageChargesPesos: Number(row.overage_charges_pesos),
      totalCalls: row.total_calls,
      isBilled: row.is_billed,
      stripeInvoiceId: row.stripe_invoice_id,
      createdAt: new Date(row.created_at),
    }));

    // Obtener total count para paginación
    const { count, error: countError } = await supabase
      .from('voice_minute_usage')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) {
      logger.warn('Error getting billing history count', { error: countError.message });
    }

    return {
      items,
      total: count ?? items.length,
    };
  }

  // =====================================================
  // HANDLE PAYMENT CONFIRMATION
  // =====================================================

  /**
   * Maneja la confirmación de pago desde Stripe webhook
   * Actualiza el estado de las transacciones
   * Incluye retry logic para operaciones de Stripe
   */
  async handlePaymentConfirmation(invoiceId: string): Promise<void> {
    const stripe = getStripe();
    const supabase = getSupabaseAdmin();

    logger.info('Processing payment confirmation', { invoiceId });

    try {
      // Obtener detalles del invoice (with retry)
      const invoiceResult = await withStripeRetry(
        () => stripe.invoices.retrieve(invoiceId, {
          expand: ['lines.data'],
        }),
        'retrieveInvoice'
      );

      if (!invoiceResult.success) {
        throw invoiceResult.error || new Error('Failed to retrieve invoice');
      }

      const invoice = invoiceResult.data;

      if (!invoice) {
        logger.warn('Invoice data is undefined', { invoiceId });
        return;
      }

      // Buscar line items de voice overage
      const overageItems = invoice.lines?.data.filter(
        (line) => line.metadata?.type === 'voice_overage'
      );

      if (!overageItems || overageItems.length === 0) {
        logger.debug('No voice overage items in invoice', { invoiceId });
        return;
      }

      // Actualizar estado de pago usando RPC
      for (const item of overageItems) {
        if (!item.id) continue;

        const { error } = await supabase.rpc('update_overage_payment_status', {
          p_stripe_invoice_item_id: item.id,
          p_stripe_invoice_id: invoiceId,
          p_paid_at: new Date().toISOString(),
        });

        if (error) {
          logger.warn('Error updating payment status', {
            invoiceItemId: item.id,
            error: error.message,
          });
        } else {
          logger.info('Payment status updated', {
            tenantId: item.metadata?.tenant_id,
            invoiceItemId: item.id,
            invoiceId,
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing payment confirmation', {
        invoiceId,
        error: errorMessage,
      });
      throw error;
    }
  }

  // =====================================================
  // PREVIEW UPCOMING CHARGES
  // =====================================================

  /**
   * Obtiene una preview de los cargos pendientes para un tenant
   * Útil para mostrar al usuario cuánto se le cobrará
   */
  async previewUpcomingCharges(tenantId: string): Promise<OveragePreview> {
    // Validar UUID
    if (!isValidUUID(tenantId)) {
      logger.error('Invalid tenantId format in previewUpcomingCharges', { tenantId });
      throw new Error('Invalid tenant ID format');
    }

    const supabase = getSupabaseAdmin();

    // Obtener preview usando RPC
    const { data: currentUsage, error } = await supabase.rpc('get_current_overage_preview', {
      p_tenant_id: tenantId,
    });

    if (error) {
      logger.error('Error getting overage preview', { error: error.message });
      throw new Error(`Failed to get overage preview: ${error.message}`);
    }

    const current = currentUsage?.[0] || {
      overage_minutes: 0,
      overage_charges_centavos: 0,
      days_elapsed: 0,
      days_total: 30,
      period_start: null,
      period_end: null,
      overage_price_centavos: OVERAGE_PRICE_PER_MINUTE_CENTS, // fallback to default
    };

    const currentOverageMinutes = Number(current.overage_minutes) || 0;
    const currentOverageChargesCentavos = current.overage_charges_centavos || 0;
    const currentOverageAmount = currentOverageChargesCentavos / 100;
    // Usar precio configurado del tenant, o fallback al default
    const tenantPricePerMinuteCents = current.overage_price_centavos || OVERAGE_PRICE_PER_MINUTE_CENTS;
    const tenantPricePerMinuteMXN = tenantPricePerMinuteCents / 100;

    // Proyección lineal al final del mes
    const daysElapsed = current.days_elapsed || 0;
    const daysTotal = current.days_total || 30;
    const dailyRate = daysElapsed > 0
      ? currentOverageMinutes / daysElapsed
      : 0;
    const projectedEndOfMonth = Math.round(dailyRate * daysTotal);
    const projectedAmount = projectedEndOfMonth * tenantPricePerMinuteMXN;

    return {
      currentOverageMinutes,
      currentOverageAmount,
      currentOverageChargesCentavos,
      projectedEndOfMonth,
      projectedAmount,
      daysElapsed,
      daysTotal,
      periodStart: current.period_start ? new Date(current.period_start) : null,
      periodEnd: current.period_end ? new Date(current.period_end) : null,
    };
  }

  // =====================================================
  // RESET MONTHLY USAGE
  // =====================================================

  /**
   * Crea nuevos registros de uso para el período mensual actual
   * Llamado por cron job al inicio de cada mes
   */
  async resetMonthlyUsage(): Promise<{ success: boolean; tenantsProcessed: number }> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('reset_monthly_voice_usage');

    if (error) {
      logger.error('Error resetting monthly usage', { error: error.message });
      return { success: false, tenantsProcessed: 0 };
    }

    logger.info('Monthly usage reset completed', { result: data });
    return {
      success: data?.success ?? true,
      tenantsProcessed: data?.tenants_processed ?? 0,
    };
  }
}

// ======================
// SINGLETON EXPORT
// ======================

export const voiceBillingService = VoiceBillingService.getInstance();
