'use client';

/**
 * TIS TIS Platform - Voice Agent
 * CapabilityBadge Component
 *
 * Displays a single capability as a styled badge with icon and tooltip.
 * Supports multiple visual states: included, not-included, new, default.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Building2,
  UserCheck,
  HelpCircle,
  Receipt,
  CalendarCheck,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
  Package,
  Tag,
  Calendar,
  Stethoscope,
  UserCircle,
  Shield,
  CalendarCog,
  AlertTriangle,
  Check,
  X,
  Star,
} from 'lucide-react';
import type { Capability } from '@/lib/voice-agent/types';
import {
  CAPABILITY_DISPLAY_NAMES,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_BADGE_VARIANTS,
  type CapabilityBadgeVariant,
} from '../constants/capability-display';

// =====================================================
// ICON MAP
// =====================================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Clock,
  Building2,
  UserCheck,
  HelpCircle,
  Receipt,
  CalendarCheck,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
  Package,
  Tag,
  Calendar,
  Stethoscope,
  UserCircle,
  Shield,
  CalendarCog,
  AlertTriangle,
};

const CAPABILITY_TO_ICON: Record<Capability, string> = {
  business_hours: 'Clock',
  business_info: 'Building2',
  human_transfer: 'UserCheck',
  faq: 'HelpCircle',
  invoicing: 'Receipt',
  reservations: 'CalendarCheck',
  menu_info: 'UtensilsCrossed',
  recommendations: 'Sparkles',
  orders: 'ShoppingBag',
  order_status: 'Package',
  promotions: 'Tag',
  appointments: 'Calendar',
  services_info: 'Stethoscope',
  doctor_info: 'UserCircle',
  insurance_info: 'Shield',
  appointment_management: 'CalendarCog',
  emergencies: 'AlertTriangle',
};

// =====================================================
// TYPES
// =====================================================

interface CapabilityBadgeProps {
  capability: Capability;
  variant?: CapabilityBadgeVariant;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  showIcon?: boolean;
  showStatusIcon?: boolean;
  className?: string;
}

// =====================================================
// COMPONENT
// =====================================================

export function CapabilityBadge({
  capability,
  variant = 'default',
  size = 'md',
  showTooltip = true,
  showIcon = true,
  showStatusIcon = true,
  className = '',
}: CapabilityBadgeProps) {
  const displayName = CAPABILITY_DISPLAY_NAMES[capability];
  const description = CAPABILITY_DESCRIPTIONS[capability];
  const iconName = CAPABILITY_TO_ICON[capability];
  const IconComponent = ICON_MAP[iconName];
  const styles = CAPABILITY_BADGE_VARIANTS[variant];

  // Size classes
  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs gap-1',
      icon: 'w-3 h-3',
      statusIcon: 'w-3 h-3',
    },
    md: {
      container: 'px-3 py-1.5 text-sm gap-1.5',
      icon: 'w-4 h-4',
      statusIcon: 'w-4 h-4',
    },
  };

  const sizes = sizeClasses[size];

  // Status icon based on variant
  const StatusIcon = () => {
    if (!showStatusIcon) return null;

    switch (variant) {
      case 'included':
        return <Check className={`${sizes.statusIcon} text-emerald-500 flex-shrink-0`} />;
      case 'not-included':
        return <X className={`${sizes.statusIcon} text-slate-300 flex-shrink-0`} />;
      case 'new':
        return <Star className={`${sizes.statusIcon} text-amber-500 flex-shrink-0 fill-amber-500`} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center rounded-lg border font-medium
        transition-all duration-200
        ${styles.container}
        ${sizes.container}
        ${className}
      `}
      title={showTooltip ? description : undefined}
    >
      {/* Status Icon (left side) */}
      <StatusIcon />

      {/* Capability Icon */}
      {showIcon && IconComponent && (
        <IconComponent className={`${sizes.icon} ${styles.icon} flex-shrink-0`} />
      )}

      {/* Display Name */}
      <span className={`${styles.text} truncate`}>{displayName}</span>

      {/* NEW badge for 'new' variant */}
      {variant === 'new' && (
        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded">
          Nuevo
        </span>
      )}
    </motion.div>
  );
}

// =====================================================
// COMPACT VERSION (for grids)
// =====================================================

interface CapabilityBadgeCompactProps {
  capability: Capability;
  isIncluded: boolean;
  isNew?: boolean;
  className?: string;
}

export function CapabilityBadgeCompact({
  capability,
  isIncluded,
  isNew = false,
  className = '',
}: CapabilityBadgeCompactProps) {
  const variant: CapabilityBadgeVariant = isNew
    ? 'new'
    : isIncluded
    ? 'included'
    : 'not-included';

  return (
    <CapabilityBadge
      capability={capability}
      variant={variant}
      size="sm"
      showStatusIcon={true}
      showIcon={true}
      className={className}
    />
  );
}

export default CapabilityBadge;
