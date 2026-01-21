'use client';

// =====================================================
// TIS TIS PLATFORM - Status Indicator Component
// Componente para mostrar el estado de la llamada/chat
// FASE 4: UI Improvements
// =====================================================

import { motion } from 'framer-motion';
import {
  Mic,
  Volume2,
  Phone,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { VapiCallStatus } from '../hooks/useVapiWebClient';

// ======================
// TYPES
// ======================

type CallState = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

interface StatusConfig {
  icon: React.ReactNode;
  text: string;
  color: string;
  bgColor: string;
  animate: boolean;
}

interface StatusIndicatorProps {
  /** Estado actual (puede ser VapiCallStatus o CallState) */
  status: VapiCallStatus | CallState;
  /** Modo actual */
  mode: 'text' | 'call';
  /** Tamaño del indicador */
  size?: 'sm' | 'md' | 'lg';
}

// ======================
// CONSTANTS
// ======================

const TIS_CORAL = 'rgb(223, 115, 115)';
const TIS_GREEN = 'rgb(34, 197, 94)';

// ======================
// COMPONENT
// ======================

export function StatusIndicator({
  status,
  mode,
  size = 'md',
}: StatusIndicatorProps) {
  const getStatusConfig = (): StatusConfig | null => {
    if (mode === 'call') {
      switch (status) {
        case 'speaking':
          return {
            icon: <Volume2 className={getIconSize(size)} />,
            text: 'El asistente está hablando...',
            color: TIS_CORAL,
            bgColor: 'rgba(223, 115, 115, 0.1)',
            animate: true,
          };
        case 'listening':
          return {
            icon: <Mic className={getIconSize(size)} />,
            text: 'Te escucho...',
            color: TIS_GREEN,
            bgColor: 'rgba(34, 197, 94, 0.1)',
            animate: true,
          };
        case 'connected':
        case 'active':
          return {
            icon: <Phone className={getIconSize(size)} />,
            text: 'Llamada activa',
            color: TIS_GREEN,
            bgColor: 'rgba(34, 197, 94, 0.1)',
            animate: false,
          };
        case 'connecting':
          return {
            icon: <Loader2 className={`${getIconSize(size)} animate-spin`} />,
            text: 'Conectando...',
            color: 'rgb(148, 163, 184)',
            bgColor: 'rgba(148, 163, 184, 0.1)',
            animate: false,
          };
        case 'ended':
          return {
            icon: <CheckCircle className={getIconSize(size)} />,
            text: 'Llamada finalizada',
            color: 'rgb(148, 163, 184)',
            bgColor: 'rgba(148, 163, 184, 0.1)',
            animate: false,
          };
        case 'error':
          return {
            icon: <AlertCircle className={getIconSize(size)} />,
            text: 'Error en la llamada',
            color: 'rgb(239, 68, 68)',
            bgColor: 'rgba(239, 68, 68, 0.1)',
            animate: false,
          };
        default:
          return null;
      }
    }

    // Modo texto
    switch (status) {
      case 'active':
        return {
          icon: <MessageSquare className={getIconSize(size)} />,
          text: 'Chat activo',
          color: TIS_GREEN,
          bgColor: 'rgba(34, 197, 94, 0.1)',
          animate: false,
        };
      case 'connecting':
        return {
          icon: <Loader2 className={`${getIconSize(size)} animate-spin`} />,
          text: 'Conectando...',
          color: 'rgb(148, 163, 184)',
          bgColor: 'rgba(148, 163, 184, 0.1)',
          animate: false,
        };
      case 'ended':
        return {
          icon: <CheckCircle className={getIconSize(size)} />,
          text: 'Chat finalizado',
          color: 'rgb(148, 163, 184)',
          bgColor: 'rgba(148, 163, 184, 0.1)',
          animate: false,
        };
      case 'error':
        return {
          icon: <AlertCircle className={getIconSize(size)} />,
          text: 'Error de conexión',
          color: 'rgb(239, 68, 68)',
          bgColor: 'rgba(239, 68, 68, 0.1)',
          animate: false,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-2',
    lg: 'px-4 py-2 text-sm gap-2',
  };

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={config.text}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`inline-flex items-center rounded-full ${sizeClasses[size]}`}
      style={{ backgroundColor: config.bgColor }}
    >
      <span
        className={config.animate ? 'animate-pulse' : ''}
        style={{ color: config.color }}
        aria-hidden="true"
      >
        {config.icon}
      </span>
      <span className="font-medium" style={{ color: config.color }}>
        {config.text}
      </span>
    </motion.div>
  );
}

// ======================
// HELPERS
// ======================

function getIconSize(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'w-3 h-3';
    case 'md':
      return 'w-4 h-4';
    case 'lg':
      return 'w-5 h-5';
  }
}

export default StatusIndicator;
