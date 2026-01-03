'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Movement Form
// Form for recording stock movements
// =====================================================

import { useState } from 'react';
import { X, ArrowUpDown, TrendingUp, TrendingDown, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem, MovementFormData } from '../types';

// ======================
// CONSTANTS
// ======================

const MOVEMENT_TYPES = [
  { value: 'purchase', label: 'Compra/Recepción', icon: TrendingUp, color: 'text-green-600', direction: 'in' },
  { value: 'consumption', label: 'Consumo/Uso', icon: TrendingDown, color: 'text-blue-600', direction: 'out' },
  { value: 'waste', label: 'Merma/Desperdicio', icon: Trash2, color: 'text-red-600', direction: 'out' },
  { value: 'adjustment', label: 'Ajuste de Inventario', icon: AlertTriangle, color: 'text-amber-600', direction: 'both' },
  { value: 'transfer_in', label: 'Transferencia Entrante', icon: TrendingUp, color: 'text-purple-600', direction: 'in' },
  { value: 'transfer_out', label: 'Transferencia Saliente', icon: TrendingDown, color: 'text-purple-600', direction: 'out' },
  { value: 'return', label: 'Devolución', icon: TrendingUp, color: 'text-cyan-600', direction: 'in' },
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

  const selectedItem = items.find(i => i.id === formData.item_id);
  const selectedType = MOVEMENT_TYPES.find(t => t.value === formData.movement_type);
  const isOutgoing = selectedType?.direction === 'out';

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

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    const item = items.find(i => i.id === itemId);

    setFormData(prev => ({
      ...prev,
      item_id: itemId,
      unit_cost: item?.unit_cost || prev.unit_cost,
    }));

    if (errors.item_id) {
      setErrors(prev => ({ ...prev, item_id: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <ArrowUpDown className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Registrar Movimiento
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Movement Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Movimiento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MOVEMENT_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, movement_type: type.value as any }))}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left transition-all',
                        formData.movement_type === type.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', type.color)} />
                      <span className="text-sm font-medium text-gray-700">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Item Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Producto *
              </label>
              <select
                name="item_id"
                value={formData.item_id}
                onChange={handleItemChange}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                  errors.item_id ? 'border-red-500' : 'border-gray-300'
                )}
              >
                <option value="">Selecciona un producto</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.current_stock} {item.unit} disponibles)
                  </option>
                ))}
              </select>
              {errors.item_id && <p className="text-red-500 text-xs mt-1">{errors.item_id}</p>}
            </div>

            {/* Selected Item Info */}
            {selectedItem && (
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedItem.sku && `SKU: ${selectedItem.sku} • `}
                    Stock actual: {selectedItem.current_stock} {selectedItem.unit}
                  </p>
                </div>
                <div
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    selectedItem.current_stock <= 0
                      ? 'bg-red-100 text-red-700'
                      : selectedItem.current_stock <= selectedItem.minimum_stock
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                  )}
                >
                  {selectedItem.current_stock <= 0
                    ? 'Sin Stock'
                    : selectedItem.current_stock <= selectedItem.minimum_stock
                    ? 'Stock Bajo'
                    : 'Stock OK'}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                      errors.quantity ? 'border-red-500' : 'border-gray-300'
                    )}
                    placeholder="0.00"
                  />
                  {selectedItem && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {selectedItem.unit}
                    </span>
                  )}
                </div>
                {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
              </div>

              {/* Unit Cost (for purchases) */}
              {formData.movement_type === 'purchase' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo Unitario *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                    <input
                      type="number"
                      name="unit_cost"
                      value={formData.unit_cost || ''}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={cn(
                        'w-full pl-7 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                        errors.unit_cost ? 'border-red-500' : 'border-gray-300'
                      )}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.unit_cost && <p className="text-red-500 text-xs mt-1">{errors.unit_cost}</p>}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo *
              </label>
              <input
                type="text"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500',
                  errors.reason ? 'border-red-500' : 'border-gray-300'
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
              {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas Adicionales
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Notas opcionales"
              />
            </div>

            {/* Summary */}
            {selectedItem && formData.quantity > 0 && (
              <div className={cn(
                'rounded-lg p-4 border-2',
                isOutgoing ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {isOutgoing ? (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  )}
                  <span className={cn('font-medium', isOutgoing ? 'text-red-700' : 'text-green-700')}>
                    Resumen del Movimiento
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p className={isOutgoing ? 'text-red-600' : 'text-green-600'}>
                    {isOutgoing ? '-' : '+'}{formData.quantity} {selectedItem.unit} de {selectedItem.name}
                  </p>
                  <p className="text-gray-600">
                    Stock resultante: {(selectedItem.current_stock + (isOutgoing ? -formData.quantity : formData.quantity)).toFixed(3)} {selectedItem.unit}
                  </p>
                  {formData.movement_type === 'purchase' && formData.unit_cost && (
                    <p className="text-gray-600">
                      Costo total: ${(formData.quantity * formData.unit_cost).toFixed(2)} MXN
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={cn(
                'px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50',
                isOutgoing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
              )}
              disabled={isLoading}
            >
              {isLoading ? 'Registrando...' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MovementForm;
