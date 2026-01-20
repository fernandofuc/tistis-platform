/**
 * TIS TIS Platform - Voice Agent v2.0
 * Monitoring Types and Interfaces
 *
 * Defines all types for the monitoring and alerting system:
 * - Metric types (counter, gauge, histogram)
 * - Alert configurations
 * - Health check status
 * - Notification types
 *
 * @module lib/voice-agent/monitoring/types
 */

// =====================================================
// METRIC TYPES
// =====================================================

/**
 * Types of metrics supported
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Base metric interface
 */
export interface BaseMetric {
  /** Unique metric name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Type of metric */
  type: MetricType;

  /** Labels/tags for the metric */
  labels: Record<string, string>;

  /** Timestamp of last update */
  updatedAt: string;
}

/**
 * Counter metric - monotonically increasing value
 */
export interface CounterMetric extends BaseMetric {
  type: 'counter';
  value: number;
}

/**
 * Gauge metric - value that can go up or down
 */
export interface GaugeMetric extends BaseMetric {
  type: 'gauge';
  value: number;
}

/**
 * Histogram metric - distribution of values
 */
export interface HistogramMetric extends BaseMetric {
  type: 'histogram';
  count: number;
  sum: number;
  buckets: Record<string, number>; // bucket threshold -> count
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * Union type of all metrics
 */
export type Metric = CounterMetric | GaugeMetric | HistogramMetric;

// =====================================================
// VOICE-SPECIFIC METRICS
// =====================================================

/**
 * Core voice metrics as defined in FASE 16.1
 */
export interface VoiceMetrics {
  // Counters
  voice_calls_total: CounterMetric;
  voice_calls_successful: CounterMetric;
  voice_errors_total: CounterMetric;
  voice_webhook_failures_total: CounterMetric;
  voice_transfers_total: CounterMetric;

  // Gauges
  voice_active_calls: GaugeMetric;
  voice_circuit_breaker_state: GaugeMetric; // 0=CLOSED, 1=HALF_OPEN, 2=OPEN

  // Histograms
  voice_latency_seconds: HistogramMetric;
  voice_call_duration_seconds: HistogramMetric;
  voice_rag_latency_seconds: HistogramMetric;
}

/**
 * Metric names for voice agent
 */
export const VOICE_METRIC_NAMES = {
  // Counters
  CALLS_TOTAL: 'voice_calls_total',
  CALLS_SUCCESSFUL: 'voice_calls_successful',
  ERRORS_TOTAL: 'voice_errors_total',
  WEBHOOK_FAILURES: 'voice_webhook_failures_total',
  TRANSFERS_TOTAL: 'voice_transfers_total',

  // Gauges
  ACTIVE_CALLS: 'voice_active_calls',
  CIRCUIT_BREAKER_STATE: 'voice_circuit_breaker_state',

  // Histograms
  LATENCY: 'voice_latency_seconds',
  CALL_DURATION: 'voice_call_duration_seconds',
  RAG_LATENCY: 'voice_rag_latency_seconds',
} as const;

// =====================================================
// ALERT TYPES
// =====================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert status
 */
export type AlertStatus = 'firing' | 'resolved' | 'acknowledged';

/**
 * Comparison operators for alert conditions
 */
export type ComparisonOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

/**
 * Alert condition configuration
 */
export interface AlertCondition {
  /** Metric name to evaluate */
  metric: string;

  /** Comparison operator */
  operator: ComparisonOperator;

  /** Threshold value */
  threshold: number;

  /** Duration the condition must be true (in ms) */
  forDuration?: number;

  /** Aggregation function */
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'rate';

  /** Time window for aggregation (in ms) */
  window?: number;
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this alert means */
  description: string;

  /** Alert severity */
  severity: AlertSeverity;

  /** Conditions that trigger the alert */
  condition: AlertCondition;

  /** Labels to add to fired alerts */
  labels?: Record<string, string>;

  /** Annotations with additional info */
  annotations?: Record<string, string>;

  /** Whether the rule is enabled */
  enabled: boolean;

  /** Notification channels to use */
  notificationChannels: NotificationChannel[];
}

/**
 * Fired alert instance
 */
export interface Alert {
  /** Unique alert ID */
  id: string;

  /** Rule that triggered this alert */
  ruleId: string;

  /** Alert name (from rule) */
  name: string;

  /** Alert description */
  description: string;

  /** Current severity */
  severity: AlertSeverity;

  /** Current status */
  status: AlertStatus;

  /** When the alert started firing */
  firedAt: string;

  /** When the alert was resolved (if applicable) */
  resolvedAt?: string;

  /** When the alert was acknowledged (if applicable) */
  acknowledgedAt?: string;

  /** Who acknowledged the alert */
  acknowledgedBy?: string;

  /** Current metric value that triggered the alert */
  value: number;

  /** Threshold that was exceeded */
  threshold: number;

  /** Labels from the metric */
  labels: Record<string, string>;

  /** Annotations from the rule */
  annotations: Record<string, string>;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

/**
 * Supported notification channels
 */
export type NotificationChannel = 'slack' | 'email' | 'pagerduty' | 'webhook';

/**
 * Base notification configuration
 */
export interface NotificationConfigBase {
  /** Channel type */
  channel: NotificationChannel;

  /** Whether this channel is enabled */
  enabled: boolean;

  /** Minimum severity to notify on */
  minSeverity: AlertSeverity;
}

/**
 * Slack notification configuration
 */
export interface SlackNotificationConfig extends NotificationConfigBase {
  channel: 'slack';
  webhookUrl: string;
  channelName: string;
  mentionUsers?: string[];
}

/**
 * Email notification configuration
 */
export interface EmailNotificationConfig extends NotificationConfigBase {
  channel: 'email';
  recipients: string[];
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
  };
}

/**
 * PagerDuty notification configuration
 */
export interface PagerDutyNotificationConfig extends NotificationConfigBase {
  channel: 'pagerduty';
  routingKey: string;
  serviceKey?: string;
}

/**
 * Generic webhook notification configuration
 */
export interface WebhookNotificationConfig extends NotificationConfigBase {
  channel: 'webhook';
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
}

/**
 * Union type of all notification configs
 */
export type NotificationConfig =
  | SlackNotificationConfig
  | EmailNotificationConfig
  | PagerDutyNotificationConfig
  | WebhookNotificationConfig;

/**
 * Notification payload
 */
export interface NotificationPayload {
  /** Alert that triggered the notification */
  alert: Alert;

  /** Target channel */
  channel: NotificationChannel;

  /** Pre-formatted message */
  message: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

// =====================================================
// HEALTH CHECK TYPES
// =====================================================

/**
 * Health status values
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual service health
 */
export interface ServiceHealth {
  /** Service name */
  name: string;

  /** Current status */
  status: HealthStatus;

  /** Latency to check service (in ms) */
  latencyMs: number;

  /** Last successful check timestamp */
  lastCheck: string;

  /** Error message if unhealthy */
  error?: string;

  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Overall health check response
 */
export interface HealthCheckResponse {
  /** Overall status */
  status: HealthStatus;

  /** Timestamp of health check */
  timestamp: string;

  /** Service version */
  version: string;

  /** API version being used */
  apiVersion: 'v1' | 'v2';

  /** Uptime in seconds */
  uptimeSeconds: number;

  /** Individual service health */
  services: {
    database: ServiceHealth;
    redis?: ServiceHealth;
    vapi: ServiceHealth;
    langgraph: ServiceHealth;
    circuitBreaker: ServiceHealth;
  };

  /** Current metrics summary */
  metrics: {
    activeCalls: number;
    callsLastHour: number;
    errorRatePercent: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
  };

  /** Active alerts */
  activeAlerts: number;
}

// =====================================================
// ROLLOUT DASHBOARD TYPES
// =====================================================

/**
 * Rollout dashboard data
 */
export interface RolloutDashboardData {
  /** Feature flags status */
  featureFlags: {
    enabled: boolean;
    percentage: number;
    enabledTenants: number;
    disabledTenants: number;
  };

  /** V1 vs V2 comparison */
  versionComparison: {
    v1: VersionStats;
    v2: VersionStats;
  };

  /** Active alerts */
  alerts: Alert[];

  /** Health status */
  health: HealthCheckResponse;

  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Stats for a specific version
 */
export interface VersionStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  avgDurationSeconds: number;
  transferRate: number;
}

// =====================================================
// LOG TYPES
// =====================================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Timestamp */
  timestamp: string;

  /** Log level */
  level: LogLevel;

  /** Message */
  message: string;

  /** Service/module name */
  service: string;

  /** Request/call ID for correlation */
  correlationId?: string;

  /** Tenant ID */
  tenantId?: string;

  /** Call ID */
  callId?: string;

  /** Additional structured data */
  data?: Record<string, unknown>;

  /** Error details if applicable */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };

  /** Duration if this is a timing log */
  durationMs?: number;
}

// =====================================================
// DEFAULT CONFIGURATIONS
// =====================================================

/**
 * Default histogram buckets for latency (in seconds)
 */
export const DEFAULT_LATENCY_BUCKETS = {
  '0.05': 0,   // 50ms
  '0.1': 0,    // 100ms
  '0.25': 0,   // 250ms
  '0.5': 0,    // 500ms
  '0.75': 0,   // 750ms
  '1.0': 0,    // 1s
  '1.5': 0,    // 1.5s
  '2.0': 0,    // 2s
  '3.0': 0,    // 3s
  '5.0': 0,    // 5s
  '+Inf': 0,   // Above 5s
};

/**
 * Default histogram buckets for call duration (in seconds)
 */
export const DEFAULT_DURATION_BUCKETS = {
  '30': 0,     // 30s
  '60': 0,     // 1min
  '120': 0,    // 2min
  '180': 0,    // 3min
  '300': 0,    // 5min
  '600': 0,    // 10min
  '900': 0,    // 15min
  '+Inf': 0,   // Above 15min
};

/**
 * Default alert rules as defined in FASE 16.3
 */
export const DEFAULT_ALERT_RULES: Omit<AlertRule, 'id'>[] = [
  {
    name: 'High Error Rate',
    description: 'Voice agent error rate exceeds 5%',
    severity: 'critical',
    condition: {
      metric: VOICE_METRIC_NAMES.ERRORS_TOTAL,
      operator: 'gt',
      threshold: 0.05,
      aggregation: 'rate',
      window: 300_000, // 5 minutes
    },
    enabled: true,
    notificationChannels: ['slack', 'pagerduty'],
  },
  {
    name: 'High Latency',
    description: 'Voice agent p95 latency exceeds 1200ms',
    severity: 'warning',
    condition: {
      metric: VOICE_METRIC_NAMES.LATENCY,
      operator: 'gt',
      threshold: 1.2, // 1200ms in seconds
      aggregation: 'max',
      window: 300_000,
    },
    enabled: true,
    notificationChannels: ['slack'],
  },
  {
    name: 'Circuit Breaker Open',
    description: 'Circuit breaker is in OPEN state',
    severity: 'critical',
    condition: {
      metric: VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE,
      operator: 'eq',
      threshold: 2, // 2 = OPEN
    },
    enabled: true,
    notificationChannels: ['slack', 'pagerduty'],
  },
  {
    name: 'Webhook Failures',
    description: 'More than 10 webhook failures per minute',
    severity: 'warning',
    condition: {
      metric: VOICE_METRIC_NAMES.WEBHOOK_FAILURES,
      operator: 'gt',
      threshold: 10,
      aggregation: 'rate',
      window: 60_000, // 1 minute
    },
    enabled: true,
    notificationChannels: ['slack', 'email'],
  },
];
