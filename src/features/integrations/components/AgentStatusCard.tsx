// =====================================================
// TIS TIS PLATFORM - Agent Status Card
// Displays the status and metrics of a TIS TIS Local Agent
// for Soft Restaurant integration
// =====================================================

'use client';

import { cn } from '@/src/shared/utils';
import type { AgentInstance, AgentStatus } from '../types/integration.types';

// ======================
// TYPES
// ======================

interface AgentStatusCardProps {
  agent: AgentInstance | null;
  onRefresh?: () => void;
  onConfigure?: () => void;
  isRefreshing?: boolean;
  compact?: boolean;
}

// ======================
// STATUS CONFIG
// ======================

const STATUS_CONFIG: Record<AgentStatus, {
  bg: string;
  text: string;
  dot: string;
  label: string;
  pulse: boolean;
}> = {
  pending: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    label: 'Pendiente',
    pulse: false,
  },
  registered: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    label: 'Registrado',
    pulse: false,
  },
  connected: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-500',
    label: 'Conectado',
    pulse: true,
  },
  syncing: {
    bg: 'bg-tis-coral/10 dark:bg-tis-coral/20',
    text: 'text-tis-coral',
    dot: 'bg-tis-coral',
    label: 'Sincronizando',
    pulse: true,
  },
  error: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
    label: 'Error',
    pulse: false,
  },
  offline: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
    label: 'Desconectado',
    pulse: false,
  },
};

// ======================
// ICONS
// ======================

function ComputerDesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    </svg>
  );
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function CogIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ArrowPathIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ======================
// HELPERS
// ======================

function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return 'Nunca';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Hace unos segundos';
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  });
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('es-MX');
}

// ======================
// STATUS BADGE
// ======================

function StatusBadge({ status }: { status: AgentStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          config.dot,
          config.pulse && 'animate-pulse'
        )}
      />
      {config.label}
    </span>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function AgentStatusCard({
  agent,
  onRefresh,
  onConfigure,
  isRefreshing = false,
  compact = false,
}: AgentStatusCardProps) {
  // If no agent, show empty state
  if (!agent) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#2f2f2f] flex items-center justify-center">
            <ComputerDesktopIcon className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Agente Local</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">No hay agente configurado</p>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[agent.status];

  // Compact version for inline display
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#262626] rounded-lg">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full',
              statusConfig.dot,
              statusConfig.pulse && 'animate-pulse'
            )}
          />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Agente Local
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {agent.machine_name || agent.agent_id.substring(0, 12)}
            </p>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
    );
  }

  // Full version
  return (
    <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              statusConfig.dot,
              statusConfig.pulse && 'animate-pulse'
            )}
          />

          {/* Info */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Agente Local TIS TIS
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {agent.machine_name || 'Sin nombre'} • v{agent.agent_version}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <StatusBadge status={agent.status} />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              aria-label="Actualizar estado del agente"
            >
              <ArrowPathIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </button>
          )}
          {onConfigure && (
            <button
              type="button"
              onClick={onConfigure}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Configurar agente"
            >
              <CogIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-[#404040]">
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(agent.total_records_synced)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Registros sincronizados</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {agent.sync_interval_seconds}s
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Intervalo</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {agent.consecutive_errors || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Errores consecutivos</p>
        </div>
      </div>

      {/* Last sync info */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-[#404040]">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <ClockIcon className="w-3.5 h-3.5" />
          <span>Última sincronización: {formatRelativeTime(agent.last_sync_at)}</span>
        </div>
        {agent.last_sync_records > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {agent.last_sync_records} registros
          </span>
        )}
      </div>

      {/* SR Info */}
      {agent.sr_version && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#404040]">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>
              <strong>Soft Restaurant:</strong> {agent.sr_version}
            </p>
            {agent.sr_database_name && (
              <p>
                <strong>Base de datos:</strong> {agent.sr_database_name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {agent.status === 'error' && agent.last_error_message && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/30">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                Error de sincronización
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                {agent.last_error_message}
              </p>
              {agent.last_error_at && (
                <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                  {formatRelativeTime(agent.last_error_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync capabilities */}
      <div className="mt-4 flex flex-wrap gap-2">
        {agent.sync_sales && (
          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
            Ventas
          </span>
        )}
        {agent.sync_menu && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
            Menú
          </span>
        )}
        {agent.sync_inventory && (
          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
            Inventario
          </span>
        )}
        {agent.sync_tables && (
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
            Mesas
          </span>
        )}
      </div>
    </div>
  );
}
