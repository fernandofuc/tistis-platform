// =====================================================
// TIS TIS PLATFORM - Assistant Type Selector Component
// Premium UI component for selecting assistant types
// Design: Apple/Google/Lovable aesthetics with TIS TIS colors
// =====================================================

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import type { AgentTemplate, VerticalType, ProfileType } from '@/src/shared/config/agent-templates';
import { getTemplatesForVertical, AGENT_TEMPLATES } from '@/src/shared/config/agent-templates';
import { CAPABILITY_LABELS } from './config';

// ======================
// ICONS
// ======================

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ======================
// TYPES
// ======================

interface AssistantTypeSelectorProps {
  value: string;
  onChange: (templateKey: string) => void;
  vertical: VerticalType;
  profileType: ProfileType;
  colorScheme?: 'purple' | 'orange';
  disabled?: boolean;
}

// Capabilities that should show as "enabled" vs "disabled" for each template type
const CAPABILITY_DISPLAY_CONFIG: Record<string, { show: string[]; hide: string[] }> = {
  // Business templates
  dental_full: {
    show: ['booking', 'pricing', 'faq', 'lead_capture'],
    hide: [],
  },
  dental_appointments_only: {
    show: ['booking', 'location', 'hours'],
    hide: ['pricing', 'lead_capture'],
  },
  resto_full: {
    show: ['reservations', 'ordering', 'menu_info', 'location'],
    hide: [],
  },
  resto_reservations_only: {
    show: ['reservations', 'location', 'hours'],
    hide: ['ordering', 'menu_info'],
  },
  resto_orders_only: {
    show: ['ordering', 'menu_info', 'location'],
    hide: ['reservations'],
  },
  general_full: {
    show: ['booking', 'pricing', 'faq', 'lead_capture'],
    hide: [],
  },
  // Personal templates
  dental_personal_complete: {
    show: ['booking', 'pricing', 'faq', 'lead_capture'],
    hide: [],
  },
  dental_personal_brand: {
    show: ['faq', 'redirect_to_clinic'],
    hide: ['booking', 'pricing'],
  },
  dental_personal_redirect: {
    show: ['redirect_to_clinic'],
    hide: ['booking', 'pricing', 'faq'],
  },
};

// ======================
// COMPONENT
// ======================

export function AssistantTypeSelector({
  value,
  onChange,
  vertical,
  profileType,
  colorScheme = 'purple',
  disabled = false,
}: AssistantTypeSelectorProps) {
  // Get available templates for this vertical and profile type
  const templates = useMemo(
    () => getTemplatesForVertical(vertical, profileType),
    [vertical, profileType]
  );

  const colors = {
    purple: {
      border: 'border-purple-500',
      bg: 'bg-purple-50',
      iconBg: 'bg-purple-500',
      iconBgInactive: 'bg-slate-100',
      iconText: 'text-white',
      iconTextInactive: 'text-slate-600',
      badge: 'bg-purple-100 text-purple-700',
      badgeRecommended: 'bg-purple-500 text-white',
      capabilityEnabled: 'bg-emerald-100 text-emerald-700',
      capabilityDisabled: 'bg-slate-100 text-slate-400',
      checkBg: 'bg-purple-500',
    },
    orange: {
      border: 'border-orange-500',
      bg: 'bg-orange-50',
      iconBg: 'bg-orange-500',
      iconBgInactive: 'bg-slate-100',
      iconText: 'text-white',
      iconTextInactive: 'text-slate-600',
      badge: 'bg-orange-100 text-orange-700',
      badgeRecommended: 'bg-orange-500 text-white',
      capabilityEnabled: 'bg-emerald-100 text-emerald-700',
      capabilityDisabled: 'bg-slate-100 text-slate-400',
      checkBg: 'bg-orange-500',
    },
  };

  const c = colors[colorScheme];

  // Get capabilities to display for a template
  const getCapabilitiesToDisplay = (template: AgentTemplate) => {
    const config = CAPABILITY_DISPLAY_CONFIG[template.key];
    if (!config) {
      // Default: show first 4 capabilities as enabled
      return template.capabilities.slice(0, 4).map(cap => ({
        key: cap,
        label: CAPABILITY_LABELS[cap] || cap,
        enabled: true,
      }));
    }

    const result: { key: string; label: string; enabled: boolean }[] = [];

    // Add enabled capabilities
    config.show.forEach(cap => {
      result.push({
        key: cap,
        label: CAPABILITY_LABELS[cap] || cap,
        enabled: true,
      });
    });

    // Add disabled capabilities
    config.hide.forEach(cap => {
      result.push({
        key: cap,
        label: CAPABILITY_LABELS[cap] || cap,
        enabled: false,
      });
    });

    return result.slice(0, 4); // Limit to 4 for UI
  };

  // Determine grid columns based on number of templates
  const gridCols = templates.length <= 2
    ? 'grid-cols-1 md:grid-cols-2'
    : 'grid-cols-1 md:grid-cols-3';

  return (
    <div className={cn('grid gap-4', gridCols)}>
      {templates.map((template) => {
        const isSelected = value === template.key;
        const capabilities = getCapabilitiesToDisplay(template);

        return (
          <motion.button
            key={template.key}
            onClick={() => !disabled && onChange(template.key)}
            disabled={disabled}
            whileHover={!disabled ? { scale: 1.01 } : undefined}
            whileTap={!disabled ? { scale: 0.99 } : undefined}
            className={cn(
              'relative p-5 rounded-2xl border-2 text-left transition-all duration-200',
              isSelected
                ? `${c.border} ${c.bg} shadow-md`
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Recommended badge - positioned absolutely */}
            {template.isDefault && (
              <span className={cn(
                'absolute -top-2.5 -right-2.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm',
                c.badgeRecommended
              )}>
                Recomendado
              </span>
            )}

            {/* Selected indicator */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center',
                  c.checkBg, 'text-white'
                )}
              >
                <CheckIcon />
              </motion.div>
            )}

            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl',
                isSelected ? c.iconBg : c.iconBgInactive,
                isSelected ? c.iconText : c.iconTextInactive
              )}>
                {template.icon || '🤖'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-6">
                <h4 className="font-bold text-slate-900 text-base mb-1">
                  {template.name}
                </h4>
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-3">
                  {template.description}
                </p>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1.5">
                  {capabilities.map((cap) => (
                    <span
                      key={cap.key}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                        cap.enabled ? c.capabilityEnabled : c.capabilityDisabled
                      )}
                    >
                      {cap.enabled ? <CheckIcon /> : <XIcon />}
                      {cap.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default AssistantTypeSelector;
