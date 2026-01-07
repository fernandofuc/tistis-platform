// =====================================================
// TIS TIS PLATFORM - Inventario Page
// Inventory management for restaurant operations
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/shared/utils';
import { useTenant } from '@/src/hooks/useTenant';
import { useFeatureFlags } from '@/src/hooks/useFeatureFlags';
import { useInventory } from '@/src/features/restaurant-inventory/hooks/useInventory';
import {
  InventoryOverview,
  CategoriesTab,
  SuppliersTab,
  MovementsTab,
  CategoryForm,
  SupplierForm,
  MovementForm,
  RestockOrdersTab,
  RestockOrderForm,
  ItemForm,
} from '@/src/features/restaurant-inventory/components';
import { createRestockOrder } from '@/src/features/restaurant-inventory/services/restock.service';
import type { RestockOrderFormData, RestockOrder } from '@/src/features/restaurant-inventory/types';
import type {
  InventoryItem,
  InventoryCategory,
  InventorySupplier,
  InventoryMovement,
  CategoryFormData,
  SupplierFormData,
  MovementFormData,
  ItemFormData,
} from '@/src/features/restaurant-inventory/types';
import { ITEM_TYPE_CONFIG, STORAGE_TYPE_CONFIG } from '@/src/features/restaurant-inventory/types';

// ======================
// TYPES
// ======================
type TabId = 'overview' | 'items' | 'categories' | 'suppliers' | 'restock' | 'movements';

interface Tab {
  id: TabId;
  name: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'overview', name: 'Resumen', description: 'Vista general del inventario' },
  { id: 'items', name: 'Productos', description: 'Gestionar ingredientes y suministros' },
  { id: 'categories', name: 'Categorías', description: 'Organizar productos' },
  { id: 'suppliers', name: 'Proveedores', description: 'Gestionar proveedores' },
  { id: 'restock', name: 'Reabastecimiento', description: 'Órdenes de reabastecimiento' },
  { id: 'movements', name: 'Movimientos', description: 'Historial de movimientos' },
];

// ======================
// UPGRADE PROMPT
// ======================
function UpgradePrompt() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-8">
      <div className="relative max-w-4xl w-full">
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

        <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mx-auto max-w-lg mt-20">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Gestión de Inventario
            </h2>
            <p className="text-slate-500 mb-6">
              Controla tu inventario de ingredientes, suministros y más.
            </p>

            <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
              <ul className="space-y-3">
                {[
                  'Control de stock en tiempo real',
                  'Alertas de stock bajo',
                  'Gestión de lotes y caducidad',
                  'Recetas y costeo automático',
                  'Reportes de movimientos',
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
              Desbloquear Inventario
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
// ITEMS LIST TAB
// ======================
interface ItemsListTabProps {
  items: InventoryItem[];
  categories: InventoryCategory[];
  loading: boolean;
  onAddItem: () => void;
  onEditItem?: (item: InventoryItem) => void;
  onDeleteItem?: (id: string) => void;
}

function ItemsListTab({ items, categories, loading, onAddItem, onEditItem, onDeleteItem }: ItemsListTabProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredItems = items.filter(item => {
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-slate-100 rounded-xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar productos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
        >
          <option value="all">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <button
          onClick={onAddItem}
          className="px-4 py-2 bg-tis-coral text-white font-medium rounded-lg hover:bg-tis-coral/90 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Agregar
        </button>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {search || categoryFilter !== 'all' ? 'Sin resultados' : 'Sin productos'}
          </h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            {search || categoryFilter !== 'all'
              ? 'No se encontraron productos con los filtros aplicados'
              : 'Comienza agregando tu primer producto al inventario'
            }
          </p>
          {!search && categoryFilter === 'all' && (
            <button
              onClick={onAddItem}
              className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
            >
              Agregar primer producto
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Costo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Almacén</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => {
                const typeConfig = ITEM_TYPE_CONFIG[item.item_type];
                const storageConfig = STORAGE_TYPE_CONFIG[item.storage_type];
                const isLowStock = item.current_stock <= item.minimum_stock;

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          {item.sku && <p className="text-xs text-slate-500">SKU: {item.sku}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        typeConfig.color,
                        'text-white'
                      )}>
                        {typeConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn(
                        'font-medium',
                        isLowStock ? 'text-red-600' : 'text-slate-900'
                      )}>
                        {item.current_stock} {item.unit}
                      </div>
                      {isLowStock && (
                        <div className="text-xs text-red-500">Bajo mínimo ({item.minimum_stock})</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      ${item.unit_cost.toFixed(2)} / {item.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-full',
                        storageConfig.color
                      )}>
                        {storageConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {openMenuId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 top-8 z-50 w-40 bg-white rounded-xl shadow-xl border border-slate-200 py-1">
                              <button
                                onClick={() => {
                                  onEditItem?.(item);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`¿Eliminar "${item.name}"?`)) {
                                    onDeleteItem?.(item.id);
                                  }
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ======================
// MAIN PAGE COMPONENT
// ======================
export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { tenant, branches, isLoading: tenantLoading, currentBranchId } = useTenant();
  const { isEnabled, flagsLoading } = useFeatureFlags();

  // Modal states
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showRestockForm, setShowRestockForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [preSelectedAlertIds, setPreSelectedAlertIds] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [restockRefreshKey, setRestockRefreshKey] = useState(0);

  // Get active branch
  const activeBranchId = currentBranchId || branches?.[0]?.id;
  const activeBranch = branches?.find(b => b.id === activeBranchId);

  // Inventory data
  const {
    items,
    categories,
    suppliers,
    movements,
    stats,
    loading: inventoryLoading,
    createItem,
    createCategory,
    updateCategory,
    deleteCategory,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    recordMovement,
    updateItem,
    deleteItem,
    refresh,
  } = useInventory({ branch_id: activeBranchId });

  // Check feature flag
  const inventoryEnabled = isEnabled('inventory_enabled');
  const isRestaurant = tenant?.vertical === 'restaurant';

  // Handlers
  const handleAddItem = useCallback(() => {
    setEditingItem(null);
    setShowItemForm(true);
  }, []);

  const handleItemSubmit = useCallback(async (data: ItemFormData) => {
    setFormLoading(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, data);
      } else {
        await createItem(data);
      }
      setShowItemForm(false);
      setEditingItem(null);
    } finally {
      setFormLoading(false);
    }
  }, [createItem, updateItem, editingItem]);

  const handleEditItem = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setShowItemForm(true);
  }, []);

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      await deleteItem(id);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, [deleteItem]);

  const handleViewLowStock = useCallback(() => {
    setActiveTab('items');
    // TODO: Apply low stock filter
  }, []);

  const handleViewExpiring = useCallback(() => {
    // TODO: Navigate to expiring batches view
    console.log('View expiring');
  }, []);

  const handleRegisterEntry = useCallback(() => {
    setShowMovementForm(true);
  }, []);

  const handlePhysicalCount = useCallback(() => {
    // Navigate to items tab for physical count
    setActiveTab('items');
  }, []);

  const handleExportReport = useCallback(() => {
    // TODO: Implement export functionality
    alert('Función de exportación próximamente disponible');
  }, []);

  // Category handlers
  const handleCreateCategory = useCallback(() => {
    setEditingCategory(null);
    setShowCategoryForm(true);
  }, []);

  const handleEditCategory = useCallback((category: InventoryCategory) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  }, []);

  const handleCategorySubmit = useCallback(async (data: CategoryFormData) => {
    setFormLoading(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data);
      } else {
        await createCategory(data);
      }
      setShowCategoryForm(false);
      setEditingCategory(null);
    } finally {
      setFormLoading(false);
    }
  }, [editingCategory, createCategory, updateCategory]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    await deleteCategory(id);
  }, [deleteCategory]);

  // Supplier handlers
  const handleCreateSupplier = useCallback(() => {
    setEditingSupplier(null);
    setShowSupplierForm(true);
  }, []);

  const handleEditSupplier = useCallback((supplier: InventorySupplier) => {
    setEditingSupplier(supplier);
    setShowSupplierForm(true);
  }, []);

  const handleSupplierSubmit = useCallback(async (data: SupplierFormData) => {
    setFormLoading(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, data);
      } else {
        await createSupplier(data);
      }
      setShowSupplierForm(false);
      setEditingSupplier(null);
    } finally {
      setFormLoading(false);
    }
  }, [editingSupplier, createSupplier, updateSupplier]);

  const handleDeleteSupplier = useCallback(async (id: string) => {
    await deleteSupplier(id);
  }, [deleteSupplier]);

  // Movement handlers
  const handleRecordMovement = useCallback(() => {
    setShowMovementForm(true);
  }, []);

  const handleMovementSubmit = useCallback(async (data: MovementFormData) => {
    setFormLoading(true);
    try {
      await recordMovement(data);
      setShowMovementForm(false);
    } finally {
      setFormLoading(false);
    }
  }, [recordMovement]);

  // Restock handlers
  const handleCreateRestockOrder = useCallback((alertIds?: string[]) => {
    setPreSelectedAlertIds(alertIds || []);
    setShowRestockForm(true);
  }, []);

  const handleViewRestockOrder = useCallback((order: RestockOrder) => {
    // TODO: Open order detail modal
    console.log('View order:', order);
  }, []);

  const handleRestockOrderSubmit = useCallback(async (data: RestockOrderFormData) => {
    setFormLoading(true);
    try {
      await createRestockOrder(data);
      setShowRestockForm(false);
      setPreSelectedAlertIds([]);
      setRestockRefreshKey(prev => prev + 1);
    } finally {
      setFormLoading(false);
    }
  }, []);

  // Loading state
  if (tenantLoading || flagsLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-tis-coral"></div>
      </div>
    );
  }

  // Check access
  if (!isRestaurant || !inventoryEnabled) {
    return <UpgradePrompt />;
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <InventoryOverview
            stats={stats}
            items={items}
            loading={inventoryLoading}
            onViewLowStock={handleViewLowStock}
            onViewExpiring={handleViewExpiring}
            onAddItem={handleAddItem}
            onRegisterEntry={handleRegisterEntry}
            onPhysicalCount={handlePhysicalCount}
            onExportReport={handleExportReport}
          />
        );
      case 'items':
        return (
          <ItemsListTab
            items={items}
            categories={categories}
            loading={inventoryLoading}
            onAddItem={handleAddItem}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
        );
      case 'categories':
        return (
          <CategoriesTab
            categories={categories}
            isLoading={inventoryLoading}
            onCreateCategory={handleCreateCategory}
            onEditCategory={handleEditCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        );
      case 'suppliers':
        return (
          <SuppliersTab
            suppliers={suppliers}
            isLoading={inventoryLoading}
            onCreateSupplier={handleCreateSupplier}
            onEditSupplier={handleEditSupplier}
            onDeleteSupplier={handleDeleteSupplier}
          />
        );
      case 'restock':
        return activeBranchId ? (
          <RestockOrdersTab
            key={restockRefreshKey}
            branchId={activeBranchId}
            suppliers={suppliers}
            onCreateOrder={handleCreateRestockOrder}
            onViewOrder={handleViewRestockOrder}
          />
        ) : null;
      case 'movements':
        return (
          <MovementsTab
            movements={movements || []}
            items={items}
            isLoading={inventoryLoading}
            onRecordMovement={handleRecordMovement}
            onRefresh={refresh}
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
          <h1 className="text-2xl font-bold text-slate-900">Inventario</h1>
          <p className="text-slate-500 mt-1">
            Gestiona ingredientes, suministros y control de stock
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

      {/* Item Form Modal */}
      {showItemForm && (
        <ItemForm
          item={editingItem || undefined}
          categories={categories}
          suppliers={suppliers}
          onSubmit={handleItemSubmit}
          onCancel={() => {
            setShowItemForm(false);
            setEditingItem(null);
          }}
          isLoading={formLoading}
        />
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <CategoryForm
          category={editingCategory || undefined}
          parentCategories={categories}
          onSubmit={handleCategorySubmit}
          onCancel={() => {
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
          isLoading={formLoading}
        />
      )}

      {/* Supplier Form Modal */}
      {showSupplierForm && (
        <SupplierForm
          supplier={editingSupplier || undefined}
          items={items}
          onSubmit={handleSupplierSubmit}
          onCancel={() => {
            setShowSupplierForm(false);
            setEditingSupplier(null);
          }}
          isLoading={formLoading}
        />
      )}

      {/* Movement Form Modal */}
      {showMovementForm && (
        <MovementForm
          items={items}
          onSubmit={handleMovementSubmit}
          onCancel={() => setShowMovementForm(false)}
          isLoading={formLoading}
        />
      )}

      {/* Restock Order Form Modal */}
      {showRestockForm && activeBranchId && (
        <RestockOrderForm
          branchId={activeBranchId}
          suppliers={suppliers}
          items={items}
          preSelectedAlertIds={preSelectedAlertIds}
          onSubmit={handleRestockOrderSubmit}
          onCancel={() => {
            setShowRestockForm(false);
            setPreSelectedAlertIds([]);
          }}
          isLoading={formLoading}
        />
      )}
    </div>
  );
}
