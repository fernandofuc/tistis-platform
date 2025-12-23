'use client';

// =====================================================
// TIS TIS PLATFORM - Advanced Settings Section
// Configuración avanzada: modelo IA, velocidad, calidad voz
// =====================================================

import { useState, useEffect } from 'react';
import {
  type ResponseSpeedPreset,
  type VoiceQualityPreset,
  RESPONSE_SPEED_PRESETS,
  VOICE_QUALITY_PRESETS,
} from '../types';

// ======================
// ICONS
// ======================

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const VolumeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);


// ======================
// TYPES
// ======================

interface AdvancedSettingsSectionProps {
  responseSpeed: ResponseSpeedPreset;
  voiceQuality: VoiceQualityPreset;
  onResponseSpeedChange: (preset: ResponseSpeedPreset, values: {
    wait_seconds: number;
    on_punctuation_seconds: number;
    on_no_punctuation_seconds: number;
  }) => void;
  onVoiceQualityChange: (preset: VoiceQualityPreset, values: {
    stability: number;
    similarity_boost: number;
  }) => void;
  saving?: boolean;
}

// ======================
// COMPONENT
// ======================

export function AdvancedSettingsSection({
  responseSpeed,
  voiceQuality,
  onResponseSpeedChange,
  onVoiceQualityChange,
  saving = false,
}: AdvancedSettingsSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localResponseSpeed, setLocalResponseSpeed] = useState<ResponseSpeedPreset>(responseSpeed);
  const [localVoiceQuality, setLocalVoiceQuality] = useState<VoiceQualityPreset>(voiceQuality);

  // Sync with props
  useEffect(() => {
    setLocalResponseSpeed(responseSpeed);
    setLocalVoiceQuality(voiceQuality);
  }, [responseSpeed, voiceQuality]);

  // Handle Response Speed change
  const handleResponseSpeedChange = (preset: ResponseSpeedPreset) => {
    setLocalResponseSpeed(preset);
    const presetValues = RESPONSE_SPEED_PRESETS[preset];
    onResponseSpeedChange(preset, {
      wait_seconds: presetValues.wait_seconds,
      on_punctuation_seconds: presetValues.on_punctuation_seconds,
      on_no_punctuation_seconds: presetValues.on_no_punctuation_seconds,
    });
  };

  // Handle Voice Quality change
  const handleVoiceQualityChange = (preset: VoiceQualityPreset) => {
    setLocalVoiceQuality(preset);
    const presetValues = VOICE_QUALITY_PRESETS[preset];
    onVoiceQualityChange(preset, {
      stability: presetValues.stability,
      similarity_boost: presetValues.similarity_boost,
    });
  };

  const selectedResponseSpeed = RESPONSE_SPEED_PRESETS[localResponseSpeed];
  const selectedVoiceQuality = VOICE_QUALITY_PRESETS[localVoiceQuality];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Configuración Avanzada</h3>
              <p className="text-sm text-slate-500">Ajusta el comportamiento de tu asistente</p>
            </div>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Editar
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-tis-coral hover:bg-tis-coral/5 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Listo'}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Response Speed Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <ZapIcon className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Velocidad de Respuesta</h4>
              <p className="text-xs text-slate-500">Cuánto espera antes de responder</p>
            </div>
          </div>

          {isEditing ? (
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(RESPONSE_SPEED_PRESETS) as [ResponseSpeedPreset, typeof RESPONSE_SPEED_PRESETS['fast']][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleResponseSpeedChange(key)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    localResponseSpeed === key
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-semibold text-slate-900 mb-1">{preset.label}</p>
                  <p className="text-xs text-slate-500">{preset.description}</p>
                  {key === 'balanced' && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-tis-green text-white text-xs font-bold rounded-full">
                      Recomendado
                    </span>
                  )}
                  {localResponseSpeed === key && (
                    <div className="absolute top-2 right-2">
                      <CheckIcon className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <ZapIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{selectedResponseSpeed?.label || 'No seleccionado'}</p>
                <p className="text-sm text-slate-500">{selectedResponseSpeed?.description || ''}</p>
              </div>
            </div>
          )}

          {/* Technical Details (collapsed) */}
          {isEditing && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              <p><strong>Espera inicial:</strong> {RESPONSE_SPEED_PRESETS[localResponseSpeed].wait_seconds}s</p>
              <p><strong>Después de puntuación:</strong> {RESPONSE_SPEED_PRESETS[localResponseSpeed].on_punctuation_seconds}s</p>
              <p><strong>Sin puntuación:</strong> {RESPONSE_SPEED_PRESETS[localResponseSpeed].on_no_punctuation_seconds}s</p>
            </div>
          )}
        </div>

        {/* Voice Quality Section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-tis-pink/10 flex items-center justify-center">
              <VolumeIcon className="w-4 h-4 text-tis-pink" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Calidad de Voz</h4>
              <p className="text-xs text-slate-500">Estilo de la voz sintetizada</p>
            </div>
          </div>

          {isEditing ? (
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(VOICE_QUALITY_PRESETS) as [VoiceQualityPreset, typeof VOICE_QUALITY_PRESETS['natural']][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleVoiceQualityChange(key)}
                  className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                    localVoiceQuality === key
                      ? 'border-tis-pink bg-tis-pink/5'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="font-semibold text-slate-900 mb-1">{preset.label}</p>
                  <p className="text-xs text-slate-500">{preset.description}</p>
                  {key === 'natural' && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-tis-green text-white text-xs font-bold rounded-full">
                      Recomendado
                    </span>
                  )}
                  {localVoiceQuality === key && (
                    <div className="absolute top-2 right-2">
                      <CheckIcon className="w-5 h-5 text-tis-pink" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-10 h-10 rounded-lg bg-tis-pink/10 flex items-center justify-center">
                <VolumeIcon className="w-5 h-5 text-tis-pink" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{selectedVoiceQuality?.label || 'No seleccionado'}</p>
                <p className="text-sm text-slate-500">{selectedVoiceQuality?.description || ''}</p>
              </div>
            </div>
          )}

          {/* Technical Details (collapsed) */}
          {isEditing && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              <p><strong>Estabilidad:</strong> {(VOICE_QUALITY_PRESETS[localVoiceQuality].stability * 100).toFixed(0)}%</p>
              <p><strong>Similitud:</strong> {(VOICE_QUALITY_PRESETS[localVoiceQuality].similarity_boost * 100).toFixed(0)}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdvancedSettingsSection;
