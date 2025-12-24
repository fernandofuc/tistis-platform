'use client';

// =====================================================
// TIS TIS PLATFORM - Talk to Assistant Component
// Modal premium para probar el asistente de voz
// Diseño Apple-inspired con armonía visual TIS TIS
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
  Bot,
  User,
  Loader2,
  AlertCircle,
  Play,
} from 'lucide-react';
import type { VoiceAgentConfig } from '../types';

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
// ANIMATED WAVE COMPONENT
// ======================

function VoiceWave({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-full"
          animate={isActive ? {
            height: [8, 24, 8],
          } : {
            height: 8,
          }}
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
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

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();

      // Simulate connection
      setTimeout(() => {
        setStatus('connected');
        setIsListening(true);
        addMessage('assistant', config.first_message);
      }, 1500);

    } catch (err) {
      console.error('Error starting test call:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada de prueba');
      setStatus('error');
    }
  };

  // End test call
  const endCall = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    setStatus('disconnected');
    setIsListening(false);
  }, []);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen && status === 'connected') {
      endCall();
    }
  }, [isOpen, status, endCall]);

  // Simulate user input
  const simulateUserInput = (text: string) => {
    addMessage('user', text);
    setIsListening(false);

    setTimeout(() => {
      const responses: Record<string, string> = {
        'hola': '¡Hola! Bienvenido. ¿En qué puedo ayudarte hoy?',
        'cita': 'Con gusto te ayudo a agendar una cita. ¿Qué día te gustaría venir?',
        'precio': 'Los precios varían según el tratamiento. ¿Qué procedimiento te interesa conocer?',
        'horario': 'Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sábados de 9:00 a 14:00.',
        'gracias': '¡De nada! ¿Hay algo más en lo que pueda ayudarte?',
      };

      const key = Object.keys(responses).find((k) =>
        text.toLowerCase().includes(k)
      );
      const response = key
        ? responses[key]
        : 'Entendido. ¿Hay algo más en lo que pueda asistirte?';

      addMessage('assistant', response);
      setIsListening(true);
    }, 1200);
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Backdrop with blur */}
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content based on status */}
          {status === 'idle' && (
            <div className="px-8 py-10">
              {/* Header icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                    <Phone className="w-9 h-9 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                  Prueba tu Asistente
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                  Inicia una llamada de prueba para escuchar cómo responde tu asistente antes de activarlo.
                </p>
              </div>

              {/* First message preview */}
              <div className="bg-slate-50 rounded-2xl p-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">Tu asistente dirá</p>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      "{config.first_message}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={startCall}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-2xl transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5" />
                <span>Iniciar Llamada de Prueba</span>
              </button>

              {/* Footer note */}
              <p className="text-center text-xs text-slate-400 mt-4">
                Modo de prueba gratuito • No se realizan cargos
              </p>
            </div>
          )}

          {status === 'connecting' && (
            <div className="px-8 py-16 text-center">
              <div className="relative mx-auto w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-30" />
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              </div>
              <p className="text-slate-600 font-medium">Conectando...</p>
              <p className="text-slate-400 text-sm mt-1">Preparando tu asistente de voz</p>
            </div>
          )}

          {status === 'error' && (
            <div className="px-8 py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No se pudo conectar
              </h3>
              <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                {error || 'Verifica tu conexión a internet y los permisos del micrófono.'}
              </p>
              <button
                onClick={startCall}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium"
              >
                Reintentar
              </button>
            </div>
          )}

          {(status === 'connected' || status === 'disconnected') && (
            <>
              {/* Call header */}
              <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-6 text-center">
                <div className="relative mx-auto w-16 h-16 mb-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  {status === 'connected' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  )}
                </div>
                <h3 className="text-white font-semibold text-lg">
                  {config.assistant_name || 'Asistente'}
                </h3>
                <p className="text-slate-400 text-sm">
                  {status === 'connected' ? formatDuration(callDuration) : 'Llamada finalizada'}
                </p>
                {status === 'connected' && isListening && (
                  <div className="mt-3">
                    <VoiceWave isActive={true} />
                  </div>
                )}
              </div>

              {/* Transcript */}
              <div className="h-56 overflow-y-auto p-4 space-y-3 bg-slate-50">
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
                      {msg.role !== 'system' && (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.role === 'user'
                              ? 'bg-slate-200'
                              : 'bg-emerald-100'
                          }`}
                        >
                          {msg.role === 'user' ? (
                            <User className="w-3.5 h-3.5 text-slate-600" />
                          ) : (
                            <Bot className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 max-w-[75%] ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : msg.role === 'assistant'
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-100'
                            : 'bg-slate-200 text-slate-500 text-xs mx-auto'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Quick responses */}
              {status === 'connected' && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <div className="flex flex-wrap gap-2">
                    {['Hola', 'Quiero una cita', '¿Cuál es el horario?', 'Gracias'].map((text) => (
                      <button
                        key={text}
                        onClick={() => simulateUserInput(text)}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all"
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Call controls */}
              <div className="px-6 py-5 bg-white border-t border-slate-100">
                <div className="flex items-center justify-center gap-4">
                  {status === 'connected' ? (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`p-4 rounded-full transition-all ${
                          isMuted
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>

                      <button
                        onClick={endCall}
                        className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
                      >
                        <PhoneOff className="w-7 h-7" />
                      </button>

                      <button
                        onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                        className={`p-4 rounded-full transition-all ${
                          isSpeakerMuted
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isSpeakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <button
                        onClick={startCall}
                        className="px-8 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium flex items-center gap-2"
                      >
                        <Phone className="w-5 h-5" />
                        Nueva Llamada
                      </button>
                      <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TalkToAssistant;
