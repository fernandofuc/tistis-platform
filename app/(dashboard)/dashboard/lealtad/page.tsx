// =====================================================
// TIS TIS PLATFORM - Loyalty Page
// Premium Design with Apple/TIS TIS Professional Style
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { useTenant } from '@/src/hooks/useTenant';
import { useFeatureFlags } from '@/src/hooks/useFeatureFlags';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import { supabase } from '@/src/shared/lib/supabase';

// Import tab components
import { LoyaltyOverview } from '@/src/features/loyalty/components/LoyaltyOverview';
import { TokensManagement } from '@/src/features/loyalty/components/TokensManagement';
import { MembershipsManagement } from '@/src/features/loyalty/components/MembershipsManagement';
import { RewardsManagement } from '@/src/features/loyalty/components/RewardsManagement';
import { LoyaltySettings } from '@/src/features/loyalty/components/LoyaltySettings';

// ======================
// TOGGLE SWITCH COMPONENT - Professional Style
// ======================
interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}

function ToggleSwitch({ enabled, onToggle, loading }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
        enabled ? 'bg-tis-coral' : 'bg-slate-200',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ======================
// FEATURE TOGGLE CARD - Professional Design
// ======================
interface FeatureToggleCardProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
  icon: React.ReactNode;
  activeLabel?: string;
  inactiveLabel?: string;
}

function FeatureToggleCard({
  title,
  description,
  enabled,
  onToggle,
  loading,
  icon,
  activeLabel = 'Activo',
  inactiveLabel = 'Inactivo',
}: FeatureToggleCardProps) {
  return (
    <div className={cn(
      'relative rounded-2xl border p-5 transition-all duration-200',
      enabled
        ? 'border-slate-200 bg-white shadow-sm'
        : 'border-slate-200/80 bg-slate-50/50'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all',
            enabled
              ? 'bg-slate-900 text-white'
              : 'bg-slate-200 text-slate-400'
          )}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            <div className="mt-2.5">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                enabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  enabled ? 'bg-emerald-500' : 'bg-slate-400'
                )} />
                {enabled ? activeLabel : inactiveLabel}
              </span>
            </div>
          </div>
        </div>
        <ToggleSwitch enabled={enabled} onToggle={onToggle} loading={loading} />
      </div>
    </div>
  );
}

// ======================
// TYPES
// ======================
type TabId = 'overview' | 'tokens' | 'memberships' | 'rewards' | 'settings';

interface Tab {
  id: TabId;
  name: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'overview', name: 'Resumen', description: 'Vista general del programa' },
  { id: 'tokens', name: 'Tokens', description: 'Gestionar tokens y reglas' },
  { id: 'memberships', name: 'Membresías', description: 'Planes y suscripciones' },
  { id: 'rewards', name: 'Recompensas', description: 'Catálogo de recompensas' },
  { id: 'settings', name: 'Configuración', description: 'Configurar programa' },
];

// ======================
// UPGRADE PROMPT COMPONENT - Professional Design
// ======================
interface UpgradePromptProps {
  patientsName: string;
}

function UpgradePrompt({ patientsName }: UpgradePromptProps) {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-8">
      <div className="relative max-w-4xl w-full">
        {/* Blurred Preview Background */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="blur-sm opacity-50 p-8 bg-white">
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-slate-100 rounded-xl p-6 h-28" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-100 rounded-xl p-6 h-64" />
              <div className="bg-slate-100 rounded-xl p-6 h-64" />
            </div>
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mx-auto max-w-lg mt-20">
          <div className="text-center">
            {/* Lock Icon */}
            <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Sistema de Lealtad
            </h2>
            <p className="text-slate-500 mb-6">
              Fideliza a tus {patientsName} con tokens, membresías y recompensas personalizadas.
            </p>

            {/* Features List */}
            <div className="text-left bg-slate-50 rounded-xl p-4 mb-6">
              <ul className="space-y-3">
                {[
                  'Sistema de tokens por visitas y acciones',
                  'Membresías mensuales y anuales',
                  'Catálogo de recompensas canjeables',
                  'Mensajes automáticos con IA',
                  `Reactivación de ${patientsName} inactivos`,
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <svg className="w-5 h-5 text-tis-coral flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Upgrade Button */}
            <button
              onClick={() => router.push('/dashboard/settings/subscription')}
              className="w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
            >
              Actualizar a Essentials
            </button>

            <p className="text-xs text-slate-400 mt-4">
              Disponible desde el plan Essentials
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// LOYALTY PROGRAM STATE INTERFACE
// ======================
interface LoyaltyProgramState {
  id: string;
  program_name: string;
  tokens_enabled: boolean;
  membership_enabled: boolean;
  is_active: boolean;
}

// ======================
// MAIN PAGE COMPONENT
// ======================
export default function LealtadPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { isEnabled, flagsLoading } = useFeatureFlags();
  const { terminology } = useVerticalTerminology();

  // Loyalty program state
  const [program, setProgram] = useState<LoyaltyProgramState | null>(null);
  const [programLoading, setProgramLoading] = useState(true);
  const [tokensToggleLoading, setTokensToggleLoading] = useState(false);
  const [membershipsToggleLoading, setMembershipsToggleLoading] = useState(false);

  // Fetch loyalty program config
  const fetchProgram = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch('/api/loyalty', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data?.program) {
          setProgram({
            id: result.data.program.id,
            program_name: result.data.program.program_name,
            tokens_enabled: result.data.program.tokens_enabled ?? true,
            membership_enabled: result.data.program.membership_enabled ?? true,
            is_active: result.data.program.is_active ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching loyalty program:', error);
    } finally {
      setProgramLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  // Toggle tokens
  const handleToggleTokens = async () => {
    if (!program || tokensToggleLoading) return;

    setTokensToggleLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const newValue = !program.tokens_enabled;

      const response = await fetch('/api/loyalty', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tokens_enabled: newValue }),
      });

      if (response.ok) {
        setProgram(prev => prev ? { ...prev, tokens_enabled: newValue } : null);
      }
    } catch (error) {
      console.error('Error toggling tokens:', error);
    } finally {
      setTokensToggleLoading(false);
    }
  };

  // Toggle memberships
  const handleToggleMemberships = async () => {
    if (!program || membershipsToggleLoading) return;

    setMembershipsToggleLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const newValue = !program.membership_enabled;

      const response = await fetch('/api/loyalty', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ membership_enabled: newValue }),
      });

      if (response.ok) {
        setProgram(prev => prev ? { ...prev, membership_enabled: newValue } : null);
      }
    } catch (error) {
      console.error('Error toggling memberships:', error);
    } finally {
      setMembershipsToggleLoading(false);
    }
  };

  // Check if loyalty is enabled for this tenant
  const loyaltyEnabled = isEnabled('loyalty_enabled');
  const isStarterPlan = tenant?.plan === 'starter';

  // Show loading state
  if (tenantLoading || flagsLoading || programLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-tis-coral"></div>
      </div>
    );
  }

  // Show upgrade prompt for Starter plan users
  if (isStarterPlan || !loyaltyEnabled) {
    return <UpgradePrompt patientsName={terminology.patients.toLowerCase()} />;
  }

  // Filter tabs based on enabled features
  const availableTabs = TABS.filter(tab => {
    if (tab.id === 'tokens' && !program?.tokens_enabled) return false;
    if (tab.id === 'memberships' && !program?.membership_enabled) return false;
    return true;
  });

  // Render active tab content
  const renderTabContent = () => {
    if (activeTab === 'tokens' && !program?.tokens_enabled) {
      return <LoyaltyOverview />;
    }
    if (activeTab === 'memberships' && !program?.membership_enabled) {
      return <LoyaltyOverview />;
    }

    switch (activeTab) {
      case 'overview':
        return <LoyaltyOverview />;
      case 'tokens':
        return <TokensManagement />;
      case 'memberships':
        return <MembershipsManagement />;
      case 'rewards':
        return <RewardsManagement />;
      case 'settings':
        return <LoyaltySettings />;
      default:
        return <LoyaltyOverview />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Programa de Lealtad</h1>
          <p className="text-slate-500 mt-1">
            Gestiona tokens, membresías y recompensas para fidelizar a tus {terminology.patients.toLowerCase()}
          </p>
        </div>
      </div>

      {/* Feature Toggles - Professional Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FeatureToggleCard
          title="Sistema de Tokens"
          description={`Otorga puntos por ${terminology.appointments.toLowerCase()}, compras y acciones de tus ${terminology.patients.toLowerCase()}`}
          enabled={program?.tokens_enabled ?? true}
          onToggle={handleToggleTokens}
          loading={tokensToggleLoading}
          activeLabel="Tokens Activos"
          inactiveLabel="Tokens Desactivados"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <FeatureToggleCard
          title="Sistema de Membresías"
          description="Ofrece planes de suscripción con beneficios exclusivos"
          enabled={program?.membership_enabled ?? true}
          onToggle={handleToggleMemberships}
          loading={membershipsToggleLoading}
          activeLabel="Membresías Activas"
          inactiveLabel="Membresías Desactivadas"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          }
        />
      </div>

      {/* Info banner when features are disabled */}
      {(!program?.tokens_enabled || !program?.membership_enabled) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-700">
                Funciones desactivadas
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                {!program?.tokens_enabled && !program?.membership_enabled
                  ? `El sistema de tokens y membresías están desactivados. Actívalos para gestionar la lealtad de tus ${terminology.patients.toLowerCase()}.`
                  : !program?.tokens_enabled
                    ? `El sistema de tokens está desactivado. Actívalo para otorgar puntos a tus ${terminology.patients.toLowerCase()}.`
                    : 'El sistema de membresías está desactivado. Actívalo para ofrecer planes de suscripción.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Professional Style */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200',
                activeTab === tab.id
                  ? 'border-tis-coral text-tis-coral'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
