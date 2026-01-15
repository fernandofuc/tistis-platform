// =====================================================
// TIS TIS PLATFORM - KB Empty State Premium
// Premium empty state component for KB categories
// Part of Knowledge Base Redesign - FASE 3
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { KBCategory } from './KBCategoryNavigation';

// ======================
// TYPES
// ======================
interface Props {
  category: KBCategory;
  onAction: () => void;
  className?: string;
}

// ======================
// CATEGORY CONTENT
// ======================
const CATEGORY_CONTENT: Record<KBCategory, {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  color: {
    gradient: string;
    bg: string;
    text: string;
    buttonGradient: string;
  };
  tips: string[];
}> = {
  instructions: {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Define la mente de tu asistente',
    description: 'Agrega instrucciones para que tu AI sepa exactamente cómo comportarse y responder',
    actionLabel: 'Agregar Instrucción',
    color: {
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      buttonGradient: 'from-violet-600 to-purple-600',
    },
    tips: [
      'Define el tono de voz ideal',
      'Especifica cómo manejar objeciones',
      'Configura comportamientos especiales',
    ],
  },
  policies: {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Establece las reglas del juego',
    description: 'Define las políticas que tu asistente debe comunicar y respetar',
    actionLabel: 'Agregar Política',
    color: {
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      buttonGradient: 'from-emerald-600 to-teal-600',
    },
    tips: [
      'Políticas de cancelación',
      'Condiciones de pago',
      'Garantías y devoluciones',
    ],
  },
  articles: {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Comparte el saber de tu negocio',
    description: 'Agrega información detallada para que tu AI sea un experto en tu empresa',
    actionLabel: 'Agregar Información',
    color: {
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      buttonGradient: 'from-blue-600 to-indigo-600',
    },
    tips: [
      'Historia y diferenciadores',
      'Tecnología utilizada',
      'Equipo y certificaciones',
    ],
  },
  templates: {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    title: 'Dale voz a tu marca',
    description: 'Crea plantillas con las palabras exactas que representan tu negocio',
    actionLabel: 'Agregar Plantilla',
    color: {
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      buttonGradient: 'from-amber-600 to-orange-600',
    },
    tips: [
      'Saludos personalizados',
      'Confirmaciones de cita',
      'Respuestas a preguntas frecuentes',
    ],
  },
  competitors: {
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Prepárate para competir',
    description: 'Define estrategias profesionales para cuando mencionen a tus competidores',
    actionLabel: 'Agregar Competidor',
    color: {
      gradient: 'from-rose-500 to-pink-600',
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      buttonGradient: 'from-rose-600 to-pink-600',
    },
    tips: [
      'Diferenciadores clave',
      'Puntos de valor único',
      'Respuestas diplomáticas',
    ],
  },
};

// ======================
// MAIN COMPONENT
// ======================
export function KBEmptyState({ category, onAction, className }: Props) {
  const content = CATEGORY_CONTENT[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'border-2 border-dashed',
        'border-gray-200',
        'p-8 sm:p-12',
        className
      )}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className={cn(
          'absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl',
          content.color.bg
        )} />
        <div className={cn(
          'absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl',
          content.color.bg
        )} />
      </div>

      <div className="relative flex flex-col items-center text-center max-w-md mx-auto">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center mb-6',
            content.color.bg,
            content.color.text
          )}
        >
          {content.icon}
        </motion.div>

        {/* Title */}
        <h4 className="text-xl font-bold text-gray-900 mb-2">
          {content.title}
        </h4>

        {/* Description */}
        <p className="text-gray-500 mb-6">
          {content.description}
        </p>

        {/* Tips */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {content.tips.map((tip, idx) => (
            <motion.span
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.1 }}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full',
                content.color.bg,
                content.color.text
              )}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {tip}
            </motion.span>
          ))}
        </div>

        {/* Action button */}
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAction}
          className={cn(
            'inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold',
            'shadow-lg transition-all',
            `bg-gradient-to-r ${content.color.buttonGradient}`
          )}
          style={{
            boxShadow: `0 10px 30px -10px ${content.color.gradient.includes('violet') ? 'rgba(139, 92, 246, 0.4)' :
              content.color.gradient.includes('emerald') ? 'rgba(16, 185, 129, 0.4)' :
              content.color.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.4)' :
              content.color.gradient.includes('amber') ? 'rgba(245, 158, 11, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {content.actionLabel}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ======================
// EXPORTS
// ======================
export type { Props as KBEmptyStateProps };
