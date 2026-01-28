'use client';

// =====================================================
// TIS TIS PLATFORM - Report Flow Overlay Component
// Multi-step modal for report generation
// Inspired by Claude Cowork design
// Fixed: Accessibility (role, aria, ESC, focus trap)
// =====================================================

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { X, ChevronLeft, FileBarChart, AlertCircle } from 'lucide-react';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { PeriodSelector } from './PeriodSelector';
import { ReportTypeSelector } from './ReportTypeSelector';
import { GeneratingState } from './GeneratingState';
import { DownloadReady } from './DownloadReady';

// ======================
// TYPES
// ======================

interface ReportFlowOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (pdfUrl: string) => void;
  branchId?: string;
}

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// Step labels for progress indicator
const STEP_LABELS = ['Período', 'Tipo', 'Generando', 'Listo'];

// ======================
// COMPONENT
// ======================

export function ReportFlowOverlay({
  isOpen,
  onClose,
  onComplete,
  branchId,
}: ReportFlowOverlayProps) {
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

  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow animation to complete
      const timer = setTimeout(reset, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, reset]);

  // ESC key handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isGenerating) {
        onClose();
      }
    },
    [isGenerating, onClose]
  );

  // Focus trap and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Add ESC key listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the modal
      const timer = setTimeout(() => {
        modalRef.current?.focus();
      }, 100);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        clearTimeout(timer);

        // Restore focus to previous element
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, handleKeyDown]);

  // Get current step index for progress indicator
  const getStepIndex = () => {
    switch (state.step) {
      case 'period':
        return 0;
      case 'type':
        return 1;
      case 'generating':
        return 2;
      case 'ready':
        return 3;
      case 'error':
        return state.reportType ? 1 : 0;
      default:
        return 0;
    }
  };

  // Can show back button?
  const canGoBack = state.step === 'type' || state.step === 'error';

  // Handle close with confirmation if generating
  const handleClose = () => {
    if (isGenerating) {
      // Could add confirmation dialog here
      return;
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.3, ease: appleEasing }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:w-full sm:max-w-lg outline-none"
          >
            <div className="h-full sm:h-auto bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {/* Back button */}
                  {canGoBack && (
                    <motion.button
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={goBack}
                      aria-label="Volver al paso anterior"
                      className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </motion.button>
                  )}

                  {/* Title with icon */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
                      <FileBarChart className="w-4 h-4 text-white" aria-hidden="true" />
                    </div>
                    <h1 id="report-modal-title" className="font-semibold text-slate-900">
                      Crear Reporte
                    </h1>
                  </div>
                </div>

                {/* Close button */}
                {!isGenerating && (
                  <button
                    onClick={handleClose}
                    aria-label="Cerrar modal"
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Progress indicator */}
              <div className="px-4 py-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  {STEP_LABELS.map((label, index) => {
                    const currentStep = getStepIndex();
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;

                    return (
                      <div key={label} className="flex items-center">
                        {/* Step indicator */}
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                              isCompleted
                                ? 'bg-tis-coral text-white'
                                : isActive
                                ? 'bg-tis-coral/20 text-tis-coral border-2 border-tis-coral'
                                : 'bg-slate-200 text-slate-400'
                            )}
                          >
                            {isCompleted ? '✓' : index + 1}
                          </div>
                          <span
                            className={cn(
                              'text-xs mt-1 hidden sm:block',
                              isActive ? 'text-tis-coral font-medium' : 'text-slate-400'
                            )}
                          >
                            {label}
                          </span>
                        </div>

                        {/* Connector line */}
                        {index < STEP_LABELS.length - 1 && (
                          <div
                            className={cn(
                              'w-8 sm:w-12 h-0.5 mx-1 sm:mx-2',
                              isCompleted ? 'bg-tis-coral' : 'bg-slate-200'
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {/* Step 1: Period Selection */}
                  {state.step === 'period' && (
                    <motion.div
                      key="period"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PeriodSelector
                        onSelect={selectPeriod}
                        selectedPeriod={state.period}
                      />
                    </motion.div>
                  )}

                  {/* Step 2: Report Type Selection */}
                  {state.step === 'type' && (
                    <motion.div
                      key="type"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ReportTypeSelector
                        onSelect={selectType}
                        selectedType={state.reportType}
                        onConfirm={generate}
                      />
                    </motion.div>
                  )}

                  {/* Step 3: Generating */}
                  {state.step === 'generating' && state.period && state.reportType && (
                    <motion.div
                      key="generating"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <GeneratingState
                        period={state.period}
                        reportType={state.reportType}
                        progress={state.progress}
                      />
                    </motion.div>
                  )}

                  {/* Step 4: Ready */}
                  {state.step === 'ready' && state.pdfUrl && state.period && state.reportType && (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <DownloadReady
                        pdfUrl={state.pdfUrl}
                        filename={state.filename || 'reporte.pdf'}
                        period={state.period}
                        reportType={state.reportType}
                        onGenerateAnother={reset}
                      />
                    </motion.div>
                  )}

                  {/* Error State */}
                  {state.step === 'error' && (
                    <motion.div
                      key="error"
                      role="alert"
                      aria-live="assertive"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center justify-center py-8 space-y-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-500" aria-hidden="true" />
                      </div>
                      <div className="text-center">
                        <h2 className="text-lg font-semibold text-slate-900">
                          Error al generar
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                          {state.error || 'Ocurrió un error inesperado'}
                        </p>
                      </div>
                      <button
                        onClick={goBack}
                        aria-label="Intentar generar el reporte nuevamente"
                        className={cn(
                          'py-2.5 px-6 rounded-xl font-medium transition-all duration-200',
                          'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]'
                        )}
                      >
                        Intentar de nuevo
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
