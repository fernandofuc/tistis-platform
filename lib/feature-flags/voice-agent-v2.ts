/**
 * TIS TIS Platform - Voice Agent v2.0
 * Feature Flags Management
 *
 * This module manages feature flags for gradual rollout of Voice Agent v2.
 * Supports percentage-based rollout, tenant-specific overrides, and instant rollback.
 *
 * @module lib/feature-flags/voice-agent-v2
 */

import { supabaseAdmin } from '@/lib/supabase';

// Type for call data from Supabase
interface CallData {
  status: string;
  avg_latency_ms: number | null;
  api_version: string | null;
}

// =====================================================
// TYPES
// =====================================================

export interface VoiceAgentV2Flags {
  enabled: boolean;
  percentage: number;
  enabledTenants: string[];
  disabledTenants: string[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface RolloutStatus {
  currentPercentage: number;
  tenantsOnV2: number;
  totalTenants: number;
  isHealthy: boolean;
  lastUpdated: string;
  metrics: {
    v1: VersionMetrics;
    v2: VersionMetrics;
  };
}

export interface VersionMetrics {
  totalCalls: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
}

// =====================================================
// FEATURE FLAG OPERATIONS
// =====================================================

/**
 * Get Voice Agent v2 feature flags configuration
 */
export async function getVoiceAgentV2Flags(): Promise<VoiceAgentV2Flags> {
  const { data, error } = await supabaseAdmin
    .from('platform_feature_flags')
    .select('*')
    .eq('name', 'voice_agent_v2')
    .single();

  if (error || !data) {
    // Return default disabled state if not found
    return {
      enabled: false,
      percentage: 0,
      enabledTenants: [],
      disabledTenants: [],
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }

  return {
    enabled: data.enabled ?? false,
    percentage: data.percentage ?? 0,
    enabledTenants: data.enabled_tenants ?? [],
    disabledTenants: data.disabled_tenants ?? [],
    updatedAt: data.updated_at ?? new Date().toISOString(),
    updatedBy: data.updated_by ?? null,
  };
}

/**
 * Check if a specific tenant should use Voice Agent v2
 *
 * Decision logic:
 * 1. If globally disabled → false
 * 2. If tenant is explicitly disabled → false
 * 3. If tenant is explicitly enabled → true
 * 4. Otherwise, use percentage-based decision
 */
export async function shouldUseVoiceAgentV2(tenantId: string): Promise<boolean> {
  // Validate tenantId
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    return false; // Invalid tenant should not use v2
  }

  const flags = await getVoiceAgentV2Flags();

  // If globally disabled
  if (!flags.enabled) {
    return false;
  }

  // If tenant is explicitly disabled (rollback)
  if (flags.disabledTenants.includes(tenantId)) {
    return false;
  }

  // If tenant is explicitly enabled (canary/early adopter)
  if (flags.enabledTenants.includes(tenantId)) {
    return true;
  }

  // Percentage-based decision using consistent hashing
  const hash = hashTenantId(tenantId);
  const percentile = hash % 100;

  return percentile < flags.percentage;
}

/**
 * Check if tenant is using v2 (cached for performance)
 * Use this in hot paths like webhook handling
 */
const v2StatusCache = new Map<string, { value: boolean; expiry: number }>();
const CACHE_TTL_MS = 60000; // 1 minute
const CACHE_MAX_SIZE = 10000; // Prevent unbounded growth

export async function shouldUseVoiceAgentV2Cached(tenantId: string): Promise<boolean> {
  // Quick validation before cache lookup
  if (!tenantId || tenantId.trim() === '') {
    return false;
  }

  const now = Date.now();
  const cached = v2StatusCache.get(tenantId);

  if (cached && cached.expiry > now) {
    return cached.value;
  }

  const value = await shouldUseVoiceAgentV2(tenantId);

  // Evict oldest entries if cache is full
  if (v2StatusCache.size >= CACHE_MAX_SIZE) {
    // Simple eviction: clear expired entries first
    const keysToCheck = Array.from(v2StatusCache.keys());
    for (const key of keysToCheck) {
      const entry = v2StatusCache.get(key);
      if (entry && entry.expiry <= now) {
        v2StatusCache.delete(key);
      }
    }
    // If still full, clear oldest 10%
    if (v2StatusCache.size >= CACHE_MAX_SIZE) {
      const keysToDelete = keysToCheck.slice(0, Math.floor(CACHE_MAX_SIZE * 0.1));
      keysToDelete.forEach((key) => v2StatusCache.delete(key));
    }
  }

  v2StatusCache.set(tenantId, {
    value,
    expiry: now + CACHE_TTL_MS,
  });

  return value;
}

/**
 * Clear the v2 status cache (call after flag updates)
 */
export function clearV2StatusCache(): void {
  v2StatusCache.clear();
}

// =====================================================
// ROLLOUT MANAGEMENT
// =====================================================

/**
 * Update the rollout percentage
 */
export async function updateRolloutPercentage(
  percentage: number,
  updatedBy?: string
): Promise<void> {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }

  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .update({
      percentage,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('name', 'voice_agent_v2');

  if (error) {
    throw new Error(`Failed to update rollout percentage: ${error.message}`);
  }

  // Clear cache
  clearV2StatusCache();
}

/**
 * Enable Voice Agent v2 globally
 */
export async function enableVoiceAgentV2(updatedBy?: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .update({
      enabled: true,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('name', 'voice_agent_v2');

  if (error) {
    throw new Error(`Failed to enable v2: ${error.message}`);
  }

  clearV2StatusCache();
}

/**
 * Disable Voice Agent v2 globally (emergency rollback)
 */
export async function disableVoiceAgentV2(updatedBy?: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('platform_feature_flags')
    .update({
      enabled: false,
      percentage: 0,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    })
    .eq('name', 'voice_agent_v2');

  if (error) {
    throw new Error(`Failed to disable v2: ${error.message}`);
  }

  clearV2StatusCache();
}

// =====================================================
// TENANT-SPECIFIC OVERRIDES
// =====================================================

/**
 * Enable v2 for a specific tenant (canary/early adopter)
 * Uses atomic SQL operations to prevent race conditions
 */
export async function enableTenantForV2(
  tenantId: string,
  updatedBy?: string
): Promise<void> {
  // Use atomic array operations to prevent race conditions
  // This removes from disabled_tenants and adds to enabled_tenants atomically
  const { error } = await supabaseAdmin.rpc('update_tenant_v2_status', {
    p_tenant_id: tenantId,
    p_action: 'enable',
    p_updated_by: updatedBy || null,
  });

  // Fallback to non-atomic if RPC doesn't exist
  if (error?.code === '42883') { // function does not exist
    const flags = await getVoiceAgentV2Flags();

    // Remove from disabled list if present
    const disabledTenants = flags.disabledTenants.filter((id) => id !== tenantId);

    // Add to enabled list if not present
    const enabledTenants = flags.enabledTenants.includes(tenantId)
      ? flags.enabledTenants
      : [...flags.enabledTenants, tenantId];

    const { error: updateError } = await supabaseAdmin
      .from('platform_feature_flags')
      .update({
        enabled_tenants: enabledTenants,
        disabled_tenants: disabledTenants,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('name', 'voice_agent_v2');

    if (updateError) {
      throw new Error(`Failed to enable tenant: ${updateError.message}`);
    }
  } else if (error) {
    throw new Error(`Failed to enable tenant: ${error.message}`);
  }

  clearV2StatusCache();
}

/**
 * Disable v2 for a specific tenant (individual rollback)
 * Uses atomic SQL operations to prevent race conditions
 */
export async function disableTenantForV2(
  tenantId: string,
  updatedBy?: string
): Promise<void> {
  // Use atomic array operations to prevent race conditions
  const { error } = await supabaseAdmin.rpc('update_tenant_v2_status', {
    p_tenant_id: tenantId,
    p_action: 'disable',
    p_updated_by: updatedBy || null,
  });

  // Fallback to non-atomic if RPC doesn't exist
  if (error?.code === '42883') { // function does not exist
    const flags = await getVoiceAgentV2Flags();

    // Remove from enabled list if present
    const enabledTenants = flags.enabledTenants.filter((id) => id !== tenantId);

    // Add to disabled list if not present
    const disabledTenants = flags.disabledTenants.includes(tenantId)
      ? flags.disabledTenants
      : [...flags.disabledTenants, tenantId];

    const { error: updateError } = await supabaseAdmin
      .from('platform_feature_flags')
      .update({
        enabled_tenants: enabledTenants,
        disabled_tenants: disabledTenants,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('name', 'voice_agent_v2');

    if (updateError) {
      throw new Error(`Failed to disable tenant: ${updateError.message}`);
    }
  } else if (error) {
    throw new Error(`Failed to disable tenant: ${error.message}`);
  }

  clearV2StatusCache();
}

/**
 * Remove tenant from all override lists (use default behavior)
 * Uses atomic SQL operations to prevent race conditions
 */
export async function resetTenantOverride(
  tenantId: string,
  updatedBy?: string
): Promise<void> {
  // Use atomic array operations to prevent race conditions
  const { error } = await supabaseAdmin.rpc('update_tenant_v2_status', {
    p_tenant_id: tenantId,
    p_action: 'reset',
    p_updated_by: updatedBy || null,
  });

  // Fallback to non-atomic if RPC doesn't exist
  if (error?.code === '42883') { // function does not exist
    const flags = await getVoiceAgentV2Flags();

    const enabledTenants = flags.enabledTenants.filter((id) => id !== tenantId);
    const disabledTenants = flags.disabledTenants.filter((id) => id !== tenantId);

    const { error: updateError } = await supabaseAdmin
      .from('platform_feature_flags')
      .update({
        enabled_tenants: enabledTenants,
        disabled_tenants: disabledTenants,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      })
      .eq('name', 'voice_agent_v2');

    if (updateError) {
      throw new Error(`Failed to reset tenant: ${updateError.message}`);
    }
  } else if (error) {
    throw new Error(`Failed to reset tenant: ${error.message}`);
  }

  clearV2StatusCache();
}

// =====================================================
// ROLLOUT STATUS
// =====================================================

/**
 * Get current rollout status with metrics
 */
export async function getRolloutStatus(): Promise<RolloutStatus> {
  const flags = await getVoiceAgentV2Flags();

  // Get tenant counts
  const { count: totalTenants } = await supabaseAdmin
    .from('voice_assistant_configs')
    .select('*', { count: 'exact', head: true });

  // Calculate tenants on v2
  let tenantsOnV2 = flags.enabledTenants.length;

  // Add percentage-based tenants
  if (flags.enabled && flags.percentage > 0) {
    const percentageBasedCount = Math.floor(
      ((totalTenants || 0) * flags.percentage) / 100
    );
    // Ensure non-negative result
    tenantsOnV2 = Math.max(
      0,
      Math.min(
        tenantsOnV2 + percentageBasedCount - flags.disabledTenants.length,
        totalTenants || 0
      )
    );
  }

  // Get metrics (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recentCalls } = await supabaseAdmin
    .from('voice_calls')
    .select('status, avg_latency_ms, api_version')
    .gte('started_at', oneHourAgo);

  const calls = (recentCalls || []) as CallData[];
  const v1Calls = calls.filter((c: CallData) => c.api_version !== 'v2');
  const v2Calls = calls.filter((c: CallData) => c.api_version === 'v2');

  const calculateMetrics = (callList: CallData[]): VersionMetrics => {
    const total = callList.length;
    const failed = callList.filter((c: CallData) => c.status === 'failed').length;
    const latencies = callList
      .map((c: CallData) => c.avg_latency_ms || 0)
      .filter((l: number) => l > 0)
      .sort((a: number, b: number) => a - b);

    // Calculate p95 index safely (ensure it doesn't exceed array bounds)
    const p95Index = latencies.length > 0
      ? Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1)
      : -1;

    return {
      totalCalls: total,
      errorRate: total > 0 ? failed / total : 0,
      avgLatency:
        latencies.length > 0
          ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length)
          : 0,
      p95Latency: p95Index >= 0 ? latencies[p95Index] : 0,
    };
  };

  const v1Metrics = calculateMetrics(v1Calls);
  const v2Metrics = calculateMetrics(v2Calls);

  // Determine health status
  // Consider unhealthy if no v2 calls yet (can't determine health without data)
  // Or if error rate >= 2% or p95 latency >= 800ms
  const hasV2Data = v2Metrics.totalCalls > 0;
  const isHealthy = hasV2Data
    ? v2Metrics.errorRate < 0.02 && v2Metrics.p95Latency < 800
    : false; // No data = unknown health, default to false for safety

  return {
    currentPercentage: flags.percentage,
    tenantsOnV2,
    totalTenants: totalTenants || 0,
    isHealthy,
    lastUpdated: flags.updatedAt,
    metrics: {
      v1: v1Metrics,
      v2: v2Metrics,
    },
  };
}

// =====================================================
// UTILITIES
// =====================================================

/**
 * Hash tenant ID for consistent percentage-based bucketing
 * Uses djb2 algorithm for deterministic distribution
 */
function hashTenantId(tenantId: string): number {
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    const char = tenantId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Calculate if a tenant should use v2 based on pre-loaded flags
 * This is a synchronous version used for bulk operations
 *
 * @internal Use shouldUseVoiceAgentV2 for single tenant checks
 */
function calculateTenantV2Status(
  tenantId: string,
  flags: VoiceAgentV2Flags
): { isOnV2: boolean; overrideType: 'enabled' | 'disabled' | 'percentage' | null } {
  // Tenant explicitly enabled
  if (flags.enabledTenants.includes(tenantId)) {
    return { isOnV2: true, overrideType: 'enabled' };
  }

  // Tenant explicitly disabled
  if (flags.disabledTenants.includes(tenantId)) {
    return { isOnV2: false, overrideType: 'disabled' };
  }

  // Percentage-based decision
  if (flags.enabled && flags.percentage > 0) {
    const hash = hashTenantId(tenantId);
    const percentile = hash % 100;
    const isOnV2 = percentile < flags.percentage;
    return { isOnV2, overrideType: isOnV2 ? 'percentage' : null };
  }

  return { isOnV2: false, overrideType: null };
}

/**
 * Initialize feature flag if it doesn't exist
 */
export async function initializeVoiceAgentV2Flag(): Promise<void> {
  // Check if flag exists
  const { data: existing } = await supabaseAdmin
    .from('platform_feature_flags')
    .select('id')
    .eq('name', 'voice_agent_v2')
    .single();

  if (!existing) {
    // Create default flag
    const { error } = await supabaseAdmin.from('platform_feature_flags').insert({
      name: 'voice_agent_v2',
      enabled: false,
      percentage: 0,
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
// AUDIT AND HISTORY
// =====================================================

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

/**
 * Get audit history for the voice agent v2 flag
 */
export async function getVoiceAgentV2AuditLog(limit: number = 50): Promise<FlagAuditEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('platform_feature_flag_audit_log')
    .select('*')
    .eq('flag_name', 'voice_agent_v2')
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

/**
 * Get list of tenants with their v2 status
 */
export async function getTenantV2StatusList(): Promise<Array<{
  tenantId: string;
  tenantName: string;
  isOnV2: boolean;
  overrideType: 'enabled' | 'disabled' | 'percentage' | null;
}>> {
  const flags = await getVoiceAgentV2Flags();

  // Get all tenants with voice configs
  const { data: tenants } = await supabaseAdmin
    .from('voice_assistant_configs')
    .select('business_id, businesses(id, name)')
    .eq('is_active', true);

  if (!tenants) return [];

  return tenants.map((tenant) => {
    const tenantId = tenant.business_id;
    const tenantName = (tenant.businesses as { name?: string })?.name || 'Unknown';

    // Use shared logic for consistency
    const { isOnV2, overrideType } = calculateTenantV2Status(tenantId, flags);

    return {
      tenantId,
      tenantName,
      isOnV2,
      overrideType,
    };
  });
}

/**
 * Batch update multiple tenants' v2 status
 */
export async function batchUpdateTenantV2Status(
  updates: Array<{ tenantId: string; action: 'enable' | 'disable' | 'reset' }>,
  updatedBy?: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const update of updates) {
    try {
      switch (update.action) {
        case 'enable':
          await enableTenantForV2(update.tenantId, updatedBy);
          break;
        case 'disable':
          await disableTenantForV2(update.tenantId, updatedBy);
          break;
        case 'reset':
          await resetTenantOverride(update.tenantId, updatedBy);
          break;
      }
    } catch (err) {
      errors.push(`Failed to ${update.action} tenant ${update.tenantId}: ${err}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
