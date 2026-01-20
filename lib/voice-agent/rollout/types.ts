/**
 * TIS TIS Platform - Voice Agent v2.0
 * Rollout Types and Interfaces
 *
 * Defines all types for the rollout management system:
 * - Rollout stages and phases
 * - Go/No-Go criteria
 * - Tenant selection
 * - Rollback procedures
 *
 * @module lib/voice-agent/rollout/types
 */

// =====================================================
// ROLLOUT STAGES
// =====================================================

/**
 * Rollout stage identifiers
 */
export type RolloutStage =
  | 'disabled'      // 0% - V2 completely off
  | 'canary'        // 5% - Initial testing
  | 'early_adopters'// 10% - Early adopters
  | 'expansion'     // 25% - Expanded testing
  | 'majority'      // 50% - Half of tenants
  | 'complete';     // 100% - Full rollout

/**
 * Rollout stage configuration
 */
export interface RolloutStageConfig {
  /** Stage identifier */
  stage: RolloutStage;

  /** Target percentage */
  percentage: number;

  /** Minimum duration before advancing (hours) */
  minDurationHours: number;

  /** Monitoring frequency (minutes) */
  monitoringIntervalMinutes: number;

  /** Go criteria for advancing */
  goCriteria: GoNoCriteria;

  /** No-Go criteria for rollback */
  noGoCriteria: GoNoCriteria;
}

/**
 * Go/No-Go criteria thresholds
 */
export interface GoNoCriteria {
  /** Maximum error rate (0-1) */
  maxErrorRate: number;

  /** Maximum p95 latency (ms) */
  maxP95LatencyMs: number;

  /** Maximum failed calls percentage (0-1) */
  maxFailedCallsRate: number;

  /** Maximum circuit breaker opens */
  maxCircuitBreakerOpens: number;
}

// =====================================================
// ROLLOUT STATUS
// =====================================================

/**
 * Current rollout status
 */
export interface RolloutStatus {
  /** Current stage */
  currentStage: RolloutStage;

  /** Current percentage */
  percentage: number;

  /** Whether rollout is enabled */
  enabled: boolean;

  /** Tenants explicitly enabled */
  enabledTenants: string[];

  /** Tenants explicitly disabled */
  disabledTenants: string[];

  /** When current stage started */
  stageStartedAt: string;

  /** Who initiated the current stage */
  stageInitiatedBy: string | null;

  /** Whether auto-advance is enabled */
  autoAdvanceEnabled: boolean;

  /** Last health check result */
  lastHealthCheck: HealthCheckResult | null;

  /** History of stage changes */
  history: RolloutHistoryEntry[];
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check timestamp */
  timestamp: string;

  /** Whether criteria are met */
  healthy: boolean;

  /** Can advance to next stage */
  canAdvance: boolean;

  /** Should rollback */
  shouldRollback: boolean;

  /** V2 metrics */
  v2Metrics: RolloutMetrics;

  /** V1 metrics for comparison */
  v1Metrics: RolloutMetrics;

  /** Issues found */
  issues: RolloutIssue[];
}

/**
 * Rollout metrics
 */
export interface RolloutMetrics {
  /** Total calls in period */
  totalCalls: number;

  /** Successful calls */
  successfulCalls: number;

  /** Failed calls */
  failedCalls: number;

  /** Error rate (0-1) */
  errorRate: number;

  /** Average latency (ms) */
  avgLatencyMs: number;

  /** p50 latency (ms) */
  p50LatencyMs: number;

  /** p95 latency (ms) */
  p95LatencyMs: number;

  /** p99 latency (ms) */
  p99LatencyMs: number;

  /** Circuit breaker opens count */
  circuitBreakerOpens: number;

  /** Active calls right now */
  activeCalls: number;
}

/**
 * Issue detected during health check
 */
export interface RolloutIssue {
  /** Severity level */
  severity: 'warning' | 'critical';

  /** Issue type */
  type: 'error_rate' | 'latency' | 'circuit_breaker' | 'failed_calls' | 'other';

  /** Human-readable message */
  message: string;

  /** Current value */
  currentValue: number;

  /** Threshold value */
  thresholdValue: number;

  /** Recommended action */
  recommendedAction: string;
}

/**
 * History entry for rollout changes
 */
export interface RolloutHistoryEntry {
  /** Entry ID */
  id: string;

  /** Timestamp */
  timestamp: string;

  /** Action taken */
  action: RolloutAction;

  /** Previous stage */
  fromStage: RolloutStage;

  /** New stage */
  toStage: RolloutStage;

  /** Previous percentage */
  fromPercentage: number;

  /** New percentage */
  toPercentage: number;

  /** Who initiated */
  initiatedBy: string | null;

  /** Reason for change */
  reason: string;

  /** Health metrics at time of change */
  healthMetrics?: RolloutMetrics;
}

/**
 * Types of rollout actions
 */
export type RolloutAction =
  | 'advance'           // Move to next stage
  | 'rollback_partial'  // Reduce percentage
  | 'rollback_total'    // Go to 0%
  | 'rollback_tenant'   // Disable specific tenant
  | 'enable_tenant'     // Enable specific tenant
  | 'set_percentage'    // Manual percentage change
  | 'enable'            // Enable rollout
  | 'disable';          // Disable rollout

// =====================================================
// ROLLOUT COMMANDS
// =====================================================

/**
 * Command to advance rollout
 */
export interface AdvanceRolloutCommand {
  /** Target stage or percentage */
  target: RolloutStage | number;

  /** Who is initiating */
  initiatedBy: string;

  /** Reason for advancement */
  reason: string;

  /** Skip health check (emergency only) */
  skipHealthCheck?: boolean;
}

/**
 * Command to rollback
 */
export interface RollbackCommand {
  /** Rollback level */
  level: 'tenant' | 'partial' | 'total';

  /** Target percentage for partial rollback */
  targetPercentage?: number;

  /** Tenant ID for tenant-level rollback */
  tenantId?: string;

  /** Who is initiating */
  initiatedBy: string;

  /** Reason for rollback */
  reason: string;
}

/**
 * Command to update tenant status
 */
export interface TenantRolloutCommand {
  /** Tenant ID */
  tenantId: string;

  /** Action to take */
  action: 'enable' | 'disable';

  /** Who is initiating */
  initiatedBy: string;

  /** Reason */
  reason: string;
}

// =====================================================
// PRE-ROLLOUT CHECKLIST
// =====================================================

/**
 * Pre-rollout checklist item
 */
export interface ChecklistItem {
  /** Item ID */
  id: string;

  /** Category */
  category: 'migration' | 'feature_flags' | 'monitoring' | 'alerts' | 'rollback' | 'team';

  /** Item description */
  description: string;

  /** Whether it's completed */
  completed: boolean;

  /** Who completed it */
  completedBy: string | null;

  /** When it was completed */
  completedAt: string | null;

  /** Whether it's required */
  required: boolean;

  /** Notes */
  notes: string | null;
}

/**
 * Complete pre-rollout checklist
 */
export interface PreRolloutChecklist {
  /** Checklist ID */
  id: string;

  /** Created timestamp */
  createdAt: string;

  /** Last updated */
  updatedAt: string;

  /** All items */
  items: ChecklistItem[];

  /** Overall completion percentage */
  completionPercentage: number;

  /** Whether all required items are completed */
  allRequiredComplete: boolean;

  /** Who approved the checklist */
  approvedBy: string | null;

  /** When it was approved */
  approvedAt: string | null;
}

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Default stage configurations
 */
export const DEFAULT_STAGE_CONFIGS: Record<RolloutStage, RolloutStageConfig> = {
  disabled: {
    stage: 'disabled',
    percentage: 0,
    minDurationHours: 0,
    monitoringIntervalMinutes: 60,
    goCriteria: {
      maxErrorRate: 1,
      maxP95LatencyMs: Infinity,
      maxFailedCallsRate: 1,
      maxCircuitBreakerOpens: Infinity,
    },
    noGoCriteria: {
      maxErrorRate: 1,
      maxP95LatencyMs: Infinity,
      maxFailedCallsRate: 1,
      maxCircuitBreakerOpens: Infinity,
    },
  },
  canary: {
    stage: 'canary',
    percentage: 5,
    minDurationHours: 4,
    monitoringIntervalMinutes: 30,
    goCriteria: {
      maxErrorRate: 0.01,
      maxP95LatencyMs: 800,
      maxFailedCallsRate: 0.01,
      maxCircuitBreakerOpens: 0,
    },
    noGoCriteria: {
      maxErrorRate: 0.05,
      maxP95LatencyMs: 1200,
      maxFailedCallsRate: 0.10,
      maxCircuitBreakerOpens: 2,
    },
  },
  early_adopters: {
    stage: 'early_adopters',
    percentage: 10,
    minDurationHours: 24,
    monitoringIntervalMinutes: 60,
    goCriteria: {
      maxErrorRate: 0.01,
      maxP95LatencyMs: 800,
      maxFailedCallsRate: 0.03,
      maxCircuitBreakerOpens: 0,
    },
    noGoCriteria: {
      maxErrorRate: 0.05,
      maxP95LatencyMs: 1200,
      maxFailedCallsRate: 0.10,
      maxCircuitBreakerOpens: 2,
    },
  },
  expansion: {
    stage: 'expansion',
    percentage: 25,
    minDurationHours: 24,
    monitoringIntervalMinutes: 120,
    goCriteria: {
      maxErrorRate: 0.02,
      maxP95LatencyMs: 800,
      maxFailedCallsRate: 0.03,
      maxCircuitBreakerOpens: 0,
    },
    noGoCriteria: {
      maxErrorRate: 0.05,
      maxP95LatencyMs: 1200,
      maxFailedCallsRate: 0.10,
      maxCircuitBreakerOpens: 2,
    },
  },
  majority: {
    stage: 'majority',
    percentage: 50,
    minDurationHours: 24,
    monitoringIntervalMinutes: 240,
    goCriteria: {
      maxErrorRate: 0.02,
      maxP95LatencyMs: 800,
      maxFailedCallsRate: 0.03,
      maxCircuitBreakerOpens: 0,
    },
    noGoCriteria: {
      maxErrorRate: 0.05,
      maxP95LatencyMs: 1200,
      maxFailedCallsRate: 0.10,
      maxCircuitBreakerOpens: 2,
    },
  },
  complete: {
    stage: 'complete',
    percentage: 100,
    minDurationHours: 168, // 1 week
    monitoringIntervalMinutes: 360,
    goCriteria: {
      maxErrorRate: 0.02,
      maxP95LatencyMs: 800,
      maxFailedCallsRate: 0.03,
      maxCircuitBreakerOpens: 0,
    },
    noGoCriteria: {
      maxErrorRate: 0.05,
      maxP95LatencyMs: 1200,
      maxFailedCallsRate: 0.10,
      maxCircuitBreakerOpens: 2,
    },
  },
};

/**
 * Stage progression order
 */
export const STAGE_PROGRESSION: RolloutStage[] = [
  'disabled',
  'canary',
  'early_adopters',
  'expansion',
  'majority',
  'complete',
];

/**
 * Default pre-rollout checklist items
 */
export const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, 'id' | 'completed' | 'completedBy' | 'completedAt' | 'notes'>[] = [
  // Migration
  { category: 'migration', description: 'Migration script executed successfully', required: true },
  { category: 'migration', description: 'Data validation passed', required: true },
  { category: 'migration', description: 'Backup created and verified', required: true },

  // Feature Flags
  { category: 'feature_flags', description: 'Feature flags configured in database', required: true },
  { category: 'feature_flags', description: 'Feature flag service tested', required: true },
  { category: 'feature_flags', description: 'Rollback via flag verified', required: true },

  // Monitoring
  { category: 'monitoring', description: 'Metrics collection active', required: true },
  { category: 'monitoring', description: 'Dashboards configured', required: true },
  { category: 'monitoring', description: 'Log aggregation working', required: true },

  // Alerts
  { category: 'alerts', description: 'Alert rules configured', required: true },
  { category: 'alerts', description: 'Notification channels tested', required: true },
  { category: 'alerts', description: 'On-call schedule confirmed', required: true },

  // Rollback
  { category: 'rollback', description: 'Rollback procedure documented', required: true },
  { category: 'rollback', description: 'Rollback tested in staging', required: true },
  { category: 'rollback', description: 'Rollback scripts ready', required: true },

  // Team
  { category: 'team', description: 'Team notified of rollout plan', required: true },
  { category: 'team', description: 'Support team briefed', required: false },
  { category: 'team', description: 'Stakeholders informed', required: false },
];
