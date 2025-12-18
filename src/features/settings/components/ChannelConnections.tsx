// =====================================================
// TIS TIS PLATFORM - Channel Connections Component
// Premium Apple/TIS TIS design with multi-account support
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';
import {
  CHANNEL_METADATA,
  PERSONALITY_METADATA,
  type ChannelConnection,
  type ChannelType,
  type AccountNumber,
  type ConnectionStatus,
} from '../types/channels.types';
import {
  testWhatsAppConnection,
  testInstagramConnection,
  testFacebookConnection,
  testTikTokConnection,
  formatDelay,
} from '../services/channels.service';
import { ChannelAISettings } from './ChannelAISettings';

// ======================
// ICONS
// ======================

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ======================
// CHANNEL ICON COMPONENT
// ======================

function ChannelIcon({ channel, className }: { channel: ChannelType; className?: string }) {
  const icons = {
    whatsapp: WhatsAppIcon,
    instagram: InstagramIcon,
    facebook: FacebookIcon,
    tiktok: TikTokIcon,
  };
  const Icon = icons[channel];
  return <Icon className={className} />;
}

// ======================
// TYPES
// ======================

interface Branch {
  id: string;
  name: string;
  city: string;
  is_headquarters: boolean;
}

// ======================
// STATUS BADGE
// ======================

const statusConfig: Record<ConnectionStatus, { bg: string; text: string; label: string }> = {
  connected: { bg: 'bg-green-100', text: 'text-green-700', label: 'Conectado' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendiente' },
  configuring: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Configurando' },
  disconnected: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Desconectado' },
  error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error' },
  suspended: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspendido' },
};

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
      {status === 'connected' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

// ======================
// ACCOUNT CARD
// ======================

interface AccountCardProps {
  connection: ChannelConnection;
  onEdit: () => void;
  onToggleAI: (enabled: boolean) => void;
  onOpenAISettings: () => void;
}

function AccountCard({ connection, onEdit, onToggleAI, onOpenAISettings }: AccountCardProps) {
  const metadata = CHANNEL_METADATA[connection.channel];
  const isConnected = connection.status === 'connected';
  const personality = connection.ai_personality_override
    ? PERSONALITY_METADATA[connection.ai_personality_override]
    : null;

  const getIdentifier = () => {
    switch (connection.channel) {
      case 'whatsapp':
        return connection.whatsapp_phone_number_id ? `ID: ...${connection.whatsapp_phone_number_id.slice(-6)}` : '';
      case 'instagram':
        return connection.instagram_username ? `@${connection.instagram_username}` : '';
      case 'facebook':
        return connection.facebook_page_name || '';
      case 'tiktok':
        return connection.tiktok_open_id ? `ID: ...${connection.tiktok_open_id.slice(-6)}` : '';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Channel Icon */}
            <div
              className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm',
                metadata.bgColor,
                metadata.textColor
              )}
            >
              <ChannelIcon channel={connection.channel} className="w-7 h-7" />
            </div>

            {/* Info */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {connection.account_name}
                </h3>
                {connection.is_personal_brand && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    <UserIcon className="w-3 h-3 mr-1" />
                    Personal
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {getIdentifier() || metadata.name}
              </p>
            </div>
          </div>

          <StatusBadge status={connection.status} />
        </div>

        {/* AI Settings Preview */}
        {isConnected && (
          <div className="mt-4 flex flex-wrap gap-2">
            {personality && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                <SparklesIcon className="w-3.5 h-3.5 mr-1.5 text-tis-coral" />
                {personality.name}
              </span>
            )}
            {connection.first_message_delay_seconds > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                <ClockIcon className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                {formatDelay(connection.first_message_delay_seconds)}
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {connection.error_message && (
          <div className="mt-3 p-3 bg-red-50 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{connection.error_message}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100 rounded-b-2xl flex items-center justify-between">
        {isConnected ? (
          <>
            {/* AI Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleAI(!connection.ai_enabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tis-coral focus:ring-offset-2',
                  connection.ai_enabled ? 'bg-tis-coral' : 'bg-gray-200'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    connection.ai_enabled ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                AI {connection.ai_enabled ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {/* AI Settings Button */}
              <button
                onClick={onOpenAISettings}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-tis-coral hover:bg-tis-coral/10 rounded-xl transition-colors"
              >
                <SparklesIcon className="w-4 h-4" />
                AI
              </button>

              {/* Edit/API Button */}
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
                API
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={onEdit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-tis-coral text-white rounded-xl font-medium hover:bg-tis-coral-dark transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            {connection.status === 'configuring' ? 'Continuar configuración' : 'Configurar API'}
          </button>
        )}
      </div>
    </div>
  );
}

// ======================
// ADD ACCOUNT CARD
// ======================

interface AddAccountCardProps {
  channel: ChannelType;
  accountNumber: AccountNumber;
  onClick: () => void;
}

function AddAccountCard({ channel, accountNumber, onClick }: AddAccountCardProps) {
  const metadata = CHANNEL_METADATA[channel];

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-tis-coral/50 hover:bg-gray-50/50 transition-all duration-200 p-8"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center opacity-40',
            metadata.bgColor,
            metadata.textColor
          )}
        >
          <PlusIcon className="w-7 h-7" />
        </div>
        <div className="text-center">
          <p className="font-medium text-gray-700">
            Agregar {metadata.shortName} #{accountNumber}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {accountNumber === 2 ? 'Cuenta secundaria (ej: marca personal)' : 'Cuenta principal'}
          </p>
        </div>
      </div>
    </button>
  );
}

// ======================
// CHANNEL GROUP SECTION
// ======================

interface ChannelGroupSectionProps {
  channel: ChannelType;
  accounts: ChannelConnection[];
  onAddAccount: (accountNumber: AccountNumber) => void;
  onEditAccount: (connection: ChannelConnection) => void;
  onToggleAI: (connectionId: string, enabled: boolean) => void;
  onOpenAISettings: (connection: ChannelConnection) => void;
}

function ChannelGroupSection({
  channel,
  accounts,
  onAddAccount,
  onEditAccount,
  onToggleAI,
  onOpenAISettings,
}: ChannelGroupSectionProps) {
  const metadata = CHANNEL_METADATA[channel];
  const account1 = accounts.find(a => a.account_number === 1);
  const account2 = accounts.find(a => a.account_number === 2);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            metadata.bgColor,
            metadata.textColor
          )}
        >
          <ChannelIcon channel={channel} className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{metadata.name}</h3>
          <p className="text-sm text-gray-500">{metadata.description}</p>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-13">
        {/* Account 1 */}
        {account1 ? (
          <AccountCard
            connection={account1}
            onEdit={() => onEditAccount(account1)}
            onToggleAI={(enabled) => onToggleAI(account1.id, enabled)}
            onOpenAISettings={() => onOpenAISettings(account1)}
          />
        ) : (
          <AddAccountCard
            channel={channel}
            accountNumber={1}
            onClick={() => onAddAccount(1)}
          />
        )}

        {/* Account 2 */}
        {account2 ? (
          <AccountCard
            connection={account2}
            onEdit={() => onEditAccount(account2)}
            onToggleAI={(enabled) => onToggleAI(account2.id, enabled)}
            onOpenAISettings={() => onOpenAISettings(account2)}
          />
        ) : (
          <AddAccountCard
            channel={channel}
            accountNumber={2}
            onClick={() => onAddAccount(2)}
          />
        )}
      </div>
    </div>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function ChannelConnections() {
  const { tenant } = useAuthContext();
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupChannel, setSetupChannel] = useState<ChannelType | null>(null);
  const [setupAccountNumber, setSetupAccountNumber] = useState<AccountNumber>(1);
  const [editingConnection, setEditingConnection] = useState<ChannelConnection | null>(null);

  // AI Settings modal state
  const [showAISettingsModal, setShowAISettingsModal] = useState(false);
  const [aiSettingsConnection, setAISettingsConnection] = useState<ChannelConnection | null>(null);

  // Load data
  useEffect(() => {
    if (!tenant?.id) return;

    const loadData = async () => {
      setLoading(true);

      // Load connections
      const { data: connData } = await supabase
        .from('channel_connections')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('channel')
        .order('account_number');

      if (connData) {
        // Add default values for new fields
        const normalized = connData.map(c => ({
          ...c,
          account_number: c.account_number || 1,
          account_name: c.account_name || `${c.channel.charAt(0).toUpperCase() + c.channel.slice(1)} Principal`,
          is_personal_brand: c.is_personal_brand || false,
          first_message_delay_seconds: c.first_message_delay_seconds || 0,
          subsequent_message_delay_seconds: c.subsequent_message_delay_seconds || 0,
        }));
        setConnections(normalized as ChannelConnection[]);
      }

      // Load branches
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name, city, is_headquarters')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false });

      if (branchData) {
        setBranches(branchData);
      }

      setLoading(false);
    };

    loadData();
  }, [tenant?.id]);

  // Group connections by channel
  const getAccountsByChannel = (channel: ChannelType) => {
    return connections.filter(c => c.channel === channel);
  };

  // Toggle AI
  const handleToggleAI = async (connectionId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('channel_connections')
      .update({ ai_enabled: enabled })
      .eq('id', connectionId);

    if (!error) {
      setConnections(prev =>
        prev.map(c => c.id === connectionId ? { ...c, ai_enabled: enabled } : c)
      );
    }
  };

  // Open setup modal
  const handleAddAccount = (channel: ChannelType, accountNumber: AccountNumber) => {
    setSetupChannel(channel);
    setSetupAccountNumber(accountNumber);
    setEditingConnection(null);
    setShowSetupModal(true);
  };

  // Open edit modal
  const handleEditAccount = (connection: ChannelConnection) => {
    setSetupChannel(connection.channel);
    setSetupAccountNumber(connection.account_number as AccountNumber);
    setEditingConnection(connection);
    setShowSetupModal(true);
  };

  // Handle save from modal
  const handleSaveConnection = (connection: ChannelConnection) => {
    setConnections(prev => {
      const existing = prev.find(c => c.id === connection.id);
      if (existing) {
        return prev.map(c => c.id === connection.id ? connection : c);
      }
      return [...prev, connection];
    });
    setShowSetupModal(false);
    setEditingConnection(null);
    setSetupChannel(null);
  };

  // Open AI Settings modal
  const handleOpenAISettings = (connection: ChannelConnection) => {
    setAISettingsConnection(connection);
    setShowAISettingsModal(true);
  };

  // Handle AI Settings save
  const handleAISettingsSaved = (updated: ChannelConnection) => {
    setConnections(prev =>
      prev.map(c => c.id === updated.id ? updated : c)
    );
    setShowAISettingsModal(false);
    setAISettingsConnection(null);
  };

  // Stats
  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const aiEnabledCount = connections.filter(c => c.ai_enabled && c.status === 'connected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-tis-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Canales de Comunicación</h2>
            <p className="text-sm text-gray-500 mt-1">
              Conecta hasta 2 cuentas por canal para capturar leads de múltiples fuentes
            </p>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">{connectedCount} conectados</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-tis-coral/10 rounded-xl">
              <SparklesIcon className="w-5 h-5 text-tis-coral" />
              <span className="text-sm font-medium text-tis-coral">{aiEnabledCount} con AI</span>
            </div>
          </div>
        </div>

        {/* Channel Groups */}
        <div className="space-y-8">
          {(['whatsapp', 'instagram', 'facebook', 'tiktok'] as ChannelType[]).map(channel => (
            <ChannelGroupSection
              key={channel}
              channel={channel}
              accounts={getAccountsByChannel(channel)}
              onAddAccount={(accountNumber) => handleAddAccount(channel, accountNumber)}
              onEditAccount={handleEditAccount}
              onToggleAI={handleToggleAI}
              onOpenAISettings={handleOpenAISettings}
            />
          ))}
        </div>

        {/* Help Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">¿Por qué múltiples cuentas?</h4>
              <p className="text-sm text-gray-600 mt-1">
                Puedes conectar 2 cuentas por canal. Por ejemplo, una cuenta de Instagram para tu clínica
                y otra para tu marca personal como doctor. Cada cuenta puede tener su propia personalidad
                de AI y configuración de respuesta.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <BuildingIcon className="w-4 h-4" />
                  Cuenta de negocio
                </span>
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <UserIcon className="w-4 h-4" />
                  Marca personal
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      {showSetupModal && setupChannel && (
        <ChannelSetupModal
          channel={setupChannel}
          accountNumber={setupAccountNumber}
          tenantId={tenant?.id || ''}
          branches={branches}
          existingConnection={editingConnection}
          onClose={() => {
            setShowSetupModal(false);
            setEditingConnection(null);
            setSetupChannel(null);
          }}
          onSuccess={handleSaveConnection}
        />
      )}

      {/* AI Settings Modal */}
      {showAISettingsModal && aiSettingsConnection && (
        <ChannelAISettings
          connection={aiSettingsConnection}
          onClose={() => {
            setShowAISettingsModal(false);
            setAISettingsConnection(null);
          }}
          onSaved={handleAISettingsSaved}
        />
      )}
    </>
  );
}

// ======================
// CHANNEL SETUP MODAL (Unified)
// ======================

interface ChannelSetupModalProps {
  channel: ChannelType;
  accountNumber: AccountNumber;
  tenantId: string;
  branches: Branch[];
  existingConnection: ChannelConnection | null;
  onClose: () => void;
  onSuccess: (connection: ChannelConnection) => void;
}

function ChannelSetupModal({
  channel,
  accountNumber,
  tenantId,
  branches,
  existingConnection,
  onClose,
  onSuccess,
}: ChannelSetupModalProps) {
  const metadata = CHANNEL_METADATA[channel];
  const isEditing = !!existingConnection;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedConnection, setSavedConnection] = useState<ChannelConnection | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Form data - unified for all channels
  const [formData, setFormData] = useState({
    // General
    accountName: existingConnection?.account_name || `${metadata.shortName} ${accountNumber === 1 ? 'Principal' : 'Secundario'}`,
    branchId: existingConnection?.branch_id || '',
    isPersonalBrand: existingConnection?.is_personal_brand || accountNumber === 2,

    // AI Settings
    aiPersonality: existingConnection?.ai_personality_override || '',
    firstMessageDelay: existingConnection?.first_message_delay_seconds || 0,
    subsequentMessageDelay: existingConnection?.subsequent_message_delay_seconds || 0,

    // WhatsApp
    phoneNumberId: existingConnection?.whatsapp_phone_number_id || '',
    businessAccountId: existingConnection?.whatsapp_business_account_id || '',
    waAccessToken: existingConnection?.whatsapp_access_token || '',
    waVerifyToken: existingConnection?.whatsapp_verify_token || '',
    webhookSecret: existingConnection?.webhook_secret || '',

    // Instagram
    igPageId: existingConnection?.instagram_page_id || '',
    igAccountId: existingConnection?.instagram_account_id || '',
    igUsername: existingConnection?.instagram_username || '',
    igAccessToken: existingConnection?.instagram_access_token || '',
    igVerifyToken: existingConnection?.instagram_verify_token || '',

    // Facebook
    fbPageId: existingConnection?.facebook_page_id || '',
    fbPageName: existingConnection?.facebook_page_name || '',
    fbAccessToken: existingConnection?.facebook_access_token || '',
    fbVerifyToken: existingConnection?.facebook_verify_token || '',

    // TikTok
    ttClientKey: existingConnection?.tiktok_client_key || '',
    ttClientSecret: existingConnection?.tiktok_client_secret || '',
    ttAccessToken: existingConnection?.tiktok_access_token || '',
    ttOpenId: existingConnection?.tiktok_open_id || '',
    ttVerifyToken: existingConnection?.tiktok_verify_token || '',
  });

  // Test connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    let result;
    switch (channel) {
      case 'whatsapp':
        result = await testWhatsAppConnection(formData.phoneNumberId, formData.waAccessToken);
        break;
      case 'instagram':
        result = await testInstagramConnection(formData.igAccountId, formData.igAccessToken);
        break;
      case 'facebook':
        result = await testFacebookConnection(formData.fbPageId, formData.fbAccessToken);
        break;
      case 'tiktok':
        result = testTikTokConnection(formData.ttAccessToken);
        break;
    }

    setTestResult(result);
    setTesting(false);
  };

  // Get verify token for channel
  const getVerifyToken = () => {
    const existingToken = {
      whatsapp: formData.waVerifyToken || existingConnection?.whatsapp_verify_token,
      instagram: formData.igVerifyToken || existingConnection?.instagram_verify_token,
      facebook: formData.fbVerifyToken || existingConnection?.facebook_verify_token,
      tiktok: formData.ttVerifyToken || existingConnection?.tiktok_verify_token,
    }[channel];

    return existingToken || `tistis_${channel.substring(0, 2)}_${Math.random().toString(36).substring(7)}`;
  };

  // Save connection
  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);

    const verifyToken = getVerifyToken();

    // Build channel-specific data
    const channelData: Record<string, unknown> = {
      tenant_id: tenantId,
      branch_id: formData.branchId || null,
      channel,
      account_number: accountNumber,
      account_name: formData.accountName,
      is_personal_brand: formData.isPersonalBrand,
      status: testResult?.success ? 'connected' : 'configuring',
      ai_enabled: true,
      ai_personality_override: formData.aiPersonality || null,
      first_message_delay_seconds: formData.firstMessageDelay,
      subsequent_message_delay_seconds: formData.subsequentMessageDelay,
    };

    // Add channel-specific fields
    switch (channel) {
      case 'whatsapp':
        Object.assign(channelData, {
          whatsapp_phone_number_id: formData.phoneNumberId,
          whatsapp_business_account_id: formData.businessAccountId,
          whatsapp_access_token: formData.waAccessToken,
          whatsapp_verify_token: verifyToken,
          webhook_secret: formData.webhookSecret,
        });
        break;
      case 'instagram':
        Object.assign(channelData, {
          instagram_page_id: formData.igPageId,
          instagram_account_id: formData.igAccountId,
          instagram_username: formData.igUsername,
          instagram_access_token: formData.igAccessToken,
          instagram_verify_token: verifyToken,
        });
        break;
      case 'facebook':
        Object.assign(channelData, {
          facebook_page_id: formData.fbPageId,
          facebook_page_name: formData.fbPageName,
          facebook_access_token: formData.fbAccessToken,
          facebook_verify_token: verifyToken,
        });
        break;
      case 'tiktok':
        Object.assign(channelData, {
          tiktok_client_key: formData.ttClientKey,
          tiktok_client_secret: formData.ttClientSecret,
          tiktok_access_token: formData.ttAccessToken,
          tiktok_open_id: formData.ttOpenId,
          tiktok_verify_token: verifyToken,
        });
        break;
    }

    let result;
    if (isEditing && existingConnection) {
      result = await supabase
        .from('channel_connections')
        .update(channelData)
        .eq('id', existingConnection.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('channel_connections')
        .insert(channelData)
        .select()
        .single();
    }

    setSaving(false);

    if (result.error) {
      setSaveError(result.error.message);
      return;
    }

    // Get webhook URL
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();

    if (tenant) {
      setWebhookUrl(`${window.location.origin}/api/webhook/${channel}/${tenant.slug}`);
    }

    setSavedConnection(result.data as ChannelConnection);
    setStep(4); // Go to success step
  };

  // Copy to clipboard
  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Calculate total steps
  const totalSteps = 4;

  // Check if can proceed to next step
  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.accountName.trim().length > 0;
      case 2:
        if (channel === 'whatsapp') return !!(formData.phoneNumberId && formData.businessAccountId);
        if (channel === 'instagram') return !!(formData.igPageId && formData.igAccountId);
        if (channel === 'facebook') return !!formData.fbPageId;
        if (channel === 'tiktok') return !!(formData.ttClientKey && formData.ttClientSecret);
        return false;
      case 3:
        if (channel === 'whatsapp') return !!formData.waAccessToken;
        if (channel === 'instagram') return !!formData.igAccessToken;
        if (channel === 'facebook') return !!formData.fbAccessToken;
        if (channel === 'tiktok') return !!formData.ttAccessToken;
        return false;
      default:
        return true;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center shadow-md',
                  metadata.bgColor,
                  metadata.textColor
                )}
              >
                <ChannelIcon channel={channel} className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {isEditing ? 'Editar' : 'Configurar'} {metadata.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Cuenta #{accountNumber} • Paso {step} de {totalSteps}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <XIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-6 flex gap-2">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={cn(
                  'h-1.5 rounded-full flex-1 transition-colors',
                  s <= step ? 'bg-tis-coral' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Account Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Información de la Cuenta</h4>

                {/* Account Name */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de la cuenta
                    </label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      placeholder={`Ej: ${metadata.shortName} de mi clínica`}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Este nombre te ayudará a identificar esta cuenta
                    </p>
                  </div>

                  {/* Branch Selector */}
                  {branches.length > 1 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sucursal (opcional)
                      </label>
                      <select
                        value={formData.branchId}
                        onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors"
                      >
                        <option value="">Todas las sucursales</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name} ({branch.city}) {branch.is_headquarters ? '• Principal' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Personal Brand Toggle */}
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Marca Personal</p>
                          <p className="text-sm text-gray-600">
                            Esta cuenta es para mi perfil personal
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFormData({ ...formData, isPersonalBrand: !formData.isPersonalBrand })}
                        className={cn(
                          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                          formData.isPersonalBrand ? 'bg-purple-600' : 'bg-gray-200'
                        )}
                      >
                        <span
                          className={cn(
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200',
                            formData.isPersonalBrand ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: API Credentials - Part 1 */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-1">Credenciales de API</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Ingresa los datos de tu {metadata.name}
                </p>

                {/* Channel-specific fields */}
                {channel === 'whatsapp' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-xl text-sm text-green-800">
                      <strong>¿Dónde encuentro estos datos?</strong>
                      <p className="mt-1">Meta Business Suite → WhatsApp → Configuración de API</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number ID *
                      </label>
                      <input
                        type="text"
                        value={formData.phoneNumberId}
                        onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                        placeholder="123456789012345"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Business Account ID *
                      </label>
                      <input
                        type="text"
                        value={formData.businessAccountId}
                        onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
                        placeholder="123456789012345"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>
                  </div>
                )}

                {channel === 'instagram' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-pink-50 rounded-xl text-sm text-pink-800">
                      <strong>Requisitos:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Cuenta Instagram Business/Creator</li>
                        <li>Vinculada a una página de Facebook</li>
                      </ul>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instagram Page ID *
                      </label>
                      <input
                        type="text"
                        value={formData.igPageId}
                        onChange={(e) => setFormData({ ...formData, igPageId: e.target.value })}
                        placeholder="17841400..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Instagram Account ID *
                      </label>
                      <input
                        type="text"
                        value={formData.igAccountId}
                        onChange={(e) => setFormData({ ...formData, igAccountId: e.target.value })}
                        placeholder="17841400..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username de Instagram
                      </label>
                      <input
                        type="text"
                        value={formData.igUsername}
                        onChange={(e) => setFormData({ ...formData, igUsername: e.target.value })}
                        placeholder="@tu_cuenta"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors"
                      />
                    </div>
                  </div>
                )}

                {channel === 'facebook' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
                      <strong>¿Dónde encuentro estos datos?</strong>
                      <p className="mt-1">Meta Developers → Tu App → Messenger → Settings</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Page ID *
                      </label>
                      <input
                        type="text"
                        value={formData.fbPageId}
                        onChange={(e) => setFormData({ ...formData, fbPageId: e.target.value })}
                        placeholder="123456789012345"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre de la Página
                      </label>
                      <input
                        type="text"
                        value={formData.fbPageName}
                        onChange={(e) => setFormData({ ...formData, fbPageName: e.target.value })}
                        placeholder="Mi Negocio"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors"
                      />
                    </div>
                  </div>
                )}

                {channel === 'tiktok' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-100 rounded-xl text-sm text-gray-800">
                      <strong>Requisitos:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Cuenta TikTok Business verificada</li>
                        <li>App en TikTok for Developers</li>
                      </ul>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Client Key *
                      </label>
                      <input
                        type="text"
                        value={formData.ttClientKey}
                        onChange={(e) => setFormData({ ...formData, ttClientKey: e.target.value })}
                        placeholder="awxxxxxxxx"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Client Secret *
                      </label>
                      <input
                        type="password"
                        value={formData.ttClientSecret}
                        onChange={(e) => setFormData({ ...formData, ttClientSecret: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: API Credentials - Part 2 (Token + Test) */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-1">Access Token</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Ingresa tu token de acceso y prueba la conexión
                </p>

                <div className="space-y-4">
                  {/* Access Token Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Token *
                    </label>
                    <input
                      type="password"
                      value={
                        channel === 'whatsapp' ? formData.waAccessToken :
                        channel === 'instagram' ? formData.igAccessToken :
                        channel === 'facebook' ? formData.fbAccessToken :
                        formData.ttAccessToken
                      }
                      onChange={(e) => {
                        const token = e.target.value;
                        if (channel === 'whatsapp') setFormData({ ...formData, waAccessToken: token });
                        if (channel === 'instagram') setFormData({ ...formData, igAccessToken: token });
                        if (channel === 'facebook') setFormData({ ...formData, fbAccessToken: token });
                        if (channel === 'tiktok') setFormData({ ...formData, ttAccessToken: token });
                      }}
                      placeholder={channel === 'tiktok' ? 'act.xxxxx' : 'EAA...'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                    />
                  </div>

                  {/* Webhook Secret (WhatsApp only) */}
                  {channel === 'whatsapp' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        App Secret (para verificar webhooks)
                      </label>
                      <input
                        type="password"
                        value={formData.webhookSecret}
                        onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
                        placeholder="abc123..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors font-mono"
                      />
                    </div>
                  )}

                  {/* Test Connection Button */}
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !canProceed()}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors',
                      testing ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    {testing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        Probando conexión...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        Probar Conexión
                      </>
                    )}
                  </button>

                  {/* Test Result */}
                  {testResult && (
                    <div
                      className={cn(
                        'p-4 rounded-xl flex items-start gap-3',
                        testResult.success ? 'bg-green-50' : 'bg-red-50'
                      )}
                    >
                      {testResult.success ? (
                        <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={cn('text-sm', testResult.success ? 'text-green-800' : 'text-red-800')}>
                        {testResult.message}
                      </span>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-4 bg-red-50 rounded-xl flex items-start gap-3">
                      <XCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-red-800">{saveError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success + Webhook Info */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">
                  {testResult?.success ? '¡Conexión Exitosa!' : 'Configuración Guardada'}
                </h4>
                <p className="text-gray-600 mt-1">
                  {testResult?.success
                    ? 'Tu cuenta está lista para recibir mensajes'
                    : 'Ahora configura el webhook en la plataforma'}
                </p>
              </div>

              {/* Webhook URL */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  URL del Webhook
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-mono"
                  />
                  <button
                    onClick={() => handleCopy(webhookUrl, 'webhook')}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    {copied === 'webhook' ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <CopyIcon className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Verify Token */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Verify Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getVerifyToken()}
                    className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-mono"
                  />
                  <button
                    onClick={() => handleCopy(getVerifyToken(), 'verify')}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    {copied === 'verify' ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <CopyIcon className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 bg-amber-50 rounded-xl">
                <h5 className="font-medium text-amber-900 mb-2">Siguiente paso:</h5>
                <ol className="list-decimal list-inside text-sm text-amber-800 space-y-1">
                  {channel === 'whatsapp' && (
                    <>
                      <li>Ve a Meta Developers → Tu App → WhatsApp → Configuración</li>
                      <li>En Webhooks, pega la URL de arriba</li>
                      <li>Usa el Verify Token mostrado</li>
                      <li>Suscribe a: messages, message_deliveries</li>
                    </>
                  )}
                  {channel === 'instagram' && (
                    <>
                      <li>Ve a Meta Developers → Tu App → Webhooks</li>
                      <li>Selecciona &quot;Instagram&quot;</li>
                      <li>Configura la URL y el Verify Token</li>
                      <li>Suscribe a: messages, messaging_postbacks</li>
                    </>
                  )}
                  {channel === 'facebook' && (
                    <>
                      <li>Ve a Meta Developers → Tu App → Messenger → Settings</li>
                      <li>En Webhooks, configura la URL y el Verify Token</li>
                      <li>Suscribe a: messages, messaging_postbacks</li>
                      <li>Vincula tu página a la app</li>
                    </>
                  )}
                  {channel === 'tiktok' && (
                    <>
                      <li>Ve a TikTok for Developers → Tu App</li>
                      <li>Configura el Webhook URL y Verify Token</li>
                      <li>Habilita eventos de mensajes directos</li>
                    </>
                  )}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-between">
          {step > 1 && step < 4 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Anterior
            </button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className={cn(
                'px-6 py-3 rounded-xl font-medium transition-colors',
                canProceed()
                  ? 'bg-tis-coral text-white hover:bg-tis-coral-dark'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              )}
            >
              Siguiente
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleSubmit}
              disabled={saving || !canProceed()}
              className={cn(
                'px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2',
                saving || !canProceed()
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-tis-coral text-white hover:bg-tis-coral-dark'
              )}
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Guardar y Continuar
            </button>
          )}

          {step === 4 && (
            <button
              onClick={() => {
                if (savedConnection) {
                  onSuccess(savedConnection);
                }
                onClose();
              }}
              className="px-6 py-3 bg-tis-coral text-white rounded-xl font-medium hover:bg-tis-coral-dark transition-colors"
            >
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChannelConnections;
