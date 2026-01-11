'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, UtensilsCrossed, Plus, Trash2, DollarSign, Clock, Flame, AlertTriangle, ChefHat } from 'lucide-react';
import type { MenuItem, MenuCategory, MenuItemFormData, Allergen, MenuItemVariant, MenuItemSize, MenuItemAddOn } from '../types';
import { ALLERGEN_CONFIG, SPICE_LEVELS } from '../types';
import { RecipeEditor, type RecipeEditorRef } from './RecipeEditor';

// ======================
// TYPES
// ======================

interface MenuItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MenuItemFormData) => Promise<void>;
  item?: MenuItem | null;
  categories: MenuCategory[];
  branchId: string;
  isLoading?: boolean;
}

// ======================
// FORM COMPONENTS
// ======================

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors
          ${checked ? 'bg-tis-coral' : 'bg-slate-200'}
        `}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

function AllergenSelector({
  selected,
  onChange,
}: {
  selected: Allergen[];
  onChange: (allergens: Allergen[]) => void;
}) {
  const toggleAllergen = (allergen: Allergen) => {
    if (selected.includes(allergen)) {
      onChange(selected.filter(a => a !== allergen));
    } else {
      onChange([...selected, allergen]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Alérgenos
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ALLERGEN_CONFIG).map(([key, config]) => {
          const allergen = key as Allergen;
          const isSelected = selected.includes(allergen);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleAllergen(allergen)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5
                ${isSelected
                  ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpiceLevelSelector({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (level: number | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        <span className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Nivel de picante
        </span>
      </label>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors
            ${value === null || value === undefined
              ? 'bg-slate-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
          `}
        >
          N/A
        </button>
        {SPICE_LEVELS.map(level => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors
              ${value === level.value
                ? `${level.color} text-white`
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function VariantsEditor({
  variants,
  onChange,
}: {
  variants: MenuItemVariant[];
  onChange: (variants: MenuItemVariant[]) => void;
}) {
  const addVariant = () => {
    onChange([...variants, { name: '', price: 0, is_default: variants.length === 0 }]);
  };

  const updateVariant = (index: number, field: keyof MenuItemVariant, value: string | number | boolean) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'is_default' && value) {
      updated.forEach((v, i) => { if (i !== index) v.is_default = false; });
    }
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Variantes</label>
        <button
          type="button"
          onClick={addVariant}
          className="text-xs text-tis-coral hover:text-tis-coral/80 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {variants.length === 0 ? (
        <p className="text-xs text-slate-500">Sin variantes (ej: tamaño, tipo de carne)</p>
      ) : (
        <div className="space-y-2">
          {variants.map((variant, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <input
                type="text"
                value={variant.name}
                onChange={(e) => updateVariant(index, 'name', e.target.value)}
                placeholder="Nombre"
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
              />
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  value={variant.price}
                  onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={variant.is_default || false}
                  onChange={(e) => updateVariant(index, 'is_default', e.target.checked)}
                  className="rounded border-slate-300"
                />
                Default
              </label>
              <button type="button" onClick={() => removeVariant(index)} className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-95 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SizesEditor({
  sizes,
  onChange,
}: {
  sizes: MenuItemSize[];
  onChange: (sizes: MenuItemSize[]) => void;
}) {
  const addSize = () => {
    onChange([...sizes, { name: '', price: 0 }]);
  };

  const updateSize = (index: number, field: keyof MenuItemSize, value: string | number) => {
    const updated = [...sizes];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeSize = (index: number) => {
    onChange(sizes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Tamaños</label>
        <button type="button" onClick={addSize} className="text-xs text-tis-coral hover:text-tis-coral/80 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {sizes.length === 0 ? (
        <p className="text-xs text-slate-500">Sin tamaños (usa precio único)</p>
      ) : (
        <div className="space-y-2">
          {sizes.map((size, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <input
                type="text"
                value={size.name}
                onChange={(e) => updateSize(index, 'name', e.target.value)}
                placeholder="Nombre (Chico, Grande)"
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
              />
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  value={size.price}
                  onChange={(e) => updateSize(index, 'price', parseFloat(e.target.value) || 0)}
                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <button type="button" onClick={() => removeSize(index)} className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-95 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddOnsEditor({
  addOns,
  onChange,
}: {
  addOns: MenuItemAddOn[];
  onChange: (addOns: MenuItemAddOn[]) => void;
}) {
  const addAddOn = () => {
    onChange([...addOns, { name: '', price: 0 }]);
  };

  const updateAddOn = (index: number, field: keyof MenuItemAddOn, value: string | number) => {
    const updated = [...addOns];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeAddOn = (index: number) => {
    onChange(addOns.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Extras / Add-ons</label>
        <button type="button" onClick={addAddOn} className="text-xs text-tis-coral hover:text-tis-coral/80 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {addOns.length === 0 ? (
        <p className="text-xs text-slate-500">Sin extras disponibles</p>
      ) : (
        <div className="space-y-2">
          {addOns.map((addOn, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <input
                type="text"
                value={addOn.name}
                onChange={(e) => updateAddOn(index, 'name', e.target.value)}
                placeholder="Nombre (Extra queso)"
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded"
              />
              <div className="relative w-20">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  value={addOn.price}
                  onChange={(e) => updateAddOn(index, 'price', parseFloat(e.target.value) || 0)}
                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-slate-200 rounded"
                />
              </div>
              <button type="button" onClick={() => removeAddOn(index)} className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-95 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function MenuItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  item,
  categories,
  branchId,
  isLoading = false,
}: MenuItemFormModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'variants' | 'recipe'>('basic');
  const [recipeCost, setRecipeCost] = useState<number>(0);

  // Ref to RecipeEditor to call saveRecipe before closing
  const recipeEditorRef = useRef<RecipeEditorRef>(null);

  // Callback for recipe cost updates
  const handleRecipeCostCalculated = useCallback((cost: number) => {
    setRecipeCost(cost);
  }, []);
  const [formData, setFormData] = useState<MenuItemFormData>({
    category_id: '',
    name: '',
    price: 0,
    is_available: true,
    is_featured: false,
    allergens: [],
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    variants: [],
    sizes: [],
    add_ons: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!item;

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          category_id: item.category_id,
          name: item.name,
          description: item.description || undefined,
          price: item.price,
          prep_time_minutes: item.prep_time_minutes || undefined,
          calories: item.calories || undefined,
          allergens: item.allergens || [],
          is_vegetarian: item.is_vegetarian,
          is_vegan: item.is_vegan,
          is_gluten_free: item.is_gluten_free,
          is_spicy: item.is_spicy,
          spice_level: item.spice_level,
          is_available: item.is_available,
          is_featured: item.is_featured,
          image_url: item.image_url || undefined,
          variants: item.variants || [],
          sizes: item.sizes || [],
          add_ons: item.add_ons || [],
        });
      } else {
        setFormData({
          category_id: categories.length > 0 ? categories[0].id : '',
          name: '',
          price: 0,
          is_available: true,
          is_featured: false,
          allergens: [],
          is_vegetarian: false,
          is_vegan: false,
          is_gluten_free: false,
          is_spicy: false,
          variants: [],
          sizes: [],
          add_ons: [],
        });
      }
      setErrors({});
      setActiveTab('basic');
    }
  }, [isOpen, item, categories]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | number | undefined = value;
    if (type === 'number') {
      parsedValue = value === '' ? undefined : parseFloat(value);
    }
    setFormData(prev => ({ ...prev, [name]: parsedValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.category_id) newErrors.category_id = 'La categoría es requerida';
    if (formData.price < 0) newErrors.price = 'El precio debe ser mayor o igual a 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[MenuItemFormModal.handleSubmit] Starting submit, item?.id:', item?.id);

    if (!validateForm()) {
      console.log('[MenuItemFormModal.handleSubmit] Form validation failed');
      setActiveTab('basic');
      return;
    }

    // IMPORTANT: Save recipe BEFORE submitting the form
    // Because onSubmit will close the modal and unmount RecipeEditor
    // We need to save any pending recipe changes first
    if (recipeEditorRef.current && item?.id) {
      console.log('[MenuItemFormModal.handleSubmit] Saving recipe first...');
      // Only save if we're editing an existing item (has ID)
      const recipeSaved = await recipeEditorRef.current.saveRecipe();
      console.log('[MenuItemFormModal.handleSubmit] Recipe save result:', recipeSaved);

      // If recipe save failed, don't continue with form submit
      // This prevents data loss - user can retry
      if (!recipeSaved) {
        console.error('[MenuItemFormModal.handleSubmit] Recipe save failed, aborting form submit');
        return;
      }
    } else {
      console.log('[MenuItemFormModal.handleSubmit] No recipe to save (no ref or no item.id)');
    }

    // Now save the menu item (this may close the modal)
    console.log('[MenuItemFormModal.handleSubmit] Saving menu item...');
    await onSubmit(formData);
    console.log('[MenuItemFormModal.handleSubmit] Menu item saved');
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'basic', label: 'Básico' },
    { id: 'details', label: 'Detalles' },
    { id: 'variants', label: 'Variantes' },
    { id: 'recipe', label: 'Receta', icon: ChefHat },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-tis-coral/10 rounded-xl flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-tis-coral" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {isEditing ? 'Editar Platillo' : 'Nuevo Platillo'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isEditing ? 'Modifica los datos del platillo' : 'Agrega un nuevo platillo al menú'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg active:scale-95 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-4 border-b border-slate-100">
            <div className="flex gap-1">
              {tabs.map(tab => {
                const Icon = 'icon' in tab ? tab.icon : null;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5
                      ${activeTab === tab.id
                        ? 'bg-white text-tis-coral border-b-2 border-tis-coral -mb-px'
                        : 'text-slate-500 hover:text-slate-700'
                      }
                    `}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 max-h-[60vh] overflow-y-auto">
            {activeTab === 'basic' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Ej: Tacos al Pastor"
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral
                        ${errors.name ? 'border-red-300' : 'border-slate-200'}`}
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Categoría <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral
                        ${errors.category_id ? 'border-red-300' : 'border-slate-200'}`}
                    >
                      <option value="">Seleccionar...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.parent_id ? `  └ ${cat.name}` : cat.name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id && <p className="mt-1 text-xs text-red-500">{errors.category_id}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                  <textarea
                    name="description"
                    value={formData.description || ''}
                    onChange={handleChange}
                    placeholder="Describe el platillo..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20 resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo prep.</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        name="prep_time_minutes"
                        value={formData.prep_time_minutes || ''}
                        onChange={handleChange}
                        placeholder="min"
                        className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Calorías</label>
                    <input
                      type="number"
                      name="calories"
                      value={formData.calories || ''}
                      onChange={handleChange}
                      placeholder="kcal"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL de imagen</label>
                  <input
                    type="url"
                    name="image_url"
                    value={formData.image_url || ''}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <ToggleSwitch
                    label="Disponible"
                    checked={formData.is_available ?? true}
                    onChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
                  />
                  <ToggleSwitch
                    label="Destacado"
                    checked={formData.is_featured ?? false}
                    onChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                  />
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-4">
                  <ToggleSwitch
                    label="Vegetariano"
                    checked={formData.is_vegetarian ?? false}
                    onChange={(checked) => setFormData(prev => ({ ...prev, is_vegetarian: checked }))}
                  />
                  <ToggleSwitch
                    label="Vegano"
                    checked={formData.is_vegan ?? false}
                    onChange={(checked) => setFormData(prev => ({ ...prev, is_vegan: checked }))}
                  />
                  <ToggleSwitch
                    label="Sin gluten"
                    checked={formData.is_gluten_free ?? false}
                    onChange={(checked) => setFormData(prev => ({ ...prev, is_gluten_free: checked }))}
                  />
                  <ToggleSwitch
                    label="Picante"
                    checked={formData.is_spicy ?? false}
                    onChange={(checked) => setFormData(prev => ({ ...prev, is_spicy: checked }))}
                  />
                </div>

                {formData.is_spicy && (
                  <SpiceLevelSelector
                    value={formData.spice_level}
                    onChange={(level) => setFormData(prev => ({ ...prev, spice_level: level }))}
                  />
                )}

                <AllergenSelector
                  selected={formData.allergens ?? []}
                  onChange={(allergens) => setFormData(prev => ({ ...prev, allergens }))}
                />
              </div>
            )}

            {activeTab === 'variants' && (
              <div className="space-y-6">
                <VariantsEditor
                  variants={formData.variants ?? []}
                  onChange={(variants) => setFormData(prev => ({ ...prev, variants }))}
                />
                <hr className="border-slate-200" />
                <SizesEditor
                  sizes={formData.sizes ?? []}
                  onChange={(sizes) => setFormData(prev => ({ ...prev, sizes }))}
                />
                <hr className="border-slate-200" />
                <AddOnsEditor
                  addOns={formData.add_ons ?? []}
                  onChange={(add_ons) => setFormData(prev => ({ ...prev, add_ons }))}
                />
              </div>
            )}

            {/* Recipe Tab - ALWAYS MOUNTED but hidden when not active
                This ensures the RecipeEditor state is preserved when switching tabs
                and the ref is always available for saving */}
            <div className={activeTab === 'recipe' ? 'block' : 'hidden'}>
              <div className="space-y-5">
                {/* Recipe Cost vs Price Info */}
                {item && recipeCost > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Precio de venta</p>
                      <p className="text-lg font-semibold text-slate-800">${formData.price.toFixed(2)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Costo de producción</p>
                      <p className="text-lg font-semibold text-tis-coral">${recipeCost.toFixed(2)}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Margen</p>
                      <p className={`text-lg font-semibold ${
                        formData.price > recipeCost ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formData.price > 0
                          ? `${(((formData.price - recipeCost) / formData.price) * 100).toFixed(1)}%`
                          : '0%'}
                      </p>
                    </div>
                  </div>
                )}

                <RecipeEditor
                  ref={recipeEditorRef}
                  menuItemId={item?.id || null}
                  branchId={branchId}
                  onCostCalculated={handleRecipeCostCalculated}
                />
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-tis-coral hover:bg-tis-coral/90 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Guardar cambios' : 'Crear platillo'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MenuItemFormModal;
