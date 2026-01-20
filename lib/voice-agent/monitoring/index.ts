/**
 * TIS TIS Platform - Voice Agent v2.0
 * Monitoring Module Exports
 *
 * Central export point for all monitoring functionality:
 * - Metrics collection and export
 * - Structured logging
 * - Alert system
 * - Health checks
 * - Notification services
 *
 * @module lib/voice-agent/monitoring
 */

// =====================================================
// TYPES
// =====================================================

export type {
  // Metric types
  MetricType,
  BaseMetric,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  Metric,
  VoiceMetrics,

  // Alert types
  AlertSeverity,
  AlertStatus,
  ComparisonOperator,
  AlertCondition,
  AlertRule,
  Alert,

  // Notification types
  NotificationChannel,
  NotificationConfigBase,
  SlackNotificationConfig,
  EmailNotificationConfig,
  PagerDutyNotificationConfig,
  WebhookNotificationConfig,
  NotificationConfig,
  NotificationPayload,

  // Health check types
  HealthStatus,
  ServiceHealth,
  HealthCheckResponse,

  // Dashboard types
  RolloutDashboardData,
  VersionStats,

  // Log types
  LogLevel,
  LogEntry,
} from './types';

// =====================================================
// CONSTANTS
// =====================================================

export {
  VOICE_METRIC_NAMES,
  DEFAULT_LATENCY_BUCKETS,
  DEFAULT_DURATION_BUCKETS,
  DEFAULT_ALERT_RULES,
} from './types';

// =====================================================
// METRICS
// =====================================================

export {
  // Main class
  MetricsRegistry,

  // Singleton functions
  getMetricsRegistry,

  // Counter operations
  incrementCounter,
  recordVoiceCall,
  recordSuccessfulCall,
  recordVoiceError,
  recordWebhookFailure,
  recordTransfer,

  // Gauge operations
  setGauge,
  incrementGauge,
  decrementGauge,
  incrementActiveCalls,
  decrementActiveCalls,
  setCircuitBreakerState,

  // Histogram operations
  observeHistogram,
  recordLatency,
  recordCallDuration,
  recordRAGLatency,

  // Export functions
  exportMetricsPrometheus,
  exportMetricsJSON,
  getMetricsSummary,
  resetMetrics,
} from './voice-metrics';

// =====================================================
// LOGGING
// =====================================================

export {
  // Main class
  VoiceLogger,
  ChildLogger,

  // Logger types
  type VoiceLoggerConfig,
  type CallContext,
  type ErrorContext,
  type CircuitBreakerContext,
  type RAGContext,
  type ToolContext,

  // Singleton functions
  getVoiceLogger,

  // Logging functions
  logDebug,
  logInfo,
  logWarn,
  logError,

  // Specialized logging
  logCallStart,
  logCallEnd,
  logVoiceError,
  logCircuitBreakerChange,
  logRAGOperation,
  logToolExecution,
  logLatency,

  // Utility functions
  createCallLogger,
  startTimer,
} from './voice-logger';

// =====================================================
// ALERT MANAGER
// =====================================================

export {
  // Main class
  AlertManager,

  // Types
  type AlertManagerConfig,

  // Singleton functions
  getAlertManager,
  startAlertManager,
  stopAlertManager,

  // Alert operations
  getActiveAlerts,
  getAlertSummary,
  acknowledgeAlert,
  resolveAlert,
  createManualAlert,

  // Rule operations
  addAlertRule,
  getAlertRules,
} from './alert-manager';

// =====================================================
// NOTIFICATION SERVICE
// =====================================================

export {
  // Main class
  NotificationService,

  // Types
  type NotificationServiceConfig,
  type DeliveryStatus,
  type NotificationRecord,

  // Singleton functions
  getNotificationService,

  // Notification operations
  sendAlertNotification,
  configureNotificationChannel,
  getNotificationHistory,
  getNotificationDeliveryStats,

  // Alert manager integration
  createNotificationHandler,
} from './notification-service';

// =====================================================
// DASHBOARD DATA
// =====================================================

export {
  // Main class
  DashboardDataService,

  // Types
  type DashboardConfig,

  // Singleton functions
  getDashboardDataService,

  // Data operations
  getRolloutDashboardData,
  getVersionComparison,
  getHealthCheck,
  getRealTimeMetrics,
} from './dashboard-data';
