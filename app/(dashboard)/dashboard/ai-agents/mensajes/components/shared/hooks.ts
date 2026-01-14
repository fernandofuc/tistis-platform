// =====================================================
// TIS TIS PLATFORM - Shared Hooks for Agent Messages Module
// Centralized React hooks for all tabs
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

import { useState, useCallback, useRef, useEffect } from 'react';

// ======================
// DEBOUNCE HOOK
// ======================

/**
 * Custom hook for debouncing a value
 * Useful for text inputs to avoid excessive updates
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
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
// DEBOUNCED CALLBACK HOOK
// ======================

/**
 * Custom hook for debouncing a callback function
 *
 * @param callback - The callback to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// ======================
// FORM STATE HOOK
// ======================

interface FormState {
  hasChanges: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
}

interface FormStateActions {
  markChange: () => void;
  startSaving: () => void;
  setSaveSuccess: () => void;
  setSaveError: (error: string) => void;
  reset: () => void;
}

/**
 * Custom hook for managing form state (saving, errors, changes tracking)
 *
 * @returns Form state and actions
 */
export function useFormState(): [FormState, FormStateActions] {
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const markChange = useCallback(() => {
    setHasChanges(true);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const startSaving = useCallback(() => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  const handleSaveSuccess = useCallback(() => {
    setIsSaving(false);
    setSaveSuccess(true);
    setHasChanges(false);
    // Auto-hide success after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);
  }, []);

  const handleSaveError = useCallback((error: string) => {
    setIsSaving(false);
    setSaveError(error);
  }, []);

  const reset = useCallback(() => {
    setHasChanges(false);
    setIsSaving(false);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const state: FormState = {
    hasChanges,
    isSaving,
    saveSuccess,
    saveError,
  };

  const actions: FormStateActions = {
    markChange,
    startSaving,
    setSaveSuccess: handleSaveSuccess,
    setSaveError: handleSaveError,
    reset,
  };

  return [state, actions];
}

// ======================
// PREVIOUS VALUE HOOK
// ======================

/**
 * Custom hook to get the previous value of a variable
 * Useful for comparing current and previous values
 *
 * @param value - The current value
 * @returns The previous value
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

// ======================
// TOGGLE HOOK
// ======================

/**
 * Custom hook for managing boolean toggle state
 *
 * @param initialValue - Initial boolean value (default: false)
 * @returns [value, toggle, setValue]
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((v) => !v);
  }, []);

  return [value, toggle, setValue];
}

// ======================
// LOCAL STORAGE HOOK
// ======================

/**
 * Custom hook for persisting state in localStorage
 * Useful for remembering user preferences
 *
 * @param key - localStorage key
 * @param initialValue - Initial value if not found in storage
 * @returns [storedValue, setValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue];
}

// ======================
// ASYNC STATE HOOK
// ======================

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for managing async operation state
 *
 * @param asyncFunction - The async function to execute
 * @returns [state, execute, reset]
 */
export function useAsync<T, Args extends unknown[]>(
  asyncFunction: (...args: Args) => Promise<T>
): [AsyncState<T>, (...args: Args) => Promise<void>, () => void] {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState({ data: null, isLoading: true, error: null });
      try {
        const result = await asyncFunction(...args);
        setState({ data: result, isLoading: false, error: null });
      } catch (err) {
        setState({
          data: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return [state, execute, reset];
}
