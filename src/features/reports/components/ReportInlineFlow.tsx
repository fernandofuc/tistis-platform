'use client';

// =====================================================
// TIS TIS PLATFORM - Report Inline Flow Component
// Cowork-style inline flow for report generation
// Replaces modal with minimalist inline UI above chat input
// =====================================================

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import {
  FileBarChart,
  X,
  ChevronLeft,
  Calendar,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  DollarSign,
  Activity,
  Package,
  Users,
  Sparkles,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useReportGeneration } from '../hooks/useReportGeneration';
import type { ReportPeriod, ReportType } from '../types';
import { REPORT_PERIODS, REPORT_TYPES } from '../types';

// ======================
// TYPES
// ======================

interface ReportInlineFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (pdfUrl: string) => void;
  branchId?: string;
}

// Icon mapping for report types
const REPORT_TYPE_ICONS: Record<ReportType, React.ElementType> = {
  resumen: LayoutDashboard,
  ventas: DollarSign,
  operaciones: Activity,
  inventario: Package,
  clientes: Users,
  ai_insights: Sparkles,
};

// Icon mapping for periods
const PERIOD_ICONS: Record<ReportPeriod, React.ElementType> = {
  '7d': Calendar,
  '30d': CalendarDays,
  '90d': CalendarRange,
};

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// ======================
// COMPONENT
// ======================

export function ReportInlineFlow({
  isOpen,
  onClose,
  onComplete,
  branchId,
}: ReportInlineFlowProps) {
  const {
    state,
    isGenerating,
    selectPeriod,
    selectType,
    generate,
    goBack,
    reset,
  } = useReportGeneration({
    branchId,
    onSuccess: (url) => {
      onComplete?.(url);
    },
  });

  // Handle close with reset
  const handleClose = useCallback(() => {
    if (isGenerating) return;
    reset();
    onClose();
  }, [isGenerating, reset, onClose]);

  // Handle period selection (auto-advance to type)
  const handlePeriodSelect = useCallback((period: ReportPeriod) => {
    selectPeriod(period);
  }, [selectPeriod]);

  // Handle type selection and trigger generation
  const handleTypeSelect = useCallback((type: ReportType) => {
    selectType(type);
  }, [selectType]);

  // Handle generate click
  const handleGenerate = useCallback(() => {
    generate();
  }, [generate]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (state.pdfUrl) {
      window.open(state.pdfUrl, '_blank');
    }
  }, [state.pdfUrl]);

  // Handle generate another
  const handleGenerateAnother = useCallback(() => {
    reset();
  }, [reset]);

  // Get current step labels
  const periodLabel = state.period
    ? REPORT_PERIODS.find(p => p.id === state.period)?.label
    : null;
  const typeLabel = state.reportType
    ? REPORT_TYPES.find(t => t.id === state.reportType)?.label
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: appleEasing }}
          className="border-b border-slate-200 bg-white overflow-hidden"
        >
          <div className="p-4 max-w-4xl mx-auto">
            {/* Header with title and close */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Back button (when not on first step) */}
                {state.step !== 'period' && state.step !== 'generating' && state.step !== 'ready' && (
                  <button
                    onClick={goBack}
                    className="p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="Volver"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center" aria-hidden="true">
                    <FileBarChart className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-medium text-slate-900 text-sm">
                    Crear Reporte
                  </span>

                  {/* Breadcrumb showing selections */}
                  {periodLabel && (
                    <span className="text-slate-400 text-sm">
                      • {periodLabel}
                    </span>
                  )}
                  {typeLabel && (
                    <span className="text-slate-400 text-sm">
                      • {typeLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Close button */}
              {!isGenerating && (
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content based on step */}
            <AnimatePresence mode="wait">
              {/* Step 1: Period Selection */}
              {state.step === 'period' && (
                <motion.div
                  key="period"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="text-sm text-slate-500 mb-3">
                    ¿De qué período quieres el reporte?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {REPORT_PERIODS.map((period) => {
                      const Icon = PERIOD_ICONS[period.id];
                      return (
                        <button
                          key={period.id}
                          onClick={() => handlePeriodSelect(period.id)}
                          aria-label={`${period.label}: ${period.description}`}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200',
                            'hover:border-tis-coral/50 hover:bg-tis-coral/5 active:scale-[0.98]',
                            'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
                            'border-slate-200 bg-white text-slate-700'
                          )}
                        >
                          <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <span className="text-sm font-medium">{period.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Type Selection */}
              {state.step === 'type' && (
                <motion.div
                  key="type"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="text-sm text-slate-500 mb-3">
                    ¿Qué tipo de reporte necesitas?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {REPORT_TYPES.map((type) => {
                      const Icon = REPORT_TYPE_ICONS[type.id];
                      const isSelected = state.reportType === type.id;
                      return (
                        <button
                          key={type.id}
                          onClick={() => handleTypeSelect(type.id)}
                          aria-pressed={isSelected}
                          aria-label={`${type.label}: ${type.description}`}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200',
                            'hover:shadow-sm active:scale-[0.98]',
                            'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
                            isSelected
                              ? 'border-tis-coral bg-tis-coral/5 text-tis-coral'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-tis-coral/50 hover:bg-tis-coral/5'
                          )}
                        >
                          <Icon className={cn(
                            'w-4 h-4',
                            isSelected ? 'text-tis-coral' : 'text-slate-400'
                          )} aria-hidden="true" />
                          <span className="text-sm font-medium">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!state.reportType}
                    className={cn(
                      'px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
                      state.reportType
                        ? 'bg-gradient-to-r from-tis-coral to-tis-pink text-white hover:shadow-lg hover:shadow-tis-coral/25 active:scale-[0.98]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    )}
                  >
                    Generar Reporte
                  </button>
                </motion.div>
              )}

              {/* Step 3: Generating */}
              {state.step === 'generating' && (
                <motion.div
                  key="generating"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-tis-coral/10 flex items-center justify-center" aria-hidden="true">
                      <Loader2 className="w-4 h-4 text-tis-coral animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Generando reporte...
                      </p>
                      <p className="text-xs text-slate-500">
                        {typeLabel} • {periodLabel}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 max-w-xs">
                    <div
                      className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={state.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${state.progress}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full bg-gradient-to-r from-tis-coral to-tis-pink rounded-full"
                      />
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 tabular-nums">
                    {state.progress}%
                  </span>
                </motion.div>
              )}

              {/* Step 4: Ready */}
              {state.step === 'ready' && state.pdfUrl && (
                <motion.div
                  key="ready"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center" aria-hidden="true">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        ¡Reporte listo!
                      </p>
                      <p className="text-xs text-slate-500">
                        {typeLabel} • {periodLabel}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      aria-label={`Descargar reporte ${typeLabel} ${periodLabel}`}
                      className={cn(
                        'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        'bg-gradient-to-r from-tis-coral to-tis-pink text-white',
                        'hover:shadow-lg hover:shadow-tis-coral/25 active:scale-[0.98]',
                        'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2'
                      )}
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      Descargar
                    </button>

                    <a
                      href={state.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Abrir reporte en nueva pestaña`}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]',
                        'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2'
                      )}
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      Abrir
                    </a>

                    <button
                      onClick={handleGenerateAnother}
                      aria-label="Generar otro reporte"
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]',
                        'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2'
                      )}
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Otro
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Error State */}
              {state.step === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-4"
                  role="alert"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center" aria-hidden="true">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Error al generar
                      </p>
                      <p className="text-xs text-red-500">
                        {state.error || 'Ocurrió un error inesperado'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={goBack}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]',
                      'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2'
                    )}
                  >
                    Intentar de nuevo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
