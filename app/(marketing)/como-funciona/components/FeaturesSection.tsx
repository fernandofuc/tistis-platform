// =====================================================
// Features Section - Ventajas de TIS TIS
// Grid con iconos y animaciones al scroll
// =====================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Users,
  Calendar,
  BarChart3,
  Shield,
  Zap,
  Globe,
  Clock,
} from 'lucide-react';

const features = [
  {
    icon: MessageCircle,
    title: 'Respuestas en segundos, no horas',
    description: 'Mientras tu competencia tarda horas en contestar, TIS TIS responde al instante. Cada minuto perdido es un cliente que se va con otro.',
    color: '#25D366', // WhatsApp green
  },
  {
    icon: Users,
    title: 'Leads que se califican solos',
    description: 'La IA detecta quien esta listo para comprar y quien solo pregunta. Tu equipo se enfoca en cerrar, no en filtrar.',
    color: 'rgb(223, 115, 115)', // tis-coral
  },
  {
    icon: Calendar,
    title: 'Citas sin llamadas, sin esperas',
    description: 'El cliente escribe, el agente agenda. Sin transferencias, sin "te marco despues". La cita queda confirmada en el momento.',
    color: 'rgb(102, 126, 234)', // tis-purple
  },
  {
    icon: BarChart3,
    title: 'Insights de IA, no solo graficas',
    description: 'Gemini analiza tus conversaciones y te dice que servicios vender, cuando hay mas demanda y donde pierdes clientes.',
    color: 'rgb(157, 184, 161)', // tis-green
  },
  {
    icon: Shield,
    title: 'Una cuenta, todas tus sucursales',
    description: 'Cada ubicacion ve solo sus datos. Reportes consolidados para ti. Sin mezclar informacion ni perder control.',
    color: '#1e293b', // slate-800
  },
  {
    icon: Zap,
    title: 'Triple IA: GPT-5 + Gemini + Claude',
    description: 'No dependemos de un solo modelo. Usamos el mejor para cada tarea: velocidad, analisis o conversacion natural.',
    color: '#f59e0b', // amber
  },
  {
    icon: Globe,
    title: 'Donde estan tus clientes, ahi esta TIS TIS',
    description: 'WhatsApp, Instagram DM, Facebook Messenger, TikTok y llamadas telefonicas. Todo llega a una sola bandeja.',
    color: '#ec4899', // pink
  },
  {
    icon: Clock,
    title: 'Funciona desde el dia 1',
    description: 'Otros sistemas tardan semanas en implementar. Con TIS TIS conectas tu WhatsApp hoy y mañana ya tienes tu IA contestando.',
    color: '#06b6d4', // cyan
  },
];

// Hook para detectar cuando un elemento está visible
function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, { threshold: 0.1 });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const { ref, isInView } = useInView();
  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      className={`
        group relative bg-white rounded-2xl p-6 border border-slate-100
        hover:border-slate-200 hover:shadow-card-hover
        transition-all duration-500 ease-out
        ${isInView
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
        }
      `}
      style={{ transitionDelay: `${(index % 4) * 100}ms` }}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: `${feature.color}15` }}
      >
        <Icon
          className="w-6 h-6"
          style={{ color: feature.color }}
        />
      </div>

      {/* Content */}
      <h3 className="text-lg font-bold text-slate-900 mb-2">
        {feature.title}
      </h3>
      <p className="text-slate-600 text-sm leading-relaxed">
        {feature.description}
      </p>

      {/* Hover effect line */}
      <div
        className="absolute bottom-0 left-0 h-1 rounded-b-2xl transition-all duration-300 w-0 group-hover:w-full"
        style={{ backgroundColor: feature.color }}
      />
    </div>
  );
}

export default function FeaturesSection() {
  const { ref: headerRef, isInView: headerInView } = useInView();

  return (
    <section className="py-20 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div
          ref={headerRef}
          className={`
            text-center mb-16 transition-all duration-700
            ${headerInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Por que TIS TIS{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              es diferente
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            No es solo un chatbot. Es un sistema de agentes IA que trabaja como un empleado estrella:
            <span className="font-medium text-slate-700"> nunca descansa, nunca olvida, siempre mejora.</span>
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>

        {/* Stats bar */}
        <div
          className={`
            mt-16 bg-white rounded-2xl p-8 shadow-card
            grid grid-cols-2 md:grid-cols-4 gap-8
            transition-all duration-700 delay-300
            ${headerInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          {[
            { value: '50', label: 'Cupos disponibles este mes' },
            { value: '1M+', label: 'Conversaciones gestionadas' },
            { value: '24/7', label: 'Sin interrupciones' },
            { value: '<3 seg', label: 'Tiempo de respuesta' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold bg-gradient-coral bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-slate-600 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
