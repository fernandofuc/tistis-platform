// =====================================================
// TIS TIS PLATFORM - Instruction Modal Component
// Modal for creating/editing prompt instructions
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { CharacterCountBar } from '../shared';
import {
  PROMPT_INSTRUCTION_TYPES,
  type PromptInstructionType,
} from '../shared/config';
import type { Instruction } from './InstructionCard';

// ======================
// ICONS FOR INSTRUCTION TYPES - Premium Design
// ======================
const INSTRUCTION_ICONS: Record<string, React.ReactNode> = {
  identity: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  greeting: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 10-3.15 0v3m3.15-3v-1.5a1.575 1.575 0 013.15 0v1.5m-3.15 0l.075 5.925m3.075.75V4.575m0 0a1.575 1.575 0 013.15 0V15M6.9 7.575a1.575 1.575 0 10-3.15 0v8.175a6.75 6.75 0 006.75 6.75h2.018a5.25 5.25 0 003.712-1.538l1.732-1.732a5.25 5.25 0 001.538-3.712l.003-2.024a.668.668 0 01.198-.471 1.575 1.575 0 10-2.228-2.228 3.818 3.818 0 00-1.12 2.687M6.9 7.575V12m6.27 4.318A4.49 4.49 0 0116.35 15" />
    </svg>
  ),
  farewell: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
    </svg>
  ),
  pricing_policy: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  objections: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  special_cases: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  tone_examples: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  upsell: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  forbidden: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  ),
  always_mention: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  custom: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
};

// Default icon for unknown types
const DefaultIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

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
  colorScheme: _colorScheme = 'purple', // Deprecated: now using unified TIS TIS colors
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

  // Colors - TIS TIS Premium Design System (unified coral theme)
  const colors = {
    button: 'bg-[#FF6B5B] hover:bg-[#e55a4a]',
    buttonSecondary: 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300',
    selected: 'border-[#FF6B5B] bg-[#FFF5F4] ring-1 ring-[#FF6B5B]/20',
    text: 'text-[#FF6B5B]',
    ring: 'focus:ring-[#FF6B5B]',
    iconBg: 'bg-[#FFF5F4]',
    iconColor: 'text-[#FF6B5B]',
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

          {/* Header - Clean Apple-style design */}
          <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center',
                  colors.iconBg
                )}>
                  <svg className={cn('w-6 h-6', colors.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {instruction ? 'Editar Instrucción' : 'Nueva Instrucción'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Define cómo debe comportarse tu asistente
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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

                {/* Recommended Types - Premium Card Design */}
                <div className="space-y-2">
                  {recommendedTypes.map((type) => {
                    const isUsed = existingTypes.includes(type.key) && !instruction;
                    const TypeIcon = INSTRUCTION_ICONS[type.key] || DefaultIcon;
                    return (
                      <button
                        key={type.key}
                        onClick={() => !isUsed && handleSelectType(type.key)}
                        disabled={isUsed}
                        className={cn(
                          'w-full p-4 rounded-2xl border text-left transition-all group',
                          selectedType === type.key
                            ? colors.selected
                            : isUsed
                              ? 'border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-sm'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                            selectedType === type.key
                              ? 'bg-[#FF6B5B] text-white'
                              : isUsed
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-gray-100 text-gray-500 group-hover:bg-[#FFF5F4] group-hover:text-[#FF6B5B]'
                          )}>
                            {TypeIcon}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                'font-medium',
                                selectedType === type.key ? 'text-[#FF6B5B]' : 'text-gray-900'
                              )}>
                                {type.label}
                              </span>
                              {isUsed && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                                  Ya existe
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{type.description}</p>
                          </div>
                          {/* Chevron */}
                          {!isUsed && (
                            <svg className={cn(
                              'w-5 h-5 flex-shrink-0 transition-colors',
                              selectedType === type.key ? 'text-[#FF6B5B]' : 'text-gray-300 group-hover:text-gray-400'
                            )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Show More Button - Subtle divider style */}
                <div className="relative py-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center">
                    <button
                      onClick={() => setShowMoreTypes(!showMoreTypes)}
                      className="px-4 py-2 bg-white text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
                    >
                      {showMoreTypes ? 'Ver menos opciones' : 'Más opciones'}
                      <motion.svg
                        animate={{ rotate: showMoreTypes ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>
                  </div>
                </div>

                {/* Other Types - Same premium design */}
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
                        const TypeIcon = INSTRUCTION_ICONS[type.key] || DefaultIcon;
                        return (
                          <button
                            key={type.key}
                            onClick={() => !isUsed && handleSelectType(type.key)}
                            disabled={isUsed}
                            className={cn(
                              'w-full p-4 rounded-2xl border text-left transition-all group',
                              selectedType === type.key
                                ? colors.selected
                                : isUsed
                                  ? 'border-gray-100 bg-gray-50/50 opacity-60 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 hover:shadow-sm'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                                selectedType === type.key
                                  ? 'bg-[#FF6B5B] text-white'
                                  : isUsed
                                    ? 'bg-gray-100 text-gray-400'
                                    : 'bg-gray-100 text-gray-500 group-hover:bg-[#FFF5F4] group-hover:text-[#FF6B5B]'
                              )}>
                                {TypeIcon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn(
                                    'font-medium',
                                    selectedType === type.key ? 'text-[#FF6B5B]' : 'text-gray-900'
                                  )}>
                                    {type.label}
                                  </span>
                                  {isUsed && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                                      Ya existe
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{type.description}</p>
                              </div>
                              {!isUsed && (
                                <svg className={cn(
                                  'w-5 h-5 flex-shrink-0 transition-colors',
                                  selectedType === type.key ? 'text-[#FF6B5B]' : 'text-gray-300 group-hover:text-gray-400'
                                )} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                              )}
                            </div>
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
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF6B5B]"
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

          {/* Footer - Clean Apple-style */}
          <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
            {step === 2 && !instruction ? (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors min-h-[44px] rounded-xl hover:bg-gray-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                <span>Cambiar tipo</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-5 py-2.5 min-h-[44px] rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 font-medium transition-all"
              >
                Cancelar
              </button>
            )}

            <div className="flex items-center gap-3">
              {step === 2 && instruction && (
                <button
                  onClick={onClose}
                  className="hidden md:flex px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 font-medium transition-all"
                >
                  Cancelar
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleSave}
                  disabled={isSaving || !title.trim() || !content.trim()}
                  className={cn(
                    'px-6 py-2.5 min-h-[44px] rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all shadow-sm',
                    isSaving || !title.trim() || !content.trim()
                      ? 'bg-gray-300 cursor-not-allowed shadow-none'
                      : 'bg-[#FF6B5B] hover:bg-[#e55a4a] hover:shadow-md active:scale-[0.98]'
                  )}
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>{instruction ? 'Guardar cambios' : 'Crear instrucción'}</span>
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
