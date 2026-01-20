/**
 * TIS TIS Platform - Voice Agent v2.0
 * Voice Metrics Service
 *
 * Centralized metrics collection and aggregation for voice agent monitoring.
 * Implements:
 * - Counter, Gauge, and Histogram metric types
 * - Automatic percentile calculation
 * - Thread-safe operations
 * - Export to Supabase for persistence
 *
 * @module lib/voice-agent/monitoring/voice-metrics
 */

import type {
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  Metric,
  VoiceMetrics,
} from './types';
import {
  VOICE_METRIC_NAMES,
  DEFAULT_LATENCY_BUCKETS,
  DEFAULT_DURATION_BUCKETS,
} from './types';

// =====================================================
// METRIC REGISTRY
// =====================================================

/**
 * In-memory metrics registry
 * Uses singleton pattern for global access
 */
class MetricsRegistry {
  private static instance: MetricsRegistry;
  private metrics: Map<string, Metric>;
  private histogramValues: Map<string, number[]>; // For percentile calculation
  private readonly startTime: number;

  private constructor() {
    this.metrics = new Map();
    this.histogramValues = new Map();
    this.startTime = Date.now();
    this.initializeDefaultMetrics();
  }

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    MetricsRegistry.instance = undefined as unknown as MetricsRegistry;
  }

  /**
   * Initialize default voice agent metrics
   */
  private initializeDefaultMetrics(): void {
    // Counters
    this.registerCounter(VOICE_METRIC_NAMES.CALLS_TOTAL, 'Total voice calls', {});
    this.registerCounter(VOICE_METRIC_NAMES.CALLS_SUCCESSFUL, 'Successful voice calls', {});
    this.registerCounter(VOICE_METRIC_NAMES.ERRORS_TOTAL, 'Total voice errors', {});
    this.registerCounter(VOICE_METRIC_NAMES.WEBHOOK_FAILURES, 'Total webhook failures', {});
    this.registerCounter(VOICE_METRIC_NAMES.TRANSFERS_TOTAL, 'Total transfers to human', {});

    // Gauges
    this.registerGauge(VOICE_METRIC_NAMES.ACTIVE_CALLS, 'Currently active calls', {});
    this.registerGauge(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE, 'Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)', {});

    // Histograms
    this.registerHistogram(
      VOICE_METRIC_NAMES.LATENCY,
      'Voice response latency in seconds',
      {},
      { ...DEFAULT_LATENCY_BUCKETS }
    );
    this.registerHistogram(
      VOICE_METRIC_NAMES.CALL_DURATION,
      'Voice call duration in seconds',
      {},
      { ...DEFAULT_DURATION_BUCKETS }
    );
    this.registerHistogram(
      VOICE_METRIC_NAMES.RAG_LATENCY,
      'RAG retrieval latency in seconds',
      {},
      { ...DEFAULT_LATENCY_BUCKETS }
    );
  }

  // =====================================================
  // COUNTER OPERATIONS
  // =====================================================

  registerCounter(
    name: string,
    description: string,
    labels: Record<string, string>
  ): void {
    const counter: CounterMetric = {
      name,
      description,
      type: 'counter',
      labels,
      value: 0,
      updatedAt: new Date().toISOString(),
    };
    this.metrics.set(name, counter);
  }

  incrementCounter(name: string, delta: number = 1, labels?: Record<string, string>): void {
    const metricKey = this.getMetricKey(name, labels);
    let metric = this.metrics.get(metricKey);

    if (!metric) {
      // Auto-register counter if it doesn't exist
      this.registerCounter(name, `Auto-registered counter: ${name}`, labels || {});
      metric = this.metrics.get(metricKey);
    }

    if (metric && metric.type === 'counter') {
      (metric as CounterMetric).value += delta;
      metric.updatedAt = new Date().toISOString();
    }
  }

  // =====================================================
  // GAUGE OPERATIONS
  // =====================================================

  registerGauge(
    name: string,
    description: string,
    labels: Record<string, string>
  ): void {
    const gauge: GaugeMetric = {
      name,
      description,
      type: 'gauge',
      labels,
      value: 0,
      updatedAt: new Date().toISOString(),
    };
    this.metrics.set(name, gauge);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const metricKey = this.getMetricKey(name, labels);
    let metric = this.metrics.get(metricKey);

    if (!metric) {
      this.registerGauge(name, `Auto-registered gauge: ${name}`, labels || {});
      metric = this.metrics.get(metricKey);
    }

    if (metric && metric.type === 'gauge') {
      (metric as GaugeMetric).value = value;
      metric.updatedAt = new Date().toISOString();
    }
  }

  incrementGauge(name: string, delta: number = 1, labels?: Record<string, string>): void {
    const metricKey = this.getMetricKey(name, labels);
    const metric = this.metrics.get(metricKey);

    if (metric && metric.type === 'gauge') {
      (metric as GaugeMetric).value += delta;
      metric.updatedAt = new Date().toISOString();
    }
  }

  decrementGauge(name: string, delta: number = 1, labels?: Record<string, string>): void {
    const metricKey = this.getMetricKey(name, labels);
    const metric = this.metrics.get(metricKey);

    if (metric && metric.type === 'gauge') {
      const gauge = metric as GaugeMetric;
      // Prevent negative values
      gauge.value = Math.max(0, gauge.value - delta);
      gauge.updatedAt = new Date().toISOString();
    }
  }

  // =====================================================
  // HISTOGRAM OPERATIONS
  // =====================================================

  registerHistogram(
    name: string,
    description: string,
    labels: Record<string, string>,
    buckets: Record<string, number>
  ): void {
    const histogram: HistogramMetric = {
      name,
      description,
      type: 'histogram',
      labels,
      count: 0,
      sum: 0,
      buckets: { ...buckets },
      percentiles: { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
      updatedAt: new Date().toISOString(),
    };
    this.metrics.set(name, histogram);
    this.histogramValues.set(name, []);
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const metricKey = this.getMetricKey(name, labels);
    const metric = this.metrics.get(metricKey);

    if (metric && metric.type === 'histogram') {
      const histogram = metric as HistogramMetric;

      // Update count and sum
      histogram.count++;
      histogram.sum += value;

      // Update buckets
      for (const bucket of Object.keys(histogram.buckets)) {
        if (bucket === '+Inf' || value <= parseFloat(bucket)) {
          histogram.buckets[bucket]++;
        }
      }

      // Store value for percentile calculation
      let values = this.histogramValues.get(metricKey);
      if (!values) {
        values = [];
        this.histogramValues.set(metricKey, values);
      }
      values.push(value);

      // Keep only last 10000 values for memory efficiency
      if (values.length > 10000) {
        values.shift();
      }

      // Recalculate percentiles
      histogram.percentiles = this.calculatePercentiles(values);
      histogram.updatedAt = new Date().toISOString();
    }
  }

  private calculatePercentiles(values: number[]): HistogramMetric['percentiles'] {
    if (values.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)] || 0,
      p75: sorted[Math.floor(len * 0.75)] || 0,
      p90: sorted[Math.floor(len * 0.9)] || 0,
      p95: sorted[Math.floor(len * 0.95)] || 0,
      p99: sorted[Math.floor(len * 0.99)] || 0,
    };
  }

  // =====================================================
  // GETTERS
  // =====================================================

  getMetric(name: string, labels?: Record<string, string>): Metric | undefined {
    const metricKey = this.getMetricKey(name, labels);
    return this.metrics.get(metricKey);
  }

  getAllMetrics(): Map<string, Metric> {
    return new Map(this.metrics);
  }

  getVoiceMetrics(): Partial<VoiceMetrics> {
    const result: Partial<VoiceMetrics> = {};

    for (const key of Object.values(VOICE_METRIC_NAMES)) {
      const metric = this.metrics.get(key);
      if (metric) {
        (result as Record<string, Metric>)[key] = metric;
      }
    }

    return result;
  }

  getCounterValue(name: string, labels?: Record<string, string>): number {
    const metric = this.getMetric(name, labels);
    if (metric?.type === 'counter') {
      return (metric as CounterMetric).value;
    }
    return 0;
  }

  getGaugeValue(name: string, labels?: Record<string, string>): number {
    const metric = this.getMetric(name, labels);
    if (metric?.type === 'gauge') {
      return (metric as GaugeMetric).value;
    }
    return 0;
  }

  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    percentiles: HistogramMetric['percentiles'];
  } | null {
    const metric = this.getMetric(name, labels);
    if (metric?.type === 'histogram') {
      const histogram = metric as HistogramMetric;
      return {
        count: histogram.count,
        sum: histogram.sum,
        avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
        percentiles: histogram.percentiles,
      };
    }
    return null;
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  // =====================================================
  // UTILITIES
  // =====================================================

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${sortedLabels}}`;
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.histogramValues.clear();
    this.initializeDefaultMetrics();
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // Add HELP line
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      // Add TYPE line
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      const labelsStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const labelsPart = labelsStr ? `{${labelsStr}}` : '';

      switch (metric.type) {
        case 'counter':
        case 'gauge':
          lines.push(`${metric.name}${labelsPart} ${(metric as CounterMetric | GaugeMetric).value}`);
          break;
        case 'histogram': {
          const h = metric as HistogramMetric;
          for (const [bucket, count] of Object.entries(h.buckets)) {
            const le = bucket === '+Inf' ? '+Inf' : bucket;
            lines.push(`${metric.name}_bucket{le="${le}"${labelsStr ? ',' + labelsStr : ''}} ${count}`);
          }
          lines.push(`${metric.name}_sum${labelsPart} ${h.sum}`);
          lines.push(`${metric.name}_count${labelsPart} ${h.count}`);
          break;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, metric] of this.metrics.entries()) {
      result[key] = { ...metric };
    }

    return result;
  }
}

// =====================================================
// SINGLETON EXPORTS
// =====================================================

/**
 * Get the metrics registry instance
 */
export function getMetricsRegistry(): MetricsRegistry {
  return MetricsRegistry.getInstance();
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Record a new voice call
 */
export function recordVoiceCall(labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.incrementCounter(VOICE_METRIC_NAMES.CALLS_TOTAL, 1, labels);
}

/**
 * Record a successful voice call
 */
export function recordSuccessfulCall(labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.incrementCounter(VOICE_METRIC_NAMES.CALLS_SUCCESSFUL, 1, labels);
}

/**
 * Record a voice error
 */
export function recordVoiceError(errorType?: string, labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  const errorLabels = errorType ? { ...labels, error_type: errorType } : labels;
  registry.incrementCounter(VOICE_METRIC_NAMES.ERRORS_TOTAL, 1, errorLabels);
}

/**
 * Record a webhook failure
 */
export function recordWebhookFailure(labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.incrementCounter(VOICE_METRIC_NAMES.WEBHOOK_FAILURES, 1, labels);
}

/**
 * Record a transfer to human
 * @param reason - Optional reason for the transfer
 */
export function recordTransfer(reason?: string, labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  const transferLabels = reason ? { ...labels, reason } : labels;
  registry.incrementCounter(VOICE_METRIC_NAMES.TRANSFERS_TOTAL, 1, transferLabels);
}

/**
 * Update active calls count
 */
export function setActiveCalls(count: number, labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.setGauge(VOICE_METRIC_NAMES.ACTIVE_CALLS, count, labels);
}

/**
 * Increment active calls
 */
export function incrementActiveCalls(labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.incrementGauge(VOICE_METRIC_NAMES.ACTIVE_CALLS, 1, labels);
}

/**
 * Decrement active calls
 */
export function decrementActiveCalls(labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.decrementGauge(VOICE_METRIC_NAMES.ACTIVE_CALLS, 1, labels);
}

/**
 * Update circuit breaker state
 * @param state - 'CLOSED' | 'HALF_OPEN' | 'OPEN'
 * @param tenantId - Optional tenant ID for labeling
 */
export function setCircuitBreakerState(
  state: 'CLOSED' | 'HALF_OPEN' | 'OPEN',
  tenantId?: string
): void {
  const registry = getMetricsRegistry();
  const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
  // TIS TIS uses tenant_id, not business_id
  const labels = tenantId ? { tenant_id: tenantId } : undefined;
  registry.setGauge(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE, stateValue, labels);
}

/**
 * Record voice response latency
 * @param latencyMs - Latency in milliseconds
 */
export function recordLatency(latencyMs: number, labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.observeHistogram(VOICE_METRIC_NAMES.LATENCY, latencyMs / 1000, labels);
}

/**
 * Record call duration
 * @param durationSeconds - Duration in seconds
 */
export function recordCallDuration(durationSeconds: number, labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.observeHistogram(VOICE_METRIC_NAMES.CALL_DURATION, durationSeconds, labels);
}

/**
 * Record RAG latency
 * @param latencyMs - Latency in milliseconds
 */
export function recordRagLatency(latencyMs: number, labels?: Record<string, string>): void {
  const registry = getMetricsRegistry();
  registry.observeHistogram(VOICE_METRIC_NAMES.RAG_LATENCY, latencyMs / 1000, labels);
}

/**
 * Get current metrics summary for health check
 */
export function getMetricsSummary(): {
  activeCalls: number;
  totalCalls: number;
  successfulCalls: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  circuitBreakerState: number;
} {
  const registry = getMetricsRegistry();

  const totalCalls = registry.getCounterValue(VOICE_METRIC_NAMES.CALLS_TOTAL);
  const successfulCalls = registry.getCounterValue(VOICE_METRIC_NAMES.CALLS_SUCCESSFUL);
  const errorCount = registry.getCounterValue(VOICE_METRIC_NAMES.ERRORS_TOTAL);
  const activeCalls = registry.getGaugeValue(VOICE_METRIC_NAMES.ACTIVE_CALLS);

  const latencyStats = registry.getHistogramStats(VOICE_METRIC_NAMES.LATENCY);

  return {
    activeCalls,
    totalCalls,
    successfulCalls,
    errorCount,
    errorRate: totalCalls > 0 ? errorCount / totalCalls : 0,
    avgLatencyMs: latencyStats ? latencyStats.avg * 1000 : 0,
    p95LatencyMs: latencyStats ? latencyStats.percentiles.p95 * 1000 : 0,
    circuitBreakerState: registry.getGaugeValue(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE),
  };
}

/**
 * Export metrics in Prometheus format
 */
export function exportMetricsPrometheus(): string {
  return getMetricsRegistry().toPrometheusFormat();
}

/**
 * Export metrics as JSON string
 */
export function exportMetricsJSON(): string {
  const registry = getMetricsRegistry();
  const allMetrics = registry.getAllMetrics();

  const counters: Metric[] = [];
  const gauges: Metric[] = [];
  const histograms: Metric[] = [];

  for (const metric of allMetrics.values()) {
    switch (metric.type) {
      case 'counter':
        counters.push(metric);
        break;
      case 'gauge':
        gauges.push(metric);
        break;
      case 'histogram':
        histograms.push(metric);
        break;
    }
  }

  return JSON.stringify({
    counters,
    gauges,
    histograms,
    exportedAt: new Date().toISOString(),
    uptimeSeconds: registry.getUptimeSeconds(),
  });
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  getMetricsRegistry().reset();
}

/**
 * Generic counter increment
 */
export function incrementCounter(name: string, delta: number = 1, labels?: Record<string, string>): void {
  getMetricsRegistry().incrementCounter(name, delta, labels);
}

/**
 * Generic gauge set
 */
export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
  getMetricsRegistry().setGauge(name, value, labels);
}

/**
 * Generic gauge increment
 */
export function incrementGauge(name: string, delta: number = 1, labels?: Record<string, string>): void {
  getMetricsRegistry().incrementGauge(name, delta, labels);
}

/**
 * Generic gauge decrement
 */
export function decrementGauge(name: string, delta: number = 1, labels?: Record<string, string>): void {
  getMetricsRegistry().decrementGauge(name, delta, labels);
}

/**
 * Generic histogram observation
 */
export function observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
  getMetricsRegistry().observeHistogram(name, value, labels);
}

/**
 * Record RAG latency (alias)
 */
export function recordRAGLatency(latencyMs: number, labels?: Record<string, string>): void {
  recordRagLatency(latencyMs, labels);
}

// Export the MetricsRegistry class for type purposes and testing
export { MetricsRegistry };
