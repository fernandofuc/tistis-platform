/**
 * TIS TIS Platform - Voice Agent v2.0
 * Feature Flags Management (Simplified)
 *
 * Simple on/off toggle for Voice Agent functionality.
 * The v1/v2 rollout system has been removed - this is now v2-only.
 *
 * This module provides:
 * - Global enable/disable for voice agent
 * - Tenant-level overrides (enable/disable specific tenants)
 * - Audit logging for changes
 *
 * @module lib/feature-flags/voice-agent-v2
 * @version 2.0.0
 */

import { supabaseAdmin } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

/**
 * Voice Agent feature flag configuration
 */
export interface VoiceAgentFlags {
  /** Whether voice agent is globally enabled */
  enabled: boolean;
  /** Tenants explicitly enabled (overrides global) */
  enabledTenants: string[];
  /** Tenants explicitly disabled (overrides global) */
  disabledTenants: string[];
  /** Last update timestamp */
  updatedAt: string;
  /** Who made the last update */
  updatedBy: string | null;
}

/**
 * Voice Agent status for a specific tenant
 */
export interface TenantVoiceStatus {
  /** Whether voice agent is enabled for this tenant */
  enabled: boolean;
  /** Override type if applicable */
  overrideType: 'enabled' | 'disabled' | 'global' | null;
}

/**
 * Audit log entry for flag changes
 */
export interface FlagAuditEntry {
  id: string;
  flagName: string;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changedBy: string | null;
  reason: string | null;
  createdAt: string;
}

// =====================================================
// CACHE
// =====================================================

/**
 * In-memory cache for tenant voice status
 * Prevents excessive database queries for hot paths
 */
const statusCache = new Map<string, { value: boolean; expiry: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute
const CACHE_MAX_SIZE = 10_000;

/**
 * Clear the status cache
 * Call after any flag updates
 */
export function clearVoiceStatusCache(): void {
  statusCache.clear();
}

/**
 * Evict expired entries from cache
 */
function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of statusCache.entries()) {
    if (entry.expiry <= now) {
      statusCache.delete(key);
    }
  }
}

// =====================================================
// FEATURE FLAG OPERATIONS
// =====================================================

/**
 * Get Voice Agent feature flags configuration
 */
export async function getVoiceAgentFlags(): Promise<VoiceAgentFlags> {
  const { data, error } = await supabaseAdmin
    .from('platform_feature_flags')
    .select('*')
    .eq('name', 'voice_agent')
    .single();

  if (error || !data) {
    // Return default enabled state if not found
    return {
      enabled: true, // v2 is now the default
      enabledTenants: [],
      disabledTenants: [],
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }

  return {
    enabled: data.enabled ?? true,
    enabledTenants: data.enabled_tenants ?? [],
    disabledTenants: data.disabled_tenants ?? [],
    updatedAt: data.updated_at ?? new Date().toISOString(),
    updatedBy: data.updated_by ?? null,
  };
}

/**
 * Check if voice agent is enabled for a specific tenant
 *
 * Decision logic:
 * 1. If tenant is explicitly disabled → false
 * 2. If tenant is explicitly enabled → true
 * 3. Otherwise, use global enabled state
 */
export async function isVoiceAgentEnabled(tenantId: string): Promise<boolean> {
  // Validate tenantId
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    return false;
  }

  const flags = await getVoiceAgentFlags();

  // If tenant is explicitly disabled
  if (flags.disabledTenants.includes(tenantId)) {
    return false;
  }

  // If tenant is explicitly enabled
  if (flags.enabledTenants.includes(tenantId)) {
    return true;
  }

  // Use global state
  return flags.enabled;
}

/**
 * Check if voice agent is enabled (cached version)
 * Use this in hot paths like webhook handling
 */
export async function isVoiceAgentEnabledCached(tenantId: string): Promise<boolean> {
  // Quick validation
  if (!tenantId || tenantId.trim() === '') {
    return false;
  }

  const now = Date.now();
  const cached = statusCache.get(tenantId);

  if (cached && cached.expiry > now) {
    return cached.value;
  }

  const value = await isVoiceAgentEnabled(tenantId);

  // Evict expired entries if cache is full
  if (statusCache.size >= CACHE_MAX_SIZE) {
    evictExpiredEntries();
    // If still full, clear oldest 10%
    if (statusCache.size >= CACHE_MAX_SIZE) {
      const keysToDelete = Array.from(statusCache.keys()).slice(0, Math.floor(CACHE_MAX_SIZE * 0.1));
      keysToDelete.forEach((key) => statusCache.delete(key));
    }
  }

  statusCache.set(tenantId, {
    value,
    expiry: now + CACHE_TTL_MS,
  });

  return value;
}

/**
 * Get detailed voice status for a tenant
 */
export async function getTenantVoiceStatus(tenantId: string): Promise<TenantVoiceStatus> {
  const flags = await getVoiceAgentFlags();

  if (flags.disabledTenants.includes(tenantId)) {
    return { enabled: false, overrideType: 'disabled' };
  }

  if (flags.enabledTenants.includes(tenantId)) {
    return { enabled: true, overrideType: 'enabled' };
  }

  return { enabled: flags.enabled, overrideType: 'global' };
}

// =====================================================
// FLAG MANAGEMENT
// =====================================================

/**
 * Enable Voice Agent globally
 */
export async function enableVoiceAgent(updatedBy?: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .upsert({
      name: 'voice_agent',
      enabled: true,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    }, {
      onConflict: 'name',
    });

  if (error) {
    throw new Error(`Failed to enable voice agent: ${error.message}`);
  }

  clearVoiceStatusCache();
}

/**
 * Disable Voice Agent globally
 */
export async function disableVoiceAgent(updatedBy?: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .upsert({
      name: 'voice_agent',
      enabled: false,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    }, {
      onConflict: 'name',
    });

  if (error) {
    throw new Error(`Failed to disable voice agent: ${error.message}`);
  }

  clearVoiceStatusCache();
}

// =====================================================
// TENANT-SPECIFIC OVERRIDES
// =====================================================

/**
 * Enable voice agent for a specific tenant
 */
export async function enableTenantVoiceAgent(
  tenantId: string,
  updatedBy?: string
): Promise<void> {
  const flags = await getVoiceAgentFlags();

  // Remove from disabled list if present
  const disabledTenants = flags.disabledTenants.filter((id) => id !== tenantId);

  // Add to enabled list if not present
  const enabledTenants = flags.enabledTenants.includes(tenantId)
    ? flags.enabledTenants
    : [...flags.enabledTenants, tenantId];

  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .upsert({
      name: 'voice_agent',
      enabled: flags.enabled,
      enabled_tenants: enabledTenants,
      disabled_tenants: disabledTenants,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    }, {
      onConflict: 'name',
    });

  if (error) {
    throw new Error(`Failed to enable tenant: ${error.message}`);
  }

  clearVoiceStatusCache();
}

/**
 * Disable voice agent for a specific tenant
 */
export async function disableTenantVoiceAgent(
  tenantId: string,
  updatedBy?: string
): Promise<void> {
  const flags = await getVoiceAgentFlags();

  // Remove from enabled list if present
  const enabledTenants = flags.enabledTenants.filter((id) => id !== tenantId);

  // Add to disabled list if not present
  const disabledTenants = flags.disabledTenants.includes(tenantId)
    ? flags.disabledTenants
    : [...flags.disabledTenants, tenantId];

  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .upsert({
      name: 'voice_agent',
      enabled: flags.enabled,
      enabled_tenants: enabledTenants,
      disabled_tenants: disabledTenants,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    }, {
      onConflict: 'name',
    });

  if (error) {
    throw new Error(`Failed to disable tenant: ${error.message}`);
  }

  clearVoiceStatusCache();
}

/**
 * Remove tenant from all override lists (use global behavior)
 */
export async function resetTenantVoiceOverride(
  tenantId: string,
  updatedBy?: string
): Promise<void> {
  const flags = await getVoiceAgentFlags();

  const enabledTenants = flags.enabledTenants.filter((id) => id !== tenantId);
  const disabledTenants = flags.disabledTenants.filter((id) => id !== tenantId);

  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .upsert({
      name: 'voice_agent',
      enabled: flags.enabled,
      enabled_tenants: enabledTenants,
      disabled_tenants: disabledTenants,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    }, {
      onConflict: 'name',
    });

  if (error) {
    throw new Error(`Failed to reset tenant override: ${error.message}`);
  }

  clearVoiceStatusCache();
}

// =====================================================
// AUDIT AND HISTORY
// =====================================================

/**
 * Get audit history for the voice agent flag
 */
export async function getVoiceAgentAuditLog(limit: number = 50): Promise<FlagAuditEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('platform_feature_flag_audit_log')
    .select('*')
    .eq('flag_name', 'voice_agent')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch audit log:', error.message);
    return [];
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    flagName: entry.flag_name,
    action: entry.action,
    oldValue: entry.old_value,
    newValue: entry.new_value,
    changedBy: entry.changed_by,
    reason: entry.reason,
    createdAt: entry.created_at,
  }));
}

// =====================================================
// TENANT LIST
// =====================================================

/**
 * Get list of all tenants with their voice status
 */
export async function getTenantVoiceStatusList(): Promise<Array<{
  tenantId: string;
  tenantName: string;
  enabled: boolean;
  overrideType: 'enabled' | 'disabled' | 'global' | null;
}>> {
  const flags = await getVoiceAgentFlags();

  // Get all tenants with voice configs
  // TIS TIS uses tenant_id, not business_id
  const { data: tenants } = await supabaseAdmin
    .from('voice_assistant_configs')
    .select('tenant_id, tenants(id, name)')
    .eq('is_active', true);

  if (!tenants) return [];

  return tenants.map((tenant) => {
    const tenantId = tenant.tenant_id;
    const tenantName = (tenant.tenants as { name?: string })?.name || 'Unknown';

    let enabled = flags.enabled;
    let overrideType: 'enabled' | 'disabled' | 'global' | null = 'global';

    if (flags.disabledTenants.includes(tenantId)) {
      enabled = false;
      overrideType = 'disabled';
    } else if (flags.enabledTenants.includes(tenantId)) {
      enabled = true;
      overrideType = 'enabled';
    }

    return {
      tenantId,
      tenantName,
      enabled,
      overrideType,
    };
  });
}

// =====================================================
// INITIALIZATION
// =====================================================

/**
 * Initialize voice agent flag if it doesn't exist
 */
export async function initializeVoiceAgentFlag(): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('platform_feature_flags')
    .select('id')
    .eq('name', 'voice_agent')
    .single();

  if (!existing) {
    const { error } = await supabaseAdmin.from('platform_feature_flags').insert({
      name: 'voice_agent',
      enabled: true, // Enabled by default for v2
      enabled_tenants: [],
      disabled_tenants: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to initialize feature flag: ${error.message}`);
    }
  }
}

// =====================================================
// BACKWARDS COMPATIBILITY EXPORTS
// =====================================================

/**
 * @deprecated Use isVoiceAgentEnabled instead
 * Maintained for backwards compatibility during migration
 */
export const shouldUseVoiceAgentV2 = isVoiceAgentEnabled;

/**
 * @deprecated Use isVoiceAgentEnabledCached instead
 * Maintained for backwards compatibility during migration
 */
export const shouldUseVoiceAgentV2Cached = isVoiceAgentEnabledCached;

/**
 * @deprecated Use getVoiceAgentFlags instead
 * Maintained for backwards compatibility during migration
 */
export async function getVoiceAgentV2Flags(): Promise<VoiceAgentFlags & { percentage: number }> {
  const flags = await getVoiceAgentFlags();
  return {
    ...flags,
    percentage: flags.enabled ? 100 : 0, // v2-only: 100% or 0%
  };
}

/**
 * @deprecated No longer needed in v2-only architecture
 */
export const clearV2StatusCache = clearVoiceStatusCache;
