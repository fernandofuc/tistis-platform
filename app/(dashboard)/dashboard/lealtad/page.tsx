// =====================================================
// TIS TIS PLATFORM - Loyalty Page
// Main loyalty management page with plan-based access
// =====================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { useTenant } from '@/src/hooks/useTenant';
import { useFeatureFlags } from '@/src/hooks/useFeatureFlags';

// Import tab components
import { LoyaltyOverview } from '@/src/features/loyalty/components/LoyaltyOverview';
import { TokensManagement } from '@/src/features/loyalty/components/TokensManagement';
import { MembershipsManagement } from '@/src/features/loyalty/components/MembershipsManagement';
import { RewardsManagement } from '@/src/features/loyalty/components/RewardsManagement';
import { LoyaltySettings } from '@/src/features/loyalty/components/LoyaltySettings';

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
// UPGRADE PROMPT COMPONENT
// ======================
function UpgradePrompt() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-8">
      <div className="relative max-w-4xl w-full">
        {/* Blurred Preview Background */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="blur-sm opacity-50 p-8 bg-white">
            {/* Fake dashboard preview */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl p-6 h-28" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-100 rounded-xl p-6 h-64" />
              <div className="bg-gray-100 rounded-xl p-6 h-64" />
            </div>
          </div>
        </div>

        {/* Upgrade Card */}
        <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mx-auto max-w-lg mt-20">
          <div className="text-center">
            {/* Lock Icon */}
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Sistema de Lealtad
            </h2>
            <p className="text-gray-500 mb-6">
              Fideliza a tus pacientes con tokens, membresías y recompensas personalizadas.
            </p>

            {/* Features List */}
            <div className="text-left bg-gray-50 rounded-xl p-4 mb-6">
              <ul className="space-y-3">
                {[
                  'Sistema de tokens por visitas y acciones',
                  'Membresías mensuales y anuales',
                  'Catálogo de recompensas canjeables',
                  'Mensajes automáticos con IA',
                  'Reactivación de pacientes inactivos',
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Upgrade Button */}
            <button
              onClick={() => router.push('/dashboard/settings?tab=billing')}
              className="w-full bg-gradient-to-r from-tis-coral to-orange-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-tis-coral/90 hover:to-orange-500/90 transition-all shadow-lg hover:shadow-xl"
            >
              Actualizar a Essentials
            </button>

            <p className="text-xs text-gray-400 mt-4">
              Disponible desde el plan Essentials
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN PAGE COMPONENT
// ======================
export default function LealtadPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { isEnabled, flagsLoading } = useFeatureFlags();

  // Check if loyalty is enabled for this tenant
  const loyaltyEnabled = isEnabled('loyalty_enabled');
  const isStarterPlan = tenant?.plan === 'starter';

  // Show loading state
  if (tenantLoading || flagsLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tis-coral"></div>
      </div>
    );
  }

  // Show upgrade prompt for Starter plan users
  if (isStarterPlan || !loyaltyEnabled) {
    return <UpgradePrompt />;
  }

  // Render active tab content
  const renderTabContent = () => {
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
          <h1 className="text-2xl font-bold text-gray-900">Programa de Lealtad</h1>
          <p className="text-gray-500 mt-1">
            Gestiona tokens, membresías y recompensas para fidelizar a tus pacientes
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'border-tis-coral text-tis-coral'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
