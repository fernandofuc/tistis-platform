// =====================================================
// TIS TIS PLATFORM - Table Form Modal Component
// Create/Edit table modal with comprehensive form
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils';
import type {
  RestaurantTable,
  TableFormData,
  TableZone,
  TableFeature,
} from '../types';
import { ZONE_CONFIG, FEATURE_LABELS } from '../types';

// ======================
// FORM INPUT
// ======================
interface FormInputProps {
  label: string;
  id: string;
  type?: 'text' | 'number';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  error?: string;
}

function FormInput({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  min,
  max,
  error,
}: FormInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl border bg-white text-sm transition-all',
          'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral',
          error
            ? 'border-red-300 bg-red-50'
            : 'border-slate-200 hover:border-slate-300'
        )}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ======================
// FORM SELECT
// ======================
interface FormSelectProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}

function FormSelect({ label, id, value, onChange, options, required }: FormSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm transition-all focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral hover:border-slate-300"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ======================
// TOGGLE SWITCH
// ======================
interface ToggleSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
          checked ? 'bg-tis-coral' : 'bg-slate-200'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  );
}

// ======================
// FEATURE SELECTOR
// ======================
interface FeatureSelectorProps {
  selected: TableFeature[];
  onChange: (features: TableFeature[]) => void;
}

function FeatureSelector({ selected, onChange }: FeatureSelectorProps) {
  const features = Object.entries(FEATURE_LABELS) as [TableFeature, string][];

  const toggle = (feature: TableFeature) => {
    if (selected.includes(feature)) {
      onChange(selected.filter((f) => f !== feature));
    } else {
      onChange([...selected, feature]);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        Características de la mesa
      </label>
      <div className="flex flex-wrap gap-2">
        {features.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg border transition-all',
              selected.includes(key)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ======================
// CAPACITY SELECTOR
// ======================
interface CapacitySelectorProps {
  min: number;
  max: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

function CapacitySelector({ min, max, onMinChange, onMaxChange }: CapacitySelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        Capacidad de la mesa
      </label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Mínimo</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => min > 1 && onMinChange(min - 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              value={min}
              onChange={(e) => onMinChange(parseInt(e.target.value) || 1)}
              min={1}
              max={max}
              className="w-16 text-center px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
            />
            <button
              type="button"
              onClick={() => min < max && onMinChange(min + 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Máximo</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => max > min && onMaxChange(max - 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="number"
              value={max}
              onChange={(e) => onMaxChange(parseInt(e.target.value) || min)}
              min={min}
              max={20}
              className="w-16 text-center px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
            />
            <button
              type="button"
              onClick={() => max < 20 && onMaxChange(max + 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface TableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TableFormData) => Promise<void>;
  table?: RestaurantTable | null;
  branchId: string;
  existingTableNumbers: string[];
}

export function TableFormModal({
  isOpen,
  onClose,
  onSubmit,
  table,
  branchId,
  existingTableNumbers,
}: TableFormModalProps) {
  const isEdit = Boolean(table);

  // Form state
  const [tableNumber, setTableNumber] = useState('');
  const [name, setName] = useState('');
  const [minCapacity, setMinCapacity] = useState(1);
  const [maxCapacity, setMaxCapacity] = useState(4);
  const [zone, setZone] = useState<TableZone>('main');
  const [floor, setFloor] = useState(1);
  const [isOutdoor, setIsOutdoor] = useState(false);
  const [isAccessible, setIsAccessible] = useState(true);
  const [isHighTop, setIsHighTop] = useState(false);
  const [hasPowerOutlet, setHasPowerOutlet] = useState(false);
  const [features, setFeatures] = useState<TableFeature[]>([]);
  const [canCombine, setCanCombine] = useState(true);
  const [priority, setPriority] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Initialize form when table changes
  useEffect(() => {
    if (table) {
      setTableNumber(table.table_number);
      setName(table.name || '');
      setMinCapacity(table.min_capacity);
      setMaxCapacity(table.max_capacity);
      setZone(table.zone);
      setFloor(table.floor);
      setIsOutdoor(table.is_outdoor);
      setIsAccessible(table.is_accessible);
      setIsHighTop(table.is_high_top);
      setHasPowerOutlet(table.has_power_outlet);
      setFeatures(table.features);
      setCanCombine(table.can_combine);
      setPriority(table.priority);
      setIsActive(table.is_active);
    } else {
      // Reset form for new table
      setTableNumber('');
      setName('');
      setMinCapacity(1);
      setMaxCapacity(4);
      setZone('main');
      setFloor(1);
      setIsOutdoor(false);
      setIsAccessible(true);
      setIsHighTop(false);
      setHasPowerOutlet(false);
      setFeatures([]);
      setCanCombine(true);
      setPriority(0);
      setIsActive(true);
    }
    setErrors({});
  }, [table, isOpen]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!tableNumber.trim()) {
      newErrors.tableNumber = 'El número de mesa es requerido';
    } else if (!isEdit && existingTableNumbers.includes(tableNumber.trim())) {
      newErrors.tableNumber = 'Ya existe una mesa con este número';
    }

    if (maxCapacity < minCapacity) {
      newErrors.capacity = 'La capacidad máxima debe ser mayor o igual a la mínima';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const data: TableFormData = {
        table_number: tableNumber.trim(),
        name: name.trim() || undefined,
        min_capacity: minCapacity,
        max_capacity: maxCapacity,
        zone,
        floor,
        is_outdoor: isOutdoor,
        is_accessible: isAccessible,
        is_high_top: isHighTop,
        has_power_outlet: hasPowerOutlet,
        features,
        can_combine: canCombine,
        priority,
        is_active: isActive,
      };

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Error saving table:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const zoneOptions = Object.entries(ZONE_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEdit ? 'Editar Mesa' : 'Nueva Mesa'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEdit ? 'Modifica los datos de la mesa' : 'Configura una nueva mesa para tu restaurante'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Número de Mesa"
                id="tableNumber"
                value={tableNumber}
                onChange={setTableNumber}
                placeholder="Ej: 1, A1, VIP-1"
                required
                error={errors.tableNumber}
              />

              <FormInput
                label="Nombre (opcional)"
                id="name"
                value={name}
                onChange={setName}
                placeholder="Ej: Mesa VIP Terraza"
              />
            </div>

            {/* Zone & Floor */}
            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Zona"
                id="zone"
                value={zone}
                onChange={(v) => setZone(v as TableZone)}
                options={zoneOptions}
                required
              />

              <FormInput
                label="Piso"
                id="floor"
                type="number"
                value={floor}
                onChange={(v) => setFloor(parseInt(v) || 1)}
                min={1}
                max={10}
              />
            </div>

            {/* Capacity */}
            <CapacitySelector
              min={minCapacity}
              max={maxCapacity}
              onMinChange={setMinCapacity}
              onMaxChange={setMaxCapacity}
            />
            {errors.capacity && (
              <p className="text-xs text-red-600 -mt-4">{errors.capacity}</p>
            )}

            {/* Toggles */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <ToggleSwitch
                label="Mesa exterior"
                description="Ubicada en área al aire libre"
                checked={isOutdoor}
                onChange={setIsOutdoor}
              />

              <ToggleSwitch
                label="Accesible"
                description="Apta para sillas de ruedas"
                checked={isAccessible}
                onChange={setIsAccessible}
              />

              <ToggleSwitch
                label="Mesa alta / Barra"
                description="Mesa tipo bar o alta"
                checked={isHighTop}
                onChange={setIsHighTop}
              />

              <ToggleSwitch
                label="Enchufe eléctrico"
                description="Disponible para cargar dispositivos"
                checked={hasPowerOutlet}
                onChange={setHasPowerOutlet}
              />

              <ToggleSwitch
                label="Puede combinarse"
                description="Permite unirse con otras mesas"
                checked={canCombine}
                onChange={setCanCombine}
              />
            </div>

            {/* Features */}
            <FeatureSelector selected={features} onChange={setFeatures} />

            {/* Priority & Active */}
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Prioridad de asignación"
                id="priority"
                type="number"
                value={priority}
                onChange={(v) => setPriority(parseInt(v) || 0)}
                min={0}
                max={100}
              />

              <div className="flex items-end pb-1">
                <ToggleSwitch
                  label="Mesa activa"
                  description="Disponible para asignar"
                  checked={isActive}
                  onChange={setIsActive}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'px-6 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl transition-all',
                loading
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-slate-800'
              )}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Guardando...
                </span>
              ) : isEdit ? (
                'Guardar cambios'
              ) : (
                'Crear mesa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
