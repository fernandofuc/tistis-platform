'use client';

// =====================================================
// TIS TIS PLATFORM - Business Knowledge Section
// Muestra al cliente qué información tiene el asistente
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import type { PromptPreviewResponse } from '../types';

// ======================
// ICONS
// ======================

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
    <path d="M10 6h4"/>
    <path d="M10 10h4"/>
    <path d="M10 14h4"/>
    <path d="M10 18h4"/>
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const BriefcaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" className="animate-spin origin-center"/>
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ======================
// TYPES
// ======================

interface BusinessKnowledgeSectionProps {
  accessToken: string;
  onRegeneratePrompt?: () => void;
}

// ======================
// COMPONENT
// ======================

export function BusinessKnowledgeSection({
  accessToken,
  onRegeneratePrompt,
}: BusinessKnowledgeSectionProps) {
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [data, setData] = useState<PromptPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Fetch prompt context
  const fetchContext = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/voice-agent/generate-prompt', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar información del asistente');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Regenerate prompt
  const handleRegenerate = async () => {
    try {
      setRegenerating(true);

      const response = await fetch('/api/voice-agent/generate-prompt', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al regenerar prompt');
      }

      // Refetch context
      await fetchContext();
      onRegeneratePrompt?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al regenerar');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-tis-coral rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="text-center py-8">
          <AlertTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={fetchContext}
            className="mt-4 px-4 py-2 text-sm font-medium text-tis-coral hover:bg-tis-coral/5 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const context = data?.context_summary;
  const hasPrompt = !!data?.current_prompt;

  // Calculate warnings - show when context is null OR when data is missing
  const warnings: string[] = [];
  if (!context) {
    warnings.push('No hay sucursales configuradas');
    warnings.push('No hay servicios configurados');
    warnings.push('No hay personal registrado');
  } else {
    if (!context.has_branches) warnings.push('No hay sucursales configuradas');
    if (!context.has_services) warnings.push('No hay servicios configurados');
    if (!context.has_staff) warnings.push('No hay personal registrado');
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FileTextIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Conocimiento del Negocio</h3>
                <p className="text-sm text-slate-500">Información que usará tu asistente de voz</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshIcon className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Actualizando...' : 'Actualizar'}
              </button>
              <button
                onClick={() => setShowPromptModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:shadow-lg hover:shadow-tis-coral/20 transition-all"
              >
                <EyeIcon className="w-4 h-4" />
                Ver Prompt
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    Información incompleta
                  </p>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        {w}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 mt-3 mb-3">
                    Configura sucursales, doctores y servicios en <strong>Ajustes → AI Agent → Clínica</strong>. El asistente de voz comparte esta información con tu AI Agent de chat.
                  </p>
                  <Link
                    href="/dashboard/settings?tab=ai"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Configurar en AI Agent
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Sucursales */}
            <div className={`p-4 rounded-xl border transition-colors ${
              context?.has_branches
                ? 'bg-tis-green/5 border-tis-green/20'
                : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  context?.has_branches ? 'bg-tis-green/10' : 'bg-slate-100'
                }`}>
                  <BuildingIcon className={`w-4 h-4 ${
                    context?.has_branches ? 'text-tis-green' : 'text-slate-400'
                  }`} />
                </div>
                {context?.has_branches ? (
                  <CheckCircleIcon className="w-4 h-4 text-tis-green" />
                ) : (
                  <AlertTriangleIcon className="w-4 h-4 text-slate-300" />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{context?.branches_count || 0}</p>
              <p className="text-xs text-slate-500">Sucursales</p>
            </div>

            {/* Servicios */}
            <div className={`p-4 rounded-xl border transition-colors ${
              context?.has_services
                ? 'bg-tis-green/5 border-tis-green/20'
                : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  context?.has_services ? 'bg-tis-green/10' : 'bg-slate-100'
                }`}>
                  <BriefcaseIcon className={`w-4 h-4 ${
                    context?.has_services ? 'text-tis-green' : 'text-slate-400'
                  }`} />
                </div>
                {context?.has_services ? (
                  <CheckCircleIcon className="w-4 h-4 text-tis-green" />
                ) : (
                  <AlertTriangleIcon className="w-4 h-4 text-slate-300" />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{context?.services_count || 0}</p>
              <p className="text-xs text-slate-500">Servicios</p>
            </div>

            {/* Personal */}
            <div className={`p-4 rounded-xl border transition-colors ${
              context?.has_staff
                ? 'bg-tis-green/5 border-tis-green/20'
                : 'bg-slate-50 border-slate-100'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  context?.has_staff ? 'bg-tis-green/10' : 'bg-slate-100'
                }`}>
                  <UsersIcon className={`w-4 h-4 ${
                    context?.has_staff ? 'text-tis-green' : 'text-slate-400'
                  }`} />
                </div>
                {context?.has_staff ? (
                  <CheckCircleIcon className="w-4 h-4 text-tis-green" />
                ) : (
                  <AlertTriangleIcon className="w-4 h-4 text-slate-300" />
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900">{context?.staff_count || 0}</p>
              <p className="text-xs text-slate-500">Personal</p>
            </div>
          </div>

          {/* Prompt Status */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  hasPrompt ? 'bg-tis-green' : 'bg-amber-400'
                }`} />
                <span className="text-sm text-slate-600">
                  {hasPrompt
                    ? `Prompt generado ${data?.current_prompt_generated_at
                        ? new Date(data.current_prompt_generated_at).toLocaleDateString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''
                      }`
                    : 'Sin prompt generado'
                  }
                </span>
              </div>
              {!hasPrompt && (
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="text-sm font-medium text-tis-coral hover:text-tis-pink transition-colors"
                >
                  Generar ahora
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Preview Modal */}
      <AnimatePresence>
        {showPromptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowPromptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Prompt del Asistente</h2>
                  <p className="text-sm text-slate-500">
                    Este es el texto que guía el comportamiento de tu asistente
                  </p>
                </div>
                <button
                  onClick={() => setShowPromptModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <XIcon className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {data?.current_prompt ? (
                  <div className="bg-slate-50 rounded-xl p-6 font-mono text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {data.current_prompt}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileTextIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 mb-4">No hay prompt generado todavía</p>
                    <button
                      onClick={() => {
                        setShowPromptModal(false);
                        handleRegenerate();
                      }}
                      className="px-6 py-2 bg-tis-coral text-white font-medium rounded-xl hover:bg-tis-pink transition-colors"
                    >
                      Generar Prompt
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {data?.current_prompt && (
                <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-400">
                    {data.current_prompt.length} caracteres
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(data.current_prompt || '');
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => {
                        handleRegenerate();
                      }}
                      disabled={regenerating}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      <RefreshIcon className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                      Regenerar
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default BusinessKnowledgeSection;
