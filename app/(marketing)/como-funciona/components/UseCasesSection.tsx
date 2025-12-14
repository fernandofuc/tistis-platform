// =====================================================
// Use Cases Section - Carrusel de demos
// Estilo Lovable con tabs y screenshots
// =====================================================

'use client';

import { useState } from 'react';
import {
  Stethoscope,
  UtensilsCrossed,
  ShoppingBag,
  Building2,
  ChevronRight
} from 'lucide-react';

// Casos de uso con placeholders para screenshots
const useCases = [
  {
    id: 'dental',
    icon: Stethoscope,
    title: 'Clínicas Dentales',
    subtitle: 'ESVA Dental Clinic',
    description: 'Gestiona pacientes, agenda citas automáticamente y responde consultas por WhatsApp 24/7. El sistema clasifica leads y prioriza los más interesados.',
    features: ['Historial clínico digital', 'Recordatorios automáticos', 'Cotizaciones instantáneas'],
    // Placeholder - Será reemplazado por screenshot real
    screenshotPlaceholder: {
      type: 'dashboard',
      label: 'Dashboard Clínica Dental',
      aspectRatio: '16/10',
    },
  },
  {
    id: 'restaurant',
    icon: UtensilsCrossed,
    title: 'Restaurantes',
    subtitle: 'Multi-sucursal',
    description: 'Reservaciones automáticas, gestión de mesas y pedidos. Responde preguntas sobre el menú y horarios sin intervención humana.',
    features: ['Reservas por WhatsApp', 'Gestión de mesas', 'Menú digital integrado'],
    screenshotPlaceholder: {
      type: 'dashboard',
      label: 'Dashboard Restaurante',
      aspectRatio: '16/10',
    },
  },
  {
    id: 'retail',
    icon: ShoppingBag,
    title: 'Tiendas de Ropa',
    subtitle: 'E-commerce + Físico',
    description: 'Control de inventario en tiempo real, atención al cliente automatizada y seguimiento de ventas por sucursal.',
    features: ['Inventario multi-sucursal', 'Catálogo por WhatsApp', 'Reportes de ventas'],
    screenshotPlaceholder: {
      type: 'dashboard',
      label: 'Dashboard Retail',
      aspectRatio: '16/10',
    },
  },
  {
    id: 'services',
    icon: Building2,
    title: 'Servicios Profesionales',
    subtitle: 'Consultorías, Agencias',
    description: 'Agenda reuniones, califica prospectos automáticamente y mantén seguimiento de cada oportunidad de negocio.',
    features: ['CRM inteligente', 'Scoring de leads', 'Pipeline de ventas'],
    screenshotPlaceholder: {
      type: 'dashboard',
      label: 'Dashboard Servicios',
      aspectRatio: '16/10',
    },
  },
];

export default function UseCasesSection() {
  const [activeCase, setActiveCase] = useState(0);
  const currentCase = useCases[activeCase];

  return (
    <section id="casos-de-uso" className="py-20 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Un cerebro para{' '}
            <span className="bg-gradient-coral bg-clip-text text-transparent">
              cada tipo de negocio
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            TIS TIS se adapta a tu industria. Mira cómo funciona en diferentes sectores.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon;
            const isActive = index === activeCase;

            return (
              <button
                key={useCase.id}
                onClick={() => setActiveCase(index)}
                className={`
                  flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300
                  ${isActive
                    ? 'bg-gradient-coral text-white shadow-coral'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{useCase.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Info */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-tis-coral/10 text-tis-coral rounded-full text-sm font-medium mb-4">
              {(() => {
                const Icon = currentCase.icon;
                return <Icon className="w-4 h-4" />;
              })()}
              {currentCase.subtitle}
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              {currentCase.title}
            </h3>

            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              {currentCase.description}
            </p>

            {/* Features list */}
            <ul className="space-y-3 mb-8">
              {currentCase.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-700">
                  <div className="w-6 h-6 rounded-full bg-tis-green/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-tis-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button className="group flex items-center gap-2 text-tis-coral font-semibold hover:gap-3 transition-all">
              Ver demo completa
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right: Screenshot Placeholder */}
          <div className="order-1 lg:order-2">
            <div className="relative">
              {/* Browser frame */}
              <div className="bg-slate-800 rounded-t-xl p-3 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-slate-700 rounded-md px-3 py-1 text-xs text-slate-400 text-center">
                    app.tistis.com/dashboard
                  </div>
                </div>
              </div>

              {/* Screenshot placeholder */}
              <div
                className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-b-xl overflow-hidden"
                style={{ aspectRatio: currentCase.screenshotPlaceholder.aspectRatio }}
              >
                {/* Placeholder content - Será reemplazado por imagen real */}
                <div className="w-full h-full flex flex-col items-center justify-center p-8">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-card flex items-center justify-center mb-4">
                    {(() => {
                      const Icon = currentCase.icon;
                      return <Icon className="w-8 h-8 text-tis-coral" />;
                    })()}
                  </div>
                  <p className="text-slate-500 font-medium text-center">
                    {currentCase.screenshotPlaceholder.label}
                  </p>
                  <p className="text-slate-400 text-sm mt-2">
                    Screenshot pendiente
                  </p>

                  {/* Mock dashboard elements */}
                  <div className="mt-6 w-full max-w-md space-y-3">
                    <div className="h-3 bg-white/60 rounded-full w-3/4" />
                    <div className="h-3 bg-white/60 rounded-full w-1/2" />
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="h-16 bg-white/60 rounded-xl" />
                      <div className="h-16 bg-white/60 rounded-xl" />
                      <div className="h-16 bg-white/60 rounded-xl" />
                    </div>
                    <div className="h-24 bg-white/60 rounded-xl mt-4" />
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -right-4 top-1/4 bg-white rounded-xl shadow-card-elevated p-3 animate-pulse-soft">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-tis-green/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-tis-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Lead calificado</p>
                    <p className="text-xs text-slate-500">Hace 2 min</p>
                  </div>
                </div>
              </div>

              <div className="absolute -left-4 bottom-1/4 bg-white rounded-xl shadow-card-elevated p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-tis-coral/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-tis-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">WhatsApp respondido</p>
                    <p className="text-xs text-slate-500">Automático</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
