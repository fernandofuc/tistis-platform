// =====================================================
// TIS TIS Genesis - Image Scroll Sync Hook
// Sincroniza el reveal de una imagen con la posición del scroll
// Inspirado en efectos de Apple.com con smooth 60fps
// =====================================================

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// =====================================================
// Types
// =====================================================

export interface ImageScrollSyncConfig {
  /**
   * Offset from top of container where sync begins (0-1)
   * Default: 0.1 (starts when 10% of container is visible)
   */
  startOffset?: number;

  /**
   * Offset from bottom of container where sync ends (0-1)
   * Default: 0.9 (ends when 90% scrolled through)
   */
  endOffset?: number;

  /**
   * Smoothing factor for progress transitions (0-1)
   * Higher = smoother but more lag. Default: 0.08
   * Use 1 for instant updates (no smoothing)
   */
  smoothing?: number;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;

  /**
   * Threshold for IntersectionObserver (0-1)
   * Default: 0 (trigger as soon as any part is visible)
   */
  intersectionThreshold?: number;

  /**
   * Root margin for IntersectionObserver
   * Default: "0px"
   */
  rootMargin?: string;

  /**
   * Whether the image should start fully hidden (progress 0)
   * or partially visible. Default: true
   */
  startHidden?: boolean;
}

export interface ImageScrollSyncReturn {
  /**
   * Ref to attach to the scrollable container element
   * Compatible with div, section, and other HTML elements
   */
  containerRef: React.MutableRefObject<HTMLElement | null>;

  /**
   * Ref to attach to the image container element
   */
  imageContainerRef: React.MutableRefObject<HTMLElement | null>;

  /**
   * Current scroll progress (0-1) within the container
   */
  progress: number;

  /**
   * Whether the container is currently visible in viewport
   */
  isInView: boolean;

  /**
   * Whether the image has fully loaded
   */
  isImageReady: boolean;

  /**
   * Image loading error (if any)
   */
  error: string | null;

  /**
   * Manually set progress (useful for testing or animations)
   */
  setProgress: (progress: number) => void;

  /**
   * Current reveal percentage (0-100) for display
   */
  revealPercent: number;

  /**
   * Mark image as ready (call from onLoad handler)
   */
  markImageReady: () => void;

  /**
   * Mark image as error (call from onError handler)
   */
  markImageError: (message?: string) => void;
}

// =====================================================
// Constants
// =====================================================

const DEFAULT_CONFIG: Required<ImageScrollSyncConfig> = {
  startOffset: 0.1,
  endOffset: 0.9,
  // Smoothing factor optimized for Apple-style buttery animations
  // Lower = smoother but more lag, Higher = more responsive
  smoothing: 0.12,
  debug: false,
  intersectionThreshold: 0,
  rootMargin: '0px',
  startHidden: true,
};

// =====================================================
// Utility Functions
// =====================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

/**
 * Calculate scroll progress within a container
 */
function calculateScrollProgress(
  containerTop: number,
  containerHeight: number,
  windowHeight: number,
  startOffset: number,
  endOffset: number
): number {
  // Calculate the effective scroll range
  const scrollStart = containerTop - windowHeight * (1 - startOffset);
  const scrollEnd = containerTop + containerHeight - windowHeight * endOffset;
  const scrollRange = scrollEnd - scrollStart;

  if (scrollRange <= 0) return 0;

  // Current scroll position relative to container
  const currentScroll = -scrollStart;
  const progress = currentScroll / scrollRange;

  return clamp(progress, 0, 1);
}

// =====================================================
// Hook Implementation
// =====================================================

export function useImageScrollSync(
  config: ImageScrollSyncConfig = {}
): ImageScrollSyncReturn {
  // Merge config with defaults
  const mergedConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
  }), [config]);

  const {
    startOffset,
    endOffset,
    smoothing,
    debug,
    intersectionThreshold,
    rootMargin,
    startHidden,
  } = mergedConfig;

  // Refs - Using HTMLElement for flexibility with section, div, etc.
  const containerRef = useRef<HTMLElement | null>(null);
  const imageContainerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetProgressRef = useRef<number>(startHidden ? 0 : 0.5);
  const currentProgressRef = useRef<number>(startHidden ? 0 : 0.5);

  // State
  const [progress, setProgress] = useState<number>(startHidden ? 0 : 0.5);
  const [isInView, setIsInView] = useState<boolean>(false);
  const [isImageReady, setIsImageReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // Image Ready/Error Handlers
  // =====================================================

  const markImageReady = useCallback(() => {
    setIsImageReady(true);
    setError(null);
    if (debug) {
      console.log('[ImageScrollSync] Image ready');
    }
  }, [debug]);

  const markImageError = useCallback((message?: string) => {
    setError(message || 'Error loading image');
    setIsImageReady(false);
    if (debug) {
      console.error('[ImageScrollSync] Image error:', message);
    }
  }, [debug]);

  // =====================================================
  // Intersection Observer
  // =====================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsInView(entry.isIntersecting);

        if (debug) {
          console.log('[ImageScrollSync] InView:', entry.isIntersecting);
        }
      },
      {
        threshold: intersectionThreshold,
        rootMargin,
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [intersectionThreshold, rootMargin, debug]);

  // =====================================================
  // Animation Frame Loop
  // =====================================================

  const updateProgress = useCallback(() => {
    // Smooth interpolation towards target progress
    const current = currentProgressRef.current;
    const target = targetProgressRef.current;

    // Use smoothing factor (1 = instant, lower = smoother)
    const effectiveSmoothing = smoothing >= 1 ? 1 : smoothing;
    const smoothed = lerp(current, target, effectiveSmoothing);

    // Only update if there's a meaningful difference
    if (Math.abs(smoothed - current) > 0.0001) {
      currentProgressRef.current = smoothed;
      setProgress(smoothed);

      if (debug) {
        console.log('[ImageScrollSync] Progress:', smoothed.toFixed(3));
      }
    }

    // Continue animation loop if in view
    if (isInView) {
      rafRef.current = requestAnimationFrame(updateProgress);
    }
  }, [smoothing, isInView, debug]);

  // =====================================================
  // Scroll Handler
  // =====================================================

  useEffect(() => {
    // SSR guard - only run on client
    if (typeof window === 'undefined') return;

    if (!isInView) {
      // Cancel animation frame when out of view
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const newProgress = calculateScrollProgress(
        rect.top,
        rect.height,
        windowHeight,
        startOffset,
        endOffset
      );

      targetProgressRef.current = newProgress;
    };

    // Initial calculation
    handleScroll();

    // Start animation loop
    rafRef.current = requestAnimationFrame(updateProgress);

    // Add scroll listener (passive for performance)
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isInView, startOffset, endOffset, updateProgress]);

  // =====================================================
  // Manual Progress Setter
  // =====================================================

  const setManualProgress = useCallback((newProgress: number) => {
    const clamped = clamp(newProgress, 0, 1);
    targetProgressRef.current = clamped;
    currentProgressRef.current = clamped;
    setProgress(clamped);
  }, []);

  // =====================================================
  // Computed Values
  // =====================================================

  const revealPercent = useMemo(() => {
    return Math.round(progress * 100);
  }, [progress]);

  // =====================================================
  // Return Value
  // =====================================================

  return {
    containerRef,
    imageContainerRef,
    progress,
    isInView,
    isImageReady,
    error,
    setProgress: setManualProgress,
    revealPercent,
    markImageReady,
    markImageError,
  };
}
