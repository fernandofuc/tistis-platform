'use client';

// =====================================================
// TIS TIS PLATFORM - Supplier Form (Simplified)
// Premium modal for creating and editing suppliers
// Design: Apple/Lovable style with TIS TIS colors
// =====================================================

import { useState, useMemo } from 'react';
import {
  X,
  Building2,
  User,
  MessageCircle,
  Package,
  MapPin,
  FileText,
  Check,
  Search,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/src/hooks/useTenant';
import type { InventorySupplier, SupplierFormData, InventoryItem } from '../types';

// ======================
// TYPES
// ======================

interface SupplierFormProps {
  supplier?: InventorySupplier;
  items: InventoryItem[]; // All available inventory items
  onSubmit: (data: SupplierFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface SimplifiedFormData {
  name: string;
  contact_name: string;
  whatsapp: string;
  supplied_item_ids: string[];
  delivery_branch_ids: string[];
  notes: string;
}

// ======================
// HELPERS
// ======================

function formatWhatsAppNumber(value: string): string {
  // Remove all non-numeric characters except +
  const cleaned = value.replace(/[^\d+]/g, '');

  // Ensure it starts with + for international format
  if (cleaned && !cleaned.startsWith('+')) {
    return '+' + cleaned;
  }

  return cleaned;
}

function isValidWhatsApp(value: string): boolean {
  // Basic validation: should start with + and have 10-15 digits
  if (!value) return true; // Empty is valid (optional)
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ======================
// COMPONENT
// ======================

export function SupplierForm({
  supplier,
  items,
  onSubmit,
  onCancel,
  isLoading = false,
}: SupplierFormProps) {
  const { branches } = useTenant();
  const isEditing = !!supplier;

  // Simplified form state
  const [formData, setFormData] = useState<SimplifiedFormData>({
    name: supplier?.name || '',
    contact_name: supplier?.contact_name || '',
    whatsapp: supplier?.whatsapp || '',
    supplied_item_ids: supplier?.supplied_item_ids || [],
    delivery_branch_ids: supplier?.delivery_branch_ids || [],
    notes: supplier?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemSearch, setItemSearch] = useState('');

  // Filter items by search term
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const search = itemSearch.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search)
    );
  }, [items, itemSearch]);

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre de la empresa es requerido';
    }

    if (formData.whatsapp && !isValidWhatsApp(formData.whatsapp)) {
      newErrors.whatsapp = 'Numero de WhatsApp invalido (10-15 digitos)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      // Convert simplified form to full SupplierFormData
      const fullData: SupplierFormData = {
        name: formData.name.trim(),
        contact_name: formData.contact_name.trim() || undefined,
        whatsapp: formData.whatsapp.trim() || undefined,
        supplied_item_ids: formData.supplied_item_ids,
        delivery_branch_ids: formData.delivery_branch_ids,
        notes: formData.notes.trim() || undefined,
        is_active: true,
        // Keep existing values if editing (convert null to undefined)
        ...(supplier && {
          code: supplier.code ?? undefined,
          email: supplier.email ?? undefined,
          phone: supplier.phone ?? undefined,
          mobile: supplier.mobile ?? undefined,
          country: supplier.country ?? undefined,
          currency: supplier.currency ?? undefined,
        }),
      };

      await onSubmit(fullData);
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  // Input change handler
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Special handling for WhatsApp
    if (name === 'whatsapp') {
      setFormData(prev => ({
        ...prev,
        [name]: formatWhatsAppNumber(value),
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Toggle item selection
  const toggleItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      supplied_item_ids: prev.supplied_item_ids.includes(itemId)
        ? prev.supplied_item_ids.filter(id => id !== itemId)
        : [...prev.supplied_item_ids, itemId],
    }));
  };

  // Toggle branch selection
  const toggleBranch = (branchId: string) => {
    setFormData(prev => ({
      ...prev,
      delivery_branch_ids: prev.delivery_branch_ids.includes(branchId)
        ? prev.delivery_branch_ids.filter(id => id !== branchId)
        : [...prev.delivery_branch_ids, branchId],
    }));
  };

  // Select/Deselect all items
  const toggleAllItems = () => {
    setFormData(prev => ({
      ...prev,
      supplied_item_ids:
        prev.supplied_item_ids.length === items.length
          ? []
          : items.map(item => item.id),
    }));
  };

  // Select/Deselect all branches
  const toggleAllBranches = () => {
    setFormData(prev => ({
      ...prev,
      delivery_branch_ids:
        prev.delivery_branch_ids.length === branches.length
          ? []
          : branches.map(b => b.id),
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-tis-coral/5 to-tis-purple/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-tis-coral to-tis-pink rounded-xl shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <p className="text-xs text-slate-500">
                Configura el proveedor para notificaciones
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center hover:bg-slate-100 rounded-xl active:scale-95 transition-all"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* === SECTION: Basic Info === */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Building2 className="w-4 h-4 text-tis-coral" />
                Informacion Basica
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nombre de la Empresa <span className="text-tis-coral">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl text-sm',
                    'focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all',
                    errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  )}
                  placeholder="Ej: Distribuidora del Norte S.A."
                  autoFocus
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 bg-red-500 rounded-full" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Contact Name & WhatsApp Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <User className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                    Nombre del Contacto
                  </label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
                    placeholder="Juan Perez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-green-500" />
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-4 py-2.5 border rounded-xl text-sm',
                      'focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all',
                      errors.whatsapp ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    )}
                    placeholder="+52 55 1234 5678"
                  />
                  {errors.whatsapp && (
                    <p className="text-red-500 text-xs mt-1">{errors.whatsapp}</p>
                  )}
                </div>
              </div>
            </section>

            {/* === SECTION: Products/Items === */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Package className="w-4 h-4 text-tis-purple" />
                  Productos que Provee
                </div>
                <button
                  type="button"
                  onClick={toggleAllItems}
                  className="text-xs text-tis-purple hover:text-tis-purple-dark font-medium"
                >
                  {formData.supplied_item_ids.length === items.length
                    ? 'Deseleccionar todo'
                    : 'Seleccionar todo'}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Selecciona los ingredientes o productos que este proveedor suministra
              </p>

              {/* Search Items */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-tis-purple/20 focus:border-tis-purple transition-all"
                  placeholder="Buscar ingredientes..."
                />
              </div>

              {/* Items Grid */}
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                {filteredItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    {items.length === 0
                      ? 'No hay productos en inventario'
                      : 'No se encontraron productos'}
                  </p>
                ) : (
                  filteredItems.map(item => (
                    <label
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all',
                        formData.supplied_item_ids.includes(item.id)
                          ? 'bg-tis-purple/10 border border-tis-purple/30'
                          : 'hover:bg-white border border-transparent'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center transition-all',
                          formData.supplied_item_ids.includes(item.id)
                            ? 'bg-tis-purple text-white'
                            : 'border-2 border-slate-300'
                        )}
                      >
                        {formData.supplied_item_ids.includes(item.id) && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.supplied_item_ids.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="sr-only"
                      />
                      <span className="text-sm text-slate-700 flex-1">{item.name}</span>
                      {item.sku && (
                        <span className="text-xs text-slate-400">{item.sku}</span>
                      )}
                    </label>
                  ))
                )}
              </div>

              {formData.supplied_item_ids.length > 0 && (
                <p className="text-xs text-tis-purple font-medium">
                  {formData.supplied_item_ids.length} producto
                  {formData.supplied_item_ids.length !== 1 ? 's' : ''} seleccionado
                  {formData.supplied_item_ids.length !== 1 ? 's' : ''}
                </p>
              )}
            </section>

            {/* === SECTION: Delivery Branches === */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <MapPin className="w-4 h-4 text-tis-green" />
                  Sucursales de Entrega
                </div>
                {branches.length > 1 && (
                  <button
                    type="button"
                    onClick={toggleAllBranches}
                    className="text-xs text-tis-green hover:text-tis-green/80 font-medium"
                  >
                    {formData.delivery_branch_ids.length === branches.length
                      ? 'Deseleccionar todo'
                      : 'Seleccionar todo'}
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-500">
                ¿A que sucursales entrega este proveedor?
              </p>

              {/* Branches List */}
              <div className="border border-slate-200 rounded-xl p-2 space-y-1 bg-slate-50/50">
                {branches.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No hay sucursales configuradas
                  </p>
                ) : (
                  branches.map(branch => (
                    <label
                      key={branch.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all',
                        formData.delivery_branch_ids.includes(branch.id)
                          ? 'bg-tis-green/10 border border-tis-green/30'
                          : 'hover:bg-white border border-transparent'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center transition-all',
                          formData.delivery_branch_ids.includes(branch.id)
                            ? 'bg-tis-green text-white'
                            : 'border-2 border-slate-300'
                        )}
                      >
                        {formData.delivery_branch_ids.includes(branch.id) && (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.delivery_branch_ids.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="sr-only"
                      />
                      <span className="text-sm text-slate-700 flex-1">
                        {branch.name}
                        {branch.is_headquarters && (
                          <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            Principal
                          </span>
                        )}
                      </span>
                      {branch.city && (
                        <span className="text-xs text-slate-400">{branch.city}</span>
                      )}
                    </label>
                  ))
                )}
              </div>

              {formData.delivery_branch_ids.length > 0 && (
                <p className="text-xs text-tis-green font-medium">
                  {formData.delivery_branch_ids.length} sucursal
                  {formData.delivery_branch_ids.length !== 1 ? 'es' : ''} seleccionada
                  {formData.delivery_branch_ids.length !== 1 ? 's' : ''}
                </p>
              )}
            </section>

            {/* === SECTION: Notes === */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <FileText className="w-4 h-4 text-slate-400" />
                Notas
                <span className="text-xs text-slate-400 font-normal">(opcional)</span>
              </div>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
                placeholder="Informacion adicional sobre el proveedor, horarios de entrega, etc."
              />
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={cn(
                'px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all',
                'bg-gradient-to-r from-tis-coral to-tis-pink',
                'hover:shadow-lg hover:shadow-tis-coral/25 hover:-translate-y-0.5',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
                'flex items-center gap-2'
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isEditing ? 'Guardar Cambios' : 'Crear Proveedor'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SupplierForm;
