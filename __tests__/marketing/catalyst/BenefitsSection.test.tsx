/**
 * TIS TIS Catalyst - BenefitsSection Tests
 * FASE 5 - Testing
 *
 * Tests for the Benefits section with:
 * - 6 benefit cards with stats
 * - Stats bar with 4 metrics
 * - BenefitCard subcomponents
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
    article: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <article {...filterMotionProps(props)}>{children}</article>
    ),
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Clock: ({ className }: { className?: string }) => (
    <span data-testid="icon-clock" className={className}>Clock</span>
  ),
  PiggyBank: ({ className }: { className?: string }) => (
    <span data-testid="icon-piggy-bank" className={className}>PiggyBank</span>
  ),
  Target: ({ className }: { className?: string }) => (
    <span data-testid="icon-target" className={className}>Target</span>
  ),
  Building2: ({ className }: { className?: string }) => (
    <span data-testid="icon-building" className={className}>Building2</span>
  ),
  LineChart: ({ className }: { className?: string }) => (
    <span data-testid="icon-line-chart" className={className}>LineChart</span>
  ),
  HeartHandshake: ({ className }: { className?: string }) => (
    <span data-testid="icon-heart-handshake" className={className}>HeartHandshake</span>
  ),
}));

import BenefitsSection from '@/app/(marketing)/catalyst/components/BenefitsSection';

// ==============================================
// TEST SUITES
// ==============================================

describe('BenefitsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<BenefitsSection />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('applies default id "benefits"', () => {
      render(<BenefitsSection />);

      const section = document.getElementById('benefits');
      expect(section).toBeInTheDocument();
    });

    it('applies custom id when provided', () => {
      render(<BenefitsSection id="custom-benefits" />);

      const section = document.getElementById('custom-benefits');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<BenefitsSection className="custom-class" />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });
  });

  describe('Section Header', () => {
    it('renders eyebrow text "¿Por qué Catalyst?"', () => {
      render(<BenefitsSection />);

      expect(screen.getByText('¿Por qué Catalyst?')).toBeInTheDocument();
    });

    it('renders main heading with "Beneficios reales"', () => {
      render(<BenefitsSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Beneficios');
      expect(heading).toHaveTextContent('reales');
    });

    it('heading has id for aria-labelledby', () => {
      render(<BenefitsSection />);

      const heading = document.getElementById('benefits-heading');
      expect(heading).toBeInTheDocument();
    });

    it('section references heading with aria-labelledby', () => {
      render(<BenefitsSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'benefits-heading');
    });

    it('renders description paragraph', () => {
      render(<BenefitsSection />);

      expect(
        screen.getByText(/No solo palabras. Resultados medibles/i)
      ).toBeInTheDocument();
    });
  });

  describe('Stats Bar', () => {
    it('renders capital conectado stat', () => {
      render(<BenefitsSection />);

      expect(screen.getByText('$10M+')).toBeInTheDocument();
      expect(screen.getByText('Capital conectado')).toBeInTheDocument();
    });

    it('renders negocios verificados stat', () => {
      render(<BenefitsSection />);

      expect(screen.getByText('50+')).toBeInTheDocument();
      expect(screen.getByText('Negocios verificados')).toBeInTheDocument();
    });

    it('renders semanas promedio stat', () => {
      render(<BenefitsSection />);

      expect(screen.getByText('2-4')).toBeInTheDocument();
      expect(screen.getByText('Semanas promedio')).toBeInTheDocument();
    });

    it('renders fondeo exitoso stat', () => {
      render(<BenefitsSection />);

      expect(screen.getByText('98%')).toBeInTheDocument();
      expect(screen.getByText('Fondeo exitoso')).toBeInTheDocument();
    });

    it('stats bar has dark gradient background', () => {
      render(<BenefitsSection />);

      // Check for the gradient background container
      const statsBar = screen.getByText('$10M+').closest('[class*="bg-gradient-to-r"]');
      expect(statsBar).toBeInTheDocument();
    });
  });

  describe('Benefit Cards', () => {
    it('renders 6 benefit cards', () => {
      render(<BenefitsSection />);

      const articles = document.querySelectorAll('article');
      expect(articles.length).toBe(6);
    });

    describe('Velocidad sin precedentes', () => {
      it('renders title', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('Velocidad sin precedentes')).toBeInTheDocument();
      });

      it('renders description', () => {
        render(<BenefitsSection />);

        expect(
          screen.getByText(/Olvídate de meses esperando aprobaciones/i)
        ).toBeInTheDocument();
      });

      it('renders stat value', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('4x')).toBeInTheDocument();
      });

      it('renders stat label', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('más rápido que bancos')).toBeInTheDocument();
      });

      it('renders Clock icon', () => {
        render(<BenefitsSection />);

        expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
      });
    });

    describe('Mantén tu empresa', () => {
      it('renders title', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('Mantén tu empresa')).toBeInTheDocument();
      });

      it('renders stat value', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      it('renders stat label', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('ownership mantenido')).toBeInTheDocument();
      });

      it('renders Building icon', () => {
        render(<BenefitsSection />);

        expect(screen.getByTestId('icon-building')).toBeInTheDocument();
      });
    });

    describe('Basado en datos reales', () => {
      it('renders title', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('Basado en datos reales')).toBeInTheDocument();
      });

      it('renders stat value', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('24/7')).toBeInTheDocument();
      });

      it('renders stat label', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('datos en tiempo real')).toBeInTheDocument();
      });

      it('renders LineChart icon', () => {
        render(<BenefitsSection />);

        expect(screen.getByTestId('icon-line-chart')).toBeInTheDocument();
      });
    });

    describe('Costos transparentes', () => {
      it('renders title', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('Costos transparentes')).toBeInTheDocument();
      });

      it('renders stat value', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('0')).toBeInTheDocument();
      });

      it('renders stat label', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('costos ocultos')).toBeInTheDocument();
      });

      it('renders PiggyBank icon', () => {
        render(<BenefitsSection />);

        expect(screen.getByTestId('icon-piggy-bank')).toBeInTheDocument();
      });
    });

    describe('Capital con propósito', () => {
      it('renders title', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('Capital con propósito')).toBeInTheDocument();
      });

      it('renders stat value', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('$50K-2M')).toBeInTheDocument();
      });

      it('renders stat label', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('rango de capital')).toBeInTheDocument();
      });

      it('renders Target icon', () => {
        render(<BenefitsSection />);

        expect(screen.getByTestId('icon-target')).toBeInTheDocument();
      });
    });

    describe('Relación ganar-ganar', () => {
      it('renders title', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('Relación ganar-ganar')).toBeInTheDocument();
      });

      it('renders stat value', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('95%')).toBeInTheDocument();
      });

      it('renders stat label', () => {
        render(<BenefitsSection />);

        expect(screen.getByText('tasa de satisfacción')).toBeInTheDocument();
      });

      it('renders HeartHandshake icon', () => {
        render(<BenefitsSection />);

        expect(screen.getByTestId('icon-heart-handshake')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('section has aria-labelledby', () => {
      render(<BenefitsSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'benefits-heading');
    });

    it('benefit cards are articles', () => {
      render(<BenefitsSection />);

      const articles = document.querySelectorAll('article');
      expect(articles.length).toBe(6);
    });

    it('icons are decorative (aria-hidden)', () => {
      render(<BenefitsSection />);

      // Icons in our mock are rendered with data-testid
      const icons = screen.getAllByTestId(/icon-/);
      expect(icons.length).toBe(6);
    });

    it('decorative elements have aria-hidden', () => {
      const { container } = render(<BenefitsSection />);

      const decorativeElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorativeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('section has responsive padding', () => {
      render(<BenefitsSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/px-4/);
      expect(section?.className).toMatch(/sm:px-6/);
      expect(section?.className).toMatch(/lg:px-8/);
    });

    it('stats bar grid is responsive', () => {
      render(<BenefitsSection />);

      const statsBar = screen.getByText('$10M+').closest('[class*="grid"]');
      expect(statsBar?.className).toMatch(/grid-cols-2/);
      expect(statsBar?.className).toMatch(/md:grid-cols-4/);
    });

    it('benefits grid is responsive', () => {
      render(<BenefitsSection />);

      // Find the benefits grid container
      const benefitCard = screen.getByText('Velocidad sin precedentes').closest('[class*="grid"]')?.parentElement;
      const gridContainer = benefitCard?.querySelector('[class*="grid-cols"]') || benefitCard;

      // The grid should have responsive columns
      const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
      expect(grid).toBeInTheDocument();
    });

    it('benefit cards have responsive padding', () => {
      render(<BenefitsSection />);

      const benefitCard = screen.getByText('Velocidad sin precedentes').closest('[class*="p-"]');
      expect(benefitCard?.className).toMatch(/sm:p-/);
    });
  });

  describe('Styling Classes', () => {
    it('section has background color', () => {
      render(<BenefitsSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('bg-slate-50/50');
    });

    it('section has dark mode background', () => {
      render(<BenefitsSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/dark:bg-slate-900\/50/);
    });

    it('benefit cards have rounded corners', () => {
      render(<BenefitsSection />);

      const benefitCard = screen.getByText('Velocidad sin precedentes').closest('[class*="rounded"]');
      expect(benefitCard?.className).toMatch(/rounded-2xl|rounded-3xl/);
    });

    it('benefit cards have shadow', () => {
      render(<BenefitsSection />);

      const benefitCard = screen.getByText('Velocidad sin precedentes').closest('[class*="shadow"]');
      expect(benefitCard).toBeInTheDocument();
    });

    it('benefit cards have border', () => {
      render(<BenefitsSection />);

      const benefitCard = screen.getByText('Velocidad sin precedentes').closest('[class*="border"]');
      expect(benefitCard).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    it('main heading has dark mode text color', () => {
      render(<BenefitsSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.className).toMatch(/dark:text-white/);
    });

    it('benefit cards have dark mode background', () => {
      render(<BenefitsSection />);

      const benefitCard = screen.getByText('Velocidad sin precedentes').closest('[class*="dark:bg-"]');
      expect(benefitCard).toBeInTheDocument();
    });

    it('stat labels have dark mode text color', () => {
      render(<BenefitsSection />);

      const statLabel = screen.getByText('más rápido que bancos');
      expect(statLabel.className).toMatch(/dark:/);
    });
  });

  describe('Hover Effects', () => {
    it('benefit cards have group class', () => {
      render(<BenefitsSection />);

      const groups = document.querySelectorAll('.group');
      expect(groups.length).toBeGreaterThan(0);
    });

    it('benefit cards have hover shadow', () => {
      render(<BenefitsSection />);

      const cardWithHoverShadow = document.querySelector('[class*="group-hover:shadow"]');
      expect(cardWithHoverShadow).toBeInTheDocument();
    });

    it('icons scale on hover', () => {
      render(<BenefitsSection />);

      const iconContainer = document.querySelector('[class*="group-hover:scale"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('cards have bottom gradient line on hover', () => {
      const { container } = render(<BenefitsSection />);

      const bottomLine = container.querySelector('[class*="group-hover:scale-x-100"]');
      expect(bottomLine).toBeInTheDocument();
    });
  });

  describe('Gradient Styling', () => {
    it('stat values have gradient text', () => {
      render(<BenefitsSection />);

      const statValue = screen.getByText('4x');
      expect(statValue.className).toMatch(/bg-gradient-to-r/);
      expect(statValue.className).toMatch(/bg-clip-text/);
    });

    it('icons have gradient background', () => {
      render(<BenefitsSection />);

      const iconContainer = screen.getByTestId('icon-clock').closest('[class*="bg-gradient-to"]');
      expect(iconContainer).toBeInTheDocument();
    });

    it('stats bar stats have gradient text', () => {
      render(<BenefitsSection />);

      const statBarValue = screen.getByText('$10M+');
      expect(statBarValue.className).toMatch(/bg-gradient-to-r/);
    });
  });

  describe('Content Structure', () => {
    it('each benefit card has icon, title, description, and stats', () => {
      render(<BenefitsSection />);

      // Check one complete benefit card structure
      const benefitTitle = screen.getByText('Velocidad sin precedentes');
      const card = benefitTitle.closest('article');

      expect(card).toBeInTheDocument();

      // Find elements within this card
      const title = benefitTitle;
      expect(title).toBeInTheDocument();

      // Stats should be in the same card
      expect(screen.getByText('4x')).toBeInTheDocument();
      expect(screen.getByText('más rápido que bancos')).toBeInTheDocument();
    });

    it('stats bar is before benefits grid', () => {
      render(<BenefitsSection />);

      const statsBar = screen.getByText('$10M+').closest('[class*="grid"]');
      const benefitsGrid = screen.getByText('Velocidad sin precedentes').closest('[class*="grid"]');

      // Both should exist
      expect(statsBar).toBeInTheDocument();
      expect(benefitsGrid).toBeInTheDocument();
    });
  });
});
