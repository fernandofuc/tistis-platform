'use client';

/**
 * TIS TIS Platform - Voice Agent Setup Wizard Page
 *
 * Dedicated page for the 5-step voice agent configuration wizard.
 * Users are redirected here when setting up a new voice agent
 * or when they need to reconfigure their existing one.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/src/features/auth';
import { useTenant } from '@/src/hooks/useTenant';
import { VoiceAgentWizard } from '@/components/voice-agent/wizard';
import type { VoiceAgentConfig } from '@/src/features/voice-agent/types';

// =====================================================
// LOADING COMPONENT
// =====================================================

function LoadingState() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-4 border-t-tis-coral animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Preparando tu asistente
        </h2>
        <p className="text-slate-500">
          Cargando configuración...
        </p>
      </motion.div>
    </div>
  );
}

// =====================================================
// ERROR COMPONENT
// =====================================================

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
      >
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
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

        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Error al cargar
        </h2>
        <p className="text-slate-500 mb-6">{message}</p>

        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={() => router.push('/dashboard/ai-agents/voz')}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          >
            Volver
          </button>
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all"
          >
            Reintentar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================
// MAIN PAGE COMPONENT
// =====================================================

export default function VoiceAgentSetupPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { tenant } = useTenant();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingConfig, setExistingConfig] = useState<VoiceAgentConfig | null>(
    null
  );

  const accessToken = session?.access_token || '';
  const vertical = (tenant?.vertical || 'dental') as 'restaurant' | 'dental';
  const businessId = tenant?.id || '';

  // Fetch existing voice agent configuration
  const fetchConfig = useCallback(async () => {
    if (!accessToken) {
      setError('Sesión no válida. Inicia sesión de nuevo.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/voice-agent', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        // If blocked (no plan), redirect to main page
        if (data.status === 'blocked') {
          router.replace('/dashboard/ai-agents/voz');
          return;
        }

        throw new Error(data.error || 'Error al cargar configuración');
      }

      const result = await response.json();
      setExistingConfig(result.data?.config || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar configuración'
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, router]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save configuration handler
  const handleSaveConfig = useCallback(
    async (updates: Partial<VoiceAgentConfig>): Promise<boolean> => {
      if (!accessToken) return false;

      try {
        const response = await fetch('/api/voice-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(updates),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          // Update local state
          if (result.config) {
            setExistingConfig(result.config);
          }
          return true;
        }

        return false;
      } catch {
        return false;
      }
    },
    [accessToken]
  );

  // Request phone number handler
  const handleRequestPhoneNumber = useCallback(
    async (areaCode: string): Promise<boolean> => {
      if (!accessToken) return false;

      try {
        const response = await fetch('/api/voice-agent/phone-numbers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ area_code: areaCode }),
        });

        const result = await response.json();
        return response.ok && result.success;
      } catch {
        return false;
      }
    },
    [accessToken]
  );

  // Wizard completion handler
  const handleComplete = useCallback(() => {
    router.push('/dashboard/ai-agents/voz');
  }, [router]);

  // Wizard close handler
  const handleClose = useCallback(() => {
    router.push('/dashboard/ai-agents/voz');
  }, [router]);

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={fetchConfig} />;
  }

  // Render wizard
  return (
    <VoiceAgentWizard
      businessId={businessId}
      vertical={vertical}
      existingConfig={existingConfig}
      accessToken={accessToken}
      onComplete={handleComplete}
      onClose={handleClose}
      onSaveConfig={handleSaveConfig}
      onRequestPhoneNumber={handleRequestPhoneNumber}
    />
  );
}
