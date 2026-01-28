'use client';

// =====================================================
// TIS TIS PLATFORM - Period Selector Component
// Step 1 of report generation flow
// Fixed: Accessibility (aria-pressed, aria-hidden)
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import type { ReportPeriod } from '../types';

// ======================
// TYPES
// ======================

interface PeriodSelectorProps {
  onSelect: (period: ReportPeriod) => void;
  selectedPeriod?: ReportPeriod | null;
}

interface PeriodOption {
  id: ReportPeriod;
  label: string;
  description: string;
  icon: React.ElementType;
}

// ======================
// CONSTANTS
// ======================

const PERIODS: PeriodOption[] = [
  { id: '7d', label: 'Últimos 7 días', description: 'Resumen semanal', icon: Calendar },
  { id: '30d', label: 'Últimos 30 días', description: 'Resumen mensual', icon: CalendarDays },
  { id: '90d', label: 'Últimos 90 días', description: 'Resumen trimestral', icon: CalendarRange },
];

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// ======================
// COMPONENT
// ======================

export function PeriodSelector({ onSelect, selectedPeriod }: PeriodSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">
          ¿De qué período quieres el reporte?
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Selecciona el rango de fechas para tu análisis
        </p>
      </div>

      {/* Period Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PERIODS.map((period, index) => {
          const Icon = period.icon;
          const isSelected = selectedPeriod === period.id;

          return (
            <motion.button
              key={period.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, ease: appleEasing }}
              onClick={() => onSelect(period.id)}
              aria-pressed={isSelected}
              aria-label={`${period.label}: ${period.description}`}
              className={cn(
                'relative p-6 rounded-2xl border-2 transition-all duration-300',
                'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
                isSelected
                  ? 'border-tis-coral bg-tis-coral/5 shadow-lg shadow-tis-coral/10'
                  : 'border-slate-200 bg-white hover:border-tis-coral/50'
              )}
            >
              {/* Selected indicator */}
              {isSelected && (
                <motion.div
                  layoutId="period-selected"
                  className="absolute inset-0 border-2 border-tis-coral rounded-2xl"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  aria-hidden="true"
                />
              )}

              <div className="relative flex flex-col items-center text-center gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center transition-colors',
                    isSelected ? 'bg-tis-coral/10' : 'bg-slate-100'
                  )}
                  aria-hidden="true"
                >
                  <Icon
                    className={cn(
                      'w-7 h-7 transition-colors',
                      isSelected ? 'text-tis-coral' : 'text-slate-500'
                    )}
                  />
                </div>

                {/* Text */}
                <div>
                  <h3
                    className={cn(
                      'font-semibold transition-colors',
                      isSelected ? 'text-tis-coral' : 'text-slate-900'
                    )}
                  >
                    {period.label}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{period.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
