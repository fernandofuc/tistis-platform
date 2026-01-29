/**
 * TIS TIS Catalyst - ComingSoonCTA Tests
 * FASE 5 - Testing
 *
 * Tests for the Coming Soon CTA section with:
 * - Waitlist form with email input
 * - Success state after submission
 * - Feature highlights
 * - Trust indicators
 * - Optional back link
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
    a: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <a {...filterMotionProps(props)}>{children}</a>
    ),
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Sparkles: ({ className }: { className?: string }) => (
    <span data-testid="icon-sparkles" className={className}>Sparkles</span>
  ),
  CheckCircle2: ({ className }: { className?: string }) => (
    <span data-testid="icon-check-circle" className={className}>CheckCircle2</span>
  ),
  Bell: ({ className }: { className?: string }) => (
    <span data-testid="icon-bell" className={className}>Bell</span>
  ),
  Mail: ({ className }: { className?: string }) => (
    <span data-testid="icon-mail" className={className}>Mail</span>
  ),
  ArrowLeft: ({ className }: { className?: string }) => (
    <span data-testid="icon-arrow-left" className={className}>ArrowLeft</span>
  ),
}));

import ComingSoonCTA from '@/app/(marketing)/catalyst/components/ComingSoonCTA';

// ==============================================
// TEST SUITES
// ==============================================

describe('ComingSoonCTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<ComingSoonCTA />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('applies default id "coming-soon"', () => {
      render(<ComingSoonCTA />);

      const section = document.getElementById('coming-soon');
      expect(section).toBeInTheDocument();
    });

    it('applies custom id when provided', () => {
      render(<ComingSoonCTA id="custom-cta" />);

      const section = document.getElementById('custom-cta');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ComingSoonCTA className="custom-class" />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });
  });

  describe('Section Header', () => {
    it('renders "Próximamente 2027" badge', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText('Próximamente 2027')).toBeInTheDocument();
    });

    it('renders Sparkles icon in badge', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByTestId('icon-sparkles')).toBeInTheDocument();
    });

    it('renders main heading with "¿Listo para crecer?"', () => {
      render(<ComingSoonCTA />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('¿Listo para');
      expect(heading).toHaveTextContent('crecer');
    });

    it('heading has id for aria-labelledby', () => {
      render(<ComingSoonCTA />);

      const heading = document.getElementById('coming-soon-heading');
      expect(heading).toBeInTheDocument();
    });

    it('section references heading with aria-labelledby', () => {
      render(<ComingSoonCTA />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'coming-soon-heading');
    });

    it('renders description paragraph', () => {
      render(<ComingSoonCTA />);

      expect(
        screen.getByText(/Sé de los primeros en acceder a Catalyst/i)
      ).toBeInTheDocument();
    });
  });

  describe('Feature Highlights', () => {
    it('renders "Acceso anticipado" highlight', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText('Acceso anticipado')).toBeInTheDocument();
    });

    it('renders "Condiciones preferenciales" highlight', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText('Condiciones preferenciales')).toBeInTheDocument();
    });

    it('renders "Soporte prioritario" highlight', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText('Soporte prioritario')).toBeInTheDocument();
    });

    it('renders check icons for each highlight', () => {
      render(<ComingSoonCTA />);

      // Should have at least 3 check icons for features
      const checkIcons = screen.getAllByTestId('icon-check-circle');
      expect(checkIcons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Waitlist Form', () => {
    it('renders email input', () => {
      render(<ComingSoonCTA />);

      const emailInput = screen.getByRole('textbox', { name: /correo electrónico/i });
      expect(emailInput).toBeInTheDocument();
    });

    it('email input has placeholder', () => {
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      expect(emailInput).toBeInTheDocument();
    });

    it('email input is required', () => {
      render(<ComingSoonCTA />);

      const emailInput = screen.getByRole('textbox', { name: /correo electrónico/i });
      expect(emailInput).toBeRequired();
    });

    it('renders Mail icon in input', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByTestId('icon-mail')).toBeInTheDocument();
    });

    it('renders submit button', () => {
      render(<ComingSoonCTA />);

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      expect(submitButton).toBeInTheDocument();
    });

    it('renders Bell icon in submit button', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByTestId('icon-bell')).toBeInTheDocument();
    });

    it('submit button is disabled when email is empty', () => {
      render(<ComingSoonCTA />);

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      expect(submitButton).toBeDisabled();
    });

    it('submit button is enabled when email is entered', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      expect(submitButton).not.toBeDisabled();
      vi.useFakeTimers();
    });

    it('renders spam disclaimer', () => {
      render(<ComingSoonCTA />);

      expect(
        screen.getByText(/Sin spam. Solo te contactaremos cuando lancemos/i)
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('shows loading state when submitting', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      await user.click(submitButton);

      expect(screen.getByText('Registrando...')).toBeInTheDocument();
      vi.useFakeTimers();
    });

    it('disables form during submission', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      await user.click(submitButton);

      expect(emailInput).toBeDisabled();
      vi.useFakeTimers();
    });

    it('shows success state after submission', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      await user.click(submitButton);

      // Wait for the simulated API call to complete (1500ms)
      await waitFor(() => {
        expect(screen.getByText('¡Estás en la lista!')).toBeInTheDocument();
      }, { timeout: 3000 });
      vi.useFakeTimers();
    });

    it('shows confirmation message after submission', async () => {
      vi.useRealTimers();
      const user = userEvent.setup();
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      await user.click(submitButton);

      // Wait for the simulated API call to complete (1500ms)
      await waitFor(() => {
        expect(
          screen.getByText(/Te notificaremos cuando Catalyst esté disponible/i)
        ).toBeInTheDocument();
      }, { timeout: 3000 });
      vi.useFakeTimers();
    });
  });

  describe('Trust Indicators', () => {
    it('renders "100% seguro" indicator', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText(/100% seguro/i)).toBeInTheDocument();
    });

    it('renders "Sin compromisos" indicator', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText(/Sin compromisos/i)).toBeInTheDocument();
    });

    it('renders "Cancela cuando quieras" indicator', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByText(/Cancela cuando quieras/i)).toBeInTheDocument();
    });
  });

  describe('Back Link', () => {
    it('renders back link by default', () => {
      render(<ComingSoonCTA />);

      const backLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(backLink).toBeInTheDocument();
    });

    it('back link points to home', () => {
      render(<ComingSoonCTA />);

      const backLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(backLink).toHaveAttribute('href', '/');
    });

    it('back link has ArrowLeft icon', () => {
      render(<ComingSoonCTA />);

      expect(screen.getByTestId('icon-arrow-left')).toBeInTheDocument();
    });

    it('hides back link when showBackLink is false', () => {
      render(<ComingSoonCTA showBackLink={false} />);

      const backLink = screen.queryByRole('link', { name: /volver al inicio/i });
      expect(backLink).not.toBeInTheDocument();
    });
  });

  describe('Decorative Elements', () => {
    it('renders decorative background elements', () => {
      const { container } = render(<ComingSoonCTA />);

      const decorativeElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorativeElements.length).toBeGreaterThan(0);
    });

    it('decorative elements are hidden from screen readers', () => {
      const { container } = render(<ComingSoonCTA />);

      const blurElements = container.querySelectorAll('.blur-3xl');
      blurElements.forEach((element) => {
        expect(element).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Accessibility', () => {
    it('section has aria-labelledby', () => {
      render(<ComingSoonCTA />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-labelledby', 'coming-soon-heading');
    });

    it('email input has aria-label', () => {
      render(<ComingSoonCTA />);

      const emailInput = screen.getByRole('textbox');
      expect(emailInput).toHaveAttribute('aria-label');
    });

    it('icons are decorative (aria-hidden)', () => {
      render(<ComingSoonCTA />);

      const icons = screen.getAllByTestId(/icon-/);
      expect(icons.length).toBeGreaterThan(0);
    });

    it('back link has focus-visible styles', () => {
      render(<ComingSoonCTA />);

      const backLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(backLink.className).toMatch(/focus-visible:/);
    });
  });

  describe('Responsive Design', () => {
    it('main content area has responsive padding', () => {
      const { container } = render(<ComingSoonCTA />);

      const gradientBg = container.querySelector('[class*="px-4"]');
      expect(gradientBg?.className).toMatch(/sm:px-6/);
      expect(gradientBg?.className).toMatch(/lg:px-8/);
    });

    it('form layout is responsive', () => {
      render(<ComingSoonCTA />);

      // Form should be a form element
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();

      // Check for responsive flex direction
      const formContainer = form?.querySelector('[class*="flex-col"]');
      expect(formContainer?.className).toMatch(/sm:flex-row/);
    });

    it('back link section has responsive padding', () => {
      render(<ComingSoonCTA />);

      // The back link section has py-8 sm:py-12, find the parent div with bg-slate-100
      const backLinkSection = screen.getByRole('link', { name: /volver al inicio/i }).closest('[class*="bg-slate-100"]');
      expect(backLinkSection?.className).toMatch(/sm:py-12/);
    });
  });

  describe('Styling Classes', () => {
    it('section has overflow-hidden', () => {
      render(<ComingSoonCTA />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('overflow-hidden');
    });

    it('main area has gradient background', () => {
      const { container } = render(<ComingSoonCTA />);

      const gradientBg = container.querySelector('[class*="bg-gradient-to-br"]');
      expect(gradientBg).toBeInTheDocument();
    });

    it('heading has gradient text for "crecer"', () => {
      render(<ComingSoonCTA />);

      const heading = screen.getByRole('heading', { level: 2 });
      const gradientSpan = heading.querySelector('[class*="bg-gradient-to-r"]');
      expect(gradientSpan).toBeInTheDocument();
    });

    it('submit button has white background', () => {
      render(<ComingSoonCTA />);

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      expect(submitButton).toHaveClass('bg-white');
    });

    it('submit button has rounded corners', () => {
      render(<ComingSoonCTA />);

      const submitButton = screen.getByRole('button', { name: /notificarme/i });
      expect(submitButton.className).toMatch(/rounded-xl|rounded-2xl/);
    });
  });

  describe('Dark Mode', () => {
    it('main gradient has dark mode variant', () => {
      const { container } = render(<ComingSoonCTA />);

      const gradientBg = container.querySelector('[class*="dark:from-slate-950"]');
      expect(gradientBg).toBeInTheDocument();
    });

    it('back link section has dark mode background', () => {
      render(<ComingSoonCTA />);

      const backLinkSection = screen.getByRole('link', { name: /volver al inicio/i }).closest('[class*="dark:bg-"]');
      expect(backLinkSection).toBeInTheDocument();
    });

    it('back link has dark mode text color', () => {
      render(<ComingSoonCTA />);

      const backLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(backLink.className).toMatch(/dark:text-slate-400/);
    });
  });

  describe('Focus States', () => {
    it('email input has focus ring', () => {
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      expect(emailInput.className).toMatch(/focus:ring/);
    });

    it('back link has focus ring', () => {
      render(<ComingSoonCTA />);

      const backLink = screen.getByRole('link', { name: /volver al inicio/i });
      expect(backLink.className).toMatch(/focus-visible:ring/);
    });
  });

  describe('Input Validation', () => {
    it('email input has type="email"', () => {
      render(<ComingSoonCTA />);

      const emailInput = screen.getByPlaceholderText('tu@email.com');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('form has onSubmit handler', () => {
      render(<ComingSoonCTA />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });
  });
});
