// =====================================================
// TIS TIS PLATFORM - Analytics Clientes Tab
// Customer metrics: leads, loyalty, conversion
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
  leads: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  hot: (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
  loyalty: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  repeat: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  star: (
    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface ClientesTabProps {
  data: {
    // KPIs
    totalLeads?: number;
    leadsChange?: number;
    hotLeads?: number;
    hotLeadsChange?: number;
    loyaltyMembers?: number;
    membersChange?: number;
    repeatCustomers?: number;
    repeatRate?: number;
    conversionRate?: number;
    // Chart data
    leadsTrend?: Array<{ label: string; leads: number; converted: number }>;
    leadsByClassification?: Array<{ name: string; value: number; color: string }>;
    leadsBySource?: Array<{ name: string; value: number; fill: string }>;
    loyaltyTiers?: Array<{ name: string; value: number; color: string }>;
    topCustomers?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    conversionFunnel?: Array<{ name: string; value: number; percentage: number }>;
  };
  loading: boolean;
  period: string;
}

// Default values for safe data access
const DEFAULT_DATA = {
  totalLeads: 0,
  leadsChange: 0,
  hotLeads: 0,
  hotLeadsChange: 0,
  loyaltyMembers: 0,
  membersChange: 0,
  repeatCustomers: 0,
  repeatRate: 0,
  conversionRate: 0,
  leadsTrend: [] as Array<{ label: string; leads: number; converted: number }>,
  leadsByClassification: [] as Array<{ name: string; value: number; color: string }>,
  leadsBySource: [] as Array<{ name: string; value: number; fill: string }>,
  loyaltyTiers: [] as Array<{ name: string; value: number; color: string }>,
  topCustomers: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  conversionFunnel: [] as Array<{ name: string; value: number; percentage: number }>,
};

// ======================
// COMPONENT
// ======================
export function ClientesTab({ data, loading, period }: ClientesTabProps) {
  // Safe data with defaults - prevents undefined errors
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Nuevos Leads"
          value={formatNumber(safeData.totalLeads)}
          change={safeData.leadsChange}
          changeLabel="vs período anterior"
          icon={icons.leads}
          iconBgColor="bg-blue-50"
          trend={safeData.leadsChange > 0 ? 'up' : safeData.leadsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Leads Calientes"
          value={formatNumber(safeData.hotLeads)}
          change={safeData.hotLeadsChange}
          changeLabel="vs período anterior"
          icon={icons.hot}
          iconBgColor="bg-red-50"
          trend={safeData.hotLeadsChange > 0 ? 'up' : safeData.hotLeadsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Miembros VIP"
          value={formatNumber(safeData.loyaltyMembers)}
          change={safeData.membersChange}
          changeLabel="vs período anterior"
          icon={icons.loyalty}
          iconBgColor="bg-purple-50"
          trend={safeData.membersChange > 0 ? 'up' : safeData.membersChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Clientes Recurrentes"
          value={formatNumber(safeData.repeatCustomers)}
          change={safeData.repeatRate}
          changeLabel="tasa de retención"
          icon={icons.repeat}
          iconBgColor="bg-emerald-50"
          trend={safeData.repeatRate > 30 ? 'up' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Conversión"
          value={`${safeData.conversionRate}%`}
          changeLabel="leads a clientes"
          icon={icons.star}
          iconBgColor="bg-amber-50"
          trend={safeData.conversionRate > 20 ? 'up' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Leads Trend */}
      <Card variant="bordered">
        <CardHeader
          title="Tendencia de Leads"
          subtitle={`Nuevos leads y conversiones - ${period}`}
        />
        <CardContent>
          <TISAreaChart
            data={safeData.leadsTrend}
            areas={[
              { dataKey: 'leads', name: 'Nuevos Leads', color: CHART_COLORS.blue },
              { dataKey: 'converted', name: 'Convertidos', color: CHART_COLORS.success },
            ]}
            height={300}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Three Column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Classification */}
        <Card variant="bordered">
          <CardHeader title="Clasificación de Leads" subtitle="Por temperatura" />
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <TISPieChart
                  data={safeData.leadsByClassification}
                  height={160}
                  loading={loading}
                  innerRadius={35}
                  outerRadius={60}
                />
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Calientes', value: safeData.leadsByClassification.find(l => l.name === 'Calientes')?.value || 0, color: '#EF4444', emoji: '🔥' },
                  { label: 'Tibios', value: safeData.leadsByClassification.find(l => l.name === 'Tibios')?.value || 0, color: '#F59E0B', emoji: '🌡️' },
                  { label: 'Fríos', value: safeData.leadsByClassification.find(l => l.name === 'Fríos')?.value || 0, color: '#3B82F6', emoji: '❄️' },
                ].map((item) => {
                  const total = safeData.totalLeads || 1;
                  const percentage = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{item.emoji}</span>
                        <span className="text-sm text-slate-600">{item.label}</span>
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

        {/* Lead Sources */}
        <Card variant="bordered">
          <CardHeader title="Canales de Origen" subtitle="De dónde vienen los leads" />
          <CardContent>
            <TISBarChart
              data={safeData.leadsBySource}
              height={220}
              loading={loading}
              layout="vertical"
              barSize={20}
            />
          </CardContent>
        </Card>

        {/* Loyalty Tiers */}
        <Card variant="bordered">
          <CardHeader title="Niveles VIP" subtitle="Distribución de miembros" />
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex justify-center">
                <TISPieChart
                  data={safeData.loyaltyTiers}
                  height={160}
                  loading={loading}
                  innerRadius={35}
                  outerRadius={60}
                />
              </div>
              <div className="space-y-3">
                {safeData.loyaltyTiers.map((tier) => {
                  const total = safeData.loyaltyMembers || 1;
                  const percentage = Math.round((tier.value / total) * 100);
                  return (
                    <div key={tier.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span className="text-sm text-slate-600">{tier.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{tier.value}</span>
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

      {/* Conversion Funnel */}
      <Card variant="bordered">
        <CardHeader title="Embudo de Conversión" subtitle="Del lead al cliente recurrente" />
        <CardContent>
          <div className="space-y-4">
            {safeData.conversionFunnel.map((stage, index) => {
              const maxWidth = safeData.conversionFunnel[0]?.percentage || 100;
              const width = (stage.percentage / maxWidth) * 100;
              return (
                <div key={stage.name} className="flex items-center gap-4">
                  <div className="w-32 flex-shrink-0">
                    <p className="text-sm font-medium text-slate-700">{stage.name}</p>
                    <p className="text-xs text-slate-500">{stage.value} ({stage.percentage}%)</p>
                  </div>
                  <div className="flex-1 relative h-8">
                    <div
                      className={cn(
                        'absolute left-0 top-0 h-full rounded-r-lg transition-all duration-500',
                        index === 0 ? 'bg-blue-500' :
                        index === 1 ? 'bg-purple-500' :
                        index === 2 ? 'bg-emerald-500' :
                        'bg-tis-coral'
                      )}
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-end pr-3">
                      <span className={cn(
                        'text-sm font-bold',
                        width > 50 ? 'text-white' : 'text-slate-900'
                      )}>
                        {stage.percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card variant="bordered">
        <CardHeader title="Mejores Clientes" subtitle="Por valor total de compras" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RankingList
              items={safeData.topCustomers.slice(0, 5)}
              loading={loading}
              emptyMessage="Sin datos de clientes"
              valuePrefix="$"
            />
            <RankingList
              items={safeData.topCustomers.slice(5, 10)}
              loading={loading}
              emptyMessage=""
              valuePrefix="$"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-xl">
          <p className="text-sm text-slate-600 mb-1">Leads esta semana</p>
          <p className="text-2xl font-bold text-blue-600">{Math.round(safeData.totalLeads / 4)}</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-xl">
          <p className="text-sm text-slate-600 mb-1">Tasa de Retención</p>
          <p className="text-2xl font-bold text-emerald-600">{safeData.repeatRate}%</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-xl">
          <p className="text-sm text-slate-600 mb-1">Puntos Canjeados</p>
          <p className="text-2xl font-bold text-purple-600">{formatNumber(safeData.loyaltyMembers * 50)}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-xl">
          <p className="text-sm text-slate-600 mb-1">Valor Promedio Cliente</p>
          <p className="text-2xl font-bold text-amber-600">$450</p>
        </div>
      </div>
    </div>
  );
}
