// =====================================================
// TIS TIS PLATFORM - Template Card Component
// Card display for response templates with actions
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import { icons } from '../shared';
import { getTemplateTriggerType, TEMPLATE_CATEGORY_LABELS } from '../shared/config';

// ======================
// TYPES
// ======================
export interface ResponseTemplate {
  id: string;
  trigger_type: string;
  name: string;
  template_text: string;
  variables_available?: string[];
  is_active: boolean;
  use_count?: number;
  branch_id?: string;
}

interface TemplateCardProps {
  template: ResponseTemplate;
  colorScheme?: 'purple' | 'orange';
  onEdit: (template: ResponseTemplate) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDuplicate?: (template: ResponseTemplate) => void;
  isDeleting?: boolean;
}

// Icon mapping for template types
const iconMap: Record<string, React.ReactNode> = {
  messageSquare: icons.chat,
  hand: icons.sparkles,
  heart: icons.sparkles,
  refresh: icons.settings,
  calendarCheck: icons.calendar,
  bell: icons.alert,
  clock: icons.clock,
  currency: icons.currency || icons.info,
  mapPin: icons.location,
  user: icons.user,
  alertTriangle: icons.alert,
  alert: icons.alert,
  tag: icons.trending || icons.sparkles,
  sparkles: icons.sparkles,
};

// ======================
// COMPONENT
// ======================
export function TemplateCard({
  template,
  colorScheme = 'purple',
  onEdit,
  onDelete,
  onToggleActive,
  onDuplicate,
  isDeleting,
}: TemplateCardProps) {
  const triggerType = getTemplateTriggerType(template.trigger_type);

  const colors = colorScheme === 'purple'
    ? {
        badge: 'bg-purple-100 text-purple-700',
        border: 'border-purple-200',
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
      }
    : {
        badge: 'bg-orange-100 text-orange-700',
        border: 'border-orange-200',
        iconBg: 'bg-orange-50',
        iconColor: 'text-orange-600',
      };

  // Highlight variables in template text
  const highlightVariables = (text: string) => {
    const parts = text.split(/(\{[^}]+\})/g);
    return parts.map((part, index) => {
      if (part.match(/^\{[^}]+\}$/)) {
        return (
          <span key={index} className={cn(
            'px-1 py-0.5 rounded text-xs font-mono',
            colorScheme === 'purple' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
          )}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'bg-white rounded-xl border p-4 shadow-sm transition-all hover:shadow-md relative overflow-hidden',
        template.is_active ? 'border-slate-200' : 'border-slate-100 opacity-70',
        isDeleting && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Status Indicator Line - Visual feedback at top of card */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-1 transition-colors',
        template.is_active
          ? colorScheme === 'purple' ? 'bg-purple-500' : 'bg-orange-500'
          : 'bg-slate-200'
      )} />

      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
            colors.iconBg,
            colors.iconColor
          )}>
            {iconMap[triggerType?.icon || 'sparkles'] || icons.sparkles}
          </div>

          {/* Title and Category */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-slate-900 truncate">
                {template.name}
              </h4>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                colors.badge
              )}>
                {triggerType?.label || template.trigger_type}
              </span>
              {!template.is_active && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
                  Inactiva
                </span>
              )}
            </div>

            {/* Category subtitle */}
            <p className="text-xs text-slate-400 mt-0.5">
              {TEMPLATE_CATEGORY_LABELS[triggerType?.category || 'situations']}
              {template.use_count ? ` • Usado ${template.use_count} veces` : ''}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Edit Button */}
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Editar"
          >
            {icons.edit || icons.settings}
          </button>

          {/* Duplicate Button */}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(template)}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
              title="Duplicar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
              </svg>
            </button>
          )}

          {/* Delete Button */}
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title="Eliminar"
          >
            {icons.trash || icons.x}
          </button>
        </div>
      </div>

      {/* Content Preview with highlighted variables */}
      <div className="mt-3 pl-12">
        <p className="text-sm text-slate-600 line-clamp-2">
          {highlightVariables(template.template_text)}
        </p>

        {/* Variables badges */}
        {template.variables_available && template.variables_available.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {template.variables_available.slice(0, 5).map((variable) => (
              <span
                key={variable}
                className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 text-slate-500 rounded"
              >
                {variable}
              </span>
            ))}
            {template.variables_available.length > 5 && (
              <span className="px-1.5 py-0.5 text-xs text-slate-400">
                +{template.variables_available.length - 5} más
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer with toggle */}
      <div className="mt-3 pt-3 border-t border-slate-100 pl-12 flex items-center justify-end">
        {/* Active Toggle */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <span className={cn(
            'text-xs transition-colors',
            template.is_active ? 'text-emerald-600 font-medium' : 'text-slate-500'
          )}>
            {template.is_active ? 'Activa' : 'Inactiva'}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={template.is_active}
              onChange={(e) => onToggleActive(template.id, e.target.checked)}
              className="sr-only peer"
            />
            <div className={cn(
              'w-9 h-5 rounded-full transition-all duration-200 group-hover:shadow-md',
              template.is_active ? 'bg-emerald-500' : 'bg-slate-200'
            )} />
            <motion.div
              animate={{ x: template.is_active ? 16 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow"
            />
          </div>
        </label>
      </div>
    </motion.div>
  );
}

export default TemplateCard;
