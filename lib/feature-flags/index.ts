/**
 * TIS TIS Platform - Feature Flags Module
 *
 * Central module for managing feature flags across the platform.
 *
 * @module lib/feature-flags
 */

// Voice Agent v2 Feature Flags
export {
  // Types
  type VoiceAgentV2Flags,
  type RolloutStatus,
  type VersionMetrics,
  type FlagAuditEntry,

  // Core operations
  getVoiceAgentV2Flags,
  shouldUseVoiceAgentV2,
  shouldUseVoiceAgentV2Cached,
  clearV2StatusCache,

  // Rollout management
  updateRolloutPercentage,
  enableVoiceAgentV2,
  disableVoiceAgentV2,

  // Tenant-specific
  enableTenantForV2,
  disableTenantForV2,
  resetTenantOverride,

  // Status and monitoring
  getRolloutStatus,
  initializeVoiceAgentV2Flag,

  // Audit and admin
  getVoiceAgentV2AuditLog,
  getTenantV2StatusList,
  batchUpdateTenantV2Status,
} from './voice-agent-v2';
