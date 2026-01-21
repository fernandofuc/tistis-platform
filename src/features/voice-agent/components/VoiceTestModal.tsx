'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Test Modal Component
// Modal premium para probar el asistente de voz
// Combina UI de TalkToAssistant + funcionalidad de CallSimulator
// FASE 4: UI Final con componentes mejorados
// =====================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  X,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Play,
  Clock,
  MessageSquare,
  Zap,
  Send,
  PhoneCall,
  MessageCircle,
} from 'lucide-react';
import type { VoiceAgentConfig } from '../types';
import { useVapiWebClient, type VapiCallStatus, type VapiTranscript } from '../hooks/useVapiWebClient';
import { useMicrophonePermission } from '../hooks/useMicrophonePermission';
import { StatusIndicator } from './StatusIndicator';
import { AudioVisualizer } from './AudioVisualizer';
import { MicrophonePermissionBanner } from './MicrophonePermissionBanner';
import { CallSummary } from './CallSummary';

// ======================
// TYPES
// ======================

interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  /** Vertical del tenant para adaptar quick responses y fallbacks */
  vertical: 'restaurant' | 'dental';
  /** Token de acceso para autenticación con el API */
  accessToken: string;
  /** Modo de prueba inicial: 'text' = chat, 'call' = VAPI Web */
  initialMode?: 'text' | 'call';
}

/** Respuesta del API /api/voice-agent/test/assistant */
interface AssistantApiResponse {
  success: boolean;
  assistantId?: string;
  assistantName?: string;
  firstMessage?: string;
  error?: string;
}

/** Respuesta del API /api/voice-agent/test */
interface TestApiResponse {
  success: boolean;
  response?: string;
  latencyMs: number;
  toolsUsed?: string[];
  ragContext?: string;
  error?: string;
}

/** Configuración de Quick Responses */
interface QuickResponseConfig {
  text: string;
  category?: 'greeting' | 'booking' | 'info' | 'farewell';
}

type CallState = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  latencyMs?: number;
  isPartial?: boolean;
}

interface CallMetrics {
  duration: number;
  messageCount: number;
  avgLatency: number;
  maxLatency: number;
}

// Note: VoiceWave has been replaced by AudioVisualizer component

// ======================
// QUICK RESPONSES POR VERTICAL
// ======================

const QUICK_RESPONSES_BY_VERTICAL: Record<'restaurant' | 'dental', QuickResponseConfig[]> = {
  restaurant: [
    { text: 'Hola', category: 'greeting' },
    { text: 'Quiero hacer una reservación', category: 'booking' },
    { text: '¿Tienen mesas disponibles?', category: 'booking' },
    { text: '¿Cuál es el menú?', category: 'info' },
    { text: '¿Cuál es el horario?', category: 'info' },
    { text: '¿Tienen servicio a domicilio?', category: 'info' },
    { text: 'Gracias', category: 'farewell' },
  ],
  dental: [
    { text: 'Hola', category: 'greeting' },
    { text: 'Quiero agendar una cita', category: 'booking' },
    { text: '¿Tienen citas disponibles?', category: 'booking' },
    { text: '¿Qué servicios ofrecen?', category: 'info' },
    { text: '¿Cuál es el horario?', category: 'info' },
    { text: '¿Cuáles son los precios?', category: 'info' },
    { text: 'Gracias', category: 'farewell' },
  ],
};

// ======================
// FALLBACK RESPONSES POR VERTICAL
// (Solo se usan si API falla)
// ======================

const FALLBACK_RESPONSES_BY_VERTICAL: Record<'restaurant' | 'dental', Record<string, string>> = {
  restaurant: {
    hola: '¡Hola! Bienvenido a nuestro restaurante. ¿En qué puedo ayudarte?',
    reserv: 'Con gusto te ayudo con una reservación. ¿Para qué día y cuántas personas?',
    mesa: 'Permíteme verificar disponibilidad. ¿Para qué día y hora te gustaría?',
    menu: 'Tenemos una variedad de platillos. ¿Te gustaría conocer nuestras especialidades?',
    horario: 'Nuestro horario está disponible en nuestra configuración. ¿Hay algo más en que pueda ayudarte?',
    domicilio: 'Sí, contamos con servicio a domicilio. ¿Te gustaría hacer un pedido?',
    gracias: '¡De nada! Fue un placer atenderte. ¡Esperamos verte pronto!',
  },
  dental: {
    hola: '¡Hola! Bienvenido a nuestra clínica dental. ¿En qué puedo ayudarte?',
    cita: 'Con gusto te ayudo a agendar una cita. ¿Qué día te gustaría venir?',
    disponib: 'Permíteme verificar nuestra agenda. ¿Tienes preferencia de horario?',
    servicio: 'Ofrecemos diversos tratamientos dentales. ¿Hay algo específico que necesites?',
    horario: 'Nuestro horario de atención está en nuestra configuración. ¿Puedo ayudarte en algo más?',
    precio: 'Los precios varían según el tratamiento. ¿Qué procedimiento te interesa?',
    gracias: '¡De nada! Gracias por contactarnos. ¡Cuida tu sonrisa!',
  },
};

/**
 * Obtiene respuesta de fallback si API falla
 */
function getFallbackResponse(message: string, vertical: 'restaurant' | 'dental'): string {
  const responses = FALLBACK_RESPONSES_BY_VERTICAL[vertical];
  const lowerMessage = message.toLowerCase();

  const key = Object.keys(responses).find((k) => lowerMessage.includes(k));
  return key ? responses[key] : 'Entendido. ¿Hay algo más en lo que pueda ayudarte?';
}

// ======================
// COMPONENT
// ======================

export function VoiceTestModal({
  isOpen,
  onClose,
  config,
  vertical,
  accessToken,
  initialMode = 'text',
}: VoiceTestModalProps) {
  // ======================
  // STATE - COMMON
  // ======================
  const [mode, setMode] = useState<'text' | 'call'>(initialMode);
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // ======================
  // STATE - VAPI (Call Mode)
  // ======================
  const [testAssistantId, setTestAssistantId] = useState<string | null>(null);
  const [isCreatingAssistant, setIsCreatingAssistant] = useState(false);
  // Ref para evitar race conditions en cleanup
  const isCleaningUpRef = useRef(false);

  // ======================
  // REFS
  // ======================
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Refs para limpiar timeouts de conexión y evitar memory leaks
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firstMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ======================
  // MICROPHONE PERMISSION HOOK
  // ======================
  const {
    permissionState: micPermission,
    isChecking: isMicChecking,
    requestPermission: requestMicPermission,
  } = useMicrophonePermission();

  // ======================
  // VAPI WEB CLIENT HOOK
  // ======================
  const vapiPublicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '';

  const handleVapiTranscript = useCallback((vapiTranscript: VapiTranscript) => {
    if (vapiTranscript.isFinal) {
      const id = `vapi-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      setTranscript((prev) => [
        ...prev,
        {
          id,
          role: vapiTranscript.role,
          content: vapiTranscript.text,
          timestamp: vapiTranscript.timestamp,
        },
      ]);
    }
  }, []);

  const handleVapiStatusChange = useCallback((vapiStatus: VapiCallStatus) => {
    // Mapear status de VAPI a CallState del modal
    switch (vapiStatus) {
      case 'connecting':
        setCallState('connecting');
        break;
      case 'connected':
      case 'listening':
      case 'speaking':
        setCallState('active');
        setIsListening(vapiStatus === 'listening');
        break;
      case 'ended':
        setCallState('ended');
        setIsListening(false);
        break;
      case 'error':
        setCallState('error');
        break;
      default:
        // idle - no change
        break;
    }
  }, []);

  const handleVapiError = useCallback((err: Error) => {
    console.error('[VoiceTestModal] VAPI error:', err);
    setError(err.message);
  }, []);

  const {
    status: vapiStatus,
    durationSeconds: vapiDuration,
    isMuted: vapiIsMuted,
    error: vapiError,
    startCall: vapiStartCall,
    endCall: vapiEndCall,
    toggleMute: vapiToggleMute,
  } = useVapiWebClient({
    publicKey: vapiPublicKey,
    onTranscript: handleVapiTranscript,
    onStatusChange: handleVapiStatusChange,
    onError: handleVapiError,
  });

  // Quick responses dinámicas según vertical
  const quickResponses = useMemo(
    () => QUICK_RESPONSES_BY_VERTICAL[vertical].map((qr) => qr.text),
    [vertical]
  );

  // Calculate metrics
  const metrics: CallMetrics = useMemo(() => {
    const messagesWithLatency = transcript.filter(m => m.latencyMs !== undefined);
    const totalLatency = messagesWithLatency.reduce((sum, m) => sum + (m.latencyMs || 0), 0);

    return {
      duration: callDuration,
      messageCount: transcript.filter(m => m.role !== 'system').length,
      avgLatency: messagesWithLatency.length > 0 ? totalLatency / messagesWithLatency.length : 0,
      maxLatency: Math.max(...messagesWithLatency.map(m => m.latencyMs || 0), 0),
    };
  }, [callDuration, transcript]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Call duration timer - Solo para modo texto
  // En modo call, usamos vapiDuration del hook
  useEffect(() => {
    // Solo iniciar timer en modo texto
    if (callState === 'active' && mode === 'text') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callState, mode]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add message to transcript
  const addMessage = useCallback((
    role: 'user' | 'assistant' | 'system',
    content: string,
    latencyMs?: number
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setTranscript((prev) => [
      ...prev,
      { id, role, content, timestamp: new Date(), latencyMs }
    ]);
  }, []);

  // ======================
  // VAPI ASSISTANT MANAGEMENT
  // ======================

  /**
   * Crea un assistant temporal en VAPI para la llamada de prueba
   */
  const createTestAssistant = useCallback(async (): Promise<string | null> => {
    // Evitar crear si hay un cleanup en progreso
    if (isCleaningUpRef.current) {
      console.log('[VoiceTestModal] Skipping assistant creation - cleanup in progress');
      return null;
    }

    setIsCreatingAssistant(true);
    try {
      const response = await fetch('/api/voice-agent/test/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Verificar de nuevo después del fetch async
      if (isCleaningUpRef.current) {
        console.log('[VoiceTestModal] Cleanup started during creation - aborting');
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: AssistantApiResponse = await response.json();

      if (!data.success || !data.assistantId) {
        throw new Error(data.error || 'No se pudo crear el assistant');
      }

      console.log('[VoiceTestModal] Test assistant created:', data.assistantId.substring(0, 8) + '...');
      setTestAssistantId(data.assistantId);
      return data.assistantId;

    } catch (err) {
      console.error('[VoiceTestModal] Error creating test assistant:', err);
      setError(err instanceof Error ? err.message : 'Error creando assistant');
      return null;
    } finally {
      setIsCreatingAssistant(false);
    }
  }, [accessToken]);

  /**
   * Elimina el assistant temporal de VAPI
   */
  const deleteTestAssistant = useCallback(async (assistantId: string) => {
    // Marcar que estamos en proceso de limpieza
    isCleaningUpRef.current = true;

    try {
      await fetch(`/api/voice-agent/test/assistant?id=${assistantId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      console.log('[VoiceTestModal] Test assistant deleted');
    } catch (err) {
      // No bloqueante - solo log
      console.warn('[VoiceTestModal] Error deleting test assistant:', err);
    } finally {
      setTestAssistantId(null);
      // Liberar el flag de cleanup
      isCleaningUpRef.current = false;
    }
  }, [accessToken]);

  // ======================
  // VAPI CALL FUNCTIONS
  // ======================

  /**
   * Inicia una llamada con VAPI Web SDK
   */
  const startVapiCall = useCallback(async () => {
    let createdAssistantId: string | null = null;

    try {
      setCallState('connecting');
      setError(null);
      setCallDuration(0);
      setTranscript([]);

      // 1. Verificar que tenemos public key
      if (!vapiPublicKey) {
        throw new Error('VAPI Public Key no configurada');
      }

      // 2. Crear assistant temporal
      createdAssistantId = await createTestAssistant();
      if (!createdAssistantId) {
        throw new Error('No se pudo crear el assistant temporal');
      }

      // 3. Agregar mensaje de sistema
      addMessage('system', 'Conectando llamada de voz...');

      // 4. Iniciar llamada con VAPI
      await vapiStartCall(createdAssistantId);

      // 5. Agregar first message
      addMessage('system', 'Llamada conectada - Habla con tu asistente');

    } catch (err) {
      console.error('[VoiceTestModal] Error starting VAPI call:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar llamada');
      setCallState('error');

      // CRÍTICO: Limpiar assistant huérfano si la llamada falló después de crearlo
      if (createdAssistantId) {
        console.log('[VoiceTestModal] Cleaning up orphaned assistant after call error');
        deleteTestAssistant(createdAssistantId);
      }
    }
  }, [vapiPublicKey, createTestAssistant, addMessage, vapiStartCall, deleteTestAssistant]);

  /**
   * Termina la llamada VAPI y limpia recursos
   */
  const endVapiCall = useCallback(() => {
    // 1. Terminar llamada VAPI
    vapiEndCall();

    // 2. Eliminar assistant temporal
    if (testAssistantId) {
      deleteTestAssistant(testAssistantId);
    }

    // 3. Agregar mensaje de sistema
    addMessage('system', 'Llamada finalizada');

  }, [vapiEndCall, testAssistantId, deleteTestAssistant, addMessage]);

  // Sincronizar duración de VAPI con el state local en modo call
  useEffect(() => {
    if (mode === 'call' && vapiStatus !== 'idle') {
      setCallDuration(vapiDuration);
    }
  }, [mode, vapiStatus, vapiDuration]);

  // Sincronizar mute de VAPI con el state local en modo call
  useEffect(() => {
    if (mode === 'call') {
      setIsMuted(vapiIsMuted);
    }
  }, [mode, vapiIsMuted]);

  // Mostrar error de VAPI
  useEffect(() => {
    if (vapiError) {
      setError(vapiError.message);
    }
  }, [vapiError]);

  // Start test call - Dispatcher según modo
  const startCall = async () => {
    if (mode === 'call') {
      await startVapiCall();
    } else {
      await startTextCall();
    }
  };

  // Start text mode call (simulada)
  const startTextCall = async () => {
    try {
      setCallState('connecting');
      setError(null);
      setCallDuration(0);
      setTranscript([]);

      // Request microphone permission (para UI de mute aunque no se use en texto)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();

      // Simulate connection delay (con cleanup para evitar memory leaks)
      connectTimeoutRef.current = setTimeout(() => {
        setCallState('active');
        setIsListening(true);
        addMessage('system', 'Llamada conectada');

        // Add first message from assistant
        firstMessageTimeoutRef.current = setTimeout(() => {
          addMessage('assistant', config.first_message || 'Hola, ¿en qué puedo ayudarte?', 0);
          inputRef.current?.focus();
        }, 500);
      }, 1500);

    } catch (err) {
      console.error('Error starting test call:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada de prueba');
      setCallState('error');
    }
  };

  // End text mode call
  const endTextCall = useCallback(() => {
    // Limpiar timeouts pendientes para evitar memory leaks
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (firstMessageTimeoutRef.current) {
      clearTimeout(firstMessageTimeoutRef.current);
      firstMessageTimeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    addMessage('system', 'Llamada finalizada');
    setCallState('ended');
    setIsListening(false);
  }, [addMessage]);

  // End test call - Dispatcher según modo
  const endCall = useCallback(() => {
    if (mode === 'call') {
      endVapiCall();
    } else {
      endTextCall();
    }
  }, [mode, endVapiCall, endTextCall]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen && callState === 'active') {
      endCall();
    }
  }, [isOpen, callState, endCall]);

  // Cleanup assistant temporal when modal closes - separate effect to avoid circular deps
  useEffect(() => {
    // Solo limpiar si el modal se cerró Y hay un assistant temporal
    if (!isOpen && testAssistantId) {
      // Usar ref para evitar re-renders
      const assistantToDelete = testAssistantId;
      deleteTestAssistant(assistantToDelete);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Solo depende de isOpen, deleteTestAssistant es estable

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
      }
      if (firstMessageTimeoutRef.current) {
        clearTimeout(firstMessageTimeoutRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && callState === 'ended') {
      setCallState('idle');
      setTranscript([]);
      setCallDuration(0);
      setError(null);
    }
  }, [isOpen, callState]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  /**
   * Envía mensaje al backend API y obtiene respuesta
   * Si el API falla, usa respuesta de fallback según vertical
   */
  const sendMessageToBackend = useCallback(
    async (
      message: string,
      history: TranscriptMessage[]
    ): Promise<{ response: string; latencyMs: number }> => {
      // Construir historial de conversación (excluyendo mensajes del sistema)
      const conversationHistory = history
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await fetch('/api/voice-agent/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message,
            conversation_history: conversationHistory,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: TestApiResponse = await response.json();

        if (!data.success && !data.response) {
          throw new Error(data.error || 'Unknown error');
        }

        return {
          response: data.response || getFallbackResponse(message, vertical),
          latencyMs: data.latencyMs,
        };
      } catch (err) {
        console.error('[VoiceTestModal] API error, using fallback:', err);

        // Usar fallback si API falla
        return {
          response: getFallbackResponse(message, vertical),
          latencyMs: 0,
        };
      }
    },
    [accessToken, vertical]
  );

  // Send message usando el API backend
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isSending || callState !== 'active') return;

      const messageText = text.trim();
      setInputValue('');
      setIsSending(true);
      setIsListening(false);

      // Add user message
      addMessage('user', messageText);

      try {
        // Llamar al backend
        const { response, latencyMs } = await sendMessageToBackend(
          messageText,
          transcript
        );

        // Add assistant response
        addMessage('assistant', response, latencyMs);
      } catch (err) {
        console.error('[VoiceTestModal] Error:', err);
        addMessage('system', 'Error al procesar mensaje');
      }

      setIsSending(false);
      setIsListening(true);
      inputRef.current?.focus();
    },
    [isSending, callState, transcript, sendMessageToBackend, addMessage]
  );

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  // Toggle microphone - Dispatcher según modo
  const toggleMute = () => {
    if (mode === 'call') {
      vapiToggleMute();
    } else {
      // Modo texto - toggle local
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = isMuted;
        });
      }
      setIsMuted(!isMuted);
    }
  };

  // Reset and start new call
  const handleNewCall = () => {
    // Limpiar assistant temporal si existe
    if (testAssistantId) {
      deleteTestAssistant(testAssistantId);
    }
    setCallState('idle');
    setTranscript([]);
    setCallDuration(0);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Modal Container */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-test-modal-title"
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)' }}
              >
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 id="voice-test-modal-title" className="text-base font-bold text-slate-900 tracking-tight">
                  Probar Asistente de Voz
                </h2>
                <p className="text-xs text-slate-500">
                  {callState === 'active'
                    ? `${mode === 'call' ? 'Llamada de voz' : 'Chat de texto'} • ${formatDuration(callDuration)}`
                    : 'Modo de prueba'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar modal"
              className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* IDLE STATE */}
            {callState === 'idle' && (
              <div className="text-center">
                {/* Microphone Permission Banner - Solo mostrar en modo llamada */}
                {mode === 'call' && (
                  <MicrophonePermissionBanner
                    status={micPermission}
                    onRequestPermission={requestMicPermission}
                    isChecking={isMicChecking}
                  />
                )}

                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)',
                        boxShadow: '0 10px 30px -5px rgba(223, 115, 115, 0.4)'
                      }}
                    >
                      <Bot className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
                  Prueba tu Asistente
                </h3>
                <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto leading-relaxed">
                  Verifica cómo responde tu asistente antes de activarlo.
                </p>

                {/* Mode Selector */}
                <div className="flex items-center justify-center gap-2 mb-5">
                  <button
                    onClick={() => setMode('text')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      mode === 'text'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Modo Texto</span>
                  </button>
                  <button
                    onClick={() => setMode('call')}
                    disabled={!vapiPublicKey}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      mode === 'call'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={!vapiPublicKey ? 'VAPI Public Key no configurada' : 'Llamada de voz real'}
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Modo Llamada</span>
                  </button>
                </div>

                {/* Mode description */}
                <p className="text-xs text-slate-400 mb-5">
                  {mode === 'text'
                    ? 'Chat de texto con respuestas del backend'
                    : 'Llamada de voz real con audio bidireccional'}
                </p>

                {/* First message preview */}
                <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left border border-slate-100">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'rgba(223, 115, 115, 0.1)' }}
                    >
                      <Bot className="w-4 h-4" style={{ color: 'rgb(223, 115, 115)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                        Tu asistente dirá
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        &ldquo;{config.first_message || 'Hola, ¿en qué puedo ayudarte?'}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <button
                  onClick={startCall}
                  disabled={isCreatingAssistant}
                  className="w-full py-3.5 px-6 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{
                    background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)',
                    boxShadow: '0 4px 14px -2px rgba(223, 115, 115, 0.4)'
                  }}
                >
                  {isCreatingAssistant ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Preparando...</span>
                    </>
                  ) : (
                    <>
                      {mode === 'call' ? <PhoneCall className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      <span>{mode === 'call' ? 'Iniciar Llamada' : 'Iniciar Chat de Prueba'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CONNECTING STATE */}
            {callState === 'connecting' && (
              <div className="text-center py-8">
                <div className="relative mx-auto w-20 h-20 mb-5">
                  <div
                    className="absolute inset-0 rounded-2xl animate-ping opacity-20"
                    style={{ backgroundColor: 'rgb(223, 115, 115)' }}
                  />
                  <div
                    className="relative w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)' }}
                  >
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                </div>
                <p className="text-slate-900 font-semibold">Conectando...</p>
                <p className="text-slate-500 text-sm mt-1">Preparando tu asistente de voz</p>
              </div>
            )}

            {/* ERROR STATE */}
            {callState === 'error' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  No se pudo conectar
                </h3>
                <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                  {error || 'Verifica tu conexión y los permisos del micrófono.'}
                </p>
                <button
                  onClick={startCall}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* ACTIVE / ENDED STATE */}
            {(callState === 'active' || callState === 'ended') && (
              <>
                {/* Call header */}
                <div
                  className="rounded-xl p-4 mb-4 text-center"
                  style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
                >
                  <div className="relative mx-auto w-14 h-14 mb-2">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)' }}
                    >
                      <Bot className="w-7 h-7 text-white" />
                    </div>
                    {callState === 'active' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-900" />
                    )}
                  </div>
                  <h3 className="text-white font-semibold">
                    {config.assistant_name || 'Asistente'}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {callState === 'active' ? formatDuration(callDuration) : 'Llamada finalizada'}
                  </p>
                  {callState === 'active' && (
                    <div className="mt-2">
                      <AudioVisualizer
                        isActive={isListening || vapiStatus === 'speaking'}
                        isSpeaking={vapiStatus === 'speaking'}
                      />
                    </div>
                  )}
                </div>

                {/* Transcript */}
                <div className="h-48 overflow-y-auto space-y-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  {transcript.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-slate-400">La conversación aparecerá aquí...</p>
                    </div>
                  ) : (
                    transcript.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${
                          msg.role === 'user' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        {msg.role === 'system' ? (
                          <div className="w-full text-center">
                            <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                              {msg.content}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                msg.role === 'user'
                                  ? 'bg-slate-200'
                                  : ''
                              }`}
                              style={msg.role === 'assistant' ? { backgroundColor: 'rgba(223, 115, 115, 0.1)' } : {}}
                            >
                              {msg.role === 'user' ? (
                                <User className="w-3 h-3 text-slate-600" />
                              ) : (
                                <Bot className="w-3 h-3" style={{ color: 'rgb(223, 115, 115)' }} />
                              )}
                            </div>
                            <div
                              className={`rounded-xl px-3 py-2 max-w-[75%] ${
                                msg.role === 'user'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-slate-800 shadow-sm border border-slate-100'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              {msg.latencyMs !== undefined && msg.role === 'assistant' && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                  {msg.latencyMs}ms
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                  {isSending && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(223, 115, 115, 0.1)' }}
                      >
                        <Bot className="w-3 h-3" style={{ color: 'rgb(223, 115, 115)' }} />
                      </div>
                      <div className="bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.2,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {/* Input and Quick responses - Solo en modo texto */}
                {callState === 'active' && mode === 'text' && (
                  <div className="mt-3 space-y-3">
                    {/* Text input */}
                    <div className="flex items-center gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Escribe tu mensaje..."
                        disabled={isSending}
                        className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tis-coral/20 disabled:opacity-50"
                      />
                      <button
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!inputValue.trim() || isSending}
                        aria-label="Enviar mensaje"
                        className="p-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: inputValue.trim() && !isSending
                            ? 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)'
                            : '#e2e8f0',
                        }}
                      >
                        <Send className={`w-4 h-4 ${inputValue.trim() && !isSending ? 'text-white' : 'text-slate-400'}`} />
                      </button>
                    </div>

                    {/* Quick responses dinámicas por vertical */}
                    <div className="flex flex-wrap gap-2">
                      {quickResponses.map((text) => (
                        <button
                          key={text}
                          onClick={() => handleSendMessage(text)}
                          disabled={isSending}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio indicator - Solo en modo llamada */}
                {callState === 'active' && mode === 'call' && (
                  <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-center">
                      <StatusIndicator
                        status={vapiStatus}
                        mode="call"
                        size="md"
                      />
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-2">
                      Habla directamente con tu asistente
                    </p>
                  </div>
                )}

                {/* Call controls - Solo mostrar durante llamada activa */}
                {callState === 'active' && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                      aria-pressed={isMuted}
                      className={`p-3.5 rounded-xl transition-all ${
                        isMuted
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <button
                      onClick={endCall}
                      aria-label="Finalizar llamada"
                      className="p-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-lg"
                      style={{ boxShadow: '0 4px 14px -2px rgba(239, 68, 68, 0.4)' }}
                    >
                      <PhoneOff className="w-6 h-6" />
                    </button>

                    <button
                      onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                      aria-label={isSpeakerMuted ? 'Activar altavoz' : 'Silenciar altavoz'}
                      aria-pressed={isSpeakerMuted}
                      className={`p-3.5 rounded-xl transition-all ${
                        isSpeakerMuted
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer - Metrics during call, info when idle */}
          {callState === 'idle' && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-center text-xs text-slate-400">
                Modo de prueba gratuito • No se realizan cargos
              </p>
            </div>
          )}

          {callState === 'active' && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDuration(metrics.duration)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{metrics.messageCount} mensajes</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{Math.round(metrics.avgLatency)}ms</span>
                </div>
              </div>
            </div>
          )}

          {callState === 'ended' && (
            <CallSummary
              metrics={metrics}
              mode={mode}
              transcript={transcript}
              onNewTest={handleNewCall}
              onClose={onClose}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default VoiceTestModal;
