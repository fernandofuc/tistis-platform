// =====================================================
// TIS TIS PLATFORM - Business IA Page (Premium Design)
// Dashboard de insights de negocio generados por IA
// Incluye: Insights generados por Gemini + AI Learning (patrones detectados)
// =====================================================

'use client';

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

// ======================
// ICONS (Premium SVG)
// ======================
const icons = {
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  lightbulb: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  trending: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  dollar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  checkCircle: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  eye: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  lock: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  ),
  thumbsUp: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
    </svg>
  ),
  brain: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  fire: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  ),
  exclamation: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  book: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
};

// ======================
// TYPES
// ======================

interface BusinessInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  confidence_score: number;
  impact_score: number;
  data_points: number;
  metadata: Record<string, unknown>;
  created_at: string;
  was_acted_upon: boolean;
}

interface InsightsResponse {
  success: boolean;
  status: 'active' | 'onboarding' | 'blocked';
  reason?: string;
  plan: string;
  data: BusinessInsight[];
  unseen_count: number;
  progress?: {
    current: number;
    required: number;
    percentage: number;
  };
}

interface MessagePattern {
  id: string;
  pattern_type: string;
  pattern_type_label: string;
  pattern_value: string;
  occurrence_count: number;
  last_occurrence: string;
  context_examples: string[];
  is_high_priority: boolean;
}

interface LearnedVocabulary {
  id: string;
  term: string;
  meaning: string | null;
  category: string;
  usage_count: number;
}

interface AILearningStats {
  total_patterns: number;
  total_vocabulary: number;
  patterns_by_type: Record<string, number>;
  high_priority_patterns: number;
  last_learning_run: string | null;
}

interface AILearningResponse {
  success: boolean;
  status: 'active' | 'inactive' | 'blocked' | 'not_applicable';
  reason?: string;
  plan: string;
  vertical: string;
  patterns: MessagePattern[];
  vocabulary: LearnedVocabulary[];
  stats: AILearningStats | null;
}

// ======================
// INSIGHT TYPE CONFIG
// ======================

const INSIGHT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  popular_service: { icon: icons.trending, color: 'text-tis-green', bgColor: 'bg-tis-green-100', label: 'Servicio Popular' },
  peak_hours: { icon: icons.clock, color: 'text-tis-purple', bgColor: 'bg-tis-purple/10', label: 'Horas Pico' },
  common_objection: { icon: icons.alert, color: 'text-amber-500', bgColor: 'bg-amber-50', label: 'Objecion Comun' },
  pricing_sensitivity: { icon: icons.dollar, color: 'text-tis-coral', bgColor: 'bg-tis-coral-100', label: 'Sensibilidad a Precios' },
  lead_conversion: { icon: icons.users, color: 'text-tis-purple', bgColor: 'bg-tis-purple/10', label: 'Conversion de Leads' },
  loyalty_insight: { icon: icons.sparkles, color: 'text-tis-pink', bgColor: 'bg-tis-pink-100', label: 'Insight de Lealtad' },
  follow_up_opportunity: { icon: icons.arrowRight, color: 'text-indigo-500', bgColor: 'bg-indigo-50', label: 'Oportunidad de Seguimiento' },
  upsell_opportunity: { icon: icons.trending, color: 'text-tis-green', bgColor: 'bg-tis-green-100', label: 'Venta Cruzada' },
  response_improvement: { icon: icons.lightbulb, color: 'text-tis-coral', bgColor: 'bg-tis-coral-100', label: 'Mejora de Respuesta' },
  booking_pattern: { icon: icons.clock, color: 'text-cyan-500', bgColor: 'bg-cyan-50', label: 'Patron de Reservas' },
  satisfaction_trend: { icon: icons.thumbsUp, color: 'text-tis-green', bgColor: 'bg-tis-green-100', label: 'Tendencia de Satisfaccion' },
};

// Pattern type config for AI Learning
const PATTERN_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  urgency_indicator: { icon: icons.fire, color: 'text-red-500', bgColor: 'bg-red-50' },
  complaint: { icon: icons.exclamation, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  objection: { icon: icons.alert, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  pain_point: { icon: icons.alert, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  satisfaction: { icon: icons.thumbsUp, color: 'text-tis-green', bgColor: 'bg-tis-green-100' },
  service_request: { icon: icons.tag, color: 'text-tis-purple', bgColor: 'bg-tis-purple/10' },
  scheduling_preference: { icon: icons.clock, color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
  pricing_inquiry: { icon: icons.dollar, color: 'text-tis-coral', bgColor: 'bg-tis-coral-100' },
};

// Vocabulary category config
const VOCABULARY_CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  service: { label: 'Servicio', color: 'bg-tis-purple/10 text-tis-purple' },
  procedure: { label: 'Procedimiento', color: 'bg-cyan-50 text-cyan-600' },
  symptom: { label: 'Sintoma', color: 'bg-rose-50 text-rose-600' },
  staff: { label: 'Personal', color: 'bg-indigo-50 text-indigo-600' },
  time: { label: 'Tiempo', color: 'bg-amber-50 text-amber-600' },
  price: { label: 'Precio', color: 'bg-tis-green-100 text-tis-green' },
  informal: { label: 'Informal', color: 'bg-slate-100 text-slate-600' },
  brand: { label: 'Marca', color: 'bg-tis-coral-100 text-tis-coral' },
  other: { label: 'Otro', color: 'bg-slate-100 text-slate-500' },
};

// ======================
// INSIGHT CARD COMPONENT
// ======================

function InsightCard({
  insight,
  onMarkSeen,
  onDismiss,
  onActedUpon,
}: {
  insight: BusinessInsight;
  onMarkSeen: (id: string) => void;
  onDismiss: (id: string) => void;
  onActedUpon: (id: string) => void;
}) {
  const config = INSIGHT_TYPE_CONFIG[insight.insight_type] || {
    icon: icons.lightbulb,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100',
    label: 'Insight',
  };

  const isNew = !insight.metadata?.seen_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-lg transition-all duration-200 ${
        isNew ? 'ring-2 ring-tis-coral/20' : ''
      }`}
      onMouseEnter={() => isNew && onMarkSeen(insight.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${config.bgColor} ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">
              {config.label}
            </span>
            {isNew && (
              <span className="ml-2 px-2 py-0.5 bg-tis-coral-100 text-tis-coral text-xs font-medium rounded-full">
                Nuevo
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-tis-green" />
          <span className="text-xs text-slate-500">
            {Math.round(insight.confidence_score * 100)}% confianza
          </span>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2">
        {insight.title}
      </h3>
      <p className="text-slate-600 text-sm mb-4 leading-relaxed">
        {insight.description}
      </p>

      {/* Evidence */}
      {insight.evidence && insight.evidence.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Evidencia
          </p>
          <ul className="space-y-1.5">
            {insight.evidence.slice(0, 3).map((item, idx) => (
              <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                <span className="text-tis-coral mt-0.5 flex-shrink-0">{icons.chevronRight}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-gradient-to-r from-tis-coral-100/50 to-orange-50 rounded-xl p-4 mb-4">
        <p className="text-xs font-semibold text-tis-coral uppercase tracking-wide mb-1">
          Recomendacion
        </p>
        <p className="text-sm text-slate-700">
          {insight.recommendation}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          Basado en {insight.data_points.toLocaleString()} conversaciones
        </span>
        <div className="flex items-center gap-2">
          {!insight.was_acted_upon ? (
            <button
              onClick={() => onActedUpon(insight.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-tis-green hover:bg-tis-green-100 rounded-lg transition-colors"
            >
              {icons.check}
              <span>Ya lo hice</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-tis-green">
              {icons.check}
              <span>Completado</span>
            </span>
          )}
          <button
            onClick={() => onDismiss(insight.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {icons.x}
            <span>Descartar</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ======================
// AI LEARNING SECTION COMPONENT
// ======================

function AILearningSection({
  learningData,
  loading,
}: {
  learningData: AILearningResponse | null;
  loading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'patterns' | 'vocabulary'>('patterns');

  if (loading) {
    return (
      <Card variant="bordered" className="mt-8">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-tis-purple border-t-transparent rounded-full animate-spin mr-3" />
            <span className="text-slate-600">Cargando datos de aprendizaje...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!learningData || learningData.status === 'blocked' || learningData.status === 'not_applicable') {
    return null;
  }

  if (!learningData.stats || (learningData.stats.total_patterns === 0 && learningData.stats.total_vocabulary === 0)) {
    return (
      <Card variant="bordered" className="mt-8">
        <CardHeader
          title="Aprendizaje Automatico"
          subtitle="La IA aprende de las conversaciones con tus clientes"
        />
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-tis-purple/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-tis-purple w-8 h-8">{icons.brain}</span>
            </div>
            <p className="text-slate-600 mb-2">
              Aun no hay suficientes datos de aprendizaje
            </p>
            <p className="text-sm text-slate-500">
              El sistema aprendera automaticamente conforme recibas mas conversaciones
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highPriorityPatterns = learningData.patterns.filter(p => p.is_high_priority);
  const regularPatterns = learningData.patterns.filter(p => !p.is_high_priority);

  return (
    <div className="mt-8 space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-tis-purple">{icons.brain}</span>
            Aprendizaje Automatico
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Patrones y vocabulario detectados en las conversaciones de tus clientes
          </p>
        </div>
        {learningData.stats.last_learning_run && (
          <span className="text-xs text-slate-400">
            Ultimo analisis: {new Date(learningData.stats.last_learning_run).toLocaleDateString('es-MX')}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-tis-purple">{icons.chat}</span>
            <span className="text-xs font-medium text-slate-500">Patrones</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{learningData.stats.total_patterns}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-500">{icons.fire}</span>
            <span className="text-xs font-medium text-slate-500">Alta Prioridad</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{learningData.stats.high_priority_patterns}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-tis-green">{icons.book}</span>
            <span className="text-xs font-medium text-slate-500">Vocabulario</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{learningData.stats.total_vocabulary}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-tis-coral">{icons.tag}</span>
            <span className="text-xs font-medium text-slate-500">Tipos</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {Object.keys(learningData.stats.patterns_by_type).length}
          </p>
        </div>
      </div>

      {/* High Priority Patterns Alert */}
      {highPriorityPatterns.length > 0 && (
        <Card variant="bordered" className="border-amber-200 bg-amber-50/50">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-amber-700">
                {icons.fire}
                Patrones de Alta Prioridad ({highPriorityPatterns.length})
              </span>
            }
            subtitle="Urgencias, quejas y objeciones detectadas que requieren atencion"
          />
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {highPriorityPatterns.slice(0, 6).map((pattern) => {
                const config = PATTERN_TYPE_CONFIG[pattern.pattern_type] || {
                  icon: icons.alert,
                  color: 'text-slate-500',
                  bgColor: 'bg-slate-100',
                };
                return (
                  <div
                    key={pattern.id}
                    className="bg-white rounded-lg p-3 border border-amber-200"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg ${config.bgColor} ${config.color} flex-shrink-0`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {pattern.pattern_value}
                        </p>
                        <p className="text-xs text-slate-500">
                          {pattern.pattern_type_label} - {pattern.occurrence_count}x
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {highPriorityPatterns.length > 6 && (
              <p className="text-sm text-amber-700 mt-3 text-center">
                +{highPriorityPatterns.length - 6} patrones mas detectados
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('patterns')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'patterns'
              ? 'border-tis-purple text-tis-purple'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Patrones Detectados
        </button>
        <button
          onClick={() => setActiveTab('vocabulary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vocabulary'
              ? 'border-tis-purple text-tis-purple'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Vocabulario Aprendido
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'patterns' && (
          <motion.div
            key="patterns"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card variant="bordered">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {regularPatterns.slice(0, 15).map((pattern) => {
                    const config = PATTERN_TYPE_CONFIG[pattern.pattern_type] || {
                      icon: icons.tag,
                      color: 'text-slate-500',
                      bgColor: 'bg-slate-100',
                    };
                    return (
                      <div
                        key={pattern.id}
                        className="p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                              {config.icon}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                {pattern.pattern_value}
                              </p>
                              <p className="text-sm text-slate-500">
                                {pattern.pattern_type_label}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-slate-900">
                              {pattern.occurrence_count}x
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(pattern.last_occurrence).toLocaleDateString('es-MX')}
                            </p>
                          </div>
                        </div>
                        {pattern.context_examples && pattern.context_examples.length > 0 && (
                          <div className="mt-2 pl-11">
                            <p className="text-xs text-slate-400 italic">
                              &quot;{pattern.context_examples[0]}&quot;
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {regularPatterns.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No hay patrones regulares detectados aun
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'vocabulary' && (
          <motion.div
            key="vocabulary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card variant="bordered">
              <CardContent>
                {learningData.vocabulary.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {learningData.vocabulary.map((vocab) => {
                      const catConfig = VOCABULARY_CATEGORY_CONFIG[vocab.category] ||
                        VOCABULARY_CATEGORY_CONFIG.other;
                      return (
                        <div
                          key={vocab.id}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium ${catConfig.color} flex items-center gap-2`}
                          title={vocab.meaning || vocab.term}
                        >
                          <span>{vocab.term}</span>
                          <span className="text-xs opacity-70">
                            {vocab.usage_count}x
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    No hay vocabulario aprendido aun
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======================
// ONBOARDING STATE
// ======================

function OnboardingState({ progress }: { progress: { current: number; required: number; percentage: number } }) {
  const checklistItems = [
    { id: 1, label: 'Conectar al menos un canal (WhatsApp, Instagram, etc.)', done: true },
    { id: 2, label: 'Configurar tu AI Agent con informacion del negocio', done: true },
    { id: 3, label: `Recibir ${progress.required} conversaciones`, done: progress.current >= progress.required },
    { id: 4, label: 'Los insights se generaran automaticamente', done: false },
  ];

  return (
    <PageWrapper
      title="Business IA"
      subtitle="Tu asistente de inteligencia de negocios"
    >
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-gradient-coral rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-coral">
            <span className="text-white w-10 h-10">{icons.sparkles}</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Preparando Business IA
          </h2>
          <p className="text-slate-600 mb-8">
            Tu asistente de inteligencia de negocios se esta preparando.
            Necesitamos mas datos para generar insights precisos.
          </p>

          {/* Progress Bar */}
          <Card variant="bordered" className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Progreso
                </span>
                <span className="text-sm font-semibold text-tis-coral">
                  {progress.current} / {progress.required} conversaciones
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-gradient-coral rounded-full"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Faltan {progress.required - progress.current} conversaciones para activar Business IA
              </p>
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card variant="bordered">
            <CardHeader title="Lista de preparacion" />
            <CardContent>
              <ul className="space-y-3">
                {checklistItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.done
                        ? 'bg-tis-green-100 text-tis-green'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {item.done ? (
                        icons.check
                      ) : (
                        <span className="text-xs font-semibold">{item.id}</span>
                      )}
                    </div>
                    <span className={`text-sm text-left ${
                      item.done ? 'text-slate-900' : 'text-slate-500'
                    }`}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}

// ======================
// BLOCKED STATE
// ======================

function BlockedState() {
  return (
    <PageWrapper
      title="Business IA"
      subtitle="Inteligencia de negocios con IA"
    >
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
            <span className="text-slate-400 w-10 h-10">{icons.sparkles}</span>
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-lg border border-slate-100">
              <span className="text-slate-500 w-5 h-5">{icons.lock}</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Business IA
          </h2>
          <p className="text-slate-600 mb-6">
            Obten insights automaticos sobre tu negocio con inteligencia artificial.
            Disponible en planes Essentials y superiores.
          </p>

          {/* Features List */}
          <Card variant="bordered" className="mb-6 text-left">
            <CardHeader title="Con Business IA podras:" />
            <CardContent>
              <ul className="space-y-3">
                {[
                  'Identificar tus servicios mas solicitados',
                  'Conocer las objeciones mas comunes de tus clientes',
                  'Descubrir los mejores horarios para tu negocio',
                  'Mejorar tu tasa de conversion de leads',
                  'Optimizar tu programa de lealtad',
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="text-tis-green">{icons.check}</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Link href="/dashboard/settings/subscription">
            <Button className="bg-gradient-coral hover:opacity-90 text-white shadow-coral">
              Actualizar Plan
              <span className="ml-2">{icons.arrowRight}</span>
            </Button>
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}

// ======================
// MAIN PAGE
// ======================

export default function BusinessIAPage() {
  const { session } = useAuth();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [learningData, setLearningData] = useState<AILearningResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [learningLoading, setLearningLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.access_token;

  const fetchInsights = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/business-insights', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar insights');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchLearningData = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLearningLoading(true);
      const response = await fetch('/api/ai-learning', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setLearningData(result);
      }
    } catch (err) {
      console.error('Error fetching AI learning data:', err);
    } finally {
      setLearningLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchInsights();
    fetchLearningData();
  }, [fetchInsights, fetchLearningData]);

  const handleAction = async (insightId: string, action: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch('/api/business-insights', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ insight_id: insightId, action }),
      });

      if (response.ok) {
        fetchInsights();
      }
    } catch (err) {
      console.error('Error updating insight:', err);
    }
  };

  const handleRefresh = () => {
    fetchInsights();
    fetchLearningData();
  };

  // Handle unauthenticated state
  if (!accessToken && !loading) {
    return (
      <PageWrapper title="Business IA" subtitle="Inteligencia de negocios">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-amber-500">{icons.alert}</span>
            </div>
            <p className="text-slate-900 font-semibold mb-2">Sesion no encontrada</p>
            <p className="text-slate-600 text-sm">Inicia sesion para acceder a Business IA</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (loading) {
    return (
      <PageWrapper title="Business IA" subtitle="Cargando...">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-tis-coral border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Cargando insights...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper title="Business IA" subtitle="Error">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500">{icons.alert}</span>
            </div>
            <p className="text-slate-900 font-semibold mb-2">Error al cargar</p>
            <p className="text-slate-600 text-sm mb-4">{error}</p>
            <Button onClick={fetchInsights} variant="outline">
              Reintentar
            </Button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Blocked state
  if (data?.status === 'blocked') {
    return <BlockedState />;
  }

  // Onboarding state
  if (data?.status === 'onboarding' && data.progress) {
    return <OnboardingState progress={data.progress} />;
  }

  // Active state
  return (
    <PageWrapper
      title="Business IA"
      subtitle="Insights automaticos para hacer crecer tu negocio"
      actions={
        <Button
          variant="ghost"
          leftIcon={icons.refresh}
          onClick={handleRefresh}
        >
          Actualizar
        </Button>
      }
    >
      {/* Stats Grid */}
      <StatsGrid columns={3}>
        <StatCard
          title="Insights Activos"
          value={data?.data.length || 0}
          icon={icons.lightbulb}
        />
        <StatCard
          title="Sin Revisar"
          value={data?.unseen_count || 0}
          icon={icons.eye}
        />
        <StatCard
          title="Completados"
          value={data?.data.filter(i => i.was_acted_upon).length || 0}
          icon={icons.checkCircle}
        />
      </StatsGrid>

      {/* Insights Grid */}
      <div className="mt-6">
        {data?.data && data.data.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {data.data.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onMarkSeen={(id) => handleAction(id, 'mark_seen')}
                  onDismiss={(id) => handleAction(id, 'dismiss')}
                  onActedUpon={(id) => handleAction(id, 'acted_upon')}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card variant="bordered">
            <CardContent className="py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-slate-400 w-8 h-8">{icons.sparkles}</span>
                </div>
                <p className="text-slate-600 mb-2">
                  No hay insights disponibles en este momento
                </p>
                <p className="text-sm text-slate-500">
                  Los insights se generan automaticamente cada 3 dias
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* AI Learning Section */}
      <AILearningSection learningData={learningData} loading={learningLoading} />
    </PageWrapper>
  );
}
