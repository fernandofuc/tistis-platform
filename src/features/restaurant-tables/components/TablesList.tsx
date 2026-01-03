// =====================================================
// TIS TIS PLATFORM - Tables List Component
// Grid and list views for tables with filters
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/shared/utils';
import { TableCard } from './TableCard';
import type { RestaurantTable, TableStatus, TableZone, TableFilters } from '../types';
import { STATUS_CONFIG, ZONE_CONFIG } from '../types';

// ======================
// VIEW TOGGLE
// ======================
type ViewMode = 'grid' | 'list' | 'zone';

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center bg-slate-100 rounded-xl p-1">
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          view === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        )}
        title="Vista en cuadrícula"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
      <button
        onClick={() => onChange('list')}
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        )}
        title="Vista en lista"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      <button
        onClick={() => onChange('zone')}
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          view === 'zone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        )}
        title="Vista por zona"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </button>
    </div>
  );
}

// ======================
// FILTER BAR
// ======================
interface FilterBarProps {
  filters: TableFilters;
  onFiltersChange: (filters: TableFilters) => void;
  zones: TableZone[];
}

function FilterBar({ filters, onFiltersChange, zones }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Status Filter */}
      <select
        value={filters.status || ''}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as TableStatus || undefined })}
        className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral"
      >
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <option key={key} value={key}>{config.label}</option>
        ))}
      </select>

      {/* Zone Filter */}
      <select
        value={filters.zone || ''}
        onChange={(e) => onFiltersChange({ ...filters, zone: e.target.value as TableZone || undefined })}
        className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral"
      >
        <option value="">Todas las zonas</option>
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {ZONE_CONFIG[zone]?.label || zone}
          </option>
        ))}
      </select>

      {/* Capacity Filter */}
      <select
        value={filters.min_capacity || ''}
        onChange={(e) => onFiltersChange({ ...filters, min_capacity: e.target.value ? parseInt(e.target.value) : undefined })}
        className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral"
      >
        <option value="">Cualquier capacidad</option>
        <option value="2">2+ personas</option>
        <option value="4">4+ personas</option>
        <option value="6">6+ personas</option>
        <option value="8">8+ personas</option>
        <option value="10">10+ personas</option>
      </select>

      {/* Outdoor Toggle */}
      <button
        onClick={() => onFiltersChange({
          ...filters,
          is_outdoor: filters.is_outdoor === true ? undefined : true
        })}
        className={cn(
          'px-3 py-2 text-sm rounded-xl border transition-all',
          filters.is_outdoor === true
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        )}
      >
        Exterior
      </button>

      {/* Accessible Toggle */}
      <button
        onClick={() => onFiltersChange({
          ...filters,
          is_accessible: filters.is_accessible === true ? undefined : true
        })}
        className={cn(
          'px-3 py-2 text-sm rounded-xl border transition-all',
          filters.is_accessible === true
            ? 'bg-slate-900 text-white border-slate-900'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        )}
      >
        Accesible
      </button>

      {/* Clear Filters */}
      {(filters.status || filters.zone || filters.min_capacity || filters.is_outdoor || filters.is_accessible) && (
        <button
          onClick={() => onFiltersChange({})}
          className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

// ======================
// SEARCH BAR
// ======================
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar mesa..."
        className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral"
      />
    </div>
  );
}

// ======================
// EMPTY STATE
// ======================
interface EmptyStateProps {
  hasFilters: boolean;
  onClearFilters: () => void;
  onAddTable: () => void;
}

function EmptyState({ hasFilters, onClearFilters, onAddTable }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </div>

      {hasFilters ? (
        <>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No se encontraron mesas
          </h3>
          <p className="text-slate-500 mb-6">
            No hay mesas que coincidan con los filtros seleccionados
          </p>
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Limpiar filtros
          </button>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Comienza configurando tus mesas
          </h3>
          <p className="text-slate-500 mb-6">
            Agrega las mesas de tu restaurante para gestionar reservaciones
          </p>
          <button
            onClick={onAddTable}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar primera mesa
          </button>
        </>
      )}
    </div>
  );
}

// ======================
// ZONE GROUP
// ======================
interface ZoneGroupProps {
  zone: TableZone;
  tables: RestaurantTable[];
  onEdit: (table: RestaurantTable) => void;
  onChangeStatus: (table: RestaurantTable, status: TableStatus) => void;
  onToggleActive: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
  onViewReservations: (table: RestaurantTable) => void;
}

function ZoneGroup({
  zone,
  tables,
  onEdit,
  onChangeStatus,
  onToggleActive,
  onDelete,
  onViewReservations,
}: ZoneGroupProps) {
  const config = ZONE_CONFIG[zone];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{config?.label || zone}</h3>
          <p className="text-xs text-slate-500">{tables.length} mesas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            onEdit={onEdit}
            onChangeStatus={onChangeStatus}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
            onViewReservations={onViewReservations}
          />
        ))}
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface TablesListProps {
  tables: RestaurantTable[];
  loading?: boolean;
  onEdit: (table: RestaurantTable) => void;
  onChangeStatus: (table: RestaurantTable, status: TableStatus) => void;
  onToggleActive: (table: RestaurantTable) => void;
  onDelete: (table: RestaurantTable) => void;
  onViewReservations: (table: RestaurantTable) => void;
  onAddTable: () => void;
}

export function TablesList({
  tables,
  loading,
  onEdit,
  onChangeStatus,
  onToggleActive,
  onDelete,
  onViewReservations,
  onAddTable,
}: TablesListProps) {
  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TableFilters>({});

  // Get unique zones
  const zones = useMemo(() => {
    const uniqueZones = new Set(tables.map((t) => t.zone));
    return Array.from(uniqueZones) as TableZone[];
  }, [tables]);

  // Filter and search tables
  const filteredTables = useMemo(() => {
    let result = tables;

    // Search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.table_number.toLowerCase().includes(searchLower) ||
          t.name?.toLowerCase().includes(searchLower) ||
          t.zone.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status) {
      result = result.filter((t) => t.status === filters.status);
    }

    // Zone filter
    if (filters.zone) {
      result = result.filter((t) => t.zone === filters.zone);
    }

    // Capacity filter
    if (filters.min_capacity) {
      result = result.filter((t) => t.max_capacity >= filters.min_capacity!);
    }

    // Outdoor filter
    if (filters.is_outdoor) {
      result = result.filter((t) => t.is_outdoor);
    }

    // Accessible filter
    if (filters.is_accessible) {
      result = result.filter((t) => t.is_accessible);
    }

    return result;
  }, [tables, search, filters]);

  // Group tables by zone
  const tablesByZone = useMemo(() => {
    const grouped: Record<TableZone, RestaurantTable[]> = {} as Record<TableZone, RestaurantTable[]>;
    filteredTables.forEach((table) => {
      if (!grouped[table.zone]) {
        grouped[table.zone] = [];
      }
      grouped[table.zone].push(table);
    });
    return grouped;
  }, [filteredTables]);

  const hasFilters = Boolean(search || filters.status || filters.zone || filters.min_capacity || filters.is_outdoor || filters.is_accessible);

  if (loading) {
    return <TablesListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <button
          onClick={onAddTable}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Mesa
        </button>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onFiltersChange={setFilters} zones={zones} />

      {/* Tables */}
      {filteredTables.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onClearFilters={() => {
            setSearch('');
            setFilters({});
          }}
          onAddTable={onAddTable}
        />
      ) : view === 'zone' ? (
        // Zone View
        <div>
          {(Object.keys(tablesByZone) as TableZone[]).map((zone) => (
            <ZoneGroup
              key={zone}
              zone={zone}
              tables={tablesByZone[zone]}
              onEdit={onEdit}
              onChangeStatus={onChangeStatus}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onViewReservations={onViewReservations}
            />
          ))}
        </div>
      ) : view === 'list' ? (
        // List View
        <div className="space-y-2">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              compact
              onEdit={onEdit}
              onChangeStatus={onChangeStatus}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onViewReservations={onViewReservations}
            />
          ))}
        </div>
      ) : (
        // Grid View
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onEdit={onEdit}
              onChangeStatus={onChangeStatus}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              onViewReservations={onViewReservations}
            />
          ))}
        </div>
      )}

      {/* Count */}
      {filteredTables.length > 0 && (
        <div className="text-center text-sm text-slate-500">
          Mostrando {filteredTables.length} de {tables.length} mesas
        </div>
      )}
    </div>
  );
}

// ======================
// SKELETON
// ======================
function TablesListSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="flex gap-4">
          <div className="w-64 h-10 bg-slate-100 rounded-xl" />
          <div className="w-28 h-10 bg-slate-100 rounded-xl" />
        </div>
        <div className="w-32 h-10 bg-slate-100 rounded-xl" />
      </div>

      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-32 h-10 bg-slate-100 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 h-48" />
        ))}
      </div>
    </div>
  );
}

export { TablesListSkeleton };
