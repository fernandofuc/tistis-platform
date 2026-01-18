// =====================================================
// TIS TIS PLATFORM - API Keys Section
// Main component for managing API Keys in Settings
// =====================================================

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card } from '@/shared/components/ui/Card';
import { Button } from '@/shared/components/ui/Button';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/shared/utils';
import { useAuthContext } from '@/features/auth';
import { APIKeyCard } from './APIKeyCard';
import { CreateAPIKeyModal } from './CreateAPIKeyModal';
import { APIKeyDetailModal } from './APIKeyDetailModal';
import { APIDocumentation } from './APIDocumentation';
import { APISandbox } from './APISandbox';
import { useAPIKeys, useAPIKeyDetail } from '../hooks/useAPIKeys';
import type {
  APIKeyListItem,
  APIKeyEnvironment,
  Vertical,
} from '../types';
import { getPlanRateLimits } from '../constants';

// ======================
// ICONS
// ======================

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const TabKeyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const LinkIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const TerminalIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// ======================
// TYPES
// ======================

export interface APIKeysSectionProps {
  vertical?: Vertical;
  plan?: string;
  className?: string;
}

type FilterStatus = 'all' | 'active' | 'revoked' | 'expired';
type FilterEnvironment = 'all' | APIKeyEnvironment;
type SectionTab = 'keys' | 'docs' | 'sandbox';

// ======================
// HELPER FUNCTIONS
// ======================

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ======================
// SUB-COMPONENTS
// ======================

interface EmptyStateProps {
  onCreateClick: () => void;
}

function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
        <KeyIcon />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No tienes API Keys
      </h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Crea tu primera API Key para comenzar a integrar tu aplicación con nuestra
        plataforma.
      </p>
      <Button variant="primary" onClick={onCreateClick} leftIcon={<PlusIcon />}>
        Crear API Key
      </Button>
    </div>
  );
}

interface FilterBarProps {
  statusFilter: FilterStatus;
  environmentFilter: FilterEnvironment;
  onStatusChange: (status: FilterStatus) => void;
  onEnvironmentChange: (env: FilterEnvironment) => void;
  onRefresh: () => void;
  loading: boolean;
}

function FilterBar({
  statusFilter,
  environmentFilter,
  onStatusChange,
  onEnvironmentChange,
  onRefresh,
  loading,
}: FilterBarProps) {
  const statusOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Activas' },
    { value: 'revoked', label: 'Revocadas' },
    { value: 'expired', label: 'Expiradas' },
  ];

  const envOptions: { value: FilterEnvironment; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'live', label: 'Live' },
    { value: 'test', label: 'Test' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span aria-hidden="true"><FilterIcon /></span>
        <span className="text-sm text-gray-500" id="status-filter-label">Estado:</span>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="radiogroup" aria-labelledby="status-filter-label">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              role="radio"
              aria-checked={statusFilter === option.value}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                statusFilter === option.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Environment Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500" id="env-filter-label">Entorno:</span>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="radiogroup" aria-labelledby="env-filter-label">
          {envOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onEnvironmentChange(option.value)}
              role="radio"
              aria-checked={environmentFilter === option.value}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                environmentFilter === option.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={loading}
        className={cn(
          'p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-auto',
          loading && 'animate-spin'
        )}
        title="Actualizar"
        aria-label="Actualizar lista de API Keys"
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

interface KeysListProps {
  keys: APIKeyListItem[];
  onViewDetails: (key: APIKeyListItem) => void;
  onRevoke: (key: APIKeyListItem) => void;
}

function KeysList({ keys, onViewDetails, onRevoke }: KeysListProps) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No se encontraron API Keys con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keys.map((key) => (
        <APIKeyCard
          key={key.id}
          apiKey={key}
          onViewDetails={() => onViewDetails(key)}
          onRevoke={() => onRevoke(key)}
        />
      ))}
    </div>
  );
}

// ======================
// INTEGRATION INFO COMPONENT
// ======================

interface IntegrationInfoProps {
  tenantId: string | null;
  webhookUrl: string;
  onViewDocs?: () => void;
}

function IntegrationInfo({ tenantId, webhookUrl, onViewDocs }: IntegrationInfoProps) {
  const [copiedField, setCopiedField] = useState<'webhook' | 'tenant' | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async (value: string, field: 'webhook' | 'tenant') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout with cleanup reference
      timeoutRef.current = setTimeout(() => {
        setCopiedField(null);
        timeoutRef.current = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <LinkIcon />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Información de Integración
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Usa estos datos para integrar tu aplicación
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Webhook URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Webhook URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-600 dark:text-gray-300 text-sm font-mono truncate"
              />
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, 'webhook')}
                className={cn(
                  'p-2.5 rounded-xl transition-all duration-200',
                  copiedField === 'webhook'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : 'text-gray-500 hover:text-tis-coral hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
                title={copiedField === 'webhook' ? 'Copiado!' : 'Copiar URL'}
                aria-label="Copiar Webhook URL"
              >
                {copiedField === 'webhook' ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              URL para recibir eventos de tu aplicación
            </p>
          </div>

          {/* Tenant ID */}
          {tenantId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tenant ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tenantId}
                  readOnly
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-600 dark:text-gray-300 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(tenantId, 'tenant')}
                  className={cn(
                    'p-2.5 rounded-xl transition-all duration-200',
                    copiedField === 'tenant'
                      ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                      : 'text-gray-500 hover:text-tis-coral hover:bg-gray-100 dark:hover:bg-slate-700'
                  )}
                  title={copiedField === 'tenant' ? 'Copiado!' : 'Copiar ID'}
                  aria-label="Copiar Tenant ID"
                >
                  {copiedField === 'tenant' ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Identificador único de tu organización
              </p>
            </div>
          )}
        </div>

        {/* Documentation Link */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onViewDocs}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            <BookIcon />
            <span>Ver documentación de la API</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function APIKeysSection({
  vertical = 'dental',
  plan = 'starter',
  className,
}: APIKeysSectionProps) {
  // Get tenant context
  const { staff } = useAuthContext();
  const tenantId = staff?.tenant_id || null;

  // State for client-side origin to prevent hydration mismatch
  const [origin, setOrigin] = useState<string>('');

  // Set origin on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Generate webhook URL based on tenant
  // Uses origin state to ensure consistent SSR/CSR rendering
  const webhookUrl = tenantId
    ? origin
      ? `${origin}/api/v1/webhook/${tenantId}`
      : `/api/v1/webhook/${tenantId}`
    : '';

  // API Keys state
  const {
    keys,
    loading,
    error,
    refresh,
    createKey,
    updateKey,
    revokeKey,
    rotateKey,
  } = useAPIKeys();

  // Tab state
  const [activeTab, setActiveTab] = useState<SectionTab>('keys');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<FilterEnvironment>('all');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);

  // Detail modal data
  const { key: selectedKeyDetail, loading: detailLoading, refresh: refreshDetail } = useAPIKeyDetail(
    selectedKeyId
  );

  // Revoke confirmation
  const [keyToRevoke, setKeyToRevoke] = useState<APIKeyListItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Get plan limits
  const limits = getPlanRateLimits(plan);

  // Filter keys
  const filteredKeys = keys.filter((key) => {
    // Status filter
    if (statusFilter === 'active') {
      if (!key.is_active || isExpired(key.expires_at)) return false;
    } else if (statusFilter === 'revoked') {
      if (key.is_active) return false;
    } else if (statusFilter === 'expired') {
      if (!isExpired(key.expires_at)) return false;
    }

    // Environment filter
    if (environmentFilter !== 'all' && key.environment !== environmentFilter) {
      return false;
    }

    return true;
  });

  // Handlers
  const handleViewDetails = (key: APIKeyListItem) => {
    setSelectedKeyId(key.id);
  };

  const handleCloseDetail = () => {
    setSelectedKeyId(null);
  };

  const handleRevokeFromCard = (key: APIKeyListItem) => {
    setKeyToRevoke(key);
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;

    setRevoking(true);
    try {
      await revokeKey(keyToRevoke.id);
      setKeyToRevoke(null);
    } catch {
      // Error is shown in the main error state from the hook
    } finally {
      setRevoking(false);
    }
  };

  const handleUpdateKey = async (id: string, data: Parameters<typeof updateKey>[1]) => {
    await updateKey(id, data);
    // Refresh the detail view
    if (selectedKeyId === id) {
      await refreshDetail();
    }
  };

  const handleRevokeFromDetail = async (id: string, reason?: string) => {
    await revokeKey(id, reason);
    setSelectedKeyId(null);
  };

  const handleRotateKey = async (id: string, gracePeriodHours?: number) => {
    const result = await rotateKey(id, gracePeriodHours);
    // Close the modal after rotation
    setSelectedKeyId(null);
    return result;
  };

  // Active keys count for limit display
  const activeKeysCount = keys.filter((k) => k.is_active && !isExpired(k.expires_at)).length;
  const canCreateMore = activeKeysCount < limits.max_keys;

  // Tab definitions
  const tabs: { id: SectionTab; label: string; icon: React.ReactNode }[] = [
    { id: 'keys', label: 'API Keys', icon: <TabKeyIcon /> },
    { id: 'docs', label: 'Documentación', icon: <BookIcon /> },
    { id: 'sandbox', label: 'Sandbox', icon: <TerminalIcon /> },
  ];

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las claves de acceso para tu API.
            {limits.max_keys > 0 && (
              <span className="ml-1">
                ({activeKeysCount}/{limits.max_keys} activas)
              </span>
            )}
          </p>
        </div>
        {activeTab === 'keys' && (
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<PlusIcon />}
            disabled={!canCreateMore}
          >
            Nueva API Key
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="-mb-px flex gap-6" role="tablist" aria-label="Secciones de API">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <span className={cn(
                'w-5 h-5',
                activeTab === tab.id ? 'text-blue-500' : 'text-gray-400'
              )}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content: Keys */}
      {activeTab === 'keys' && (
        <div
          role="tabpanel"
          id="tabpanel-keys"
          aria-labelledby="tab-keys"
          className="space-y-6"
        >
          {/* Integration Info (Webhook URL & Tenant ID) */}
          {webhookUrl && (
            <IntegrationInfo
              tenantId={tenantId}
              webhookUrl={webhookUrl}
              onViewDocs={() => setActiveTab('docs')}
            />
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
              <p className="font-medium">Error al cargar las API Keys</p>
              <p className="text-sm mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="mt-3"
              >
                Reintentar
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && keys.length === 0 ? (
            <Card className="p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            </Card>
          ) : keys.length === 0 ? (
            <Card className="p-8">
              <EmptyState onCreateClick={() => setShowCreateModal(true)} />
            </Card>
          ) : (
            <>
              {/* Filter Bar */}
              <FilterBar
                statusFilter={statusFilter}
                environmentFilter={environmentFilter}
                onStatusChange={setStatusFilter}
                onEnvironmentChange={setEnvironmentFilter}
                onRefresh={refresh}
                loading={loading}
              />

              {/* Keys List */}
              <KeysList
                keys={filteredKeys}
                onViewDetails={handleViewDetails}
                onRevoke={handleRevokeFromCard}
              />
            </>
          )}

          {/* Plan Limit Warning */}
          {!canCreateMore && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 font-medium">
                Has alcanzado el límite de API Keys
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Tu plan {plan} permite hasta {limits.max_keys} API Keys activas.
                Revoca una key existente o actualiza tu plan para crear más.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Documentation */}
      {activeTab === 'docs' && (
        <div
          role="tabpanel"
          id="tabpanel-docs"
          aria-labelledby="tab-docs"
        >
          <Card className="p-6 bg-zinc-950 border-zinc-800">
            <APIDocumentation
              tenantId={tenantId}
              baseUrl={origin}
            />
          </Card>
        </div>
      )}

      {/* Tab Content: Sandbox */}
      {activeTab === 'sandbox' && (
        <div
          role="tabpanel"
          id="tabpanel-sandbox"
          aria-labelledby="tab-sandbox"
        >
          <Card className="p-6 bg-zinc-950 border-zinc-800">
            <APISandbox
              tenantId={tenantId}
              baseUrl={origin}
            />
          </Card>
        </div>
      )}

      {/* Create Modal */}
      <CreateAPIKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createKey}
        vertical={vertical}
        maxRpm={limits.max_rpm}
        maxDaily={limits.max_daily}
        defaultRpm={limits.default_rpm}
        defaultDaily={limits.default_daily}
      />

      {/* Detail Modal */}
      <APIKeyDetailModal
        isOpen={!!selectedKeyId}
        onClose={handleCloseDetail}
        apiKey={selectedKeyDetail}
        onUpdate={handleUpdateKey}
        onRevoke={handleRevokeFromDetail}
        onRotate={handleRotateKey}
        vertical={vertical}
        loading={detailLoading}
      />

      {/* Revoke Confirmation Modal */}
      <Modal
        isOpen={!!keyToRevoke}
        onClose={() => setKeyToRevoke(null)}
        title="¿Revocar API Key?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Estás a punto de revocar la key &quot;{keyToRevoke?.name}&quot;.
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setKeyToRevoke(null)}
              disabled={revoking}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRevoke}
              isLoading={revoking}
            >
              Revocar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
