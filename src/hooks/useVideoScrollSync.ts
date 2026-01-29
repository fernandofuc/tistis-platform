// =====================================================
// TIS TIS Catalyst - Video Scroll Sync Hook
// Sincroniza el tiempo del video con la posición del scroll
// Inspirado en efectos de Apple.com con smooth 60fps
// =====================================================

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// =====================================================
// Types
// =====================================================

export interface VideoScrollSyncConfig {
  /**
   * Offset from top of container where video sync begins (0-1)
   * Default: 0 (starts at top of container)
   */
  startOffset?: number;

  /**
   * Offset from bottom of container where video sync ends (0-1)
   * Default: 1 (ends at bottom of container)
   */
  endOffset?: number;

  /**
   * Smoothing factor for video time transitions (0-1)
   * Higher = smoother but more lag. Default: 0.1
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
   * Default: "0px" (no margin)
   */
  rootMargin?: string;
}

export interface VideoScrollSyncReturn {
  /**
   * Ref to attach to the scrollable container element
   */
  containerRef: React.RefObject<HTMLDivElement>;

  /**
   * Ref to attach to the video element
   */
  videoRef: React.RefObject<HTMLVideoElement>;

  /**
   * Current scroll progress (0-1) within the container
   */
  progress: number;

  /**
   * Whether the container is currently visible in viewport
   */
  isInView: boolean;

  /**
   * Whether the video is ready to play
   */
  isVideoReady: boolean;

  /**
   * Current video time in seconds
   */
  currentTime: number;

  /**
   * Total video duration in seconds
   */
  duration: number;

  /**
   * Video loading error (if any)
   */
  error: string | null;

  /**
   * Manually set progress (useful for testing or animations)
   */
  setProgress: (progress: number) => void;
}

// =====================================================
// Constants
// =====================================================

const DEFAULT_CONFIG: Required<VideoScrollSyncConfig> = {
  startOffset: 0,
  endOffset: 1,
  smoothing: 0.1,
  debug: false,
  intersectionThreshold: 0,
  rootMargin: '0px',
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

export function useVideoScrollSync(
  config: VideoScrollSyncConfig = {}
): VideoScrollSyncReturn {
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
  } = mergedConfig;

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);

  // State
  const [progress, setProgress] = useState<number>(0);
  const [isInView, setIsInView] = useState<boolean>(false);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // =====================================================
  // Video Ready Handler
  // =====================================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Guard against NaN duration
      const videoDuration = video.duration;
      if (Number.isNaN(videoDuration) || videoDuration <= 0) {
        setError('Video duration is invalid');
        return;
      }

      setDuration(videoDuration);
      setIsVideoReady(true);
      setError(null);

      // Pause video - we control playback via scroll
      video.pause();

      if (debug) {
        console.log('[VideoScrollSync] Video ready, duration:', videoDuration);
      }
    };

    const handleCanPlay = () => {
      setIsVideoReady(true);
    };

    const handleError = () => {
      const errorMessage = video.error?.message || 'Unknown video error';
      setError(errorMessage);
      setIsVideoReady(false);

      if (debug) {
        console.error('[VideoScrollSync] Video error:', errorMessage);
      }
    };

    // Check if already loaded
    if (video.readyState >= 1) {
      const videoDuration = video.duration;
      if (!Number.isNaN(videoDuration) && videoDuration > 0) {
        setDuration(videoDuration);
        setIsVideoReady(true);
        video.pause();
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
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
          console.log('[VideoScrollSync] InView:', entry.isIntersecting);
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

  const updateVideoTime = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVideoReady || video.duration <= 0) return;

    // Smooth interpolation towards target progress
    const current = currentProgressRef.current;
    const target = targetProgressRef.current;
    const smoothed = lerp(current, target, smoothing);

    // Only update if there's a meaningful difference
    if (Math.abs(smoothed - current) > 0.0001) {
      currentProgressRef.current = smoothed;
      setProgress(smoothed);

      // Calculate and set video time
      const newTime = smoothed * video.duration;

      // Avoid unnecessary seeks (can cause jitter)
      if (Math.abs(video.currentTime - newTime) > 0.05) {
        video.currentTime = newTime;
        setCurrentTime(newTime);

        if (debug) {
          console.log('[VideoScrollSync] Time:', newTime.toFixed(2), 'Progress:', smoothed.toFixed(3));
        }
      }
    }

    // Continue animation loop if in view
    if (isInView) {
      rafRef.current = requestAnimationFrame(updateVideoTime);
    }
  }, [smoothing, isVideoReady, isInView, debug]);

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
    rafRef.current = requestAnimationFrame(updateVideoTime);

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
  }, [isInView, startOffset, endOffset, updateVideoTime]);

  // =====================================================
  // Manual Progress Setter
  // =====================================================

  const setManualProgress = useCallback((newProgress: number) => {
    const clamped = clamp(newProgress, 0, 1);
    targetProgressRef.current = clamped;
    currentProgressRef.current = clamped;
    setProgress(clamped);

    const video = videoRef.current;
    if (video && isVideoReady && video.duration > 0) {
      video.currentTime = clamped * video.duration;
      setCurrentTime(clamped * video.duration);
    }
  }, [isVideoReady]);

  // =====================================================
  // Return Value
  // =====================================================

  return {
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    progress,
    isInView,
    isVideoReady,
    currentTime,
    duration,
    error,
    setProgress: setManualProgress,
  };
}

