// =====================================================
// TIS TIS Genesis - Components Barrel Export
// Exports publicos de todos los componentes de landing
// =====================================================

// =====================================================
// Types & Constants
// Re-exports de tipos compartidos y Genesis-specific
// =====================================================

export * from './types';

// =====================================================
// Core Components
// Componentes principales de la pagina Genesis
// =====================================================

// FASE 2: ImageScrollPlayer (Core) - IMPLEMENTED
export { default as ImageScrollPlayer } from './ImageScrollPlayer';

// FASE 3: Content Sections - IMPLEMENTED
export { default as HeroSection } from './HeroSection';
export { default as WhatIsGenesisSection } from './WhatIsGenesisSection';
export { default as HowItWorksSection } from './HowItWorksSection';
export { default as RobotReadyScoreSection } from './RobotReadyScoreSection';
export { default as UseCaseSection } from './UseCaseSection';
export { default as ComingSoonCTA } from './ComingSoonCTA';

// =====================================================
// Utility Exports
// Hooks y utilidades para los componentes
// =====================================================

// FASE 2: Hook useImageScrollSync - Ubicado en src/hooks/
// Importar directamente: import { useImageScrollSync } from '@/src/hooks';
