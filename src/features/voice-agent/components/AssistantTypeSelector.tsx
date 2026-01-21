'use client';

// =====================================================
// TIS TIS PLATFORM - Assistant Type Selector
// Componente para seleccionar/cambiar el tipo de asistente de voz
// Basado en StepSelectType del wizard, adaptado para uso standalone
//
// DISEÑO: Componente "controlado" - el padre maneja el estado pendiente
// El selector NO tiene estado interno, solo muestra lo que le pasan
// =====================================================

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  SparklesIcon,
} from './VoiceAgentIcons';
import {
  getActiveTypesForVertical,
} from '@/lib/voice-agent/types/assistant-types';
import type { AssistantType } from '@/lib/voice-agent/types';

// =====================================================
// ICON MAPPING
// =====================================================

function getIconForType(iconName?: string) {
  switch (iconName || '') {
    case 'calendar':
    case 'calendar-check':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      );
    case 'utensils':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path d="M7 2v20"/>
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>
      );
    case 'star':
    case 'star-of-life':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      );
    case 'tooth':
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C8.5 2 6 4 6 7c0 2.5 1 4.5 1 7 0 2.5-.5 5 1 7 1 1.5 2 1 2.5 0 .5-1 1-3 2.5-3s2 2 2.5 3c.5 1 1.5 1.5 2.5 0 1.5-2 1-4.5 1-7 0-2.5 1-4.5 1-7 0-3-2.5-5-6-5z"/>
        </svg>
      );
    default:
      return <SparklesIcon className="w-5 h-5" />;
  }
}

// =====================================================
// TYPES
// =====================================================

interface AssistantTypeSelectorProps {
  vertical: 'restaurant' | 'dental';
  /** ID del tipo actualmente guardado en BD */
  currentTypeId: string | null;
  /** ID del tipo pendiente de confirmación (para resaltar visualmente) */
  pendingTypeId?: string | null;
  /** Callback cuando el usuario selecciona un tipo diferente */
  onTypeChange: (typeId: string) => void;
  disabled?: boolean;
  compact?: boolean;
  showFeatures?: boolean;
}

interface TypeCardProps {
  type: AssistantType;
  /** Está seleccionado visualmente (pendiente o confirmado) */
  isSelected: boolean;
  /** Es el tipo actualmente guardado en BD */
  isCurrent: boolean;
  /** Hay un cambio pendiente de confirmación */
  hasPendingChange: boolean;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
  showFeatures?: boolean;
}

// =====================================================
// TYPE CARD COMPONENT
// =====================================================

function TypeCard({
  type,
  isSelected,
  isCurrent,
  hasPendingChange,
  onSelect,
  disabled,
  compact,
  showFeatures = true,
}: TypeCardProps) {
  const gradientClasses = {
    basic: 'from-slate-500 to-slate-600',
    standard: 'from-tis-coral to-tis-pink',
    complete: 'from-tis-purple to-indigo-600',
  };

  const gradientClass = gradientClasses[type.level] || gradientClasses.standard;

  // Determinar el estilo del borde según el estado
  const getBorderClass = () => {
    if (isSelected && hasPendingChange) {
      // Seleccionado con cambio pendiente - borde coral con ring
      return 'border-tis-coral bg-white shadow-lg ring-2 ring-tis-coral/20';
    }
    if (isCurrent && !hasPendingChange) {
      // Es el actual y no hay cambio pendiente - borde verde
      return 'border-tis-green/50 bg-tis-green/5';
    }
    if (isCurrent && hasPendingChange) {
      // Es el actual pero hay otro seleccionado - borde verde sutil
      return 'border-tis-green/30 bg-white';
    }
    // No seleccionado, no actual
    return 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md';
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`
        relative w-full text-left rounded-xl border-2
        transition-all duration-300 group
        ${compact ? 'p-3' : 'p-4'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${getBorderClass()}
      `}
      whileHover={!disabled ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        {/* Icon */}
        <div
          className={`
            ${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-lg flex items-center justify-center text-white
            bg-gradient-to-br ${gradientClass}
            shadow-md
          `}
        >
          {getIconForType(type.iconName)}
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-1 items-end">
          {type.isRecommended && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
              <SparklesIcon className="w-3 h-3" />
              Recomendado
            </span>
          )}
          {isCurrent && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-tis-green bg-tis-green/10 rounded-full">
              <CheckIcon className="w-3 h-3" />
              Actual
            </span>
          )}
        </div>
      </div>

      {/* Title & Description */}
      <h4 className={`font-bold text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}>
        {type.displayName}
      </h4>
      <p className={`text-slate-500 mt-0.5 line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        {type.description}
      </p>

      {/* Features list (only if not compact and showFeatures is true) */}
      {showFeatures && !compact && type.features.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {type.features.slice(0, 4).map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-xs">
              <CheckIcon
                className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                  isSelected ? 'text-tis-coral' : 'text-tis-green'
                }`}
              />
              <span className="text-slate-600">{feature}</span>
            </li>
          ))}
          {type.features.length > 4 && (
            <li className="text-xs text-slate-400 pl-5">
              +{type.features.length - 4} más...
            </li>
          )}
        </ul>
      )}

      {/* Selection indicator - solo si está seleccionado Y hay cambio pendiente */}
      <AnimatePresence>
        {isSelected && hasPendingChange && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-tis-coral flex items-center justify-center"
          >
            <CheckIcon className="w-3 h-3 text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level indicator */}
      <div className={`mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs`}>
        <span className="text-slate-400 capitalize">{type.level}</span>
        <span className="text-slate-400">{type.maxCallDurationSeconds / 60} min máx</span>
      </div>
    </motion.button>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function AssistantTypeSelector({
  vertical,
  currentTypeId,
  pendingTypeId,
  onTypeChange,
  disabled = false,
  compact = false,
  showFeatures = true,
}: AssistantTypeSelectorProps) {
  // Get available types for this vertical
  const assistantTypes = useMemo(() => {
    return getActiveTypesForVertical(vertical);
  }, [vertical]);

  // Determinar si hay un cambio pendiente
  const hasPendingChange = pendingTypeId !== null && pendingTypeId !== undefined && pendingTypeId !== currentTypeId;

  // El tipo visualmente "seleccionado" es el pendiente si existe, sino el actual
  const visuallySelectedTypeId = hasPendingChange ? pendingTypeId : currentTypeId;

  const handleSelectType = (typeId: string) => {
    if (disabled) return;
    // No hacer nada si selecciona el mismo que ya está seleccionado
    if (typeId === visuallySelectedTypeId) return;
    // Notificar al padre del cambio
    onTypeChange(typeId);
  };

  return (
    <div className="space-y-4">
      {/* Type cards grid */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'md:grid-cols-3'}`}>
        {assistantTypes.map((type) => (
          <TypeCard
            key={type.id}
            type={type}
            isSelected={visuallySelectedTypeId === type.id}
            isCurrent={currentTypeId === type.id}
            hasPendingChange={hasPendingChange}
            onSelect={() => handleSelectType(type.id)}
            disabled={disabled}
            compact={compact}
            showFeatures={showFeatures}
          />
        ))}
      </div>
    </div>
  );
}

export default AssistantTypeSelector;
