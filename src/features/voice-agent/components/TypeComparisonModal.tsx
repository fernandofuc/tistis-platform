'use client';

/**
 * TIS TIS Platform - Voice Agent
 * TypeComparisonModal Component
 *
 * Modal that displays a side-by-side comparison of all assistant types
 * showing capabilities, tools, and what's gained/lost when switching types.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Star,
  Minus,
  Zap,
  Wrench,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  getActiveTypesForVertical,
} from '@/lib/voice-agent/types/assistant-types';
import {
  getCapabilitiesForTypeId,
  getToolsForTypeId,
  getAddedCapabilities,
} from '@/lib/voice-agent/types/capability-definitions';
import type { AssistantType, AssistantTypeId } from '@/lib/voice-agent/types';
import {
  CAPABILITY_DISPLAY_NAMES,
} from '../constants/capability-display';

// =====================================================
// TYPES
// =====================================================

interface TypeComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  vertical: 'restaurant' | 'dental' | 'clinic';
  currentTypeId: string | null;
  onSelectType?: (typeId: string) => void;
}

// =====================================================
// COMPONENT
// =====================================================

export function TypeComparisonModal({
  isOpen,
  onClose,
  vertical,
  currentTypeId,
  onSelectType,
}: TypeComparisonModalProps) {
  // Get all types for comparison
  const types = useMemo(() => {
    return getActiveTypesForVertical(vertical);
  }, [vertical]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex items-center justify-center"
          >
            <div className="w-full max-w-6xl max-h-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Comparar Tipos de Asistente
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {vertical === 'restaurant' ? 'Restaurante' : vertical === 'clinic' ? 'Consultorios' : 'Dental'} - Compara capacidades y herramientas
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {/* Types Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {types.map((type) => (
                    <TypeComparisonCard
                      key={type.id}
                      type={type}
                      isCurrent={currentTypeId === type.id}
                      vertical={vertical}
                      onSelect={onSelectType ? () => onSelectType(type.id) : undefined}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-emerald-100 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span>Incluido</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-amber-100 flex items-center justify-center">
                        <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                      </div>
                      <span>Nuevo vs nivel anterior</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center">
                        <Minus className="w-3 h-3 text-slate-400" />
                      </div>
                      <span>No incluido</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// =====================================================
// TYPE COMPARISON CARD
// =====================================================

interface TypeComparisonCardProps {
  type: AssistantType;
  isCurrent: boolean;
  vertical: 'restaurant' | 'dental' | 'clinic';
  onSelect?: () => void;
}

function TypeComparisonCard({
  type,
  isCurrent,
  vertical,
  onSelect,
}: TypeComparisonCardProps) {
  // Get capabilities and tools
  const capabilities = useMemo(() => {
    return getCapabilitiesForTypeId(type.id as AssistantTypeId) || [];
  }, [type.id]);

  const tools = useMemo(() => {
    return getToolsForTypeId(type.id as AssistantTypeId) || [];
  }, [type.id]);

  // Get what's new compared to previous level
  const previousLevel = type.level === 'standard' ? 'basic' : type.level === 'complete' ? 'standard' : null;
  const newCapabilities = useMemo(() => {
    if (!previousLevel) return [];
    return getAddedCapabilities(vertical, previousLevel, type.level);
  }, [vertical, previousLevel, type.level]);

  // Gradient classes
  const gradientClasses = {
    basic: 'from-slate-500 to-slate-600',
    standard: 'from-tis-coral to-tis-pink',
    complete: 'from-violet-500 to-indigo-600',
  };

  const gradientClass = gradientClasses[type.level];

  // Header gradient for cards
  const headerGradients = {
    basic: 'from-slate-50 to-slate-100',
    standard: 'from-coral-50/50 to-pink-50/50',
    complete: 'from-violet-50/50 to-indigo-50/50',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        flex flex-col rounded-xl border-2 overflow-hidden
        ${isCurrent
          ? 'border-tis-green shadow-lg ring-2 ring-tis-green/20'
          : 'border-slate-200 hover:border-slate-300'
        }
      `}
    >
      {/* Header */}
      <div className={`p-4 bg-gradient-to-br ${headerGradients[type.level]}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Icon */}
          <div
            className={`
              w-10 h-10 rounded-lg flex items-center justify-center text-white
              bg-gradient-to-br ${gradientClass}
              shadow-md
            `}
          >
            {type.level === 'basic' && <Zap className="w-5 h-5" />}
            {type.level === 'standard' && <Sparkles className="w-5 h-5" />}
            {type.level === 'complete' && <Star className="w-5 h-5" />}
          </div>

          {/* Badges */}
          <div className="flex flex-col gap-1 items-end">
            {type.isRecommended && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
                <Sparkles className="w-3 h-3" />
                Recomendado
              </span>
            )}
            {isCurrent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-tis-green bg-tis-green/10 rounded-full">
                <Check className="w-3 h-3" />
                Actual
              </span>
            )}
          </div>
        </div>

        <h3 className="font-bold text-slate-900 text-lg">{type.displayName}</h3>
        <p className="text-sm text-slate-500 mt-0.5">{type.description}</p>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-200/50">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{type.maxCallDurationSeconds / 60} min</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Zap className="w-3.5 h-3.5" />
            <span>{capabilities.length} cap.</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Wrench className="w-3.5 h-3.5" />
            <span>{tools.length} tools</span>
          </div>
        </div>
      </div>

      {/* Capabilities List */}
      <div className="flex-1 p-4 bg-white">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
          Capacidades
        </h4>
        <div className="space-y-1.5">
          {capabilities.map((cap) => {
            const isNew = newCapabilities.includes(cap);
            return (
              <div
                key={cap}
                className={`
                  flex items-center gap-2 text-xs
                  ${isNew ? 'text-amber-700' : 'text-slate-600'}
                `}
              >
                {isNew ? (
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                )}
                <span className={isNew ? 'font-medium' : ''}>
                  {CAPABILITY_DISPLAY_NAMES[cap]}
                </span>
                {isNew && (
                  <span className="ml-auto px-1 py-0.5 text-[9px] font-bold uppercase bg-amber-100 text-amber-700 rounded">
                    Nuevo
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Action */}
      {onSelect && !isCurrent && (
        <div className="p-4 pt-0">
          <button
            onClick={onSelect}
            className={`
              w-full py-2 px-4 text-sm font-medium rounded-lg
              transition-all duration-200
              ${type.level === 'standard'
                ? 'bg-gradient-to-r from-tis-coral to-tis-pink text-white hover:shadow-lg'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }
            `}
          >
            Seleccionar
          </button>
        </div>
      )}

      {isCurrent && (
        <div className="p-4 pt-0">
          <div className="w-full py-2 px-4 text-sm font-medium text-center rounded-lg bg-tis-green/10 text-tis-green">
            Tipo Actual
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default TypeComparisonModal;
