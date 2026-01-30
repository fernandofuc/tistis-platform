// =====================================================
// TIS TIS Genesis - Image Scroll Player Component
// Imagen con reveal sincronizado al scroll
// Estilo Apple.com con overlays dinamicos
// =====================================================

'use client';

import { useImageScrollSync } from '@/src/hooks';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Database,
  Gauge,
  Search,
  Bot,
  Users,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Import types and constants from FASE 1
import type {
  ImageScrollPlayerProps,
  ImageScrollOverlay,
  ImageScrollOverlayData,
} from './types';
import {
  DEFAULT_SCROLL_OVERLAYS,
  GENESIS_ANIMATION_DURATIONS,
  APPLE_EASE,
} from './types';

// =====================================================
// Icon Mapping
// Maps overlay IDs to their corresponding icons
// =====================================================

const OVERLAY_ICONS: Record<string, LucideIcon> = {
  'data-collection': Database,
  'robot-ready-score': Gauge,
  'task-analysis': Search,
  'robot-training': Bot,
  'gradual-integration': Users,
};

/**
 * Get icon for overlay by ID, with fallback to Database
 */
function getOverlayIcon(id: string): LucideIcon {
  return OVERLAY_ICONS[id] || Database;
}

/**
 * Convert overlay data to full overlay with icon
 */
function enrichOverlayWithIcon(overlay: ImageScrollOverlayData): ImageScrollOverlay {
  return {
    ...overlay,
    icon: getOverlayIcon(overlay.id),
  };
}

// =====================================================
// Animation Variants
// Apple-style smooth animations with APPLE_EASE
// =====================================================

/** Position type for overlay animations - matches ImageScrollOverlay.position */
type OverlayPosition = 'left' | 'right' | 'center';

const overlayVariants = {
  hidden: (position: OverlayPosition) => ({
    opacity: 0,
    x: position === 'left' ? -50 : position === 'right' ? 50 : 0,
    y: position === 'center' ? 30 : 0,
    scale: 0.95,
  }),
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      duration: GENESIS_ANIMATION_DURATIONS.slow,
      ease: APPLE_EASE,
    },
  },
  exit: (position: OverlayPosition) => ({
    opacity: 0,
    x: position === 'left' ? -30 : position === 'right' ? 30 : 0,
    y: position === 'center' ? -20 : 0,
    scale: 0.98,
    transition: {
      duration: GENESIS_ANIMATION_DURATIONS.normal,
      ease: APPLE_EASE,
    },
  }),
};

const reducedMotionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

// =====================================================
// Sub-Component: TextOverlayCard
// Tarjeta de texto que aparece durante el scroll
// =====================================================

interface TextOverlayCardProps {
  overlay: ImageScrollOverlay;
  isVisible: boolean;
  prefersReducedMotion?: boolean | null;
}

function TextOverlayCard({ overlay, isVisible, prefersReducedMotion }: TextOverlayCardProps) {
  const Icon = overlay.icon;
  const activeVariants = prefersReducedMotion ? reducedMotionVariants : overlayVariants;

  const positionClasses = useMemo(() => {
    switch (overlay.position) {
      case 'left':
        return 'left-4 sm:left-8 lg:left-16 xl:left-24 top-1/2 -translate-y-1/2';
      case 'right':
        return 'right-4 sm:right-8 lg:right-16 xl:right-24 top-1/2 -translate-y-1/2';
      case 'center':
        return 'left-1/2 -translate-x-1/2 bottom-24 sm:bottom-32';
      default:
        return '';
    }
  }, [overlay.position]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key={overlay.id}
          custom={overlay.position}
          variants={activeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`absolute ${positionClasses} z-20 max-w-xs sm:max-w-sm lg:max-w-md`}
        >
          {/* Glass morphism card */}
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/20 dark:border-slate-700/30">
            {/* Icon Badge with gradient */}
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br ${overlay.gradient || 'from-tis-coral to-tis-pink'} flex items-center justify-center mb-3 sm:mb-4 shadow-lg`}
            >
              <Icon
                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                aria-hidden="true"
              />
            </div>

            {/* Title with gradient text */}
            <h3
              className={`text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r ${overlay.gradient || 'from-tis-coral to-tis-pink'} bg-clip-text text-transparent mb-1 sm:mb-2 leading-tight`}
            >
              {overlay.title}
            </h3>

            {/* Subtitle */}
            {overlay.subtitle && (
              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                {overlay.subtitle}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =====================================================
// Sub-Component: ProgressIndicator
// Indicador de progreso visual con dots y porcentaje
// =====================================================

interface ProgressIndicatorProps {
  progress: number;
  currentPhase: number;
  totalPhases: number;
}

function ProgressIndicator({ progress, currentPhase, totalPhases }: ProgressIndicatorProps) {
  return (
    <div
      className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso: ${Math.round(progress * 100)}%`}
    >
      {/* Phase dots */}
      {Array.from({ length: totalPhases }).map((_, index) => (
        <div
          key={`phase-dot-${index}`}
          className={`rounded-full transition-all duration-300 ${
            index < currentPhase
              ? 'bg-tis-coral w-2 h-2'
              : index === currentPhase
                ? 'bg-tis-coral w-4 h-2'
                : 'bg-white/40 w-2 h-2'
          }`}
          aria-hidden="true"
        />
      ))}

      {/* Percentage display */}
      <span className="ml-2 text-xs font-semibold text-white/90 tabular-nums">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
}

// =====================================================
// Sub-Component: LoadingPlaceholder
// Estado de carga o error para la imagen
// =====================================================

interface LoadingPlaceholderProps {
  error?: string | null;
}

function LoadingPlaceholder({ error }: LoadingPlaceholderProps) {
  if (error) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900"
        role="alert"
        aria-label="Error cargando imagen"
      >
        <div className="text-center px-4">
          <AlertCircle
            className="w-12 h-12 sm:w-16 sm:h-16 text-tis-coral mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
            No se pudo cargar la imagen
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900"
      role="status"
      aria-label="Cargando imagen"
    >
      <div className="text-center">
        {/* Animated loading spinner */}
        <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-tis-coral/20 border-t-tis-coral rounded-full animate-spin motion-reduce:animate-none mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Cargando experiencia...
        </p>
      </div>
    </div>
  );
}

// =====================================================
// Sub-Component: ScrollBadge
// Badge que indica que se puede hacer scroll
// =====================================================

interface ScrollBadgeProps {
  isVisible: boolean;
}

function ScrollBadge({ isVisible }: ScrollBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="absolute top-20 right-4 sm:top-24 sm:right-8 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
    >
      <Sparkles
        className="w-3 h-3 sm:w-4 sm:h-4 text-white"
        aria-hidden="true"
      />
      <span className="text-xs font-semibold text-white/90">
        Scroll para explorar
      </span>
    </motion.div>
  );
}

// =====================================================
// Main Component: ImageScrollPlayer
// =====================================================

export default function ImageScrollPlayer({
  imageSrc,
  imageAlt,
  scrollHeight = 400,
  overlays,
  showProgress = true,
  debug = false,
  className = '',
  id,
}: ImageScrollPlayerProps) {
  // Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Use our custom hook for scroll sync
  // Optimized for Apple-style buttery smooth reveal animation
  const {
    containerRef,
    progress,
    isInView,
    isImageReady,
    error: imageError,
    markImageReady,
    markImageError,
  } = useImageScrollSync({
    startOffset: 0.05,  // Start revealing earlier for smoother feel
    endOffset: 0.85,    // Complete reveal before end
    smoothing: prefersReducedMotion ? 1 : 0.1,  // Balanced smoothing
    debug,
  });

  // Use default overlays if none provided, enriched with icons
  const enrichedOverlays: ImageScrollOverlay[] = useMemo(() => {
    if (overlays) return overlays;
    return DEFAULT_SCROLL_OVERLAYS.map(enrichOverlayWithIcon);
  }, [overlays]);

  // Determine which overlay should be visible
  const visibleOverlays = useMemo(() => {
    return enrichedOverlays.map((overlay) => ({
      ...overlay,
      isVisible:
        progress >= overlay.startProgress && progress < overlay.endProgress,
    }));
  }, [enrichedOverlays, progress]);

  // Current phase for progress indicator
  const currentPhase = useMemo(() => {
    const index = visibleOverlays.findIndex((o) => o.isVisible);
    return index >= 0 ? index : 0;
  }, [visibleOverlays]);

  // Image load handlers
  const handleImageLoad = useCallback(() => {
    markImageReady();
  }, [markImageReady]);

  const handleImageError = useCallback(() => {
    markImageError('Failed to load robot image');
  }, [markImageError]);

  // Validate scrollHeight with sensible bounds (100vh to 800vh)
  const safeScrollHeight = Math.max(100, Math.min(scrollHeight, 800));

  // Calculate scroll effect based on progress
  // The image is taller than viewport, scrolling pans down through the robot body
  // At progress 0: top of robot (head) visible
  // At progress 1: bottom of robot visible
  // Uses transform for GPU-accelerated smooth scrolling
  const scrollStyle = useMemo(() => {
    // Pan down through the image as user scrolls
    // translateY goes from 0% (top) to -50% (showing bottom half of container)
    // Since container is 200% of viewport, -50% translateY = full scroll through image
    const translateY = progress * -50; // Move up to 50% of image container height

    return {
      transform: `translateY(${translateY}%)`,
      transition: prefersReducedMotion ? 'none' : 'transform 0.1s cubic-bezier(0.33, 1, 0.68, 1)',
      willChange: isInView ? 'transform' : 'auto',
    };
  }, [progress, prefersReducedMotion, isInView]);

  return (
    <section
      ref={containerRef}
      id={id}
      className={`relative w-screen -ml-[calc((100vw-100%)/2)] ${className}`}
      style={{ height: `${safeScrollHeight}vh` }}
      aria-label="Imagen interactiva: Desplazate para explorar las fases de Genesis"
    >
      {/* Sticky Image Container - Full Viewport */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        {/* Background - Pure black base */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black z-0"
        />

        {/* Image Element - Full screen, scrolls through robot body */}
        <div
          className="absolute inset-0 w-full z-10"
          style={{
            height: '200%', // Image container much taller than viewport for scroll effect
            ...scrollStyle,
          }}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            priority
            quality={100}
            sizes="100vw"
            className="object-cover object-center"
            style={{
              objectPosition: '50% 20%', // Center horizontally, show more of top
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>

        {/* Loading State */}
        {(!isImageReady || imageError) && <LoadingPlaceholder error={imageError} />}

        {/* Vignette overlay for depth - subtle */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)] pointer-events-none z-20"
        />

        {/* Bottom transition gradient - Blend to next section */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-40 sm:h-56 lg:h-64 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none z-20"
        />

        {/* Scroll Badge */}
        <div className="z-30">
          <ScrollBadge isVisible={isInView && progress < 0.1} />
        </div>

        {/* Screen Reader Announcements */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {visibleOverlays.find((o) => o.isVisible)?.title || ''}
        </div>

        {/* Text Overlays */}
        <div className="z-30">
          {visibleOverlays.map((overlay) => (
            <TextOverlayCard
              key={overlay.id}
              overlay={overlay}
              isVisible={overlay.isVisible}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>

        {/* Progress Indicator */}
        {showProgress && (
          <div className="z-30">
            <ProgressIndicator
              progress={progress}
              currentPhase={currentPhase}
              totalPhases={enrichedOverlays.length}
            />
          </div>
        )}

        {/* Debug Overlay */}
        {debug && (
          <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-4 rounded-lg font-mono text-xs">
            <div>Progress: {(progress * 100).toFixed(1)}%</div>
            <div>In View: {isInView ? 'Yes' : 'No'}</div>
            <div>Image Ready: {isImageReady ? 'Yes' : 'No'}</div>
            <div>Phase: {currentPhase + 1}/{enrichedOverlays.length}</div>
            <div>TranslateY: {(progress * -50).toFixed(1)}%</div>
          </div>
        )}
      </div>
    </section>
  );
}
