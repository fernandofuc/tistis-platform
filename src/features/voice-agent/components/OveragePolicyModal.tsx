'use client';

// =====================================================
// TIS TIS PLATFORM - Overage Policy Modal
// Modal para configurar política de excedentes
// Sistema: Voice Minute Limits (FASE 4.3)
// =====================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Shield,
  CreditCard,
  Bell,
  Check,
  AlertTriangle,
  Info,
  Loader2,
} from 'lucide-react';
import type { OveragePolicy } from '../types';

// =====================================================
// TYPES
// =====================================================

interface OveragePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPolicy: OveragePolicy;
  overagePricePesos: number;
  includedMinutes: number;
  onSave: (policy: OveragePolicy) => Promise<void>;
}

interface PolicyOption {
  value: OveragePolicy;
  label: string;
  description: string;
  icon: typeof Shield;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  pros: string[];
  cons: string[];
}

// =====================================================
// CONSTANTS
// =====================================================

const TIS_CORAL = 'rgb(223, 115, 115)';
const TIS_PINK = 'rgb(194, 51, 80)';

const POLICY_OPTIONS: PolicyOption[] = [
  {
    value: 'block',
    label: 'Bloquear llamadas',
    description: 'Las llamadas se bloquean al alcanzar el límite. Sin cargos adicionales.',
    icon: Shield,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    pros: ['Control total del presupuesto', 'Sin sorpresas en facturación'],
    cons: ['Clientes no pueden comunicarse', 'Posible pérdida de oportunidades'],
  },
  {
    value: 'charge',
    label: 'Cobrar excedente',
    description: 'Las llamadas continúan y se cobra por minuto adicional.',
    icon: CreditCard,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    pros: ['Servicio ininterrumpido', 'Flexibilidad en picos de demanda'],
    cons: ['Cargos adicionales variables', 'Requiere monitoreo de uso'],
  },
  {
    value: 'notify_only',
    label: 'Solo notificar',
    description: 'Las llamadas continúan gratis pero recibes alertas. Uso de cortesía limitado.',
    icon: Bell,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    pros: ['Sin interrupciones', 'Sin cargos inmediatos'],
    cons: ['Uso de cortesía limitado', 'Revisión manual mensual'],
  },
];

// =====================================================
// COMPONENT
// =====================================================

export function OveragePolicyModal({
  isOpen,
  onClose,
  currentPolicy,
  overagePricePesos,
  includedMinutes,
  onSave,
}: OveragePolicyModalProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<OveragePolicy>(currentPolicy);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset selection and error when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPolicy(currentPolicy);
      setSaveError(null);
    }
  }, [isOpen, currentPolicy]);

  const handleSave = async () => {
    if (selectedPolicy === currentPolicy) {
      onClose();
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(selectedPolicy);
      // Only close on success - onSave should throw on error
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar cambios';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  // Update description with actual price
  const getDescription = (option: PolicyOption): string => {
    if (option.value === 'charge') {
      return `Las llamadas continúan y se cobra $${overagePricePesos.toFixed(2)} MXN por minuto adicional.`;
    }
    return option.description;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={isSaving ? undefined : onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="
              fixed z-50 overflow-hidden
              inset-x-4 top-[5%] max-h-[90vh]
              sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
              sm:w-full sm:max-w-lg sm:max-h-[85vh]
              bg-white rounded-2xl shadow-2xl
              flex flex-col
            "
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h2
                  id="policy-modal-title"
                  className="text-lg sm:text-xl font-bold text-slate-900"
                >
                  Política de Excedentes
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Define qué sucede al alcanzar el límite de minutos
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="
                  p-2 hover:bg-slate-100 rounded-xl transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0
                  flex items-center justify-center
                "
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl mb-5 sm:mb-6">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">
                    Plan Growth: {includedMinutes} minutos incluidos
                  </p>
                  <p className="text-blue-600 text-xs sm:text-sm">
                    Recibirás alertas al 70%, 85% y 95% de uso.
                  </p>
                </div>
              </div>

              {/* Policy options */}
              <div className="space-y-3" role="radiogroup" aria-label="Opciones de política de excedentes">
                {POLICY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedPolicy === option.value;
                  const isCurrent = currentPolicy === option.value;

                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedPolicy(option.value)}
                      disabled={isSaving}
                      className={`
                        w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all
                        min-h-[44px]
                        disabled:opacity-70 disabled:cursor-not-allowed
                        ${isSelected
                          ? 'shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                        }
                      `}
                      style={isSelected ? {
                        borderColor: TIS_CORAL,
                        background: `linear-gradient(to bottom right, ${TIS_CORAL}08, ${TIS_PINK}08)`,
                      } : undefined}
                      role="radio"
                      aria-checked={isSelected}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`
                            w-9 h-9 sm:w-10 sm:h-10 rounded-xl
                            flex items-center justify-center flex-shrink-0
                            ${option.bgColor}
                          `}
                        >
                          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${option.iconColor}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm sm:text-base">
                              {option.label}
                            </span>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${TIS_CORAL} 0%, ${TIS_PINK} 100%)`,
                                }}
                              >
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                            {isCurrent && !isSelected && (
                              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                                Actual
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            {getDescription(option)}
                          </p>

                          {/* Pros/Cons (show when selected) */}
                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="mt-3 pt-3 border-t border-slate-100"
                              >
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="font-medium text-emerald-600 mb-1">Ventajas:</p>
                                    {option.pros.map((pro, i) => (
                                      <p key={i} className="text-slate-600 leading-relaxed">• {pro}</p>
                                    ))}
                                  </div>
                                  <div>
                                    <p className="font-medium text-amber-600 mb-1">Consideraciones:</p>
                                    {option.cons.map((con, i) => (
                                      <p key={i} className="text-slate-600 leading-relaxed">• {con}</p>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Warning for block policy */}
              <AnimatePresence>
                {selectedPolicy === 'block' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-amber-800">
                      Al bloquear llamadas, tus clientes no podrán comunicarse con el agente de voz hasta el próximo ciclo de facturación.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error message */}
              <AnimatePresence>
                {saveError && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl"
                    role="alert"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-red-800">
                      {saveError}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="
                  px-4 py-2.5 text-slate-600 font-medium
                  hover:bg-slate-100 rounded-xl transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  min-h-[44px] sm:min-h-0
                "
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="
                  px-5 sm:px-6 py-2.5 text-white font-medium rounded-xl
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  min-h-[44px] sm:min-h-0
                  flex items-center gap-2
                "
                style={{
                  background: `linear-gradient(135deg, ${TIS_CORAL} 0%, ${TIS_PINK} 100%)`,
                }}
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default OveragePolicyModal;
