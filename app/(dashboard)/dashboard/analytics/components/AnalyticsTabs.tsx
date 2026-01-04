// =====================================================
// TIS TIS PLATFORM - Analytics Tabs Navigation
// Apple-style tab navigation for analytics sections
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
  sales: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  operations: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  inventory: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  customers: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  ai: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

// ======================
// TAB TYPES
// ======================
export type AnalyticsTabKey = 'resumen' | 'ventas' | 'operaciones' | 'inventario' | 'clientes' | 'ai';

interface Tab {
  key: AnalyticsTabKey;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const ANALYTICS_TABS: Tab[] = [
  { key: 'resumen', label: 'Resumen', icon: icons.overview, description: 'Vista general del negocio' },
  { key: 'ventas', label: 'Ventas', icon: icons.sales, description: 'Ingresos y transacciones' },
  { key: 'operaciones', label: 'Operaciones', icon: icons.operations, description: 'Tiempos y eficiencia' },
  { key: 'inventario', label: 'Inventario', icon: icons.inventory, description: 'Stock y alertas' },
  { key: 'clientes', label: 'Clientes', icon: icons.customers, description: 'Leads y lealtad' },
  { key: 'ai', label: 'AI Insights', icon: icons.ai, description: 'Conversaciones y asistente' },
];

// ======================
// PROPS
// ======================
interface AnalyticsTabsProps {
  activeTab: AnalyticsTabKey;
  onTabChange: (tab: AnalyticsTabKey) => void;
}

// ======================
// COMPONENT
// ======================
export function AnalyticsTabs({ activeTab, onTabChange }: AnalyticsTabsProps) {
  return (
    <div className="mb-6">
      {/* Desktop Tabs */}
      <div className="hidden md:block">
        <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {ANALYTICS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                )}
              >
                <span className={cn(
                  'transition-colors',
                  isActive ? 'text-tis-coral' : 'text-slate-400'
                )}>
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
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {ANALYTICS_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200',
                  isActive
                    ? 'bg-tis-coral text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { ANALYTICS_TABS };
