'use client';

// =====================================================
// TIS TIS PLATFORM - Assistant Type Selector
// Componente para seleccionar/cambiar el tipo de asistente de voz
// Basado en StepSelectType del wizard, adaptado para uso standalone
//
// DISEÑO: Componente "controlado" - el padre maneja el estado pendiente
// El selector NO tiene estado interno, solo muestra lo que le pasan
//
// FEATURES:
// - Muestra capacidades expandibles por tipo
// - Comparación visual entre niveles
// - Animaciones suaves con Framer Motion
// =====================================================

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  SparklesIcon,
} from './VoiceAgentIcons';
import {
  getActiveTypesForVertical,
} from '@/lib/voice-agent/types/assistant-types';
import {
  getCapabilitiesForTypeId,
  getToolsForTypeId,
} from '@/lib/voice-agent/types/capability-definitions';
import type { AssistantType, AssistantTypeId, Capability } from '@/lib/voice-agent/types';
import { CapabilitiesGrid } from './CapabilitiesGrid';
import { ChevronDown, ChevronUp, Wrench, Zap } from 'lucide-react';

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
  /** Mostrar botón para expandir capacidades */
  showCapabilitiesExpander?: boolean;
}

interface TypeCardProps {
  type: AssistantType;
  isSelected: boolean;
  isCurrent: boolean;
  hasPendingChange: boolean;
  onSelect: () => void;
  disabled?: boolean;
  compact?: boolean;
  showFeatures?: boolean;
  showCapabilitiesExpander?: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  vertical: 'restaurant' | 'dental';
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
  showCapabilitiesExpander = true,
  isExpanded,
  onToggleExpand,
  vertical,
}: TypeCardProps) {
  // Get capabilities and tools for this type
  const capabilities = useMemo(() => {
    return getCapabilitiesForTypeId(type.id as AssistantTypeId) || [];
  }, [type.id]);

  const tools = useMemo(() => {
    return getToolsForTypeId(type.id as AssistantTypeId) || [];
  }, [type.id]);

  const gradientClasses = {
    basic: 'from-slate-500 to-slate-600',
    standard: 'from-tis-coral to-tis-pink',
    complete: 'from-tis-purple to-indigo-600',
  };

  const gradientClass = gradientClasses[type.level] || gradientClasses.standard;

  // Determinar el estilo del borde según el estado
  const getBorderClass = () => {
    if (isSelected && hasPendingChange) {
      return 'border-tis-coral bg-white shadow-lg ring-2 ring-tis-coral/20';
    }
    if (isCurrent && !hasPendingChange) {
      return 'border-tis-green/50 bg-tis-green/5';
    }
    if (isCurrent && hasPendingChange) {
      return 'border-tis-green/30 bg-white';
    }
    return 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md';
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };

  return (
    <div className="flex flex-col">
      {/* Main Card */}
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
          ${isExpanded ? 'rounded-b-none border-b-0' : ''}
        `}
        whileHover={!disabled ? { y: -2 } : undefined}
        whileTap={!disabled ? { scale: 0.98 } : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div
            className={`
              ${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-lg flex items-center justify-center text-white
              bg-gradient-to-br ${gradientClass}
              shadow-md
            `}
          >
            {getIconForType(type.iconName)}
          </div>

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

        {/* Features list */}
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

        {/* Selection indicator */}
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

        {/* Footer with stats and expand button */}
        <div className={`mt-3 pt-2 border-t border-slate-100 flex items-center justify-between`}>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="capitalize">{type.level}</span>
            <span>{type.maxCallDurationSeconds / 60} min</span>
          </div>

          {/* Capabilities/Tools count badges */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
              <Zap className="w-3 h-3" />
              {capabilities.length}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-100 rounded">
              <Wrench className="w-3 h-3" />
              {tools.length}
            </span>
          </div>
        </div>
      </motion.button>

      {/* Expand/Collapse Button */}
      {showCapabilitiesExpander && !compact && (
        <button
          type="button"
          onClick={handleExpandClick}
          className={`
            w-full flex items-center justify-center gap-2 py-2 text-xs font-medium
            transition-all duration-200
            ${isExpanded
              ? 'bg-slate-100 text-slate-700 rounded-b-xl border-2 border-t-0 border-slate-200'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 rounded-b-xl border-2 border-t-0 border-slate-200'
            }
          `}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Ocultar capacidades
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Ver capacidades ({capabilities.length})
            </>
          )}
        </button>
      )}

      {/* Expandable Capabilities Panel */}
      <AnimatePresence>
        {isExpanded && !compact && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-50 border-2 border-t-0 border-slate-200 rounded-b-xl">
              {/* Capabilities Section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-tis-coral" />
                  <span className="text-sm font-semibold text-slate-700">
                    Capacidades ({capabilities.length})
                  </span>
                </div>
                <CapabilitiesGrid
                  vertical={vertical}
                  includedCapabilities={capabilities}
                  showCategories={true}
                  compact={true}
                />
              </div>

              {/* Tools Section */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-700">
                    Herramientas ({tools.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tools.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center px-2 py-1 text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
  showCapabilitiesExpander = true,
}: AssistantTypeSelectorProps) {
  // State for expanded panel
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  // Get available types for this vertical
  const assistantTypes = useMemo(() => {
    return getActiveTypesForVertical(vertical);
  }, [vertical]);

  // Determinar si hay un cambio pendiente
  const hasPendingChange = pendingTypeId !== null && pendingTypeId !== undefined && pendingTypeId !== currentTypeId;

  // El tipo visualmente "seleccionado" es el pendiente si existe, sino el actual
  const visuallySelectedTypeId = hasPendingChange ? pendingTypeId : currentTypeId;

  const handleSelectType = useCallback((typeId: string) => {
    if (disabled) return;
    if (typeId === visuallySelectedTypeId) return;
    onTypeChange(typeId);
  }, [disabled, visuallySelectedTypeId, onTypeChange]);

  const handleToggleExpand = useCallback((typeId: string) => {
    setExpandedTypeId((prev) => (prev === typeId ? null : typeId));
  }, []);

  return (
    <div className="space-y-4">
      {/* Type cards grid */}
      <div className={`grid gap-4 ${compact ? 'grid-cols-3' : 'md:grid-cols-3'}`}>
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
            showCapabilitiesExpander={showCapabilitiesExpander}
            isExpanded={expandedTypeId === type.id}
            onToggleExpand={() => handleToggleExpand(type.id)}
            vertical={vertical}
          />
        ))}
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-tis-coral" />
            <span>Capacidades</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-violet-500" />
            <span>Herramientas</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssistantTypeSelector;
