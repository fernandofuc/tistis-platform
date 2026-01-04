// =====================================================
// TIS TIS PLATFORM - Analytics Operaciones Tab
// Operations metrics: prep time, efficiency, tables
// =====================================================

'use client';

import { Card, CardHeader, CardContent } from '@/src/shared/components/ui';
import { formatNumber, cn } from '@/src/shared/utils';
import {
  TISAreaChart,
  TISBarChart,
  TISLineChart,
  MetricCard,
  RankingList,
  ProgressBar,
  CHART_COLORS,
} from '../charts';

// ======================
// ICONS
// ======================
const icons = {
  clock: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  table: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="2" rx="0.5" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12v4M17 12v4" />
    </svg>
  ),
  flame: (
    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface OperacionesTabProps {
  data: {
    // KPIs
    avgPrepTime?: number;
    prepTimeChange?: number;
    completedOrders?: number;
    completedRate?: number;
    cancelledOrders?: number;
    cancellationRate?: number;
    tableOccupancy?: number;
    avgTurnover?: number;
    // Chart data
    prepTimeByHour?: Array<{ label: string; prepTime: number; orders: number }>;
    prepTimeByStation?: Array<{ name: string; value: number; fill: string }>;
    ordersByHourHeatmap?: Array<{ label: string; value: number }>;
    serverPerformance?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    slowestItems?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    tableUtilization?: Array<{ name: string; value: number; fill: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values for safe data access
const DEFAULT_DATA = {
  avgPrepTime: 0,
  prepTimeChange: 0,
  completedOrders: 0,
  completedRate: 0,
  cancelledOrders: 0,
  cancellationRate: 0,
  tableOccupancy: 0,
  avgTurnover: 0,
  prepTimeByHour: [] as Array<{ label: string; prepTime: number; orders: number }>,
  prepTimeByStation: [] as Array<{ name: string; value: number; fill: string }>,
  ordersByHourHeatmap: [] as Array<{ label: string; value: number }>,
  serverPerformance: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  slowestItems: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  tableUtilization: [] as Array<{ name: string; value: number; fill: string }>,
};

// ======================
// COMPONENT
// ======================
export function OperacionesTab({ data, loading, period }: OperacionesTabProps) {
  // Safe data with defaults - prevents undefined errors
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Tiempo Promedio"
          value={`${safeData.avgPrepTime} min`}
          change={safeData.prepTimeChange}
          changeLabel="vs período anterior"
          icon={icons.clock}
          iconBgColor="bg-purple-50"
          trend={safeData.prepTimeChange < 0 ? 'up' : safeData.prepTimeChange > 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Órdenes Completadas"
          value={formatNumber(safeData.completedOrders)}
          change={safeData.completedRate}
          changeLabel="tasa de éxito"
          icon={icons.check}
          iconBgColor="bg-emerald-50"
          trend="up"
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Cancelaciones"
          value={formatNumber(safeData.cancelledOrders)}
          change={safeData.cancellationRate}
          changeLabel="tasa de cancelación"
          icon={icons.x}
          iconBgColor="bg-red-50"
          trend={safeData.cancellationRate > 5 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Ocupación Mesas"
          value={`${safeData.tableOccupancy}%`}
          change={safeData.avgTurnover}
          changeLabel="rotaciones/día"
          icon={icons.table}
          iconBgColor="bg-amber-50"
          trend={safeData.tableOccupancy > 70 ? 'up' : 'neutral'}
          loading={loading}
          size="lg"
        />
      </div>

      {/* Prep Time by Hour */}
      <Card variant="bordered">
        <CardHeader
          title="Tiempo de Preparación por Hora"
          subtitle="Rendimiento operativo durante el día"
        />
        <CardContent>
          <TISLineChart
            data={safeData.prepTimeByHour}
            lines={[
              { dataKey: 'prepTime', name: 'Tiempo Prep. (min)', color: CHART_COLORS.primary },
              { dataKey: 'orders', name: 'Órdenes', color: CHART_COLORS.blue },
            ]}
            height={300}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Two Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prep Time by Station */}
        <Card variant="bordered">
          <CardHeader title="Tiempo por Estación" subtitle="Promedio de preparación" />
          <CardContent>
            <TISBarChart
              data={safeData.prepTimeByStation}
              height={240}
              loading={loading}
              layout="vertical"
              barSize={24}
            />
          </CardContent>
        </Card>

        {/* Slowest Items */}
        <Card variant="bordered">
          <CardHeader
            title="Items más Lentos"
            subtitle="Requieren optimización"
            action={
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                {icons.flame}
                Atención
              </span>
            }
          />
          <CardContent>
            <RankingList
              items={safeData.slowestItems}
              loading={loading}
              emptyMessage="Sin datos de preparación"
              valueSuffix=" min"
            />
          </CardContent>
        </Card>
      </div>

      {/* Server Performance */}
      <Card variant="bordered">
        <CardHeader title="Rendimiento de Meseros" subtitle="Órdenes atendidas y ticket promedio" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-3">Top Meseros por Órdenes</h4>
              <RankingList
                items={safeData.serverPerformance}
                loading={loading}
                emptyMessage="Sin datos de meseros"
                valueSuffix=" órdenes"
              />
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-3">Métricas Clave</h4>
              <div className="space-y-4">
                <ProgressBar
                  label="Tasa de Completado"
                  value={safeData.completedRate}
                  color="bg-emerald-500"
                />
                <ProgressBar
                  label="Ocupación de Mesas"
                  value={safeData.tableOccupancy}
                  color="bg-blue-500"
                />
                <ProgressBar
                  label="Eficiencia Cocina"
                  value={Math.max(0, 100 - ((isNaN(safeData.avgPrepTime) ? 0 : safeData.avgPrepTime) / 30 * 100))}
                  color="bg-purple-500"
                />
                <ProgressBar
                  label="Sin Cancelaciones"
                  value={100 - safeData.cancellationRate}
                  color="bg-tis-coral"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Utilization */}
      <Card variant="bordered">
        <CardHeader title="Utilización de Mesas" subtitle="Estado y ocupación" />
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {safeData.tableUtilization.map((item) => (
              <div key={item.name} className="p-4 rounded-xl" style={{ backgroundColor: `${item.fill}15` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm font-medium text-slate-700">{item.name}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">mesas</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Peak Hours Heatmap */}
      <Card variant="bordered">
        <CardHeader title="Horas Pico" subtitle="Volumen de órdenes por hora" />
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {safeData.ordersByHourHeatmap.map((item, index) => {
              const maxValue = Math.max(...safeData.ordersByHourHeatmap.map(h => h.value), 1);
              const intensity = item.value / maxValue;
              return (
                <div
                  key={index}
                  className="flex flex-col items-center p-2 rounded-lg min-w-[50px]"
                  style={{
                    backgroundColor: `rgba(223, 115, 115, ${0.1 + intensity * 0.6})`,
                  }}
                >
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className={cn(
                    'text-sm font-bold',
                    intensity > 0.7 ? 'text-white' : 'text-slate-900'
                  )}>
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500">
            <span>Bajo</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((opacity) => (
                <div
                  key={opacity}
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: `rgba(223, 115, 115, ${opacity})` }}
                />
              ))}
            </div>
            <span>Alto</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
