# FASE 6: Plan-Based Usage Limits

## Objetivo
Implementar un sistema robusto de control de uso basado en el plan de suscripcion del tenant, con notificaciones proactivas y upgrade prompts.

---

## Limites por Plan

| Plan | Precio/mes | Mensajes/dia | Archivos/dia | Vision/dia | Tokens/dia |
|------|------------|--------------|--------------|------------|------------|
| **Starter** | $3,490 | 20 | 3 | 2 | 10,000 |
| **Essentials** | $7,490 | 50 | 10 | 5 | 50,000 |
| **Growth** | $12,490 | 200 | 50 | 25 | 200,000 |
| **Enterprise** | Custom | Ilimitado | Ilimitado | Ilimitado | Ilimitado |

---

## Microfases

### 6.1 Plan Configuration

**Archivo:** `src/features/setup-assistant/config/limits.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Limits Config
// =====================================================

export type PlanId = 'starter' | 'essentials' | 'growth' | 'enterprise';

export interface PlanLimits {
  messagesPerDay: number;
  filesPerDay: number;
  visionRequestsPerDay: number;
  tokensPerDay: number;
  features: {
    visionAnalysis: boolean;
    bulkImport: boolean;
    customPrompts: boolean;
    advancedAnalytics: boolean;
  };
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    messagesPerDay: 20,
    filesPerDay: 3,
    visionRequestsPerDay: 2,
    tokensPerDay: 10000,
    features: {
      visionAnalysis: true,
      bulkImport: false,
      customPrompts: false,
      advancedAnalytics: false,
    },
  },
  essentials: {
    messagesPerDay: 50,
    filesPerDay: 10,
    visionRequestsPerDay: 5,
    tokensPerDay: 50000,
    features: {
      visionAnalysis: true,
      bulkImport: true,
      customPrompts: false,
      advancedAnalytics: false,
    },
  },
  growth: {
    messagesPerDay: 200,
    filesPerDay: 50,
    visionRequestsPerDay: 25,
    tokensPerDay: 200000,
    features: {
      visionAnalysis: true,
      bulkImport: true,
      customPrompts: true,
      advancedAnalytics: true,
    },
  },
  enterprise: {
    messagesPerDay: 999999,
    filesPerDay: 999999,
    visionRequestsPerDay: 999999,
    tokensPerDay: 999999999,
    features: {
      visionAnalysis: true,
      bulkImport: true,
      customPrompts: true,
      advancedAnalytics: true,
    },
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function getPlanLimits(planId: string): PlanLimits {
  const normalizedPlanId = planId.toLowerCase() as PlanId;
  return PLAN_LIMITS[normalizedPlanId] || PLAN_LIMITS.starter;
}

export function isAtLimit(
  usage: { messages: number; files: number; vision: number },
  limits: PlanLimits
): boolean {
  return (
    usage.messages >= limits.messagesPerDay ||
    usage.files >= limits.filesPerDay ||
    usage.vision >= limits.visionRequestsPerDay
  );
}

export function getLimitPercentage(current: number, limit: number): number {
  if (limit === 0) return 100;
  return Math.min(100, Math.round((current / limit) * 100));
}

export function shouldShowUpgradePrompt(
  usage: { messages: number; files: number; vision: number },
  limits: PlanLimits
): boolean {
  const messagePercentage = getLimitPercentage(usage.messages, limits.messagesPerDay);
  const filePercentage = getLimitPercentage(usage.files, limits.filesPerDay);
  const visionPercentage = getLimitPercentage(usage.vision, limits.visionRequestsPerDay);

  // Show prompt if any limit is at 80% or more
  return messagePercentage >= 80 || filePercentage >= 80 || visionPercentage >= 80;
}
```

**Criterios de aceptación:**
- [ ] Límites definidos por plan
- [ ] Funciones helper implementadas
- [ ] Tipos exportados

---

### 6.2 Update Database Function

**Archivo:** `supabase/migrations/161_SETUP_ASSISTANT_LIMITS_UPDATE.sql`

```sql
-- =====================================================
-- TIS TIS PLATFORM - Migration 161
-- UPDATE SETUP ASSISTANT LIMITS FUNCTION
-- =====================================================

-- Drop and recreate with better plan detection
DROP FUNCTION IF EXISTS get_setup_usage_with_limits(UUID);

CREATE OR REPLACE FUNCTION get_setup_usage_with_limits(
  p_tenant_id UUID
) RETURNS TABLE (
  messages_count INT,
  messages_limit INT,
  files_uploaded INT,
  files_limit INT,
  vision_requests INT,
  vision_limit INT,
  tokens_used BIGINT,
  tokens_limit BIGINT,
  plan_id TEXT,
  plan_name TEXT,
  is_at_limit BOOLEAN,
  reset_at TIMESTAMPTZ
) AS $$
DECLARE
  v_plan_id TEXT;
  v_plan_name TEXT;
  v_limits RECORD;
  v_usage RECORD;
BEGIN
  -- Get active subscription plan
  SELECT
    COALESCE(s.plan_id, 'starter'),
    COALESCE(p.name, 'Starter')
  INTO v_plan_id, v_plan_name
  FROM tenants t
  LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
  LEFT JOIN plans p ON p.id = s.plan_id
  WHERE t.id = p_tenant_id;

  -- Fallback if no tenant found
  IF v_plan_id IS NULL THEN
    v_plan_id := 'starter';
    v_plan_name := 'Starter';
  END IF;

  -- Define limits based on plan
  CASE LOWER(v_plan_id)
    WHEN 'starter' THEN
      v_limits := ROW(20, 3, 2, 10000);
    WHEN 'essentials' THEN
      v_limits := ROW(50, 10, 5, 50000);
    WHEN 'growth' THEN
      v_limits := ROW(200, 50, 25, 200000);
    WHEN 'enterprise' THEN
      v_limits := ROW(999999, 999999, 999999, 999999999);
    ELSE
      v_limits := ROW(20, 3, 2, 10000);
  END CASE;

  -- Get current usage
  SELECT
    COALESCE(u.messages_count, 0),
    COALESCE(u.files_uploaded, 0),
    COALESCE(u.vision_requests, 0),
    COALESCE(u.total_input_tokens + u.total_output_tokens, 0)
  INTO v_usage
  FROM (SELECT 1) AS dummy
  LEFT JOIN setup_assistant_usage u
    ON u.tenant_id = p_tenant_id
    AND u.usage_date = CURRENT_DATE;

  -- Return result
  RETURN QUERY SELECT
    COALESCE(v_usage.f1, 0)::INT,
    v_limits.f1::INT,
    COALESCE(v_usage.f2, 0)::INT,
    v_limits.f2::INT,
    COALESCE(v_usage.f3, 0)::INT,
    v_limits.f3::INT,
    COALESCE(v_usage.f4, 0)::BIGINT,
    v_limits.f4::BIGINT,
    v_plan_id,
    v_plan_name,
    (
      COALESCE(v_usage.f1, 0) >= v_limits.f1 OR
      COALESCE(v_usage.f2, 0) >= v_limits.f2 OR
      COALESCE(v_usage.f3, 0) >= v_limits.f3
    )::BOOLEAN,
    -- Reset at midnight in tenant's timezone (default UTC)
    DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_setup_usage_with_limits IS
  'Returns current usage with plan-based limits and reset time';
```

**Criterios de aceptación:**
- [ ] Función actualizada con tokens
- [ ] Detecta plan correcto
- [ ] Retorna reset_at

---

### 6.3 Usage Service

**Archivo:** `src/features/setup-assistant/services/usage.service.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Setup Assistant Usage Service
// =====================================================

import { createServiceClient } from '@/src/shared/lib/supabase';
import { getPlanLimits, type PlanLimits } from '../config/limits';
import type { UsageInfo } from '../types';

export interface DetailedUsageInfo extends UsageInfo {
  tokensUsed: number;
  tokensLimit: number;
  resetAt: Date;
  percentages: {
    messages: number;
    files: number;
    vision: number;
    tokens: number;
  };
}

export class UsageService {
  private static instance: UsageService;

  private constructor() {}

  static getInstance(): UsageService {
    if (!UsageService.instance) {
      UsageService.instance = new UsageService();
    }
    return UsageService.instance;
  }

  /**
   * Get detailed usage info for a tenant
   */
  async getUsage(tenantId: string): Promise<DetailedUsageInfo> {
    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('get_setup_usage_with_limits', {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('[UsageService] Error getting usage:', error);
      throw new Error('Failed to get usage');
    }

    const usage = data?.[0];
    if (!usage) {
      // Return defaults
      const defaultLimits = getPlanLimits('starter');
      return {
        messagesCount: 0,
        messagesLimit: defaultLimits.messagesPerDay,
        filesUploaded: 0,
        filesLimit: defaultLimits.filesPerDay,
        visionRequests: 0,
        visionLimit: defaultLimits.visionRequestsPerDay,
        planId: 'starter',
        isAtLimit: false,
        tokensUsed: 0,
        tokensLimit: defaultLimits.tokensPerDay,
        resetAt: this.getNextResetTime(),
        percentages: {
          messages: 0,
          files: 0,
          vision: 0,
          tokens: 0,
        },
      };
    }

    return {
      messagesCount: usage.messages_count,
      messagesLimit: usage.messages_limit,
      filesUploaded: usage.files_uploaded,
      filesLimit: usage.files_limit,
      visionRequests: usage.vision_requests,
      visionLimit: usage.vision_limit,
      planId: usage.plan_id,
      isAtLimit: usage.is_at_limit,
      tokensUsed: usage.tokens_used,
      tokensLimit: usage.tokens_limit,
      resetAt: new Date(usage.reset_at),
      percentages: {
        messages: this.calculatePercentage(usage.messages_count, usage.messages_limit),
        files: this.calculatePercentage(usage.files_uploaded, usage.files_limit),
        vision: this.calculatePercentage(usage.vision_requests, usage.vision_limit),
        tokens: this.calculatePercentage(usage.tokens_used, usage.tokens_limit),
      },
    };
  }

  /**
   * Check if a specific action is allowed
   */
  async canPerformAction(
    tenantId: string,
    action: 'message' | 'file' | 'vision'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const usage = await this.getUsage(tenantId);

    switch (action) {
      case 'message':
        if (usage.messagesCount >= usage.messagesLimit) {
          return {
            allowed: false,
            reason: `Has alcanzado el límite de ${usage.messagesLimit} mensajes diarios.`,
          };
        }
        break;

      case 'file':
        if (usage.filesUploaded >= usage.filesLimit) {
          return {
            allowed: false,
            reason: `Has alcanzado el límite de ${usage.filesLimit} archivos diarios.`,
          };
        }
        break;

      case 'vision':
        if (usage.visionRequests >= usage.visionLimit) {
          return {
            allowed: false,
            reason: `Has alcanzado el límite de ${usage.visionLimit} análisis de imagen diarios.`,
          };
        }
        break;
    }

    return { allowed: true };
  }

  /**
   * Get upgrade suggestions based on current usage
   */
  getUpgradeSuggestion(usage: DetailedUsageInfo): {
    shouldUpgrade: boolean;
    suggestedPlan: string;
    reason: string;
  } {
    const { planId, percentages } = usage;

    // Already on enterprise
    if (planId === 'enterprise') {
      return {
        shouldUpgrade: false,
        suggestedPlan: planId,
        reason: '',
      };
    }

    // Check if any limit is consistently high
    const highUsage = Object.values(percentages).some((p) => p >= 80);

    if (!highUsage) {
      return {
        shouldUpgrade: false,
        suggestedPlan: planId,
        reason: '',
      };
    }

    // Suggest next plan up
    const planUpgrades: Record<string, string> = {
      starter: 'essentials',
      essentials: 'growth',
      growth: 'enterprise',
    };

    const suggestedPlan = planUpgrades[planId] || 'enterprise';

    return {
      shouldUpgrade: true,
      suggestedPlan,
      reason: this.getUpgradeReason(percentages),
    };
  }

  private calculatePercentage(current: number, limit: number): number {
    if (limit <= 0 || limit >= 999999) return 0;
    return Math.min(100, Math.round((current / limit) * 100));
  }

  private getNextResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  private getUpgradeReason(percentages: Record<string, number>): string {
    const reasons: string[] = [];

    if (percentages.messages >= 80) {
      reasons.push('límite de mensajes');
    }
    if (percentages.files >= 80) {
      reasons.push('límite de archivos');
    }
    if (percentages.vision >= 80) {
      reasons.push('límite de análisis de imagen');
    }

    if (reasons.length === 0) {
      return 'Más capacidad para tu negocio';
    }

    return `Estás cerca del ${reasons.join(' y ')}. Actualiza para continuar sin interrupciones.`;
  }
}

export const usageService = UsageService.getInstance();
```

**Criterios de aceptación:**
- [ ] Servicio obtiene uso detallado
- [ ] Validación de acciones
- [ ] Sugerencias de upgrade

---

### 6.4 Upgrade Prompt Component

**Archivo:** `src/features/setup-assistant/components/UpgradePrompt.tsx`

```typescript
'use client';

// =====================================================
// TIS TIS PLATFORM - Upgrade Prompt Component
// =====================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/src/shared/components/ui/Button';
import { cn } from '@/src/shared/utils';
import type { DetailedUsageInfo } from '../services/usage.service';

// Icons
import {
  ArrowUpCircleIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface UpgradePromptProps {
  usage: DetailedUsageInfo;
  suggestedPlan: string;
  reason: string;
  onUpgrade: () => void;
  onDismiss: () => void;
  className?: string;
}

const appleEasing = [0.25, 0.1, 0.25, 1];

const PLAN_INFO: Record<string, { name: string; price: string; highlight: string }> = {
  essentials: {
    name: 'Essentials',
    price: '$7,490/mes',
    highlight: '50 mensajes/día, 10 archivos, 5 análisis',
  },
  growth: {
    name: 'Growth',
    price: '$12,490/mes',
    highlight: '200 mensajes/día, 50 archivos, 25 análisis',
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Personalizado',
    highlight: 'Sin límites, soporte prioritario',
  },
};

export function UpgradePrompt({
  usage,
  suggestedPlan,
  reason,
  onUpgrade,
  onDismiss,
  className,
}: UpgradePromptProps) {
  const planInfo = PLAN_INFO[suggestedPlan] || PLAN_INFO.essentials;

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
        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-tis-coral to-tis-pink flex items-center justify-center">
          <ArrowUpCircleIcon className="w-5 h-5 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Desbloquea más con {planInfo.name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {reason}
          </p>

          {/* Plan highlight */}
          <div className="mt-3 flex items-center gap-2 text-sm">
            <SparklesIcon className="w-4 h-4 text-tis-coral" />
            <span className="text-slate-700 dark:text-slate-300">
              {planInfo.highlight}
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
              Actualizar a {planInfo.name}
            </Button>
            <span className="text-xs text-slate-500">{planInfo.price}</span>
          </div>
        </div>
      </div>

      {/* Reset time */}
      <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tus límites se reinician{' '}
          <span className="font-medium">
            {formatResetTime(usage.resetAt)}
          </span>
        </p>
      </div>
    </motion.div>
  );
}

// =====================================================
// USAGE BAR
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

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span
          className={cn(
            'font-medium',
            isFull
              ? 'text-red-500'
              : isHigh
              ? 'text-amber-500'
              : 'text-slate-600 dark:text-slate-400'
          )}
        >
          {current}/{limit}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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

// =====================================================
// HELPERS
// =====================================================

function formatResetTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `en ${hours}h ${minutes}m`;
  }
  return `en ${minutes} minutos`;
}
```

**Criterios de aceptación:**
- [ ] Muestra uso actual
- [ ] Barras de progreso animadas
- [ ] CTA de upgrade
- [ ] Tiempo de reset

---

## Validación de Fase 6

```bash
# Verificar tipos
npm run typecheck

# Aplicar migración
supabase db push

# Verificar función actualizada
psql -c "SELECT * FROM get_setup_usage_with_limits('tenant-uuid')"

# Test manual
# 1. Usar hasta 80% del límite
# 2. Verificar que aparece UpgradePrompt
# 3. Usar hasta 100%
# 4. Verificar que se bloquea con mensaje
```

---

## Checklist de Fase 6

- [ ] 6.1 Config de límites por plan
- [ ] 6.2 Función SQL actualizada
- [ ] 6.3 UsageService implementado
- [ ] 6.4 UpgradePrompt component
- [ ] Migración aplicada
- [ ] Límites funcionan correctamente
- [ ] Upgrade prompt aparece a 80%
- [ ] Bloqueo funciona a 100%

---

## Siguiente Fase

→ [FASE-7-INTEGRATIONS.md](./FASE-7-INTEGRATIONS.md)
