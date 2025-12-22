'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Agent Page
// Dashboard de configuración del AI Agent por Voz
// Design System: TIS TIS Premium (Apple-like aesthetics)
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/src/features/auth';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Card, CardHeader, CardContent, Button } from '@/src/shared/components/ui';
import {
  PageWrapper,
  StatsGrid,
  StatCard,
} from '@/src/features/dashboard';
import type {
  VoiceAgentConfig,
  VoicePhoneNumber,
  VoiceCall,
  VoiceUsageSummary,
  AvailableVoice,
  VoicePersonality,
} from '@/src/features/voice-agent/types';
import {
  AVAILABLE_VOICES,
  MEXICO_AREA_CODES,
} from '@/src/features/voice-agent/types';
import { TalkToAssistant } from '@/src/features/voice-agent/components';

// ======================
// ICONS (SVG TIS TIS Style)
// ======================

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneCallIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const VolumeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const DollarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="4" height="16"/>
    <rect x="14" y="4" width="4" height="16"/>
  </svg>
);

const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <line x1="8" y1="16" x2="8" y2="16"/>
    <line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const HeadphonesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
  </svg>
);

const HistoryIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"/>
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const MessageIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

// ======================
// TYPES
// ======================

interface VoiceAgentResponse {
  success: boolean;
  status: 'blocked' | 'inactive' | 'configuring' | 'active';
  reason?: string;
  plan: string;
  data?: {
    config: VoiceAgentConfig;
    phone_numbers: VoicePhoneNumber[];
    usage_summary: VoiceUsageSummary;
    recent_calls: VoiceCall[];
    generated_prompt: string | null;
  };
}

// ======================
// PERSONALITY CONFIG (with SVG icons instead of emojis)
// ======================

const PERSONALITY_CONFIG: Record<VoicePersonality, { label: string; description: string; color: string }> = {
  professional: {
    label: 'Profesional',
    description: 'Tono serio y formal, ideal para consultorios',
    color: 'tis-purple',
  },
  professional_friendly: {
    label: 'Profesional Amigable',
    description: 'Balance entre profesionalismo y calidez',
    color: 'tis-coral',
  },
  casual: {
    label: 'Casual',
    description: 'Tono relajado y conversacional',
    color: 'tis-green',
  },
  formal: {
    label: 'Formal',
    description: 'Máxima formalidad y respeto',
    color: 'tis-pink',
  },
};

// ======================
// BLOCKED STATE COMPONENT
// ======================

function BlockedState() {
  return (
    <PageWrapper
      title="AI Agent Voz"
      subtitle="Asistente telefónico con inteligencia artificial"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* Hero Card */}
        <Card variant="bordered">
          <CardContent className="p-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Icon */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 bg-gradient-to-br from-tis-coral-100 to-tis-pink-100 rounded-3xl flex items-center justify-center">
                  <PhoneCallIcon className="w-12 h-12 text-tis-coral" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center border border-slate-100">
                  <LockIcon className="w-5 h-5 text-slate-400" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Asistente Telefónico con IA
                </h2>
                <p className="text-slate-600 leading-relaxed max-w-xl">
                  Tu asistente virtual que responde llamadas, agenda citas y atiende a tus clientes 24/7
                  con voz natural en español mexicano.
                </p>

                {/* Plan badge */}
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
                  <span className="text-sm text-slate-500">Disponible en</span>
                  <span className="px-3 py-1 bg-gradient-coral text-white text-sm font-semibold rounded-lg">
                    Plan Growth
                  </span>
                </div>
              </div>

              {/* CTA */}
              <div className="flex-shrink-0">
                <Link
                  href="/dashboard/settings/subscription"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-coral text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Actualizar Plan
                  <ArrowRightIcon className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <PhoneCallIcon className="w-6 h-6" />,
              title: 'Respuesta 24/7',
              description: 'Atiende llamadas automáticamente a cualquier hora del día',
              color: 'tis-coral',
              bgColor: 'bg-tis-coral-100',
            },
            {
              icon: <ClockIcon className="w-6 h-6" />,
              title: 'Agenda Citas',
              description: 'Programa citas directamente en tu calendario integrado',
              color: 'tis-green',
              bgColor: 'bg-tis-green-100',
            },
            {
              icon: <MessageIcon className="w-6 h-6" />,
              title: 'FAQ Automático',
              description: 'Responde preguntas frecuentes sobre tu negocio',
              color: 'tis-purple',
              bgColor: 'bg-tis-purple/10',
            },
            {
              icon: <ArrowRightIcon className="w-6 h-6" />,
              title: 'Escalamiento',
              description: 'Transfiere llamadas a tu equipo cuando sea necesario',
              color: 'tis-pink',
              bgColor: 'bg-tis-pink-100',
            },
            {
              icon: <MicIcon className="w-6 h-6" />,
              title: 'Transcripciones',
              description: 'Obtén texto y análisis de cada conversación',
              color: 'amber-600',
              bgColor: 'bg-amber-100',
            },
            {
              icon: <PhoneIcon className="w-6 h-6" />,
              title: 'LADA Mexicana',
              description: 'Número telefónico local de tu ciudad',
              color: 'tis-green',
              bgColor: 'bg-tis-green-100',
            },
          ].map((feature, idx) => (
            <Card key={idx} variant="bordered" className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-${feature.color}`}>{feature.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-500">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <Card variant="bordered" className="bg-gradient-to-r from-tis-coral-100/50 to-tis-pink-100/50 border-tis-coral/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <PhoneCallIcon className="w-6 h-6 text-tis-coral" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">¿Listo para automatizar tus llamadas?</h3>
                  <p className="text-sm text-slate-600">Actualiza a Plan Growth y activa tu asistente de voz hoy</p>
                </div>
              </div>
              <Link
                href="/dashboard/settings/subscription"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-coral text-white font-semibold rounded-xl hover:shadow-lg transition-all whitespace-nowrap"
              >
                Ver Planes
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageWrapper>
  );
}

// ======================
// VOICE SELECTOR COMPONENT
// ======================

function VoiceSelector({
  selectedVoiceId,
  onSelect,
}: {
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
}) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const playPreview = (voice: AvailableVoice) => {
    setPlayingVoice(voice.id);
    setTimeout(() => setPlayingVoice(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {AVAILABLE_VOICES.map((voice) => (
        <button
          key={voice.id}
          onClick={() => onSelect(voice.id)}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            selectedVoiceId === voice.id
              ? 'border-tis-coral bg-tis-coral-100/50 dark:bg-tis-coral/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-tis-coral/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                voice.gender === 'male'
                  ? 'bg-tis-purple/10 text-tis-purple'
                  : 'bg-tis-pink/10 text-tis-pink'
              }`}>
                <VolumeIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {voice.name}
                </span>
                {voice.is_default && (
                  <span className="ml-2 px-2 py-0.5 bg-tis-green-100 text-tis-green text-xs font-medium rounded-full">
                    Recomendado
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                playPreview(voice);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {playingVoice === voice.id ? (
                <PauseIcon className="w-4 h-4 text-tis-coral" />
              ) : (
                <PlayIcon className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Acento {voice.accent} • {voice.gender === 'male' ? 'Masculino' : 'Femenino'}
          </p>
        </button>
      ))}
    </div>
  );
}

// ======================
// PHONE NUMBER MANAGER COMPONENT
// ======================

function PhoneNumberManager({
  phoneNumbers,
  onRequestNumber,
  onReleaseNumber,
  loading,
}: {
  phoneNumbers: VoicePhoneNumber[];
  onRequestNumber: (areaCode: string) => void;
  onReleaseNumber: (numberId: string) => void;
  loading: boolean;
}) {
  const [showAreaCodes, setShowAreaCodes] = useState(false);
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-tis-green-100 flex items-center justify-center">
            <PhoneIcon className="w-5 h-5 text-tis-green" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Números Telefónicos</h3>
            <p className="text-sm text-slate-500">Gestiona los números de tu asistente</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAreaCodes(!showAreaCodes)}
          size="sm"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Agregar Número
        </Button>
      </div>
      <CardContent>
        {/* Lista de números existentes */}
        {phoneNumbers.length > 0 ? (
          <div className="space-y-3 mb-6">
            {phoneNumbers.map((number) => (
              <div
                key={number.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    number.status === 'active'
                      ? 'bg-tis-green-100'
                      : 'bg-amber-100'
                  }`}>
                    <PhoneIcon className={`w-6 h-6 ${
                      number.status === 'active' ? 'text-tis-green' : 'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-gray-900 dark:text-white text-lg">
                      {number.phone_number_display || number.phone_number}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>LADA {number.area_code}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className={`font-medium ${
                        number.status === 'active' ? 'text-tis-green' : 'text-amber-600'
                      }`}>
                        {number.status === 'active' ? 'Activo' : number.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{number.total_calls} llamadas</p>
                    <p className="text-xs text-gray-500">{number.total_minutes} minutos</p>
                  </div>
                  <button
                    onClick={() => onReleaseNumber(number.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    title="Liberar número"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-6">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PhoneIcon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
              No tienes números telefónicos configurados
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Solicita un número para comenzar a recibir llamadas
            </p>
          </div>
        )}

        {/* Selector de LADA */}
        <AnimatePresence>
          {showAreaCodes && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-tis-coral-100 flex items-center justify-center">
                    <PhoneIcon className="w-3 h-3 text-tis-coral" />
                  </span>
                  Selecciona una LADA para tu número:
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {MEXICO_AREA_CODES.map((area) => (
                    <button
                      key={area.code}
                      onClick={() => setSelectedAreaCode(area.code)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        selectedAreaCode === area.code
                          ? 'bg-tis-coral-100 dark:bg-tis-coral/20 border-2 border-tis-coral'
                          : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <p className="font-mono font-bold text-gray-900 dark:text-white">
                        ({area.code})
                      </p>
                      <p className="text-xs text-gray-500 truncate">{area.city}</p>
                    </button>
                  ))}
                </div>
                {selectedAreaCode && (
                  <div className="mt-4 flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowAreaCodes(false);
                        setSelectedAreaCode(null);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        onRequestNumber(selectedAreaCode);
                        setShowAreaCodes(false);
                        setSelectedAreaCode(null);
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Solicitando...' : `Solicitar número (${selectedAreaCode})`}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ======================
// CALL HISTORY TABLE COMPONENT
// ======================

function CallHistoryTable({ calls }: { calls: VoiceCall[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-tis-green-100 text-tis-green';
      case 'in_progress':
        return 'bg-tis-coral-100 text-tis-coral';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'escalated':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    const labels: Record<string, string> = {
      appointment_booked: 'Cita agendada',
      information_given: 'Información dada',
      escalated_human: 'Escalado',
      callback_requested: 'Callback solicitado',
      not_interested: 'No interesado',
      wrong_number: 'Número equivocado',
      voicemail: 'Buzón de voz',
      dropped: 'Colgada',
      completed_other: 'Completada',
    };
    return outcome ? labels[outcome] || outcome : '-';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (calls.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HistoryIcon className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
          No hay llamadas recientes
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Las llamadas aparecerán aquí cuando tu asistente esté activo
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Fecha
            </th>
            <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Teléfono
            </th>
            <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Duración
            </th>
            <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Estado
            </th>
            <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Resultado
            </th>
            <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr
              key={call.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td className="py-4 px-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(call.created_at).toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(call.created_at).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </td>
              <td className="py-4 px-4">
                <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                  {call.caller_phone}
                </p>
              </td>
              <td className="py-4 px-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDuration(call.duration_seconds)}
                </p>
              </td>
              <td className="py-4 px-4">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(call.status)}`}>
                  {call.status === 'completed' ? 'Completada' : call.status}
                </span>
              </td>
              <td className="py-4 px-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {getOutcomeLabel(call.outcome)}
                </p>
              </td>
              <td className="py-4 px-4 text-right">
                <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ======================
// CONFIG SECTION COMPONENT
// ======================

function ConfigSection({
  config,
  onSave,
  saving,
}: {
  config: VoiceAgentConfig;
  onSave: (updates: Partial<VoiceAgentConfig>) => void;
  saving: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    assistant_name: config.assistant_name,
    assistant_personality: config.assistant_personality,
    first_message: config.first_message,
    voice_id: config.voice_id,
    use_filler_phrases: config.use_filler_phrases,
    recording_enabled: config.recording_enabled,
  });

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Nombre y Personalidad */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tis-coral-100 flex items-center justify-center">
              <BotIcon className="w-5 h-5 text-tis-coral" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Configuración del Asistente</h3>
              <p className="text-sm text-slate-500">Personaliza cómo se presenta tu asistente</p>
            </div>
          </div>
          {!isEditing ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <EditIcon className="w-4 h-4 mr-2" />
              Editar
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <SaveIcon className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          )}
        </div>
        <CardContent>
          <div className="space-y-6">
            {/* Nombre del asistente */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Nombre del Asistente
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.assistant_name}
                  onChange={(e) => setFormData({ ...formData, assistant_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all"
                  placeholder="Ej: Ana, Carlos, Asistente"
                />
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {config.assistant_name}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Este nombre se usará en el saludo inicial
              </p>
            </div>

            {/* Personalidad */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Personalidad
              </label>
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(PERSONALITY_CONFIG).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setFormData({ ...formData, assistant_personality: key as VoicePersonality })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.assistant_personality === key
                          ? `border-${val.color} bg-${val.color}-100/50`
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-${val.color}/10 flex items-center justify-center mb-3`}>
                        <BotIcon className={`w-5 h-5 text-${val.color}`} />
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">{val.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{val.description}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-tis-coral-100 flex items-center justify-center">
                    <BotIcon className="w-6 h-6 text-tis-coral" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {PERSONALITY_CONFIG[config.assistant_personality].label}
                    </p>
                    <p className="text-sm text-gray-500">
                      {PERSONALITY_CONFIG[config.assistant_personality].description}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Primer mensaje */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Mensaje de Bienvenida
              </label>
              {isEditing ? (
                <textarea
                  value={formData.first_message}
                  onChange={(e) => setFormData({ ...formData, first_message: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-tis-coral focus:border-transparent transition-all resize-none"
                  placeholder="Ej: Hola, soy Ana de Clínica Dental Sonrisa. ¿En qué puedo ayudarte?"
                />
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                  <p className="text-gray-700 dark:text-gray-300 italic leading-relaxed">
                    &quot;{config.first_message}&quot;
                  </p>
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Lo primero que dirá tu asistente al contestar
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Voz */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-tis-purple/10 flex items-center justify-center">
            <VolumeIcon className="w-5 h-5 text-tis-purple" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Voz del Asistente</h3>
            <p className="text-sm text-slate-500">Selecciona cómo sonará tu asistente</p>
          </div>
        </div>
        <CardContent>
          {isEditing ? (
            <VoiceSelector
              selectedVoiceId={formData.voice_id}
              onSelect={(voiceId) => setFormData({ ...formData, voice_id: voiceId })}
            />
          ) : (
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
              {(() => {
                const voice = AVAILABLE_VOICES.find((v) => v.id === config.voice_id);
                return voice ? (
                  <>
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      voice.gender === 'male'
                        ? 'bg-tis-purple/10'
                        : 'bg-tis-pink/10'
                    }`}>
                      <VolumeIcon className={`w-7 h-7 ${
                        voice.gender === 'male' ? 'text-tis-purple' : 'text-tis-pink'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{voice.name}</p>
                      <p className="text-sm text-gray-500">
                        Acento {voice.accent} • {voice.gender === 'male' ? 'Masculino' : 'Femenino'}
                      </p>
                    </div>
                    <button className="p-3 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors">
                      <PlayIcon className="w-5 h-5 text-gray-500" />
                    </button>
                  </>
                ) : (
                  <p className="text-gray-500">Voz no seleccionada</p>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opciones avanzadas */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Opciones Avanzadas</h3>
            <p className="text-sm text-slate-500">Configuración adicional del comportamiento</p>
          </div>
        </div>
        <CardContent>
          <div className="space-y-4">
            {/* Frases de relleno */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-tis-coral-100 flex items-center justify-center">
                  <MessageIcon className="w-6 h-6 text-tis-coral" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Frases de Relleno Naturales
                  </p>
                  <p className="text-sm text-gray-500">
                    &quot;Mmm...&quot;, &quot;Bueno...&quot;, &quot;Claro...&quot; para sonar más humano
                  </p>
                </div>
              </div>
              {isEditing ? (
                <button
                  onClick={() => setFormData({ ...formData, use_filler_phrases: !formData.use_filler_phrases })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    formData.use_filler_phrases ? 'bg-tis-coral' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                      formData.use_filler_phrases ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  config.use_filler_phrases
                    ? 'bg-tis-green-100 text-tis-green'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {config.use_filler_phrases ? 'Activado' : 'Desactivado'}
                </span>
              )}
            </div>

            {/* Grabación */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-tis-purple/10 flex items-center justify-center">
                  <MicIcon className="w-6 h-6 text-tis-purple" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Grabación de Llamadas
                  </p>
                  <p className="text-sm text-gray-500">
                    Guarda audio de las llamadas para revisión
                  </p>
                </div>
              </div>
              {isEditing ? (
                <button
                  onClick={() => setFormData({ ...formData, recording_enabled: !formData.recording_enabled })}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    formData.recording_enabled ? 'bg-tis-coral' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                      formData.recording_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  config.recording_enabled
                    ? 'bg-tis-green-100 text-tis-green'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {config.recording_enabled ? 'Activado' : 'Desactivado'}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ======================
// MAIN PAGE COMPONENT
// ======================

export default function AIAgentVozPage() {
  const { session } = useAuth();
  const [data, setData] = useState<VoiceAgentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'calls'>('config');
  const [showTalkToAssistant, setShowTalkToAssistant] = useState(false);

  const accessToken = session?.access_token;

  const fetchVoiceAgent = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/voice-agent', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar Voice Agent');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchVoiceAgent();
  }, [fetchVoiceAgent]);

  const handleSaveConfig = async (updates: Partial<VoiceAgentConfig>) => {
    if (!accessToken) return;

    try {
      setSaving(true);
      const response = await fetch('/api/voice-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchVoiceAgent();
      }
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVoice = async () => {
    if (!accessToken || !data?.data?.config) return;

    try {
      setSaving(true);
      const newEnabled = !data.data.config.voice_enabled;
      const response = await fetch('/api/voice-agent', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'toggle',
          enabled: newEnabled,
        }),
      });

      if (response.ok) {
        fetchVoiceAgent();
      }
    } catch (err) {
      console.error('Error toggling voice:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPhoneNumber = async (areaCode: string) => {
    if (!accessToken) return;

    try {
      setSaving(true);
      const response = await fetch('/api/voice-agent/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ area_code: areaCode }),
      });

      if (response.ok) {
        fetchVoiceAgent();
      }
    } catch (err) {
      console.error('Error requesting phone number:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReleasePhoneNumber = async (numberId: string) => {
    if (!accessToken) return;

    try {
      setSaving(true);
      const response = await fetch('/api/voice-agent/phone-numbers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ phone_number_id: numberId }),
      });

      if (response.ok) {
        fetchVoiceAgent();
      }
    } catch (err) {
      console.error('Error releasing phone number:', err);
    } finally {
      setSaving(false);
    }
  };

  // Handle unauthenticated state
  if (!accessToken && !loading) {
    return (
      <PageWrapper
        title="AI Agent Voz"
        subtitle="Asistente telefónico inteligente"
      >
        <div className="flex items-center justify-center min-h-[50vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertIcon className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-2">Sesión no encontrada</p>
            <p className="text-gray-600 dark:text-gray-400">Inicia sesión para acceder a AI Agent Voz</p>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper
        title="AI Agent Voz"
        subtitle="Cargando..."
      >
        <div className="flex items-center justify-center min-h-[50vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-12 h-12 mx-auto mb-4">
              <RefreshIcon className="w-12 h-12 text-tis-coral animate-spin" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">Cargando Voice Agent...</p>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper
        title="AI Agent Voz"
        subtitle="Error"
      >
        <div className="flex items-center justify-center min-h-[50vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertIcon className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-2">Error al cargar</p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={fetchVoiceAgent}>
              <RefreshIcon className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  // Blocked state (not Growth plan)
  if (data?.status === 'blocked') {
    return <BlockedState />;
  }

  const config = data?.data?.config;
  const phoneNumbers = data?.data?.phone_numbers || [];
  const usageSummary = data?.data?.usage_summary;
  const recentCalls = data?.data?.recent_calls || [];

  return (
    <PageWrapper
      title="AI Agent Voz"
      subtitle="Asistente telefónico inteligente para tu negocio"
      actions={
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchVoiceAgent}
          >
            <RefreshIcon className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          {config && (
            <Button
              variant={config.voice_enabled ? 'danger' : 'primary'}
              size="sm"
              onClick={handleToggleVoice}
              disabled={saving}
            >
              {config.voice_enabled ? (
                <>
                  <PhoneOffIcon className="w-4 h-4 mr-2" />
                  Desactivar
                </>
              ) : (
                <>
                  <PhoneCallIcon className="w-4 h-4 mr-2" />
                  Activar
                </>
              )}
            </Button>
          )}
        </div>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        {/* Status Banner */}
        {config && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-5 rounded-2xl flex items-center gap-4 border ${
              config.voice_enabled
                ? 'bg-tis-green-100/50 border-tis-green/30'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className={`p-3 rounded-xl ${
              config.voice_enabled
                ? 'bg-tis-green-100'
                : 'bg-amber-100'
            }`}>
              {config.voice_enabled ? (
                <CheckIcon className="w-6 h-6 text-tis-green" />
              ) : (
                <AlertIcon className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <p className={`font-semibold ${
                config.voice_enabled
                  ? 'text-tis-green'
                  : 'text-amber-700'
              }`}>
                {config.voice_enabled
                  ? 'Tu asistente de voz está activo'
                  : 'Tu asistente de voz está desactivado'}
              </p>
              <p className={`text-sm ${
                config.voice_enabled
                  ? 'text-tis-green/80'
                  : 'text-amber-600'
              }`}>
                {config.voice_enabled
                  ? 'Recibiendo llamadas en los números configurados'
                  : 'Actívalo para comenzar a recibir llamadas'}
              </p>
            </div>
            {phoneNumbers.length > 0 && config.voice_enabled && (
              <div className="text-right">
                <p className="font-mono font-semibold text-tis-green text-lg">
                  {phoneNumbers[0].phone_number_display || phoneNumbers[0].phone_number}
                </p>
                <p className="text-xs text-tis-green/70">
                  Número principal
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Stats */}
        {usageSummary && (
          <StatsGrid columns={4}>
            <StatCard
              title="Llamadas"
              value={usageSummary.total_calls.toString()}
              icon={<PhoneCallIcon className="w-5 h-5" />}
            />
            <StatCard
              title="Minutos"
              value={usageSummary.total_minutes.toString()}
              icon={<ClockIcon className="w-5 h-5" />}
            />
            <StatCard
              title="Citas Agendadas"
              value={`${Math.round(usageSummary.appointment_booking_rate * 100)}%`}
              icon={<TrendingUpIcon className="w-5 h-5" />}
            />
            <StatCard
              title="Costo"
              value={`$${usageSummary.total_cost_usd.toFixed(2)}`}
              icon={<DollarIcon className="w-5 h-5" />}
            />
          </StatsGrid>
        )}

        {/* Talk to Assistant Button */}
        <Card>
          <CardContent className="p-6">
            <button
              onClick={() => setShowTalkToAssistant(true)}
              disabled={saving || !config}
              className={`w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-semibold text-lg transition-all ${
                saving || !config
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-coral text-white hover:shadow-xl shadow-coral transform hover:scale-[1.02]'
              }`}
            >
              <HeadphonesIcon className="w-6 h-6" />
              <span>Hablar con Asistente</span>
              <span className="px-3 py-1 bg-white/20 rounded-lg text-sm font-medium">PRUEBA</span>
            </button>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-4 font-semibold transition-colors relative ${
              activeTab === 'config'
                ? 'text-tis-coral'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Configuración
            </div>
            {activeTab === 'config' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-tis-coral"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-6 py-4 font-semibold transition-colors relative ${
              activeTab === 'calls'
                ? 'text-tis-coral'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5" />
              Historial de Llamadas
              {recentCalls.length > 0 && (
                <span className="px-2 py-0.5 bg-tis-coral-100 text-tis-coral text-xs font-semibold rounded-full">
                  {recentCalls.length}
                </span>
              )}
            </div>
            {activeTab === 'calls' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-tis-coral"
              />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'config' && config && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Phone Numbers */}
              <PhoneNumberManager
                phoneNumbers={phoneNumbers}
                onRequestNumber={handleRequestPhoneNumber}
                onReleaseNumber={handleReleasePhoneNumber}
                loading={saving}
              />

              {/* Config Sections */}
              <ConfigSection
                config={config}
                onSave={handleSaveConfig}
                saving={saving}
              />
            </motion.div>
          )}

          {activeTab === 'calls' && (
            <motion.div
              key="calls"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Card>
                <CardContent className="p-0">
                  <CallHistoryTable calls={recentCalls} />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Talk to Assistant Modal */}
        {config && accessToken && (
          <TalkToAssistant
            isOpen={showTalkToAssistant}
            onClose={() => setShowTalkToAssistant(false)}
            config={config}
            accessToken={accessToken}
          />
        )}
      </motion.div>
    </PageWrapper>
  );
}
