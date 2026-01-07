'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Item Form
// Form for creating and editing inventory items
// =====================================================

import { useState } from 'react';
import { X, Package, DollarSign, Warehouse, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem, ItemFormData, InventoryCategory, InventorySupplier } from '../types';

// ======================
// CONSTANTS
// ======================

const ITEM_TYPES = [
  { value: 'ingredient', label: 'Ingrediente' },
  { value: 'supply', label: 'Suministro' },
  { value: 'equipment', label: 'Equipo' },
  { value: 'packaging', label: 'Empaque' },
];

const STORAGE_TYPES = [
  { value: 'dry', label: 'Almacén Seco' },
  { value: 'refrigerated', label: 'Refrigerado' },
  { value: 'frozen', label: 'Congelado' },
  { value: 'ambient', label: 'Temperatura Ambiente' },
];

const UNITS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'l', label: 'Litros (l)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unit', label: 'Unidades' },
  { value: 'box', label: 'Cajas' },
  { value: 'bag', label: 'Bolsas' },
  { value: 'piece', label: 'Piezas' },
];

const ALLERGENS = [
  'Gluten', 'Lácteos', 'Huevo', 'Pescado', 'Mariscos',
  'Nueces', 'Cacahuate', 'Soya', 'Apio', 'Mostaza',
  'Sésamo', 'Sulfitos', 'Moluscos', 'Altramuces',
];

// ======================
// TYPES
// ======================

interface ItemFormProps {
  item?: InventoryItem;
  categories: InventoryCategory[];
  suppliers: InventorySupplier[];
  onSubmit: (data: ItemFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// ======================
// COMPONENT
// ======================

export function ItemForm({
  item,
  categories,
  suppliers,
  onSubmit,
  onCancel,
  isLoading = false,
}: ItemFormProps) {
  const isEditing = !!item;

  const [formData, setFormData] = useState<ItemFormData>({
    name: item?.name || '',
    sku: item?.sku || '',
    description: item?.description || '',
    category_id: item?.category_id || '',
    item_type: item?.item_type || 'ingredient',
    unit: item?.unit || 'kg',
    unit_cost: item?.unit_cost || 0,
    minimum_stock: item?.minimum_stock || 0,
    maximum_stock: item?.maximum_stock || undefined,
    reorder_quantity: item?.reorder_quantity || undefined,
    storage_location: item?.storage_location || '',
    storage_type: item?.storage_type || 'dry',
    is_perishable: item?.is_perishable ?? true,
    default_shelf_life_days: item?.default_shelf_life_days || undefined,
    track_expiration: item?.track_expiration ?? true,
    preferred_supplier_id: item?.preferred_supplier_id || '',
    image_url: item?.image_url || '',
    allergens: item?.allergens || [],
    is_active: item?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.unit) {
      newErrors.unit = 'La unidad es requerida';
    }

    if ((formData.unit_cost ?? 0) < 0) {
      newErrors.unit_cost = 'El costo no puede ser negativo';
    }

    if ((formData.minimum_stock ?? 0) < 0) {
      newErrors.minimum_stock = 'El stock mínimo no puede ser negativo';
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
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle focus on numeric inputs - select all text for easy replacement
  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const toggleAllergen = (allergen: string) => {
    setFormData(prev => {
      const currentAllergens = prev.allergens || [];
      return {
        ...prev,
        allergens: currentAllergens.includes(allergen)
          ? currentAllergens.filter(a => a !== allergen)
          : [...currentAllergens, allergen],
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Editar Item' : 'Nuevo Item'}
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
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Información Básica
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    )}
                    placeholder="Ej: Tomate Roma"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: TOM-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    name="item_type"
                    value={formData.item_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {ITEM_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad *</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
                      errors.unit ? 'border-red-500' : 'border-gray-300'
                    )}
                  >
                    {UNITS.map(unit => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Descripción opcional del producto"
                  />
                </div>
              </div>
            </div>

            {/* Cost and Stock */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Costo y Stock
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo Unitario (MXN)
                  </label>
                  <input
                    type="number"
                    name="unit_cost"
                    value={formData.unit_cost}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    min="0"
                    step="0.01"
                    className={cn(
                      'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
                      errors.unit_cost ? 'border-red-500' : 'border-gray-300'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    name="minimum_stock"
                    value={formData.minimum_stock}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Máximo
                  </label>
                  <input
                    type="number"
                    name="maximum_stock"
                    value={formData.maximum_stock || ''}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad a Reordenar
                  </label>
                  <input
                    type="number"
                    name="reorder_quantity"
                    value={formData.reorder_quantity || ''}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Storage */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Warehouse className="w-4 h-4" />
                Almacenamiento
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Almacenamiento
                  </label>
                  <select
                    name="storage_type"
                    value={formData.storage_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {STORAGE_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    name="storage_location"
                    value={formData.storage_location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Estante A-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor Preferido
                  </label>
                  <select
                    name="preferred_supplier_id"
                    value={formData.preferred_supplier_id}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin proveedor</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vida Útil (días)
                  </label>
                  <input
                    type="number"
                    name="default_shelf_life_days"
                    value={formData.default_shelf_life_days || ''}
                    onChange={handleChange}
                    onFocus={handleNumericFocus}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_perishable"
                    checked={formData.is_perishable}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Es perecedero</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="track_expiration"
                    checked={formData.track_expiration}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Rastrear caducidad</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
              </div>
            </div>

            {/* Allergens */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Alérgenos
              </h3>

              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map(allergen => (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => toggleAllergen(allergen)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                      (formData.allergens || []).includes(allergen)
                        ? 'bg-amber-100 text-amber-800 border-2 border-amber-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {allergen}
                  </button>
                ))}
              </div>
            </div>
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
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ItemForm;
