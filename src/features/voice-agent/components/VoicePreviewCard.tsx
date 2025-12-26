'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AvailableVoice } from '../types';

// ======================
// ICONS
// ======================
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

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

// ======================
// TYPES
// ======================
interface VoicePreviewCardProps {
  voice: AvailableVoice;
  isSelected: boolean;
  onSelect: () => void;
  accessToken?: string;
}

// ======================
// COMPONENT
// ======================
export function VoicePreviewCard({
  voice,
  isSelected,
  onSelect,
  accessToken,
}: VoicePreviewCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      return;
    }

    try {
      setIsLoading(true);

      // Create audio element if it doesn't exist
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.onended = () => {
          setIsPlaying(false);
          setProgress(0);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        };
        audioRef.current.onloadedmetadata = () => {
          setDuration(audioRef.current?.duration || 0);
        };
        audioRef.current.onerror = () => {
          setError('Error al cargar el audio');
          setIsPlaying(false);
          setIsLoading(false);
        };
      }

      // Fetch audio from API
      const response = await fetch('/api/voice-agent/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({ voice_id: voice.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'No se pudo generar el preview');
      }

      // Check if response is JSON (error/info) or audio
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (!data.success) {
          // Show friendly message for API key not configured
          const friendlyMessage = data.message?.includes('ElevenLabs API key')
            ? 'Preview no disponible en este momento'
            : (data.message || 'Preview no disponible');
          setError(friendlyMessage);
          setIsLoading(false);
          return;
        }
      }

      // It's audio - create blob URL
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      audioRef.current.src = audioUrl;

      // Play audio
      await audioRef.current.play();
      setIsPlaying(true);
      setIsLoading(false);

      // Update progress
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setProgress(currentProgress);
        }
      }, 100);

    } catch (err) {
      console.error('[VoicePreviewCard] Error:', err);
      setError(err instanceof Error ? err.message : 'Error al reproducir');
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`
        relative w-full text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${isSelected
          ? 'border-tis-coral bg-gradient-to-br from-tis-coral/5 via-white to-tis-pink/5 shadow-lg shadow-tis-coral/10'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
        }
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="w-6 h-6 bg-tis-coral rounded-full flex items-center justify-center shadow-lg shadow-tis-coral/30">
            <CheckIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      <div className="p-5">
        {/* Header: Icon + Name */}
        <div className="flex items-start gap-4 mb-4">
          <div className={`
            w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all
            ${isSelected
              ? voice.gender === 'male'
                ? 'bg-gradient-to-br from-tis-purple to-indigo-600 shadow-lg shadow-tis-purple/30'
                : 'bg-gradient-to-br from-tis-pink to-rose-500 shadow-lg shadow-tis-pink/30'
              : voice.gender === 'male'
                ? 'bg-tis-purple/10'
                : 'bg-tis-pink/10'
            }
          `}>
            <VolumeIcon className={`w-7 h-7 ${isSelected ? 'text-white' : voice.gender === 'male' ? 'text-tis-purple' : 'text-tis-pink'}`} />
          </div>

          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-lg font-bold text-slate-900">{voice.name}</h4>
              {voice.is_default && (
                <span className="px-2 py-0.5 bg-tis-green/10 text-tis-green text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Recomendado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Acento {voice.accent} &bull; {voice.gender === 'male' ? 'Masculino' : 'Femenino'}
            </p>
          </div>
        </div>

        {/* Description */}
        {voice.description && (
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            {voice.description}
          </p>
        )}

        {/* Audio Player Bar */}
        <div className={`
          flex items-center gap-3 p-3 rounded-xl transition-all
          ${isSelected ? 'bg-white/80 border border-tis-coral/20' : 'bg-slate-50 border border-slate-100'}
        `}>
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={isLoading}
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
              ${isLoading
                ? 'bg-slate-200 cursor-wait'
                : isPlaying
                  ? 'bg-tis-coral text-white shadow-lg shadow-tis-coral/30'
                  : isSelected
                    ? 'bg-tis-coral/10 text-tis-coral hover:bg-tis-coral hover:text-white'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }
            `}
          >
            {isLoading ? (
              <LoadingSpinner className="w-5 h-5" />
            ) : isPlaying ? (
              <PauseIcon className="w-4 h-4" />
            ) : (
              <PlayIcon className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Progress Bar */}
          <div className="flex-1">
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-tis-coral to-tis-pink rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
          </div>

          {/* Duration */}
          <span className="text-xs font-mono text-slate-400 w-10 text-right">
            {duration > 0 ? formatTime(duration) : '0:00'}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export default VoicePreviewCard;
