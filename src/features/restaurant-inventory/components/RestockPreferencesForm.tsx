'use client';

// =====================================================
// TIS TIS PLATFORM - Restock Preferences Form
// Configuration for automatic restock alerts and notifications
// Allows switching between manual, semi-automatic, and automatic modes
// Professional Apple/TIS TIS Style Design
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings,
  Bell,
  Mail,
  MessageCircle,
  Clock,
  Zap,
  AlertTriangle,
  Check,
  ChevronDown,
  X,
  Plus,
  Info,
  Loader2,
  Send,
  FileCheck,
  Eye,
} from 'lucide-react';
import type {
  RestockNotificationPreferences,
  RestockPreferencesFormData,
} from '../types';

// ======================
// TYPES
// ======================

interface RestockPreferencesFormProps {
  preferences: RestockNotificationPreferences | null;
  onSubmit: (data: RestockPreferencesFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

type AutomationMode = 'manual' | 'semi_automatic' | 'automatic';

// ======================
// MODE CONFIGURATIONS
// ======================

const AUTOMATION_MODES: Record<AutomationMode, {
  label: string;
  description: string;
  icon: typeof Send;
  color: string;
  bgColor: string;
  features: string[];
}> = {
  manual: {
    label: 'Manual',
    description: 'Control total sobre cada paso del proceso',
    icon: Eye,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    features: [
      'Alertas visibles en el dashboard',
      'Crear órdenes manualmente',
      'Enviar WhatsApp con un clic',
    ],
  },
  semi_automatic: {
    label: 'Semi-automático',
    description: 'Alertas y órdenes automáticas con revisión antes de enviar',
    icon: FileCheck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    features: [
      'Alertas creadas automáticamente',
      'Órdenes creadas automáticamente',
      'Revisión antes de enviar al proveedor',
      'Notificaciones para aprobar',
    ],
  },
  automatic: {
    label: 'Automático',
    description: 'El sistema maneja todo sin intervención',
    icon: Zap,
    color: 'text-tis-coral',
    bgColor: 'bg-tis-coral/10',
    features: [
      'Alertas creadas automáticamente',
      'Órdenes creadas automáticamente',
      'Envío automático al proveedor vía WhatsApp',
      'Notificaciones de confirmación',
    ],
  },
};

// ======================
// FREQUENCY OPTIONS
// ======================

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Cada hora' },
  { value: 2, label: 'Cada 2 horas' },
  { value: 4, label: 'Cada 4 horas' },
  { value: 8, label: 'Cada 8 horas' },
  { value: 12, label: 'Cada 12 horas' },
  { value: 24, label: 'Una vez al día' },
];

// ======================
// AUTOMATION MODE SELECTOR
// ======================

interface ModeSelectorProps {
  value: AutomationMode;
  onChange: (mode: AutomationMode) => void;
}

function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {(Object.entries(AUTOMATION_MODES) as [AutomationMode, typeof AUTOMATION_MODES.manual][]).map(([mode, config]) => {
        const Icon = config.icon;
        const isSelected = value === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              'relative flex flex-col items-start p-5 rounded-2xl border-2 transition-all text-left',
              isSelected
                ? 'border-tis-coral bg-gradient-to-br from-tis-coral/5 to-orange-50 shadow-lg shadow-tis-coral/10'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            )}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-tis-coral flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}

            {/* Icon */}
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center mb-4',
              isSelected ? 'bg-tis-coral/10' : config.bgColor
            )}>
              <Icon className={cn('w-6 h-6', isSelected ? 'text-tis-coral' : config.color)} />
            </div>

            {/* Content */}
            <h4 className={cn(
              'font-semibold text-lg mb-1',
              isSelected ? 'text-tis-coral' : 'text-slate-900'
            )}>
              {config.label}
            </h4>
            <p className="text-sm text-slate-500 mb-4">
              {config.description}
            </p>

            {/* Features */}
            <ul className="space-y-2 w-full">
              {config.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <Check className={cn(
                    'w-4 h-4 flex-shrink-0 mt-0.5',
                    isSelected ? 'text-tis-coral' : 'text-slate-400'
                  )} />
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

// ======================
// EMAIL INPUT
// ======================

interface EmailInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
}

function EmailInput({ emails, onChange }: EmailInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addEmail = () => {
    const email = inputValue.trim().toLowerCase();
    setError('');

    if (!email) return;

    if (!validateEmail(email)) {
      setError('Email inválido');
      return;
    }

    if (emails.includes(email)) {
      setError('Email ya agregado');
      return;
    }

    onChange([...emails, email]);
    setInputValue('');
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="email"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="correo@ejemplo.com"
            className={cn(
              'w-full pl-11 pr-4 py-3 border rounded-xl text-sm transition-all',
              error
                ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                : 'border-slate-200 focus:ring-tis-coral/20 focus:border-tis-coral'
            )}
          />
        </div>
        <button
          type="button"
          onClick={addEmail}
          className="px-4 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </p>
      )}

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {emails.map(email => (
            <span
              key={email}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-700"
            >
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="w-4 h-4 rounded-full bg-slate-300 hover:bg-red-400 text-slate-600 hover:text-white transition-colors flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function RestockPreferencesForm({
  preferences,
  onSubmit,
  onCancel,
  isLoading = false,
}: RestockPreferencesFormProps) {
  // Derive automation mode from preferences
  const getInitialMode = (): AutomationMode => {
    if (!preferences) return 'manual';
    if (preferences.auto_send_to_supplier) return 'automatic';
    if (preferences.auto_create_orders || preferences.auto_create_alerts) return 'semi_automatic';
    return 'manual';
  };

  const [automationMode, setAutomationMode] = useState<AutomationMode>(getInitialMode);
  const [formData, setFormData] = useState<RestockPreferencesFormData>({
    warning_threshold_percent: preferences?.warning_threshold_percent ?? 30,
    critical_threshold_percent: preferences?.critical_threshold_percent ?? 10,
    notify_via_app: preferences?.notify_via_app ?? true,
    notify_via_email: preferences?.notify_via_email ?? false,
    notify_via_whatsapp: preferences?.notify_via_whatsapp ?? false,
    manager_emails: preferences?.manager_emails ?? [],
    auto_create_alerts: preferences?.auto_create_alerts ?? false,
    auto_create_orders: preferences?.auto_create_orders ?? false,
    auto_send_to_supplier: preferences?.auto_send_to_supplier ?? false,
    check_frequency_hours: preferences?.check_frequency_hours ?? 4,
    quiet_hours_start: preferences?.quiet_hours_start ?? null,
    quiet_hours_end: preferences?.quiet_hours_end ?? null,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update automation flags when mode changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      auto_create_alerts: automationMode !== 'manual',
      auto_create_orders: automationMode !== 'manual',
      auto_send_to_supplier: automationMode === 'automatic',
    }));
  }, [automationMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await onSubmit(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = <K extends keyof RestockPreferencesFormData>(
    field: K,
    value: RestockPreferencesFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-tis-coral to-orange-500 flex items-center justify-center shadow-lg shadow-tis-coral/30">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Preferencias de Reabastecimiento
                </h2>
                <p className="text-sm text-slate-500">
                  Configura alertas y automatización de órdenes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Mode Selector */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Modo de Automatización
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Elige cómo quieres gestionar las alertas de stock bajo y las órdenes de reabastecimiento
                </p>
                <ModeSelector
                  value={automationMode}
                  onChange={setAutomationMode}
                />
              </section>

              {/* Notification Channels */}
              <section>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Canales de Notificación
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Cómo quieres recibir las alertas y notificaciones
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* In-App Notifications */}
                  <label className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    formData.notify_via_app
                      ? 'border-tis-coral bg-tis-coral/5'
                      : 'border-slate-200 hover:border-slate-300'
                  )}>
                    <input
                      type="checkbox"
                      checked={formData.notify_via_app}
                      onChange={e => updateField('notify_via_app', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      formData.notify_via_app ? 'bg-tis-coral/10' : 'bg-slate-100'
                    )}>
                      <Bell className={cn(
                        'w-5 h-5',
                        formData.notify_via_app ? 'text-tis-coral' : 'text-slate-400'
                      )} />
                    </div>
                    <div className="flex-1">
                      <span className="block font-medium text-slate-900">Dashboard</span>
                      <span className="block text-xs text-slate-500">Alertas en la app</span>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                      formData.notify_via_app
                        ? 'bg-tis-coral border-tis-coral'
                        : 'border-slate-300'
                    )}>
                      {formData.notify_via_app && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </label>

                  {/* Email Notifications */}
                  <label className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    formData.notify_via_email
                      ? 'border-tis-coral bg-tis-coral/5'
                      : 'border-slate-200 hover:border-slate-300'
                  )}>
                    <input
                      type="checkbox"
                      checked={formData.notify_via_email}
                      onChange={e => updateField('notify_via_email', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      formData.notify_via_email ? 'bg-tis-coral/10' : 'bg-slate-100'
                    )}>
                      <Mail className={cn(
                        'w-5 h-5',
                        formData.notify_via_email ? 'text-tis-coral' : 'text-slate-400'
                      )} />
                    </div>
                    <div className="flex-1">
                      <span className="block font-medium text-slate-900">Email</span>
                      <span className="block text-xs text-slate-500">Correo electrónico</span>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                      formData.notify_via_email
                        ? 'bg-tis-coral border-tis-coral'
                        : 'border-slate-300'
                    )}>
                      {formData.notify_via_email && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </label>

                  {/* WhatsApp Notifications */}
                  <label className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    formData.notify_via_whatsapp
                      ? 'border-tis-coral bg-tis-coral/5'
                      : 'border-slate-200 hover:border-slate-300'
                  )}>
                    <input
                      type="checkbox"
                      checked={formData.notify_via_whatsapp}
                      onChange={e => updateField('notify_via_whatsapp', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      formData.notify_via_whatsapp ? 'bg-tis-coral/10' : 'bg-slate-100'
                    )}>
                      <MessageCircle className={cn(
                        'w-5 h-5',
                        formData.notify_via_whatsapp ? 'text-tis-coral' : 'text-slate-400'
                      )} />
                    </div>
                    <div className="flex-1">
                      <span className="block font-medium text-slate-900">WhatsApp</span>
                      <span className="block text-xs text-slate-500">A tu número</span>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                      formData.notify_via_whatsapp
                        ? 'bg-tis-coral border-tis-coral'
                        : 'border-slate-300'
                    )}>
                      {formData.notify_via_whatsapp && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </label>
                </div>

                {/* Email Recipients */}
                {formData.notify_via_email && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Destinatarios de Email
                    </label>
                    <EmailInput
                      emails={formData.manager_emails || []}
                      onChange={emails => updateField('manager_emails', emails)}
                    />
                  </div>
                )}
              </section>

              {/* Advanced Settings */}
              <section>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform',
                    showAdvanced && 'rotate-180'
                  )} />
                  Configuración Avanzada
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-6 p-5 bg-slate-50 rounded-xl">
                    {/* Thresholds */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Umbral de Advertencia
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={formData.warning_threshold_percent}
                            onChange={e => updateField('warning_threshold_percent', parseInt(e.target.value) || 30)}
                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-center"
                          />
                          <span className="text-sm text-slate-500">% del mínimo</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Alerta cuando el stock está por debajo de este porcentaje del mínimo
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          <span className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            Umbral Crítico
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={formData.critical_threshold_percent}
                            onChange={e => updateField('critical_threshold_percent', parseInt(e.target.value) || 10)}
                            className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-center"
                          />
                          <span className="text-sm text-slate-500">% del mínimo</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Alerta crítica cuando el stock está por debajo de este porcentaje
                        </p>
                      </div>
                    </div>

                    {/* Check Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          Frecuencia de Verificación
                        </span>
                      </label>
                      <select
                        value={formData.check_frequency_hours}
                        onChange={e => updateField('check_frequency_hours', parseInt(e.target.value))}
                        className="w-full sm:w-64 px-4 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral"
                      >
                        {FREQUENCY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">
                        Qué tan seguido el sistema verificará los niveles de stock
                      </p>
                    </div>

                    {/* Quiet Hours */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          Horario Silencioso (opcional)
                        </span>
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">De</span>
                          <input
                            type="time"
                            value={formData.quiet_hours_start || ''}
                            onChange={e => updateField('quiet_hours_start', e.target.value || null)}
                            className="px-3 py-2 border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500">a</span>
                          <input
                            type="time"
                            value={formData.quiet_hours_end || ''}
                            onChange={e => updateField('quiet_hours_end', e.target.value || null)}
                            className="px-3 py-2 border border-slate-200 rounded-lg"
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        No enviar notificaciones durante este horario
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Info Box */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">
                    {automationMode === 'automatic'
                      ? '¡Modo automático activado!'
                      : automationMode === 'semi_automatic'
                        ? 'Modo semi-automático'
                        : 'Modo manual'}
                  </p>
                  <p className="text-blue-600">
                    {automationMode === 'automatic'
                      ? 'Las órdenes de reabastecimiento se enviarán automáticamente a los proveedores vía WhatsApp cuando se detecte stock bajo.'
                      : automationMode === 'semi_automatic'
                        ? 'Las órdenes se crearán automáticamente pero necesitarás aprobarlas antes de enviarlas al proveedor.'
                        : 'Tendrás control total sobre la creación de órdenes y el envío a proveedores.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="px-6 py-3 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-tis-coral to-orange-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-tis-coral/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Guardar Preferencias
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RestockPreferencesForm;
