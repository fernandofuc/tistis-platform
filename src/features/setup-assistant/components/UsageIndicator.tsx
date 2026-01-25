'use client';

// =====================================================
// TIS TIS PLATFORM - Usage Indicator Component
// Sprint 5: AI-powered configuration assistant
// =====================================================

import React from 'react';
import { cn } from '@/src/shared/utils';
import type { UsageInfo } from '../types';

// Icons (using lucide-react)
import { MessageCircle, ImageIcon, Eye } from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

interface UsageIndicatorProps {
  usage: UsageInfo;
  className?: string;
}

// =====================================================
// COMPONENT
// =====================================================

export function UsageIndicator({ usage, className }: UsageIndicatorProps) {
  const items = [
    {
      icon: MessageCircle,
      label: 'Mensajes',
      current: usage.messagesCount,
      limit: usage.messagesLimit,
    },
    {
      icon: ImageIcon,
      label: 'Archivos',
      current: usage.filesUploaded,
      limit: usage.filesLimit,
    },
    {
      icon: Eye,
      label: 'Vision',
      current: usage.visionRequests,
      limit: usage.visionLimit,
    },
  ];

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {items.map((item) => {
        const percentage = item.limit > 0 ? (item.current / item.limit) * 100 : 0;
        const isNearLimit = percentage >= 80;
        const isAtLimit = percentage >= 100;

        return (
          <div
            key={item.label}
            className="flex items-center gap-2"
            title={`${item.label}: ${item.current}/${item.limit}`}
          >
            <item.icon
              className={cn(
                'w-4 h-4',
                isAtLimit
                  ? 'text-red-500'
                  : isNearLimit
                  ? 'text-amber-500'
                  : 'text-slate-400'
              )}
            />
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  isAtLimit
                    ? 'text-red-500'
                    : isNearLimit
                    ? 'text-amber-500'
                    : 'text-slate-600'
                )}
              >
                {item.current}
              </span>
              <span className="text-xs text-slate-400">
                /{item.limit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
