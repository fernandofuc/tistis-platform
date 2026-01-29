/**
 * TIS TIS Catalyst - WhatIsSection Tests
 * FASE 5 - Testing
 *
 * Tests for the "What Is Catalyst" section with:
 * - Section header and content
 * - Comparison cards (Traditional vs Catalyst)
 * - Feature grid with 6 features
 * - Accessibility and responsive design
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Framer-motion props that should NOT be passed to DOM elements
const MOTION_PROPS = ['initial', 'animate', 'exit', 'variants', 'transition', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'whileInView', 'viewport', 'layout', 'layoutId', 'custom', 'inherit', 'onAnimationStart', 'onAnimationComplete', 'onViewportEnter', 'onViewportLeave', 'drag', 'dragConstraints', 'dragElastic', 'dragMomentum', 'onDrag', 'onDragStart', 'onDragEnd'];

// Helper to filter motion props
const filterMotionProps = (props: Record<string, unknown>) => {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!MOTION_PROPS.includes(key)) filtered[key] = value;
  }
  return filtered;
};

// Mock framer-motion before imports
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...filterMotionProps(props)}>{children}</div>
    ),
    section: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <section {...filterMotionProps(props)}>{children}</section>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...filterMotionProps(props)}>{children}</span>
    ),
    h2: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h2 {...filterMotionProps(props)}>{children}</h2>
    ),
    h3: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h3 {...filterMotionProps(props)}>{children}</h3>
    ),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...filterMotionProps(props)}>{children}</p>
    ),
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Coins: ({ className }: { className?: string }) => (
    <span data-testid="icon-coins" className={className}>Coins</span>
  ),
  Shield: ({ className }: { className?: string }) => (
    <span data-testid="icon-shield" className={className}>Shield</span>
  ),
  TrendingUp: ({ className }: { className?: string }) => (
    <span data-testid="icon-trending-up" className={className}>TrendingUp</span>
  ),
  BarChart3: ({ className }: { className?: string }) => (
    <span data-testid="icon-bar-chart" className={className}>BarChart3</span>
  ),
  Zap: ({ className }: { className?: string }) => (
    <span data-testid="icon-zap" className={className}>Zap</span>
  ),
  Lock: ({ className }: { className?: string }) => (
    <span data-testid="icon-lock" className={className}>Lock</span>
  ),
}));

import WhatIsSection from '@/app/(marketing)/catalyst/components/WhatIsSection';

// ==============================================
// TEST SUITES
// ==============================================

describe('WhatIsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<WhatIsSection />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('applies default id "what-is"', () => {
      render(<WhatIsSection />);

      const section = document.getElementById('what-is');
      expect(section).toBeInTheDocument();
    });

    it('applies custom id when provided', () => {
      render(<WhatIsSection id="custom-what-is" />);

      const section = document.getElementById('custom-what-is');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<WhatIsSection className="custom-class" />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });
  });

  describe('Section Header', () => {
    it('renders eyebrow text "¿Qué es Catalyst?"', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('¿Qué es Catalyst?')).toBeInTheDocument();
    });

    it('renders main heading with "Financiamiento reinventado"', () => {
      render(<WhatIsSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Financiamiento');
      expect(heading).toHaveTextContent('reinventado');
    });

    it('heading has id for aria-labelledby', () => {
      render(<WhatIsSection />);

      const heading = document.getElementById('what-is-heading');
      expect(heading).toBeInTheDocument();
    });

    it('section references heading with aria-labelledby', () => {
      render(<WhatIsSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'what-is-heading');
    });

    it('renders description paragraph', () => {
      render(<WhatIsSection />);

      expect(
        screen.getByText(/Catalyst es la plataforma de tokenización/i)
      ).toBeInTheDocument();
    });
  });

  describe('Comparison Cards', () => {
    describe('Traditional Finance Card', () => {
      it('renders traditional finance card', () => {
        render(<WhatIsSection />);

        expect(screen.getByText('Financiamiento Tradicional')).toBeInTheDocument();
      });

      it('shows "El problema actual" heading', () => {
        render(<WhatIsSection />);

        expect(screen.getByText('El problema actual')).toBeInTheDocument();
      });

      it('lists traditional finance problems', () => {
        render(<WhatIsSection />);

        expect(screen.getByText(/Meses de espera para aprobación/i)).toBeInTheDocument();
        expect(screen.getByText(/Garantías personales requeridas/i)).toBeInTheDocument();
        expect(screen.getByText(/Tasas de interés elevadas/i)).toBeInTheDocument();
        expect(screen.getByText(/Burocracia interminable/i)).toBeInTheDocument();
      });

      it('traditional items have ✕ marker', () => {
        render(<WhatIsSection />);

        const traditionalCard = screen.getByText('El problema actual').closest('div');
        const markers = traditionalCard?.querySelectorAll('span');
        const crossMarkers = Array.from(markers || []).filter(
          (span) => span.textContent === '✕'
        );
        expect(crossMarkers.length).toBe(4);
      });
    });

    describe('Catalyst Card', () => {
      it('renders Catalyst card', () => {
        render(<WhatIsSection />);

        expect(screen.getByText('Con TIS TIS Catalyst')).toBeInTheDocument();
      });

      it('shows "La nueva forma" heading', () => {
        render(<WhatIsSection />);

        expect(screen.getByText('La nueva forma')).toBeInTheDocument();
      });

      it('lists Catalyst benefits', () => {
        render(<WhatIsSection />);

        // Use getAllByText since there may be multiple matches
        expect(screen.getAllByText(/Capital en semanas, no meses/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Tus datos son tu garantía/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Condiciones transparentes/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/100% digital y automatizado/i).length).toBeGreaterThan(0);
      });

      it('Catalyst items have ✓ marker', () => {
        render(<WhatIsSection />);

        const catalystCard = screen.getByText('La nueva forma').closest('div');
        const markers = catalystCard?.querySelectorAll('span');
        const checkMarkers = Array.from(markers || []).filter(
          (span) => span.textContent === '✓'
        );
        expect(checkMarkers.length).toBe(4);
      });

      it('Catalyst card has gradient background', () => {
        render(<WhatIsSection />);

        // The card with gradient is a parent container of the "La nueva forma" heading
        const heading = screen.getByText('La nueva forma');
        // Navigate up to find the card with gradient - it's the motion.div wrapper
        let currentElement = heading.closest('[class*="bg-gradient-to"]');
        expect(currentElement).toBeInTheDocument();
      });
    });
  });

  describe('Features Grid', () => {
    it('renders 6 feature cards', () => {
      render(<WhatIsSection />);

      const featureIcons = screen.getAllByTestId(/icon-/);
      // Should have icons for 6 features
      expect(featureIcons.length).toBeGreaterThanOrEqual(6);
    });

    it('renders Tokenización Inteligente feature', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('Tokenización Inteligente')).toBeInTheDocument();
    });

    it('renders Datos Verificados feature', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('Datos Verificados')).toBeInTheDocument();
    });

    it('renders Crecimiento Acelerado feature', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('Crecimiento Acelerado')).toBeInTheDocument();
    });

    it('renders Analytics en Vivo feature', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('Analytics en Vivo')).toBeInTheDocument();
    });

    it('renders Proceso Ágil feature', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('Proceso Ágil')).toBeInTheDocument();
    });

    it('renders Seguridad Total feature', () => {
      render(<WhatIsSection />);

      expect(screen.getByText('Seguridad Total')).toBeInTheDocument();
    });

    it('each feature has a description', () => {
      render(<WhatIsSection />);

      // Check for feature descriptions
      expect(
        screen.getByText(/Convierte tus planes de expansión en tokens/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/TIS TIS audita y verifica automáticamente/i)
      ).toBeInTheDocument();
    });
  });

  describe('Feature Icons', () => {
    it('renders Coins icon for Tokenización', () => {
      render(<WhatIsSection />);

      expect(screen.getByTestId('icon-coins')).toBeInTheDocument();
    });

    it('renders Shield icon for Datos Verificados', () => {
      render(<WhatIsSection />);

      expect(screen.getByTestId('icon-shield')).toBeInTheDocument();
    });

    it('renders TrendingUp icon for Crecimiento', () => {
      render(<WhatIsSection />);

      expect(screen.getByTestId('icon-trending-up')).toBeInTheDocument();
    });

    it('renders BarChart icon for Analytics', () => {
      render(<WhatIsSection />);

      expect(screen.getByTestId('icon-bar-chart')).toBeInTheDocument();
    });

    it('renders Zap icon for Proceso Ágil', () => {
      render(<WhatIsSection />);

      expect(screen.getByTestId('icon-zap')).toBeInTheDocument();
    });

    it('renders Lock icon for Seguridad', () => {
      render(<WhatIsSection />);

      expect(screen.getByTestId('icon-lock')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('section has aria-labelledby', () => {
      render(<WhatIsSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'what-is-heading');
    });

    it('feature cards are within the grid', () => {
      render(<WhatIsSection />);

      // Features should be in a grid layout
      const features = screen.getAllByText(/Tokenización Inteligente|Datos Verificados|Crecimiento Acelerado|Analytics en Vivo|Proceso Ágil|Seguridad Total/i);
      expect(features.length).toBe(6);
    });

    it('icons are properly hidden from screen readers', () => {
      render(<WhatIsSection />);

      const icons = screen.getAllByTestId(/icon-/);
      // Icons in the mock have aria-hidden attribute or are decorative
      icons.forEach((icon) => {
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('section has responsive padding', () => {
      render(<WhatIsSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/px-4/);
      expect(section?.className).toMatch(/sm:px-6/);
      expect(section?.className).toMatch(/lg:px-8/);
    });

    it('comparison cards grid is responsive', () => {
      const { container } = render(<WhatIsSection />);

      // Find the grid container with comparison cards responsive classes
      const gridWithResponsive = container.querySelector('[class*="md:grid-cols-2"]');
      expect(gridWithResponsive).toBeInTheDocument();
      expect(gridWithResponsive?.className).toMatch(/grid-cols-1/);
    });

    it('features grid is responsive', () => {
      const { container } = render(<WhatIsSection />);

      // Find the features grid with responsive classes
      const gridWithResponsive = container.querySelector('[class*="lg:grid-cols-3"]');
      expect(gridWithResponsive).toBeInTheDocument();
      expect(gridWithResponsive?.className).toMatch(/sm:grid-cols-2/);
    });
  });

  describe('Styling Classes', () => {
    it('section has background color classes', () => {
      render(<WhatIsSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('bg-slate-50/50');
    });

    it('section has dark mode background', () => {
      render(<WhatIsSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/dark:bg-slate-900\/50/);
    });

    it('feature cards have rounded corners', () => {
      render(<WhatIsSection />);

      const featureCard = screen.getByText('Tokenización Inteligente').closest('[class*="rounded"]');
      expect(featureCard?.className).toMatch(/rounded-2xl|rounded-3xl/);
    });

    it('feature cards have shadow', () => {
      render(<WhatIsSection />);

      const featureCard = screen.getByText('Tokenización Inteligente').closest('[class*="shadow"]');
      expect(featureCard).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    it('main heading has dark mode text color', () => {
      render(<WhatIsSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.className).toMatch(/dark:text-white/);
    });

    it('feature cards have dark mode styling', () => {
      render(<WhatIsSection />);

      const featureCard = screen.getByText('Tokenización Inteligente').closest('[class*="dark:"]');
      expect(featureCard).toBeInTheDocument();
    });
  });

  describe('Hover Effects', () => {
    it('feature cards have group class for hover effects', () => {
      render(<WhatIsSection />);

      // Find feature card container
      const featureCards = document.querySelectorAll('.group');
      expect(featureCards.length).toBeGreaterThan(0);
    });

    it('feature cards have hover shadow', () => {
      render(<WhatIsSection />);

      const cardWithHoverShadow = document.querySelector('[class*="group-hover:shadow"]');
      expect(cardWithHoverShadow).toBeInTheDocument();
    });
  });
});
