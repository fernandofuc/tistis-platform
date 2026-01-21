'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Test Modal Component
// Modal premium para probar el asistente de voz
// Combina UI de TalkToAssistant + funcionalidad de CallSimulator
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
} from 'lucide-react';
import type { VoiceAgentConfig } from '../types';

// ======================
// TYPES
// ======================

interface VoiceTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VoiceAgentConfig;
  onSendMessage?: (message: string) => Promise<string>;
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
// QUICK RESPONSES
// ======================

const QUICK_RESPONSES = [
  'Hola',
  'Quiero una cita',
  '¿Cuál es el horario?',
  '¿Cuáles son los precios?',
  'Gracias',
];

// ======================
// DEFAULT SIMULATED RESPONSES
// ======================

const DEFAULT_RESPONSES: Record<string, string> = {
  'hola': '¡Hola! Bienvenido. ¿En qué puedo ayudarte hoy?',
  'cita': 'Con gusto te ayudo a agendar una cita. ¿Qué día te gustaría venir?',
  'precio': 'Los precios varían según el servicio. ¿Qué procedimiento te interesa conocer?',
  'horario': 'Nuestro horario es de lunes a viernes de 9:00 a 18:00 y sábados de 9:00 a 14:00.',
  'gracias': '¡De nada! ¿Hay algo más en lo que pueda ayudarte?',
};

// ======================
// COMPONENT
// ======================

export function VoiceTestModal({
  isOpen,
  onClose,
  config,
  onSendMessage,
}: VoiceTestModalProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Call duration timer
  useEffect(() => {
    if (callState === 'active') {
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
  }, [callState]);

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

  // Start test call
  const startCall = async () => {
    try {
      setCallState('connecting');
      setError(null);
      setCallDuration(0);
      setTranscript([]);

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();

      // Simulate connection delay
      setTimeout(() => {
        setCallState('active');
        setIsListening(true);
        addMessage('system', 'Llamada conectada');

        // Add first message from assistant
        setTimeout(() => {
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

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    addMessage('system', 'Llamada finalizada');
    setCallState('ended');
    setIsListening(false);
  }, [addMessage]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen && callState === 'active') {
      endCall();
    }
  }, [isOpen, callState, endCall]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && callState === 'ended') {
      setCallState('idle');
      setTranscript([]);
      setCallDuration(0);
      setError(null);
    }
  }, [isOpen, callState]);

  // Send message (uses backend if available, otherwise simulates)
  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending || callState !== 'active') return;

    const messageText = text.trim();
    setInputValue('');
    setIsSending(true);
    setIsListening(false);

    // Add user message
    addMessage('user', messageText);

    const startTime = Date.now();

    try {
      let response: string;

      if (onSendMessage) {
        // Use backend
        response = await onSendMessage(messageText);
      } else {
        // Simulate response
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

        const key = Object.keys(DEFAULT_RESPONSES).find((k) =>
          messageText.toLowerCase().includes(k)
        );
        response = key
          ? DEFAULT_RESPONSES[key]
          : 'Entendido. ¿Hay algo más en lo que pueda asistirte?';
      }

      const latencyMs = Date.now() - startTime;
      addMessage('assistant', response, latencyMs);

    } catch (err) {
      console.error('Error sending message:', err);
      addMessage('system', 'Error al procesar mensaje');
    }

    setIsSending(false);
    setIsListening(true);
    inputRef.current?.focus();
  }, [isSending, callState, onSendMessage, addMessage]);

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
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

  // Reset and start new call
  const handleNewCall = () => {
    setCallState('idle');
    setTranscript([]);
    setCallDuration(0);
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
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Probar Asistente de Voz
                </h2>
                <p className="text-xs text-slate-500">
                  {callState === 'active' ? `En llamada • ${formatDuration(callDuration)}` : 'Modo de prueba'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
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
                <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto leading-relaxed">
                  Inicia una llamada de prueba para verificar cómo responde tu asistente antes de activarlo.
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
                  className="w-full py-3.5 px-6 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, rgb(223, 115, 115) 0%, rgb(194, 51, 80) 100%)',
                    boxShadow: '0 4px 14px -2px rgba(223, 115, 115, 0.4)'
                  }}
                >
                  <Play className="w-5 h-5" />
                  <span>Iniciar Llamada de Prueba</span>
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
                  {callState === 'active' && isListening && !isSending && (
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

                {/* Input and Quick responses */}
                {callState === 'active' && (
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

                    {/* Quick responses */}
                    <div className="flex flex-wrap gap-2">
                      {QUICK_RESPONSES.map((text) => (
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

                {/* Call controls */}
                <div className="mt-4 flex items-center justify-center gap-3">
                  {callState === 'active' ? (
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
                        onClick={handleNewCall}
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
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
              <div className="text-center mb-3">
                <p className="text-xs text-slate-500">Resumen de la llamada</p>
              </div>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{formatDuration(metrics.duration)}</p>
                  <p className="text-xs text-slate-500">Duración</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{metrics.messageCount}</p>
                  <p className="text-xs text-slate-500">Mensajes</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{Math.round(metrics.avgLatency)}ms</p>
                  <p className="text-xs text-slate-500">Latencia</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default VoiceTestModal;
