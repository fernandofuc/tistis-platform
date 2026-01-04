// =====================================================
// TIS TIS PLATFORM - Analytics Types
// Type definitions for analytics data and components
// =====================================================

import { Period } from '@/src/shared/utils/analyticsHelpers';

// ======================
// COMMON TYPES
// ======================

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ColoredDataPoint extends ChartDataPoint {
  color: string;
}

export interface FilledDataPoint {
  name: string;
  value: number;
  fill: string;
}

export interface RankingItem {
  rank: number;
  name: string;
  value: number | string;
  subValue?: string;
}

export type TrendDirection = 'up' | 'down' | 'neutral';

// ======================
// RESUMEN TAB TYPES
// ======================

export interface DailyRevenueData {
  label: string;
  revenue: number;
  orders: number;
  avgTicket: number;
}

export interface OrdersByTypeData {
  name: string;
  value: number;
  color: string;
}

export interface ResumenTabData {
  // KPIs
  totalRevenue: number;
  revenueChange: number;
  totalOrders: number;
  ordersChange: number;
  avgPrepTime: number;
  prepTimeChange: number;
  tableOccupancy: number;
  occupancyChange: number;
  avgTicket: number;
  ticketChange: number;

  // Charts
  dailyRevenue: DailyRevenueData[];
  ordersByType: OrdersByTypeData[];
  topItems: RankingItem[];
  ordersByStatus: FilledDataPoint[];
}

// ======================
// VENTAS TAB TYPES
// ======================

export interface RevenueByHourData {
  label: string;
  revenue: number;
  orders: number;
}

export interface PaymentMethodData {
  name: string;
  value: number;
  color: string;
}

export interface VentasTabData {
  // KPIs
  totalRevenue: number;
  revenueChange: number;
  avgTicket: number;
  ticketChange: number;
  itemsPerOrder: number;
  itemsChange: number;
  totalTips: number;
  tipsChange: number;
  discountTotal: number;
  discountPercentage: number;

  // Charts
  revenueByHour: RevenueByHourData[];
  revenueByDay: ChartDataPoint[];
  paymentMethods: PaymentMethodData[];
  topItemsByRevenue: RankingItem[];
  categoryRevenue: FilledDataPoint[];
}

// ======================
// OPERACIONES TAB TYPES
// ======================

export interface PrepTimeByHourData {
  label: string;
  prepTime: number;
  orders: number;
}

export interface OperacionesTabData {
  // KPIs
  avgPrepTime: number;
  prepTimeChange: number;
  completedOrders: number;
  completedRate: number;
  cancelledOrders: number;
  cancellationRate: number;
  tableOccupancy: number;
  avgTurnover: number;

  // Charts
  prepTimeByHour: PrepTimeByHourData[];
  prepTimeByStation: FilledDataPoint[];
  ordersByHourHeatmap: ChartDataPoint[];
  serverPerformance: RankingItem[];
  slowestItems: RankingItem[];
  tableUtilization: FilledDataPoint[];
}

// ======================
// INVENTARIO TAB TYPES
// ======================

export interface InventoryMovementData {
  label: string;
  entrada: number;
  salida: number;
  ajuste: number;
}

export interface StorageDistributionData {
  name: string;
  value: number;
  color: string;
}

export interface InventarioTabData {
  // KPIs
  totalItems: number;
  lowStockCount: number;
  expiringCount: number;
  stockValue: number;
  stockValueChange: number;
  wasteValue: number;
  wastePercentage: number;

  // Charts
  stockByCategory: FilledDataPoint[];
  movementTrend: InventoryMovementData[];
  lowStockItems: RankingItem[];
  expiringItems: RankingItem[];
  topUsedItems: RankingItem[];
  storageDistribution: StorageDistributionData[];
}

// ======================
// CLIENTES TAB TYPES
// ======================

export interface LeadsTrendData {
  label: string;
  leads: number;
  converted: number;
}

export interface LeadClassificationData {
  name: string;
  value: number;
  color: string;
}

export interface ConversionFunnelData {
  name: string;
  value: number;
  percentage: number;
}

export interface ClientesTabData {
  // KPIs
  totalLeads: number;
  leadsChange: number;
  hotLeads: number;
  hotLeadsChange: number;
  loyaltyMembers: number;
  membersChange: number;
  repeatCustomers: number;
  repeatRate: number;
  conversionRate: number;

  // Charts
  leadsTrend: LeadsTrendData[];
  leadsByClassification: LeadClassificationData[];
  leadsBySource: FilledDataPoint[];
  loyaltyTiers: LeadClassificationData[];
  topCustomers: RankingItem[];
  conversionFunnel: ConversionFunnelData[];
}

// ======================
// AI INSIGHTS TAB TYPES
// ======================

export interface ConversationTrendData {
  label: string;
  conversations: number;
  resolved: number;
  escalated: number;
}

export interface ChannelData {
  name: string;
  value: number;
  color: string;
}

export interface IntentData {
  name: string;
  value: number;
  fill: string;
}

export interface ResponseTimeByHourData {
  label: string;
  value: number;
}

export interface AIInsightsTabData {
  // KPIs
  totalConversations: number;
  conversationsChange: number;
  resolvedConversations: number;
  resolutionRate: number;
  avgResponseTime: number;
  responseTimeChange: number;
  escalatedCount: number;
  escalationRate: number;
  aiHandlingRate: number;

  // Charts
  conversationsTrend: ConversationTrendData[];
  conversationsByChannel: ChannelData[];
  intentDistribution: IntentData[];
  responseTimeByHour: ResponseTimeByHourData[];
  topIntents: RankingItem[];
  handlingBreakdown: ChannelData[];
}

// ======================
// DENTAL ANALYTICS TYPES
// ======================

export interface DentalDailyData {
  date: string;
  label: string;
  leads: number;
  appointments: number;
  conversations: number;
}

export interface DentalStats {
  newLeads: number;
  newLeadsChange: number;
  hotLeads: number;
  hotLeadsChange: number;
  appointmentsScheduled: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;
  conversationsTotal: number;
  conversationsResolved: number;
  avgResponseTime: number;
  conversionRate: number;
  conversionRateChange: number;
}

export interface LeadsByClassification {
  hot: number;
  warm: number;
  cold: number;
}

export interface AppointmentsByStatus {
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

// ======================
// COMPONENT PROP TYPES
// ======================

export interface BaseTabProps {
  loading: boolean;
  period: string;
}

export interface ResumenTabProps extends BaseTabProps {
  data: ResumenTabData;
}

export interface VentasTabProps extends BaseTabProps {
  data: VentasTabData;
}

export interface OperacionesTabProps extends BaseTabProps {
  data: OperacionesTabData;
}

export interface InventarioTabProps extends BaseTabProps {
  data: InventarioTabData;
}

export interface ClientesTabProps extends BaseTabProps {
  data: ClientesTabData;
}

export interface AIInsightsTabProps extends BaseTabProps {
  data: AIInsightsTabData;
}

export interface DentalAnalyticsProps {
  tenantId: string;
  selectedBranchId: string | null;
  period: Period;
}

// ======================
// ANALYTICS TAB TYPES
// ======================

export type AnalyticsTabKey =
  | 'resumen'
  | 'ventas'
  | 'operaciones'
  | 'inventario'
  | 'clientes'
  | 'ai';

export interface AnalyticsTab {
  key: AnalyticsTabKey;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ======================
// CHART TYPES
// ======================

export interface AreaConfig {
  dataKey: string;
  name: string;
  color: string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  trend?: TrendDirection;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
