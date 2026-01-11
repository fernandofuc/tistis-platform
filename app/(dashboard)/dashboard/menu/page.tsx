// =====================================================
// TIS TIS PLATFORM - Menu Page
// Restaurant menu management page
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/shared/utils';
import { useTenant } from '@/src/hooks/useTenant';
import { useFeatureFlags } from '@/src/hooks/useFeatureFlags';
import { useCategories, useMenuItems, useMenuStats } from '@/src/features/restaurant-menu/hooks/useMenu';
import { MenuOverview } from '@/src/features/restaurant-menu/components/MenuOverview';
import { MenuItemCard } from '@/src/features/restaurant-menu/components/MenuItemCard';
import { CategoryFormModal } from '@/src/features/restaurant-menu/components/CategoryFormModal';
import { MenuItemFormModal } from '@/src/features/restaurant-menu/components/MenuItemFormModal';
import type { MenuItem, MenuCategory, MenuFilters, CategoryFormData, MenuItemFormData } from '@/src/features/restaurant-menu/types';

// ======================
// TYPES
// ======================
type TabId = 'overview' | 'items' | 'categories';

interface Tab {
  id: TabId;
  name: string;
}

const TABS: Tab[] = [
  { id: 'overview', name: 'Resumen' },
  { id: 'items', name: 'Platillos' },
  { id: 'categories', name: 'Categorías' },
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
                <div key={i} className="bg-slate-100 rounded-xl p-6 h-52" />
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mx-auto max-w-lg mt-20">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Gestión de Menú
            </h2>
            <p className="text-slate-500 mb-6">
              Administra tu carta digital, categorías y platillos con precios y opciones dietéticas.
            </p>

            <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
              <ul className="space-y-3">
                {[
                  'Categorías y subcategorías organizadas',
                  'Platillos con variantes y precios especiales',
                  'Información de alérgenos y dietas',
                  'Disponibilidad en tiempo real',
                  'Integración con sistema de órdenes',
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
              Desbloquear Gestión de Menú
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// CATEGORY SIDEBAR
// ======================
interface CategorySidebarProps {
  categories: MenuCategory[];
  selectedCategory: string | null;
  onSelect: (categoryId: string | null) => void;
  onAddCategory: () => void;
}

function CategorySidebar({ categories, selectedCategory, onSelect, onAddCategory }: CategorySidebarProps) {
  return (
    <div className="hidden lg:block w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200/80 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Categorías</h3>
        <button
          onClick={onAddCategory}
          className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all"
          title="Nueva categoría"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="space-y-1">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            'w-full px-3 py-2.5 min-h-[44px] text-left text-sm rounded-lg transition-all active:scale-95',
            selectedCategory === null
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100 active:bg-slate-200'
          )}
        >
          Todos los platillos
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              'w-full px-3 py-2.5 min-h-[44px] text-left text-sm rounded-lg transition-all flex items-center justify-between active:scale-95',
              selectedCategory === cat.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 active:bg-slate-200'
            )}
          >
            <span className="truncate">{cat.name}</span>
            {cat.items_count !== undefined && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                selectedCategory === cat.id ? 'bg-white/20' : 'bg-slate-100'
              )}>
                {cat.items_count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ======================
// ITEMS LIST
// ======================
interface ItemsListProps {
  items: MenuItem[];
  loading: boolean;
  onEdit: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem) => void;
  onToggleFeatured: (item: MenuItem) => void;
  onDuplicate: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onAddItem: () => void;
}

function ItemsList({
  items,
  loading,
  onEdit,
  onToggleAvailability,
  onToggleFeatured,
  onDuplicate,
  onDelete,
  onAddItem,
}: ItemsListProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredItems = items.filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-6">
        <div className="relative flex-1">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar platillo..."
            className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-all active:scale-95',
                viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-500'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-all active:scale-95',
                viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          <button
            onClick={onAddItem}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 active:scale-95 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Nuevo Platillo</span>
          </button>
        </div>
      </div>

      {/* Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-slate-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {search ? 'No se encontraron platillos' : 'Sin platillos aún'}
          </h3>
          <p className="text-slate-500 mb-6">
            {search ? 'Intenta con otro término de búsqueda' : 'Agrega tu primer platillo al menú'}
          </p>
          {!search && (
            <button
              onClick={onAddItem}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar platillo
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onEdit={onEdit}
              onToggleAvailability={onToggleAvailability}
              onToggleFeatured={onToggleFeatured}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              compact
              onEdit={onEdit}
              onToggleAvailability={onToggleAvailability}
              onToggleFeatured={onToggleFeatured}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// CATEGORIES TAB
// ======================
interface CategoriesTabProps {
  categories: MenuCategory[];
  onEdit: (category: MenuCategory) => void;
  onDelete: (category: MenuCategory) => void;
  onAdd: () => void;
}

function CategoriesTab({ categories, onEdit, onDelete, onAdd }: CategoriesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Categorías del Menú</h2>
          <p className="text-sm text-slate-500">{categories.length} categorías configuradas</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Categoría
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500">No hay categorías configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {cat.image_url ? (
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-xl object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                    <p className="text-xs text-slate-500">
                      {cat.items_count ?? 0} platillos
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    cat.is_active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {cat.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {cat.description && (
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                  {cat.description}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onEdit(cat)}
                  className="px-3 py-2 min-h-[44px] text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 active:scale-95 rounded-lg transition-all"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(cat)}
                  className="px-3 py-2 min-h-[44px] text-sm text-red-600 hover:bg-red-50 active:bg-red-100 active:scale-95 rounded-lg transition-all"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// DELETE MODAL
// ======================
interface DeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function DeleteModal({ isOpen, title, message, onConfirm, onCancel, isLoading }: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">{title}</h3>
          <p className="text-sm text-slate-500 text-center mb-6">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Eliminar
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
export default function MenuPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { tenant, branches, isLoading: tenantLoading, currentBranchId } = useTenant();
  const { isEnabled, flagsLoading } = useFeatureFlags();

  // Modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'item'; data: MenuCategory | MenuItem } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data hooks
  const { stats, loading: statsLoading, refresh: refreshStats } = useMenuStats();
  const {
    categories,
    loading: categoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: refreshCategories,
  } = useCategories();
  const {
    items,
    loading: itemsLoading,
    createItem,
    updateItem,
    toggleAvailability,
    toggleFeatured,
    deleteItem,
    refresh: refreshItems,
  } = useMenuItems({ category_id: selectedCategory || undefined });

  // Check feature flag
  const menuEnabled = isEnabled('menu_enabled');
  const isRestaurant = tenant?.vertical === 'restaurant';

  // Get default branch ID
  const defaultBranchId = currentBranchId || branches?.[0]?.id || '';

  // Category handlers
  const handleAddCategory = useCallback(() => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  }, []);

  const handleEditCategory = useCallback((category: MenuCategory) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  }, []);

  const handleDeleteCategory = useCallback((category: MenuCategory) => {
    setDeleteTarget({ type: 'category', data: category });
    setDeleteModalOpen(true);
  }, []);

  const handleCategorySubmit = useCallback(async (data: CategoryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, data);
      } else {
        await createCategory(data);
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      refreshStats();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [editingCategory, updateCategory, createCategory, refreshStats]);

  // Item handlers
  const handleAddItem = useCallback(() => {
    setEditingItem(null);
    setItemModalOpen(true);
  }, []);

  const handleEditItem = useCallback((item: MenuItem) => {
    setEditingItem(item);
    setItemModalOpen(true);
  }, []);

  const handleToggleAvailability = useCallback(async (item: MenuItem) => {
    await toggleAvailability(item.id, !item.is_available);
  }, [toggleAvailability]);

  const handleToggleFeatured = useCallback(async (item: MenuItem) => {
    await toggleFeatured(item.id, !item.is_featured);
  }, [toggleFeatured]);

  const handleDuplicateItem = useCallback((item: MenuItem) => {
    // Create a copy without id to open as new item
    const duplicateData = {
      ...item,
      name: `${item.name} (copia)`,
    };
    setEditingItem(null);
    setItemModalOpen(true);
  }, []);

  const handleDeleteItem = useCallback((item: MenuItem) => {
    setDeleteTarget({ type: 'item', data: item });
    setDeleteModalOpen(true);
  }, []);

  const handleItemSubmit = useCallback(async (data: MenuItemFormData) => {
    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateItem(editingItem.id, data);
      } else {
        await createItem(data);
      }
      setItemModalOpen(false);
      setEditingItem(null);
      refreshStats();
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [editingItem, updateItem, createItem, refreshStats]);

  // Delete confirmation handler
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsSubmitting(true);
    try {
      if (deleteTarget.type === 'category') {
        await deleteCategory((deleteTarget.data as MenuCategory).id);
        refreshStats();
      } else {
        await deleteItem((deleteTarget.data as MenuItem).id);
        refreshStats();
      }
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteTarget, deleteCategory, deleteItem, refreshStats]);

  const handleImport = useCallback(() => {
    console.log('Import menu');
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
  if (!isRestaurant || !menuEnabled) {
    return <UpgradePrompt />;
  }

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <MenuOverview
            stats={stats}
            loading={statsLoading}
            onAddCategory={handleAddCategory}
            onAddItem={handleAddItem}
            onImport={handleImport}
          />
        );
      case 'items':
        return (
          <div className="flex gap-6">
            <CategorySidebar
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              onAddCategory={handleAddCategory}
            />
            <ItemsList
              items={items}
              loading={itemsLoading}
              onEdit={handleEditItem}
              onToggleAvailability={handleToggleAvailability}
              onToggleFeatured={handleToggleFeatured}
              onDuplicate={handleDuplicateItem}
              onDelete={handleDeleteItem}
              onAddItem={handleAddItem}
            />
          </div>
        );
      case 'categories':
        return (
          <CategoriesTab
            categories={categories}
            onEdit={handleEditCategory}
            onDelete={handleDeleteCategory}
            onAdd={handleAddCategory}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestión de Menú</h1>
        <p className="text-slate-500 mt-1">
          Administra los platillos, categorías y precios de tu carta
        </p>
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

      {/* Category Form Modal */}
      <CategoryFormModal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={handleCategorySubmit}
        category={editingCategory}
        parentCategories={categories.filter(c => !c.parent_id)}
        branchId={defaultBranchId}
        isLoading={isSubmitting}
      />

      {/* Item Form Modal */}
      <MenuItemFormModal
        isOpen={itemModalOpen}
        onClose={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleItemSubmit}
        item={editingItem}
        categories={categories}
        branchId={defaultBranchId}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={deleteModalOpen}
        title={deleteTarget?.type === 'category' ? 'Eliminar Categoría' : 'Eliminar Platillo'}
        message={
          deleteTarget?.type === 'category'
            ? `¿Estás seguro de eliminar la categoría "${(deleteTarget?.data as MenuCategory)?.name}"? Esta acción no se puede deshacer.`
            : `¿Estás seguro de eliminar "${(deleteTarget?.data as MenuItem)?.name}"? Esta acción no se puede deshacer.`
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
        isLoading={isSubmitting}
      />
    </div>
  );
}
