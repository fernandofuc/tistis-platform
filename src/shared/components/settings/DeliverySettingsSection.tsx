'use client';

// =====================================================
// TIS TIS PLATFORM - Delivery Settings Section
// Component for configuring delivery options per tenant
// =====================================================
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql (service_options)
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/unified-assistant-types.ts (DeliveryConfig)
// =====================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { DeliveryConfig } from '@/src/shared/types/unified-assistant-types';

// ======================
// ICONS
// ======================

const TruckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CurrencyIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

// ======================
// TYPES
// ======================

interface DeliverySettingsSectionProps {
  /** Configuracion actual de delivery */
  config: DeliveryConfig;
  /** Callback cuando cambia la configuracion */
  onChange: (config: DeliveryConfig) => void;
  /** Si el componente esta deshabilitado */
  disabled?: boolean;
  /** Si hay cambios sin guardar */
  hasChanges?: boolean;
  /** Callback para guardar */
  onSave?: () => void;
  /** Si esta guardando */
  isSaving?: boolean;
}

// ======================
// COMPONENT
// ======================

export function DeliverySettingsSection({
  config,
  onChange,
  disabled = false,
  hasChanges = false,
  onSave,
  isSaving = false,
}: DeliverySettingsSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle toggle delivery enabled
  const handleToggleDelivery = useCallback(() => {
    onChange({
      ...config,
      provider: config.provider === 'disabled' ? 'internal' : 'disabled',
    });
  }, [config, onChange]);

  // Handle field change
  const handleFieldChange = useCallback(
    (field: keyof DeliveryConfig, value: unknown) => {
      onChange({
        ...config,
        [field]: value,
      });
    },
    [config, onChange]
  );

  const isEnabled = config.provider !== 'disabled';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            isEnabled ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'
          )}>
            <TruckIcon />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Servicio de Delivery</h3>
            <p className="text-sm text-slate-500">
              Configura las entregas a domicilio
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={handleToggleDelivery}
          disabled={disabled}
          className={cn(
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
            isEnabled ? 'bg-purple-600' : 'bg-slate-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {/* Settings (only when enabled) */}
      <AnimatePresence>
        {isEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-5 overflow-hidden"
          >
            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Max Radius */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <MapPinIcon className="w-4 h-4 text-slate-400" />
                  Radio de cobertura
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={config.max_radius_km}
                    onChange={(e) => handleFieldChange('max_radius_km', parseFloat(e.target.value) || 5)}
                    disabled={disabled}
                    className={cn(
                      'w-full px-3 py-2 pr-12 border border-slate-200 rounded-lg text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                      disabled && 'bg-slate-50 cursor-not-allowed'
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    km
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Distancia maxima desde la sucursal
                </p>
              </div>

              {/* Delivery Fee */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CurrencyIcon className="w-4 h-4 text-slate-400" />
                  Costo de envio
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={config.delivery_fee}
                    onChange={(e) => handleFieldChange('delivery_fee', parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className={cn(
                      'w-full px-3 py-2 pl-7 border border-slate-200 rounded-lg text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                      disabled && 'bg-slate-50 cursor-not-allowed'
                    )}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {config.delivery_fee === 0 ? 'Envio gratis' : 'Se agrega al total del pedido'}
                </p>
              </div>

              {/* Minimum Order */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <CurrencyIcon className="w-4 h-4 text-slate-400" />
                  Pedido minimo
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={config.minimum_order_amount}
                    onChange={(e) => handleFieldChange('minimum_order_amount', parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className={cn(
                      'w-full px-3 py-2 pl-7 border border-slate-200 rounded-lg text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                      disabled && 'bg-slate-50 cursor-not-allowed'
                    )}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {config.minimum_order_amount === 0 ? 'Sin minimo' : 'Monto minimo para delivery'}
                </p>
              </div>

              {/* Estimated Time */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ClockIcon className="w-4 h-4 text-slate-400" />
                  Tiempo estimado
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={15}
                    max={120}
                    step={5}
                    value={config.estimated_time_minutes}
                    onChange={(e) => handleFieldChange('estimated_time_minutes', parseInt(e.target.value) || 30)}
                    disabled={disabled}
                    className={cn(
                      'w-full px-3 py-2 pr-16 border border-slate-200 rounded-lg text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                      disabled && 'bg-slate-50 cursor-not-allowed'
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    minutos
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Tiempo promedio de entrega
                </p>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {showAdvanced ? 'Ocultar configuracion avanzada' : 'Mostrar configuracion avanzada'}
            </button>

            {/* Advanced Settings */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 pt-4 border-t border-slate-100"
                >
                  {/* Provider */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Proveedor de delivery
                    </label>
                    <select
                      value={config.provider}
                      onChange={(e) => handleFieldChange('provider', e.target.value)}
                      disabled={disabled}
                      className={cn(
                        'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent',
                        disabled && 'bg-slate-50 cursor-not-allowed'
                      )}
                    >
                      <option value="internal">Repartidores propios</option>
                      <option value="uber_eats">Uber Eats</option>
                      <option value="rappi">Rappi</option>
                      <option value="didi_food">DiDi Food</option>
                    </select>
                  </div>

                  {/* Delivery Zones Info */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      Zonas de delivery
                    </h4>
                    <p className="text-xs text-slate-500 mb-3">
                      Puedes configurar zonas especificas con diferentes tarifas y tiempos
                      desde la seccion de Sucursales.
                    </p>
                    <button
                      type="button"
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Configurar zonas →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save Button */}
            {hasChanges && onSave && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving || disabled}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-purple-600 text-white hover:bg-purple-700',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                    (isSaving || disabled) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Guardando...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CheckIcon />
                      Guardar cambios
                    </span>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disabled State Info */}
      {!isEnabled && (
        <div className="p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-500">
            El servicio de delivery esta deshabilitado. Activa el toggle para configurar
            las opciones de entrega a domicilio.
          </p>
        </div>
      )}
    </div>
  );
}

export default DeliverySettingsSection;
