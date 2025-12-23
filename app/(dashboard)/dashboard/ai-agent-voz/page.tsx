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
import { Button } from '@/src/shared/components/ui';
import {
  PageWrapper,
} from '@/src/features/dashboard';
import type {
  VoiceAgentConfig,
  VoicePhoneNumber,
  VoiceCall,
  VoiceUsageSummary,
  AvailableVoice,
  VoicePersonality,
  AIModel,
  ResponseSpeedPreset,
  VoiceQualityPreset,
} from '@/src/features/voice-agent/types';
import {
  AVAILABLE_VOICES,
  MEXICO_AREA_CODES,
  RESPONSE_SPEED_PRESETS,
  VOICE_QUALITY_PRESETS,
} from '@/src/features/voice-agent/types';
import {
  TalkToAssistant,
  BusinessKnowledgeSection,
  CustomInstructionsSection,
  AdvancedSettingsSection,
  EscalationSection,
  SectionGroup,
} from '@/src/features/voice-agent/components';

// ======================
// ICONS (SVG TIS TIS Style - Refined)
// ======================

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneCallIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const PhoneOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
    <line x1="23" y1="1" x2="1" y2="23"/>
  </svg>
);

const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const VolumeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TrendingUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const DollarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const SaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1"/>
    <rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
);

const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/>
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/>
    <circle cx="8" cy="16" r="1" fill="currentColor"/>
    <circle cx="16" cy="16" r="1" fill="currentColor"/>
  </svg>
);

const HeadphonesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
  </svg>
);

const HistoryIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5"/>
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
    <path d="M12 7v5l4 2"/>
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const MessageIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L14.5 8.5L20 9L16 13.5L17 19L12 16L7 19L8 13.5L4 9L9.5 8.5L12 3Z"/>
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
// PERSONALITY CONFIG
// ======================

const PERSONALITY_CONFIG: Record<VoicePersonality, { label: string; description: string; gradient: string }> = {
  professional: {
    label: 'Profesional',
    description: 'Tono serio y formal, ideal para consultorios',
    gradient: 'from-slate-500 to-slate-700',
  },
  professional_friendly: {
    label: 'Profesional Amigable',
    description: 'Balance entre profesionalismo y calidez',
    gradient: 'from-tis-coral to-tis-pink',
  },
  casual: {
    label: 'Casual',
    description: 'Tono relajado y conversacional',
    gradient: 'from-tis-green to-emerald-500',
  },
  formal: {
    label: 'Formal',
    description: 'Máxima formalidad y respeto',
    gradient: 'from-tis-purple to-indigo-600',
  },
};

// ======================
// PREMIUM CARD COMPONENT
// ======================

function PremiumCard({
  children,
  className = '',
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`
        bg-white rounded-2xl border border-slate-200/60
        shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]
        ${hover ? 'transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:border-slate-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

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
        className="space-y-8"
      >
        {/* Hero Card */}
        <PremiumCard className="overflow-hidden" hover={false}>
          <div className="relative">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-tis-coral/5 via-transparent to-tis-pink/5" />

            <div className="relative p-8 lg:p-10">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Icon */}
                <div className="relative flex-shrink-0">
                  <div className="w-28 h-28 bg-gradient-to-br from-tis-coral to-tis-pink rounded-3xl flex items-center justify-center shadow-lg shadow-tis-coral/20">
                    <PhoneCallIcon className="w-14 h-14 text-white" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center border border-slate-100">
                    <LockIcon className="w-6 h-6 text-slate-400" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center lg:text-left">
                  <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
                    Asistente Telefónico con IA
                  </h2>
                  <p className="text-slate-600 leading-relaxed max-w-xl text-lg">
                    Tu asistente virtual que responde llamadas, agenda citas y atiende a tus clientes 24/7
                    con voz natural en español mexicano.
                  </p>

                  {/* Plan badge */}
                  <div className="mt-6 inline-flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <SparklesIcon className="w-5 h-5 text-tis-coral" />
                    <span className="text-sm text-slate-500">Disponible en</span>
                    <span className="px-4 py-1.5 bg-gradient-to-r from-tis-coral to-tis-pink text-white text-sm font-semibold rounded-xl">
                      Plan Growth
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex-shrink-0">
                  <Link
                    href="/dashboard/settings/subscription"
                    className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-tis-coral to-tis-pink text-white font-semibold rounded-2xl shadow-lg shadow-tis-coral/25 hover:shadow-xl hover:shadow-tis-coral/30 transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    Actualizar Plan
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </PremiumCard>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: <PhoneCallIcon className="w-6 h-6" />,
              title: 'Respuesta 24/7',
              description: 'Atiende llamadas automáticamente a cualquier hora',
              gradient: 'from-tis-coral to-tis-pink',
            },
            {
              icon: <ClockIcon className="w-6 h-6" />,
              title: 'Agenda Citas',
              description: 'Programa citas directamente en tu calendario',
              gradient: 'from-tis-green to-emerald-500',
            },
            {
              icon: <MessageIcon className="w-6 h-6" />,
              title: 'FAQ Automático',
              description: 'Responde preguntas frecuentes sobre tu negocio',
              gradient: 'from-tis-purple to-indigo-500',
            },
            {
              icon: <ArrowRightIcon className="w-6 h-6" />,
              title: 'Escalamiento',
              description: 'Transfiere llamadas a tu equipo cuando sea necesario',
              gradient: 'from-amber-500 to-orange-500',
            },
            {
              icon: <MicIcon className="w-6 h-6" />,
              title: 'Transcripciones',
              description: 'Obtén texto y análisis de cada conversación',
              gradient: 'from-rose-500 to-pink-500',
            },
            {
              icon: <PhoneIcon className="w-6 h-6" />,
              title: 'LADA Mexicana',
              description: 'Número telefónico local de tu ciudad',
              gradient: 'from-cyan-500 to-blue-500',
            },
          ].map((feature, idx) => (
            <PremiumCard key={idx} className="p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <span className="text-white">{feature.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </PremiumCard>
          ))}
        </div>

        {/* Bottom CTA */}
        <PremiumCard className="overflow-hidden" hover={false}>
          <div className="relative bg-gradient-to-r from-tis-coral/5 via-transparent to-tis-pink/5 p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-gradient-to-br from-tis-coral to-tis-pink rounded-2xl flex items-center justify-center shadow-lg shadow-tis-coral/20">
                  <PhoneCallIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">¿Listo para automatizar tus llamadas?</h3>
                  <p className="text-slate-600">Actualiza a Plan Growth y activa tu asistente de voz hoy</p>
                </div>
              </div>
              <Link
                href="/dashboard/settings/subscription"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all whitespace-nowrap"
              >
                Ver Planes
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </PremiumCard>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {AVAILABLE_VOICES.map((voice) => (
        <button
          key={voice.id}
          onClick={() => onSelect(voice.id)}
          className={`group relative p-5 rounded-2xl border-2 transition-all text-left ${
            selectedVoiceId === voice.id
              ? 'border-tis-coral bg-gradient-to-br from-tis-coral/5 to-tis-pink/5 shadow-lg shadow-tis-coral/10'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                voice.gender === 'male'
                  ? selectedVoiceId === voice.id ? 'bg-tis-purple text-white' : 'bg-tis-purple/10 text-tis-purple'
                  : selectedVoiceId === voice.id ? 'bg-tis-pink text-white' : 'bg-tis-pink/10 text-tis-pink'
              }`}>
                <VolumeIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="font-semibold text-slate-900 block">
                  {voice.name}
                </span>
                {voice.is_default && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-tis-green/10 text-tis-green text-xs font-medium rounded-full mt-1">
                    <CheckIcon className="w-3 h-3" />
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
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                playingVoice === voice.id
                  ? 'bg-tis-coral text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 group-hover:bg-slate-200'
              }`}
            >
              {playingVoice === voice.id ? (
                <PauseIcon className="w-4 h-4" />
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Acento {voice.accent} • {voice.gender === 'male' ? 'Masculino' : 'Femenino'}
          </p>

          {/* Selection indicator */}
          {selectedVoiceId === voice.id && (
            <div className="absolute top-3 right-3">
              <div className="w-6 h-6 bg-tis-coral rounded-full flex items-center justify-center">
                <CheckIcon className="w-4 h-4 text-white" />
              </div>
            </div>
          )}
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
    <PremiumCard className="overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-green to-emerald-500 flex items-center justify-center shadow-lg shadow-tis-green/20">
              <PhoneIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Números Telefónicos</h3>
              <p className="text-sm text-slate-500">Gestiona los números de tu asistente</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAreaCodes(!showAreaCodes)}
            size="sm"
            className="gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Agregar Número
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Lista de números existentes */}
        {phoneNumbers.length > 0 ? (
          <div className="space-y-4">
            {phoneNumbers.map((number) => (
              <div
                key={number.id}
                className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm ${
                    number.status === 'active'
                      ? 'bg-gradient-to-br from-tis-green to-emerald-500'
                      : 'bg-amber-100'
                  }`}>
                    <PhoneIcon className={`w-7 h-7 ${
                      number.status === 'active' ? 'text-white' : 'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-mono font-bold text-slate-900 text-xl tracking-tight">
                      {number.phone_number_display || number.phone_number}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                      <span className="font-medium">LADA {number.area_code}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className={`font-semibold ${
                        number.status === 'active' ? 'text-tis-green' : 'text-amber-600'
                      }`}>
                        {number.status === 'active' ? 'Activo' : number.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{number.total_calls}</p>
                    <p className="text-xs text-slate-500">llamadas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">{number.total_minutes}</p>
                    <p className="text-xs text-slate-500">minutos</p>
                  </div>
                  <button
                    onClick={() => onReleaseNumber(number.id)}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Liberar número"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <PhoneIcon className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-900 font-semibold text-lg mb-2">
              No tienes números telefónicos
            </p>
            <p className="text-slate-500 max-w-sm mx-auto">
              Solicita un número para comenzar a recibir llamadas con tu asistente de voz
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
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-tis-coral/10 flex items-center justify-center">
                    <PhoneIcon className="w-4 h-4 text-tis-coral" />
                  </div>
                  <h4 className="font-semibold text-slate-900">
                    Selecciona una LADA para tu número:
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto p-1">
                  {MEXICO_AREA_CODES.map((area) => (
                    <button
                      key={area.code}
                      onClick={() => setSelectedAreaCode(area.code)}
                      className={`p-4 rounded-xl text-left transition-all ${
                        selectedAreaCode === area.code
                          ? 'bg-gradient-to-br from-tis-coral to-tis-pink text-white shadow-lg shadow-tis-coral/20'
                          : 'bg-slate-50 border border-slate-200 hover:border-tis-coral/30 hover:bg-slate-100'
                      }`}
                    >
                      <p className={`font-mono font-bold text-lg ${selectedAreaCode === area.code ? 'text-white' : 'text-slate-900'}`}>
                        ({area.code})
                      </p>
                      <p className={`text-sm truncate ${selectedAreaCode === area.code ? 'text-white/80' : 'text-slate-500'}`}>
                        {area.city}
                      </p>
                    </button>
                  ))}
                </div>
                {selectedAreaCode && (
                  <div className="mt-6 flex justify-end gap-3">
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
      </div>
    </PremiumCard>
  );
}

// ======================
// CALL HISTORY TABLE COMPONENT
// ======================

function CallHistoryTable({ calls }: { calls: VoiceCall[] }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-tis-green/10', text: 'text-tis-green', label: 'Completada' };
      case 'in_progress':
        return { bg: 'bg-tis-coral/10', text: 'text-tis-coral', label: 'En progreso' };
      case 'failed':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Fallida' };
      case 'escalated':
        return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Escalada' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
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
      <div className="text-center py-20">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <HistoryIcon className="w-10 h-10 text-slate-400" />
        </div>
        <p className="text-slate-900 font-semibold text-lg mb-2">
          No hay llamadas recientes
        </p>
        <p className="text-slate-500 max-w-sm mx-auto">
          Las llamadas aparecerán aquí cuando tu asistente esté activo y reciba llamadas
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fecha
            </th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Teléfono
            </th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Duración
            </th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Resultado
            </th>
            <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">

            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {calls.map((call) => {
            const statusBadge = getStatusBadge(call.status);
            return (
              <tr
                key={call.id}
                className="hover:bg-slate-50 transition-colors"
              >
                <td className="py-5 px-6">
                  <p className="text-sm font-semibold text-slate-900">
                    {new Date(call.created_at).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(call.created_at).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </td>
                <td className="py-5 px-6">
                  <p className="font-mono text-sm font-semibold text-slate-900">
                    {call.caller_phone}
                  </p>
                </td>
                <td className="py-5 px-6">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDuration(call.duration_seconds)}
                  </p>
                </td>
                <td className="py-5 px-6">
                  <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                    {statusBadge.label}
                  </span>
                </td>
                <td className="py-5 px-6">
                  <p className="text-sm text-slate-600">
                    {getOutcomeLabel(call.outcome)}
                  </p>
                </td>
                <td className="py-5 px-6 text-right">
                  <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ======================
// CONFIG SECTION COMPONENT
// ======================

// Helper to get response speed preset from config values
function getResponseSpeedPresetFromConfig(waitSeconds: number): ResponseSpeedPreset {
  if (waitSeconds <= 0.5) return 'fast';
  if (waitSeconds <= 0.8) return 'balanced';
  return 'patient';
}

// Helper to get voice quality preset from config values
function getVoiceQualityPresetFromConfig(stability: number): VoiceQualityPreset {
  if (stability >= 0.65) return 'consistent';
  if (stability >= 0.4) return 'natural';
  return 'expressive';
}

type ConfigSectionType = 'identity' | 'knowledge' | 'behavior' | 'closing' | 'all';

function ConfigSection({
  config,
  onSave,
  saving,
  accessToken,
  section = 'all',
}: {
  config: VoiceAgentConfig;
  onSave: (updates: Partial<VoiceAgentConfig>) => void;
  saving: boolean;
  accessToken: string;
  section?: ConfigSectionType;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [formData, setFormData] = useState({
    assistant_name: config.assistant_name,
    assistant_personality: config.assistant_personality,
    first_message: config.first_message,
    voice_id: config.voice_id,
    use_filler_phrases: config.use_filler_phrases,
    recording_enabled: config.recording_enabled,
    custom_instructions: config.custom_instructions || '',
    ai_model: config.ai_model || 'gpt-4o-mini' as AIModel,
    wait_seconds: config.wait_seconds || 0.6,
    on_punctuation_seconds: config.on_punctuation_seconds || 0.2,
    on_no_punctuation_seconds: config.on_no_punctuation_seconds || 1.2,
    voice_stability: config.voice_stability || 0.5,
    voice_similarity_boost: config.voice_similarity_boost || 0.75,
    // Escalation and goodbye
    escalation_enabled: config.escalation_enabled || false,
    escalation_phone: config.escalation_phone || '',
    goodbye_message: config.goodbye_message || '',
  });

  // Derived presets from config values
  const [responseSpeedPreset, setResponseSpeedPreset] = useState<ResponseSpeedPreset>(
    getResponseSpeedPresetFromConfig(config.wait_seconds || 0.6)
  );
  const [voiceQualityPreset, setVoiceQualityPreset] = useState<VoiceQualityPreset>(
    getVoiceQualityPresetFromConfig(config.voice_stability || 0.5)
  );

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  const handleSaveCustomInstructions = () => {
    onSave({ custom_instructions: formData.custom_instructions });
    setIsEditingCustom(false);
  };

  const handleAIModelChange = (model: AIModel) => {
    setFormData(prev => ({ ...prev, ai_model: model }));
    onSave({ ai_model: model });
  };

  const handleResponseSpeedChange = (
    preset: ResponseSpeedPreset,
    values: { wait_seconds: number; on_punctuation_seconds: number; on_no_punctuation_seconds: number }
  ) => {
    setResponseSpeedPreset(preset);
    setFormData(prev => ({
      ...prev,
      wait_seconds: values.wait_seconds,
      on_punctuation_seconds: values.on_punctuation_seconds,
      on_no_punctuation_seconds: values.on_no_punctuation_seconds,
    }));
    onSave({
      wait_seconds: values.wait_seconds,
      on_punctuation_seconds: values.on_punctuation_seconds,
      on_no_punctuation_seconds: values.on_no_punctuation_seconds,
    });
  };

  const handleVoiceQualityChange = (
    preset: VoiceQualityPreset,
    values: { stability: number; similarity_boost: number }
  ) => {
    setVoiceQualityPreset(preset);
    setFormData(prev => ({
      ...prev,
      voice_stability: values.stability,
      voice_similarity_boost: values.similarity_boost,
    }));
    onSave({
      voice_stability: values.stability,
      voice_similarity_boost: values.similarity_boost,
    });
  };

  const handleSaveEscalation = () => {
    onSave({
      escalation_enabled: formData.escalation_enabled,
      escalation_phone: formData.escalation_phone,
      goodbye_message: formData.goodbye_message,
    });
  };

  const selectedVoice = AVAILABLE_VOICES.find((v) => v.id === config.voice_id);
  const selectedPersonality = PERSONALITY_CONFIG[config.assistant_personality];

  // Render sections based on prop
  const showIdentity = section === 'all' || section === 'identity';
  const showKnowledge = section === 'all' || section === 'knowledge';
  const showBehavior = section === 'all' || section === 'behavior';
  const showClosing = section === 'all' || section === 'closing';

  return (
    <div className="space-y-4">
      {/* ==================== SECCIÓN: IDENTIDAD ==================== */}
      {showIdentity && (
        <>
          {/* Configuración del Asistente */}
          <PremiumCard className="overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center shadow-lg shadow-tis-coral/20">
                    <BotIcon className="w-6 h-6 text-white" />
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
                    className="gap-2"
                  >
                    <EditIcon className="w-4 h-4" />
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
                      className="gap-2"
                    >
                      <SaveIcon className="w-4 h-4" />
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              {/* Nombre del asistente */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Nombre del Asistente
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.assistant_name}
                    onChange={(e) => setFormData({ ...formData, assistant_name: e.target.value })}
                    className="w-full px-5 py-4 border border-slate-200 rounded-xl bg-white text-slate-900 text-lg font-medium focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all placeholder:text-slate-400"
                    placeholder="Ej: Ana, Carlos, Asistente"
                  />
                ) : (
                  <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-12 h-12 bg-gradient-to-br from-tis-coral/20 to-tis-pink/20 rounded-xl flex items-center justify-center">
                      <span className="text-2xl font-bold text-tis-coral">
                        {config.assistant_name?.charAt(0) || 'A'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-slate-900">{config.assistant_name || 'Sin nombre'}</p>
                      <p className="text-sm text-slate-500">Este nombre se usará en el saludo inicial</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Personalidad */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Personalidad
                </label>
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(PERSONALITY_CONFIG).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setFormData({ ...formData, assistant_personality: key as VoicePersonality })}
                        className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                          formData.assistant_personality === key
                            ? 'border-tis-coral bg-gradient-to-br from-tis-coral/5 to-tis-pink/5 shadow-lg shadow-tis-coral/10'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${val.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                          <BotIcon className="w-6 h-6 text-white" />
                        </div>
                        <p className="font-bold text-slate-900 mb-1">{val.label}</p>
                        <p className="text-sm text-slate-500">{val.description}</p>

                        {formData.assistant_personality === key && (
                          <div className="absolute top-3 right-3">
                            <div className="w-6 h-6 bg-tis-coral rounded-full flex items-center justify-center">
                              <CheckIcon className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${selectedPersonality?.gradient || 'from-slate-500 to-slate-700'} flex items-center justify-center shadow-lg`}>
                      <BotIcon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {selectedPersonality?.label || 'Profesional'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {selectedPersonality?.description || 'Tono profesional'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Mensaje de bienvenida */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Mensaje de Bienvenida
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.first_message}
                    onChange={(e) => setFormData({ ...formData, first_message: e.target.value })}
                    rows={3}
                    className="w-full px-5 py-4 border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all resize-none placeholder:text-slate-400"
                    placeholder="Ej: Hola, soy Ana de Clínica Dental Sonrisa. ¿En qué puedo ayudarte?"
                  />
                ) : (
                  <div className="relative p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-100">
                    <div className="absolute top-4 left-4 text-4xl text-tis-coral/20 font-serif">&ldquo;</div>
                    <p className="text-slate-700 text-lg leading-relaxed pl-8 pr-4 italic">
                      {config.first_message || 'Sin mensaje configurado'}
                    </p>
                    <p className="text-xs text-slate-400 mt-3 pl-8">Lo primero que dirá tu asistente al contestar</p>
                  </div>
                )}
              </div>
            </div>
          </PremiumCard>

          {/* Voz del Asistente */}
          <PremiumCard className="overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-purple to-indigo-500 flex items-center justify-center shadow-lg shadow-tis-purple/20">
                  <VolumeIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Voz del Asistente</h3>
                  <p className="text-sm text-slate-500">Selecciona cómo sonará tu asistente</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {isEditing ? (
                <VoiceSelector
                  selectedVoiceId={formData.voice_id}
                  onSelect={(voiceId) => setFormData({ ...formData, voice_id: voiceId })}
                />
              ) : (
                <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
                  {selectedVoice ? (
                    <>
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-lg ${
                        selectedVoice.gender === 'male'
                          ? 'bg-gradient-to-br from-tis-purple to-indigo-500'
                          : 'bg-gradient-to-br from-tis-pink to-rose-500'
                      }`}>
                        <VolumeIcon className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-slate-900">{selectedVoice.name}</p>
                        <p className="text-sm text-slate-500">
                          Acento {selectedVoice.accent} • {selectedVoice.gender === 'male' ? 'Masculino' : 'Femenino'}
                        </p>
                      </div>
                      <button className="w-12 h-12 bg-slate-200 hover:bg-slate-300 rounded-xl flex items-center justify-center transition-colors">
                        <PlayIcon className="w-5 h-5 text-slate-600" />
                      </button>
                    </>
                  ) : (
                    <p className="text-slate-500">Voz no seleccionada</p>
                  )}
                </div>
              )}
            </div>
          </PremiumCard>
        </>
      )}

      {/* ==================== SECCIÓN: CONOCIMIENTO ==================== */}
      {showKnowledge && (
        <>
          {/* Conocimiento del Negocio */}
          <BusinessKnowledgeSection
            accessToken={accessToken}
            onRegeneratePrompt={() => {
              // Optionally refresh the page or config
            }}
          />

          {/* Instrucciones Personalizadas */}
          <CustomInstructionsSection
            value={formData.custom_instructions}
            onChange={(value) => setFormData(prev => ({ ...prev, custom_instructions: value }))}
            onSave={handleSaveCustomInstructions}
            saving={saving}
            isEditing={isEditingCustom}
            onToggleEdit={() => setIsEditingCustom(!isEditingCustom)}
          />
        </>
      )}

      {/* ==================== SECCIÓN: COMPORTAMIENTO ==================== */}
      {showBehavior && (
        <>
          {/* Configuración Avanzada de IA */}
          <AdvancedSettingsSection
            aiModel={formData.ai_model}
            responseSpeed={responseSpeedPreset}
            voiceQuality={voiceQualityPreset}
            onAIModelChange={handleAIModelChange}
            onResponseSpeedChange={handleResponseSpeedChange}
            onVoiceQualityChange={handleVoiceQualityChange}
            saving={saving}
          />

          {/* Opciones de Comportamiento */}
          <PremiumCard className="overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <SettingsIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Opciones de Comportamiento</h3>
                  <p className="text-sm text-slate-500">Configuración adicional del asistente</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Frases de relleno */}
              <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-coral/20 to-tis-pink/20 flex items-center justify-center">
                    <MessageIcon className="w-6 h-6 text-tis-coral" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Frases de Relleno Naturales
                    </p>
                    <p className="text-sm text-slate-500">
                      &quot;Mmm...&quot;, &quot;Bueno...&quot;, &quot;Claro...&quot; para sonar más humano
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newValue = !formData.use_filler_phrases;
                    setFormData({ ...formData, use_filler_phrases: newValue });
                    onSave({ use_filler_phrases: newValue });
                  }}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    formData.use_filler_phrases ? 'bg-tis-coral' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
                      formData.use_filler_phrases ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Grabación */}
              <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tis-purple/20 to-indigo-500/20 flex items-center justify-center">
                    <MicIcon className="w-6 h-6 text-tis-purple" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Grabación de Llamadas
                    </p>
                    <p className="text-sm text-slate-500">
                      Guarda audio de las llamadas para revisión
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newValue = !formData.recording_enabled;
                    setFormData({ ...formData, recording_enabled: newValue });
                    onSave({ recording_enabled: newValue });
                  }}
                  className={`relative w-14 h-8 rounded-full transition-colors ${
                    formData.recording_enabled ? 'bg-tis-coral' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
                      formData.recording_enabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </PremiumCard>
        </>
      )}

      {/* ==================== SECCIÓN: CIERRE ==================== */}
      {showClosing && (
        <EscalationSection
          escalationEnabled={formData.escalation_enabled}
          escalationPhone={formData.escalation_phone}
          goodbyeMessage={formData.goodbye_message}
          onEscalationEnabledChange={(enabled) => setFormData(prev => ({ ...prev, escalation_enabled: enabled }))}
          onEscalationPhoneChange={(phone) => setFormData(prev => ({ ...prev, escalation_phone: phone }))}
          onGoodbyeMessageChange={(message) => setFormData(prev => ({ ...prev, goodbye_message: message }))}
          onSave={handleSaveEscalation}
          saving={saving}
        />
      )}
    </div>
  );
}

// ======================
// STAT CARD COMPONENT (Premium)
// ======================

function StatCardPremium({
  title,
  value,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <PremiumCard className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          <span className="text-white">{icon}</span>
        </div>
      </div>
    </PremiumCard>
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
  const [activeTab, setActiveTab] = useState<'phones' | 'assistant' | 'history'>('assistant');
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
            <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <AlertIcon className="w-10 h-10 text-amber-600" />
            </div>
            <p className="text-slate-900 font-bold text-lg mb-2">Sesión no encontrada</p>
            <p className="text-slate-500">Inicia sesión para acceder a AI Agent Voz</p>
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
            <div className="w-16 h-16 mx-auto mb-5 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-tis-coral border-t-transparent animate-spin"></div>
            </div>
            <p className="text-slate-500 font-medium">Cargando Voice Agent...</p>
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
            <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <AlertIcon className="w-10 h-10 text-red-600" />
            </div>
            <p className="text-slate-900 font-bold text-lg mb-2">Error al cargar</p>
            <p className="text-slate-500 mb-6 max-w-sm">{error}</p>
            <Button onClick={fetchVoiceAgent} className="gap-2">
              <RefreshIcon className="w-4 h-4" />
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
            className="gap-2"
          >
            <RefreshIcon className="w-4 h-4" />
            Actualizar
          </Button>
          {config && (
            <Button
              variant={config.voice_enabled ? 'danger' : 'primary'}
              size="sm"
              onClick={handleToggleVoice}
              disabled={saving}
              className="gap-2"
            >
              {config.voice_enabled ? (
                <>
                  <PhoneOffIcon className="w-4 h-4" />
                  Desactivar
                </>
              ) : (
                <>
                  <PhoneCallIcon className="w-4 h-4" />
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
          >
            <PremiumCard hover={false} className={`overflow-hidden ${
              config.voice_enabled
                ? 'bg-gradient-to-r from-tis-green/5 to-emerald-500/5 border-tis-green/20'
                : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50'
            }`}>
              <div className="p-6 flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                  config.voice_enabled
                    ? 'bg-gradient-to-br from-tis-green to-emerald-500 shadow-tis-green/20'
                    : 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/20'
                }`}>
                  {config.voice_enabled ? (
                    <CheckIcon className="w-7 h-7 text-white" />
                  ) : (
                    <AlertIcon className="w-7 h-7 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-bold text-lg ${
                    config.voice_enabled ? 'text-tis-green' : 'text-amber-700'
                  }`}>
                    {config.voice_enabled
                      ? 'Tu asistente de voz está activo'
                      : 'Tu asistente de voz está desactivado'}
                  </p>
                  <p className={`text-sm ${
                    config.voice_enabled ? 'text-tis-green/80' : 'text-amber-600'
                  }`}>
                    {config.voice_enabled
                      ? 'Recibiendo llamadas en los números configurados'
                      : 'Actívalo para comenzar a recibir llamadas'}
                  </p>
                </div>
                {phoneNumbers.length > 0 && config.voice_enabled && (
                  <div className="text-right">
                    <p className="font-mono font-bold text-tis-green text-xl tracking-tight">
                      {phoneNumbers[0].phone_number_display || phoneNumbers[0].phone_number}
                    </p>
                    <p className="text-xs text-tis-green/70 font-medium">
                      Número principal
                    </p>
                  </div>
                )}
              </div>
            </PremiumCard>
          </motion.div>
        )}

        {/* Stats Grid */}
        {usageSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCardPremium
              title="Llamadas"
              value={usageSummary.total_calls.toString()}
              icon={<PhoneCallIcon className="w-6 h-6" />}
              gradient="from-tis-coral to-tis-pink"
            />
            <StatCardPremium
              title="Minutos"
              value={usageSummary.total_minutes.toString()}
              icon={<ClockIcon className="w-6 h-6" />}
              gradient="from-tis-purple to-indigo-500"
            />
            <StatCardPremium
              title="Citas Agendadas"
              value={`${usageSummary.appointment_booking_rate}%`}
              icon={<TrendingUpIcon className="w-6 h-6" />}
              gradient="from-tis-green to-emerald-500"
            />
            <StatCardPremium
              title="Costo"
              value={`$${usageSummary.total_cost_usd.toFixed(2)}`}
              icon={<DollarIcon className="w-6 h-6" />}
              gradient="from-amber-500 to-orange-500"
            />
          </div>
        )}

        {/* Talk to Assistant Button */}
        <PremiumCard hover={false} className="overflow-hidden">
          <button
            onClick={() => setShowTalkToAssistant(true)}
            disabled={saving || !config}
            className={`w-full flex items-center justify-center gap-4 py-6 px-8 transition-all ${
              saving || !config
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-tis-coral to-tis-pink text-white hover:shadow-2xl hover:shadow-tis-coral/30 transform hover:scale-[1.01]'
            }`}
          >
            <HeadphonesIcon className="w-7 h-7" />
            <span className="text-xl font-bold">Hablar con Asistente</span>
            <span className="px-4 py-1.5 bg-white/20 rounded-xl text-sm font-semibold">PRUEBA</span>
          </button>
        </PremiumCard>

        {/* Tabs - 3 secciones principales */}
        <div className="flex items-center gap-1 p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-2xl w-fit border border-slate-200/50">
          <button
            onClick={() => setActiveTab('phones')}
            className={`px-5 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'phones'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <PhoneIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Teléfonos</span>
            {phoneNumbers.length > 0 && (
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                activeTab === 'phones'
                  ? 'bg-tis-green/10 text-tis-green'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {phoneNumbers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`px-5 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'assistant'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <BotIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Asistente</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 font-semibold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Historial</span>
            {recentCalls.length > 0 && (
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
                activeTab === 'history'
                  ? 'bg-tis-coral/10 text-tis-coral'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {recentCalls.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* TAB: Teléfonos */}
          {activeTab === 'phones' && (
            <motion.div
              key="phones"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <PhoneNumberManager
                phoneNumbers={phoneNumbers}
                onRequestNumber={handleRequestPhoneNumber}
                onReleaseNumber={handleReleasePhoneNumber}
                loading={saving}
              />
            </motion.div>
          )}

          {/* TAB: Asistente - Reorganizado en grupos lógicos */}
          {activeTab === 'assistant' && config && accessToken && (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-10"
            >
              {/* GRUPO 1: Identidad del Asistente */}
              <SectionGroup
                title="Identidad del Asistente"
                subtitle="Cómo se presenta y suena tu asistente"
                icon={<BotIcon className="w-4 h-4" />}
                iconGradient="from-tis-coral to-tis-pink"
              >
                <ConfigSection
                  config={config}
                  onSave={handleSaveConfig}
                  saving={saving}
                  accessToken={accessToken}
                  section="identity"
                />
              </SectionGroup>

              {/* GRUPO 2: Conocimiento del Negocio */}
              <SectionGroup
                title="Conocimiento del Negocio"
                subtitle="La información que usa tu asistente para responder"
                icon={<SparklesIcon className="w-4 h-4" />}
                iconGradient="from-blue-500 to-indigo-600"
              >
                <ConfigSection
                  config={config}
                  onSave={handleSaveConfig}
                  saving={saving}
                  accessToken={accessToken}
                  section="knowledge"
                />
              </SectionGroup>

              {/* GRUPO 3: Comportamiento Avanzado */}
              <SectionGroup
                title="Comportamiento Avanzado"
                subtitle="Ajustes técnicos para usuarios avanzados"
                icon={<SettingsIcon className="w-4 h-4" />}
                iconGradient="from-purple-500 to-indigo-600"
              >
                <ConfigSection
                  config={config}
                  onSave={handleSaveConfig}
                  saving={saving}
                  accessToken={accessToken}
                  section="behavior"
                />
              </SectionGroup>

              {/* GRUPO 4: Cierre de Conversación */}
              <SectionGroup
                title="Cierre de Conversación"
                subtitle="Qué hace el asistente al terminar la llamada"
                icon={<MessageIcon className="w-4 h-4" />}
                iconGradient="from-rose-500 to-pink-500"
              >
                <ConfigSection
                  config={config}
                  onSave={handleSaveConfig}
                  saving={saving}
                  accessToken={accessToken}
                  section="closing"
                />
              </SectionGroup>
            </motion.div>
          )}

          {/* TAB: Historial */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PremiumCard className="overflow-hidden">
                <CallHistoryTable calls={recentCalls} />
              </PremiumCard>
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
