// =====================================================
// TIS TIS PLATFORM - Analytics Ventas Tab
// Sales metrics and revenue analysis
// =====================================================

'use client';

import { Card, CardHeader, CardContent } from '@/src/shared/components/ui';
import { formatNumber, cn } from '@/src/shared/utils';
import {
  TISAreaChart,
  TISBarChart,
  TISPieChart,
  MetricCard,
  RankingList,
  ProgressBar,
  CHART_COLORS,
} from '../charts';

// ======================
// ICONS
// ======================
const icons = {
  revenue: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ticket: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  items: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  tips: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface VentasTabProps {
  data: {
    // KPIs
    totalRevenue?: number;
    revenueChange?: number;
    avgTicket?: number;
    ticketChange?: number;
    itemsPerOrder?: number;
    itemsChange?: number;
    totalTips?: number;
    tipsChange?: number;
    discountTotal?: number;
    discountPercentage?: number;
    // Chart data
    revenueByHour?: Array<{ label: string; revenue: number; orders: number }>;
    revenueByDay?: Array<{ label: string; revenue: number }>;
    paymentMethods?: Array<{ name: string; value: number; color: string }>;
    topItemsByRevenue?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    categoryRevenue?: Array<{ name: string; value: number; fill: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values for safe data access
const DEFAULT_DATA = {
  totalRevenue: 0,
  revenueChange: 0,
  avgTicket: 0,
  ticketChange: 0,
  itemsPerOrder: 0,
  itemsChange: 0,
  totalTips: 0,
  tipsChange: 0,
  discountTotal: 0,
  discountPercentage: 0,
  revenueByHour: [] as Array<{ label: string; revenue: number; orders: number }>,
  revenueByDay: [] as Array<{ label: string; revenue: number }>,
  paymentMethods: [] as Array<{ name: string; value: number; color: string }>,
  topItemsByRevenue: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  categoryRevenue: [] as Array<{ name: string; value: number; fill: string }>,
};

// ======================
// COMPONENT
// ======================
export function VentasTab({ data, loading, period }: VentasTabProps) {
  // Safe data with defaults - prevents undefined errors
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Ingresos Totales"
          value={`$${formatNumber(safeData.totalRevenue)}`}
          change={safeData.revenueChange}
          changeLabel="vs período anterior"
          icon={icons.revenue}
          iconBgColor="bg-emerald-50"
          trend={safeData.revenueChange > 0 ? 'up' : safeData.revenueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Ticket Promedio"
          value={`$${formatNumber(safeData.avgTicket)}`}
          change={safeData.ticketChange}
          changeLabel="vs período anterior"
          icon={icons.ticket}
          iconBgColor="bg-blue-50"
          trend={safeData.ticketChange > 0 ? 'up' : safeData.ticketChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Items por Orden"
          value={safeData.itemsPerOrder.toFixed(1)}
          change={safeData.itemsChange}
          changeLabel="vs período anterior"
          icon={icons.items}
          iconBgColor="bg-purple-50"
          trend={safeData.itemsChange > 0 ? 'up' : safeData.itemsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Propinas"
          value={`$${formatNumber(safeData.totalTips)}`}
          change={safeData.tipsChange}
          changeLabel="vs período anterior"
          icon={icons.tips}
          iconBgColor="bg-amber-50"
          trend={safeData.tipsChange > 0 ? 'up' : safeData.tipsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
      </div>

      {/* Revenue by Hour Chart */}
      <Card variant="bordered">
        <CardHeader
          title="Ventas por Hora"
          subtitle="Distribución de ingresos durante el día"
        />
        <CardContent>
          <TISBarChart
            data={safeData.revenueByHour.map(item => ({
              name: item.label,
              value: item.revenue,
              fill: CHART_COLORS.primary,
            }))}
            height={280}
            loading={loading}
            layout="horizontal"
            barSize={16}
          />
        </CardContent>
      </Card>

      {/* Two Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <Card variant="bordered">
          <CardHeader title="Métodos de Pago" subtitle="Distribución de transacciones" />
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-2/5">
                <TISPieChart
                  data={safeData.paymentMethods}
                  height={200}
                  loading={loading}
                  innerRadius={45}
                  outerRadius={75}
                />
              </div>
              <div className="flex-1 space-y-4">
                {safeData.paymentMethods.map((method) => {
                  const total = safeData.paymentMethods.reduce((sum, m) => sum + m.value, 0) || 1;
                  const percentage = Math.round((method.value / total) * 100);
                  return (
                    <div key={method.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }} />
                          <span className="text-sm font-medium text-slate-700">{method.name}</span>
                        </div>
                        <span className="text-sm font-bold text-slate-900">${formatNumber(method.value)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: method.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Items by Revenue */}
        <Card variant="bordered">
          <CardHeader title="Top Items por Ingresos" subtitle="Productos más rentables" />
          <CardContent>
            <RankingList
              items={safeData.topItemsByRevenue}
              loading={loading}
              emptyMessage="Sin ventas en este período"
              valuePrefix="$"
            />
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Category */}
      <Card variant="bordered">
        <CardHeader title="Ingresos por Categoría" subtitle="Ventas por tipo de producto" />
        <CardContent>
          <TISBarChart
            data={safeData.categoryRevenue}
            height={240}
            loading={loading}
            layout="vertical"
            barSize={28}
          />
        </CardContent>
      </Card>

      {/* Discounts Summary */}
      <Card variant="bordered">
        <CardHeader title="Resumen de Descuentos" subtitle={`Descuentos aplicados - ${period}`} />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-red-50 rounded-xl">
              <p className="text-sm text-slate-600 mb-1">Total Descuentos</p>
              <p className="text-2xl font-bold text-red-600">-${formatNumber(safeData.discountTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">{safeData.discountPercentage.toFixed(1)}% del total</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <p className="text-sm text-slate-600 mb-1">Ingreso Neto</p>
              <p className="text-2xl font-bold text-emerald-600">${formatNumber(safeData.totalRevenue - safeData.discountTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">Después de descuentos</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-slate-600 mb-1">Descuento Promedio</p>
              <p className="text-2xl font-bold text-blue-600">{safeData.discountPercentage.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">Por transacción</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
