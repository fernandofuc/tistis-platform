// =====================================================
// TIS TIS PLATFORM - API Keys List Component
// FASE 2: Branch-aware display with elegant design
// =====================================================

'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/shared/components/ui/Badge';
import { Button } from '@/shared/components/ui/Button';
import { cn } from '@/shared/utils';
import type { APIKeyListItem } from '../types';

// ======================
// TYPES
// ======================

interface APIKeysListProps {
  keys: APIKeyListItem[];
  onRevoke: (keyId: string) => void;
  onViewDetails?: (keyId: string) => void;
  isLoading?: boolean;
}

// ======================
// ICONS
// ======================

const GlobeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const BuildingIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
    />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// ======================
// COMPONENT
// ======================

export function APIKeysList({ keys, onRevoke, onViewDetails, isLoading }: APIKeysListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-100 rounded-xl h-32"
          />
        ))}
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <KeyIcon />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No hay API Keys creadas
        </h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Crea tu primera API Key para comenzar a integrar la plataforma TIS TIS con tus aplicaciones externas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div
          key={key.id}
          className={cn(
            'bg-white rounded-xl border transition-all duration-200',
            'hover:border-tis-coral/30 hover:shadow-md',
            key.is_active ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
          )}
        >
          <div className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {key.name}
                  </h3>

                  {/* Status Badge */}
                  {!key.is_active && (
                    <Badge variant="danger" size="sm">
                      Revocada
                    </Badge>
                  )}
                </div>

                {key.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {key.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {onViewDetails && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(key.id)}
                    className="hidden sm:flex"
                  >
                    Detalles
                  </Button>
                )}
                {key.is_active && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onRevoke(key.id)}
                  >
                    <TrashIcon />
                    <span className="hidden sm:inline ml-1.5">Revocar</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Branch Badge - FASE 2 */}
              {key.scope_type === 'branch' && key.branch_name ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg">
                  <BuildingIcon />
                  <span>{key.branch_name}</span>
                </div>
              ) : key.scope_type === 'tenant' ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                  <GlobeIcon />
                  <span>Todas las sucursales</span>
                </div>
              ) : null}

              {/* Environment Badge */}
              <div
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-lg',
                  key.environment === 'live'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-orange-50 text-orange-700'
                )}
              >
                {key.environment === 'live' ? 'LIVE' : 'TEST'}
              </div>

              {/* Scopes */}
              <div className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                {key.scopes.length} {key.scopes.length === 1 ? 'permiso' : 'permisos'}
              </div>
            </div>

            {/* Key Hint */}
            <div className="flex items-center gap-2 mb-3">
              <code className="px-3 py-1.5 bg-gray-100 text-gray-800 text-xs font-mono rounded-lg">
                {key.key_prefix}{key.key_hint}
              </code>
            </div>

            {/* Footer Info */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
              {/* Last Used */}
              {key.last_used_at ? (
                <div className="flex items-center gap-1.5">
                  <ClockIcon />
                  <span>
                    Usado{' '}
                    {formatDistanceToNow(new Date(key.last_used_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <ClockIcon />
                  <span>Nunca usada</span>
                </div>
              )}

              {/* Usage Count */}
              <div>
                {key.usage_count.toLocaleString('es-MX')} {key.usage_count === 1 ? 'uso' : 'usos'}
              </div>

              {/* Created */}
              <div>
                Creada{' '}
                {formatDistanceToNow(new Date(key.created_at), {
                  addSuffix: true,
                  locale: es,
                })}
              </div>
            </div>

            {/* Mobile Actions */}
            {onViewDetails && (
              <div className="mt-3 pt-3 border-t border-gray-100 sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(key.id)}
                  className="w-full"
                >
                  Ver Detalles
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
