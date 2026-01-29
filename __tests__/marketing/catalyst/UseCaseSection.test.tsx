/**
 * TIS TIS Catalyst - UseCaseSection Tests
 * FASE 5 - Testing
 *
 * Tests for the Use Cases section with:
 * - 5 vertical use cases
 * - Interactive selector cards
 * - Detail panel with animations
 * - Active state management
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...filterMotionProps(props)}>{children}</button>
    ),
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Stethoscope: ({ className }: { className?: string }) => (
    <span data-testid="icon-stethoscope" className={className}>Stethoscope</span>
  ),
  UtensilsCrossed: ({ className }: { className?: string }) => (
    <span data-testid="icon-utensils" className={className}>UtensilsCrossed</span>
  ),
  Dumbbell: ({ className }: { className?: string }) => (
    <span data-testid="icon-dumbbell" className={className}>Dumbbell</span>
  ),
  Scissors: ({ className }: { className?: string }) => (
    <span data-testid="icon-scissors" className={className}>Scissors</span>
  ),
  Building: ({ className }: { className?: string }) => (
    <span data-testid="icon-building" className={className}>Building</span>
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="icon-arrow-right" className={className}>ArrowRight</span>
  ),
  Quote: ({ className }: { className?: string }) => (
    <span data-testid="icon-quote" className={className}>Quote</span>
  ),
}));

import UseCaseSection from '@/app/(marketing)/catalyst/components/UseCaseSection';

// ==============================================
// TEST SUITES
// ==============================================

describe('UseCaseSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<UseCaseSection />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('applies default id "use-cases"', () => {
      render(<UseCaseSection />);

      const section = document.getElementById('use-cases');
      expect(section).toBeInTheDocument();
    });

    it('applies custom id when provided', () => {
      render(<UseCaseSection id="custom-use-cases" />);

      const section = document.getElementById('custom-use-cases');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<UseCaseSection className="custom-class" />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });
  });

  describe('Section Header', () => {
    it('renders eyebrow text "Casos de Éxito"', () => {
      render(<UseCaseSection />);

      expect(screen.getByText('Casos de Éxito')).toBeInTheDocument();
    });

    it('renders main heading with "Negocios que crecieron"', () => {
      render(<UseCaseSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Negocios');
      expect(heading).toHaveTextContent('que crecieron');
    });

    it('heading has id for aria-labelledby', () => {
      render(<UseCaseSection />);

      const heading = document.getElementById('use-cases-heading');
      expect(heading).toBeInTheDocument();
    });

    it('section references heading with aria-labelledby', () => {
      render(<UseCaseSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'use-cases-heading');
    });

    it('renders description paragraph', () => {
      render(<UseCaseSection />);

      expect(
        screen.getByText(/Cada vertical tiene sus propias métricas de éxito/i)
      ).toBeInTheDocument();
    });
  });

  describe('Use Case Selector Cards', () => {
    it('renders 5 use case selector buttons', () => {
      render(<UseCaseSection />);

      const buttons = screen.getAllByRole('button', { name: /Ver caso de uso:/i });
      expect(buttons.length).toBe(5);
    });

    describe('Clínicas Dentales', () => {
      it('renders selector card', () => {
        render(<UseCaseSection />);

        expect(screen.getByRole('button', { name: /Ver caso de uso: Clínicas Dentales/i })).toBeInTheDocument();
      });

      it('shows vertical name', () => {
        render(<UseCaseSection />);

        // May have duplicates (selector + detail panel), so use getAllByText
        expect(screen.getAllByText('Clínicas Dentales').length).toBeGreaterThan(0);
      });

      it('shows funding amount', () => {
        render(<UseCaseSection />);

        // May have duplicates (selector + detail panel), so use getAllByText
        expect(screen.getAllByText('$180,000 MXN').length).toBeGreaterThan(0);
      });

      it('renders Stethoscope icon', () => {
        render(<UseCaseSection />);

        expect(screen.getAllByTestId('icon-stethoscope').length).toBeGreaterThan(0);
      });
    });

    describe('Restaurantes', () => {
      it('renders selector card', () => {
        render(<UseCaseSection />);

        expect(screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i })).toBeInTheDocument();
      });

      it('shows vertical name', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('Restaurantes')).toBeInTheDocument();
      });

      it('shows funding amount', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('$350,000 MXN')).toBeInTheDocument();
      });
    });

    describe('Gimnasios', () => {
      it('renders selector card', () => {
        render(<UseCaseSection />);

        expect(screen.getByRole('button', { name: /Ver caso de uso: Gimnasios/i })).toBeInTheDocument();
      });

      it('shows vertical name', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('Gimnasios')).toBeInTheDocument();
      });

      it('shows funding amount', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('$220,000 MXN')).toBeInTheDocument();
      });

      it('renders Dumbbell icon', () => {
        render(<UseCaseSection />);

        expect(screen.getByTestId('icon-dumbbell')).toBeInTheDocument();
      });
    });

    describe('Salones de Belleza', () => {
      it('renders selector card', () => {
        render(<UseCaseSection />);

        expect(screen.getByRole('button', { name: /Ver caso de uso: Salones de Belleza/i })).toBeInTheDocument();
      });

      it('shows vertical name', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('Salones de Belleza')).toBeInTheDocument();
      });

      it('shows funding amount', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('$150,000 MXN')).toBeInTheDocument();
      });

      it('renders Scissors icon', () => {
        render(<UseCaseSection />);

        expect(screen.getByTestId('icon-scissors')).toBeInTheDocument();
      });
    });

    describe('Consultorios Médicos', () => {
      it('renders selector card', () => {
        render(<UseCaseSection />);

        expect(screen.getByRole('button', { name: /Ver caso de uso: Consultorios Médicos/i })).toBeInTheDocument();
      });

      it('shows vertical name', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('Consultorios Médicos')).toBeInTheDocument();
      });

      it('shows funding amount', () => {
        render(<UseCaseSection />);

        expect(screen.getByText('$400,000 MXN')).toBeInTheDocument();
      });

      it('renders Building icon', () => {
        render(<UseCaseSection />);

        expect(screen.getByTestId('icon-building')).toBeInTheDocument();
      });
    });
  });

  describe('Active State', () => {
    it('first use case is active by default', () => {
      render(<UseCaseSection />);

      const firstButton = screen.getByRole('button', { name: /Ver caso de uso: Clínicas Dentales/i });
      expect(firstButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows detail panel for active use case', () => {
      render(<UseCaseSection />);

      // Default active is dental clinic
      expect(screen.getByText('Nueva sucursal en 90 días')).toBeInTheDocument();
    });

    it('shows description for active use case', () => {
      render(<UseCaseSection />);

      expect(
        screen.getByText(/ESVA Dental usó Catalyst para abrir su tercera sucursal/i)
      ).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('changes active use case when clicking different card', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      // Click on Restaurantes
      const restaurantButton = screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i });
      await user.click(restaurantButton);

      // Check that restaurant is now active
      expect(restaurantButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('updates detail panel when changing selection', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      // Click on Restaurantes
      const restaurantButton = screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i });
      await user.click(restaurantButton);

      // Check that restaurant details are shown
      expect(screen.getByText('Expansión de franquicia')).toBeInTheDocument();
    });

    it('shows restaurant description after selection', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      const restaurantButton = screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i });
      await user.click(restaurantButton);

      expect(
        screen.getByText(/Una cadena de taquerías fondeó 2 nuevas ubicaciones/i)
      ).toBeInTheDocument();
    });

    it('can navigate to gym use case', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      const gymButton = screen.getByRole('button', { name: /Ver caso de uso: Gimnasios/i });
      await user.click(gymButton);

      expect(screen.getByText('Equipamiento premium')).toBeInTheDocument();
    });

    it('can navigate to beauty salon use case', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      const beautyButton = screen.getByRole('button', { name: /Ver caso de uso: Salones de Belleza/i });
      await user.click(beautyButton);

      expect(screen.getByText('Segunda ubicación')).toBeInTheDocument();
    });

    it('can navigate to medical clinic use case', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      const medicalButton = screen.getByRole('button', { name: /Ver caso de uso: Consultorios Médicos/i });
      await user.click(medicalButton);

      expect(screen.getByText('Actualización tecnológica')).toBeInTheDocument();
    });
  });

  describe('Detail Panel Content', () => {
    it('shows "Capital fondeado" label', () => {
      render(<UseCaseSection />);

      expect(screen.getByText('Capital fondeado')).toBeInTheDocument();
    });

    it('shows tags for use case', () => {
      render(<UseCaseSection />);

      // Default is dental, which has these tags
      expect(screen.getByText('Expansión')).toBeInTheDocument();
      expect(screen.getByText('Equipamiento')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('updates tags when changing use case', async () => {
      const user = userEvent.setup();
      render(<UseCaseSection />);

      // Switch to restaurant
      const restaurantButton = screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i });
      await user.click(restaurantButton);

      // Restaurant has different tags
      expect(screen.getByText('Franquicia')).toBeInTheDocument();
      expect(screen.getByText('Inventario')).toBeInTheDocument();
      expect(screen.getByText('Remodelación')).toBeInTheDocument();
    });

    it('shows quote icon in detail panel', () => {
      render(<UseCaseSection />);

      expect(screen.getByTestId('icon-quote')).toBeInTheDocument();
    });
  });

  describe('Bottom Note', () => {
    it('renders disclaimer note', () => {
      render(<UseCaseSection />);

      expect(
        screen.getByText(/Casos basados en proyecciones de uso de la plataforma/i)
      ).toBeInTheDocument();
    });

    it('note mentions results may vary', () => {
      render(<UseCaseSection />);

      expect(
        screen.getByText(/Resultados pueden variar según el negocio/i)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('section has aria-labelledby', () => {
      render(<UseCaseSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'use-cases-heading');
    });

    it('selector buttons have aria-pressed attribute', () => {
      render(<UseCaseSection />);

      const buttons = screen.getAllByRole('button', { name: /Ver caso de uso:/i });
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('selector buttons have aria-label', () => {
      render(<UseCaseSection />);

      const buttons = screen.getAllByRole('button', { name: /Ver caso de uso:/i });
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('icons are decorative', () => {
      render(<UseCaseSection />);

      const icons = screen.getAllByTestId(/icon-/);
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Design', () => {
    it('section has responsive padding', () => {
      render(<UseCaseSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/px-4/);
      expect(section?.className).toMatch(/sm:px-6/);
      expect(section?.className).toMatch(/lg:px-8/);
    });

    it('content grid is responsive', () => {
      render(<UseCaseSection />);

      // Should have lg:grid-cols-5 for desktop layout
      const gridContainer = document.querySelector('[class*="lg:grid-cols-5"]');
      expect(gridContainer).toBeInTheDocument();
    });

    it('selector cards have responsive padding', () => {
      render(<UseCaseSection />);

      const button = screen.getByRole('button', { name: /Ver caso de uso: Clínicas Dentales/i });
      expect(button.className).toMatch(/sm:p-5/);
    });

    it('detail panel has responsive padding', () => {
      render(<UseCaseSection />);

      // Find the detail panel
      const detailPanel = screen.getByText('Nueva sucursal en 90 días').closest('[class*="lg:p-"]');
      expect(detailPanel).toBeInTheDocument();
    });
  });

  describe('Styling Classes', () => {
    it('section has white background', () => {
      render(<UseCaseSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('bg-white');
    });

    it('section has dark mode background', () => {
      render(<UseCaseSection />);

      const section = document.querySelector('section');
      expect(section?.className).toMatch(/dark:bg-slate-900/);
    });

    it('active selector has gradient background', () => {
      render(<UseCaseSection />);

      const activeButton = screen.getByRole('button', { name: /Ver caso de uso: Clínicas Dentales/i });
      expect(activeButton.className).toMatch(/bg-gradient-to-r/);
    });

    it('inactive selectors have light background', () => {
      render(<UseCaseSection />);

      const inactiveButton = screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i });
      expect(inactiveButton.className).toMatch(/bg-white/);
    });

    it('detail panel has rounded corners', () => {
      render(<UseCaseSection />);

      const detailPanel = screen.getByText('Nueva sucursal en 90 días').closest('[class*="rounded"]');
      expect(detailPanel?.className).toMatch(/rounded-2xl|rounded-3xl/);
    });
  });

  describe('Dark Mode', () => {
    it('main heading has dark mode text color', () => {
      render(<UseCaseSection />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading.className).toMatch(/dark:text-white/);
    });

    it('inactive selectors have dark mode background', () => {
      render(<UseCaseSection />);

      const inactiveButton = screen.getByRole('button', { name: /Ver caso de uso: Restaurantes/i });
      expect(inactiveButton.className).toMatch(/dark:bg-slate-800/);
    });

    it('detail panel has dark mode styling', () => {
      render(<UseCaseSection />);

      const detailPanel = screen.getByText('Nueva sucursal en 90 días').closest('[class*="dark:bg-"]');
      expect(detailPanel).toBeInTheDocument();
    });
  });

  describe('Tags Styling', () => {
    it('tags have pill styling', () => {
      render(<UseCaseSection />);

      const tag = screen.getByText('Expansión');
      expect(tag.className).toMatch(/rounded-full/);
    });

    it('tags have TIS TIS coral color', () => {
      render(<UseCaseSection />);

      const tag = screen.getByText('Expansión');
      expect(tag.className).toMatch(/text-tis-coral/);
    });
  });
});
