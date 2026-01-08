'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Item Form
// Professional Apple/TIS TIS style design
// Form for creating and editing inventory items
// =====================================================

import { useState, useEffect } from 'react';
import { X, Package, DollarSign, Warehouse, AlertTriangle, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryItem, ItemFormData, InventoryCategory, InventorySupplier } from '../types';

// ======================
// CONSTANTS
// ======================

const ITEM_TYPES = [
  { value: 'ingredient', label: 'Ingrediente', icon: '🥬' },
  { value: 'supply', label: 'Suministro', icon: '📦' },
  { value: 'equipment', label: 'Equipo', icon: '🔧' },
  { value: 'packaging', label: 'Empaque', icon: '🎁' },
];

const STORAGE_TYPES = [
  { value: 'dry', label: 'Almacén Seco', icon: '📦' },
  { value: 'refrigerated', label: 'Refrigerado', icon: '❄️' },
  { value: 'frozen', label: 'Congelado', icon: '🧊' },
  { value: 'ambient', label: 'Temperatura Ambiente', icon: '🌡️' },
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
  { key: 'gluten', label: 'Gluten', icon: '🌾' },
  { key: 'lacteos', label: 'Lácteos', icon: '🥛' },
  { key: 'huevo', label: 'Huevo', icon: '🥚' },
  { key: 'pescado', label: 'Pescado', icon: '🐟' },
  { key: 'mariscos', label: 'Mariscos', icon: '🦐' },
  { key: 'nueces', label: 'Nueces', icon: '🥜' },
  { key: 'cacahuate', label: 'Cacahuate', icon: '🥜' },
  { key: 'soya', label: 'Soya', icon: '🫘' },
  { key: 'apio', label: 'Apio', icon: '🥬' },
  { key: 'mostaza', label: 'Mostaza', icon: '🟡' },
  { key: 'sesamo', label: 'Sésamo', icon: '⚪' },
  { key: 'sulfitos', label: 'Sulfitos', icon: '🍷' },
];

// ======================
// TABS CONFIGURATION
// ======================

type TabId = 'basic' | 'stock' | 'storage' | 'allergens';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'basic', label: 'Básico', icon: Package },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'storage', label: 'Almacén', icon: Warehouse },
  { id: 'allergens', label: 'Alérgenos', icon: AlertTriangle },
];

// ======================
// REUSABLE COMPONENTS
// ======================

function ToggleSwitch({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-0.5',
          checked ? 'bg-tis-coral' : 'bg-slate-200 group-hover:bg-slate-300'
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function FormInput({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onFocus,
  placeholder,
  error,
  required,
  min,
  step,
  prefix,
  suffix,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  min?: string;
  step?: string;
  prefix?: React.ReactNode;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {prefix && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {prefix}
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          placeholder={placeholder}
          min={min}
          step={step}
          className={cn(
            'w-full px-3 py-2.5 border rounded-xl text-sm transition-all',
            'focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral',
            prefix && 'pl-10',
            suffix && 'pr-12',
            error ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  error,
  required,
  className,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string; icon?: string }[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={cn(
          'w-full px-3 py-2.5 border rounded-xl text-sm transition-all appearance-none bg-white',
          'focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral',
          error ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.icon ? `${opt.icon} ${opt.label}` : opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

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
// MAIN COMPONENT
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
  const [activeTab, setActiveTab] = useState<TabId>('basic');

  // Use display values for numeric inputs to handle empty state properly
  const [displayValues, setDisplayValues] = useState({
    unit_cost: item?.unit_cost?.toString() || '',
    minimum_stock: item?.minimum_stock?.toString() || '',
    maximum_stock: item?.maximum_stock?.toString() || '',
    reorder_quantity: item?.reorder_quantity?.toString() || '',
    default_shelf_life_days: item?.default_shelf_life_days?.toString() || '',
  });

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

  // Sync display values when item changes
  useEffect(() => {
    if (item) {
      setDisplayValues({
        unit_cost: item.unit_cost?.toString() || '',
        minimum_stock: item.minimum_stock?.toString() || '',
        maximum_stock: item.maximum_stock?.toString() || '',
        reorder_quantity: item.reorder_quantity?.toString() || '',
        default_shelf_life_days: item.default_shelf_life_days?.toString() || '',
      });
    }
  }, [item]);

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

    // Switch to the tab with errors
    if (newErrors.name || newErrors.unit) {
      setActiveTab('basic');
    } else if (newErrors.unit_cost || newErrors.minimum_stock) {
      setActiveTab('stock');
    }

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
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle numeric input changes with proper display value management
  const handleNumericChange = (name: keyof typeof displayValues) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;

    // Update display value (allow empty)
    setDisplayValues(prev => ({ ...prev, [name]: value }));

    // Update form data (convert to number or undefined)
    const numValue = value === '' ? (name === 'unit_cost' || name === 'minimum_stock' ? 0 : undefined) : parseFloat(value);
    setFormData(prev => ({ ...prev, [name]: numValue }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Handle focus - select all for easy replacement
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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div className="space-y-5">
            {/* Name - Full width */}
            <FormInput
              label="Nombre del producto"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Tomate Roma"
              error={errors.name}
              required
            />

            {/* SKU and Category */}
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="SKU / Código"
                name="sku"
                value={formData.sku || ''}
                onChange={handleChange}
                placeholder="Ej: TOM-001"
              />
              <FormSelect
                label="Categoría"
                name="category_id"
                value={formData.category_id || ''}
                onChange={handleChange}
                placeholder="Sin categoría"
                options={categories.map(c => ({ value: c.id, label: c.name }))}
              />
            </div>

            {/* Type and Unit */}
            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Tipo de producto"
                name="item_type"
                value={formData.item_type || 'ingredient'}
                onChange={handleChange}
                options={ITEM_TYPES}
              />
              <FormSelect
                label="Unidad de medida"
                name="unit"
                value={formData.unit || 'kg'}
                onChange={handleChange}
                options={UNITS}
                error={errors.unit}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Descripción opcional del producto..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm transition-all resize-none
                  focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral
                  hover:border-slate-300"
              />
            </div>

            {/* Image URL */}
            <FormInput
              label="URL de imagen"
              name="image_url"
              type="url"
              value={formData.image_url || ''}
              onChange={handleChange}
              placeholder="https://..."
            />

            {/* Active toggle */}
            <div className="pt-2">
              <ToggleSwitch
                label="Producto activo"
                description="Los productos inactivos no aparecerán en recetas ni reportes"
                checked={formData.is_active ?? true}
                onChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>
        );

      case 'stock':
        return (
          <div className="space-y-5">
            {/* Cost */}
            <FormInput
              label="Costo unitario"
              name="unit_cost"
              type="number"
              value={displayValues.unit_cost}
              onChange={handleNumericChange('unit_cost')}
              onFocus={handleNumericFocus}
              placeholder="0.00"
              prefix={<DollarSign className="w-4 h-4" />}
              suffix="MXN"
              error={errors.unit_cost}
            />

            {/* Min/Max Stock */}
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Stock mínimo"
                name="minimum_stock"
                type="number"
                value={displayValues.minimum_stock}
                onChange={handleNumericChange('minimum_stock')}
                onFocus={handleNumericFocus}
                placeholder="0"
                suffix={formData.unit}
                error={errors.minimum_stock}
              />
              <FormInput
                label="Stock máximo"
                name="maximum_stock"
                type="number"
                value={displayValues.maximum_stock}
                onChange={handleNumericChange('maximum_stock')}
                onFocus={handleNumericFocus}
                placeholder="Opcional"
                suffix={formData.unit}
              />
            </div>

            {/* Reorder quantity */}
            <FormInput
              label="Cantidad a reordenar"
              name="reorder_quantity"
              type="number"
              value={displayValues.reorder_quantity}
              onChange={handleNumericChange('reorder_quantity')}
              onFocus={handleNumericFocus}
              placeholder="Cantidad sugerida al reabastecer"
              suffix={formData.unit}
            />

            {/* Info card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Alertas de stock</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recibirás una alerta cuando el stock baje del mínimo configurado.
                    La cantidad a reordenar es una sugerencia para el reabastecimiento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'storage':
        return (
          <div className="space-y-5">
            {/* Storage Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Tipo de almacenamiento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STORAGE_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, storage_type: type.value as ItemFormData['storage_type'] }))}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                      formData.storage_type === type.value
                        ? 'border-tis-coral bg-tis-coral/5 ring-1 ring-tis-coral'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-xl">{type.icon}</span>
                    <span className={cn(
                      'text-sm font-medium',
                      formData.storage_type === type.value ? 'text-tis-coral' : 'text-slate-700'
                    )}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <FormInput
              label="Ubicación física"
              name="storage_location"
              value={formData.storage_location || ''}
              onChange={handleChange}
              placeholder="Ej: Estante A-3, Refrigerador 2"
            />

            {/* Supplier */}
            <FormSelect
              label="Proveedor preferido"
              name="preferred_supplier_id"
              value={formData.preferred_supplier_id || ''}
              onChange={handleChange}
              placeholder="Seleccionar proveedor"
              options={suppliers.map(s => ({ value: s.id, label: s.name }))}
            />

            {/* Shelf life */}
            <FormInput
              label="Vida útil predeterminada"
              name="default_shelf_life_days"
              type="number"
              value={displayValues.default_shelf_life_days}
              onChange={handleNumericChange('default_shelf_life_days')}
              onFocus={handleNumericFocus}
              placeholder="Días de vida útil"
              suffix="días"
            />

            {/* Toggles */}
            <div className="space-y-4 pt-2">
              <ToggleSwitch
                label="Es perecedero"
                description="Marca si el producto tiene fecha de caducidad"
                checked={formData.is_perishable ?? true}
                onChange={(checked) => setFormData(prev => ({ ...prev, is_perishable: checked }))}
              />
              <ToggleSwitch
                label="Rastrear caducidad"
                description="Registrar fecha de expiración por lote"
                checked={formData.track_expiration ?? true}
                onChange={(checked) => setFormData(prev => ({ ...prev, track_expiration: checked }))}
              />
            </div>
          </div>
        );

      case 'allergens':
        return (
          <div className="space-y-5">
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Información de alérgenos</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Selecciona los alérgenos presentes en este producto. Esta información
                    es importante para la seguridad alimentaria.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Alérgenos presentes
              </label>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map(allergen => {
                  const isSelected = (formData.allergens || []).includes(allergen.key);
                  return (
                    <button
                      key={allergen.key}
                      type="button"
                      onClick={() => toggleAllergen(allergen.key)}
                      className={cn(
                        'px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                        isSelected
                          ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      <span>{allergen.icon}</span>
                      <span>{allergen.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected allergens summary */}
            {(formData.allergens?.length ?? 0) > 0 && (
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">Alérgenos seleccionados:</p>
                <p className="text-sm font-medium text-slate-700">
                  {formData.allergens?.map(a => {
                    const config = ALLERGENS.find(al => al.key === a);
                    return config ? `${config.icon} ${config.label}` : a;
                  }).join(', ')}
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onCancel} />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-tis-coral/10 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-tis-coral" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isEditing ? 'Modifica los datos del producto' : 'Agrega un nuevo producto al inventario'}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4 border-b border-slate-100">
            <div className="flex gap-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2',
                      activeTab === tab.id
                        ? 'bg-white text-tis-coral border-b-2 border-tis-coral -mb-px'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {renderTabContent()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 text-sm font-medium text-white bg-tis-coral hover:bg-tis-coral/90 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>{isEditing ? 'Guardar cambios' : 'Crear producto'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ItemForm;
