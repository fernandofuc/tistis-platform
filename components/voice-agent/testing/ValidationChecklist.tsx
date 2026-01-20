/**
 * TIS TIS Platform - Voice Agent Testing v2.0
 * ValidationChecklist Component
 *
 * Automated checklist showing validation status for
 * voice agent configuration before deployment.
 */

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  SparklesIcon,
  VolumeIcon,
  MessageSquareIcon,
  PhoneCallIcon,
  ShieldIcon,
  ZapIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';

// =====================================================
// TYPES
// =====================================================

export type ValidationStatus = 'pending' | 'checking' | 'passed' | 'failed' | 'warning';

export interface ValidationItem {
  id: string;
  title: string;
  description: string;
  status: ValidationStatus;
  message?: string;
  icon: React.ReactNode;
}

export interface ValidationChecklistProps {
  /** List of validations */
  validations: ValidationItem[];
  /** Overall progress (0-100) */
  progress?: number;
  /** Whether validation is in progress */
  isValidating?: boolean;
  /** Callback to start validation */
  onValidate?: () => void;
  /** Callback to retry failed validations */
  onRetry?: () => void;
  /** Additional className */
  className?: string;
}

// =====================================================
// STATUS ICON
// =====================================================

function StatusIcon({ status }: { status: ValidationStatus }) {
  switch (status) {
    case 'passed':
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    case 'failed':
      return <XCircleIcon className="w-5 h-5 text-red-500" />;
    case 'warning':
      return <AlertCircleIcon className="w-5 h-5 text-amber-500" />;
    case 'checking':
      return <LoaderIcon className="w-5 h-5 text-tis-purple animate-spin" />;
    default:
      return <div className="w-5 h-5 rounded-full border-2 border-slate-300" />;
  }
}

// =====================================================
// VALIDATION ITEM ROW
// =====================================================

interface ValidationRowProps {
  item: ValidationItem;
  index: number;
}

function ValidationRow({ item, index }: ValidationRowProps) {
  const bgColor = {
    passed: 'bg-green-50 border-green-200',
    failed: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    checking: 'bg-purple-50 border-purple-200',
    pending: 'bg-white border-slate-200',
  }[item.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`
        flex items-start gap-4 p-4 rounded-xl border
        ${bgColor}
      `}
    >
      {/* Icon */}
      <div
        className={`
          w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
          ${item.status === 'passed' ? 'bg-green-100 text-green-600' :
            item.status === 'failed' ? 'bg-red-100 text-red-600' :
            item.status === 'warning' ? 'bg-amber-100 text-amber-600' :
            item.status === 'checking' ? 'bg-purple-100 text-tis-purple' :
            'bg-slate-100 text-slate-500'
          }
        `}
      >
        {item.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-slate-900">{item.title}</h4>
          <StatusIcon status={item.status} />
        </div>
        <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
        {item.message && (
          <p
            className={`
              text-xs mt-2 px-2 py-1 rounded
              ${item.status === 'passed' ? 'bg-green-100 text-green-700' :
                item.status === 'failed' ? 'bg-red-100 text-red-700' :
                item.status === 'warning' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }
            `}
          >
            {item.message}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// =====================================================
// PROGRESS BAR
// =====================================================

interface ProgressBarProps {
  progress: number;
  validations: ValidationItem[];
}

function ProgressBar({ progress, validations }: ProgressBarProps) {
  const passed = validations.filter((v) => v.status === 'passed').length;
  const failed = validations.filter((v) => v.status === 'failed').length;
  const warnings = validations.filter((v) => v.status === 'warning').length;
  const total = validations.length;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            failed > 0 ? 'bg-gradient-to-r from-tis-coral to-red-500' :
            warnings > 0 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
            'bg-gradient-to-r from-green-400 to-green-500'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircleIcon className="w-3 h-3" />
            {passed} pasadas
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircleIcon className="w-3 h-3" />
              {failed} fallidas
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertCircleIcon className="w-3 h-3" />
              {warnings} advertencias
            </span>
          )}
        </div>
        <span className="text-slate-500">{passed}/{total} completadas</span>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ValidationChecklist({
  validations,
  progress = 0,
  isValidating = false,
  onValidate,
  onRetry,
  className = '',
}: ValidationChecklistProps) {
  // Calculate summary
  const summary = useMemo(() => {
    const passed = validations.filter((v) => v.status === 'passed').length;
    const failed = validations.filter((v) => v.status === 'failed').length;
    const warnings = validations.filter((v) => v.status === 'warning').length;

    return {
      passed,
      failed,
      warnings,
      allPassed: failed === 0 && warnings === 0,
      canDeploy: failed === 0,
    };
  }, [validations]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Validación de Configuración
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Verifica que todo esté listo para activar
            </p>
          </div>

          {/* Action button */}
          {onValidate && !isValidating && progress === 0 && (
            <motion.button
              type="button"
              onClick={onValidate}
              className="px-4 py-2 bg-tis-purple text-white rounded-xl text-sm font-medium hover:bg-tis-purple-dark transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Validar
            </motion.button>
          )}

          {onRetry && summary.failed > 0 && !isValidating && (
            <motion.button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Reintentar
            </motion.button>
          )}
        </div>

        {/* Progress */}
        <ProgressBar progress={progress} validations={validations} />
      </div>

      {/* Validations list */}
      <div className="p-4 space-y-3">
        {validations.map((item, index) => (
          <ValidationRow key={item.id} item={item} index={index} />
        ))}
      </div>

      {/* Summary footer */}
      {progress === 100 && (
        <div
          className={`
            p-4 border-t
            ${summary.allPassed
              ? 'bg-green-50 border-green-200'
              : summary.canDeploy
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
            }
          `}
        >
          <div className="flex items-center gap-3">
            {summary.allPassed ? (
              <>
                <SparklesIcon className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">
                    ¡Listo para activar!
                  </p>
                  <p className="text-sm text-green-600">
                    Todas las validaciones pasaron correctamente
                  </p>
                </div>
              </>
            ) : summary.canDeploy ? (
              <>
                <AlertCircleIcon className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800">
                    Puedes activar con advertencias
                  </p>
                  <p className="text-sm text-amber-600">
                    Hay {summary.warnings} advertencias que podrías revisar
                  </p>
                </div>
              </>
            ) : (
              <>
                <XCircleIcon className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">
                    No se puede activar aún
                  </p>
                  <p className="text-sm text-red-600">
                    Hay {summary.failed} validaciones fallidas que debes corregir
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// =====================================================
// DEFAULT VALIDATIONS
// =====================================================

/**
 * Create default validation items for voice agent
 */
export function createDefaultValidations(): ValidationItem[] {
  return [
    {
      id: 'name',
      title: 'Nombre del Asistente',
      description: 'El asistente tiene un nombre configurado',
      status: 'pending',
      icon: <SparklesIcon className="w-5 h-5" />,
    },
    {
      id: 'voice',
      title: 'Voz Seleccionada',
      description: 'Se ha seleccionado una voz para el asistente',
      status: 'pending',
      icon: <VolumeIcon className="w-5 h-5" />,
    },
    {
      id: 'greeting',
      title: 'Mensaje de Bienvenida',
      description: 'El mensaje inicial está configurado correctamente',
      status: 'pending',
      icon: <MessageSquareIcon className="w-5 h-5" />,
    },
    {
      id: 'prompt',
      title: 'Prompt del Sistema',
      description: 'Las instrucciones del asistente están definidas',
      status: 'pending',
      icon: <MessageSquareIcon className="w-5 h-5" />,
    },
    {
      id: 'phone',
      title: 'Número de Teléfono',
      description: 'Se ha solicitado o asignado un número',
      status: 'pending',
      icon: <PhoneCallIcon className="w-5 h-5" />,
    },
    {
      id: 'api',
      title: 'Conexión API',
      description: 'La conexión con el proveedor de voz funciona',
      status: 'pending',
      icon: <ZapIcon className="w-5 h-5" />,
    },
    {
      id: 'privacy',
      title: 'Configuración de Privacidad',
      description: 'Las opciones de grabación y datos están configuradas',
      status: 'pending',
      icon: <ShieldIcon className="w-5 h-5" />,
    },
  ];
}

export default ValidationChecklist;
