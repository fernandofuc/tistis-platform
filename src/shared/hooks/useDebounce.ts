// =====================================================
// TIS TIS PLATFORM - useDebounce Hooks
// Debounce for values and callbacks
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';

// ======================
// DEBOUNCE VALUE
// ======================
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ======================
// DEBOUNCED CALLBACK
// ======================
type AnyFunction = (...args: unknown[]) => unknown;

export function useDebouncedCallback<T extends AnyFunction>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef<T>(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Use useMemo to create a stable function reference
  const debouncedFn = useRef<T>();

  if (!debouncedFn.current) {
    debouncedFn.current = ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T;
  }

  return debouncedFn.current;
}
