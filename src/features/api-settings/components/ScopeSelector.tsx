// =====================================================
// TIS TIS PLATFORM - Scope Selector Component
// Component for selecting API Key scopes/permissions
// =====================================================

'use client';

import { useState } from 'react';
import { cn } from '@/shared/utils';
import type { ScopeGroup, APIScope, ScopeDefinition } from '../types';
import { SCOPE_PRESETS, getScopePresetsForVertical } from '../constants/scopes';
import type { Vertical } from '../types/scope.types';

// ======================
// ICONS
// ======================

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

// Category icons map
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  leads: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  conversations: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  appointments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  webhooks: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  patients: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  treatments: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  quotes: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  services: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  menu: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  orders: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  inventory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  tables: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  kitchen: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
  reservations: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
};

// Default icon for unknown categories
const DefaultCategoryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// ======================
// TYPES
// ======================

export interface ScopeSelectorProps {
  scopeGroups: ScopeGroup[];
  selectedScopes: APIScope[];
  onToggleScope: (scope: APIScope) => void;
  onSelectPreset: (presetKey: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  vertical?: Vertical;
  className?: string;
}

// ======================
// COMPONENT
// ======================

export function ScopeSelector({
  scopeGroups,
  selectedScopes,
  onToggleScope,
  onSelectPreset,
  onSelectAll,
  onClearAll,
  vertical = 'dental',
  className,
}: ScopeSelectorProps) {
  // Get presets for the current vertical (includes vertical-specific scopes)
  const presets = vertical ? getScopePresetsForVertical(vertical) : SCOPE_PRESETS;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Presets */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Permisos Rápidos
        </label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelectPreset(key)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                'hover:border-blue-300 hover:bg-blue-50',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
                isPresetSelected(preset.scopes, selectedScopes)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700'
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {selectedScopes.length} permisos seleccionados
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-blue-600 hover:text-blue-700 hover:underline"
          >
            Seleccionar todos
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-gray-500 hover:text-gray-700 hover:underline"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Scope Groups */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {scopeGroups.map((group) => (
          <ScopeGroupAccordion
            key={group.category}
            group={group}
            selectedScopes={selectedScopes}
            onToggleScope={onToggleScope}
          />
        ))}
      </div>
    </div>
  );
}

// ======================
// HELPER FUNCTIONS
// ======================

function isPresetSelected(presetScopes: APIScope[], selectedScopes: APIScope[]): boolean {
  return presetScopes.every((scope) => selectedScopes.includes(scope));
}

// ======================
// SUB-COMPONENTS
// ======================

interface ScopeGroupAccordionProps {
  group: ScopeGroup;
  selectedScopes: APIScope[];
  onToggleScope: (scope: APIScope) => void;
}

function ScopeGroupAccordion({
  group,
  selectedScopes,
  onToggleScope,
}: ScopeGroupAccordionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const selectedInGroup = group.scopes.filter((s) =>
    selectedScopes.includes(s.key)
  ).length;
  const allSelected = selectedInGroup === group.scopes.length;

  const toggleAll = () => {
    group.scopes.forEach((scope) => {
      if (allSelected) {
        // Deselect all
        if (selectedScopes.includes(scope.key)) {
          onToggleScope(scope.key);
        }
      } else {
        // Select all
        if (!selectedScopes.includes(scope.key)) {
          onToggleScope(scope.key);
        }
      }
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`scope-group-${group.category}`}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500" aria-hidden="true">
            {CATEGORY_ICONS[group.category] || <DefaultCategoryIcon />}
          </span>
          <span className="font-medium text-gray-900">{group.name}</span>
          <span className="text-sm text-gray-500">
            ({selectedInGroup}/{group.scopes.length})
          </span>
        </div>
        <span aria-hidden="true">{isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
      </button>

      {/* Content */}
      {isOpen && (
        <div id={`scope-group-${group.category}`} className="p-3 space-y-2 bg-white" role="region" aria-label={`Permisos de ${group.name}`}>
          {/* Select/Deselect All */}
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline mb-2"
          >
            {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
          </button>

          {/* Scopes */}
          {group.scopes.map((scope) => (
            <ScopeItem
              key={scope.key}
              scope={scope}
              isSelected={selectedScopes.includes(scope.key)}
              onToggle={() => onToggleScope(scope.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ScopeItemProps {
  scope: ScopeDefinition;
  isSelected: boolean;
  onToggle: () => void;
}

function ScopeItem({ scope, isSelected, onToggle }: ScopeItemProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
        isSelected
          ? 'bg-blue-50 border border-blue-200'
          : 'hover:bg-gray-50 border border-transparent'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="sr-only"
        />
        <div
          className={cn(
            'w-5 h-5 rounded flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-blue-600 text-white'
              : 'border-2 border-gray-300'
          )}
        >
          {isSelected && <CheckIcon />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm">{scope.name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{scope.description}</div>
        <code className="text-xs text-gray-400 mt-0.5">{scope.key}</code>
      </div>
    </label>
  );
}

// ======================
// COMPACT SCOPE DISPLAY (for view-only)
// ======================

export interface ScopeDisplayProps {
  scopes: string[];
  maxVisible?: number;
  className?: string;
}

export function ScopeDisplay({ scopes, maxVisible = 5, className }: ScopeDisplayProps) {
  // Handle null/undefined/empty array
  if (!scopes || scopes.length === 0) {
    return (
      <div className={cn('text-sm text-gray-500 italic', className)}>
        Sin permisos configurados
      </div>
    );
  }

  const visibleScopes = scopes.slice(0, maxVisible);
  const hiddenCount = scopes.length - maxVisible;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visibleScopes.map((scope) => (
        <span
          key={scope}
          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
        >
          {scope}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="px-2 py-0.5 text-gray-500 text-xs">
          +{hiddenCount} más
        </span>
      )}
    </div>
  );
}
