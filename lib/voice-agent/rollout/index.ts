/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Module Exports
 *
 * Central export point for rollout functionality:
 * - Rollout status and control
 * - Pre-rollout checklist
 * - Health monitoring
 * - Rollback procedures
 *
 * @module lib/voice-agent/rollout
 */

// =====================================================
// TYPES
// =====================================================

export type {
  // Stage types
  RolloutStage,
  RolloutStageConfig,
  GoNoCriteria,

  // Status types
  RolloutStatus,
  RolloutMetrics,
  RolloutHistoryEntry,
  RolloutAction,
  HealthCheckResult,
  RolloutIssue,

  // Command types
  AdvanceRolloutCommand,
  RollbackCommand,
  TenantRolloutCommand,

  // Checklist types
  ChecklistItem,
  PreRolloutChecklist,
} from './types';

// =====================================================
// CONSTANTS
// =====================================================

export {
  DEFAULT_STAGE_CONFIGS,
  STAGE_PROGRESSION,
  DEFAULT_CHECKLIST_ITEMS,
} from './types';

// =====================================================
// ROLLOUT SERVICE
// =====================================================

export {
  // Main class
  RolloutService,

  // Config type
  type RolloutServiceConfig,

  // Singleton
  getRolloutService,

  // Status functions
  shouldUseVoiceAgentV2,
  getRolloutStatus,
  performRolloutHealthCheck,

  // Control functions
  advanceRollout,
  executeRollback,
  updateTenantRolloutStatus,

  // History functions
  getRolloutHistory,
  getTenantRolloutStats,
} from './rollout-service';

// =====================================================
// CHECKLIST SERVICE
// =====================================================

export {
  // Main class
  ChecklistService,

  // Config type
  type ChecklistServiceConfig,

  // Singleton
  getChecklistService,

  // Checklist functions
  getOrCreateChecklist,
  completeChecklistItem,
  approveChecklist,
  runAutomaticChecks,
} from './checklist-service';

// =====================================================
// ROLLOUT ALERTS
// =====================================================

export {
  // Main class
  RolloutAlertService,

  // Config types
  type RolloutAlertConfig,
  type RolloutAlertEvent,
  type RolloutAlertType,
  type RolloutAlertHandler,

  // Singleton
  getRolloutAlertService,

  // Lifecycle
  startRolloutAlertMonitoring,
  stopRolloutAlertMonitoring,

  // Query functions
  getRolloutAlerts,
  getRolloutAlertSummary,

  // Event handlers
  onRolloutAlert,

  // Notification functions
  notifyStageAdvancement,
  notifyRollback,
  notifyStageBlocked,
} from './rollout-alerts';
