// =====================================================
// TIS TIS PLATFORM - Station Form Modal Component
// Create/Edit kitchen station modal with comprehensive form
// Professional Apple/TIS TIS Style Design
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils';
import type {
  KitchenStationConfig,
  KitchenStation,
  StationFormData,
} from '../types';
import { STATION_CONFIG } from '../types';

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
  disabled?: boolean;
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
  disabled,
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
        disabled={disabled}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl border bg-white text-sm transition-all',
          'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral',
          disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
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
// FORM TEXTAREA
// ======================
interface FormTextareaProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function FormTextarea({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: FormTextareaProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm transition-all focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:border-tis-coral hover:border-slate-300 resize-none"
      />
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
// STATION TYPE SELECTOR
// ======================
interface StationTypeSelectorProps {
  selected: KitchenStation;
  onChange: (type: KitchenStation) => void;
}

function StationTypeSelector({ selected, onChange }: StationTypeSelectorProps) {
  const stationTypes = Object.entries(STATION_CONFIG) as [KitchenStation, typeof STATION_CONFIG[KitchenStation]][];

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        Tipo de estación <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {stationTypes.map(([key, config]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
              selected === key
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                selected === key ? 'bg-white/20' : ''
              )}
              style={{ backgroundColor: selected === key ? 'transparent' : config.color + '20', color: selected === key ? 'white' : config.color }}
            >
              {key.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-center leading-tight">
              {config.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ======================
// COLOR PICKER
// ======================
interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#64748B', // Slate
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#14B8A6', // Teal
];

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-8 h-8 rounded-lg transition-all',
              value === color
                ? 'ring-2 ring-offset-2 ring-slate-900 scale-110'
                : 'hover:scale-105'
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tis-coral/50"
        />
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
interface StationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StationFormData) => Promise<void>;
  station?: KitchenStationConfig | null;
  existingCodes: string[];
}

export function StationFormModal({
  isOpen,
  onClose,
  onSubmit,
  station,
  existingCodes,
}: StationFormModalProps) {
  const isEdit = Boolean(station);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stationType, setStationType] = useState<KitchenStation>('main');
  const [displayColor, setDisplayColor] = useState('#3B82F6');
  const [printerName, setPrinterName] = useState('');
  const [printerIp, setPrinterIp] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Validation & Loading
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Initialize form when station changes
  useEffect(() => {
    if (station) {
      setCode(station.code);
      setName(station.name);
      setDescription(station.description || '');
      setStationType(station.station_type);
      setDisplayColor(station.display_color || '#3B82F6');
      setPrinterName(station.printer_name || '');
      setPrinterIp(station.printer_ip || '');
      setIsActive(station.is_active);
    } else {
      // Reset form for new station
      setCode('');
      setName('');
      setDescription('');
      setStationType('main');
      setDisplayColor('#3B82F6');
      setPrinterName('');
      setPrinterIp('');
      setIsActive(true);
    }
    setErrors({});
  }, [station, isOpen]);

  // Auto-generate code from station type
  useEffect(() => {
    if (!isEdit && stationType && !code) {
      const config = STATION_CONFIG[stationType];
      if (config) {
        const baseCode = stationType.toUpperCase().slice(0, 4);
        let newCode = baseCode;
        let counter = 1;
        while (existingCodes.includes(newCode)) {
          newCode = `${baseCode}${counter}`;
          counter++;
        }
        setCode(newCode);
        setName(config.label);
        setDisplayColor(config.color);
      }
    }
  }, [stationType, isEdit, existingCodes, code]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!code.trim()) {
      newErrors.code = 'El código es requerido';
    } else if (code.length > 20) {
      newErrors.code = 'El código no puede tener más de 20 caracteres';
    } else if (!isEdit && existingCodes.includes(code.trim().toUpperCase())) {
      newErrors.code = 'Ya existe una estación con este código';
    }

    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (name.length > 100) {
      newErrors.name = 'El nombre no puede tener más de 100 caracteres';
    }

    if (printerIp && !/^(\d{1,3}\.){3}\d{1,3}$/.test(printerIp)) {
      newErrors.printerIp = 'IP inválida (ej: 192.168.1.100)';
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
      const data: StationFormData = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        station_type: stationType,
        display_color: displayColor,
        printer_name: printerName.trim() || undefined,
        printer_ip: printerIp.trim() || undefined,
        is_active: isActive,
      };

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Error saving station:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
              {isEdit ? 'Editar Estación' : 'Nueva Estación'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEdit ? 'Modifica la configuración de la estación' : 'Configura una nueva estación de cocina'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Station Type */}
            <StationTypeSelector
              selected={stationType}
              onChange={setStationType}
            />

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Código"
                id="code"
                value={code}
                onChange={setCode}
                placeholder="Ej: GRILL, FRY"
                required
                error={errors.code}
              />

              <FormInput
                label="Nombre"
                id="name"
                value={name}
                onChange={setName}
                placeholder="Ej: Parrilla Principal"
                required
                error={errors.name}
              />
            </div>

            {/* Description */}
            <FormTextarea
              label="Descripción (opcional)"
              id="description"
              value={description}
              onChange={setDescription}
              placeholder="Describe las responsabilidades de esta estación..."
            />

            {/* Display Color */}
            <ColorPicker
              label="Color de visualización"
              value={displayColor}
              onChange={setDisplayColor}
            />

            {/* Printer Settings */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Configuración de Impresora (opcional)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Nombre de impresora"
                  id="printerName"
                  value={printerName}
                  onChange={setPrinterName}
                  placeholder="Ej: Epson TM-T20"
                />

                <FormInput
                  label="IP de impresora"
                  id="printerIp"
                  value={printerIp}
                  onChange={setPrinterIp}
                  placeholder="Ej: 192.168.1.100"
                  error={errors.printerIp}
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="bg-slate-50 rounded-xl p-4">
              <ToggleSwitch
                label="Estación activa"
                description="Las estaciones inactivas no recibirán órdenes"
                checked={isActive}
                onChange={setIsActive}
              />
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
                  : 'hover:bg-slate-800 active:scale-95'
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
                'Crear estación'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
