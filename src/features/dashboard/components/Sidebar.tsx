// =====================================================
// TIS TIS PLATFORM - Dashboard Sidebar Component
// With Feature Flags and Multi-tenant Support
// =====================================================

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';
import { useAppStore } from '@/shared/stores';
import { useFeatureFlags, MODULE_FLAGS } from '@/src/hooks/useFeatureFlags';
import { useTenant } from '@/src/hooks/useTenant';
import { BranchSelector } from '@/shared/components/ui';
import type { SidebarProps, NavItem } from '../types';

// ======================
// ICONS (Inline SVGs for performance)
// ======================
const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  leads: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  patients: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  inbox: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  quotes: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  loyalty: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  businessIA: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  voiceAgent: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  collapse: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  ),
  expand: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  ),
};

// ======================
// NAVIGATION CONFIG WITH FEATURE FLAGS
// Each item includes the required feature flag
// ======================
interface NavItemWithFlag extends NavItem {
  featureFlag?: string; // Feature flag key required to show this item
  alwaysShow?: boolean; // Always show regardless of flags
  section?: string; // Section grouping for visual organization
}

// ======================
// NAVIGATION SECTIONS (Apple-like organization)
// ======================
const NAV_SECTIONS = {
  MAIN: 'main',
  OPERATIONS: 'operations',
  COMMUNICATION: 'communication',
  ANALYTICS: 'analytics',
  AI_PREMIUM: 'ai_premium',
  SYSTEM: 'system',
} as const;

const SECTION_LABELS: Record<string, string> = {
  [NAV_SECTIONS.MAIN]: '',
  [NAV_SECTIONS.OPERATIONS]: 'Operaciones',
  [NAV_SECTIONS.COMMUNICATION]: 'Comunicación',
  [NAV_SECTIONS.ANALYTICS]: 'Análisis',
  [NAV_SECTIONS.AI_PREMIUM]: 'Inteligencia Artificial',
  [NAV_SECTIONS.SYSTEM]: 'Sistema',
};

const navItemsConfig: NavItemWithFlag[] = [
  // === MAIN ===
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: icons.dashboard,
    alwaysShow: true,
    section: NAV_SECTIONS.MAIN,
  },
  // === OPERATIONS ===
  {
    name: 'Calendario',
    href: '/dashboard/calendario',
    icon: icons.calendar,
    featureFlag: 'appointments_enabled',
    section: NAV_SECTIONS.OPERATIONS,
  },
  {
    name: 'Leads',
    href: '/dashboard/leads',
    icon: icons.leads,
    featureFlag: 'leads_enabled',
    section: NAV_SECTIONS.OPERATIONS,
  },
  {
    name: 'Pacientes',
    href: '/dashboard/patients',
    icon: icons.patients,
    alwaysShow: true,
    section: NAV_SECTIONS.OPERATIONS,
  },
  {
    name: 'Cotizaciones',
    href: '/dashboard/quotes',
    icon: icons.quotes,
    featureFlag: 'quotes_enabled',
    section: NAV_SECTIONS.OPERATIONS,
  },
  // === COMMUNICATION ===
  {
    name: 'Inbox',
    href: '/dashboard/inbox',
    icon: icons.inbox,
    featureFlag: 'conversations_enabled',
    section: NAV_SECTIONS.COMMUNICATION,
  },
  // === ANALYTICS ===
  {
    name: 'Analítica',
    href: '/dashboard/analytics',
    icon: icons.analytics,
    alwaysShow: true,
    section: NAV_SECTIONS.ANALYTICS,
  },
  // === AI PREMIUM ===
  {
    name: 'Business IA',
    href: '/dashboard/business-ia',
    icon: icons.businessIA,
    alwaysShow: true,
    section: NAV_SECTIONS.AI_PREMIUM,
  },
  {
    name: 'AI Agent Voz',
    href: '/dashboard/ai-agent-voz',
    icon: icons.voiceAgent,
    alwaysShow: true,
    section: NAV_SECTIONS.AI_PREMIUM,
  },
  // === SYSTEM ===
  {
    name: 'Lealtad',
    href: '/dashboard/lealtad',
    icon: icons.loyalty,
    alwaysShow: true,
    section: NAV_SECTIONS.SYSTEM,
  },
  {
    name: 'Configuración',
    href: '/dashboard/settings',
    icon: icons.settings,
    alwaysShow: true,
    section: NAV_SECTIONS.SYSTEM,
  },
];

// Terminology mapping for nav items by vertical
const navTerminology: Record<string, Record<string, string>> = {
  dental: {
    Pacientes: 'Pacientes',
    Cotizaciones: 'Presupuestos',
  },
  clinic: {
    Pacientes: 'Pacientes',
    Cotizaciones: 'Cotizaciones',
  },
  restaurant: {
    Pacientes: 'Clientes',
    Calendario: 'Reservaciones',
  },
  gym: {
    Pacientes: 'Miembros',
  },
};

// ======================
// COMPONENT
// ======================
export function Sidebar({ isCollapsed, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);

  // Multi-tenant hooks
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { flagsLoading, isEnabled } = useFeatureFlags();

  // Use props if explicitly provided, otherwise use store state
  const collapsed = isCollapsed !== undefined ? isCollapsed : sidebarCollapsed;
  const handleCollapse = onCollapse ?? setSidebarCollapsed;

  // Filter nav items based on feature flags
  const visibleNavItems = useMemo(() => {
    // While loading, show all items (better UX than empty sidebar)
    if (flagsLoading) {
      return navItemsConfig;
    }

    return navItemsConfig.filter(item => {
      // Always show items marked as alwaysShow
      if (item.alwaysShow) return true;

      // Check feature flag
      if (item.featureFlag) {
        return isEnabled(item.featureFlag);
      }

      // Show by default if no flag specified
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsLoading, isEnabled]);

  // Get display name with vertical-specific terminology
  const getDisplayName = (item: NavItemWithFlag): string => {
    if (!tenant?.vertical) return item.name;

    const verticalTerms = navTerminology[tenant.vertical];
    if (verticalTerms && verticalTerms[item.name]) {
      return verticalTerms[item.name];
    }

    return item.name;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-slate-200/80 transition-all duration-300 flex flex-col',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo TIS TIS - Links to landing page */}
      <div className={cn(
        "h-16 flex items-center border-b border-slate-100/80 transition-all duration-300",
        collapsed ? "justify-center px-2" : "px-4"
      )}>
        <Link
          href="https://tistis.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/logos/tis-brain-logo.png"
            alt="TIS TIS"
            width={collapsed ? 40 : 36}
            height={collapsed ? 40 : 36}
            className="object-contain"
            priority
          />
          {!collapsed && (
            <span className="font-bold text-slate-800 text-lg tracking-tight">
              TIS TIS
            </span>
          )}
        </Link>
      </div>

      {/* Plan badge - Premium styled */}
      {!collapsed && tenant?.plan && (
        <div className="px-4 py-3 border-b border-slate-100/80">
          <span className={cn(
            'inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg',
            tenant.plan === 'growth' && 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-700 border border-purple-200/50',
            tenant.plan === 'essentials' && 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 border border-emerald-200/50',
            tenant.plan === 'starter' && 'bg-slate-100 text-slate-600 border border-slate-200/50',
          )}>
            Plan {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
          </span>
        </div>
      )}

      {/* Branch Selector - For multi-branch tenants */}
      <div className="px-4 py-3 border-b border-slate-100/80">
        <BranchSelector collapsed={collapsed} />
      </div>

      {/* Navigation - Organized by sections with Apple-like spacing */}
      <nav className="px-3 py-4 space-y-6 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        {/* Group items by section */}
        {Object.values(NAV_SECTIONS).map((sectionKey) => {
          const sectionItems = visibleNavItems.filter(item => item.section === sectionKey);
          if (sectionItems.length === 0) return null;

          const sectionLabel = SECTION_LABELS[sectionKey];

          return (
            <div key={sectionKey} className="space-y-1">
              {/* Section Label - Only show if not collapsed and has label */}
              {!collapsed && sectionLabel && (
                <div className="px-3 pb-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {sectionLabel}
                  </span>
                </div>
              )}

              {/* Section Items */}
              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const displayName = getDisplayName(item);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                        isActive
                          ? 'bg-tis-coral/10 text-tis-coral font-medium'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        collapsed && 'justify-center px-2'
                      )}
                      title={collapsed ? displayName : undefined}
                    >
                      <span className={cn(
                        'flex-shrink-0 transition-colors',
                        isActive ? 'text-tis-coral' : 'text-slate-400'
                      )}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="text-sm">{displayName}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom Section - Vertical indicator & Collapse */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100/80 bg-slate-50/50">
        {/* Vertical indicator (dental, restaurant, etc) */}
        {!collapsed && tenant?.vertical && (
          <div className="px-4 py-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="font-medium">Vertical:</span>
              <span className="text-slate-500 capitalize">{tenant.vertical}</span>
            </div>
          </div>
        )}

        {/* Collapse Button */}
        <div className={cn('px-3 pb-4', !collapsed && tenant?.vertical ? 'pt-0' : 'pt-4')}>
          <button
            onClick={() => handleCollapse(!collapsed)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl w-full',
              'text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all duration-200',
              collapsed && 'justify-center px-2'
            )}
          >
            {collapsed ? icons.expand : icons.collapse}
            {!collapsed && <span className="text-sm font-medium">Minimizar</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
