'use client';

// =====================================================
// TIS TIS PLATFORM - Talk to Assistant Component
// Modal para probar el asistente de voz antes de activar
// =====================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  VolumeX,
  X,
  MessageCircle,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
  Headphones,
} from 'lucide-react';
import type { VoiceAgentConfig, VoiceCallMessage } from '../types';

// ======================
// TYPES
// ======================

interface TalkToAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  accessToken: string;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isPartial?: boolean;
}

// ======================
// COMPONENT
// ======================

export function TalkToAssistant({
  isOpen,
  onClose,
  config,
  accessToken,
}: TalkToAssistantProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Call duration timer
  useEffect(() => {
    if (status === 'connected') {
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
  }, [status]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add message to transcript
  const addMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string, isPartial = false) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    setTranscript((prev) => {
      // If this is a partial update, update the last message of the same role
      if (isPartial && prev.length > 0) {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.role === role && lastMsg.isPartial) {
          return [
            ...prev.slice(0, -1),
            { ...lastMsg, content, timestamp: new Date() },
          ];
        }
      }
      return [...prev, { id, role, content, timestamp: new Date(), isPartial }];
    });
  }, []);

  // Start test call
  const startCall = async () => {
    try {
      setStatus('connecting');
      setError(null);
      setCallDuration(0);
      setTranscript([]);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create audio context for processing
      audioContextRef.current = new AudioContext();

      // Initialize WebSocket connection to backend
      // Note: This is a placeholder - actual implementation would connect to VAPI or our voice service
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/voice-agent/test-call`;

      // For now, simulate the connection since WebSocket endpoint needs to be implemented
      setStatus('connected');
      addMessage('system', 'Conexión establecida. Prueba en modo simulado.');
      addMessage('assistant', config.first_message);

      // TODO: Implement actual WebSocket connection to voice service
      // wsRef.current = new WebSocket(wsUrl);
      // wsRef.current.onopen = () => { ... };
      // wsRef.current.onmessage = (event) => { ... };
      // wsRef.current.onerror = (error) => { ... };
      // wsRef.current.onclose = () => { ... };

    } catch (err) {
      console.error('Error starting test call:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada de prueba');
      setStatus('error');
    }
  };

  // End test call
  const endCall = useCallback(() => {
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    setStatus('disconnected');
    setIsListening(false);
    addMessage('system', 'Llamada finalizada.');
  }, [addMessage]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen && status === 'connected') {
      endCall();
    }
  }, [isOpen, status, endCall]);

  // Simulate user input (for demo purposes)
  const simulateUserInput = (text: string) => {
    addMessage('user', text);

    // Simulate assistant response
    setTimeout(() => {
      const responses: Record<string, string> = {
        'hola': 'Hola, ¿cómo te puedo ayudar hoy?',
        'cita': 'Claro, con gusto te ayudo a agendar una cita. ¿Para qué servicio sería?',
        'precio': 'Los precios varían según el tratamiento. ¿Qué procedimiento te interesa?',
        'horario': 'Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sábados de 9:00 a 14:00.',
        'ubicación': 'Estamos ubicados en la dirección registrada en el sistema. ¿Necesitas indicaciones?',
      };

      const key = Object.keys(responses).find((k) =>
        text.toLowerCase().includes(k)
      );
      const response = key
        ? responses[key]
        : 'Entendido. ¿Hay algo más en lo que pueda ayudarte?';

      addMessage('assistant', response);
    }, 1500);
  };

  // Toggle microphone
  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Hablar con Asistente</h2>
                  <p className="text-sm text-white/80">
                    {status === 'connected' ? `En llamada • ${formatDuration(callDuration)}` : 'Modo de prueba'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {status === 'idle' && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Bot className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Prueba tu Asistente
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-sm mx-auto">
                  Inicia una llamada de prueba para verificar cómo suena y responde tu asistente antes de activarlo.
                </p>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6 text-left">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tu asistente dirá:
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 italic">
                    &quot;{config.first_message}&quot;
                  </p>
                </div>
                <button
                  onClick={startCall}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
                >
                  <Phone className="w-5 h-5" />
                  Iniciar Llamada de Prueba
                </button>
              </div>
            )}

            {status === 'connecting' && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-300">
                  Conectando con el asistente...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Error de Conexión
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {error || 'No se pudo establecer la conexión'}
                </p>
                <button
                  onClick={startCall}
                  className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            )}

            {(status === 'connected' || status === 'disconnected') && (
              <>
                {/* Transcript */}
                <div className="h-64 overflow-y-auto mb-4 space-y-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  {transcript.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p className="text-sm">La conversación aparecerá aquí...</p>
                    </div>
                  ) : (
                    transcript.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2 ${
                          msg.role === 'user' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'user'
                              ? 'bg-blue-100 text-blue-600'
                              : msg.role === 'assistant'
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <User className="w-4 h-4" />
                          ) : msg.role === 'assistant' ? (
                            <Bot className="w-4 h-4" />
                          ) : (
                            <MessageCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : msg.role === 'assistant'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          {msg.isPartial && (
                            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-50" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {/* Quick input buttons (for demo) */}
                {status === 'connected' && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Hola', 'Quiero una cita', '¿Cuál es el horario?', 'Gracias'].map((text) => (
                      <button
                        key={text}
                        onClick={() => simulateUserInput(text)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                )}

                {/* Call controls */}
                <div className="flex items-center justify-center gap-4">
                  {status === 'connected' ? (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`p-4 rounded-full transition-colors ${
                          isMuted
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                        title={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                      >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>

                      <button
                        onClick={endCall}
                        className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        title="Terminar llamada"
                      >
                        <PhoneOff className="w-6 h-6" />
                      </button>

                      <button
                        onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                        className={`p-4 rounded-full transition-colors ${
                          isSpeakerMuted
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                        title={isSpeakerMuted ? 'Activar altavoz' : 'Silenciar altavoz'}
                      >
                        {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startCall}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                      Nueva Llamada
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Sparkles className="w-4 h-4" />
                <span>Modo de prueba • No se cobra</span>
              </div>
              <button
                onClick={onClose}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TalkToAssistant;
