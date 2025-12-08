// =====================================================
// TIS TIS PLATFORM - Dashboard Header Component
// =====================================================

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { Avatar, Badge } from '@/shared/components/ui';
import { useAuthContext } from '@/features/auth';
import { useBranch } from '@/shared/stores';
import type { HeaderProps } from '../types';

// ======================
// ICONS
// ======================
const icons = {
  menu: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  bell: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  search: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

// ======================
// COMPONENT
// ======================
export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { staff, signOut } = useAuthContext();
  const { selectedBranch, branches, setSelectedBranchId } = useBranch();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (branchMenuRef.current && !branchMenuRef.current.contains(event.target as Node)) {
        setShowBranchMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu + Search */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            {icons.menu}
          </button>

          {/* Search */}
          <div className="hidden md:flex items-center">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                {icons.search}
              </span>
              <input
                type="search"
                placeholder="Buscar leads, citas..."
                className="w-80 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Right: Branch Selector, Notifications, User */}
        <div className="flex items-center gap-3">
          {/* Branch Selector */}
          {branches.length > 1 && (
            <div className="relative" ref={branchMenuRef}>
              <button
                onClick={() => setShowBranchMenu(!showBranchMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg"
              >
                <span className="text-gray-400">{icons.building}</span>
                <span className="hidden sm:inline max-w-32 truncate">
                  {selectedBranch?.name || 'Seleccionar'}
                </span>
                {icons.chevronDown}
              </button>

              {showBranchMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  {branches.map((branch) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setSelectedBranchId(branch.id);
                        setShowBranchMenu(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm hover:bg-gray-50',
                        selectedBranch?.id === branch.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span>{branch.name}</span>
                        {branch.is_headquarters && (
                          <Badge size="sm" variant="info">HQ</Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{branch.city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              {icons.bell}
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notificaciones</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay notificaciones nuevas
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <Avatar
                name={staff?.display_name || 'Usuario'}
                size="sm"
              />
              <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-32 truncate">
                {staff?.display_name || 'Usuario'}
              </span>
              {icons.chevronDown}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {staff?.display_name}
                  </p>
                  <p className="text-xs text-gray-500">{staff?.email}</p>
                  <Badge size="sm" variant="info" className="mt-1">
                    {staff?.role_title || staff?.role}
                  </Badge>
                </div>

                <Link
                  href="/dashboard/settings/profile"
                  className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  {icons.user}
                  Mi Perfil
                </Link>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  {icons.logout}
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
