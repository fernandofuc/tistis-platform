'use client';

// =====================================================
// TIS TIS PLATFORM - Call Summary Component
// Resumen detallado de la llamada/chat finalizado
// FASE 4: UI Improvements
// =====================================================

import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  MessageSquare,
  Zap,
  User,
  Bot,
  Phone,
  FileText,
} from 'lucide-react';

// ======================
// TYPES
// ======================

interface CallMetrics {
  duration: number;
  messageCount: number;
  avgLatency: number;
  maxLatency: number;
}

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  latencyMs?: number;
}

interface CallSummaryProps {
  /** Métricas de la llamada */
  metrics: CallMetrics;
  /** Modo de la prueba */
  mode: 'text' | 'call';
  /** Transcripción completa */
  transcript: TranscriptMessage[];
  /** Callback para nueva prueba */
  onNewTest: () => void;
  /** Callback para ver transcripción completa */
  onViewTranscript?: () => void;
  /** Callback para cerrar */
  onClose: () => void;
}

// ======================
// HELPERS
// ======================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ======================
// CONSTANTS
// ======================

const TIS_CORAL = 'rgb(223, 115, 115)';
const TIS_GREEN = 'rgb(34, 197, 94)';

// ======================
// COMPONENT
// ======================

export function CallSummary({
  metrics,
  mode,
  transcript,
  onNewTest,
  onViewTranscript,
  onClose,
}: CallSummaryProps) {
  // Calcular estadísticas
  const userMessages = transcript.filter((m) => m.role === 'user').length;
  const assistantMessages = transcript.filter((m) => m.role === 'assistant').length;
  const totalMessages = userMessages + assistantMessages;

  return (
    <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
      {/* Success badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4"
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
        >
          <CheckCircle className="w-4 h-4" style={{ color: TIS_GREEN }} aria-hidden="true" />
          <span className="text-sm font-medium" style={{ color: TIS_GREEN }}>
            {mode === 'call' ? 'Llamada finalizada' : 'Chat finalizado'}
          </span>
        </div>
      </motion.div>

      {/* Metrics grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4 text-center mb-4"
      >
        {/* Duración */}
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {formatDuration(metrics.duration)}
          </p>
          <p className="text-xs text-slate-500">Duración</p>
        </div>

        {/* Mensajes */}
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <MessageSquare className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="text-lg font-bold text-slate-900">{totalMessages}</p>
          <p className="text-xs text-slate-500">Mensajes</p>
        </div>

        {/* Latencia */}
        <div className="bg-white rounded-lg p-3 border border-slate-100">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <p className="text-lg font-bold text-slate-900">
            {Math.round(metrics.avgLatency)}ms
          </p>
          <p className="text-xs text-slate-500">Latencia</p>
        </div>
      </motion.div>

      {/* Message breakdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-center gap-4 mb-4 text-xs text-slate-500"
      >
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" aria-hidden="true" />
          <span>{userMessages} tú</span>
        </div>
        <div className="w-px h-3 bg-slate-200" />
        <div className="flex items-center gap-1">
          <Bot className="w-3 h-3" style={{ color: TIS_CORAL }} aria-hidden="true" />
          <span>{assistantMessages} asistente</span>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex gap-2"
      >
        {/* Ver transcripción (opcional) */}
        {onViewTranscript && (
          <button
            onClick={onViewTranscript}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            Ver Transcripción
          </button>
        )}

        {/* Nueva prueba */}
        <button
          onClick={onNewTest}
          className="flex-1 px-4 py-2.5 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${TIS_CORAL} 0%, rgb(194, 51, 80) 100%)`,
          }}
        >
          <Phone className="w-4 h-4" aria-hidden="true" />
          Nueva Prueba
        </button>
      </motion.div>

      {/* Close link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center mt-3"
      >
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
        >
          Cerrar
        </button>
      </motion.div>
    </div>
  );
}

export default CallSummary;
