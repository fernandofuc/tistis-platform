// =====================================================
// TIS TIS PLATFORM - Inventory Filters Component
// Premium filter bar for inventory management
// Apple/Google-inspired with elegant interactions
// =====================================================

'use client';

import { forwardRef, useState, useCallback, useEffect, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils';
import { SearchInput, Button } from '@/shared/components/ui';
import type { InventoryFilters as FiltersType, StockStatus } from '../types';
import {
  STOCK_STATUS_CONFIG,
  ITEM_TYPE_CONFIG,
  STORAGE_TYPE_CONFIG,
  SORT_OPTIONS,
} from '../config/inventory-config';

// ======================
// TYPES
// ======================
export interface InventoryFiltersProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  filters: FiltersType;
  onChange: (filters: Partial<FiltersType>) => void;
  onClear?: () => void;
  showSearch?: boolean;
  showSort?: boolean;
  showStockStatus?: boolean;
  showItemType?: boolean;
  showStorageType?: boolean;
  compact?: boolean;
}

// ======================
// FILTER CHIP COMPONENT
// ======================
interface FilterChipProps {
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ label, active = false, count, onClick }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-full text-sm font-medium',
          'transition-all duration-200 min-h-[44px] sm:min-h-0',
          'border border-transparent',
          active
            ? 'bg-tis-coral text-white shadow-coral'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
        )}
      >
        {label}
        {count !== undefined && (
          <span className={cn(
            'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold',
            active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
          )}>
            {count}
          </span>
        )}
      </button>
    );
  }
);

FilterChip.displayName = 'FilterChip';

// ======================
// SELECT DROPDOWN
// ======================
interface FilterSelectProps {
  id: string;
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}

const FilterSelect = ({ id, label, value, options, onChange, placeholder = 'Todos' }: FilterSelectProps) => {
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <select
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn(
          'block w-full rounded-lg border border-slate-200 bg-white',
          'px-3 py-2.5 sm:py-2 text-sm text-slate-900',
          'focus:outline-none focus:ring-2 focus:ring-tis-coral/30 focus:border-tis-coral',
          'transition-colors duration-200',
          'min-h-[44px] sm:min-h-0',
          'appearance-none cursor-pointer'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Custom arrow */}
      <div className="absolute inset-y-0 right-0 top-5 flex items-center pr-2 pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

// ======================
// MAIN COMPONENT
// ======================
export const InventoryFiltersComponent = forwardRef<HTMLDivElement, InventoryFiltersProps>(
  ({
    className,
    filters,
    onChange,
    onClear,
    showSearch = true,
    showSort = true,
    showStockStatus = true,
    showItemType = true,
    showStorageType = true,
    compact = false,
    ...props
  }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search || '');

    // Sync searchValue when filters.search changes externally (e.g., on clear)
    useEffect(() => {
      setSearchValue(filters.search || '');
    }, [filters.search]);

    // Debounced search handler
    const handleSearchChange = useCallback((value: string) => {
      setSearchValue(value);
      // Debounce is handled by the hook, just pass it through
      onChange({ search: value || undefined });
    }, [onChange]);

    // Stock status filter
    const handleStockStatusChange = useCallback((status: StockStatus | undefined) => {
      onChange({ stock_status: status === filters.stock_status ? undefined : status });
    }, [onChange, filters.stock_status]);

    // Item type filter
    const handleItemTypeChange = useCallback((type: string | undefined) => {
      onChange({ item_type: type as FiltersType['item_type'] });
    }, [onChange]);

    // Storage type filter
    const handleStorageTypeChange = useCallback((type: string | undefined) => {
      onChange({ storage_type: type as FiltersType['storage_type'] });
    }, [onChange]);

    // Sort change
    const handleSortChange = useCallback((sortBy: string | undefined) => {
      onChange({ sort_by: sortBy as FiltersType['sort_by'] });
    }, [onChange]);

    // Sort order toggle
    const handleSortOrderToggle = useCallback(() => {
      onChange({ sort_order: filters.sort_order === 'asc' ? 'desc' : 'asc' });
    }, [onChange, filters.sort_order]);

    // Check if any filters are active
    const hasActiveFilters = !!(
      filters.search ||
      filters.stock_status ||
      filters.item_type ||
      filters.storage_type
    );

    // Compact view for mobile
    if (compact) {
      return (
        <div ref={ref} className={cn('space-y-3', className)} {...props}>
          {/* Search Bar */}
          {showSearch && (
            <SearchInput
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onClear={() => handleSearchChange('')}
              placeholder="Buscar items..."
            />
          )}

          {/* Filter Toggle Button */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                'transition-all duration-200',
                hasActiveFilters
                  ? 'bg-tis-coral/10 text-tis-coral'
                  : 'bg-slate-100 text-slate-600'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtros
              {hasActiveFilters && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-tis-coral text-white text-xs font-semibold">
                  {[filters.stock_status, filters.item_type, filters.storage_type].filter(Boolean).length}
                </span>
              )}
            </button>

            {hasActiveFilters && onClear && (
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {isExpanded && (
            <div className="p-4 bg-slate-50 rounded-xl space-y-4 animate-slide-up">
              {showStockStatus && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Estado de Stock</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STOCK_STATUS_CONFIG) as StockStatus[]).map((status) => (
                      <FilterChip
                        key={status}
                        label={STOCK_STATUS_CONFIG[status].label}
                        active={filters.stock_status === status}
                        onClick={() => handleStockStatusChange(status)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {showItemType && (
                <FilterSelect
                  id="compact-item-type-filter"
                  label="Tipo de Item"
                  value={filters.item_type}
                  options={Object.entries(ITEM_TYPE_CONFIG).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                  onChange={handleItemTypeChange}
                />
              )}

              {showStorageType && (
                <FilterSelect
                  id="compact-storage-type-filter"
                  label="Almacenamiento"
                  value={filters.storage_type}
                  options={Object.entries(STORAGE_TYPE_CONFIG).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                  onChange={handleStorageTypeChange}
                />
              )}

              {showSort && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <FilterSelect
                      id="compact-sort-by-filter"
                      label="Ordenar por"
                      value={filters.sort_by}
                      options={SORT_OPTIONS.inventory}
                      onChange={handleSortChange}
                      placeholder="Nombre"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSortOrderToggle}
                      aria-label={filters.sort_order === 'asc' ? 'Cambiar a orden descendente' : 'Cambiar a orden ascendente'}
                      className={cn(
                        'p-2.5 rounded-lg border border-slate-200 bg-white',
                        'hover:bg-slate-50 transition-colors',
                        'min-w-[44px] min-h-[44px] flex items-center justify-center'
                      )}
                    >
                      <svg
                        className={cn(
                          'w-4 h-4 text-slate-600 transition-transform duration-200',
                          filters.sort_order === 'desc' && 'rotate-180'
                        )}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Full desktop view
    return (
      <div ref={ref} className={cn('space-y-4', className)} {...props}>
        {/* Top Row - Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          {showSearch && (
            <div className="flex-1">
              <SearchInput
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                onClear={() => handleSearchChange('')}
                placeholder="Buscar por nombre o SKU..."
              />
            </div>
          )}

          {showSort && (
            <div className="flex gap-2">
              <select
                value={filters.sort_by || 'name'}
                onChange={(e) => handleSortChange(e.target.value)}
                className={cn(
                  'rounded-lg border border-slate-200 bg-white',
                  'px-3 py-2.5 sm:py-2 text-sm text-slate-700',
                  'focus:outline-none focus:ring-2 focus:ring-tis-coral/30 focus:border-tis-coral',
                  'min-h-[44px] sm:min-h-0',
                  'cursor-pointer'
                )}
              >
                {SORT_OPTIONS.inventory.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSortOrderToggle}
                aria-label={filters.sort_order === 'asc' ? 'Cambiar a orden descendente' : 'Cambiar a orden ascendente'}
                className={cn(
                  'p-2 rounded-lg border border-slate-200 bg-white',
                  'hover:bg-slate-50 transition-colors',
                  'min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center'
                )}
              >
                <svg
                  className={cn(
                    'w-4 h-4 text-slate-600 transition-transform duration-200',
                    filters.sort_order === 'desc' && 'rotate-180'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Stock Status Chips */}
        {showStockStatus && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-slate-500 self-center mr-2">Estado:</span>
            {(Object.keys(STOCK_STATUS_CONFIG) as StockStatus[]).map((status) => (
              <FilterChip
                key={status}
                label={STOCK_STATUS_CONFIG[status].label}
                active={filters.stock_status === status}
                onClick={() => handleStockStatusChange(status)}
              />
            ))}
          </div>
        )}

        {/* Additional Filters Row */}
        {(showItemType || showStorageType) && (
          <div className="flex flex-wrap gap-4">
            {showItemType && (
              <div className="w-full sm:w-auto">
                <FilterSelect
                  id="desktop-item-type-filter"
                  label="Tipo de Item"
                  value={filters.item_type}
                  options={Object.entries(ITEM_TYPE_CONFIG).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                  onChange={handleItemTypeChange}
                />
              </div>
            )}

            {showStorageType && (
              <div className="w-full sm:w-auto">
                <FilterSelect
                  id="desktop-storage-type-filter"
                  label="Almacenamiento"
                  value={filters.storage_type}
                  options={Object.entries(STORAGE_TYPE_CONFIG).map(([value, config]) => ({
                    value,
                    label: config.label,
                  }))}
                  onChange={handleStorageTypeChange}
                />
              </div>
            )}

            {/* Clear filters button */}
            {hasActiveFilters && onClear && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="text-slate-500"
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

InventoryFiltersComponent.displayName = 'InventoryFilters';

// Export with a cleaner name
export { InventoryFiltersComponent as InventoryFilters };
