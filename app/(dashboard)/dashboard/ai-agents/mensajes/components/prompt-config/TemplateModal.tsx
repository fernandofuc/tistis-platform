// =====================================================
// TIS TIS PLATFORM - Template Modal Component
// Modal for creating/editing response templates
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { icons } from '../shared';
import {
  RESPONSE_TEMPLATE_TYPES,
  getTemplatesByCategory,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_VARIABLES,
  detectTemplateVariables,
  type ResponseTemplateTriggerType,
} from '../shared/config';
import type { ResponseTemplate } from './TemplateCard';

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
  colorScheme = 'purple',
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
  const templatesByCategory = getTemplatesByCategory();

  // Detected variables in current text
  const detectedVariables = detectTemplateVariables(templateText);

  // Colors
  const colors = colorScheme === 'purple'
    ? {
        gradient: 'from-purple-600 to-indigo-600',
        button: 'bg-purple-600 hover:bg-purple-700',
        buttonSecondary: 'border-purple-300 text-purple-700 hover:bg-purple-50',
        selected: 'border-purple-500 bg-purple-50',
        text: 'text-purple-700',
        ring: 'focus:ring-purple-500',
        variable: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
      }
    : {
        gradient: 'from-orange-500 to-pink-500',
        button: 'bg-orange-500 hover:bg-orange-600',
        buttonSecondary: 'border-orange-300 text-orange-700 hover:bg-orange-50',
        selected: 'border-orange-500 bg-orange-50',
        text: 'text-orange-700',
        ring: 'focus:ring-orange-500',
        variable: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
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
      const data: TemplateFormData = {
        id: template?.id,
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-4 bg-gradient-to-r text-white',
            colors.gradient
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  {icons.chat}
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {template ? 'Editar Plantilla' : 'Nueva Plantilla'}
                  </h2>
                  <p className="text-sm text-white/80">
                    Respuestas predefinidas para situaciones comunes
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
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Step 1: Select Type */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-medium">
                    1
                  </span>
                  <span>¿Qué tipo de plantilla?</span>
                </div>

                {/* Recommended Types */}
                <div className="space-y-2">
                  {recommendedTypes.map((type) => {
                    const isUsed = existingTypes.includes(type.key) && !template;
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
                        const isUsed = existingTypes.includes(type.key) && !template;
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Contenido de la Plantilla
                    </label>
                    <span className="text-xs text-slate-400">
                      {templateText.length}/{selectedTypeInfo?.maxLength || 600}
                    </span>
                  </div>
                  <textarea
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    placeholder={selectedTypeInfo?.placeholder || 'Escribe tu plantilla...'}
                    rows={5}
                    className={cn(
                      'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl',
                      'text-slate-900 placeholder:text-slate-400 resize-none',
                      'focus:ring-2 focus:border-transparent transition-all',
                      colors.ring
                    )}
                    maxLength={selectedTypeInfo?.maxLength || 600}
                  />

                  {/* Detected Variables */}
                  {detectedVariables.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-slate-400 mr-1">Variables detectadas:</span>
                      {detectedVariables.map((variable) => (
                        <span
                          key={variable}
                          className={cn(
                            'px-1.5 py-0.5 text-xs font-mono rounded',
                            colors.variable
                          )}
                        >
                          {variable}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variables Helper */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowVariables(!showVariables)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">{icons.info}</span>
                      <span className="text-sm font-medium text-slate-700">Variables disponibles</span>
                    </div>
                    <motion.span
                      animate={{ rotate: showVariables ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-400"
                    >
                      {icons.chevronDown}
                    </motion.span>
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

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            {step === 2 && !template && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Cambiar tipo
              </button>
            )}
            {(step === 1 || template) && <div />}

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-all"
              >
                Cancelar
              </button>
              {step === 2 && (
                <button
                  onClick={handleSave}
                  disabled={isSaving || !name.trim() || !templateText.trim()}
                  className={cn(
                    'px-5 py-2.5 rounded-xl font-medium text-white flex items-center gap-2 transition-all',
                    isSaving || !name.trim() || !templateText.trim()
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
                      <span>{template ? 'Guardar' : 'Crear'}</span>
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
