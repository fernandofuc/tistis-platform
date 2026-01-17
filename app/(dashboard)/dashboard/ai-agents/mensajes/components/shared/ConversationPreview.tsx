// =====================================================
// TIS TIS PLATFORM - Conversation Preview Component
// Shows a simulated conversation with the selected style
// Design: WhatsApp-like chat bubbles with TIS TIS aesthetics
// =====================================================

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { ResponseStyle } from '@/src/shared/config/agent-templates';
import { RESPONSE_STYLE_EXAMPLES } from '@/src/shared/config/agent-templates';

// ======================
// TYPES
// ======================

interface ConversationPreviewProps {
  style: ResponseStyle;
  profileName?: string;
  colorScheme?: 'purple' | 'orange';
  className?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

type ScenarioKey = 'greeting' | 'price' | 'appointment';

interface Scenario {
  key: ScenarioKey;
  label: string;
  icon: string;
  messages: (style: ResponseStyle, profileName: string) => Message[];
}

// ======================
// SCENARIOS
// ======================

const SCENARIOS: Scenario[] = [
  {
    key: 'greeting',
    label: 'Saludo inicial',
    icon: '👋',
    messages: (style, profileName) => [
      {
        id: '1',
        type: 'user',
        text: 'Hola, buenas tardes',
        timestamp: '14:30',
      },
      {
        id: '2',
        type: 'assistant',
        text: RESPONSE_STYLE_EXAMPLES[style]?.greeting || 'Hola, ¿en qué puedo ayudarte?',
        timestamp: '14:30',
      },
    ],
  },
  {
    key: 'price',
    label: 'Consulta de precio',
    icon: '💰',
    messages: (style, profileName) => [
      {
        id: '1',
        type: 'user',
        text: '¿Cuánto cuesta una limpieza dental?',
        timestamp: '14:32',
      },
      {
        id: '2',
        type: 'assistant',
        text: RESPONSE_STYLE_EXAMPLES[style]?.priceInquiry || 'El servicio tiene un costo de $800 MXN.',
        timestamp: '14:32',
      },
      {
        id: '3',
        type: 'user',
        text: 'Es un poco caro...',
        timestamp: '14:33',
      },
      {
        id: '4',
        type: 'assistant',
        text: RESPONSE_STYLE_EXAMPLES[style]?.objection || 'Entiendo, ofrecemos facilidades de pago.',
        timestamp: '14:33',
      },
    ],
  },
  {
    key: 'appointment',
    label: 'Agendar cita',
    icon: '📅',
    messages: (style, profileName) => [
      {
        id: '1',
        type: 'user',
        text: 'Quiero agendar una cita para mañana',
        timestamp: '14:35',
      },
      {
        id: '2',
        type: 'assistant',
        text: RESPONSE_STYLE_EXAMPLES[style]?.appointment || 'Tu cita ha sido agendada.',
        timestamp: '14:35',
      },
      {
        id: '3',
        type: 'user',
        text: 'Gracias!',
        timestamp: '14:36',
      },
      {
        id: '4',
        type: 'assistant',
        text: RESPONSE_STYLE_EXAMPLES[style]?.farewell || 'Gracias por contactarnos.',
        timestamp: '14:36',
      },
    ],
  },
];

// ======================
// COMPONENT
// ======================

export function ConversationPreview({
  style,
  profileName = 'Tu Negocio',
  colorScheme = 'purple',
  className,
}: ConversationPreviewProps) {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>('greeting');

  const colors = {
    purple: {
      header: 'from-purple-600 to-indigo-600',
      userBubble: 'bg-purple-500 text-white',
      assistantBubble: 'bg-white border border-slate-200',
      tabActive: 'bg-purple-500 text-white',
      tabInactive: 'bg-white/80 text-slate-600 hover:bg-white',
    },
    orange: {
      header: 'from-orange-500 to-pink-500',
      userBubble: 'bg-orange-500 text-white',
      assistantBubble: 'bg-white border border-slate-200',
      tabActive: 'bg-orange-500 text-white',
      tabInactive: 'bg-white/80 text-slate-600 hover:bg-white',
    },
  };

  const c = colors[colorScheme];

  const currentScenario = SCENARIOS.find(s => s.key === selectedScenario) || SCENARIOS[0];
  const messages = useMemo(
    () => currentScenario.messages(style, profileName),
    [currentScenario, style, profileName]
  );

  return (
    <div className={cn('rounded-2xl overflow-hidden shadow-lg border border-slate-200', className)}>
      {/* Phone-like header */}
      <div className={cn('bg-gradient-to-r p-4', c.header)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-sm font-bold">
            AI
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm truncate">{profileName}</h4>
            <p className="text-white/70 text-xs">Asistente Virtual</p>
          </div>
          <div className="text-white/60 text-xs">
            en línea
          </div>
        </div>
      </div>

      {/* Scenario tabs */}
      <div className="bg-slate-100 p-2 flex gap-2">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.key}
            onClick={() => setSelectedScenario(scenario.key)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200',
              selectedScenario === scenario.key ? c.tabActive : c.tabInactive
            )}
          >
            <span className="mr-1">{scenario.icon}</span>
            <span className="hidden sm:inline">{scenario.label}</span>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="bg-slate-50 p-4 min-h-[280px] max-h-[350px] overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedScenario}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'flex',
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] px-4 py-2.5 rounded-2xl shadow-sm',
                    message.type === 'user'
                      ? `${c.userBubble} rounded-br-md`
                      : `${c.assistantBubble} rounded-bl-md`
                  )}
                >
                  <p className={cn(
                    'text-sm leading-relaxed',
                    message.type === 'user' ? 'text-white' : 'text-slate-700'
                  )}>
                    {message.text}
                  </p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    message.type === 'user' ? 'text-white/70 text-right' : 'text-slate-400'
                  )}>
                    {message.timestamp}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer info */}
      <div className="bg-white px-4 py-3 border-t border-slate-100">
        <p className="text-xs text-slate-500 text-center">
          Vista previa del estilo <span className="font-semibold text-slate-700">{
            style === 'professional' ? 'Profesional' :
            style === 'professional_friendly' ? 'Profesional Cálido' :
            style === 'casual' ? 'Casual' : 'Muy Formal'
          }</span>
        </p>
      </div>
    </div>
  );
}

export default ConversationPreview;
