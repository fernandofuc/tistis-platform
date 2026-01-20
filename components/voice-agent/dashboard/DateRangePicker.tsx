/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * DateRangePicker Component
 *
 * Dropdown for selecting date range presets or custom dates.
 * Follows TIS TIS design system.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { DateRange, DateRangePreset } from './types';
import { DATE_RANGE_PRESETS, getDateRangeDates } from './types';

// =====================================================
// TYPES
// =====================================================

export interface DateRangePickerProps {
  /** Current date range */
  value: DateRange;
  /** Callback when range changes */
  onChange: (range: DateRange) => void;
  /** Whether picker is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function DateRangePicker({
  value,
  onChange,
  disabled = false,
  className = '',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Get current label
  const currentLabel = DATE_RANGE_PRESETS.find((p) => p.id === value.preset)?.label
    || 'Personalizado';

  // Handle preset selection
  const handlePresetSelect = (preset: DateRangePreset) => {
    const dates = getDateRangeDates(preset);
    onChange({
      ...dates,
      preset,
    });
    setIsOpen(false);
  };

  // Animation variants
  const dropdownVariants = {
    hidden: { opacity: 0, y: -8, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.15, ease: 'easeOut' as const },
    },
    exit: {
      opacity: 0,
      y: -8,
      scale: 0.95,
      transition: { duration: 0.1, ease: 'easeIn' as const },
    },
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-white border border-slate-200
          text-sm font-medium text-slate-700
          transition-all duration-200
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-slate-300 hover:shadow-sm active:scale-[0.98]'
          }
          ${isOpen ? 'border-tis-coral ring-2 ring-tis-coral/20' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CalendarIcon className="w-4 h-4 text-slate-400" />
        <span>{currentLabel}</span>
        <ChevronDownIcon
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`
              absolute top-full left-0 mt-2 z-50
              w-56 bg-white rounded-xl border border-slate-200 shadow-lg
              overflow-hidden
            `}
            role="listbox"
          >
            <div className="p-2">
              {DATE_RANGE_PRESETS.map((preset) => {
                const isSelected = value.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`
                      w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                      text-sm text-left transition-colors duration-150
                      ${isSelected
                        ? 'bg-tis-coral-50 text-tis-coral'
                        : 'text-slate-700 hover:bg-slate-50'
                      }
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="font-medium">{preset.label}</span>
                    {isSelected && (
                      <CheckIcon className="w-4 h-4 text-tis-coral" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Date display */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {formatDateRange(value.startDate, value.endDate)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =====================================================
// HELPER
// =====================================================

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
  };

  if (startDate === endDate) {
    return start.toLocaleDateString('es-MX', { ...options, year: 'numeric' });
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear === endYear) {
    return `${start.toLocaleDateString('es-MX', options)} - ${end.toLocaleDateString(
      'es-MX',
      { ...options, year: 'numeric' }
    )}`;
  }

  return `${start.toLocaleDateString('es-MX', {
    ...options,
    year: 'numeric',
  })} - ${end.toLocaleDateString('es-MX', { ...options, year: 'numeric' })}`;
}

// =====================================================
// COMPACT VARIANT
// =====================================================

export interface CompactDateRangePickerProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
  disabled?: boolean;
  className?: string;
}

export function CompactDateRangePicker({
  value,
  onChange,
  disabled = false,
  className = '',
}: CompactDateRangePickerProps) {
  return (
    <div className={`flex items-center gap-1 bg-slate-100 rounded-lg p-1 ${className}`}>
      {DATE_RANGE_PRESETS.slice(0, 4).map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => !disabled && onChange(preset.id)}
          disabled={disabled}
          className={`
            px-3 py-1.5 rounded-md text-xs font-medium
            transition-all duration-200
            ${value === preset.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {preset.id === 'today' ? 'Hoy' : preset.id === '7d' ? '7D' : preset.id === '30d' ? '30D' : '90D'}
        </button>
      ))}
    </div>
  );
}

export default DateRangePicker;
