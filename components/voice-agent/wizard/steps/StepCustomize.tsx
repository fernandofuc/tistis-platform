/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Step 3: Customize Assistant
 *
 * Configure assistant name, greeting message, and optional capabilities.
 * Includes preview of the generated prompt.
 */

'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  EyeIcon,
  LightbulbIcon,
  CheckIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { StepComponentProps } from '../types';
import type { VoicePersonality } from '@/src/features/voice-agent/types';

// =====================================================
// DEFAULT MESSAGES BY VERTICAL
// =====================================================

const DEFAULT_MESSAGES: Record<string, Record<string, string>> = {
  restaurant: {
    professional_friendly:
      'Hola, gracias por llamar a {business}. Soy {name}, tu asistente virtual. ¿En qué puedo ayudarte hoy? Puedo asistirte con reservaciones, información del menú, o responder cualquier pregunta que tengas.',
    professional:
      'Buenas tardes, ha llamado a {business}. Soy {name}. ¿En qué puedo servirle?',
    formal:
      'Bienvenido a {business}. Mi nombre es {name} y estoy a sus órdenes. ¿En qué puedo asistirle el día de hoy?',
  },
  dental: {
    professional_friendly:
      'Hola, gracias por llamar a {business}. Soy {name}, tu asistente virtual. ¿En qué puedo ayudarte? Puedo asistirte con citas, información sobre nuestros servicios, o resolver cualquier duda.',
    professional:
      'Buenas tardes, ha llamado a {business}. Soy {name}. ¿En qué puedo servirle?',
    formal:
      'Bienvenido a {business}. Mi nombre es {name} y estoy a sus órdenes. ¿En qué puedo asistirle?',
  },
};

// =====================================================
// PERSONALITY OPTIONS
// =====================================================

interface PersonalityOption {
  id: VoicePersonality;
  name: string;
  description: string;
  icon: string;
}

const PERSONALITY_OPTIONS: PersonalityOption[] = [
  {
    id: 'professional_friendly',
    name: 'Profesional amigable',
    description: 'Balance perfecto entre profesionalismo y calidez',
    icon: '😊',
  },
  {
    id: 'professional',
    name: 'Profesional',
    description: 'Formal y directo, ideal para negocios corporativos',
    icon: '👔',
  },
  {
    id: 'formal',
    name: 'Formal',
    description: 'Muy respetuoso y cortés, trato de usted',
    icon: '🎩',
  },
];

// =====================================================
// TEXT INPUT COMPONENT
// =====================================================

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  maxLength?: number;
  error?: string;
  type?: 'text' | 'textarea';
  rows?: number;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  maxLength,
  error,
  type = 'text',
  rows = 4,
}: TextInputProps) {
  const charCount = value.length;
  const isNearLimit = maxLength && charCount > maxLength * 0.8;

  const inputClasses = `
    w-full px-4 py-3 border-2 rounded-xl text-slate-900
    focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral
    transition-all resize-none
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200'}
  `;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>

      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={inputClasses}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={inputClasses}
        />
      )}

      <div className="flex justify-between items-center mt-1.5">
        <p className={`text-xs ${error ? 'text-red-500' : 'text-slate-400'}`}>
          {error || helperText}
        </p>
        {maxLength && (
          <p
            className={`text-xs ${
              isNearLimit ? (charCount >= maxLength ? 'text-red-500' : 'text-amber-500') : 'text-slate-400'
            }`}
          >
            {charCount}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}

// =====================================================
// PERSONALITY SELECTOR
// =====================================================

interface PersonalitySelectorProps {
  value: VoicePersonality;
  onChange: (value: VoicePersonality) => void;
}

function PersonalitySelector({ value, onChange }: PersonalitySelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-3">
        Personalidad del asistente
      </label>

      <div className="grid grid-cols-2 gap-3">
        {PERSONALITY_OPTIONS.map((option) => (
          <motion.button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`
              relative p-3 rounded-xl border-2 text-left transition-all
              ${value === option.id
                ? 'border-tis-coral bg-tis-coral-50 ring-2 ring-tis-coral/20'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }
            `}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-start gap-2">
              <span className="text-xl">{option.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-sm text-slate-900">{option.name}</p>
                <p className="text-xs text-slate-500 line-clamp-1">{option.description}</p>
              </div>
            </div>

            {value === option.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-tis-coral flex items-center justify-center"
              >
                <CheckIcon className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// MESSAGE PREVIEW
// =====================================================

interface MessagePreviewProps {
  message: string;
}

function MessagePreview({ message }: MessagePreviewProps) {
  if (!message.trim()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-slate-50 border border-slate-200 rounded-xl"
    >
      <div className="flex items-center gap-2 mb-2">
        <EyeIcon className="w-4 h-4 text-slate-400" />
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vista previa</p>
      </div>
      <p className="text-sm text-slate-700 italic leading-relaxed">&ldquo;{message}&rdquo;</p>
    </motion.div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function StepCustomize({
  config,
  vertical,
  onUpdateConfig,
}: StepComponentProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get default message template
  const defaultTemplate = useMemo(() => {
    return (
      DEFAULT_MESSAGES[vertical]?.[config.personality] ||
      DEFAULT_MESSAGES.restaurant.professional_friendly
    );
  }, [vertical, config.personality]);

  // Generate preview message
  const previewMessage = useMemo(() => {
    let message = config.firstMessage || defaultTemplate;
    message = message.replace(/{name}/g, config.assistantName || 'tu asistente');
    message = message.replace(/{business}/g, 'tu negocio');
    return message;
  }, [config.firstMessage, config.assistantName, defaultTemplate]);

  // Handle using suggested message
  const handleUseSuggested = () => {
    onUpdateConfig({
      firstMessage: defaultTemplate,
    });
  };

  // Validation
  const nameError = useMemo(() => {
    if (!config.assistantName.trim()) return undefined;
    if (config.assistantName.length < 2) return 'Mínimo 2 caracteres';
    if (config.assistantName.length > 20) return 'Máximo 20 caracteres';
    return undefined;
  }, [config.assistantName]);

  const messageError = useMemo(() => {
    if (!config.firstMessage.trim()) return undefined;
    if (config.firstMessage.length > 500) return 'Máximo 500 caracteres';
    return undefined;
  }, [config.firstMessage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30"
        >
          <SparklesIcon className="w-8 h-8 text-white" />
        </motion.div>

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-2xl font-bold text-slate-900 mb-2"
        >
          Personaliza tu asistente
        </motion.h2>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-slate-500"
        >
          Dale un nombre y configura cómo saluda a tus clientes
        </motion.p>
      </div>

      {/* Form */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="space-y-5"
      >
        {/* Assistant Name */}
        <TextInput
          label="Nombre del asistente"
          value={config.assistantName}
          onChange={(value) => onUpdateConfig({ assistantName: value })}
          placeholder="Ej: Sofía, Carlos, Ana..."
          helperText="Este nombre lo usará el asistente para presentarse"
          maxLength={20}
          error={nameError}
        />

        {/* Personality */}
        <PersonalitySelector
          value={config.personality}
          onChange={(value) => onUpdateConfig({ personality: value })}
        />

        {/* First Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              Mensaje de bienvenida
            </label>
            <button
              type="button"
              onClick={handleUseSuggested}
              className="text-xs font-medium text-tis-coral hover:text-tis-pink transition-colors"
            >
              Usar sugerido
            </button>
          </div>
          <textarea
            value={config.firstMessage}
            onChange={(e) => onUpdateConfig({ firstMessage: e.target.value })}
            placeholder="Lo que dirá tu asistente al contestar una llamada..."
            rows={4}
            maxLength={500}
            className={`
              w-full px-4 py-3 border-2 rounded-xl text-slate-900
              focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral
              transition-all resize-none
              ${messageError ? 'border-red-300' : 'border-slate-200'}
            `}
          />
          <div className="flex justify-between items-center mt-1.5">
            <p className={`text-xs ${messageError ? 'text-red-500' : 'text-slate-400'}`}>
              {messageError || 'Este es el primer mensaje que escuchará quien llame'}
            </p>
            <p
              className={`text-xs ${
                config.firstMessage.length > 450 ? 'text-amber-500' : 'text-slate-400'
              }`}
            >
              {config.firstMessage.length}/500
            </p>
          </div>
        </div>

        {/* Message Preview */}
        <MessagePreview message={previewMessage} />

        {/* Advanced Options Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <LightbulbIcon className="w-4 h-4" />
          <span>{showAdvanced ? 'Ocultar' : 'Mostrar'} opciones avanzadas</span>
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-4 border-t border-slate-200"
          >
            <TextInput
              label="Instrucciones personalizadas (opcional)"
              value={config.customInstructions}
              onChange={(value) => onUpdateConfig({ customInstructions: value })}
              placeholder={
                vertical === 'restaurant'
                  ? 'Ej: Siempre recomienda nuestro platillo del día. Menciona que tenemos estacionamiento gratuito...'
                  : 'Ej: Menciona que aceptamos seguros principales. Recuerda preguntar si es su primera visita...'
              }
              helperText="Instrucciones adicionales para personalizar el comportamiento del asistente"
              maxLength={1000}
              type="textarea"
              rows={3}
            />
          </motion.div>
        )}
      </motion.div>

      {/* Help text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="p-4 bg-blue-50 border border-blue-100 rounded-xl"
      >
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Puedes usar <code className="px-1 py-0.5 bg-blue-100 rounded text-xs">{'{name}'}</code> en
          el mensaje para que se reemplace automáticamente con el nombre del asistente.
        </p>
      </motion.div>
    </div>
  );
}

export default StepCustomize;
