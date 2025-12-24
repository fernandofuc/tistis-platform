// =====================================================
// TIS TIS PLATFORM - Dashboard Overview Page
// Design System: TIS TIS Premium (Apple-like aesthetics)
// Centro de control principal del negocio
// =====================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardContent, Badge, Avatar, Button } from '@/src/shared/components/ui';
import { motion } from 'framer-motion';
import { PageWrapper } from '@/src/features/dashboard';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { useBranch } from '@/src/shared/stores';
import { formatRelativeTime, formatTime, cn } from '@/src/shared/utils';
import type { Lead, Appointment } from '@/src/shared/types';

// ======================
// ICONS - TIS TIS Premium Style
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
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  message: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  alert: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

// ======================
// ANIMATION VARIANTS (Apple-style)
// ======================
const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2, transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const } },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: [0.32, 0.72, 0, 1] as const },
  }),
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

  // ======================
  // DATA FETCHING - OPTIMIZED (Parallel Queries)
  // ======================
  const fetchDashboardData = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      // Build base query helper
      const buildQuery = (table: string, selectFields: string) => {
        let query = supabase.from(table).select(selectFields).eq('tenant_id', tenant.id);
        if (selectedBranchId) {
          query = query.eq('branch_id', selectedBranchId);
        }
        return query;
      };

      // Calculate today's date range once
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      // Execute ALL queries in PARALLEL for maximum performance
      const [leadsResult, recentLeadsResult, appointmentsResult, conversationsResult] = await Promise.all([
        // Query 1: Leads stats (only id, classification, status)
        buildQuery('leads', 'id, classification, status')
          .in('status', ['new', 'contacted', 'qualified', 'appointment_scheduled']),

        // Query 2: Recent leads (full data, limited to 5)
        buildQuery('leads', 'id, full_name, phone, classification, score, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        // Query 3: Today's appointments with related data
        buildQuery('appointments', '*, leads(full_name, phone), patients(first_name, last_name, phone)')
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfDay)
          .order('scheduled_at'),

        // Query 4: Conversations stats (only id, status)
        buildQuery('conversations', 'id, status')
          .in('status', ['active', 'waiting_response', 'escalated']),
      ]);

      // Process all results and update state in ONE batch (single re-render)
      const { data: leads, error: leadsError } = leadsResult;
      const { data: recentLeadsData, error: recentLeadsError } = recentLeadsResult;
      const { data: appointmentsData, error: appointmentsError } = appointmentsResult;
      const { data: conversations } = conversationsResult;

      // Calculate all stats at once
      const newStats: DashboardStats = {
        totalLeads: 0,
        hotLeads: 0,
        warmLeads: 0,
        coldLeads: 0,
        todayAppointments: 0,
        activeConversations: 0,
        escalatedConversations: 0,
      };

      // Process leads stats
      if (!leadsError && leads) {
        newStats.totalLeads = leads.length;
        newStats.hotLeads = leads.filter((l: any) => l.classification === 'hot').length;
        newStats.warmLeads = leads.filter((l: any) => l.classification === 'warm').length;
        newStats.coldLeads = leads.filter((l: any) => l.classification === 'cold').length;
      }

      // Process appointments count
      if (!appointmentsError && appointmentsData) {
        newStats.todayAppointments = appointmentsData.length;
      }

      // Process conversations stats
      if (conversations) {
        newStats.activeConversations = conversations.filter((c: any) => c.status !== 'escalated').length;
        newStats.escalatedConversations = conversations.filter((c: any) => c.status === 'escalated').length;
      }

      // Update ALL state in one batch (React 18 auto-batches, but being explicit)
      setStats(newStats);

      if (!recentLeadsError && recentLeadsData) {
        setRecentLeads(recentLeadsData as unknown as Lead[]);
      }

      if (!appointmentsError && appointmentsData) {
        setTodayAppointments(appointmentsData as unknown as Appointment[]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, selectedBranchId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ======================
  // HELPERS
  // ======================
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const getLeadName = (apt: Appointment) => {
    const leadData = apt as Appointment & { leads?: { full_name?: string; phone?: string }; patients?: { first_name?: string; last_name?: string; phone?: string } };
    if (leadData.patients) {
      return `${leadData.patients.first_name || ''} ${leadData.patients.last_name || ''}`.trim() || leadData.patients.phone || 'Sin nombre';
    }
    if (leadData.leads) {
      return leadData.leads.full_name || leadData.leads.phone || 'Sin nombre';
    }
    return 'Sin nombre';
  };

  const handleLeadClick = (leadId: string) => {
    router.push(`/dashboard/leads?lead_id=${leadId}`);
  };

  // ======================
  // RENDER
  // ======================
  return (
    <PageWrapper
      title={`${getGreeting()}, ${staff?.first_name || 'Usuario'}`}
      subtitle={selectedBranch ? `Resumen de ${selectedBranch.name}` : `Centro de control de ${tenant?.name || 'tu negocio'}`}
      actions={
        <Button
          leftIcon={icons.plus}
          onClick={() => router.push('/dashboard/calendario')}
        >
          Nueva Cita
        </Button>
      }
    >
      {/* Stats Cards - Premium Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Leads */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push('/dashboard/leads')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
              <span className="text-blue-600">{icons.leads}</span>
            </div>
            <Badge variant="info" size="sm">Leads</Badge>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-slate-800">{stats.totalLeads}</div>
              <p className="text-sm text-slate-500 mt-1">Leads activos</p>
            </>
          )}
        </motion.div>

        {/* Hot Leads */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200/60 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push('/dashboard/leads?filter=hot')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-orange-100 rounded-xl">
              <span className="text-lg">🔥</span>
            </div>
            <Badge variant="hot" size="sm">Prioridad</Badge>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-12 bg-orange-200 rounded animate-pulse" />
              <div className="h-4 w-20 bg-orange-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-orange-700">{stats.hotLeads}</div>
              <p className="text-sm text-orange-600 mt-1">Leads calientes</p>
            </>
          )}
        </motion.div>

        {/* Today Appointments */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200/60 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => router.push('/dashboard/calendario')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <span className="text-emerald-600">{icons.calendar}</span>
            </div>
            <Badge variant="success" size="sm">Hoy</Badge>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-10 bg-emerald-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-emerald-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-emerald-700">{stats.todayAppointments}</div>
              <p className="text-sm text-emerald-600 mt-1">Citas programadas</p>
            </>
          )}
        </motion.div>

        {/* Conversations */}
        <motion.div
          variants={cardHoverVariants}
          initial="rest"
          whileHover="hover"
          className={cn(
            'rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer',
            stats.escalatedConversations > 0
              ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200/60'
              : 'bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200/60'
          )}
          onClick={() => router.push('/dashboard/inbox')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn(
              'p-2.5 rounded-xl',
              stats.escalatedConversations > 0 ? 'bg-amber-100' : 'bg-purple-100'
            )}>
              <span className={stats.escalatedConversations > 0 ? 'text-amber-600' : 'text-purple-600'}>
                {icons.chat}
              </span>
            </div>
            {stats.escalatedConversations > 0 ? (
              <Badge variant="warning" size="sm">
                {stats.escalatedConversations} escaladas
              </Badge>
            ) : (
              <Badge variant="default" size="sm">Inbox</Badge>
            )}
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-8 w-10 bg-purple-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-purple-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <div className={cn(
                'text-3xl font-bold',
                stats.escalatedConversations > 0 ? 'text-amber-700' : 'text-purple-700'
              )}>
                {stats.activeConversations}
              </div>
              <p className={cn(
                'text-sm mt-1',
                stats.escalatedConversations > 0 ? 'text-amber-600' : 'text-purple-600'
              )}>
                Conversaciones activas
              </p>
            </>
          )}
        </motion.div>
      </div>

      {/* Content Grid - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Leads Recientes (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leads Recientes */}
          <Card variant="bordered" className="overflow-hidden">
            <CardHeader
              title="Leads Recientes"
              subtitle="Últimos prospectos registrados"
              action={
                <Link href="/dashboard/leads">
                  <Button variant="ghost" size="sm" rightIcon={icons.arrowRight}>
                    Ver todos
                  </Button>
                </Link>
              }
            />
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3">
                      <div className="w-11 h-11 bg-slate-200 rounded-full animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2 animate-pulse" />
                        <div className="h-3 bg-slate-100 rounded w-1/4 animate-pulse" />
                      </div>
                      <div className="h-8 w-12 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : recentLeads.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center">
                    <span className="text-3xl">🎯</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    {selectedBranch ? `Sin leads en ${selectedBranch.name}` : 'Sin leads registrados'}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
                    Los leads aparecerán aquí cuando recibas mensajes por WhatsApp o los agregues manualmente.
                  </p>
                  <Link href="/dashboard/leads">
                    <Button variant="outline" size="sm">
                      Ir a Leads
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentLeads.map((lead, index) => (
                    <motion.div
                      key={lead.id}
                      custom={index}
                      variants={listItemVariants}
                      initial="hidden"
                      animate="visible"
                      onClick={() => handleLeadClick(lead.id)}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50/80 cursor-pointer transition-all duration-200 group"
                    >
                      <Avatar name={(lead as Lead & { full_name?: string }).full_name || lead.phone} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-slate-900 truncate">
                            {(lead as Lead & { full_name?: string }).full_name || 'Sin nombre'}
                          </p>
                        </div>
                        <p className="text-sm text-slate-500">{lead.phone}</p>
                      </div>

                      {/* Classification Badge with Emoji */}
                      <div className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
                        lead.classification === 'hot' && 'bg-orange-100 text-orange-700',
                        lead.classification === 'warm' && 'bg-amber-100 text-amber-700',
                        lead.classification === 'cold' && 'bg-blue-100 text-blue-700',
                        !lead.classification && 'bg-slate-100 text-slate-600'
                      )}>
                        <span>
                          {lead.classification === 'hot' && '🔥'}
                          {lead.classification === 'warm' && '🌡️'}
                          {lead.classification === 'cold' && '❄️'}
                          {!lead.classification && '📋'}
                        </span>
                        <span>{lead.score || 0}</span>
                      </div>

                      {/* Time */}
                      <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
                        {formatRelativeTime(lead.created_at)}
                      </span>

                      {/* Actions - Show on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/inbox?lead_id=${lead.id}`);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Enviar mensaje"
                        >
                          {icons.message}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/calendario?lead_id=${lead.id}`);
                          }}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Agendar cita"
                        >
                          {icons.calendar}
                        </button>
                      </div>

                      {/* Arrow */}
                      <span className="text-slate-300 group-hover:text-slate-400 transition-colors">
                        {icons.arrowRight}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions - Premium Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Nuevo Lead',
                icon: icons.leads,
                emoji: '🎯',
                gradient: 'from-blue-50 to-indigo-50',
                hoverGradient: 'hover:from-blue-100 hover:to-indigo-100',
                border: 'border-blue-200/60',
                text: 'text-blue-700',
                href: '/dashboard/leads',
              },
              {
                label: 'Agendar Cita',
                icon: icons.calendar,
                emoji: '📅',
                gradient: 'from-emerald-50 to-teal-50',
                hoverGradient: 'hover:from-emerald-100 hover:to-teal-100',
                border: 'border-emerald-200/60',
                text: 'text-emerald-700',
                href: '/dashboard/calendario',
              },
              {
                label: 'Ver Inbox',
                icon: icons.chat,
                emoji: '💬',
                gradient: 'from-purple-50 to-violet-50',
                hoverGradient: 'hover:from-purple-100 hover:to-violet-100',
                border: 'border-purple-200/60',
                text: 'text-purple-700',
                href: '/dashboard/inbox',
              },
              {
                label: 'Hot Leads',
                icon: icons.fire,
                emoji: '🔥',
                gradient: 'from-orange-50 to-red-50',
                hoverGradient: 'hover:from-orange-100 hover:to-red-100',
                border: 'border-orange-200/60',
                text: 'text-orange-700',
                href: '/dashboard/leads?filter=hot',
              },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                  `bg-gradient-to-br ${action.gradient} ${action.hoverGradient} ${action.border}`
                )}
              >
                <span className="text-2xl">{action.emoji}</span>
                <span className={cn('text-sm font-semibold', action.text)}>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar - Citas de Hoy (1/3) */}
        <div className="space-y-6">
          <Card variant="bordered" className="overflow-hidden">
            <CardHeader
              title="Citas de Hoy"
              subtitle={`${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}`}
              action={
                <Link href="/dashboard/calendario">
                  <Button variant="ghost" size="sm" rightIcon={icons.arrowRight}>
                    Ver todas
                  </Button>
                </Link>
              }
            />
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="w-12 h-12 bg-slate-200 rounded-xl animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2 animate-pulse" />
                        <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : todayAppointments.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl">📅</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800 mb-1">Sin citas hoy</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Tu agenda está libre
                  </p>
                  <Link href="/dashboard/calendario">
                    <Button variant="outline" size="sm" leftIcon={icons.plus}>
                      Agendar
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {todayAppointments.slice(0, 5).map((apt, index) => {
                    const time = formatTime(apt.scheduled_at);
                    const hour = time.split(':')[0];
                    const isConfirmed = apt.status === 'confirmed';
                    const isPast = new Date(apt.scheduled_at) < new Date();

                    return (
                      <motion.div
                        key={apt.id}
                        custom={index}
                        variants={listItemVariants}
                        initial="hidden"
                        animate="visible"
                        onClick={() => router.push('/dashboard/calendario')}
                        className={cn(
                          'flex items-center gap-3 p-4 cursor-pointer transition-all duration-200 group',
                          isPast ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/80'
                        )}
                      >
                        {/* Time Block */}
                        <div className={cn(
                          'flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center',
                          isConfirmed
                            ? 'bg-gradient-to-br from-emerald-100 to-teal-100'
                            : 'bg-gradient-to-br from-blue-100 to-indigo-100'
                        )}>
                          <span className={cn(
                            'text-lg font-bold leading-none',
                            isConfirmed ? 'text-emerald-700' : 'text-blue-700'
                          )}>
                            {hour}
                          </span>
                          <span className={cn(
                            'text-[10px] font-medium',
                            isConfirmed ? 'text-emerald-600' : 'text-blue-600'
                          )}>
                            {time.split(':')[1]} {parseInt(hour) < 12 ? 'am' : 'pm'}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {getLeadName(apt)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">
                              {apt.duration_minutes} min
                            </span>
                            {apt.reason && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs text-slate-500 truncate">
                                  {apt.reason}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge
                          variant={isConfirmed ? 'success' : 'info'}
                          size="sm"
                        >
                          {isConfirmed ? (
                            <span className="flex items-center gap-1">
                              {icons.check}
                              Confirmada
                            </span>
                          ) : (
                            'Programada'
                          )}
                        </Badge>
                      </motion.div>
                    );
                  })}

                  {/* Ver más si hay más de 5 */}
                  {todayAppointments.length > 5 && (
                    <Link
                      href="/dashboard/calendario"
                      className="block p-4 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Ver {todayAppointments.length - 5} citas más
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mini Stats - Classification Breakdown */}
          <Card variant="bordered" className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Clasificación de Leads</h3>
            <div className="space-y-3">
              {[
                { label: 'Calientes', emoji: '🔥', count: stats.hotLeads, color: 'bg-orange-500', bgLight: 'bg-orange-100' },
                { label: 'Tibios', emoji: '🌡️', count: stats.warmLeads, color: 'bg-amber-500', bgLight: 'bg-amber-100' },
                { label: 'Fríos', emoji: '❄️', count: stats.coldLeads, color: 'bg-blue-500', bgLight: 'bg-blue-100' },
              ].map((item) => {
                const percentage = stats.totalLeads > 0 ? Math.round((item.count / stats.totalLeads) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{item.emoji}</span>
                        <span className="text-slate-600">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{item.count}</span>
                        <span className="text-xs text-slate-400">({percentage}%)</span>
                      </div>
                    </div>
                    <div className={cn('h-2 rounded-full overflow-hidden', item.bgLight)}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', item.color)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
