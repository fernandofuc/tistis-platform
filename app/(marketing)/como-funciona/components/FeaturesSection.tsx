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
    title: 'WhatsApp 24/7',
    description: 'Responde automáticamente a tus clientes en WhatsApp, Instagram y Facebook. Nunca pierdas un lead.',
    color: '#25D366', // WhatsApp green
  },
  {
    icon: Users,
    title: 'CRM Inteligente',
    description: 'Clasifica leads automáticamente por interés. Prioriza los que tienen más probabilidad de comprar.',
    color: 'rgb(223, 115, 115)', // tis-coral
  },
  {
    icon: Calendar,
    title: 'Agenda Automática',
    description: 'Los clientes agendan citas directamente por WhatsApp. Sin llamadas, sin esperas.',
    color: 'rgb(102, 126, 234)', // tis-purple
  },
  {
    icon: BarChart3,
    title: 'Analytics en Tiempo Real',
    description: 'Métricas de conversión, leads por canal, rendimiento por sucursal. Todo en un dashboard.',
    color: 'rgb(157, 184, 161)', // tis-green
  },
  {
    icon: Shield,
    title: 'Multi-Tenant Seguro',
    description: 'Cada sucursal tiene acceso solo a sus datos. Seguridad empresarial desde el día uno.',
    color: '#1e293b', // slate-800
  },
  {
    icon: Zap,
    title: 'IA de Claude',
    description: 'Potenciado por Claude AI de Anthropic. Respuestas naturales que entienden contexto.',
    color: '#f59e0b', // amber
  },
  {
    icon: Globe,
    title: 'Multi-Canal',
    description: 'WhatsApp, Instagram, Facebook, TikTok. Todos tus canales en una sola bandeja de entrada.',
    color: '#ec4899', // pink
  },
  {
    icon: Clock,
    title: 'Setup en Minutos',
    description: 'No necesitas semanas de implementación. Conecta tu WhatsApp y empieza hoy mismo.',
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
            Todo lo que necesitas,{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              en un solo lugar
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Herramientas potentes diseñadas para que tu negocio crezca sin fricción.
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
            { value: '500+', label: 'Negocios activos' },
            { value: '1M+', label: 'Mensajes procesados' },
            { value: '24/7', label: 'Disponibilidad' },
            { value: '< 5min', label: 'Tiempo de respuesta' },
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
