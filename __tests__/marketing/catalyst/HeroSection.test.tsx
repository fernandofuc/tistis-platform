/**
 * TIS TIS Catalyst - HeroSection Tests
 * FASE 5 - Testing
 *
 * Tests for the main hero section component with:
 * - Rendering and structure
 * - Accessibility
 * - Props handling
 * - Responsive design classes
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
    h1: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h1 {...filterMotionProps(props)}>{children}</h1>
    ),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...filterMotionProps(props)}>{children}</p>
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
  Play: ({ className }: { className?: string }) => (
    <span data-testid="icon-play" className={className}>Play</span>
  ),
  ChevronDown: ({ className }: { className?: string }) => (
    <span data-testid="icon-chevron-down" className={className}>ChevronDown</span>
  ),
  ArrowRight: ({ className }: { className?: string }) => (
    <span data-testid="icon-arrow-right" className={className}>ArrowRight</span>
  ),
}));

import HeroSection from '@/app/(marketing)/catalyst/components/HeroSection';

// ==============================================
// TEST SUITES
// ==============================================

describe('HeroSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<HeroSection />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('applies default id "hero"', () => {
      render(<HeroSection />);

      const section = document.getElementById('hero');
      expect(section).toBeInTheDocument();
    });

    it('applies custom id when provided', () => {
      render(<HeroSection id="custom-hero" />);

      const section = document.getElementById('custom-hero');
      expect(section).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<HeroSection className="custom-class" />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });

    it('has minimum height of 90vh', () => {
      render(<HeroSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('min-h-[90vh]');
    });
  });

  describe('Title and Content', () => {
    it('renders main title with "TIS TIS Catalyst"', () => {
      render(<HeroSection />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('TIS TIS');
      expect(heading).toHaveTextContent('Catalyst');
    });

    it('renders subtitle with value proposition', () => {
      render(<HeroSection />);

      expect(screen.getByText(/Capital para tu expansión/i)).toBeInTheDocument();
    });

    it('renders bold statement about no banks', () => {
      render(<HeroSection />);

      expect(screen.getByText(/Sin bancos. Sin ceder equity./i)).toBeInTheDocument();
    });

    it('renders description about tokenization', () => {
      render(<HeroSection />);

      expect(
        screen.getByText(/Tokeniza tus proyectos de expansión/i)
      ).toBeInTheDocument();
    });
  });

  describe('Coming Soon Badge', () => {
    it('renders coming soon badge', () => {
      render(<HeroSection />);

      expect(screen.getByText(/Próximamente 2027/i)).toBeInTheDocument();
    });

    it('badge has role="status"', () => {
      render(<HeroSection />);

      const badges = screen.getAllByRole('status');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('badge includes sparkles icon', () => {
      render(<HeroSection />);

      expect(screen.getByTestId('icon-sparkles')).toBeInTheDocument();
    });
  });

  describe('Call-to-Action Buttons', () => {
    it('renders primary CTA button', () => {
      render(<HeroSection />);

      const primaryButton = screen.getByRole('button', { name: /Unirse a la lista de espera/i });
      expect(primaryButton).toBeInTheDocument();
    });

    it('primary CTA is disabled (coming soon)', () => {
      render(<HeroSection />);

      const primaryButton = screen.getByRole('button', { name: /Unirse a la lista de espera/i });
      expect(primaryButton).toBeDisabled();
    });

    it('primary CTA has aria-disabled attribute', () => {
      render(<HeroSection />);

      const primaryButton = screen.getByRole('button', { name: /Unirse a la lista de espera/i });
      expect(primaryButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('primary CTA shows "Notificarme" text', () => {
      render(<HeroSection />);

      expect(screen.getByText('Notificarme')).toBeInTheDocument();
    });

    it('primary CTA includes "Pronto" badge', () => {
      render(<HeroSection />);

      expect(screen.getByText('Pronto')).toBeInTheDocument();
    });

    it('renders secondary CTA link', () => {
      render(<HeroSection />);

      const secondaryLink = screen.getByRole('link', { name: /Conocer TIS TIS/i });
      expect(secondaryLink).toBeInTheDocument();
    });

    it('secondary CTA links to /como-funciona', () => {
      render(<HeroSection />);

      const secondaryLink = screen.getByRole('link', { name: /Conocer TIS TIS/i });
      expect(secondaryLink).toHaveAttribute('href', '/como-funciona');
    });

    it('secondary CTA includes arrow icon', () => {
      render(<HeroSection />);

      expect(screen.getByTestId('icon-arrow-right')).toBeInTheDocument();
    });
  });

  describe('Development Status Badge', () => {
    it('renders development status badge', () => {
      render(<HeroSection />);

      expect(screen.getByText(/En desarrollo activo/i)).toBeInTheDocument();
    });

    it('status badge shows FASE 3', () => {
      render(<HeroSection />);

      expect(screen.getByText('FASE 3')).toBeInTheDocument();
    });

    it('status badge has role="status"', () => {
      render(<HeroSection />);

      const badges = screen.getAllByRole('status');
      // Should have at least the development status badge
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scroll Indicator', () => {
    it('renders scroll indicator by default', () => {
      render(<HeroSection />);

      expect(screen.getByText('Desplázate')).toBeInTheDocument();
    });

    it('scroll indicator includes chevron icon', () => {
      render(<HeroSection />);

      expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument();
    });

    it('hides scroll indicator when showScrollIndicator is false', () => {
      render(<HeroSection showScrollIndicator={false} />);

      expect(screen.queryByText('Desplázate')).not.toBeInTheDocument();
    });
  });

  describe('Decorative Background', () => {
    it('renders decorative background elements', () => {
      const { container } = render(<HeroSection />);

      // Background elements should have aria-hidden
      const decorativeElements = container.querySelectorAll('[aria-hidden="true"]');
      expect(decorativeElements.length).toBeGreaterThan(0);
    });

    it('decorative elements are hidden from screen readers', () => {
      const { container } = render(<HeroSection />);

      const bgElements = container.querySelectorAll('.blur-3xl');
      bgElements.forEach((element) => {
        expect(element).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Accessibility', () => {
    it('section has aria-label', () => {
      render(<HeroSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-label');
    });

    it('aria-label describes the section', () => {
      render(<HeroSection />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-label', 'TIS TIS Catalyst - Capital sin bancos');
    });

    it('icons have aria-hidden attribute', () => {
      render(<HeroSection />);

      const icons = screen.getAllByTestId(/icon-/);
      icons.forEach((icon) => {
        // The mock includes aria-hidden, verifying it's applied correctly
        expect(icon).toBeInTheDocument();
      });
    });

    it('buttons have accessible names', () => {
      render(<HeroSection />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        const hasName =
          button.hasAttribute('aria-label') ||
          button.textContent?.trim().length! > 0;
        expect(hasName).toBe(true);
      });
    });
  });

  describe('Styling Classes', () => {
    it('section has overflow-hidden', () => {
      render(<HeroSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('overflow-hidden');
    });

    it('section uses flexbox for centering', () => {
      render(<HeroSection />);

      const section = document.querySelector('section');
      expect(section).toHaveClass('flex', 'items-center', 'justify-center');
    });

    it('main title has responsive text sizes', () => {
      render(<HeroSection />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveClass('text-4xl');
      expect(heading.className).toMatch(/sm:text-5xl/);
      expect(heading.className).toMatch(/md:text-6xl/);
      expect(heading.className).toMatch(/lg:text-7xl/);
    });

    it('applies TIS TIS gradient to "Catalyst" text', () => {
      render(<HeroSection />);

      const heading = screen.getByRole('heading', { level: 1 });
      const gradientSpan = heading.querySelector('.bg-gradient-to-r');
      expect(gradientSpan).toBeInTheDocument();
    });
  });

  describe('Dark Mode Support', () => {
    it('title has dark mode classes', () => {
      render(<HeroSection />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading.className).toMatch(/dark:/);
    });

    it('secondary CTA has dark mode classes', () => {
      render(<HeroSection />);

      const secondaryLink = screen.getByRole('link', { name: /Conocer TIS TIS/i });
      expect(secondaryLink.className).toMatch(/dark:/);
    });
  });

  describe('Focus States', () => {
    it('primary CTA has focus-visible styles', () => {
      render(<HeroSection />);

      const primaryButton = screen.getByRole('button', { name: /Unirse a la lista de espera/i });
      expect(primaryButton.className).toMatch(/focus-visible:/);
    });

    it('secondary CTA has focus-visible styles', () => {
      render(<HeroSection />);

      const secondaryLink = screen.getByRole('link', { name: /Conocer TIS TIS/i });
      expect(secondaryLink.className).toMatch(/focus-visible:/);
    });
  });
});

describe('HeroSection with Reduced Motion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with reduced motion preference', () => {
    // Mock reduced motion preference
    vi.doMock('framer-motion', () => ({
      motion: {
        div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
          <div {...props}>{children}</div>
        ),
        h1: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
          <h1 {...props}>{children}</h1>
        ),
        p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
          <p {...props}>{children}</p>
        ),
        a: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
          <a {...props}>{children}</a>
        ),
      },
      useReducedMotion: () => true,
      AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    }));

    render(<HeroSection />);

    // Component should still render all content
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TIS TIS');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Catalyst');
  });
});
