'use client';

// =====================================================
// TIS TIS PLATFORM - Orders History Tab
// Historical view of completed/cancelled kitchen orders
// =====================================================

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  TrendingUp,
  Timer,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  Car,
  ChefHat,
  Users,
  DollarSign,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import type {
  RestaurantOrder,
  OrderStatus,
  OrderType,
} from '../types';
import { ORDER_TYPE_CONFIG, ORDER_STATUS_CONFIG } from '../types';

// ======================
// CONSTANTS
// ======================

const ORDER_TYPE_ICONS: Record<OrderType, React.ElementType> = {
  dine_in: UtensilsCrossed,
  takeout: ShoppingBag,
  delivery: Truck,
  drive_thru: Car,
  catering: ChefHat,
};

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';
type StatusFilter = OrderStatus | 'all';

// ======================
// TYPES
// ======================

interface OrdersHistoryTabProps {
  orders: RestaurantOrder[];
  isLoading?: boolean;
  onViewOrder?: (order: RestaurantOrder) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

// ======================
// HELPER FUNCTIONS
// ======================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function getDateLabel(dateKey: string): string {
  const date = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return 'Hoy';
  if (date.getTime() === yesterday.getTime()) return 'Ayer';

  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function groupOrdersByDate(orders: RestaurantOrder[]): Map<string, RestaurantOrder[]> {
  const grouped = new Map<string, RestaurantOrder[]>();

  orders.forEach(order => {
    const date = new Date(order.ordered_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(order);
  });

  return grouped;
}

// ======================
// SUB-COMPONENTS
// ======================

function StatsBar({ orders }: { orders: RestaurantOrder[] }) {
  const stats = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed' || o.status === 'served');
    const cancelled = orders.filter(o => o.status === 'cancelled');

    const prepTimes = completed
      .map(o => o.actual_prep_time)
      .filter((t): t is number => t !== null && t > 0);

    const avgPrepTime = prepTimes.length > 0
      ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
      : 0;

    const totalRevenue = completed.reduce((sum, o) => sum + o.total, 0);

    return {
      total: orders.length,
      completed: completed.length,
      cancelled: cancelled.length,
      avgPrepTime,
      totalRevenue,
    };
  }, [orders]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <UtensilsCrossed className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Total</span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-xs text-slate-500">Completadas</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <XCircle className="w-4 h-4 text-red-500" />
          <span className="text-xs text-slate-500">Canceladas</span>
        </div>
        <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Timer className="w-4 h-4 text-indigo-500" />
          <span className="text-xs text-slate-500">Tiempo Prom.</span>
        </div>
        <p className="text-2xl font-bold text-indigo-600">
          {stats.avgPrepTime > 0 ? `${stats.avgPrepTime}m` : '-'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-emerald-500" />
          <span className="text-xs text-slate-500">Ingresos</span>
        </div>
        <p className="text-2xl font-bold text-emerald-600">
          ${stats.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  isExpanded,
  onToggle,
  onView,
}: {
  order: RestaurantOrder;
  isExpanded: boolean;
  onToggle: () => void;
  onView?: () => void;
}) {
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type];
  const statusConfig = ORDER_STATUS_CONFIG[order.status];
  const TypeIcon = ORDER_TYPE_ICONS[order.order_type];
  const isCompleted = order.status === 'completed' || order.status === 'served';
  const isCancelled = order.status === 'cancelled';

  const itemsCount = order.items?.length || 0;
  const prepTime = order.actual_prep_time || order.estimated_prep_time;

  return (
    <div
      className={cn(
        'relative bg-white rounded-xl border transition-all duration-200 overflow-hidden',
        'hover:shadow-md cursor-pointer',
        isExpanded ? 'ring-2 ring-indigo-200 shadow-md' : 'border-slate-200'
      )}
      onClick={onToggle}
    >
      {/* Status indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          isCompleted && 'bg-green-500',
          isCancelled && 'bg-red-500',
          !isCompleted && !isCancelled && 'bg-slate-300'
        )}
      />

      <div className="p-4 pl-5 relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Order type icon */}
            <div className={cn(
              'p-2.5 rounded-xl flex-shrink-0',
              typeConfig.color,
              'bg-opacity-20'
            )}>
              <TypeIcon className="w-5 h-5 text-slate-700" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 text-lg">
                  #{order.display_number}
                </span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  statusConfig.bgColor,
                  statusConfig.color
                )}>
                  {statusConfig.label}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(order.ordered_at)}
                </span>
                <span>{typeConfig.label}</span>
                {order.table && (
                  <span className="text-indigo-600 font-medium">
                    Mesa {order.table.table_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right side info */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="font-semibold text-slate-900">
                ${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500">
                {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
              </p>
            </div>

            <button className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
            {/* Items list */}
            {order.items && order.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Items del pedido</p>
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between bg-slate-50 rounded-lg p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.menu_item_name}</p>
                          {(item.variant_name || item.size_name) && (
                            <p className="text-xs text-slate-500">
                              {[item.variant_name, item.size_name].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-slate-600">
                        ${item.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timing info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Ordenado</p>
                <p className="font-medium text-slate-900">{formatTime(order.ordered_at)}</p>
              </div>

              {order.started_preparing_at && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Inicio prep.</p>
                  <p className="font-medium text-slate-900">{formatTime(order.started_preparing_at)}</p>
                </div>
              )}

              {order.ready_at && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Listo</p>
                  <p className="font-medium text-green-600">{formatTime(order.ready_at)}</p>
                </div>
              )}

              {prepTime && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Tiempo prep.</p>
                  <p className={cn(
                    'font-medium',
                    prepTime <= 15 ? 'text-green-600' : prepTime <= 30 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {formatDuration(prepTime)}
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            {(order.customer_notes || order.kitchen_notes || order.cancel_reason) && (
              <div className="space-y-2">
                {order.customer_notes && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">Nota del cliente:</p>
                    <p className="text-sm text-blue-800">{order.customer_notes}</p>
                  </div>
                )}
                {order.kitchen_notes && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <p className="text-xs text-amber-600 font-medium mb-1">Nota de cocina:</p>
                    <p className="text-sm text-amber-800">{order.kitchen_notes}</p>
                  </div>
                )}
                {order.cancel_reason && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <p className="text-xs text-red-600 font-medium mb-1">Razón de cancelación:</p>
                    <p className="text-sm text-red-800">{order.cancel_reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {onView && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Ver detalles completos
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 bg-slate-100 rounded-full mb-4">
        <Clock className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Sin historial de órdenes
      </h3>
      <p className="text-slate-500 text-center max-w-md">
        Aquí aparecerá el historial de todas las órdenes completadas y canceladas de tu cocina.
      </p>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function OrdersHistoryTab({
  orders,
  isLoading = false,
  onViewOrder,
  onRefresh,
  onExport,
}: OrdersHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.display_number.toLowerCase().includes(search) ||
        o.items?.some(i => i.menu_item_name.toLowerCase().includes(search)) ||
        o.customer?.full_name?.toLowerCase().includes(search)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(o => {
        const orderDate = new Date(o.ordered_at);

        switch (dateFilter) {
          case 'today':
            return orderDate >= today;
          case 'yesterday': {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return orderDate >= yesterday && orderDate < today;
          }
          case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return orderDate >= weekAgo;
          }
          case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return orderDate >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(o => o.order_type === typeFilter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) =>
      new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()
    );

    return filtered;
  }, [orders, searchTerm, dateFilter, statusFilter, typeFilter]);

  // Group by date
  const groupedOrders = useMemo(() =>
    groupOrdersByDate(filteredOrders),
    [filteredOrders]
  );

  // Active filters count
  const activeFiltersCount = [
    dateFilter !== 'today',
    statusFilter !== 'all',
    typeFilter !== 'all',
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="text-slate-500">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <StatsBar orders={filteredOrders} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por #orden, item, cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        {/* Date quick filters */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['today', 'yesterday', 'week', 'month'] as DateFilter[]).map(df => (
            <button
              key={df}
              onClick={() => setDateFilter(df)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                dateFilter === df
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {df === 'today' && 'Hoy'}
              {df === 'yesterday' && 'Ayer'}
              {df === 'week' && '7 días'}
              {df === 'month' && '30 días'}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium text-sm transition-all',
            showFilters || activeFiltersCount > 0
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          )}
        >
          <Filter className="w-4 h-4" />
          Más filtros
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Export */}
        {onExport && (
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        )}
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">Todos los estados</option>
                {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Type filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo de Orden
              </label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as OrderType | 'all')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">Todos los tipos</option>
                {Object.entries(ORDER_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {activeFiltersCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setDateFilter('today');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-slate-500">
          {filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'}
          {activeFiltersCount > 0 && ' (filtrado)'}
        </p>
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No se encontraron órdenes con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedOrders.entries()).map(([dateKey, dayOrders]) => (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {getDateLabel(dateKey)}
                  </span>
                </div>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">
                  {dayOrders.length} {dayOrders.length === 1 ? 'orden' : 'órdenes'}
                </span>
              </div>

              {/* Day orders */}
              <div className="space-y-3">
                {dayOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isExpanded={expandedId === order.id}
                    onToggle={() => setExpandedId(
                      expandedId === order.id ? null : order.id
                    )}
                    onView={onViewOrder ? () => onViewOrder(order) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrdersHistoryTab;
