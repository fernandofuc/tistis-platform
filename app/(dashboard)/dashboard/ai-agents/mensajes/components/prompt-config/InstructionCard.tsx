// =====================================================
// TIS TIS PLATFORM - Instruction Card Component
// Card display for prompt instructions with actions
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { icons } from '../shared';
import { getInstructionType, INSTRUCTION_CATEGORY_LABELS } from '../shared/config';

// ======================
// TYPES
// ======================
export interface Instruction {
  id: string;
  instruction_type: string;
  title: string;
  instruction: string;
  examples?: string | null;
  priority: number;
  include_in_prompt: boolean;
  is_active: boolean;
  profile_type?: 'business' | 'personal';
}

interface InstructionCardProps {
  instruction: Instruction;
  colorScheme?: 'purple' | 'orange';
  onEdit: (instruction: Instruction) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onToggleIncludeInPrompt: (id: string, include: boolean) => void;
  isDeleting?: boolean;
}

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  building: icons.building,
  sparkles: icons.sparkles,
  currency: icons.currency || icons.info,
  shield: icons.shield || icons.check,
  alert: icons.alert || icons.info,
  text: icons.text,
  trending: icons.trending || icons.sparkles,
  x: icons.x,
  check: icons.check,
};

// ======================
// COMPONENT
// ======================
export function InstructionCard({
  instruction,
  colorScheme = 'purple',
  onEdit,
  onDelete,
  onToggleActive,
  onToggleIncludeInPrompt,
  isDeleting,
}: InstructionCardProps) {
  const instructionType = getInstructionType(instruction.instruction_type);

  const colors = colorScheme === 'purple'
    ? {
        badge: 'bg-purple-100 text-purple-700',
        border: 'border-purple-200',
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        toggle: 'peer-checked:bg-purple-600',
      }
    : {
        badge: 'bg-orange-100 text-orange-700',
        border: 'border-orange-200',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
        toggle: 'peer-checked:bg-orange-600',
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'bg-white rounded-xl border p-4 shadow-sm transition-all hover:shadow-md',
        instruction.is_active ? 'border-slate-200' : 'border-slate-100 opacity-60',
        isDeleting && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            colors.iconBg,
            colors.iconColor
          )}>
            {iconMap[instructionType?.icon || 'sparkles'] || icons.sparkles}
          </div>

          {/* Title and Category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-slate-900 truncate">
                {instruction.title}
              </h4>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                colors.badge
              )}>
                {instructionType?.label || instruction.instruction_type}
              </span>
              {instruction.include_in_prompt && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                  En Prompt
                </span>
              )}
            </div>

            {/* Category subtitle */}
            <p className="text-xs text-slate-400 mt-0.5">
              {INSTRUCTION_CATEGORY_LABELS[instructionType?.category || 'behavior']}
              {instruction.priority > 0 && ` • Prioridad: ${instruction.priority}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Edit Button */}
          <button
            onClick={() => onEdit(instruction)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Editar"
          >
            {icons.edit || icons.settings}
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(instruction.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title="Eliminar"
          >
            {icons.trash || icons.x}
          </button>
        </div>
      </div>

      {/* Content Preview */}
      <div className="mt-3 pl-12">
        <p className="text-sm text-slate-600 line-clamp-2">
          {instruction.instruction}
        </p>

        {instruction.examples && (
          <p className="text-xs text-slate-400 mt-1 italic line-clamp-1">
            Ejemplo: {instruction.examples}
          </p>
        )}
      </div>

      {/* Footer with toggles */}
      <div className="mt-3 pt-3 border-t border-slate-100 pl-12 flex items-center justify-between">
        {/* Include in Prompt Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={instruction.include_in_prompt}
            onChange={(e) => onToggleIncludeInPrompt(instruction.id, e.target.checked)}
            className="sr-only peer"
          />
          <div className={cn(
            'w-8 h-4 bg-slate-200 rounded-full peer transition-colors',
            'peer-focus:ring-2 peer-focus:ring-offset-1',
            colors.toggle,
            'after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px]',
            'after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all',
            'peer-checked:after:translate-x-4 relative'
          )} />
          <span className="text-xs text-slate-500">Incluir en prompt</span>
        </label>

        {/* Active Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-slate-500">
            {instruction.is_active ? 'Activo' : 'Inactivo'}
          </span>
          <input
            type="checkbox"
            checked={instruction.is_active}
            onChange={(e) => onToggleActive(instruction.id, e.target.checked)}
            className="sr-only peer"
          />
          <div className={cn(
            'w-8 h-4 bg-slate-200 rounded-full peer transition-colors',
            'peer-checked:bg-emerald-500',
            'after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px]',
            'after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all',
            'peer-checked:after:translate-x-4 relative'
          )} />
        </label>
      </div>
    </motion.div>
  );
}

export default InstructionCard;
