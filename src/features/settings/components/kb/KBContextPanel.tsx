// =====================================================
// TIS TIS PLATFORM - KB Context Panel
// Contextual explanation panel for each category
// Part of Knowledge Base Redesign - FASE 4
// =====================================================

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { KBCategory } from './KBCategoryNavigation';

// ======================
// TYPES
// ======================
interface Props {
  category: KBCategory;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// ======================
// CATEGORY EXPLANATIONS
// ======================
interface CategoryExplanation {
  title: string;
  subtitle: string;
  description: string;
  howItWorks: {
    title: string;
    steps: string[];
  };
  examples: {
    title: string;
    items: Array<{ label: string; description: string }>;
  };
  tips: string[];
  ragExplanation: string;
  color: {
    gradient: string;
    bg: string;
    text: string;
    border: string;
  };
}

const EXPLANATIONS: Record<KBCategory, CategoryExplanation> = {
  instructions: {
    title: 'Mente del Asistente',
    subtitle: 'Instrucciones Personalizadas',
    description: 'Las instrucciones definen la personalidad, comportamiento y reglas de respuesta de tu asistente de AI. Son como el "ADN" de cómo piensa y actúa.',
    howItWorks: {
      title: 'Cómo funciona',
      steps: [
        'El sistema inyecta las instrucciones activas en cada conversación',
        'El AI las considera como reglas prioritarias a seguir',
        'Se combinan con el contexto del cliente para personalizar respuestas',
        'Las instrucciones con mayor prioridad tienen más peso',
      ],
    },
    examples: {
      title: 'Ejemplos de uso',
      items: [
        { label: 'Tono de voz', description: '"Siempre usa un tono cálido y profesional, como un amigo experto"' },
        { label: 'Manejo de objeciones', description: '"Cuando el cliente mencione el precio, destaca el valor y la calidad"' },
        { label: 'Promociones', description: '"Ofrece el 10% de descuento solo después de la tercera interacción"' },
      ],
    },
    tips: [
      'Sé específico en las instrucciones',
      'Usa ejemplos concretos de respuestas ideales',
      'Asigna prioridad a las más importantes',
    ],
    ragExplanation: 'Las instrucciones se incluyen directamente en el prompt del AI y tienen prioridad sobre el conocimiento general.',
    color: {
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      border: 'border-violet-200',
    },
  },
  policies: {
    title: 'Reglas del Negocio',
    subtitle: 'Políticas Comerciales',
    description: 'Las políticas son las reglas oficiales de tu negocio que el AI debe comunicar correctamente. Garantizan consistencia en la información.',
    howItWorks: {
      title: 'Cómo funciona',
      steps: [
        'El AI conoce todas tus políticas activas',
        'Cuando detecta preguntas relacionadas, cita la política correcta',
        'Puede parafrasear manteniendo el significado exacto',
        'Nunca inventa políticas que no existan',
      ],
    },
    examples: {
      title: 'Ejemplos de políticas',
      items: [
        { label: 'Cancelación', description: '"Las citas pueden cancelarse hasta 24 horas antes sin cargo"' },
        { label: 'Pagos', description: '"Aceptamos efectivo, tarjeta y transferencia. 50% de anticipo requerido"' },
        { label: 'Garantía', description: '"Todos nuestros trabajos tienen garantía de 2 años"' },
      ],
    },
    tips: [
      'Incluye fechas de vigencia si aplica',
      'Sé claro en condiciones y excepciones',
      'Agrupa políticas por tipo para mejor organización',
    ],
    ragExplanation: 'Las políticas se buscan semánticamente cuando el cliente hace preguntas relacionadas con reglas del negocio.',
    color: {
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200',
    },
  },
  articles: {
    title: 'Saber del Negocio',
    subtitle: 'Base de Conocimiento',
    description: 'Los artículos contienen información detallada sobre tu negocio que el AI usa para responder preguntas complejas con autoridad.',
    howItWorks: {
      title: 'Cómo funciona',
      steps: [
        'Cada artículo se procesa en fragmentos semánticos (chunks)',
        'Se generan embeddings vectoriales para búsqueda rápida',
        'El AI busca los fragmentos más relevantes para cada pregunta',
        'Combina múltiples fuentes para dar respuestas completas',
      ],
    },
    examples: {
      title: 'Qué incluir',
      items: [
        { label: 'Historia', description: '"Fundamos en 2010 con la visión de transformar..."' },
        { label: 'Tecnología', description: '"Usamos equipos CEREC para restauraciones en una visita"' },
        { label: 'Equipo', description: '"Dr. García tiene 15 años de experiencia y MBA de..."' },
      ],
    },
    tips: [
      'Escribe contenido detallado y específico',
      'Incluye datos verificables y únicos',
      'Organiza por categorías temáticas',
    ],
    ragExplanation: 'Los artículos alimentan el sistema RAG. Se convierten en vectores y se recuperan por similitud semántica.',
    color: {
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-200',
    },
  },
  templates: {
    title: 'Palabras del Negocio',
    subtitle: 'Plantillas de Respuesta',
    description: 'Las plantillas son respuestas predefinidas con tu voz de marca. Aseguran consistencia y permiten personalización con variables.',
    howItWorks: {
      title: 'Cómo funciona',
      steps: [
        'El AI detecta situaciones que coinciden con plantillas',
        'Usa la plantilla como base, adaptando el contexto',
        'Las variables se reemplazan con datos del cliente',
        'Puede combinar plantillas si es apropiado',
      ],
    },
    examples: {
      title: 'Plantillas comunes',
      items: [
        { label: 'Saludo inicial', description: '"¡Hola {nombre}! Soy Ana de Dental Smile 😊"' },
        { label: 'Confirmación', description: '"Tu cita con {doctor} el {fecha} a las {hora} está confirmada"' },
        { label: 'Seguimiento', description: '"Hola {nombre}, ¿cómo te fue en tu visita del {fecha}?"' },
      ],
    },
    tips: [
      'Usa variables para personalización automática',
      'Mantén el tono consistente con tu marca',
      'Crea plantillas para situaciones frecuentes',
    ],
    ragExplanation: 'Las plantillas se seleccionan por tipo de trigger y se personalizan con datos del CRM.',
    color: {
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-200',
    },
  },
  competitors: {
    title: 'Saber Competir',
    subtitle: 'Manejo de Competencia',
    description: 'Define cómo tu AI debe responder profesionalmente cuando los clientes mencionan a tus competidores.',
    howItWorks: {
      title: 'Cómo funciona',
      steps: [
        'El AI detecta menciones de competidores conocidos',
        'Aplica la estrategia definida para ese competidor',
        'Destaca tus diferenciadores sin hablar mal',
        'Redirige la conversación hacia tu valor único',
      ],
    },
    examples: {
      title: 'Estrategias',
      items: [
        { label: 'Diferenciación', description: '"A diferencia de otros, ofrecemos garantía extendida..."' },
        { label: 'Reconocimiento', description: '"Son buenos, pero nosotros nos especializamos en..."' },
        { label: 'Valor único', description: '"Lo que nos distingue es nuestra tecnología exclusiva..."' },
      ],
    },
    tips: [
      'Nunca hables mal de competidores',
      'Enfócate en tus fortalezas únicas',
      'Define puntos de conversación específicos',
    ],
    ragExplanation: 'Los competidores se detectan por nombre y alias. Se aplica la estrategia y puntos de conversación automáticamente.',
    color: {
      gradient: 'from-rose-500 to-pink-600',
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      border: 'border-rose-200',
    },
  },
};

// ======================
// ICONS
// ======================
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const BrainIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const DatabaseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
  </svg>
);

// ======================
// MAIN COMPONENT
// ======================
export function KBContextPanel({ category, isOpen, onClose, className }: Props) {
  const explanation = EXPLANATIONS[category];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className={cn('overflow-hidden', className)}
        >
          <div className={cn(
            'rounded-2xl border',
            explanation.color.border,
            explanation.color.bg,
            'p-6'
          )}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  `bg-gradient-to-br ${explanation.color.gradient}`,
                  'text-white'
                )}>
                  <BrainIcon />
                </div>
                <div>
                  <h4 className={cn('text-lg font-bold', explanation.color.text)}>
                    {explanation.title}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {explanation.subtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/50 transition-colors text-gray-500"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Description */}
            <p className="text-gray-700 mb-6 leading-relaxed">
              {explanation.description}
            </p>

            {/* Content Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* How it works */}
              <div className="bg-white/70 rounded-xl p-4">
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {explanation.howItWorks.title}
                </h5>
                <ol className="space-y-2">
                  {explanation.howItWorks.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className={cn(
                        'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white',
                        `bg-gradient-to-br ${explanation.color.gradient}`
                      )}>
                        {idx + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Examples */}
              <div className="bg-white/70 rounded-xl p-4">
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {explanation.examples.title}
                </h5>
                <div className="space-y-3">
                  {explanation.examples.items.map((item, idx) => (
                    <div key={idx} className="text-sm">
                      <span className={cn('font-medium', explanation.color.text)}>
                        {item.label}:
                      </span>
                      <p className="text-gray-600 mt-0.5 italic">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {explanation.tips.map((tip, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full',
                    'bg-white/70',
                    'text-gray-700'
                  )}
                >
                  <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {tip}
                </span>
              ))}
            </div>

            {/* RAG Technical Note */}
            <div className={cn(
              'mt-6 p-4 rounded-xl',
              'bg-gradient-to-r from-gray-900 to-gray-800',
              'text-white'
            )}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <DatabaseIcon />
                </div>
                <div>
                  <h6 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-purple-500/30 rounded text-xs">RAG</span>
                    Cómo se usa en el sistema
                  </h6>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {explanation.ragExplanation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ======================
// EXPORTS
// ======================
export type { Props as KBContextPanelProps };
