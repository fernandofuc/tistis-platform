// =====================================================
// TIS TIS PLATFORM - Dashboard Sidebar Component
// With Feature Flags and Multi-tenant Support
// =====================================================

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils';
import { useAppStore } from '@/shared/stores';
import { useFeatureFlags, MODULE_FLAGS } from '@/src/hooks/useFeatureFlags';
import { useTenant } from '@/src/hooks/useTenant';
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
}

const navItemsConfig: NavItemWithFlag[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: icons.dashboard,
    alwaysShow: true, // Dashboard always visible
  },
  {
    name: 'Calendario',
    href: '/dashboard/calendario',
    icon: icons.calendar,
    featureFlag: 'appointments_enabled',
  },
  {
    name: 'Leads',
    href: '/dashboard/leads',
    icon: icons.leads,
    featureFlag: 'leads_enabled',
  },
  {
    name: 'Pacientes',
    href: '/dashboard/patients',
    icon: icons.patients,
    featureFlag: 'patients_enabled',
  },
  {
    name: 'Cotizaciones',
    href: '/dashboard/quotes',
    icon: icons.quotes,
    featureFlag: 'quotes_enabled',
  },
  {
    name: 'Inbox',
    href: '/dashboard/inbox',
    icon: icons.inbox,
    featureFlag: 'conversations_enabled',
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: icons.analytics,
    featureFlag: 'analytics_advanced_enabled',
  },
  {
    name: 'Configuración',
    href: '/dashboard/settings',
    icon: icons.settings,
    alwaysShow: true, // Settings always visible
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
export function Sidebar({ isCollapsed = false, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);

  // Multi-tenant hooks
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { flags, flagsLoading, isEnabled } = useFeatureFlags();

  const collapsed = isCollapsed ?? sidebarCollapsed;
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
  }, [flags, flagsLoading, isEnabled]);

  // Get display name with vertical-specific terminology
  const getDisplayName = (item: NavItemWithFlag): string => {
    if (!tenant?.vertical) return item.name;

    const verticalTerms = navTerminology[tenant.vertical];
    if (verticalTerms && verticalTerms[item.name]) {
      return verticalTerms[item.name];
    }

    return item.name;
  };

  // Get tenant initial for logo
  const getTenantInitial = () => {
    if (tenant?.name) {
      return tenant.name.charAt(0).toUpperCase();
    }
    return 'T';
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Logo - Shows tenant name with TIS TIS branding */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-coral rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">{getTenantInitial()}</span>
            </div>
            <span className="font-semibold text-gray-900 truncate max-w-[140px]">
              {tenant?.name || 'TIS TIS'}
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-gradient-coral rounded-lg flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">{getTenantInitial()}</span>
          </div>
        )}
      </div>

      {/* Plan badge (collapsed shows nothing, expanded shows plan) */}
      {!collapsed && tenant?.plan && (
        <div className="px-4 py-2 border-b border-gray-100">
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            tenant.plan === 'scale' && 'bg-purple-100 text-purple-700',
            tenant.plan === 'growth' && 'bg-blue-100 text-blue-700',
            tenant.plan === 'essentials' && 'bg-green-100 text-green-700',
            tenant.plan === 'starter' && 'bg-gray-100 text-gray-700',
          )}>
            Plan {tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const displayName = getDisplayName(item);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-tis-coral/10 text-tis-coral'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                collapsed && 'justify-center'
              )}
              title={collapsed ? displayName : undefined}
            >
              <span className={cn(isActive && 'text-tis-coral')}>{item.icon}</span>
              {!collapsed && (
                <span className="font-medium">{displayName}</span>
              )}
              {!collapsed && item.badge && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Vertical indicator (dental, restaurant, etc) */}
      {!collapsed && tenant?.vertical && (
        <div className="absolute bottom-20 left-0 right-0 px-4">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            Vertical: {tenant.vertical}
          </div>
        </div>
      )}

      {/* Collapse Button */}
      <div className="absolute bottom-4 left-0 right-0 px-4">
        <button
          onClick={() => handleCollapse(!collapsed)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full',
            'text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? icons.expand : icons.collapse}
          {!collapsed && <span className="font-medium">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
