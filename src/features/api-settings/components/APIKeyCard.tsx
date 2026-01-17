// =====================================================
// TIS TIS PLATFORM - API Key Card Component
// Individual card for displaying an API Key
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import type { APIKeyListItem, APIKeyEnvironment } from '../types';

// ======================
// ICONS
// ======================

const KeyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ======================
// HELPER FUNCTIONS
// ======================

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Nunca';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Nunca';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return formatDate(dateString);
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  return diffDays > 0 && diffDays <= 7;
}

// ======================
// TYPES
// ======================

export interface APIKeyCardProps {
  apiKey: APIKeyListItem;
  onViewDetails: (id: string) => void;
  onRevoke: (id: string) => void;
  className?: string;
}

// ======================
// COMPONENT
// ======================

export function APIKeyCard({
  apiKey,
  onViewDetails,
  onRevoke,
  className,
}: APIKeyCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyHint = async () => {
    try {
      // Copy prefix + hint for context (e.g., "tis_live_...a4f7")
      const displayKey = `${apiKey.key_prefix}...${apiKey.key_hint}`;
      await navigator.clipboard.writeText(displayKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const expired = isExpired(apiKey.expires_at);
  const expiringSoon = isExpiringSoon(apiKey.expires_at);
  const isInactive = !apiKey.is_active || expired;

  return (
    <div
      className={cn(
        'bg-white border rounded-xl p-4 transition-all',
        isInactive
          ? 'border-gray-200 bg-gray-50 opacity-75'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'p-2 rounded-lg',
              apiKey.environment === 'live'
                ? 'bg-green-100 text-green-600'
                : 'bg-amber-100 text-amber-600'
            )}
          >
            <KeyIcon />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{apiKey.name}</h3>
            {apiKey.description && (
              <p className="text-sm text-gray-500 truncate">{apiKey.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <EnvironmentBadge environment={apiKey.environment} />
          <StatusBadge isActive={apiKey.is_active} expired={expired} />
        </div>
      </div>

      {/* Key Hint */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-lg border border-gray-100">
        <code className="flex-1 text-sm text-gray-600 font-mono truncate">
          {apiKey.key_prefix}...{apiKey.key_hint}
        </code>
        <button
          onClick={handleCopyHint}
          className={cn(
            'p-1.5 rounded transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center',
            copied
              ? 'text-green-600 bg-green-50'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          )}
          title={copied ? 'Copiado!' : 'Copiar hint'}
          aria-label={copied ? 'Copiado al portapapeles' : 'Copiar identificador de API Key'}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-700">{apiKey.usage_count.toLocaleString()}</span>
          <span>requests</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ClockIcon />
          <span>Usado {formatRelativeTime(apiKey.last_used_at)}</span>
        </div>
      </div>

      {/* Expiration Warning */}
      {expiringSoon && !expired && (
        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <span className="font-medium">Expira pronto:</span> {formatDate(apiKey.expires_at)}
        </div>
      )}
      {expired && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <span className="font-medium">Expirada:</span> {formatDate(apiKey.expires_at)}
        </div>
      )}

      {/* Scopes Preview */}
      {apiKey.scopes && apiKey.scopes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {apiKey.scopes.slice(0, 3).map((scope) => (
            <span
              key={scope}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {scope}
            </span>
          ))}
          {apiKey.scopes.length > 3 && (
            <span className="px-2 py-0.5 text-gray-500 text-xs">
              +{apiKey.scopes.length - 3} más
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(apiKey.id)}
          leftIcon={<EyeIcon />}
          className="flex-1"
        >
          Ver Detalles
        </Button>
        {apiKey.is_active && !expired && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevoke(apiKey.id)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            aria-label={`Revocar API Key ${apiKey.name}`}
          >
            <TrashIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

// ======================
// SUB-COMPONENTS
// ======================

function EnvironmentBadge({ environment }: { environment: APIKeyEnvironment }) {
  return (
    <Badge
      variant={environment === 'live' ? 'success' : 'warning'}
      size="sm"
    >
      {environment === 'live' ? 'Live' : 'Test'}
    </Badge>
  );
}

function StatusBadge({ isActive, expired }: { isActive: boolean; expired: boolean }) {
  if (!isActive) {
    return (
      <Badge variant="default" size="sm">
        Revocada
      </Badge>
    );
  }
  if (expired) {
    return (
      <Badge variant="danger" size="sm">
        Expirada
      </Badge>
    );
  }
  return (
    <Badge variant="success" size="sm" dot>
      Activa
    </Badge>
  );
}
