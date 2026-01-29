/**
 * TIS TIS Catalyst - Test Utilities
 * FASE 5 - Testing
 *
 * Shared test utilities, mocks, and helpers for Catalyst landing page components.
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import { vi } from 'vitest';
import type { ReactNode, ComponentType } from 'react';

// ==============================================
// FRAMER MOTION PROPS FILTER
// ==============================================

/**
 * Props that framer-motion uses but should NOT be passed to DOM elements.
 * Passing these to DOM elements causes React warnings.
 */
const FRAMER_MOTION_PROPS = [
  // Animation state props
  'initial',
  'animate',
  'exit',
  'variants',
  'transition',
  // Gesture props
  'whileHover',
  'whileTap',
  'whileFocus',
  'whileDrag',
  'whileInView',
  // Viewport props
  'viewport',
  'onViewportEnter',
  'onViewportLeave',
  // Layout props
  'layout',
  'layoutId',
  'layoutDependency',
  'layoutScroll',
  // Drag props
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'dragTransition',
  'dragPropagation',
  'dragControls',
  'dragListener',
  'onDrag',
  'onDragStart',
  'onDragEnd',
  'onDirectionLock',
  // Other framer-specific props
  'custom',
  'inherit',
  'onAnimationStart',
  'onAnimationComplete',
  'onUpdate',
  'transformTemplate',
  'style', // Let React handle style, but filter motion-specific style transforms
] as const;

/**
 * Filters out framer-motion specific props from an object.
 * This prevents React warnings about unknown DOM attributes.
 */
export function filterMotionProps<T extends Record<string, unknown>>(props: T): Partial<T> {
  const filteredProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (!FRAMER_MOTION_PROPS.includes(key as typeof FRAMER_MOTION_PROPS[number])) {
      filteredProps[key] = value;
    }
  }

  return filteredProps as Partial<T>;
}

// ==============================================
// FRAMER MOTION MOCKS
// ==============================================

/**
 * Mock motion components that render as standard HTML elements.
 * Props are filtered to remove framer-motion specific attributes
 * that would cause React warnings when passed to DOM elements.
 *
 * Note: We use `any` for the rest props to accept motion-specific props
 * that will be filtered out. The children type is explicitly ReactNode.
 */
export const mockMotionComponents = {
  motion: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    div: React.forwardRef<HTMLDivElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <div ref={ref} {...filterMotionProps(props)}>{children}</div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    section: React.forwardRef<HTMLElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <section ref={ref} {...filterMotionProps(props)}>{children}</section>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    span: React.forwardRef<HTMLSpanElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <span ref={ref} {...filterMotionProps(props)}>{children}</span>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    h1: React.forwardRef<HTMLHeadingElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <h1 ref={ref} {...filterMotionProps(props)}>{children}</h1>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    h2: React.forwardRef<HTMLHeadingElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <h2 ref={ref} {...filterMotionProps(props)}>{children}</h2>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    h3: React.forwardRef<HTMLHeadingElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <h3 ref={ref} {...filterMotionProps(props)}>{children}</h3>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: React.forwardRef<HTMLParagraphElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <p ref={ref} {...filterMotionProps(props)}>{children}</p>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    button: React.forwardRef<HTMLButtonElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <button ref={ref} {...filterMotionProps(props)}>{children}</button>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    a: React.forwardRef<HTMLAnchorElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <a ref={ref} {...filterMotionProps(props)}>{children}</a>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    article: React.forwardRef<HTMLElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <article ref={ref} {...filterMotionProps(props)}>{children}</article>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: React.forwardRef<HTMLFormElement, { children?: ReactNode } & Record<string, any>>(
      ({ children, ...props }, ref) => <form ref={ref} {...filterMotionProps(props)}>{children}</form>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: React.forwardRef<HTMLInputElement, Record<string, any>>(
      (props, ref) => <input ref={ref} {...filterMotionProps(props)} />
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  useAnimation: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    set: vi.fn(),
  }),
  useInView: () => true,
};

/**
 * Creates the framer-motion mock module
 */
export function createFramerMotionMock() {
  return mockMotionComponents;
}

// ==============================================
// LUCIDE REACT ICON MOCKS
// ==============================================

/**
 * Mock Lucide icons as simple spans with testid
 */
export const createIconMock = (name: string): ComponentType<{ className?: string }> => {
  const MockIcon = ({ className }: { className?: string }) => (
    <span data-testid={`icon-${name}`} className={className} aria-hidden="true">
      {name}
    </span>
  );
  MockIcon.displayName = name;
  return MockIcon;
};

// ==============================================
// VIEWPORT MOCK HELPERS
// ==============================================

/**
 * Mock window.matchMedia for responsive tests
 */
export function mockMatchMedia(matches: boolean = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/**
 * Mock prefers-reduced-motion for accessibility tests
 */
export function mockReducedMotion(prefersReduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? prefersReduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ==============================================
// TEST DATA FACTORIES
// ==============================================

/**
 * Factory for creating test section IDs
 */
export const TEST_IDS = {
  heroSection: 'hero-section',
  whatIsSection: 'what-is-section',
  howItWorksSection: 'how-it-works-section',
  benefitsSection: 'benefits-section',
  useCasesSection: 'use-cases-section',
  comingSoonCTA: 'coming-soon-cta',
} as const;

// ==============================================
// CUSTOM RENDER WITH PROVIDERS
// ==============================================

import { render, RenderOptions } from '@testing-library/react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  prefersReducedMotion?: boolean;
}

/**
 * Custom render function with optional providers and mocks
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { prefersReducedMotion = false, ...renderOptions } = options;

  if (prefersReducedMotion) {
    mockReducedMotion(true);
  }

  return render(ui, { ...renderOptions });
}

// ==============================================
// ASSERTION HELPERS
// ==============================================

/**
 * Check if element has TIS TIS brand gradient classes
 */
export function hasTISGradient(element: HTMLElement): boolean {
  const gradientPatterns = [
    'from-tis-coral',
    'to-tis-pink',
    'from-tis-pink',
    'to-tis-purple',
    'via-tis-pink',
  ];

  const className = element.className;
  return gradientPatterns.some((pattern) => className.includes(pattern));
}

/**
 * Check if element has dark mode classes
 */
export function hasDarkModeSupport(element: HTMLElement): boolean {
  const className = element.className;
  return className.includes('dark:');
}

/**
 * Check if element has responsive classes
 */
export function hasResponsiveClasses(element: HTMLElement): boolean {
  const responsivePrefixes = ['sm:', 'md:', 'lg:', 'xl:', '2xl:'];
  const className = element.className;
  return responsivePrefixes.some((prefix) => className.includes(prefix));
}

// ==============================================
// ACCESSIBILITY HELPERS
// ==============================================

/**
 * Check if element has proper ARIA attributes for sections
 */
export function hasProperSectionAria(section: HTMLElement): boolean {
  return (
    section.hasAttribute('aria-labelledby') ||
    section.hasAttribute('aria-label')
  );
}

/**
 * Check if buttons have accessible names
 */
export function hasAccessibleName(button: HTMLElement): boolean {
  const ariaLabel = button.getAttribute('aria-label');
  const textContent = button.textContent?.trim();
  return Boolean(ariaLabel || textContent);
}

// ==============================================
// RE-EXPORTS
// ==============================================

export { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
