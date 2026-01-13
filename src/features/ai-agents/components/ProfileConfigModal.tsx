// =====================================================
// TIS TIS PLATFORM - Profile Configuration Modal
// Modal para configurar perfiles de agentes de IA
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type {
  AgentProfile,
  AgentProfileInput,
  AgentProfileWithChannels,
} from '@/src/shared/types/agent-profiles';
import type { ProfileType, VerticalType, ResponseStyle } from '@/src/shared/config/agent-templates';
import {
  RESPONSE_STYLES,
  getTemplatesForVertical,
} from '@/src/shared/config/agent-templates';

// ======================
// ICONS
// ======================

// Traducción de capabilities al español
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

const icons = {
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  brain: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================

interface ProfileConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: AgentProfile | AgentProfileWithChannels | null;
  profileType: ProfileType;
  vertical: VerticalType;
  onSave: (data: AgentProfileInput) => Promise<boolean>;
  isSaving?: boolean;
}

type ConfigStep = 'template' | 'style' | 'advanced';

// ======================
// COMPONENT
// ======================

export function ProfileConfigModal({
  isOpen,
  onClose,
  profile,
  profileType,
  vertical,
  onSave,
  isSaving = false,
}: ProfileConfigModalProps) {
  const isBusiness = profileType === 'business';

  // Form state
  const [currentStep, setCurrentStep] = useState<ConfigStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [profileName, setProfileName] = useState('');
  const [responseStyle, setResponseStyle] = useState<ResponseStyle>('professional_friendly');
  const [responseDelayMinutes, setResponseDelayMinutes] = useState(0);
  const [responseDelayFirstOnly, setResponseDelayFirstOnly] = useState(true);
  const [aiLearningEnabled, setAiLearningEnabled] = useState(true);
  const [customInstructions, setCustomInstructions] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Memoize templates to prevent infinite loop in useEffect
  const availableTemplates = useMemo(
    () => getTemplatesForVertical(vertical, profileType),
    [vertical, profileType]
  );

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Initialize form with profile data
  useEffect(() => {
    if (!isOpen) return;

    if (profile) {
      setSelectedTemplate(profile.agent_template || '');
      setProfileName(profile.profile_name || '');
      setResponseStyle(profile.response_style || 'professional_friendly');
      setResponseDelayMinutes(profile.response_delay_minutes || 0);
      setResponseDelayFirstOnly(profile.response_delay_first_only ?? true);
      setAiLearningEnabled(profile.ai_learning_enabled ?? true);
      setCustomInstructions(profile.custom_instructions_override || '');
    } else {
      // Defaults for new profile
      setSelectedTemplate(availableTemplates[0]?.key || '');
      setProfileName('');
      setResponseStyle('professional_friendly');
      setResponseDelayMinutes(isBusiness ? 0 : 8);
      setResponseDelayFirstOnly(true);
      setAiLearningEnabled(true);
      setCustomInstructions('');
    }
    setCurrentStep('template');
  }, [isOpen, profile, availableTemplates, isBusiness]);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaveError(null);

    const data: AgentProfileInput = {
      profile_name: profileName || `Mi ${isBusiness ? 'Negocio' : 'Perfil Personal'}`,
      agent_template: selectedTemplate,
      response_style: responseStyle,
      response_delay_minutes: responseDelayMinutes,
      response_delay_first_only: responseDelayFirstOnly,
      ai_learning_enabled: aiLearningEnabled,
      custom_instructions_override: customInstructions || undefined,
    };

    try {
      const success = await onSave(data);
      if (success) {
        onClose();
      } else {
        setSaveError('No se pudo guardar el perfil. Intenta de nuevo.');
      }
    } catch (err) {
      setSaveError('Error al guardar. Verifica tu conexión e intenta de nuevo.');
    }
  }, [
    profileName,
    selectedTemplate,
    responseStyle,
    responseDelayMinutes,
    responseDelayFirstOnly,
    aiLearningEnabled,
    customInstructions,
    isBusiness,
    onSave,
    onClose,
  ]);

  // Step navigation
  const steps: { key: ConfigStep; label: string }[] = [
    { key: 'template', label: 'Tipo de Asistente' },
    { key: 'style', label: 'Personalización' },
    { key: 'advanced', label: 'Avanzado' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const isLastStep = currentStepIndex === steps.length - 1;

  const goNext = () => {
    if (!isLastStep) {
      setCurrentStep(steps[currentStepIndex + 1].key);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          aria-hidden="true"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-4 flex items-center justify-between',
            isBusiness
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
              : 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
          )}>
            <div>
              <h2 id="modal-title" className="text-lg font-semibold">
                Configurar {isBusiness ? 'Perfil de Negocio' : 'Perfil Personal'}
              </h2>
              <p className="text-sm text-white/80">
                {profile ? 'Editar configuración' : 'Configuración inicial'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Cerrar modal"
            >
              {icons.close}
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              {steps.map((step, idx) => (
                <div key={step.key} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      currentStep === step.key
                        ? isBusiness
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-orange-100 text-orange-700'
                        : 'text-gray-500 hover:text-gray-700'
                    )}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                      currentStep === step.key
                        ? isBusiness ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white'
                        : idx < currentStepIndex
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                    )}>
                      {idx < currentStepIndex ? icons.check : idx + 1}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-200 mx-2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* Step 1: Template Selection */}
              {currentStep === 'template' && (
                <motion.div
                  key="template"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Selecciona el tipo de asistente
                    </h3>
                    <p className="text-sm text-gray-500">
                      Elige la plantilla que mejor se adapte a tu negocio
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {availableTemplates.map((template) => (
                      <button
                        key={template.key}
                        onClick={() => setSelectedTemplate(template.key)}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          selectedTemplate === template.key
                            ? isBusiness
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{template.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">
                                {template.name}
                              </span>
                              {selectedTemplate === template.key && (
                                <span className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  isBusiness ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white'
                                )}>
                                  Seleccionado
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {template.description}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.capabilities.slice(0, 4).map((cap) => (
                                <span
                                  key={cap}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                                >
                                  {capabilityLabels[cap] || cap}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Personalization */}
              {currentStep === 'style' && (
                <motion.div
                  key="style"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Profile Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del perfil
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder={isBusiness ? 'Ej: Mi Clínica Dental' : 'Ej: Dr. García'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Response Style */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estilo de respuesta
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {RESPONSE_STYLES.map((style) => (
                        <button
                          key={style.value}
                          onClick={() => setResponseStyle(style.value)}
                          className={cn(
                            'p-3 rounded-xl border-2 text-left transition-all',
                            responseStyle === style.value
                              ? isBusiness
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <div className="font-medium text-gray-900 text-sm">
                            {style.label}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {style.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Advanced */}
              {currentStep === 'advanced' && (
                <motion.div
                  key="advanced"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Response Delay (only for personal) */}
                  {!isBusiness && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        {icons.clock}
                        <div>
                          <h4 className="font-medium text-gray-900">Delay de respuesta</h4>
                          <p className="text-sm text-gray-500">
                            Simula tiempo de respuesta humano para parecer más natural
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={responseDelayMinutes}
                          onChange={(e) => setResponseDelayMinutes(Number(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="w-16 text-center font-medium text-gray-900">
                          {responseDelayMinutes} min
                        </span>
                      </div>
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={responseDelayFirstOnly}
                          onChange={(e) => setResponseDelayFirstOnly(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-600">
                          Solo aplicar delay en primer mensaje
                        </span>
                      </label>
                    </div>
                  )}

                  {/* AI Learning */}
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      {icons.brain}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">AI Learning</h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={aiLearningEnabled}
                              onChange={(e) => setAiLearningEnabled(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Permite que el asistente aprenda de las interacciones para mejorar sus respuestas.
                          No aprende vocabulario inapropiado.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {icons.sparkles}
                      <label className="font-medium text-gray-700">
                        Instrucciones adicionales
                      </label>
                    </div>
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="Agrega instrucciones específicas para este perfil... (opcional)"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Estas instrucciones se agregan a las instrucciones base de la plantilla
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100">
            {/* Error message */}
            {saveError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{saveError}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={currentStepIndex === 0 ? onClose : goPrev}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                {currentStepIndex === 0 ? 'Cancelar' : 'Anterior'}
              </button>

              {isLastStep ? (
              <button
                onClick={handleSave}
                disabled={isSaving || !selectedTemplate}
                className={cn(
                  'px-6 py-2.5 font-medium rounded-xl transition-all flex items-center gap-2',
                  isBusiness
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25',
                  (isSaving || !selectedTemplate) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    {icons.check}
                    <span>Guardar configuración</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={currentStep === 'template' && !selectedTemplate}
                className={cn(
                  'px-6 py-2.5 font-medium rounded-xl transition-all flex items-center gap-2',
                  isBusiness
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white',
                  currentStep === 'template' && !selectedTemplate && 'opacity-50 cursor-not-allowed'
                )}
              >
                <span>Siguiente</span>
                {icons.chevronRight}
              </button>
            )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ProfileConfigModal;
