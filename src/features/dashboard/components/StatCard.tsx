// =====================================================
// TIS TIS PLATFORM - Stat Card Component
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
}: StatCardProps) {
  const trendColors = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  };

  if (loading) {
    return (
      <Card variant="bordered" className="animate-pulse">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {(change !== undefined || changeLabel) && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
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
                <span className="text-xs text-gray-500">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2.5 bg-blue-50 rounded-lg text-blue-600">
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
        <span className="text-2xl">🔥</span>
      }
    />
  );
}

export function AppointmentsStatCard({
  today,
  upcoming,
  loading,
}: {
  today: number;
  upcoming: number;
  loading?: boolean;
}) {
  return (
    <StatCard
      title="Citas Hoy"
      value={today}
      changeLabel={`${upcoming} próximas`}
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
