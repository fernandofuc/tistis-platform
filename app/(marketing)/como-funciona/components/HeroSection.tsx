// =====================================================
// Hero Section - Cómo Funciona
// Estilo Lovable/Apple con gradiente y CTA
// =====================================================

'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, Play } from 'lucide-react';

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-tis-bg-primary via-white to-white" />

      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-tis-coral/10 rounded-full blur-3xl" />
      <div className="absolute top-40 right-10 w-96 h-96 bg-tis-purple/10 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-card border border-slate-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tis-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-tis-green"></span>
            </span>
            <span className="text-sm font-medium text-slate-700">
              +500 negocios ya automatizados
            </span>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
          Tu negocio en{' '}
          <span className="bg-gradient-coral bg-clip-text text-transparent">
            piloto automático
          </span>
          <br />
          mientras tú haces lo importante
        </h1>

        {/* Subtitle */}
        <p className="text-center text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
          TIS TIS es el cerebro digital que gestiona tus leads, responde WhatsApp 24/7,
          agenda citas y organiza todo tu negocio con inteligencia artificial.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="group flex items-center gap-2 px-8 py-4 bg-gradient-coral text-white font-semibold rounded-xl shadow-coral hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            Empieza Gratis
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => {
              // Scroll to use cases section
              document.getElementById('casos-de-uso')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group flex items-center gap-2 px-8 py-4 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300"
          >
            <Play className="w-5 h-5 text-tis-coral" />
            Ver cómo funciona
          </button>
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-col items-center">
          <p className="text-sm text-slate-500 mb-4">Funciona con las herramientas que ya usas</p>
          <div className="flex items-center gap-8 opacity-60">
            {/* WhatsApp */}
            <svg className="h-8 w-auto" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {/* Instagram */}
            <svg className="h-8 w-auto" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            {/* Calendar */}
            <svg className="h-8 w-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {/* AI Brain */}
            <svg className="h-8 w-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a9 9 0 0 1 9 9c0 3.074-1.676 5.963-4.5 7.313V19.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-1.187C4.676 16.963 3 14.074 3 11a9 9 0 0 1 9-9z"/>
              <path d="M9 22h6"/>
              <path d="M12 2v3"/>
              <path d="M8 8h.01"/>
              <path d="M16 8h.01"/>
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
