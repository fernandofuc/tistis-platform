// =====================================================
// TIS TIS PLATFORM - SR Deployment Type Selector
// Allows user to choose between SR Local and SR Cloud
// =====================================================

'use client';

import { useState, useEffect, useId } from 'react';
import { cn } from '@/src/shared/utils';
import type { SRDeploymentType } from '../types/integration.types';
import { SR_DEPLOYMENT_CAPABILITIES } from '../types/integration.types';

// ======================
// ICONS
// ======================

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}

// ======================
// TYPES
// ======================

interface SRDeploymentSelectorProps {
  onSelect: (type: SRDeploymentType) => void;
  selectedType?: SRDeploymentType;
  showBackButton?: boolean;
  onBack?: () => void;
}

interface DeploymentOptionProps {
  type: SRDeploymentType;
  selected: boolean;
  onSelect: () => void;
}

// ======================
// DEPLOYMENT OPTION CARD
// ======================

function DeploymentOption({ type, selected, onSelect }: DeploymentOptionProps) {
  const config = SR_DEPLOYMENT_CAPABILITIES[type];
  const Icon = type === 'local' ? ServerIcon : CloudIcon;
  const isLocal = type === 'local';

  // Feature list with availability
  const features = [
    { key: 'syncMenu', label: 'Menu y Productos', available: config.capabilities.syncMenu },
    { key: 'syncInventory', label: 'Inventario', available: config.capabilities.syncInventory },
    { key: 'syncSales', label: 'Ventas Detalladas', available: config.capabilities.syncSales },
    { key: 'syncTables', label: 'Mesas', available: config.capabilities.syncTables },
    { key: 'syncRecipes', label: 'Recetas/Gramaje', available: config.capabilities.syncRecipes },
  ];

  const availableCount = features.filter(f => f.available).length;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${config.displayName}: ${config.description}`}
      onClick={onSelect}
      className={cn(
        'relative w-full p-6 rounded-2xl border-2 text-left transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.01]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DF7373] focus-visible:ring-offset-2',
        selected
          ? 'border-[#DF7373] bg-gradient-to-br from-[#DF7373]/5 to-[#C23350]/5 dark:from-[#DF7373]/10 dark:to-[#C23350]/10'
          : 'border-gray-200 dark:border-[#404040] bg-white dark:bg-[#2f2f2f] hover:border-gray-300 dark:hover:border-[#505050]'
      )}
    >
      {/* Recommended badge for Local */}
      {isLocal && (
        <div className="absolute -top-3 left-4 px-3 py-1 bg-gradient-to-r from-[#DF7373] to-[#C23350] text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-md">
          <SparklesIcon className="w-3.5 h-3.5" />
          Recomendado
        </div>
      )}

      {/* Selection indicator */}
      <div
        className={cn(
          'absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
          selected
            ? 'border-[#DF7373] bg-[#DF7373]'
            : 'border-gray-300 dark:border-[#505050]'
        )}
      >
        {selected && <CheckIcon className="w-4 h-4 text-white" />}
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-4 mt-2">
        <div
          className={cn(
            'p-3 rounded-xl',
            isLocal
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          )}
        >
          <Icon
            className={cn(
              'w-7 h-7',
              isLocal
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-blue-600 dark:text-blue-400'
            )}
          />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {config.displayName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {config.description}
          </p>
        </div>
      </div>

      {/* Feature availability */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Funcionalidades disponibles:
          </span>
          <span
            className={cn(
              'text-sm font-bold',
              availableCount === features.length
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            )}
          >
            {availableCount}/{features.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {features.map((feature) => (
            <div
              key={feature.key}
              className="flex items-center gap-2 text-sm"
            >
              {feature.available ? (
                <CheckIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
              ) : (
                <XMarkIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              )}
              <span
                className={cn(
                  feature.available
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500 line-through'
                )}
              >
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Method and versions */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">Metodo: </span>
        {config.integrationMethod === 'local_agent' && 'TIS TIS Local Agent'}
        {config.integrationMethod === 'cloud_api' && 'API REST Oficial'}
        {config.integrationMethod === 'webhook' && 'Webhook'}
        <span className="mx-2">|</span>
        <span className="font-medium">Versiones: </span>
        {config.supportedVersions.join(', ')}
      </div>

      {/* Cloud limitations warning */}
      {!isLocal && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
          <div className="flex gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Limitaciones de SR Cloud:</strong>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>Inventario NO disponible</li>
                <li>Ventas limitadas (solo resumen)</li>
                <li>Requiere conexion a internet</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function SRDeploymentSelector({
  onSelect,
  selectedType,
  showBackButton,
  onBack,
}: SRDeploymentSelectorProps) {
  const [selected, setSelected] = useState<SRDeploymentType | undefined>(selectedType);
  const groupId = useId();

  // Sync with controlled prop when it changes
  useEffect(() => {
    if (selectedType !== undefined) {
      setSelected(selectedType);
    }
  }, [selectedType]);

  const handleSelect = (type: SRDeploymentType) => {
    setSelected(type);
  };

  const handleContinue = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2
          id={`${groupId}-title`}
          className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
        >
          Selecciona tu versión de Soft Restaurant
        </h2>
        <p
          id={`${groupId}-description`}
          className="text-sm text-gray-500 dark:text-gray-400"
        >
          Elige el tipo de instalación que tienes para configurar la integración correcta
        </p>
      </div>

      {/* Options - Accessible radiogroup */}
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-title`}
        aria-describedby={`${groupId}-description`}
        className="grid gap-4 md:grid-cols-2"
      >
        <DeploymentOption
          type="local"
          selected={selected === 'local'}
          onSelect={() => handleSelect('local')}
        />

        <DeploymentOption
          type="cloud"
          selected={selected === 'cloud'}
          onSelect={() => handleSelect('cloud')}
        />
      </div>

      {/* Help text */}
      <div className="text-center p-4 bg-gray-50 dark:bg-[#262626] rounded-xl">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>¿No estás seguro?</strong> Si instalaste Soft Restaurant en tu
          computadora o servidor, es <strong>Local</strong>. Si accedes desde
          internet sin instalación, es <strong>Cloud</strong>.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-end">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#404040] hover:bg-gray-200 dark:hover:bg-[#505050] rounded-xl transition-colors"
          >
            Atrás
          </button>
        )}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          aria-disabled={!selected}
          className={cn(
            'px-6 py-2.5 text-sm font-semibold rounded-xl transition-all',
            selected
              ? 'bg-gradient-to-r from-[#DF7373] to-[#C23350] text-white hover:shadow-lg hover:scale-[1.02]'
              : 'bg-gray-200 dark:bg-[#404040] text-gray-400 dark:text-gray-500 cursor-not-allowed'
          )}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

export default SRDeploymentSelector;
