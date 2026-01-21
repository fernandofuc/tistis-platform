'use client';

// =====================================================
// TIS TIS PLATFORM - VAPI Web Client Hook
// Hook para manejar llamadas WebRTC con VAPI Web SDK
// =====================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import Vapi from '@vapi-ai/web';

// ======================
// TYPES
// ======================

export type VapiCallStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'speaking'
  | 'listening'
  | 'ended'
  | 'error';

export interface VapiTranscript {
  role: 'user' | 'assistant';
  text: string;
  isFinal: boolean;
  timestamp: Date;
}

export interface UseVapiWebClientOptions {
  /** VAPI Public Key (requerido) */
  publicKey: string;
  /** Callback cuando llega una transcripción */
  onTranscript?: (transcript: VapiTranscript) => void;
  /** Callback cuando cambia el status */
  onStatusChange?: (status: VapiCallStatus) => void;
  /** Callback cuando hay un error */
  onError?: (error: Error) => void;
  /** Callback cuando termina la llamada */
  onCallEnd?: (report: CallEndReport) => void;
}

export interface CallEndReport {
  durationSeconds: number;
  messages: VapiTranscript[];
  endReason: string;
}

export interface UseVapiWebClientReturn {
  /** Estado actual de la llamada */
  status: VapiCallStatus;
  /** Lista de transcripciones finales */
  transcripts: VapiTranscript[];
  /** Duración de la llamada en segundos */
  durationSeconds: number;
  /** Si el micrófono está muteado */
  isMuted: boolean;
  /** Error si ocurrió uno */
  error: Error | null;
  /** Inicia una llamada con el assistant ID */
  startCall: (assistantId: string) => Promise<void>;
  /** Termina la llamada actual */
  endCall: () => void;
  /** Alterna mute del micrófono */
  toggleMute: () => void;
}

// ======================
// HOOK
// ======================

export function useVapiWebClient(
  options: UseVapiWebClientOptions
): UseVapiWebClientReturn {
  const { publicKey, onTranscript, onStatusChange, onError, onCallEnd } = options;

  // State
  const [status, setStatus] = useState<VapiCallStatus>('idle');
  const [transcripts, setTranscripts] = useState<VapiTranscript[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptsRef = useRef<VapiTranscript[]>([]);
  const durationRef = useRef<number>(0);

  // Refs para callbacks - evita re-crear el cliente cuando cambian los callbacks
  const onTranscriptRef = useRef(onTranscript);
  const onStatusChangeRef = useRef(onStatusChange);
  const onErrorRef = useRef(onError);
  const onCallEndRef = useRef(onCallEnd);

  // Actualizar refs cuando cambian los callbacks
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onCallEndRef.current = onCallEnd;
  }, [onCallEnd]);

  // Helper functions - usan refs para evitar dependencias cambiantes
  const updateStatus = useCallback((newStatus: VapiCallStatus) => {
    setStatus(newStatus);
    if (onStatusChangeRef.current) {
      onStatusChangeRef.current(newStatus);
    }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDurationSeconds(durationRef.current);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Initialize VAPI client - SOLO depende de publicKey para evitar recreaciones
  useEffect(() => {
    if (!publicKey) {
      console.warn('[useVapiWebClient] Public key is required');
      return;
    }

    // Solo inicializar si no existe
    if (vapiRef.current) {
      return;
    }

    try {
      vapiRef.current = new Vapi(publicKey);
      const vapi = vapiRef.current;

      // Event: Call started
      vapi.on('call-start', () => {
        console.log('[VAPI] Call started');
        updateStatus('connected');
        startTimer();
      });

      // Event: Call ended
      vapi.on('call-end', () => {
        console.log('[VAPI] Call ended');
        updateStatus('ended');
        stopTimer();

        // Usar ref para callback
        if (onCallEndRef.current) {
          onCallEndRef.current({
            durationSeconds: durationRef.current,
            messages: transcriptsRef.current,
            endReason: 'user_hangup',
          });
        }
      });

      // Event: Assistant is speaking
      vapi.on('speech-start', () => {
        updateStatus('speaking');
      });

      // Event: Assistant stopped speaking
      vapi.on('speech-end', () => {
        updateStatus('listening');
      });

      // Event: Message received (transcripts, etc.)
      vapi.on('message', (message: Record<string, unknown>) => {
        if (message.type === 'transcript') {
          // Validar tipos antes de usar
          const role = message.role;
          const transcriptText = message.transcript;
          const transcriptType = message.transcriptType;

          // Validación de tipos
          if (
            (role !== 'user' && role !== 'assistant') ||
            typeof transcriptText !== 'string'
          ) {
            console.warn('[VAPI] Invalid transcript message format:', message);
            return;
          }

          const transcript: VapiTranscript = {
            role,
            text: transcriptText,
            isFinal: transcriptType === 'final',
            timestamp: new Date(),
          };

          if (transcript.isFinal) {
            transcriptsRef.current = [...transcriptsRef.current, transcript];
            setTranscripts(transcriptsRef.current);
          }

          // Usar ref para callback
          if (onTranscriptRef.current) {
            onTranscriptRef.current(transcript);
          }
        }
      });

      // Event: Error
      vapi.on('error', (err: Error) => {
        console.error('[VAPI] Error:', err);
        setError(err);
        updateStatus('error');

        // Usar ref para callback
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
      });

    } catch (initError) {
      console.error('[useVapiWebClient] Failed to initialize:', initError);
      setError(initError instanceof Error ? initError : new Error('Failed to initialize VAPI'));
    }

    // Cleanup
    return () => {
      if (vapiRef.current) {
        try {
          vapiRef.current.stop();
        } catch {
          // Ignore errors during cleanup
        }
        vapiRef.current = null;
      }
      stopTimer();
    };
  }, [publicKey, updateStatus, startTimer, stopTimer]);

  // Public methods
  const startCall = useCallback(async (assistantId: string) => {
    if (!vapiRef.current) {
      throw new Error('VAPI client not initialized');
    }

    if (!assistantId) {
      throw new Error('Assistant ID is required');
    }

    try {
      setError(null);
      setTranscripts([]);
      transcriptsRef.current = [];
      setDurationSeconds(0);
      durationRef.current = 0;
      updateStatus('connecting');

      await vapiRef.current.start(assistantId);

    } catch (err) {
      console.error('[useVapiWebClient] Error starting call:', err);
      const error = err instanceof Error ? err : new Error('Failed to start call');
      setError(error);
      updateStatus('error');
      throw error;
    }
  }, [updateStatus]);

  const endCall = useCallback(() => {
    if (vapiRef.current) {
      try {
        vapiRef.current.stop();
      } catch (err) {
        console.warn('[useVapiWebClient] Error stopping call:', err);
      }
    }
    stopTimer();
    updateStatus('ended');
  }, [stopTimer, updateStatus]);

  const toggleMute = useCallback(() => {
    if (vapiRef.current) {
      const newMuted = !isMuted;
      vapiRef.current.setMuted(newMuted);
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  return {
    status,
    transcripts,
    durationSeconds,
    isMuted,
    error,
    startCall,
    endCall,
    toggleMute,
  };
}

export default useVapiWebClient;
