// =====================================================
// TIS TIS PLATFORM - Branch Selector Component
// Global branch filter for multi-branch tenants
// =====================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/utils';
import { useBranch } from '@/shared/stores';

// ======================
// ICONS
// ======================
const icons = {
  location: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  building: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
};

// ======================
// COMPONENT PROPS
// ======================
interface BranchSelectorProps {
  collapsed?: boolean;
  className?: string;
}

// ======================
// COMPONENT
// ======================
export function BranchSelector({ collapsed = false, className }: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get branch state from store (synced by BranchSyncProvider in DashboardLayout)
  const { selectedBranchId, selectedBranch, branches, setSelectedBranchId } = useBranch();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render if no branches
  if (!branches || branches.length < 1) {
    return null;
  }

  // With only 1 branch, just show the branch info (no dropdown)
  const singleBranch = branches.length === 1;
  const currentBranch = singleBranch ? branches[0] : selectedBranch;

  const handleSelect = (branchId: string | null) => {
    setSelectedBranchId(branchId);
    setIsOpen(false);
  };

  // Get display text - use current branch or "Todas las sucursales" for multi-branch
  const displayText = currentBranch?.name || (singleBranch ? 'Sucursal' : 'Todas las sucursales');
  const displayCity = currentBranch?.city || '';

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button - clickable only if multiple branches */}
      <button
        onClick={() => !singleBranch && setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2.5 sm:py-2 rounded-lg transition-colors min-h-[44px] sm:min-h-0',
          'bg-gray-50 border border-gray-200',
          'text-left',
          singleBranch ? 'cursor-default' : 'hover:bg-gray-100 active:bg-gray-200 cursor-pointer',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? displayText : undefined}
      >
        <span className="text-purple-600">{icons.location}</span>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayText}
              </p>
              {displayCity && (
                <p className="text-xs text-gray-500 truncate">{displayCity}</p>
              )}
            </div>
            {/* Only show chevron if multiple branches */}
            {!singleBranch && (
              <span className={cn(
                'text-gray-400 transition-transform',
                isOpen && 'rotate-180'
              )}>
                {icons.chevronDown}
              </span>
            )}
          </>
        )}
      </button>

      {/* Dropdown Menu - only show if multiple branches */}
      {isOpen && !singleBranch && (
        <div className={cn(
          'absolute z-50 mt-1 w-[calc(100vw-2rem)] sm:w-64 max-w-[280px] bg-white rounded-xl shadow-lg border border-gray-200 py-1',
          collapsed ? 'left-full ml-2 top-0' : 'left-0 sm:right-0'
        )}>
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Filtrar por sucursal
            </p>
          </div>

          {/* All Branches Option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-3 sm:py-2.5 text-left transition-colors min-h-[48px] sm:min-h-0',
              selectedBranchId === null
                ? 'bg-purple-50 text-purple-700'
                : 'hover:bg-gray-50 active:bg-gray-100 text-gray-700'
            )}
          >
            <span className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              selectedBranchId === null ? 'bg-purple-100' : 'bg-gray-100'
            )}>
              {icons.building}
            </span>
            <div className="flex-1">
              <p className="font-medium">Todas las sucursales</p>
              <p className="text-xs text-gray-500">Ver datos consolidados</p>
            </div>
            {selectedBranchId === null && (
              <span className="text-purple-600">{icons.check}</span>
            )}
          </button>

          {/* Divider */}
          <div className="border-t border-gray-100 my-1" />

          {/* Branch Options */}
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => handleSelect(branch.id)}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-3 sm:py-2.5 text-left transition-colors min-h-[48px] sm:min-h-0',
                selectedBranchId === branch.id
                  ? 'bg-purple-50 text-purple-700'
                  : 'hover:bg-gray-50 active:bg-gray-100 text-gray-700'
              )}
            >
              <span className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                selectedBranchId === branch.id ? 'bg-purple-100' : 'bg-gray-100',
                branch.is_headquarters && 'ring-2 ring-purple-300'
              )}>
                {icons.location}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{branch.name}</p>
                  {branch.is_headquarters && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                      Principal
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {branch.city}{branch.state ? `, ${branch.state}` : ''}
                </p>
              </div>
              {selectedBranchId === branch.id && (
                <span className="text-purple-600 flex-shrink-0">{icons.check}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BranchSelector;
