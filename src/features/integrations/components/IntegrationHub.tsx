// =====================================================
// TIS TIS PLATFORM - Integration Hub Component
// Premium UI for managing external system integrations
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, Badge, Modal } from '@/src/shared/components/ui';
import { useAuthContext } from '@/src/features/auth';
import { supabase } from '@/src/shared/lib/supabase';
import { cn } from '@/src/shared/utils';
import type {
  IntegrationConnection,
  IntegrationType,
  IntegrationStatus,
  ConnectorDefinition,
} from '../types/integration.types';

// ======================
// CONNECTOR DEFINITIONS
// ======================

const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  // CRMs
  {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'Sincroniza contactos, deals y actividades',
    icon: 'hubspot',
    category: 'crm',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: false,
      inventory: false,
      orders: false,
    },
  },
  {
    type: 'salesforce',
    name: 'Salesforce',
    description: 'CRM empresarial líder mundial',
    icon: 'salesforce',
    category: 'crm',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: false,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  {
    type: 'zoho_crm',
    name: 'Zoho CRM',
    description: 'Suite completa de gestión de clientes',
    icon: 'zoho',
    category: 'crm',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: false,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  {
    type: 'pipedrive',
    name: 'Pipedrive',
    description: 'CRM para equipos de ventas',
    icon: 'pipedrive',
    category: 'crm',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: false,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  // Dental Software
  {
    type: 'dentrix',
    name: 'Dentrix',
    description: 'Software líder para consultorios dentales',
    icon: 'dentrix',
    category: 'dental',
    auth_type: 'api_key',
    supports_oauth: false,
    supports_webhook: true,
    supports_csv_import: true,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: true,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  {
    type: 'open_dental',
    name: 'Open Dental',
    description: 'Software dental de código abierto',
    icon: 'opendental',
    category: 'dental',
    auth_type: 'api_key',
    supports_oauth: false,
    supports_webhook: true,
    supports_csv_import: true,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: true,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  // POS Systems
  {
    type: 'square',
    name: 'Square',
    description: 'POS moderno con inventario y pagos',
    icon: 'square',
    category: 'pos',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: false,
      products: true,
      inventory: true,
      orders: true,
    },
    coming_soon: true,
  },
  {
    type: 'toast',
    name: 'Toast',
    description: 'POS especializado en restaurantes',
    icon: 'toast',
    category: 'pos',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: false,
      appointments: false,
      products: true,
      inventory: true,
      orders: true,
    },
    coming_soon: true,
  },
  // Calendar
  {
    type: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sincroniza citas con tu calendario',
    icon: 'google',
    category: 'calendar',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: false,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: false,
      appointments: true,
      products: false,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  {
    type: 'calendly',
    name: 'Calendly',
    description: 'Programación de citas automatizada',
    icon: 'calendly',
    category: 'calendar',
    auth_type: 'oauth2',
    supports_oauth: true,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: false,
      inventory: false,
      orders: false,
    },
    coming_soon: true,
  },
  // Generic
  {
    type: 'webhook_incoming',
    name: 'Webhook Entrante',
    description: 'Recibe datos de cualquier sistema via webhook',
    icon: 'webhook',
    category: 'generic',
    auth_type: 'webhook_secret',
    supports_oauth: false,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: true,
      inventory: true,
      orders: true,
    },
  },
  {
    type: 'csv_import',
    name: 'Importar CSV/Excel',
    description: 'Importa datos manualmente desde archivos',
    icon: 'csv',
    category: 'generic',
    auth_type: 'api_key',
    supports_oauth: false,
    supports_webhook: false,
    supports_csv_import: true,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: true,
      inventory: true,
      orders: true,
    },
  },
  {
    type: 'api_custom',
    name: 'API Personalizada',
    description: 'Conecta cualquier sistema con API REST',
    icon: 'api',
    category: 'generic',
    auth_type: 'api_key',
    supports_oauth: false,
    supports_webhook: true,
    supports_csv_import: false,
    sync_capabilities: {
      contacts: true,
      appointments: true,
      products: true,
      inventory: true,
      orders: true,
    },
    coming_soon: true,
  },
];

// ======================
// CATEGORY METADATA
// ======================

const CATEGORY_METADATA: Record<string, { name: string; color: string; bgColor: string }> = {
  crm: { name: 'CRM', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  pos: { name: 'POS', color: 'text-green-700', bgColor: 'bg-green-50' },
  dental: { name: 'Dental', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  calendar: { name: 'Calendario', color: 'text-orange-700', bgColor: 'bg-orange-50' },
  medical: { name: 'Médico', color: 'text-red-700', bgColor: 'bg-red-50' },
  generic: { name: 'Genérico', color: 'text-gray-700', bgColor: 'bg-gray-50' },
};

// ======================
// STATUS CONFIG
// ======================

const STATUS_CONFIG: Record<IntegrationStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendiente' },
  configuring: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Configurando' },
  connected: { bg: 'bg-green-100', text: 'text-green-700', label: 'Conectado' },
  syncing: { bg: 'bg-tis-coral/10', text: 'text-tis-coral', label: 'Sincronizando' },
  paused: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pausado' },
  error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Error' },
  disconnected: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Desconectado' },
};

// ======================
// ICONS
// ======================

function HubSpotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984 2.21 2.21 0 00-2.209-2.21 2.21 2.21 0 00-2.208 2.21c0 .867.502 1.615 1.232 1.972v2.858a5.81 5.81 0 00-2.593 1.372l-6.836-5.324a2.597 2.597 0 00.06-.557 2.545 2.545 0 10-2.544 2.545c.469 0 .906-.133 1.283-.356l6.737 5.245a5.85 5.85 0 00-.507 2.377c0 .863.189 1.68.525 2.421l-2.006 2.005a1.96 1.96 0 00-.612-.102 1.985 1.985 0 101.985 1.985c0-.216-.038-.423-.099-.619l2.009-2.009a5.822 5.822 0 003.486 1.157 5.846 5.846 0 005.842-5.842 5.847 5.847 0 00-5.842-5.842c-.68 0-1.324.124-1.928.341z"/>
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function CSVIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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

function ExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

// ======================
// CONNECTOR ICON
// ======================

function ConnectorIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'hubspot':
      return <HubSpotIcon className={className} />;
    case 'webhook':
    case 'webhook_incoming':
      return <WebhookIcon className={className} />;
    case 'csv':
    case 'csv_import':
      return <CSVIcon className={className} />;
    default:
      return <CloudIcon className={className} />;
  }
}

// ======================
// STATUS BADGE
// ======================

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', config.bg, config.text)}>
      {status === 'connected' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
      )}
      {status === 'syncing' && (
        <SyncIcon className="w-3 h-3 mr-1 animate-spin" />
      )}
      {config.label}
    </span>
  );
}

// ======================
// CONFIGURATION MODAL
// ======================

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: IntegrationConnection | null;
  connector: ConnectorDefinition | undefined;
  onSave: (data: Partial<IntegrationConnection>) => Promise<void>;
  isLoading: boolean;
}

function ConfigurationModal({ isOpen, onClose, connection, connector, onSave, isLoading }: ConfigModalProps) {
  const [formData, setFormData] = useState({
    connection_name: '',
    sync_direction: 'bidirectional' as 'inbound' | 'outbound' | 'bidirectional',
    sync_frequency_minutes: 60,
    sync_contacts: true,
    sync_appointments: true,
    sync_products: false,
    sync_inventory: false,
  });
  const [copied, setCopied] = useState(false);

  // Initialize form data when connection changes
  useEffect(() => {
    if (connection) {
      setFormData({
        connection_name: connection.connection_name || connector?.name || '',
        sync_direction: connection.sync_direction || 'bidirectional',
        sync_frequency_minutes: connection.sync_frequency_minutes || 60,
        sync_contacts: connection.sync_contacts ?? true,
        sync_appointments: connection.sync_appointments ?? true,
        sync_products: connection.sync_products ?? false,
        sync_inventory: connection.sync_inventory ?? false,
      });
    } else if (connector) {
      setFormData({
        connection_name: connector.name,
        sync_direction: 'bidirectional',
        sync_frequency_minutes: 60,
        sync_contacts: connector.sync_capabilities.contacts,
        sync_appointments: connector.sync_capabilities.appointments,
        sync_products: connector.sync_capabilities.products,
        sync_inventory: connector.sync_capabilities.inventory,
      });
    }
  }, [connection, connector]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  const copyWebhookUrl = () => {
    if (connection?.webhook_url) {
      const fullUrl = `${window.location.origin}${connection.webhook_url}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const category = connector ? CATEGORY_METADATA[connector.category] : CATEGORY_METADATA.generic;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={connection ? 'Configurar Integración' : 'Nueva Integración'}
      subtitle={connector?.description}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="config-form"
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-tis-coral rounded-lg hover:bg-tis-coral/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <SyncIcon className="w-4 h-4 animate-spin" />}
            {connection ? 'Guardar Cambios' : 'Crear Integración'}
          </button>
        </>
      }
    >
      <form id="config-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Header with connector info */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', category.bgColor)}>
            <ConnectorIcon type={connector?.type || ''} className={cn('w-7 h-7', category.color)} />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{connector?.name}</h4>
            <p className="text-sm text-gray-500">{connector?.description}</p>
          </div>
          <span className={cn('px-2 py-1 rounded-full text-xs font-medium', category.bgColor, category.color)}>
            {category.name}
          </span>
        </div>

        {/* Connection Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la conexión
          </label>
          <input
            type="text"
            value={formData.connection_name}
            onChange={(e) => setFormData(prev => ({ ...prev, connection_name: e.target.value }))}
            placeholder="Mi integración con HubSpot"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral outline-none transition-all"
          />
        </div>

        {/* Webhook URL (only for webhook type or if exists) */}
        {(connector?.type === 'webhook_incoming' || connection?.webhook_url) && connection?.webhook_url && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL del Webhook
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}${connection.webhook_url}`}
                readOnly
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 text-sm font-mono"
              />
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="p-2.5 text-gray-500 hover:text-tis-coral hover:bg-gray-100 rounded-xl transition-colors"
                title="Copiar URL"
              >
                {copied ? <CheckCircleIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Configura tu sistema externo para enviar datos a esta URL
            </p>
          </div>
        )}

        {/* Webhook Secret (only show if exists) */}
        {connection?.webhook_secret && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secret del Webhook
            </label>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-800 font-mono break-all">
                {connection.webhook_secret}
              </p>
              <p className="mt-2 text-xs text-amber-600">
                Usa este secret para validar firmas HMAC en tu sistema
              </p>
            </div>
          </div>
        )}

        {/* Sync Direction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dirección de sincronización
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'inbound', label: 'Solo entrada', desc: 'Recibir datos del sistema externo' },
              { value: 'outbound', label: 'Solo salida', desc: 'Enviar datos al sistema externo' },
              { value: 'bidirectional', label: 'Bidireccional', desc: 'Sincronización en ambos sentidos' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, sync_direction: option.value as typeof formData.sync_direction }))}
                className={cn(
                  'p-3 border-2 rounded-xl text-left transition-all',
                  formData.sync_direction === option.value
                    ? 'border-tis-coral bg-tis-coral/5'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <p className="font-medium text-sm text-gray-900">{option.label}</p>
                <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Sync Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Frecuencia de sincronización
          </label>
          <select
            value={formData.sync_frequency_minutes}
            onChange={(e) => setFormData(prev => ({ ...prev, sync_frequency_minutes: parseInt(e.target.value) }))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral outline-none bg-white"
          >
            <option value={5}>Cada 5 minutos</option>
            <option value={15}>Cada 15 minutos</option>
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada hora</option>
            <option value={360}>Cada 6 horas</option>
            <option value={1440}>Una vez al día</option>
          </select>
        </div>

        {/* Sync Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Datos a sincronizar
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'sync_contacts', label: 'Contactos', available: connector?.sync_capabilities.contacts },
              { key: 'sync_appointments', label: 'Citas', available: connector?.sync_capabilities.appointments },
              { key: 'sync_products', label: 'Productos', available: connector?.sync_capabilities.products },
              { key: 'sync_inventory', label: 'Inventario', available: connector?.sync_capabilities.inventory },
            ].map((option) => (
              <label
                key={option.key}
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all',
                  option.available
                    ? formData[option.key as keyof typeof formData]
                      ? 'border-tis-coral bg-tis-coral/5'
                      : 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                )}
              >
                <input
                  type="checkbox"
                  checked={option.available && (formData[option.key as keyof typeof formData] as boolean)}
                  onChange={(e) => option.available && setFormData(prev => ({ ...prev, [option.key]: e.target.checked }))}
                  disabled={!option.available}
                  className="w-4 h-4 text-tis-coral border-gray-300 rounded focus:ring-tis-coral"
                />
                <span className="text-sm font-medium text-gray-700">{option.label}</span>
                {!option.available && (
                  <span className="text-xs text-gray-400 ml-auto">No disponible</span>
                )}
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ======================
// DELETE CONFIRMATION MODAL
// ======================

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: IntegrationConnection | null;
  connector: ConnectorDefinition | undefined;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function DeleteConfirmationModal({ isOpen, onClose, connection, connector, onConfirm, isLoading }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const expectedText = 'ELIMINAR';
  const canDelete = confirmText === expectedText;

  // Reset confirm text when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Eliminar Integración"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && <SyncIcon className="w-4 h-4 animate-spin" />}
            <TrashIcon className="w-4 h-4" />
            Eliminar Permanentemente
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <ExclamationIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-800">Esta acción no se puede deshacer</h4>
              <p className="text-sm text-red-700 mt-1">
                Se eliminarán permanentemente todos los datos asociados a esta integración, incluyendo:
              </p>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                <li>Historial de sincronizaciones</li>
                <li>Configuración de mapeo de campos</li>
                <li>Credenciales y tokens de acceso</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Integration Info */}
        <div className="p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">Integración a eliminar:</p>
          <p className="font-semibold text-gray-900 mt-1">
            {connection?.connection_name || connector?.name}
          </p>
          <p className="text-sm text-gray-500">
            {connection?.records_synced_total?.toLocaleString() || 0} registros sincronizados
          </p>
        </div>

        {/* Confirmation Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Escribe <span className="font-mono font-bold text-red-600">{expectedText}</span> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder="Escribe ELIMINAR"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
          />
        </div>
      </div>
    </Modal>
  );
}

// ======================
// INTEGRATION CARD
// ======================

interface IntegrationCardProps {
  connection: IntegrationConnection;
  connector: ConnectorDefinition | undefined;
  onConfigure: () => void;
  onSync: () => void;
  onPause: () => void;
  onDelete: () => void;
  isLoading?: boolean;
}

function IntegrationCard({ connection, connector, onConfigure, onSync, onPause, onDelete, isLoading }: IntegrationCardProps) {
  const isConnected = connection.status === 'connected' || connection.status === 'syncing';
  const isPaused = connection.status === 'paused' || connection.status === 'disconnected';
  const isConfiguring = connection.status === 'configuring' || connection.status === 'pending';
  const category = connector ? CATEGORY_METADATA[connector.category] : CATEGORY_METADATA.generic;

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
  };

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Header with delete button always visible */}
      <div className="p-5 relative">
        {/* Delete button - always visible in top right corner */}
        <button
          onClick={onDelete}
          disabled={isLoading}
          className={cn(
            'absolute top-3 right-3 p-2 rounded-lg transition-all group',
            isLoading
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
          )}
          title="Eliminar integración"
        >
          <TrashIcon className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 pr-10">
          {/* Connector Icon */}
          <div className={cn(
            'w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0',
            category.bgColor
          )}>
            <ConnectorIcon type={connection.integration_type} className={cn('w-7 h-7', category.color)} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {connection.connection_name || connector?.name || connection.integration_type}
              </h3>
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                category.bgColor,
                category.color
              )}>
                {category.name}
              </span>
              <StatusBadge status={connection.status} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {connection.external_account_name || connector?.description}
            </p>
          </div>
        </div>

        {/* Sync Stats - only for connected/paused states */}
        {(isConnected || isPaused) && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-[#333] rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Registros</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {connection.records_synced_total.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#333] rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hoy</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {connection.records_synced_today.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-[#333] rounded-xl">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Última Sync</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5" />
                {formatLastSync(connection.last_sync_at)}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {connection.last_error_message && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <ExclamationIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{connection.last_error_message}</span>
          </div>
        )}
      </div>

      {/* Footer - Different layouts for different states */}
      <div className="px-5 py-4 bg-gray-50/50 dark:bg-[#222] border-t border-gray-100 dark:border-gray-700">
        {isConfiguring ? (
          /* Configuring state - two buttons side by side */
          <div className="flex items-center gap-3">
            <button
              onClick={onConfigure}
              disabled={isLoading}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors',
                isLoading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-tis-coral text-white hover:bg-tis-coral/90'
              )}
            >
              <SettingsIcon className="w-4 h-4" />
              Continuar configuración
            </button>
            <button
              onClick={onDelete}
              disabled={isLoading}
              className={cn(
                'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors border',
                isLoading
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : 'border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
              )}
            >
              <TrashIcon className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        ) : (
          /* Connected/Paused state - full action bar */
          <div className="flex items-center justify-between">
            {/* Left Actions */}
            <div className="flex items-center gap-2">
              {/* Sync Button */}
              <button
                onClick={onSync}
                disabled={connection.status === 'syncing' || isPaused || isLoading}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-all',
                  connection.status === 'syncing' || isPaused || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'text-tis-coral border border-tis-coral/30 hover:bg-tis-coral/10'
                )}
              >
                <SyncIcon className={cn('w-4 h-4', connection.status === 'syncing' && 'animate-spin')} />
                {connection.status === 'syncing' ? 'Sincronizando...' : 'Sincronizar'}
              </button>

              {/* Pause/Resume Button */}
              <button
                onClick={onPause}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors',
                  isLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : isPaused
                      ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                      : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                )}
              >
                {isPaused ? (
                  <>
                    <PlayIcon className="w-4 h-4" />
                    Reanudar
                  </>
                ) : (
                  <>
                    <PauseIcon className="w-4 h-4" />
                    Pausar
                  </>
                )}
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onConfigure}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-colors',
                  isLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                <SettingsIcon className="w-4 h-4" />
                Configurar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ======================
// ADD CONNECTOR CARD
// ======================

interface AddConnectorCardProps {
  connector: ConnectorDefinition;
  onClick: () => void;
  disabled?: boolean;
}

function AddConnectorCard({ connector, onClick, disabled }: AddConnectorCardProps) {
  const category = CATEGORY_METADATA[connector.category];
  const isDisabled = connector.coming_soon || disabled;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'w-full bg-white dark:bg-[#2a2a2a] rounded-2xl border-2 border-dashed transition-all duration-200 p-5 text-left group',
        isDisabled
          ? 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
          : 'border-gray-200 dark:border-gray-700 hover:border-tis-coral/50 hover:bg-gray-50/50 dark:hover:bg-[#333] hover:shadow-sm'
      )}
    >
      {/* Top section with icon and add button */}
      <div className="flex items-start justify-between mb-3">
        {/* Icon */}
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          category.bgColor
        )}>
          <ConnectorIcon type={connector.type} className={cn('w-6 h-6', category.color)} />
        </div>

        {/* Add Icon or Coming Soon badge */}
        {connector.coming_soon ? (
          <Badge variant="default" size="sm">Próximamente</Badge>
        ) : (
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            'bg-gray-100 dark:bg-gray-700 group-hover:bg-tis-coral/10'
          )}>
            <PlusIcon className="w-4 h-4 text-gray-400 group-hover:text-tis-coral transition-colors" />
          </div>
        )}
      </div>

      {/* Title and category */}
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {connector.name}
          </h3>
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
            category.bgColor,
            category.color
          )}>
            {category.name}
          </span>
        </div>
      </div>

      {/* Description - full text, no truncation */}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
        {connector.description}
      </p>

      {/* Capabilities - as small pills */}
      <div className="flex flex-wrap gap-1.5">
        {connector.sync_capabilities.contacts && (
          <span className="text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full font-medium">
            Contactos
          </span>
        )}
        {connector.sync_capabilities.appointments && (
          <span className="text-[11px] px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full font-medium">
            Citas
          </span>
        )}
        {connector.sync_capabilities.products && (
          <span className="text-[11px] px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full font-medium">
            Productos
          </span>
        )}
        {connector.sync_capabilities.inventory && (
          <span className="text-[11px] px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full font-medium">
            Inventario
          </span>
        )}
        {connector.sync_capabilities.orders && (
          <span className="text-[11px] px-2 py-0.5 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-full font-medium">
            Órdenes
          </span>
        )}
      </div>
    </button>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function IntegrationHub() {
  const { staff } = useAuthContext();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal states
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<IntegrationConnection | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<ConnectorDefinition | null>(null);

  // Check permissions
  const isOwner = staff?.role === 'owner';
  const isAdmin = staff?.role === 'admin';
  const canManageIntegrations = isOwner || isAdmin;

  // Helper para obtener headers de autenticación
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  // Load connections
  useEffect(() => {
    let isMounted = true;

    const loadConnections = async () => {
      if (!staff?.tenant_id) return;

      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/integrations', { headers });
        const result = await response.json();

        if (!isMounted) return;

        if (!response.ok) {
          throw new Error(result.error || 'Error al cargar integraciones');
        }

        setConnections(result.connections || []);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error('[IntegrationHub] Error loading connections:', err);
        const message = err instanceof Error ? err.message : 'Error al cargar integraciones';
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConnections();

    return () => {
      isMounted = false;
    };
  }, [staff?.tenant_id, getAuthHeaders]);

  // Get connector definition for a connection
  const getConnector = (type: IntegrationType): ConnectorDefinition | undefined => {
    return CONNECTOR_CATALOG.find(c => c.type === type);
  };

  // Filter connectors by category
  const filteredConnectors = selectedCategory === 'all'
    ? CONNECTOR_CATALOG
    : CONNECTOR_CATALOG.filter(c => c.category === selectedCategory);

  // Group available connectors (not yet connected)
  const connectedTypes = new Set(connections.map(c => c.integration_type));
  const availableConnectors = filteredConnectors.filter(c => !connectedTypes.has(c.type));

  // ======================
  // HANDLERS
  // ======================

  // Open add integration modal
  const handleOpenAddModal = (connector: ConnectorDefinition) => {
    setSelectedConnection(null);
    setSelectedConnector(connector);
    setConfigModalOpen(true);
  };

  // Open configure modal for existing connection
  const handleOpenConfigModal = (connection: IntegrationConnection) => {
    setSelectedConnection(connection);
    setSelectedConnector(getConnector(connection.integration_type) || null);
    setConfigModalOpen(true);
  };

  // Open delete confirmation modal
  const handleOpenDeleteModal = (connection: IntegrationConnection) => {
    setSelectedConnection(connection);
    setSelectedConnector(getConnector(connection.integration_type) || null);
    setDeleteModalOpen(true);
  };

  // Save configuration (create or update)
  const handleSaveConfig = async (data: Partial<IntegrationConnection>) => {
    if (!staff?.tenant_id) return;

    setActionLoading(selectedConnection?.id || 'creating');

    try {
      const headers = await getAuthHeaders();

      if (selectedConnection) {
        // Update existing connection
        const response = await fetch(`/api/integrations/${selectedConnection.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al actualizar integración');
        }

        setConnections(prev =>
          prev.map(c => c.id === selectedConnection.id ? result.connection : c)
        );
      } else if (selectedConnector) {
        // Create new connection
        const response = await fetch('/api/integrations', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            integration_type: selectedConnector.type,
            ...data,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Error al crear integración');
        }

        setConnections(prev => [result.connection, ...prev]);
      }

      setConfigModalOpen(false);
    } catch (err: unknown) {
      console.error('[IntegrationHub] Error saving config:', err);
      const message = err instanceof Error ? err.message : 'Error al guardar';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete integration
  const handleDelete = async () => {
    if (!selectedConnection) return;

    setActionLoading(selectedConnection.id);

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/integrations/${selectedConnection.id}`, {
        method: 'DELETE',
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar integración');
      }

      setConnections(prev => prev.filter(c => c.id !== selectedConnection.id));
      setDeleteModalOpen(false);
    } catch (err: unknown) {
      console.error('[IntegrationHub] Error deleting:', err);
      const message = err instanceof Error ? err.message : 'Error al eliminar';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  // Sync integration
  const handleSync = async (connection: IntegrationConnection) => {
    if (actionLoading) return;

    setActionLoading(connection.id);

    try {
      setConnections(prev =>
        prev.map(c => c.id === connection.id ? { ...c, status: 'syncing' as IntegrationStatus } : c)
      );

      const headers = await getAuthHeaders();

      const response = await fetch(`/api/integrations/${connection.id}/sync`, {
        method: 'POST',
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar');
      }

      // Poll for status update
      setTimeout(async () => {
        try {
          const pollHeaders = await getAuthHeaders();
          const pollResponse = await fetch(`/api/integrations/${connection.id}`, {
            headers: pollHeaders,
          });

          if (pollResponse.ok) {
            const pollResult = await pollResponse.json();
            if (pollResult.connection) {
              setConnections(prev =>
                prev.map(c => c.id === connection.id ? pollResult.connection : c)
              );
            }
          }
        } catch (pollErr) {
          console.warn('[IntegrationHub] Polling failed:', pollErr);
        }
      }, 4000);
    } catch (err: unknown) {
      console.error('[IntegrationHub] Error syncing:', err);
      const message = err instanceof Error ? err.message : 'Error al sincronizar';
      setError(message);

      setConnections(prev =>
        prev.map(c => c.id === connection.id ? { ...c, status: connection.status } : c)
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Pause/Resume integration
  const handlePause = async (connection: IntegrationConnection) => {
    if (actionLoading) return;

    setActionLoading(connection.id);

    const isPaused = connection.status === 'paused' || connection.status === 'disconnected';
    const newStatus = isPaused ? 'connected' : 'paused';

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`/api/integrations/${connection.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: newStatus,
          sync_enabled: isPaused,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar estado');
      }

      setConnections(prev =>
        prev.map(c => c.id === connection.id ? result.connection : c)
      );
    } catch (err: unknown) {
      console.error('[IntegrationHub] Error updating status:', err);
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  // ======================
  // RENDER
  // ======================

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tis-coral/10 rounded-lg">
              <SyncIcon className="w-5 h-5 text-tis-coral" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Integraciones</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Conecta TIS TIS con tus sistemas externos (CRM, POS, software dental)
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Permission Warning */}
          {!canManageIntegrations && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-start gap-3">
              <ExclamationIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">Acceso limitado</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Solo los propietarios y administradores pueden gestionar integraciones.
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tis-coral"></div>
              <span className="ml-3 text-gray-500 dark:text-gray-400">Cargando integraciones...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-start gap-3">
              <ExclamationIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800 dark:text-red-300">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          )}

          {/* Active Connections */}
          {!loading && connections.length > 0 && (
            <div className="mb-8">
              <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                Integraciones Activas ({connections.length})
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {connections.map(connection => (
                  <IntegrationCard
                    key={connection.id}
                    connection={connection}
                    connector={getConnector(connection.integration_type)}
                    onConfigure={() => handleOpenConfigModal(connection)}
                    onSync={() => handleSync(connection)}
                    onPause={() => handlePause(connection)}
                    onDelete={() => handleOpenDeleteModal(connection)}
                    isLoading={actionLoading === connection.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Connectors */}
          {!loading && canManageIntegrations && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <PlusIcon className="w-5 h-5 text-gray-400" />
                  Agregar Integración
                </h4>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'crm', label: 'CRM' },
                    { key: 'dental', label: 'Dental' },
                    { key: 'pos', label: 'POS' },
                    { key: 'calendar', label: 'Calendario' },
                    { key: 'generic', label: 'Genérico' },
                  ].map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                        selectedCategory === cat.key
                          ? 'bg-tis-coral text-white'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {availableConnectors.map(connector => (
                  <AddConnectorCard
                    key={connector.type}
                    connector={connector}
                    onClick={() => handleOpenAddModal(connector)}
                    disabled={actionLoading === 'creating'}
                  />
                ))}
              </div>

              {/* Empty State */}
              {availableConnectors.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CheckCircleIcon className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">¡Todas las integraciones conectadas!</p>
                  <p className="text-sm">Has conectado todos los sistemas disponibles en esta categoría.</p>
                </div>
              )}
            </div>
          )}

          {/* No Integrations Empty State */}
          {!loading && connections.length === 0 && !canManageIntegrations && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <CloudIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Sin integraciones activas</p>
              <p className="text-sm">Contacta al administrador para configurar integraciones.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Modal */}
      <ConfigurationModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        connection={selectedConnection}
        connector={selectedConnector || undefined}
        onSave={handleSaveConfig}
        isLoading={actionLoading !== null}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        connection={selectedConnection}
        connector={selectedConnector || undefined}
        onConfirm={handleDelete}
        isLoading={actionLoading !== null}
      />
    </>
  );
}
