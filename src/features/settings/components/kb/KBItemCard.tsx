// =====================================================
// TIS TIS PLATFORM - KB Item Card Premium
// Premium card design for knowledge base items
// Part of Knowledge Base Redesign - FASE 3
// =====================================================

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { KBCategory } from './KBCategoryNavigation';

// ======================
// TYPES
// ======================
interface Props {
  id: string;
  category: KBCategory;
  type: string;
  title: string;
  content: string;
  isActive: boolean;
  branchName?: string | null;
  priority?: number;
  // For templates
  variables?: string[];
  // For competitors
  talkingPoints?: string[];
  strategy?: string;
  // Actions
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive?: (id: string, newState: boolean) => void;
  className?: string;
}

// ======================
// CATEGORY COLORS
// ======================
const CATEGORY_COLORS: Record<KBCategory, {
  gradient: string;
  bg: string;
  text: string;
  border: string;
  iconBg: string;
  activeDot: string;
}> = {
  instructions: {
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    iconBg: 'bg-violet-100',
    activeDot: 'bg-violet-500',
  },
  policies: {
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    activeDot: 'bg-emerald-500',
  },
  articles: {
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    iconBg: 'bg-blue-100',
    activeDot: 'bg-blue-500',
  },
  templates: {
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    activeDot: 'bg-amber-500',
  },
  competitors: {
    gradient: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    activeDot: 'bg-rose-500',
  },
};

// ======================
// ICONS
// ======================
const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const LocationIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
  </svg>
);

const ExpandIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const VariableIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// ======================
// MAIN COMPONENT
// ======================
export function KBItemCard({
  id,
  category,
  type,
  title,
  content,
  isActive,
  branchName,
  priority,
  variables,
  talkingPoints,
  strategy,
  onEdit,
  onDelete,
  onToggleActive,
  className,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = CATEGORY_COLORS[category];

  // Check if content is long enough to expand
  const isExpandable = content.length > 150 || (talkingPoints && talkingPoints.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative rounded-2xl border transition-all duration-300',
        'bg-white',
        isActive
          ? `border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md`
          : 'border-gray-200 opacity-60',
        className
      )}
    >
      {/* Active indicator line */}
      <div className={cn(
        'absolute left-0 top-4 bottom-4 w-1 rounded-full transition-all',
        isActive ? colors.activeDot : 'bg-gray-300'
      )} />

      <div className="p-5 pl-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {/* Type badge */}
              <span className={cn(
                'inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg',
                isActive
                  ? `bg-gradient-to-r ${colors.gradient} text-white`
                  : 'bg-gray-100 text-gray-500'
              )}>
                {type}
              </span>

              {/* Priority badge (for instructions) */}
              {priority !== undefined && priority > 0 && (
                <span className={cn(
                  'inline-flex items-center text-xs font-medium px-2 py-1 rounded-lg',
                  isActive
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  Prioridad: {priority}
                </span>
              )}

              {/* Strategy badge (for competitors) */}
              {strategy && (
                <span className={cn(
                  'inline-flex items-center text-xs font-medium px-2 py-1 rounded-lg',
                  isActive
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  {strategy}
                </span>
              )}

              {/* Branch badge */}
              {branchName && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg',
                  isActive
                    ? 'bg-blue-50 text-blue-600 border border-blue-100'
                    : 'bg-gray-100 text-gray-500'
                )}>
                  <LocationIcon />
                  {branchName}
                </span>
              )}

              {/* Inactive indicator */}
              {!isActive && (
                <span className="text-xs text-gray-400 italic">
                  Pausado
                </span>
              )}
            </div>

            {/* Title */}
            <h5 className={cn(
              'font-semibold text-base leading-tight',
              isActive ? 'text-gray-900' : 'text-gray-500'
            )}>
              {title}
            </h5>
          </div>

          {/* Active status dot */}
          <div className={cn(
            'flex-shrink-0 w-3 h-3 rounded-full mt-1 transition-colors',
            isActive ? 'bg-green-400' : 'bg-gray-300'
          )} />
        </div>

        {/* Content preview */}
        <div className="mb-3">
          <p className={cn(
            'text-sm leading-relaxed',
            isActive ? 'text-gray-600' : 'text-gray-400',
            !isExpanded && 'line-clamp-2'
          )}>
            {content}
          </p>

          {/* Talking points (for competitors) */}
          <AnimatePresence>
            {isExpanded && talkingPoints && talkingPoints.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t border-gray-100"
              >
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Puntos Clave:
                </p>
                <ul className="space-y-1">
                  {talkingPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2', colors.activeDot)} />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Variables (for templates) */}
        {variables && variables.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-xs text-gray-400">Variables:</span>
            {variables.map((v) => (
              <span
                key={v}
                className={cn(
                  'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                  isActive
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-gray-100 text-gray-500'
                )}
              >
                <VariableIcon />
                {v}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Expand button + Actions */}
        <div className="flex items-center justify-between">
          {/* Expand button */}
          {isExpandable ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'flex items-center gap-1 text-xs font-medium transition-colors',
                isActive
                  ? 'text-gray-500 hover:text-gray-700'
                  : 'text-gray-400'
              )}
            >
              <motion.span
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ExpandIcon />
              </motion.span>
              {isExpanded ? 'Ver menos' : 'Ver más'}
            </button>
          ) : (
            <div />
          )}

          {/* Actions */}
          <div className={cn(
            'flex items-center gap-1 transition-opacity',
            'opacity-0 group-hover:opacity-100'
          )}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onEdit}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                'text-gray-400 hover:text-purple-600 hover:bg-purple-50',
                'dark:text-gray-500'
              )}
              title="Editar"
            >
              <EditIcon />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDelete}
              className={cn(
                'p-2.5 rounded-xl transition-all',
                'text-gray-400 hover:text-red-500 hover:bg-red-50',
                'dark:text-gray-500'
              )}
              title="Eliminar"
            >
              <DeleteIcon />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ======================
// EXPORTS
// ======================
export type { Props as KBItemCardProps };
