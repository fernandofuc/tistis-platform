// =====================================================
// TIS TIS PLATFORM - Prompt Preview Component
// View generated prompts for each agent profile
// =====================================================

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/shared/components/ui';
import { useToast } from '@/src/shared/hooks';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================
type ProfileType = 'business' | 'personal' | 'voice';

interface PromptData {
  prompt: string;
  tokens_estimated: number;
  generated_at: string | null;
  profile_name: string;
}

interface Props {
  className?: string;
}

// ======================
// ICONS
// ======================
const ProfileIcons = {
  business: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  personal: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  voice: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
};

// ======================
// PROFILES CONFIG
// ======================
const profiles: { key: ProfileType; label: string; description: string }[] = [
  {
    key: 'business',
    label: 'Perfil Negocio',
    description: 'Usado en canales del negocio',
  },
  {
    key: 'personal',
    label: 'Perfil Personal',
    description: 'Usado en marca personal',
  },
  {
    key: 'voice',
    label: 'Agente de Voz',
    description: 'Usado en llamadas telefónicas',
  },
];

// ======================
// COMPONENT
// ======================
export function PromptPreview({ className }: Props) {
  const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(false);
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchPrompt = async (profileType: ProfileType) => {
    setLoading(true);
    setError(null);
    setSelectedProfile(profileType);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No autenticado');
      }

      const response = await fetch(`/api/ai-config/preview-prompt?profile=${profileType}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Error al obtener el prompt';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no es JSON válido, usar mensaje genérico
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setPromptData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!promptData?.prompt) return;

    try {
      await navigator.clipboard.writeText(promptData.prompt);
      showToast({ type: 'success', message: 'Prompt copiado al portapapeles' });
    } catch {
      showToast({ type: 'error', message: 'Error al copiar' });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca generado';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-indigo-900 mb-1">Vista Previa de Prompts</h4>
            <p className="text-sm text-indigo-700">
              Visualiza cómo se ve el prompt completo que usarán tus agentes de IA.
              Incluye toda la información de tu Base de Conocimiento.
            </p>
          </div>
        </div>
      </div>

      {/* Profile Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-label="Seleccionar perfil">
        {profiles.map((profile) => (
          <button
            key={profile.key}
            onClick={() => fetchPrompt(profile.key)}
            disabled={loading}
            aria-pressed={selectedProfile === profile.key}
            aria-label={`Ver prompt de ${profile.label}`}
            className={cn(
              'p-4 rounded-xl border-2 transition-all text-left',
              selectedProfile === profile.key
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 bg-white hover:border-purple-200'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center mb-2',
              selectedProfile === profile.key
                ? 'bg-purple-100 text-purple-600'
                : 'bg-gray-100 text-gray-600'
            )} aria-hidden="true">
              {ProfileIcons[profile.key]}
            </div>
            <p className="font-semibold text-gray-900">{profile.label}</p>
            <p className="text-xs text-gray-500">{profile.description}</p>
          </button>
        ))}
      </div>

      {/* Prompt Preview */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-8 bg-gray-50 rounded-xl text-center"
            role="status"
            aria-live="polite"
          >
            <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-600">Generando preview del prompt...</p>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 rounded-xl border border-red-200"
            role="alert"
          >
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}

        {promptData && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-gray-900 rounded-xl overflow-hidden"
          >
            {/* Preview Header */}
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-gray-400 text-sm ml-2">
                  {promptData.profile_name}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
                aria-label="Copiar prompt al portapapeles"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copiar
              </Button>
            </div>

            {/* Preview Content */}
            <div className="p-4 max-h-96 overflow-y-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
                {promptData.prompt}
              </pre>
            </div>

            {/* Preview Footer */}
            <div className="px-4 py-3 bg-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>~{promptData.tokens_estimated.toLocaleString()} tokens</span>
              <span>Actualizado: {formatDate(promptData.generated_at)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No selection state */}
      {!selectedProfile && !loading && (
        <div className="p-8 bg-gray-50 rounded-xl text-center">
          <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-gray-600">Selecciona un perfil para ver su prompt</p>
        </div>
      )}
    </div>
  );
}
