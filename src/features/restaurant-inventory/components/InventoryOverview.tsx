'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Overview Component
// Dashboard view for inventory statistics and alerts
// =====================================================

import { cn } from '@/shared/utils';
import type { InventoryStats, InventoryItem } from '../types';
import { STORAGE_TYPE_CONFIG } from '../types';

// ======================
// TYPES
// ======================

interface InventoryOverviewProps {
  stats: InventoryStats | null;
  items: InventoryItem[];
  loading?: boolean;
  onViewLowStock?: () => void;
  onViewExpiring?: () => void;
  onAddItem?: () => void;
  onRegisterEntry?: () => void;
  onPhysicalCount?: () => void;
  onExportReport?: () => void;
}

// ======================
// STAT CARD
// ======================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
  className?: string;
}

function StatCard({ title, value, subtitle, icon, trend, onClick, className }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-5 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-slate-300',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="p-2 bg-slate-100 rounded-xl">{icon}</div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              trend.isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
          >
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ======================
// LOW STOCK ALERT
// ======================

interface LowStockAlertProps {
  items: Array<{
    id: string;
    name: string;
    current_stock: number;
    minimum_stock: number;
    unit: string;
  }>;
  onViewAll?: () => void;
}

function LowStockAlert({ items, onViewAll }: LowStockAlertProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 rounded-lg">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="font-semibold text-amber-800">Stock bajo</span>
          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
            {items.length} items
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-amber-700 hover:text-amber-900 font-medium"
          >
            Ver todos →
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-2 px-3 bg-white rounded-lg"
          >
            <span className="text-sm font-medium text-slate-700">{item.name}</span>
            <div className="text-right">
              <span className="text-sm font-bold text-red-600">
                {item.current_stock} {item.unit}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                / min: {item.minimum_stock}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================
// EXPIRING BATCHES ALERT
// ======================

interface ExpiringBatchesAlertProps {
  batches: Array<{
    batch_id: string;
    item_name: string;
    expiration_date: string;
    days_until_expiration: number;
    quantity: number;
  }>;
  onViewAll?: () => void;
}

function ExpiringBatchesAlert({ batches, onViewAll }: ExpiringBatchesAlertProps) {
  if (batches.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 rounded-lg">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-semibold text-red-800">Próximos a expirar</span>
          <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
            {batches.length} lotes
          </span>
        </div>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs text-red-700 hover:text-red-900 font-medium"
          >
            Ver todos →
          </button>
        )}
      </div>
      <div className="space-y-2">
        {batches.slice(0, 5).map((batch) => (
          <div
            key={batch.batch_id}
            className="flex items-center justify-between py-2 px-3 bg-white rounded-lg"
          >
            <span className="text-sm font-medium text-slate-700">{batch.item_name}</span>
            <div className="text-right">
              <span
                className={cn(
                  'text-sm font-bold',
                  batch.days_until_expiration <= 0
                    ? 'text-red-600'
                    : batch.days_until_expiration <= 3
                    ? 'text-orange-600'
                    : 'text-yellow-600'
                )}
              >
                {batch.days_until_expiration <= 0
                  ? 'EXPIRADO'
                  : `${batch.days_until_expiration} días`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ======================
// CATEGORY BREAKDOWN
// ======================

interface CategoryBreakdownProps {
  categories: Array<{
    category_id: string;
    category_name: string;
    value: number;
    items_count: number;
  }>;
}

function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const total = categories.reduce((sum, cat) => sum + cat.value, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-900 mb-4">Valor por categoría</h3>
      <div className="space-y-3">
        {categories.slice(0, 6).map((category) => {
          const percentage = total > 0 ? (category.value / total) * 100 : 0;
          return (
            <div key={category.category_id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-700">{category.category_name}</span>
                <span className="font-medium text-slate-900">
                  ${category.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-tis-coral transition-all"
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
// MAIN COMPONENT
// ======================

export function InventoryOverview({
  stats,
  items,
  loading = false,
  onViewLowStock,
  onViewExpiring,
  onAddItem,
  onRegisterEntry,
  onPhysicalCount,
  onExportReport,
}: InventoryOverviewProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-100 rounded-xl h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-100 rounded-xl h-64 animate-pulse" />
          <div className="bg-slate-100 rounded-xl h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Items"
          value={stats?.total_items || 0}
          subtitle={`${stats?.categories_count || 0} categorías`}
          icon={
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          title="Valor total"
          value={`$${(stats?.total_value || 0).toLocaleString()}`}
          subtitle="MXN"
          icon={
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Stock bajo"
          value={stats?.low_stock_count || 0}
          subtitle="Requieren reorden"
          onClick={onViewLowStock}
          className={stats?.low_stock_count ? 'border-amber-200 bg-amber-50' : ''}
          icon={
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          title="Por expirar"
          value={stats?.expiring_soon_count || 0}
          subtitle="En los próximos 14 días"
          onClick={onViewExpiring}
          className={stats?.expiring_soon_count ? 'border-red-200 bg-red-50' : ''}
          icon={
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Alerts and Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <LowStockAlert
            items={stats?.low_stock_items || []}
            onViewAll={onViewLowStock}
          />
          <ExpiringBatchesAlert
            batches={stats?.expiring_batches || []}
            onViewAll={onViewExpiring}
          />
          {!stats?.low_stock_items?.length && !stats?.expiring_batches?.length && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="font-semibold text-green-800">Todo en orden</h4>
              <p className="text-sm text-green-600 mt-1">
                No hay alertas de inventario en este momento
              </p>
            </div>
          )}
        </div>

        <CategoryBreakdown categories={stats?.value_by_category || []} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Acciones rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={onAddItem}
            className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <div className="w-10 h-10 bg-tis-coral/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-tis-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Agregar item</span>
          </button>
          <button
            onClick={onRegisterEntry}
            disabled={!onRegisterEntry}
            className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Registrar entrada</span>
          </button>
          <button
            onClick={onPhysicalCount}
            disabled={!onPhysicalCount}
            className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Conteo físico</span>
          </button>
          <button
            onClick={onExportReport}
            disabled={!onExportReport}
            className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-700">Exportar reporte</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default InventoryOverview;
