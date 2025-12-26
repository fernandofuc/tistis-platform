'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Agent Setup Progress
// Barra de progreso para configuración del Voice Agent
// =====================================================

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  VolumeIcon,
  FileTextIcon,
  BuildingIcon,
  PhoneIcon,
} from './VoiceAgentIcons';
import type { VoiceAgentConfig, VoicePhoneNumber } from '../types';

// ======================
// TYPES
// ======================

interface SetupStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  isComplete: boolean;
}

interface VoiceAgentSetupProgressProps {
  config: VoiceAgentConfig | null;
  phoneNumbers: VoicePhoneNumber[];
  hasKnowledge: boolean;
  className?: string;
  variant?: 'horizontal' | 'vertical' | 'compact';
  onStepClick?: (stepId: string) => void;
}

// ======================
// COMPONENT
// ======================

export function VoiceAgentSetupProgress({
  config,
  phoneNumbers,
  hasKnowledge,
  className = '',
  variant = 'horizontal',
  onStepClick,
}: VoiceAgentSetupProgressProps) {
  // Calculate setup steps
  const steps = useMemo((): SetupStep[] => {
    const voiceConfigured = !!(config?.voice_id && config?.assistant_name);
    const instructionsConfigured = !!(config?.custom_instructions || config?.system_prompt);
    const phoneConfigured = phoneNumbers.some(p => p.status === 'active');

    return [
      {
        id: 'voice',
        label: 'Voz',
        description: 'Elige la voz de tu asistente',
        icon: <VolumeIcon className="w-4 h-4" />,
        isComplete: voiceConfigured,
      },
      {
        id: 'instructions',
        label: 'Instrucciones',
        description: 'Configura cómo responde',
        icon: <FileTextIcon className="w-4 h-4" />,
        isComplete: instructionsConfigured,
      },
      {
        id: 'knowledge',
        label: 'Conocimiento',
        description: 'Tu negocio y servicios',
        icon: <BuildingIcon className="w-4 h-4" />,
        isComplete: hasKnowledge,
      },
      {
        id: 'phone',
        label: 'Número',
        description: 'Asigna un número telefónico',
        icon: <PhoneIcon className="w-4 h-4" />,
        isComplete: phoneConfigured,
      },
    ];
  }, [config, phoneNumbers, hasKnowledge]);

  const completedCount = steps.filter(s => s.isComplete).length;
  const progressPercent = (completedCount / steps.length) * 100;
  const isFullyConfigured = completedCount === steps.length;

  // Compact variant - just the progress bar and percentage
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isFullyConfigured
                ? 'bg-gradient-to-r from-tis-green to-emerald-500'
                : 'bg-gradient-to-r from-tis-coral to-tis-pink'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className={`text-sm font-medium ${
          isFullyConfigured ? 'text-tis-green' : 'text-slate-600'
        }`}>
          {completedCount}/{steps.length}
        </span>
      </div>
    );
  }

  // Horizontal variant - steps in a row
  if (variant === 'horizontal') {
    return (
      <div className={`bg-white rounded-2xl border border-slate-200/60 p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isFullyConfigured ? 'Configuración completa' : 'Configura tu agente'}
            </h3>
            <p className="text-sm text-slate-500">
              {isFullyConfigured
                ? 'Tu asistente de voz está listo para recibir llamadas'
                : `${completedCount} de ${steps.length} pasos completados`
              }
            </p>
          </div>
          {isFullyConfigured && (
            <div className="w-10 h-10 rounded-full bg-tis-green/10 flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-tis-green" />
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="relative mb-6">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                isFullyConfigured
                  ? 'bg-gradient-to-r from-tis-green to-emerald-500'
                  : 'bg-gradient-to-r from-tis-coral to-tis-pink'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-4 gap-4">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200 text-left
                ${step.isComplete
                  ? 'border-tis-green/30 bg-tis-green/5'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }
                ${onStepClick ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              {/* Step Number / Check */}
              <div className={`
                absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step.isComplete
                  ? 'bg-tis-green text-white'
                  : 'bg-slate-200 text-slate-600'
                }
              `}>
                {step.isComplete ? (
                  <CheckCircleIcon className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center mb-3
                ${step.isComplete
                  ? 'bg-tis-green/10 text-tis-green'
                  : 'bg-slate-100 text-slate-400'
                }
              `}>
                {step.icon}
              </div>

              {/* Label */}
              <p className={`font-semibold text-sm ${
                step.isComplete ? 'text-slate-900' : 'text-slate-600'
              }`}>
                {step.label}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {step.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Vertical variant - steps in a column
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/60 p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-900">
            {isFullyConfigured ? 'Configuración completa' : 'Progreso de configuración'}
          </h3>
          <span className={`text-sm font-semibold ${
            isFullyConfigured ? 'text-tis-green' : 'text-slate-600'
          }`}>
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isFullyConfigured
                ? 'bg-gradient-to-r from-tis-green to-emerald-500'
                : 'bg-gradient-to-r from-tis-coral to-tis-pink'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => onStepClick?.(step.id)}
            className={`
              w-full flex items-center gap-4 p-3 rounded-xl border transition-all duration-200
              ${step.isComplete
                ? 'border-tis-green/30 bg-tis-green/5'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }
              ${onStepClick ? 'cursor-pointer' : 'cursor-default'}
            `}
          >
            {/* Step Number / Check */}
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
              ${step.isComplete
                ? 'bg-tis-green text-white'
                : 'bg-slate-100 text-slate-500'
              }
            `}>
              {step.isComplete ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <span className="text-sm font-bold">{index + 1}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 text-left">
              <p className={`font-semibold text-sm ${
                step.isComplete ? 'text-slate-900' : 'text-slate-600'
              }`}>
                {step.label}
              </p>
              <p className="text-xs text-slate-400">
                {step.description}
              </p>
            </div>

            {/* Icon */}
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center
              ${step.isComplete
                ? 'bg-tis-green/10 text-tis-green'
                : 'bg-slate-50 text-slate-300'
              }
            `}>
              {step.icon}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default VoiceAgentSetupProgress;
