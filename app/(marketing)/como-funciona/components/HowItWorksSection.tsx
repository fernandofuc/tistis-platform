// =====================================================
// How It Works Section - 3 Pasos
// Estilo Apple con scroll animations
// =====================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Cpu, Rocket } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: MessageSquare,
    title: 'Conecta tus canales en 5 minutos',
    description: 'Vincula WhatsApp Business, Instagram y Facebook. Sin codigo, sin configuraciones complicadas. Solo escanea un QR y listo.',
    color: 'tis-coral',
    gradient: 'from-tis-coral to-tis-pink',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'La IA aprende de tu negocio',
    description: 'Sube tu menu, servicios o catalogo. TIS TIS entrena agentes especializados que conocen tus precios, horarios y politicas mejor que un empleado nuevo.',
    color: 'tis-purple',
    gradient: 'from-tis-purple to-tis-purple-dark',
  },
  {
    number: '03',
    icon: Rocket,
    title: 'Convierte clientes mientras duermes',
    description: 'Respuestas instantaneas 24/7. Citas agendadas automaticamente. Facturas generadas por WhatsApp. Leads calificados y priorizados para que vendas mas.',
    color: 'tis-green',
    gradient: 'from-tis-green to-tis-green-600',
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
    }, { threshold: 0.2 });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const { ref, isInView } = useInView();
  const Icon = step.icon;

  return (
    <div
      ref={ref}
      className={`
        relative transition-all duration-700 ease-out
        ${isInView
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-12'
        }
      `}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Connection line (not on last item) */}
      {index < steps.length - 1 && (
        <div className="hidden lg:block absolute top-1/2 left-full w-full h-0.5 bg-gradient-to-r from-slate-200 to-transparent -translate-y-1/2 z-0" />
      )}

      <div className="relative bg-white rounded-3xl p-8 shadow-card hover:shadow-card-elevated transition-shadow duration-300 z-10">
        {/* Step number */}
        <div className={`
          absolute -top-4 -right-4 w-12 h-12 rounded-xl bg-gradient-to-br ${step.gradient}
          flex items-center justify-center text-white font-bold text-lg shadow-lg
        `}>
          {step.number}
        </div>

        {/* Icon */}
        <div className={`
          w-16 h-16 rounded-2xl bg-${step.color}/10 flex items-center justify-center mb-6
        `}
        style={{
          backgroundColor: step.color === 'tis-coral' ? 'rgba(223, 115, 115, 0.1)'
            : step.color === 'tis-purple' ? 'rgba(102, 126, 234, 0.1)'
            : 'rgba(157, 184, 161, 0.1)'
        }}
        >
          <Icon
            className="w-8 h-8"
            style={{
              color: step.color === 'tis-coral' ? 'rgb(223, 115, 115)'
                : step.color === 'tis-purple' ? 'rgb(102, 126, 234)'
                : 'rgb(157, 184, 161)'
            }}
          />
        </div>

        {/* Content */}
        <h3 className="text-xl font-bold text-slate-900 mb-3">
          {step.title}
        </h3>
        <p className="text-slate-600 leading-relaxed">
          {step.description}
        </p>
      </div>
    </div>
  );
}

export default function HowItWorksSection() {
  const { ref: sectionRef, isInView: sectionInView } = useInView();

  return (
    <section className="py-20 lg:py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div
          ref={sectionRef}
          className={`
            text-center mb-16 transition-all duration-700
            ${sectionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-tis-purple/10 text-tis-purple rounded-full text-sm font-medium mb-4">
            <Cpu className="w-4 h-4" />
            Implementacion en minutos, no semanas
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            De cero a{' '}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              automatizado
            </span>
            {' '}en 3 pasos
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Sin equipos de TI. Sin consultores caros. Sin semanas de implementacion.
            <span className="font-medium text-slate-700"> Tu negocio empieza a trabajar solo desde el primer dia.</span>
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <StepCard key={step.number} step={step} index={index} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          className={`
            text-center mt-16 transition-all duration-700 delay-500
            ${sectionInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          <p className="text-slate-600 mb-4">
            Negocios como el tuyo ya estan ahorrando +20 horas a la semana
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-coral text-white font-semibold rounded-xl shadow-coral hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            Prueba 10 dias gratis
            <Rocket className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
