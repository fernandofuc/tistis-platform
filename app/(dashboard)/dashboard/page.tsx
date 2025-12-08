// =====================================================
// TIS TIS PLATFORM - Dashboard Overview Page
// =====================================================

'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, Badge, Avatar, Button } from '@/src/shared/components/ui';
import {
  PageWrapper,
  StatsGrid,
  ContentGrid,
  StatCard,
} from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase, ESVA_TENANT_ID } from '@/src/shared/lib/supabase';
import { formatRelativeTime, formatTime } from '@/src/shared/utils';
import type { Lead, Appointment, Conversation } from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  leads: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  fire: <span className="text-lg">🔥</span>,
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
};

// ======================
// STATS DATA
// ======================
interface DashboardStats {
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  todayAppointments: number;
  activeConversations: number;
  escalatedConversations: number;
}

// ======================
// COMPONENT
// ======================
export default function DashboardPage() {
  const { staff, tenant } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    todayAppointments: 0,
    activeConversations: 0,
    escalatedConversations: 0,
  });
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch leads stats
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, classification, status')
          .eq('tenant_id', ESVA_TENANT_ID)
          .in('status', ['new', 'contacted', 'qualified', 'appointment_scheduled']);

        if (!leadsError && leads) {
          setStats((prev) => ({
            ...prev,
            totalLeads: leads.length,
            hotLeads: leads.filter((l) => l.classification === 'hot').length,
            warmLeads: leads.filter((l) => l.classification === 'warm').length,
            coldLeads: leads.filter((l) => l.classification === 'cold').length,
          }));
        }

        // Fetch recent leads
        const { data: recentLeadsData } = await supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', ESVA_TENANT_ID)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentLeadsData) {
          setRecentLeads(recentLeadsData as Lead[]);
        }

        // Fetch today's appointments
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const { data: appointmentsData } = await supabase
          .from('appointments')
          .select('*, leads(name, phone)')
          .eq('tenant_id', ESVA_TENANT_ID)
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfDay)
          .order('scheduled_at');

        if (appointmentsData) {
          setTodayAppointments(appointmentsData as Appointment[]);
          setStats((prev) => ({
            ...prev,
            todayAppointments: appointmentsData.length,
          }));
        }

        // Fetch conversations stats
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('tenant_id', ESVA_TENANT_ID)
          .in('status', ['active', 'waiting_response', 'escalated']);

        if (conversations) {
          setStats((prev) => ({
            ...prev,
            activeConversations: conversations.filter((c) => c.status !== 'escalated').length,
            escalatedConversations: conversations.filter((c) => c.status === 'escalated').length,
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <PageWrapper
      title={`${getGreeting()}, ${staff?.first_name || 'Usuario'}`}
      subtitle={`Aquí está el resumen de ${tenant?.name || 'ESVA'}`}
      actions={
        <Button leftIcon={icons.plus}>
          Nueva Cita
        </Button>
      }
    >
      {/* Stats Grid */}
      <StatsGrid columns={4}>
        <StatCard
          title="Total Leads Activos"
          value={stats.totalLeads}
          icon={icons.leads}
          loading={loading}
        />
        <StatCard
          title="Leads Calientes"
          value={stats.hotLeads}
          icon={icons.fire}
          loading={loading}
        />
        <StatCard
          title="Citas Hoy"
          value={stats.todayAppointments}
          icon={icons.calendar}
          loading={loading}
        />
        <StatCard
          title="Conversaciones Activas"
          value={stats.activeConversations}
          changeLabel={stats.escalatedConversations > 0 ? `${stats.escalatedConversations} escaladas` : undefined}
          trend={stats.escalatedConversations > 0 ? 'down' : 'neutral'}
          icon={icons.chat}
          loading={loading}
        />
      </StatsGrid>

      {/* Content Grid */}
      <div className="mt-6">
        <ContentGrid
          sidebar={
            <Card variant="bordered">
              <CardHeader title="Citas de Hoy" action={
                <Button variant="ghost" size="sm">Ver todas</Button>
              } />
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : todayAppointments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay citas programadas para hoy</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.slice(0, 5).map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                            {formatTime(apt.scheduled_at).split(':')[0]}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {(apt as any).leads?.name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatTime(apt.scheduled_at)} - {apt.duration_minutes} min
                          </p>
                        </div>
                        <Badge
                          variant={apt.status === 'confirmed' ? 'success' : 'info'}
                          size="sm"
                        >
                          {apt.status === 'confirmed' ? 'Confirmada' : 'Programada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          }
        >
          {/* Recent Leads */}
          <Card variant="bordered">
            <CardHeader
              title="Leads Recientes"
              subtitle="Últimos leads registrados"
              action={
                <Button variant="ghost" size="sm">Ver todos</Button>
              }
            />
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                        <div className="h-3 bg-gray-200 rounded w-1/4" />
                      </div>
                      <div className="h-6 w-16 bg-gray-200 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p className="mb-2">No hay leads registrados</p>
                  <p className="text-sm">Los leads aparecerán aquí cuando lleguen mensajes</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-4 py-3 hover:bg-gray-50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <Avatar name={lead.name || lead.phone} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {lead.name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-gray-500">{lead.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={lead.classification as 'hot' | 'warm' | 'cold'}
                          size="sm"
                        >
                          {lead.classification === 'hot' && '🔥'}
                          {lead.classification === 'warm' && '🌡️'}
                          {lead.classification === 'cold' && '❄️'}
                          {' '}{lead.score}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(lead.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Nuevo Lead', icon: icons.leads, color: 'bg-blue-50 text-blue-600' },
              { label: 'Agendar Cita', icon: icons.calendar, color: 'bg-green-50 text-green-600' },
              { label: 'Ver Inbox', icon: icons.chat, color: 'bg-purple-50 text-purple-600' },
              { label: 'Ver Hot Leads', icon: icons.fire, color: 'bg-red-50 text-red-600' },
            ].map((action) => (
              <button
                key={action.label}
                className={`${action.color} p-4 rounded-xl flex flex-col items-center gap-2 hover:opacity-80 transition-opacity`}
              >
                {action.icon}
                <span className="text-sm font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </ContentGrid>
      </div>
    </PageWrapper>
  );
}
