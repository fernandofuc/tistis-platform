// =====================================================
// TIS TIS PLATFORM - Dental Analytics Resumen Tab
// Overview dashboard with key metrics for dental clinic
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
  leads: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  hotLead: (
    <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  ),
  appointments: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  conversion: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface ResumenDentalTabProps {
  data: {
    // KPIs
    newLeads?: number;
    newLeadsChange?: number;
    hotLeads?: number;
    hotLeadsChange?: number;
    appointmentsScheduled?: number;
    appointmentsCompleted?: number;
    appointmentsCancelled?: number;
    conversionRate?: number;
    conversionRateChange?: number;
    // Chart data
    dailyActivity?: Array<{ label: string; leads: number; appointments: number; conversations: number }>;
    leadsByClassification?: Array<{ name: string; value: number; color: string }>;
    appointmentsByStatus?: Array<{ name: string; value: number; fill: string }>;
    topServices?: Array<{ rank: number; name: string; value: number; subValue: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values
const DEFAULT_DATA = {
  newLeads: 0,
  newLeadsChange: 0,
  hotLeads: 0,
  hotLeadsChange: 0,
  appointmentsScheduled: 0,
  appointmentsCompleted: 0,
  appointmentsCancelled: 0,
  conversionRate: 0,
  conversionRateChange: 0,
  dailyActivity: [] as Array<{ label: string; leads: number; appointments: number; conversations: number }>,
  leadsByClassification: [] as Array<{ name: string; value: number; color: string }>,
  appointmentsByStatus: [] as Array<{ name: string; value: number; fill: string }>,
  topServices: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
};

// ======================
// COMPONENT
// ======================
export function ResumenDentalTab({ data, loading, period }: ResumenDentalTabProps) {
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Nuevos Leads"
          value={formatNumber(safeData.newLeads)}
          change={safeData.newLeadsChange}
          changeLabel="vs período anterior"
          icon={icons.leads}
          iconBgColor="bg-blue-50"
          trend={safeData.newLeadsChange > 0 ? 'up' : safeData.newLeadsChange < 0 ? 'down' : 'neutral'}
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
          title="Citas Completadas"
          value={`${safeData.appointmentsCompleted}/${safeData.appointmentsScheduled}`}
          changeLabel={`${safeData.appointmentsCancelled} canceladas`}
          icon={icons.appointments}
          iconBgColor="bg-emerald-50"
          trend={safeData.appointmentsCancelled > 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Tasa de Conversión"
          value={`${safeData.conversionRate}%`}
          change={safeData.conversionRateChange}
          changeLabel="vs período anterior"
          icon={icons.conversion}
          iconBgColor="bg-purple-50"
          trend={safeData.conversionRateChange > 0 ? 'up' : safeData.conversionRateChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Main Chart - Activity Trend */}
      <Card variant="bordered" className="overflow-hidden">
        <CardHeader
          title="Tendencia de Actividad"
          subtitle={`Leads, citas y conversaciones - ${period}`}
        />
        <CardContent className="pt-2">
          <TISAreaChart
            data={safeData.dailyActivity}
            areas={[
              { dataKey: 'appointments', name: 'Citas', color: CHART_COLORS.success },
              { dataKey: 'leads', name: 'Leads', color: CHART_COLORS.blue },
              { dataKey: 'conversations', name: 'Conversaciones', color: CHART_COLORS.secondary },
            ]}
            height={320}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads Distribution - Pie Chart */}
        <Card variant="bordered">
          <CardHeader title="Distribución de Leads" subtitle="Por temperatura" />
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-1/2">
                <TISPieChart
                  data={safeData.leadsByClassification}
                  height={180}
                  loading={loading}
                  innerRadius={40}
                  outerRadius={70}
                />
              </div>
              <div className="flex-1 space-y-3">
                {safeData.leadsByClassification.map((item) => {
                  const total = safeData.leadsByClassification.reduce((sum, i) => sum + i.value, 0) || 1;
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

        {/* Top Services - Ranking */}
        <Card variant="bordered">
          <CardHeader title="Servicios Populares" subtitle="Más solicitados del período" />
          <CardContent>
            <RankingList
              items={safeData.topServices}
              loading={loading}
              emptyMessage="Sin datos de servicios"
              valuePrefix=""
              valueSuffix=" citas"
            />
          </CardContent>
        </Card>

        {/* Appointments by Status - Bar Chart */}
        <Card variant="bordered">
          <CardHeader title="Estado de Citas" subtitle="Distribución actual" />
          <CardContent>
            <TISBarChart
              data={safeData.appointmentsByStatus}
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
          label="Tasa de Asistencia"
          value={safeData.appointmentsScheduled > 0 ? safeData.appointmentsCompleted : 0}
          total={safeData.appointmentsScheduled || 1}
          color="bg-emerald-500"
          bgColor="bg-emerald-50"
          loading={loading}
        />
        <QuickStatCard
          label="Leads HOT"
          value={safeData.hotLeads}
          total={safeData.newLeads || 1}
          color="bg-orange-500"
          bgColor="bg-orange-50"
          loading={loading}
        />
        <QuickStatCard
          label="Conversión a Paciente"
          value={Math.round((safeData.conversionRate / 100) * safeData.newLeads)}
          total={safeData.newLeads || 1}
          color="bg-purple-500"
          bgColor="bg-purple-50"
          loading={loading}
        />
        <QuickStatCard
          label="Cancelaciones"
          value={safeData.appointmentsCancelled}
          total={safeData.appointmentsScheduled || 1}
          color="bg-red-500"
          bgColor="bg-red-50"
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
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
