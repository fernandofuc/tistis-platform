// =====================================================
// TIS TIS PLATFORM - API Key Create Modal
// FASE 2: Branch-aware API Key creation
// =====================================================

'use client';

import { useState } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Input } from '@/shared/components/ui/Input';
import { Button } from '@/shared/components/ui/Button';
import { useBranches } from '@/src/hooks';
import { cn } from '@/shared/utils';
import type {
  APIKeyEnvironment,
  APIKeyScopeType,
  CreateAPIKeyRequest,
} from '../types';

// ======================
// TYPES
// ======================

interface APIKeyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (key: { id: string; rawKey: string }) => void;
}

interface ScopeOption {
  value: string;
  label: string;
  description: string;
  category: 'leads' | 'appointments' | 'menu' | 'other';
}

// ======================
// CONSTANTS
// ======================

const AVAILABLE_SCOPES: ScopeOption[] = [
  {
    value: 'leads:read',
    label: 'Leer Leads',
    description: 'Ver información de leads y prospectos',
    category: 'leads',
  },
  {
    value: 'leads:write',
    label: 'Crear/Editar Leads',
    description: 'Crear y modificar leads',
    category: 'leads',
  },
  {
    value: 'appointments:read',
    label: 'Leer Citas',
    description: 'Ver citas agendadas',
    category: 'appointments',
  },
  {
    value: 'appointments:write',
    label: 'Crear/Editar Citas',
    description: 'Crear y modificar citas',
    category: 'appointments',
  },
  {
    value: 'menu:read',
    label: 'Leer Menú',
    description: 'Ver platillos y categorías del menú',
    category: 'menu',
  },
  {
    value: 'menu:write',
    label: 'Modificar Menú',
    description: 'Editar menú del restaurante',
    category: 'menu',
  },
];

const ENVIRONMENT_OPTIONS: Array<{ value: APIKeyEnvironment; label: string; description: string }> = [
  {
    value: 'live',
    label: 'Producción (Live)',
    description: 'Usar en tu aplicación en producción',
  },
  {
    value: 'test',
    label: 'Pruebas (Test)',
    description: 'Usar para desarrollo y pruebas',
  },
];

// ======================
// ICONS
// ======================

const GlobeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
);

// ======================
// COMPONENT
// ======================

export function APIKeyCreateModal({ isOpen, onClose, onSuccess }: APIKeyCreateModalProps) {
  const { branches, isLoading: loadingBranches } = useBranches();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<APIKeyEnvironment>('live');
  const [scopeType, setScopeType] = useState<APIKeyScopeType>('branch');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  // UI state
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);

    try {
      // Validaciones
      if (!name.trim()) {
        throw new Error('El nombre es requerido');
      }

      if (selectedScopes.length === 0) {
        throw new Error('Debes seleccionar al menos un permiso');
      }

      if (scopeType === 'branch' && !selectedBranchId) {
        throw new Error('Debes seleccionar una sucursal');
      }

      const requestBody: CreateAPIKeyRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        environment,
        scope_type: scopeType,
        branch_id: scopeType === 'branch' ? selectedBranchId : null,
        scopes: selectedScopes,
      };

      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear API Key');
      }

      onSuccess({
        id: data.key.id,
        rawKey: data.api_key_secret,
      });

      // Reset form
      setName('');
      setDescription('');
      setEnvironment('live');
      setScopeType('branch');
      setSelectedBranchId('');
      setSelectedScopes([]);

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crear Nueva API Key"
      subtitle="Genera una clave de API para acceder a la plataforma de forma programática"
      size="xl"
    >
      <div className="space-y-6">
        {/* Información General */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Información General</h4>

          <Input
            label="Nombre *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Integración CRM"
            helperText="Un nombre descriptivo para identificar esta API Key"
          />

          <div className="w-full">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: API Key para sincronizar leads con Salesforce"
              rows={3}
              className={cn(
                'block w-full rounded-lg border transition-colors duration-200',
                'text-gray-900 placeholder:text-gray-400',
                'bg-white px-4 py-3 sm:py-2.5 text-base sm:text-sm',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                'border-gray-300 focus:border-tis-coral focus:ring-tis-coral/30'
              )}
            />
            <p className="mt-1.5 text-sm text-gray-500">Información adicional sobre el uso de esta key</p>
          </div>
        </div>

        {/* Entorno */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Entorno *</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENVIRONMENT_OPTIONS.map((env) => (
              <label
                key={env.value}
                className={cn(
                  'relative flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all',
                  'hover:border-tis-coral/50 hover:bg-tis-coral/5',
                  environment === env.value
                    ? 'border-tis-coral bg-tis-coral/10'
                    : 'border-gray-200'
                )}
              >
                <input
                  type="radio"
                  name="environment"
                  value={env.value}
                  checked={environment === env.value}
                  onChange={() => setEnvironment(env.value)}
                  className="sr-only"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{env.label}</span>
                    {environment === env.value && (
                      <CheckCircleIcon />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{env.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Alcance de la API Key */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Alcance de la API Key *</h4>

          <div className="space-y-3">
            <label
              className={cn(
                'relative flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all',
                'hover:border-tis-coral/50 hover:bg-tis-coral/5',
                scopeType === 'branch'
                  ? 'border-tis-coral bg-tis-coral/10'
                  : 'border-gray-200'
              )}
            >
              <input
                type="radio"
                name="scopeType"
                value="branch"
                checked={scopeType === 'branch'}
                onChange={() => setScopeType('branch')}
                className="sr-only"
              />
              <div className="flex-shrink-0 mt-0.5 text-tis-coral">
                <BuildingIcon />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">Sucursal Específica</span>
                  <span className="px-2 py-0.5 text-xs font-medium bg-tis-coral/20 text-tis-coral rounded">
                    Recomendado
                  </span>
                  {scopeType === 'branch' && <CheckCircleIcon />}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Esta API Key solo tendrá acceso a datos de una sucursal en particular. Más seguro y recomendado para la mayoría de los casos.
                </p>
              </div>
            </label>

            <label
              className={cn(
                'relative flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all',
                'hover:border-tis-coral/50 hover:bg-tis-coral/5',
                scopeType === 'tenant'
                  ? 'border-tis-coral bg-tis-coral/10'
                  : 'border-gray-200'
              )}
            >
              <input
                type="radio"
                name="scopeType"
                value="tenant"
                checked={scopeType === 'tenant'}
                onChange={() => {
                  setScopeType('tenant');
                  setSelectedBranchId('');
                }}
                className="sr-only"
              />
              <div className="flex-shrink-0 mt-0.5 text-gray-600">
                <GlobeIcon />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">Todas las Sucursales</span>
                  {scopeType === 'tenant' && <CheckCircleIcon />}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Esta API Key tendrá acceso a datos de todas las sucursales de tu organización. Recomendado para integraciones centralizadas.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Selección de Sucursal (condicional) */}
        {scopeType === 'branch' && (
          <div className="space-y-3">
            <label htmlFor="branch" className="block text-sm font-medium text-gray-700">
              Sucursal *
            </label>
            <select
              id="branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={loadingBranches}
              className={cn(
                'block w-full rounded-lg border transition-colors duration-200',
                'text-gray-900 bg-white px-4 py-3 sm:py-2.5 text-base sm:text-sm min-h-[44px] sm:min-h-0',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                'border-gray-300 focus:border-tis-coral focus:ring-tis-coral/30',
                loadingBranches && 'bg-gray-50 cursor-wait'
              )}
            >
              <option value="">
                {loadingBranches ? 'Cargando sucursales...' : 'Selecciona una sucursal...'}
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                  {branch.address && ` - ${branch.address}`}
                </option>
              ))}
            </select>
            {branches.length === 0 && !loadingBranches && (
              <p className="mt-1.5 text-sm text-amber-600">
                No se encontraron sucursales. Por favor crea una sucursal primero.
              </p>
            )}
          </div>
        )}

        {/* Permisos (Scopes) */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Permisos *</h4>
          <p className="text-xs text-gray-500">
            Selecciona los permisos que necesita esta API Key. Puedes seleccionar múltiples permisos.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope.value}
                className={cn(
                  'relative flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all',
                  'hover:border-tis-coral/50 hover:bg-tis-coral/5',
                  selectedScopes.includes(scope.value)
                    ? 'border-tis-coral bg-tis-coral/10'
                    : 'border-gray-200'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.value)}
                  onChange={() => toggleScope(scope.value)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-tis-coral focus:ring-tis-coral"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{scope.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{scope.description}</div>
                </div>
              </label>
            ))}
          </div>

          {selectedScopes.length === 0 && (
            <p className="text-xs text-amber-600">Debes seleccionar al menos un permiso</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={creating}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={creating} className="w-full sm:w-auto">
            {creating ? 'Creando...' : 'Crear API Key'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
