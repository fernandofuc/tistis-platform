// =====================================================
// TIS TIS PLATFORM - Agent Messages Tabs Navigation
// Apple-style tab navigation for messaging agent sections
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { cn } from '@/src/shared/utils';

// ======================
// ICONS
// ======================
const icons = {
  overview: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  business: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  personal: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// ======================
// TAB TYPES
// ======================
export type AgentMessagesTabKey = 'resumen' | 'negocio' | 'personal' | 'avanzado';

interface Tab {
  key: AgentMessagesTabKey;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// Tabs base - Personal se agrega condicionalmente
const BASE_TABS: Tab[] = [
  { key: 'resumen', label: 'Resumen', icon: icons.overview, description: 'Estado general y métricas' },
  { key: 'negocio', label: 'Perfil Negocio', icon: icons.business, description: 'Configuración del asistente' },
  { key: 'avanzado', label: 'Avanzado', icon: icons.settings, description: 'Opciones técnicas' },
];

const PERSONAL_TAB: Tab = {
  key: 'personal',
  label: 'Perfil Personal',
  icon: icons.personal,
  description: 'Marca personal del doctor',
};

// ======================
// PROPS
// ======================
interface AgentMessagesTabsProps {
  activeTab: AgentMessagesTabKey;
  onTabChange: (tab: AgentMessagesTabKey) => void;
  showPersonalTab?: boolean;
}

// ======================
// COMPONENT
// ======================
export function AgentMessagesTabs({
  activeTab,
  onTabChange,
  showPersonalTab = false,
}: AgentMessagesTabsProps) {
  // Build tabs array with personal tab if needed
  const tabs = showPersonalTab
    ? [BASE_TABS[0], BASE_TABS[1], PERSONAL_TAB, BASE_TABS[2]]
    : BASE_TABS;

  return (
    <div className="mb-6" role="navigation" aria-label="Agent messages sections">
      {/* Desktop Tabs */}
      <div className="hidden md:block">
        <nav
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl"
          role="tablist"
          aria-label="Agent messages tabs"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                title={tab.description}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                )}
              >
                <span
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-tis-coral' : 'text-slate-400'
                  )}
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Tabs - Scrollable */}
      <div className="md:hidden">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
          role="tablist"
          aria-label="Agent messages tabs"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-mobile-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                title={tab.description}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-95',
                  isActive
                    ? 'bg-tis-coral text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
                )}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { BASE_TABS, PERSONAL_TAB };
