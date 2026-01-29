// =====================================================
// TIS TIS Catalyst - Video Scroll Player Component
// Reproductor de video sincronizado con scroll
// Estilo Apple.com con overlays dinámicos
// =====================================================

'use client';

import { useVideoScrollSync } from '@/src/hooks';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import {
  Coins,
  TrendingUp,
  Shield,
  Sparkles,
  Building2,
  Users,
  AlertCircle,
} from 'lucide-react';

// =====================================================
// Types
// =====================================================

interface TextOverlay {
  id: string;
  startProgress: number;
  endProgress: number;
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  position: 'left' | 'right' | 'center';
  gradient?: string;
}

interface VideoScrollPlayerProps {
  /**
   * Path to the video file
   */
  videoSrc: string;

  /**
   * Poster image while video loads
   */
  poster?: string;

  /**
   * Height of the scrollable container (in vh units)
   * Default: 400 (4x viewport height for long scroll)
   */
  scrollHeight?: number;

  /**
   * Whether to show debug information
   */
  debug?: boolean;
}

// =====================================================
// Text Overlays Configuration
// =====================================================

const TEXT_OVERLAYS: TextOverlay[] = [
  {
    id: 'tokenization',
    startProgress: 0,
    endProgress: 0.2,
    title: 'Tokeniza tu expansión',
    subtitle: 'Convierte tus proyectos en tokens respaldados por datos reales',
    icon: Coins,
    position: 'left',
    gradient: 'from-tis-coral to-tis-pink',
  },
  {
    id: 'growth',
    startProgress: 0.2,
    endProgress: 0.4,
    title: 'Crece sin límites',
    subtitle: 'Accede a capital sin necesidad de bancos tradicionales',
    icon: TrendingUp,
    position: 'right',
    gradient: 'from-tis-pink to-tis-purple',
  },
  {
    id: 'trust',
    startProgress: 0.4,
    endProgress: 0.6,
    title: 'Datos verificados',
    subtitle: 'Inversionistas confían en métricas auditadas por TIS TIS',
    icon: Shield,
    position: 'left',
    gradient: 'from-tis-purple to-blue-500',
  },
  {
    id: 'equity',
    startProgress: 0.6,
    endProgress: 0.8,
    title: 'Sin ceder equity',
    subtitle: 'Mantén el 100% de tu empresa mientras creces',
    icon: Building2,
    position: 'right',
    gradient: 'from-blue-500 to-tis-coral',
  },
  {
    id: 'investors',
    startProgress: 0.8,
    endProgress: 1.0,
    title: 'Conecta con inversionistas',
    subtitle: 'Red de capital inteligente esperando por ti',
    icon: Users,
    position: 'center',
    gradient: 'from-tis-coral to-tis-pink',
  },
];

// =====================================================
// Animation Variants
// =====================================================

const overlayVariants = {
  hidden: (position: string) => ({
    opacity: 0,
    x: position === 'left' ? -50 : position === 'right' ? 50 : 0,
    y: position === 'center' ? 30 : 0,
  }),
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const, // Apple-like smooth easing
    },
  },
  exit: (position: string) => ({
    opacity: 0,
    x: position === 'left' ? -30 : position === 'right' ? 30 : 0,
    y: position === 'center' ? -20 : 0,
    transition: {
      duration: 0.3,
      ease: 'easeIn' as const,
    },
  }),
};

// =====================================================
// Sub-Components
// =====================================================

interface TextOverlayCardProps {
  overlay: TextOverlay;
  isVisible: boolean;
  prefersReducedMotion?: boolean | null;
}

function TextOverlayCard({ overlay, isVisible, prefersReducedMotion }: TextOverlayCardProps) {
  const Icon = overlay.icon;

  // Use simpler animations if reduced motion is preferred
  const reducedVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  const activeVariants = prefersReducedMotion ? reducedVariants : overlayVariants;

  const positionClasses = useMemo(() => {
    switch (overlay.position) {
      case 'left':
        return 'left-4 sm:left-8 lg:left-16 top-1/2 -translate-y-1/2';
      case 'right':
        return 'right-4 sm:right-8 lg:right-16 top-1/2 -translate-y-1/2';
      case 'center':
        return 'left-1/2 -translate-x-1/2 bottom-8 sm:bottom-16';
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
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/20">
            {/* Icon Badge */}
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br ${overlay.gradient} flex items-center justify-center mb-3 sm:mb-4 shadow-lg`}
            >
              <Icon
                className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                aria-hidden="true"
              />
            </div>

            {/* Title */}
            <h3
              className={`text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r ${overlay.gradient} bg-clip-text text-transparent mb-1 sm:mb-2`}
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
// Progress Indicator Component
// =====================================================

interface ProgressIndicatorProps {
  progress: number;
  currentPhase: number;
  totalPhases: number;
}

function ProgressIndicator({ progress, currentPhase, totalPhases }: ProgressIndicatorProps) {
  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full"
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso: ${Math.round(progress * 100)}%`}
    >
      {/* Progress dots */}
      {Array.from({ length: totalPhases }).map((_, index) => (
        <div
          key={`phase-dot-${index}`}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            index < currentPhase
              ? 'bg-tis-coral w-2'
              : index === currentPhase
                ? 'bg-tis-coral w-4'
                : 'bg-white/40'
          }`}
          aria-hidden="true"
        />
      ))}

      {/* Percentage */}
      <span className="ml-2 text-xs font-medium text-white/90 tabular-nums">
        {Math.round(progress * 100)}%
      </span>
    </div>
  );
}

// =====================================================
// Loading Placeholder
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
        aria-label="Error cargando video"
      >
        <div className="text-center px-4">
          <AlertCircle
            className="w-12 h-12 sm:w-16 sm:h-16 text-tis-coral mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
            No se pudo cargar el video
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900"
      role="status"
      aria-label="Cargando video"
    >
      <div className="text-center">
        <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-tis-coral/20 border-t-tis-coral rounded-full animate-spin motion-reduce:animate-none mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          Cargando experiencia...
        </p>
      </div>
    </div>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function VideoScrollPlayer({
  videoSrc,
  poster,
  scrollHeight = 400,
  debug = false,
}: VideoScrollPlayerProps) {
  // Respect user's reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  const {
    containerRef,
    videoRef,
    progress,
    isInView,
    isVideoReady,
    error: videoError,
  } = useVideoScrollSync({
    startOffset: 0.1,
    endOffset: 0.9,
    smoothing: prefersReducedMotion ? 1 : 0.08, // Instant updates if reduced motion
    debug,
  });

  // Determine which overlay should be visible
  const visibleOverlays = useMemo(() => {
    return TEXT_OVERLAYS.map((overlay) => ({
      ...overlay,
      isVisible:
        progress >= overlay.startProgress && progress < overlay.endProgress,
    }));
  }, [progress]);

  // Current phase for progress indicator
  const currentPhase = useMemo(() => {
    return visibleOverlays.findIndex((o) => o.isVisible);
  }, [visibleOverlays]);

  return (
    <section
      ref={containerRef}
      className="relative w-screen -ml-[calc((100vw-100%)/2)]"
      style={{ height: `${scrollHeight}vh` }}
      aria-label="Video interactivo: Desplázate para explorar las características de TIS TIS Catalyst"
    >
      {/* Sticky Video Container - True Fullscreen */}
      <div className="sticky top-0 h-screen w-screen overflow-hidden bg-black">
        {/* Video Element - Edge to Edge */}
        <video
          ref={videoRef}
          src={videoSrc}
          poster={poster}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        >
          <track kind="captions" srcLang="es" label="Español" />
        </video>

        {/* Loading State */}
        {(!isVideoReady || videoError) && <LoadingPlaceholder error={videoError} />}

        {/* Gradient Overlays for text contrast - Apple style */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20 pointer-events-none"
        />

        {/* Sparkles Badge - Positioned below header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="absolute top-20 right-6 sm:top-24 sm:right-8 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10"
        >
          <Sparkles
            className="w-3 h-3 sm:w-4 sm:h-4 text-white"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-white/90">
            Scroll para explorar
          </span>
        </motion.div>

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
        <ProgressIndicator
          progress={progress}
          currentPhase={currentPhase >= 0 ? currentPhase : 0}
          totalPhases={TEXT_OVERLAYS.length}
        />

        {/* Debug Overlay */}
        {debug && (
          <div className="absolute top-4 left-4 z-50 bg-black/80 text-white p-4 rounded-lg font-mono text-xs">
            <div>Progress: {(progress * 100).toFixed(1)}%</div>
            <div>In View: {isInView ? 'Yes' : 'No'}</div>
            <div>Video Ready: {isVideoReady ? 'Yes' : 'No'}</div>
            <div>Phase: {currentPhase + 1}/{TEXT_OVERLAYS.length}</div>
          </div>
        )}
      </div>
    </section>
  );
}
