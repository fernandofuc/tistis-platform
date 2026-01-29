/**
 * TIS TIS Catalyst - VideoScrollPlayer Tests
 * FASE 5 - Testing
 *
 * Tests for the Video Scroll Player component with:
 * - Scroll-synced video playback
 * - Text overlays at different scroll positions
 * - Progress indicator
 * - Loading and error states
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReducedMotion: () => false,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Coins: ({ className }: { className?: string }) => (
    <span data-testid="icon-coins" className={className}>Coins</span>
  ),
  TrendingUp: ({ className }: { className?: string }) => (
    <span data-testid="icon-trending-up" className={className}>TrendingUp</span>
  ),
  Shield: ({ className }: { className?: string }) => (
    <span data-testid="icon-shield" className={className}>Shield</span>
  ),
  Sparkles: ({ className }: { className?: string }) => (
    <span data-testid="icon-sparkles" className={className}>Sparkles</span>
  ),
  Building2: ({ className }: { className?: string }) => (
    <span data-testid="icon-building" className={className}>Building2</span>
  ),
  Users: ({ className }: { className?: string }) => (
    <span data-testid="icon-users" className={className}>Users</span>
  ),
  AlertCircle: ({ className }: { className?: string }) => (
    <span data-testid="icon-alert-circle" className={className}>AlertCircle</span>
  ),
}));

// Mock useVideoScrollSync hook
const mockUseVideoScrollSync = vi.fn();
vi.mock('@/src/hooks', () => ({
  useVideoScrollSync: (options: Record<string, unknown>) => mockUseVideoScrollSync(options),
}));

import VideoScrollPlayer from '@/app/(marketing)/catalyst/components/VideoScrollPlayer';

// ==============================================
// TEST SUITES
// ==============================================

describe('VideoScrollPlayer', () => {
  const defaultHookReturn = {
    containerRef: { current: null },
    videoRef: { current: null },
    progress: 0,
    isInView: true,
    isVideoReady: true,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVideoScrollSync.mockReturnValue(defaultHookReturn);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('renders as a section element', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const section = document.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it('renders video element with correct src', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', '/test-video.mp4');
    });

    it('applies poster when provided', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" poster="/poster.jpg" />);

      const video = document.querySelector('video');
      expect(video).toHaveAttribute('poster', '/poster.jpg');
    });

    it('video is muted for autoplay compatibility', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const video = document.querySelector('video') as HTMLVideoElement;
      // muted is a boolean property, check the property itself
      expect(video.muted).toBe(true);
    });

    it('video has playsInline for mobile compatibility', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const video = document.querySelector('video');
      expect(video).toHaveAttribute('playsinline');
    });
  });

  describe('Scroll Height', () => {
    it('uses default scroll height of 400vh', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const section = document.querySelector('section');
      expect(section).toHaveStyle({ height: '400vh' });
    });

    it('applies custom scroll height', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" scrollHeight={300} />);

      const section = document.querySelector('section');
      expect(section).toHaveStyle({ height: '300vh' });
    });
  });

  describe('Loading State', () => {
    it('shows loading placeholder when video is not ready', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        isVideoReady: false,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Cargando experiencia...')).toBeInTheDocument();
    });

    it('loading spinner has animation', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        isVideoReady: false,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when video fails to load', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        error: 'Video failed to load',
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('No se pudo cargar el video')).toBeInTheDocument();
    });

    it('shows AlertCircle icon on error', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        error: 'Video failed to load',
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument();
    });
  });

  describe('Progress Indicator', () => {
    it('renders progress indicator', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
    });

    it('progress indicator shows 0% at start', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('progress indicator shows correct percentage', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.5,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('progress indicator has ARIA attributes', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.75,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '75');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Text Overlays', () => {
    it('shows first overlay at progress 0', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.1,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('Tokeniza tu expansión')).toBeInTheDocument();
    });

    it('shows second overlay at progress 0.3', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.3,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('Crece sin límites')).toBeInTheDocument();
    });

    it('shows trust overlay at progress 0.5', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.5,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('Datos verificados')).toBeInTheDocument();
    });

    it('shows equity overlay at progress 0.7', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.7,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('Sin ceder equity')).toBeInTheDocument();
    });

    it('shows final overlay at progress 0.9', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.9,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('Conecta con inversionistas')).toBeInTheDocument();
    });
  });

  describe('Overlay Subtitles', () => {
    it('shows subtitle for tokenization overlay', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.1,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText(/Convierte tus proyectos en tokens/i)).toBeInTheDocument();
    });
  });

  describe('Sparkles Badge', () => {
    it('renders Sparkles badge', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByTestId('icon-sparkles')).toBeInTheDocument();
    });

    it('shows scroll instruction text', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.getByText('Scroll para explorar')).toBeInTheDocument();
    });
  });

  describe('Debug Mode', () => {
    it('does not show debug overlay by default', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(screen.queryByText(/Progress:/)).not.toBeInTheDocument();
    });

    it('shows debug overlay when debug prop is true', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" debug />);

      expect(screen.getByText(/Progress:/)).toBeInTheDocument();
      expect(screen.getByText(/In View:/)).toBeInTheDocument();
      expect(screen.getByText(/Video Ready:/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('section has aria-label describing the interactive video', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const section = document.querySelector('section');
      expect(section).toHaveAttribute('aria-label');
      expect(section?.getAttribute('aria-label')).toContain('Video interactivo');
    });

    it('video is aria-hidden (decorative)', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const video = document.querySelector('video');
      expect(video).toHaveAttribute('aria-hidden', 'true');
    });

    it('has track element for captions', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const track = document.querySelector('track');
      expect(track).toBeInTheDocument();
      expect(track).toHaveAttribute('kind', 'captions');
      expect(track).toHaveAttribute('srclang', 'es');
    });

    it('decorative elements have aria-hidden', () => {
      const { container } = render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const decorativeBlurs = container.querySelectorAll('.blur-3xl');
      decorativeBlurs.forEach((element) => {
        expect(element).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Responsive Design', () => {
    it('video container has max-width constraint', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const videoContainer = document.querySelector('.max-w-4xl');
      expect(videoContainer).toBeInTheDocument();
    });

    it('video has aspect-video class', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const video = document.querySelector('video');
      expect(video).toHaveClass('aspect-video');
    });

    it('overlay cards have responsive padding', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.1,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const overlayCard = screen.getByText('Tokeniza tu expansión').closest('[class*="p-4"]');
      expect(overlayCard?.className).toMatch(/sm:p-6/);
    });
  });

  describe('Dark Mode', () => {
    it('loading state has dark mode background', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        isVideoReady: false,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const loadingContainer = screen.getByRole('status').closest('[class*="dark:from-slate-800"]');
      expect(loadingContainer).toBeInTheDocument();
    });

    it('overlay cards have dark mode styling', () => {
      mockUseVideoScrollSync.mockReturnValue({
        ...defaultHookReturn,
        progress: 0.1,
      });

      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const overlayCard = screen.getByText('Tokeniza tu expansión').closest('[class*="dark:bg-slate-900"]');
      expect(overlayCard).toBeInTheDocument();
    });
  });

  describe('Styling Classes', () => {
    it('section has sticky container', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const stickyContainer = document.querySelector('.sticky');
      expect(stickyContainer).toBeInTheDocument();
      expect(stickyContainer).toHaveClass('top-0');
    });

    it('video frame has rounded corners', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const videoFrame = document.querySelector('.rounded-2xl');
      expect(videoFrame).toBeInTheDocument();
    });

    it('video frame has shadow', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      const videoFrame = document.querySelector('.shadow-2xl');
      expect(videoFrame).toBeInTheDocument();
    });
  });

  describe('Hook Integration', () => {
    it('passes smoothing option to hook', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(mockUseVideoScrollSync).toHaveBeenCalledWith(
        expect.objectContaining({
          smoothing: expect.any(Number),
        })
      );
    });

    it('passes startOffset and endOffset to hook', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" />);

      expect(mockUseVideoScrollSync).toHaveBeenCalledWith(
        expect.objectContaining({
          startOffset: 0.1,
          endOffset: 0.9,
        })
      );
    });

    it('passes debug option to hook', () => {
      render(<VideoScrollPlayer videoSrc="/test-video.mp4" debug />);

      expect(mockUseVideoScrollSync).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true,
        })
      );
    });
  });
});
