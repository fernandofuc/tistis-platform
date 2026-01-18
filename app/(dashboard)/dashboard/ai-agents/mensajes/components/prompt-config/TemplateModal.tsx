// =====================================================
// TIS TIS PLATFORM - Template Modal Component
// Modal for creating/editing response templates
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { CharacterCountBar } from '../shared';
import {
  RESPONSE_TEMPLATE_TYPES,
  TEMPLATE_VARIABLES,
  detectTemplateVariables,
  type ResponseTemplateTriggerType,
} from '../shared/config';
import type { ResponseTemplate } from './TemplateCard';

// ======================
// ICONS FOR TEMPLATE TYPES - Premium Design
// ======================
const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
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
  appointment_confirm: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  ),
  pricing_inquiry: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  emergency: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  out_of_hours: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  follow_up: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
    </svg>
  ),
  promotion: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  custom: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
};

// Default icon for unknown types
const DefaultTemplateIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);

// ======================
// TYPES
// ======================
interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TemplateFormData) => Promise<boolean>;
  template?: ResponseTemplate | null;
  colorScheme?: 'purple' | 'orange';
  existingTypes?: string[];
}

export interface TemplateFormData {
  id?: string;
  trigger_type: string;
  name: string;
  template_text: string;
  variables_available: string[];
  is_active: boolean;
}

// ======================
// COMPONENT
// ======================
export function TemplateModal({
  isOpen,
  onClose,
  onSave,
  template,
  colorScheme: _colorScheme = 'purple', // Deprecated: now using unified TIS TIS colors
  existingTypes = [],
}: TemplateModalProps) {
  // Form state
  const [step, setStep] = useState<1 | 2>(template ? 2 : 1);
  const [selectedType, setSelectedType] = useState<string>(template?.trigger_type || '');
  const [name, setName] = useState(template?.name || '');
  const [templateText, setTemplateText] = useState(template?.template_text || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoreTypes, setShowMoreTypes] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  // Get selected type info
  const selectedTypeInfo = RESPONSE_TEMPLATE_TYPES.find(t => t.key === selectedType);

  // Determine if this is an edit (has valid ID) or new/duplicate (no ID)
  const isEditing = Boolean(template?.id && template.id.trim() !== '');
  const isDuplicating = Boolean(template && (!template.id || template.id.trim() === ''));

  // Detected variables in current text
  const detectedVariables = detectTemplateVariables(templateText);

  // Colors - TIS TIS Premium Design System
  const colors = {
    button: 'bg-[#FF6B5B] hover:bg-[#e55a4a]',
    buttonSecondary: 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300',
    selected: 'border-[#FF6B5B] bg-[#FFF5F4] ring-1 ring-[#FF6B5B]/20',
    text: 'text-[#FF6B5B]',
    ring: 'focus:ring-[#FF6B5B]',
    iconBg: 'bg-[#FFF5F4]',
    iconColor: 'text-[#FF6B5B]',
    variable: 'bg-[#FFF5F4] text-[#FF6B5B] hover:bg-[#FFE8E5]',
  };

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (template) {
        setStep(2);
        setSelectedType(template.trigger_type);
        setName(template.name);
        setTemplateText(template.template_text);
      } else {
        setStep(1);
        setSelectedType('');
        setName('');
        setTemplateText('');
      }
      setError(null);
      setShowMoreTypes(false);
      setShowVariables(false);
    }
  }, [isOpen, template]);

  // Handle type selection
  const handleSelectType = useCallback((typeKey: string) => {
    setSelectedType(typeKey);
    const typeInfo = RESPONSE_TEMPLATE_TYPES.find(t => t.key === typeKey);
    if (typeInfo && !name) {
      setName(typeInfo.label);
    }
    if (typeInfo && !templateText) {
      setTemplateText(typeInfo.placeholder);
    }
    setStep(2);
  }, [name, templateText]);

  // Insert variable at cursor
  const insertVariable = useCallback((variable: string) => {
    setTemplateText(prev => prev + variable);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validation
    if (!selectedType) {
      setError('Selecciona un tipo de plantilla');
      return;
    }
    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }
    if (!templateText.trim()) {
      setError('El contenido de la plantilla es requerido');
      return;
    }
    if (templateText.length > (selectedTypeInfo?.maxLength || 600)) {
      setError(`La plantilla no puede exceder ${selectedTypeInfo?.maxLength || 600} caracteres`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Only include ID if it's a valid (non-empty) string - supports duplication
      const templateId = template?.id && template.id.trim() !== '' ? template.id : undefined;

      const data: TemplateFormData = {
        id: templateId,
        trigger_type: selectedType,
        name: name.trim(),
        template_text: templateText.trim(),
        variables_available: detectedVariables,
        is_active: template?.is_active ?? true,
      };

      const success = await onSave(data);
      if (success) {
        onClose();
      } else {
        setError('Error al guardar. Intenta de nuevo.');
      }
    } catch (err) {
      setError('Error al guardar la plantilla');
    } finally {
      setIsSaving(false);
    }
  }, [selectedType, name, templateText, template, onSave, onClose, selectedTypeInfo, detectedVariables]);

  // Get recommended and other types
  const recommendedTypes = RESPONSE_TEMPLATE_TYPES.filter(t => t.recommended);
  const otherTypes = RESPONSE_TEMPLATE_TYPES.filter(t => !t.recommended);

  // Group variables by category
  const variablesByCategory = TEMPLATE_VARIABLES.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, typeof TEMPLATE_VARIABLES>);

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
          {/* Header - Clean Apple-style design */}
          <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center',
                  colors.iconBg
                )}>
                  <svg className={cn('w-6 h-6', colors.iconColor)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {isEditing ? 'Editar Plantilla' : isDuplicating ? 'Duplicar Plantilla' : 'Nueva Plantilla'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {isDuplicating
                      ? 'Crea una copia de la plantilla existente'
                      : 'Respuestas predefinidas para situaciones comunes'}
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
                  <span>¿Qué tipo de plantilla?</span>
                </div>

                {/* Recommended Types - Premium Card Design */}
                <div className="space-y-2">
                  {recommendedTypes.map((type) => {
                    const isUsed = existingTypes.includes(type.key) && !template;
                    const TypeIcon = TEMPLATE_ICONS[type.key] || DefaultTemplateIcon;
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
                        const isUsed = existingTypes.includes(type.key) && !template;
                        const TypeIcon = TEMPLATE_ICONS[type.key] || DefaultTemplateIcon;
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
                  <span>Configura tu plantilla</span>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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

                {/* Template Content */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Contenido de la Plantilla
                  </label>
                  <textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder={selectedTypeInfo?.placeholder || 'Escribe tu plantilla...'}
                    rows={5}
                    className={cn(
                      'w-full px-4 py-3 bg-slate-50 border rounded-xl',
                      'text-slate-900 placeholder:text-slate-400 resize-none',
                      'focus:ring-2 focus:border-transparent transition-all',
                      colors.ring,
                      templateText.length > (selectedTypeInfo?.maxLength || 600) * 0.9
                        ? 'border-red-300 focus:ring-red-500'
                        : templateText.length > (selectedTypeInfo?.maxLength || 600) * 0.7
                          ? 'border-amber-300 focus:ring-amber-500'
                          : 'border-slate-200'
                    )}
                    maxLength={selectedTypeInfo?.maxLength || 600}
                  />

                  {/* Character Count Bar */}
                  <div className="mt-2">
                    <CharacterCountBar
                      current={templateText.length}
                      max={selectedTypeInfo?.maxLength || 600}
                      showWarningAt={70}
                      showDangerAt={90}
                    />
                  </div>

                  {/* Detected Variables */}
                  {detectedVariables.length > 0 && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium text-emerald-700">
                          Variables detectadas ({detectedVariables.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {detectedVariables.map((variable) => (
                          <span
                            key={variable}
                            className="px-2 py-1 text-xs font-mono bg-white border border-emerald-200 rounded text-emerald-700"
                          >
                            {variable}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-emerald-600 mt-2">
                        Estas variables se reemplazarán automáticamente con datos reales
                      </p>
                    </div>
                  )}
                </div>

                {/* Variables Helper */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowVariables(!showVariables)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF6B5B]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-gray-700">Variables disponibles</span>
                    </div>
                    <motion.div
                      animate={{ rotate: showVariables ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gray-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {showVariables && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-3 border-t border-slate-200 space-y-3">
                          <p className="text-xs text-slate-500">
                            Haz clic en una variable para insertarla en tu plantilla
                          </p>
                          {Object.entries(variablesByCategory).map(([category, variables]) => (
                            <div key={category}>
                              <p className="text-xs font-medium text-slate-600 mb-1.5">{category}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {variables.map((variable) => (
                                  <button
                                    key={variable.key}
                                    onClick={() => insertVariable(variable.key)}
                                    className={cn(
                                      'px-2 py-1 text-xs font-mono rounded-lg transition-colors',
                                      colors.variable
                                    )}
                                    title={variable.description}
                                  >
                                    {variable.key}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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

          {/* Footer - Premium Apple-style */}
          <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
            {step === 2 && !template ? (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors min-h-[44px] active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Cambiar tipo
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 md:flex-none px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium transition-all active:scale-[0.98]"
              >
                Cancelar
              </button>
            )}

            <div className="flex items-center gap-3 flex-1 md:flex-none justify-end">
              {step === 2 && (isEditing || isDuplicating) && (
                <button
                  onClick={onClose}
                  className="hidden md:flex px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 font-medium transition-all active:scale-[0.98]"
                >
                  Cancelar
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={handleSave}
                  disabled={isSaving || !name.trim() || !templateText.trim()}
                  className={cn(
                    'flex-1 md:flex-none px-5 py-2.5 min-h-[44px] rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]',
                    isSaving || !name.trim() || !templateText.trim()
                      ? 'bg-gray-300 cursor-not-allowed shadow-none'
                      : `${colors.button} shadow-[#FF6B5B]/25`
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{isEditing ? 'Guardar' : isDuplicating ? 'Duplicar' : 'Crear'}</span>
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

export default TemplateModal;
