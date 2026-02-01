/**
 * TIS TIS PLATFORM - Admin Channel Analytics Service
 *
 * Consultas de analytics para reportes B2B.
 * Obtiene métricas de ventas, leads, IA y operaciones.
 *
 * @module admin-channel/services/analytics
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AdminAnalyticsReport } from '../types';
import { validateUUID } from '../utils/helpers';

// =====================================================
// CONSTANTS
// =====================================================

const LOG_PREFIX = '[AdminChannel/Analytics]';

// Valid verticals
const VALID_VERTICALS = ['dental', 'clinic', 'restaurant', 'beauty', 'gym', 'veterinary', 'general'];

function validateVertical(value: string): string {
  if (!VALID_VERTICALS.includes(value)) {
    console.warn(`${LOG_PREFIX} Unknown vertical: ${value}, defaulting to 'general'`);
    return 'general';
  }
  return value;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// =====================================================
// SERVICE CLASS
// =====================================================

export class AnalyticsService {
  private supabase: SupabaseClient;

  constructor() {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // =====================================================
  // FULL REPORT
  // =====================================================

  async getFullReport(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly',
    vertical: string
  ): Promise<AdminAnalyticsReport> {
    // Validate inputs
    validateUUID(tenantId, 'tenantId');
    const safeVertical = validateVertical(vertical);

    const { startDate, endDate } = this.getPeriodDates(period);

    const [sales, leads, ai, operations] = await Promise.all([
      this.getSalesData(tenantId, startDate, endDate),
      this.getLeadsData(tenantId, startDate, endDate),
      this.getAIData(tenantId, startDate, endDate),
      this.getOperationsData(tenantId, startDate, endDate, vertical),
    ]);

    // Calcular cambio porcentual vs período anterior
    const previousPeriod = this.getPreviousPeriodDates(period);
    const previousSales = await this.getSalesData(
      tenantId,
      previousPeriod.startDate,
      previousPeriod.endDate
    );

    const revenueChange =
      previousSales.total > 0
        ? Math.round(((sales.total - previousSales.total) / previousSales.total) * 100)
        : 0;

    return {
      type: period,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      summary: {
        totalRevenue: sales.total,
        totalOrders: sales.count,
        totalLeads: leads.total,
        newCustomers: leads.converted,
        conversionRate: leads.conversionRate,
      },
      sales: {
        total: sales.total,
        count: sales.count,
        averageTicket: sales.averageTicket,
        byChannel: {},
        topProducts: [],
      },
      leads: {
        total: leads.total,
        new: leads.new,
        converted: leads.converted,
        bySource: {},
        hotLeads: leads.hot,
      },
      appointments: operations.appointments
        ? {
            total: operations.appointments,
            completed: 0,
            cancelled: 0,
            noShow: 0,
            upcoming: 0,
          }
        : undefined,
      aiPerformance: {
        totalConversations: ai.conversations,
        messagesProcessed: ai.messages,
        averageResponseTime: 0,
        escalationRate: ai.escalationRate,
        satisfactionScore: 0,
      },
      comparison: {
        revenueChange,
        ordersChange: 0,
        leadsChange: 0,
      },
      generatedAt: new Date(),
    };
  }

  // =====================================================
  // SALES REPORT
  // =====================================================

  async getSalesReport(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<AdminAnalyticsReport> {
    // P0 Security: Validate tenantId
    validateUUID(tenantId, 'tenantId');

    const { startDate, endDate } = this.getPeriodDates(period);
    const sales = await this.getSalesData(tenantId, startDate, endDate);

    const previousPeriod = this.getPreviousPeriodDates(period);
    const previousSales = await this.getSalesData(
      tenantId,
      previousPeriod.startDate,
      previousPeriod.endDate
    );

    const revenueChange =
      previousSales.total > 0
        ? Math.round(((sales.total - previousSales.total) / previousSales.total) * 100)
        : 0;

    return {
      type: period,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      summary: {
        totalRevenue: sales.total,
        totalOrders: sales.count,
        totalLeads: 0,
        newCustomers: 0,
        conversionRate: 0,
      },
      sales: {
        total: sales.total,
        count: sales.count,
        averageTicket: sales.averageTicket,
        byChannel: {},
        topProducts: [],
      },
      comparison: {
        revenueChange,
        ordersChange: 0,
        leadsChange: 0,
      },
      generatedAt: new Date(),
    };
  }

  // =====================================================
  // LEADS REPORT
  // =====================================================

  async getLeadsReport(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<AdminAnalyticsReport> {
    // P0 Security: Validate tenantId
    validateUUID(tenantId, 'tenantId');

    const { startDate, endDate } = this.getPeriodDates(period);
    const leads = await this.getLeadsData(tenantId, startDate, endDate);

    return {
      type: period,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      summary: {
        totalRevenue: 0,
        totalOrders: 0,
        totalLeads: leads.total,
        newCustomers: leads.converted,
        conversionRate: leads.conversionRate,
      },
      leads: {
        total: leads.total,
        new: leads.new,
        converted: leads.converted,
        bySource: {},
        hotLeads: leads.hot,
      },
      generatedAt: new Date(),
    };
  }

  // =====================================================
  // ORDERS REPORT (Restaurantes)
  // =====================================================

  async getOrdersReport(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<AdminAnalyticsReport> {
    // P0 Security: Validate tenantId
    validateUUID(tenantId, 'tenantId');

    const { startDate, endDate } = this.getPeriodDates(period);

    // Query específica para orders (restaurantes) o appointments
    const { data: orders, error } = await this.supabase
      .from('appointments')
      .select('id, status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error(`${LOG_PREFIX} Orders query error:`, error);
    }

    const orderList = orders || [];
    const completed = orderList.filter((o) => o.status === 'completed').length;
    const cancelled = orderList.filter((o) => o.status === 'cancelled').length;

    return {
      type: period,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      summary: {
        totalRevenue: 0,
        totalOrders: orderList.length,
        totalLeads: 0,
        newCustomers: 0,
        conversionRate: 0,
      },
      appointments: {
        total: orderList.length,
        completed,
        cancelled,
        noShow: 0,
        upcoming: 0,
      },
      generatedAt: new Date(),
    };
  }

  // =====================================================
  // INVENTORY REPORT
  // =====================================================

  async getInventoryReport(tenantId: string): Promise<AdminAnalyticsReport> {
    // P0 Security: Validate tenantId
    validateUUID(tenantId, 'tenantId');

    const { data: inventory, error } = await this.supabase
      .from('inventory_items')
      .select('id, name, current_stock, min_stock, status')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error(`${LOG_PREFIX} Inventory query error:`, error);
    }

    const items = inventory || [];
    const lowStockItems = items.filter(
      (i) => (i.current_stock || 0) <= (i.min_stock || 0)
    );
    const outOfStock = items.filter((i) => (i.current_stock || 0) === 0);

    const today = new Date();

    return {
      type: 'daily',
      period: {
        start: today,
        end: today,
      },
      summary: {
        totalRevenue: 0,
        totalOrders: 0,
        totalLeads: 0,
        newCustomers: 0,
        conversionRate: 0,
      },
      inventory: {
        lowStockItems: lowStockItems.length,
        outOfStockItems: outOfStock.length,
        totalValue: 0,
        alerts: lowStockItems.slice(0, 5).map((item) => ({
          item: item.name || 'Sin nombre',
          current: item.current_stock || 0,
          minimum: item.min_stock || 0,
        })),
      },
      generatedAt: new Date(),
    };
  }

  // =====================================================
  // AI PERFORMANCE REPORT
  // =====================================================

  async getAIPerformanceReport(
    tenantId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<AdminAnalyticsReport> {
    // P0 Security: Validate tenantId
    validateUUID(tenantId, 'tenantId');

    const { startDate, endDate } = this.getPeriodDates(period);
    const ai = await this.getAIData(tenantId, startDate, endDate);

    return {
      type: period,
      period: {
        start: new Date(startDate),
        end: new Date(endDate),
      },
      summary: {
        totalRevenue: 0,
        totalOrders: 0,
        totalLeads: 0,
        newCustomers: 0,
        conversionRate: 0,
      },
      aiPerformance: {
        totalConversations: ai.conversations,
        messagesProcessed: ai.messages,
        averageResponseTime: 0,
        escalationRate: ai.escalationRate,
        satisfactionScore: ai.resolutionRate,
      },
      generatedAt: new Date(),
    };
  }

  // =====================================================
  // DATA QUERIES
  // =====================================================

  private async getSalesData(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{ total: number; count: number; averageTicket: number }> {
    // Query a quotes pagadas
    const { data: quotes, error } = await this.supabase
      .from('quotes')
      .select('id, total_amount, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error(`${LOG_PREFIX} Sales query error:`, error);
    }

    const quoteList = quotes || [];
    const total = quoteList.reduce((sum, q) => sum + (q.total_amount || 0), 0);

    return {
      total,
      count: quoteList.length,
      averageTicket: quoteList.length > 0 ? total / quoteList.length : 0,
    };
  }

  private async getLeadsData(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total: number;
    new: number;
    hot: number;
    warm: number;
    cold: number;
    converted: number;
    conversionRate: number;
  }> {
    const { data: leads, error } = await this.supabase
      .from('leads')
      .select('id, score, status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error(`${LOG_PREFIX} Leads query error:`, error);
    }

    const leadList = leads || [];

    const hot = leadList.filter((l) => (l.score || 0) >= 80).length;
    const warm = leadList.filter((l) => (l.score || 0) >= 50 && (l.score || 0) < 80).length;
    const cold = leadList.filter((l) => (l.score || 0) < 50).length;
    const converted = leadList.filter((l) => l.status === 'converted').length;

    return {
      total: leadList.length,
      new: leadList.length,
      hot,
      warm,
      cold,
      converted,
      conversionRate:
        leadList.length > 0 ? Math.round((converted / leadList.length) * 100) : 0,
    };
  }

  private async getAIData(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    conversations: number;
    messages: number;
    resolved: number;
    escalated: number;
    resolutionRate: number;
    escalationRate: number;
  }> {
    const { data: conversations, error } = await this.supabase
      .from('conversations')
      .select('id, status, channel, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error(`${LOG_PREFIX} AI query error:`, error);
    }

    const convList = conversations || [];
    const convIds = convList.map((c) => c.id);

    // Contar mensajes
    let messageCount = 0;
    if (convIds.length > 0) {
      const { count } = await this.supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds);
      messageCount = count || 0;
    }

    const resolved = convList.filter((c) => c.status === 'resolved').length;
    const escalated = convList.filter((c) => c.status === 'escalated').length;

    return {
      conversations: convList.length,
      messages: messageCount,
      resolved,
      escalated,
      resolutionRate:
        convList.length > 0 ? Math.round((resolved / convList.length) * 100) : 0,
      escalationRate:
        convList.length > 0 ? Math.round((escalated / convList.length) * 100) : 0,
    };
  }

  private async getOperationsData(
    tenantId: string,
    startDate: string,
    endDate: string,
    vertical: string
  ): Promise<{ appointments?: number; orders?: number }> {
    const operations: { appointments?: number; orders?: number } = {};

    // Appointments (dental, clinic, beauty)
    if (['dental', 'clinic', 'beauty', 'veterinary'].includes(vertical)) {
      const { count } = await this.supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('scheduled_at', startDate)
        .lte('scheduled_at', endDate);

      operations.appointments = count || 0;
    }

    // Orders (restaurant)
    if (vertical === 'restaurant') {
      const { count } = await this.supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      operations.orders = count || 0;
    }

    return operations;
  }

  // =====================================================
  // DATE HELPERS
  // =====================================================

  private getPeriodDates(period: 'daily' | 'weekly' | 'monthly'): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    const endDate = now.toISOString();

    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate,
    };
  }

  private getPreviousPeriodDates(period: 'daily' | 'weekly' | 'monthly'): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'daily':
        endDate = new Date(now);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(endDate);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        endDate = new Date(now);
        endDate.setDate(now.getDate() - 7);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        endDate = new Date(now);
        endDate.setMonth(now.getMonth() - 1);
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }
}

// =====================================================
// SINGLETON
// =====================================================

let _service: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!_service) {
    _service = new AnalyticsService();
  }
  return _service;
}
