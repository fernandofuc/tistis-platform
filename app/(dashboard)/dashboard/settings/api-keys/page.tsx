// =====================================================
// TIS TIS PLATFORM - API Keys Management Page
// FASE 2: Multi-branch API key management with elegant UI
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { APIKeyCreateModal } from '@/features/api-settings/components/APIKeyCreateModal';
import { APIKeyDisplayModal } from '@/features/api-settings/components/APIKeyDisplayModal';
import { APIKeysList } from '@/features/api-settings/components/APIKeysList';
import { Button } from '@/shared/components/ui/Button';
import type { APIKeyListItem } from '@/features/api-settings/types/apiKey.types';

// ======================
// TYPES
// ======================

interface NewAPIKeyResult {
  id: string;
  rawKey: string;
}

// ======================
// ICONS
// ======================

const KeyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

const RefreshIcon = ({ className = '' }: { className?: string }) => (
  <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

// ======================
// COMPONENT
// ======================

export default function APIKeysPage() {
  // State for API Keys list
  const [apiKeys, setApiKeys] = useState<APIKeyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDisplayModalOpen, setIsDisplayModalOpen] = useState(false);

  // State for newly created key
  const [newKeyResult, setNewKeyResult] = useState<NewAPIKeyResult | null>(null);
  const [newKeyName, setNewKeyName] = useState<string>('');

  // Fetch API Keys
  const fetchAPIKeys = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/settings/api-keys');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cargar API Keys');
      }

      const data = await response.json();
      setApiKeys(data.keys || []);
    } catch (err) {
      console.error('[APIKeysPage] Error fetching API keys:', err);
      setError(err instanceof Error ? err.message : 'Error inesperado al cargar API Keys');
    } finally {
      setIsLoading(false);
    }
  };

  // Load API Keys on mount
  useEffect(() => {
    fetchAPIKeys();
  }, []);

  // Handle create success
  const handleCreateSuccess = (result: NewAPIKeyResult) => {
    // Find the created key name from the form (we'll pass it through the modal)
    const createdKey = apiKeys.find((k) => k.id === result.id);
    const keyName = createdKey?.name || 'Nueva API Key';

    setNewKeyResult(result);
    setNewKeyName(keyName);
    setIsDisplayModalOpen(true);

    // Refresh the list
    fetchAPIKeys();
  };

  // Handle revoke
  const handleRevoke = async (keyId: string) => {
    if (!confirm('¿Estás seguro de que deseas revocar esta API Key? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al revocar API Key');
      }

      // Refresh the list
      await fetchAPIKeys();
    } catch (err) {
      console.error('[APIKeysPage] Error revoking API key:', err);
      alert(err instanceof Error ? err.message : 'Error inesperado al revocar API Key');
    }
  };

  // Handle close display modal
  const handleCloseDisplayModal = () => {
    setIsDisplayModalOpen(false);
    setNewKeyResult(null);
    setNewKeyName('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 bg-tis-coral/10 rounded-xl">
            <KeyIcon />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              API Keys
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona las claves de acceso para la API pública de TIS TIS
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex-shrink-0 text-blue-600 mt-0.5">
            <InfoIcon />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Acerca de las API Keys
            </h4>
            <p className="text-sm text-blue-700">
              Las API Keys te permiten integrar TIS TIS con tus aplicaciones externas.
              Puedes crear keys con acceso a todas las sucursales o limitadas a una sucursal específica.
              Cada key puede tener diferentes permisos y límites de uso.
            </p>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Tus API Keys
          </h2>
          {!isLoading && (
            <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-full">
              {apiKeys.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={fetchAPIKeys}
            variant="outline"
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshIcon className={isLoading ? 'animate-spin' : ''} />
            <span className="ml-2">Actualizar</span>
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <PlusIcon />
            <span className="ml-2">Nueva API Key</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Error al cargar API Keys</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button onClick={fetchAPIKeys} variant="outline" size="sm">
              Reintentar
            </Button>
          </div>
        </div>
      ) : (
        <APIKeysList
          keys={apiKeys}
          onRevoke={handleRevoke}
          onViewDetails={(keyId) => {
            // TODO: Implement view details modal in future
            console.log('View details for key:', keyId);
          }}
          isLoading={isLoading}
        />
      )}

      {/* Modals */}
      <APIKeyCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {newKeyResult && (
        <APIKeyDisplayModal
          isOpen={isDisplayModalOpen}
          onClose={handleCloseDisplayModal}
          apiKey={newKeyResult.rawKey}
          keyName={newKeyName}
        />
      )}
    </div>
  );
}
