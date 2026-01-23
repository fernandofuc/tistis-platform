// =====================================================
// TIS TIS PLATFORM - Inventory List Component
// Premium list/grid display for inventory items
// Apple/Google-inspired with TIS TIS brand identity
// =====================================================

'use client';

import { forwardRef, useState, useCallback, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';
import type { InventoryItemDisplay } from '../types';
import { InventoryItemCard } from './InventoryItemCard';

// ======================
// TYPES
// ======================
export interface InventoryListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  items: InventoryItemDisplay[];
  loading?: boolean;
  error?: string | null;
  layout?: 'grid' | 'list' | 'compact';
  selectedId?: string | null;
  onSelect?: (item: InventoryItemDisplay) => void;
  onEdit?: (item: InventoryItemDisplay) => void;
  onDelete?: (item: InventoryItemDisplay) => void;
  onRetry?: () => void;
  showActions?: boolean;
  showStock?: boolean;
  showValue?: boolean;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
}

// ======================
// SKELETON LOADER
// ======================
const InventoryItemSkeleton = ({ layout = 'grid' }: { layout?: 'grid' | 'list' | 'compact' }) => {
  if (layout === 'compact') {
    return (
      <div className="p-3 bg-white rounded-xl animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
          <div className="w-16 h-5 bg-slate-200 rounded-full" />
        </div>
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="p-4 bg-white rounded-xl animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-200" />
          <div className="flex-1 min-w-0">
            <div className="h-5 w-48 bg-slate-200 rounded mb-2" />
            <div className="h-3 w-32 bg-slate-200 rounded" />
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="w-20 h-5 bg-slate-200 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // Grid skeleton
  return (
    <div className="p-4 bg-white rounded-xl animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200" />
          <div>
            <div className="h-4 w-28 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-16 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="w-16 h-5 bg-slate-200 rounded-full" />
      </div>
      <div className="h-2 w-full bg-slate-200 rounded-full mb-3" />
      <div className="flex justify-between">
        <div className="w-20 h-5 bg-slate-200 rounded-full" />
        <div className="w-16 h-4 bg-slate-200 rounded" />
      </div>
    </div>
  );
};

// ======================
// EMPTY STATE
// ======================
interface EmptyStateProps {
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState = ({ message, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Empty illustration */}
      <div className="w-24 h-24 mb-6 rounded-full bg-slate-100 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Sin items de inventario
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
        {message}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5',
            'bg-tis-coral text-white font-medium rounded-xl',
            'hover:bg-tis-coral-600 transition-colors duration-200',
            'shadow-coral min-h-[44px]'
          )}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {action.label}
        </button>
      )}
    </div>
  );
};

// ======================
// ERROR STATE
// ======================
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = ({ message, onRetry }: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Error illustration */}
      <div className="w-24 h-24 mb-6 rounded-full bg-red-100 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Error al cargar inventario
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5',
            'bg-slate-900 text-white font-medium rounded-xl',
            'hover:bg-slate-800 transition-colors duration-200',
            'min-h-[44px]'
          )}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reintentar
        </button>
      )}
    </div>
  );
};

// ======================
// LAYOUT TOGGLE
// ======================
interface LayoutToggleProps {
  layout: 'grid' | 'list' | 'compact';
  onChange: (layout: 'grid' | 'list' | 'compact') => void;
}

export const InventoryLayoutToggle = ({ layout, onChange }: LayoutToggleProps) => {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg" role="group" aria-label="Opciones de visualización">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={cn(
          'p-2 rounded-md transition-all duration-200',
          layout === 'grid'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        )}
        title="Vista de cuadrícula"
        aria-label="Vista de cuadrícula"
        aria-pressed={layout === 'grid'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={cn(
          'p-2 rounded-md transition-all duration-200',
          layout === 'list'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        )}
        title="Vista de lista"
        aria-label="Vista de lista"
        aria-pressed={layout === 'list'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('compact')}
        className={cn(
          'p-2 rounded-md transition-all duration-200',
          layout === 'compact'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        )}
        title="Vista compacta"
        aria-label="Vista compacta"
        aria-pressed={layout === 'compact'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
};

// ======================
// MAIN COMPONENT
// ======================
export const InventoryList = forwardRef<HTMLDivElement, InventoryListProps>(
  ({
    className,
    items,
    loading = false,
    error = null,
    layout = 'grid',
    selectedId = null,
    onSelect,
    onEdit,
    onDelete,
    onRetry,
    showActions = true,
    showStock = true,
    showValue = true,
    emptyMessage = 'No hay items que coincidan con los filtros aplicados.',
    emptyAction,
    ...props
  }, ref) => {
    // Loading state
    if (loading) {
      const skeletonCount = layout === 'compact' ? 8 : 6;
      const gridClasses = {
        grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
        list: 'space-y-3',
        compact: 'space-y-2',
      };

      return (
        <div ref={ref} className={cn(gridClasses[layout], className)} {...props}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <InventoryItemSkeleton key={i} layout={layout} />
          ))}
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div ref={ref} className={className} {...props}>
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      );
    }

    // Empty state
    if (items.length === 0) {
      return (
        <div ref={ref} className={className} {...props}>
          <EmptyState message={emptyMessage} action={emptyAction} />
        </div>
      );
    }

    // Map layout to card variant
    const cardVariant = layout === 'compact' ? 'compact' : 'default';

    // Layout classes
    const layoutClasses = {
      grid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
      list: 'space-y-3',
      compact: 'space-y-2',
    };

    return (
      <div
        ref={ref}
        className={cn(layoutClasses[layout], className)}
        {...props}
      >
        {items.map((item) => (
          <InventoryItemCard
            key={item.id}
            item={item}
            variant={cardVariant}
            selected={selectedId === item.id}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            showActions={showActions}
            showStock={showStock}
            showValue={showValue}
          />
        ))}
      </div>
    );
  }
);

InventoryList.displayName = 'InventoryList';

// ======================
// VIRTUALIZED LIST (for large datasets)
// Placeholder for future implementation
// ======================
export interface VirtualizedInventoryListProps extends InventoryListProps {
  height?: number;
  itemHeight?: number;
}

export const VirtualizedInventoryList = forwardRef<HTMLDivElement, VirtualizedInventoryListProps>(
  ({ height = 600, itemHeight = 100, ...props }, ref) => {
    // For now, fallback to regular list
    // Future: Implement react-window or similar for virtualization
    if (process.env.NODE_ENV === 'development') {
      console.warn('[InventoryList] VirtualizedInventoryList is not yet implemented, falling back to regular list');
    }
    return <InventoryList ref={ref} {...props} />;
  }
);

VirtualizedInventoryList.displayName = 'VirtualizedInventoryList';
