'use client';

// =====================================================
// TIS TIS PLATFORM - Quick Actions Grid Component
// Inspired by Claude Cowork design, styled for TIS TIS
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import {
  UtensilsCrossed,
  Trophy,
  Bot,
  HelpCircle,
  Calendar,
  FileBarChart,
} from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface QuickAction {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  prompt: string;
  color: 'coral' | 'purple' | 'green' | 'blue' | 'amber' | 'pink';
}

interface QuickActionsGridProps {
  onActionClick: (prompt: string) => void;
  vertical?: string;
}

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// Color variants for action cards
const colorVariants = {
  coral: 'hover:border-tis-coral hover:shadow-tis-coral/20',
  purple: 'hover:border-purple-500 hover:shadow-purple-500/20',
  green: 'hover:border-emerald-500 hover:shadow-emerald-500/20',
  blue: 'hover:border-blue-500 hover:shadow-blue-500/20',
  amber: 'hover:border-amber-500 hover:shadow-amber-500/20',
  pink: 'hover:border-tis-pink hover:shadow-tis-pink/20',
};

const iconColorVariants = {
  coral: 'text-tis-coral',
  purple: 'text-purple-500',
  green: 'text-emerald-500',
  blue: 'text-blue-500',
  amber: 'text-amber-500',
  pink: 'text-tis-pink',
};

// =====================================================
// DEFAULT ACTIONS (can be customized per vertical)
// =====================================================

const defaultActions: QuickAction[] = [
  {
    id: 'menu',
    icon: UtensilsCrossed,
    title: 'Agregar productos',
    description: 'Sube una foto y agrego tu catálogo automáticamente',
    prompt: 'Quiero agregar mis productos o servicios al sistema',
    color: 'coral',
  },
  {
    id: 'loyalty',
    icon: Trophy,
    title: 'Programa de lealtad',
    description: 'Crea un sistema de puntos para premiar clientes',
    prompt: 'Quiero crear un programa de lealtad para mis clientes',
    color: 'amber',
  },
  {
    id: 'bot',
    icon: Bot,
    title: 'Configurar asistente',
    description: 'Personaliza cómo responde tu bot de WhatsApp',
    prompt: 'Quiero configurar la personalidad de mi asistente de WhatsApp',
    color: 'purple',
  },
  {
    id: 'faq',
    icon: HelpCircle,
    title: 'Crear FAQs',
    description: 'Define respuestas a preguntas frecuentes',
    prompt: 'Quiero crear FAQs para que el bot responda preguntas comunes',
    color: 'blue',
  },
  {
    id: 'schedule',
    icon: Calendar,
    title: 'Horarios y citas',
    description: 'Configura tu disponibilidad y agenda',
    prompt: 'Quiero configurar mis horarios de atención y sistema de citas',
    color: 'green',
  },
  {
    id: 'report',
    icon: FileBarChart,
    title: 'Crear reporte',
    description: 'Genera un PDF con las métricas de tu negocio',
    prompt: '__TRIGGER_REPORT_FLOW__',
    color: 'pink',
  },
];

// =====================================================
// COMPONENT
// =====================================================

export function QuickActionsGrid({ onActionClick, vertical }: QuickActionsGridProps) {
  // Could customize actions based on vertical in the future
  const actions = defaultActions;

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-3 gap-3"
      role="list"
      aria-label="Acciones rápidas de configuración"
    >
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          role="listitem"
          aria-label={`${action.title}: ${action.description}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.05 + index * 0.05,
            ease: appleEasing,
          }}
          onClick={() => onActionClick(action.prompt)}
          className={cn(
            'group text-left p-4 rounded-xl',
            'bg-white',
            'border border-slate-200',
            'hover:shadow-lg transition-all duration-300',
            'focus:outline-none focus:ring-2 focus:ring-tis-coral/50 focus:ring-offset-2',
            colorVariants[action.color]
          )}
        >
          <div className="flex flex-col gap-3">
            {/* Icon */}
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-slate-100',
                'group-hover:scale-110 transition-transform duration-300'
              )}
            >
              <action.icon className={cn('w-5 h-5', iconColorVariants[action.color])} />
            </div>

            {/* Content */}
            <div>
              <h3 className="font-medium text-slate-900 text-sm">
                {action.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {action.description}
              </p>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
