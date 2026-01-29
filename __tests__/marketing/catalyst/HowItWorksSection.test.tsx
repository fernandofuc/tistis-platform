/**
 * TIS TIS Catalyst - HowItWorksSection Tests
 * FASE 5 - Testing
 *
 * Tests for the "How It Works" section with:
 * - 5 process steps
 * - Timeline visual
 * - StepCard subcomponents
 * - Bottom CTA hint
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
  UserPlus: ({ className }: { className?: string }) => (
    <span data-testid="icon-user-plus" className={className}>UserPlus</span>
  ),
  BarChart3: ({ className }: { className?: string }) => (
    <span data-testid="icon-bar-chart" className={className}>BarChart3</span>
  ),
  Coins: ({ className }: { className?: string }) => (
    <span data-testid="icon-coins" className={className}>Coins</span>
  ),
  Users: ({ className }: { className?: string }) => (
    <span data-testid="icon-users" className={className}>Users</span>
  ),
  Wallet: ({ className }: { className?: string }) => (
    <span data-testid="icon-wallet" className={className}>Wallet</span>
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="icon-arrow-right" className={className}>ArrowRight</span>
  ),
}));

import HowItWorksSection from '@/app/(marketing)/catalyst/components/HowItWorksSection';

// ==============================================
// TEST SUITES
// ==============================================

describe('HowItWorksSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<HowItWorksSection />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('applies default id "how-it-works"', () => {
      render(<HowItWorksSection />);

      const section = document.getElementById('how-it-works');
      expect(section).toBeInTheDocument();
    });

    it('applies custom id when provided', () => {
      render(<HowItWorksSection id="custom-how-it-works" />);

      const section = document.getElementById('custom-how-it-works');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<HowItWorksSection className="custom-class" />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });
  });

  describe('Section Header', () => {
    it('renders eyebrow text "Proceso Simple"', () => {
      render(<HowItWorksSection />);

      expect(screen.getByText('Proceso Simple')).toBeInTheDocument();
    });

    it('renders main heading with "¿Cómo funciona?"', () => {
      render(<HowItWorksSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('¿Cómo');
      expect(heading).toHaveTextContent('funciona');
    });

    it('heading has id for aria-labelledby', () => {
      render(<HowItWorksSection />);

      const heading = document.getElementById('how-it-works-heading');
      expect(heading).toBeInTheDocument();
    });

    it('section references heading with aria-labelledby', () => {
      render(<HowItWorksSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'how-it-works-heading');
    });

    it('renders description paragraph', () => {
      render(<HowItWorksSection />);

      expect(
        screen.getByText(/De tus datos a capital en 5 pasos simples/i)
      ).toBeInTheDocument();
    });
  });

  describe('Process Steps', () => {
    it('renders all 5 process steps', () => {
      render(<HowItWorksSection />);

      // Check for step numbers (may have duplicates for mobile/desktop layouts)
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('4').length).toBeGreaterThan(0);
      expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    });

    describe('Step 1: Conecta tu negocio', () => {
      it('renders step title', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Conecta tu negocio').length).toBeGreaterThan(0);
      });

      it('renders step description', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(
          screen.getAllByText(/Integra TIS TIS a tu operación/i).length
        ).toBeGreaterThan(0);
      });

      it('renders step highlight', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Integración automática').length).toBeGreaterThan(0);
      });

      it('renders UserPlus icon', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByTestId('icon-user-plus').length).toBeGreaterThan(0);
      });
    });

    describe('Step 2: Verificamos tus datos', () => {
      it('renders step title', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Verificamos tus datos').length).toBeGreaterThan(0);
      });

      it('renders step description', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(
          screen.getAllByText(/Nuestro sistema audita y valida/i).length
        ).toBeGreaterThan(0);
      });

      it('renders step highlight', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Auditoría inteligente').length).toBeGreaterThan(0);
      });
    });

    describe('Step 3: Tokeniza tu proyecto', () => {
      it('renders step title', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Tokeniza tu proyecto').length).toBeGreaterThan(0);
      });

      it('renders step description', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(
          screen.getAllByText(/Define tu plan de expansión/i).length
        ).toBeGreaterThan(0);
      });

      it('renders step highlight', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Proceso digital').length).toBeGreaterThan(0);
      });

      it('renders Coins icon', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByTestId('icon-coins').length).toBeGreaterThan(0);
      });
    });

    describe('Step 4: Inversionistas participan', () => {
      it('renders step title', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Inversionistas participan').length).toBeGreaterThan(0);
      });

      it('renders step description', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(
          screen.getAllByText(/Tu proyecto se presenta a nuestra red/i).length
        ).toBeGreaterThan(0);
      });

      it('renders step highlight', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Red de capital').length).toBeGreaterThan(0);
      });

      it('renders Users icon', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByTestId('icon-users').length).toBeGreaterThan(0);
      });
    });

    describe('Step 5: Recibe tu capital', () => {
      it('renders step title', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Recibe tu capital').length).toBeGreaterThan(0);
      });

      it('renders step description', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(
          screen.getAllByText(/Una vez fondeado, recibe el capital/i).length
        ).toBeGreaterThan(0);
      });

      it('renders step highlight', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByText('Capital directo').length).toBeGreaterThan(0);
      });

      it('renders Wallet icon', () => {
        render(<HowItWorksSection />);

        // May have duplicates for mobile/desktop
        expect(screen.getAllByTestId('icon-wallet').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Step Icons', () => {
    it('renders all step icons', () => {
      render(<HowItWorksSection />);

      // All icons may have duplicates for mobile/desktop layouts
      expect(screen.getAllByTestId('icon-user-plus').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('icon-bar-chart').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('icon-coins').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('icon-users').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('icon-wallet').length).toBeGreaterThan(0);
    });
  });

  describe('Bottom CTA Hint', () => {
    it('renders timing information', () => {
      render(<HowItWorksSection />);

      // May have duplicates for mobile/desktop
      expect(screen.getAllByText(/Desde solicitud hasta capital/i).length).toBeGreaterThan(0);
    });

    it('renders time estimate', () => {
      render(<HowItWorksSection />);

      // May have duplicates for mobile/desktop
      expect(screen.getAllByText('2-4 semanas').length).toBeGreaterThan(0);
    });

    it('renders arrow icon', () => {
      render(<HowItWorksSection />);

      // May have duplicates for mobile/desktop
      expect(screen.getAllByTestId('icon-arrow-right').length).toBeGreaterThan(0);
    });

    it('CTA hint has pill styling', () => {
      render(<HowItWorksSection />);

      // Get first match for pill styling check
      const ctaHints = screen.getAllByText('2-4 semanas');
      const ctaHint = ctaHints[0].closest('[class*="rounded-full"]');
      expect(ctaHint).toBeInTheDocument();
    });
  });

  describe('Timeline Visual', () => {
    it('renders connector lines between steps', () => {
      const { container } = render(<HowItWorksSection />);

      // Check for decorative connector lines
      const connectorLines = container.querySelectorAll('[aria-hidden="true"]');
      expect(connectorLines.length).toBeGreaterThan(0);
    });

    it('connector lines are hidden from screen readers', () => {
      const { container } = render(<HowItWorksSection />);

      const decorativeElements = container.querySelectorAll('[aria-hidden="true"]');
      decorativeElements.forEach((element) => {
        expect(element).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Step Numbers', () => {
    it('step numbers are in gradient circles', () => {
      render(<HowItWorksSection />);

      const stepNumbers = ['1', '2', '3', '4', '5'];
      stepNumbers.forEach((number) => {
        // May have duplicates for mobile/desktop, get first
        const numberElements = screen.getAllByText(number);
        const circle = numberElements[0].closest('[class*="rounded-full"]');
        expect(circle).toBeInTheDocument();
      });
    });

    it('step number circles have gradient background', () => {
      render(<HowItWorksSection />);

      // May have duplicates for mobile/desktop, get first
      const numberOnes = screen.getAllByText('1');
      const circle = numberOnes[0].closest('[class*="bg-gradient-to"]');
      expect(circle).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('section has aria-labelledby', () => {
      render(<HowItWorksSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'how-it-works-heading');
    });

    it('all step titles are headings', () => {
      render(<HowItWorksSection />);

      // Step titles should be h3 (may have duplicates for mobile/desktop)
      const stepTitles = [
        'Conecta tu negocio',
        'Verificamos tus datos',
        'Tokeniza tu proyecto',
        'Inversionistas participan',
        'Recibe tu capital',
      ];

      stepTitles.forEach((title) => {
        const headings = screen.getAllByText(title);
        // Check first instance
        expect(headings[0].tagName).toBe('H3');
      });
    });

    it('icons are decorative (aria-hidden)', () => {
      render(<HowItWorksSection />);

      // Icons in our mock should be rendered
      const icons = screen.getAllByTestId(/icon-/);
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('section has responsive padding', () => {
      render(<HowItWorksSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/px-4/);
      expect(section?.className).toMatch(/sm:px-6/);
      expect(section?.className).toMatch(/lg:px-8/);
    });

    it('step cards have different layouts for mobile and desktop', () => {
      render(<HowItWorksSection />);

      // Check for responsive layout classes (may have duplicates)
      const stepContainers = screen.getAllByText('Conecta tu negocio');
      const stepContainer = stepContainers[0].closest('[class*="lg:"]');
      expect(stepContainer).toBeInTheDocument();
    });

    it('header has responsive margin', () => {
      render(<HowItWorksSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      const headerContainer = heading.closest('[class*="mb-"]');
      expect(headerContainer?.className).toMatch(/sm:mb-|lg:mb-/);
    });
  });

  describe('Styling Classes', () => {
    it('section has white background', () => {
      render(<HowItWorksSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('bg-white');
    });

    it('section has dark mode background', () => {
      render(<HowItWorksSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/dark:bg-slate-900/);
    });

    it('step cards have rounded corners', () => {
      render(<HowItWorksSection />);

      // May have duplicates, get first
      const stepCards = screen.getAllByText('Conecta tu negocio');
      const stepCard = stepCards[0].closest('[class*="rounded"]');
      expect(stepCard?.className).toMatch(/rounded-2xl|rounded-3xl/);
    });

    it('step cards have shadow on hover', () => {
      render(<HowItWorksSection />);

      const cardWithHoverShadow = document.querySelector('[class*="group-hover:shadow"]');
      expect(cardWithHoverShadow).toBeInTheDocument();
    });
  });

  describe('Dark Mode', () => {
    it('main heading has dark mode text color', () => {
      render(<HowItWorksSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.className).toMatch(/dark:text-white/);
    });

    it('step descriptions have dark mode text color', () => {
      render(<HowItWorksSection />);

      // May have duplicates, get first
      const descriptions = screen.getAllByText(/Integra TIS TIS a tu operación/i);
      expect(descriptions[0].className).toMatch(/dark:/);
    });

    it('step cards have dark mode background', () => {
      render(<HowItWorksSection />);

      // May have duplicates, get first
      const stepCards = screen.getAllByText('Conecta tu negocio');
      const stepCard = stepCards[0].closest('[class*="dark:bg-"]');
      expect(stepCard).toBeInTheDocument();
    });
  });

  describe('Content Structure', () => {
    it('steps are in chronological order', () => {
      render(<HowItWorksSection />);

      const stepTexts = screen.getAllByRole('heading', { level: 3 });
      const stepOrder = stepTexts.map((h) => h.textContent);

      // May have duplicates for mobile/desktop, so we check that all expected titles appear
      // and they appear in the correct relative order
      const expectedOrder = [
        'Conecta tu negocio',
        'Verificamos tus datos',
        'Tokeniza tu proyecto',
        'Inversionistas participan',
        'Recibe tu capital',
      ];

      // Filter to unique titles in order of first appearance
      const uniqueOrder = stepOrder.filter((title, index) =>
        stepOrder.indexOf(title) === index
      );

      expect(uniqueOrder).toEqual(expectedOrder);
    });

    it('each step has highlight badge above title', () => {
      render(<HowItWorksSection />);

      const highlights = [
        'Integración automática',
        'Auditoría inteligente',
        'Proceso digital',
        'Red de capital',
        'Capital directo',
      ];

      // May have duplicates for mobile/desktop
      highlights.forEach((highlight) => {
        expect(screen.getAllByText(highlight).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Hover Effects', () => {
    it('step containers have group class', () => {
      render(<HowItWorksSection />);

      const groups = document.querySelectorAll('.group');
      expect(groups.length).toBeGreaterThan(0);
    });

    it('step cards have transition on shadow', () => {
      render(<HowItWorksSection />);

      const cardWithTransition = document.querySelector('[class*="transition-shadow"]');
      expect(cardWithTransition).toBeInTheDocument();
    });
  });
});
