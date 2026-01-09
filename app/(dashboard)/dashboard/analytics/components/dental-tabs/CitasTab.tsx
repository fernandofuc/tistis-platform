// =====================================================
// TIS TIS PLATFORM - Dental Analytics Citas Tab
// Appointment metrics and scheduling analytics
// =====================================================

'use client';

import { Card, CardHeader, CardContent } from '@/src/shared/components/ui';
import { formatNumber } from '@/src/shared/utils';
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
  calendar: (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  cancel: (
    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  noShow: (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================
interface CitasTabProps {
  data: {
    // KPIs
    totalAppointments?: number;
    appointmentsChange?: number;
    completedRate?: number;
    completedRateChange?: number;
    cancellationRate?: number;
    noShowRate?: number;
    avgDuration?: number;
    // Chart data
    appointmentsTrend?: Array<{ label: string; scheduled: number; completed: number; cancelled: number }>;
    appointmentsByHour?: Array<{ label: string; value: number }>;
    appointmentsByDay?: Array<{ name: string; value: number; fill: string }>;
    appointmentsBySource?: Array<{ name: string; value: number; color: string }>;
    topDentists?: Array<{ rank: number; name: string; value: number; subValue: string }>;
    topServices?: Array<{ rank: number; name: string; value: number; subValue: string }>;
  };
  loading: boolean;
  period: string;
}

// Default values
const DEFAULT_DATA = {
  totalAppointments: 0,
  appointmentsChange: 0,
  completedRate: 0,
  completedRateChange: 0,
  cancellationRate: 0,
  noShowRate: 0,
  avgDuration: 0,
  appointmentsTrend: [] as Array<{ label: string; scheduled: number; completed: number; cancelled: number }>,
  appointmentsByHour: [] as Array<{ label: string; value: number }>,
  appointmentsByDay: [] as Array<{ name: string; value: number; fill: string }>,
  appointmentsBySource: [] as Array<{ name: string; value: number; color: string }>,
  topDentists: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
  topServices: [] as Array<{ rank: number; name: string; value: number; subValue: string }>,
};

// ======================
// COMPONENT
// ======================
export function CitasTab({ data, loading, period }: CitasTabProps) {
  const safeData = { ...DEFAULT_DATA, ...data };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Citas"
          value={formatNumber(safeData.totalAppointments)}
          change={safeData.appointmentsChange}
          changeLabel="vs período anterior"
          icon={icons.calendar}
          iconBgColor="bg-emerald-50"
          trend={safeData.appointmentsChange > 0 ? 'up' : safeData.appointmentsChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Tasa Completadas"
          value={`${safeData.completedRate}%`}
          change={safeData.completedRateChange}
          changeLabel="vs período anterior"
          icon={icons.check}
          iconBgColor="bg-blue-50"
          trend={safeData.completedRateChange > 0 ? 'up' : safeData.completedRateChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Cancelaciones"
          value={`${safeData.cancellationRate}%`}
          changeLabel="del total"
          icon={icons.cancel}
          iconBgColor="bg-red-50"
          trend={safeData.cancellationRate > 10 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="No Asistió"
          value={`${safeData.noShowRate}%`}
          changeLabel="del total"
          icon={icons.noShow}
          iconBgColor="bg-amber-50"
          trend={safeData.noShowRate > 5 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Duración Prom."
          value={`${safeData.avgDuration} min`}
          changeLabel="por cita"
          icon={icons.clock}
          iconBgColor="bg-purple-50"
          trend="neutral"
          loading={loading}
        />
      </div>

      {/* Main Chart - Appointments Trend */}
      <Card variant="bordered" className="overflow-hidden">
        <CardHeader
          title="Tendencia de Citas"
          subtitle={`Programadas, completadas y canceladas - ${period}`}
        />
        <CardContent className="pt-2">
          <TISAreaChart
            data={safeData.appointmentsTrend}
            areas={[
              { dataKey: 'scheduled', name: 'Programadas', color: CHART_COLORS.blue },
              { dataKey: 'completed', name: 'Completadas', color: CHART_COLORS.success },
              { dataKey: 'cancelled', name: 'Canceladas', color: CHART_COLORS.danger },
            ]}
            height={320}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Secondary Row - Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointments by Hour - Heatmap-style */}
        <Card variant="bordered" className="lg:col-span-2">
          <CardHeader title="Citas por Hora" subtitle="Distribución horaria del día" />
          <CardContent>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral" />
              </div>
            ) : safeData.appointmentsByHour.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400">
                <p className="text-sm">No hay datos para mostrar</p>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-1">
                {safeData.appointmentsByHour.map((hour, index) => {
                  const maxValue = Math.max(...safeData.appointmentsByHour.map(h => h.value), 1);
                  const intensity = hour.value / maxValue;
                  return (
                    <div
                      key={index}
                      className="aspect-square rounded flex items-center justify-center text-xs font-medium transition-all hover:scale-110"
                      style={{
                        backgroundColor: `rgba(223, 115, 115, ${0.1 + intensity * 0.8})`,
                        color: intensity > 0.5 ? 'white' : '#64748b',
                      }}
                      title={`${hour.label}: ${hour.value} citas`}
                    >
                      {hour.value > 0 ? hour.value : ''}
                    </div>
                  );
                })}
                {/* Hour labels */}
                <div className="col-span-12 flex justify-between mt-2 px-1">
                  {['8am', '10am', '12pm', '2pm', '4pm', '6pm'].map(label => (
                    <span key={label} className="text-xs text-slate-400">{label}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointments by Source */}
        <Card variant="bordered">
          <CardHeader title="Fuente de Citas" subtitle="Canal de reservación" />
          <CardContent>
            <div className="space-y-4">
              <TISPieChart
                data={safeData.appointmentsBySource}
                height={140}
                loading={loading}
                innerRadius={30}
                outerRadius={55}
              />
              <div className="space-y-2">
                {safeData.appointmentsBySource.map((item) => {
                  const total = safeData.appointmentsBySource.reduce((sum, i) => sum + i.value, 0) || 1;
                  const percentage = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600">{item.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Third Row - Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Dentists */}
        <Card variant="bordered">
          <CardHeader title="Top Dentistas" subtitle="Por número de citas atendidas" />
          <CardContent>
            <RankingList
              items={safeData.topDentists}
              loading={loading}
              emptyMessage="Sin datos de dentistas"
              valuePrefix=""
              valueSuffix=" citas"
            />
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card variant="bordered">
          <CardHeader title="Servicios Más Solicitados" subtitle="Por número de citas" />
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
      </div>

      {/* Day of Week Distribution */}
      <Card variant="bordered">
        <CardHeader title="Citas por Día de la Semana" subtitle="Distribución semanal" />
        <CardContent>
          <TISBarChart
            data={safeData.appointmentsByDay}
            height={200}
            loading={loading}
            layout="horizontal"
            barSize={40}
          />
        </CardContent>
      </Card>
    </div>
  );
}
