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
import { KDSDisplay, OrdersHistoryTab } from '@/src/features/restaurant-kitchen/components';
import type { KitchenStation, RestaurantOrder } from '@/src/features/restaurant-kitchen/types';

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
// STATIONS CONFIG TAB
// ======================
interface StationsConfigTabProps {
  stations: any[];
  loading: boolean;
  onCreateStation: (data: any) => Promise<void>;
  onUpdateStation: (id: string, data: any) => Promise<void>;
  onDeleteStation: (id: string) => Promise<void>;
}

function StationsConfigTab({ stations, loading }: StationsConfigTabProps) {
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
        <button className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors">
          Crear primera estación
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stations.map(station => (
        <div
          key={station.id}
          className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: station.display_color }}
              >
                {station.code}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">{station.name}</h4>
                <p className="text-xs text-slate-500">{station.station_type}</p>
              </div>
            </div>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                station.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {station.is_active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          {station.description && (
            <p className="text-sm text-slate-500 mt-3">{station.description}</p>
          )}
          <div className="flex gap-2 mt-4">
            <button className="flex-1 text-xs py-1.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Editar
            </button>
            <button className="text-xs py-1.5 px-3 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
              Eliminar
            </button>
          </div>
        </div>
      ))}
      <button className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:border-slate-300 hover:bg-slate-50 transition-colors min-h-[160px]">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  // Check feature flag - use kitchen_display_enabled (the correct flag name)
  const kdsEnabled = isEnabled('kitchen_display_enabled');
  const isRestaurant = tenant?.vertical?.toLowerCase() === 'restaurant';

  // Handlers
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
            onCreateStation={createStation}
            onUpdateStation={updateStation}
            onDeleteStation={deleteStation}
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
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200',
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
    </div>
  );
}
