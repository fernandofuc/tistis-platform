// =====================================================
// TIS TIS Catalyst - Shared Types & Constants
// Tipos y constantes compartidas para componentes de landing
// =====================================================

import type { LucideIcon } from 'lucide-react';

// =====================================================
// Animation Types - Removed strict typing
// Framer Motion handles variants dynamically
// =====================================================

// =====================================================
// Section Component Types
// =====================================================

/**
 * Base props for all section components
 */
export interface BaseSectionProps {
  /** Additional CSS classes */
  className?: string;
  /** Section ID for anchor navigation */
  id?: string;
}

/**
 * Feature item for feature grids/lists
 */
export interface FeatureItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: string;
}

/**
 * Step item for process/timeline sections
 */
export interface StepItem {
  id: string;
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
  highlight?: string;
}

/**
 * Benefit item for benefits section
 */
export interface BenefitItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  stats?: {
    value: string;
    label: string;
  };
  gradient: string;
}

/**
 * Use case item for vertical-specific cases
 */
export interface UseCaseItem {
  id: string;
  icon: LucideIcon;
  vertical: string;
  title: string;
  description: string;
  highlight: string;
  tags: string[];
}

/**
 * Testimonial for social proof
 */
export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar?: string;
}

// =====================================================
// Shared Animation Variants
// Apple/Google-style smooth animations
// =====================================================

// Apple-style cubic bezier easing - exported for consistent use across components
export const APPLE_EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * Fade in from bottom - primary entrance animation
 */
export const fadeInUp = {
  hidden: {
    opacity: 0,
    y: 24
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: APPLE_EASE,
    },
  },
};

/**
 * Fade in from left
 */
export const fadeInLeft = {
  hidden: {
    opacity: 0,
    x: -32
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: APPLE_EASE,
    },
  },
};

/**
 * Fade in from right
 */
export const fadeInRight = {
  hidden: {
    opacity: 0,
    x: 32
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: APPLE_EASE,
    },
  },
};

/**
 * Scale up with fade
 */
export const scaleIn = {
  hidden: {
    opacity: 0,
    scale: 0.92
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: APPLE_EASE,
    },
  },
};

/**
 * Stagger container for child animations
 */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

/**
 * Stagger container - faster variant
 */
export const staggerContainerFast = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

// =====================================================
// Micro-Interaction Configurations
// Apple/Google-style spring and gesture animations
// =====================================================

/**
 * Spring configuration for natural feeling animations
 * Inspired by iOS/macOS spring physics
 */
export const SPRING_CONFIG = {
  /** Gentle spring for subtle movements */
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  /** Bouncy spring for playful interactions */
  bouncy: { type: 'spring', stiffness: 300, damping: 20 },
  /** Snappy spring for responsive feedback */
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  /** Smooth spring for elegant transitions */
  smooth: { type: 'spring', stiffness: 200, damping: 25 },
} as const;

/**
 * Button hover animation - subtle lift effect
 */
export const buttonHover = {
  scale: 1.02,
  transition: { duration: 0.2, ease: APPLE_EASE },
};

/**
 * Button tap animation - pressed feedback
 */
export const buttonTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

/**
 * Card hover animation - elevated lift effect
 */
export const cardHover = {
  y: -4,
  scale: 1.01,
  transition: { duration: 0.3, ease: APPLE_EASE },
};

/**
 * Icon pulse animation for attention
 */
export const iconPulse = {
  scale: [1, 1.1, 1],
  transition: {
    duration: 0.4,
    ease: APPLE_EASE,
    times: [0, 0.5, 1],
  },
};

/**
 * Shimmer effect for loading states
 */
export const shimmer = {
  x: ['-100%', '100%'],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'linear',
  },
};

// =====================================================
// Shared Gradients
// TIS TIS brand gradients for consistent styling
// =====================================================

export const GRADIENTS = {
  /** Primary coral to pink gradient */
  coralPink: 'from-tis-coral to-tis-pink',
  /** Pink to purple gradient */
  pinkPurple: 'from-tis-pink to-tis-purple',
  /** Purple to blue gradient */
  purpleBlue: 'from-tis-purple to-blue-500',
  /** Blue to coral (full circle) */
  blueCoral: 'from-blue-500 to-tis-coral',
  /** Coral to purple (wide range) */
  coralPurple: 'from-tis-coral via-tis-pink to-tis-purple',
  /** Subtle coral */
  coralSubtle: 'from-tis-coral/10 to-tis-pink/10',
  /** Subtle purple */
  purpleSubtle: 'from-tis-purple/10 to-blue-500/10',
} as const;

// =====================================================
// Viewport Configuration
// IntersectionObserver settings for scroll animations
// =====================================================

export const VIEWPORT_CONFIG = {
  /** Trigger when 20% visible */
  standard: { once: true, margin: '-80px' },
  /** Trigger when entering viewport */
  eager: { once: true, margin: '0px' },
  /** Trigger earlier for preloading */
  preload: { once: true, margin: '100px' },
} as const;

// =====================================================
// Breakpoint Utilities
// Responsive design helpers
// =====================================================

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// =====================================================
// Section Spacing
// Consistent vertical rhythm
// =====================================================

export const SECTION_SPACING = {
  /** Small sections: py-12 sm:py-16 */
  sm: 'py-12 sm:py-16',
  /** Medium sections: py-16 sm:py-24 */
  md: 'py-16 sm:py-24',
  /** Large sections: py-20 sm:py-32 */
  lg: 'py-20 sm:py-32',
  /** Extra large sections: py-24 sm:py-40 */
  xl: 'py-24 sm:py-40',
} as const;

// =====================================================
// Container Widths
// Max-width configurations
// =====================================================

export const CONTAINER_WIDTHS = {
  /** Narrow content: max-w-2xl */
  narrow: 'max-w-2xl',
  /** Standard content: max-w-4xl */
  standard: 'max-w-4xl',
  /** Wide content: max-w-6xl */
  wide: 'max-w-6xl',
  /** Full width: max-w-7xl */
  full: 'max-w-7xl',
} as const;
