// =====================================================
// TIS TIS PLATFORM - SoftRestaurant Configuration Modal
// Specialized configuration for Soft Restaurant POS integration
// Supports: Webhook Official + Local Agent methods
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/src/shared/components/ui';
import { cn } from '@/src/shared/utils';
import type {
  IntegrationConnection,
  SRSyncConfig,
  SRIntegrationMethod,
  AgentInstance,
} from '../types/integration.types';

// ======================
// NATIONAL SOFT CONTACT INFO
// ======================

const NATIONAL_SOFT_CONTACT = {
  email: 'erik.basto@nationalsoft.com.mx',
  moduleName: 'Interface para ERP y PMS',
  documentation: 'OPE.ANA.SR11.Guia_para_el_modulo_de_conexion_de_ERP_y_PMS.pdf',
} as const;

// ======================
// CAPABILITY STATUS
// ======================

export type SRCapabilityStatus = 'confirmed' | 'beta' | 'coming_soon';

export type SRCapabilityKey =
  | 'sync_menu'
  | 'sync_recipes'
  | 'sync_inventory'
  | 'sync_tables'
  | 'sync_reservations'
  | 'sync_sales';

// Webhook capabilities (limited)
export const SR_WEBHOOK_CAPABILITIES: Record<SRCapabilityKey, { status: SRCapabilityStatus; note?: string }> = {
  sync_menu: { status: 'coming_soon', note: 'Requiere API adicional' },
  sync_recipes: { status: 'coming_soon', note: 'Requiere API adicional' },
  sync_inventory: { status: 'coming_soon', note: 'Requiere API adicional' },
  sync_tables: { status: 'coming_soon', note: 'Requiere API adicional' },
  sync_reservations: { status: 'coming_soon', note: 'Requiere API adicional' },
  sync_sales: { status: 'confirmed', note: 'Recibe ventas via webhook' },
};

// Local Agent capabilities (full)
export const SR_AGENT_CAPABILITIES: Record<SRCapabilityKey, { status: SRCapabilityStatus; note?: string }> = {
  sync_menu: { status: 'confirmed', note: 'Sincroniza menú completo' },
  sync_recipes: { status: 'confirmed', note: 'Incluye gramaje e ingredientes' },
  sync_inventory: { status: 'confirmed', note: 'Stock en tiempo real' },
  sync_tables: { status: 'beta', note: 'Mesas y zonas' },
  sync_reservations: { status: 'beta', note: 'Reservaciones' },
  sync_sales: { status: 'confirmed', note: 'Ventas y tickets' },
};

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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
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

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
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

function WebhookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}

function ComputerDesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

// ======================
// TYPES
// ======================

interface SoftRestaurantConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: IntegrationConnection | null;
  agentInstance?: AgentInstance | null;
  onSave: (data: {
    sync_config: SRSyncConfig;
    integration_method?: SRIntegrationMethod;
  }) => Promise<void>;
  onOpenAgentWizard?: () => void;
  isLoading: boolean;
  tenantId: string;
}

type SetupStep = 'method_select' | 'webhook_config' | 'webhook_options' | 'agent_redirect';

// ======================
// DEFAULT SYNC CONFIG
// ======================

const DEFAULT_SR_SYNC_CONFIG: SRSyncConfig = {
  sync_menu: false,
  sync_recipes: false,
  sync_inventory: false,
  sync_tables: false,
  sync_reservations: false,
  sync_sales: true,
  menu_direction: 'sr_to_tistis',
  inventory_direction: 'sr_to_tistis',
  reservations_direction: 'sr_to_tistis',
  sync_frequency_minutes: 0,
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
// COPY BUTTON
// ======================

interface CopyButtonProps {
  text: string;
  label?: string;
}

function CopyButton({ text, label = 'Copiar' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all',
        copied
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#404040] dark:text-gray-300 dark:hover:bg-[#505050]'
      )}
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5" />
          Copiado
        </>
      ) : (
        <>
          <ClipboardIcon className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </button>
  );
}

// ======================
// CREDENTIAL DISPLAY
// ======================

interface CredentialDisplayProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  isSecret?: boolean;
}

function CredentialDisplay({ label, value, icon: Icon, isSecret }: CredentialDisplayProps) {
  const [showSecret, setShowSecret] = useState(false);
  const displayValue = isSecret && !showSecret ? '•'.repeat(Math.min(32, value.length)) : value;

  return (
    <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-sm font-mono bg-white dark:bg-[#1f1f1f] px-3 py-2 rounded-lg border border-gray-200 dark:border-[#404040] break-all text-gray-900 dark:text-gray-100">
          {displayValue}
        </code>
        <div className="flex items-center gap-1">
          {isSecret && (
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showSecret ? 'Ocultar' : 'Ver'}
            </button>
          )}
          <CopyButton text={value} />
        </div>
      </div>
    </div>
  );
}

// ======================
// METHOD SELECTOR CARD
// ======================

interface MethodCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  iconColor: string;
  isRecommended?: boolean;
  features: Array<{ text: string; positive: boolean }>;
}

function MethodCard({
  selected,
  onSelect,
  title,
  subtitle,
  icon: Icon,
  iconBgColor,
  iconColor,
  isRecommended,
  features,
}: MethodCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative w-full p-5 rounded-2xl border-2 text-left transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5',
        selected
          ? 'border-tis-coral bg-gradient-to-br from-tis-coral/5 to-tis-pink/5 ring-2 ring-tis-coral/20 dark:from-tis-coral/10 dark:to-tis-pink/10'
          : 'border-gray-200 dark:border-[#404040] hover:border-tis-coral/50 bg-white dark:bg-[#262626]'
      )}
    >
      {/* Recommended badge */}
      {isRecommended && (
        <span className="absolute -top-3 left-4 px-3 py-1 text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full shadow-sm flex items-center gap-1">
          <SparklesIcon className="w-3 h-3" />
          Recomendado
        </span>
      )}

      {/* Radio indicator */}
      <div className="absolute top-4 right-4">
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            selected
              ? 'border-tis-coral bg-tis-coral'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1f1f1f]'
          )}
        >
          {selected && <CheckIcon className="w-3 h-3 text-white" />}
        </div>
      </div>

      {/* Icon and title */}
      <div className="flex items-start gap-4 mb-4">
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', iconBgColor)}>
          <Icon className={cn('w-6 h-6', iconColor)} />
        </div>
        <div className="flex-1 pr-8">
          <h4 className="font-semibold text-gray-900 dark:text-white text-base">{title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Features list */}
      <ul className="space-y-2">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            {feature.positive ? (
              <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <XIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <span
              className={cn(
                feature.positive
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 dark:text-gray-500'
              )}
            >
              {feature.text}
            </span>
          </li>
        ))}
      </ul>
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
  agentInstance,
  onSave,
  onOpenAgentWizard,
  isLoading,
  tenantId,
}: SoftRestaurantConfigModalProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('method_select');
  const [selectedMethod, setSelectedMethod] = useState<SRIntegrationMethod>('local_agent');
  const [syncConfig, setSyncConfig] = useState<SRSyncConfig>(DEFAULT_SR_SYNC_CONFIG);

  // Generate webhook URL and secret
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';

  const webhookUrl = `${baseUrl}/api/integrations/softrestaurant/webhook/${tenantId}`;
  const webhookSecret = connection?.webhook_secret || 'Se generará al guardar';

  // Determine if editing existing connection
  const isEditMode = !!connection?.id;
  const existingMethod = connection?.metadata?.integration_method as SRIntegrationMethod | undefined;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && existingMethod) {
        // Editing existing - go directly to config
        setSelectedMethod(existingMethod);
        setCurrentStep(existingMethod === 'webhook_official' ? 'webhook_options' : 'agent_redirect');

        if (connection?.metadata) {
          const savedConfig = connection.metadata as { sync_config?: Partial<SRSyncConfig> };
          if (savedConfig.sync_config) {
            setSyncConfig({ ...DEFAULT_SR_SYNC_CONFIG, ...savedConfig.sync_config });
          }
        }
      } else {
        // New connection - start at method selection
        setCurrentStep('method_select');
        setSelectedMethod('local_agent');
        setSyncConfig(DEFAULT_SR_SYNC_CONFIG);
      }
    }
  }, [isOpen, connection, isEditMode, existingMethod]);

  // Toggle sync option
  const toggleSync = useCallback((key: keyof typeof syncConfig) => {
    setSyncConfig(prev => {
      const currentValue = prev[key];
      if (typeof currentValue !== 'boolean') return prev;
      return { ...prev, [key]: !currentValue };
    });
  }, []);

  // Handle method selection continue
  const handleMethodContinue = () => {
    if (selectedMethod === 'local_agent') {
      // Open agent wizard
      onOpenAgentWizard?.();
      onClose();
    } else {
      setCurrentStep('webhook_config');
    }
  };

  // Handle webhook config continue
  const handleWebhookConfigContinue = () => {
    setCurrentStep('webhook_options');
  };

  // Handle save
  const handleSave = async () => {
    await onSave({
      sync_config: syncConfig,
      integration_method: selectedMethod,
    });
  };

  // Get step title and subtitle
  const getStepInfo = () => {
    switch (currentStep) {
      case 'method_select':
        return {
          title: 'Conectar Soft Restaurant',
          subtitle: 'Selecciona el método de integración',
        };
      case 'webhook_config':
        return {
          title: 'Configuración de Webhook',
          subtitle: 'Configura el webhook en Soft Restaurant',
        };
      case 'webhook_options':
        return {
          title: 'Opciones de Sincronización',
          subtitle: 'Personaliza las notificaciones',
        };
      default:
        return { title: 'Soft Restaurant', subtitle: '' };
    }
  };

  const stepInfo = getStepInfo();

  // Get footer buttons
  const renderFooter = () => {
    switch (currentStep) {
      case 'method_select':
        return (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleMethodContinue}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-tis-coral/25"
            >
              Continuar
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </>
        );
      case 'webhook_config':
        return (
          <>
            <button
              type="button"
              onClick={() => setCurrentStep('method_select')}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleWebhookConfigContinue}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-tis-coral/25"
            >
              Continuar
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </>
        );
      case 'webhook_options':
        return (
          <>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => setCurrentStep('webhook_config')}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors"
              >
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-tis-coral/25"
            >
              {isLoading && <SyncIcon className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Guardar Cambios' : 'Activar Integración'}
            </button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stepInfo.title}
      subtitle={stepInfo.subtitle}
      size="lg"
      footer={renderFooter()}
    >
      {/* Step: Method Selection */}
      {currentStep === 'method_select' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-100 dark:border-green-800/30">
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1f1f1f] shadow-sm flex items-center justify-center">
              <RestaurantIcon className="w-8 h-8 text-green-600 dark:text-green-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Soft Restaurant</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">POS #1 en México para restaurantes</p>
            </div>
          </div>

          {/* Method selection cards */}
          <div className="grid gap-4">
            <MethodCard
              selected={selectedMethod === 'local_agent'}
              onSelect={() => setSelectedMethod('local_agent')}
              title="Agente Local TIS TIS"
              subtitle="Instalación en tu servidor"
              icon={ComputerDesktopIcon}
              iconBgColor="bg-gradient-to-br from-tis-coral/10 to-tis-pink/10 dark:from-tis-coral/20 dark:to-tis-pink/20"
              iconColor="text-tis-coral"
              isRecommended
              features={[
                { text: 'Sin costo adicional', positive: true },
                { text: 'Menú completo + Inventario + Ventas', positive: true },
                { text: 'Recetas con gramaje', positive: true },
                { text: 'Control total y soporte TIS TIS', positive: true },
                { text: 'No requiere módulo National Soft', positive: true },
              ]}
            />

            <MethodCard
              selected={selectedMethod === 'webhook_official'}
              onSelect={() => setSelectedMethod('webhook_official')}
              title="Webhook Oficial (ERP/PMS)"
              subtitle="Módulo de National Soft"
              icon={WebhookIcon}
              iconBgColor="bg-blue-50 dark:bg-blue-900/20"
              iconColor="text-blue-600 dark:text-blue-400"
              features={[
                { text: 'Requiere compra de módulo adicional', positive: false },
                { text: 'Solo sincroniza ventas', positive: false },
                { text: 'Sin acceso a menú ni inventario', positive: false },
                { text: 'Dependencia de tercero', positive: false },
                { text: 'Integración oficial National Soft', positive: true },
              ]}
            />
          </div>

          {/* Info note */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Nota:</strong> El Agente Local TIS TIS se instala en el servidor donde corre Soft Restaurant
              y lee directamente la base de datos SQL Server para sincronizar todos tus datos.
            </p>
          </div>
        </div>
      )}

      {/* Step: Webhook Configuration */}
      {currentStep === 'webhook_config' && (
        <div className="space-y-6">
          {/* How it works */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
            <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4" />
              Cómo funciona esta integración
            </h5>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
              Soft Restaurant enviará automáticamente las ventas a TIS TIS cada vez que se cierre un ticket.
            </p>
            <div className="flex items-center gap-4 text-xs text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-1">
                <CheckIcon className="w-3.5 h-3.5" />
                Tiempo real
              </span>
              <span className="flex items-center gap-1">
                <CheckIcon className="w-3.5 h-3.5" />
                Seguro
              </span>
              <span className="flex items-center gap-1">
                <CheckIcon className="w-3.5 h-3.5" />
                Automático
              </span>
            </div>
          </div>

          {/* Webhook Credentials */}
          <div className="space-y-4">
            <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <CogIcon className="w-4 h-4" />
              Datos para configurar en Soft Restaurant
            </h5>

            <CredentialDisplay
              label="URL del Webhook"
              value={webhookUrl}
              icon={LinkIcon}
            />

            {connection?.webhook_secret ? (
              <CredentialDisplay
                label="Secret de Autenticación"
                value={webhookSecret}
                icon={KeyIcon}
                isSecret
              />
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  <strong>Nota:</strong> El secret de autenticación se generará automáticamente al activar la integración.
                </p>
              </div>
            )}
          </div>

          {/* Configuration Steps */}
          <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
            <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Pasos para configurar en Soft Restaurant
            </h5>
            <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              {[
                `Contacta a National Soft para adquirir el módulo "${NATIONAL_SOFT_CONTACT.moduleName}"`,
                'En Soft Restaurant, ve a Configuración → Interface para ERP y PMS',
                'Pega la URL del Webhook en el campo de URL del servidor',
                'Pega el Secret en el campo de Authorization header',
                'Selecciona cuándo enviar los datos: Al cierre de cada ticket (recomendado)',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-tis-coral text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {i + 1}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                </li>
              ))}
            </ol>
          </div>

          {/* Contact National Soft */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30">
            <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
              <EnvelopeIcon className="w-4 h-4" />
              ¿No tienes el módulo de ERP/PMS?
            </h5>
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              Contacta a National Soft para adquirir el módulo de integración:
            </p>
            <a
              href={`mailto:${NATIONAL_SOFT_CONTACT.email}?subject=Solicitud%20de%20m%C3%B3dulo%20Interface%20para%20ERP%20y%20PMS`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-100 dark:bg-amber-800/30 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-800 dark:text-amber-300 rounded-lg font-medium text-sm transition-colors w-full"
            >
              <EnvelopeIcon className="w-4 h-4" />
              {NATIONAL_SOFT_CONTACT.email}
            </a>
          </div>
        </div>
      )}

      {/* Step: Webhook Options */}
      {currentStep === 'webhook_options' && (
        <div className="space-y-6">
          {/* Sales Sync Card */}
          <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl border border-pink-100 dark:border-pink-800/30">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <ChartIcon className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white">Recepción de Ventas</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  TIS TIS recibirá automáticamente los datos de cada venta.
                </p>
              </div>
              <div className="w-12 h-7 rounded-full bg-green-500 relative">
                <div className="absolute top-1 translate-x-6 w-5 h-5 bg-white rounded-full shadow" />
              </div>
            </div>
          </div>

          {/* Notification Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Notificaciones</h4>

            {[
              {
                key: 'alert_on_low_stock',
                label: 'Alertas de ventas altas',
                description: 'Notificar cuando las ventas superen un umbral',
                icon: BellIcon,
              },
              {
                key: 'alert_on_price_change',
                label: 'Resumen diario de ventas',
                description: 'Recibir un resumen al final del día',
                icon: BellIcon,
              },
            ].map((opt) => (
              <label
                key={opt.key}
                className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-[#404040] hover:border-gray-300 dark:hover:border-[#505050] cursor-pointer transition-colors bg-white dark:bg-[#262626]"
              >
                <input
                  type="checkbox"
                  checked={syncConfig[opt.key as keyof SRSyncConfig] as boolean}
                  onChange={() => toggleSync(opt.key as keyof SRSyncConfig)}
                  className="w-4 h-4 mt-0.5 text-tis-coral border-gray-300 dark:border-gray-600 rounded focus:ring-tis-coral bg-white dark:bg-[#1f1f1f]"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {opt.label}
                    <opt.icon className="w-4 h-4 text-gray-400" />
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Connection Status (edit mode) */}
          {isEditMode && connection && (
            <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Estado de la conexión</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                  <span
                    className={cn(
                      'ml-2 font-medium',
                      connection.status === 'connected'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {connection.status === 'connected' ? 'Conectado' : connection.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Última sincronización:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {connection.last_sync_at
                      ? new Date(connection.last_sync_at).toLocaleString('es-MX')
                      : 'Nunca'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Ventas recibidas hoy:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {connection.records_synced_today || 0}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Total histórico:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {connection.records_synced_total || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              <strong>Nota:</strong> Los datos de ventas se reciben en tiempo real cada vez que Soft Restaurant
              cierra un ticket.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default SoftRestaurantConfigModal;
