'use client';

// =====================================================
// TIS TIS PLATFORM - Custom Instructions Section
// Permite al cliente agregar instrucciones personalizadas
// =====================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ======================
// ICONS
// ======================

const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const LightbulbIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6"/>
    <path d="M10 22h4"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L14.5 8.5L20 9L16 13.5L17 19L12 16L7 19L8 13.5L4 9L9.5 8.5L12 3Z"/>
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
);

// ======================
// TYPES
// ======================

interface CustomInstructionsSectionProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving?: boolean;
  isEditing?: boolean;
  onToggleEdit?: () => void;
}

// ======================
// EXAMPLE PROMPTS
// ======================

const EXAMPLE_INSTRUCTIONS = [
  'Siempre ofrece una cita de valoración gratuita para nuevos pacientes.',
  'Menciona que tenemos estacionamiento gratuito.',
  'Si preguntan por precios, menciona que tenemos planes de financiamiento.',
  'Recuerda mencionar nuestra promoción del mes.',
  'Si el cliente parece indeciso, ofrece enviar información por WhatsApp.',
];

// ======================
// COMPONENT
// ======================

export function CustomInstructionsSection({
  value,
  onChange,
  onSave,
  saving = false,
  isEditing = false,
  onToggleEdit,
}: CustomInstructionsSectionProps) {
  const [localValue, setLocalValue] = useState(value);
  const [showExamples, setShowExamples] = useState(false);

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSave = () => {
    onChange(localValue);
    onSave();
  };

  const addExample = (example: string) => {
    const newValue = localValue
      ? `${localValue}\n${example}`
      : example;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const characterCount = localValue?.length || 0;
  const maxCharacters = 1000;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <LightbulbIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Instrucciones Personalizadas</h3>
              <p className="text-sm text-slate-500">Agrega reglas especiales para tu asistente</p>
            </div>
          </div>
          {onToggleEdit && !isEditing && (
            <button
              onClick={onToggleEdit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <EditIcon className="w-4 h-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Info Box */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex items-start gap-3">
            <InfoIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                Estas instrucciones se agregan al prompt del asistente. Usa lenguaje natural para indicar comportamientos específicos.
              </p>
            </div>
          </div>
        </div>

        {isEditing ? (
          <>
            {/* Textarea */}
            <div className="relative">
              <textarea
                value={localValue}
                onChange={(e) => {
                  if (e.target.value.length <= maxCharacters) {
                    setLocalValue(e.target.value);
                  }
                }}
                placeholder="Escribe instrucciones adicionales para tu asistente...

Ejemplos:
- Siempre ofrece una cita de valoración gratuita
- Menciona que tenemos estacionamiento
- Si preguntan por emergencias, da el número de guardia"
                rows={6}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all resize-none"
              />
              <div className="absolute bottom-3 right-3 text-xs text-slate-400">
                {characterCount}/{maxCharacters}
              </div>
            </div>

            {/* Examples Toggle */}
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="mt-3 flex items-center gap-2 text-sm text-tis-coral hover:text-tis-pink transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              {showExamples ? 'Ocultar ejemplos' : 'Ver ejemplos de instrucciones'}
            </button>

            {/* Examples */}
            <AnimatePresence>
              {showExamples && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-2">
                    {EXAMPLE_INSTRUCTIONS.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => addExample(example)}
                        className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-600 transition-colors"
                      >
                        <span className="text-tis-coral mr-2">+</span>
                        {example}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save Button */}
            <div className="mt-6 flex justify-end gap-3">
              {onToggleEdit && (
                <button
                  onClick={onToggleEdit}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-tis-coral to-tis-pink rounded-xl hover:shadow-lg hover:shadow-tis-coral/20 transition-all disabled:opacity-50"
              >
                <SaveIcon className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Display Mode */}
            {localValue ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{localValue}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <LightbulbIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-2">No hay instrucciones personalizadas</p>
                <p className="text-sm text-slate-400">
                  Agrega reglas especiales que tu asistente debe seguir
                </p>
                {onToggleEdit && (
                  <button
                    onClick={onToggleEdit}
                    className="mt-4 px-4 py-2 text-sm font-medium text-tis-coral hover:bg-tis-coral/5 rounded-lg transition-colors"
                  >
                    Agregar instrucciones
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CustomInstructionsSection;
