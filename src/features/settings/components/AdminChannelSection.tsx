// =====================================================
// TIS TIS PLATFORM - Admin Channel Section Component
// Vinculación de WhatsApp/Telegram personal para notificaciones
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';

// =====================================================
// TYPES
// =====================================================

interface LinkedUser {
  id: string;
  phone_normalized: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  status: 'pending' | 'active' | 'suspended' | 'unlinked';
  linked_at: string | null;
  can_view_analytics: boolean;
  can_configure: boolean;
  can_receive_notifications: boolean;
  messages_today: number;
  last_message_at: string | null;
  staff?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

interface LinkCode {
  code: string;
  expiresAt: string;
  instructions: {
    whatsapp: string;
    telegram: string;
  };
}

type AdminChannelType = 'whatsapp' | 'telegram';

// API Response Types
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

interface LinkedUsersResponse extends ApiResponse<LinkedUser[]> {}

interface LinkCodeResponse extends ApiResponse<LinkCode> {}

// =====================================================
// ICONS
// =====================================================

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
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

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// =====================================================
// CHANNEL METADATA
// =====================================================

const CHANNEL_METADATA: Record<AdminChannelType, {
  name: string;
  description: string;
  bgColor: string;
  textColor: string;
  icon: typeof WhatsAppIcon;
}> = {
  whatsapp: {
    name: 'WhatsApp',
    description: 'Recibe alertas en tu WhatsApp personal',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600',
    icon: WhatsAppIcon,
  },
  telegram: {
    name: 'Telegram',
    description: 'Recibe alertas en tu cuenta de Telegram',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600',
    icon: TelegramIcon,
  },
};

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({ status }: { status: LinkedUser['status'] }) {
  const config = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Activo', dot: true },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendiente', dot: false },
    suspended: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspendido', dot: false },
    unlinked: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Desvinculado', dot: false },
  }[status];

  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
      {config.dot && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
      {config.label}
    </span>
  );
}

// =====================================================
// LINKED ACCOUNT CARD
// =====================================================

interface LinkedAccountCardProps {
  user: LinkedUser;
  channel: AdminChannelType;
  onUnlink: (userId: string) => void;
  isUnlinking: boolean;
}

function LinkedAccountCard({ user, channel, onUnlink, isUnlinking }: LinkedAccountCardProps) {
  const metadata = CHANNEL_METADATA[channel];
  const Icon = metadata.icon;

  const identifier = channel === 'whatsapp'
    ? user.phone_normalized
    : user.telegram_username
      ? `@${user.telegram_username}`
      : user.telegram_user_id;

  const displayName = user.staff
    ? `${user.staff.first_name} ${user.staff.last_name}`
    : identifier;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm', metadata.bgColor, metadata.textColor)}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold text-gray-900">
                  {displayName}
                </h4>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {identifier}
              </p>
            </div>
          </div>
          <StatusBadge status={user.status} />
        </div>

        {/* Permissions & Stats */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {user.can_receive_notifications && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg">
                <BellIcon className="w-3.5 h-3.5" />
                Alertas
              </span>
            )}
            {user.can_view_analytics && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">
                Analytics
              </span>
            )}
            {user.can_configure && (
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-lg">
                Config
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onUnlink(user.id)}
            disabled={isUnlinking}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Desvincular"
            aria-label="Desvincular dispositivo"
          >
            {isUnlinking ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <TrashIcon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// ADD CHANNEL CARD
// =====================================================

interface AddChannelCardProps {
  channel: AdminChannelType;
  onClick: () => void;
  isLoading?: boolean;
}

function AddChannelCard({ channel, onClick, isLoading = false }: AddChannelCardProps) {
  const metadata = CHANNEL_METADATA[channel];
  const Icon = metadata.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="w-full bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-tis-coral/50 hover:bg-gray-50/50 transition-all duration-200 p-8 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
    >
      <div className="flex flex-col items-center gap-3">
        <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center opacity-40', metadata.bgColor, metadata.textColor)}>
          <PlusIcon className="w-7 h-7" />
        </div>
        <div className="text-center">
          <p className="font-medium text-gray-700">
            Vincular {metadata.name}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {metadata.description}
          </p>
        </div>
      </div>
    </button>
  );
}

// =====================================================
// LINK CODE DISPLAY
// =====================================================

interface LinkCodeDisplayProps {
  linkCode: LinkCode;
  onClose: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function LinkCodeDisplay({ linkCode, onClose, onRefresh, isRefreshing }: LinkCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(linkCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for non-HTTPS or unsupported browsers
      console.error('Failed to copy to clipboard:', err);
    }
  }, [linkCode.code]);

  // Calculate remaining time
  const expiresAt = new Date(linkCode.expiresAt);
  const now = new Date();
  const minutesRemaining = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / 60000));

  return (
    <div className="bg-gradient-to-br from-tis-coral/5 to-purple-50 rounded-2xl border border-tis-coral/20 p-6">
      {/* Code Display */}
      <div className="flex items-center justify-center gap-4 p-6 bg-white rounded-xl shadow-sm mb-6">
        <div className="text-4xl font-mono font-bold tracking-[0.3em] text-gray-900">
          {linkCode.code}
        </div>
        <button
          type="button"
          onClick={copyCode}
          className={cn(
            'p-2 rounded-lg transition-all',
            copied
              ? 'bg-green-100 text-green-600'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
          aria-label={copied ? 'Código copiado' : 'Copiar código'}
        >
          {copied ? <CheckIcon className="w-5 h-5" aria-hidden="true" /> : <CopyIcon className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <WhatsAppIcon className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-800">WhatsApp</span>
          </div>
          <p className="text-sm text-green-700">
            Envía el código al número de <strong>TIS TIS</strong>
          </p>
        </div>

        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <TelegramIcon className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-800">Telegram</span>
          </div>
          <p className="text-sm text-blue-700">
            Envía el código a <strong>@TISTISBot</strong>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          El código expira en <span className="font-medium text-gray-700">{minutesRemaining} minutos</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={cn('w-4 h-4', isRefreshing && 'animate-spin')} aria-hidden="true" />
            Nuevo código
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// AUTH HELPER - Get session token for API calls
// =====================================================

async function getAuthHeaders(): Promise<HeadersInit | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('[AdminChannel] No session found');
      return null;
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  } catch (err) {
    console.error('[AdminChannel] Error getting session:', err);
    return null;
  }
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function AdminChannelSection() {
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch linked users
  const fetchLinkedUsers = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setError('Sesión no válida. Por favor, recarga la página.');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/admin-channel/link', { headers });
      const data: LinkedUsersResponse = await response.json();

      if (response.ok && data.data) {
        // Filter out unlinked users
        const activeUsers = data.data.filter(
          (u) => u.status !== 'unlinked'
        );
        setLinkedUsers(activeUsers);
        setError(null);
      } else {
        setError(data.error ?? 'Error al cargar dispositivos');
      }
    } catch (err) {
      console.error('Error fetching linked users:', err);
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinkedUsers();
  }, [fetchLinkedUsers]);

  // Generate link code
  const generateLinkCode = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setError('Sesión no válida. Por favor, recarga la página.');
        setIsGenerating(false);
        return;
      }

      const response = await fetch('/api/admin-channel/link', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data: LinkCodeResponse = await response.json();

      if (response.ok && data.data) {
        setLinkCode(data.data);
      } else {
        setError(data.error ?? 'Error generando código');
      }
    } catch (err) {
      console.error('Error generating link code:', err);
      setError('Error de conexión');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Unlink user
  const handleUnlink = useCallback(async (userId: string) => {
    if (!confirm('¿Estás seguro de desvincular este dispositivo?')) {
      return;
    }

    setUnlinkingId(userId);

    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        setError('Sesión no válida. Por favor, recarga la página.');
        setUnlinkingId(null);
        return;
      }

      const response = await fetch(`/api/admin-channel/link?userId=${userId}`, {
        method: 'DELETE',
        headers,
      });

      if (response.ok) {
        setLinkedUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const data: ApiResponse<unknown> = await response.json();
        setError(data.error ?? 'Error desvinculando');
      }
    } catch (err) {
      console.error('Error unlinking user:', err);
      setError('Error de conexión');
    } finally {
      setUnlinkingId(null);
    }
  }, []);

  // Group users by channel (memoized for performance)
  const whatsappUsers = useMemo(
    () => linkedUsers.filter((u) => u.phone_normalized),
    [linkedUsers]
  );
  const telegramUsers = useMemo(
    () => linkedUsers.filter((u) => u.telegram_user_id),
    [linkedUsers]
  );

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-tis-coral/10 rounded-lg">
          <svg className="w-5 h-5 text-tis-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Admin Channel</h3>
          <p className="text-sm text-gray-500">
            Administra tu negocio desde WhatsApp o Telegram
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Cerrar mensaje de error"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="space-y-6 bg-gray-50 rounded-xl p-4">
        {/* Link Code Display */}
        {linkCode && (
          <LinkCodeDisplay
            linkCode={linkCode}
            onClose={() => setLinkCode(null)}
            onRefresh={generateLinkCode}
            isRefreshing={isGenerating}
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
          </div>
        )}

        {/* Channels Grid */}
        {!isLoading && (
          <div className="space-y-6">
            {/* WhatsApp Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', CHANNEL_METADATA.whatsapp.bgColor, CHANNEL_METADATA.whatsapp.textColor)}>
                  <WhatsAppIcon className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-900">WhatsApp</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-10">
                {whatsappUsers.map((user) => (
                  <LinkedAccountCard
                    key={user.id}
                    user={user}
                    channel="whatsapp"
                    onUnlink={handleUnlink}
                    isUnlinking={unlinkingId === user.id}
                  />
                ))}
                {whatsappUsers.length === 0 && (
                  <AddChannelCard channel="whatsapp" onClick={generateLinkCode} isLoading={isGenerating} />
                )}
              </div>
            </div>

            {/* Telegram Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', CHANNEL_METADATA.telegram.bgColor, CHANNEL_METADATA.telegram.textColor)}>
                  <TelegramIcon className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-900">Telegram</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-10">
                {telegramUsers.map((user) => (
                  <LinkedAccountCard
                    key={user.id}
                    user={user}
                    channel="telegram"
                    onUnlink={handleUnlink}
                    isUnlinking={unlinkingId === user.id}
                  />
                ))}
                {telegramUsers.length === 0 && (
                  <AddChannelCard channel="telegram" onClick={generateLinkCode} isLoading={isGenerating} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Help Info */}
        {!isLoading && !linkCode && linkedUsers.length === 0 && (
          <div className="mt-6 p-4 bg-white rounded-xl border border-gray-100">
            <h4 className="font-medium text-gray-900 mb-3">¿Cómo funciona?</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-tis-coral/10 text-tis-coral rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Genera un código</p>
                  <p className="text-xs text-gray-500">Expira en 15 minutos</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-tis-coral/10 text-tis-coral rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Envía el código</p>
                  <p className="text-xs text-gray-500">A WhatsApp o Telegram</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-7 h-7 bg-tis-coral/10 text-tis-coral rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">¡Listo!</p>
                  <p className="text-xs text-gray-500">Administra desde tu celular</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
