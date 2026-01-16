// =====================================================
// TIS TIS PLATFORM - Instruction Modal Component
// Modal for creating/editing prompt instructions
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { icons, CharacterCountBar } from '../shared';
import {
  PROMPT_INSTRUCTION_TYPES,
  getInstructionsByCategory,
  INSTRUCTION_CATEGORY_LABELS,
  type PromptInstructionType,
} from '../shared/config';
import type { Instruction } from './InstructionCard';

// ======================
// TYPES
// ======================
interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InstructionFormData) => Promise<boolean>;
  instruction?: Instruction | null;
  colorScheme?: 'purple' | 'orange';
  profileType: 'business' | 'personal';
  existingTypes?: string[];
}

export interface InstructionFormData {
  id?: string;
  instruction_type: string;
  title: string;
  instruction: string;
  examples?: string;
  priority: number;
  include_in_prompt: boolean;
  profile_type: 'business' | 'personal';
}

// ======================
// COMPONENT
// ======================
export function InstructionModal({
  isOpen,
  onClose,
  onSave,
  instruction,
  colorScheme = 'purple',
  profileType,
  existingTypes = [],
}: InstructionModalProps) {
  // Form state
  const [step, setStep] = useState<1 | 2>(instruction ? 2 : 1);
  const [selectedType, setSelectedType] = useState<string>(instruction?.instruction_type || '');
  const [title, setTitle] = useState(instruction?.title || '');
  const [content, setContent] = useState(instruction?.instruction || '');
  const [examples, setExamples] = useState(instruction?.examples || '');
  const [priority, setPriority] = useState(instruction?.priority || 0);
  const [includeInPrompt, setIncludeInPrompt] = useState(instruction?.include_in_prompt ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  // Get selected type info
  const selectedTypeInfo = PROMPT_INSTRUCTION_TYPES.find(t => t.key === selectedType);
  const instructionsByCategory = getInstructionsByCategory();

  // Colors
  const colors = colorScheme === 'purple'
    ? {
        gradient: 'from-purple-600 to-indigo-600',
        button: 'bg-purple-600 hover:bg-purple-700',
        buttonSecondary: 'border-purple-300 text-purple-700 hover:bg-purple-50',
        selected: 'border-purple-500 bg-purple-50',
        text: 'text-purple-700',
        ring: 'focus:ring-purple-500',
      }
    : {
        gradient: 'from-orange-500 to-pink-500',
        button: 'bg-orange-500 hover:bg-orange-600',
        buttonSecondary: 'border-orange-300 text-orange-700 hover:bg-orange-50',
        selected: 'border-orange-500 bg-orange-50',
        text: 'text-orange-700',
        ring: 'focus:ring-orange-500',
      };

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (instruction) {
        setStep(2);
        setSelectedType(instruction.instruction_type);
        setTitle(instruction.title);
        setContent(instruction.instruction);
        setExamples(instruction.examples || '');
        setPriority(instruction.priority);
        setIncludeInPrompt(instruction.include_in_prompt);
      } else {
        setStep(1);
        setSelectedType('');
        setTitle('');
        setContent('');
        setExamples('');
        setPriority(0);
        setIncludeInPrompt(true);
      }
      setError(null);
      setShowMoreTypes(false);
    }
  }, [isOpen, instruction]);

  // Handle type selection
  const handleSelectType = useCallback((typeKey: string) => {
    setSelectedType(typeKey);
    const typeInfo = PROMPT_INSTRUCTION_TYPES.find(t => t.key === typeKey);
    if (typeInfo && !title) {
      setTitle(typeInfo.label);
    }
    setStep(2);
  }, [title]);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validation
    if (!selectedType) {
      setError('Selecciona un tipo de instrucción');
      return;
    }
    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }
    if (!content.trim()) {
      setError('La instrucción es requerida');
      return;
    }
    if (content.length > (selectedTypeInfo?.maxLength || 500)) {
      setError(`La instrucción no puede exceder ${selectedTypeInfo?.maxLength || 500} caracteres`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const data: InstructionFormData = {
        id: instruction?.id,
        instruction_type: selectedType,
        title: title.trim(),
        instruction: content.trim(),
        examples: examples.trim() || undefined,
        priority,
        include_in_prompt: includeInPrompt,
        profile_type: profileType,
      };

      const success = await onSave(data);
      if (success) {
        onClose();
      } else {
        setError('Error al guardar. Intenta de nuevo.');
      }
    } catch (err) {
      setError('Error al guardar la instrucción');
    } finally {
      setIsSaving(false);
    }
  }, [selectedType, title, content, examples, priority, includeInPrompt, instruction, profileType, onSave, onClose, selectedTypeInfo]);

  // Get recommended and other types
  const recommendedTypes = PROMPT_INSTRUCTION_TYPES.filter(t => t.recommended);
  const otherTypes = PROMPT_INSTRUCTION_TYPES.filter(t => !t.recommended);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Mobile drag indicator */}
          <div className="md:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          <div className={cn(
            'px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r text-white',
            colors.gradient
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  {icons.documentText}
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {instruction ? 'Editar Instrucción' : 'Nueva Instrucción'}
                  </h2>
                  <p className="text-sm text-white/80">
                    Define cómo debe comportarse tu asistente
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                {icons.x}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            {/* Step 1: Select Type */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-medium">
                    1
                  </span>
                  <span>¿Qué tipo de instrucción?</span>
                </div>

                {/* Recommended Types */}
                <div className="space-y-2">
                  {recommendedTypes.map((type) => {
                    const isUsed = existingTypes.includes(type.key) && !instruction;
                    return (
                      <button
                        key={type.key}
                        onClick={() => !isUsed && handleSelectType(type.key)}
                        disabled={isUsed}
                        className={cn(
                          'w-full p-3 rounded-xl border-2 text-left transition-all',
                          selectedType === type.key
                            ? colors.selected
                            : isUsed
                              ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                              : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-900">{type.label}</span>
                          {isUsed && (
                            <span className="text-xs text-slate-400">Ya existe</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">{type.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Show More Button */}
                <button
                  onClick={() => setShowMoreTypes(!showMoreTypes)}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1"
                >
                  {showMoreTypes ? 'Ver menos opciones' : 'Ver más opciones...'}
                  <motion.span
                    animate={{ rotate: showMoreTypes ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {icons.chevronDown}
                  </motion.span>
                </button>

                {/* Other Types */}
                <AnimatePresence>
                  {showMoreTypes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {otherTypes.map((type) => {
                        const isUsed = existingTypes.includes(type.key) && !instruction;
                        return (
                          <button
                            key={type.key}
                            onClick={() => !isUsed && handleSelectType(type.key)}
                            disabled={isUsed}
                            className={cn(
                              'w-full p-3 rounded-xl border-2 text-left transition-all',
                              selectedType === type.key
                                ? colors.selected
                                : isUsed
                                  ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                  : 'border-slate-200 hover:border-slate-300'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-900">{type.label}</span>
                              {isUsed && (
                                <span className="text-xs text-slate-400">Ya existe</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">{type.description}</p>
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Step 2: Fill Details */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Step indicator */}
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-medium">
                    2
                  </span>
                  <span>Nombre de la instrucción</span>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Título
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={selectedTypeInfo?.label || 'Nombre descriptivo'}
                    className={cn(
                      'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl',
                      'text-slate-900 placeholder:text-slate-400',
                      'focus:ring-2 focus:border-transparent transition-all',
                      colors.ring
                    )}
                    maxLength={100}
                  />
                </div>

                {/* Instruction Content */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Instrucción
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={selectedTypeInfo?.placeholder || 'Escribe la instrucción...'}
                    rows={4}
                    className={cn(
                      'w-full px-4 py-3 bg-slate-50 border rounded-xl',
                      'text-slate-900 placeholder:text-slate-400 resize-none',
                      'focus:ring-2 focus:border-transparent transition-all',
                      colors.ring,
                      content.length > (selectedTypeInfo?.maxLength || 500) * 0.9
                        ? 'border-red-300 focus:ring-red-500'
                        : content.length > (selectedTypeInfo?.maxLength || 500) * 0.7
                          ? 'border-amber-300 focus:ring-amber-500'
                          : 'border-slate-200'
                    )}
                    maxLength={selectedTypeInfo?.maxLength || 500}
                  />
                  <div className="mt-2">
                    <CharacterCountBar
                      current={content.length}
                      max={selectedTypeInfo?.maxLength || 500}
                      showWarningAt={70}
                      showDangerAt={90}
                    />
                  </div>
                </div>

                {/* Examples (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ejemplos <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={examples}
                    onChange={(e) => setExamples(e.target.value)}
                    placeholder="Ej: En lugar de decir 'No sé', decir 'Permíteme verificar esa información'"
                    rows={2}
                    className={cn(
                      'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl',
                      'text-slate-900 placeholder:text-slate-400 resize-none',
                      'focus:ring-2 focus:border-transparent transition-all',
                      colors.ring
                    )}
                    maxLength={300}
                  />
                </div>

                {/* Priority Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Prioridad
                    </label>
                    <span className={cn('text-sm font-medium', colors.text)}>
                      {priority === 0 ? 'Normal' : priority <= 3 ? 'Media' : priority <= 6 ? 'Alta' : 'Máxima'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Las instrucciones de mayor prioridad aparecen primero en el prompt
                  </p>
                </div>

                {/* Include in Prompt Toggle */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="font-medium text-slate-900">Incluir en Prompt Inicial</span>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Esta instrucción se incluirá directamente en el prompt del agente
                      </p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={includeInPrompt}
                        onChange={(e) => setIncludeInPrompt(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={cn(
                        'w-11 h-6 rounded-full transition-colors',
                        includeInPrompt ? 'bg-emerald-500' : 'bg-slate-200'
                      )} />
                      <div className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                        includeInPrompt && 'translate-x-5'
                      )} />
                    </div>
                  </label>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 md:px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
            {step === 2 && !instruction ? (
              <button
                onClick={() => setStep(1)}
                className="px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 transition-colors min-h-[44px]"
              >
                ← Cambiar tipo
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 md:flex-none px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
              >
                Cancelar
              </button>
            )}

            <div className="flex items-center gap-3 flex-1 md:flex-none justify-end">
              {step === 2 && instruction && (
                <button
                  onClick={onClose}
                  className="hidden md:flex px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
                >
                  Cancelar
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleSave}
                  disabled={isSaving || !title.trim() || !content.trim()}
                  className={cn(
                    'flex-1 md:flex-none px-5 py-2.5 min-h-[44px] rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all',
                    isSaving || !title.trim() || !content.trim()
                      ? 'bg-slate-300 cursor-not-allowed'
                      : colors.button
                  )}
                >
                  {isSaving ? (
                    <>
                      {icons.spinner}
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      {icons.check}
                      <span>{instruction ? 'Guardar' : 'Crear'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default InstructionModal;
