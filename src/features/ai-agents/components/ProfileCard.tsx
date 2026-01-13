// =====================================================
// TIS TIS PLATFORM - Agent Profile Card Component
// Tarjeta de perfil de agente de IA
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { AgentProfileWithChannels } from '@/src/shared/types/agent-profiles';
import type { ProfileType } from '@/src/shared/config/agent-templates';
import { RESPONSE_STYLES, getTemplate } from '@/src/shared/config/agent-templates';

// ======================
// ICONS
// ======================

const icons = {
  business: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  personal: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  brain: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
};

// ======================
// CHANNEL ICON MAP
// ======================

const channelIcons: Record<string, JSX.Element> = {
  whatsapp: icons.whatsapp,
  instagram: icons.instagram,
  messenger: icons.messenger,
  webchat: icons.messenger,
  tiktok: icons.instagram,
};

const channelColors: Record<string, string> = {
  whatsapp: 'text-green-600 bg-green-50',
  instagram: 'text-pink-600 bg-pink-50',
  messenger: 'text-blue-600 bg-blue-50',
  webchat: 'text-purple-600 bg-purple-50',
  tiktok: 'text-gray-800 bg-gray-100',
};

// ======================
// TYPES
// ======================

interface ProfileCardProps {
  profile: AgentProfileWithChannels | null;
  profileType: ProfileType;
  vertical: string;
  tenantName?: string;
  isLoading?: boolean;
  isActivating?: boolean;
  isTogglingActive?: boolean;
  onConfigure: () => void;
  onActivate?: () => void;
  onToggleActive?: (isActive: boolean) => void;
}

// ======================
// COMPONENT
// ======================

export function ProfileCard({
  profile,
  profileType,
  vertical,
  tenantName,
  isLoading,
  isActivating,
  isTogglingActive,
  onConfigure,
  onActivate,
  onToggleActive,
}: ProfileCardProps) {
  const isBusiness = profileType === 'business';
  const isActive = profile?.is_active ?? false;

  // Get template info
  const template = profile?.agent_template ? getTemplate(profile.agent_template) : null;
  const responseStyle = RESPONSE_STYLES.find(s => s.value === profile?.response_style);

  // Render empty state for personal profile that doesn't exist
  if (!profile && profileType === 'personal') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
              {icons.personal}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Perfil Personal</h3>
              <p className="text-sm text-gray-500">Para tu marca personal</p>
            </div>
          </div>
          <span className="px-2 py-1 text-xs font-medium text-gray-400 bg-gray-100 rounded-full">
            Inactivo
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Usa este perfil para las redes sociales personales del doctor o dueño del negocio.
          El asistente derivará consultas al perfil de negocio.
        </p>

        <button
          onClick={onActivate}
          disabled={isActivating}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-xl transition-colors',
            isActivating
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
          )}
        >
          {isActivating ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Activando...</span>
            </>
          ) : (
            <>
              {icons.plus}
              <span>Activar Perfil Personal</span>
            </>
          )}
        </button>
      </motion.div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-3/4 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-2xl border p-6 transition-all hover:shadow-lg',
        isActive ? 'border-gray-100 shadow-sm' : 'border-gray-200 opacity-75'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            isBusiness
              ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
              : 'bg-gradient-to-br from-orange-400 to-pink-500 text-white'
          )}>
            {isBusiness ? icons.business : icons.personal}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {isBusiness ? 'Perfil de Negocio' : 'Perfil Personal'}
            </h3>
            <p className="text-sm text-gray-500">
              {profile?.profile_name || tenantName || 'Sin nombre'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Switch (only for personal profile) */}
          {!isBusiness && onToggleActive && (
            <button
              onClick={() => onToggleActive(!isActive)}
              disabled={isTogglingActive}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: isActive ? '#22c55e' : '#d1d5db',
              }}
              aria-label={isActive ? 'Desactivar perfil' : 'Activar perfil'}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
                  isActive ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          )}

          <span className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1',
            isActive
              ? 'text-green-700 bg-green-50'
              : 'text-gray-500 bg-gray-100'
          )}>
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              isActive ? 'bg-green-500' : 'bg-gray-400'
            )} />
            {isActive ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {/* Template & Style Info */}
      {template ? (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{template.icon}</span>
            <span className="font-medium text-gray-900 text-sm">{template.name}</span>
          </div>
          <p className="text-xs text-gray-500">{template.description}</p>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <div className="flex items-center gap-2 text-amber-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">Sin configurar</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Haz clic en "Configurar Perfil" para seleccionar un tipo de asistente
          </p>
        </div>
      )}

      {/* Messaging Channels */}
      {profile?.channels && profile.channels.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Canales conectados</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.channels.filter(c => c.is_connected).map((channel, idx) => (
              <div
                key={`${channel.channel_type}-${idx}`}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                  channelColors[channel.channel_type] || 'text-gray-600 bg-gray-100'
                )}
              >
                {channelIcons[channel.channel_type]}
                <span className="capitalize">{channel.channel_type}</span>
                {channel.channel_identifier && (
                  <span className="text-gray-400 font-normal truncate max-w-[100px]">
                    {channel.channel_identifier}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice Agent (only for business) */}
      {isBusiness && profile?.voice_config && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
            {icons.phone}
            <span>Asistente de Voz</span>
          </div>
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            profile.voice_config.enabled
              ? 'bg-purple-50 text-purple-700'
              : 'bg-gray-100 text-gray-500'
          )}>
            {profile.voice_config.enabled ? (
              <>
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-sm font-medium">
                  {profile.voice_config.assistant_name || 'Voz activa'}
                </span>
                {profile.voice_config.phone_number && (
                  <span className="text-xs text-purple-500">
                    {profile.voice_config.phone_number}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm">No configurado</span>
            )}
          </div>
        </div>
      )}

      {/* Response Delay (for personal profile) */}
      {!isBusiness && (profile?.response_delay_minutes ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          {icons.clock}
          <span>
            Delay de respuesta: <strong>{profile.response_delay_minutes} min</strong>
            {profile.response_delay_first_only && ' (solo primera vez)'}
          </span>
        </div>
      )}

      {/* AI Learning */}
      {profile?.ai_learning_enabled && (
        <div className="mb-4 flex items-center gap-2 text-sm text-blue-600">
          {icons.brain}
          <span>AI Learning activado</span>
        </div>
      )}

      {/* Response Style */}
      {responseStyle && (
        <div className="mb-4 text-xs text-gray-500">
          Estilo: <span className="font-medium text-gray-700">{responseStyle.label}</span>
          {' - '}{responseStyle.description}
        </div>
      )}

      {/* Configure Button */}
      <button
        onClick={onConfigure}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-xl transition-all',
          isBusiness
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25'
            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25'
        )}
      >
        {icons.settings}
        <span>Configurar Perfil</span>
      </button>
    </motion.div>
  );
}

export default ProfileCard;
