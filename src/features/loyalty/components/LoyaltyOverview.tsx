// =====================================================
// TIS TIS PLATFORM - Loyalty Overview Component
// Dashboard with stats and quick actions
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { useLoyaltyStats, useLoyaltyProgram } from '../hooks/useLoyalty';

// ======================
// STAT CARD COMPONENT
// ======================
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: 'coral' | 'blue' | 'green' | 'purple' | 'amber';
}

function StatCard({ title, value, subtitle, icon, trend, color }: StatCardProps) {
  const colorClasses = {
    coral: 'bg-tis-coral/10 text-tis-coral',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', colorClasses[color])}>
          {icon}
        </div>
        {trend && (
          <span className={cn(
            'text-sm font-medium px-2 py-1 rounded-full',
            trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ======================
// TIER DISTRIBUTION
// ======================
interface TierDistributionProps {
  tiers: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
}

function TierDistribution({ tiers }: TierDistributionProps) {
  const total = tiers.bronze + tiers.silver + tiers.gold + tiers.platinum || 1;

  const tierConfig = [
    { name: 'Bronze', count: tiers.bronze, color: 'bg-amber-600' },
    { name: 'Silver', count: tiers.silver, color: 'bg-gray-400' },
    { name: 'Gold', count: tiers.gold, color: 'bg-yellow-500' },
    { name: 'Platinum', count: tiers.platinum, color: 'bg-purple-600' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Distribución por Nivel</h3>
      <div className="space-y-3">
        {tierConfig.map((tier) => (
          <div key={tier.name}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">{tier.name}</span>
              <span className="font-medium text-gray-900">{tier.count}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', tier.color)}
                style={{ width: `${(tier.count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================
// EXPIRING MEMBERSHIPS
// ======================
interface ExpiringMembershipsProps {
  memberships: Array<{
    id: string;
    end_date: string;
    leads: { name: string; email: string };
    loyalty_membership_plans: { plan_name: string };
  }>;
}

function ExpiringMemberships({ memberships }: ExpiringMembershipsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Membresías por Vencer</h3>
      {memberships.length === 0 ? (
        <p className="text-gray-500 text-sm">No hay membresías próximas a vencer</p>
      ) : (
        <div className="space-y-3">
          {memberships.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{m.leads.name}</p>
                <p className="text-xs text-gray-500">{m.loyalty_membership_plans.plan_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-red-600 font-medium">
                  {new Date(m.end_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// TOP REWARDS
// ======================
interface TopRewardsProps {
  rewards: Array<{
    id: string;
    reward_name: string;
    tokens_required: number;
    redemption_count: number;
  }>;
  tokensName: string;
}

function TopRewards({ rewards, tokensName }: TopRewardsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Recompensas Populares</h3>
      {rewards.length === 0 ? (
        <p className="text-gray-500 text-sm">Aún no hay recompensas configuradas</p>
      ) : (
        <div className="space-y-3">
          {rewards.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                i === 0 ? 'bg-yellow-100 text-yellow-700' :
                i === 1 ? 'bg-gray-100 text-gray-700' :
                i === 2 ? 'bg-amber-100 text-amber-700' :
                'bg-gray-50 text-gray-500'
              )}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm truncate">{r.reward_name}</p>
                <p className="text-xs text-gray-500">{r.tokens_required} {tokensName}</p>
              </div>
              <span className="text-sm font-medium text-gray-600">{r.redemption_count} canjes</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function LoyaltyOverview() {
  const [period, setPeriod] = useState(30);
  const { stats, loading, error } = useLoyaltyStats(period);
  const { program } = useLoyaltyProgram();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600">{error || 'Error al cargar estadísticas'}</p>
      </div>
    );
  }

  const tokensName = program?.tokens_name_plural || 'Puntos';

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-end">
        <select
          value={period}
          onChange={(e) => setPeriod(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`${tokensName} en Circulación`}
          value={stats.tokens.total_in_circulation.toLocaleString()}
          subtitle={`${stats.tokens.members_with_tokens} miembros con ${tokensName.toLowerCase()}`}
          color="coral"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Membresías Activas"
          value={stats.memberships.total_active}
          subtitle={`${stats.memberships.new_this_period} nuevas este período`}
          color="green"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <StatCard
          title="Ingresos Recurrentes"
          value={`$${(stats.memberships.monthly_recurring_revenue + stats.memberships.annual_recurring_revenue / 12).toLocaleString()}`}
          subtitle="Ingreso mensual estimado"
          color="blue"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Redenciones"
          value={stats.redemptions.redemptions_this_period}
          subtitle={`${stats.redemptions.pending} pendientes de uso`}
          color="purple"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          }
        />
      </div>

      {/* Period Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{tokensName} Otorgados</p>
          <p className="text-2xl font-bold text-green-600 mt-1">+{stats.period.tokens_earned.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Últimos {period} días</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{tokensName} Canjeados</p>
          <p className="text-2xl font-bold text-red-600 mt-1">-{stats.period.tokens_spent.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Últimos {period} días</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Transacciones</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.period.transactions_count}</p>
          <p className="text-xs text-gray-400 mt-1">Últimos {period} días</p>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TierDistribution tiers={stats.tiers} />
        <TopRewards rewards={stats.top_rewards} tokensName={tokensName} />
        <ExpiringMemberships memberships={stats.expiring_memberships} />
      </div>
    </div>
  );
}
