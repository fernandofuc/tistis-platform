// =====================================================
// TIS TIS Catalyst - Landing Page
// Plataforma de tokenización para expansión de negocios
// FASE 3 COMPLETADA - Todas las secciones implementadas
// =====================================================

'use client';

import {
  HeroSection,
  VideoScrollPlayer,
  WhatIsSection,
  HowItWorksSection,
} from './components';

// =====================================================
// Main Page Component
// =====================================================

export default function CatalystPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* ============================================= */}
      {/* Hero Section - Above the fold */}
      {/* ============================================= */}
      <HeroSection showScrollIndicator />

      {/* ============================================= */}
      {/* Video Scroll Section - Immersive Experience */}
      {/* ============================================= */}
      <VideoScrollPlayer
        videoSrc="/videos/catalyst-token.mp4"
        scrollHeight={400}
        debug={false}
      />

      {/* ============================================= */}
      {/* What Is Section - Explanation & Features */}
      {/* ============================================= */}
      <WhatIsSection />

      {/* ============================================= */}
      {/* How It Works Section - Process Timeline */}
      {/* ============================================= */}
      <HowItWorksSection />

    </div>
  );
}
