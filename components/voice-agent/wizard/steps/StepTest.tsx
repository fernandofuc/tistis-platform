/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Step 4: Test Assistant
 *
 * Call simulator for testing the configured assistant.
 * Includes test scenarios and validation checklist.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIcon,
  PhoneOffIcon,
  MicrophoneIcon,
  VolumeIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  LoaderIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import { TEST_SCENARIOS, type TestScenario, type TestResult, type StepComponentProps } from '../types';

// =====================================================
// MESSAGE COMPONENT
// =====================================================

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
  latency?: number;
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`
          max-w-[80%] rounded-2xl px-4 py-2.5
          ${isAssistant
            ? 'bg-slate-700 text-white rounded-tl-sm'
            : 'bg-gradient-to-r from-tis-coral to-tis-pink text-white rounded-tr-sm'
          }
        `}
      >
        <p className="text-sm">{message.content}</p>
        {message.latency && (
          <p className="text-xs opacity-60 mt-1">{message.latency}ms</p>
        )}
      </div>
    </motion.div>
  );
}

// =====================================================
// CALL SIMULATOR
// =====================================================

interface CallSimulatorProps {
  onTestComplete: (result: TestResult) => void;
  vertical: 'restaurant' | 'dental';
  assistantName: string;
}

function CallSimulator({ onTestComplete, vertical, assistantName }: CallSimulatorProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
  const [currentScenario, setCurrentScenario] = useState<TestScenario | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scenarios = TEST_SCENARIOS[vertical];

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Start call
  const startCall = useCallback(async () => {
    setStatus('connecting');
    setMessages([]);
    setCallDuration(0);

    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setStatus('active');
    setIsCallActive(true);

    // Start timer
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Simulate first message from assistant
    setTimeout(() => {
      setMessages([
        {
          role: 'assistant',
          content: `Hola, gracias por llamar. Soy ${assistantName || 'tu asistente virtual'}. ¿En qué puedo ayudarte?`,
          timestamp: new Date(),
          latency: 450,
        },
      ]);
    }, 500);
  }, [assistantName]);

  // End call
  const endCall = useCallback(() => {
    setIsCallActive(false);
    setStatus('ended');

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Calculate test result
    const latencies = messages.filter((m) => m.latency).map((m) => m.latency!);
    const avgLatency =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const result: TestResult = {
      success: true,
      durationSeconds: callDuration,
      messageCount: messages.length,
      averageLatencyMs: avgLatency,
      detectedIntents: currentScenario ? [currentScenario.expectedIntent || 'general'] : [],
    };

    onTestComplete(result);
  }, [callDuration, messages, currentScenario, onTestComplete]);

  // Simulate scenario
  const simulateScenario = useCallback(
    async (scenario: TestScenario) => {
      if (!isCallActive) return;

      setCurrentScenario(scenario);

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: scenario.sampleMessage,
          timestamp: new Date(),
        },
      ]);

      // Simulate thinking delay
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

      // Add assistant response
      const responses: Record<string, string> = {
        reservation: `Claro, con gusto te ayudo con la reservación. ¿Para cuántas personas y qué día prefieres?`,
        appointment: `Por supuesto, te puedo agendar una cita. ¿Qué tipo de servicio necesitas y qué día te queda mejor?`,
        hours: `Nuestro horario es de lunes a viernes de 9am a 7pm, y sábados de 10am a 2pm.`,
        menu: `Tenemos una gran variedad de opciones. ¿Buscas algo en particular o te gustaría escuchar nuestras especialidades?`,
        services: `Ofrecemos limpieza dental, blanqueamiento, ortodoncia, y tratamientos de conducto, entre otros. ¿Cuál te interesa?`,
        cancel: `Entiendo, puedo ayudarte con eso. ¿Podrías proporcionarme tu nombre o el número de confirmación?`,
        emergency: `Entiendo que es urgente. Voy a revisar disponibilidad para atenderte lo antes posible. ¿Puedes describirme el problema?`,
      };

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: responses[scenario.id] || 'Déjame ayudarte con eso.',
          timestamp: new Date(),
          latency: Math.round(400 + Math.random() * 300),
        },
      ]);
    },
    [isCallActive]
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Phone UI */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-3xl overflow-hidden">
        {/* Status bar */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700/50">
          <span
            className={`
              px-3 py-1 text-xs font-medium rounded-full
              ${status === 'idle' && 'bg-slate-700 text-slate-300'}
              ${status === 'connecting' && 'bg-amber-500/20 text-amber-400'}
              ${status === 'active' && 'bg-green-500/20 text-green-400'}
              ${status === 'ended' && 'bg-slate-700 text-slate-300'}
            `}
          >
            {status === 'idle' && 'Listo para llamar'}
            {status === 'connecting' && 'Conectando...'}
            {status === 'active' && 'Llamada activa'}
            {status === 'ended' && 'Llamada finalizada'}
          </span>

          {status === 'active' && (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <ClockIcon className="w-4 h-4" />
              {formatDuration(callDuration)}
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="h-64 overflow-y-auto p-4 bg-slate-800/50">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              {status === 'idle' && 'Inicia una llamada de prueba'}
              {status === 'connecting' && (
                <span className="flex items-center gap-2">
                  <LoaderIcon className="w-4 h-4" />
                  Conectando...
                </span>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex justify-center items-center gap-4">
            {!isCallActive ? (
              <motion.button
                type="button"
                onClick={startCall}
                disabled={status === 'connecting'}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PhoneIcon className="w-7 h-7" />
              </motion.button>
            ) : (
              <>
                <motion.button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`
                    w-12 h-12 rounded-full border-2 flex items-center justify-center
                    ${isMuted
                      ? 'border-red-500 bg-red-500/20 text-red-400'
                      : 'border-slate-600 text-slate-300 hover:bg-slate-700'
                    }
                  `}
                  whileTap={{ scale: 0.95 }}
                >
                  <MicrophoneIcon className="w-5 h-5" />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <PhoneOffIcon className="w-7 h-7" />
                </motion.button>

                <motion.button
                  type="button"
                  className="w-12 h-12 rounded-full border-2 border-slate-600 flex items-center justify-center text-slate-300 hover:bg-slate-700"
                  whileTap={{ scale: 0.95 }}
                >
                  <VolumeIcon className="w-5 h-5" />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Test scenarios */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Escenarios de prueba</h3>
        <div className="grid grid-cols-2 gap-2">
          {scenarios.map((scenario) => (
            <motion.button
              key={scenario.id}
              type="button"
              onClick={() => simulateScenario(scenario)}
              disabled={!isCallActive}
              className={`
                flex items-center gap-2 p-3 rounded-xl text-left text-sm
                transition-colors
                ${isCallActive
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }
              `}
              whileTap={isCallActive ? { scale: 0.98 } : undefined}
            >
              <span className="text-lg">{scenario.icon}</span>
              <span className="font-medium truncate">{scenario.name}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// VALIDATION CHECKLIST
// =====================================================

interface ValidationItem {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  message?: string;
}

interface ValidationChecklistProps {
  testResult?: TestResult;
}

function ValidationChecklist({ testResult }: ValidationChecklistProps) {
  const items: ValidationItem[] = [
    {
      id: 'latency',
      name: 'Latencia aceptable',
      status: testResult
        ? testResult.averageLatencyMs < 1000
          ? 'passed'
          : testResult.averageLatencyMs < 1500
            ? 'warning'
            : 'failed'
        : 'pending',
      message: testResult ? `${testResult.averageLatencyMs}ms promedio` : undefined,
    },
    {
      id: 'conversation',
      name: 'Conversación fluida',
      status: testResult
        ? testResult.messageCount >= 2
          ? 'passed'
          : 'warning'
        : 'pending',
      message: testResult ? `${testResult.messageCount} mensajes` : undefined,
    },
    {
      id: 'duration',
      name: 'Duración de prueba',
      status: testResult
        ? testResult.durationSeconds >= 10
          ? 'passed'
          : 'warning'
        : 'pending',
      message: testResult ? `${testResult.durationSeconds}s` : undefined,
    },
  ];

  const getStatusIcon = (status: ValidationItem['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-5 h-5 text-amber-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-slate-200" />;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Validación</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-50"
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(item.status)}
              <span className="text-sm font-medium text-slate-700">{item.name}</span>
            </div>
            {item.message && (
              <span className="text-xs text-slate-500">{item.message}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function StepTest({
  config,
  vertical,
  onUpdateConfig,
}: StepComponentProps) {
  const handleTestComplete = (result: TestResult) => {
    onUpdateConfig({
      hasBeenTested: true,
      testResult: result,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30"
        >
          <PhoneIcon className="w-8 h-8 text-white" />
        </motion.div>

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-2xl font-bold text-slate-900 mb-2"
        >
          Prueba tu asistente
        </motion.h2>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-slate-500"
        >
          Simula una llamada para verificar que todo funcione correctamente
        </motion.p>
      </div>

      {/* Main content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        {/* Call simulator */}
        <CallSimulator
          onTestComplete={handleTestComplete}
          vertical={vertical}
          assistantName={config.assistantName}
        />

        {/* Validation checklist */}
        <ValidationChecklist testResult={config.testResult} />
      </motion.div>

      {/* Test completed message */}
      {config.hasBeenTested && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 border border-green-200 rounded-xl"
        >
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700">
              <strong>Prueba completada.</strong> Tu asistente está listo para activarse.
            </p>
          </div>
        </motion.div>
      )}

      {/* Help text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="p-4 bg-blue-50 border border-blue-100 rounded-xl"
      >
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Este es un simulador. Usa los escenarios de prueba para
          probar diferentes tipos de conversaciones. Puedes continuar sin probar, pero te
          recomendamos hacerlo para verificar el comportamiento.
        </p>
      </motion.div>
    </div>
  );
}

export default StepTest;
