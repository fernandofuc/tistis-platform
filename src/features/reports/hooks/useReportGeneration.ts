// =====================================================
// TIS TIS PLATFORM - Report Generation Hook
// Hook for managing report generation state and API calls
// Fixed: Memory leak, stale closures, AbortController
// =====================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchWithAuth } from '@/src/shared/lib/api-client';
import type {
  ReportPeriod,
  ReportType,
  ReportResponse,
  ReportFlowState,
} from '../types';

// ======================
// TYPES
// ======================

interface UseReportGenerationOptions {
  branchId?: string;
  onSuccess?: (url: string, filename: string) => void;
  onError?: (error: string) => void;
}

interface UseReportGenerationReturn {
  // State
  state: ReportFlowState;
  isGenerating: boolean;

  // Actions
  selectPeriod: (period: ReportPeriod) => void;
  selectType: (type: ReportType) => void;
  generate: () => Promise<void>;
  goBack: () => void;
  reset: () => void;
}

// ======================
// INITIAL STATE
// ======================

const initialState: ReportFlowState = {
  step: 'period',
  period: null,
  reportType: null,
  pdfUrl: null,
  filename: null,
  error: null,
  progress: 0,
};

// ======================
// HOOK IMPLEMENTATION
// ======================

export function useReportGeneration(
  options: UseReportGenerationOptions = {}
): UseReportGenerationReturn {
  const { branchId, onSuccess, onError } = options;

  const [state, setState] = useState<ReportFlowState>(initialState);

  // Refs to avoid stale closures and for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear interval if running
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Abort pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // ======================
  // SELECT PERIOD
  // ======================
  const selectPeriod = useCallback((period: ReportPeriod) => {
    setState((prev) => ({
      ...prev,
      period,
      step: 'type',
      error: null,
    }));
  }, []);

  // ======================
  // SELECT TYPE
  // ======================
  const selectType = useCallback((type: ReportType) => {
    setState((prev) => ({
      ...prev,
      reportType: type,
      error: null,
    }));
  }, []);

  // ======================
  // GENERATE REPORT
  // ======================
  const generate = useCallback(async () => {
    // Use functional update to get current state
    let currentPeriod: ReportPeriod | null = null;
    let currentReportType: ReportType | null = null;

    setState((prev) => {
      currentPeriod = prev.period;
      currentReportType = prev.reportType;
      return prev;
    });

    if (!currentPeriod || !currentReportType) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: 'Selecciona un período y tipo de reporte',
      }));
      return;
    }

    // Store values for use in async operation
    const period = currentPeriod;
    const reportType = currentReportType;

    setState((prev) => ({
      ...prev,
      step: 'generating',
      progress: 10,
      error: null,
    }));

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    // Simulate progress while generating
    progressIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 15, 85),
        }));
      }
    }, 800);

    try {
      const response = await fetchWithAuth<ReportResponse>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          period,
          type: reportType,
          branchId,
        }),
        signal: abortControllerRef.current.signal,
      });

      // Clear interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Check if still mounted
      if (!isMountedRef.current) return;

      if (!response.success || !response.pdfUrl) {
        throw new Error(response.error || 'Error generando reporte');
      }

      setState((prev) => ({
        ...prev,
        step: 'ready',
        pdfUrl: response.pdfUrl!,
        filename: response.filename || `reporte-${reportType}-${period}.pdf`,
        progress: 100,
      }));

      onSuccess?.(response.pdfUrl!, response.filename || '');
    } catch (err) {
      // Clear interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Check if still mounted and not aborted
      if (!isMountedRef.current) return;

      // Don't show error for aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Error generando reporte';

      setState((prev) => ({
        ...prev,
        step: 'error',
        error: errorMessage,
        progress: 0,
      }));

      onError?.(errorMessage);
    } finally {
      abortControllerRef.current = null;
    }
  }, [branchId, onSuccess, onError]);

  // ======================
  // GO BACK
  // ======================
  const goBack = useCallback(() => {
    // Cancel any pending request when going back
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setState((prev) => {
      switch (prev.step) {
        case 'type':
          return { ...prev, step: 'period' as const, reportType: null };
        case 'error':
          return prev.reportType
            ? { ...prev, step: 'type' as const, error: null }
            : { ...prev, step: 'period' as const, error: null };
        case 'ready':
          return { ...prev, step: 'type' as const };
        case 'generating':
          return { ...prev, step: 'type' as const, progress: 0 };
        default:
          return prev;
      }
    });
  }, []);

  // ======================
  // RESET
  // ======================
  const reset = useCallback(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setState(initialState);
  }, []);

  // ======================
  // RETURN
  // ======================
  return {
    state,
    isGenerating: state.step === 'generating',
    selectPeriod,
    selectType,
    generate,
    goBack,
    reset,
  };
}
