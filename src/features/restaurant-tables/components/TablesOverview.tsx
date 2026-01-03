// =====================================================
// TIS TIS PLATFORM - Tables Overview Component
// Dashboard with stats, floor plan preview and quick insights
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { cn } from '@/shared/utils';
import type { TableStats, RestaurantTable, TableZone } from '../types';
import { STATUS_CONFIG, ZONE_CONFIG } from '../types';

// ======================
// STAT CARD
// ======================
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'red';
}

function StatCard({ title, value, subtitle, icon, color = 'default' }: StatCardProps) {
  const colorConfig = {
    default: { iconBg: 'bg-slate-100', iconText: 'text-slate-600' },
    emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    red: { iconBg: 'bg-red-100', iconText: 'text-red-600' },
  };

  const config = colorConfig[color];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300/80">
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center',
            config.iconBg,
            config.iconText
          )}>
            {icon}
          </div>
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
// OCCUPANCY RING
// ======================
interface OccupancyRingProps {
  rate: number;
  total: number;
  occupied: number;
}

function OccupancyRing({ rate, total, occupied }: OccupancyRingProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-100"
        />
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            'transition-all duration-1000 ease-out',
            rate >= 80 ? 'text-red-500' :
            rate >= 60 ? 'text-amber-500' :
            rate >= 40 ? 'text-blue-500' :
            'text-emerald-500'
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{rate}%</span>
        <span className="text-xs text-slate-500">{occupied}/{total}</span>
      </div>
    </div>
  );
}

// ======================
// ZONE DISTRIBUTION
// ======================
interface ZoneDistributionProps {
  zones: Record<TableZone, number>;
  total: number;
}

function ZoneDistribution({ zones, total }: ZoneDistributionProps) {
  const sortedZones = Object.entries(zones)
    .filter(([_, count]) => count > 0)
    .sort(([_, a], [__, b]) => b - a);

  if (sortedZones.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500 text-sm">No hay zonas configuradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedZones.map(([zone, count]) => {
        const config = ZONE_CONFIG[zone as TableZone];
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <div key={zone}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-slate-700">
                {config?.label || zone}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{count} mesas</span>
                <span className="text-xs text-slate-400">{percentage}%</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ======================
// STATUS DISTRIBUTION
// ======================
interface StatusDistributionProps {
  stats: TableStats;
}

function StatusDistribution({ stats }: StatusDistributionProps) {
  const statusData = [
    { key: 'available', count: stats.available, ...STATUS_CONFIG.available },
    { key: 'occupied', count: stats.occupied, ...STATUS_CONFIG.occupied },
    { key: 'reserved', count: stats.reserved, ...STATUS_CONFIG.reserved },
    { key: 'unavailable', count: stats.unavailable, ...STATUS_CONFIG.unavailable },
    { key: 'maintenance', count: stats.maintenance, ...STATUS_CONFIG.maintenance },
  ].filter(s => s.count > 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {statusData.map((status) => (
        <div
          key={status.key}
          className={cn(
            'rounded-xl p-4 border border-slate-100 transition-all hover:shadow-sm',
            status.bgColor
          )}
        >
          <p className={cn('text-2xl font-bold', status.color)}>
            {status.count}
          </p>
          <p className="text-xs text-slate-600 mt-1">{status.label}</p>
        </div>
      ))}
    </div>
  );
}

// ======================
// QUICK ACTIONS
// ======================
interface QuickActionsProps {
  onAddTable: () => void;
  onViewFloorPlan: () => void;
  onBulkEdit: () => void;
}

function QuickActions({ onAddTable, onViewFloorPlan, onBulkEdit }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button
        onClick={onAddTable}
        className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="text-left">
          <p className="font-medium">Nueva Mesa</p>
          <p className="text-xs text-white/60">Agregar mesa al plano</p>
        </div>
      </button>

      <button
        onClick={onViewFloorPlan}
        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </div>
        <div className="text-left">
          <p className="font-medium text-slate-900">Plano Visual</p>
          <p className="text-xs text-slate-500">Ver distribución</p>
        </div>
      </button>

      <button
        onClick={onBulkEdit}
        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <div className="text-left">
          <p className="font-medium text-slate-900">Edición Masiva</p>
          <p className="text-xs text-slate-500">Modificar múltiples</p>
        </div>
      </button>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface TablesOverviewProps {
  stats: TableStats | null;
  tables: RestaurantTable[];
  loading?: boolean;
  onAddTable: () => void;
  onViewFloorPlan: () => void;
  onBulkEdit: () => void;
}

export function TablesOverview({
  stats,
  tables,
  loading,
  onAddTable,
  onViewFloorPlan,
  onBulkEdit,
}: TablesOverviewProps) {
  if (loading || !stats) {
    return <TablesOverviewSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <QuickActions
        onAddTable={onAddTable}
        onViewFloorPlan={onViewFloorPlan}
        onBulkEdit={onBulkEdit}
      />

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Mesas"
          value={stats.total}
          subtitle={`${stats.total_capacity} lugares totales`}
          color="default"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          }
        />

        <StatCard
          title="Disponibles"
          value={stats.available}
          subtitle="Listas para asignar"
          color="emerald"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Ocupadas"
          value={stats.occupied}
          subtitle="En servicio ahora"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />

        <StatCard
          title="Reservadas"
          value={stats.reserved}
          subtitle="Próximas horas"
          color="amber"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Occupancy & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy Rate */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Ocupación Actual</h3>
              <p className="text-xs text-slate-500">Mesas en uso</p>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <OccupancyRing
              rate={stats.occupancy_rate}
              total={stats.total}
              occupied={stats.occupied}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Capacidad total</span>
              <span className="font-medium text-slate-900">{stats.total_capacity} personas</span>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Estado de Mesas</h3>
              <p className="text-xs text-slate-500">Distribución actual</p>
            </div>
          </div>

          <StatusDistribution stats={stats} />
        </div>
      </div>

      {/* Zone Distribution */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Distribución por Zona</h3>
            <p className="text-xs text-slate-500">Mesas por área del restaurante</p>
          </div>
        </div>

        <ZoneDistribution zones={stats.zones} total={stats.total} />
      </div>
    </div>
  );
}

// ======================
// SKELETON LOADER
// ======================
function TablesOverviewSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl" />
        ))}
      </div>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6">
            <div className="w-11 h-11 bg-slate-100 rounded-xl mb-4" />
            <div className="h-4 w-24 bg-slate-100 rounded mb-2" />
            <div className="h-8 w-16 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 h-64" />
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 h-64" />
      </div>
    </div>
  );
}

export { TablesOverviewSkeleton };
