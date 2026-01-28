'use client';

// =====================================================
// TIS TIS PLATFORM - Report Type Selector Component
// Step 2 of report generation flow
// Fixed: Accessibility (aria-pressed, aria-hidden)
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import {
  LayoutDashboard,
  DollarSign,
  Activity,
  Package,
  Users,
  Sparkles,
} from 'lucide-react';
import type { ReportType } from '../types';

// ======================
// TYPES
// ======================

interface ReportTypeSelectorProps {
  onSelect: (type: ReportType) => void;
  selectedType?: ReportType | null;
  onConfirm: () => void;
}

interface ReportTypeOption {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  hoverBorder: string;
}

// ======================
// CONSTANTS
// ======================

const REPORT_TYPES: ReportTypeOption[] = [
  {
    id: 'resumen',
    label: 'Resumen General',
    description: 'KPIs principales y tendencias',
    icon: LayoutDashboard,
    color: 'text-tis-coral',
    bgColor: 'bg-tis-coral/10',
    hoverBorder: 'hover:border-tis-coral/50',
  },
  {
    id: 'ventas',
    label: 'Ventas',
    description: 'Ingresos, tickets y métodos de pago',
    icon: DollarSign,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    hoverBorder: 'hover:border-emerald-500/50',
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    description: 'Órdenes, tiempos y eficiencia',
    icon: Activity,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    hoverBorder: 'hover:border-blue-500/50',
  },
  {
    id: 'inventario',
    label: 'Inventario',
    description: 'Stock, movimientos y alertas',
    icon: Package,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    hoverBorder: 'hover:border-purple-500/50',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Leads, conversiones y retención',
    icon: Users,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    hoverBorder: 'hover:border-amber-500/50',
  },
  {
    id: 'ai_insights',
    label: 'AI Insights',
    description: 'Análisis inteligente con IA',
    icon: Sparkles,
    color: 'text-tis-pink',
    bgColor: 'bg-tis-pink/10',
    hoverBorder: 'hover:border-tis-pink/50',
  },
];

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// ======================
// COMPONENT
// ======================

export function ReportTypeSelector({
  onSelect,
  selectedType,
  onConfirm,
}: ReportTypeSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900">
          ¿Qué tipo de reporte necesitas?
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Selecciona la categoría de análisis
        </p>
      </div>

      {/* Report Type Options - Grid 2x3 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {REPORT_TYPES.map((type, index) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <motion.button
              key={type.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, ease: appleEasing }}
              onClick={() => onSelect(type.id)}
              aria-pressed={isSelected}
              aria-label={`${type.label}: ${type.description}`}
              className={cn(
                'relative p-4 rounded-xl border-2 transition-all duration-200',
                'hover:shadow-md active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
                isSelected
                  ? 'border-tis-coral bg-tis-coral/5 shadow-md'
                  : `border-slate-200 bg-white ${type.hoverBorder}`
              )}
            >
              <div className="flex flex-col items-center text-center gap-2">
                {/* Icon */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    isSelected ? 'bg-tis-coral/10' : type.bgColor
                  )}
                  aria-hidden="true"
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isSelected ? 'text-tis-coral' : type.color
                    )}
                  />
                </div>

                {/* Text */}
                <div>
                  <h3
                    className={cn(
                      'font-medium text-sm transition-colors',
                      isSelected ? 'text-tis-coral' : 'text-slate-900'
                    )}
                  >
                    {type.label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {type.description}
                  </p>
                </div>
              </div>

              {/* Selected check */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-tis-coral rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Generate Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: selectedType ? 1 : 0.5 }}
        onClick={onConfirm}
        disabled={!selectedType}
        className={cn(
          'w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
          selectedType
            ? 'bg-gradient-to-r from-tis-coral to-tis-pink hover:shadow-lg hover:shadow-tis-coral/25 active:scale-[0.98]'
            : 'bg-slate-300 cursor-not-allowed'
        )}
      >
        Generar Reporte
      </motion.button>
    </div>
  );
}
