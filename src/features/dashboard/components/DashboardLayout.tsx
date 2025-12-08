// =====================================================
// TIS TIS PLATFORM - Dashboard Layout Component
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils';
import { useAppStore } from '@/shared/stores';
import { AuthProvider, ProtectedRoute } from '@/features/auth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav, MobileDrawer } from './MobileNav';
import type { DashboardLayoutProps } from '../types';

// ======================
// COMPONENT
// ======================
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const branches = useAppStore((state) => state.branches);
  const setBranches = useAppStore((state) => state.setBranches);

  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <Sidebar />
          </div>

          {/* Mobile Drawer */}
          <MobileDrawer
            isOpen={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
          />

          {/* Main Content */}
          <div
            className={cn(
              'min-h-screen transition-all duration-300',
              sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
            )}
          >
            {/* Header */}
            <Header onMenuClick={() => setMobileDrawerOpen(true)} />

            {/* Page Content */}
            <main className="p-4 lg:p-6 pb-24 lg:pb-6">
              {children}
            </main>
          </div>

          {/* Mobile Bottom Nav */}
          <MobileBottomNav />
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}

// ======================
// PAGE WRAPPER
// ======================
interface PageWrapperProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PageWrapper({ title, subtitle, actions, children }: PageWrapperProps) {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}

// ======================
// STATS GRID
// ======================
interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}

export function StatsGrid({ children, columns = 4 }: StatsGridProps) {
  const colsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', colsClass[columns])}>
      {children}
    </div>
  );
}

// ======================
// CONTENT GRID
// ======================
interface ContentGridProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function ContentGrid({ children, sidebar }: ContentGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">{children}</div>
      {sidebar && <div className="lg:col-span-1">{sidebar}</div>}
    </div>
  );
}
