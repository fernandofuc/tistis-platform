// =====================================================
// TIS TIS PLATFORM - Analytics Resumen Tab
// Overview dashboard with key metrics for restaurant
// =====================================================

'use client';

import { Card, CardHeader, CardContent } from '@/src/shared/components/ui';
import { formatNumber, cn } from '@/src/shared/utils';
import {
  TISAreaChart,
  TISPieChart,
  TISBarChart,
  MetricCard,
  RankingList,
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
  orders: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  tables: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="2" rx="0.5" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12v4M17 12v4" />
      <circle cx="4" cy="11" r="1.5" strokeWidth={1.5} />
      <circle cx="20" cy="11" r="1.5" strokeWidth={1.5} />
    </svg>
  ),
  trendUp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface ResumenTabProps {
  data: {
    // KPIs
    totalRevenue?: number;
    revenueChange?: number;
    totalOrders?: number;
    ordersChange?: number;
    avgPrepTime?: number;
    prepTimeChange?: number;
    tableOccupancy?: number;
    occupancyChange?: number;
    avgTicket?: number;
    ticketChange?: number;
    // Chart data
    dailyRevenue?: Array<{ label: string; revenue: number; orders: number; avgTicket: number }>;
    ordersByType?: Array<{ name: string; value: number; color: string }>;
    topItems?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    ordersByStatus?: Array<{ name: string; value: number; fill: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values for safe data access
const DEFAULT_DATA = {
  totalRevenue: 0,
  revenueChange: 0,
  totalOrders: 0,
  ordersChange: 0,
  avgPrepTime: 0,
  prepTimeChange: 0,
  tableOccupancy: 0,
  occupancyChange: 0,
  avgTicket: 0,
  ticketChange: 0,
  dailyRevenue: [] as Array<{ label: string; revenue: number; orders: number; avgTicket: number }>,
  ordersByType: [] as Array<{ name: string; value: number; color: string }>,
  topItems: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  ordersByStatus: [] as Array<{ name: string; value: number; fill: string }>,
};

// ======================
// COMPONENT
// ======================
export function ResumenTab({ data, loading, period }: ResumenTabProps) {
  // Safe data with defaults - prevents undefined errors
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Ingresos"
          value={`$${formatNumber(safeData.totalRevenue)}`}
          change={safeData.revenueChange}
          changeLabel="vs período anterior"
          icon={icons.revenue}
          iconBgColor="bg-emerald-50"
          trend={safeData.revenueChange > 0 ? 'up' : safeData.revenueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Órdenes"
          value={formatNumber(safeData.totalOrders)}
          change={safeData.ordersChange}
          changeLabel="vs período anterior"
          icon={icons.orders}
          iconBgColor="bg-blue-50"
          trend={safeData.ordersChange > 0 ? 'up' : safeData.ordersChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Ticket Promedio"
          value={`$${formatNumber(safeData.avgTicket)}`}
          change={safeData.ticketChange}
          changeLabel="vs período anterior"
          icon={icons.trendUp}
          iconBgColor="bg-tis-coral/10"
          trend={safeData.ticketChange > 0 ? 'up' : safeData.ticketChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Tiempo Prep."
          value={`${safeData.avgPrepTime} min`}
          change={safeData.prepTimeChange}
          changeLabel="vs período anterior"
          icon={icons.clock}
          iconBgColor="bg-purple-50"
          trend={safeData.prepTimeChange < 0 ? 'up' : safeData.prepTimeChange > 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Ocupación"
          value={`${safeData.tableOccupancy}%`}
          change={safeData.occupancyChange}
          changeLabel="vs período anterior"
          icon={icons.tables}
          iconBgColor="bg-amber-50"
          trend={safeData.occupancyChange > 0 ? 'up' : safeData.occupancyChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Main Chart - Revenue Trend */}
      <Card variant="bordered" className="overflow-hidden">
        <CardHeader
          title="Tendencia de Ventas"
          subtitle={`Ingresos, órdenes y ticket promedio - ${period}`}
        />
        <CardContent className="pt-2">
          <TISAreaChart
            data={safeData.dailyRevenue}
            areas={[
              { dataKey: 'revenue', name: 'Ingresos ($)', color: CHART_COLORS.success },
              { dataKey: 'orders', name: 'Órdenes', color: CHART_COLORS.blue },
              { dataKey: 'avgTicket', name: 'Ticket Prom.', color: CHART_COLORS.primary },
            ]}
            height={320}
            loading={loading}
            formatter={(value, name) => {
              if (name.includes('$') || name.includes('Ticket')) return `$${value.toLocaleString()}`;
              return value.toLocaleString();
            }}
          />
        </CardContent>
      </Card>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders by Type - Pie Chart */}
        <Card variant="bordered">
          <CardHeader title="Órdenes por Tipo" subtitle="Distribución de canales" />
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-1/2">
                <TISPieChart
                  data={safeData.ordersByType}
                  height={180}
                  loading={loading}
                  innerRadius={40}
                  outerRadius={70}
                />
              </div>
              <div className="flex-1 space-y-3">
                {safeData.ordersByType.map((item) => {
                  const total = safeData.ordersByType.reduce((sum, i) => sum + i.value, 0) || 1;
                  const percentage = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-slate-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.value}</span>
                        <span className="text-xs text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Items - Ranking */}
        <Card variant="bordered">
          <CardHeader title="Top 5 Items" subtitle="Más vendidos del período" />
          <CardContent>
            <RankingList
              items={safeData.topItems}
              loading={loading}
              emptyMessage="Sin ventas en este período"
              valuePrefix=""
              valueSuffix=" uds"
            />
          </CardContent>
        </Card>

        {/* Orders by Status - Bar Chart */}
        <Card variant="bordered">
          <CardHeader title="Estado de Órdenes" subtitle="Distribución actual" />
          <CardContent>
            <TISBarChart
              data={safeData.ordersByStatus}
              height={200}
              loading={loading}
              layout="vertical"
              barSize={20}
            />
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickStatCard
          label="Órdenes Completadas"
          value={safeData.ordersByStatus.find(s => s.name === 'Completadas')?.value || 0}
          total={safeData.totalOrders}
          color="bg-emerald-500"
          bgColor="bg-emerald-50"
          loading={loading}
        />
        <QuickStatCard
          label="En Preparación"
          value={safeData.ordersByStatus.find(s => s.name === 'Preparando')?.value || 0}
          total={safeData.totalOrders}
          color="bg-amber-500"
          bgColor="bg-amber-50"
          loading={loading}
        />
        <QuickStatCard
          label="Canceladas"
          value={safeData.ordersByStatus.find(s => s.name === 'Canceladas')?.value || 0}
          total={safeData.totalOrders}
          color="bg-red-500"
          bgColor="bg-red-50"
          loading={loading}
        />
        <QuickStatCard
          label="Pendientes"
          value={safeData.ordersByStatus.find(s => s.name === 'Pendientes')?.value || 0}
          total={safeData.totalOrders}
          color="bg-slate-500"
          bgColor="bg-slate-50"
          loading={loading}
        />
      </div>
    </div>
  );
}

// ======================
// QUICK STAT CARD
// ======================
interface QuickStatCardProps {
  label: string;
  value: number;
  total: number;
  color: string;
  bgColor: string;
  loading?: boolean;
}

function QuickStatCard({ label, value, total, color, bgColor, loading }: QuickStatCardProps) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  if (loading) {
    return (
      <div className={cn('p-4 rounded-xl animate-pulse', bgColor)}>
        <div className="h-3 bg-white/60 rounded w-2/3 mb-3" />
        <div className="h-6 bg-white/60 rounded w-1/3 mb-2" />
        <div className="h-2 bg-white/60 rounded w-full" />
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-xl', bgColor)}>
      <p className="text-sm text-slate-600 font-medium mb-1">{label}</p>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        <span className="text-sm text-slate-500">({percentage}%)</span>
      </div>
      <div className="w-full bg-white/60 rounded-full h-1.5">
        <div
          className={cn('h-1.5 rounded-full transition-all duration-500', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
