'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Suppliers Tab
// Full CRUD management for inventory suppliers
// Professional Apple/TIS TIS Style Design
// =====================================================

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Globe,
  MapPin,
  MoreVertical,
  Check,
  X,
  Star,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import type { InventorySupplier } from '../types';

// ======================
// CONSTANTS
// ======================

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  immediate: 'Pago Inmediato',
  net_7: 'Neto 7 días',
  net_15: 'Neto 15 días',
  net_30: 'Neto 30 días',
  net_45: 'Neto 45 días',
  net_60: 'Neto 60 días',
};

// ======================
// TYPES
// ======================

interface SuppliersTabProps {
  suppliers: InventorySupplier[];
  isLoading?: boolean;
  onCreateSupplier: () => void;
  onEditSupplier: (supplier: InventorySupplier) => void;
  onDeleteSupplier: (supplierId: string) => Promise<void>;
}

// ======================
// DELETE CONFIRMATION MODAL
// ======================

interface DeleteModalProps {
  isOpen: boolean;
  supplier: InventorySupplier | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

function DeleteModal({ isOpen, supplier, onClose, onConfirm, loading }: DeleteModalProps) {
  if (!isOpen || !supplier) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Eliminar Proveedor
          </h3>

          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <span className="font-medium text-slate-900">{supplier.name}</span>
          </div>

          <p className="text-slate-500 text-sm mb-6">
            Esta acción no se puede deshacer. El proveedor y toda su información de contacto serán eliminados permanentemente.
          </p>

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
// SUPPLIER CARD
// ======================

interface SupplierCardProps {
  supplier: InventorySupplier;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

function SupplierCard({ supplier, onEdit, onDelete, onToggleActive }: SupplierCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Generate initials for avatar
  const initials = supplier.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'group relative bg-white rounded-xl border transition-all duration-200',
        supplier.is_active
          ? 'border-slate-200 hover:border-slate-300 hover:shadow-md'
          : 'border-slate-100 bg-slate-50 opacity-70'
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {initials}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{supplier.name}</h3>
              {supplier.code && (
                <p className="text-xs text-slate-500">Código: {supplier.code}</p>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
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
                      onToggleActive();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {supplier.is_active ? (
                      <>
                        <X className="w-4 h-4" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Activar
                      </>
                    )}
                  </button>
                  <hr className="my-1 border-slate-100" />
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

        {/* Contact Info */}
        <div className="space-y-2 mb-4">
          {supplier.contact_name && (
            <p className="text-sm text-slate-600">
              <span className="text-slate-400">Contacto:</span> {supplier.contact_name}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {supplier.phone && (
              <a
                href={`tel:${supplier.phone}`}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-purple-600 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {supplier.phone}
              </a>
            )}

            {supplier.email && (
              <a
                href={`mailto:${supplier.email}`}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-purple-600 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {supplier.email}
              </a>
            )}
          </div>

          {supplier.website && (
            <a
              href={supplier.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-purple-600 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {supplier.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {(supplier.city || supplier.state) && (
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5" />
              {[supplier.city, supplier.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {/* Payment Terms */}
            {supplier.payment_terms && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <CreditCard className="w-3.5 h-3.5" />
                {PAYMENT_TERMS_LABELS[supplier.payment_terms] || supplier.payment_terms}
              </span>
            )}

            {/* Rating */}
            {supplier.rating && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <Star className="w-3.5 h-3.5 fill-current" />
                {supplier.rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Status Badge */}
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              supplier.is_active
                ? 'bg-green-50 text-green-700'
                : 'bg-slate-100 text-slate-500'
            )}
          >
            {supplier.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function SuppliersTab({
  suppliers,
  isLoading = false,
  onCreateSupplier,
  onEditSupplier,
  onDeleteSupplier,
}: SuppliersTabProps) {
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<InventorySupplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(sup => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !sup.name.toLowerCase().includes(searchLower) &&
        !sup.code?.toLowerCase().includes(searchLower) &&
        !sup.contact_name?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (!showInactive && !sup.is_active) return false;
    return true;
  });

  // Sort: active first, then by name
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Handlers
  const handleOpenDelete = useCallback((supplier: InventorySupplier) => {
    setDeletingSupplier(supplier);
    setDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingSupplier) return;

    setDeleteLoading(true);
    try {
      await onDeleteSupplier(deletingSupplier.id);
      setDeleteModalOpen(false);
      setDeletingSupplier(null);
    } catch (error) {
      console.error('Error deleting supplier:', error);
    } finally {
      setDeleteLoading(false);
    }
  }, [deletingSupplier, onDeleteSupplier]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-64 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-slate-100 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (suppliers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
          <Building2 className="w-10 h-10 text-purple-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          Sin proveedores
        </h3>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Agrega proveedores para gestionar tus compras y mantener un directorio de contactos.
        </p>
        <button
          onClick={onCreateSupplier}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          Agregar primer proveedor
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar proveedores..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            Mostrar inactivos
          </label>

          <button
            onClick={onCreateSupplier}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 text-sm text-slate-500">
        <span>
          <span className="font-semibold text-slate-900">{suppliers.filter(s => s.is_active).length}</span> activos
        </span>
        <span>
          <span className="font-semibold text-slate-900">{suppliers.filter(s => !s.is_active).length}</span> inactivos
        </span>
      </div>

      {/* Suppliers Grid */}
      {sortedSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <Search className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No se encontraron proveedores con "{search}"</p>
          <button
            onClick={() => setSearch('')}
            className="mt-2 text-sm text-purple-600 hover:underline"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedSuppliers.map(supplier => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onEdit={() => onEditSupplier(supplier)}
              onDelete={() => handleOpenDelete(supplier)}
              onToggleActive={() => {/* Handled through edit */}}
            />
          ))}

          {/* Add Card */}
          <button
            onClick={onCreateSupplier}
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 hover:border-purple-300 hover:bg-purple-50/50 transition-all min-h-[200px] group"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <Plus className="w-6 h-6 text-slate-400 group-hover:text-purple-500" />
            </div>
            <span className="text-sm font-medium text-slate-600 group-hover:text-purple-600">Agregar proveedor</span>
          </button>
        </div>
      )}

      {/* Delete Modal */}
      <DeleteModal
        isOpen={deleteModalOpen}
        supplier={deletingSupplier}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingSupplier(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}

export default SuppliersTab;
