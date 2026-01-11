'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Movements Tab
// Timeline view for stock movements history
// =====================================================

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Package,
  Trash2,
  AlertTriangle,
  ShoppingCart,
  RotateCcw,
  Utensils,
  ChefHat,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import type { InventoryMovement, InventoryItem, MovementType } from '../types';
import { MOVEMENT_TYPE_CONFIG } from '../types';

// ======================
// CONSTANTS
// ======================

const MOVEMENT_ICONS: Record<MovementType, React.ElementType> = {
  purchase: ShoppingCart,
  sale: TrendingDown,
  consumption: Utensils,
  waste: Trash2,
  adjustment: AlertTriangle,
  transfer_in: ArrowDownCircle,
  transfer_out: ArrowUpCircle,
  return: RotateCcw,
  production: ChefHat,
};

const MOVEMENT_COLORS: Record<MovementType, { bg: string; text: string; border: string }> = {
  purchase: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  sale: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  consumption: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  waste: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  adjustment: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  transfer_in: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  transfer_out: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  return: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  production: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
};

// ======================
// TYPES
// ======================

interface MovementsTabProps {
  movements: InventoryMovement[];
  items: InventoryItem[];
  isLoading?: boolean;
  onRecordMovement: () => void;
  onRefresh?: () => void;
}

type DateFilter = 'today' | 'week' | 'month' | 'all';
type MovementFilter = MovementType | 'all';

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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Ahora mismo';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDate(dateString);
}

function groupMovementsByDate(movements: InventoryMovement[]): Map<string, InventoryMovement[]> {
  const grouped = new Map<string, InventoryMovement[]>();

  movements.forEach(movement => {
    const date = new Date(movement.performed_at);
    const dateKey = date.toISOString().split('T')[0];

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(movement);
  });

  return grouped;
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

// ======================
// SUB-COMPONENTS
// ======================

function MovementCard({
  movement,
  item,
  isExpanded,
  onToggle,
}: {
  movement: InventoryMovement;
  item?: InventoryItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = MOVEMENT_TYPE_CONFIG[movement.movement_type];
  const colors = MOVEMENT_COLORS[movement.movement_type];
  const Icon = MOVEMENT_ICONS[movement.movement_type];
  const isPositive = config.isPositive;

  return (
    <div
      className={cn(
        'relative bg-white rounded-xl border transition-all duration-200',
        'hover:shadow-md cursor-pointer',
        isExpanded ? 'ring-2 ring-indigo-200 shadow-md' : 'border-slate-200'
      )}
      onClick={onToggle}
    >
      {/* Timeline connector */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
           style={{ backgroundColor: isPositive ? '#10b981' : '#ef4444' }} />

      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon */}
            <div className={cn(
              'p-2.5 rounded-xl flex-shrink-0',
              colors.bg
            )}>
              <Icon className={cn('w-5 h-5', colors.text)} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  colors.bg,
                  colors.text
                )}>
                  {config.label}
                </span>
                <span className="text-xs text-slate-500">
                  {formatRelativeTime(movement.performed_at)}
                </span>
              </div>

              <h4 className="font-medium text-slate-900 mt-1 truncate">
                {item?.name || 'Producto desconocido'}
              </h4>

              {movement.reason && (
                <p className="text-sm text-slate-500 mt-0.5 truncate">
                  {movement.reason}
                </p>
              )}
            </div>
          </div>

          {/* Quantity change */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={cn(
              'px-3 py-1.5 rounded-lg font-semibold text-sm',
              isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            )}>
              {isPositive ? '+' : '-'}{Math.abs(movement.quantity).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
              {item && <span className="text-xs ml-1 opacity-70">{item.unit}</span>}
            </div>

            <button className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center hover:bg-slate-100 rounded-lg active:scale-95 transition-all">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {/* Stock change */}
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Stock Anterior</p>
                <p className="font-semibold text-slate-700">
                  {movement.previous_stock.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                </p>
              </div>
              <ArrowUpDown className="w-5 h-5 text-slate-400" />
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Stock Nuevo</p>
                <p className={cn(
                  'font-semibold',
                  movement.new_stock <= (item?.minimum_stock || 0) ? 'text-red-600' : 'text-slate-700'
                )}>
                  {movement.new_stock.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                </p>
              </div>
            </div>

            {/* Additional info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Timestamp */}
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{formatDate(movement.performed_at)} a las {formatTime(movement.performed_at)}</span>
              </div>

              {/* Cost */}
              {movement.total_cost != null && movement.total_cost > 0 && (
                <div className="flex items-center gap-2 text-slate-600">
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                  <span>
                    ${movement.total_cost.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                  </span>
                </div>
              )}

              {/* Reference */}
              {movement.reference_type && movement.reference_id && (
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="truncate">
                    {movement.reference_type}: {movement.reference_id}
                  </span>
                </div>
              )}

              {/* Staff */}
              {movement.staff_id && (
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Registrado por staff</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {movement.notes && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-xs text-amber-600 font-medium mb-1">Notas:</p>
                <p className="text-sm text-amber-800">{movement.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onRecordMovement }: { onRecordMovement: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 bg-slate-100 rounded-full mb-4">
        <ArrowUpDown className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Sin movimientos registrados
      </h3>
      <p className="text-slate-500 text-center mb-6 max-w-md">
        Aquí verás el historial de todos los movimientos de inventario: compras, consumos, mermas y ajustes.
      </p>
      <button
        onClick={onRecordMovement}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Registrar Movimiento
      </button>
    </div>
  );
}

function StatsBar({ movements, items }: { movements: InventoryMovement[]; items: InventoryItem[] }) {
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayMovements = movements.filter(m => {
      const mDate = new Date(m.performed_at);
      mDate.setHours(0, 0, 0, 0);
      return mDate.getTime() === today.getTime();
    });

    const entriesCount = movements.filter(m => MOVEMENT_TYPE_CONFIG[m.movement_type].isPositive).length;
    const exitsCount = movements.filter(m => !MOVEMENT_TYPE_CONFIG[m.movement_type].isPositive).length;

    const totalValue = movements
      .filter(m => m.total_cost != null)
      .reduce((sum, m) => sum + (m.total_cost || 0), 0);

    return {
      total: movements.length,
      today: todayMovements.length,
      entries: entriesCount,
      exits: exitsCount,
      value: totalValue,
    };
  }, [movements]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <ArrowUpDown className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Total</span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">Hoy</span>
        </div>
        <p className="text-2xl font-bold text-indigo-600">{stats.today}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className="text-xs text-slate-500">Entradas</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{stats.entries}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <span className="text-xs text-slate-500">Salidas</span>
        </div>
        <p className="text-2xl font-bold text-red-600">{stats.exits}</p>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function MovementsTab({
  movements,
  items,
  isLoading = false,
  onRecordMovement,
  onRefresh,
}: MovementsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [typeFilter, setTypeFilter] = useState<MovementFilter>('all');
  const [itemFilter, setItemFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Create item lookup map
  const itemsMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    items.forEach(item => map.set(item.id, item));
    return map;
  }, [items]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    let filtered = [...movements];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(m => {
        const item = itemsMap.get(m.item_id);
        return (
          item?.name.toLowerCase().includes(search) ||
          m.reason?.toLowerCase().includes(search) ||
          m.notes?.toLowerCase().includes(search)
        );
      });
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(m => {
        const mDate = new Date(m.performed_at);

        switch (dateFilter) {
          case 'today':
            return mDate >= today;
          case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return mDate >= weekAgo;
          }
          case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return mDate >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(m => m.movement_type === typeFilter);
    }

    // Item filter
    if (itemFilter !== 'all') {
      filtered = filtered.filter(m => m.item_id === itemFilter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) =>
      new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
    );

    return filtered;
  }, [movements, searchTerm, dateFilter, typeFilter, itemFilter, itemsMap]);

  // Group by date
  const groupedMovements = useMemo(() =>
    groupMovementsByDate(filteredMovements),
    [filteredMovements]
  );

  // Active filters count
  const activeFiltersCount = [
    dateFilter !== 'all',
    typeFilter !== 'all',
    itemFilter !== 'all',
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="text-slate-500">Cargando movimientos...</p>
        </div>
      </div>
    );
  }

  if (movements.length === 0) {
    return <EmptyState onRecordMovement={onRecordMovement} />;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <StatsBar movements={movements} items={items} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por producto, motivo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
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
          Filtros
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
            Actualizar
          </button>
        )}

        {/* Record movement */}
        <button
          onClick={onRecordMovement}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Movimiento
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Date filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Período
              </label>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value as DateFilter)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">Todo el historial</option>
                <option value="today">Hoy</option>
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
              </select>
            </div>

            {/* Type filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo de Movimiento
              </label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as MovementFilter)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">Todos los tipos</option>
                {Object.entries(MOVEMENT_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Item filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Producto
              </label>
              <select
                value={itemFilter}
                onChange={e => setItemFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="all">Todos los productos</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeFiltersCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setDateFilter('all');
                  setTypeFilter('all');
                  setItemFilter('all');
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
          {filteredMovements.length} {filteredMovements.length === 1 ? 'movimiento' : 'movimientos'}
          {activeFiltersCount > 0 && ' (filtrado)'}
        </p>
      </div>

      {/* Timeline */}
      {filteredMovements.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No se encontraron movimientos con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedMovements.entries()).map(([dateKey, dayMovements]) => (
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
                  {dayMovements.length} {dayMovements.length === 1 ? 'movimiento' : 'movimientos'}
                </span>
              </div>

              {/* Day movements */}
              <div className="space-y-3 ml-2">
                {dayMovements.map(movement => (
                  <MovementCard
                    key={movement.id}
                    movement={movement}
                    item={itemsMap.get(movement.item_id)}
                    isExpanded={expandedId === movement.id}
                    onToggle={() => setExpandedId(
                      expandedId === movement.id ? null : movement.id
                    )}
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

export default MovementsTab;
