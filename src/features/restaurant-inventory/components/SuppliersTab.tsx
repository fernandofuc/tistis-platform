'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Suppliers Tab
// Full CRUD management for inventory suppliers
// Focused on auto-restock notifications workflow
// Professional Apple/TIS TIS Style Design
// =====================================================

import { useState, useCallback, useMemo } from 'react';
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
  Bell,
  Clock,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type { InventorySupplier } from '../types';

// ======================
// CONSTANTS
// ======================

const PAYMENT_TERMS_LABELS: Record<string, { label: string; badge: string }> = {
  immediate: { label: 'Pago Inmediato', badge: 'bg-red-50 text-red-600' },
  net_7: { label: 'Neto 7 días', badge: 'bg-orange-50 text-orange-600' },
  net_15: { label: 'Neto 15 días', badge: 'bg-amber-50 text-amber-600' },
  net_30: { label: 'Neto 30 días', badge: 'bg-blue-50 text-blue-600' },
  net_45: { label: 'Neto 45 días', badge: 'bg-indigo-50 text-indigo-600' },
  net_60: { label: 'Neto 60 días', badge: 'bg-purple-50 text-purple-600' },
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
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in duration-200">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>

          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            Eliminar Proveedor
          </h3>

          <div className="flex items-center justify-center gap-3 mb-4 py-3 px-4 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {(supplier.name || 'SP').split(' ').filter(w => w.length > 0).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'SP'}
            </div>
            <span className="font-semibold text-slate-900">{supplier.name}</span>
          </div>

          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            Esta acción eliminará permanentemente al proveedor y toda su información de contacto.
            Los productos asociados no se verán afectados.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium text-white rounded-xl transition-all shadow-lg',
                loading
                  ? 'bg-red-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 hover:shadow-xl'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Eliminando...
                </span>
              ) : (
                'Eliminar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// STATS BAR
// ======================

interface StatsBarProps {
  suppliers: InventorySupplier[];
}

function StatsBar({ suppliers }: StatsBarProps) {
  const activeCount = suppliers.filter(s => s.is_active).length;
  const inactiveCount = suppliers.filter(s => !s.is_active).length;
  const withPaymentTerms = suppliers.filter(s => s.payment_terms).length;
  const avgRating = suppliers.filter(s => s.rating).reduce((acc, s) => acc + (s.rating || 0), 0) /
    (suppliers.filter(s => s.rating).length || 1);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center">
            <Check className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
            <p className="text-xs text-slate-500">Activos</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{inactiveCount}</p>
            <p className="text-xs text-slate-500">Inactivos</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-slate-500">Calificación</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 hover:border-slate-300 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{withPaymentTerms}</p>
            <p className="text-xs text-slate-500">Con crédito</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// AUTO-RESTOCK INFO BANNER
// ======================

function AutoRestockBanner() {
  return (
    <div className="bg-gradient-to-r from-tis-coral/5 via-orange-50/50 to-amber-50/30 rounded-2xl p-5 border border-tis-coral/10">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-coral to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-tis-coral/20">
          <Bell className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            Reabastecimiento Automático
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
              Activo
            </span>
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            Configura tus proveedores y TIS TIS detectará automáticamente cuando los productos estén en
            <strong> punto crítico de stock</strong>, permitiéndote crear órdenes de reabastecimiento con un clic.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/60 px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Alertas de stock bajo
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/60 px-3 py-1.5 rounded-full">
              <Zap className="w-3.5 h-3.5 text-tis-coral" />
              Pedidos con un clic
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/60 px-3 py-1.5 rounded-full">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Historial de pedidos
            </div>
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

  // Generate initials for avatar (with safeguard for empty/whitespace names)
  const initials = (supplier.name || 'SP')
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SP';

  // Get payment terms config
  const paymentConfig = supplier.payment_terms
    ? PAYMENT_TERMS_LABELS[supplier.payment_terms]
    : null;

  return (
    <div
      className={cn(
        'group relative bg-white rounded-2xl border transition-all duration-300',
        supplier.is_active
          ? 'border-slate-200 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/50'
          : 'border-slate-100 bg-slate-50/50 opacity-70'
      )}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20">
              {initials}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg leading-tight">{supplier.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {supplier.code && (
                  <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                    {supplier.code}
                  </span>
                )}
                {/* Status Badge */}
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    supplier.is_active
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {supplier.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-10 z-20 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="w-4 h-4 text-slate-500" />
                    Editar información
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onToggleActive();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {supplier.is_active ? (
                      <>
                        <X className="w-4 h-4 text-slate-500" />
                        Desactivar proveedor
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        Activar proveedor
                      </>
                    )}
                  </button>
                  <hr className="my-2 border-slate-100" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar proveedor
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-2.5 mb-4">
          {supplier.contact_name && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span>{supplier.contact_name}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {supplier.phone && (
              <a
                href={`tel:${supplier.phone}`}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-tis-coral transition-colors group/link"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center group-hover/link:bg-tis-coral/10 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 group-hover/link:text-tis-coral" />
                </div>
                {supplier.phone}
              </a>
            )}

            {supplier.email && (
              <a
                href={`mailto:${supplier.email}`}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-tis-coral transition-colors group/link"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center group-hover/link:bg-tis-coral/10 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-blue-600 group-hover/link:text-tis-coral" />
                </div>
                {supplier.email}
              </a>
            )}
          </div>

          {supplier.website && (
            <a
              href={supplier.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-tis-coral transition-colors group/link"
            >
              <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center group-hover/link:bg-tis-coral/10 transition-colors">
                <Globe className="w-3.5 h-3.5 text-purple-600 group-hover/link:text-tis-coral" />
              </div>
              {supplier.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          )}

          {(supplier.city || supplier.state) && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
              </div>
              {[supplier.city, supplier.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {/* Payment Terms */}
            {paymentConfig && (
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                paymentConfig.badge
              )}>
                <CreditCard className="w-3.5 h-3.5" />
                {paymentConfig.label}
              </span>
            )}
          </div>

          {/* Rating */}
          {supplier.rating && (
            <div className="flex items-center gap-1 text-sm">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    'w-4 h-4',
                    star <= supplier.rating!
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-200'
                  )}
                />
              ))}
            </div>
          )}
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
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(sup => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !sup.name.toLowerCase().includes(searchLower) &&
          !sup.code?.toLowerCase().includes(searchLower) &&
          !sup.contact_name?.toLowerCase().includes(searchLower) &&
          !sup.email?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      if (!showInactive && !sup.is_active) return false;
      return true;
    });
  }, [suppliers, search, showInactive]);

  // Sort: active first, then by name
  const sortedSuppliers = useMemo(() => {
    return [...filteredSuppliers].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredSuppliers]);

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
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="h-11 w-72 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-11 w-40 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-slate-100 rounded-2xl h-56 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (suppliers.length === 0) {
    return (
      <div className="space-y-6">
        {/* Info Banner */}
        <AutoRestockBanner />

        {/* Empty State */}
        <div className="text-center py-20">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-100 via-indigo-50 to-blue-100 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-purple-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Agrega tus proveedores
          </h3>
          <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
            Registra a tus proveedores para que TIS TIS pueda enviarte notificaciones
            automáticas cuando necesites reabastecer tu inventario.
          </p>
          <button
            onClick={onCreateSupplier}
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            Agregar primer proveedor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <AutoRestockBanner />

      {/* Stats */}
      <StatsBar suppliers={suppliers} />

      {/* Header with Search and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o contacto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="w-5 h-5 rounded-lg border-slate-300 text-tis-coral focus:ring-tis-coral/20"
            />
            <span>Mostrar inactivos</span>
          </label>

          <button
            onClick={onCreateSupplier}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      {sortedSuppliers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            Sin resultados
          </h3>
          <p className="text-slate-500 mb-4">
            No se encontraron proveedores con &ldquo;{search}&rdquo;
          </p>
          <button
            onClick={() => setSearch('')}
            className="text-sm font-medium text-tis-coral hover:underline"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-tis-coral/30 hover:bg-tis-coral/5 transition-all min-h-[240px] group"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-tis-coral/10 transition-colors">
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-tis-coral transition-colors" />
            </div>
            <div className="text-center">
              <span className="block text-sm font-semibold text-slate-600 group-hover:text-tis-coral transition-colors">
                Agregar proveedor
              </span>
              <span className="block text-xs text-slate-400 mt-1">
                Clic para crear nuevo
              </span>
            </div>
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
