// =====================================================
// TIS TIS PLATFORM - Menu Overview Component
// Dashboard with stats and quick insights
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { cn } from '@/shared/utils';
import type { MenuStats, MenuCategory } from '../types';

// ======================
// STAT CARD
// ======================
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'default' | 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
}

function StatCard({ title, value, subtitle, icon, color = 'default' }: StatCardProps) {
  const colorConfig = {
    default: { iconBg: 'bg-slate-100', iconText: 'text-slate-600' },
    emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
    red: { iconBg: 'bg-red-100', iconText: 'text-red-600' },
    purple: { iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
  };

  const config = colorConfig[color];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300/80">
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', config.iconBg, config.iconText)}>
            {icon}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
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
// POPULAR ITEMS
// ======================
interface PopularItemsProps {
  items: Array<{
    id: string;
    name: string;
    times_ordered: number;
    image_url: string | null;
  }>;
}

function PopularItems({ items }: PopularItemsProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Más Ordenados</h3>
          <p className="text-xs text-slate-500">Top platillos del menú</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">Aún no hay datos de órdenes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0',
                  i === 0 ? 'bg-slate-900 text-white' :
                  i === 1 ? 'bg-slate-600 text-white' :
                  i === 2 ? 'bg-slate-400 text-white' :
                  'bg-slate-100 text-slate-600'
                )}
              >
                {i + 1}
              </div>

              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{item.name}</p>
              </div>

              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 text-xs font-medium border border-slate-100">
                {item.times_ordered} órdenes
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// CATEGORIES BREAKDOWN
// ======================
interface CategoriesBreakdownProps {
  categories: Array<{
    id: string;
    name: string;
    items_count: number;
  }>;
  totalItems: number;
}

function CategoriesBreakdown({ categories, totalItems }: CategoriesBreakdownProps) {
  const sortedCategories = [...categories].sort((a, b) => b.items_count - a.items_count);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Por Categoría</h3>
          <p className="text-xs text-slate-500">{categories.length} categorías</p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedCategories.map((cat) => {
          const percentage = totalItems > 0 ? Math.round((cat.items_count / totalItems) * 100) : 0;

          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{cat.items_count} items</span>
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
    </div>
  );
}

// ======================
// DIETARY DISTRIBUTION
// ======================
interface DietaryDistributionProps {
  counts: {
    vegetarian: number;
    vegan: number;
    gluten_free: number;
  };
  total: number;
}

function DietaryDistribution({ counts, total }: DietaryDistributionProps) {
  const items = [
    { key: 'vegetarian', label: 'Vegetariano', count: counts.vegetarian, icon: '🥬', color: 'bg-emerald-500' },
    { key: 'vegan', label: 'Vegano', count: counts.vegan, icon: '🌱', color: 'bg-green-500' },
    { key: 'gluten_free', label: 'Sin Gluten', count: counts.gluten_free, icon: '🌾', color: 'bg-amber-500' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 hover:shadow-md hover:border-slate-300/80 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Opciones Dietéticas</h3>
          <p className="text-xs text-slate-500">Platillos especiales</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => {
          const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;

          return (
            <div key={item.key} className="text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-xl font-bold text-slate-900">{item.count}</p>
              <p className="text-xs text-slate-500">{item.label}</p>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', item.color)}
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
// QUICK ACTIONS
// ======================
interface QuickActionsProps {
  onAddCategory: () => void;
  onAddItem: () => void;
  onImport: () => void;
}

function QuickActions({ onAddCategory, onAddItem, onImport }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button
        onClick={onAddItem}
        className="flex items-center gap-3 p-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div className="text-left">
          <p className="font-medium">Nuevo Platillo</p>
          <p className="text-xs text-white/60">Agregar al menú</p>
        </div>
      </button>

      <button
        onClick={onAddCategory}
        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div className="text-left">
          <p className="font-medium text-slate-900">Nueva Categoría</p>
          <p className="text-xs text-slate-500">Organizar menú</p>
        </div>
      </button>

      <button
        onClick={onImport}
        className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div className="text-left">
          <p className="font-medium text-slate-900">Importar</p>
          <p className="text-xs text-slate-500">Desde archivo</p>
        </div>
      </button>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface MenuOverviewProps {
  stats: MenuStats | null;
  loading?: boolean;
  onAddCategory: () => void;
  onAddItem: () => void;
  onImport: () => void;
}

export function MenuOverview({
  stats,
  loading,
  onAddCategory,
  onAddItem,
  onImport,
}: MenuOverviewProps) {
  if (loading || !stats) {
    return <MenuOverviewSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <QuickActions
        onAddCategory={onAddCategory}
        onAddItem={onAddItem}
        onImport={onImport}
      />

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Platillos"
          value={stats.total_items}
          subtitle={`${stats.total_categories} categorías`}
          color="default"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
        />

        <StatCard
          title="Disponibles"
          value={stats.available_items}
          subtitle={`${stats.unavailable_items} agotados`}
          color="emerald"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Destacados"
          value={stats.featured_items}
          subtitle="Promocionados"
          color="amber"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />

        <StatCard
          title="Precio Promedio"
          value={`$${(stats.average_price ?? 0).toFixed(0)}`}
          subtitle="Por platillo"
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PopularItems items={stats.most_ordered} />
        <CategoriesBreakdown
          categories={stats.categories_breakdown}
          totalItems={stats.total_items}
        />
        <DietaryDistribution
          counts={stats.dietary_counts}
          total={stats.total_items}
        />
      </div>
    </div>
  );
}

// ======================
// SKELETON
// ======================
function MenuOverviewSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 h-36" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 h-64" />
        ))}
      </div>
    </div>
  );
}

export { MenuOverviewSkeleton };
