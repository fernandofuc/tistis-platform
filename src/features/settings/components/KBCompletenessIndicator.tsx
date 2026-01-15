// =====================================================
// TIS TIS PLATFORM - KB Completeness Indicator
// Shows completion status of Knowledge Base
// =====================================================

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
interface KBData {
  instructions: Array<{ instruction_type?: string; is_active: boolean }>;
  policies: Array<{ policy_type?: string; is_active: boolean }>;
  articles: Array<{ is_active: boolean }>;
  templates: Array<{ trigger_type?: string; is_active: boolean }>;
  competitors: Array<{ is_active: boolean }>;
}

interface CompletionCheck {
  key: string;
  label: string;
  tip: string;
  check: (data: KBData) => boolean;
  priority: 'essential' | 'recommended' | 'optional';
}

// ======================
// COMPLETION CHECKS
// ======================
const COMPLETION_CHECKS: CompletionCheck[] = [
  // Esenciales
  {
    key: 'identity',
    label: 'Identidad del asistente',
    tip: 'Define quién es tu asistente (nombre, personalidad)',
    check: (data) => data.instructions.some(i => i.instruction_type === 'identity' && i.is_active),
    priority: 'essential',
  },
  {
    key: 'greeting',
    label: 'Saludo configurado',
    tip: 'Crea una plantilla de saludo para nuevas conversaciones',
    check: (data) => data.templates.some(t => t.trigger_type === 'greeting' && t.is_active),
    priority: 'essential',
  },
  {
    key: 'farewell',
    label: 'Despedida configurada',
    tip: 'Define cómo se despide tu asistente',
    check: (data) => data.templates.some(t => t.trigger_type === 'farewell' && t.is_active),
    priority: 'essential',
  },

  // Recomendados
  {
    key: 'cancellation',
    label: 'Política de cancelación',
    tip: 'Informa a los clientes sobre tu política de cancelación de citas',
    check: (data) => data.policies.some(p => p.policy_type === 'cancellation' && p.is_active),
    priority: 'recommended',
  },
  {
    key: 'payment',
    label: 'Política de pagos',
    tip: 'Explica métodos de pago y condiciones',
    check: (data) => data.policies.some(p => p.policy_type === 'payment' && p.is_active),
    priority: 'recommended',
  },
  {
    key: 'communication_style',
    label: 'Estilo de comunicación',
    tip: 'Define cómo debe comunicarse tu asistente',
    check: (data) => data.instructions.some(i => i.instruction_type === 'communication_style' && i.is_active),
    priority: 'recommended',
  },

  // Opcionales pero valiosos
  {
    key: 'articles',
    label: 'Artículos de información',
    tip: 'Agrega información útil sobre tus servicios',
    check: (data) => data.articles.filter(a => a.is_active).length > 0,
    priority: 'optional',
  },
  {
    key: 'competitors',
    label: 'Manejo de competencia',
    tip: 'Define cómo responder cuando mencionen a la competencia',
    check: (data) => data.competitors.filter(c => c.is_active).length > 0,
    priority: 'optional',
  },
  {
    key: 'upselling',
    label: 'Instrucciones de upselling',
    tip: 'Enseña a tu asistente a promocionar servicios premium',
    check: (data) => data.instructions.some(i => i.instruction_type === 'upselling' && i.is_active),
    priority: 'optional',
  },
];

// ======================
// COMPONENT PROPS
// ======================
interface Props {
  data: KBData;
  className?: string;
  compact?: boolean;
}

// ======================
// COMPONENT
// ======================
export function KBCompletenessIndicator({ data, className, compact = false }: Props) {
  const completionStatus = useMemo(() => {
    const results = COMPLETION_CHECKS.map(check => ({
      ...check,
      completed: check.check(data),
    }));

    const essentialChecks = results.filter(r => r.priority === 'essential');
    const recommendedChecks = results.filter(r => r.priority === 'recommended');
    const optionalChecks = results.filter(r => r.priority === 'optional');

    const essentialComplete = essentialChecks.filter(r => r.completed).length;
    const recommendedComplete = recommendedChecks.filter(r => r.completed).length;
    const optionalComplete = optionalChecks.filter(r => r.completed).length;

    // Peso: esenciales 50%, recomendados 35%, opcionales 15%
    // Protección contra división por cero
    const essentialScore = essentialChecks.length > 0
      ? (essentialComplete / essentialChecks.length) * 50
      : 50; // Si no hay esenciales, cuenta como completo
    const recommendedScore = recommendedChecks.length > 0
      ? (recommendedComplete / recommendedChecks.length) * 35
      : 35;
    const optionalScore = optionalChecks.length > 0
      ? (optionalComplete / optionalChecks.length) * 15
      : 15;

    const percentage = Math.round(essentialScore + recommendedScore + optionalScore);

    // Encontrar siguiente tip
    const nextIncomplete = results.find(r => !r.completed && r.priority === 'essential')
      || results.find(r => !r.completed && r.priority === 'recommended')
      || results.find(r => !r.completed);

    return {
      percentage,
      results,
      essentialComplete,
      essentialTotal: essentialChecks.length,
      recommendedComplete,
      recommendedTotal: recommendedChecks.length,
      optionalComplete,
      optionalTotal: optionalChecks.length,
      nextTip: nextIncomplete,
    };
  }, [data]);

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' };
    if (percentage >= 70) return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50' };
    return { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' };
  };

  const colors = getStatusColor(completionStatus.percentage);

  // Compact version for inline display
  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div
          className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={completionStatus.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Completitud de Knowledge Base: ${completionStatus.percentage}%`}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionStatus.percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full rounded-full', colors.bg)}
          />
        </div>
        <span className={cn('text-sm font-medium', colors.text)} aria-hidden="true">
          {completionStatus.percentage}%
        </span>
      </div>
    );
  }

  // Full version
  return (
    <div className={cn('p-5 bg-white rounded-xl border border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">Completitud de tu Base de Conocimiento</h4>
        <span className={cn(
          'px-3 py-1 rounded-full text-sm font-bold',
          colors.light, colors.text
        )}>
          {completionStatus.percentage}%
        </span>
      </div>

      {/* Progress Bar */}
      <div
        className="bg-gray-100 rounded-full h-3 overflow-hidden mb-4"
        role="progressbar"
        aria-valuenow={completionStatus.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Completitud: ${completionStatus.percentage}%`}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${completionStatus.percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', colors.bg)}
        />
      </div>

      {/* Checklist */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4" aria-label="Lista de configuraciones">
        {completionStatus.results.map((item) => (
          <li
            key={item.key}
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg text-sm',
              item.completed ? 'bg-green-50' : 'bg-gray-50'
            )}
          >
            {item.completed ? (
              <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <div className={cn(
                'w-4 h-4 rounded-full border-2 flex-shrink-0',
                item.priority === 'essential' ? 'border-red-300' :
                item.priority === 'recommended' ? 'border-amber-300' : 'border-gray-300'
              )} aria-hidden="true" />
            )}
            <span className={item.completed ? 'text-green-700' : 'text-gray-600'}>
              {item.label}
              <span className="sr-only">{item.completed ? ' - completado' : ' - pendiente'}</span>
            </span>
            {!item.completed && item.priority === 'essential' && (
              <span className="ml-auto text-xs text-red-500 font-medium">Esencial</span>
            )}
          </li>
        ))}
      </ul>

      {/* Next Tip */}
      {completionStatus.nextTip && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200" role="note">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-purple-900">
                Siguiente paso: {completionStatus.nextTip.label}
              </p>
              <p className="text-xs text-purple-700 mt-0.5">
                {completionStatus.nextTip.tip}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 100% Complete Message */}
      {completionStatus.percentage >= 100 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200" role="status">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-800">
              Tu Base de Conocimiento está completa. Tu asistente tiene todo lo necesario.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
