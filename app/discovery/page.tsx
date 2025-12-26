'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Message } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Send, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// TIPOS Y CONSTANTES
// ============================================================

interface AIAnalysis {
  business_type: 'dental' | 'restaurant' | 'otro';
  business_subtype?: string;
  primary_pain: string;
  financial_impact: number;
  time_impact: number;
  urgency_score: number;
  recommended_plan: 'starter' | 'essentials' | 'growth' | 'enterprise';
  requires_consultation: boolean;
  reasoning: string;
  contact_info?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
}

// Etapas del análisis para la animación
const ANALYSIS_STAGES = [
  { id: 1, label: 'Identificando tipo de negocio', duration: 2000 },
  { id: 2, label: 'Analizando problemas operativos', duration: 3000 },
  { id: 3, label: 'Calculando impacto financiero', duration: 2500 },
  { id: 4, label: 'Evaluando soluciones', duration: 2000 },
  { id: 5, label: 'Preparando recomendacion', duration: 1500 },
];

// ============================================================
// COMPONENTE: Cerebrito flotante (animación)
// ============================================================

// Posiciones fijas para evitar recálculos en cada render
const BRAIN_POSITIONS = [15, 25, 38, 52, 65, 75, 85, 45];

function FloatingBrain({ delay, size = 24, index = 0 }: { delay: number; size?: number; index?: number }) {
  const leftPosition = BRAIN_POSITIONS[index % BRAIN_POSITIONS.length];

  return (
    <motion.div
      initial={{ y: -50, opacity: 0, rotate: -15 }}
      animate={{
        y: [0, 400, 800],
        opacity: [0, 1, 1, 0],
        rotate: [-15, 15, -15],
        x: [0, 20, -20, 0],
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="absolute"
      style={{
        left: `${leftPosition}%`,
        top: -50,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="text-tis-coral/30"
      >
        <path
          d="M12 2C8.5 2 5.5 4.5 5 8C3.5 8.5 2 10 2 12C2 14.5 4 16.5 6.5 16.5H7C7 19 9 21 12 21C15 21 17 19 17 16.5H17.5C20 16.5 22 14.5 22 12C22 10 20.5 8.5 19 8C18.5 4.5 15.5 2 12 2Z"
          fill="currentColor"
        />
        <path
          d="M9 10C9 10.5523 8.55228 11 8 11C7.44772 11 7 10.5523 7 10C7 9.44772 7.44772 9 8 9C8.55228 9 9 9.44772 9 10Z"
          fill="white"
        />
        <path
          d="M17 10C17 10.5523 16.5523 11 16 11C15.4477 11 15 10.5523 15 10C15 9.44772 15.4477 9 16 9C16.5523 9 17 9.44772 17 10Z"
          fill="white"
        />
      </svg>
    </motion.div>
  );
}

// ============================================================
// COMPONENTE: Panel de Análisis (Derecho)
// ============================================================

function AnalysisPanel({
  messageCount,
  isAnalyzing,
  analysisComplete,
  analysis,
}: {
  messageCount: number;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  analysis: AIAnalysis | null;
}) {
  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);

  // Avanzar por las etapas cuando está analizando
  useEffect(() => {
    if (!isAnalyzing && !analysisComplete) {
      setCurrentStage(0);
      setStageProgress(0);
      return;
    }

    if (analysisComplete) {
      setCurrentStage(ANALYSIS_STAGES.length);
      setStageProgress(100);
      return;
    }

    const interval = setInterval(() => {
      setStageProgress(prev => {
        if (prev >= 100) {
          if (currentStage < ANALYSIS_STAGES.length - 1) {
            setCurrentStage(c => c + 1);
            return 0;
          }
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isAnalyzing, analysisComplete, currentStage]);

  // Calcular progreso general basado en mensajes
  const conversationProgress = Math.min((messageCount / 10) * 100, 100);

  return (
    <div className="relative h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Cerebritos flotantes de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <FloatingBrain key={i} index={i} delay={i * 1.5} size={20 + (i % 4) * 5} />
        ))}
      </div>

      {/* Contenido principal */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8">
        {/* Logo TIS TIS */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Image
            src="/logos/tis-brain-logo.png"
            alt="TIS TIS"
            width={80}
            height={80}
            className="w-20 h-20 object-contain"
          />
        </motion.div>

        {/* Estado del análisis */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">
            {analysisComplete
              ? 'Analisis Completado'
              : isAnalyzing
                ? 'Analizando tu negocio...'
                : 'Conversemos sobre tu negocio'
            }
          </h2>
          <p className="text-slate-500">
            {analysisComplete
              ? 'Hemos identificado la mejor solucion para ti'
              : isAnalyzing
                ? 'Procesando la informacion que nos compartiste'
                : 'Responde las preguntas del consultor'
            }
          </p>
        </motion.div>

        {/* Etapas del análisis */}
        <div className="w-full max-w-sm space-y-4 mb-8">
          {ANALYSIS_STAGES.map((stage, index) => {
            const isActive = currentStage === index;
            const isComplete = currentStage > index || analysisComplete;
            const showProgress = isActive && !analysisComplete;

            return (
              <motion.div
                key={stage.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className={`
                  flex items-center gap-3 p-3 rounded-xl transition-all duration-300
                  ${isActive ? 'bg-white shadow-md' : 'bg-white/50'}
                  ${isComplete ? 'bg-white' : ''}
                `}>
                  {/* Icono de estado */}
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${isComplete
                      ? 'bg-tis-coral text-white'
                      : isActive
                        ? 'bg-tis-coral/20 text-tis-coral'
                        : 'bg-slate-100 text-slate-400'
                    }
                  `}>
                    {isComplete ? (
                      <Check className="w-4 h-4" />
                    ) : isActive ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="text-xs font-medium">{stage.id}</span>
                    )}
                  </div>

                  {/* Texto */}
                  <span className={`
                    text-sm font-medium transition-colors
                    ${isComplete || isActive ? 'text-slate-700' : 'text-slate-400'}
                  `}>
                    {stage.label}
                  </span>
                </div>

                {/* Barra de progreso */}
                {showProgress && (
                  <div className="absolute bottom-0 left-14 right-3 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-tis-coral"
                      style={{ width: `${stageProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Progreso de conversación */}
        {!analysisComplete && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-sm"
          >
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>Progreso de la conversacion</span>
              <span>{Math.round(conversationProgress)}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-tis-coral to-tis-pink"
                initial={{ width: 0 }}
                animate={{ width: `${conversationProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {/* Resultado del análisis */}
        <AnimatePresence>
          {analysisComplete && analysis && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-full max-w-sm mt-8"
            >
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
                <div className="text-center mb-4">
                  <span className="inline-block px-3 py-1 bg-tis-coral/10 text-tis-coral text-xs font-semibold rounded-full uppercase tracking-wider">
                    {analysis.business_type === 'dental'
                      ? 'Clinica Dental'
                      : analysis.business_type === 'restaurant'
                        ? 'Restaurante'
                        : 'Evaluacion Personalizada'
                    }
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
                  Plan Recomendado: {analysis.recommended_plan.charAt(0).toUpperCase() + analysis.recommended_plan.slice(1)}
                </h3>

                <p className="text-sm text-slate-500 text-center mb-4">
                  {analysis.reasoning}
                </p>

                {analysis.financial_impact > 0 && (
                  <div className="flex justify-center gap-4 text-center mb-4">
                    <div>
                      <div className="text-lg font-bold text-tis-coral">
                        ${analysis.financial_impact.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400">Impacto mensual</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-tis-coral">
                        {analysis.time_impact}h
                      </div>
                      <div className="text-xs text-slate-400">Horas/semana</div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer con branding */}
      <div className="relative z-10 p-6 text-center">
        <p className="text-xs text-slate-400">
          Powered by TIS TIS AI
        </p>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: Discovery Page
// ============================================================

function generateSessionToken(): string {
  return `ds_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export default function DiscoveryPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [sessionToken] = useState(() => generateSessionToken());
  const [rawStreamingContent, setRawStreamingContent] = useState<string>('');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  // Auto-scroll al nuevo mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, rawStreamingContent]);

  // Parsear análisis del contenido
  const parseAnalysis = (content: string): AIAnalysis | null => {
    const match = content.match(/ANALYSIS_COMPLETE::({[\s\S]*})/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  };

  // Limpiar el contenido de análisis para mostrar al usuario
  const cleanContent = (content: string): string => {
    return content.replace(/ANALYSIS_COMPLETE::{[\s\S]*}/, '').trim();
  };

  // Enviar mensaje a la IA
  const sendMessageToAI = useCallback(async (conversationHistory: Message[]) => {
    setIsLoading(true);
    setRawStreamingContent('');
    const aiMessageId = `ai_${Date.now()}`;
    setStreamingMessageId(aiMessageId);

    try {
      const response = await fetch('/api/chat/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory.map(m => ({
            role: m.role,
            content: m.content
          })),
          sessionToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta');
      }

      if (!response.body) {
        throw new Error('No se recibio respuesta');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      // Leer el stream chunk por chunk
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;
        // Actualizar el contenido raw, el hook de typing lo mostrará progresivamente
        setRawStreamingContent(cleanContent(accumulatedText));
      }

      // Verificar si hay análisis completo
      const analysisResult = parseAnalysis(accumulatedText);
      if (analysisResult) {
        setIsAnalyzing(true);

        // Simular tiempo de procesamiento
        await new Promise(resolve => setTimeout(resolve, 3000));

        setAnalysis(analysisResult);
        setIsAnalyzing(false);

        // Guardar en sessionStorage
        sessionStorage.setItem('discovery_analysis', JSON.stringify(analysisResult));
        sessionStorage.setItem('discovery_session_token', sessionToken);

        // Redirigir después de mostrar el resultado
        setTimeout(() => {
          if (analysisResult.requires_consultation || analysisResult.business_type === 'otro') {
            // Redirigir a Enterprise/Consultoría
            router.push('/enterprise');
          } else {
            // Redirigir a Pricing con el plan recomendado
            router.push(`/pricing?plan=${analysisResult.recommended_plan}`);
          }
        }, 4000);
      }

      // Agregar mensaje limpio
      const finalMessage: Message = {
        id: aiMessageId,
        role: 'assistant',
        content: cleanContent(accumulatedText),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, finalMessage]);
      setRawStreamingContent('');
      setStreamingMessageId(null);

    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Disculpa, hubo un error en la conexion. Por favor intenta de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setRawStreamingContent('');
      setStreamingMessageId(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken, router]);

  // Cargar mensaje inicial - solo se ejecuta una vez al montar el componente
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initialMessage = sessionStorage.getItem('initial_message');
    if (initialMessage) {
      const userMessage: Message = {
        id: '1',
        role: 'user',
        content: initialMessage,
        timestamp: new Date()
      };
      setMessages([userMessage]);
      sendMessageToAI([userMessage]);
      sessionStorage.removeItem('initial_message');
    } else {
      // Mensaje de bienvenida profesional
      const welcomeMessage: Message = {
        id: '0',
        role: 'assistant',
        content: 'Bienvenido. Soy consultor de TIS TIS y mi objetivo es entender tu negocio para determinar si podemos ayudarte. Para comenzar, cuentame que tipo de negocio tienes y cual es el principal problema operativo que enfrentas actualmente.',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  // Manejar envío de mensaje
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading || analysis) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setCurrentInput('');

    await sendMessageToAI(updatedMessages);
  };

  // Focus en input después de respuesta
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  return (
    <div className="flex h-screen bg-white">
      {/* ============================================ */}
      {/* PANEL IZQUIERDO: Chat */}
      {/* ============================================ */}
      <div className="w-1/2 flex flex-col border-r border-slate-100">
        {/* Header minimalista */}
        <header className="h-16 px-6 flex items-center justify-between border-b border-slate-100 bg-white">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver</span>
          </Link>

          <div className="flex items-center gap-3">
            <Image
              src="/logos/tis-brain-logo.png"
              alt="TIS TIS"
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
            <div>
              <h1 className="text-sm font-semibold text-slate-800">TIS TIS</h1>
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                En linea
              </p>
            </div>
          </div>

          <div className="w-16" /> {/* Spacer para centrar */}
        </header>

        {/* Área de mensajes */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-5 py-3.5
                    ${msg.role === 'user'
                      ? 'bg-tis-coral text-white'
                      : 'bg-slate-100 text-slate-700'
                    }
                  `}
                >
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </motion.div>
            ))}

            {/* Mensaje en streaming - muestra texto progresivamente */}
            {streamingMessageId && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-slate-100 text-slate-700">
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {rawStreamingContent ? (
                      /* Mostrar el texto que va llegando del servidor */
                      <>
                        {rawStreamingContent}
                        {/* Cursor parpadeante mientras sigue llegando texto */}
                        {isLoading && (
                          <span
                            className="inline-block w-0.5 h-4 bg-tis-coral ml-0.5 align-middle"
                            style={{
                              animation: 'blink 0.8s step-end infinite',
                            }}
                          />
                        )}
                      </>
                    ) : isLoading ? (
                      /* Esperando primer chunk del servidor */
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-slate-400">Escribiendo...</span>
                      </span>
                    ) : null}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Estilos para el cursor */}
            <style jsx>{`
              @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
              }
            `}</style>

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input de mensaje */}
        <div className="p-6 border-t border-slate-100 bg-white">
          <form onSubmit={handleSendMessage}>
            <div className={`
              flex items-end gap-3 p-4 rounded-2xl border-2 transition-all duration-200
              ${analysis
                ? 'bg-slate-50 border-slate-100'
                : 'bg-white border-slate-200 focus-within:border-tis-coral focus-within:shadow-sm'
              }
            `}>
              <textarea
                ref={inputRef}
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={analysis ? 'Analisis completado' : 'Escribe tu respuesta...'}
                className="flex-1 text-[15px] text-slate-700 placeholder:text-slate-400 bg-transparent border-none focus:outline-none resize-none"
                rows={1}
                disabled={isLoading || !!analysis}
                style={{ minHeight: '24px', maxHeight: '120px' }}
              />

              <button
                type="submit"
                disabled={!currentInput.trim() || isLoading || !!analysis}
                className={`
                  p-3 rounded-xl transition-all duration-200
                  ${!currentInput.trim() || isLoading || analysis
                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    : 'bg-tis-coral text-white hover:bg-tis-pink shadow-sm hover:shadow'
                  }
                `}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400 text-center">
              Presiona Enter para enviar
            </p>
          </form>
        </div>
      </div>

      {/* ============================================ */}
      {/* PANEL DERECHO: Análisis */}
      {/* ============================================ */}
      <div className="w-1/2">
        <AnalysisPanel
          messageCount={messages.length}
          isAnalyzing={isAnalyzing}
          analysisComplete={!!analysis}
          analysis={analysis}
        />
      </div>
    </div>
  );
}
