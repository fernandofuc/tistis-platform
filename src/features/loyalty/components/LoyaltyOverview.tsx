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
  color: 'coral' | 'blue' | 'green' | 'purple' | 'amber';
  gradient?: boolean;
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
  leads: { name: string; email: string };
  loyalty_membership_plans: { plan_name: string };
}

// ======================
// STAT CARD - PREMIUM DESIGN
// ======================
function StatCard({ title, value, subtitle, icon, trend, color, gradient = false }: StatCardProps) {
  const colorConfig = {
    coral: {
      bg: 'bg-gradient-to-br from-tis-coral/10 to-tis-coral/5',
      iconBg: 'bg-gradient-to-br from-tis-coral to-tis-coral/80',
      iconText: 'text-white',
      accent: 'text-tis-coral',
      border: 'border-tis-coral/20',
    },
    blue: {
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      iconText: 'text-white',
      accent: 'text-blue-600',
      border: 'border-blue-200',
    },
    green: {
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconText: 'text-white',
      accent: 'text-emerald-600',
      border: 'border-emerald-200',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50',
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      iconText: 'text-white',
      accent: 'text-purple-600',
      border: 'border-purple-200',
    },
    amber: {
      bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      iconText: 'text-white',
      accent: 'text-amber-600',
      border: 'border-amber-200',
    },
  };

  const config = colorConfig[color];

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-6 transition-all duration-300',
      'hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5',
      gradient ? config.bg : 'bg-white',
      config.border
    )}>
      {/* Decorative Element */}
      <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-5">
        <div className={cn('w-full h-full rounded-full', config.iconBg)} />
      </div>

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg',
            config.iconBg
          )}>
            <div className={config.iconText}>
              {icon}
            </div>
          </div>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
              trend.isPositive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
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
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className={cn('text-3xl font-bold tracking-tight', config.accent)}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
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
      bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/30',
      border: 'border-emerald-200',
      valueColor: 'text-emerald-600',
      iconBg: 'bg-emerald-500',
    },
    negative: {
      bg: 'bg-gradient-to-br from-red-50 to-red-100/30',
      border: 'border-red-200',
      valueColor: 'text-red-600',
      iconBg: 'bg-red-500',
    },
    neutral: {
      bg: 'bg-gradient-to-br from-gray-50 to-gray-100/30',
      border: 'border-gray-200',
      valueColor: 'text-gray-900',
      iconBg: 'bg-gray-600',
    },
  };

  const config = typeConfig[type];

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-5 transition-all duration-300',
      'hover:shadow-md hover:-translate-y-0.5',
      config.bg,
      config.border
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md',
          config.iconBg
        )}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-0.5">{title}</p>
          <p className={cn('text-2xl font-bold tracking-tight', config.valueColor)}>
            {type === 'positive' && '+'}{type === 'negative' && '-'}{value}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white/50 text-xs text-gray-500">
            {period} días
          </span>
        </div>
      </div>
    </div>
  );
}

// ======================
// TIER DISTRIBUTION - PREMIUM
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
      gradient: 'from-amber-600 to-amber-700',
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      icon: '🥉'
    },
    {
      name: 'Silver',
      count: tiers.silver,
      gradient: 'from-gray-400 to-gray-500',
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: '🥈'
    },
    {
      name: 'Gold',
      count: tiers.gold,
      gradient: 'from-yellow-400 to-yellow-500',
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      icon: '🥇'
    },
    {
      name: 'Platinum',
      count: tiers.platinum,
      gradient: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      icon: '💎'
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Distribución por Nivel</h3>
            <p className="text-xs text-gray-500">{total} miembros totales</p>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="space-y-4">
        {tierConfig.map((tier) => {
          const percentage = Math.round((tier.count / total) * 100);
          return (
            <div key={tier.name} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tier.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{tier.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    tier.bg,
                    tier.text
                  )}>
                    {tier.count}
                  </span>
                  <span className="text-xs text-gray-400 w-8 text-right">{percentage}%</span>
                </div>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out',
                    tier.gradient
                  )}
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
// TOP REWARDS - PREMIUM
// ======================
interface TopRewardsProps {
  rewards: TopReward[];
  tokensName: string;
}

function TopRewards({ rewards, tokensName }: TopRewardsProps) {
  const rankConfig = [
    { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-white', shadow: 'shadow-amber-200' },
    { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-white', shadow: 'shadow-gray-200' },
    { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-white', shadow: 'shadow-amber-200' },
    { bg: 'bg-gray-100', text: 'text-gray-600', shadow: '' },
    { bg: 'bg-gray-100', text: 'text-gray-600', shadow: '' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tis-coral to-orange-500 flex items-center justify-center text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Recompensas Populares</h3>
            <p className="text-xs text-gray-500">Top canjeadas</p>
          </div>
        </div>
      </div>

      {/* Rewards List */}
      {rewards.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Aún no hay recompensas configuradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.slice(0, 5).map((reward, i) => {
            const rank = rankConfig[i] || rankConfig[4];
            return (
              <div
                key={reward.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shadow-md',
                  rank.bg,
                  rank.text,
                  rank.shadow
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate group-hover:text-tis-coral transition-colors">
                    {reward.reward_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {reward.tokens_required.toLocaleString()} {tokensName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-tis-coral/10 text-tis-coral text-xs font-semibold">
                    {reward.redemption_count} canjes
                  </span>
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
// EXPIRING MEMBERSHIPS - PREMIUM
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
    if (days <= 3) return { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' };
    if (days <= 7) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pronto' };
    return { bg: 'bg-blue-100', text: 'text-blue-700', label: '' };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Por Vencer</h3>
            <p className="text-xs text-gray-500">{memberships.length} membresías</p>
          </div>
        </div>
        {memberships.length > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            Atención
          </span>
        )}
      </div>

      {/* List */}
      {memberships.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No hay membresías próximas a vencer</p>
          <p className="text-xs text-gray-400 mt-1">Todo bajo control</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.slice(0, 5).map((m) => {
            const days = getDaysUntil(m.end_date);
            const urgency = getUrgencyConfig(days);

            return (
              <div
                key={m.id}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-semibold text-sm">
                  {m.leads.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {m.leads.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {m.loyalty_membership_plans.plan_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-sm font-semibold',
                    days <= 3 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-gray-600'
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
                      urgency.text
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
    <div className="inline-flex items-center bg-gray-100 rounded-xl p-1">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            value === period.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
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
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-36 bg-gray-200 rounded-xl animate-pulse" />
      </div>

      {/* Skeleton for main stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton for activity cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-xl animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
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
    <div className="bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 rounded-2xl p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar datos</h3>
      <p className="text-red-600 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
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
          <h2 className="text-2xl font-bold text-gray-900">Resumen del Programa</h2>
          <p className="text-sm text-gray-500 mt-1">
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
          color="coral"
          gradient
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Membresías Activas"
          value={stats.memberships.total_active.toLocaleString()}
          subtitle={`${stats.memberships.new_this_period} nuevas en ${period} días`}
          color="green"
          gradient
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <StatCard
          title="Ingresos Recurrentes"
          value={`$${Math.round(stats.memberships.monthly_recurring_revenue + stats.memberships.annual_recurring_revenue / 12).toLocaleString()}`}
          subtitle="Ingreso mensual estimado"
          color="blue"
          gradient
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Canjes del Período"
          value={stats.redemptions.redemptions_this_period.toLocaleString()}
          subtitle={`${stats.redemptions.pending} pendientes de uso`}
          color="purple"
          gradient
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
        />
      </div>

      {/* Period Activity Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Análisis Detallado
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TierDistribution tiers={stats.tiers} />
          <TopRewards rewards={stats.top_rewards} tokensName={tokensName} />
          <ExpiringMemberships memberships={stats.expiring_memberships} />
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-tis-coral">
              {stats.tokens.average_balance.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tokensName} promedio por miembro
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-600">
              {Math.round((stats.memberships.total_active / (stats.tokens.members_with_tokens || 1)) * 100)}%
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Tasa de membresía
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">
              {stats.redemptions.total_all_time.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Canjes totales históricos
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">
              {stats.period.transactions_count > 0
                ? Math.round(stats.period.tokens_earned / stats.period.transactions_count)
                : 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {tokensName} por transacción
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
