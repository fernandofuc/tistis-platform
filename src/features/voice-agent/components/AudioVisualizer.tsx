'use client';

// =====================================================
// TIS TIS PLATFORM - Audio Visualizer Component
// Visualizador de audio animado para modo llamada
// FASE 4: UI Improvements
// =====================================================

import { motion } from 'framer-motion';

// ======================
// TYPES
// ======================

interface AudioVisualizerProps {
  /** Si el visualizador está activo */
  isActive: boolean;
  /** Si el asistente está hablando (vs escuchando) */
  isSpeaking: boolean;
  /** Número de barras */
  bars?: number;
  /** Altura máxima de las barras */
  maxHeight?: number;
  /** Altura mínima de las barras */
  minHeight?: number;
}

// ======================
// CONSTANTS
// ======================

const TIS_CORAL = 'rgb(223, 115, 115)';
const TIS_GREEN = 'rgb(34, 197, 94)';

// ======================
// COMPONENT
// ======================

export function AudioVisualizer({
  isActive,
  isSpeaking,
  bars = 5,
  maxHeight = 24,
  minHeight = 8,
}: AudioVisualizerProps) {
  const barColor = isSpeaking ? TIS_CORAL : TIS_GREEN;

  return (
    <div className="flex items-center justify-center gap-1 h-8" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: barColor }}
          animate={
            isActive
              ? {
                  height: [minHeight, maxHeight, minHeight],
                }
              : {
                  height: minHeight,
                }
          }
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ======================
// VARIANT: Mini Visualizer
// ======================

interface MiniVisualizerProps {
  isActive: boolean;
  color?: string;
}

export function MiniVisualizer({
  isActive,
  color = TIS_CORAL,
}: MiniVisualizerProps) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={
            isActive
              ? {
                  height: [4, 12, 4],
                }
              : {
                  height: 4,
                }
          }
          transition={{
            duration: 0.4,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export default AudioVisualizer;
