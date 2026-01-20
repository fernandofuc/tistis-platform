/**
 * TIS TIS Platform - Voice Agent Wizard v2.0
 * Step 2: Select Voice
 *
 * Enhanced voice selection with:
 * - Audio preview with waveform visualization
 * - Speed control with presets
 * - Voice personality tags
 * - API loading with fallback
 * - Accessible audio controls
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  UserIcon,
  SparklesIcon,
  VolumeIcon,
  LoaderIcon,
  CheckIcon,
  AlertTriangleIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import {
  AVAILABLE_VOICES,
  VOICE_PREVIEW_TEXT,
  type AvailableVoice,
} from '@/src/features/voice-agent/types';
import type { StepComponentProps } from '../types';

// =====================================================
// CONSTANTS
// =====================================================

/** Speed presets for quick selection */
const SPEED_PRESETS = [
  { value: 0.9, label: 'Lento', description: 'Más pausado, ideal para información compleja' },
  { value: 1.0, label: 'Normal', description: 'Velocidad natural y cómoda' },
  { value: 1.15, label: 'Rápido', description: 'Más ágil, para conversaciones dinámicas' },
] as const;

/** Voice personality tags based on characteristics */
const PERSONALITY_TAGS: Record<string, { label: string; color: string }[]> = {
  professional: [
    { label: 'Profesional', color: 'bg-blue-100 text-blue-700' },
  ],
  friendly: [
    { label: 'Amigable', color: 'bg-green-100 text-green-700' },
  ],
  warm: [
    { label: 'Cálida', color: 'bg-amber-100 text-amber-700' },
  ],
  clear: [
    { label: 'Clara', color: 'bg-purple-100 text-purple-700' },
  ],
  formal: [
    { label: 'Formal', color: 'bg-slate-100 text-slate-700' },
  ],
  confident: [
    { label: 'Confiable', color: 'bg-indigo-100 text-indigo-700' },
  ],
};

/** Map voice descriptions to personality tags */
function getVoicePersonalityTags(description?: string): { label: string; color: string }[] {
  if (!description) return [];

  const tags: { label: string; color: string }[] = [];
  const lowerDesc = description.toLowerCase();

  if (lowerDesc.includes('profesional')) tags.push(...PERSONALITY_TAGS.professional);
  if (lowerDesc.includes('amigable') || lowerDesc.includes('amable')) tags.push(...PERSONALITY_TAGS.friendly);
  if (lowerDesc.includes('cálida') || lowerDesc.includes('calida')) tags.push(...PERSONALITY_TAGS.warm);
  if (lowerDesc.includes('clara') || lowerDesc.includes('claro')) tags.push(...PERSONALITY_TAGS.clear);
  if (lowerDesc.includes('formal')) tags.push(...PERSONALITY_TAGS.formal);
  if (lowerDesc.includes('confiable')) tags.push(...PERSONALITY_TAGS.confident);

  return tags.slice(0, 2); // Max 2 tags
}

// =====================================================
// WAVEFORM VISUALIZATION
// =====================================================

interface WaveformProps {
  isPlaying: boolean;
  progress: number;
}

function Waveform({ isPlaying, progress }: WaveformProps) {
  const bars = 12;

  return (
    <div className="flex items-center justify-center gap-0.5 h-4">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = (i / bars) * 100 < progress;
        const delay = i * 0.05;

        return (
          <motion.div
            key={i}
            className={`
              w-0.5 rounded-full transition-colors
              ${isActive ? 'bg-tis-coral' : 'bg-slate-300'}
            `}
            animate={isPlaying ? {
              height: ['4px', '14px', '8px', '12px', '4px'],
            } : {
              height: '4px',
            }}
            transition={isPlaying ? {
              duration: 0.8,
              repeat: Infinity,
              delay,
              ease: 'easeInOut',
            } : {
              duration: 0.2,
            }}
          />
        );
      })}
    </div>
  );
}

// =====================================================
// AUDIO PLAYER HOOK
// =====================================================

interface UseAudioPlayerOptions {
  onEnded?: () => void;
  onError?: (error: Error) => void;
}

function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    // Clean up progress interval first
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // Clean up audio element safely
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src'); // Safer than setting empty string
      audio.load(); // Reset the audio element
    }
    audioRef.current = null;
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const play = useCallback(async (url: string, playbackRate: number = 1.0) => {
    cleanup();
    setIsLoading(true);
    setError(null);

    try {
      const audio = new Audio(url);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(100);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        options.onEnded?.();
      };

      audio.onerror = () => {
        const err = new Error('Error al reproducir audio');
        setError(err.message);
        setIsPlaying(false);
        setIsLoading(false);
        options.onError?.(err);
      };

      audio.oncanplaythrough = async () => {
        try {
          await audio.play();
          setIsPlaying(true);
          setIsLoading(false);

          // Update progress - only after successful play
          progressIntervalRef.current = setInterval(() => {
            if (audio.duration > 0) {
              setProgress((audio.currentTime / audio.duration) * 100);
            }
          }, 100);
        } catch {
          setError('No se pudo reproducir el audio');
          setIsLoading(false);
          // Clean up interval if it was somehow set
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }
      };

      audio.load();
    } catch (e) {
      setError('Error cargando audio');
      setIsLoading(false);
    }
  }, [cleanup, options.onEnded, options.onError]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isPlaying,
    isLoading,
    progress,
    error,
    play,
    pause,
    cleanup,
    setPlaybackRate,
  };
}

// =====================================================
// VOICE CARD COMPONENT
// =====================================================

interface VoiceCardProps {
  voice: AvailableVoice;
  isSelected: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  error: string | null;
  onSelect: () => void;
  onPlayPreview: () => void;
}

function VoiceCard({
  voice,
  isSelected,
  isPlaying,
  isLoading,
  progress,
  error,
  onSelect,
  onPlayPreview,
}: VoiceCardProps) {
  const avatarGradient =
    voice.gender === 'female'
      ? 'from-pink-400 to-rose-500'
      : voice.gender === 'male'
        ? 'from-blue-400 to-indigo-500'
        : 'from-slate-400 to-slate-500';

  const tags = getVoicePersonalityTags(voice.description);

  return (
    <motion.div
      className={`
        relative w-full text-left rounded-2xl border-2 overflow-hidden
        transition-all duration-300 group
        ${isSelected
          ? 'border-tis-coral bg-white shadow-lg ring-2 ring-tis-coral/20'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
        }
      `}
      whileHover={{ y: -2 }}
    >
      {/* Main content - clickable to select */}
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-tis-coral/50"
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className={`
              relative w-12 h-12 rounded-full flex items-center justify-center text-white
              bg-gradient-to-br ${avatarGradient}
              shadow-md flex-shrink-0
            `}
          >
            <UserIcon className="w-6 h-6" />
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-tis-coral rounded-full flex items-center justify-center shadow-sm"
              >
                <CheckIcon className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-slate-900">{voice.name}</h3>
              {voice.is_default && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
                  <SparklesIcon className="w-2.5 h-2.5" />
                  Recomendada
                </span>
              )}
            </div>

            <p className="text-sm text-slate-500 line-clamp-1 mb-2">{voice.description}</p>

            {/* Tags */}
            {(tags.length > 0 || voice.accent) && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                  <span
                    key={`tag-${idx}`}
                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${tag.color}`}
                  >
                    {tag.label}
                  </span>
                ))}
                {voice.accent && (
                  <span
                    key="accent"
                    className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600"
                  >
                    {voice.accent}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Audio preview section */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
          {/* Play/Pause button */}
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayPreview();
            }}
            disabled={isLoading}
            className={`
              w-10 h-10 rounded-full flex items-center justify-center
              transition-all flex-shrink-0
              ${isPlaying
                ? 'bg-tis-coral text-white shadow-md shadow-tis-coral/30'
                : 'bg-white border-2 border-slate-200 text-slate-500 hover:border-tis-coral hover:text-tis-coral'
              }
              ${isLoading ? 'opacity-60 cursor-wait' : ''}
            `}
            whileHover={{ scale: isLoading ? 1 : 1.05 }}
            whileTap={{ scale: isLoading ? 1 : 0.95 }}
            aria-label={isPlaying ? `Pausar preview de ${voice.name}` : `Reproducir preview de ${voice.name}`}
          >
            {isLoading ? (
              <LoaderIcon className="w-4 h-4 animate-spin" />
            ) : isPlaying ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
          </motion.button>

          {/* Waveform or status */}
          <div className="flex-1">
            {error ? (
              <div className="flex items-center gap-2 text-red-500">
                <AlertTriangleIcon className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            ) : isPlaying || progress > 0 ? (
              <div className="space-y-1">
                <Waveform isPlaying={isPlaying} progress={progress} />
                <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-tis-coral"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>
            ) : (
              <span className="text-xs text-slate-400">
                Haz clic para escuchar
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =====================================================
// SPEED CONTROL COMPONENT
// =====================================================

interface SpeedControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function SpeedControl({ value, onChange, disabled }: SpeedControlProps) {
  const [isCustom, setIsCustom] = useState(false);

  // Check if current value matches a preset
  const matchedPreset = SPEED_PRESETS.find(p => Math.abs(p.value - value) < 0.05);

  useEffect(() => {
    setIsCustom(!matchedPreset);
  }, [matchedPreset]);

  const handlePresetClick = (preset: typeof SPEED_PRESETS[number]) => {
    onChange(preset.value);
    setIsCustom(false);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
    setIsCustom(true);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tis-purple to-indigo-600 flex items-center justify-center">
          <VolumeIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Velocidad de habla</h3>
          <p className="text-xs text-slate-500">Ajusta qué tan rápido habla el asistente</p>
        </div>
        <div className="ml-auto">
          <span className="text-lg font-bold text-tis-coral">{value.toFixed(2)}x</span>
        </div>
      </div>

      {/* Presets */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {SPEED_PRESETS.map((preset) => (
            <motion.button
              key={preset.value}
              type="button"
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              className={`
                relative p-3 rounded-xl border-2 text-center transition-all
                ${matchedPreset?.value === preset.value && !isCustom
                  ? 'border-tis-coral bg-tis-coral-50 ring-2 ring-tis-coral/20'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              whileTap={disabled ? undefined : { scale: 0.98 }}
            >
              <p className="font-semibold text-slate-900">{preset.label}</p>
              <p className="text-xs text-slate-500">{preset.value}x</p>
              {matchedPreset?.value === preset.value && !isCustom && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-tis-coral rounded-full flex items-center justify-center"
                >
                  <CheckIcon className="w-3 h-3 text-white" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Custom slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-medium text-slate-500">Ajuste fino</span>
            {isCustom && (
              <span className="text-xs font-medium text-tis-coral">Personalizado</span>
            )}
          </div>

          <div className="relative pt-1">
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={value}
              onChange={handleSliderChange}
              disabled={disabled}
              className={`
                w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-gradient-to-br
                [&::-webkit-slider-thumb]:from-tis-coral
                [&::-webkit-slider-thumb]:to-tis-pink
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:transition-transform
                [&::-webkit-slider-thumb]:hover:scale-110
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-gradient-to-br
                [&::-moz-range-thumb]:from-tis-coral
                [&::-moz-range-thumb]:to-tis-pink
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:shadow-md
                [&::-moz-range-thumb]:cursor-pointer
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label="Velocidad personalizada"
            />
            {/* Progress fill */}
            <div
              className="absolute top-1 left-0 h-2 bg-gradient-to-r from-tis-coral to-tis-pink rounded-full pointer-events-none"
              style={{ width: `${Math.min(100, Math.max(0, ((value - 0.8) / 0.5) * 100))}%` }}
            />
          </div>

          <div className="flex justify-between">
            <span className="text-xs text-slate-400">0.8x Lento</span>
            <span className="text-xs text-slate-400">1.3x Rápido</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// LOADING SKELETON
// =====================================================

function VoiceCardSkeleton() {
  return (
    <div className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-200 rounded w-24" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="flex gap-1.5">
            <div className="h-5 bg-slate-100 rounded-full w-16" />
            <div className="h-5 bg-slate-100 rounded-full w-14" />
          </div>
        </div>
      </div>
      <div className="mt-4 h-16 bg-slate-50 rounded-xl" />
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function StepSelectVoice({
  config,
  onUpdateConfig,
  accessToken,
}: StepComponentProps) {
  const [voices, setVoices] = useState<AvailableVoice[]>(AVAILABLE_VOICES);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);

  // Memoize audio player options to prevent unnecessary re-renders
  const audioPlayerOptions = useMemo(() => ({
    onEnded: () => setCurrentPlayingId(null),
    onError: () => setCurrentPlayingId(null),
  }), []);

  const audioPlayer = useAudioPlayer(audioPlayerOptions);

  // Fetch voices from API (with fallback to static list)
  useEffect(() => {
    const fetchVoices = async () => {
      if (!accessToken) return;

      setIsLoadingVoices(true);

      try {
        const response = await fetch('/api/voice-agent/voices', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.voices && Array.isArray(data.voices) && data.voices.length > 0) {
            setVoices(data.voices);
          }
        }
        // If API fails, keep using static AVAILABLE_VOICES
      } catch {
        // Silently fall back to static list
      } finally {
        setIsLoadingVoices(false);
      }
    };

    fetchVoices();
  }, [accessToken]);

  // Auto-select default voice if nothing selected
  useEffect(() => {
    if (!config.voiceId && voices.length > 0) {
      const defaultVoice = voices.find((v) => v.is_default) || voices[0];
      if (defaultVoice) {
        onUpdateConfig({ voiceId: defaultVoice.id });
      }
    }
  }, [config.voiceId, voices, onUpdateConfig]);

  // Play voice preview
  const playPreview = useCallback(
    async (voice: AvailableVoice) => {
      // If same voice is playing, pause it
      if (currentPlayingId === voice.id && audioPlayer.isPlaying) {
        audioPlayer.pause();
        return;
      }

      setCurrentPlayingId(voice.id);

      // If voice has a preview_url, use it directly
      if (voice.preview_url) {
        audioPlayer.play(voice.preview_url, config.voiceSpeed);
        return;
      }

      // Otherwise, generate preview via API
      try {
        const response = await fetch('/api/voice-agent/preview-voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: accessToken ? `Bearer ${accessToken}` : '',
          },
          body: JSON.stringify({
            voice_id: voice.id,
            text: VOICE_PREVIEW_TEXT,
            speed: config.voiceSpeed,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate preview');
        }

        const data = await response.json();

        if (data.audio_url) {
          audioPlayer.play(data.audio_url, config.voiceSpeed);
        } else {
          // No audio URL returned, reset state
          setCurrentPlayingId(null);
        }
      } catch {
        // Reset playing state but keep currentPlayingId
        // so the error from audioPlayer can still be displayed
        // The audioPlayer hook handles error display
        setCurrentPlayingId(null);
      }
    },
    [currentPlayingId, audioPlayer.isPlaying, audioPlayer.pause, audioPlayer.play, config.voiceSpeed, accessToken]
  );

  const handleSelectVoice = useCallback((voiceId: string) => {
    onUpdateConfig({ voiceId });
  }, [onUpdateConfig]);

  const handleSpeedChange = useCallback((speed: number) => {
    onUpdateConfig({ voiceSpeed: speed });
    audioPlayer.setPlaybackRate(speed);
  }, [onUpdateConfig, audioPlayer.setPlaybackRate]);

  // Memoize sorted voices (default first, then alphabetical)
  const sortedVoices = useMemo(() => {
    return [...voices].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [voices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-tis-purple to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-tis-purple/30"
        >
          <VolumeIcon className="w-8 h-8 text-white" />
        </motion.div>

        <motion.h2
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-2xl font-bold text-slate-900 mb-2"
        >
          Elige la voz de tu asistente
        </motion.h2>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-slate-500"
        >
          Selecciona la voz que mejor represente a tu negocio
        </motion.p>
      </div>

      {/* Voice cards grid */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="grid gap-4 sm:grid-cols-2"
      >
        {isLoadingVoices ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <VoiceCardSkeleton key={i} />
          ))
        ) : (
          sortedVoices.map((voice, index) => (
            <motion.div
              key={voice.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
            >
              <VoiceCard
                voice={voice}
                isSelected={config.voiceId === voice.id}
                isPlaying={currentPlayingId === voice.id && audioPlayer.isPlaying}
                isLoading={currentPlayingId === voice.id && audioPlayer.isLoading}
                progress={currentPlayingId === voice.id ? audioPlayer.progress : 0}
                error={currentPlayingId === voice.id ? audioPlayer.error : null}
                onSelect={() => handleSelectVoice(voice.id)}
                onPlayPreview={() => playPreview(voice)}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Speed control */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <SpeedControl
          value={config.voiceSpeed}
          onChange={handleSpeedChange}
          disabled={audioPlayer.isLoading}
        />
      </motion.div>

      {/* Help text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="p-4 bg-blue-50 border border-blue-100 rounded-xl"
      >
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> Escucha cada voz antes de seleccionarla. La velocidad
          que elijas se aplicará en las conversaciones reales con tus clientes.
        </p>
      </motion.div>
    </div>
  );
}

export default StepSelectVoice;
