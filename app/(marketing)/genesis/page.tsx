// =====================================================
// TIS TIS Genesis - Landing Page
// Preparacion para integracion robotica - Vision 2028+
// FASE 4 COMPLETADA - Todas las secciones implementadas
// =====================================================

'use client';

import {
  HeroSection,
  ImageScrollPlayer,
  WhatIsGenesisSection,
  HowItWorksSection,
  RobotReadyScoreSection,
  UseCaseSection,
  ComingSoonCTA,
} from './components';

// =====================================================
// Configuration
// =====================================================

/** Path to Genesis robot image for ImageScrollPlayer */
const GENESIS_IMAGE_SRC = '/images/genesis/robot-optimus.jpg';

/** Alt text for Genesis robot image - accessibility */
const GENESIS_IMAGE_ALT =
  'Robot de servicio Optimus preparandose para integracion con negocios TIS TIS';

/** Scroll height in viewport units for immersive experience */
const SCROLL_HEIGHT_VH = 400;

/** Example Robot-Ready Score for demonstration */
const EXAMPLE_ROBOT_SCORE = 78;

// =====================================================
// Main Page Component
// =====================================================

export default function GenesisPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* ============================================= */}
      {/* Hero Section - Above the fold */}
      {/* Vision 2028+ badge, main title, CTAs */}
      {/* ============================================= */}
      <HeroSection showScrollIndicator />

      {/* ============================================= */}
      {/* Image Scroll Section - Immersive Experience */}
      {/* Robot reveal with phase overlays on scroll */}
      {/* ============================================= */}
      <ImageScrollPlayer
        imageSrc={GENESIS_IMAGE_SRC}
        imageAlt={GENESIS_IMAGE_ALT}
        scrollHeight={SCROLL_HEIGHT_VH}
        showProgress
        debug={false}
      />

      {/* ============================================= */}
      {/* What Is Genesis Section */}
      {/* Explanation, comparison cards, features grid */}
      {/* ============================================= */}
      <WhatIsGenesisSection />

      {/* ============================================= */}
      {/* How It Works Section - 5 Phases Timeline */}
      {/* Visual timeline with alternating cards */}
      {/* ============================================= */}
      <HowItWorksSection />

      {/* ============================================= */}
      {/* Robot-Ready Score Section */}
      {/* Interactive score visualization 0-100 */}
      {/* ============================================= */}
      <RobotReadyScoreSection exampleScore={EXAMPLE_ROBOT_SCORE} />

      {/* ============================================= */}
      {/* Use Cases Section */}
      {/* Real examples by business type (dental, restaurant, etc) */}
      {/* ============================================= */}
      <UseCaseSection />

      {/* ============================================= */}
      {/* Coming Soon CTA - Vision 2028+ */}
      {/* Final call to action + timeline preview */}
      {/* ============================================= */}
      <ComingSoonCTA showBackLink showStartNow />
    </div>
  );
}
