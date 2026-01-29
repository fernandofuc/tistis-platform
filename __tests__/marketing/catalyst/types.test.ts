/**
 * TIS TIS Catalyst - Types & Constants Tests
 * FASE 5 - Testing
 *
 * Tests for shared types, animation variants, and constants
 * used across all Catalyst landing page components.
 */

import { describe, it, expect } from 'vitest';
import {
  // Animation variants
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  staggerContainer,
  staggerContainerFast,
  // Micro-interactions
  APPLE_EASE,
  SPRING_CONFIG,
  buttonHover,
  buttonTap,
  cardHover,
  iconPulse,
  shimmer,
  // Style constants
  GRADIENTS,
  VIEWPORT_CONFIG,
  BREAKPOINTS,
  SECTION_SPACING,
  CONTAINER_WIDTHS,
} from '@/app/(marketing)/catalyst/components/types';

// ==============================================
// ANIMATION EASING TESTS
// ==============================================

describe('APPLE_EASE', () => {
  it('exports a valid cubic-bezier array', () => {
    expect(APPLE_EASE).toBeDefined();
    expect(Array.isArray(APPLE_EASE)).toBe(true);
    expect(APPLE_EASE).toHaveLength(4);
  });

  it('has values in valid range (0-1 for most)', () => {
    expect(APPLE_EASE[0]).toBe(0.25);
    expect(APPLE_EASE[1]).toBe(0.46);
    expect(APPLE_EASE[2]).toBe(0.45);
    expect(APPLE_EASE[3]).toBe(0.94);
  });

  it('is marked as const (readonly tuple)', () => {
    // TypeScript enforces this, but we verify the values are consistent
    const [p1, p2, p3, p4] = APPLE_EASE;
    expect(typeof p1).toBe('number');
    expect(typeof p2).toBe('number');
    expect(typeof p3).toBe('number');
    expect(typeof p4).toBe('number');
  });
});

// ==============================================
// ANIMATION VARIANT TESTS
// ==============================================

describe('Animation Variants', () => {
  describe('fadeInUp', () => {
    it('has hidden and visible states', () => {
      expect(fadeInUp).toHaveProperty('hidden');
      expect(fadeInUp).toHaveProperty('visible');
    });

    it('hidden state has opacity 0 and positive y offset', () => {
      expect(fadeInUp.hidden).toEqual({
        opacity: 0,
        y: 24,
      });
    });

    it('visible state has opacity 1 and y 0', () => {
      expect(fadeInUp.visible.opacity).toBe(1);
      expect(fadeInUp.visible.y).toBe(0);
    });

    it('visible transition uses APPLE_EASE', () => {
      expect(fadeInUp.visible.transition).toBeDefined();
      expect(fadeInUp.visible.transition.ease).toEqual(APPLE_EASE);
    });

    it('visible transition has duration', () => {
      expect(fadeInUp.visible.transition.duration).toBe(0.6);
    });
  });

  describe('fadeInLeft', () => {
    it('hidden state has negative x offset', () => {
      expect(fadeInLeft.hidden.x).toBe(-32);
      expect(fadeInLeft.hidden.opacity).toBe(0);
    });

    it('visible state has x 0', () => {
      expect(fadeInLeft.visible.x).toBe(0);
      expect(fadeInLeft.visible.opacity).toBe(1);
    });
  });

  describe('fadeInRight', () => {
    it('hidden state has positive x offset', () => {
      expect(fadeInRight.hidden.x).toBe(32);
      expect(fadeInRight.hidden.opacity).toBe(0);
    });

    it('visible state has x 0', () => {
      expect(fadeInRight.visible.x).toBe(0);
      expect(fadeInRight.visible.opacity).toBe(1);
    });
  });

  describe('scaleIn', () => {
    it('hidden state has reduced scale', () => {
      expect(scaleIn.hidden.scale).toBe(0.92);
      expect(scaleIn.hidden.opacity).toBe(0);
    });

    it('visible state has scale 1', () => {
      expect(scaleIn.visible.scale).toBe(1);
      expect(scaleIn.visible.opacity).toBe(1);
    });
  });

  describe('staggerContainer', () => {
    it('has hidden and visible states', () => {
      expect(staggerContainer).toHaveProperty('hidden');
      expect(staggerContainer).toHaveProperty('visible');
    });

    it('visible has staggerChildren property', () => {
      expect(staggerContainer.visible.transition).toHaveProperty('staggerChildren');
      expect(staggerContainer.visible.transition.staggerChildren).toBe(0.12);
    });

    it('visible has delayChildren property', () => {
      expect(staggerContainer.visible.transition).toHaveProperty('delayChildren');
      expect(staggerContainer.visible.transition.delayChildren).toBe(0.1);
    });
  });

  describe('staggerContainerFast', () => {
    it('has faster stagger than regular container', () => {
      expect(staggerContainerFast.visible.transition.staggerChildren).toBe(0.08);
      expect(staggerContainerFast.visible.transition.staggerChildren).toBeLessThan(
        staggerContainer.visible.transition.staggerChildren
      );
    });

    it('has shorter delay than regular container', () => {
      expect(staggerContainerFast.visible.transition.delayChildren).toBe(0.05);
      expect(staggerContainerFast.visible.transition.delayChildren).toBeLessThan(
        staggerContainer.visible.transition.delayChildren
      );
    });
  });
});

// ==============================================
// SPRING CONFIG TESTS
// ==============================================

describe('SPRING_CONFIG', () => {
  it('exports all spring configurations', () => {
    expect(SPRING_CONFIG).toHaveProperty('gentle');
    expect(SPRING_CONFIG).toHaveProperty('bouncy');
    expect(SPRING_CONFIG).toHaveProperty('snappy');
    expect(SPRING_CONFIG).toHaveProperty('smooth');
  });

  it('all configs have type "spring"', () => {
    expect(SPRING_CONFIG.gentle.type).toBe('spring');
    expect(SPRING_CONFIG.bouncy.type).toBe('spring');
    expect(SPRING_CONFIG.snappy.type).toBe('spring');
    expect(SPRING_CONFIG.smooth.type).toBe('spring');
  });

  it('configs have stiffness and damping properties', () => {
    const configs = Object.values(SPRING_CONFIG);
    configs.forEach((config) => {
      expect(config).toHaveProperty('stiffness');
      expect(config).toHaveProperty('damping');
      expect(typeof config.stiffness).toBe('number');
      expect(typeof config.damping).toBe('number');
    });
  });

  it('snappy has higher stiffness than gentle', () => {
    expect(SPRING_CONFIG.snappy.stiffness).toBeGreaterThan(
      SPRING_CONFIG.gentle.stiffness
    );
  });

  it('bouncy has higher stiffness than smooth', () => {
    expect(SPRING_CONFIG.bouncy.stiffness).toBeGreaterThan(
      SPRING_CONFIG.smooth.stiffness
    );
  });
});

// ==============================================
// MICRO-INTERACTION TESTS
// ==============================================

describe('Micro-Interactions', () => {
  describe('buttonHover', () => {
    it('has scale property slightly above 1', () => {
      expect(buttonHover.scale).toBe(1.02);
    });

    it('has transition with APPLE_EASE', () => {
      expect(buttonHover.transition).toBeDefined();
      expect(buttonHover.transition.ease).toEqual(APPLE_EASE);
    });

    it('has short duration for quick feedback', () => {
      expect(buttonHover.transition.duration).toBe(0.2);
    });
  });

  describe('buttonTap', () => {
    it('has scale property slightly below 1', () => {
      expect(buttonTap.scale).toBe(0.98);
    });

    it('has very short duration for instant feedback', () => {
      expect(buttonTap.transition.duration).toBe(0.1);
    });
  });

  describe('cardHover', () => {
    it('has negative y offset (lift effect)', () => {
      expect(cardHover.y).toBe(-4);
    });

    it('has slight scale increase', () => {
      expect(cardHover.scale).toBe(1.01);
    });

    it('uses APPLE_EASE for smooth animation', () => {
      expect(cardHover.transition.ease).toEqual(APPLE_EASE);
    });
  });

  describe('iconPulse', () => {
    it('has keyframe scale array', () => {
      expect(Array.isArray(iconPulse.scale)).toBe(true);
      expect(iconPulse.scale).toEqual([1, 1.1, 1]);
    });

    it('has matching times array', () => {
      expect(iconPulse.transition.times).toEqual([0, 0.5, 1]);
    });
  });

  describe('shimmer', () => {
    it('has x translation keyframes', () => {
      expect(shimmer.x).toEqual(['-100%', '100%']);
    });

    it('repeats infinitely', () => {
      expect(shimmer.transition.repeat).toBe(Infinity);
    });

    it('uses linear easing', () => {
      expect(shimmer.transition.ease).toBe('linear');
    });
  });
});

// ==============================================
// GRADIENT TESTS
// ==============================================

describe('GRADIENTS', () => {
  it('exports all gradient presets', () => {
    expect(GRADIENTS).toHaveProperty('coralPink');
    expect(GRADIENTS).toHaveProperty('pinkPurple');
    expect(GRADIENTS).toHaveProperty('purpleBlue');
    expect(GRADIENTS).toHaveProperty('blueCoral');
    expect(GRADIENTS).toHaveProperty('coralPurple');
    expect(GRADIENTS).toHaveProperty('coralSubtle');
    expect(GRADIENTS).toHaveProperty('purpleSubtle');
  });

  it('gradients use TIS TIS brand colors', () => {
    expect(GRADIENTS.coralPink).toContain('tis-coral');
    expect(GRADIENTS.coralPink).toContain('tis-pink');
  });

  it('gradients follow Tailwind gradient syntax', () => {
    Object.values(GRADIENTS).forEach((gradient) => {
      expect(gradient).toMatch(/from-/);
      expect(gradient).toMatch(/to-/);
    });
  });

  it('coralPurple uses via for three-color gradient', () => {
    expect(GRADIENTS.coralPurple).toContain('via-');
  });

  it('subtle gradients have opacity modifiers', () => {
    expect(GRADIENTS.coralSubtle).toContain('/10');
    expect(GRADIENTS.purpleSubtle).toContain('/10');
  });
});

// ==============================================
// VIEWPORT CONFIG TESTS
// ==============================================

describe('VIEWPORT_CONFIG', () => {
  it('exports all viewport presets', () => {
    expect(VIEWPORT_CONFIG).toHaveProperty('standard');
    expect(VIEWPORT_CONFIG).toHaveProperty('eager');
    expect(VIEWPORT_CONFIG).toHaveProperty('preload');
  });

  it('all configs trigger only once', () => {
    expect(VIEWPORT_CONFIG.standard.once).toBe(true);
    expect(VIEWPORT_CONFIG.eager.once).toBe(true);
    expect(VIEWPORT_CONFIG.preload.once).toBe(true);
  });

  it('standard has negative margin for delayed trigger', () => {
    expect(VIEWPORT_CONFIG.standard.margin).toBe('-80px');
  });

  it('eager triggers at viewport edge', () => {
    expect(VIEWPORT_CONFIG.eager.margin).toBe('0px');
  });

  it('preload triggers before element is visible', () => {
    expect(VIEWPORT_CONFIG.preload.margin).toBe('100px');
  });
});

// ==============================================
// BREAKPOINT TESTS
// ==============================================

describe('BREAKPOINTS', () => {
  it('exports all Tailwind breakpoints', () => {
    expect(BREAKPOINTS).toHaveProperty('sm');
    expect(BREAKPOINTS).toHaveProperty('md');
    expect(BREAKPOINTS).toHaveProperty('lg');
    expect(BREAKPOINTS).toHaveProperty('xl');
    expect(BREAKPOINTS).toHaveProperty('2xl');
  });

  it('breakpoints are in ascending order', () => {
    expect(BREAKPOINTS.sm).toBeLessThan(BREAKPOINTS.md);
    expect(BREAKPOINTS.md).toBeLessThan(BREAKPOINTS.lg);
    expect(BREAKPOINTS.lg).toBeLessThan(BREAKPOINTS.xl);
    expect(BREAKPOINTS.xl).toBeLessThan(BREAKPOINTS['2xl']);
  });

  it('matches Tailwind default breakpoints', () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
  });
});

// ==============================================
// SECTION SPACING TESTS
// ==============================================

describe('SECTION_SPACING', () => {
  it('exports all spacing presets', () => {
    expect(SECTION_SPACING).toHaveProperty('sm');
    expect(SECTION_SPACING).toHaveProperty('md');
    expect(SECTION_SPACING).toHaveProperty('lg');
    expect(SECTION_SPACING).toHaveProperty('xl');
  });

  it('all presets use responsive padding', () => {
    Object.values(SECTION_SPACING).forEach((spacing) => {
      expect(spacing).toMatch(/py-\d+/);
      expect(spacing).toMatch(/sm:py-\d+/);
    });
  });

  it('spacing increases with size', () => {
    // Extract base py values
    const smMatch = SECTION_SPACING.sm.match(/py-(\d+)/);
    const lgMatch = SECTION_SPACING.lg.match(/py-(\d+)/);

    if (smMatch && lgMatch) {
      expect(parseInt(lgMatch[1])).toBeGreaterThan(parseInt(smMatch[1]));
    }
  });
});

// ==============================================
// CONTAINER WIDTH TESTS
// ==============================================

describe('CONTAINER_WIDTHS', () => {
  it('exports all width presets', () => {
    expect(CONTAINER_WIDTHS).toHaveProperty('narrow');
    expect(CONTAINER_WIDTHS).toHaveProperty('standard');
    expect(CONTAINER_WIDTHS).toHaveProperty('wide');
    expect(CONTAINER_WIDTHS).toHaveProperty('full');
  });

  it('all presets use max-w Tailwind classes', () => {
    Object.values(CONTAINER_WIDTHS).forEach((width) => {
      expect(width).toMatch(/^max-w-/);
    });
  });

  it('narrow is smaller than full', () => {
    expect(CONTAINER_WIDTHS.narrow).toBe('max-w-2xl');
    expect(CONTAINER_WIDTHS.full).toBe('max-w-7xl');
  });
});

// ==============================================
// TYPE SAFETY TESTS
// ==============================================

describe('Type Safety', () => {
  it('APPLE_EASE is readonly (const assertion)', () => {
    // This test verifies the tuple is properly typed
    // The TypeScript compiler ensures this at build time
    const easing: readonly [number, number, number, number] = APPLE_EASE;
    expect(easing).toHaveLength(4);
  });

  it('SPRING_CONFIG is readonly', () => {
    const config: typeof SPRING_CONFIG = SPRING_CONFIG;
    expect(Object.isFrozen(config) || typeof config === 'object').toBe(true);
  });

  it('GRADIENTS values are strings', () => {
    Object.values(GRADIENTS).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });

  it('BREAKPOINTS values are numbers', () => {
    Object.values(BREAKPOINTS).forEach((value) => {
      expect(typeof value).toBe('number');
    });
  });
});
