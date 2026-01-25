// =====================================================
// TIS TIS PLATFORM - Calendar Tabs Navigation
// Apple-style tab navigation for calendar/reservations sections
// Phase 7: UI/Dashboard - Booking States System
// =====================================================

'use client';

import { cn } from '@/src/shared/utils';
import { useVerticalTerminology } from '@/src/hooks/useVerticalTerminology';
import type { CalendarTabKey } from '@/src/shared/types';

// ======================
// ICONS
// ======================
const icons = {
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  states: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  ),
};

// ======================
// TAB DEFINITIONS
// ======================
interface Tab {
  key: CalendarTabKey;
  labelKey: 'agenda' | 'estados';
  icon: React.ReactNode;
  descriptionKey: 'agenda_description' | 'estados_description';
}

const CALENDAR_TABS: Tab[] = [
  {
    key: 'agenda',
    labelKey: 'agenda',
    icon: icons.calendar,
    descriptionKey: 'agenda_description',
  },
  {
    key: 'estados',
    labelKey: 'estados',
    icon: icons.states,
    descriptionKey: 'estados_description',
  },
];

// Terminology map for tabs based on vertical
const getTabLabels = (vertical: string) => {
  const isRestaurant = vertical === 'restaurant';
  return {
    agenda: isRestaurant ? 'Reservaciones' : 'Citas',
    estados: 'Estados',
    agenda_description: isRestaurant
      ? 'Calendario de reservaciones'
      : 'Calendario de citas',
    estados_description: isRestaurant
      ? 'Estados de reservaciones y confirmaciones'
      : 'Estados de citas y confirmaciones',
  };
};

// ======================
// PROPS
// ======================
interface CalendarTabsProps {
  activeTab: CalendarTabKey;
  onTabChange: (tab: CalendarTabKey) => void;
  /** Stats to show in badges (optional) */
  stats?: {
    pendingConfirmation?: number;
    activeHolds?: number;
  };
}

// ======================
// COMPONENT
// ======================
export function CalendarTabs({ activeTab, onTabChange, stats }: CalendarTabsProps) {
  const { vertical } = useVerticalTerminology();
  const labels = getTabLabels(vertical);

  return (
    <div className="mb-6" role="navigation" aria-label="Calendar sections">
      {/* Desktop Tabs */}
      <div className="hidden md:block">
        <nav
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl"
          role="tablist"
          aria-label="Calendar tabs"
        >
          {CALENDAR_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const label = labels[tab.labelKey];
            const description = labels[tab.descriptionKey];

            // Count badge for estados tab
            const badgeCount =
              tab.key === 'estados'
                ? (stats?.pendingConfirmation || 0) + (stats?.activeHolds || 0)
                : 0;

            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                title={description}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50'
                )}
              >
                <span
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-tis-coral' : 'text-slate-400 dark:text-slate-500'
                  )}
                  aria-hidden="true"
                >
                  {tab.icon}
                </span>
                <span>{label}</span>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 px-2 py-0.5 text-xs font-medium rounded-full transition-colors',
                      isActive
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Tabs - Scrollable */}
      <div className="md:hidden">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
          role="tablist"
          aria-label="Calendar tabs"
        >
          {CALENDAR_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const label = labels[tab.labelKey];
            const description = labels[tab.descriptionKey];

            // Count badge for estados tab
            const badgeCount =
              tab.key === 'estados'
                ? (stats?.pendingConfirmation || 0) + (stats?.activeHolds || 0)
                : 0;

            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-mobile-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                title={description}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 active:scale-95',
                  isActive
                    ? 'bg-tis-coral text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300'
                )}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{label}</span>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { CALENDAR_TABS };
