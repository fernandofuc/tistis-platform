// =====================================================
// TIS TIS PLATFORM - Reports Feature Types
// Types for PDF report generation
// =====================================================

// ======================
// REPORT PERIODS
// ======================

export type ReportPeriod = '7d' | '30d' | '90d';

export const REPORT_PERIODS: { id: ReportPeriod; label: string; description: string; days: number }[] = [
  { id: '7d', label: 'Últimos 7 días', description: 'Resumen semanal', days: 7 },
  { id: '30d', label: 'Últimos 30 días', description: 'Resumen mensual', days: 30 },
  { id: '90d', label: 'Últimos 90 días', description: 'Resumen trimestral', days: 90 },
];

// ======================
// REPORT TYPES
// ======================

export type ReportType =
  | 'resumen'
  | 'ventas'
  | 'operaciones'
  | 'inventario'
  | 'clientes'
  | 'ai_insights';

export interface ReportTypeConfig {
  id: ReportType;
  label: string;
  description: string;
  color: 'coral' | 'green' | 'blue' | 'purple' | 'amber' | 'pink';
}

export const REPORT_TYPES: ReportTypeConfig[] = [
  { id: 'resumen', label: 'Resumen General', description: 'KPIs principales y tendencias', color: 'coral' },
  { id: 'ventas', label: 'Ventas', description: 'Ingresos, tickets y métodos de pago', color: 'green' },
  { id: 'operaciones', label: 'Operaciones', description: 'Órdenes, tiempos y eficiencia', color: 'blue' },
  { id: 'inventario', label: 'Inventario', description: 'Stock, movimientos y alertas', color: 'purple' },
  { id: 'clientes', label: 'Clientes', description: 'Leads, conversiones y retención', color: 'amber' },
  { id: 'ai_insights', label: 'AI Insights', description: 'Análisis inteligente con IA', color: 'pink' },
];

// ======================
// API TYPES
// ======================

export interface ReportRequest {
  period: ReportPeriod;
  type: ReportType;
  branchId?: string;
}

export interface ReportResponse {
  success: boolean;
  pdfUrl?: string;
  filename?: string;
  expiresAt?: string;
  error?: string;
}

// ======================
// REPORT DATA TYPES
// ======================

export interface ReportMetadata {
  tenantId: string;
  tenantName: string;
  branchName?: string;
  period: ReportPeriod;
  periodLabel: string;
  type: ReportType;
  typeLabel: string;
  generatedAt: string;
  vertical: string;
  logoUrl?: string;
}

export interface ReportKPI {
  label: string;
  value: string | number;
  formattedValue: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  suffix?: string;
  prefix?: string;
}

export interface ReportChartData {
  label: string;
  value: number;
  fill?: string;
}

export interface ReportChart {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  data: ReportChartData[];
  imageBase64?: string;
}

export interface ReportTableRow {
  cells: Array<string | number>;
  highlight?: boolean;
}

export interface ReportTable {
  title: string;
  headers: string[];
  rows: ReportTableRow[];
}

export interface ReportData {
  metadata: ReportMetadata;
  kpis: ReportKPI[];
  charts: ReportChart[];
  tables: ReportTable[];
  summary?: string;
}

// ======================
// FLOW STATE TYPES
// ======================

export type ReportFlowStep = 'period' | 'type' | 'generating' | 'ready' | 'error';

export interface ReportFlowState {
  step: ReportFlowStep;
  period: ReportPeriod | null;
  reportType: ReportType | null;
  pdfUrl: string | null;
  filename: string | null;
  error: string | null;
  progress: number;
}

// ======================
// GENERATION OPTIONS
// ======================

export interface GenerateReportOptions {
  tenantId: string;
  branchId?: string;
  period: ReportPeriod;
  type: ReportType;
}

export interface DateRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}
