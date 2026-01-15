// =====================================================
// TIS TIS PLATFORM - Dashboard Layout Component
// =====================================================

'use client';

import { useState, Suspense, useEffect } from 'react';
import { cn } from '@/shared/utils';
import { useAppStore } from '@/shared/stores';
import { NavigationProgress } from '@/shared/components/ui';
import { ToastProvider } from '@/shared/hooks';
import { AuthProvider, ProtectedRoute, useAuthContext } from '@/features/auth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav, MobileDrawer } from './MobileNav';
import { DashboardSkeleton } from './DashboardSkeleton';
import type { DashboardLayoutProps } from '../types';

// ======================
// BRANCH SYNC COMPONENT
// Syncs branches from auth context to Zustand store
// This ensures all components (Header, Sidebar, etc) have access
// to branches regardless of whether BranchSelector renders
// ======================
function BranchSyncProvider({ children }: { children: React.ReactNode }) {
  const { branches: authBranches } = useAuthContext();
  const setBranches = useAppStore((state) => state.setBranches);
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);

  // Sync branches from auth context to global store
  // This runs every time authBranches changes (e.g., after creating a branch)
  useEffect(() => {
    // Debug logging to trace branch sync issues
    console.log('🔄 [BranchSync] authBranches:', authBranches?.length || 0, authBranches?.map(b => b.name));

    if (authBranches && authBranches.length > 0) {
      console.log('🟢 [BranchSync] Syncing', authBranches.length, 'branches to Zustand store');
      setBranches(authBranches);

      // Auto-select first branch or HQ if none selected
      if (!selectedBranchId) {
        const hq = authBranches.find(b => b.is_headquarters);
        const defaultBranch = hq || authBranches[0];
        if (defaultBranch) {
          console.log('🟢 [BranchSync] Auto-selecting branch:', defaultBranch.name);
          setSelectedBranchId(defaultBranch.id);
        }
      } else {
        // Validate that selected branch still exists
        const branchExists = authBranches.some(b => b.id === selectedBranchId);
        if (!branchExists) {
          const hq = authBranches.find(b => b.is_headquarters);
          console.log('🟡 [BranchSync] Selected branch not found, resetting to:', hq?.name || authBranches[0]?.name);
          setSelectedBranchId(hq?.id || authBranches[0]?.id || null);
        }
      }
    } else {
      console.log('🟡 [BranchSync] No branches from auth context');
    }
  }, [authBranches, setBranches, selectedBranchId, setSelectedBranchId]);

  return <>{children}</>;
}

// ======================
// COMPONENT
// ======================
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);

  return (
    <AuthProvider>
      <ProtectedRoute loadingSkeleton={<DashboardSkeleton />}>
        {/* Toast Notifications Provider */}
        <ToastProvider>
          {/* Sync branches from auth to global store */}
          <BranchSyncProvider>
            {/* Navigation Progress Indicator */}
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>

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
          </BranchSyncProvider>
        </ToastProvider>
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
