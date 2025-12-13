// =====================================================
// TIS TIS PLATFORM - Dashboard Overview Page (Premium)
// =====================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardContent, Badge, Avatar, Button, LeadScoreBadge } from '@/src/shared/components/ui';
import {
  PageWrapper,
  StatsGrid,
  ContentGrid,
  StatCard,
} from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { formatRelativeTime, formatTime } from '@/src/shared/utils';
import type { Lead, Appointment } from '@/src/shared/types';

// ======================
// ICONS (Premium SVG - sin emojis)
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
  fire: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  ),
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
  const router = useRouter();
  const { staff, tenant } = useAuthContext();
  const { selectedBranchId, selectedBranch } = useBranch();
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

  // Fetch dashboard data when tenant is available
  useEffect(() => {
    async function fetchDashboardData() {
      // Wait for tenant to be loaded
      if (!tenant?.id) {
        return;
      }

      try {
        // Build base query with optional branch filter
        const buildQuery = (table: string, selectFields: string) => {
          let query = supabase.from(table).select(selectFields).eq('tenant_id', tenant.id);
          // Apply branch filter if a specific branch is selected
          if (selectedBranchId) {
            query = query.eq('branch_id', selectedBranchId);
          }
          return query;
        };

        // Fetch leads stats
        const { data: leads, error: leadsError } = await buildQuery('leads', 'id, classification, status')
          .in('status', ['new', 'contacted', 'qualified', 'appointment_scheduled']);

        if (!leadsError && leads) {
          setStats((prev) => ({
            ...prev,
            totalLeads: leads.length,
            hotLeads: leads.filter((l: any) => l.classification === 'hot').length,
            warmLeads: leads.filter((l: any) => l.classification === 'warm').length,
            coldLeads: leads.filter((l: any) => l.classification === 'cold').length,
          }));
        }

        // Fetch recent leads
        const { data: recentLeadsData, error: recentLeadsError } = await buildQuery('leads', '*')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!recentLeadsError && recentLeadsData) {
          setRecentLeads(recentLeadsData as unknown as Lead[]);
        }

        // Fetch today's appointments
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

        const { data: appointmentsData, error: appointmentsError } = await buildQuery('appointments', '*, leads(full_name, phone)')
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfDay)
          .order('scheduled_at');

        if (!appointmentsError && appointmentsData) {
          setTodayAppointments(appointmentsData as unknown as Appointment[]);
          setStats((prev) => ({
            ...prev,
            todayAppointments: appointmentsData.length,
          }));
        }

        // Fetch conversations stats
        const { data: conversations } = await buildQuery('conversations', 'id, status')
          .in('status', ['active', 'waiting_response', 'escalated']);

        if (conversations) {
          setStats((prev) => ({
            ...prev,
            activeConversations: conversations.filter((c: any) => c.status !== 'escalated').length,
            escalatedConversations: conversations.filter((c: any) => c.status === 'escalated').length,
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [tenant?.id, selectedBranchId]);

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
      subtitle={selectedBranch ? `Sucursal: ${selectedBranch.name}` : `Aquí está el resumen de ${tenant?.name || 'tu negocio'}`}
      actions={
        <Button
          leftIcon={icons.plus}
          onClick={() => router.push('/dashboard/calendario')}
          className="bg-gradient-coral hover:opacity-90 text-white shadow-coral transition-all"
        >
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
                <Link href="/dashboard/calendario">
                  <Button variant="ghost" size="sm">Ver todas</Button>
                </Link>
              } />
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 skeleton rounded-full" />
                        <div className="flex-1">
                          <div className="h-4 skeleton rounded w-3/4 mb-2" />
                          <div className="h-3 skeleton rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : todayAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-tis-green-100 rounded-2xl flex items-center justify-center text-tis-green">
                      {icons.calendar}
                    </div>
                    <p className="text-slate-900 font-medium text-sm mb-1">Sin citas para hoy</p>
                    <p className="text-xs text-slate-500">Agenda tu primera cita</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.slice(0, 5).map((apt) => (
                      <div
                        key={apt.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-tis-coral-100 rounded-xl flex items-center justify-center text-tis-coral font-bold text-sm">
                            {formatTime(apt.scheduled_at).split(':')[0]}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {(apt as any).leads?.full_name || 'Sin nombre'}
                          </p>
                          <p className="text-xs text-slate-500">
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
                <Link href="/dashboard/leads">
                  <Button variant="ghost" size="sm">Ver todos</Button>
                </Link>
              }
            />
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-10 h-10 skeleton rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 skeleton rounded w-1/3 mb-2" />
                        <div className="h-3 skeleton rounded w-1/4" />
                      </div>
                      <div className="h-9 w-9 skeleton rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : recentLeads.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-tis-coral-100 rounded-2xl flex items-center justify-center text-tis-coral">
                    {icons.leads}
                  </div>
                  <p className="text-slate-900 font-semibold mb-1">No hay leads registrados</p>
                  <p className="text-sm text-slate-500 mb-4">Los leads aparecerán aquí cuando lleguen mensajes por WhatsApp</p>
                  <Link href="/dashboard/leads">
                    <Button variant="outline" size="sm">Crear lead manual</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-4 py-3 hover:bg-slate-50 px-2 -mx-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <Avatar name={(lead as any).full_name || lead.phone} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {(lead as any).full_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500">{lead.phone}</p>
                      </div>
                      <LeadScoreBadge
                        score={lead.score || 0}
                        classification={lead.classification as 'hot' | 'warm' | 'cold'}
                        size="sm"
                      />
                      <span className="text-xs text-slate-400">
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
              { label: 'Nuevo Lead', icon: icons.leads, color: 'bg-tis-coral-100 text-tis-coral hover:bg-tis-coral-200', href: '/dashboard/leads' },
              { label: 'Agendar Cita', icon: icons.calendar, color: 'bg-tis-green-100 text-tis-green hover:bg-tis-green-200', href: '/dashboard/calendario' },
              { label: 'Ver Inbox', icon: icons.chat, color: 'bg-tis-purple/10 text-tis-purple hover:bg-tis-purple/20', href: '/dashboard/inbox' },
              { label: 'Hot Leads', icon: icons.fire, color: 'bg-tis-pink-100 text-tis-pink hover:bg-tis-pink-200', href: '/dashboard/leads?filter=hot' },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`${action.color} p-4 rounded-2xl flex flex-col items-center gap-2 transition-all duration-200 hover:-translate-y-0.5`}
              >
                {action.icon}
                <span className="text-sm font-semibold">{action.label}</span>
              </Link>
            ))}
          </div>
        </ContentGrid>
      </div>
    </PageWrapper>
  );
}
