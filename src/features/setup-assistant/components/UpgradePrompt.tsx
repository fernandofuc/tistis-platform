'use client';

// =====================================================
// TIS TIS PLATFORM - Upgrade Prompt Component
// Sprint 5: Plan upgrade prompts for Setup Assistant
// =====================================================

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/src/shared/components/ui/Button';
import { cn } from '@/src/shared/utils';
import type { DetailedUsageInfo } from '../services/usage.service';
import { usageService } from '../services/usage.service';

// Icons (using lucide-react)
import { ArrowUpCircle, Sparkles, X } from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface UpgradePromptProps {
  usage: DetailedUsageInfo;
  suggestedPlanName: string;
  suggestedPlanPrice: string;
  suggestedPlanHighlight: string;
  reason: string;
  onUpgrade: () => void;
  onDismiss: () => void;
  className?: string;
}

// Apple-like easing
const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// =====================================================
// MAIN COMPONENT
// =====================================================

export function UpgradePrompt({
  usage,
  suggestedPlanName,
  suggestedPlanPrice,
  suggestedPlanHighlight,
  reason,
  onUpgrade,
  onDismiss,
  className,
}: UpgradePromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: appleEasing }}
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-gradient-to-br from-tis-coral/10 to-tis-pink/10',
        'border border-tis-coral/20',
        'p-4',
        className
      )}
    >
      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        aria-label="Cerrar sugerencia de upgrade"
        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
          <ArrowUpCircle className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-semibold text-slate-900">
            Desbloquea más con {suggestedPlanName}
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            {reason}
          </p>

          {/* Plan highlight */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-tis-coral" />
            <span className="text-slate-700">
              {suggestedPlanHighlight}
            </span>
          </div>

          {/* Usage bars */}
          <div className="mt-3 space-y-2">
            <UsageBar
              label="Mensajes"
              current={usage.messagesCount}
              limit={usage.messagesLimit}
              percentage={usage.percentages.messages}
            />
            <UsageBar
              label="Archivos"
              current={usage.filesUploaded}
              limit={usage.filesLimit}
              percentage={usage.percentages.files}
            />
            <UsageBar
              label="Vision"
              current={usage.visionRequests}
              limit={usage.visionLimit}
              percentage={usage.percentages.vision}
            />
          </div>

          {/* CTA */}
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={onUpgrade}
              className="bg-gradient-to-r from-tis-coral to-tis-pink hover:opacity-90"
            >
              Actualizar a {suggestedPlanName}
            </Button>
            <span className="text-xs text-slate-500">{suggestedPlanPrice}</span>
          </div>
        </div>
      </div>

      {/* Reset time */}
      {usage.resetAt && (
        <div className="mt-3 pt-3 border-t border-slate-200/50">
          <p className="text-xs text-slate-500">
            Tus límites se reinician{' '}
            <span className="font-medium">
              {usageService.formatResetTime(usage.resetAt)}
            </span>
          </p>
        </div>
      )}
    </motion.div>
  );
}

// =====================================================
// USAGE BAR COMPONENT
// =====================================================

interface UsageBarProps {
  label: string;
  current: number;
  limit: number;
  percentage: number;
}

function UsageBar({ label, current, limit, percentage }: UsageBarProps) {
  const isHigh = percentage >= 80;
  const isFull = percentage >= 100;

  // Don't show bar for unlimited plans
  if (limit >= 999999) {
    return null;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span
          className={cn(
            'font-medium',
            isFull
              ? 'text-red-500'
              : isHigh
              ? 'text-amber-500'
              : 'text-slate-600'
          )}
        >
          {current}/{limit}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: appleEasing }}
          className={cn(
            'h-full rounded-full',
            isFull
              ? 'bg-red-500'
              : isHigh
              ? 'bg-amber-500'
              : 'bg-tis-coral'
          )}
        />
      </div>
    </div>
  );
}
