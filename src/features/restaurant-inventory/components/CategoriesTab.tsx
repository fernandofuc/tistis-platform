'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Categories Tab
// Full CRUD management for inventory categories
// Professional Apple/TIS TIS Style Design
// =====================================================

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Folder,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronRight,
  Package,
  MoreVertical,
  Check,
  X,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { InventoryCategory } from '../types';

// ======================
// TYPES
// ======================

interface CategoriesTabProps {
  categories: InventoryCategory[];
  isLoading?: boolean;
  onCreateCategory: () => void;
  onEditCategory: (category: InventoryCategory) => void;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

// ======================
// DELETE CONFIRMATION MODAL
// ======================

interface DeleteModalProps {
  isOpen: boolean;
  category: InventoryCategory | null;
  itemsCount: number;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

function DeleteModal({ isOpen, category, itemsCount, onClose, onConfirm, loading }: DeleteModalProps) {
  if (!isOpen || !category) return null;

  const hasItems = itemsCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Eliminar {category.name}
          </h3>

          {hasItems ? (
            <div className="bg-amber-50 rounded-xl p-4 mb-4 border border-amber-100">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Esta categoría tiene {itemsCount} producto{itemsCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Los productos quedarán sin categoría asignada.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm mb-6">
              Esta acción no se puede deshacer. La categoría será eliminada permanentemente.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl transition-colors',
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
// CATEGORY CARD
// ======================

interface CategoryCardProps {
  category: InventoryCategory;
  itemsCount: number;
  onEdit: () => void;
  onDelete: () => void;
}

function CategoryCard({ category, itemsCount, onEdit, onDelete }: CategoryCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        'group relative bg-white rounded-xl border transition-all duration-200',
        category.is_active
          ? 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          : 'border-slate-100 bg-slate-50 opacity-70'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ backgroundColor: `${category.color}15` }}
            >
              <Folder className="w-6 h-6" style={{ color: category.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{category.name}</h3>
              <p className="text-xs text-slate-500">
                {itemsCount} producto{itemsCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {category.description && (
          <p className="mt-3 text-sm text-slate-500 line-clamp-2">
            {category.description}
          </p>
        )}

        {/* Status Badge */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              category.is_active
                ? 'bg-green-50 text-green-700'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            {category.is_active ? 'Activa' : 'Inactiva'}
          </span>
          {category.parent_id && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              Subcategoría
            </span>
          )}
        </div>
      </div>

      {/* Color Bar */}
      <div
        className="h-1 rounded-b-xl"
        style={{ backgroundColor: category.color }}
      />
    </div>
  );
}

// ======================
// EMPTY STATE
// ======================

function EmptyState({ onCreateCategory }: { onCreateCategory: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="p-4 bg-slate-100 rounded-full mb-4">
        <Folder className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        Sin categorías
      </h3>
      <p className="text-slate-500 text-center mb-6 max-w-md">
        Organiza tu inventario creando categorías para agrupar productos similares.
      </p>
      <button
        onClick={onCreateCategory}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Crear Categoría
      </button>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function CategoriesTab({
  categories,
  isLoading = false,
  onCreateCategory,
  onEditCategory,
  onDeleteCategory,
}: CategoriesTabProps) {
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<InventoryCategory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Filter categories
  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
      if (search && !cat.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (!showInactive && !cat.is_active) return false;
      return true;
    });
  }, [categories, search, showInactive]);

  // Sort: active first, then by display_order, then by name
  const sortedCategories = useMemo(() => {
    return [...filteredCategories].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });
  }, [filteredCategories]);

  // Get items count per category
  const getItemsCount = useCallback((categoryId: string): number => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.items_count || 0;
  }, [categories]);

  // Handlers
  const handleOpenDelete = useCallback((category: InventoryCategory) => {
    setDeletingCategory(category);
    setDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingCategory) return;

    setDeleteLoading(true);
    try {
      await onDeleteCategory(deletingCategory.id);
      setDeleteModalOpen(false);
      setDeletingCategory(null);
    } catch (error) {
      console.error('Error deleting category:', error);
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingCategory, onDeleteCategory]);

  // Stats
  const stats = useMemo(() => {
    const active = categories.filter(c => c.is_active).length;
    const inactive = categories.length - active;
    const totalItems = categories.reduce((sum, c) => sum + (c.items_count || 0), 0);
    return { total: categories.length, active, inactive, totalItems };
  }, [categories]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          <p className="text-slate-500">Cargando categorías...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (categories.length === 0) {
    return <EmptyState onCreateCategory={onCreateCategory} />;
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Total</p>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Activas</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Inactivas</p>
          <p className="text-2xl font-bold text-slate-400">{stats.inactive}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Productos</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.totalItems}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar categorías..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        {/* Show inactive toggle */}
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl font-medium text-sm transition-all',
            showInactive
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          )}
        >
          {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showInactive ? 'Ocultando inactivas' : 'Mostrar inactivas'}
        </button>

        {/* Add button */}
        <button
          onClick={onCreateCategory}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </button>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">
        {sortedCategories.length} {sortedCategories.length === 1 ? 'categoría' : 'categorías'}
        {search && ' (filtrado)'}
      </p>

      {/* Categories Grid */}
      {sortedCategories.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No se encontraron categorías</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCategories.map(category => (
            <CategoryCard
              key={category.id}
              category={category}
              itemsCount={getItemsCount(category.id)}
              onEdit={() => onEditCategory(category)}
              onDelete={() => handleOpenDelete(category)}
            />
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModalOpen}
        category={deletingCategory}
        itemsCount={deletingCategory ? getItemsCount(deletingCategory.id) : 0}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingCategory(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}

export default CategoriesTab;
