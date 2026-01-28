// =====================================================
// TIS TIS PLATFORM - Branch Selector Component
// Global branch filter for multi-branch tenants
// Updated: Consistent with navbar branch selector design
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
          'flex items-center gap-2 w-full px-3 py-2.5 sm:py-2 rounded-xl transition-colors min-h-[44px] sm:min-h-0',
          'bg-slate-50/80 hover:bg-slate-100',
          'text-left',
          singleBranch ? 'cursor-default' : 'cursor-pointer',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? displayText : undefined}
      >
        <span className="text-slate-400">{icons.location}</span>

        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {displayText}
              </p>
              {displayCity && (
                <p className="text-xs text-slate-500 truncate">{displayCity}</p>
              )}
            </div>
            {/* Only show chevron if multiple branches */}
            {!singleBranch && (
              <span className={cn(
                'text-slate-400 transition-transform duration-200',
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
          'absolute z-50 mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 py-2 overflow-hidden',
          collapsed ? 'left-full ml-2 top-0' : 'left-0'
        )}>
          {/* Header */}
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Sucursales
            </p>
          </div>

          {/* All Branches Option */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors',
              selectedBranchId === null ? 'bg-slate-100' : 'text-slate-700'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">Todas las sucursales</span>
            </div>
            <span className="text-xs text-slate-500">Datos consolidados</span>
          </button>

          {/* Divider */}
          <div className="border-t border-slate-100 my-1" />

          {/* Branch Options */}
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => handleSelect(branch.id)}
              className={cn(
                'w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors',
                selectedBranchId === branch.id ? 'bg-slate-100' : 'text-slate-700'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{branch.name}</span>
                {branch.is_headquarters && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-900 text-white rounded-md">
                    HQ
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {branch.city}{branch.state ? `, ${branch.state}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BranchSelector;
