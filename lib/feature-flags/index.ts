/**
 * TIS TIS Platform - Feature Flags Module
 *
 * Central module for managing feature flags across the platform.
 * Simplified for v2-only architecture.
 *
 * @module lib/feature-flags
 * @version 2.0.0
 */

// Voice Agent Feature Flags
export {
  // Types
  type VoiceAgentFlags,
  type TenantVoiceStatus,
  type FlagAuditEntry,

  // Core operations
  getVoiceAgentFlags,
  isVoiceAgentEnabled,
  isVoiceAgentEnabledCached,
  getTenantVoiceStatus,
  clearVoiceStatusCache,

  // Global management
  enableVoiceAgent,
  disableVoiceAgent,

  // Tenant-specific
  enableTenantVoiceAgent,
  disableTenantVoiceAgent,
  resetTenantVoiceOverride,

  // Admin and monitoring
  getVoiceAgentAuditLog,
  getTenantVoiceStatusList,
  initializeVoiceAgentFlag,

  // Backwards compatibility (deprecated)
  shouldUseVoiceAgentV2,
  shouldUseVoiceAgentV2Cached,
  getVoiceAgentV2Flags,
  clearV2StatusCache,
} from './voice-agent-v2';
