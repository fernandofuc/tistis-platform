// =====================================================
// TIS TIS PLATFORM - Dental Analytics Pacientes Tab
// Lead and patient conversion analytics
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
  hotLead: (
    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
  patients: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  conversion: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  loyalty: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface PacientesTabProps {
  data: {
    // KPIs
    totalLeads?: number;
    leadsChange?: number;
    hotLeads?: number;
    hotLeadsChange?: number;
    convertedToPatients?: number;
    conversionRate?: number;
    loyaltyMembers?: number;
    loyaltyMembersChange?: number;
    // Chart data
    leadsTrend?: Array<{ label: string; leads: number; converted: number }>;
    leadsByClassification?: Array<{ name: string; value: number; color: string }>;
    leadsBySource?: Array<{ name: string; value: number; fill: string }>;
    conversionFunnel?: Array<{ name: string; value: number; percentage: number }>;
    topPatients?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    loyaltyTiers?: Array<{ name: string; value: number; color: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values
const DEFAULT_DATA = {
  totalLeads: 0,
  leadsChange: 0,
  hotLeads: 0,
  hotLeadsChange: 0,
  convertedToPatients: 0,
  conversionRate: 0,
  loyaltyMembers: 0,
  loyaltyMembersChange: 0,
  leadsTrend: [] as Array<{ label: string; leads: number; converted: number }>,
  leadsByClassification: [] as Array<{ name: string; value: number; color: string }>,
  leadsBySource: [] as Array<{ name: string; value: number; fill: string }>,
  conversionFunnel: [] as Array<{ name: string; value: number; percentage: number }>,
  topPatients: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  loyaltyTiers: [] as Array<{ name: string; value: number; color: string }>,
};

// ======================
// COMPONENT
// ======================
export function PacientesTab({ data, loading, period }: PacientesTabProps) {
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Leads"
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
          icon={icons.hotLead}
          iconBgColor="bg-orange-50"
          trend={safeData.hotLeadsChange > 0 ? 'up' : safeData.hotLeadsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Convertidos"
          value={formatNumber(safeData.convertedToPatients)}
          changeLabel="nuevos pacientes"
          icon={icons.patients}
          iconBgColor="bg-emerald-50"
          trend="neutral"
          loading={loading}
        />
        <MetricCard
          title="Tasa Conversión"
          value={`${safeData.conversionRate}%`}
          changeLabel="lead → paciente"
          icon={icons.conversion}
          iconBgColor="bg-purple-50"
          trend={safeData.conversionRate > 20 ? 'up' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Programa Lealtad"
          value={formatNumber(safeData.loyaltyMembers)}
          change={safeData.loyaltyMembersChange}
          changeLabel="miembros activos"
          icon={icons.loyalty}
          iconBgColor="bg-amber-50"
          trend={safeData.loyaltyMembersChange > 0 ? 'up' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Main Chart - Leads Trend */}
      <Card variant="bordered" className="overflow-hidden">
        <CardHeader
          title="Tendencia de Leads"
          subtitle={`Nuevos leads y conversiones - ${period}`}
        />
        <CardContent className="pt-2">
          <TISAreaChart
            data={safeData.leadsTrend}
            areas={[
              { dataKey: 'leads', name: 'Nuevos Leads', color: CHART_COLORS.blue },
              { dataKey: 'converted', name: 'Convertidos', color: CHART_COLORS.success },
            ]}
            height={320}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads by Classification - Pie Chart with legend */}
        <Card variant="bordered">
          <CardHeader title="Temperatura de Leads" subtitle="Clasificación actual" />
          <CardContent>
            <div className="space-y-4">
              <TISPieChart
                data={safeData.leadsByClassification}
                height={160}
                loading={loading}
                innerRadius={35}
                outerRadius={60}
              />
              <div className="space-y-3">
                {[
                  { name: 'Calientes', color: '#EF4444', emoji: '🔥', key: 'hot' },
                  { name: 'Tibios', color: '#F59E0B', emoji: '🌡️', key: 'warm' },
                  { name: 'Fríos', color: '#3B82F6', emoji: '❄️', key: 'cold' },
                ].map((item) => {
                  const found = safeData.leadsByClassification.find(l => l.name === item.name);
                  const value = found?.value || 0;
                  const total = safeData.totalLeads || 1;
                  const percentage = Math.round((value / total) * 100);
                  return (
                    <div key={item.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{item.emoji}</span>
                        <span className="text-sm text-slate-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{value}</span>
                        <span className="text-xs text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads by Source - Bar Chart */}
        <Card variant="bordered">
          <CardHeader title="Fuente de Leads" subtitle="Canal de origen" />
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

        {/* Conversion Funnel */}
        <Card variant="bordered">
          <CardHeader title="Embudo de Conversión" subtitle="Lead → Paciente" />
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral" />
              </div>
            ) : safeData.conversionFunnel.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-400">
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {safeData.conversionFunnel.map((step, index) => (
                  <div key={step.name} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{step.name}</span>
                      <span className="text-sm font-bold text-slate-900">{step.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div
                        className={cn(
                          'h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2',
                          index === 0 ? 'bg-blue-500' :
                          index === 1 ? 'bg-amber-500' :
                          index === 2 ? 'bg-orange-500' :
                          'bg-emerald-500'
                        )}
                        style={{ width: `${step.percentage}%` }}
                      >
                        <span className="text-xs font-semibold text-white">{step.percentage}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Patients by Value */}
        <Card variant="bordered">
          <CardHeader title="Pacientes Más Valiosos" subtitle="Por número de citas/tratamientos" />
          <CardContent>
            <RankingList
              items={safeData.topPatients}
              loading={loading}
              emptyMessage="Sin datos de pacientes"
              valuePrefix=""
              valueSuffix=" citas"
            />
          </CardContent>
        </Card>

        {/* Loyalty Tiers */}
        <Card variant="bordered">
          <CardHeader title="Programa de Lealtad" subtitle="Distribución por nivel" />
          <CardContent>
            {loading ? (
              <div className="h-52 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral" />
              </div>
            ) : safeData.loyaltyTiers.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-400 flex-col gap-2">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <p className="text-sm">Sin miembros de lealtad</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { tier: 'Oro', color: '#F59E0B', bgColor: 'bg-amber-50', icon: '🥇' },
                  { tier: 'Plata', color: '#94A3B8', bgColor: 'bg-slate-100', icon: '🥈' },
                  { tier: 'Bronce', color: '#D97706', bgColor: 'bg-orange-50', icon: '🥉' },
                ].map((level) => {
                  const tierData = safeData.loyaltyTiers.find(t => t.name === level.tier);
                  const value = tierData?.value || 0;
                  const total = safeData.loyaltyMembers || 1;
                  const percentage = Math.round((value / total) * 100);
                  return (
                    <div key={level.tier} className={cn('p-4 rounded-xl', level.bgColor)}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{level.icon}</span>
                          <span className="font-semibold text-slate-900">{level.tier}</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-900">{value}</span>
                      </div>
                      <div className="w-full bg-white/60 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%`, backgroundColor: level.color }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{percentage}% del programa</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
