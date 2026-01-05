// =====================================================
// CTA Section - Call to Action Final
// Estilo premium con gradiente
// =====================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function CTASection() {
  const router = useRouter();
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

  return (
    <section className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className={`
            relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
            p-8 sm:p-12 lg:p-16 text-center
            transition-all duration-700
            ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}
        >
          {/* Background decorations */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-tis-coral/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-tis-purple/20 rounded-full blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              10 dias gratis - Solo 50 cupos este mes
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              Cada minuto sin TIS TIS
              <br />
              <span className="bg-gradient-to-r from-tis-coral to-tis-pink bg-clip-text text-transparent">
                es un cliente que se va
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              Mientras lees esto, tu competencia ya esta contestando en segundos con IA.
              <span className="text-white font-medium"> El que responde primero, cierra primero.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-coral text-white font-semibold rounded-xl shadow-coral hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                Empieza tu prueba gratuita
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => router.push('/pricing')}
                className="flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300"
              >
                Ver planes desde $499/mes
              </button>
            </div>

            {/* Trust text */}
            <p className="mt-8 text-sm text-slate-400">
              Implementacion en minutos. Sin contratos. Cancela cuando quieras.
            </p>
          </div>

          {/* Bottom gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-tis-coral via-tis-purple to-tis-green" />
        </div>
      </div>
    </section>
  );
}
