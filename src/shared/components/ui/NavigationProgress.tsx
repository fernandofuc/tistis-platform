// =====================================================
// TIS TIS PLATFORM - Navigation Progress Indicator
// Apple-style progress bar for route transitions
// =====================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// ======================
// COMPONENT
// ======================
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Track navigation state
  useEffect(() => {
    // When route changes, animation completes
    setProgress(100);
    const timer = setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
    }, 200);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Listen for click events on links to start progress
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');

      if (link) {
        const href = link.getAttribute('href');
        // Only track internal navigation
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          // Don't trigger for same page or anchor links
          if (href !== pathname && !href.startsWith('#')) {
            setIsNavigating(true);
            setProgress(30);

            // Simulate progress
            const interval = setInterval(() => {
              setProgress((prev) => {
                if (prev >= 90) {
                  clearInterval(interval);
                  return prev;
                }
                return prev + Math.random() * 10;
              });
            }, 100);

            // Cleanup interval on route change
            return () => clearInterval(interval);
          }
        }
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname]);

  return (
    <AnimatePresence>
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-1"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-tis-coral via-tis-coral to-orange-400 shadow-lg shadow-tis-coral/30"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
