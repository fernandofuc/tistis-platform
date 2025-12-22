'use client';

// =====================================================
// TIS TIS PLATFORM - Business IA Page
// Dashboard de insights de negocio generados por IA
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Lock,
  ArrowRight,
  RefreshCw,
  Eye,
  ThumbsUp,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

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

// ======================
// INSIGHT TYPE CONFIG
// ======================

const INSIGHT_TYPE_CONFIG: Record<string, { icon: typeof Lightbulb; color: string; label: string }> = {
  popular_service: { icon: TrendingUp, color: 'text-emerald-500', label: 'Servicio Popular' },
  peak_hours: { icon: Clock, color: 'text-blue-500', label: 'Horas Pico' },
  common_objection: { icon: AlertCircle, color: 'text-amber-500', label: 'Objeción Común' },
  pricing_sensitivity: { icon: DollarSign, color: 'text-red-500', label: 'Sensibilidad a Precios' },
  lead_conversion: { icon: Users, color: 'text-purple-500', label: 'Conversión de Leads' },
  loyalty_insight: { icon: Sparkles, color: 'text-pink-500', label: 'Insight de Lealtad' },
  follow_up_opportunity: { icon: ArrowRight, color: 'text-indigo-500', label: 'Oportunidad de Seguimiento' },
  upsell_opportunity: { icon: TrendingUp, color: 'text-green-500', label: 'Venta Cruzada' },
  response_improvement: { icon: Lightbulb, color: 'text-orange-500', label: 'Mejora de Respuesta' },
  booking_pattern: { icon: Clock, color: 'text-cyan-500', label: 'Patrón de Reservas' },
  satisfaction_trend: { icon: ThumbsUp, color: 'text-emerald-500', label: 'Tendencia de Satisfacción' },
};

// ======================
// COMPONENTS
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
    icon: Lightbulb,
    color: 'text-gray-500',
    label: 'Insight',
  };
  const Icon = config.icon;

  const isNew = !insight.metadata?.seen_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all ${
        isNew ? 'ring-2 ring-blue-500/20' : ''
      }`}
      onMouseEnter={() => isNew && onMarkSeen(insight.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl bg-gray-50 dark:bg-gray-700 ${config.color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {config.label}
            </span>
            {isNew && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                Nuevo
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">
              {Math.round(insight.confidence_score * 100)}% confianza
            </span>
          </div>
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {insight.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
        {insight.description}
      </p>

      {/* Evidence */}
      {insight.evidence && insight.evidence.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Evidencia:
          </p>
          <ul className="space-y-1">
            {insight.evidence.slice(0, 3).map((item, idx) => (
              <li key={idx} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 mb-4">
        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
          Recomendación
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {insight.recommendation}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="text-xs text-gray-500">
          Basado en {insight.data_points.toLocaleString()} conversaciones
        </div>
        <div className="flex items-center gap-2">
          {!insight.was_acted_upon ? (
            <button
              onClick={() => onActedUpon(insight.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Ya lo hice
            </button>
          ) : (
            <span className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              Completado
            </span>
          )}
          <button
            onClick={() => onDismiss(insight.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Descartar
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function OnboardingState({ progress }: { progress: { current: number; required: number; percentage: number } }) {
  const checklistItems = [
    { id: 1, label: 'Conectar al menos un canal (WhatsApp, Instagram, etc.)', done: true },
    { id: 2, label: 'Configurar tu AI Agent con información del negocio', done: true },
    { id: 3, label: `Recibir ${progress.required} conversaciones`, done: progress.current >= progress.required },
    { id: 4, label: 'Los insights se generarán automáticamente', done: false },
  ];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Preparando Business IA
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Tu asistente de inteligencia de negocios se está preparando. Necesitamos más datos para generar insights precisos.
        </p>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progreso
            </span>
            <span className="text-sm font-medium text-blue-600">
              {progress.current} / {progress.required} conversaciones
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress.percentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Faltan {progress.required - progress.current} conversaciones para activar Business IA
          </p>
        </div>

        {/* Checklist */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Lista de preparación
          </h3>
          <ul className="space-y-3">
            {checklistItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  item.done
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                    : 'bg-gray-200 text-gray-400 dark:bg-gray-700'
                }`}>
                  {item.done ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-medium">{item.id}</span>
                  )}
                </div>
                <span className={`text-sm ${
                  item.done
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BlockedState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
          <Sparkles className="w-10 h-10 text-gray-400" />
          <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg">
            <Lock className="w-5 h-5 text-gray-500" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Business IA
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Obtén insights automáticos sobre tu negocio con inteligencia artificial. Disponible en planes Essentials y superiores.
        </p>

        {/* Blurred Preview */}
        <div className="relative mb-8 overflow-hidden rounded-2xl">
          <div className="blur-sm opacity-50 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-40" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-white/80 to-transparent dark:from-gray-900/80">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* Features List */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-6 text-left">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Con Business IA podrás:
          </h3>
          <ul className="space-y-3">
            {[
              'Identificar tus servicios más solicitados',
              'Conocer las objeciones más comunes de tus clientes',
              'Descubrir los mejores horarios para tu negocio',
              'Mejorar tu tasa de conversión de leads',
              'Optimizar tu programa de lealtad',
            ].map((feature, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          Actualizar a Essentials
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ======================
// MAIN PAGE
// ======================

export default function BusinessIAPage() {
  const { session } = useAuth();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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
        // Refresh insights after action
        fetchInsights();
      }
    } catch (err) {
      console.error('Error updating insight:', err);
    }
  };

  // Handle unauthenticated state
  if (!accessToken && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-white font-medium mb-2">Sesión no encontrada</p>
          <p className="text-gray-600 dark:text-gray-300">Inicia sesión para acceder a Business IA</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Cargando insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-white font-medium mb-2">Error al cargar</p>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={fetchInsights}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Blocked state (Starter plan)
  if (data?.status === 'blocked') {
    return (
      <div className="p-6">
        <BlockedState />
      </div>
    );
  }

  // Onboarding state (not enough data)
  if (data?.status === 'onboarding' && data.progress) {
    return (
      <div className="p-6">
        <OnboardingState progress={data.progress} />
      </div>
    );
  }

  // Active state with insights
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Business IA
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Insights automáticos para hacer crecer tu negocio
          </p>
        </div>
        <button
          onClick={fetchInsights}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Insights Activos
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {data?.data.length || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Sin Revisar
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {data?.unseen_count || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Completados
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {data?.data.filter(i => i.was_acted_upon).length || 0}
          </p>
        </div>
      </div>

      {/* Insights Grid */}
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
        <div className="text-center py-16">
          <Sparkles className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            No hay insights disponibles en este momento
          </p>
          <p className="text-sm text-gray-500">
            Los insights se generan automáticamente cada 3 días
          </p>
        </div>
      )}
    </div>
  );
}
