'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Agent Page
// Dashboard de configuración del AI Agent por Voz
// =====================================================

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Mic,
  Settings,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Play,
  Pause,
  Volume2,
  PhoneCall,
  PhoneOff,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  MessageSquare,
  Bot,
  Sparkles,
  Headphones,
  Globe,
  Shield,
  Zap,
  History,
} from 'lucide-react';
import Link from 'next/link';
import type {
  VoiceAgentConfig,
  VoicePhoneNumber,
  VoiceCall,
  VoiceUsageSummary,
  AvailableVoice,
  AreaCode,
  VoicePersonality,
} from '@/src/features/voice-agent/types';
import {
  AVAILABLE_VOICES,
  MEXICO_AREA_CODES,
} from '@/src/features/voice-agent/types';
import { TalkToAssistant } from '@/src/features/voice-agent/components';

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

const PERSONALITY_CONFIG: Record<VoicePersonality, { label: string; description: string; emoji: string }> = {
  professional: {
    label: 'Profesional',
    description: 'Tono serio y formal, ideal para consultorios médicos',
    emoji: '👔',
  },
  professional_friendly: {
    label: 'Profesional Amigable',
    description: 'Balance entre profesionalismo y calidez',
    emoji: '😊',
  },
  casual: {
    label: 'Casual',
    description: 'Tono relajado y conversacional',
    emoji: '🗣️',
  },
  formal: {
    label: 'Formal',
    description: 'Máxima formalidad y respeto',
    emoji: '🎩',
  },
};

// ======================
// COMPONENTS
// ======================

function BlockedState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
          <Phone className="w-10 h-10 text-gray-400" />
          <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-1 shadow-lg">
            <Lock className="w-5 h-5 text-gray-500" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          AI Agent Voz
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Asistente telefónico con inteligencia artificial. Responde llamadas, agenda citas y atiende a tus clientes 24/7.
          Disponible en el plan Growth.
        </p>

        {/* Blurred Preview */}
        <div className="relative mb-8 overflow-hidden rounded-2xl">
          <div className="blur-sm opacity-50 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg" />
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
            Con AI Agent Voz podrás:
          </h3>
          <ul className="space-y-3">
            {[
              'Responder llamadas automáticamente 24/7',
              'Agendar citas directamente en tu calendario',
              'Responder preguntas frecuentes sobre tu negocio',
              'Escalar llamadas a tu equipo cuando sea necesario',
              'Obtener transcripciones y análisis de cada llamada',
              'Número telefónico local con LADA mexicana',
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
          Actualizar a Growth
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

function VoiceSelector({
  selectedVoiceId,
  onSelect,
}: {
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
}) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const playPreview = (voice: AvailableVoice) => {
    // TODO: Implementar reproducción de preview cuando tengamos URLs
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
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                voice.gender === 'male'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-pink-100 text-pink-600'
              }`}>
                {voice.gender === 'male' ? '👨' : '👩'}
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {voice.name}
                </span>
                {voice.is_default && (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
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
                <Pause className="w-4 h-4 text-blue-500" />
              ) : (
                <Play className="w-4 h-4 text-gray-500" />
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
            <Phone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Números Telefónicos
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestiona los números de tu asistente
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAreaCodes(!showAreaCodes)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar Número
        </button>
      </div>

      {/* Lista de números existentes */}
      {phoneNumbers.length > 0 ? (
        <div className="space-y-3 mb-6">
          {phoneNumbers.map((number) => (
            <div
              key={number.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  number.status === 'active'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-mono font-medium text-gray-900 dark:text-white">
                    {number.phone_number_display || number.phone_number}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>LADA {number.area_code}</span>
                    <span>•</span>
                    <span className={`capitalize ${
                      number.status === 'active' ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {number.status === 'active' ? 'Activo' : number.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="text-gray-500">{number.total_calls} llamadas</p>
                  <p className="text-gray-400">{number.total_minutes} min</p>
                </div>
                <button
                  onClick={() => onReleaseNumber(number.id)}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Liberar número"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 mb-6">
          <Phone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No tienes números telefónicos configurados
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
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
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Selecciona una LADA para tu número:
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {MEXICO_AREA_CODES.map((area) => (
                  <button
                    key={area.code}
                    onClick={() => setSelectedAreaCode(area.code)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      selectedAreaCode === area.code
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
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
                  <button
                    onClick={() => {
                      setShowAreaCodes(false);
                      setSelectedAreaCode(null);
                    }}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      onRequestNumber(selectedAreaCode);
                      setShowAreaCodes(false);
                      setSelectedAreaCode(null);
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Solicitando...' : `Solicitar número (${selectedAreaCode})`}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CallHistoryTable({ calls }: { calls: VoiceCall[] }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
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
      <div className="text-center py-12">
        <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">
          No hay llamadas recientes
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500">
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
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Fecha
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Teléfono
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Duración
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Estado
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
              Resultado
            </th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
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
              <td className="py-3 px-4">
                <p className="text-sm text-gray-900 dark:text-white">
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
              <td className="py-3 px-4">
                <p className="font-mono text-sm text-gray-900 dark:text-white">
                  {call.caller_phone}
                </p>
              </td>
              <td className="py-3 px-4">
                <p className="text-sm text-gray-900 dark:text-white">
                  {formatDuration(call.duration_seconds)}
                </p>
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                  {call.status === 'completed' ? 'Completada' : call.status}
                </span>
              </td>
              <td className="py-3 px-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {getOutcomeLabel(call.outcome)}
                </p>
              </td>
              <td className="py-3 px-4 text-right">
                <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TalkToAssistantButton({
  config,
  onStartTest,
  disabled,
}: {
  config: VoiceAgentConfig | null;
  onStartTest: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onStartTest}
      disabled={disabled || !config}
      className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-medium transition-all ${
        disabled || !config
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
      }`}
    >
      <Headphones className="w-5 h-5" />
      <span>Hablar con Asistente</span>
      <span className="px-2 py-0.5 bg-white/20 rounded text-xs">PRUEBA</span>
    </button>
  );
}

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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Configuración del Asistente
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Personaliza cómo se presenta tu asistente
              </p>
            </div>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Nombre del asistente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre del Asistente
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.assistant_name}
                onChange={(e) => setFormData({ ...formData, assistant_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Ana, Carlos, Asistente"
              />
            ) : (
              <p className="text-gray-900 dark:text-white font-medium">
                {config.assistant_name}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Este nombre se usará en el saludo inicial
            </p>
          </div>

          {/* Personalidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-2xl mb-2 block">{val.emoji}</span>
                    <p className="font-medium text-gray-900 dark:text-white">{val.label}</p>
                    <p className="text-xs text-gray-500">{val.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PERSONALITY_CONFIG[config.assistant_personality].emoji}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mensaje de Bienvenida
            </label>
            {isEditing ? (
              <textarea
                value={formData.first_message}
                onChange={(e) => setFormData({ ...formData, first_message: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: Hola, soy Ana de Clínica Dental Sonrisa. ¿En qué puedo ayudarte?"
              />
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-gray-700 dark:text-gray-300 italic">
                  &quot;{config.first_message}&quot;
                </p>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Lo primero que dirá tu asistente al contestar
            </p>
          </div>
        </div>
      </div>

      {/* Voz */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <Volume2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Voz del Asistente
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selecciona cómo sonará tu asistente
            </p>
          </div>
        </div>

        {isEditing ? (
          <VoiceSelector
            selectedVoiceId={formData.voice_id}
            onSelect={(voiceId) => setFormData({ ...formData, voice_id: voiceId })}
          />
        ) : (
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            {(() => {
              const voice = AVAILABLE_VOICES.find((v) => v.id === config.voice_id);
              return voice ? (
                <>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    voice.gender === 'male'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-pink-100 text-pink-600'
                  }`}>
                    {voice.gender === 'male' ? '👨' : '👩'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{voice.name}</p>
                    <p className="text-sm text-gray-500">
                      Acento {voice.accent} • {voice.gender === 'male' ? 'Masculino' : 'Femenino'}
                    </p>
                  </div>
                  <button className="ml-auto p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <Play className="w-5 h-5 text-gray-500" />
                  </button>
                </>
              ) : (
                <p className="text-gray-500">Voz no seleccionada</p>
              );
            })()}
          </div>
        )}
      </div>

      {/* Opciones avanzadas */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Settings className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Opciones Avanzadas
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configuración adicional del comportamiento
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Frases de relleno */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.use_filler_phrases ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.use_filler_phrases ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            ) : (
              <span className={`px-3 py-1 rounded-full text-sm ${
                config.use_filler_phrases
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {config.use_filler_phrases ? 'Activado' : 'Desactivado'}
              </span>
            )}
          </div>

          {/* Grabación */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.recording_enabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.recording_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            ) : (
              <span className={`px-3 py-1 rounded-full text-sm ${
                config.recording_enabled
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {config.recording_enabled ? 'Activado' : 'Desactivado'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// MAIN PAGE
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

  const handleStartTest = () => {
    setShowTalkToAssistant(true);
  };

  // Handle unauthenticated state
  if (!accessToken && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-white font-medium mb-2">Sesión no encontrada</p>
          <p className="text-gray-600 dark:text-gray-300">Inicia sesión para acceder a AI Agent Voz</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Cargando Voice Agent...</p>
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
            onClick={fetchVoiceAgent}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Blocked state (not Growth plan)
  if (data?.status === 'blocked') {
    return (
      <div className="p-6">
        <BlockedState />
      </div>
    );
  }

  const config = data?.data?.config;
  const phoneNumbers = data?.data?.phone_numbers || [];
  const usageSummary = data?.data?.usage_summary;
  const recentCalls = data?.data?.recent_calls || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Phone className="w-7 h-7 text-blue-600" />
            AI Agent Voz
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Asistente telefónico inteligente para tu negocio
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchVoiceAgent}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
          {config && (
            <button
              onClick={handleToggleVoice}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all ${
                config.voice_enabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {config.voice_enabled ? (
                <>
                  <PhoneOff className="w-4 h-4" />
                  Desactivar
                </>
              ) : (
                <>
                  <PhoneCall className="w-4 h-4" />
                  Activar
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {config && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-4 ${
          config.voice_enabled
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        }`}>
          <div className={`p-3 rounded-xl ${
            config.voice_enabled
              ? 'bg-emerald-100 dark:bg-emerald-900/40'
              : 'bg-amber-100 dark:bg-amber-900/40'
          }`}>
            {config.voice_enabled ? (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-medium ${
              config.voice_enabled
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-amber-800 dark:text-amber-200'
            }`}>
              {config.voice_enabled
                ? 'Tu asistente de voz está activo'
                : 'Tu asistente de voz está desactivado'}
            </p>
            <p className={`text-sm ${
              config.voice_enabled
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}>
              {config.voice_enabled
                ? 'Recibiendo llamadas en los números configurados'
                : 'Actívalo para comenzar a recibir llamadas'}
            </p>
          </div>
          {phoneNumbers.length > 0 && config.voice_enabled && (
            <div className="text-right">
              <p className="font-mono font-medium text-emerald-700 dark:text-emerald-300">
                {phoneNumbers[0].phone_number_display || phoneNumbers[0].phone_number}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Número principal
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {usageSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <PhoneCall className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Llamadas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {usageSummary.total_calls}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Minutos</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {usageSummary.total_minutes}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Citas Agendadas</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(usageSummary.appointment_booking_rate * 100)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Costo</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${usageSummary.total_cost_usd.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Talk to Assistant Button */}
      <div className="mb-8">
        <TalkToAssistantButton
          config={config || null}
          onStartTest={handleStartTest}
          disabled={saving || !config}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'config'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuración
          </div>
          {activeTab === 'config' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'calls'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial de Llamadas
            {recentCalls.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {recentCalls.length}
              </span>
            )}
          </div>
          {activeTab === 'calls' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && config && (
        <div className="space-y-6">
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
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <CallHistoryTable calls={recentCalls} />
        </div>
      )}

      {/* Talk to Assistant Modal */}
      {config && accessToken && (
        <TalkToAssistant
          isOpen={showTalkToAssistant}
          onClose={() => setShowTalkToAssistant(false)}
          config={config}
          accessToken={accessToken}
        />
      )}
    </div>
  );
}
