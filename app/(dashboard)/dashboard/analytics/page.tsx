// =====================================================
// TIS TIS PLATFORM - Analytics Page
// =====================================================

'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, Button, Badge } from '@/src/shared/components/ui';
import { PageWrapper, StatsGrid, StatCard } from '@/src/features/dashboard';
import { supabase, ESVA_TENANT_ID } from '@/src/shared/lib/supabase';
import { formatCurrency, formatNumber, cn } from '@/src/shared/utils';

// ======================
// ICONS
// ======================
const icons = {
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  trendUp: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  leads: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  appointments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// PERIOD SELECTOR
// ======================
type Period = '7d' | '30d' | '90d';

// ======================
// COMPONENT
// ======================
export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [stats, setStats] = useState({
    newLeads: 0,
    newLeadsChange: 0,
    hotLeads: 0,
    hotLeadsChange: 0,
    appointmentsScheduled: 0,
    appointmentsCompleted: 0,
    appointmentsCancelled: 0,
    conversationsTotal: 0,
    conversationsResolved: 0,
    avgResponseTime: 0,
    conversionRate: 0,
    conversionRateChange: 0,
  });

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch leads created in period
        const { data: leads } = await supabase
          .from('leads')
          .select('id, classification, created_at')
          .eq('tenant_id', ESVA_TENANT_ID)
          .gte('created_at', startDate.toISOString());

        // Fetch appointments in period
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id, status')
          .eq('tenant_id', ESVA_TENANT_ID)
          .gte('scheduled_at', startDate.toISOString());

        // Fetch conversations in period
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('tenant_id', ESVA_TENANT_ID)
          .gte('created_at', startDate.toISOString());

        // Calculate stats
        const newLeads = leads?.length || 0;
        const hotLeads = leads?.filter((l) => l.classification === 'hot').length || 0;
        const appointmentsScheduled = appointments?.length || 0;
        const appointmentsCompleted = appointments?.filter((a) => a.status === 'completed').length || 0;
        const appointmentsCancelled = appointments?.filter((a) => a.status === 'cancelled').length || 0;
        const conversationsTotal = conversations?.length || 0;
        const conversationsResolved = conversations?.filter((c) => c.status === 'resolved').length || 0;

        setStats({
          newLeads,
          newLeadsChange: 12, // Mock change percentage
          hotLeads,
          hotLeadsChange: 8,
          appointmentsScheduled,
          appointmentsCompleted,
          appointmentsCancelled,
          conversationsTotal,
          conversationsResolved,
          avgResponseTime: 45, // Mock: 45 seconds
          conversionRate: appointmentsScheduled > 0 ? Math.round((appointmentsCompleted / appointmentsScheduled) * 100) : 0,
          conversionRateChange: 5,
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [period]);

  // Period labels
  const periodLabels: Record<Period, string> = {
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    '90d': 'Últimos 90 días',
  };

  return (
    <PageWrapper
      title="Analytics"
      subtitle={periodLabels[period]}
      actions={
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  period === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {p === '7d' ? '7D' : p === '30d' ? '30D' : '90D'}
              </button>
            ))}
          </div>
          <Button variant="outline" leftIcon={icons.download}>
            Exportar
          </Button>
        </div>
      }
    >
      {/* Key Metrics */}
      <StatsGrid columns={4}>
        <StatCard
          title="Nuevos Leads"
          value={formatNumber(stats.newLeads)}
          change={stats.newLeadsChange}
          changeLabel="vs período anterior"
          trend={stats.newLeadsChange > 0 ? 'up' : stats.newLeadsChange < 0 ? 'down' : 'neutral'}
          icon={icons.leads}
          loading={loading}
        />
        <StatCard
          title="Leads Calientes"
          value={formatNumber(stats.hotLeads)}
          change={stats.hotLeadsChange}
          changeLabel="vs período anterior"
          trend={stats.hotLeadsChange > 0 ? 'up' : stats.hotLeadsChange < 0 ? 'down' : 'neutral'}
          icon={<span className="text-lg">🔥</span>}
          loading={loading}
        />
        <StatCard
          title="Citas Completadas"
          value={`${stats.appointmentsCompleted}/${stats.appointmentsScheduled}`}
          changeLabel={`${stats.appointmentsCancelled} canceladas`}
          trend={stats.appointmentsCancelled > 0 ? 'down' : 'neutral'}
          icon={icons.appointments}
          loading={loading}
        />
        <StatCard
          title="Tasa de Conversión"
          value={`${stats.conversionRate}%`}
          change={stats.conversionRateChange}
          changeLabel="vs período anterior"
          trend={stats.conversionRateChange > 0 ? 'up' : stats.conversionRateChange < 0 ? 'down' : 'neutral'}
          icon={icons.trendUp}
          loading={loading}
        />
      </StatsGrid>

      {/* Charts Section */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads Over Time */}
        <Card variant="bordered">
          <CardHeader title="Leads por Día" subtitle="Tendencia de nuevos leads" />
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-sm">Gráfica de leads por día</p>
                <p className="text-xs mt-1">(Integrar librería de charts)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lead Classification Distribution */}
        <Card variant="bordered">
          <CardHeader title="Distribución de Leads" subtitle="Por clasificación" />
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'Calientes', value: stats.hotLeads, color: 'bg-red-500', emoji: '🔥' },
                { label: 'Tibios', value: Math.round(stats.newLeads * 0.4), color: 'bg-orange-500', emoji: '🌡️' },
                { label: 'Fríos', value: Math.round(stats.newLeads * 0.3), color: 'bg-blue-500', emoji: '❄️' },
              ].map((item) => {
                const percentage = stats.newLeads > 0 ? Math.round((item.value / stats.newLeads) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {item.emoji} {item.label}
                      </span>
                      <span className="text-sm text-gray-500">
                        {item.value} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={cn('h-2 rounded-full transition-all duration-500', item.color)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Conversations Stats */}
        <Card variant="bordered">
          <CardHeader title="Conversaciones" subtitle="Métricas del AI Agent" />
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Total Conversaciones</p>
                <p className="text-2xl font-bold text-gray-900">{stats.conversationsTotal}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Resueltas</p>
                <p className="text-2xl font-bold text-green-600">{stats.conversationsResolved}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Tiempo de Respuesta Promedio</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.avgResponseTime}s</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                    {icons.clock}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Stats */}
        <Card variant="bordered">
          <CardHeader title="Citas" subtitle="Métricas de agendamiento" />
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{stats.appointmentsScheduled}</p>
                <p className="text-xs text-gray-500 mt-1">Programadas</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{stats.appointmentsCompleted}</p>
                <p className="text-xs text-gray-500 mt-1">Completadas</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{stats.appointmentsCancelled}</p>
                <p className="text-xs text-gray-500 mt-1">Canceladas</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Tasa de asistencia</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats.appointmentsScheduled > 0
                    ? Math.round((stats.appointmentsCompleted / stats.appointmentsScheduled) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
