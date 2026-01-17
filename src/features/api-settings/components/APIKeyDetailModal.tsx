// =====================================================
// TIS TIS PLATFORM - API Key Detail Modal
// Modal for viewing and editing API Key details
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Badge } from '@/shared/components/ui/Badge';
import { cn } from '@/shared/utils';
import { ScopeSelector, ScopeDisplay } from './ScopeSelector';
import { useScopeSelector } from '../hooks/useAPIKeys';
import type {
  APIKeyWithCreator,
  UpdateAPIKeyRequest,
  Vertical,
  APIScope,
} from '../types';

// ======================
// ICONS
// ======================

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const GlobeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// ======================
// TYPES
// ======================

export interface APIKeyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: APIKeyWithCreator | null;
  onUpdate: (id: string, data: UpdateAPIKeyRequest) => Promise<void>;
  onRevoke: (id: string, reason?: string) => Promise<void>;
  vertical?: Vertical;
  loading?: boolean;
}

type Tab = 'details' | 'usage' | 'security';

interface UsageDataPoint {
  date: string;
  requests: number;
}

// ======================
// HELPER FUNCTIONS
// ======================

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Nunca';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;

  return formatDate(dateString);
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expDate = new Date(expiresAt);
  const now = new Date();
  const daysUntilExpiry = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
}

// Generate mock usage data for visualization
function generateMockUsageData(usageCount: number): UsageDataPoint[] {
  const data: UsageDataPoint[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Distribute usage somewhat randomly across days
    const dayRequests = Math.floor((usageCount / 7) * (0.5 + Math.random()));

    data.push({
      date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      requests: Math.max(0, dayRequests),
    });
  }

  return data;
}

// ======================
// SUB-COMPONENTS
// ======================

interface UsageBarChartProps {
  data: UsageDataPoint[];
  maxValue: number;
}

function UsageBarChart({ data, maxValue }: UsageBarChartProps) {
  const barMaxHeight = 100;

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((point, index) => {
        const heightPercent = maxValue > 0 ? (point.requests / maxValue) * 100 : 0;
        const barHeight = Math.max(4, (heightPercent / 100) * barMaxHeight);

        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-gray-500 font-medium">
              {point.requests}
            </div>
            <div
              className="w-full bg-blue-500 rounded-t transition-all duration-300"
              style={{ height: `${barHeight}px` }}
            />
            <div className="text-xs text-gray-400 truncate max-w-full">
              {point.date}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function StatCard({ label, value, icon, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-gray-50 text-gray-600',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  };

  return (
    <div className={cn('p-4 rounded-xl', variantStyles[variant])}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function APIKeyDetailModal({
  isOpen,
  onClose,
  apiKey,
  onUpdate,
  onRevoke,
  vertical = 'dental',
  loading = false,
}: APIKeyDetailModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRateLimitRpm, setEditRateLimitRpm] = useState(60);
  const [editRateLimitDaily, setEditRateLimitDaily] = useState(1000);

  // Scope editor
  const {
    scopeGroups,
    selectedScopes,
    setScopes: setSelectedScopes,
    toggleScope,
    selectPreset,
    selectAll,
    clearAll,
  } = useScopeSelector(vertical);

  // Revoke confirmation
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  // Update/revoke loading
  const [updating, setUpdating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize edit form when API key changes
  useEffect(() => {
    if (apiKey) {
      setEditName(apiKey.name);
      setEditDescription(apiKey.description || '');
      setEditRateLimitRpm(apiKey.rate_limit_rpm || 60);
      setEditRateLimitDaily(apiKey.rate_limit_daily || 1000);
      setSelectedScopes((apiKey.scopes || []) as APIScope[]);
    }
  }, [apiKey, setSelectedScopes]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('details');
      setIsEditing(false);
      setShowRevokeConfirm(false);
      setRevokeReason('');
      setError(null);
    }
  }, [isOpen]);

  // Handle save
  const handleSave = async () => {
    if (!apiKey) return;

    // Validate required fields
    if (!editName.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (selectedScopes.length === 0) {
      setError('Debes seleccionar al menos un permiso');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const updateData: UpdateAPIKeyRequest = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        scopes: selectedScopes,
        rate_limit_rpm: editRateLimitRpm,
        rate_limit_daily: editRateLimitDaily,
      };

      await onUpdate(apiKey.id, updateData);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setUpdating(false);
    }
  };

  // Handle revoke
  const handleRevoke = async () => {
    if (!apiKey) return;

    setRevoking(true);
    setError(null);

    try {
      await onRevoke(apiKey.id, revokeReason.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al revocar');
      setRevoking(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    if (apiKey) {
      setEditName(apiKey.name);
      setEditDescription(apiKey.description || '');
      setEditRateLimitRpm(apiKey.rate_limit_rpm || 60);
      setEditRateLimitDaily(apiKey.rate_limit_daily || 1000);
      setSelectedScopes((apiKey.scopes || []) as APIScope[]);
    }
    setIsEditing(false);
    setError(null);
  };

  if (!apiKey) return null;

  const expired = isExpired(apiKey.expires_at);
  const expiringSoon = isExpiringSoon(apiKey.expires_at);
  const isActive = apiKey.is_active && !expired;
  const usageData = generateMockUsageData(apiKey.usage_count || 0);
  const maxUsage = Math.max(...usageData.map((d) => d.requests), 1);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Detalles' },
    { id: 'usage', label: 'Uso' },
    { id: 'security', label: 'Seguridad' },
  ];

  // Build subtitle text
  const subtitleText = !apiKey.is_active
    ? 'API Key revocada'
    : expired
      ? 'API Key expirada'
      : expiringSoon
        ? 'API Key activa - Expira pronto'
        : 'API Key activa';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={apiKey.name}
      subtitle={subtitleText}
      size="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : showRevokeConfirm ? (
        /* Revoke Confirmation */
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <h3 className="font-semibold text-red-800 mb-2">
              ¿Revocar esta API Key?
            </h3>
            <p className="text-sm text-red-700">
              Esta acción desactivará permanentemente la API Key. Las aplicaciones
              que la utilicen dejarán de funcionar inmediatamente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Motivo (opcional)
            </label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Ej: Key comprometida, ya no se necesita, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowRevokeConfirm(false)}
              disabled={revoking}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleRevoke}
              isLoading={revoking}
              leftIcon={<TrashIcon />}
            >
              Revocar API Key
            </Button>
          </div>
        </div>
      ) : (
        /* Main Content */
        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <Badge variant={apiKey.environment === 'live' ? 'success' : 'warning'}>
              {apiKey.environment === 'live' ? 'Live' : 'Test'}
            </Badge>
            {!apiKey.is_active ? (
              <Badge variant="danger">Revocada</Badge>
            ) : expired ? (
              <Badge variant="danger">Expirada</Badge>
            ) : expiringSoon ? (
              <Badge variant="warning">Expira pronto</Badge>
            ) : (
              <Badge variant="success">Activa</Badge>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg" role="tablist" aria-label="Secciones de la API Key">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <div className="space-y-6" role="tabpanel" id="tabpanel-details" aria-labelledby="tab-details">
              {/* Key Info */}
              <div className="p-4 bg-gray-900 rounded-xl">
                <label className="block text-xs text-gray-400 mb-1">API Key</label>
                <code className="text-green-400 font-mono text-sm">
                  {apiKey.key_prefix}...{apiKey.key_hint}
                </code>
              </div>

              {/* Basic Info */}
              {isEditing ? (
                <div className="space-y-4">
                  <Input
                    label="Nombre"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Descripción
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKey.description && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                      <p className="text-gray-700">{apiKey.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Creado</label>
                      <p className="text-sm text-gray-700">{formatDate(apiKey.created_at)}</p>
                    </div>
                    {apiKey.created_by_user && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Creado por</label>
                        <p className="text-sm text-gray-700">
                          {apiKey.created_by_user.full_name || apiKey.created_by_user.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rate Limits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Límites de uso
                </label>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Peticiones por minuto
                      </label>
                      <input
                        type="number"
                        value={editRateLimitRpm}
                        onChange={(e) => setEditRateLimitRpm(Number(e.target.value))}
                        min={1}
                        max={1000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Peticiones diarias
                      </label>
                      <input
                        type="number"
                        value={editRateLimitDaily}
                        onChange={(e) => setEditRateLimitDaily(Number(e.target.value))}
                        min={100}
                        max={1000000}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Por minuto</div>
                      <div className="text-lg font-semibold">{apiKey.rate_limit_rpm} RPM</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Por día</div>
                      <div className="text-lg font-semibold">
                        {apiKey.rate_limit_daily?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Scopes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Permisos
                </label>
                {isEditing ? (
                  <ScopeSelector
                    scopeGroups={scopeGroups}
                    selectedScopes={selectedScopes}
                    onToggleScope={toggleScope}
                    onSelectPreset={selectPreset}
                    onSelectAll={selectAll}
                    onClearAll={clearAll}
                  />
                ) : (
                  <ScopeDisplay scopes={apiKey.scopes} />
                )}
              </div>
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-6" role="tabpanel" id="tabpanel-usage" aria-labelledby="tab-usage">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Total de peticiones"
                  value={(apiKey.usage_count || 0).toLocaleString()}
                  icon={<ChartIcon />}
                />
                <StatCard
                  label="Último uso"
                  value={formatRelativeTime(apiKey.last_used_at)}
                  icon={<ClockIcon />}
                  variant={apiKey.last_used_at ? 'success' : 'default'}
                />
              </div>

              {/* Usage Chart */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Uso en los últimos 7 días
                </h4>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <UsageBarChart data={usageData} maxValue={maxUsage} />
                </div>
              </div>

              {/* Last Used Info */}
              {apiKey.last_used_at && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Último acceso
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Fecha:</span>
                      <span className="ml-2 text-gray-900">
                        {formatDate(apiKey.last_used_at)}
                      </span>
                    </div>
                    {apiKey.last_used_ip && (
                      <div>
                        <span className="text-gray-500">IP:</span>
                        <code className="ml-2 text-gray-900 font-mono">
                          {apiKey.last_used_ip}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6" role="tabpanel" id="tabpanel-security" aria-labelledby="tab-security">
              {/* Expiration */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ClockIcon />
                  <h4 className="font-medium text-gray-900">Expiración</h4>
                </div>
                {apiKey.expires_at ? (
                  <div>
                    <p
                      className={cn(
                        'text-sm',
                        expired
                          ? 'text-red-600'
                          : expiringSoon
                            ? 'text-amber-600'
                            : 'text-gray-600'
                      )}
                    >
                      {expired
                        ? `Expiró el ${formatDate(apiKey.expires_at)}`
                        : `Expira el ${formatDate(apiKey.expires_at)}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Sin fecha de expiración</p>
                )}
              </div>

              {/* IP Whitelist */}
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <GlobeIcon />
                  <h4 className="font-medium text-gray-900">Lista blanca de IPs</h4>
                </div>
                {apiKey.ip_whitelist && apiKey.ip_whitelist.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {apiKey.ip_whitelist.map((ip, index) => (
                      <code
                        key={index}
                        className="px-2 py-1 bg-gray-200 text-gray-700 text-sm rounded font-mono"
                      >
                        {ip}
                      </code>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Acceso permitido desde cualquier IP
                  </p>
                )}
              </div>

              {/* Creator Info */}
              {apiKey.created_by_user && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <UserIcon />
                    <h4 className="font-medium text-gray-900">Creado por</h4>
                  </div>
                  <p className="text-sm text-gray-600">
                    {apiKey.created_by_user.full_name || apiKey.created_by_user.email}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(apiKey.created_at)}
                  </p>
                </div>
              )}

              {/* Revocation Info (if revoked) */}
              {!apiKey.is_active && apiKey.revoked_at && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldIcon />
                    <h4 className="font-medium text-red-800">Revocada</h4>
                  </div>
                  <p className="text-sm text-red-700">
                    Revocada el {formatDate(apiKey.revoked_at)}
                  </p>
                  {apiKey.revoke_reason && (
                    <p className="text-sm text-red-600 mt-1">
                      Motivo: {apiKey.revoke_reason}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {isActive && (
            <div className="flex justify-between pt-4 border-t border-gray-100">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={updating}
                    leftIcon={<XIcon />}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    isLoading={updating}
                    leftIcon={<CheckIcon />}
                  >
                    Guardar cambios
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="danger"
                    onClick={() => setShowRevokeConfirm(true)}
                    leftIcon={<TrashIcon />}
                  >
                    Revocar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    leftIcon={<EditIcon />}
                  >
                    Editar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
