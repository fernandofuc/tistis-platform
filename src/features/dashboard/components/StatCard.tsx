// =====================================================
// TIS TIS PLATFORM - Stat Card Component (Premium Design)
// =====================================================

'use client';

import { cn } from '@/shared/utils';
import { Card } from '@/shared/components/ui';
import type { StatCardProps } from '../types';

// ======================
// TREND ICONS
// ======================
const trendIcons = {
  up: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  down: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  neutral: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
    </svg>
  ),
};

// ======================
// COMPONENT
// ======================
export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = 'neutral',
  loading = false,
  variant = 'default',
}: StatCardProps & { variant?: 'default' | 'hero' }) {
  const trendColors = {
    up: 'text-tis-green-600 bg-tis-green-100',
    down: 'text-tis-coral bg-tis-coral-100',
    neutral: 'text-slate-500 bg-slate-100',
  };

  // Loading skeleton with premium animation
  if (loading) {
    return (
      <Card variant="bordered" hover={false} className="overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="h-3 w-24 skeleton rounded" />
            <div className="h-8 w-16 skeleton rounded" />
          </div>
          <div className="w-11 h-11 skeleton rounded-xl" />
        </div>
      </Card>
    );
  }

  // Hero variant (dark card)
  if (variant === 'hero') {
    return (
      <Card variant="hero" padding="lg" hover={false}>
        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="metric-label text-slate-400">{title}</p>
            <p className="metric-value text-white mt-2">{value}</p>
            {(change !== undefined || changeLabel) && (
              <div className="flex items-center gap-2 mt-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                    trend === 'up' ? 'bg-tis-green-200 text-tis-green-600' :
                    trend === 'down' ? 'bg-tis-coral-200 text-tis-coral' :
                    'bg-slate-700 text-slate-300'
                  )}
                >
                  {trendIcons[trend]}
                  {change !== undefined && (
                    <span>
                      {change > 0 ? '+' : ''}
                      {change}%
                    </span>
                  )}
                </span>
                {changeLabel && (
                  <span className="text-xs text-slate-400">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl text-white">
              {icon}
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Default variant (light card)
  return (
    <Card variant="bordered">
      <div className="flex items-start justify-between">
        <div>
          <p className="metric-label">{title}</p>
          <p className="metric-value text-slate-900 mt-2">{value}</p>
          {(change !== undefined || changeLabel) && (
            <div className="flex items-center gap-2 mt-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                  trendColors[trend]
                )}
              >
                {trendIcons[trend]}
                {change !== undefined && (
                  <span>
                    {change > 0 ? '+' : ''}
                    {change}%
                  </span>
                )}
              </span>
              {changeLabel && (
                <span className="text-xs text-slate-500">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-tis-coral-100 rounded-xl text-tis-coral">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ======================
// PRESET STAT CARDS
// ======================
export function LeadsStatCard({
  total,
  hot,
  newToday,
  change,
  loading,
}: {
  total: number;
  hot: number;
  newToday: number;
  change: number;
  loading?: boolean;
}) {
  return (
    <StatCard
      title="Total Leads"
      value={total}
      change={change}
      changeLabel="vs. ayer"
      trend={change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'}
      loading={loading}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
    />
  );
}

export function HotLeadsStatCard({
  count,
  loading,
}: {
  count: number;
  loading?: boolean;
}) {
  return (
    <StatCard
      title="Leads Calientes"
      value={count}
      loading={loading}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      }
    />
  );
}

export function AppointmentsStatCard({
  today,
  upcoming,
  loading,
  /** Dynamic title - use terminology.todayAppointments from useVerticalTerminology */
  title = 'Citas Hoy',
  /** Dynamic "upcoming" label - use terminology.upcomingLabel from useVerticalTerminology */
  upcomingLabel = 'próximas',
}: {
  today: number;
  upcoming: number;
  loading?: boolean;
  title?: string;
  upcomingLabel?: string;
}) {
  return (
    <StatCard
      title={title}
      value={today}
      changeLabel={`${upcoming} ${upcomingLabel}`}
      loading={loading}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
    />
  );
}

export function ConversationsStatCard({
  active,
  escalated,
  loading,
}: {
  active: number;
  escalated: number;
  loading?: boolean;
}) {
  return (
    <StatCard
      title="Conversaciones"
      value={active}
      changeLabel={escalated > 0 ? `${escalated} escaladas` : 'Ninguna escalada'}
      trend={escalated > 0 ? 'down' : 'neutral'}
      loading={loading}
      icon={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      }
    />
  );
}
