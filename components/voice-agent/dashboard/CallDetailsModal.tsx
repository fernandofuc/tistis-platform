/**
 * TIS TIS Platform - Voice Agent Dashboard v2.0
 * CallDetailsModal Component
 *
 * Modal showing detailed information about a specific call,
 * including transcription, analysis, and recording playback.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  ClockIcon,
  CalendarIcon,
  UserIcon,
  PlayIcon,
  PauseIcon,
  VolumeIcon,
  ZapIcon,
  TagIcon,
  MessageSquareIcon,
  DollarIcon,
  AlertCircleIcon,
} from '@/src/features/voice-agent/components/VoiceAgentIcons';
import type { VoiceCall, TranscriptionSegment } from '@/src/features/voice-agent/types';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  formatDuration,
  formatLatency,
  formatCurrency,
} from './types';

// =====================================================
// TYPES
// =====================================================

export interface CallDetailsModalProps {
  /** Call to display */
  call: VoiceCall | null;
  /** Whether modal is open */
  isOpen: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Additional className */
  className?: string;
}

// =====================================================
// TRANSCRIPTION VIEW
// =====================================================

interface TranscriptionViewProps {
  segments: TranscriptionSegment[];
  fullTranscription?: string | null;
}

function TranscriptionView({ segments, fullTranscription }: TranscriptionViewProps) {
  if (segments.length === 0 && !fullTranscription) {
    return (
      <div className="text-center py-8">
        <MessageSquareIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No hay transcripción disponible</p>
      </div>
    );
  }

  // If we have segments, show them
  if (segments.length > 0) {
    return (
      <div className="space-y-3">
        {segments.map((segment, index) => (
          <div
            key={index}
            className={`flex gap-3 ${
              segment.speaker === 'assistant' ? 'justify-start' : 'justify-end'
            }`}
          >
            <div
              className={`
                max-w-[80%] px-4 py-2.5 rounded-2xl
                ${segment.speaker === 'assistant'
                  ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  : 'bg-tis-coral text-white rounded-tr-sm'
                }
              `}
            >
              <p className="text-sm">{segment.text}</p>
              <p
                className={`text-[10px] mt-1 ${
                  segment.speaker === 'assistant' ? 'text-slate-400' : 'text-white/70'
                }`}
              >
                {formatDuration(Math.round(segment.start))} - {formatDuration(Math.round(segment.end))}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback to full transcription
  return (
    <div className="prose prose-sm max-w-none">
      <p className="text-slate-600 whitespace-pre-wrap">{fullTranscription}</p>
    </div>
  );
}

// =====================================================
// AUDIO PLAYER
// =====================================================

interface AudioPlayerProps {
  url: string;
  duration?: number;
}

function AudioPlayer({ url, duration }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(value);
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play/Pause */}
      <motion.button
        type="button"
        onClick={togglePlay}
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          transition-colors
          ${isPlaying
            ? 'bg-tis-coral text-white'
            : 'bg-white border-2 border-slate-200 text-slate-500 hover:border-tis-coral hover:text-tis-coral'
          }
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isPlaying ? (
          <PauseIcon className="w-4 h-4" />
        ) : (
          <PlayIcon className="w-4 h-4" />
        )}
      </motion.button>

      {/* Progress */}
      <div className="flex-1">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSeek}
          className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-tis-coral
            [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">{formatDuration(Math.round(currentTime))}</span>
          <span className="text-xs text-slate-400">
            {duration ? formatDuration(Math.round(duration)) : '--:--'}
          </span>
        </div>
      </div>

      {/* Volume */}
      <VolumeIcon className="w-4 h-4 text-slate-400" />
    </div>
  );
}

// =====================================================
// INFO ITEM
// =====================================================

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function CallDetailsModal({
  call,
  isOpen,
  onClose,
  className = '',
}: CallDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'transcription' | 'analysis'>('details');

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Animation variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.2 },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 20,
      transition: { duration: 0.15 },
    },
  };

  if (!call) return null;

  const statusColors = STATUS_COLORS[call.status];
  const outcomeColor = call.outcome ? OUTCOME_COLORS[call.outcome] : '#94a3b8';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={`
              bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh]
              flex flex-col overflow-hidden
              ${className}
            `}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div
                  className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${call.call_direction === 'inbound'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                    }
                  `}
                >
                  {call.call_direction === 'inbound' ? (
                    <PhoneIncomingIcon className="w-6 h-6" />
                  ) : (
                    <PhoneOutgoingIcon className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Detalles de Llamada
                  </h2>
                  <p className="text-sm text-slate-500">
                    {call.caller_phone || 'Número desconocido'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
              {(['details', 'transcription', 'analysis'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`
                    flex-1 px-4 py-3 text-sm font-medium transition-colors
                    ${activeTab === tab
                      ? 'text-tis-coral border-b-2 border-tis-coral'
                      : 'text-slate-500 hover:text-slate-700'
                    }
                  `}
                >
                  {tab === 'details' && 'Detalles'}
                  {tab === 'transcription' && 'Transcripción'}
                  {tab === 'analysis' && 'Análisis'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Status badges */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`
                        inline-flex items-center px-3 py-1.5 rounded-full
                        text-sm font-medium border
                        ${statusColors.bg} ${statusColors.text} ${statusColors.border}
                      `}
                    >
                      {STATUS_LABELS[call.status]}
                    </span>
                    {call.outcome && (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-slate-100"
                        style={{ color: outcomeColor }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: outcomeColor }}
                        />
                        {OUTCOME_LABELS[call.outcome]}
                      </span>
                    )}
                  </div>

                  {/* Recording */}
                  {call.recording_url && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Grabación</h4>
                      <AudioPlayer
                        url={call.recording_url}
                        duration={call.recording_duration_seconds || undefined}
                      />
                    </div>
                  )}

                  {/* Info grid */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Información</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        icon={<CalendarIcon className="w-4 h-4" />}
                        label="Fecha"
                        value={call.started_at
                          ? new Date(call.started_at).toLocaleDateString('es-MX', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : '-'
                        }
                      />
                      <InfoItem
                        icon={<ClockIcon className="w-4 h-4" />}
                        label="Hora"
                        value={call.started_at
                          ? new Date(call.started_at).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'
                        }
                      />
                      <InfoItem
                        icon={<ClockIcon className="w-4 h-4" />}
                        label="Duración"
                        value={formatDuration(call.duration_seconds)}
                      />
                      <InfoItem
                        icon={<ZapIcon className="w-4 h-4" />}
                        label="Latencia"
                        value={call.latency_avg_ms ? formatLatency(call.latency_avg_ms) : '-'}
                      />
                      <InfoItem
                        icon={<MessageSquareIcon className="w-4 h-4" />}
                        label="Turnos"
                        value={call.turns_count}
                      />
                      <InfoItem
                        icon={<DollarIcon className="w-4 h-4" />}
                        label="Costo"
                        value={formatCurrency(call.cost_usd)}
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {call.error_message && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-700">Error en llamada</p>
                          <p className="text-sm text-red-600 mt-1">{call.error_message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Transcription Tab */}
              {activeTab === 'transcription' && (
                <TranscriptionView
                  segments={call.transcription_segments || []}
                  fullTranscription={call.transcription}
                />
              )}

              {/* Analysis Tab */}
              {activeTab === 'analysis' && (
                <div className="space-y-6">
                  {/* Intents */}
                  {call.detected_intents && call.detected_intents.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">
                        Intenciones Detectadas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {call.detected_intents.map((intent, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm font-medium"
                          >
                            <TagIcon className="w-3 h-3" />
                            {intent}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analysis data */}
                  {call.analysis && Object.keys(call.analysis).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">
                        Datos Extraídos
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {call.analysis.customer_name && (
                          <InfoItem
                            icon={<UserIcon className="w-4 h-4" />}
                            label="Nombre del cliente"
                            value={call.analysis.customer_name}
                          />
                        )}
                        {call.analysis.service_requested && (
                          <InfoItem
                            icon={<TagIcon className="w-4 h-4" />}
                            label="Servicio solicitado"
                            value={call.analysis.service_requested}
                          />
                        )}
                        {call.analysis.appointment_date && (
                          <InfoItem
                            icon={<CalendarIcon className="w-4 h-4" />}
                            label="Fecha de cita"
                            value={call.analysis.appointment_date}
                          />
                        )}
                        {call.analysis.appointment_time && (
                          <InfoItem
                            icon={<ClockIcon className="w-4 h-4" />}
                            label="Hora de cita"
                            value={call.analysis.appointment_time}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key topics */}
                  {call.analysis?.key_topics && call.analysis.key_topics.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">
                        Temas Principales
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {call.analysis.key_topics.map((topic, i) => (
                          <span
                            key={i}
                            className="inline-flex px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentiment */}
                  {call.analysis?.sentiment && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Sentimiento</h4>
                      <span
                        className={`
                          inline-flex px-3 py-1.5 rounded-full text-sm font-medium
                          ${call.analysis.sentiment === 'positive'
                            ? 'bg-green-100 text-green-700'
                            : call.analysis.sentiment === 'negative'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                          }
                        `}
                      >
                        {call.analysis.sentiment === 'positive'
                          ? 'Positivo'
                          : call.analysis.sentiment === 'negative'
                          ? 'Negativo'
                          : 'Neutral'}
                      </span>
                    </div>
                  )}

                  {/* Empty state */}
                  {(!call.detected_intents || call.detected_intents.length === 0) &&
                   (!call.analysis || Object.keys(call.analysis).length === 0) && (
                    <div className="text-center py-8">
                      <ZapIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No hay análisis disponible</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CallDetailsModal;
