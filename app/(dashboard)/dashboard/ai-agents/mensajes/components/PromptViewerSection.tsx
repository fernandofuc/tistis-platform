// =====================================================
// TIS TIS PLATFORM - Prompt Viewer Section Component
// Muestra el prompt generado para un perfil de agente
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';

// Shared imports
import { icons } from './shared';

// ======================
// TYPES
// ======================
interface PromptViewerSectionProps {
  profileType: 'business' | 'personal';
  profileName: string;
  isProfileActive: boolean;
  tenantId?: string;
  // Color scheme based on profile type
  colorScheme?: 'purple' | 'orange';
}

interface PromptData {
  has_prompt: boolean;
  prompt: string | null;
  prompt_preview: string | null;
  prompt_length: number;
  estimated_tokens: number;
  prompt_version: number;
  last_generated: string | null;
  needs_regeneration: boolean;
  agent_profile: {
    profile_name: string;
    agent_template: string;
    response_style: string;
    is_active: boolean;
  } | null;
}

// ======================
// COMPONENT
// ======================
export function PromptViewerSection({
  profileType,
  profileName,
  isProfileActive,
  colorScheme = 'purple',
}: PromptViewerSectionProps) {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Color schemes
  const colors = colorScheme === 'purple'
    ? {
        gradient: 'from-purple-50 to-indigo-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        bg: 'bg-purple-100',
        button: 'bg-purple-600 hover:bg-purple-700',
        icon: 'text-purple-600',
      }
    : {
        gradient: 'from-orange-50 to-amber-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        bg: 'bg-orange-100',
        button: 'bg-orange-600 hover:bg-orange-700',
        icon: 'text-orange-600',
      };

  // Fetch prompt data
  const fetchPromptData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Sesión no válida');
        return;
      }

      const response = await fetch(`/api/agent-profiles/prompt?profile_type=${profileType}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al obtener prompt');
      }

      const data = await response.json();
      if (data.success) {
        setPromptData(data);
      } else {
        setError(data.error || 'Error desconocido');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('[PromptViewer] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profileType]);

  // Regenerate prompt
  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Sesión no válida');
        return;
      }

      const response = await fetch('/api/agent-profiles/prompt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profile_type: profileType }),
      });

      const data = await response.json();
      if (data.success) {
        setPromptData(prev => ({
          ...prev!,
          has_prompt: true,
          prompt: data.prompt,
          prompt_preview: data.prompt_preview,
          prompt_length: data.prompt_length,
          estimated_tokens: data.estimated_tokens,
          last_generated: data.generated_at,
          needs_regeneration: false,
        }));
      } else {
        setError(data.error || 'Error al regenerar');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('[PromptViewer] Regenerate error:', err);
    } finally {
      setIsRegenerating(false);
    }
  }, [profileType]);

  // Copy prompt to clipboard
  const handleCopy = useCallback(async () => {
    if (!promptData?.prompt) return;

    try {
      await navigator.clipboard.writeText(promptData.prompt);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('[PromptViewer] Copy error:', err);
    }
  }, [promptData?.prompt]);

  // Fetch on expand
  useEffect(() => {
    if (isExpanded && !promptData && !isLoading) {
      fetchPromptData();
    }
  }, [isExpanded, promptData, isLoading, fetchPromptData]);

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca generado';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn(
      'bg-gradient-to-r rounded-2xl border overflow-hidden shadow-sm',
      colors.gradient,
      colors.border
    )}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', colors.bg)}>
            {icons.documentText}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Ver Prompt Generado</h3>
            <p className="text-sm text-slate-500">
              {promptData?.has_prompt
                ? `${promptData.estimated_tokens.toLocaleString()} tokens • Última actualización: ${formatDate(promptData.last_generated)}`
                : 'Click para ver el prompt del asistente'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {promptData?.needs_regeneration && (
            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              Requiere actualización
            </span>
          )}
          <motion.span
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            {icons.chevronDown}
          </motion.span>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
              {/* Loading State */}
              {isLoading && (
                <div className="pt-4 flex items-center justify-center gap-2 text-slate-500">
                  {icons.spinner}
                  <span>Cargando prompt...</span>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="pt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={fetchPromptData}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Prompt Content */}
              {!isLoading && !error && promptData && (
                <>
                  {/* Stats Row */}
                  <div className="pt-4 grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500">Caracteres</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {promptData.prompt_length.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500">Tokens (aprox)</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {promptData.estimated_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500">Versión</p>
                      <p className="text-lg font-semibold text-slate-900">
                        v{promptData.prompt_version || 1}
                      </p>
                    </div>
                  </div>

                  {/* Prompt Preview */}
                  <div className="relative">
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-500">
                          PROMPT DEL SISTEMA
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCopy}
                            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Copiar prompt"
                          >
                            {copySuccess ? icons.check : icons.clipboardCopy}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 max-h-96 overflow-y-auto">
                        {promptData.prompt ? (
                          <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {promptData.prompt}
                          </pre>
                        ) : (
                          <p className="text-sm text-slate-500 italic">
                            No hay prompt generado. Guarda tu configuración para generar uno.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Copy success toast */}
                    <AnimatePresence>
                      {copySuccess && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute bottom-4 right-4 px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg shadow-lg"
                        >
                          ¡Copiado!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Info Banner */}
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">💡 Este prompt se genera automáticamente</span> combinando tu configuración de agente,
                      las instrucciones de tu Base de Conocimiento marcadas como &quot;Incluir en Prompt&quot;, y la información de tu negocio.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all',
                        isRegenerating ? 'opacity-70 cursor-not-allowed' : '',
                        colors.button
                      )}
                    >
                      {isRegenerating ? (
                        <>
                          {icons.spinner}
                          <span>Regenerando...</span>
                        </>
                      ) : (
                        <>
                          {icons.refresh}
                          <span>Regenerar Prompt</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Regeneration Warning */}
                  {promptData.needs_regeneration && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-700">
                        <span className="font-medium">⚠️ Tu prompt necesita actualizarse.</span>{' '}
                        Has realizado cambios en tu configuración o Base de Conocimiento.
                        Regenera el prompt para que reflejen los cambios.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PromptViewerSection;
