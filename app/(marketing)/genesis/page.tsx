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
    <div className="min-h-screen">
      {/* ============================================= */}
      {/* Unified Hero + Robot Section */}
      {/* Robot image visible from start, hero text overlays */}
      {/* ============================================= */}
      <div className="relative">
        {/* Robot Image - Starts from top, behind hero content */}
        <ImageScrollPlayer
          imageSrc={GENESIS_IMAGE_SRC}
          imageAlt={GENESIS_IMAGE_ALT}
          scrollHeight={SCROLL_HEIGHT_VH}
          showProgress
          debug={false}
        />

        {/* Hero Content - Overlaid on robot image */}
        <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
          <div className="pointer-events-auto">
            <HeroSection showScrollIndicator={false} />
          </div>
        </div>
      </div>

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
      {/* Coming Soon CTA - Vision 2028+ */}
      {/* Final call to action + timeline preview */}
      {/* ============================================= */}
      <ComingSoonCTA showBackLink showStartNow />
    </div>
  );
}
