'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Folder, Image as ImageIcon } from 'lucide-react';
import type { MenuCategory, CategoryFormData } from '../types';
import { AVAILABLE_DAYS } from '../types';

// ======================
// TYPES
// ======================

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  category?: MenuCategory | null;
  parentCategories?: MenuCategory[];
  branchId: string;
  isLoading?: boolean;
}

// Local form state (maps to CategoryFormData)
interface FormState {
  name: string;
  description: string;
  parent_id: string;
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
  available_days: string[];
  start_time: string;
  end_time: string;
}

// ======================
// FORM COMPONENTS
// ======================

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-tis-coral' : 'bg-slate-200'}
        `}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
}

function DaysSelector({
  selectedDays,
  onChange,
}: {
  selectedDays: string[];
  onChange: (days: string[]) => void;
}) {
  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter(d => d !== day));
    } else {
      onChange([...selectedDays, day]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        Días disponibles
      </label>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_DAYS.map(day => (
          <button
            key={day.value}
            type="button"
            onClick={() => toggleDay(day.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors
              ${selectedDays.includes(day.value)
                ? 'bg-tis-coral text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
          >
            {day.short}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Deja vacío para disponible todos los días
      </p>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  category,
  parentCategories = [],
  branchId,
  isLoading = false,
}: CategoryFormModalProps) {
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    parent_id: '',
    image_url: '',
    is_active: true,
    is_featured: false,
    available_days: [],
    start_time: '',
    end_time: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTimeRestrictions, setShowTimeRestrictions] = useState(false);

  const isEditing = !!category;

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormState({
          name: category.name,
          description: category.description || '',
          parent_id: category.parent_id || '',
          image_url: category.image_url || '',
          is_active: category.is_active,
          is_featured: category.is_featured,
          available_days: category.available_days || [],
          start_time: category.available_times?.start_time || '',
          end_time: category.available_times?.end_time || '',
        });
        const hasTimeRestrictions = !!(
          category.available_days?.length ||
          category.available_times?.start_time ||
          category.available_times?.end_time
        );
        setShowTimeRestrictions(hasTimeRestrictions);
      } else {
        setFormState({
          name: '',
          description: '',
          parent_id: '',
          image_url: '',
          is_active: true,
          is_featured: false,
          available_days: [],
          start_time: '',
          end_time: '',
        });
        setShowTimeRestrictions(false);
      }
      setErrors({});
    }
  }, [isOpen, category]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formState.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if ((formState.start_time && !formState.end_time) ||
        (!formState.start_time && formState.end_time)) {
      newErrors.time = 'Debes especificar ambos horarios';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const submitData: CategoryFormData = {
      name: formState.name,
      description: formState.description || undefined,
      parent_id: formState.parent_id || null,
      image_url: formState.image_url || undefined,
      is_active: formState.is_active,
      is_featured: formState.is_featured,
      available_days: showTimeRestrictions && formState.available_days.length > 0
        ? formState.available_days
        : undefined,
      available_times: showTimeRestrictions && (formState.start_time || formState.end_time)
        ? {
            start_time: formState.start_time || undefined,
            end_time: formState.end_time || undefined,
          }
        : undefined,
    };

    await onSubmit(submitData);
  };

  if (!isOpen) return null;

  // Filter out current category and its children from parent options
  const availableParentCategories = parentCategories.filter(cat => {
    if (category && cat.id === category.id) return false;
    if (category && cat.parent_id === category.id) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl transform transition-all"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-tis-coral/10 rounded-xl flex items-center justify-center">
                <Folder className="w-5 h-5 text-tis-coral" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {isEditing ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isEditing ? 'Modifica los datos de la categoría' : 'Agrega una nueva categoría al menú'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formState.name}
                onChange={handleChange}
                placeholder="Ej: Entradas, Bebidas, Postres"
                className={`w-full px-3 py-2 border rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral
                  ${errors.name ? 'border-red-300' : 'border-slate-200'}
                `}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea
                name="description"
                value={formState.description}
                onChange={handleChange}
                placeholder="Describe esta categoría (opcional)"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral resize-none"
              />
            </div>

            {/* Parent Category */}
            {availableParentCategories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría padre</label>
                <select
                  name="parent_id"
                  value={formState.parent_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                >
                  <option value="">Sin categoría padre (raíz)</option>
                  {availableParentCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL de imagen</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    name="image_url"
                    value={formState.image_url}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                  />
                </div>
                {formState.image_url && (
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
                    <Image
                      src={formState.image_url}
                      alt="Preview"
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <ToggleSwitch
                label="Categoría activa"
                description="Las categorías inactivas no aparecen en el menú"
                checked={formState.is_active}
                onChange={(checked) => setFormState(prev => ({ ...prev, is_active: checked }))}
              />

              <ToggleSwitch
                label="Destacada"
                checked={formState.is_featured}
                onChange={(checked) => setFormState(prev => ({ ...prev, is_featured: checked }))}
              />

              <ToggleSwitch
                label="Restricciones de horario"
                description="Limitar disponibilidad a ciertos días u horas"
                checked={showTimeRestrictions}
                onChange={setShowTimeRestrictions}
              />
            </div>

            {/* Time Restrictions */}
            {showTimeRestrictions && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-xl">
                <DaysSelector
                  selectedDays={formState.available_days}
                  onChange={(days) => setFormState(prev => ({ ...prev, available_days: days }))}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora inicio</label>
                    <input
                      type="time"
                      name="start_time"
                      value={formState.start_time}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora fin</label>
                    <input
                      type="time"
                      name="end_time"
                      value={formState.end_time}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                    />
                  </div>
                </div>
                {errors.time && <p className="text-xs text-red-500">{errors.time}</p>}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800
                hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-tis-coral
                hover:bg-tis-coral/90 rounded-lg transition-colors disabled:opacity-50
                flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Guardar cambios' : 'Crear categoría'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryFormModal;
