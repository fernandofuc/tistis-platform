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

// ======================
// ICONS
// ======================
const icons = {
  messages: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  instagram: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  messenger: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259 6.559-6.963 3.13 3.259 5.889-3.259-6.559 6.963z"/>
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  robot: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

// ======================
// CHANNEL ICONS MAP
// ======================
const channelIcons: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  whatsapp: { icon: icons.whatsapp, color: 'text-green-600', bg: 'bg-green-50' },
  instagram: { icon: icons.instagram, color: 'text-pink-600', bg: 'bg-pink-50' },
  messenger: { icon: icons.messenger, color: 'text-blue-600', bg: 'bg-blue-50' },
  tiktok: { icon: icons.instagram, color: 'text-gray-800', bg: 'bg-gray-100' },
};

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
// PREVIEW SCENARIOS
// ======================
const PREVIEW_SCENARIOS = [
  { id: 'price', label: 'Consulta de precio', message: 'Hola, cuanto cuesta una limpieza dental?' },
  { id: 'appointment', label: 'Agendar cita', message: 'Quiero agendar una cita para manana' },
  { id: 'location', label: 'Ubicacion', message: 'Donde estan ubicados?' },
  { id: 'hours', label: 'Horarios', message: 'A que hora abren?' },
];

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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
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
                  const channelInfo = channelIcons[channel.channel_type] || channelIcons.whatsapp;
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
                      <span className="capitalize">{channel.channel_type}</span>
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
              <span>Estilo: <strong className="text-slate-700">{businessProfile.response_style === 'professional_friendly' ? 'Profesional Calido' : businessProfile.response_style}</strong></span>
              <span>Delay: <strong className="text-slate-700">{businessProfile.response_delay_minutes === 0 ? 'Inmediato' : `${businessProfile.response_delay_minutes} min`}</strong></span>
            </div>
          )}

          <button
            onClick={onEditBusiness}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            {icons.edit}
            <span>Editar configuracion</span>
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
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
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
                  <span>Editar configuracion</span>
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
          <p className="text-xs text-slate-400 mt-1">Ultimos 7 dias</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              {icons.check}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">--</p>
          <p className="text-xs text-slate-500">Resueltos sin escalar</p>
          <p className="text-xs text-slate-400 mt-1">Ultimos 7 dias</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              {icons.calendar}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">--</p>
          <p className="text-xs text-slate-500">Citas agendadas</p>
          <p className="text-xs text-slate-400 mt-1">Ultimos 7 dias</p>
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
            <p className="text-sm text-slate-500">Simula como responde tu asistente</p>
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
              {icons.user}
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
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
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
