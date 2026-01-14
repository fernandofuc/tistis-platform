// =====================================================
// TIS TIS PLATFORM - Resumen Tab (Agent Messages)
// Overview tab showing agent status, metrics, and preview
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { createClient } from '@supabase/supabase-js';
import type { AgentProfileWithChannels } from '@/src/shared/types/agent-profiles';

// Shared imports from centralized modules
import { icons, channelIconsConfig, PREVIEW_SCENARIOS } from '../shared';

// ======================
// TYPES
// ======================
interface ResumenTabProps {
  businessProfile: AgentProfileWithChannels | null;
  personalProfile: AgentProfileWithChannels | null;
  tenantName?: string;
  vertical: string;
  isLoading?: boolean;
  onEditBusiness: () => void;
  onEditPersonal: () => void;
}

interface PreviewMetadata {
  intent: string;
  signals: Array<{ signal: string; points: number }>;
  processing_time_ms: number;
  model_used: string;
  prompt_from_cache: boolean;
  prompt_version?: number;
  tokens_used: number;
}

type ProfileType = 'business' | 'personal';

// ======================
// INTENT LABELS
// ======================
const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  GREETING: { label: 'Saludo', color: 'bg-blue-100 text-blue-700' },
  PRICE_INQUIRY: { label: 'Consulta de precio', color: 'bg-green-100 text-green-700' },
  BOOK_APPOINTMENT: { label: 'Agendar cita', color: 'bg-purple-100 text-purple-700' },
  LOCATION: { label: 'Ubicación', color: 'bg-amber-100 text-amber-700' },
  HOURS: { label: 'Horarios', color: 'bg-cyan-100 text-cyan-700' },
  PAIN_URGENT: { label: 'Urgencia', color: 'bg-red-100 text-red-700' },
  HUMAN_REQUEST: { label: 'Solicita humano', color: 'bg-orange-100 text-orange-700' },
  GENERAL_INQUIRY: { label: 'Consulta general', color: 'bg-slate-100 text-slate-700' },
  UNKNOWN: { label: 'Desconocido', color: 'bg-slate-100 text-slate-500' },
};

// ======================
// COMPONENT
// ======================
export function ResumenTab({
  businessProfile,
  personalProfile,
  tenantName,
  vertical,
  isLoading,
  onEditBusiness,
  onEditPersonal,
}: ResumenTabProps) {
  const [selectedScenario, setSelectedScenario] = useState(PREVIEW_SCENARIOS[0]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>('business');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewResponse, setPreviewResponse] = useState<string | null>(null);
  const [previewMetadata, setPreviewMetadata] = useState<PreviewMetadata | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const showPersonal = vertical === 'dental';
  const businessIsActive = businessProfile?.is_active ?? false;
  const personalIsActive = personalProfile?.is_active ?? false;

  // Get connected channels for business profile
  const connectedChannels = businessProfile?.channels?.filter(c => c.is_connected) || [];

  // Get Supabase session for API calls
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  // Generate preview using real AI with Knowledge Base
  const handleGeneratePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    setPreviewError(null);
    setPreviewMetadata(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setPreviewError('Sesión expirada. Por favor, recarga la página.');
        setIsGeneratingPreview(false);
        return;
      }

      const messageToSend = isCustomMode && customMessage.trim()
        ? customMessage.trim()
        : selectedScenario.message;

      const response = await fetch('/api/ai-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: messageToSend,
          profile_type: selectedProfile,
          scenario_id: selectedScenario.id,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setPreviewError(result.error || 'Error al generar la respuesta');
        setPreviewResponse(null);
      } else {
        setPreviewResponse(result.response);
        setPreviewMetadata({
          intent: result.intent || 'UNKNOWN',
          signals: result.signals || [],
          processing_time_ms: result.processing_time_ms || 0,
          model_used: result.model_used || 'unknown',
          prompt_from_cache: result.prompt_from_cache ?? false,
          prompt_version: result.prompt_version,
          tokens_used: result.tokens_used || 0,
        });
      }
    } catch (error) {
      console.error('[ResumenTab] Preview error:', error);
      setPreviewError('Error de conexión. Intenta de nuevo.');
      setPreviewResponse(null);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [getAccessToken, selectedScenario, selectedProfile, isCustomMode, customMessage]);

  // Handle scenario change
  const handleScenarioChange = useCallback((scenario: typeof PREVIEW_SCENARIOS[0]) => {
    setSelectedScenario(scenario);
    setPreviewResponse(null);
    setPreviewMetadata(null);
    setPreviewError(null);
    setIsCustomMode(false);
    setCustomMessage('');
  }, []);

  // Handle profile change
  const handleProfileChange = useCallback((profile: ProfileType) => {
    setSelectedProfile(profile);
    setPreviewResponse(null);
    setPreviewMetadata(null);
    setPreviewError(null);
  }, []);

  // Toggle custom message mode
  const handleToggleCustomMode = useCallback(() => {
    setIsCustomMode(prev => !prev);
    setPreviewResponse(null);
    setPreviewMetadata(null);
    setPreviewError(null);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Status Cards */}
      <div className={cn(
        'grid gap-4',
        showPersonal ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      )}>
        {/* Business Profile Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center',
                businessIsActive
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-slate-100 text-slate-400'
              )}>
                {icons.building}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Perfil de Negocio</h3>
                <p className="text-sm text-slate-500">{tenantName || 'Mi Negocio'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                businessIsActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  businessIsActive ? 'bg-emerald-500' : 'bg-slate-400'
                )} />
                {businessIsActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {/* Connected Channels */}
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Canales conectados</p>
            <div className="flex flex-wrap gap-2">
              {connectedChannels.length > 0 ? (
                connectedChannels.map((channel, idx) => {
                  const channelInfo = channelIconsConfig[channel.channel_type] || channelIconsConfig.whatsapp;
                  return (
                    <span
                      key={`${channel.channel_type}-${channel.account_number}-${idx}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                        channelInfo.bg,
                        channelInfo.color
                      )}
                    >
                      {channelInfo.icon}
                      <span className="capitalize">{channelInfo.name}</span>
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-slate-400">Sin canales conectados</span>
              )}
            </div>
          </div>

          {/* Quick Info */}
          {businessProfile && (
            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
              <span>Estilo: <strong className="text-slate-700">{businessProfile.response_style === 'professional_friendly' ? 'Profesional Cálido' : businessProfile.response_style}</strong></span>
              <span>Delay: <strong className="text-slate-700">{businessProfile.response_delay_minutes === 0 ? 'Inmediato' : `${businessProfile.response_delay_minutes} min`}</strong></span>
            </div>
          )}

          <button
            onClick={onEditBusiness}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            {icons.edit}
            <span>Editar configuración</span>
          </button>
        </div>

        {/* Personal Profile Status (Only for dental) */}
        {showPersonal && (
          <div className={cn(
            'bg-white rounded-2xl border p-5 shadow-sm',
            personalIsActive ? 'border-slate-200' : 'border-dashed border-slate-300'
          )}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center',
                  personalIsActive
                    ? 'bg-orange-100 text-orange-600'
                    : 'bg-slate-100 text-slate-400'
                )}>
                  {icons.userSmall}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Perfil Personal</h3>
                  <p className="text-sm text-slate-500">Marca personal del doctor</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                  personalIsActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    personalIsActive ? 'bg-emerald-500' : 'bg-slate-400'
                  )} />
                  {personalIsActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>

            {personalProfile ? (
              <>
                <p className="text-sm text-slate-500 mb-4">
                  Responde en redes sociales personales con delay para parecer humano.
                </p>
                <button
                  onClick={onEditPersonal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                >
                  {icons.edit}
                  <span>Editar configuración</span>
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 mb-4">
                  Activa este perfil para que el asistente responda en tus redes personales.
                </p>
                <button
                  onClick={onEditPersonal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <span>Activar perfil personal</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              {icons.messages}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">--</p>
          <p className="text-xs text-slate-500">Mensajes procesados</p>
          <p className="text-xs text-slate-400 mt-1">Últimos 7 días</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              {icons.checkCircle}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">--</p>
          <p className="text-xs text-slate-500">Resueltos sin escalar</p>
          <p className="text-xs text-slate-400 mt-1">Últimos 7 días</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              {icons.calendar}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">--</p>
          <p className="text-xs text-slate-500">Citas agendadas</p>
          <p className="text-xs text-slate-400 mt-1">Últimos 7 días</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              {icons.clock}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">--</p>
          <p className="text-xs text-slate-500">Tiempo promedio</p>
          <p className="text-xs text-slate-400 mt-1">De respuesta</p>
        </div>
      </div>

      {/* Preview Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-slate-900">Preview en vivo</h3>
              <p className="text-sm text-slate-500">Prueba tu asistente con datos reales de tu negocio</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Profile Selector */}
              {showPersonal && personalProfile && (
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => handleProfileChange('business')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      selectedProfile === 'business'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Negocio
                  </button>
                  <button
                    onClick={() => handleProfileChange('personal')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      selectedProfile === 'personal'
                        ? 'bg-white text-orange-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Personal
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Scenario Selector / Custom Toggle */}
          <div className="flex items-center gap-3">
            <select
              value={isCustomMode ? 'custom' : selectedScenario.id}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  handleToggleCustomMode();
                } else {
                  const scenario = PREVIEW_SCENARIOS.find(s => s.id === e.target.value);
                  if (scenario) handleScenarioChange(scenario);
                }
              }}
              aria-label="Seleccionar escenario de prueba"
              className="flex-1 px-3 py-2 bg-slate-100 border-0 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500"
            >
              {PREVIEW_SCENARIOS.map(scenario => (
                <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
              ))}
              <option value="custom">✏️ Mensaje personalizado</option>
            </select>
          </div>
        </div>

        {/* Chat Preview */}
        <div className="p-5 bg-gradient-to-b from-slate-50 to-white min-h-[280px]">
          {/* Customer Message */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
              {icons.userSmall}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 mb-1">Cliente</p>
              {isCustomMode ? (
                <div className="relative">
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Escribe tu mensaje de prueba..."
                    className="w-full px-4 py-3 bg-slate-100 rounded-2xl rounded-tl-sm text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[60px]"
                    rows={2}
                  />
                </div>
              ) : (
                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 inline-block">
                  <p className="text-sm text-slate-700">{selectedScenario.message}</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Response */}
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              selectedProfile === 'business'
                ? 'bg-purple-100 text-purple-600'
                : 'bg-orange-100 text-orange-600'
            )}>
              {icons.robot}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Asistente ({selectedProfile === 'business' ? 'Perfil Negocio' : 'Perfil Personal'})
              </p>

              <AnimatePresence mode="wait">
                {previewError ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-sm px-4 py-3 inline-block"
                  >
                    <p className="text-sm text-red-700">{previewError}</p>
                  </motion.div>
                ) : previewResponse ? (
                  <motion.div
                    key="response"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      'border rounded-2xl rounded-tl-sm px-4 py-3 inline-block max-w-full',
                      selectedProfile === 'business'
                        ? 'bg-purple-50 border-purple-100'
                        : 'bg-orange-50 border-orange-100'
                    )}
                  >
                    <p className={cn(
                      'text-sm whitespace-pre-wrap',
                      selectedProfile === 'business' ? 'text-purple-900' : 'text-orange-900'
                    )}>
                      {previewResponse}
                    </p>
                  </motion.div>
                ) : (
                  <motion.button
                    key="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleGeneratePreview}
                    disabled={isGeneratingPreview || (isCustomMode && !customMessage.trim())}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3 border rounded-2xl rounded-tl-sm text-sm font-medium transition-colors',
                      selectedProfile === 'business'
                        ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                        : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
                      (isGeneratingPreview || (isCustomMode && !customMessage.trim())) && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isGeneratingPreview ? (
                      <>
                        {icons.spinner}
                        <span>Generando con IA...</span>
                      </>
                    ) : (
                      <>
                        {icons.sparkles}
                        <span>Generar respuesta real</span>
                      </>
                    )}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Metadata Section */}
          <AnimatePresence>
            {previewMetadata && previewResponse && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-slate-100"
              >
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  {/* Intent Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Intención:</span>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      INTENT_LABELS[previewMetadata.intent]?.color || 'bg-slate-100 text-slate-600'
                    )}>
                      {INTENT_LABELS[previewMetadata.intent]?.label || previewMetadata.intent}
                    </span>
                  </div>

                  {/* Signals */}
                  {previewMetadata.signals.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Señales:</span>
                      <div className="flex gap-1">
                        {previewMetadata.signals.slice(0, 3).map((signal, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700"
                          >
                            {signal.signal} (+{signal.points})
                          </span>
                        ))}
                        {previewMetadata.signals.length > 3 && (
                          <span className="text-xs text-slate-500">
                            +{previewMetadata.signals.length - 3} más
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Technical Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>⏱️ {previewMetadata.processing_time_ms}ms</span>
                    <span>🤖 {previewMetadata.model_used}</span>
                    <span>📝 {previewMetadata.tokens_used} tokens</span>
                    {previewMetadata.prompt_from_cache && (
                      <span className="text-emerald-600">
                        ✓ Prompt v{previewMetadata.prompt_version || '?'} (caché)
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleGeneratePreview}
                    disabled={isGeneratingPreview}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {icons.refresh}
                    <span>Regenerar</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error retry */}
          {previewError && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleGeneratePreview}
                disabled={isGeneratingPreview}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {icons.refresh}
                <span>Reintentar</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-500 text-center">
            {previewMetadata?.prompt_from_cache
              ? '💡 Usando prompt optimizado de tu Knowledge Base y Agent Profile'
              : '💡 Configura tu Base de Conocimiento en "Business IA" para respuestas más precisas'
            }
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default ResumenTab;
