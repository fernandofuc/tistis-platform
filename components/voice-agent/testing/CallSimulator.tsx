/**
 * TIS TIS Platform - Voice Agent Testing v2.0
 * CallSimulator Component
 *
 * Interactive call simulator with phone-like UI for testing
 * voice agent conversations before deployment.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneCallIcon,
  PhoneOffIcon,
  MicrophoneIcon,
  VolumeIcon,
  MessageSquareIcon,
  ClockIcon,
  ZapIcon,
  UserIcon,
  BotIcon,
  LoaderIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';

// =====================================================
// TYPES
// =====================================================

export interface SimulatorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  latencyMs?: number;
}

export interface SimulatorMetrics {
  duration: number;
  messageCount: number;
  avgLatency: number;
  maxLatency: number;
}

export interface CallSimulatorProps {
  /** Assistant name for display */
  assistantName: string;
  /** First message from assistant */
  firstMessage: string;
  /** Callback to send message and get response */
  onSendMessage: (message: string) => Promise<string>;
  /** Callback when call ends */
  onCallEnd?: (metrics: SimulatorMetrics) => void;
  /** Whether the simulator is connecting */
  isConnecting?: boolean;
  /** Additional className */
  className?: string;
}

type CallState = 'idle' | 'connecting' | 'active' | 'ended';

// =====================================================
// PHONE DIALPAD
// =====================================================

interface DialpadProps {
  onCall: () => void;
  disabled?: boolean;
}

function Dialpad({ onCall, disabled }: DialpadProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-center">
        <p className="text-sm text-slate-500">Simulador de Llamada</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">Prueba tu Asistente</p>
      </div>

      <motion.button
        type="button"
        onClick={onCall}
        disabled={disabled}
        className={`
          w-20 h-20 rounded-full flex items-center justify-center
          bg-gradient-to-br from-green-500 to-green-600
          text-white shadow-lg shadow-green-500/30
          transition-all duration-300
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
        `}
        whileHover={disabled ? undefined : { scale: 1.05 }}
        whileTap={disabled ? undefined : { scale: 0.95 }}
      >
        <PhoneCallIcon className="w-8 h-8" />
      </motion.button>

      <p className="text-xs text-slate-400">
        Presiona para iniciar una llamada de prueba
      </p>
    </div>
  );
}

// =====================================================
// MESSAGE BUBBLE
// =====================================================

interface MessageBubbleProps {
  message: SimulatorMessage;
  showLatency?: boolean;
}

function MessageBubble({ message, showLatency }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
          ${isUser
            ? 'bg-tis-coral text-white'
            : 'bg-gradient-to-br from-tis-purple to-indigo-600 text-white'
          }
        `}
      >
        {isUser ? <UserIcon className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={`
          max-w-[80%] px-4 py-2.5 rounded-2xl
          ${isUser
            ? 'bg-tis-coral text-white rounded-tr-sm'
            : 'bg-slate-100 text-slate-800 rounded-tl-sm'
          }
        `}
      >
        <p className="text-sm">{message.content}</p>
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
          <span className={`text-[10px] ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
            {message.timestamp.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
          {showLatency && message.latencyMs && !isUser && (
            <span className={`text-[10px] ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
              • {message.latencyMs}ms
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// =====================================================
// TYPING INDICATOR
// =====================================================

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-tis-purple to-indigo-600 flex items-center justify-center">
        <BotIcon className="w-4 h-4 text-white" />
      </div>
      <div className="bg-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-slate-400 rounded-full"
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
  );
}

// =====================================================
// CALL CONTROLS
// =====================================================

interface CallControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

function CallControls({ isMuted, onToggleMute, onEndCall }: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {/* Mute */}
      <motion.button
        type="button"
        onClick={onToggleMute}
        className={`
          w-12 h-12 rounded-full flex items-center justify-center
          transition-colors
          ${isMuted
            ? 'bg-red-100 text-red-600'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }
        `}
        whileTap={{ scale: 0.95 }}
      >
        <MicrophoneIcon className="w-5 h-5" />
      </motion.button>

      {/* End call */}
      <motion.button
        type="button"
        onClick={onEndCall}
        className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg shadow-red-500/30"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <PhoneOffIcon className="w-6 h-6" />
      </motion.button>

      {/* Volume */}
      <motion.button
        type="button"
        className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
        whileTap={{ scale: 0.95 }}
      >
        <VolumeIcon className="w-5 h-5" />
      </motion.button>
    </div>
  );
}

// =====================================================
// CALL METRICS
// =====================================================

interface CallMetricsProps {
  duration: number;
  messageCount: number;
  avgLatency: number;
}

function CallMetrics({ duration, messageCount, avgLatency }: CallMetricsProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center gap-6 py-2 bg-slate-50 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <ClockIcon className="w-3.5 h-3.5" />
        <span>{formatTime(duration)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <MessageSquareIcon className="w-3.5 h-3.5" />
        <span>{messageCount} mensajes</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <ZapIcon className="w-3.5 h-3.5" />
        <span>{Math.round(avgLatency)}ms</span>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function CallSimulator({
  assistantName,
  firstMessage,
  onSendMessage,
  onCallEnd,
  isConnecting = false,
  className = '',
}: CallSimulatorProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Duration timer
  useEffect(() => {
    if (callState === 'active') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState]);

  // Calculate metrics
  const metrics: SimulatorMetrics = {
    duration: callDuration,
    messageCount: messages.filter((m) => m.role !== 'system').length,
    avgLatency:
      messages.filter((m) => m.latencyMs).reduce((sum, m) => sum + (m.latencyMs || 0), 0) /
        (messages.filter((m) => m.latencyMs).length || 1),
    maxLatency: Math.max(...messages.map((m) => m.latencyMs || 0), 0),
  };

  // Start call
  const handleStartCall = useCallback(async () => {
    setCallState('connecting');
    setMessages([]);
    setCallDuration(0);

    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setCallState('active');

    // Add system message
    setMessages([
      {
        id: 'system-1',
        role: 'system',
        content: 'Llamada conectada',
        timestamp: new Date(),
      },
    ]);

    // Add first message from assistant
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: 'assistant-first',
          role: 'assistant',
          content: firstMessage,
          timestamp: new Date(),
          latencyMs: 0,
        },
      ]);
    }, 500);

    // Focus input
    setTimeout(() => inputRef.current?.focus(), 600);
  }, [firstMessage]);

  // End call
  const handleEndCall = useCallback(() => {
    setCallState('ended');

    // Add system message
    setMessages((prev) => [
      ...prev,
      {
        id: `system-${Date.now()}`,
        role: 'system',
        content: 'Llamada finalizada',
        timestamp: new Date(),
      },
    ]);

    // Notify parent
    onCallEnd?.(metrics);
  }, [metrics, onCallEnd]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isSending || callState !== 'active') return;

    const userMessage: SimulatorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    const startTime = Date.now();

    try {
      const response = await onSendMessage(userMessage.content);
      const latencyMs = Date.now() - startTime;

      const assistantMessage: SimulatorMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        latencyMs,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      // Handle error silently
      setMessages((prev) => [
        ...prev,
        {
          id: `system-error-${Date.now()}`,
          role: 'system',
          content: 'Error al procesar mensaje',
          timestamp: new Date(),
        },
      ]);
    }

    setIsSending(false);
    inputRef.current?.focus();
  }, [inputValue, isSending, callState, onSendMessage]);

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Reset simulator
  const handleReset = () => {
    setCallState('idle');
    setMessages([]);
    setCallDuration(0);
  };

  return (
    <div
      className={`
        bg-white rounded-2xl border border-slate-200 overflow-hidden
        shadow-lg max-w-md w-full
        ${className}
      `}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
              <BotIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold">{assistantName}</p>
              <p className="text-xs text-slate-400">
                {callState === 'idle' && 'Listo para llamar'}
                {callState === 'connecting' && 'Conectando...'}
                {callState === 'active' && 'En llamada'}
                {callState === 'ended' && 'Llamada finalizada'}
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {callState === 'connecting' && (
              <LoaderIcon className="w-4 h-4 animate-spin text-amber-400" />
            )}
            {callState === 'active' && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400">Activa</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="h-80 overflow-y-auto">
        {callState === 'idle' && (
          <Dialpad onCall={handleStartCall} disabled={isConnecting} />
        )}

        {(callState === 'connecting' || callState === 'active' || callState === 'ended') && (
          <div className="p-4 space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} showLatency />
              ))}
            </AnimatePresence>

            {isSending && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Controls */}
      {callState === 'active' && (
        <>
          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu mensaje..."
                disabled={isSending}
                className="flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tis-coral/20"
              />
              <motion.button
                type="button"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending}
                className={`
                  px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-colors
                  ${inputValue.trim() && !isSending
                    ? 'bg-tis-coral text-white hover:bg-tis-coral-600'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }
                `}
                whileTap={inputValue.trim() && !isSending ? { scale: 0.95 } : undefined}
              >
                Enviar
              </motion.button>
            </div>
          </div>

          {/* Call controls */}
          <CallControls
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onEndCall={handleEndCall}
          />

          {/* Metrics */}
          <CallMetrics
            duration={callDuration}
            messageCount={metrics.messageCount}
            avgLatency={metrics.avgLatency}
          />
        </>
      )}

      {/* Ended state */}
      {callState === 'ended' && (
        <div className="p-4 border-t border-slate-100">
          <div className="text-center mb-4">
            <p className="text-sm text-slate-500">Duración total</p>
            <p className="text-2xl font-bold text-slate-900">
              {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
            </p>
          </div>

          <motion.button
            type="button"
            onClick={handleReset}
            className="w-full px-4 py-3 bg-tis-coral text-white rounded-xl font-medium hover:bg-tis-coral-600 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Nueva Llamada
          </motion.button>
        </div>
      )}
    </div>
  );
}

export default CallSimulator;
