// =====================================================
// TIS TIS PLATFORM - Channel AI Settings Component
// Configure AI personality and delays per channel account
// Premium Apple/TIS TIS design
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/src/shared/utils';
import { supabase } from '@/src/shared/lib/supabase';
import {
  CHANNEL_METADATA,
  PERSONALITY_METADATA,
  DELAY_PRESETS,
  type ChannelConnection,
  type ChannelType,
  type AIPersonality,
} from '../types/channels.types';
import { formatDelay } from '../services/channels.service';

// ======================
// ICONS
// ======================

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function ChannelIcon({ channel, className }: { channel: ChannelType; className?: string }) {
  const icons = {
    whatsapp: WhatsAppIcon,
    instagram: InstagramIcon,
    facebook: FacebookIcon,
    tiktok: TikTokIcon,
  };
  const Icon = icons[channel];
  return <Icon className={className} />;
}

// ======================
// PERSONALITY CARD
// ======================

interface PersonalityCardProps {
  personality: AIPersonality;
  selected: boolean;
  onSelect: () => void;
}

function PersonalityCard({ personality, selected, onSelect }: PersonalityCardProps) {
  const meta = PERSONALITY_METADATA[personality];

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200',
        selected
          ? 'border-tis-coral bg-tis-coral/5 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{meta.name}</span>
            {selected && (
              <CheckCircleIcon className="w-5 h-5 text-tis-coral" />
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{meta.description}</p>
          <div className="mt-2 p-3 bg-gray-100 rounded-xl">
            <p className="text-sm text-gray-700 italic">&ldquo;{meta.example}&rdquo;</p>
          </div>
        </div>
      </div>
    </button>
  );
}

// ======================
// DELAY PRESET CARD
// ======================

interface DelayPresetCardProps {
  preset: typeof DELAY_PRESETS[0];
  selected: boolean;
  onSelect: () => void;
}

function DelayPresetCard({ preset, selected, onSelect }: DelayPresetCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex-1 p-4 rounded-2xl border-2 transition-all duration-200 text-left',
        selected
          ? 'border-tis-coral bg-tis-coral/5 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{preset.name}</span>
        {selected && <CheckCircleIcon className="w-5 h-5 text-tis-coral" />}
      </div>
      <p className="text-sm text-gray-600">{preset.description}</p>
      {preset.id !== 'custom' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <ClockIcon className="w-4 h-4" />
          <span>
            1er mensaje: {formatDelay(preset.firstMessageDelay)}
            {preset.subsequentMessageDelay > 0 && ` • Siguientes: ${formatDelay(preset.subsequentMessageDelay)}`}
          </span>
        </div>
      )}
    </button>
  );
}

// ======================
// MAIN COMPONENT
// ======================

interface ChannelAISettingsProps {
  connection: ChannelConnection;
  onClose: () => void;
  onSaved: (updated: ChannelConnection) => void;
}

export function ChannelAISettings({ connection, onClose, onSaved }: ChannelAISettingsProps) {
  const metadata = CHANNEL_METADATA[connection.channel];

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [personality, setPersonality] = useState<AIPersonality | ''>(
    connection.ai_personality_override || ''
  );
  const [firstMessageDelay, setFirstMessageDelay] = useState(
    connection.first_message_delay_seconds || 0
  );
  const [subsequentMessageDelay, setSubsequentMessageDelay] = useState(
    connection.subsequent_message_delay_seconds || 0
  );
  const [customInstructions, setCustomInstructions] = useState(
    connection.custom_instructions_override || ''
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    // Find matching preset
    const preset = DELAY_PRESETS.find(
      p => p.firstMessageDelay === connection.first_message_delay_seconds &&
           p.subsequentMessageDelay === connection.subsequent_message_delay_seconds &&
           p.id !== 'custom'
    );
    return preset?.id || 'custom';
  });

  // Handle preset selection
  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = DELAY_PRESETS.find(p => p.id === presetId);
    if (preset && presetId !== 'custom') {
      setFirstMessageDelay(preset.firstMessageDelay);
      setSubsequentMessageDelay(preset.subsequentMessageDelay);
    }
  };

  // Update preset when delays change manually
  useEffect(() => {
    if (selectedPreset !== 'custom') {
      const preset = DELAY_PRESETS.find(p => p.id === selectedPreset);
      if (preset && (
        firstMessageDelay !== preset.firstMessageDelay ||
        subsequentMessageDelay !== preset.subsequentMessageDelay
      )) {
        setSelectedPreset('custom');
      }
    }
  }, [firstMessageDelay, subsequentMessageDelay, selectedPreset]);

  // Save
  const handleSave = async () => {
    setSaving(true);

    const { data, error } = await supabase
      .from('channel_connections')
      .update({
        ai_personality_override: personality || null,
        first_message_delay_seconds: firstMessageDelay,
        subsequent_message_delay_seconds: subsequentMessageDelay,
        custom_instructions_override: customInstructions || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error('Error saving AI settings:', error);
      return;
    }

    setSaved(true);
    setTimeout(() => {
      onSaved(data as ChannelConnection);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center shadow-md',
                  metadata.bgColor,
                  metadata.textColor
                )}
              >
                <ChannelIcon channel={connection.channel} className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Configuración de AI
                </h3>
                <p className="text-sm text-gray-500">
                  {connection.account_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-all"
            >
              <XIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[65vh] space-y-8">
          {/* Personality Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <SparklesIcon className="w-5 h-5 text-tis-coral" />
              <h4 className="text-lg font-semibold text-gray-900">Personalidad del AI</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Elige cómo quieres que el AI responda en este canal.
              Si no seleccionas ninguna, usará la configuración global de tu cuenta.
            </p>

            <div className="grid gap-3">
              {/* Option to use global */}
              <button
                onClick={() => setPersonality('')}
                className={cn(
                  'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200',
                  !personality
                    ? 'border-tis-coral bg-tis-coral/5 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🌐</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Usar configuración global</span>
                      {!personality && <CheckCircleIcon className="w-5 h-5 text-tis-coral" />}
                    </div>
                    <p className="text-sm text-gray-600">
                      La personalidad se hereda de la configuración general de AI Agent
                    </p>
                  </div>
                </div>
              </button>

              {/* Personality options */}
              {(Object.keys(PERSONALITY_METADATA) as AIPersonality[]).map((p) => (
                <PersonalityCard
                  key={p}
                  personality={p}
                  selected={personality === p}
                  onSelect={() => setPersonality(p)}
                />
              ))}
            </div>
          </div>

          {/* Delay Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="w-5 h-5 text-gray-600" />
              <h4 className="text-lg font-semibold text-gray-900">Tiempo de Respuesta</h4>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Configura cuánto tiempo espera el AI antes de responder.
              Un pequeño delay hace que la conversación se sienta más natural y humana.
            </p>

            {/* Presets */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {DELAY_PRESETS.map((preset) => (
                <DelayPresetCard
                  key={preset.id}
                  preset={preset}
                  selected={selectedPreset === preset.id}
                  onSelect={() => handlePresetSelect(preset.id)}
                />
              ))}
            </div>

            {/* Custom sliders (shown when custom is selected) */}
            {selectedPreset === 'custom' && (
              <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Primer mensaje
                    </label>
                    <span className="text-sm font-semibold text-tis-coral">
                      {formatDelay(firstMessageDelay)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1800}
                    step={30}
                    value={firstMessageDelay}
                    onChange={(e) => setFirstMessageDelay(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-tis-coral"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tiempo de espera antes de responder el primer mensaje de una conversación
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Mensajes siguientes
                    </label>
                    <span className="text-sm font-semibold text-tis-coral">
                      {formatDelay(subsequentMessageDelay)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={300}
                    step={10}
                    value={subsequentMessageDelay}
                    onChange={(e) => setSubsequentMessageDelay(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-tis-coral"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tiempo de espera para los mensajes siguientes en la misma conversación
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Custom Instructions */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-900">Instrucciones Personalizadas</h4>
              <span className="text-xs text-gray-500">(Opcional)</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Añade instrucciones específicas para este canal.
              Por ejemplo, si es tu cuenta personal, puedes indicar que hable en primera persona.
            </p>

            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={`Ej: "Habla en primera persona como el Dr. García. Menciona que los pacientes pueden escribirme directamente por este canal para consultas rápidas."`}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tis-coral/20 focus:border-tis-coral transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50 flex justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              'px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2',
              saved
                ? 'bg-green-500 text-white'
                : saving
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-tis-coral text-white hover:bg-tis-coral-dark'
            )}
          >
            {saved ? (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                Guardado
              </>
            ) : saving ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChannelAISettings;
