// =====================================================
// TIS TIS PLATFORM - Resumen Tab (Agent Messages)
// Overview tab showing agent status, metrics, and preview
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { AgentProfileWithChannels } from '@/src/shared/types/agent-profiles';

// Shared imports from centralized modules
import { icons, channelIconsConfig, LivePreviewChat } from '../shared';

// ======================
// AI MODEL CONFIG
// ======================
const AI_MODEL_NAME = 'GPT-5 Mini';

// ======================
// TOGGLE SWITCH COMPONENT - Professional Style (Matches Loyalty Page)
// ======================
interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}

function ToggleSwitch({ enabled, onToggle, loading }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
        enabled ? 'bg-tis-coral' : 'bg-slate-200',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ======================
// AI AGENT TOGGLE CARD COMPONENT - Premium Design
// ======================
interface AIAgentToggleCardProps {
  aiEnabled: boolean;
  onToggle: () => void;
  loading?: boolean;
}

function AIAgentToggleCard({ aiEnabled, onToggle, loading }: AIAgentToggleCardProps) {
  return (
    <div className={cn(
      'relative rounded-2xl border p-5 transition-all duration-200',
      aiEnabled
        ? 'border-slate-200 bg-white shadow-sm'
        : 'border-slate-200/80 bg-slate-50/50'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all',
            aiEnabled
              ? 'bg-slate-900 text-white'
              : 'bg-slate-200 text-slate-400'
          )}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">AI Agent</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {aiEnabled
                ? `Usando ${AI_MODEL_NAME} para mensajería`
                : 'Las conversaciones serán atendidas manualmente'}
            </p>
            <div className="mt-2.5">
              <span className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
                aiEnabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              )}>
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  aiEnabled ? 'bg-emerald-500' : 'bg-slate-400'
                )} />
                {aiEnabled ? 'Activo' : 'Desactivado'}
              </span>
            </div>
          </div>
        </div>
        <ToggleSwitch enabled={aiEnabled} onToggle={onToggle} loading={loading} />
      </div>
    </div>
  );
}

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
  // AI Agent Toggle props
  aiEnabled?: boolean;
  aiToggleLoading?: boolean;
  onToggleAI?: () => void;
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
  // AI Agent Toggle props
  aiEnabled = true,
  aiToggleLoading = false,
  onToggleAI,
}: ResumenTabProps) {
  const showPersonal = vertical === 'dental';
  const businessIsActive = businessProfile?.is_active ?? false;
  const personalIsActive = personalProfile?.is_active ?? false;

  // Get connected channels for business profile
  const connectedChannels = businessProfile?.channels?.filter(c => c.is_connected) || [];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* AI Agent Toggle skeleton */}
        <div className="h-24 bg-slate-100 rounded-2xl" />
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
      {/* AI Agent Toggle Card - Professional Design matching Loyalty Program */}
      {onToggleAI && (
        <AIAgentToggleCard
          aiEnabled={aiEnabled}
          onToggle={onToggleAI}
          loading={aiToggleLoading}
        />
      )}

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
            <p className="text-xs font-medium text-slate-500 mb-2">Canales asignados a este perfil</p>
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
                      title={channel.account_name || channelInfo.name}
                    >
                      {channelInfo.icon}
                      <span className="capitalize">
                        {channel.account_name || channelInfo.name}
                        {channel.account_number === 2 && ' (2)'}
                      </span>
                      {channel.is_connected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Sin canales asignados — Configura en Settings {'>'} Canales
                </span>
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
                {/* Canales asignados al perfil personal */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Canales asignados</p>
                  <div className="flex flex-wrap gap-2">
                    {(personalProfile.channels?.filter(c => c.is_connected) || []).length > 0 ? (
                      personalProfile.channels?.filter(c => c.is_connected).map((channel, idx) => {
                        const channelInfo = channelIconsConfig[channel.channel_type] || channelIconsConfig.instagram;
                        return (
                          <span
                            key={`personal-${channel.channel_type}-${channel.account_number}-${idx}`}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                              channelInfo.bg,
                              channelInfo.color
                            )}
                            title={channel.account_name || channelInfo.name}
                          >
                            {channelInfo.icon}
                            <span className="capitalize">
                              {channel.account_name || channelInfo.name}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Sin canales asignados — Configura en Settings {'>'} Canales
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Info Personal */}
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                  <span>Estilo: <strong className="text-slate-700">{personalProfile.response_style === 'professional_friendly' ? 'Profesional Cálido' : personalProfile.response_style}</strong></span>
                  <span>Delay: <strong className="text-slate-700">{personalProfile.response_delay_minutes === 0 ? 'Inmediato' : `${personalProfile.response_delay_minutes} min`}</strong></span>
                </div>

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

      {/* Preview Section - New LivePreviewChat Component */}
      <LivePreviewChat
        tenantName={tenantName}
        vertical={vertical}
        businessProfile={businessProfile ? {
          is_active: businessProfile.is_active,
          response_delay_minutes: businessProfile.response_delay_minutes,
          response_style: businessProfile.response_style,
        } : null}
        personalProfile={personalProfile ? {
          is_active: personalProfile.is_active,
          response_delay_minutes: personalProfile.response_delay_minutes,
          response_style: personalProfile.response_style,
        } : null}
        colorScheme="purple"
      />
    </motion.div>
  );
}

export default ResumenTab;
