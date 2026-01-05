'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Movement Form
// Premium modal for recording stock movements
// Apple/Lovable Design with TIS TIS Colors
// =====================================================

import { useState, useEffect } from 'react';
import {
  X,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trash2,
  Package,
  ArrowRightLeft,
  RotateCcw,
  ShoppingCart,
  ChevronDown,
  Search,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem, MovementFormData } from '../types';

// ======================
// CONSTANTS
// ======================

const MOVEMENT_TYPES = [
  {
    value: 'purchase',
    label: 'Compra',
    description: 'Recepción de mercancía',
    icon: ShoppingCart,
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    iconBg: 'bg-emerald-100',
    direction: 'in'
  },
  {
    value: 'consumption',
    label: 'Consumo',
    description: 'Uso en producción',
    icon: Package,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-100',
    direction: 'out'
  },
  {
    value: 'waste',
    label: 'Merma',
    description: 'Desperdicio o pérdida',
    icon: Trash2,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconBg: 'bg-red-100',
    direction: 'out'
  },
  {
    value: 'adjustment',
    label: 'Ajuste',
    description: 'Corrección de inventario',
    icon: AlertTriangle,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    iconBg: 'bg-amber-100',
    direction: 'both'
  },
  {
    value: 'transfer_in',
    label: 'Entrada',
    description: 'Transferencia recibida',
    icon: TrendingUp,
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    iconBg: 'bg-purple-100',
    direction: 'in'
  },
  {
    value: 'transfer_out',
    label: 'Salida',
    description: 'Transferencia enviada',
    icon: TrendingDown,
    color: 'violet',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    textColor: 'text-violet-700',
    iconBg: 'bg-violet-100',
    direction: 'out'
  },
  {
    value: 'return',
    label: 'Devolución',
    description: 'Retorno de producto',
    icon: RotateCcw,
    color: 'cyan',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    textColor: 'text-cyan-700',
    iconBg: 'bg-cyan-100',
    direction: 'in'
  },
];

// ======================
// TYPES
// ======================

interface MovementFormProps {
  items: InventoryItem[];
  preselectedItemId?: string;
  onSubmit: (data: MovementFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// ======================
// COMPONENT
// ======================

export function MovementForm({
  items,
  preselectedItemId,
  onSubmit,
  onCancel,
  isLoading = false,
}: MovementFormProps) {
  const [formData, setFormData] = useState<MovementFormData>({
    item_id: preselectedItemId || '',
    movement_type: 'consumption',
    quantity: 0,
    unit_cost: undefined,
    reason: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isVisible, setIsVisible] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Animation on mount
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const selectedItem = items.find(i => i.id === formData.item_id);
  const selectedType = MOVEMENT_TYPES.find(t => t.value === formData.movement_type);
  const isOutgoing = selectedType?.direction === 'out';

  // Filter items based on search
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(itemSearch.toLowerCase()))
  );

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.item_id) {
      newErrors.item_id = 'Selecciona un producto';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0';
    }

    if (isOutgoing && selectedItem && formData.quantity > selectedItem.current_stock) {
      newErrors.quantity = `Stock insuficiente. Disponible: ${selectedItem.current_stock} ${selectedItem.unit}`;
    }

    if (!formData.reason?.trim()) {
      newErrors.reason = 'Especifica un motivo';
    }

    if (formData.movement_type === 'purchase' && !formData.unit_cost) {
      newErrors.unit_cost = 'El costo es requerido para compras';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleItemSelect = (itemId: string) => {
    const item = items.find(i => i.id === itemId);

    setFormData(prev => ({
      ...prev,
      item_id: itemId,
      unit_cost: item?.unit_cost || prev.unit_cost,
    }));

    setShowItemDropdown(false);
    setItemSearch('');

    if (errors.item_id) {
      setErrors(prev => ({ ...prev, item_id: '' }));
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onCancel, 200);
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden transition-all duration-300",
          isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-tis-coral to-tis-coral/80 rounded-xl shadow-lg shadow-tis-coral/20">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Registrar Movimiento
              </h2>
              <p className="text-sm text-slate-500">Actualiza tu inventario</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-all duration-200 active:scale-95"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto">
            {/* Movement Type - Compact Grid */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Tipo de Movimiento
              </label>
              <div className="grid grid-cols-4 gap-2">
                {MOVEMENT_TYPES.slice(0, 4).map(type => {
                  const Icon = type.icon;
                  const isSelected = formData.movement_type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, movement_type: type.value as MovementFormData['movement_type'] }))}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all duration-200',
                        isSelected
                          ? `${type.borderColor} ${type.bgColor} shadow-sm`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg transition-colors',
                        isSelected ? type.iconBg : 'bg-slate-100'
                      )}>
                        <Icon className={cn('w-4 h-4', isSelected ? type.textColor : 'text-slate-500')} />
                      </div>
                      <span className={cn(
                        'text-xs font-medium',
                        isSelected ? type.textColor : 'text-slate-600'
                      )}>
                        {type.label}
                      </span>
                      {isSelected && (
                        <div className={cn('absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center', type.iconBg)}>
                          <Check className={cn('w-2.5 h-2.5', type.textColor)} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* More options row */}
              <div className="mt-2 grid grid-cols-3 gap-2">
                {MOVEMENT_TYPES.slice(4).map(type => {
                  const Icon = type.icon;
                  const isSelected = formData.movement_type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, movement_type: type.value as MovementFormData['movement_type'] }))}
                      className={cn(
                        'relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-200',
                        isSelected
                          ? `${type.borderColor} ${type.bgColor}`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', isSelected ? type.textColor : 'text-slate-500')} />
                      <span className={cn(
                        'text-xs font-medium',
                        isSelected ? type.textColor : 'text-slate-600'
                      )}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Item Selection - Custom Dropdown */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Producto *
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowItemDropdown(!showItemDropdown)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 border-2 rounded-xl transition-all duration-200',
                    errors.item_id
                      ? 'border-red-300 bg-red-50'
                      : showItemDropdown
                        ? 'border-tis-coral bg-tis-coral/5 shadow-lg shadow-tis-coral/10'
                        : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <span className={selectedItem ? 'text-slate-900' : 'text-slate-400'}>
                    {selectedItem ? selectedItem.name : 'Selecciona un producto'}
                  </span>
                  <ChevronDown className={cn(
                    'w-5 h-5 text-slate-400 transition-transform duration-200',
                    showItemDropdown && 'rotate-180'
                  )} />
                </button>

                {/* Dropdown */}
                {showItemDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-3 border-b border-slate-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          placeholder="Buscar producto..."
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-tis-coral focus:border-transparent"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="max-h-64 overflow-y-auto">
                      {filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                          No se encontraron productos
                        </div>
                      ) : (
                        filteredItems.map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemSelect(item.id)}
                            className={cn(
                              'w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors',
                              item.id === formData.item_id && 'bg-tis-coral/5'
                            )}
                          >
                            <div className="text-left">
                              <p className="font-medium text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-500">
                                {item.sku && `SKU: ${item.sku} • `}
                                {item.current_stock} {item.unit}
                              </p>
                            </div>
                            <div className={cn(
                              'px-2.5 py-1 rounded-full text-xs font-medium',
                              item.current_stock <= 0
                                ? 'bg-red-100 text-red-700'
                                : item.current_stock <= item.minimum_stock
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            )}>
                              {item.current_stock <= 0 ? 'Sin Stock' : item.current_stock <= item.minimum_stock ? 'Bajo' : 'OK'}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {errors.item_id && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.item_id}</p>}
            </div>

            {/* Selected Item Preview */}
            {selectedItem && (
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-slate-200">
                      <Package className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{selectedItem.name}</p>
                      <p className="text-sm text-slate-500">
                        Stock: <span className="font-semibold">{selectedItem.current_stock}</span> {selectedItem.unit}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold',
                    selectedItem.current_stock <= 0
                      ? 'bg-red-100 text-red-700'
                      : selectedItem.current_stock <= selectedItem.minimum_stock
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {selectedItem.current_stock <= 0
                      ? 'Sin Stock'
                      : selectedItem.current_stock <= selectedItem.minimum_stock
                        ? 'Stock Bajo'
                        : 'Stock OK'}
                  </div>
                </div>
              </div>
            )}

            {/* Quantity & Cost Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cantidad *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity || ''}
                    onChange={handleChange}
                    min="0.001"
                    step="0.001"
                    className={cn(
                      'w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:ring-0',
                      errors.quantity
                        ? 'border-red-300 bg-red-50 focus:border-red-500'
                        : 'border-slate-200 focus:border-tis-coral focus:bg-tis-coral/5'
                    )}
                    placeholder="0.00"
                  />
                  {selectedItem && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {selectedItem.unit}
                    </span>
                  )}
                </div>
                {errors.quantity && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.quantity}</p>}
              </div>

              {/* Unit Cost (for purchases) */}
              {formData.movement_type === 'purchase' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Costo Unitario *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">$</span>
                    <input
                      type="number"
                      name="unit_cost"
                      value={formData.unit_cost || ''}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={cn(
                        'w-full pl-8 pr-4 py-3 border-2 rounded-xl transition-all duration-200 focus:ring-0',
                        errors.unit_cost
                          ? 'border-red-300 bg-red-50 focus:border-red-500'
                          : 'border-slate-200 focus:border-tis-coral focus:bg-tis-coral/5'
                      )}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.unit_cost && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.unit_cost}</p>}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Motivo *
              </label>
              <input
                type="text"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className={cn(
                  'w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:ring-0',
                  errors.reason
                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                    : 'border-slate-200 focus:border-tis-coral focus:bg-tis-coral/5'
                )}
                placeholder={
                  formData.movement_type === 'consumption'
                    ? 'Ej: Preparación de orden #123'
                    : formData.movement_type === 'waste'
                      ? 'Ej: Producto caducado'
                      : formData.movement_type === 'purchase'
                        ? 'Ej: Factura #456 - Proveedor ABC'
                        : 'Motivo del movimiento'
                }
              />
              {errors.reason && <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.reason}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notas Adicionales
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-tis-coral focus:bg-tis-coral/5 focus:ring-0 transition-all duration-200 resize-none"
                placeholder="Notas opcionales"
              />
            </div>

            {/* Movement Summary */}
            {selectedItem && formData.quantity > 0 && (
              <div className={cn(
                'rounded-xl p-4 border-2 transition-all duration-300',
                isOutgoing
                  ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
                  : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  {isOutgoing ? (
                    <div className="p-1.5 bg-red-100 rounded-lg">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    </div>
                  ) : (
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                  <span className={cn('font-semibold text-sm', isOutgoing ? 'text-red-800' : 'text-emerald-800')}>
                    Resumen del Movimiento
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Cambio</span>
                    <span className={cn('font-bold', isOutgoing ? 'text-red-600' : 'text-emerald-600')}>
                      {isOutgoing ? '-' : '+'}{formData.quantity} {selectedItem.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Stock resultante</span>
                    <span className="font-bold text-slate-900">
                      {(selectedItem.current_stock + (isOutgoing ? -formData.quantity : formData.quantity)).toFixed(2)} {selectedItem.unit}
                    </span>
                  </div>
                  {formData.movement_type === 'purchase' && formData.unit_cost && formData.unit_cost > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-sm text-slate-600">Costo total</span>
                      <span className="font-bold text-slate-900">
                        ${(formData.quantity * formData.unit_cost).toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 text-slate-700 bg-white border-2 border-slate-200 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:scale-95"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={cn(
                'px-5 py-2.5 text-white rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-lg',
                isOutgoing
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/25'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25'
              )}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Registrando...
                </span>
              ) : (
                'Registrar Movimiento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MovementForm;
