'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/auth';

// Feature flag structure
interface FeatureFlag {
  feature_key: string;
  is_enabled: boolean;
  source_component: string | null;
  override_reason: string | null;
}

interface UseFeatureFlagsReturn {
  // Raw flags data
  flags: Record<string, boolean>;
  flagsLoading: boolean;
  flagsError: string | null;

  // Helper methods
  isEnabled: (flagKey: string) => boolean;
  isAnyEnabled: (flagKeys: string[]) => boolean;
  isAllEnabled: (flagKeys: string[]) => boolean;

  // Actions
  refreshFlags: () => Promise<void>;
}

// Default feature flags (for clients without configured flags)
const DEFAULT_FLAGS: Record<string, boolean> = {
  // Core (always enabled)
  auth_enabled: true,
  dashboard_enabled: true,
  notifications_enabled: true,

  // Common modules
  leads_enabled: true,
  appointments_enabled: true,
  conversations_enabled: true,

  // Optional modules (plan-dependent)
  patients_enabled: false,
  quotes_enabled: false,
  clinical_history_enabled: false,
  analytics_advanced_enabled: false,
  ai_chat_enabled: false,
  whatsapp_enabled: true,
  email_enabled: true,

  // Vertical-specific
  treatment_plans_enabled: false,
  inventory_enabled: false,
  reservations_enabled: false,
};

// Feature flags by plan (used when no DB flags exist)
const PLAN_DEFAULT_FLAGS: Record<string, string[]> = {
  starter: [
    'auth_enabled',
    'dashboard_enabled',
    'notifications_enabled',
    'leads_enabled',
    'appointments_enabled',
    'conversations_enabled',
    'whatsapp_enabled',
  ],
  essentials: [
    'auth_enabled',
    'dashboard_enabled',
    'notifications_enabled',
    'leads_enabled',
    'appointments_enabled',
    'conversations_enabled',
    'whatsapp_enabled',
    'email_enabled',
    'patients_enabled',
  ],
  growth: [
    'auth_enabled',
    'dashboard_enabled',
    'notifications_enabled',
    'leads_enabled',
    'appointments_enabled',
    'conversations_enabled',
    'whatsapp_enabled',
    'email_enabled',
    'patients_enabled',
    'quotes_enabled',
    'clinical_history_enabled',
    'ai_chat_enabled',
    'analytics_advanced_enabled',
  ],
  scale: [
    'auth_enabled',
    'dashboard_enabled',
    'notifications_enabled',
    'leads_enabled',
    'appointments_enabled',
    'conversations_enabled',
    'whatsapp_enabled',
    'email_enabled',
    'patients_enabled',
    'quotes_enabled',
    'clinical_history_enabled',
    'ai_chat_enabled',
    'analytics_advanced_enabled',
    'treatment_plans_enabled',
  ],
};

// Vertical-specific flags
const VERTICAL_FLAGS: Record<string, string[]> = {
  dental: [
    'patients_enabled',
    'quotes_enabled',
    'clinical_history_enabled',
    'treatment_plans_enabled',
  ],
  clinic: [
    'patients_enabled',
    'clinical_history_enabled',
    'treatment_plans_enabled',
  ],
  restaurant: [
    'reservations_enabled',
    'inventory_enabled',
  ],
  gym: [
    'patients_enabled', // members
  ],
};

// Hook to get feature flags for current client
export function useFeatureFlags(clientId?: string): UseFeatureFlagsReturn {
  const [flags, setFlags] = useState<Record<string, boolean>>(DEFAULT_FLAGS);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagsError, setFlagsError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    setFlagsError(null);

    try {
      // If clientId provided, load from feature_flags table
      if (clientId) {
        const { data, error } = await supabase
          .from('feature_flags')
          .select('feature_key, is_enabled, source_component, override_reason')
          .eq('client_id', clientId);

        if (error) {
          console.error('Error loading feature flags:', error);
          setFlagsError('Error cargando feature flags');
          return;
        }

        if (data && data.length > 0) {
          // Convert array to record
          const flagsRecord: Record<string, boolean> = { ...DEFAULT_FLAGS };
          data.forEach((flag: FeatureFlag) => {
            flagsRecord[flag.feature_key] = flag.is_enabled;
          });
          setFlags(flagsRecord);
          setFlagsLoading(false);
          return;
        }
      }

      // Fallback: try to get flags from user's tenant via user_roles
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select(`
            tenant_id,
            tenants (
              id,
              vertical,
              plan
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (roleData?.tenants) {
          const tenantData = roleData.tenants as any;
          const plan = tenantData.plan || 'essentials';
          const vertical = tenantData.vertical || 'dental';

          // Build flags from plan + vertical
          const planFlags = PLAN_DEFAULT_FLAGS[plan] || PLAN_DEFAULT_FLAGS.essentials;
          const verticalFlags = VERTICAL_FLAGS[vertical] || [];

          const flagsRecord: Record<string, boolean> = {};

          // Start with all defaults as false
          Object.keys(DEFAULT_FLAGS).forEach(key => {
            flagsRecord[key] = false;
          });

          // Enable plan flags
          planFlags.forEach(flag => {
            flagsRecord[flag] = true;
          });

          // Enable vertical flags if plan supports
          verticalFlags.forEach(flag => {
            if (planFlags.includes(flag) || ['growth', 'scale'].includes(plan)) {
              flagsRecord[flag] = true;
            }
          });

          setFlags(flagsRecord);
        }
      }

    } catch (err) {
      console.error('Error in useFeatureFlags:', err);
      setFlagsError('Error inesperado cargando flags');
    } finally {
      setFlagsLoading(false);
    }
  }, [clientId]);

  // Load flags on mount
  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Helper: check if a single flag is enabled
  const isEnabled = useCallback((flagKey: string): boolean => {
    return flags[flagKey] ?? false;
  }, [flags]);

  // Helper: check if ANY of the flags are enabled
  const isAnyEnabled = useCallback((flagKeys: string[]): boolean => {
    return flagKeys.some(key => flags[key] ?? false);
  }, [flags]);

  // Helper: check if ALL flags are enabled
  const isAllEnabled = useCallback((flagKeys: string[]): boolean => {
    return flagKeys.every(key => flags[key] ?? false);
  }, [flags]);

  return {
    flags,
    flagsLoading,
    flagsError,
    isEnabled,
    isAnyEnabled,
    isAllEnabled,
    refreshFlags: loadFlags,
  };
}

// Mapping of modules to their required feature flags
export const MODULE_FLAGS: Record<string, string> = {
  dashboard: 'dashboard_enabled',
  leads: 'leads_enabled',
  appointments: 'appointments_enabled',
  calendario: 'appointments_enabled',
  patients: 'patients_enabled',
  conversations: 'conversations_enabled',
  inbox: 'conversations_enabled',
  quotes: 'quotes_enabled',
  analytics: 'analytics_advanced_enabled',
  settings: 'auth_enabled', // Everyone can access settings
  clinical_history: 'clinical_history_enabled',
};

// Helper to check if a route/module should be accessible
export function canAccessModule(moduleName: string, flags: Record<string, boolean>): boolean {
  const flagKey = MODULE_FLAGS[moduleName];
  if (!flagKey) return true; // Unknown modules are accessible by default
  return flags[flagKey] ?? false;
}

// Export types
export type { FeatureFlag, UseFeatureFlagsReturn };
