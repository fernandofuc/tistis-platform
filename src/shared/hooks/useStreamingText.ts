// =====================================================
// TIS TIS PLATFORM - useStreamingText Hook
// =====================================================
// Hook para manejar texto que llega por streaming con
// efecto de typing progresivo suavizado.
//
// El texto se muestra caracter por caracter para crear
// un efecto visual de escritura natural.
// =====================================================

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseStreamingTextOptions {
  /** Velocidad base en ms entre caracteres (default: 20) */
  baseSpeed?: number;
  /** Variación aleatoria en ms para efecto más natural (default: 10) */
  speedVariation?: number;
  /** Pausa extra después de puntuación (default: 100) */
  punctuationPause?: number;
  /** Si está habilitado el efecto de typing (default: true) */
  enabled?: boolean;
}

export interface UseStreamingTextReturn {
  /** Texto visible actualmente (puede ser parcial) */
  displayedText: string;
  /** Si está actualmente "escribiendo" */
  isTyping: boolean;
  /** Si ha terminado de mostrar todo el texto */
  isComplete: boolean;
  /** Actualizar el texto fuente (desde streaming) */
  setSourceText: (text: string) => void;
  /** Resetear el estado */
  reset: () => void;
  /** Mostrar todo el texto inmediatamente */
  skipToEnd: () => void;
}

const PUNCTUATION_MARKS = ['.', ',', '!', '?', ':', ';', '\n'];

/**
 * Hook para mostrar texto con efecto de typing progresivo
 *
 * @example
 * ```tsx
 * const { displayedText, isTyping, setSourceText } = useStreamingText();
 *
 * // Cuando llega nuevo texto por streaming:
 * setSourceText(accumulatedText);
 *
 * // En el render:
 * <p>{displayedText}{isTyping && <span className="cursor" />}</p>
 * ```
 */
export function useStreamingText(
  options: UseStreamingTextOptions = {}
): UseStreamingTextReturn {
  const {
    baseSpeed = 20,
    speedVariation = 10,
    punctuationPause = 100,
    enabled = true,
  } = options;

  const [sourceText, setSourceText] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Función para calcular delay entre caracteres
  const getDelay = useCallback((char: string): number => {
    if (!enabled) return 0;

    let delay = baseSpeed + Math.random() * speedVariation;

    // Pausa extra después de puntuación
    if (PUNCTUATION_MARKS.includes(char)) {
      delay += punctuationPause;
    }

    return delay;
  }, [baseSpeed, speedVariation, punctuationPause, enabled]);

  // Efecto principal de typing
  useEffect(() => {
    if (!enabled) {
      // Si está deshabilitado, mostrar todo inmediatamente
      setDisplayedText(sourceText);
      currentIndexRef.current = sourceText.length;
      setIsTyping(false);
      return;
    }

    // Si el source text cambió y hay más caracteres por mostrar
    if (currentIndexRef.current < sourceText.length) {
      setIsTyping(true);

      const typeNextChar = () => {
        if (currentIndexRef.current < sourceText.length) {
          const nextChar = sourceText[currentIndexRef.current];
          currentIndexRef.current += 1;
          setDisplayedText(sourceText.slice(0, currentIndexRef.current));

          const delay = getDelay(nextChar);
          timeoutRef.current = setTimeout(typeNextChar, delay);
        } else {
          setIsTyping(false);
        }
      };

      // Iniciar typing si no hay timeout activo
      if (!timeoutRef.current) {
        typeNextChar();
      }
    } else if (currentIndexRef.current === sourceText.length && sourceText.length > 0) {
      // Terminó de mostrar todo
      setIsTyping(false);
    }

    return () => {
      // No limpiar el timeout aquí para permitir que continúe el typing
    };
  }, [sourceText, enabled, getDelay]);

  // Reset
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setSourceText('');
    setDisplayedText('');
    currentIndexRef.current = 0;
    setIsTyping(false);
  }, []);

  // Skip to end
  const skipToEnd = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setDisplayedText(sourceText);
    currentIndexRef.current = sourceText.length;
    setIsTyping(false);
  }, [sourceText]);

  // Setter para el source text
  const updateSourceText = useCallback((text: string) => {
    setSourceText(text);
  }, []);

  return {
    displayedText,
    isTyping,
    isComplete: !isTyping && displayedText.length > 0 && displayedText === sourceText,
    setSourceText: updateSourceText,
    reset,
    skipToEnd,
  };
}

/**
 * Hook simplificado para streaming directo sin efecto de typing
 * Útil cuando el streaming ya viene suficientemente lento
 */
export function useDirectStreaming() {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const start = useCallback(() => {
    setText('');
    setIsStreaming(true);
  }, []);

  const append = useCallback((chunk: string) => {
    setText(prev => prev + chunk);
  }, []);

  const complete = useCallback(() => {
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setText('');
    setIsStreaming(false);
  }, []);

  return {
    text,
    isStreaming,
    start,
    append,
    complete,
    reset,
  };
}
