'use client';

import { useEffect } from 'react';

// =====================================================
// TIS TIS PLATFORM - Application Error Boundary
// FASE 9 - Production Error Handling
// =====================================================

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Report error to monitoring service
 * In production, this would send to Sentry, LogRocket, etc.
 */
async function reportError(error: Error & { digest?: string }) {
  // Only report in production
  if (process.env.NODE_ENV !== 'production') return;

  try {
    // POST to internal error tracking endpoint
    await fetch('/api/errors/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack?.slice(0, 1000), // Limit stack trace size
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // Silently fail if error reporting fails
    });
  } catch {
    // Never let error reporting break the app
  }
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to console
    console.error('Application error:', error);

    // Report to monitoring in production
    reportError(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center max-w-md px-6">
        {/* Error Icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-slate-800 mb-3">
          Algo salió mal
        </h2>

        {/* Description */}
        <p className="text-slate-600 mb-8">
          Ha ocurrido un error inesperado. Por favor intenta de nuevo.
        </p>

        {/* Error Details (development: full details, production: just ID) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
            <p className="text-sm font-mono text-red-700 break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Error ID (always shown for support reference) */}
        {error.digest && (
          <p className="mb-6 text-xs text-slate-500">
            Código de error: <code className="bg-slate-100 px-2 py-1 rounded">{error.digest}</code>
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-6 py-3 bg-tis-coral text-white font-medium rounded-lg hover:bg-tis-coral/90 transition-colors"
          >
            Intentar de nuevo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Ir al inicio
          </a>
        </div>

        {/* Help Link */}
        <p className="mt-8 text-sm text-slate-500">
          Si el problema persiste,{' '}
          <a
            href="mailto:soporte@tistis.com"
            className="text-tis-coral hover:underline"
          >
            contáctanos
          </a>
        </p>
      </div>
    </div>
  );
}
