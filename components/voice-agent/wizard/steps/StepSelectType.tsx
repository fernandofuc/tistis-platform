/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Step 1: Select Assistant Type
 *
 * Displays cards for each assistant type with features list.
 * Includes "Recomendado" badge for standard types.
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckIcon,
  CalendarIcon,
  SparklesIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import {
  getActiveTypesForVertical,
  getRecommendedType,
} from '@/lib/voice-agent/types/assistant-types';
import type { AssistantType } from '@/lib/voice-agent/types';
import type { StepComponentProps } from '../types';

// =====================================================
// ICON MAPPING
// =====================================================

function getIconForType(iconName?: string) {
  // Map icon names to actual components
  switch (iconName || '') {
    case 'calendar':
    case 'calendar-check':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      );
    case 'utensils':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>
      );
    case 'star':
    case 'star-of-life':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      );
    case 'tooth':
      return (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.5 2 6 4 6 7c0 2.5 1 4.5 1 7 0 2.5-.5 5 1 7 1 1.5 2 1 2.5 0 .5-1 1-3 2.5-3s2 2 2.5 3c.5 1 1.5 1.5 2.5 0 1.5-2 1-4.5 1-7 0-2.5 1-4.5 1-7 0-3-2.5-5-6-5z"/>
        </svg>
      );
    default:
      return <SparklesIcon className="w-6 h-6" />;
  }
}

// =====================================================
// TYPE CARD COMPONENT
// =====================================================

interface TypeCardProps {
  type: AssistantType;
  isSelected: boolean;
  onSelect: () => void;
}

function TypeCard({ type, isSelected, onSelect }: TypeCardProps) {
  const gradientClasses = {
    basic: 'from-slate-500 to-slate-600',
    standard: 'from-tis-coral to-tis-pink',
    complete: 'from-tis-purple to-indigo-600',
  };

  const gradientClass = gradientClasses[type.level] || gradientClasses.standard;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={`
        relative w-full text-left p-4 sm:p-5 rounded-2xl border-2
        transition-all duration-300 group
        ${isSelected
          ? 'border-tis-coral bg-white shadow-card-elevated ring-2 ring-tis-coral/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-card-hover'
        }
      `}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        {/* Icon */}
        <div
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-white
            bg-gradient-to-br ${gradientClass}
            shadow-lg
          `}
          style={{
            boxShadow: isSelected
              ? '0 8px 24px -4px rgba(223, 115, 115, 0.3)'
              : undefined,
          }}
        >
          {getIconForType(type.iconName)}
        </div>

        {/* Recommended badge */}
        {type.isRecommended && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
            <SparklesIcon className="w-3 h-3" />
            Recomendado
          </span>
        )}
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-bold text-slate-900 mb-1">{type.displayName}</h3>
      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{type.description}</p>

      {/* Features list */}
      <ul className="space-y-2">
        {type.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <CheckIcon
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                isSelected ? 'text-tis-coral' : 'text-tis-green'
              }`}
            />
            <span className="text-slate-600">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-4 right-4 w-6 h-6 rounded-full bg-tis-coral flex items-center justify-center"
        >
          <CheckIcon className="w-4 h-4 text-white" />
        </motion.div>
      )}

      {/* Selected state bar */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 pt-4 border-t border-tis-coral/20"
        >
          <p className="text-sm font-semibold text-tis-coral text-center">
            Tipo seleccionado
          </p>
        </motion.div>
      )}
    </motion.button>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function StepSelectType({
  config,
  vertical,
  onUpdateConfig,
  onNext,
}: StepComponentProps) {
  const [assistantTypes, setAssistantTypes] = useState<AssistantType[]>([]);
  const [recommendedType, setRecommendedType] = useState<AssistantType | null>(null);

  // Load assistant types based on vertical
  useEffect(() => {
    const types = getActiveTypesForVertical(vertical);
    setAssistantTypes(types);

    const recommended = getRecommendedType(vertical);
    setRecommendedType(recommended);

    // Auto-select recommended type if nothing selected
    if (!config.assistantType && recommended) {
      onUpdateConfig({ assistantType: recommended.id });
    }
  }, [vertical, config.assistantType, onUpdateConfig]);

  const handleSelectType = (typeId: string) => {
    onUpdateConfig({ assistantType: typeId as any });
  };

  const verticalLabel = vertical === 'restaurant' ? 'restaurante' : 'clínica dental';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center mb-4 shadow-lg shadow-tis-coral/30"
        >
          <SparklesIcon className="w-8 h-8 text-white" />
        </motion.div>

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-2xl font-bold text-slate-900 mb-2"
        >
          Elige el tipo de asistente
        </motion.h2>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-slate-500"
        >
          Selecciona las capacidades que necesitas para tu {verticalLabel}
        </motion.p>
      </div>

      {/* Type cards grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="grid gap-4 sm:gap-5 md:grid-cols-3"
      >
        {assistantTypes.map((type, index) => (
          <motion.div
            key={type.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
          >
            <TypeCard
              type={type}
              isSelected={config.assistantType === type.id}
              onSelect={() => handleSelectType(type.id)}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Help text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="p-4 bg-slate-50 border border-slate-200 rounded-xl"
      >
        <p className="text-sm text-slate-600">
          <strong className="text-slate-700">Tip:</strong> Puedes comenzar con el tipo{' '}
          <strong className="text-tis-coral">Recomendado</strong> y actualizar después según
          tus necesidades. Siempre puedes cambiar el tipo de asistente más adelante.
        </p>
      </motion.div>
    </div>
  );
}

export default StepSelectType;
