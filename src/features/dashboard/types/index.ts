// =====================================================
// TIS TIS PLATFORM - Dashboard Feature Types
// =====================================================

import type { ReactNode } from 'react';

// ======================
// NAVIGATION
// ======================
export interface NavItem {
  name: string;
  href: string;
  icon: ReactNode;
  badge?: number | string;
  children?: NavItem[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

// ======================
// LAYOUT
// ======================
export interface DashboardLayoutProps {
  children: ReactNode;
}

export interface SidebarProps {
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export interface HeaderProps {
  onMenuClick?: () => void;
}

// ======================
// WIDGETS
// ======================
export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

// ======================
// DASHBOARD STATS
// ======================
export interface DashboardStatsData {
  leads: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    newToday: number;
    change: number;
  };
  appointments: {
    today: number;
    upcoming: number;
    completedToday: number;
    cancelledToday: number;
  };
  conversations: {
    active: number;
    escalated: number;
    resolvedToday: number;
    avgResponseTime: number;
  };
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
}
