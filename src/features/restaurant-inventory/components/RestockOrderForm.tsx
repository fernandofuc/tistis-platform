'use client';

// =====================================================
// TIS TIS PLATFORM - Restock Order Form
// Premium modal for creating restock orders
// Design: Apple/Lovable style with TIS TIS colors
// =====================================================

import { useState, useMemo, useEffect } from 'react';
import {
  X,
  Package,
  Building2,
  Truck,
  Plus,
  Minus,
  Trash2,
  Search,
  Calendar,
  FileText,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  InventorySupplier,
  InventoryItem,
  LowStockAlert,
  RestockOrderFormData,
} from '../types';

// ======================
// TYPES
// ======================

interface RestockOrderFormProps {
  branchId: string;
  suppliers: InventorySupplier[];
  items: InventoryItem[];
  alerts?: LowStockAlert[];
  preSelectedAlertIds?: string[];
  onSubmit: (data: RestockOrderFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface OrderItem {
  inventory_item_id: string;
  item: InventoryItem;
  quantity_requested: number;
  unit: string;
  unit_cost: number;
}

// ======================
// COMPONENT
// ======================

export function RestockOrderForm({
  branchId,
  suppliers,
  items,
  alerts = [],
  preSelectedAlertIds = [],
  onSubmit,
  onCancel,
  isLoading = false,
}: RestockOrderFormProps) {
  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemSearch, setItemSearch] = useState('');
  const [showItemSelector, setShowItemSelector] = useState(false);

  // Initialize from alerts if provided
  useEffect(() => {
    if (preSelectedAlertIds.length > 0 && alerts.length > 0) {
      const selectedAlerts = alerts.filter(a => preSelectedAlertIds.includes(a.id));

      if (selectedAlerts.length > 0) {
        // Get unique supplier from alerts
        const firstAlert = selectedAlerts[0];
        if (firstAlert.suggested_supplier_id) {
          setSelectedSupplierId(firstAlert.suggested_supplier_id);
        }

        // Create order items from alerts
        const newItems: OrderItem[] = selectedAlerts
          .filter(a => a.item)
          .map(alert => {
            const item = items.find(i => i.id === alert.item_id);
            if (!item) return null;

            return {
              inventory_item_id: alert.item_id,
              item,
              quantity_requested: alert.suggested_quantity || alert.deficit_quantity || 10,
              unit: item.unit || 'unidad',
              unit_cost: item.unit_cost || 0,
            };
          })
          .filter((item): item is OrderItem => item !== null);

        setOrderItems(newItems);
      }
    }
  }, [preSelectedAlertIds, alerts, items]);

  // Filter suppliers with WhatsApp
  const activeSuppliers = useMemo(() => {
    return suppliers.filter(s => s.is_active);
  }, [suppliers]);

  // Filter items by search and not already added
  const availableItems = useMemo(() => {
    const addedIds = new Set(orderItems.map(oi => oi.inventory_item_id));
    let filtered = items.filter(item => !addedIds.has(item.id));

    if (itemSearch.trim()) {
      const search = itemSearch.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.name.toLowerCase().includes(search) ||
          item.sku?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [items, orderItems, itemSearch]);

  // Get selected supplier
  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  // Filter items by supplier's supplied_item_ids if available
  const supplierItems = useMemo(() => {
    if (!selectedSupplier?.supplied_item_ids?.length) {
      return availableItems;
    }
    return availableItems.filter(item =>
      selectedSupplier.supplied_item_ids?.includes(item.id)
    );
  }, [availableItems, selectedSupplier]);

  // Calculate total
  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + item.quantity_requested * item.unit_cost;
    }, 0);
  }, [orderItems]);

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedSupplierId) {
      newErrors.supplier = 'Selecciona un proveedor';
    }

    if (orderItems.length === 0) {
      newErrors.items = 'Agrega al menos un artículo';
    }

    const invalidItems = orderItems.filter(item => item.quantity_requested <= 0);
    if (invalidItems.length > 0) {
      newErrors.items = 'Todas las cantidades deben ser mayores a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const data: RestockOrderFormData = {
        branch_id: branchId,
        supplier_id: selectedSupplierId,
        trigger_source: preSelectedAlertIds.length > 0 ? 'alert' : 'manual',
        triggered_by_alert_ids: preSelectedAlertIds,
        expected_delivery_date: expectedDeliveryDate || undefined,
        internal_notes: internalNotes.trim() || undefined,
        supplier_notes: supplierNotes.trim() || undefined,
        items: orderItems.map(item => ({
          inventory_item_id: item.inventory_item_id,
          quantity_requested: item.quantity_requested,
          unit: item.unit,
          unit_cost: item.unit_cost,
        })),
      };

      await onSubmit(data);
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  // Add item to order
  const addItem = (item: InventoryItem) => {
    setOrderItems(prev => [
      ...prev,
      {
        inventory_item_id: item.id,
        item,
        quantity_requested: item.reorder_quantity || 10,
        unit: item.unit || 'unidad',
        unit_cost: item.unit_cost || 0,
      },
    ]);
    setShowItemSelector(false);
    setItemSearch('');
  };

  // Remove item from order
  const removeItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(oi => oi.inventory_item_id !== itemId));
  };

  // Update item quantity
  const updateQuantity = (itemId: string, delta: number) => {
    setOrderItems(prev =>
      prev.map(oi => {
        if (oi.inventory_item_id === itemId) {
          const newQty = Math.max(0, oi.quantity_requested + delta);
          return { ...oi, quantity_requested: newQty };
        }
        return oi;
      })
    );
  };

  // Update item cost
  const updateCost = (itemId: string, cost: number) => {
    setOrderItems(prev =>
      prev.map(oi => {
        if (oi.inventory_item_id === itemId) {
          return { ...oi, unit_cost: Math.max(0, cost) };
        }
        return oi;
      })
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-tis-coral/5 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-tis-coral to-orange-500 rounded-xl shadow-lg shadow-tis-coral/20">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Nueva Orden de Reabastecimiento
              </h2>
              <p className="text-xs text-slate-500">
                {preSelectedAlertIds.length > 0
                  ? `Creando desde ${preSelectedAlertIds.length} alerta${preSelectedAlertIds.length !== 1 ? 's' : ''}`
                  : 'Orden manual'}
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
            {/* === SECTION: Supplier === */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Building2 className="w-4 h-4 text-purple-500" />
                Proveedor <span className="text-tis-coral">*</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeSuppliers.map(supplier => (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => setSelectedSupplierId(supplier.id)}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                      selectedSupplierId === supplier.id
                        ? 'border-tis-coral bg-tis-coral/5 ring-2 ring-tis-coral/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm',
                      selectedSupplierId === supplier.id
                        ? 'bg-tis-coral text-white'
                        : 'bg-slate-100 text-slate-600'
                    )}>
                      {supplier.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{supplier.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {supplier.whatsapp ? '📱 WhatsApp disponible' : supplier.contact_name || 'Sin contacto'}
                      </p>
                    </div>
                    {selectedSupplierId === supplier.id && (
                      <Check className="w-5 h-5 text-tis-coral flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {errors.supplier && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.supplier}
                </p>
              )}
            </section>

            {/* === SECTION: Items === */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Package className="w-4 h-4 text-tis-coral" />
                  Artículos <span className="text-tis-coral">*</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowItemSelector(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-tis-coral hover:text-tis-coral/80 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar artículo
                </button>
              </div>

              {/* Order Items List */}
              {orderItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                  <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">
                    No hay artículos en la orden
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowItemSelector(true)}
                    className="text-sm text-tis-coral font-medium hover:underline mt-2"
                  >
                    Agregar artículos
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {orderItems.map(orderItem => (
                    <div
                      key={orderItem.inventory_item_id}
                      className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">
                          {orderItem.item.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {orderItem.item.sku && <span className="mr-2">{orderItem.item.sku}</span>}
                          Stock: {orderItem.item.current_stock || 0} {orderItem.unit}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(orderItem.inventory_item_id, -1)}
                          className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
                        >
                          <Minus className="w-5 h-5 text-slate-600" />
                        </button>
                        <input
                          type="number"
                          value={orderItem.quantity_requested}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setOrderItems(prev =>
                              prev.map(oi =>
                                oi.inventory_item_id === orderItem.inventory_item_id
                                  ? { ...oi, quantity_requested: val }
                                  : oi
                              )
                            );
                          }}
                          className="w-16 text-center py-1 px-2 border border-slate-200 rounded-lg text-sm font-medium"
                          min="0"
                          step="0.1"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(orderItem.inventory_item_id, 1)}
                          className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all"
                        >
                          <Plus className="w-5 h-5 text-slate-600" />
                        </button>
                        <span className="text-xs text-slate-500 w-12">{orderItem.unit}</span>
                      </div>

                      {/* Unit Cost */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">$</span>
                        <input
                          type="number"
                          value={orderItem.unit_cost}
                          onChange={e => updateCost(orderItem.inventory_item_id, parseFloat(e.target.value) || 0)}
                          className="w-20 py-1 px-2 border border-slate-200 rounded-lg text-sm text-right"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Subtotal */}
                      <div className="text-right w-24">
                        <p className="text-sm font-medium text-slate-900">
                          ${(orderItem.quantity_requested * orderItem.unit_cost).toFixed(2)}
                        </p>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeItem(orderItem.inventory_item_id)}
                        className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}

                  {/* Total */}
                  <div className="flex items-center justify-end gap-4 pt-3 border-t border-slate-200">
                    <span className="text-sm font-medium text-slate-600">Total estimado:</span>
                    <span className="text-lg font-bold text-slate-900">
                      ${orderTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {errors.items && (
                <p className="text-red-500 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.items}
                </p>
              )}
            </section>

            {/* === SECTION: Delivery === */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Truck className="w-4 h-4 text-blue-500" />
                Entrega
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1" />
                  Fecha esperada de entrega
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={e => setExpectedDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </section>

            {/* === SECTION: Notes === */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <FileText className="w-4 h-4 text-slate-400" />
                Notas
                <span className="text-xs text-slate-400 font-normal">(opcional)</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Notas internas
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={e => setInternalNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
                    placeholder="Solo visibles para tu equipo..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Notas para el proveedor
                  </label>
                  <textarea
                    value={supplierNotes}
                    onChange={e => setSupplierNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
                    placeholder="Incluidas en el mensaje..."
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-sm text-slate-500">
              {orderItems.length} artículo{orderItems.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-3">
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
                  'bg-gradient-to-r from-tis-coral to-orange-500',
                  'hover:shadow-lg hover:shadow-tis-coral/25 hover:-translate-y-0.5',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
                  'flex items-center gap-2'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Crear Orden
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Item Selector Modal */}
        {showItemSelector && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Agregar Artículo</h3>
                <button
                  onClick={() => {
                    setShowItemSelector(false);
                    setItemSearch('');
                  }}
                  className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center hover:bg-slate-100 rounded-lg active:scale-95 transition-all"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
                    placeholder="Buscar artículos..."
                    autoFocus
                  />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1">
                  {supplierItems.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No hay artículos disponibles</p>
                    </div>
                  ) : (
                    supplierItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addItem(item)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            Stock: {item.current_stock || 0} {item.unit || 'unidad'}
                            {item.minimum_stock && (
                              <span className={cn(
                                'ml-2',
                                (item.current_stock || 0) <= item.minimum_stock ? 'text-red-500' : ''
                              )}>
                                (Mín: {item.minimum_stock})
                              </span>
                            )}
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-tis-coral" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RestockOrderForm;
