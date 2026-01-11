'use client';

// =====================================================
// TIS TIS PLATFORM - Talk to Assistant Component
// Modal premium para probar el asistente de voz
// Diseño alineado con TIS TIS Design System
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
    <div className="flex items-center justify-center gap-1 h-6">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: 'rgb(223, 115, 115)' }}
          animate={isActive ? {
            height: [6, 20, 6],
          } : {
            height: 6,
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
        {/* Backdrop - TIS TIS Pattern */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Modal Container - TIS TIS Design System */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header - TIS TIS Style */}
          <div className="relative px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              {/* Icon with TIS Coral gradient */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)' }}
              >
                <Phone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Probar Asistente de Voz
                </h2>
                <p className="text-xs text-slate-500">
                  {status === 'connected' ? `En llamada • ${formatDuration(callDuration)}` : 'Modo de prueba'}
                </p>
              </div>
            </div>
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* IDLE STATE */}
            {status === 'idle' && (
              <div className="text-center">
                {/* Icon */}
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

                {/* Title */}
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
                  Prueba tu Asistente
                </h3>
                <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto leading-relaxed">
                  Inicia una llamada de prueba para escuchar cómo suena y responde tu asistente antes de activarlo.
                </p>

                {/* First message preview - Card style */}
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
                        &ldquo;{config.first_message}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button - TIS TIS Primary Style */}
                <button
                  onClick={startCall}
                  className="w-full py-3.5 px-6 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)',
                    boxShadow: '0 4px 14px -2px rgba(223, 115, 115, 0.4)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px -2px rgba(223, 115, 115, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px -2px rgba(223, 115, 115, 0.4)';
                  }}
                >
                  <Play className="w-5 h-5" />
                  <span>Iniciar Llamada de Prueba</span>
                </button>
              </div>
            )}

            {/* CONNECTING STATE */}
            {status === 'connecting' && (
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
            {status === 'error' && (
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

            {/* CONNECTED / DISCONNECTED STATE */}
            {(status === 'connected' || status === 'disconnected') && (
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
                    {status === 'connected' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-900" />
                    )}
                  </div>
                  <h3 className="text-white font-semibold">
                    {config.assistant_name || 'Asistente'}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {status === 'connected' ? formatDuration(callDuration) : 'Llamada finalizada'}
                  </p>
                  {status === 'connected' && isListening && (
                    <div className="mt-2">
                      <VoiceWave isActive={true} />
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
                        {msg.role !== 'system' && (
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
                        )}
                        <div
                          className={`rounded-xl px-3 py-2 max-w-[75%] ${
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
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {['Hola', 'Quiero una cita', '¿Cuál es el horario?', 'Gracias'].map((text) => (
                        <button
                          key={text}
                          onClick={() => simulateUserInput(text)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Call controls */}
                <div className="mt-4 flex items-center justify-center gap-3">
                  {status === 'connected' ? (
                    <>
                      <button
                        onClick={toggleMute}
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
                        className="p-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-lg"
                        style={{ boxShadow: '0 4px 14px -2px rgba(239, 68, 68, 0.4)' }}
                      >
                        <PhoneOff className="w-6 h-6" />
                      </button>

                      <button
                        onClick={() => setIsSpeakerMuted(!isSpeakerMuted)}
                        className={`p-3.5 rounded-xl transition-all ${
                          isSpeakerMuted
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={startCall}
                        className="px-6 py-2.5 text-white rounded-xl transition-colors font-medium text-sm flex items-center gap-2"
                        style={{ background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)' }}
                      >
                        <Phone className="w-4 h-4" />
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
              </>
            )}
          </div>

          {/* Footer - TIS TIS Style */}
          {status === 'idle' && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-center text-xs text-slate-400">
                Modo de prueba gratuito • No se realizan cargos
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default TalkToAssistant;
