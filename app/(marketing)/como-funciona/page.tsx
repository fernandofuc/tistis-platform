// =====================================================
// TIS TIS PLATFORM - Cómo Funciona Page
// Premium landing page with scroll animations (Apple-style)
// =====================================================

import { Metadata } from 'next';
import HeroSection from './components/HeroSection';
import UseCasesSection from './components/UseCasesSection';
import HowItWorksSection from './components/HowItWorksSection';
import FeaturesSection from './components/FeaturesSection';
import CTASection from './components/CTASection';

export const metadata: Metadata = {
  title: 'Como Funciona | TIS TIS - IA que Aprende tu Negocio',
  description: 'Sistema de agentes IA que responde WhatsApp 24/7, agenda citas, califica leads y genera facturas. Potenciado por GPT-5, Gemini y Claude. Prueba 10 dias gratis.',
  openGraph: {
    title: 'Como Funciona TIS TIS | IA para tu Negocio',
    description: 'La IA que aprende tu negocio y trabaja por ti 24/7. Respuestas en 3 segundos, 0 leads perdidos.',
  },
};

export default function ComoFuncionaPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <HeroSection />

      {/* Casos de Uso - Carrusel con demos */}
      <UseCasesSection />

      {/* Cómo Funciona - 3 Pasos */}
      <HowItWorksSection />

      {/* Features/Ventajas */}
      <FeaturesSection />

      {/* CTA Final */}
      <CTASection />
    </div>
  );
}
