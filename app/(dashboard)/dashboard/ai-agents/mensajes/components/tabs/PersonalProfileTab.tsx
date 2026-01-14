// =====================================================
// TIS TIS PLATFORM - Personal Profile Tab (Agent Messages)
// Inline configuration for personal brand agent profile
// Design: Premium TIS TIS (Apple/Google aesthetics)
// Only available for dental vertical
// =====================================================

'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { AgentProfileWithChannels, AgentProfileInput } from '@/src/shared/types/agent-profiles';
import type { VerticalType, ResponseStyle } from '@/src/shared/config/agent-templates';
import {
  RESPONSE_STYLES,
  getTemplatesForVertical,
} from '@/src/shared/config/agent-templates';

// ======================
// ICONS
// ======================
const icons = {
  save: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  brain: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  user: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  link: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  // Iconos para tipos de asistente personal
  assistantFull: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  redirectOnly: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// ======================
// DELAY OPTIONS (Personal has longer delays)
// ======================
const PERSONAL_DELAY_OPTIONS = [
  { value: 3, label: '3 minutos', description: 'Delay corto' },
  { value: 5, label: '5 minutos', description: 'Delay natural' },
  { value: 8, label: '8 minutos', description: 'Más humano', recommended: true },
  { value: 15, label: '15 minutos', description: 'Muy ocupado' },
];

// ======================
// PERSONAL ASSISTANT TYPES
// ======================
interface PersonalAssistantType {
  key: string;
  name: string;
  description: string;
  capabilities: { text: string; enabled: boolean }[];
  recommended?: boolean;
  icon: 'assistantFull' | 'redirectOnly';
}

const PERSONAL_ASSISTANT_TYPES: PersonalAssistantType[] = [
  {
    key: 'personal_full',
    name: 'Asistente Personal',
    description: 'Responde consultas educativas, comparte tips y deriva servicios al negocio',
    capabilities: [
      { text: 'Tips educativos', enabled: true },
      { text: 'Engagement', enabled: true },
      { text: 'Citas', enabled: false },
      { text: 'Precios', enabled: false },
    ],
    recommended: true,
    icon: 'assistantFull',
  },
  {
    key: 'personal_redirect',
    name: 'Solo Derivación',
    description: 'Solo redirige al negocio, no responde consultas educativas',
    capabilities: [
      { text: 'Tips educativos', enabled: false },
      { text: 'Engagement', enabled: false },
      { text: 'Citas', enabled: false },
      { text: 'Precios', enabled: false },
    ],
    recommended: false,
    icon: 'redirectOnly',
  },
];

// ======================
// TYPES
// ======================
interface PersonalProfileTabProps {
  profile: AgentProfileWithChannels | null;
  vertical: VerticalType;
  tenantName?: string;
  isLoading?: boolean;
  onSave: (data: AgentProfileInput) => Promise<boolean>;
  onActivate: () => Promise<void>;
  onToggleActive: (isActive: boolean) => Promise<void>;
  isActivating?: boolean;
  isTogglingActive?: boolean;
}

// ======================
// COMPONENT
// ======================
export function PersonalProfileTab({
  profile,
  vertical,
  tenantName,
  isLoading,
  onSave,
  onActivate,
  onToggleActive,
  isActivating,
  isTogglingActive,
}: PersonalProfileTabProps) {
  // Helper: Map template key to assistant type
  const getAssistantTypeFromTemplate = useCallback((template: string): string => {
    if (template.includes('redirect')) return 'personal_redirect';
    return 'personal_full';
  }, []);

  // Helper: Get template key for vertical and type
  const getTemplateKeyForType = useCallback((type: string): string => {
    const prefix = vertical === 'dental' ? 'dental' : vertical === 'restaurant' ? 'resto' : 'general';
    return type === 'personal_redirect' ? `${prefix}_personal_redirect` : `${prefix}_personal_full`;
  }, [vertical]);

  // Form state
  const [profileName, setProfileName] = useState(profile?.profile_name || '');
  const [selectedTemplate, setSelectedTemplate] = useState(profile?.agent_template || '');
  const [assistantType, setAssistantType] = useState<string>(
    profile?.agent_template ? getAssistantTypeFromTemplate(profile.agent_template) : 'personal_full'
  );
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(profile?.response_style || 'professional_friendly');
  const [responseDelay, setResponseDelay] = useState(profile?.response_delay_minutes || 8);
  const [delayFirstOnly, setDelayFirstOnly] = useState(profile?.response_delay_first_only ?? true);
  const [aiLearningEnabled, setAiLearningEnabled] = useState(profile?.ai_learning_enabled ?? true);
  const [customInstructions, setCustomInstructions] = useState(profile?.custom_instructions_override || '');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const profileExists = !!profile;
  const isActive = profile?.is_active ?? false;

  // Get available templates for personal profile
  const availableTemplates = useMemo(
    () => getTemplatesForVertical(vertical, 'personal'),
    [vertical]
  );

  // Sync state when profile changes (e.g., after save or external update)
  useEffect(() => {
    if (profile) {
      setProfileName(profile.profile_name || '');
      setSelectedTemplate(profile.agent_template || '');
      setAssistantType(getAssistantTypeFromTemplate(profile.agent_template || ''));
      setResponseStyle(profile.response_style || 'professional_friendly');
      setResponseDelay(profile.response_delay_minutes || 8);
      setDelayFirstOnly(profile.response_delay_first_only ?? true);
      setAiLearningEnabled(profile.ai_learning_enabled ?? true);
      setCustomInstructions(profile.custom_instructions_override || '');
      setHasChanges(false);
    }
  }, [profile, getAssistantTypeFromTemplate]);

  // Set default template if none selected and templates are available
  useEffect(() => {
    if (!selectedTemplate && availableTemplates.length > 0) {
      setSelectedTemplate(availableTemplates[0].key);
    }
  }, [selectedTemplate, availableTemplates]);

  // Mark changes
  const markChange = useCallback(() => {
    setHasChanges(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  // Handle assistant type change
  const handleAssistantTypeChange = useCallback((type: string) => {
    setAssistantType(type);
    // Update template based on type and vertical
    const newTemplate = getTemplateKeyForType(type);
    setSelectedTemplate(newTemplate);
    markChange();
  }, [getTemplateKeyForType, markChange]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // Get the correct template based on selected type
    const templateToSave = getTemplateKeyForType(assistantType);

    const data: AgentProfileInput = {
      profile_name: profileName || 'Perfil Personal',
      agent_template: templateToSave,
      response_style: responseStyle,
      response_delay_minutes: responseDelay,
      response_delay_first_only: delayFirstOnly,
      ai_learning_enabled: aiLearningEnabled,
      custom_instructions_override: customInstructions || undefined,
    };

    try {
      const success = await onSave(data);
      if (success) {
        setSaveSuccess(true);
        setHasChanges(false);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError('No se pudo guardar. Intenta de nuevo.');
      }
    } catch (err) {
      setSaveError('Error al guardar. Verifica tu conexión.');
    } finally {
      setIsSaving(false);
    }
  }, [profileName, assistantType, getTemplateKeyForType, responseStyle, responseDelay, delayFirstOnly, aiLearningEnabled, customInstructions, onSave]);

  // Handle toggle active
  const handleToggle = useCallback(async () => {
    await onToggleActive(!isActive);
  }, [isActive, onToggleActive]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-100 rounded-2xl" />
        <div className="h-40 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  // If profile doesn't exist, show activation card
  if (!profileExists) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl p-8 border border-orange-100 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 flex items-center justify-center mx-auto mb-4 text-white">
            {icons.user}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Perfil Personal</h2>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Activa este perfil para que el asistente responda en tus redes sociales personales.
            Ideal para doctores que quieren manejar su marca personal sin mezclar con la clínica.
          </p>

          <button
            onClick={onActivate}
            disabled={isActivating}
            className={cn(
              'px-6 py-3 rounded-xl font-medium transition-all',
              isActivating
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30'
            )}
          >
            {isActivating ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Activando...
              </span>
            ) : (
              'Activar perfil personal'
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-orange-100">
            <h4 className="font-medium text-slate-800 mb-3">¿Qué incluye?</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">{icons.clock}</span>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Delay inteligente</p>
                  <p className="text-xs text-slate-500">Simula respuesta humana</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">{icons.link}</span>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Deriva a la clínica</p>
                  <p className="text-xs text-slate-500">No mezcla consultas</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">{icons.sparkles}</span>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Tono personal</p>
                  <p className="text-xs text-slate-500">Estilo único del doctor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with toggle */}
      <div className="bg-gradient-to-r from-orange-500 via-pink-500 to-rose-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              {icons.user}
            </div>
            <div>
              <h2 className="text-xl font-bold">Perfil Personal</h2>
              <p className="text-white/80 text-sm">
                {vertical === 'dental' ? 'Marca personal del doctor' :
                 vertical === 'restaurant' ? 'Marca personal del chef' :
                 'Marca personal del profesional'}
              </p>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80">{isActive ? 'Activo' : 'Inactivo'}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={handleToggle}
                disabled={isTogglingActive}
                className="sr-only peer"
              />
              <div className={cn(
                'w-11 h-6 rounded-full peer transition-colors',
                isActive ? 'bg-white' : 'bg-white/30',
                isTogglingActive && 'opacity-50 cursor-not-allowed'
              )}>
                <div className={cn(
                  'absolute top-[2px] w-5 h-5 rounded-full transition-all',
                  isActive
                    ? 'left-[22px] bg-orange-500'
                    : 'left-[2px] bg-white/80'
                )} />
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Assistant Type Selection */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Tipo de asistente
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAL_ASSISTANT_TYPES.map((type) => (
            <button
              key={type.key}
              onClick={() => handleAssistantTypeChange(type.key)}
              className={cn(
                'relative p-4 rounded-xl border-2 text-left transition-all',
                assistantType === type.key
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              {/* Recommended badge */}
              {type.recommended && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-medium rounded-full">
                  Recomendado
                </span>
              )}

              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  assistantType === type.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-600'
                )}>
                  {icons[type.icon]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900">{type.name}</div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{type.description}</p>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {type.capabilities.map((cap, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                          cap.enabled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-400'
                        )}
                      >
                        {cap.enabled ? icons.check : icons.x}
                        {cap.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected indicator */}
              {assistantType === type.key && (
                <div className="absolute top-4 right-4">
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white">
                    {icons.check}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Profile Name */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Nombre del perfil
        </label>
        <input
          type="text"
          value={profileName}
          onChange={(e) => { setProfileName(e.target.value); markChange(); }}
          placeholder="Ej: Dr. García"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
        />
        <p className="mt-2 text-xs text-slate-500">
          Este nombre representa tu marca personal
        </p>
      </div>

      {/* Response Style */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Estilo de respuesta
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {RESPONSE_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => { setResponseStyle(style.value); markChange(); }}
              className={cn(
                'p-3 rounded-xl border-2 text-center transition-all',
                responseStyle === style.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="font-medium text-slate-900 text-sm">{style.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{style.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Response Delay */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          {icons.clock}
          <label className="text-sm font-medium text-slate-700">Delay de respuesta</label>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Simula tiempo de escritura humano para que no parezca un bot
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PERSONAL_DELAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { setResponseDelay(option.value); markChange(); }}
              className={cn(
                'p-3 rounded-xl border-2 text-center transition-all',
                responseDelay === option.value
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="font-medium text-slate-900">{option.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{option.description}</div>
              {option.recommended && (
                <div className="mt-1">
                  <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">
                    Recomendado
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* First message only toggle */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={delayFirstOnly}
              onChange={(e) => { setDelayFirstOnly(e.target.checked); markChange(); }}
              className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
            />
            <div>
              <span className="text-sm font-medium text-slate-700">Solo aplicar delay en primer mensaje</span>
              <p className="text-xs text-slate-500">Los siguientes mensajes en la conversación responden más rápido</p>
            </div>
          </label>
        </div>
      </div>

      {/* Advanced Settings (Collapsible) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Configuración avanzada</span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Opcional</span>
          </div>
          <motion.span
            animate={{ rotate: showAdvanced ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            {icons.chevronDown}
          </motion.span>
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-5 border-t border-slate-100">
                {/* AI Learning Toggle */}
                <div className="pt-5">
                  <div className="flex items-start justify-between gap-4 p-4 bg-orange-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="text-orange-600 mt-0.5">{icons.brain}</div>
                      <div>
                        <h4 className="font-medium text-slate-900">AI Learning</h4>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Permite que el asistente aprenda de las interacciones.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={aiLearningEnabled}
                        onChange={(e) => { setAiLearningEnabled(e.target.checked); markChange(); }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                </div>

                {/* Custom Instructions */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {icons.sparkles}
                    <label className="text-sm font-medium text-slate-700">
                      Instrucciones adicionales
                    </label>
                  </div>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => { setCustomInstructions(e.target.value); markChange(); }}
                    placeholder="Agrega instrucciones para tu perfil personal...&#10;&#10;Ejemplo: Cuando pregunten por citas, menciona que atiendo en Clínica Sonrisa los martes y jueves."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-emerald-600 font-medium flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Cambios guardados
            </motion.span>
          )}
          {saveError && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-red-600"
            >
              {saveError}
            </motion.span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className={cn(
            'px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all',
            hasChanges
              ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          )}
        >
          {isSaving ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Guardando...</span>
            </>
          ) : (
            <>
              {icons.save}
              <span>Guardar cambios</span>
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default PersonalProfileTab;
