// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Configuration Modal
// Specialized configuration for Soft Restaurant POS integration
// Based on official API: api.softrestaurant.com.mx
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/src/shared/components/ui';
import { cn } from '@/src/shared/utils';
import type { IntegrationConnection, SRSyncConfig } from '../types/integration.types';
import {
  SR_CAPABILITY_STATUS,
  type SRCapabilityKey,
  type SRCapabilityStatus,
} from '../services/soft-restaurant-api.service';

// ======================
// NATIONAL SOFT CONTACT INFO
// Official contact for API Key requests
// ======================

const NATIONAL_SOFT_CONTACT = {
  email: 'erik.basto@nationalsoft.com.mx',
  apiPortal: 'https://api.softrestaurant.com.mx',
} as const;

// ======================
// ICONS
// ======================

function RestaurantIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.97zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.97z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function ArrowsRightLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

// ======================
// CAPABILITY STATUS BADGE
// ======================

interface CapabilityBadgeProps {
  status: SRCapabilityStatus;
  note?: string;
}

function CapabilityBadge({ status, note }: CapabilityBadgeProps) {
  const config = {
    confirmed: {
      label: 'Confirmado',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    },
    beta: {
      label: 'Beta',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
    },
    coming_soon: {
      label: 'Proximamente',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      borderColor: 'border-gray-200',
    },
  };

  const { label, bgColor, textColor, borderColor } = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        bgColor,
        textColor,
        borderColor
      )}
      title={note}
    >
      {label}
    </span>
  );
}

// ======================
// TYPES
// ======================

interface SoftRestaurantConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: IntegrationConnection | null;
  onSave: (data: {
    api_key: string;
    sync_config: SRSyncConfig;
  }) => Promise<void>;
  isLoading: boolean;
}

type SyncDirection = 'sr_to_tistis' | 'tistis_to_sr' | 'bidirectional';

type ConnectionStatusType = 'idle' | 'testing' | 'success' | 'error';

interface ConnectionTestDetails {
  menuItemsCount?: number;
  categoriesCount?: number;
  responseTimeMs?: number;
}

interface ConnectionErrorDetails {
  message: string;
  errorCode?: string;
  errorDetails?: string;
}

interface SyncOption {
  key: keyof Pick<SRSyncConfig, 'sync_menu' | 'sync_recipes' | 'sync_inventory' | 'sync_tables' | 'sync_reservations' | 'sync_sales'>;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  hasDirection: boolean;
  directionKey?: keyof Pick<SRSyncConfig, 'menu_direction' | 'inventory_direction' | 'reservations_direction'>;
  color: string;
  bgColor: string;
  capabilityKey: SRCapabilityKey; // Links to SR_CAPABILITY_STATUS
}

// ======================
// DEFAULT SYNC CONFIG
// ======================

const DEFAULT_SR_SYNC_CONFIG: SRSyncConfig = {
  sync_menu: true,
  sync_recipes: true,
  sync_inventory: true,
  sync_tables: true,
  sync_reservations: false,
  sync_sales: true,
  menu_direction: 'sr_to_tistis',
  inventory_direction: 'bidirectional',
  reservations_direction: 'bidirectional',
  sync_frequency_minutes: 30,
  include_inactive_products: false,
  sales_history_days: 30,
  default_branch_id: undefined,
  category_mapping: {},
  auto_create_categories: true,
  auto_update_prices: true,
  alert_on_low_stock: true,
  alert_on_price_change: false,
};

// ======================
// SYNC OPTIONS CONFIG
// ======================

const SYNC_OPTIONS: SyncOption[] = [
  {
    key: 'sync_menu',
    label: 'Menu',
    description: 'Productos, categorias, precios y modificadores',
    icon: MenuIcon,
    hasDirection: true,
    directionKey: 'menu_direction',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    capabilityKey: 'sync_menu',
  },
  {
    key: 'sync_recipes',
    label: 'Recetas con Gramaje',
    description: 'Explosion de insumos, costos por porcion y merma (requiere Menu)',
    icon: ScaleIcon,
    hasDirection: false,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    capabilityKey: 'sync_recipes',
  },
  {
    key: 'sync_inventory',
    label: 'Inventario',
    description: 'Stock, puntos de reorden y costos unitarios',
    icon: BoxIcon,
    hasDirection: true,
    directionKey: 'inventory_direction',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    capabilityKey: 'sync_inventory',
  },
  {
    key: 'sync_tables',
    label: 'Mesas',
    description: 'Plano del restaurante, zonas y capacidad',
    icon: TableIcon,
    hasDirection: false,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    capabilityKey: 'sync_tables',
  },
  {
    key: 'sync_reservations',
    label: 'Reservaciones',
    description: 'Reservas de clientes con horarios y mesas',
    icon: CalendarIcon,
    hasDirection: true,
    directionKey: 'reservations_direction',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    capabilityKey: 'sync_reservations',
  },
  {
    key: 'sync_sales',
    label: 'Ventas',
    description: 'Tickets, productos vendidos y analisis (via webhook)',
    icon: ChartIcon,
    hasDirection: false,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    capabilityKey: 'sync_sales',
  },
];

// ======================
// DIRECTION BUTTON
// ======================

interface DirectionButtonProps {
  direction: SyncDirection;
  onSelect: (dir: SyncDirection) => void;
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function DirectionButton({ direction, onSelect, selected, icon, label, description }: DirectionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(direction)}
      className={cn(
        'flex-1 p-3 rounded-xl border-2 transition-all text-left',
        selected
          ? 'border-tis-coral bg-tis-coral/5'
          : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="font-medium text-sm text-gray-900">{label}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}

// ======================
// MAIN COMPONENT
// ======================

export function SoftRestaurantConfigModal({
  isOpen,
  onClose,
  connection,
  onSave,
  isLoading,
}: SoftRestaurantConfigModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('idle');
  const [connectionDetails, setConnectionDetails] = useState<ConnectionTestDetails | null>(null);
  const [connectionError, setConnectionError] = useState<ConnectionErrorDetails | null>(null);
  const [syncConfig, setSyncConfig] = useState<SRSyncConfig>(DEFAULT_SR_SYNC_CONFIG);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset all states when modal opens
      setApiKey('');
      setConnectionStatus('idle');
      setConnectionDetails(null);
      setConnectionError(null);
      setShowApiKey(false);

      // If editing existing connection, skip credentials step and load saved config
      if (connection?.id) {
        // Already connected - start at step 2 (sync config)
        setCurrentStep(2);
        setConnectionStatus('success'); // Mark as already connected

        if (connection.metadata) {
          const savedConfig = connection.metadata as { sync_config?: Partial<SRSyncConfig> };
          if (savedConfig.sync_config) {
            setSyncConfig({
              ...DEFAULT_SR_SYNC_CONFIG,
              ...savedConfig.sync_config,
            });
          } else {
            setSyncConfig(DEFAULT_SR_SYNC_CONFIG);
          }
        } else {
          setSyncConfig(DEFAULT_SR_SYNC_CONFIG);
        }
      } else {
        // New connection - start at step 1 (credentials) with defaults
        setCurrentStep(1);
        setSyncConfig(DEFAULT_SR_SYNC_CONFIG);
      }
    }
  }, [isOpen, connection]);

  // Test connection handler - calls real API
  const handleTestConnection = useCallback(async () => {
    if (!apiKey.trim()) return;

    setConnectionStatus('testing');
    setConnectionDetails(null);
    setConnectionError(null);

    try {
      const response = await fetch('/api/integrations/softrestaurant/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const result = await response.json();

      if (result.success) {
        setConnectionStatus('success');
        setConnectionDetails(result.details || null);
        setConnectionError(null);

        // Auto-advance to next step after successful test
        setTimeout(() => setCurrentStep(2), 1200);
      } else {
        setConnectionStatus('error');
        setConnectionDetails(null);
        setConnectionError({
          message: result.message || 'Error de conexion',
          errorCode: result.errorCode,
          errorDetails: result.errorDetails,
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionDetails(null);
      setConnectionError({
        message: 'Error de red. Verifica tu conexion a internet.',
        errorCode: 'NETWORK_ERROR',
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [apiKey]);

  // Toggle sync option (only for boolean fields)
  const toggleSync = (key: keyof typeof syncConfig) => {
    setSyncConfig(prev => {
      const currentValue = prev[key];
      // Only toggle boolean values
      if (typeof currentValue !== 'boolean') return prev;

      const newValue = !currentValue;

      // If disabling menu, also disable recipes (dependency)
      if (key === 'sync_menu' && !newValue) {
        return { ...prev, [key]: newValue, sync_recipes: false };
      }

      // If enabling recipes, also enable menu (dependency)
      if (key === 'sync_recipes' && newValue && !prev.sync_menu) {
        return { ...prev, [key]: newValue, sync_menu: true };
      }

      return { ...prev, [key]: newValue };
    });
  };

  // Set direction
  const setDirection = (key: keyof Pick<SRSyncConfig, 'menu_direction' | 'inventory_direction' | 'reservations_direction'>, value: SyncDirection) => {
    setSyncConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle save
  const handleSave = async () => {
    await onSave({
      api_key: apiKey,
      sync_config: syncConfig,
    });
  };

  // Count enabled syncs
  const enabledSyncsCount = SYNC_OPTIONS.filter(opt => syncConfig[opt.key]).length;

  // Determine if this is an edit (existing connection) or new connection
  const isEditMode = !!connection?.id;
  // In edit mode, minimum step is 2 (skip credentials)
  const minStep = isEditMode ? 2 : 1;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Editar Configuración' : 'Configurar Soft Restaurant'}
      subtitle={isEditMode ? 'Ajusta la sincronización de tu conexión con Soft Restaurant' : 'Conecta tu POS con TIS TIS para sincronizar datos automáticamente'}
      size="lg"
      footer={
        <>
          {currentStep > minStep && (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Atrás
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          {currentStep < 3 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={currentStep === 1 && connectionStatus !== 'success'}
              className="px-4 py-2 text-sm font-medium text-white bg-tis-coral rounded-lg hover:bg-tis-coral/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              Siguiente
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || enabledSyncsCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-tis-coral rounded-lg hover:bg-tis-coral/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <SyncIcon className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Guardar Cambios' : 'Guardar y Conectar'}
            </button>
          )}
        </>
      }
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[
          { num: 1, label: 'Credenciales' },
          { num: 2, label: 'Sincronización' },
          { num: 3, label: 'Opciones' },
        ].map((step, idx) => {
          // In edit mode, step 1 is always "completed" (credentials already saved)
          const isStepCompleted = isEditMode ? (step.num === 1 || currentStep > step.num) : currentStep > step.num;
          const isStepActive = isEditMode ? (step.num >= 2 && currentStep >= step.num) : currentStep >= step.num;

          return (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm transition-colors',
                    isStepActive || isStepCompleted
                      ? 'bg-tis-coral text-white'
                      : 'bg-gray-100 text-gray-400'
                  )}
                >
                  {isStepCompleted ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    step.num
                  )}
                </div>
                <span
                  className={cn(
                    'ml-2 text-sm font-medium',
                    isStepActive || isStepCompleted ? 'text-gray-900' : 'text-gray-400'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < 2 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-4',
                    isStepCompleted ? 'bg-tis-coral' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Credentials */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
            <div className="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center">
              <RestaurantIcon className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Soft Restaurant</h4>
              <p className="text-sm text-gray-600">POS #1 en Mexico y Latinoamerica</p>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label htmlFor="sr-api-key" className="block text-sm font-medium text-gray-700 mb-2">
              API Key de Soft Restaurant
            </label>
            <div className="relative">
              <input
                id="sr-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setConnectionStatus('idle');
                  setConnectionError(null);
                }}
                placeholder="Ingresa tu API Key"
                autoComplete="off"
                aria-describedby="sr-api-key-help"
                className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={showApiKey ? 'Ocultar API Key' : 'Mostrar API Key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-2"
              >
                {showApiKey ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p id="sr-api-key-help" className="mt-2 text-xs text-gray-500">
              La API Key se obtiene contactando a National Soft. No se encuentra en la configuracion del software.
            </p>
          </div>

          {/* Test Connection Button */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!apiKey.trim() || connectionStatus === 'testing'}
            className={cn(
              'w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
              connectionStatus === 'success'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : connectionStatus === 'error'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {connectionStatus === 'testing' ? (
              <>
                <SyncIcon className="w-5 h-5 animate-spin" />
                Conectando con Soft Restaurant...
              </>
            ) : connectionStatus === 'success' ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Conexion exitosa
                {connectionDetails?.menuItemsCount !== undefined && (
                  <span className="text-green-600 text-sm ml-1">
                    ({connectionDetails.menuItemsCount} productos)
                  </span>
                )}
              </>
            ) : connectionStatus === 'error' ? (
              <>
                <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs">!</span>
                {connectionError?.message || 'Error de conexion'}
              </>
            ) : (
              <>
                <SyncIcon className="w-5 h-5" />
                Probar conexion
              </>
            )}
          </button>

          {/* Error Details (if any) */}
          {connectionStatus === 'error' && connectionError?.errorDetails && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-red-600 font-mono">
                {connectionError.errorCode && (
                  <span className="font-semibold">[{connectionError.errorCode}] </span>
                )}
                {connectionError.errorDetails}
              </p>
            </div>
          )}

          {/* Success Details */}
          {connectionStatus === 'success' && connectionDetails && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-4 text-sm text-green-700">
                {connectionDetails.menuItemsCount !== undefined && (
                  <span>{connectionDetails.menuItemsCount} productos en menu</span>
                )}
                {connectionDetails.categoriesCount !== undefined && (
                  <span>{connectionDetails.categoriesCount} categorias</span>
                )}
                {connectionDetails.responseTimeMs !== undefined && (
                  <span className="text-green-600 text-xs">({connectionDetails.responseTimeMs}ms)</span>
                )}
              </div>
            </div>
          )}

          {/* How to get API Key - Corrected instructions */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <h5 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <EnvelopeIcon className="w-4 h-4" />
              Como obtener tu API Key
            </h5>
            <p className="text-sm text-amber-700 mb-3">
              Para obtener acceso a la API de Soft Restaurant, debes contactar directamente a National Soft:
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`mailto:${NATIONAL_SOFT_CONTACT.email}?subject=Solicitud%20de%20API%20Key%20para%20integraci%C3%B3n%20TIS%20TIS&body=Hola%2C%0A%0ASolicito%20acceso%20a%20la%20API%20de%20Soft%20Restaurant%20para%20integrar%20con%20TIS%20TIS.%0A%0ANombre%20del%20negocio%3A%20%0AN%C3%BAmero%20de%20licencia%20SR%3A%20%0A%0AGracias.`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium text-sm transition-colors"
              >
                <EnvelopeIcon className="w-4 h-4" />
                {NATIONAL_SOFT_CONTACT.email}
              </a>
              <a
                href={NATIONAL_SOFT_CONTACT.apiPortal}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-medium text-sm border border-gray-200 transition-colors"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                Portal API
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Sync Configuration */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              Selecciona que datos sincronizar entre Soft Restaurant y TIS TIS
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <CapabilityBadge status="confirmed" />
              <CapabilityBadge status="beta" />
            </div>
          </div>

          {SYNC_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isEnabled = syncConfig[option.key];
            const capabilityInfo = SR_CAPABILITY_STATUS[option.capabilityKey];
            const isComingSoon = capabilityInfo.status === 'coming_soon';

            return (
              <div
                key={option.key}
                className={cn(
                  'rounded-xl border-2 transition-all overflow-hidden',
                  isComingSoon
                    ? 'border-gray-200 bg-gray-50/70 opacity-75'
                    : isEnabled
                      ? 'border-tis-coral/50 bg-white'
                      : 'border-gray-200 bg-gray-50/50'
                )}
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => !isComingSoon && toggleSync(option.key)}
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`${isEnabled ? 'Desactivar' : 'Activar'} sincronizacion de ${option.label}`}
                  disabled={isComingSoon}
                  className={cn(
                    'w-full p-4 flex items-center gap-4 text-left',
                    isComingSoon && 'cursor-not-allowed'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                    isEnabled && !isComingSoon ? option.bgColor : 'bg-gray-100'
                  )} aria-hidden="true">
                    <Icon className={cn('w-5 h-5', isEnabled && !isComingSoon ? option.color : 'text-gray-400')} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn(
                        'font-medium transition-colors',
                        isEnabled && !isComingSoon ? 'text-gray-900' : 'text-gray-500'
                      )}>
                        {option.label}
                      </span>
                      <CapabilityBadge
                        status={capabilityInfo.status}
                        note={capabilityInfo.note}
                      />
                    </div>
                    <span className="text-sm text-gray-500">{option.description}</span>
                    {capabilityInfo.note && capabilityInfo.status !== 'confirmed' && (
                      <span className="block text-xs text-gray-400 mt-0.5 italic">
                        {capabilityInfo.note}
                      </span>
                    )}
                  </div>

                  {/* Toggle - visual only, button handles interaction */}
                  {!isComingSoon && (
                    <div
                      className={cn(
                        'w-12 h-7 rounded-full transition-colors relative',
                        isEnabled ? 'bg-tis-coral' : 'bg-gray-300'
                      )}
                      aria-hidden="true"
                    >
                      <div className={cn(
                        'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform',
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </div>
                  )}
                </button>

                {/* Direction selector (if applicable and enabled) */}
                {isEnabled && !isComingSoon && option.hasDirection && option.directionKey && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      Direccion de sincronizacion
                    </p>
                    <div className="flex gap-2">
                      <DirectionButton
                        direction="sr_to_tistis"
                        selected={syncConfig[option.directionKey] === 'sr_to_tistis'}
                        onSelect={(dir) => setDirection(option.directionKey!, dir)}
                        icon={<ArrowRightIcon className="w-4 h-4 text-blue-500" />}
                        label="SR → TIS TIS"
                        description="Solo importar"
                      />
                      <DirectionButton
                        direction="bidirectional"
                        selected={syncConfig[option.directionKey] === 'bidirectional'}
                        onSelect={(dir) => setDirection(option.directionKey!, dir)}
                        icon={<ArrowsRightLeftIcon className="w-4 h-4 text-purple-500" />}
                        label="Bidireccional"
                        description="Sync completo"
                      />
                      <DirectionButton
                        direction="tistis_to_sr"
                        selected={syncConfig[option.directionKey] === 'tistis_to_sr'}
                        onSelect={(dir) => setDirection(option.directionKey!, dir)}
                        icon={<ArrowLeftIcon className="w-4 h-4 text-green-500" />}
                        label="TIS TIS → SR"
                        description="Solo exportar"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary */}
          <div className="p-4 bg-gray-50 rounded-xl mt-4">
            <p className="text-sm text-gray-600">
              <strong>{enabledSyncsCount}</strong> tipo(s) de datos seleccionados para sincronizar
            </p>
          </div>

          {/* API Info Banner */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              <strong>Nota:</strong> Las capacidades marcadas como &quot;Beta&quot; requieren configuracion adicional con National Soft.
              Solo &quot;Menu&quot; y &quot;Ventas (webhook)&quot; estan completamente confirmados en la documentacion oficial.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Additional Options */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Sync Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frecuencia de sincronización
            </label>
            <select
              value={syncConfig.sync_frequency_minutes}
              onChange={(e) => setSyncConfig(prev => ({
                ...prev,
                sync_frequency_minutes: parseInt(e.target.value),
              }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral outline-none bg-white"
            >
              <option value={5}>Cada 5 minutos (recomendado para ventas)</option>
              <option value={15}>Cada 15 minutos</option>
              <option value={30}>Cada 30 minutos</option>
              <option value={60}>Cada hora</option>
              <option value={360}>Cada 6 horas</option>
              <option value={1440}>Una vez al día</option>
            </select>
          </div>

          {/* Sales History */}
          {syncConfig.sync_sales && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Historial de ventas a sincronizar
              </label>
              <select
                value={syncConfig.sales_history_days}
                onChange={(e) => setSyncConfig(prev => ({
                  ...prev,
                  sales_history_days: parseInt(e.target.value),
                }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral outline-none bg-white"
              >
                <option value={7}>Últimos 7 días</option>
                <option value={30}>Últimos 30 días</option>
                <option value={90}>Últimos 3 meses</option>
                <option value={365}>Último año</option>
              </select>
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Opciones adicionales</h4>

            {[
              {
                key: 'auto_create_categories',
                label: 'Crear categorías automáticamente',
                description: 'Si una categoría de SR no existe en TIS TIS, crearla automáticamente',
              },
              {
                key: 'auto_update_prices',
                label: 'Actualizar precios automáticamente',
                description: 'Mantener los precios sincronizados según la dirección seleccionada',
              },
              {
                key: 'include_inactive_products',
                label: 'Incluir productos inactivos',
                description: 'Sincronizar también productos deshabilitados en Soft Restaurant',
              },
              {
                key: 'alert_on_low_stock',
                label: 'Alertas de stock bajo',
                description: 'Notificar cuando el inventario esté por debajo del punto de reorden',
                icon: BellIcon,
              },
              {
                key: 'alert_on_price_change',
                label: 'Alertas de cambio de precio',
                description: 'Notificar cuando los precios cambien en cualquier sistema',
                icon: BellIcon,
              },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={syncConfig[opt.key as keyof SRSyncConfig] as boolean}
                  onChange={() => toggleSync(opt.key as keyof SRSyncConfig)}
                  className="w-4 h-4 mt-0.5 text-tis-coral border-gray-300 rounded focus:ring-tis-coral"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {opt.label}
                    {opt.icon && <opt.icon className="w-4 h-4 text-gray-400" />}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Summary Card */}
          <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
            <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
              <CheckIcon className="w-5 h-5" />
              Resumen de la integración
            </h4>
            <div className="space-y-2 text-sm text-green-700">
              <p>
                <strong>Datos a sincronizar:</strong>{' '}
                {SYNC_OPTIONS.filter(opt => syncConfig[opt.key]).map(opt => opt.label).join(', ') || 'Ninguno'}
              </p>
              <p>
                <strong>Frecuencia:</strong> Cada {syncConfig.sync_frequency_minutes} minutos
              </p>
              {syncConfig.sync_sales && (
                <p>
                  <strong>Historial de ventas:</strong> {syncConfig.sales_history_days} días
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default SoftRestaurantConfigModal;
