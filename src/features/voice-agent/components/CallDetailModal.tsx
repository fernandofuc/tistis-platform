'use client';

// =====================================================
// TIS TIS PLATFORM - Call Detail Modal
// Modal para ver detalles de una llamada de voz
// =====================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XIcon,
  PhoneIncomingIcon,
  PhoneOutgoingIcon,
  ClockIcon,
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  PlayIcon,
  PauseIcon,
  LoaderIcon,
  TrendingUpIcon,
  MessageIcon,
} from './VoiceAgentIcons';
import type { VoiceCall, VoiceCallMessage } from '../types';

// ======================
// TYPES
// ======================

interface CallDetailModalProps {
  call: VoiceCall;
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  /** Dynamic label for appointment_booked outcome - use terminology.appointment from useVerticalTerminology */
  appointmentLabel?: string;
}

// ======================
// HELPER FUNCTIONS
// ======================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOutcomeLabel(outcome: string | null, appointmentLabel: string = 'Cita'): { label: string; color: string } {
  const outcomes: Record<string, { label: string; color: string }> = {
    appointment_booked: { label: `${appointmentLabel} agendada`, color: 'text-tis-green bg-tis-green/10' },
    information_given: { label: 'Información dada', color: 'text-blue-600 bg-blue-50' },
    escalated_human: { label: 'Escalado a humano', color: 'text-amber-600 bg-amber-50' },
    callback_requested: { label: 'Callback solicitado', color: 'text-purple-600 bg-purple-50' },
    not_interested: { label: 'No interesado', color: 'text-slate-600 bg-slate-100' },
    wrong_number: { label: 'Número equivocado', color: 'text-red-600 bg-red-50' },
    voicemail: { label: 'Buzón de voz', color: 'text-slate-500 bg-slate-100' },
    dropped: { label: 'Llamada cortada', color: 'text-red-500 bg-red-50' },
    completed_other: { label: 'Completada', color: 'text-tis-green bg-tis-green/10' },
  };

  return outcomes[outcome || ''] || { label: outcome || 'N/A', color: 'text-slate-600 bg-slate-100' };
}

function getStatusLabel(status: string): { label: string; color: string } {
  const statuses: Record<string, { label: string; color: string }> = {
    initiated: { label: 'Iniciada', color: 'text-blue-600' },
    ringing: { label: 'Timbrando', color: 'text-amber-600' },
    in_progress: { label: 'En progreso', color: 'text-tis-green' },
    completed: { label: 'Completada', color: 'text-tis-green' },
    busy: { label: 'Ocupado', color: 'text-amber-600' },
    no_answer: { label: 'Sin respuesta', color: 'text-slate-500' },
    failed: { label: 'Fallida', color: 'text-red-600' },
    canceled: { label: 'Cancelada', color: 'text-slate-500' },
    escalated: { label: 'Escalada', color: 'text-amber-600' },
  };

  return statuses[status] || { label: status, color: 'text-slate-600' };
}

function getSentimentEmoji(sentiment: string | undefined): string {
  switch (sentiment) {
    case 'positive':
      return '😊';
    case 'negative':
      return '😔';
    case 'neutral':
    default:
      return '😐';
  }
}

// ======================
// COMPONENT
// ======================

export function CallDetailModal({
  call,
  isOpen,
  onClose,
  accessToken,
  appointmentLabel = 'Cita',
}: CallDetailModalProps) {
  const [messages, setMessages] = useState<VoiceCallMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Fetch call messages
  const fetchMessages = useCallback(async () => {
    if (!call.id || !accessToken) return;

    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/voice-agent/calls/${call.id}/messages`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error fetching call messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [call.id, accessToken]);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen, fetchMessages]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, [audioElement]);

  const handlePlayRecording = () => {
    if (!call.recording_url) return;

    if (isPlaying && audioElement) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      const audio = new Audio(call.recording_url);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    }
  };

  const outcomeInfo = getOutcomeLabel(call.outcome, appointmentLabel);
  const statusInfo = getStatusLabel(call.status);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${call.call_direction === 'inbound'
                  ? 'bg-tis-green/10 text-tis-green'
                  : 'bg-blue-50 text-blue-600'
                }
              `}>
                {call.call_direction === 'inbound' ? (
                  <PhoneIncomingIcon className="w-6 h-6" />
                ) : (
                  <PhoneOutgoingIcon className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Detalle de llamada
                </h2>
                <p className="text-sm text-slate-500">
                  {call.call_direction === 'inbound' ? 'Entrante' : 'Saliente'} • {call.caller_phone}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <XIcon className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Info Cards */}
            <div className="grid grid-cols-4 gap-4 p-6 border-b border-slate-100">
              {/* Date & Time */}
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <CalendarIcon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900">
                  {call.started_at ? formatTime(call.started_at) : 'N/A'}
                </p>
                <p className="text-xs text-slate-500">
                  {call.started_at ? formatDate(call.started_at) : ''}
                </p>
              </div>

              {/* Duration */}
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <ClockIcon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900">
                  {formatDuration(call.duration_seconds)}
                </p>
                <p className="text-xs text-slate-500">Duración</p>
              </div>

              {/* Status */}
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <CheckCircleIcon className={`w-5 h-5 mx-auto mb-2 ${statusInfo.color}`} />
                <p className={`text-sm font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </p>
                <p className="text-xs text-slate-500">Estado</p>
              </div>

              {/* Outcome */}
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <TrendingUpIcon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${outcomeInfo.color}`}>
                  {outcomeInfo.label}
                </span>
                <p className="text-xs text-slate-500 mt-1">Resultado</p>
              </div>
            </div>

            {/* Analysis */}
            {call.analysis && Object.keys(call.analysis).length > 0 && (
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUpIcon className="w-4 h-4" />
                  Análisis de la llamada
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {call.analysis.customer_name && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <UserIcon className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Cliente</p>
                        <p className="text-sm font-medium text-slate-900">
                          {call.analysis.customer_name}
                        </p>
                      </div>
                    </div>
                  )}

                  {call.analysis.sentiment && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className="text-2xl">{getSentimentEmoji(call.analysis.sentiment)}</span>
                      <div>
                        <p className="text-xs text-slate-500">Sentimiento</p>
                        <p className="text-sm font-medium text-slate-900 capitalize">
                          {call.analysis.sentiment === 'positive' ? 'Positivo' :
                           call.analysis.sentiment === 'negative' ? 'Negativo' : 'Neutral'}
                        </p>
                      </div>
                    </div>
                  )}

                  {call.analysis.service_requested && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <CalendarIcon className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Servicio solicitado</p>
                        <p className="text-sm font-medium text-slate-900">
                          {call.analysis.service_requested}
                        </p>
                      </div>
                    </div>
                  )}

                  {call.analysis.urgency && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <AlertTriangleIcon className={`w-5 h-5 ${
                        call.analysis.urgency === 'high' ? 'text-red-500' :
                        call.analysis.urgency === 'medium' ? 'text-amber-500' : 'text-slate-400'
                      }`} />
                      <div>
                        <p className="text-xs text-slate-500">Urgencia</p>
                        <p className="text-sm font-medium text-slate-900 capitalize">
                          {call.analysis.urgency === 'high' ? 'Alta' :
                           call.analysis.urgency === 'medium' ? 'Media' : 'Baja'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {call.analysis.key_topics && call.analysis.key_topics.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-slate-500 mb-2">Temas mencionados</p>
                    <div className="flex flex-wrap gap-2">
                      {call.analysis.key_topics.map((topic, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recording */}
            {call.recording_url && (
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Grabación
                </h3>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <button
                    onClick={handlePlayRecording}
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center transition-all
                      ${isPlaying
                        ? 'bg-tis-coral text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                      }
                    `}
                  >
                    {isPlaying ? (
                      <PauseIcon className="w-5 h-5" />
                    ) : (
                      <PlayIcon className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      Grabación de la llamada
                    </p>
                    <p className="text-xs text-slate-500">
                      {call.recording_duration_seconds
                        ? formatDuration(call.recording_duration_seconds)
                        : formatDuration(call.duration_seconds)
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Transcription / Messages */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MessageIcon className="w-4 h-4" />
                Conversación
              </h3>

              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderIcon className="w-6 h-6 text-slate-400" />
                </div>
              ) : messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`
                          max-w-[80%] p-4 rounded-2xl
                          ${msg.role === 'assistant'
                            ? 'bg-slate-100 text-slate-800 rounded-tl-md'
                            : 'bg-tis-coral text-white rounded-tr-md'
                          }
                        `}
                      >
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        {msg.detected_intent && (
                          <p className={`text-xs mt-2 ${
                            msg.role === 'assistant' ? 'text-slate-500' : 'text-white/70'
                          }`}>
                            Intención: {msg.detected_intent}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : call.transcription ? (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {call.transcription}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageIcon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">
                    No hay transcripción disponible para esta llamada
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50">
            <div className="text-sm text-slate-500">
              ID: {call.id.slice(0, 8)}...
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default CallDetailModal;
