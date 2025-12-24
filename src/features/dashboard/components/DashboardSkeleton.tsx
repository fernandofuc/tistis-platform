// =====================================================
// TIS TIS PLATFORM - Dashboard Skeleton Loading
// Shows instant visual structure while auth loads
// =====================================================

'use client';

import { cn } from '@/shared/utils';

// ======================
// SKELETON COMPONENT
// ======================
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Skeleton */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200/80 flex-col">
        {/* Logo */}
        <div className="h-16 px-4 flex items-center border-b border-slate-100/80">
          <div className="w-9 h-9 bg-slate-200 rounded-lg animate-pulse" />
          <div className="ml-3 w-20 h-6 bg-slate-200 rounded animate-pulse" />
        </div>

        {/* Plan Badge */}
        <div className="px-4 py-3 border-b border-slate-100/80">
          <div className="w-24 h-6 bg-slate-100 rounded-lg animate-pulse" />
        </div>

        {/* Branch Selector */}
        <div className="px-4 py-3 border-b border-slate-100/80">
          <div className="w-full h-10 bg-slate-100 rounded-xl animate-pulse" />
        </div>

        {/* Navigation Items */}
        <nav className="px-3 py-4 space-y-6 flex-1">
          {/* Main Section */}
          <div className="space-y-1">
            {[1].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-5 h-5 bg-slate-200 rounded animate-pulse" />
                <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Operations Section */}
          <div className="space-y-1">
            <div className="px-3 pb-2">
              <div className="w-20 h-3 bg-slate-100 rounded animate-pulse" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-5 h-5 bg-slate-100 rounded animate-pulse" />
                <div className="w-20 h-4 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* More Sections */}
          <div className="space-y-1">
            <div className="px-3 pb-2">
              <div className="w-24 h-3 bg-slate-100 rounded animate-pulse" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-5 h-5 bg-slate-100 rounded animate-pulse" />
                <div className="w-24 h-4 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header Skeleton */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse lg:hidden" />
            <div className="w-48 h-5 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-full animate-pulse" />
          </div>
        </header>

        {/* Page Content Skeleton */}
        <main className="p-6 flex-1">
          {/* Page Title */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="w-64 h-8 bg-slate-200 rounded animate-pulse mb-2" />
              <div className="w-48 h-4 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="w-32 h-10 bg-slate-100 rounded-lg animate-pulse" />
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="w-16 h-5 bg-slate-100 rounded-full animate-pulse" />
                </div>
                <div className="w-16 h-8 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="w-24 h-4 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Leads Card */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="w-32 h-5 bg-slate-200 rounded animate-pulse mb-1" />
                      <div className="w-48 h-3 bg-slate-100 rounded animate-pulse" />
                    </div>
                    <div className="w-20 h-8 bg-slate-100 rounded-lg animate-pulse" />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <div className="w-11 h-11 bg-slate-100 rounded-full animate-pulse" />
                      <div className="flex-1">
                        <div className="w-32 h-4 bg-slate-200 rounded animate-pulse mb-2" />
                        <div className="w-24 h-3 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="w-16 h-6 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-slate-200/60"
                  >
                    <div className="w-8 h-8 bg-slate-100 rounded animate-pulse" />
                    <div className="w-20 h-4 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Appointments Card */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="w-28 h-5 bg-slate-200 rounded animate-pulse mb-1" />
                  <div className="w-36 h-3 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl animate-pulse" />
                      <div className="flex-1">
                        <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mb-1" />
                        <div className="w-16 h-3 bg-slate-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats Card */}
              <div className="bg-white rounded-xl border border-slate-200/60 p-4">
                <div className="w-36 h-4 bg-slate-200 rounded animate-pulse mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="w-20 h-4 bg-slate-100 rounded animate-pulse" />
                        <div className="w-12 h-4 bg-slate-100 rounded animate-pulse" />
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
