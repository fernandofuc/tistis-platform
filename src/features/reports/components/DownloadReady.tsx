'use client';

// =====================================================
// TIS TIS PLATFORM - Download Ready Component
// Step 4 of report generation flow - Success state
// Fixed: Accessibility (aria-hidden, aria-labels)
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { CheckCircle2, Download, ExternalLink, RefreshCw } from 'lucide-react';
import type { ReportPeriod, ReportType } from '../types';
import { REPORT_PERIODS, REPORT_TYPES } from '../types';

// ======================
// TYPES
// ======================

interface DownloadReadyProps {
  pdfUrl: string;
  filename: string;
  period: ReportPeriod;
  reportType: ReportType;
  onDownload?: () => void;
  onGenerateAnother?: () => void;
}

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// ======================
// COMPONENT
// ======================

export function DownloadReady({
  pdfUrl,
  filename,
  period,
  reportType,
  onDownload,
  onGenerateAnother,
}: DownloadReadyProps) {
  const periodLabel = REPORT_PERIODS.find((p) => p.id === period)?.label || period;
  const typeConfig = REPORT_TYPES.find((t) => t.id === reportType);
  const typeLabel = typeConfig?.label || reportType;

  const handleDownload = () => {
    // Open in new tab for download
    window.open(pdfUrl, '_blank');
    onDownload?.();
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      {/* Success Icon (decorative) */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="relative"
        aria-hidden="true"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>

        {/* Celebration particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, x: 0, y: 0 }}
            animate={{
              scale: [0, 1, 0],
              x: Math.cos((i * Math.PI) / 3) * 50,
              y: Math.sin((i * Math.PI) / 3) * 50,
            }}
            transition={{
              duration: 0.8,
              delay: 0.2 + i * 0.1,
              ease: appleEasing,
            }}
            className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-tis-coral"
          />
        ))}
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center space-y-2"
      >
        <h2 className="text-xl font-semibold text-slate-900">
          ¡Reporte listo!
        </h2>
        <p className="text-sm text-slate-500">
          {typeLabel} • {periodLabel}
        </p>
      </motion.div>

      {/* File preview card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-sm bg-slate-50 rounded-xl p-4 border border-slate-200"
      >
        <div className="flex items-center gap-3">
          {/* PDF Icon */}
          <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-6 h-6 text-red-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
              <path d="M14 2v6h6" fill="none" stroke="currentColor" strokeWidth={2} />
              <text x="7" y="17" fontSize="6" fontWeight="bold" fill="white">
                PDF
              </text>
            </svg>
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 truncate">{filename}</p>
            <p className="text-xs text-slate-500">Listo para descargar</p>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        {/* Primary download button */}
        <button
          onClick={handleDownload}
          aria-label={`Descargar ${filename}`}
          className={cn(
            'w-full py-3.5 px-6 rounded-xl font-semibold text-white transition-all duration-200',
            'bg-gradient-to-r from-tis-coral to-tis-pink',
            'hover:shadow-lg hover:shadow-tis-coral/25 active:scale-[0.98]',
            'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
            'flex items-center justify-center gap-2'
          )}
        >
          <Download className="w-5 h-5" aria-hidden="true" />
          Descargar PDF
        </button>

        {/* Secondary buttons */}
        <div className="flex gap-3">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${filename} en nueva pestaña`}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200',
              'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]',
              'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
              'flex items-center justify-center gap-2 text-sm'
            )}
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            Abrir
          </a>

          {onGenerateAnother && (
            <button
              onClick={onGenerateAnother}
              aria-label="Generar otro reporte"
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl font-medium transition-all duration-200',
                'bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]',
                'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
                'flex items-center justify-center gap-2 text-sm'
              )}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Otro
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
