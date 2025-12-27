'use client';

// =====================================================
// TIS TIS PLATFORM - Voice Agent Page
// Dashboard de configuración del AI Agent por Voz
// Design System: TIS TIS Premium (Apple/ElevenLabs aesthetics)
// REDESIGN v2.0 - Cleaner, more professional layout
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
  ResponseSpeedPreset,
  VoiceQualityPreset,
} from '@/src/features/voice-agent/types';
import {
  AVAILABLE_VOICES,
  MEXICO_AREA_CODES,
} from '@/src/features/voice-agent/types';
import {
  TalkToAssistant,
  BusinessKnowledgeSection,
  GuidedInstructionsSection,
  AdvancedSettingsSection,
  EscalationSection,
  VoicePreviewCard,
  VoiceAgentSetupProgress,
  VoiceAgentWizard,
  CallDetailModal,
  // Centralized icons
  PhoneIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  MicIcon,
  VolumeIcon,
  LockIcon,
  CheckIcon,
  AlertIcon,
  RefreshIcon,
  ArrowRightIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  EditIcon,
  SaveIcon,
  BotIcon,
  HeadphonesIcon,
  HistoryIcon,
  ChevronRightIcon,
  MessageIcon,
  SparklesIcon,
  BookIcon,
} from '@/src/features/voice-agent/components';
import { useTenant } from '@/src/hooks/useTenant';

// ======================
// TYPES
// ======================

interface PhoneNumberLimit {
  current: number;
  max: number;
  canRequest: boolean;
  activeBranches: number;
}

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

type TabType = 'voice' | 'knowledge' | 'phones' | 'history';

// ======================
// BLOCKED STATE COMPONENT (Plan upgrade needed)
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
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Hero Card */}
        <div className="relative bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-tis-coral/5 via-transparent to-tis-pink/5" />

          <div className="relative p-8 lg:p-12">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Icon */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 bg-gradient-to-br from-tis-coral to-tis-pink rounded-3xl flex items-center justify-center shadow-xl shadow-tis-coral/25">
                  <PhoneCallIcon className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center border border-slate-100">
                  <LockIcon className="w-5 h-5 text-slate-400" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-3">
                  Asistente Telefónico con IA
                </h2>
                <p className="text-slate-600 leading-relaxed max-w-xl text-lg">
                  Tu asistente virtual que responde llamadas, agenda citas y atiende a tus clientes 24/7
                  con voz natural en español mexicano.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
                    <SparklesIcon className="w-4 h-4 text-tis-coral" />
                    <span className="text-sm text-slate-600">Disponible en</span>
                    <span className="px-3 py-1 bg-gradient-to-r from-tis-coral to-tis-pink text-white text-sm font-semibold rounded-lg">
                      Plan Growth
                    </span>
                  </div>
                  <Link
                    href="/dashboard/settings/subscription"
                    className="group inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all"
                  >
                    Actualizar Plan
                    <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: <PhoneCallIcon className="w-5 h-5" />, title: 'Respuesta 24/7', description: 'Atiende llamadas automáticamente a cualquier hora' },
            { icon: <ClockIcon className="w-5 h-5" />, title: 'Agenda Citas', description: 'Programa citas directamente en tu calendario' },
            { icon: <MessageIcon className="w-5 h-5" />, title: 'FAQ Automático', description: 'Responde preguntas frecuentes sobre tu negocio' },
            { icon: <ArrowRightIcon className="w-5 h-5" />, title: 'Escalamiento', description: 'Transfiere llamadas a tu equipo cuando sea necesario' },
            { icon: <MicIcon className="w-5 h-5" />, title: 'Transcripciones', description: 'Obtén texto y análisis de cada conversación' },
            { icon: <PhoneIcon className="w-5 h-5" />, title: 'LADA Mexicana', description: 'Número telefónico local de tu ciudad' },
          ].map((feature, idx) => (
            <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-600">{feature.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-0.5">{feature.title}</h3>
                  <p className="text-sm text-slate-500">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </PageWrapper>
  );
}

// ======================
// ASSISTANT HERO CARD - Compact header with status
// ======================

function AssistantHeroCard({
  config,
  phoneNumbers,
  usageSummary,
  onToggle,
  onTest,
  saving,
}: {
  config: VoiceAgentConfig;
  phoneNumbers: VoicePhoneNumber[];
  usageSummary?: VoiceUsageSummary;
  onToggle: () => void;
  onTest: () => void;
  saving: boolean;
}) {
  const selectedVoice = AVAILABLE_VOICES.find(v => v.id === config.voice_id);
  const primaryPhone = phoneNumbers.find(p => p.status === 'active');
  const hasUsage = usageSummary && usageSummary.total_calls > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Avatar & Info */}
          <div className="flex items-center gap-4 flex-1">
            {/* Avatar */}
            <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
              config.voice_enabled
                ? 'bg-gradient-to-br from-tis-coral to-tis-pink shadow-tis-coral/20'
                : 'bg-slate-200'
            }`}>
              <span className="text-2xl font-bold text-white">
                {config.assistant_name?.charAt(0) || 'A'}
              </span>
              {/* Status dot */}
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                config.voice_enabled ? 'bg-tis-green' : 'bg-slate-400'
              }`}>
                {config.voice_enabled ? (
                  <CheckIcon className="w-3 h-3 text-white" />
                ) : (
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </div>
            </div>

            {/* Name & Status */}
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">
                  {config.assistant_name || 'Asistente'}
                </h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  config.voice_enabled
                    ? 'bg-tis-green/10 text-tis-green'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {config.voice_enabled ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {selectedVoice ? `Voz: ${selectedVoice.name}` : 'Sin voz configurada'}
                {primaryPhone && (
                  <span className="ml-2 font-mono text-slate-600">
                    • {primaryPhone.phone_number_display || primaryPhone.phone_number}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Stats (only if has data) */}
          {hasUsage && (
            <div className="flex items-center gap-6 px-6 py-3 bg-slate-50 rounded-xl">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{usageSummary.total_calls}</p>
                <p className="text-xs text-slate-500">Llamadas</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{usageSummary.total_minutes}</p>
                <p className="text-xs text-slate-500">Minutos</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-bold text-tis-green">{usageSummary.appointment_booking_rate}%</p>
                <p className="text-xs text-slate-500">Citas</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={onTest}
              className="gap-2"
            >
              <HeadphonesIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Probar</span>
            </Button>
            <Button
              variant={config.voice_enabled ? 'danger' : 'primary'}
              size="sm"
              onClick={onToggle}
              disabled={saving}
              className="gap-2"
            >
              {config.voice_enabled ? (
                <>
                  <PhoneOffIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Desactivar</span>
                </>
              ) : (
                <>
                  <PhoneCallIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Activar</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================
// TAB BAR COMPONENT - Apple-style segmented control
// ======================

function TabBar({
  activeTab,
  onTabChange,
  phoneCount,
  callCount,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  phoneCount: number;
  callCount: number;
}) {
  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'voice', label: 'Voz y Personalidad', icon: <VolumeIcon className="w-4 h-4" /> },
    { id: 'knowledge', label: 'Conocimiento', icon: <BookIcon className="w-4 h-4" /> },
    { id: 'phones', label: 'Teléfonos', icon: <PhoneIcon className="w-4 h-4" />, badge: phoneCount },
    { id: 'history', label: 'Historial', icon: <HistoryIcon className="w-4 h-4" />, badge: callCount },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 font-medium rounded-lg transition-all flex items-center gap-2 text-sm ${
            activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.icon}
          <span className="hidden md:inline">{tab.label}</span>
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className={`px-1.5 py-0.5 text-xs font-bold rounded-full ${
              activeTab === tab.id
                ? 'bg-tis-coral/10 text-tis-coral'
                : 'bg-slate-200 text-slate-600'
            }`}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ======================
// VOICE & PERSONALITY TAB
// ======================

function VoicePersonalityTab({
  config,
  onSave,
  saving,
  accessToken,
}: {
  config: VoiceAgentConfig;
  onSave: (updates: Partial<VoiceAgentConfig>) => Promise<boolean>;
  saving: boolean;
  accessToken: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    assistant_name: config.assistant_name,
    first_message: config.first_message,
    voice_id: config.voice_id,
  });

  // Sync with config
  useEffect(() => {
    setFormData({
      assistant_name: config.assistant_name,
      first_message: config.first_message,
      voice_id: config.voice_id,
    });
  }, [config]);

  const handleSave = async () => {
    const success = await onSave(formData);
    if (success) setIsEditing(false);
  };

  const selectedVoice = AVAILABLE_VOICES.find(v => v.id === formData.voice_id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left Column: Voice Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Voz del Asistente</h3>
            <p className="text-sm text-slate-500">Selecciona cómo sonará tu asistente</p>
          </div>
        </div>

        <div className="space-y-3">
          {AVAILABLE_VOICES.map((voice) => (
            <VoicePreviewCard
              key={voice.id}
              voice={voice}
              isSelected={formData.voice_id === voice.id}
              onSelect={async () => {
                setFormData(prev => ({ ...prev, voice_id: voice.id }));
                await onSave({ voice_id: voice.id });
              }}
              accessToken={accessToken}
            />
          ))}
        </div>
      </div>

      {/* Right Column: Identity */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
                <BotIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Identidad</h3>
                <p className="text-xs text-slate-500">Nombre y saludo inicial</p>
              </div>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <EditIcon className="w-4 h-4" />
              </button>
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
                  Guardar
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre del Asistente
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.assistant_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, assistant_name: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all"
                  placeholder="Ej: Ana, Carlos, Asistente"
                />
              ) : (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-gradient-to-br from-tis-coral/20 to-tis-pink/20 rounded-xl flex items-center justify-center">
                    <span className="text-lg font-bold text-tis-coral">
                      {config.assistant_name?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-slate-900">
                    {config.assistant_name || 'Sin nombre'}
                  </span>
                </div>
              )}
            </div>

            {/* First Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mensaje de Bienvenida
              </label>
              {isEditing ? (
                <textarea
                  value={formData.first_message}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_message: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-all resize-none"
                  placeholder="Ej: Hola, soy Ana de Clínica Dental Sonrisa. ¿En qué puedo ayudarte?"
                />
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-slate-700 italic leading-relaxed">
                    &ldquo;{config.first_message || 'Sin mensaje configurado'}&rdquo;
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Lo primero que dirá tu asistente</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Voice Settings */}
        <AdvancedSettingsSection
          responseSpeed={getResponseSpeedPreset(config.wait_seconds || 0.6)}
          voiceQuality={getVoiceQualityPreset(config.voice_stability || 0.5)}
          onResponseSpeedChange={(preset, values) => {
            onSave({
              wait_seconds: values.wait_seconds,
              on_punctuation_seconds: values.on_punctuation_seconds,
              on_no_punctuation_seconds: values.on_no_punctuation_seconds,
            });
          }}
          onVoiceQualityChange={(preset, values) => {
            onSave({
              voice_stability: values.stability,
              voice_similarity_boost: values.similarity_boost,
            });
          }}
          saving={saving}
        />

        {/* Recording Toggle */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-tis-purple/10 flex items-center justify-center">
                <MicIcon className="w-5 h-5 text-tis-purple" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Grabación de Llamadas</p>
                <p className="text-sm text-slate-500">Guarda audio para revisión</p>
              </div>
            </div>
            <button
              onClick={() => onSave({ recording_enabled: !config.recording_enabled })}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                config.recording_enabled ? 'bg-tis-coral' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  config.recording_enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Escalation & Goodbye */}
        <EscalationSection
          escalationEnabled={config.escalation_enabled || false}
          escalationPhone={config.escalation_phone || ''}
          goodbyeMessage={config.goodbye_message || ''}
          onEscalationEnabledChange={(enabled) => onSave({ escalation_enabled: enabled })}
          onEscalationPhoneChange={(phone) => onSave({ escalation_phone: phone })}
          onGoodbyeMessageChange={(message) => onSave({ goodbye_message: message })}
          onSave={() => {}}
          saving={saving}
        />
      </div>
    </div>
  );
}

// Helper functions for presets
function getResponseSpeedPreset(waitSeconds: number): ResponseSpeedPreset {
  if (waitSeconds <= 0.5) return 'fast';
  if (waitSeconds <= 0.8) return 'balanced';
  return 'patient';
}

function getVoiceQualityPreset(stability: number): VoiceQualityPreset {
  if (stability >= 0.65) return 'consistent';
  if (stability >= 0.4) return 'natural';
  return 'expressive';
}

// ======================
// KNOWLEDGE TAB
// ======================

function KnowledgeTab({
  config,
  onSave,
  saving,
  accessToken,
  vertical,
}: {
  config: VoiceAgentConfig;
  onSave: (updates: Partial<VoiceAgentConfig>) => Promise<boolean>;
  saving: boolean;
  accessToken: string;
  vertical: 'dental' | 'restaurant' | 'medical' | 'general';
}) {
  const [customInstructions, setCustomInstructions] = useState(config.custom_instructions || '');

  useEffect(() => {
    setCustomInstructions(config.custom_instructions || '');
  }, [config.custom_instructions]);

  const handleSaveInstructions = async (text: string): Promise<boolean> => {
    setCustomInstructions(text);
    return await onSave({ custom_instructions: text });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Business Knowledge */}
      <BusinessKnowledgeSection
        accessToken={accessToken}
        onRegeneratePrompt={() => {}}
      />

      {/* Custom Instructions */}
      <GuidedInstructionsSection
        value={customInstructions}
        vertical={vertical}
        onChange={setCustomInstructions}
        onSave={handleSaveInstructions}
        saving={saving}
      />
    </div>
  );
}

// ======================
// PHONE NUMBERS TAB
// ======================

interface BranchOption {
  id: string;
  name: string;
  city: string;
  is_headquarters: boolean;
}

function PhoneNumbersTab({
  phoneNumbers,
  branches,
  onRequestNumber,
  onReleaseNumber,
  loading,
  message,
  onClearMessage,
  phoneLimit,
}: {
  phoneNumbers: VoicePhoneNumber[];
  branches: BranchOption[];
  onRequestNumber: (areaCode: string, branchId?: string) => void;
  onReleaseNumber: (numberId: string) => void;
  loading: boolean;
  message?: { type: 'success' | 'error'; text: string } | null;
  onClearMessage?: () => void;
  phoneLimit?: PhoneNumberLimit | null;
}) {
  const [showAreaCodes, setShowAreaCodes] = useState(false);
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (message && onClearMessage) {
      const timer = setTimeout(onClearMessage, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, onClearMessage]);

  const handleRequestClick = () => {
    if (selectedAreaCode) {
      onRequestNumber(selectedAreaCode, selectedBranchId || undefined);
      setShowAreaCodes(false);
      setSelectedAreaCode(null);
      setSelectedBranchId(null);
    }
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return null;
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : null;
  };

  const getPhoneStatusDisplay = (status: string) => {
    switch (status) {
      case 'active': return { label: 'Activo', color: 'text-tis-green', bgColor: 'bg-tis-green/10' };
      case 'pending': return { label: 'En proceso', color: 'text-amber-600', bgColor: 'bg-amber-50' };
      case 'provisioning': return { label: 'Configurando', color: 'text-blue-600', bgColor: 'bg-blue-50' };
      case 'released': return { label: 'Liberado', color: 'text-slate-400', bgColor: 'bg-slate-100' };
      case 'suspended': return { label: 'Suspendido', color: 'text-red-600', bgColor: 'bg-red-50' };
      default: return { label: 'Pendiente', color: 'text-slate-500', bgColor: 'bg-slate-100' };
    }
  };

  const limitReached = phoneLimit ? !phoneLimit.canRequest : false;
  const limitMessage = phoneLimit
    ? `${phoneLimit.current} de ${phoneLimit.max} número${phoneLimit.max > 1 ? 's' : ''} (${phoneLimit.activeBranches} sucursal${phoneLimit.activeBranches > 1 ? 'es' : ''})`
    : null;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Números Telefónicos</h3>
          <p className="text-sm text-slate-500">
            {limitMessage ? (
              <>
                Límite: <span className={limitReached ? 'text-amber-600 font-medium' : 'text-slate-600'}>{limitMessage}</span>
              </>
            ) : (
              'Gestiona los números de tu asistente'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {limitReached && (
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg font-medium">
              Límite alcanzado
            </span>
          )}
          <Button
            onClick={() => setShowAreaCodes(!showAreaCodes)}
            className="gap-2"
            disabled={limitReached}
          >
            <PlusIcon className="w-4 h-4" />
            Agregar Número
          </Button>
        </div>
      </div>

      {/* Limit Warning */}
      {limitReached && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertIcon className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-amber-800">Has alcanzado el límite de números</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Solo puedes tener un número telefónico por cada sucursal activa.
              Para agregar más números, primero agrega más sucursales desde Configuración.
            </p>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-tis-green/10 border border-tis-green/20'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            message.type === 'success' ? 'bg-tis-green' : 'bg-red-500'
          }`}>
            {message.type === 'success' ? (
              <CheckIcon className="w-4 h-4 text-white" />
            ) : (
              <AlertIcon className="w-4 h-4 text-white" />
            )}
          </div>
          <p className={`flex-1 text-sm font-medium ${
            message.type === 'success' ? 'text-tis-green' : 'text-red-700'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Phone List */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {phoneNumbers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {phoneNumbers.map((number) => (
              <div
                key={number.id}
                className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    number.status === 'active' ? 'bg-slate-900' : 'bg-amber-100'
                  }`}>
                    <PhoneIcon className={`w-5 h-5 ${
                      number.status === 'active' ? 'text-white' : 'text-amber-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-slate-900">
                      {number.phone_number_display || number.phone_number}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">LADA {number.area_code}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getPhoneStatusDisplay(number.status).bgColor} ${getPhoneStatusDisplay(number.status).color}`}>
                        {getPhoneStatusDisplay(number.status).label}
                      </span>
                      {number.branch_id && getBranchName(number.branch_id) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                          {getBranchName(number.branch_id)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 text-center">
                    <div className="px-3">
                      <p className="text-sm font-bold text-slate-900">{number.total_calls}</p>
                      <p className="text-[10px] text-slate-400 uppercase">llamadas</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div className="px-3">
                      <p className="text-sm font-bold text-slate-900">{number.total_minutes}</p>
                      <p className="text-[10px] text-slate-400 uppercase">minutos</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onReleaseNumber(number.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PhoneIcon className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium mb-1">No tienes números telefónicos</p>
            <p className="text-slate-500 text-sm">Solicita un número para comenzar a recibir llamadas</p>
          </div>
        )}
      </div>

      {/* Area Code Selector */}
      <AnimatePresence>
        {showAreaCodes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-slate-900">Selecciona una LADA</h4>
                  <p className="text-xs text-slate-500">Elige el código de área para tu número</p>
                </div>
                <button
                  onClick={() => {
                    setShowAreaCodes(false);
                    setSelectedAreaCode(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto">
                {MEXICO_AREA_CODES.map((area) => (
                  <button
                    key={area.code}
                    onClick={() => setSelectedAreaCode(area.code)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedAreaCode === area.code
                        ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2'
                        : 'bg-slate-50 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className={`font-mono font-bold text-sm ${selectedAreaCode === area.code ? 'text-white' : 'text-slate-900'}`}>
                      {area.code}
                    </p>
                    <p className={`text-[10px] truncate ${selectedAreaCode === area.code ? 'text-slate-300' : 'text-slate-500'}`}>
                      {area.city}
                    </p>
                  </button>
                ))}
              </div>

              {/* Branch Selector */}
              {selectedAreaCode && branches.length > 1 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    Asignar a sucursal <span className="text-slate-400 font-normal">(opcional)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedBranchId(null)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        selectedBranchId === null
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <p className={`font-semibold text-sm ${selectedBranchId === null ? 'text-white' : 'text-slate-900'}`}>
                        Sin asignar
                      </p>
                      <p className={`text-[10px] ${selectedBranchId === null ? 'text-slate-300' : 'text-slate-500'}`}>
                        Número general
                      </p>
                    </button>
                    {branches.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() => setSelectedBranchId(branch.id)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          selectedBranchId === branch.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <p className={`font-semibold text-sm truncate ${selectedBranchId === branch.id ? 'text-white' : 'text-slate-900'}`}>
                          {branch.name}
                        </p>
                        <p className={`text-[10px] truncate ${selectedBranchId === branch.id ? 'text-blue-200' : 'text-slate-500'}`}>
                          {branch.city}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm */}
              {selectedAreaCode && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    LADA: <span className="font-mono font-semibold text-slate-900">{selectedAreaCode}</span>
                  </span>
                  <Button
                    onClick={handleRequestClick}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Solicitando...
                      </>
                    ) : (
                      <>
                        <ArrowRightIcon className="w-4 h-4" />
                        Confirmar
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======================
// CALL HISTORY TAB
// ======================

function CallHistoryTab({
  calls,
  onCallClick,
}: {
  calls: VoiceCall[];
  onCallClick?: (call: VoiceCall) => void;
}) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return { bg: 'bg-tis-green/10', text: 'text-tis-green', label: 'Completada' };
      case 'in_progress': return { bg: 'bg-tis-coral/10', text: 'text-tis-coral', label: 'En progreso' };
      case 'failed': return { bg: 'bg-red-100', text: 'text-red-700', label: 'Fallida' };
      case 'escalated': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Escalada' };
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
    }
  };

  const getOutcomeLabel = (outcome: string | null) => {
    const labels: Record<string, string> = {
      appointment_booked: 'Cita agendada',
      information_given: 'Información dada',
      escalated_human: 'Escalado',
      callback_requested: 'Callback',
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
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HistoryIcon className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-900 font-semibold text-lg mb-1">No hay llamadas recientes</p>
        <p className="text-slate-500 max-w-sm mx-auto">
          Las llamadas aparecerán aquí cuando tu asistente esté activo
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Teléfono</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Duración</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Estado</th>
              <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase">Resultado</th>
              <th className="text-right py-4 px-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {calls.map((call) => {
              const statusBadge = getStatusBadge(call.status);
              return (
                <tr
                  key={call.id}
                  onClick={() => onCallClick?.(call)}
                  className={`hover:bg-slate-50 transition-colors ${onCallClick ? 'cursor-pointer' : ''}`}
                >
                  <td className="py-4 px-6">
                    <p className="text-sm font-semibold text-slate-900">
                      {new Date(call.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(call.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-mono text-sm font-semibold text-slate-900">{call.caller_phone}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm font-semibold text-slate-900">{formatDuration(call.duration_seconds)}</p>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-slate-600">{getOutcomeLabel(call.outcome)}</p>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallClick?.(call);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================
// MAIN PAGE COMPONENT
// ======================

export default function AIAgentVozPage() {
  const { session } = useAuth();
  const { tenant, branches } = useTenant();
  const [data, setData] = useState<VoiceAgentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('voice');
  const [showTalkToAssistant, setShowTalkToAssistant] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [phoneRequestMessage, setPhoneRequestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [phoneLimit, setPhoneLimit] = useState<PhoneNumberLimit | null>(null);

  const accessToken = session?.access_token;
  const vertical = (tenant?.vertical || 'dental') as 'dental' | 'restaurant' | 'medical' | 'general';

  const fetchPhoneLimit = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('/api/voice-agent/phone-numbers', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.limit) {
          setPhoneLimit(result.limit);
        }
      }
    } catch (err) {
      console.error('[Voice Agent] Error fetching phone limit:', err);
    }
  }, [accessToken]);

  const fetchVoiceAgent = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/voice-agent', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar Voice Agent');
      }

      const result = await response.json();
      setData(result);

      // También obtenemos el límite de números
      fetchPhoneLimit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchPhoneLimit]);

  useEffect(() => {
    fetchVoiceAgent();
  }, [fetchVoiceAgent]);

  // Mostrar wizard automáticamente para usuarios nuevos
  useEffect(() => {
    const config = data?.data?.config;
    const isNewUser = config && !config.voice_id && !config.assistant_name;
    if (isNewUser && !showWizard) {
      setShowWizard(true);
    }
  }, [data, showWizard]);

  const handleSaveConfig = async (updates: Partial<VoiceAgentConfig>): Promise<boolean> => {
    if (!accessToken) return false;

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

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.config && data) {
          setData({
            ...data,
            data: { ...data.data!, config: result.config },
          });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[Voice Agent] Error saving config:', err);
      return false;
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
        body: JSON.stringify({ action: 'toggle', enabled: newEnabled }),
      });

      if (response.ok) fetchVoiceAgent();
    } catch (err) {
      console.error('Error toggling voice:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPhoneNumber = async (areaCode: string, branchId?: string) => {
    if (!accessToken) {
      setPhoneRequestMessage({ type: 'error', text: 'Sesión no válida. Recarga la página.' });
      return;
    }

    try {
      setSaving(true);
      setPhoneRequestMessage(null);

      const response = await fetch('/api/voice-agent/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          area_code: areaCode,
          ...(branchId && { branch_id: branchId }),
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setPhoneRequestMessage({
          type: 'success',
          text: `¡Solicitud enviada! Tu número con LADA ${areaCode} será provisionado pronto.`,
        });
        fetchVoiceAgent();
      } else {
        setPhoneRequestMessage({ type: 'error', text: result.error || 'Error al solicitar el número' });
      }
    } catch {
      setPhoneRequestMessage({ type: 'error', text: 'Error de conexión. Verifica tu internet.' });
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

      if (response.ok) fetchVoiceAgent();
    } catch (err) {
      console.error('Error releasing phone number:', err);
    } finally {
      setSaving(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <PageWrapper title="AI Agent Voz" subtitle="Cargando...">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-tis-coral border-t-transparent animate-spin" />
            </div>
            <p className="text-slate-500">Cargando...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Error state
  if (error) {
    return (
      <PageWrapper title="AI Agent Voz" subtitle="Error">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertIcon className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-slate-900 font-semibold mb-2">Error al cargar</p>
            <p className="text-slate-500 mb-4">{error}</p>
            <Button onClick={fetchVoiceAgent} className="gap-2">
              <RefreshIcon className="w-4 h-4" />
              Reintentar
            </Button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Unauthenticated state
  if (!accessToken) {
    return (
      <PageWrapper title="AI Agent Voz" subtitle="Sesión requerida">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertIcon className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-slate-900 font-semibold mb-2">Sesión no encontrada</p>
            <p className="text-slate-500">Inicia sesión para acceder a AI Agent Voz</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Blocked state (needs plan upgrade)
  if (data?.status === 'blocked') {
    return <BlockedState />;
  }

  const config = data?.data?.config;
  const phoneNumbers = data?.data?.phone_numbers || [];
  const usageSummary = data?.data?.usage_summary;
  const recentCalls = data?.data?.recent_calls || [];

  // Handler para solicitar número desde el wizard
  const handleWizardRequestPhone = async (areaCode: string): Promise<boolean> => {
    if (!accessToken) return false;

    try {
      const response = await fetch('/api/voice-agent/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ area_code: areaCode }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        fetchVoiceAgent();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  if (!config) {
    return (
      <PageWrapper title="AI Agent Voz" subtitle="Configurando...">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-tis-coral border-t-transparent animate-spin" />
            </div>
            <p className="text-slate-500">Configurando asistente...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="AI Agent Voz"
      subtitle="Asistente telefónico inteligente"
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchVoiceAgent}
          className="gap-2"
        >
          <RefreshIcon className="w-4 h-4" />
          Actualizar
        </Button>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Hero Card */}
        <AssistantHeroCard
          config={config}
          phoneNumbers={phoneNumbers}
          usageSummary={usageSummary}
          onToggle={handleToggleVoice}
          onTest={() => setShowTalkToAssistant(true)}
          saving={saving}
        />

        {/* Setup Progress - Solo mostrar si no está completamente configurado */}
        {(!config.voice_enabled || !phoneNumbers.some(p => p.status === 'active')) && (
          <VoiceAgentSetupProgress
            config={config}
            phoneNumbers={phoneNumbers}
            hasKnowledge={!!(config.custom_instructions || config.system_prompt)}
            variant="horizontal"
            onStepClick={(stepId) => {
              // Navegar al tab correspondiente
              if (stepId === 'voice') setActiveTab('voice');
              if (stepId === 'instructions' || stepId === 'knowledge') setActiveTab('knowledge');
              if (stepId === 'phone') setActiveTab('phones');
            }}
          />
        )}

        {/* Tab Bar */}
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          phoneCount={phoneNumbers.length}
          callCount={recentCalls.length}
        />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'voice' && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <VoicePersonalityTab
                config={config}
                onSave={handleSaveConfig}
                saving={saving}
                accessToken={accessToken}
              />
            </motion.div>
          )}

          {activeTab === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <KnowledgeTab
                config={config}
                onSave={handleSaveConfig}
                saving={saving}
                accessToken={accessToken}
                vertical={vertical}
              />
            </motion.div>
          )}

          {activeTab === 'phones' && (
            <motion.div
              key="phones"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PhoneNumbersTab
                phoneNumbers={phoneNumbers}
                branches={branches}
                onRequestNumber={handleRequestPhoneNumber}
                onReleaseNumber={handleReleasePhoneNumber}
                loading={saving}
                message={phoneRequestMessage}
                onClearMessage={() => setPhoneRequestMessage(null)}
                phoneLimit={phoneLimit}
              />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CallHistoryTab
                calls={recentCalls}
                onCallClick={(call) => setSelectedCall(call)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Talk to Assistant Modal */}
        <TalkToAssistant
          isOpen={showTalkToAssistant}
          onClose={() => setShowTalkToAssistant(false)}
          config={config}
          accessToken={accessToken}
        />

        {/* Setup Wizard for new users */}
        {showWizard && (
          <VoiceAgentWizard
            config={config}
            vertical={vertical}
            accessToken={accessToken}
            onSaveConfig={handleSaveConfig}
            onRequestPhoneNumber={handleWizardRequestPhone}
            onComplete={() => {
              setShowWizard(false);
              fetchVoiceAgent();
            }}
            onClose={() => setShowWizard(false)}
          />
        )}

        {/* Call Detail Modal */}
        {selectedCall && (
          <CallDetailModal
            call={selectedCall}
            isOpen={!!selectedCall}
            onClose={() => setSelectedCall(null)}
            accessToken={accessToken}
          />
        )}
      </motion.div>
    </PageWrapper>
  );
}
