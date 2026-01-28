'use client';

// =====================================================
// TIS TIS PLATFORM - Generating State Component
// Step 3 of report generation flow - Loading state
// Fixed: Accessibility (aria-live, progressbar role)
// =====================================================

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { FileText, Loader2 } from 'lucide-react';
import type { ReportPeriod, ReportType } from '../types';
import { REPORT_PERIODS, REPORT_TYPES } from '../types';

// ======================
// TYPES
// ======================

interface GeneratingStateProps {
  period: ReportPeriod;
  reportType: ReportType;
  progress: number;
}

// ======================
// COMPONENT
// ======================

export function GeneratingState({ period, reportType, progress }: GeneratingStateProps) {
  const periodLabel = REPORT_PERIODS.find((p) => p.id === period)?.label || period;
  const typeLabel = REPORT_TYPES.find((t) => t.id === reportType)?.label || reportType;

  // Compute step label for screen readers
  const currentStep = useMemo(() => {
    if (progress < 30) return 'Obteniendo datos';
    if (progress < 70) return 'Generando PDF';
    if (progress < 100) return 'Finalizando';
    return 'Completado';
  }, [progress]);

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-8">
      {/* Animated Icon (decorative) */}
      <div className="relative" aria-hidden="true">
        {/* Pulsing background */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full bg-tis-coral/20"
        />

        {/* Icon container */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center shadow-lg shadow-tis-coral/30">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-8 h-8 text-white" />
          </motion.div>
        </div>

        {/* Floating document icon */}
        <motion.div
          animate={{
            y: [-5, 5, -5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute -right-2 -bottom-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center"
        >
          <FileText className="w-5 h-5 text-tis-coral" />
        </motion.div>
      </div>

      {/* Text */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">
          Generando tu reporte
        </h2>
        <p className="text-sm text-slate-500">
          {typeLabel} • {periodLabel}
        </p>
      </div>

      {/* Progress Bar with accessibility */}
      <div className="w-full max-w-xs space-y-2">
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Generando reporte: ${progress}% - ${currentStep}`}
          className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-tis-coral to-tis-pink rounded-full"
          />
        </div>
        {/* Live region for screen readers */}
        <p
          className="text-center text-sm text-slate-400"
          aria-live="polite"
          aria-atomic="true"
        >
          {progress}%
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <motion.span
          animate={{ opacity: progress < 30 ? [0.5, 1, 0.5] : 1 }}
          transition={{ duration: 1, repeat: progress < 30 ? Infinity : 0 }}
          className={cn(progress >= 30 && 'text-tis-coral')}
        >
          Obteniendo datos
        </motion.span>
        <span className="text-slate-300">→</span>
        <motion.span
          animate={{ opacity: progress >= 30 && progress < 70 ? [0.5, 1, 0.5] : 1 }}
          transition={{ duration: 1, repeat: progress >= 30 && progress < 70 ? Infinity : 0 }}
          className={cn(progress >= 70 && 'text-tis-coral')}
        >
          Generando PDF
        </motion.span>
        <span className="text-slate-300">→</span>
        <motion.span
          animate={{ opacity: progress >= 70 ? [0.5, 1, 0.5] : 1 }}
          transition={{ duration: 1, repeat: progress >= 70 && progress < 100 ? Infinity : 0 }}
          className={cn(progress >= 100 && 'text-tis-coral')}
        >
          Finalizando
        </motion.span>
      </div>
    </div>
  );
}
