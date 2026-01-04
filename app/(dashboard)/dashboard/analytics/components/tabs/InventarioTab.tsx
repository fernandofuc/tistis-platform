// =====================================================
// TIS TIS PLATFORM - Analytics Inventario Tab
// Inventory metrics: stock, alerts, value
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
  inventory: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  expire: (
    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  value: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  waste: (
    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface InventarioTabProps {
  data: {
    // KPIs
    totalItems?: number;
    lowStockCount?: number;
    expiringCount?: number;
    stockValue?: number;
    stockValueChange?: number;
    wasteValue?: number;
    wastePercentage?: number;
    // Chart data
    stockByCategory?: Array<{ name: string; value: number; fill: string }>;
    movementTrend?: Array<{ label: string; entrada: number; salida: number; ajuste: number }>;
    lowStockItems?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    expiringItems?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    topUsedItems?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    storageDistribution?: Array<{ name: string; value: number; color: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values for safe data access
const DEFAULT_DATA = {
  totalItems: 0,
  lowStockCount: 0,
  expiringCount: 0,
  stockValue: 0,
  stockValueChange: 0,
  wasteValue: 0,
  wastePercentage: 0,
  stockByCategory: [] as Array<{ name: string; value: number; fill: string }>,
  movementTrend: [] as Array<{ label: string; entrada: number; salida: number; ajuste: number }>,
  lowStockItems: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  expiringItems: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  topUsedItems: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  storageDistribution: [] as Array<{ name: string; value: number; color: string }>,
};

// ======================
// COMPONENT
// ======================
export function InventarioTab({ data, loading, period }: InventarioTabProps) {
  // Safe data with defaults - prevents undefined errors
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Valor en Stock"
          value={`$${formatNumber(safeData.stockValue)}`}
          change={safeData.stockValueChange}
          changeLabel="vs período anterior"
          icon={icons.value}
          iconBgColor="bg-emerald-50"
          trend={safeData.stockValueChange > 0 ? 'up' : safeData.stockValueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Items Totales"
          value={formatNumber(safeData.totalItems)}
          changeLabel="productos en inventario"
          icon={icons.inventory}
          iconBgColor="bg-blue-50"
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Stock Bajo"
          value={formatNumber(safeData.lowStockCount)}
          changeLabel="requieren reorden"
          icon={icons.alert}
          iconBgColor="bg-amber-50"
          trend={safeData.lowStockCount > 5 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
        <MetricCard
          title="Por Expirar"
          value={formatNumber(safeData.expiringCount)}
          changeLabel="próximos 14 días"
          icon={icons.expire}
          iconBgColor="bg-red-50"
          trend={safeData.expiringCount > 0 ? 'down' : 'neutral'}
          loading={loading}
          size="lg"
        />
      </div>

      {/* Alerts Row */}
      {(safeData.lowStockCount > 0 || safeData.expiringCount > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alert */}
          {safeData.lowStockCount > 0 && (
            <Card variant="bordered" className="border-amber-200 bg-amber-50/30">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {icons.alert}
                    <span>Items con Stock Bajo</span>
                  </span>
                }
                subtitle="Necesitan reabastecimiento"
              />
              <CardContent>
                <RankingList
                  items={safeData.lowStockItems}
                  loading={loading}
                  emptyMessage="Sin alertas de stock"
                  valueSuffix=" uds"
                />
              </CardContent>
            </Card>
          )}

          {/* Expiring Alert */}
          {safeData.expiringCount > 0 && (
            <Card variant="bordered" className="border-red-200 bg-red-50/30">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {icons.expire}
                    <span>Próximos a Expirar</span>
                  </span>
                }
                subtitle="En los próximos 14 días"
              />
              <CardContent>
                <RankingList
                  items={safeData.expiringItems}
                  loading={loading}
                  emptyMessage="Sin items por expirar"
                  valueSuffix=" días"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Movement Trend */}
      <Card variant="bordered">
        <CardHeader
          title="Movimientos de Inventario"
          subtitle={`Entradas, salidas y ajustes - ${period}`}
        />
        <CardContent>
          <TISAreaChart
            data={safeData.movementTrend}
            areas={[
              { dataKey: 'entrada', name: 'Entradas', color: CHART_COLORS.success },
              { dataKey: 'salida', name: 'Salidas', color: CHART_COLORS.danger },
              { dataKey: 'ajuste', name: 'Ajustes', color: CHART_COLORS.warning },
            ]}
            height={300}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Two Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock by Category */}
        <Card variant="bordered">
          <CardHeader title="Stock por Categoría" subtitle="Distribución de items" />
          <CardContent>
            <TISBarChart
              data={safeData.stockByCategory}
              height={240}
              loading={loading}
              layout="vertical"
              barSize={24}
            />
          </CardContent>
        </Card>

        {/* Storage Distribution */}
        <Card variant="bordered">
          <CardHeader title="Tipo de Almacenamiento" subtitle="Por condiciones de conservación" />
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-2/5">
                <TISPieChart
                  data={safeData.storageDistribution}
                  height={200}
                  loading={loading}
                  innerRadius={45}
                  outerRadius={75}
                />
              </div>
              <div className="flex-1 space-y-3">
                {safeData.storageDistribution.map((item) => {
                  const total = safeData.storageDistribution.reduce((sum, i) => sum + i.value, 0) || 1;
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
      </div>

      {/* Top Used Items */}
      <Card variant="bordered">
        <CardHeader title="Items más Utilizados" subtitle="Mayor rotación en el período" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RankingList
              items={safeData.topUsedItems.slice(0, 5)}
              loading={loading}
              emptyMessage="Sin datos de uso"
              valueSuffix=" uds"
            />
            <RankingList
              items={safeData.topUsedItems.slice(5, 10)}
              loading={loading}
              emptyMessage=""
              valueSuffix=" uds"
            />
          </div>
        </CardContent>
      </Card>

      {/* Waste Summary */}
      <Card variant="bordered">
        <CardHeader
          title="Resumen de Merma"
          subtitle="Pérdidas por desperdicio y expiración"
        />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                {icons.waste}
                <span className="text-sm text-slate-600">Valor Perdido</span>
              </div>
              <p className="text-2xl font-bold text-red-600">-${formatNumber(safeData.wasteValue)}</p>
              <p className="text-xs text-slate-500 mt-1">{safeData.wastePercentage.toFixed(1)}% del inventario</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                {icons.alert}
                <span className="text-sm text-slate-600">Items en Riesgo</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{safeData.lowStockCount + safeData.expiringCount}</p>
              <p className="text-xs text-slate-500 mt-1">Requieren atención</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-slate-600">Nivel Óptimo</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{safeData.totalItems - safeData.lowStockCount}</p>
              <p className="text-xs text-slate-500 mt-1">Items saludables</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
