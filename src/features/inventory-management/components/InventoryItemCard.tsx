// =====================================================
// TIS TIS PLATFORM - Inventory Item Card Component
// Premium card design for displaying inventory items
// Apple/Google-inspired with TIS TIS brand identity
// =====================================================

'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';
import { Card, CardHeader, CardContent, CardFooter } from '@/shared/components/ui';
import type { InventoryItemDisplay } from '../types';
import { ITEM_TYPE_CONFIG, STORAGE_TYPE_CONFIG } from '../config/inventory-config';
import { StockStatusBadge, StockLevelIndicator } from './StockStatusBadge';

// ======================
// TYPES
// ======================
export interface InventoryItemCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick' | 'onSelect'> {
  item: InventoryItemDisplay;
  variant?: 'default' | 'compact' | 'detailed';
  selected?: boolean;
  onSelect?: (item: InventoryItemDisplay) => void;
  onEdit?: (item: InventoryItemDisplay) => void;
  onDelete?: (item: InventoryItemDisplay) => void;
  showActions?: boolean;
  showStock?: boolean;
  showValue?: boolean;
}

// ======================
// SUB-COMPONENTS
// ======================

// Item Type Icon with color
const ItemTypeIcon = ({ type }: { type: InventoryItemDisplay['item_type'] }) => {
  const config = ITEM_TYPE_CONFIG[type];
  if (!config) return null;

  // Map icon names to SVG paths
  const iconPaths: Record<string, string> = {
    Leaf: 'M12 2C6.48 2 2 6.48 2 12c0 3.86 2.2 7.19 5.4 8.83C8 17.83 12 14 12 14s4 3.83 4.6 6.83C19.8 19.19 22 15.86 22 12c0-5.52-4.48-10-10-10z',
    Box: 'M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z',
    Wrench: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
    Package: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  };

  return (
    <div className={cn(
      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
      config.colors.bg
    )}>
      <svg
        className={cn('w-5 h-5', config.colors.icon)}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d={iconPaths[config.icon] || iconPaths.Box} />
      </svg>
    </div>
  );
};

// Storage Type Badge
const StorageTypeBadge = ({ type }: { type: InventoryItemDisplay['storage_type'] }) => {
  const config = STORAGE_TYPE_CONFIG[type];
  if (!config) return null;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      config.bgColor,
      config.color
    )}>
      {config.label}
    </span>
  );
};

// ======================
// MAIN COMPONENT
// ======================
export const InventoryItemCard = forwardRef<HTMLDivElement, InventoryItemCardProps>(
  ({
    className,
    item,
    variant = 'default',
    selected = false,
    onSelect,
    onEdit,
    onDelete,
    showActions = true,
    showStock = true,
    showValue = true,
    ...props
  }, ref) => {
    const handleClick = () => {
      onSelect?.(item);
    };

    // Compact variant
    if (variant === 'compact') {
      return (
        <Card
          ref={ref}
          variant={selected ? 'bordered' : 'default'}
          padding="sm"
          hover={!!onSelect}
          className={cn(
            'transition-all duration-200',
            onSelect && 'cursor-pointer',
            selected && 'ring-2 ring-tis-coral ring-offset-2',
            className
          )}
          onClick={onSelect ? handleClick : undefined}
          {...props}
        >
          <div className="flex items-center gap-3">
            <ItemTypeIcon type={item.item_type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900 truncate">
                  {item.name}
                </h4>
                <StockStatusBadge status={item.stockStatus} size="sm" showDot={false} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.formattedStock}
              </p>
            </div>
          </div>
        </Card>
      );
    }

    // Detailed variant
    if (variant === 'detailed') {
      return (
        <Card
          ref={ref}
          variant={selected ? 'elevated' : 'default'}
          padding="lg"
          hover={!!onSelect}
          className={cn(
            'transition-all duration-200',
            selected && 'ring-2 ring-tis-coral ring-offset-2',
            onSelect && 'cursor-pointer',
            className
          )}
          onClick={onSelect ? handleClick : undefined}
          {...props}
        >
          <CardHeader
            title={
              <div className="flex items-center gap-3">
                <ItemTypeIcon type={item.item_type} />
                <div>
                  <span className="text-base sm:text-lg font-bold text-slate-900">
                    {item.name}
                  </span>
                  {item.sku && (
                    <span className="ml-2 text-xs text-slate-400 font-mono">
                      {item.sku}
                    </span>
                  )}
                </div>
              </div>
            }
            action={
              <StockStatusBadge status={item.stockStatus} size="md" />
            }
          />

          <CardContent>
            {/* Description */}
            {item.description && (
              <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                {item.description}
              </p>
            )}

            {/* Stock Level */}
            {showStock && (
              <div className="mb-4">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm font-medium text-slate-700">Stock Actual</span>
                  <span className="text-lg font-bold text-slate-900">
                    {item.formattedStock}
                  </span>
                </div>
                <StockLevelIndicator
                  currentStock={item.current_stock}
                  minimumStock={item.minimum_stock}
                  maximumStock={item.maximum_stock}
                  size="md"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Mín: {item.minimum_stock}</span>
                  {item.maximum_stock && <span>Máx: {item.maximum_stock}</span>}
                </div>
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-0.5">Costo Unitario</p>
                <p className="text-sm font-semibold text-slate-900">{item.formattedCost}</p>
              </div>
              {showValue && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-500 mb-0.5">Valor en Stock</p>
                  <p className="text-sm font-semibold text-slate-900">{item.formattedValue}</p>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              <StorageTypeBadge type={item.storage_type} />
              {item.is_perishable && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  Perecedero
                </span>
              )}
              {!item.is_active && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                  Inactivo
                </span>
              )}
            </div>
          </CardContent>

          {showActions && (onEdit || onDelete) && (
            <CardFooter className="justify-end gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px] sm:min-h-0"
                >
                  Editar
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item);
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] sm:min-h-0"
                >
                  Eliminar
                </button>
              )}
            </CardFooter>
          )}
        </Card>
      );
    }

    // Default variant
    return (
      <Card
        ref={ref}
        variant={selected ? 'bordered' : 'default'}
        padding="md"
        hover={!!onSelect}
        className={cn(
          'transition-all duration-200',
          selected && 'ring-2 ring-tis-coral ring-offset-2',
          onSelect && 'cursor-pointer',
          className
        )}
        onClick={onSelect ? handleClick : undefined}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <ItemTypeIcon type={item.item_type} />
            <div className="min-w-0">
              <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {item.name}
              </h4>
              {item.sku && (
                <p className="text-xs text-slate-400 font-mono truncate">
                  {item.sku}
                </p>
              )}
            </div>
          </div>
          <StockStatusBadge status={item.stockStatus} size="sm" />
        </div>

        {/* Stock Bar */}
        {showStock && (
          <div className="mb-3">
            <StockLevelIndicator
              currentStock={item.current_stock}
              minimumStock={item.minimum_stock}
              maximumStock={item.maximum_stock}
              showLabels
              size="sm"
            />
          </div>
        )}

        {/* Footer Info */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <StorageTypeBadge type={item.storage_type} />
          </div>
          {showValue && (
            <span className="font-semibold text-slate-700">
              {item.formattedValue}
            </span>
          )}
        </div>

        {/* Actions */}
        {showActions && (onEdit || onDelete) && (
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                aria-label="Editar item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                aria-label="Eliminar item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </Card>
    );
  }
);

InventoryItemCard.displayName = 'InventoryItemCard';
