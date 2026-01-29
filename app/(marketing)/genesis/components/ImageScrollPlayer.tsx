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
  const {
    containerRef,
    progress,
    isInView,
    isImageReady,
    error: imageError,
    markImageReady,
    markImageError,
  } = useImageScrollSync({
    startOffset: 0.1,
    endOffset: 0.9,
    smoothing: prefersReducedMotion ? 1 : 0.08,
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

  // Calculate reveal effect based on progress
  // The image reveals from bottom to top as user scrolls
  // Uses will-change for GPU acceleration during animation
  const revealStyle = useMemo(() => {
    // At progress 0: show only bottom 10% of image
    // At progress 1: show 100% of image
    const clipPercentage = 100 - (progress * 90 + 10);

    return {
      clipPath: `inset(${clipPercentage}% 0 0 0)`,
      transition: prefersReducedMotion ? 'none' : 'clip-path 0.1s ease-out',
      // Hint browser for GPU acceleration during scroll
      willChange: isInView ? 'clip-path' : 'auto',
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
      <div className="sticky top-0 h-screen w-screen overflow-hidden bg-slate-900">
        {/* Background gradient base */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        />

        {/* Image Element with reveal effect */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={revealStyle}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-contain object-bottom"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>

        {/* Loading State */}
        {(!isImageReady || imageError) && <LoadingPlaceholder error={imageError} />}

        {/* Top transition gradient - Smooth blend from previous section */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-32 sm:h-48 lg:h-64 bg-gradient-to-b from-slate-50 via-slate-50/60 to-transparent dark:from-slate-900 dark:via-slate-900/60 dark:to-transparent pointer-events-none z-10"
        />

        {/* Warm tint layer to match TIS TIS brand */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 sm:h-32 lg:h-40 bg-gradient-to-b from-tis-coral/5 via-tis-pink/3 to-transparent dark:from-tis-coral/10 dark:via-tis-pink/5 dark:to-transparent pointer-events-none z-10"
        />

        {/* Gradient overlays for text contrast - Apple style */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20 pointer-events-none"
        />

        {/* Bottom transition gradient - Smooth blend to next section */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 sm:h-48 lg:h-64 bg-gradient-to-t from-slate-50 via-slate-50/60 to-transparent dark:from-slate-900 dark:via-slate-900/60 dark:to-transparent pointer-events-none z-10"
        />

        {/* Scroll Badge */}
        <ScrollBadge isVisible={isInView && progress < 0.1} />

        {/* Screen Reader Announcements */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {visibleOverlays.find((o) => o.isVisible)?.title || ''}
        </div>

        {/* Text Overlays */}
        {visibleOverlays.map((overlay) => (
          <TextOverlayCard
            key={overlay.id}
            overlay={overlay}
            isVisible={overlay.isVisible}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}

        {/* Progress Indicator */}
        {showProgress && (
          <ProgressIndicator
            progress={progress}
            currentPhase={currentPhase}
            totalPhases={enrichedOverlays.length}
          />
        )}

        {/* Debug Overlay */}
        {debug && (
          <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-4 rounded-lg font-mono text-xs">
            <div>Progress: {(progress * 100).toFixed(1)}%</div>
            <div>In View: {isInView ? 'Yes' : 'No'}</div>
            <div>Image Ready: {isImageReady ? 'Yes' : 'No'}</div>
            <div>Phase: {currentPhase + 1}/{enrichedOverlays.length}</div>
            <div>Clip: {(100 - (progress * 90 + 10)).toFixed(1)}%</div>
          </div>
        )}
      </div>
    </section>
  );
}
