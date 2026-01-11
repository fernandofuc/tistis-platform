// =====================================================
// TIS TIS PLATFORM - Mesas (Tables) Page
// Restaurant tables management page
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { useTenant } from '@/src/hooks/useTenant';
import { useFeatureFlags } from '@/src/hooks/useFeatureFlags';
import { useTables } from '@/src/features/restaurant-tables/hooks/useTables';
import { TablesOverview } from '@/src/features/restaurant-tables/components/TablesOverview';
import { TablesList } from '@/src/features/restaurant-tables/components/TablesList';
import { TableFormModal } from '@/src/features/restaurant-tables/components/TableFormModal';
import { FloorPlanEditor } from '@/src/features/restaurant-tables/components/FloorPlanEditor';
import type {
  RestaurantTable,
  TableFormData,
  TableStatus,
} from '@/src/features/restaurant-tables/types';
import * as tablesService from '@/src/features/restaurant-tables/services/tables.service';

// ======================
// TYPES
// ======================
type TabId = 'overview' | 'list' | 'floor_plan';

interface Tab {
  id: TabId;
  name: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'overview', name: 'Resumen', description: 'Vista general de mesas' },
  { id: 'list', name: 'Lista', description: 'Gestionar todas las mesas' },
  { id: 'floor_plan', name: 'Plano', description: 'Vista del plano del restaurante' },
];

// ======================
// UPGRADE PROMPT
// ======================
function UpgradePrompt() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-8">
      <div className="relative max-w-4xl w-full">
        {/* Blurred Preview Background */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="blur-sm opacity-50 p-8 bg-white">
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-100 rounded-xl p-6 h-28" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-slate-100 rounded-xl p-6 h-40" />
              ))}
            </div>
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mx-auto max-w-lg mt-20">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Gestión de Mesas
            </h2>
            <p className="text-slate-500 mb-6">
              Administra las mesas de tu restaurante, controla la disponibilidad y optimiza la distribución.
            </p>

            <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
              <ul className="space-y-3">
                {[
                  'Configuración visual de mesas por zona',
                  'Estados en tiempo real (disponible, ocupada, reservada)',
                  'Gestión de capacidad y características',
                  'Integración automática con reservaciones',
                  'Combinación de mesas para grupos grandes',
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <svg className="w-5 h-5 text-tis-coral flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => router.push('/dashboard/settings/subscription')}
              className="w-full min-h-[48px] bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-lg hover:shadow-xl"
            >
              Desbloquear Gestión de Mesas
            </button>

            <p className="text-xs text-slate-400 mt-4">
              Disponible para restaurantes con vertical activa
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


// ======================
// DELETE CONFIRMATION MODAL
// ======================
interface DeleteModalProps {
  isOpen: boolean;
  table: RestaurantTable | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

function DeleteModal({ isOpen, table, onClose, onConfirm, loading }: DeleteModalProps) {
  if (!isOpen || !table) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Eliminar Mesa {table.table_number}
          </h3>
          <p className="text-slate-500 text-sm mb-6">
            Esta acción no se puede deshacer. La mesa será eliminada permanentemente junto con su historial.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-95 active:bg-slate-300 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2.5 min-h-[44px] text-sm font-medium text-white bg-red-600 rounded-xl transition-all active:scale-95',
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700 active:bg-red-800'
              )}
            >
              {loading ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN PAGE COMPONENT
// ======================
export default function MesasPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { tenant, branches, isLoading: tenantLoading, currentBranchId } = useTenant();
  const { isEnabled, flagsLoading } = useFeatureFlags();

  // Get active branch
  const activeBranchId = currentBranchId || branches?.[0]?.id;
  const activeBranch = branches?.find(b => b.id === activeBranchId);

  // Tables data
  const {
    tables,
    stats,
    loading: tablesLoading,
    createTable,
    updateTable,
    deleteTable,
    updateStatus,
    toggleActive,
    refresh,
  } = useTables({ branch_id: activeBranchId });

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingTable, setDeletingTable] = useState<RestaurantTable | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Check feature flag
  const tablesEnabled = isEnabled('tables_enabled');
  const isRestaurant = tenant?.vertical === 'restaurant';

  // Handlers
  const handleAddTable = useCallback(() => {
    setEditingTable(null);
    setFormModalOpen(true);
  }, []);

  const handleEditTable = useCallback((table: RestaurantTable) => {
    setEditingTable(table);
    setFormModalOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async (data: TableFormData) => {
    if (editingTable) {
      await updateTable(editingTable.id, data);
    } else if (activeBranchId) {
      await createTable(data, activeBranchId);
    }
  }, [editingTable, activeBranchId, updateTable, createTable]);

  const handleChangeStatus = useCallback(async (table: RestaurantTable, status: TableStatus) => {
    await updateStatus(table.id, status);
  }, [updateStatus]);

  const handleToggleActive = useCallback(async (table: RestaurantTable) => {
    await toggleActive(table.id, !table.is_active);
  }, [toggleActive]);

  const handleDeleteClick = useCallback((table: RestaurantTable) => {
    setDeletingTable(table);
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTable) return;

    setDeleteLoading(true);
    try {
      await deleteTable(deletingTable.id);
      setDeleteModalOpen(false);
      setDeletingTable(null);
    } catch (error) {
      console.error('Error deleting table:', error);
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingTable, deleteTable]);

  const handleViewReservations = useCallback((table: RestaurantTable) => {
    // TODO: Navigate to reservations filtered by this table
    console.log('View reservations for table:', table.id);
  }, []);

  // Handler for updating table position from floor plan editor
  const handleUpdatePosition = useCallback(async (tableId: string, x: number, y: number) => {
    await updateTable(tableId, { position_x: x, position_y: y });
  }, [updateTable]);

  // Loading state
  if (tenantLoading || flagsLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-tis-coral"></div>
      </div>
    );
  }

  // Check access
  if (!isRestaurant || !tablesEnabled) {
    return <UpgradePrompt />;
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <TablesOverview
            stats={stats}
            tables={tables}
            loading={tablesLoading}
            onAddTable={handleAddTable}
            onViewFloorPlan={() => setActiveTab('floor_plan')}
            onBulkEdit={() => {}}
          />
        );
      case 'list':
        return (
          <TablesList
            tables={tables}
            loading={tablesLoading}
            onEdit={handleEditTable}
            onChangeStatus={handleChangeStatus}
            onToggleActive={handleToggleActive}
            onDelete={handleDeleteClick}
            onViewReservations={handleViewReservations}
            onAddTable={handleAddTable}
          />
        );
      case 'floor_plan':
        return (
          <FloorPlanEditor
            tables={tables}
            isLoading={tablesLoading}
            onUpdatePosition={handleUpdatePosition}
            onAddTable={handleAddTable}
            onEditTable={handleEditTable}
            onChangeStatus={handleChangeStatus}
            onRefresh={refresh}
          />
        );
      default:
        return null;
    }
  };

  const existingTableNumbers = tables.map((t) => t.table_number);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Mesas</h1>
          <p className="text-slate-500 mt-1">
            Administra la distribución y disponibilidad de mesas en tu restaurante
          </p>
        </div>

        {activeBranch && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <span className="text-sm font-medium text-slate-700">{activeBranch.name}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'py-2.5 sm:py-3 px-3 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 min-h-[44px] active:scale-95',
                activeTab === tab.id
                  ? 'border-tis-coral text-tis-coral'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {renderTabContent()}
      </div>

      {/* Form Modal */}
      <TableFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingTable(null);
        }}
        onSubmit={handleFormSubmit}
        table={editingTable}
        branchId={activeBranch?.id || ''}
        existingTableNumbers={existingTableNumbers}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteModalOpen}
        table={deletingTable}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingTable(null);
        }}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
    </div>
  );
}
