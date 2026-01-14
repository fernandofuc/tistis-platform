// =====================================================
// TIS TIS PLATFORM - Resumen Tab (Agent Messages)
// Overview tab showing agent status, metrics, and preview
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
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
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewResponse, setPreviewResponse] = useState<string | null>(null);

  const showPersonal = vertical === 'dental';
  const businessIsActive = businessProfile?.is_active ?? false;
  const personalIsActive = personalProfile?.is_active ?? false;

  // Get connected channels for business profile
  const connectedChannels = businessProfile?.channels?.filter(c => c.is_connected) || [];

  // Simulate preview generation (will be replaced with actual API call)
  const handleGeneratePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate a sample response based on scenario
    const responses: Record<string, string> = {
      price: `Hola! Con gusto te informo. La limpieza dental tiene un costo de $800 MXN e incluye profilaxis completa y revision con el especialista. Tenemos disponibilidad esta semana, te gustaria agendar una cita?`,
      appointment: `Perfecto! Con gusto te ayudo a agendar. Tenemos disponibilidad manana por la tarde a las 4:00pm o 5:30pm. Cual horario te funciona mejor?`,
      location: `Nuestra clinica principal esta en Av. Presidente Masaryk 123, Col. Polanco. Contamos con estacionamiento gratuito. Te comparto la ubicacion exacta para que puedas llegar facilmente.`,
      hours: `Nuestros horarios de atencion son: Lunes a Viernes de 9:00am a 7:00pm, y Sabados de 9:00am a 2:00pm. Te gustaria agendar una cita?`,
    };

    setPreviewResponse(responses[selectedScenario.id] || responses.price);
    setIsGeneratingPreview(false);
  }, [selectedScenario]);

  // Generate preview on scenario change
  const handleScenarioChange = useCallback((scenario: typeof PREVIEW_SCENARIOS[0]) => {
    setSelectedScenario(scenario);
    setPreviewResponse(null);
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
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Preview en vivo</h3>
            <p className="text-sm text-slate-500">Simula cómo responde tu asistente</p>
          </div>
          <select
            value={selectedScenario.id}
            onChange={(e) => {
              const scenario = PREVIEW_SCENARIOS.find(s => s.id === e.target.value);
              if (scenario) handleScenarioChange(scenario);
            }}
            aria-label="Seleccionar escenario de prueba"
            className="px-3 py-2 bg-slate-100 border-0 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-purple-500"
          >
            {PREVIEW_SCENARIOS.map(scenario => (
              <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
            ))}
          </select>
        </div>

        <div className="p-5 bg-gradient-to-b from-slate-50 to-white">
          {/* Customer Message */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
              {icons.userSmall}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 mb-1">Cliente</p>
              <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 inline-block">
                <p className="text-sm text-slate-700">{selectedScenario.message}</p>
              </div>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
              {icons.robot}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 mb-1">Asistente (Perfil Negocio)</p>
              {previewResponse ? (
                <div className="bg-purple-50 border border-purple-100 rounded-2xl rounded-tl-sm px-4 py-3 inline-block">
                  <p className="text-sm text-purple-900">{previewResponse}</p>
                </div>
              ) : (
                <button
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-2xl rounded-tl-sm text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors',
                    isGeneratingPreview && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isGeneratingPreview ? (
                    <>
                      {icons.spinner}
                      <span>Generando respuesta...</span>
                    </>
                  ) : (
                    <>
                      {icons.refresh}
                      <span>Generar respuesta de ejemplo</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {previewResponse && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={handleGeneratePreview}
                disabled={isGeneratingPreview}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {icons.refresh}
                <span>Regenerar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default ResumenTab;
