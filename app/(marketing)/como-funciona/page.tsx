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
  title: 'Cómo Funciona | TIS TIS - El Cerebro Digital para tu Negocio',
  description: 'Descubre cómo TIS TIS automatiza tu negocio con IA. Gestión de leads, WhatsApp automático, citas y más. Todo en piloto automático.',
  openGraph: {
    title: 'Cómo Funciona | TIS TIS',
    description: 'Descubre cómo TIS TIS automatiza tu negocio con IA.',
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
