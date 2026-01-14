// =====================================================
// TIS TIS PLATFORM - Business Profile Tab (Agent Messages)
// Inline configuration for business agent profile
// Design: Premium TIS TIS (Apple/Google aesthetics)
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
  info: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ======================
// CAPABILITY LABELS
// ======================
const capabilityLabels: Record<string, string> = {
  booking: 'Citas',
  pricing: 'Precios',
  faq: 'FAQ',
  lead_capture: 'Leads',
  objections: 'Objeciones',
  location: 'Ubicación',
  hours: 'Horarios',
  reservations: 'Reservas',
  ordering: 'Pedidos',
  menu_info: 'Menú',
  redirect_to_clinic: 'Derivar',
  redirect_to_business: 'Derivar',
  basic_info: 'Info',
};

// ======================
// DELAY OPTIONS
// ======================
const DELAY_OPTIONS = [
  { value: 0, label: 'Inmediato', description: 'Responde al instante' },
  { value: 1, label: '1 minuto', description: 'Delay corto' },
  { value: 3, label: '3 minutos', description: 'Delay moderado' },
  { value: 5, label: '5 minutos', description: 'Delay natural' },
];

// ======================
// TYPES
// ======================
interface BusinessProfileTabProps {
  profile: AgentProfileWithChannels | null;
  vertical: VerticalType;
  tenantName?: string;
  isLoading?: boolean;
  onSave: (data: AgentProfileInput) => Promise<boolean>;
}

// ======================
// COMPONENT
// ======================
export function BusinessProfileTab({
  profile,
  vertical,
  tenantName,
  isLoading,
  onSave,
}: BusinessProfileTabProps) {
  // Form state
  const [profileName, setProfileName] = useState(profile?.profile_name || tenantName || '');
  const [selectedTemplate, setSelectedTemplate] = useState(profile?.agent_template || '');
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>(profile?.response_style || 'professional_friendly');
  const [responseDelay, setResponseDelay] = useState(profile?.response_delay_minutes || 0);
  const [aiLearningEnabled, setAiLearningEnabled] = useState(profile?.ai_learning_enabled ?? true);
  const [customInstructions, setCustomInstructions] = useState(profile?.custom_instructions_override || '');

  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Get available templates for this vertical
  const availableTemplates = useMemo(
    () => getTemplatesForVertical(vertical, 'business'),
    [vertical]
  );

  // Sync state when profile changes (e.g., after save or external update)
  useEffect(() => {
    if (profile) {
      setProfileName(profile.profile_name || tenantName || '');
      setSelectedTemplate(profile.agent_template || '');
      setResponseStyle(profile.response_style || 'professional_friendly');
      setResponseDelay(profile.response_delay_minutes || 0);
      setAiLearningEnabled(profile.ai_learning_enabled ?? true);
      setCustomInstructions(profile.custom_instructions_override || '');
      setHasChanges(false);
    }
  }, [profile, tenantName]);

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

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const data: AgentProfileInput = {
      profile_name: profileName || tenantName || 'Mi Negocio',
      agent_template: selectedTemplate,
      response_style: responseStyle,
      response_delay_minutes: responseDelay,
      ai_learning_enabled: aiLearningEnabled,
      custom_instructions_override: customInstructions || undefined,
      is_active: true,
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
  }, [profileName, tenantName, selectedTemplate, responseStyle, responseDelay, aiLearningEnabled, customInstructions, onSave]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-slate-100 rounded-2xl" />
        <div className="h-40 bg-slate-100 rounded-2xl" />
        <div className="h-32 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with status */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">Perfil de Negocio</h2>
              <p className="text-white/80 text-sm">Configura cómo responde tu asistente</p>
            </div>
          </div>
          <div className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5',
            profile?.is_active
              ? 'bg-emerald-400/20 text-emerald-100'
              : 'bg-white/20 text-white/80'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full',
              profile?.is_active ? 'bg-emerald-400' : 'bg-white/50'
            )} />
            {profile?.is_active ? 'Activo' : 'Inactivo'}
          </div>
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
          placeholder="Ej: Clínica Dental Sonrisa"
          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        />
        <p className="mt-2 text-xs text-slate-500">
          Este nombre identifica tu perfil y puede usarse en los saludos
        </p>
      </div>

      {/* Template Selection */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Tipo de asistente
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableTemplates.map((template) => (
            <button
              key={template.key}
              onClick={() => { setSelectedTemplate(template.key); markChange(); }}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                selectedTemplate === template.key
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{template.name}</span>
                    {template.isDefault && (
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {template.capabilities.slice(0, 4).map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
                      >
                        {capabilityLabels[cap] || cap}
                      </span>
                    ))}
                    {template.capabilities.length > 4 && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                        +{template.capabilities.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
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
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="font-medium text-slate-900 text-sm">{style.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{style.description}</div>
              {style.recommended && (
                <div className="mt-1">
                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                    Recomendado
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Example response for selected style */}
        {responseStyle && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1">Ejemplo de respuesta:</p>
            <p className="text-sm text-slate-700 italic">
              {RESPONSE_STYLES.find(s => s.value === responseStyle)?.example}
            </p>
          </div>
        )}
      </div>

      {/* Response Delay */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          {icons.clock}
          <label className="text-sm font-medium text-slate-700">Tiempo de respuesta</label>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DELAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { setResponseDelay(option.value); markChange(); }}
              className={cn(
                'p-3 rounded-xl border-2 text-center transition-all',
                responseDelay === option.value
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="font-medium text-slate-900">{option.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{option.description}</div>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5">
          <span className="text-slate-400 mt-0.5">{icons.info}</span>
          <span>
            Para perfiles de negocio se recomienda respuesta inmediata. El delay simula un tiempo de escritura humano.
          </span>
        </p>
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
                  <div className="flex items-start justify-between gap-4 p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="text-blue-600 mt-0.5">{icons.brain}</div>
                      <div>
                        <h4 className="font-medium text-slate-900">AI Learning</h4>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Permite que el asistente aprenda de las interacciones para mejorar sus respuestas.
                          No aprende vocabulario inapropiado.
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
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                    placeholder="Agrega instrucciones específicas para este perfil... (opcional)&#10;&#10;Ejemplo: Siempre menciona que tenemos estacionamiento gratuito."
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Estas instrucciones se agregan a las instrucciones base de la plantilla seleccionada
                  </p>
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
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30'
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

export default BusinessProfileTab;
