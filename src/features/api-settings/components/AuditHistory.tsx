// =====================================================
// TIS TIS PLATFORM - Audit History Component
// Displays audit log history for API Keys
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { Badge } from '@/shared/components/ui/Badge';
import { cn } from '@/shared/utils';
import type {
  AuditLogListItem,
  AuditAction,
  AuditSeverity,
  AuditStatus,
  AuditLogFilters,
} from '../types';
import { fetchAuditLogs } from '../services/auditLog.service';

// ======================
// ICONS
// ======================

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

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Audit action icons
const ActionIcons: Record<string, () => JSX.Element> = {
  'api_key.created': () => (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  'api_key.updated': () => (
    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  'api_key.revoked': () => (
    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  'api_key.rotated': () => (
    <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  'api_key.auth_failed': () => (
    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  'api_key.rate_limited': () => (
    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'api_key.ip_blocked': () => (
    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
    </svg>
  ),
  default: () => (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================

export interface AuditHistoryProps {
  keyId?: string;
  className?: string;
  compact?: boolean;
  limit?: number;
}

// ======================
// CONSTANTS
// ======================

const ACTION_LABELS: Record<AuditAction, string> = {
  'api_key.created': 'API Key creada',
  'api_key.updated': 'API Key actualizada',
  'api_key.revoked': 'API Key revocada',
  'api_key.rotated': 'API Key rotada',
  'api_key.viewed': 'API Key vista',
  'api_key.used': 'API Key usada',
  'api_key.rate_limited': 'Rate limit alcanzado',
  'api_key.auth_failed': 'Autenticación fallida',
  'api_key.ip_blocked': 'IP bloqueada',
  'api_key.scope_denied': 'Scope denegado',
  'api_key.expired': 'API Key expirada',
};

const SEVERITY_BADGE_VARIANTS: Record<AuditSeverity, 'default' | 'info' | 'warning' | 'danger'> = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  critical: 'danger',
};

const STATUS_BADGE_VARIANTS: Record<AuditStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  success: 'success',
  failure: 'danger',
  blocked: 'warning',
};

// ======================
// HELPER FUNCTIONS
// ======================

function formatRelativeTime(dateString: string): string {
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

  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionIcon(action: AuditAction): () => JSX.Element {
  return ActionIcons[action] || ActionIcons.default;
}

// ======================
// SUB-COMPONENTS
// ======================

interface AuditLogItemProps {
  log: AuditLogListItem;
  compact?: boolean;
}

function AuditLogItem({ log, compact = false }: AuditLogItemProps) {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = getActionIcon(log.action);

  return (
    <div
      className={cn(
        'border-b border-gray-100 last:border-b-0',
        compact ? 'py-2' : 'py-3'
      )}
    >
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div className="mt-0.5">
          <IconComponent />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-medium', compact ? 'text-sm' : 'text-base')}>
              {ACTION_LABELS[log.action] || log.action}
            </span>
            {log.metadata?.key_name && (
              <span className="text-gray-500 text-sm">
                - {log.metadata.key_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-gray-500">
              {formatRelativeTime(log.created_at)}
            </span>
            {log.actor_email && (
              <span className="text-xs text-gray-400">
                por {log.actor_email}
              </span>
            )}
            {log.ip_address && (
              <code className="text-xs text-gray-400 font-mono">
                {log.ip_address}
              </code>
            )}
          </div>

          {log.metadata?.error_message && (
            <p className="text-xs text-red-600 mt-1">
              {log.metadata.error_message}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANTS[log.status]} className="text-xs">
            {log.status === 'success' ? 'OK' : log.status === 'failure' ? 'Error' : 'Bloqueado'}
          </Badge>
          <ChevronDownIcon />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 ml-7 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">ID:</span>
              <code className="ml-2 text-xs font-mono">{log.id.slice(0, 8)}...</code>
            </div>
            <div>
              <span className="text-gray-500">Severidad:</span>
              <Badge variant={SEVERITY_BADGE_VARIANTS[log.severity]} className="ml-2 text-xs">
                {log.severity}
              </Badge>
            </div>
            {log.metadata?.endpoint && (
              <div className="col-span-2">
                <span className="text-gray-500">Endpoint:</span>
                <code className="ml-2 text-xs font-mono">{log.metadata.endpoint}</code>
              </div>
            )}
            {log.resource_id && (
              <div className="col-span-2">
                <span className="text-gray-500">Key ID:</span>
                <code className="ml-2 text-xs font-mono">{log.resource_id}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function AuditHistory({
  keyId,
  className,
  compact = false,
  limit = 50,
}: AuditHistoryProps) {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | 'all'>('all');

  // Load logs
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: AuditLogFilters = {
        limit,
      };

      if (keyId) {
        filters.key_id = keyId;
      }

      if (actionFilter !== 'all') {
        filters.action = actionFilter;
      }

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      const response = await fetchAuditLogs(filters);
      setLogs(response.logs);
      setHasMore(response.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [keyId, limit, actionFilter, statusFilter]);

  // Initial load
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Loading state
  if (loading && logs.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="text-sm text-gray-500 mt-2">Cargando historial...</p>
      </div>
    );
  }

  // Error state
  if (error && logs.length === 0) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-sm text-red-600 mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={loadLogs}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">
          Historial de actividad
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<FilterIcon />}
          >
            Filtros
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
            leftIcon={<RefreshIcon />}
          >
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg flex gap-4 flex-wrap">
          <div>
            <label htmlFor="action-filter" className="block text-xs text-gray-500 mb-1">
              Acción
            </label>
            <select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as AuditAction | 'all')}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">Todas</option>
              <option value="api_key.created">Creadas</option>
              <option value="api_key.updated">Actualizadas</option>
              <option value="api_key.revoked">Revocadas</option>
              <option value="api_key.rotated">Rotadas</option>
              <option value="api_key.auth_failed">Auth fallidas</option>
              <option value="api_key.rate_limited">Rate limited</option>
              <option value="api_key.ip_blocked">IP bloqueadas</option>
            </select>
          </div>
          <div>
            <label htmlFor="status-filter" className="block text-xs text-gray-500 mb-1">
              Estado
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AuditStatus | 'all')}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">Todos</option>
              <option value="success">Exitosos</option>
              <option value="failure">Fallidos</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>
        </div>
      )}

      {/* Log List */}
      {logs.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">
            No hay eventos de auditoría registrados
            {keyId ? ' para esta API Key' : ''}.
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {logs.map((log) => (
            <AuditLogItem key={log.id} log={log} compact={compact} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" onClick={() => {/* TODO: implement pagination */}}>
            Cargar más
          </Button>
        </div>
      )}

      {/* Error Toast */}
      {error && logs.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
