'use client';

// =====================================================
// TIS TIS PLATFORM - KDS Display Component
// Main Kitchen Display System view with order grid
// =====================================================

import { useState, useMemo } from 'react';
import { cn } from '@/shared/utils';
import { KDSOrderCard } from './KDSOrderCard';
import type {
  KDSOrderView,
  KDSStats,
  KitchenStationConfig,
  KitchenStation,
  OrderStatus,
} from '../types';
import {
  ORDER_STATUS_CONFIG,
  STATION_CONFIG,
} from '../types';

// ======================
// TYPES
// ======================

interface KDSDisplayProps {
  orders: KDSOrderView[];
  stats: KDSStats | null;
  stations: KitchenStationConfig[];
  loading?: boolean;
  onBumpOrder?: (orderId: string) => void;
  onRecallOrder?: (orderId: string) => void;
  onStartItem?: (itemId: string) => void;
  onBumpItem?: (itemId: string) => void;
  onCancelItem?: (itemId: string) => void;
  onPriorityChange?: (orderId: string, priority: number) => void;
  onRefresh?: () => void;
}

type ViewMode = 'all' | 'station' | 'status';
type FilterStatus = 'all' | OrderStatus;

// ======================
// STATS BAR
// ======================

interface StatsBarProps {
  stats: KDSStats | null;
  loading?: boolean;
}

function StatsBar({ stats, loading }: StatsBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-6 py-2 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-8 w-24 bg-slate-200 rounded" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex items-center gap-6 py-2 overflow-x-auto">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-lg">
        <span className="text-2xl font-bold text-blue-700">{stats.active_orders}</span>
        <span className="text-xs text-blue-600">Órdenes activas</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 rounded-lg">
        <span className="text-2xl font-bold text-yellow-700">{stats.pending_items}</span>
        <span className="text-xs text-yellow-600">En cola</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 rounded-lg">
        <span className="text-2xl font-bold text-orange-700">{stats.preparing_items}</span>
        <span className="text-xs text-orange-600">Preparando</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-lg">
        <span className="text-2xl font-bold text-green-700">{stats.ready_items}</span>
        <span className="text-xs text-green-600">Listos</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
        <span className="text-2xl font-bold text-slate-700">{stats.avg_prep_time}m</span>
        <span className="text-xs text-slate-600">Tiempo prom.</span>
      </div>
    </div>
  );
}

// ======================
// FILTER BAR
// ======================

interface FilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedStation: KitchenStation | 'all';
  onStationChange: (station: KitchenStation | 'all') => void;
  selectedStatus: FilterStatus;
  onStatusChange: (status: FilterStatus) => void;
  stations: KitchenStationConfig[];
  onRefresh?: () => void;
}

function FilterBar({
  viewMode,
  onViewModeChange,
  selectedStation,
  onStationChange,
  selectedStatus,
  onStatusChange,
  stations,
  onRefresh,
}: FilterBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-200">
      <div className="flex items-center gap-4">
        {/* View mode toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('all')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              viewMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            )}
          >
            Todas
          </button>
          <button
            onClick={() => onViewModeChange('station')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              viewMode === 'station' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            )}
          >
            Por Estación
          </button>
          <button
            onClick={() => onViewModeChange('status')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              viewMode === 'status' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            )}
          >
            Por Estado
          </button>
        </div>

        {/* Station filter */}
        {viewMode === 'station' && (
          <select
            value={selectedStation}
            onChange={e => onStationChange(e.target.value as KitchenStation | 'all')}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
          >
            <option value="all">Todas las estaciones</option>
            {stations.map(s => (
              <option key={s.id} value={s.station_type}>
                {s.name}
              </option>
            ))}
            {Object.entries(STATION_CONFIG).map(([key, config]) => {
              if (stations.some(s => s.station_type === key)) return null;
              return (
                <option key={key} value={key}>
                  {config.label}
                </option>
              );
            })}
          </select>
        )}

        {/* Status filter */}
        {viewMode === 'status' && (
          <select
            value={selectedStatus}
            onChange={e => onStatusChange(e.target.value as FilterStatus)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
          >
            <option value="all">Todos los estados</option>
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ======================
// ORDER GRID
// ======================

interface OrderGridProps {
  orders: KDSOrderView[];
  onBumpOrder?: (orderId: string) => void;
  onRecallOrder?: (orderId: string) => void;
  onStartItem?: (itemId: string) => void;
  onBumpItem?: (itemId: string) => void;
  onCancelItem?: (itemId: string) => void;
  onPriorityChange?: (orderId: string, priority: number) => void;
}

function OrderGrid({
  orders,
  onBumpOrder,
  onRecallOrder,
  onStartItem,
  onBumpItem,
  onCancelItem,
  onPriorityChange,
}: OrderGridProps) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Sin órdenes activas</h3>
        <p className="text-slate-500">Las nuevas órdenes aparecerán aquí automáticamente</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {orders.map(order => (
        <KDSOrderCard
          key={order.order_id}
          order={order}
          onBumpOrder={onBumpOrder}
          onRecallOrder={onRecallOrder}
          onStartItem={onStartItem}
          onBumpItem={onBumpItem}
          onCancelItem={onCancelItem}
          onPriorityChange={onPriorityChange}
        />
      ))}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function KDSDisplay({
  orders,
  stats,
  stations,
  loading = false,
  onBumpOrder,
  onRecallOrder,
  onStartItem,
  onBumpItem,
  onCancelItem,
  onPriorityChange,
  onRefresh,
}: KDSDisplayProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedStation, setSelectedStation] = useState<KitchenStation | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<FilterStatus>('all');

  // Filter orders based on current view mode
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (viewMode === 'station' && selectedStation !== 'all') {
      result = result.filter(order =>
        order.items?.some(item => item.kitchen_station === selectedStation)
      );
    }

    if (viewMode === 'status' && selectedStatus !== 'all') {
      result = result.filter(order => order.order_status === selectedStatus);
    }

    // Sort by priority (desc) then by time (asc)
    return result.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime();
    });
  }, [orders, viewMode, selectedStation, selectedStatus]);

  // Group orders by station if in station view
  const ordersByStation = useMemo(() => {
    if (viewMode !== 'station') return null;

    const grouped: Record<string, KDSOrderView[]> = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        const station = item.kitchen_station || 'main';
        if (!grouped[station]) grouped[station] = [];
        if (!grouped[station].find(o => o.order_id === order.order_id)) {
          grouped[station].push(order);
        }
      });
    });
    return grouped;
  }, [orders, viewMode]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <StatsBar stats={null} loading />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <StatsBar stats={stats} />

      {/* Filter Bar */}
      <FilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedStation={selectedStation}
        onStationChange={setSelectedStation}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        stations={stations}
        onRefresh={onRefresh}
      />

      {/* Orders Display */}
      {viewMode === 'station' && ordersByStation ? (
        <div className="space-y-6">
          {Object.entries(ordersByStation).map(([station, stationOrders]) => {
            const stationConfig = STATION_CONFIG[station as KitchenStation];
            return (
              <div key={station}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stationConfig?.color || '#64748B' }}
                  />
                  <h3 className="font-semibold text-slate-900">
                    {stationConfig?.label || station}
                  </h3>
                  <span className="text-sm text-slate-500">
                    ({stationOrders.length} {stationOrders.length === 1 ? 'orden' : 'órdenes'})
                  </span>
                </div>
                <OrderGrid
                  orders={stationOrders}
                  onBumpOrder={onBumpOrder}
                  onRecallOrder={onRecallOrder}
                  onStartItem={onStartItem}
                  onBumpItem={onBumpItem}
                  onCancelItem={onCancelItem}
                  onPriorityChange={onPriorityChange}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <OrderGrid
          orders={filteredOrders}
          onBumpOrder={onBumpOrder}
          onRecallOrder={onRecallOrder}
          onStartItem={onStartItem}
          onBumpItem={onBumpItem}
          onCancelItem={onCancelItem}
          onPriorityChange={onPriorityChange}
        />
      )}
    </div>
  );
}

export default KDSDisplay;
