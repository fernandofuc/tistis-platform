'use client';

// =====================================================
// TIS TIS PLATFORM - Progress Panel Component
// Shows setup progress, workspace, and context
// Inspired by Claude Cowork right sidebar
// =====================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import {
  CheckCircle2,
  Circle,
  FolderOpen,
  FileText,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Building2,
  Clock,
} from 'lucide-react';
import type { MessageAttachment, UsageInfo } from '../types';

// =====================================================
// TYPES
// =====================================================

interface SetupProgress {
  id: string;
  label: string;
  completed: boolean;
}

interface ProgressPanelProps {
  // Progress tracking
  progress?: SetupProgress[];
  // Workspace files
  files?: MessageAttachment[];
  // Business context
  businessName?: string;
  vertical?: string;
  // Usage info
  usage?: UsageInfo | null;
  // Collapse state
  defaultExpanded?: boolean;
  className?: string;
}

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// Default progress items
const defaultProgress: SetupProgress[] = [
  { id: 'services', label: 'Productos/Servicios', completed: false },
  { id: 'loyalty', label: 'Programa de lealtad', completed: false },
  { id: 'bot', label: 'Asistente configurado', completed: false },
  { id: 'faq', label: 'FAQs creadas', completed: false },
  { id: 'schedule', label: 'Horarios definidos', completed: false },
];

// =====================================================
// COLLAPSIBLE SECTION COMPONENT
// =====================================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const sectionId = React.useId();

  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`section-${sectionId}`}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-tis-coral/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-500">{icon}</span>
          <span className="font-medium text-sm text-slate-700">
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-tis-coral/10 text-tis-coral">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`section-${sectionId}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: appleEasing }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export function ProgressPanel({
  progress = defaultProgress,
  files = [],
  businessName,
  vertical,
  usage,
  className,
}: ProgressPanelProps) {
  const completedCount = progress.filter((p) => p.completed).length;
  const totalCount = progress.length;
  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div
      className={cn(
        'h-full flex flex-col',
        'bg-white',
        'border-l border-slate-200',
        className
      )}
    >
      {/* Header with usage */}
      {usage && (
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">
              Uso de hoy
            </span>
            <span className="text-xs text-slate-400">
              {usage.messagesCount}/{usage.messagesLimit} mensajes
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                usage.isAtLimit
                  ? 'bg-red-500'
                  : usage.messagesCount / usage.messagesLimit > 0.8
                  ? 'bg-amber-500'
                  : 'bg-gradient-to-r from-tis-coral to-tis-pink'
              )}
              style={{ width: `${Math.min((usage.messagesCount / usage.messagesLimit) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Progress Section */}
        <CollapsibleSection
          title="Progreso"
          icon={<Sparkles className="w-4 h-4" />}
          badge={`${completedCount}/${totalCount}`}
        >
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: appleEasing }}
                  className="h-full bg-gradient-to-r from-tis-coral to-tis-pink rounded-full"
                />
              </div>
              <span className="text-xs font-medium text-slate-500">
                {Math.round(progressPercentage)}%
              </span>
            </div>

            {/* Progress items */}
            <div className="space-y-2">
              {progress.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, ease: appleEasing }}
                  className="flex items-center gap-2"
                >
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300" />
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      item.completed
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    )}
                  >
                    {item.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </CollapsibleSection>

        {/* Workspace Section */}
        <CollapsibleSection
          title="Carpeta de trabajo"
          icon={<FolderOpen className="w-4 h-4" />}
          badge={files.length > 0 ? files.length : undefined}
          defaultOpen={files.length > 0}
        >
          {files.length === 0 ? (
            <div className="py-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-100 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">
                Los archivos que subas aparecerán aquí
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <motion.div
                  key={`${file.url}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
                >
                  {file.type === 'image' || file.mimeType?.startsWith('image/') ? (
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-200 flex-shrink-0">
                      <img
                        src={file.url}
                        alt={file.filename}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-md bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <span className="text-sm text-slate-700 truncate flex-1">
                    {file.filename || 'Archivo'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Context Section */}
        <CollapsibleSection
          title="Contexto"
          icon={<Layers className="w-4 h-4" />}
        >
          <div className="space-y-3">
            {businessName && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {businessName}
                </span>
              </div>
            )}
            {vertical && (
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600 capitalize">
                  {vertical === 'restaurant' && 'Restaurante'}
                  {vertical === 'dental' && 'Clínica Dental'}
                  {vertical === 'clinic' && 'Consultorio'}
                  {vertical === 'beauty' && 'Salón de Belleza'}
                  {vertical === 'gym' && 'Gimnasio'}
                  {vertical === 'veterinary' && 'Veterinaria'}
                </span>
              </div>
            )}
            {!businessName && !vertical && (
              <p className="text-sm text-slate-400">
                El contexto de tu negocio aparecerá aquí mientras conversas
              </p>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Sesión activa</span>
        </div>
      </div>
    </div>
  );
}
