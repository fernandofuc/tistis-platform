// =====================================================
// TIS TIS PLATFORM - Loyalty Overview Component
// Dashboard with stats, analytics and quick insights
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { useLoyaltyStats, useLoyaltyProgram } from '../hooks/useLoyalty';

// ======================
// TYPES
// ======================
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
}

interface TierData {
  bronze: number;
  silver: number;
  gold: number;
  platinum: number;
}

interface TopReward {
  id: string;
  reward_name: string;
  tokens_required: number;
  redemption_count: number;
}

interface ExpiringMembership {
  id: string;
  end_date: string;
  leads: { full_name?: string; first_name?: string; last_name?: string; email?: string };
  loyalty_membership_plans: { plan_name: string };
}

// ======================
// STAT CARD - PROFESSIONAL DESIGN
// ======================
function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300/80">
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            {icon}
          </div>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            )}>
              <svg
                className={cn('w-3 h-3', !trend.isPositive && 'rotate-180')}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================
// ACTIVITY CARD - PERIOD METRICS
// ======================
interface ActivityCardProps {
  title: string;
  value: string | number;
  period: number;
  type: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
}

function ActivityCard({ title, value, period, type, icon }: ActivityCardProps) {
  const typeConfig = {
    positive: {
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600',
      valueColor: 'text-emerald-600',
    },
    negative: {
      iconBg: 'bg-slate-100',
      iconText: 'text-slate-600',
      valueColor: 'text-slate-700',
    },
    neutral: {
      iconBg: 'bg-slate-100',
      iconText: 'text-slate-600',
      valueColor: 'text-slate-900',
    },
  };

  const config = typeConfig[type];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 transition-all duration-300 hover:shadow-md hover:border-slate-300/80">
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          config.iconBg,
          config.iconText
        )}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500 mb-0.5">{title}</p>
          <p className={cn('text-2xl font-bold tracking-tight', config.valueColor)}>
            {type === 'positive' && '+'}{value}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 text-xs text-slate-500 border border-slate-100">
            {period} días
          </span>
        </div>
      </div>
    </div>
  );
}

// ======================
// TIER DISTRIBUTION - PROFESSIONAL
// ======================
interface TierDistributionProps {
  tiers: TierData;
}

function TierDistribution({ tiers }: TierDistributionProps) {
  const total = tiers.bronze + tiers.silver + tiers.gold + tiers.platinum || 1;

  const tierConfig = [
    {
      name: 'Bronze',
      count: tiers.bronze,
      barColor: 'bg-amber-500',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-700',
      icon: '🥉'
    },
    {
      name: 'Silver',
      count: tiers.silver,
      barColor: 'bg-slate-400',
      badgeBg: 'bg-slate-50',
      badgeText: 'text-slate-700',
      icon: '🥈'
    },
    {
      name: 'Gold',
      count: tiers.gold,
      barColor: 'bg-yellow-500',
      badgeBg: 'bg-yellow-50',
      badgeText: 'text-yellow-700',
      icon: '🥇'
    },
    {
      name: 'Platinum',
      count: tiers.platinum,
      barColor: 'bg-slate-700',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-700',
      icon: '💎'
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Distribución por Nivel</h3>
            <p className="text-xs text-slate-500">{total} miembros totales</p>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="space-y-4">
        {tierConfig.map((tier) => {
          const percentage = Math.round((tier.count / total) * 100);
          return (
            <div key={tier.name}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{tier.icon}</span>
                  <span className="text-sm font-medium text-slate-700">{tier.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    tier.badgeBg,
                    tier.badgeText
                  )}>
                    {tier.count}
                  </span>
                  <span className="text-xs text-slate-400 w-8 text-right">{percentage}%</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', tier.barColor)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================
// TOP REWARDS - PROFESSIONAL
// ======================
interface TopRewardsProps {
  rewards: TopReward[];
  tokensName: string;
}

function TopRewards({ rewards, tokensName }: TopRewardsProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Recompensas Populares</h3>
            <p className="text-xs text-slate-500">Top canjeadas</p>
          </div>
        </div>
      </div>

      {/* Rewards List */}
      {rewards.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">Aún no hay recompensas configuradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.slice(0, 5).map((reward, i) => (
            <div
              key={reward.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                i === 0 ? 'bg-slate-900 text-white' :
                i === 1 ? 'bg-slate-600 text-white' :
                i === 2 ? 'bg-slate-400 text-white' :
                'bg-slate-100 text-slate-600'
              )}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">
                  {reward.reward_name}
                </p>
                <p className="text-xs text-slate-500">
                  {reward.tokens_required.toLocaleString()} {tokensName}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100">
                {reward.redemption_count} canjes
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// EXPIRING MEMBERSHIPS - PROFESSIONAL
// ======================
interface ExpiringMembershipsProps {
  memberships: ExpiringMembership[];
}

function ExpiringMemberships({ memberships }: ExpiringMembershipsProps) {
  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getUrgencyConfig = (days: number) => {
    if (days <= 3) return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', label: 'Urgente' };
    if (days <= 7) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', label: 'Pronto' };
    return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100', label: '' };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Por Vencer</h3>
            <p className="text-xs text-slate-500">{memberships.length} membresías</p>
          </div>
        </div>
        {memberships.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
            Atención
          </span>
        )}
      </div>

      {/* List */}
      {memberships.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm">No hay membresías próximas a vencer</p>
          <p className="text-xs text-slate-400 mt-1">Todo bajo control</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memberships.slice(0, 5).map((m) => {
            const days = getDaysUntil(m.end_date);
            const urgency = getUrgencyConfig(days);

            return (
              <div
                key={m.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                  {(m.leads.full_name || m.leads.first_name || 'P').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">
                    {m.leads.full_name || `${m.leads.first_name || ''} ${m.leads.last_name || ''}`.trim() || 'Sin nombre'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {m.loyalty_membership_plans.plan_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-sm font-medium',
                    days <= 3 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-slate-600'
                  )}>
                    {new Date(m.end_date).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </p>
                  {urgency.label && (
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded text-xs font-medium mt-1',
                      urgency.bg,
                      urgency.text,
                      `border ${urgency.border}`
                    )}>
                      {urgency.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ======================
// PERIOD SELECTOR
// ======================
interface PeriodSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods = [
    { value: 7, label: '7 días' },
    { value: 30, label: '30 días' },
    { value: 90, label: '90 días' },
  ];

  return (
    <div className="inline-flex items-center bg-slate-100 rounded-xl p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            value === period.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

// ======================
// LOADING STATE
// ======================
function LoadingState() {
  return (
    <div className="space-y-6">
      {/* Skeleton for header */}
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-10 w-36 bg-slate-100 rounded-xl animate-pulse" />
      </div>

      {/* Skeleton for main stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 bg-slate-100 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-8 w-32 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton for activity cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================
// ERROR STATE
// ======================
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">Error al cargar datos</h3>
      <p className="text-red-600 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reintentar
        </button>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function LoyaltyOverview() {
  const [period, setPeriod] = useState(30);
  const { stats, loading, error, refresh } = useLoyaltyStats(period);
  const { program } = useLoyaltyProgram();

  if (loading) {
    return <LoadingState />;
  }

  if (error || !stats) {
    return <ErrorState message={error || 'Error al cargar estadísticas'} onRetry={refresh} />;
  }

  const tokensName = program?.tokens_name_plural || 'Puntos';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Resumen del Programa</h2>
          <p className="text-sm text-slate-500 mt-1">
            Vista general de tu programa de lealtad
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`${tokensName} en Circulación`}
          value={stats.tokens.total_in_circulation.toLocaleString()}
          subtitle={`${stats.tokens.members_with_tokens} miembros con ${tokensName.toLowerCase()}`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Membresías Activas"
          value={stats.memberships.total_active.toLocaleString()}
          subtitle={`${stats.memberships.new_this_period} nuevas en ${period} días`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <StatCard
          title="Ingresos Recurrentes"
          value={`$${Math.round(stats.memberships.monthly_recurring_revenue + stats.memberships.annual_recurring_revenue / 12).toLocaleString()}`}
          subtitle="Ingreso mensual estimado"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Canjes del Período"
          value={stats.redemptions.redemptions_this_period.toLocaleString()}
          subtitle={`${stats.redemptions.pending} pendientes de uso`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
        />
      </div>

      {/* Period Activity Section */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Actividad del Período
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActivityCard
            title={`${tokensName} Otorgados`}
            value={stats.period.tokens_earned.toLocaleString()}
            period={period}
            type="positive"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            }
          />
          <ActivityCard
            title={`${tokensName} Canjeados`}
            value={stats.period.tokens_spent.toLocaleString()}
            period={period}
            type="negative"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            }
          />
          <ActivityCard
            title="Transacciones"
            value={stats.period.transactions_count.toLocaleString()}
            period={period}
            type="neutral"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Analytics Grid */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Análisis Detallado
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TierDistribution tiers={stats.tiers} />
          <TopRewards rewards={stats.top_rewards} tokensName={tokensName} />
          <ExpiringMemberships memberships={stats.expiring_memberships} />
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {stats.tokens.average_balance.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {tokensName} promedio por miembro
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {Math.round((stats.memberships.total_active / (stats.tokens.members_with_tokens || 1)) * 100)}%
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Tasa de membresía
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {stats.redemptions.total_all_time.toLocaleString()}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Canjes totales históricos
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-slate-900">
              {stats.period.transactions_count > 0
                ? Math.round(stats.period.tokens_earned / stats.period.transactions_count)
                : 0}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {tokensName} por transacción
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
