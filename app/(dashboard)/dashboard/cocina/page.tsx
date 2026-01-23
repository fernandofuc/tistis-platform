// =====================================================
// TIS TIS PLATFORM - Cocina (Kitchen) Page
// Kitchen Display System for restaurant operations
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { useTenant } from '@/src/hooks/useTenant';
import { useFeatureFlags } from '@/src/hooks/useFeatureFlags';
import { useKitchen } from '@/src/features/restaurant-kitchen/hooks/useKitchen';
import { KDSDisplay, OrdersHistoryTab, StationFormModal } from '@/src/features/restaurant-kitchen/components';
import type { KitchenStation, KitchenStationConfig, StationFormData } from '@/src/features/restaurant-kitchen/types';
import { STATION_CONFIG } from '@/src/features/restaurant-kitchen/types';

// ======================
// TYPES
// ======================
type TabId = 'kds' | 'orders' | 'stations';

interface Tab {
  id: TabId;
  name: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'kds', name: 'KDS', description: 'Kitchen Display System' },
  { id: 'orders', name: 'Órdenes', description: 'Historial de órdenes' },
  { id: 'stations', name: 'Estaciones', description: 'Configurar estaciones' },
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
              Sistema de Cocina (KDS)
            </h2>
            <p className="text-slate-500 mb-6">
              Gestiona las órdenes en cocina en tiempo real con nuestro Kitchen Display System.
            </p>

            <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
              <ul className="space-y-3">
                {[
                  'Visualización en tiempo real de órdenes',
                  'Gestión por estaciones de cocina',
                  'Control de tiempos de preparación',
                  'Alertas de órdenes urgentes',
                  'Historial y estadísticas de rendimiento',
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
              className="w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
            >
              Desbloquear Sistema de Cocina
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
interface DeleteConfirmModalProps {
  isOpen: boolean;
  stationName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirmModal({ isOpen, stationName, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar estación</h3>
          <p className="text-slate-500 mb-6">
            ¿Estás seguro de que deseas eliminar la estación <strong>&quot;{stationName}&quot;</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl transition-all',
                loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'
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
// STATIONS CONFIG TAB
// ======================
interface StationsConfigTabProps {
  stations: KitchenStationConfig[];
  loading: boolean;
  onOpenModal: (station?: KitchenStationConfig) => void;
  onDeleteStation: (station: KitchenStationConfig) => void;
}

function StationsConfigTab({ stations, loading, onOpenModal, onDeleteStation }: StationsConfigTabProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-slate-100 rounded-xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Sin estaciones configuradas
        </h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Configura las estaciones de tu cocina para organizar mejor el flujo de trabajo.
        </p>
        <button
          onClick={() => onOpenModal()}
          className="px-6 py-2.5 min-h-[44px] bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 active:scale-95 transition-all"
        >
          Crear primera estación
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stations.map(station => {
        const typeConfig = STATION_CONFIG[station.station_type as KitchenStation];
        return (
          <div
            key={station.id}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                  style={{ backgroundColor: station.display_color || '#3B82F6' }}
                >
                  {station.code.slice(0, 3)}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{station.name}</h4>
                  <p className="text-xs text-slate-500">{typeConfig?.label || station.station_type}</p>
                </div>
              </div>
              <span
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full font-medium',
                  station.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {station.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            {station.description && (
              <p className="text-sm text-slate-500 mt-3 line-clamp-2">{station.description}</p>
            )}
            {(station.printer_name || station.printer_ip) && (
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>{station.printer_name || station.printer_ip}</span>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => onOpenModal(station)}
                className="flex-1 text-xs py-2.5 min-h-[44px] text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition-all font-medium"
              >
                Editar
              </button>
              <button
                onClick={() => onDeleteStation(station)}
                className="text-xs py-2.5 px-4 min-h-[44px] text-red-600 bg-red-50 rounded-lg hover:bg-red-100 active:bg-red-200 active:scale-95 transition-all font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        );
      })}

      {/* Add Station Card */}
      <button
        onClick={() => onOpenModal()}
        className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-slate-300 hover:bg-slate-50 transition-all min-h-[160px] active:scale-[0.98]"
      >
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
        <span className="text-sm font-medium text-slate-600">Agregar estación</span>
      </button>
    </div>
  );
}

// ======================
// MAIN PAGE COMPONENT
// ======================
export default function CocinaPage() {
  const [activeTab, setActiveTab] = useState<TabId>('kds');
  const { tenant, branches, isLoading: tenantLoading, currentBranchId } = useTenant();
  const { isEnabled, flagsLoading } = useFeatureFlags();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<KitchenStationConfig | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [stationToDelete, setStationToDelete] = useState<KitchenStationConfig | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Get active branch
  const activeBranchId = currentBranchId || branches?.[0]?.id;
  const activeBranch = branches?.find(b => b.id === activeBranchId);

  // Kitchen data
  const {
    orders,
    orderHistory,
    stations,
    stats,
    loading: kitchenLoading,
    bumpOrder,
    recallOrder,
    startItem,
    bumpItem,
    cancelItem,
    setPriority,
    fetchOrderHistory,
    createStation,
    updateStation,
    deleteStation,
    refresh,
  } = useKitchen({ branch_id: activeBranchId });

  // Check feature flag
  const kdsEnabled = isEnabled('kitchen_display_enabled');
  const isRestaurant = tenant?.vertical?.toLowerCase() === 'restaurant';

  // Get existing station codes for validation
  const existingCodes = stations.map(s => s.code.toUpperCase());

  // Modal handlers
  const handleOpenModal = useCallback((station?: KitchenStationConfig) => {
    setEditingStation(station || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingStation(null);
  }, []);

  const handleSubmitStation = useCallback(async (data: StationFormData) => {
    if (editingStation) {
      await updateStation(editingStation.id, data);
    } else {
      await createStation(data);
    }
    handleCloseModal();
  }, [editingStation, createStation, updateStation, handleCloseModal]);

  // Delete handlers
  const handleDeleteClick = useCallback((station: KitchenStationConfig) => {
    setStationToDelete(station);
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!stationToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteStation(stationToDelete.id);
      setDeleteConfirmOpen(false);
      setStationToDelete(null);
    } catch (error) {
      console.error('Error deleting station:', error);
    } finally {
      setDeleteLoading(false);
    }
  }, [stationToDelete, deleteStation]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmOpen(false);
    setStationToDelete(null);
  }, []);

  // Order handlers
  const handleBumpOrder = useCallback(async (orderId: string) => {
    try {
      await bumpOrder(orderId);
    } catch (error) {
      console.error('Error bumping order:', error);
    }
  }, [bumpOrder]);

  const handleRecallOrder = useCallback(async (orderId: string) => {
    try {
      await recallOrder(orderId);
    } catch (error) {
      console.error('Error recalling order:', error);
    }
  }, [recallOrder]);

  const handleStartItem = useCallback(async (itemId: string) => {
    try {
      await startItem(itemId);
    } catch (error) {
      console.error('Error starting item:', error);
    }
  }, [startItem]);

  const handleBumpItem = useCallback(async (itemId: string) => {
    try {
      await bumpItem(itemId);
    } catch (error) {
      console.error('Error bumping item:', error);
    }
  }, [bumpItem]);

  const handleCancelItem = useCallback(async (itemId: string) => {
    try {
      await cancelItem(itemId);
    } catch (error) {
      console.error('Error canceling item:', error);
    }
  }, [cancelItem]);

  const handlePriorityChange = useCallback(async (orderId: string, priority: number) => {
    try {
      await setPriority(orderId, priority);
    } catch (error) {
      console.error('Error changing priority:', error);
    }
  }, [setPriority]);

  // Load order history when switching to orders tab
  useEffect(() => {
    if (activeTab === 'orders' && activeBranchId) {
      fetchOrderHistory();
    }
  }, [activeTab, activeBranchId, fetchOrderHistory]);

  // Loading state
  if (tenantLoading || flagsLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-tis-coral"></div>
      </div>
    );
  }

  // Check access
  if (!isRestaurant || !kdsEnabled) {
    return <UpgradePrompt />;
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'kds':
        return (
          <KDSDisplay
            orders={orders}
            stats={stats}
            stations={stations}
            loading={kitchenLoading}
            onBumpOrder={handleBumpOrder}
            onRecallOrder={handleRecallOrder}
            onStartItem={handleStartItem}
            onBumpItem={handleBumpItem}
            onCancelItem={handleCancelItem}
            onPriorityChange={handlePriorityChange}
            onRefresh={refresh}
          />
        );
      case 'orders':
        return (
          <OrdersHistoryTab
            orders={orderHistory}
            isLoading={kitchenLoading}
            onRefresh={fetchOrderHistory}
          />
        );
      case 'stations':
        return (
          <StationsConfigTab
            stations={stations}
            loading={kitchenLoading}
            onOpenModal={handleOpenModal}
            onDeleteStation={handleDeleteClick}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sistema de Cocina</h1>
          <p className="text-slate-500 mt-1">
            Gestiona las órdenes en tiempo real con el Kitchen Display System
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'stations' && stations.length > 0 && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nueva Estación
            </button>
          )}

          {activeBranch && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span className="text-sm font-medium text-slate-700">{activeBranch.name}</span>
            </div>
          )}
        </div>
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

      {/* Station Form Modal */}
      <StationFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitStation}
        station={editingStation}
        existingCodes={editingStation ? existingCodes.filter(c => c !== editingStation.code.toUpperCase()) : existingCodes}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmOpen}
        stationName={stationToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
