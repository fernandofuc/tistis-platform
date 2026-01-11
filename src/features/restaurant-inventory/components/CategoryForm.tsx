'use client';

// =====================================================
// TIS TIS PLATFORM - Inventory Category Form
// Form for creating and editing categories
// Professional Apple/TIS TIS Style Design
// =====================================================

import { useState, useMemo } from 'react';
import { X, Folder, Palette, Check, Layers, Tag, Hash, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryCategory, CategoryFormData } from '../types';

// ======================
// CONSTANTS
// ======================

const PRESET_COLORS = [
  // Row 1: Warm colors
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  // Row 2: Cool colors
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  // Row 3: Purples & Pinks
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  // Row 4: Neutral & Special
  '#EC4899', '#F43F5E', '#64748B', '#475569', '#1E293B',
];

const ICON_OPTIONS = [
  { value: 'Package', label: 'Paquete', emoji: '📦' },
  { value: 'Droplet', label: 'Líquidos', emoji: '💧' },
  { value: 'Leaf', label: 'Vegetales', emoji: '🥬' },
  { value: 'Beef', label: 'Carnes', emoji: '🥩' },
  { value: 'Fish', label: 'Pescados', emoji: '🐟' },
  { value: 'Egg', label: 'Huevos', emoji: '🥚' },
  { value: 'Milk', label: 'Lácteos', emoji: '🥛' },
  { value: 'Apple', label: 'Frutas', emoji: '🍎' },
  { value: 'Carrot', label: 'Verduras', emoji: '🥕' },
  { value: 'Cookie', label: 'Postres', emoji: '🍪' },
  { value: 'Coffee', label: 'Bebidas', emoji: '☕' },
  { value: 'Wine', label: 'Vinos', emoji: '🍷' },
  { value: 'Utensils', label: 'Utensilios', emoji: '🍴' },
  { value: 'Snowflake', label: 'Congelados', emoji: '❄️' },
  { value: 'Flame', label: 'Especias', emoji: '🔥' },
  { value: 'Box', label: 'Empaques', emoji: '📦' },
  { value: 'ShoppingBag', label: 'Insumos', emoji: '🛍️' },
  { value: 'Archive', label: 'Almacén', emoji: '🗄️' },
  { value: 'Layers', label: 'General', emoji: '📚' },
  { value: 'Grid', label: 'Otros', emoji: '🔲' },
];

// ======================
// TYPES
// ======================

interface CategoryFormProps {
  category?: InventoryCategory;
  parentCategories?: InventoryCategory[];
  onSubmit: (data: CategoryFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// ======================
// ICON SELECTOR
// ======================

interface IconSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function IconSelector({ value, onChange }: IconSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ICON_OPTIONS.map((icon) => (
        <button
          key={icon.value}
          type="button"
          onClick={() => onChange(icon.value)}
          className={cn(
            'flex flex-col items-center justify-center p-2.5 rounded-xl transition-all text-center',
            value === icon.value
              ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
          )}
          title={icon.label}
        >
          <span className="text-lg mb-0.5">{icon.emoji}</span>
          <span className="text-[10px] font-medium truncate w-full">{icon.label}</span>
        </button>
      ))}
    </div>
  );
}

// ======================
// COLOR SELECTOR
// ======================

interface ColorSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

function ColorSelector({ value, onChange }: ColorSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-10 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-8 h-8 rounded-lg transition-all hover:scale-110',
              value === color && 'ring-2 ring-offset-2 ring-slate-400 scale-110'
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <label className="text-xs text-slate-500">Color personalizado:</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 focus:ring-2 focus:ring-slate-900/20 focus:border-slate-300"
            placeholder="#3B82F6"
          />
        </div>
      </div>
    </div>
  );
}

// ======================
// PREVIEW CARD
// ======================

interface PreviewCardProps {
  name: string;
  description: string;
  color: string;
  icon: string;
  isActive: boolean;
}

function PreviewCard({ name, description, color, icon, isActive }: PreviewCardProps) {
  const iconData = ICON_OPTIONS.find(i => i.value === icon);

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all",
      isActive
        ? "border-slate-200 bg-white shadow-sm"
        : "border-slate-100 bg-slate-50 opacity-60"
    )}>
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${color}15` }}
        >
          {iconData?.emoji || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900 truncate">
              {name || 'Nombre de categoría'}
            </h4>
            {!isActive && (
              <span className="px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-500 rounded-full">
                Inactiva
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">
            {description || 'Descripción opcional'}
          </p>
        </div>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function CategoryForm({
  category,
  parentCategories = [],
  onSubmit,
  onCancel,
  isLoading = false,
}: CategoryFormProps) {
  const isEditing = !!category;

  const [formData, setFormData] = useState<CategoryFormData>({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    parent_id: category?.parent_id || undefined,
    icon: category?.icon || 'Package',
    color: category?.color || '#3B82F6',
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<'basic' | 'style'>('basic');

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const dataToSubmit = {
        ...formData,
        slug: formData.slug || generateSlug(formData.name),
      };
      await onSubmit(dataToSubmit);
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
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: !isEditing ? generateSlug(name) : prev.slug,
    }));

    if (errors.name) {
      setErrors(prev => ({ ...prev, name: '' }));
    }
  };

  // Filter parent categories for dropdown
  const availableParents = useMemo(() => {
    return parentCategories.filter(c => c.id !== category?.id);
  }, [parentCategories, category?.id]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${formData.color}15` }}
            >
              <Folder className="w-6 h-6" style={{ color: formData.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
              </h2>
              <p className="text-sm text-slate-500">
                {isEditing ? 'Modifica la información de la categoría' : 'Crea una nueva categoría para organizar tu inventario'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center hover:bg-slate-100 rounded-xl active:scale-95 transition-all"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => setActiveSection('basic')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
              activeSection === 'basic'
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <Tag className="w-4 h-4" />
              Información
            </span>
            {activeSection === 'basic' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('style')}
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
              activeSection === 'style'
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <span className="flex items-center justify-center gap-2">
              <Palette className="w-4 h-4" />
              Estilo
            </span>
            {activeSection === 'style' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />
            )}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {activeSection === 'basic' ? (
              <>
                {/* Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    Nombre de la categoría
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleNameChange}
                    className={cn(
                      'w-full px-4 py-3 border rounded-xl text-sm transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400',
                      errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    )}
                    placeholder="Ej: Carnes y Pescados, Lácteos, Especias..."
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Slug */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Hash className="w-4 h-4 text-slate-400" />
                    Identificador (slug)
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    placeholder="carnes-y-pescados"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Se genera automáticamente del nombre. Usado internamente.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Layers className="w-4 h-4 text-slate-400" />
                    Descripción
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                    placeholder="Breve descripción de qué incluye esta categoría..."
                  />
                </div>

                {/* Parent Category */}
                {availableParents.length > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Folder className="w-4 h-4 text-slate-400" />
                      Categoría padre
                    </label>
                    <select
                      name="parent_id"
                      value={formData.parent_id || ''}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white"
                    >
                      <option value="">Sin categoría padre (principal)</option>
                      {availableParents.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    {formData.is_active ? (
                      <Eye className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {formData.is_active ? 'Categoría activa' : 'Categoría inactiva'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formData.is_active
                          ? 'Visible en el sistema'
                          : 'Oculta pero no eliminada'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={cn(
                      'relative w-12 h-7 rounded-full transition-colors',
                      formData.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                    )}
                  >
                    <div className={cn(
                      'absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                      formData.is_active ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Icon */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                    <Layers className="w-4 h-4 text-slate-400" />
                    Icono de la categoría
                  </label>
                  <IconSelector
                    value={formData.icon || 'Package'}
                    onChange={(value) => setFormData(prev => ({ ...prev, icon: value }))}
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                    <Palette className="w-4 h-4 text-slate-400" />
                    Color identificador
                  </label>
                  <ColorSelector
                    value={formData.color || '#3B82F6'}
                    onChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                    <Eye className="w-4 h-4 text-slate-400" />
                    Vista previa
                  </label>
                  <PreviewCard
                    name={formData.name}
                    description={formData.description || ''}
                    color={formData.color || '#3B82F6'}
                    icon={formData.icon || 'Package'}
                    isActive={formData.is_active ?? true}
                  />
                </div>

                {/* Display Order */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Hash className="w-4 h-4 text-slate-400" />
                    Orden de visualización
                  </label>
                  <input
                    type="number"
                    name="display_order"
                    value={formData.display_order}
                    onChange={handleChange}
                    min="0"
                    className="w-32 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Menor número = aparece primero
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: formData.color }} />
              {formData.name || 'Sin nombre'}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={cn(
                  'px-6 py-2.5 text-sm font-semibold text-white rounded-xl transition-all',
                  'flex items-center gap-2 shadow-lg',
                  isLoading
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 hover:shadow-xl'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {isEditing ? 'Guardar cambios' : 'Crear categoría'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryForm;
