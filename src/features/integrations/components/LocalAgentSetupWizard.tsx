// =====================================================
// TIS TIS PLATFORM - Local Agent Setup Wizard
// 5-step wizard for configuring the TIS TIS Local Agent
// for Soft Restaurant integration
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/src/shared/components/ui';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import type {
  AgentCredentials,
  AgentInstallerConfig,
  SRSyncConfig,
} from '../types/integration.types';

// ======================
// TYPES
// ======================

export interface Branch {
  id: string;
  name: string;
  address?: string;
  is_main?: boolean;
}

interface LocalAgentSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  branches: Branch[];  // List of available branches
  integrationId?: string;  // Optional: if provided, uses this integration
  onComplete: (config: {
    sync_config: Partial<SRSyncConfig>;
    credentials: AgentCredentials;
    branchId?: string;
    storeCode?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface SyncOption {
  key: keyof SRSyncConfig;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'available' | 'beta' | 'coming_soon';
}

// ======================
// ICONS
// ======================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

function ComputerDesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
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

function ArrowDownTrayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function WrenchScrewdriverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function CheckBadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  );
}

function DocumentTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
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

function ChartBarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function TableCellsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
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

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
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

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeSlashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
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

// ======================
// STEP INDICATOR
// ======================

interface StepIndicatorProps {
  currentStep: WizardStep;
  totalSteps: number;
}

function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const steps = [
    { num: 1, label: 'Información', icon: DocumentTextIcon },
    { num: 2, label: 'Configuración', icon: CogIcon },
    { num: 3, label: 'Descarga', icon: ArrowDownTrayIcon },
    { num: 4, label: 'Instalación', icon: WrenchScrewdriverIcon },
    { num: 5, label: 'Verificación', icon: CheckBadgeIcon },
  ];

  return (
    <div className="flex items-center justify-between px-2 mb-8">
      {steps.slice(0, totalSteps).map((step, idx) => {
        const isCompleted = currentStep > step.num;
        const isActive = currentStep === step.num;
        const Icon = step.icon;

        return (
          <div key={step.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isActive
                    ? 'bg-gradient-to-br from-tis-coral to-tis-pink text-white shadow-lg shadow-tis-coral/30'
                    : 'bg-gray-100 dark:bg-[#2f2f2f] text-gray-400 dark:text-gray-500'
                )}
              >
                {isCompleted ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs font-medium text-center hidden sm:block',
                  isActive ? 'text-tis-coral' : 'text-gray-500 dark:text-gray-400'
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < totalSteps - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 transition-colors duration-300',
                  currentStep > step.num ? 'bg-green-500' : 'bg-gray-200 dark:bg-[#404040]'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ======================
// COPY BUTTON
// ======================

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
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
      aria-label={copied ? 'Copiado al portapapeles' : `${label} al portapapeles`}
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
          <span aria-live="polite">Copiado</span>
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
// SYNC OPTIONS
// ======================

const SYNC_OPTIONS: SyncOption[] = [
  {
    key: 'sync_sales',
    label: 'Ventas y Tickets',
    description: 'Sincroniza todas las ventas en tiempo real',
    icon: ChartBarIcon,
    status: 'available',
  },
  {
    key: 'sync_menu',
    label: 'Menú Completo',
    description: 'Productos, precios y categorías',
    icon: DocumentTextIcon,
    status: 'available',
  },
  {
    key: 'sync_recipes',
    label: 'Recetas con Gramaje',
    description: 'Ingredientes y costos de cada platillo',
    icon: CubeIcon,
    status: 'available',
  },
  {
    key: 'sync_inventory',
    label: 'Inventario',
    description: 'Stock, movimientos y alertas',
    icon: CubeIcon,
    status: 'available',
  },
  {
    key: 'sync_tables',
    label: 'Mesas y Zonas',
    description: 'Layout del restaurante',
    icon: TableCellsIcon,
    status: 'beta',
  },
];

// ======================
// MAIN COMPONENT
// ======================

export function LocalAgentSetupWizard({
  isOpen,
  onClose,
  tenantId,
  branches,
  integrationId: propIntegrationId,
  onComplete,
  isLoading = false,
}: LocalAgentSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [syncConfig, setSyncConfig] = useState<Partial<SRSyncConfig>>({
    sync_sales: true,
    sync_menu: true,
    sync_recipes: true,
    sync_inventory: true,
    sync_tables: false,
  });
  const [credentials, setCredentials] = useState<AgentCredentials | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'waiting' | 'connected' | 'error'>('waiting');

  // Multi-branch configuration
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [storeCode, setStoreCode] = useState<string>('');
  const [storeCodeError, setStoreCodeError] = useState<string | null>(null);

  // Validate storeCode format
  const validateStoreCode = useCallback((value: string): boolean => {
    if (!value.trim()) {
      setStoreCodeError(null);
      return true;  // Empty is valid
    }
    if (value.length > 50) {
      setStoreCodeError('Máximo 50 caracteres');
      return false;
    }
    if (!/^[a-zA-Z0-9_-]*$/.test(value)) {
      setStoreCodeError('Solo letras, números, guiones y guiones bajos');
      return false;
    }
    setStoreCodeError(null);
    return true;
  }, []);

  // Handle storeCode change with validation
  const handleStoreCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStoreCode(value);
    validateStoreCode(value);
  }, [validateStoreCode]);

  // Generate webhook URL
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || 'https://app.tistis.com';

  // Reset wizard when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSyncConfig({
        sync_sales: true,
        sync_menu: true,
        sync_recipes: true,
        sync_inventory: true,
        sync_tables: false,
      });
      setCredentials(null);
      setShowToken(false);
      setAgentStatus('waiting');
      // Reset multi-branch config - default to main branch if available
      const mainBranch = branches.find(b => b.is_main) || branches[0];
      setSelectedBranchId(mainBranch?.id || '');
      setStoreCode('');
    }
  }, [isOpen, branches]);

  // Toggle sync option
  const toggleSync = useCallback((key: keyof SRSyncConfig) => {
    // Sales is required
    if (key === 'sync_sales') return;
    setSyncConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Error state for credential generation
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);

  // Helper to get auth headers with Bearer token
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

  // Generate credentials via API
  const generateCredentials = async () => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      // Use provided integration ID or find/create one
      const effectiveIntegrationId = propIntegrationId || integrationId || await findOrCreateSRIntegration();

      // Cache it for potential retries
      if (effectiveIntegrationId && !integrationId) {
        setIntegrationId(effectiveIntegrationId);
      }

      if (!effectiveIntegrationId) {
        throw new Error('No se pudo encontrar la integración de Soft Restaurant');
      }

      const headers = await getAuthHeaders();
      const response = await fetch('/api/agent/installer', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          integration_id: effectiveIntegrationId,
          branch_id: selectedBranchId || undefined,
          store_code: storeCode.trim() || undefined,
          sync_menu: syncConfig.sync_menu || false,
          sync_inventory: syncConfig.sync_inventory || false,
          sync_sales: syncConfig.sync_sales || false,
          sync_tables: syncConfig.sync_tables || false,
          sync_interval_seconds: 300,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error generando credenciales');
      }

      const apiCredentials: AgentCredentials = {
        agent_id: data.agent_id,
        auth_token: data.auth_token,
        webhook_url: data.webhook_url,
        expires_at: data.expires_at,
      };

      setCredentials(apiCredentials);
    } catch (error) {
      console.error('Failed to generate credentials:', error);
      setGenerateError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to find or create Soft Restaurant integration
  const findOrCreateSRIntegration = async (): Promise<string | null> => {
    try {
      const headers = await getAuthHeaders();

      // First, try to find existing SR integration for this tenant
      const response = await fetch('/api/integrations?type=softrestaurant', {
        headers,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.connections && data.connections.length > 0) {
          return data.connections[0].id;
        }
      }

      // If not found, create one
      const createResponse = await fetch('/api/integrations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          integration_type: 'softrestaurant',
          connection_name: 'Soft Restaurant (Local Agent)',
          sync_products: true,
          sync_inventory: true,
        }),
      });

      if (createResponse.ok) {
        const newIntegration = await createResponse.json();
        // API returns { connection: { id, ... } }, not { id, ... }
        return newIntegration.connection?.id || newIntegration.id;
      }

      return null;
    } catch {
      return null;
    }
  };

  // Handle step navigation
  const handleNext = async () => {
    // Validate before moving from Step 2
    if (currentStep === 2) {
      // Validate storeCode if entered
      if (storeCode && !validateStoreCode(storeCode)) {
        return;  // Don't proceed if storeCode is invalid
      }

      // Validate: if sync_sales is enabled, branch must be selected (for multi-branch tenants)
      if (syncConfig.sync_sales && branches.length > 1 && !selectedBranchId) {
        // This shouldn't happen because we default to first branch, but safety check
        console.warn('[AgentWizard] Sales sync enabled but no branch selected');
      }

      // Generate credentials before moving to download step
      await generateCredentials();

      // Only proceed if credentials were generated successfully
      // (credentials will be set if successful, generateError will be set if failed)
      // Note: We still move to step 3 so user can see the error and retry
      // The "Continue" button in step 3 should check for credentials before allowing to proceed
    }

    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  // Handle complete
  const handleComplete = async () => {
    if (credentials) {
      await onComplete({
        sync_config: syncConfig,
        credentials,
        branchId: selectedBranchId || undefined,
        storeCode: storeCode.trim() || undefined,
      });
    }
    onClose();
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      // Step 1: Information
      case 1:
        return (
          <div className="space-y-6">
            {/* Hero */}
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-tis-coral/10 to-tis-pink/10 dark:from-tis-coral/20 dark:to-tis-pink/20 rounded-2xl border border-tis-coral/20">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#1f1f1f] shadow-lg flex items-center justify-center">
                <ComputerDesktopIcon className="w-9 h-9 text-tis-coral" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Agente Local TIS TIS</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sincronización directa con Soft Restaurant
                </p>
              </div>
            </div>

            {/* What is it */}
            <div className="space-y-4">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">¿Qué es el Agente Local?</h5>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                El Agente Local TIS TIS es un servicio de Windows que se instala en el servidor donde corre
                Soft Restaurant. Lee directamente la base de datos SQL Server y envía los datos a TIS TIS
                de forma automática y segura.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Beneficios</h5>
              <div className="grid gap-3">
                {[
                  { id: 'no-cost', icon: ShieldCheckIcon, title: 'Sin costo adicional', desc: 'No requiere módulos de terceros' },
                  { id: 'full-sync', icon: SyncIcon, title: 'Sincronización completa', desc: 'Menú, inventario, ventas y más' },
                  { id: 'full-control', icon: ComputerDesktopIcon, title: 'Control total', desc: 'Soporte directo de TIS TIS' },
                ].map((benefit) => (
                  <div
                    key={benefit.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#262626] rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{benefit.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <h5 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Requisitos</h5>
              <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                <li>• Windows 10/11 o Windows Server 2016+</li>
                <li>• Soft Restaurant v10 o superior</li>
                <li>• Acceso a la base de datos SQL Server</li>
                <li>• Conexión a internet</li>
              </ul>
            </div>
          </div>
        );

      // Step 2: Configuration
      case 2:
        return (
          <div className="space-y-6">
            {/* Branch Selection (Multi-branch support) */}
            {branches.length > 1 && (
              <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                    Configuración Multi-Sucursal
                  </h5>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Tienes múltiples sucursales. Selecciona a cuál asociar este agente.
                  </p>
                </div>

                {/* Branch Selector */}
                <div className="space-y-2">
                  <label htmlFor="branchSelect" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sucursal de TIS TIS
                  </label>
                  <select
                    id="branchSelect"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#404040] rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-tis-coral text-gray-900 dark:text-white"
                  >
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.is_main ? '(Principal)' : ''} {branch.address ? `- ${branch.address}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Las ventas se guardarán en esta sucursal en TIS TIS
                  </p>
                </div>

                {/* Store Code Input */}
                <div className="space-y-2">
                  <label htmlFor="storeCode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Código de Tienda en Soft Restaurant (opcional)
                  </label>
                  <input
                    id="storeCode"
                    type="text"
                    value={storeCode}
                    onChange={handleStoreCodeChange}
                    placeholder="Ej: TIENDA01, SUC_CENTRO"
                    maxLength={50}
                    className={cn(
                      'w-full px-3 py-2.5 text-sm bg-white dark:bg-[#1f1f1f] border rounded-xl focus:ring-2 focus:ring-tis-coral focus:border-tis-coral text-gray-900 dark:text-white placeholder:text-gray-400',
                      storeCodeError
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-[#404040]'
                    )}
                  />
                  {storeCodeError ? (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {storeCodeError}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Si tu Soft Restaurant tiene múltiples tiendas, ingresa el CodigoTienda o Almacen para filtrar solo los datos de esta sucursal.
                      Déjalo vacío si es una instalación de tienda única.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Selecciona qué datos sincronizar
              </h5>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Elige las funcionalidades que deseas habilitar. Podrás modificar esto después.
              </p>
            </div>

            <div className="space-y-3">
              {SYNC_OPTIONS.map((option) => {
                const isEnabled = syncConfig[option.key] as boolean;
                const isRequired = option.key === 'sync_sales';
                const Icon = option.icon;

                return (
                  <label
                    key={option.key}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer',
                      isEnabled
                        ? 'border-tis-coral bg-tis-coral/5 dark:bg-tis-coral/10'
                        : 'border-gray-200 dark:border-[#404040] hover:border-gray-300 dark:hover:border-[#505050]',
                      isRequired && 'cursor-default'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleSync(option.key)}
                      disabled={isRequired}
                      className="w-5 h-5 mt-0.5 text-tis-coral border-gray-300 dark:border-gray-600 rounded focus:ring-tis-coral bg-white dark:bg-[#1f1f1f] disabled:opacity-60"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={cn('w-5 h-5', isEnabled ? 'text-tis-coral' : 'text-gray-400')} />
                        <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                        {isRequired && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-[#404040] text-gray-600 dark:text-gray-300 rounded-full">
                            Requerido
                          </span>
                        )}
                        {option.status === 'beta' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                            Beta
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );

      // Step 3: Download
      case 3:
        return (
          <div className="space-y-6">
            {/* Error Alert */}
            {generateError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Error generando credenciales</p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">{generateError}</p>
                    <button
                      type="button"
                      onClick={generateCredentials}
                      className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 underline hover:no-underline"
                    >
                      Reintentar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Installer info */}
            <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800/30">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-white dark:bg-[#1f1f1f] shadow-sm flex items-center justify-center">
                  <ArrowDownTrayIcon className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Instalador listo</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Credenciales pre-configuradas incluidas
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/25"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Descargar TIS-TIS-Agent-SR.msi
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                Tamaño: ~15 MB • Requisitos: Windows 10+, .NET 8.0
              </p>
            </div>

            {/* Credentials */}
            <div className="space-y-4">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <KeyIcon className="w-4 h-4" />
                Credenciales de conexión
              </h5>

              <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">URL del Webhook</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white dark:bg-[#1f1f1f] px-3 py-2 rounded-lg border border-gray-200 dark:border-[#404040] break-all text-gray-900 dark:text-gray-100">
                    {credentials?.webhook_url || 'Generando...'}
                  </code>
                  {credentials && <CopyButton text={credentials.webhook_url} />}
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-[#262626] rounded-xl border border-gray-200 dark:border-[#404040]">
                <div className="flex items-center gap-2 mb-2">
                  <KeyIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Token de autenticación</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-white dark:bg-[#1f1f1f] px-3 py-2 rounded-lg border border-gray-200 dark:border-[#404040] break-all text-gray-900 dark:text-gray-100">
                    {credentials
                      ? showToken
                        ? credentials.auth_token
                        : '•'.repeat(32)
                      : 'Generando...'}
                  </code>
                  {credentials && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        {showToken ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                      </button>
                      <CopyButton text={credentials.auth_token} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Guarda estas credenciales</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    El token de autenticación solo se mostrará una vez. Guárdalo en un lugar seguro.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      // Step 4: Installation
      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Instrucciones de instalación</h5>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sigue estos pasos para instalar el agente en tu servidor.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  num: 1,
                  title: 'Ejecuta el instalador',
                  desc: 'Haz doble clic en el archivo TIS-TIS-Agent-SR.msi que descargaste',
                },
                {
                  num: 2,
                  title: 'Acepta los términos',
                  desc: 'Lee y acepta los términos de licencia de TIS TIS',
                },
                {
                  num: 3,
                  title: 'Detección automática',
                  desc: 'El instalador detectará automáticamente tu instalación de Soft Restaurant',
                },
                {
                  num: 4,
                  title: 'Verifica la conexión',
                  desc: 'El asistente verificará que puede conectarse a la base de datos',
                },
                {
                  num: 5,
                  title: 'Completa la instalación',
                  desc: 'El servicio se instalará y comenzará a sincronizar automáticamente',
                },
              ].map((step) => (
                <div key={step.num} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-tis-coral text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{step.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Help note */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>¿Necesitas ayuda?</strong> Si tienes problemas durante la instalación, contacta a nuestro
                equipo de soporte en <span className="font-medium">soporte@tistis.com</span>
              </p>
            </div>
          </div>
        );

      // Step 5: Verification
      case 5:
        return (
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center py-8">
              {agentStatus === 'waiting' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                    <SyncIcon className="w-8 h-8 text-amber-600 dark:text-amber-400 animate-spin" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Esperando conexión del agente
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
                    Una vez que completes la instalación, el agente se conectará automáticamente.
                    Esta pantalla se actualizará cuando detectemos la conexión.
                  </p>
                </>
              )}

              {agentStatus === 'connected' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <CheckBadgeIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Agente conectado exitosamente
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
                    El agente está funcionando correctamente y ha comenzado a sincronizar datos.
                  </p>
                </>
              )}
            </div>

            {/* Agent status card (when connected) */}
            {agentStatus === 'connected' && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/30">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Agente Local TIS TIS</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {credentials?.agent_id} • v1.0.0
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Skip verification button */}
            {agentStatus === 'waiting' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAgentStatus('connected')}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                >
                  Simular conexión exitosa (demo)
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Render footer
  const renderFooter = () => (
    <>
      {currentStep > 1 && (
        <button
          type="button"
          onClick={handleBack}
          disabled={isLoading || isGenerating}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Atrás
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#2f2f2f] border border-gray-300 dark:border-[#404040] rounded-xl hover:bg-gray-50 dark:hover:bg-[#363636] transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      {currentStep < 5 ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={isLoading || isGenerating || (currentStep === 3 && !credentials)}
          className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-tis-coral/25 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <SyncIcon className="w-4 h-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              Continuar
              <ArrowRightIcon className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleComplete}
          disabled={isLoading || agentStatus !== 'connected'}
          className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-green-500/25 disabled:opacity-50"
        >
          <CheckIcon className="w-4 h-4" />
          Completar configuración
        </button>
      )}
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar Agente Local"
      subtitle={`Paso ${currentStep} de 5`}
      size="lg"
      footer={renderFooter()}
    >
      <StepIndicator currentStep={currentStep} totalSteps={5} />
      {renderStepContent()}
    </Modal>
  );
}
