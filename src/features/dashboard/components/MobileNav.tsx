// =====================================================
// TIS TIS PLATFORM - Mobile Navigation Component (Premium)
// =====================================================

'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';

// ======================
// ICONS
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  inbox: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  more: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
  close: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
};

// ======================
// NAV ITEMS
// ======================
const navItems = [
  { name: 'Inicio', href: '/dashboard', icon: icons.dashboard },
  { name: 'Calendario', href: '/dashboard/calendario', icon: icons.calendar },
  { name: 'Leads', href: '/dashboard/leads', icon: icons.leads },
  { name: 'Inbox', href: '/dashboard/inbox', icon: icons.inbox },
];

// ======================
// MOBILE BOTTOM NAV (Premium)
// ======================
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Prefetch route on touch for faster navigation
  const handlePrefetch = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  // Prefetch all routes on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      navItems.forEach(item => {
        router.prefetch(item.href);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bottom-nav px-2 pb-safe">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onTouchStart={() => handlePrefetch(item.href)}
              className={cn(
                'bottom-nav-item',
                isActive && 'active'
              )}
            >
              <span className={cn(
                'p-2 sm:p-1.5 rounded-xl transition-colors',
                isActive && 'bg-tis-coral-100'
              )}>
                {item.icon}
              </span>
              <span className="text-[11px] sm:text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
        <button className="bottom-nav-item min-h-[48px]">
          <span className="p-2 sm:p-1.5 rounded-xl">
            {icons.more}
          </span>
          <span className="text-[11px] sm:text-xs font-medium">Más</span>
        </button>
      </div>
    </nav>
  );
}

// ======================
// MOBILE DRAWER (Premium)
// ======================
interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Prefetch route on touch
  const handlePrefetch = useCallback((href: string) => {
    router.prefetch(href);
  }, [router]);

  // Close on navigation
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const allNavItems = [
    ...navItems,
    { name: 'Analítica', href: '/dashboard/analytics', icon: icons.analytics },
    { name: 'Configuración', href: '/dashboard/settings', icon: icons.settings },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white lg:hidden shadow-2xl">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-coral rounded-xl flex items-center justify-center shadow-coral">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-bold text-slate-900">TIS TIS</span>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          >
            {icons.close}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onTouchStart={() => handlePrefetch(item.href)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 min-h-[52px]',
                  isActive
                    ? 'bg-tis-coral-100 text-tis-coral'
                    : 'text-slate-600 hover:bg-slate-50 active:bg-slate-100 hover:text-slate-900'
                )}
              >
                <span className={cn(
                  'p-2 rounded-lg transition-colors',
                  isActive ? 'bg-tis-coral/10' : 'bg-slate-100'
                )}>
                  {item.icon}
                </span>
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 px-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 text-center">
              Powered by <span className="font-semibold text-tis-coral">TIS TIS</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
