// =====================================================
// TIS TIS PLATFORM - Create API Key Modal
// Modal for creating a new API Key
// =====================================================

'use client';

import { useState } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { cn } from '@/shared/utils';
import { ScopeSelector } from './ScopeSelector';
import { APIKeySecretDisplay } from './APIKeySecretDisplay';
import { useScopeSelector } from '../hooks/useAPIKeys';
import type {
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
  APIKeyEnvironment,
  Vertical,
} from '../types';

// ======================
// ICONS
// ======================

const KeyIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

// ======================
// TYPES
// ======================

export interface CreateAPIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAPIKeyRequest) => Promise<CreateAPIKeyResponse>;
  vertical?: Vertical;
  maxRpm?: number;
  maxDaily?: number;
  defaultRpm?: number;
  defaultDaily?: number;
}

type Step = 'form' | 'success';

// ======================
// COMPONENT
// ======================

export function CreateAPIKeyModal({
  isOpen,
  onClose,
  onSubmit,
  vertical = 'dental',
  maxRpm = 100,
  maxDaily = 10000,
  defaultRpm = 60,
  defaultDaily = 1000,
}: CreateAPIKeyModalProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<APIKeyEnvironment>('live');
  const [rateLimitRpm, setRateLimitRpm] = useState(defaultRpm);
  const [rateLimitDaily, setRateLimitDaily] = useState(defaultDaily);
  const [expiresAt, setExpiresAt] = useState('');
  const [ipWhitelist, setIpWhitelist] = useState('');

  // Scope selector
  const {
    scopeGroups,
    selectedScopes,
    toggleScope,
    selectPreset,
    selectAll,
    clearAll,
  } = useScopeSelector(vertical);

  // UI state
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null);

  // Reset form
  const resetForm = () => {
    setName('');
    setDescription('');
    setEnvironment('live');
    setRateLimitRpm(defaultRpm);
    setRateLimitDaily(defaultDaily);
    setExpiresAt('');
    setIpWhitelist('');
    clearAll();
    setStep('form');
    setError(null);
    setCreatedKey(null);
  };

  // Handle close
  const handleClose = () => {
    if (step === 'success') {
      resetForm();
    }
    onClose();
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (selectedScopes.length === 0) {
      setError('Debes seleccionar al menos un permiso');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Parse IP whitelist
      const parsedIpWhitelist = ipWhitelist
        .split(/[\n,]/)
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);

      const data: CreateAPIKeyRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        environment,
        scopes: selectedScopes,
        rate_limit_rpm: rateLimitRpm,
        rate_limit_daily: rateLimitDaily,
        expires_at: expiresAt || undefined,
        ip_whitelist: parsedIpWhitelist.length > 0 ? parsedIpWhitelist : undefined,
      };

      const response = await onSubmit(data);
      setCreatedKey(response);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la API Key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'form' ? 'Crear API Key' : 'API Key Creada'}
      subtitle={
        step === 'form'
          ? 'Configura los permisos y límites de tu nueva API Key'
          : undefined
      }
      size="lg"
      closeOnBackdrop={step !== 'success'}
      closeOnEscape={step !== 'success'}
    >
      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <Input
              label="Nombre *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Integración CRM, App Móvil, etc."
              maxLength={100}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el propósito de esta API Key (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Environment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entorno
            </label>
            <div className="flex gap-3" role="radiogroup" aria-label="Seleccionar entorno">
              <button
                type="button"
                onClick={() => setEnvironment('live')}
                role="radio"
                aria-checked={environment === 'live'}
                className={cn(
                  'flex-1 p-3 rounded-lg border-2 transition-all text-left',
                  environment === 'live'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                  <span className="font-medium text-gray-900">Live</span>
                </div>
                <p className="text-xs text-gray-500">
                  Para uso en producción con datos reales
                </p>
              </button>
              <button
                type="button"
                onClick={() => setEnvironment('test')}
                role="radio"
                aria-checked={environment === 'test'}
                className={cn(
                  'flex-1 p-3 rounded-lg border-2 transition-all text-left',
                  environment === 'test'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                  <span className="font-medium text-gray-900">Test</span>
                </div>
                <p className="text-xs text-gray-500">
                  Para desarrollo y pruebas
                </p>
              </button>
            </div>
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permisos *
            </label>
            <ScopeSelector
              scopeGroups={scopeGroups}
              selectedScopes={selectedScopes}
              onToggleScope={toggleScope}
              onSelectPreset={selectPreset}
              onSelectAll={selectAll}
              onClearAll={clearAll}
              vertical={vertical}
            />
          </div>

          {/* Rate Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Límite por minuto (RPM)
              </label>
              <input
                type="number"
                value={rateLimitRpm}
                onChange={(e) => setRateLimitRpm(Number(e.target.value))}
                min={1}
                max={maxRpm}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Máx: {maxRpm}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Límite diario
              </label>
              <input
                type="number"
                value={rateLimitDaily}
                onChange={(e) => setRateLimitDaily(Number(e.target.value))}
                min={100}
                max={maxDaily}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Máx: {maxDaily.toLocaleString()}</p>
            </div>
          </div>

          {/* Advanced Options (Collapsible) */}
          <details className="border border-gray-200 rounded-lg">
            <summary className="p-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50">
              Opciones Avanzadas
            </summary>
            <div className="p-3 pt-0 space-y-4 border-t border-gray-200 mt-3">
              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha de Expiración
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dejar vacío para una key sin expiración
                </p>
              </div>

              {/* IP Whitelist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Lista Blanca de IPs
                </label>
                <textarea
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                  placeholder="192.168.1.1&#10;10.0.0.0/24&#10;..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Una IP por línea. Soporta notación CIDR. Dejar vacío para permitir cualquier IP.
                </p>
              </div>
            </div>
          </details>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              leftIcon={<KeyIcon />}
            >
              Crear API Key
            </Button>
          </div>
        </form>
      ) : (
        /* Success Step */
        <div className="space-y-4">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* API Key Display */}
          {createdKey && (
            <APIKeySecretDisplay
              apiKey={createdKey.api_key_secret}
              keyName={createdKey.key.name}
              onClose={handleClose}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
