// =====================================================
// TIS TIS PLATFORM - Dental/Clinic Analytics View
// Original analytics for non-restaurant verticals
// =====================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, Button } from '@/src/shared/components/ui';
import { StatsGrid, StatCard } from '@/src/features/dashboard';
import { supabase } from '@/src/shared/lib/supabase';
import { formatNumber, cn } from '@/src/shared/utils';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

// ======================
// ICONS
// ======================
const icons = {
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
// TYPES
// ======================
type Period = '7d' | '30d' | '90d';

interface DailyData {
  date: string;
  label: string;
  leads: number;
  appointments: number;
  conversations: number;
}

interface LeadsByClassification {
  hot: number;
  warm: number;
  cold: number;
}

interface AppointmentsByStatus {
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

// ======================
// CHART COLORS
// ======================
const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
};

// ======================
// CUSTOM TOOLTIP
// ======================
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-lg border border-slate-100">
        <p className="text-sm font-medium text-slate-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ======================
// PROPS
// ======================
interface DentalAnalyticsProps {
  tenantId: string;
  selectedBranchId: string | null;
  period: Period;
}

// ======================
// COMPONENT
// ======================
export function DentalAnalytics({ tenantId, selectedBranchId, period }: DentalAnalyticsProps) {
  const { terminology } = useVerticalTerminology();
  const [loading, setLoading] = useState(true);

  // Stats state
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

  // Chart data state
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [leadsByClassification, setLeadsByClassification] = useState<LeadsByClassification>({ hot: 0, warm: 0, cold: 0 });
  const [appointmentsByStatus, setAppointmentsByStatus] = useState<AppointmentsByStatus>({
    scheduled: 0, confirmed: 0, completed: 0, cancelled: 0, no_show: 0,
  });

  // Fetch analytics data
  useEffect(() => {
    async function fetchAnalytics() {
      if (!tenantId) return;

      setLoading(true);

      try {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - days);

        // Leads
        let leadsQuery = supabase
          .from('leads')
          .select('id, classification, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString());

        if (selectedBranchId) {
          leadsQuery = leadsQuery.eq('branch_id', selectedBranchId);
        }

        const { data: leads } = await leadsQuery;

        // Appointments
        let appointmentsQuery = supabase
          .from('appointments')
          .select('id, status, scheduled_at')
          .eq('tenant_id', tenantId)
          .gte('scheduled_at', startDate.toISOString());

        if (selectedBranchId) {
          appointmentsQuery = appointmentsQuery.eq('branch_id', selectedBranchId);
        }

        const { data: appointments } = await appointmentsQuery;

        // Conversations
        let conversationsQuery = supabase
          .from('conversations')
          .select('id, status, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', startDate.toISOString());

        if (selectedBranchId) {
          conversationsQuery = conversationsQuery.eq('branch_id', selectedBranchId);
        }

        const { data: conversations } = await conversationsQuery;

        // Previous period leads
        let prevLeadsQuery = supabase
          .from('leads')
          .select('id, classification')
          .eq('tenant_id', tenantId)
          .gte('created_at', prevStartDate.toISOString())
          .lt('created_at', startDate.toISOString());

        if (selectedBranchId) {
          prevLeadsQuery = prevLeadsQuery.eq('branch_id', selectedBranchId);
        }

        const { data: prevLeads } = await prevLeadsQuery;

        // Previous period appointments
        let prevAppointmentsQuery = supabase
          .from('appointments')
          .select('id, status')
          .eq('tenant_id', tenantId)
          .gte('scheduled_at', prevStartDate.toISOString())
          .lt('scheduled_at', startDate.toISOString());

        if (selectedBranchId) {
          prevAppointmentsQuery = prevAppointmentsQuery.eq('branch_id', selectedBranchId);
        }

        const { data: prevAppointments } = await prevAppointmentsQuery;

        // Calculate stats
        const newLeads = leads?.length || 0;
        const hotLeads = leads?.filter((l) => l.classification === 'hot').length || 0;
        const warmLeads = leads?.filter((l) => l.classification === 'warm').length || 0;
        const coldLeads = leads?.filter((l) => l.classification === 'cold').length || 0;

        const prevNewLeads = prevLeads?.length || 0;
        const prevHotLeads = prevLeads?.filter((l) => l.classification === 'hot').length || 0;

        const appointmentsScheduled = appointments?.length || 0;
        const appointmentsConfirmed = appointments?.filter((a) => a.status === 'confirmed').length || 0;
        const appointmentsCompleted = appointments?.filter((a) => a.status === 'completed').length || 0;
        const appointmentsCancelled = appointments?.filter((a) => a.status === 'cancelled').length || 0;
        const appointmentsNoShow = appointments?.filter((a) => a.status === 'no_show').length || 0;

        const prevCompleted = prevAppointments?.filter((a) => a.status === 'completed').length || 0;
        const prevScheduled = prevAppointments?.length || 0;

        const conversationsTotal = conversations?.length || 0;
        const conversationsResolved = conversations?.filter((c) => c.status === 'resolved' || c.status === 'closed').length || 0;

        const calcChange = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return Math.round(((current - previous) / previous) * 100);
        };

        const newLeadsChange = calcChange(newLeads, prevNewLeads);
        const hotLeadsChange = calcChange(hotLeads, prevHotLeads);

        const conversionRate = appointmentsScheduled > 0
          ? Math.round((appointmentsCompleted / appointmentsScheduled) * 100)
          : 0;
        const prevConversionRate = prevScheduled > 0
          ? Math.round((prevCompleted / prevScheduled) * 100)
          : 0;
        const conversionRateChange = conversionRate - prevConversionRate;

        setStats({
          newLeads,
          newLeadsChange,
          hotLeads,
          hotLeadsChange,
          appointmentsScheduled,
          appointmentsCompleted,
          appointmentsCancelled,
          conversationsTotal,
          conversationsResolved,
          avgResponseTime: 2,
          conversionRate,
          conversionRateChange,
        });

        setLeadsByClassification({ hot: hotLeads, warm: warmLeads, cold: coldLeads });
        setAppointmentsByStatus({
          scheduled: appointmentsScheduled - appointmentsConfirmed - appointmentsCompleted - appointmentsCancelled - appointmentsNoShow,
          confirmed: appointmentsConfirmed,
          completed: appointmentsCompleted,
          cancelled: appointmentsCancelled,
          no_show: appointmentsNoShow,
        });

        // Build daily data
        const dailyMap = new Map<string, DailyData>();

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const label = date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
          dailyMap.set(dateStr, { date: dateStr, label, leads: 0, appointments: 0, conversations: 0 });
        }

        leads?.forEach((lead) => {
          const dateStr = new Date(lead.created_at).toISOString().split('T')[0];
          const dayData = dailyMap.get(dateStr);
          if (dayData) dayData.leads += 1;
        });

        appointments?.forEach((apt) => {
          const dateStr = new Date(apt.scheduled_at).toISOString().split('T')[0];
          const dayData = dailyMap.get(dateStr);
          if (dayData) dayData.appointments += 1;
        });

        conversations?.forEach((conv) => {
          const dateStr = new Date(conv.created_at).toISOString().split('T')[0];
          const dayData = dailyMap.get(dateStr);
          if (dayData) dayData.conversations += 1;
        });

        setDailyData(Array.from(dailyMap.values()));

      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [period, tenantId, selectedBranchId]);

  // Pie chart data
  const pieData = useMemo(() => [
    { name: 'Calientes', value: leadsByClassification.hot, color: '#EF4444' },
    { name: 'Tibios', value: leadsByClassification.warm, color: '#F59E0B' },
    { name: 'Fríos', value: leadsByClassification.cold, color: '#3B82F6' },
  ].filter(item => item.value > 0), [leadsByClassification]);

  // Bar chart data
  const appointmentBarData = useMemo(() => [
    { name: 'Completadas', value: appointmentsByStatus.completed, fill: '#10B981' },
    { name: 'Confirmadas', value: appointmentsByStatus.confirmed, fill: '#3B82F6' },
    { name: 'Pendientes', value: appointmentsByStatus.scheduled, fill: '#6B7280' },
    { name: 'Canceladas', value: appointmentsByStatus.cancelled, fill: '#EF4444' },
    { name: 'No asistió', value: appointmentsByStatus.no_show, fill: '#F59E0B' },
  ].filter(item => item.value > 0), [appointmentsByStatus]);

  return (
    <div className="space-y-6">
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
          title={`${terminology.appointments} Completadas`}
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

      {/* Main Chart */}
      <Card variant="bordered" className="overflow-hidden">
        <CardHeader
          title="Tendencia de Actividad"
          subtitle={`Leads, ${terminology.appointments.toLowerCase()} y conversaciones por día`}
        />
        <CardContent className="pt-2">
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : dailyData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm font-medium">No hay datos para este período</p>
                <p className="text-xs mt-1">Los datos aparecerán cuando tengas actividad</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAppointments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" formatter={(value) => <span className="text-sm text-slate-600">{value}</span>} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="appointments" name={terminology.appointments} stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAppointments)" />
                <Area type="monotone" dataKey="conversations" name="Conversaciones" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConversations)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Classification */}
        <Card variant="bordered">
          <CardHeader title="Distribución de Leads" subtitle="Por clasificación de temperatura" />
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <p className="text-sm">No hay leads en este período</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-4">
                  {[
                    { label: 'Calientes', value: leadsByClassification.hot, color: '#EF4444', emoji: '🔥' },
                    { label: 'Tibios', value: leadsByClassification.warm, color: '#F59E0B', emoji: '🌡️' },
                    { label: 'Fríos', value: leadsByClassification.cold, color: '#3B82F6', emoji: '❄️' },
                  ].map((item) => {
                    const total = stats.newLeads || 1;
                    const percentage = Math.round((item.value / total) * 100);
                    return (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{item.emoji}</span>
                          <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.value}</span>
                          <span className="text-xs text-slate-500">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointments Bar Chart */}
        <Card variant="bordered">
          <CardHeader title={`Estado de ${terminology.appointments}`} subtitle="Distribución por estado" />
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : appointmentBarData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-400">
                <p className="text-sm">No hay {terminology.appointments.toLowerCase()} en este período</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={appointmentBarData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={true} vertical={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {appointmentBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations Stats */}
        <Card variant="bordered">
          <CardHeader title="Conversaciones AI" subtitle="Métricas del asistente virtual" />
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  {icons.chat}
                  <span className="text-sm text-slate-600">Total</span>
                </div>
                <p className="text-3xl font-bold text-slate-900">{stats.conversationsTotal}</p>
                <p className="text-xs text-slate-500 mt-1">conversaciones</p>
              </div>
              <div className="p-5 bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-slate-600">Resueltas</span>
                </div>
                <p className="text-3xl font-bold text-green-600">{stats.conversationsResolved}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.conversationsTotal > 0
                    ? `${Math.round((stats.conversationsResolved / stats.conversationsTotal) * 100)}% del total`
                    : 'sin conversaciones'
                  }
                </p>
              </div>
            </div>
            <div className="mt-4 p-5 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {icons.clock}
                    <span className="text-sm text-slate-600">Tiempo de Respuesta Promedio</span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{stats.avgResponseTime}<span className="text-lg font-normal text-slate-500">s</span></p>
                </div>
                <div className="w-16 h-16 bg-white/80 rounded-2xl flex items-center justify-center shadow-sm">
                  <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card variant="bordered">
          <CardHeader title="Resumen del Período" subtitle="Métricas clave de rendimiento" />
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  label: 'Tasa de Asistencia',
                  value: stats.appointmentsScheduled > 0 ? `${Math.round((stats.appointmentsCompleted / stats.appointmentsScheduled) * 100)}%` : '0%',
                  color: 'bg-green-500',
                  bgColor: 'bg-green-50',
                  progress: stats.appointmentsScheduled > 0 ? (stats.appointmentsCompleted / stats.appointmentsScheduled) * 100 : 0,
                },
                {
                  label: 'Leads Calificados (HOT)',
                  value: stats.newLeads > 0 ? `${Math.round((stats.hotLeads / stats.newLeads) * 100)}%` : '0%',
                  color: 'bg-red-500',
                  bgColor: 'bg-red-50',
                  progress: stats.newLeads > 0 ? (stats.hotLeads / stats.newLeads) * 100 : 0,
                },
                {
                  label: 'Conversaciones Resueltas',
                  value: stats.conversationsTotal > 0 ? `${Math.round((stats.conversationsResolved / stats.conversationsTotal) * 100)}%` : '0%',
                  color: 'bg-purple-500',
                  bgColor: 'bg-purple-50',
                  progress: stats.conversationsTotal > 0 ? (stats.conversationsResolved / stats.conversationsTotal) * 100 : 0,
                },
                {
                  label: 'Cancelaciones',
                  value: stats.appointmentsScheduled > 0 ? `${Math.round((stats.appointmentsCancelled / stats.appointmentsScheduled) * 100)}%` : '0%',
                  color: 'bg-amber-500',
                  bgColor: 'bg-amber-50',
                  progress: stats.appointmentsScheduled > 0 ? (stats.appointmentsCancelled / stats.appointmentsScheduled) * 100 : 0,
                },
              ].map((item) => (
                <div key={item.label} className={cn("p-4 rounded-xl", item.bgColor)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <span className="text-lg font-bold text-slate-900">{item.value}</span>
                  </div>
                  <div className="w-full bg-white/60 rounded-full h-2">
                    <div className={cn('h-2 rounded-full transition-all duration-500', item.color)} style={{ width: `${Math.min(item.progress, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
