'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Agent Setup Wizard
// Wizard de 3 pasos para configurar el Voice Agent
// =====================================================

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VolumeIcon,
  CheckIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  SparklesIcon,
  PhoneIcon,
  XIcon,
  LoaderIcon,
} from './VoiceAgentIcons';
import { VoicePreviewCard } from './VoicePreviewCard';
import type { VoiceAgentConfig, AvailableVoice, AreaCode } from '../types';
import { AVAILABLE_VOICES, MEXICO_AREA_CODES } from '../types';

// ======================
// TYPES
// ======================

interface VoiceAgentWizardProps {
  config: VoiceAgentConfig | null;
  vertical: 'dental' | 'restaurant' | 'medical' | 'general';
  accessToken: string;
  onSaveConfig: (updates: Partial<VoiceAgentConfig>) => Promise<boolean>;
  onRequestPhoneNumber: (areaCode: string) => Promise<boolean>;
  onComplete: () => void;
  onClose: () => void;
}

type WizardStep = 'voice' | 'personality' | 'phone';

// ======================
// STEP COMPONENTS
// ======================

interface StepVoiceProps {
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  accessToken: string;
}

function StepVoice({ selectedVoiceId, onSelect, accessToken }: StepVoiceProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-tis-purple to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-tis-purple/30">
          <VolumeIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Elige la voz de tu asistente
        </h2>
        <p className="text-slate-500">
          Selecciona cómo sonará tu asistente al hablar con tus clientes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {AVAILABLE_VOICES.map((voice) => (
          <VoicePreviewCard
            key={voice.id}
            voice={voice}
            isSelected={selectedVoiceId === voice.id}
            onSelect={() => onSelect(voice.id)}
            accessToken={accessToken}
          />
        ))}
      </div>
    </div>
  );
}

interface StepPersonalityProps {
  assistantName: string;
  firstMessage: string;
  onNameChange: (name: string) => void;
  onMessageChange: (message: string) => void;
  vertical: string;
}

function StepPersonality({
  assistantName,
  firstMessage,
  onNameChange,
  onMessageChange,
  vertical,
}: StepPersonalityProps) {
  const defaultMessages: Record<string, string> = {
    dental: 'Hola, gracias por llamar a nuestra clínica dental. Soy {name}, tu asistente virtual. ¿En qué puedo ayudarte hoy?',
    restaurant: 'Hola, gracias por llamar a nuestro restaurante. Soy {name}. ¿Te gustaría hacer una reservación?',
    medical: 'Hola, gracias por comunicarte con nosotros. Soy {name}, tu asistente de citas médicas. ¿En qué puedo ayudarte?',
    general: 'Hola, gracias por llamar. Soy {name}, tu asistente virtual. ¿En qué puedo ayudarte hoy?',
  };

  const handleUseSuggested = () => {
    const template = defaultMessages[vertical] || defaultMessages.general;
    onMessageChange(template.replace('{name}', assistantName || 'tu asistente'));
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30">
          <SparklesIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Personaliza tu asistente
        </h2>
        <p className="text-slate-500">
          Dale un nombre y configura su saludo inicial
        </p>
      </div>

      <div className="space-y-6">
        {/* Assistant Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre del asistente
          </label>
          <input
            type="text"
            value={assistantName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ej: Sofía, Carlos, Ana..."
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
          />
          <p className="text-xs text-slate-400 mt-1">
            Este nombre lo usará el asistente para presentarse
          </p>
        </div>

        {/* First Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              Mensaje de bienvenida
            </label>
            <button
              onClick={handleUseSuggested}
              className="text-xs font-medium text-tis-coral hover:text-tis-pink transition-colors"
            >
              Usar sugerido
            </button>
          </div>
          <textarea
            value={firstMessage}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Lo que dirá tu asistente al contestar una llamada..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all resize-none"
          />
          <p className="text-xs text-slate-400 mt-1">
            Este es el primer mensaje que escuchará quien llame
          </p>
        </div>

        {/* Preview */}
        {firstMessage && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-medium text-slate-500 mb-2">Vista previa:</p>
            <p className="text-sm text-slate-700 italic">&ldquo;{firstMessage}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StepPhoneProps {
  selectedAreaCode: string;
  onSelect: (code: string) => void;
  loading: boolean;
}

function StepPhone({ selectedAreaCode, onSelect, loading }: StepPhoneProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCodes = MEXICO_AREA_CODES.filter(
    (ac) =>
      ac.code.includes(searchQuery) ||
      ac.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ac.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Popular codes shown first
  const popularCodes = ['55', '33', '81'];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-tis-green to-emerald-500 flex items-center justify-center mb-4 shadow-lg shadow-tis-green/30">
          <PhoneIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Elige tu número de teléfono
        </h2>
        <p className="text-slate-500">
          Selecciona la lada de tu ciudad para tu número de voz
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por ciudad, estado o lada..."
          className="w-full px-4 py-3 pl-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Popular Area Codes */}
      {!searchQuery && (
        <div>
          <p className="text-sm font-medium text-slate-500 mb-3">Ciudades principales</p>
          <div className="grid grid-cols-3 gap-3">
            {MEXICO_AREA_CODES.filter((ac) => popularCodes.includes(ac.code)).map((areaCode) => (
              <button
                key={areaCode.code}
                onClick={() => onSelect(areaCode.code)}
                disabled={loading}
                className={`
                  p-4 rounded-xl border-2 text-left transition-all
                  ${selectedAreaCode === areaCode.code
                    ? 'border-tis-green bg-tis-green/5 shadow-lg shadow-tis-green/10'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }
                  ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <p className="text-2xl font-bold text-slate-900">+52 {areaCode.code}</p>
                <p className="text-sm font-medium text-slate-600">{areaCode.city}</p>
                <p className="text-xs text-slate-400">{areaCode.state}</p>
                {selectedAreaCode === areaCode.code && (
                  <div className="mt-2">
                    <CheckIcon className="w-5 h-5 text-tis-green" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All Area Codes (or filtered) */}
      <div>
        <p className="text-sm font-medium text-slate-500 mb-3">
          {searchQuery ? `Resultados para "${searchQuery}"` : 'Todas las ciudades'}
        </p>
        <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
          {filteredCodes.map((areaCode) => (
            <button
              key={areaCode.code}
              onClick={() => onSelect(areaCode.code)}
              disabled={loading}
              className={`
                w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all
                ${selectedAreaCode === areaCode.code
                  ? 'border-tis-green bg-tis-green/5'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-900">+52 {areaCode.code}</span>
                <span className="text-sm text-slate-600">{areaCode.city}, {areaCode.state}</span>
              </div>
              {selectedAreaCode === areaCode.code && (
                <CheckIcon className="w-5 h-5 text-tis-green" />
              )}
            </button>
          ))}

          {filteredCodes.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No se encontraron resultados
            </div>
          )}
        </div>
      </div>

      {/* Cost Info */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-sm text-blue-700">
          <strong>Costo estimado:</strong> ~$3 USD/mes + ~$0.02 USD/minuto de llamada
        </p>
      </div>
    </div>
  );
}

// ======================
// MAIN WIZARD COMPONENT
// ======================

export function VoiceAgentWizard({
  config,
  vertical,
  accessToken,
  onSaveConfig,
  onRequestPhoneNumber,
  onComplete,
  onClose,
}: VoiceAgentWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('voice');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedVoiceId, setSelectedVoiceId] = useState(
    config?.voice_id || AVAILABLE_VOICES.find(v => v.is_default)?.id || AVAILABLE_VOICES[0]?.id || ''
  );
  const [assistantName, setAssistantName] = useState(config?.assistant_name || '');
  const [firstMessage, setFirstMessage] = useState(config?.first_message || '');
  const [selectedAreaCode, setSelectedAreaCode] = useState('');

  const steps: WizardStep[] = ['voice', 'personality', 'phone'];
  const currentIndex = steps.indexOf(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'voice':
        return !!selectedVoiceId;
      case 'personality':
        return !!assistantName.trim() && !!firstMessage.trim();
      case 'phone':
        return !!selectedAreaCode;
      default:
        return false;
    }
  }, [currentStep, selectedVoiceId, assistantName, firstMessage, selectedAreaCode]);

  const handleNext = async () => {
    setError(null);

    // Save voice and personality before going to phone step
    if (currentStep === 'personality') {
      setSaving(true);
      try {
        const success = await onSaveConfig({
          voice_id: selectedVoiceId,
          assistant_name: assistantName.trim(),
          first_message: firstMessage.trim(),
        });

        if (!success) {
          setError('Error al guardar la configuración. Intenta de nuevo.');
          setSaving(false);
          return;
        }
      } catch (err) {
        setError('Error al guardar la configuración. Intenta de nuevo.');
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    if (!isLastStep) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleFinish = async () => {
    if (!selectedAreaCode) return;

    setSaving(true);
    setError(null);

    try {
      const success = await onRequestPhoneNumber(selectedAreaCode);

      if (success) {
        onComplete();
      } else {
        setError('Error al solicitar el número. Intenta de nuevo.');
      }
    } catch (err) {
      setError('Error al solicitar el número. Intenta de nuevo.');
    }

    setSaving(false);
  };

  const handleSkipPhone = async () => {
    // Save config without phone and complete
    setSaving(true);
    setError(null);

    try {
      const success = await onSaveConfig({
        voice_id: selectedVoiceId,
        assistant_name: assistantName.trim(),
        first_message: firstMessage.trim(),
        voice_status: 'configuring',
      });

      if (success) {
        onComplete();
      } else {
        setError('Error al guardar. Intenta de nuevo.');
      }
    } catch (err) {
      setError('Error al guardar. Intenta de nuevo.');
    }

    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            {/* Progress Dots */}
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    index <= currentIndex
                      ? 'bg-tis-coral'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-slate-500">
              Paso {currentIndex + 1} de {steps.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <XIcon className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 'voice' && (
                <StepVoice
                  selectedVoiceId={selectedVoiceId}
                  onSelect={setSelectedVoiceId}
                  accessToken={accessToken}
                />
              )}

              {currentStep === 'personality' && (
                <StepPersonality
                  assistantName={assistantName}
                  firstMessage={firstMessage}
                  onNameChange={setAssistantName}
                  onMessageChange={setFirstMessage}
                  vertical={vertical}
                />
              )}

              {currentStep === 'phone' && (
                <StepPhone
                  selectedAreaCode={selectedAreaCode}
                  onSelect={setSelectedAreaCode}
                  loading={saving}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6">
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50">
          <div>
            {!isFirstStep && (
              <button
                onClick={handleBack}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Atrás
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isLastStep && (
              <button
                onClick={handleSkipPhone}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                Omitir por ahora
              </button>
            )}

            {isLastStep ? (
              <button
                onClick={handleFinish}
                disabled={!canProceed() || saving}
                className="flex items-center gap-2 px-6 py-3 text-white font-medium bg-gradient-to-r from-tis-green to-emerald-500 rounded-xl hover:shadow-lg hover:shadow-tis-green/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <LoaderIcon className="w-5 h-5" />
                    Activando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Activar mi número
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed() || saving}
                className="flex items-center gap-2 px-6 py-3 text-white font-medium bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:shadow-lg hover:shadow-tis-coral/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <LoaderIcon className="w-5 h-5" />
                    Guardando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default VoiceAgentWizard;
