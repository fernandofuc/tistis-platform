// =====================================================
// TIS TIS PLATFORM - Live Preview Chat Component
// Premium chat interface for testing AI agent with LangGraph
// Design: Apple/Google/Lovable aesthetics with TIS TIS colors
// =====================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import type { ProfileType } from '@/src/shared/config/agent-templates';

// ======================
// TYPES
// ======================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean; // Para efecto typewriter
  metadata?: {
    intent?: string;
    signals?: Array<{ signal: string; points: number }>;
    processing_time_ms?: number;
    agents_used?: string[];
    model_used?: string;
    tokens_used?: number;
  };
}

interface ProfileConfig {
  profile_type: ProfileType;
  response_style: string;
  template_key: string;
  delay_minutes: number;
  delay_first_only: boolean;
}

interface LivePreviewChatProps {
  tenantName?: string;
  vertical?: string;
  businessProfile?: {
    is_active: boolean;
    response_delay_minutes: number;
    response_style: string;
  } | null;
  personalProfile?: {
    is_active: boolean;
    response_delay_minutes: number;
    response_style: string;
  } | null;
  colorScheme?: 'purple' | 'orange';
}

type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'webchat';

// ======================
// CONSTANTS
// ======================

const CHANNEL_CONFIG: Record<ChannelType, { name: string; icon: JSX.Element; color: string; bg: string }> = {
  whatsapp: {
    name: 'WhatsApp',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
    ),
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  instagram: {
    name: 'Instagram',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    color: 'text-pink-600',
    bg: 'bg-pink-50',
  },
  facebook: {
    name: 'Facebook',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  webchat: {
    name: 'Web Chat',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    color: 'text-slate-600',
    bg: 'bg-slate-50',
  },
};

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  GREETING: { label: 'Saludo', color: 'bg-blue-100 text-blue-700' },
  PRICE_INQUIRY: { label: 'Consulta de precio', color: 'bg-green-100 text-green-700' },
  BOOK_APPOINTMENT: { label: 'Agendar cita', color: 'bg-purple-100 text-purple-700' },
  LOCATION: { label: 'Ubicacion', color: 'bg-amber-100 text-amber-700' },
  HOURS: { label: 'Horarios', color: 'bg-cyan-100 text-cyan-700' },
  PAIN_URGENT: { label: 'Urgencia', color: 'bg-red-100 text-red-700' },
  HUMAN_REQUEST: { label: 'Solicita humano', color: 'bg-orange-100 text-orange-700' },
  GENERAL_INQUIRY: { label: 'Consulta general', color: 'bg-slate-100 text-slate-700' },
  UNKNOWN: { label: 'Desconocido', color: 'bg-slate-100 text-slate-500' },
};

// ======================
// ICONS
// ======================

const SendIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const ClearIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const RobotIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
  </svg>
);

// ======================
// COMPONENT
// ======================

export function LivePreviewChat({
  tenantName,
  vertical,
  businessProfile,
  personalProfile,
  colorScheme = 'purple',
}: LivePreviewChatProps) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ProfileType>('business');
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('whatsapp');
  const [profileConfig, setProfileConfig] = useState<ProfileConfig | null>(null);
  const [delayCountdown, setDelayCountdown] = useState<number | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  // Estado para el mensaje que se está escribiendo (typewriter)
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string>('');

  // Derived state
  const showPersonal = vertical === 'dental' && personalProfile?.is_active;
  const currentProfile = selectedProfile === 'business' ? businessProfile : personalProfile;
  const currentDelay = currentProfile?.response_delay_minutes || 0;

  // Colors
  const colors = {
    purple: {
      primary: 'bg-purple-500',
      primaryHover: 'hover:bg-purple-600',
      primaryLight: 'bg-purple-50',
      primaryBorder: 'border-purple-200',
      primaryText: 'text-purple-700',
      bubble: 'bg-purple-50 border-purple-100',
    },
    orange: {
      primary: 'bg-orange-500',
      primaryHover: 'hover:bg-orange-600',
      primaryLight: 'bg-orange-50',
      primaryBorder: 'border-orange-200',
      primaryText: 'text-orange-700',
      bubble: 'bg-orange-50 border-orange-100',
    },
  };
  const c = colors[colorScheme];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, delayCountdown]);

  // Track mounted state and cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (delayTimerRef.current) {
        clearInterval(delayTimerRef.current);
      }
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Función para efecto typewriter premium
  const startTypewriterEffect = useCallback((messageId: string, fullContent: string, onComplete: () => void) => {
    setTypingMessageId(messageId);
    setDisplayedContent('');

    let currentIndex = 0;
    const charsPerTick = 2; // Caracteres por tick (ajusta velocidad)
    const tickInterval = 20; // ms entre ticks (ajusta velocidad)

    typewriterRef.current = setInterval(() => {
      if (!isMountedRef.current) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        return;
      }

      currentIndex += charsPerTick;

      if (currentIndex >= fullContent.length) {
        setDisplayedContent(fullContent);
        setTypingMessageId(null);
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        onComplete();
      } else {
        setDisplayedContent(fullContent.substring(0, currentIndex));
      }
    }, tickInterval);
  }, []);

  // Get access token
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  // Send message
  const handleSendMessage = useCallback(async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setError(null);
    setInputValue('');

    // Capture current message count BEFORE adding user message (for isFirstMessage logic)
    const currentMessageCount = messages.length;
    const isFirstMessage = currentMessageCount === 0;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Determine if we should simulate delay
    // Use captured currentMessageCount, NOT messages.length (which is stale in this callback)
    const shouldSimulateDelay = currentDelay > 0 && (isFirstMessage || !profileConfig?.delay_first_only);
    const simulatedDelayMs = shouldSimulateDelay ? Math.min(currentDelay * 60 * 1000, 10000) : 0; // Max 10s for preview

    // Start delay countdown if needed (show in UI)
    if (simulatedDelayMs > 0) {
      const totalSeconds = Math.ceil(simulatedDelayMs / 1000);
      setDelayCountdown(totalSeconds);

      let remaining = totalSeconds;
      delayTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (isMountedRef.current) {
          setDelayCountdown(remaining);
        }
        if (remaining <= 0) {
          if (delayTimerRef.current) {
            clearInterval(delayTimerRef.current);
          }
          if (isMountedRef.current) {
            setDelayCountdown(null);
          }
        }
      }, 1000);
    }

    setIsLoading(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error('Sesion expirada. Por favor, recarga la pagina.');
      }

      // Build conversation history from previous messages (captured from state)
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Hacer la llamada API y el delay en paralelo
      // El delay es visual para simular el comportamiento real del agente
      const apiPromise = fetch('/api/ai-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: trimmedInput,
          profile_type: selectedProfile,
          channel: selectedChannel,
          conversation_history: conversationHistory,
        }),
        signal, // Allow aborting the request
      });

      // Calcular delay visual (minimo 2 segundos para mostrar "Pensando...")
      const visualDelayMs = simulatedDelayMs > 0 ? simulatedDelayMs : 2000;
      const delayPromise = new Promise(resolve => setTimeout(resolve, visualDelayMs));

      // Esperar ambos (el API response y el delay visual)
      const [response] = await Promise.all([apiPromise, delayPromise]);

      // Check if request was aborted
      if (signal.aborted) return;

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar la respuesta');
      }

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      // Store profile config for metadata display
      if (result.profile_config) {
        setProfileConfig(result.profile_config);
      }

      // Add assistant message with typewriter effect
      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
        isTyping: true, // Marca para efecto typewriter
        metadata: {
          intent: result.intent,
          signals: result.signals,
          processing_time_ms: result.processing_time_ms,
          agents_used: result.agents_used,
          model_used: result.model_used,
          tokens_used: result.tokens_used,
        },
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Iniciar efecto typewriter
      startTypewriterEffect(assistantMessageId, result.response, () => {
        // Cuando termine el typewriter, marcar mensaje como completo
        setMessages(prev => prev.map(m =>
          m.id === assistantMessageId ? { ...m, isTyping: false } : m
        ));
      });

    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('[LivePreviewChat] Error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setDelayCountdown(null);
      }
      if (delayTimerRef.current) {
        clearInterval(delayTimerRef.current);
      }
    }
  }, [inputValue, isLoading, messages, selectedProfile, selectedChannel, currentDelay, profileConfig, getAccessToken, startTypewriterEffect]);

  // Handle enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Clear conversation
  const handleClearConversation = useCallback(() => {
    setMessages([]);
    setProfileConfig(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  // Handle profile change - MUST clear conversation because profiles are different agents
  const handleProfileChange = useCallback((profile: ProfileType) => {
    // Cancel any pending request when switching profiles
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Stop any running typewriter effect
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      setTypingMessageId(null);
      setDisplayedContent('');
    }
    // Stop delay timer
    if (delayTimerRef.current) {
      clearInterval(delayTimerRef.current);
    }

    // Clear state for new agent context
    setSelectedProfile(profile);
    setMessages([]); // Different agent = fresh conversation
    setProfileConfig(null);
    setError(null);
    setIsLoading(false);
    setDelayCountdown(null);

    // Focus input for new conversation
    inputRef.current?.focus();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              selectedProfile === 'business' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
            )}>
              <RobotIcon />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Preview en vivo</h3>
              <p className="text-xs text-slate-500">
                LangGraph + Tools + RAG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Profile Selector */}
            {showPersonal && (
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => handleProfileChange('business')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                    selectedProfile === 'business'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Negocio
                </button>
                <button
                  onClick={() => handleProfileChange('personal')}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                    selectedProfile === 'personal'
                      ? 'bg-white text-orange-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Personal
                </button>
              </div>
            )}

            {/* Clear button */}
            {messages.length > 0 && (
              <button
                onClick={handleClearConversation}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Limpiar conversacion"
              >
                <ClearIcon />
              </button>
            )}
          </div>
        </div>

        {/* Channel Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Canal:</span>
          <div className="flex gap-1">
            {(Object.keys(CHANNEL_CONFIG) as ChannelType[]).map((ch) => {
              const config = CHANNEL_CONFIG[ch];
              return (
                <button
                  key={ch}
                  onClick={() => setSelectedChannel(ch)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all',
                    selectedChannel === ch
                      ? `${config.bg} ${config.color} ring-1 ring-current`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {config.icon}
                  <span className="hidden sm:inline">{config.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Delay indicator */}
        {currentDelay > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <ClockIcon />
            <span>
              Delay configurado: {currentDelay} min
              {profileConfig?.delay_first_only && ' (solo primer mensaje)'}
            </span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50/50 to-white">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center mb-3',
              selectedProfile === 'business' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
            )}>
              <RobotIcon />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Prueba tu asistente
            </p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              Escribe un mensaje para ver como responde usando tu Knowledge Base real
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                    selectedProfile === 'business' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                  )}>
                    <RobotIcon />
                  </div>
                )}

                <div className={cn(
                  'max-w-[80%] space-y-2',
                  msg.role === 'user' ? 'items-end' : 'items-start'
                )}>
                  {/* Message bubble */}
                  <div className={cn(
                    'px-4 py-2.5 rounded-2xl text-sm',
                    msg.role === 'user'
                      ? 'bg-slate-200 text-slate-900 rounded-br-sm'
                      : cn('border rounded-bl-sm', c.bubble, c.primaryText)
                  )}>
                    <p className="whitespace-pre-wrap">
                      {/* Efecto typewriter: mostrar contenido progresivo si está escribiendo */}
                      {msg.role === 'assistant' && typingMessageId === msg.id
                        ? displayedContent
                        : msg.content}
                      {/* Cursor parpadeante durante typewriter */}
                      {msg.role === 'assistant' && typingMessageId === msg.id && (
                        <span className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse" />
                      )}
                    </p>
                  </div>

                  {/* Metadata (for assistant messages) */}
                  {msg.role === 'assistant' && msg.metadata && showMetadata && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs space-y-1 pl-2"
                    >
                      {/* Intent */}
                      {msg.metadata.intent && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Intent:</span>
                          <span className={cn(
                            'px-1.5 py-0.5 rounded-full font-medium',
                            INTENT_LABELS[msg.metadata.intent]?.color || 'bg-slate-100 text-slate-600'
                          )}>
                            {INTENT_LABELS[msg.metadata.intent]?.label || msg.metadata.intent}
                          </span>
                        </div>
                      )}

                      {/* Agents */}
                      {msg.metadata.agents_used && msg.metadata.agents_used.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Agentes:</span>
                          <span className="text-slate-600">
                            {msg.metadata.agents_used.join(' -> ')}
                          </span>
                        </div>
                      )}

                      {/* Signals */}
                      {msg.metadata.signals && msg.metadata.signals.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-400">Senales:</span>
                          {msg.metadata.signals.slice(0, 3).map((s, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                              {s.signal} (+{s.points})
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Timing */}
                      <div className="flex items-center gap-3 text-slate-400">
                        <span>{msg.metadata.processing_time_ms}ms</span>
                        <span>{msg.metadata.tokens_used} tokens</span>
                        <span>{msg.metadata.model_used}</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-600">
                    <UserIcon />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Loading / Delay indicator - Premium typing animation */}
            <AnimatePresence>
              {(isLoading || delayCountdown !== null) && !typingMessageId && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3"
                >
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center',
                    selectedProfile === 'business' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'
                  )}>
                    <RobotIcon />
                  </div>
                  <div className={cn('px-4 py-3 rounded-2xl rounded-bl-sm border', c.bubble)}>
                    {/* Animación de puntos premium tipo iMessage/WhatsApp */}
                    <div className="flex items-center gap-1">
                      <motion.span
                        className={cn('w-2 h-2 rounded-full', selectedProfile === 'business' ? 'bg-purple-400' : 'bg-orange-400')}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      />
                      <motion.span
                        className={cn('w-2 h-2 rounded-full', selectedProfile === 'business' ? 'bg-purple-400' : 'bg-orange-400')}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.span
                        className={cn('w-2 h-2 rounded-full', selectedProfile === 'business' ? 'bg-purple-400' : 'bg-orange-400')}
                        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 px-4 py-2.5 bg-slate-100 rounded-xl text-sm resize-none',
              'placeholder-slate-400 focus:outline-none focus:ring-2',
              selectedProfile === 'business' ? 'focus:ring-purple-500' : 'focus:ring-orange-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[42px] max-h-[120px]'
            )}
            style={{ height: 'auto' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'p-2.5 rounded-xl transition-all flex-shrink-0',
              c.primary, c.primaryHover, 'text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'hover:shadow-md active:scale-95'
            )}
          >
            {isLoading ? <SpinnerIcon /> : <SendIcon />}
          </button>
        </div>

        {/* Footer with toggle */}
        <div className="flex items-center justify-between mt-2 px-1">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showMetadata ? 'Ocultar metadata' : 'Mostrar metadata'}
          </button>
          <span className="text-xs text-slate-400">
            {messages.length} mensaje{messages.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LivePreviewChat;
