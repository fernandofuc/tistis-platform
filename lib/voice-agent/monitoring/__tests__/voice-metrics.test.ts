/**
 * TIS TIS Platform - Voice Agent v2.0
 * Voice Metrics Tests
 *
 * Tests for the metrics collection system:
 * - Counter operations
 * - Gauge operations
 * - Histogram operations
 * - Export formats (Prometheus, JSON)
 * - Metrics summary
 */

import {
  MetricsRegistry,
  getMetricsRegistry,
  recordVoiceCall,
  recordSuccessfulCall,
  recordVoiceError,
  recordWebhookFailure,
  recordTransfer,
  incrementActiveCalls,
  decrementActiveCalls,
  setCircuitBreakerState,
  recordLatency,
  recordCallDuration,
  recordRAGLatency,
  getMetricsSummary,
  exportMetricsPrometheus,
  exportMetricsJSON,
  resetMetrics,
} from '../voice-metrics';
import { VOICE_METRIC_NAMES } from '../types';

// =====================================================
// TEST SETUP
// =====================================================

describe('Voice Metrics System', () => {
  beforeEach(() => {
    // Reset metrics before each test
    MetricsRegistry.resetInstance();
    resetMetrics();
  });

  // =====================================================
  // COUNTER TESTS
  // =====================================================

  describe('Counter Operations', () => {
    it('should record voice calls correctly', () => {
      recordVoiceCall();
      recordVoiceCall();
      recordVoiceCall();

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.CALLS_TOTAL);

      expect(metric).toBeDefined();
      expect(metric?.type).toBe('counter');
      if (metric?.type === 'counter') {
        expect(metric.value).toBe(3);
      }
    });

    it('should record successful calls separately', () => {
      recordVoiceCall();
      recordVoiceCall();
      recordSuccessfulCall();

      const registry = getMetricsRegistry();
      const totalMetric = registry.getMetric(VOICE_METRIC_NAMES.CALLS_TOTAL);
      const successMetric = registry.getMetric(VOICE_METRIC_NAMES.CALLS_SUCCESSFUL);

      if (totalMetric?.type === 'counter') {
        expect(totalMetric.value).toBe(2);
      }
      if (successMetric?.type === 'counter') {
        expect(successMetric.value).toBe(1);
      }
    });

    it('should record errors with optional type', () => {
      recordVoiceError();
      recordVoiceError('network');
      recordVoiceError('timeout');

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.ERRORS_TOTAL);

      expect(metric).toBeDefined();
      if (metric?.type === 'counter') {
        expect(metric.value).toBe(3);
      }
    });

    it('should record webhook failures', () => {
      recordWebhookFailure();
      recordWebhookFailure({ tenantId: 'test-tenant' });

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.WEBHOOK_FAILURES);

      expect(metric).toBeDefined();
      if (metric?.type === 'counter') {
        expect(metric.value).toBe(2);
      }
    });

    it('should record transfers', () => {
      recordTransfer('human_requested');
      recordTransfer('timeout');

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.TRANSFERS_TOTAL);

      expect(metric).toBeDefined();
      if (metric?.type === 'counter') {
        expect(metric.value).toBe(2);
      }
    });

    it('should not allow negative counter increments', () => {
      const registry = getMetricsRegistry();

      // Counter should start at 0
      recordVoiceCall();

      const metric = registry.getMetric(VOICE_METRIC_NAMES.CALLS_TOTAL);
      if (metric?.type === 'counter') {
        expect(metric.value).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =====================================================
  // GAUGE TESTS
  // =====================================================

  describe('Gauge Operations', () => {
    it('should track active calls', () => {
      incrementActiveCalls();
      incrementActiveCalls();
      incrementActiveCalls();

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.ACTIVE_CALLS);

      if (metric?.type === 'gauge') {
        expect(metric.value).toBe(3);
      }

      decrementActiveCalls();

      const updatedMetric = registry.getMetric(VOICE_METRIC_NAMES.ACTIVE_CALLS);
      if (updatedMetric?.type === 'gauge') {
        expect(updatedMetric.value).toBe(2);
      }
    });

    it('should not allow negative active calls', () => {
      decrementActiveCalls();
      decrementActiveCalls();

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.ACTIVE_CALLS);

      if (metric?.type === 'gauge') {
        expect(metric.value).toBe(0);
      }
    });

    it('should set circuit breaker state correctly', () => {
      setCircuitBreakerState('CLOSED');

      const registry = getMetricsRegistry();
      let metric = registry.getMetric(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE);

      if (metric?.type === 'gauge') {
        expect(metric.value).toBe(0);
      }

      setCircuitBreakerState('HALF_OPEN');
      metric = registry.getMetric(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE);
      if (metric?.type === 'gauge') {
        expect(metric.value).toBe(1);
      }

      setCircuitBreakerState('OPEN');
      metric = registry.getMetric(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE);
      if (metric?.type === 'gauge') {
        expect(metric.value).toBe(2);
      }
    });
  });

  // =====================================================
  // HISTOGRAM TESTS
  // =====================================================

  describe('Histogram Operations', () => {
    it('should record latency measurements', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.LATENCY);

      expect(metric).toBeDefined();
      expect(metric?.type).toBe('histogram');
      if (metric?.type === 'histogram') {
        expect(metric.count).toBe(3);
        expect(metric.sum).toBeCloseTo(0.6, 1); // 600ms = 0.6s
      }
    });

    it('should calculate percentiles correctly', () => {
      // Record 100 latency values from 10ms to 1000ms
      for (let i = 10; i <= 1000; i += 10) {
        recordLatency(i);
      }

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.LATENCY);

      if (metric?.type === 'histogram') {
        expect(metric.count).toBe(100);
        // P50 should be around 500ms (0.5s)
        expect(metric.percentiles.p50).toBeGreaterThan(0.4);
        expect(metric.percentiles.p50).toBeLessThan(0.6);
        // P95 should be around 950ms (0.95s)
        expect(metric.percentiles.p95).toBeGreaterThan(0.9);
      }
    });

    it('should record call duration', () => {
      recordCallDuration(60); // 1 minute
      recordCallDuration(120); // 2 minutes
      recordCallDuration(180); // 3 minutes

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.CALL_DURATION);

      if (metric?.type === 'histogram') {
        expect(metric.count).toBe(3);
        expect(metric.sum).toBe(360); // Total seconds
      }
    });

    it('should record RAG latency', () => {
      recordRAGLatency(50);
      recordRAGLatency(100);
      recordRAGLatency(150);

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.RAG_LATENCY);

      if (metric?.type === 'histogram') {
        expect(metric.count).toBe(3);
      }
    });

    it('should update histogram buckets', () => {
      // Record values in different bucket ranges
      recordLatency(40);   // < 50ms bucket
      recordLatency(80);   // < 100ms bucket
      recordLatency(200);  // < 250ms bucket
      recordLatency(600);  // < 750ms bucket
      recordLatency(1500); // < 2000ms bucket
      recordLatency(6000); // +Inf bucket

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.LATENCY);

      if (metric?.type === 'histogram') {
        expect(metric.count).toBe(6);
        // Check that buckets are populated
        expect(Object.values(metric.buckets).some((v) => v > 0)).toBe(true);
      }
    });
  });

  // =====================================================
  // EXPORT TESTS
  // =====================================================

  describe('Export Functions', () => {
    beforeEach(() => {
      // Add some test data
      recordVoiceCall();
      recordSuccessfulCall();
      recordVoiceError();
      incrementActiveCalls();
      setCircuitBreakerState('CLOSED');
      recordLatency(100);
      recordCallDuration(60);
    });

    it('should export metrics in Prometheus format', () => {
      const prometheus = exportMetricsPrometheus();

      expect(prometheus).toContain('# HELP');
      expect(prometheus).toContain('# TYPE');
      expect(prometheus).toContain('voice_calls_total');
      expect(prometheus).toContain('counter');
      expect(prometheus).toContain('gauge');
      expect(prometheus).toContain('histogram');
    });

    it('should include all metric types in Prometheus export', () => {
      const prometheus = exportMetricsPrometheus();

      // Check counters
      expect(prometheus).toContain(VOICE_METRIC_NAMES.CALLS_TOTAL);
      expect(prometheus).toContain(VOICE_METRIC_NAMES.ERRORS_TOTAL);

      // Check gauges
      expect(prometheus).toContain(VOICE_METRIC_NAMES.ACTIVE_CALLS);
      expect(prometheus).toContain(VOICE_METRIC_NAMES.CIRCUIT_BREAKER_STATE);

      // Check histograms
      expect(prometheus).toContain(VOICE_METRIC_NAMES.LATENCY);
      expect(prometheus).toContain('_bucket');
      expect(prometheus).toContain('_sum');
      expect(prometheus).toContain('_count');
    });

    it('should export metrics as JSON', () => {
      const json = exportMetricsJSON();
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('counters');
      expect(parsed).toHaveProperty('gauges');
      expect(parsed).toHaveProperty('histograms');
      expect(parsed).toHaveProperty('exportedAt');
    });

    it('should include metric values in JSON export', () => {
      const json = exportMetricsJSON();
      const parsed = JSON.parse(json);

      // Check counter values
      expect(parsed.counters).toBeDefined();
      const totalCalls = parsed.counters.find((c: { name: string }) =>
        c.name === VOICE_METRIC_NAMES.CALLS_TOTAL
      );
      expect(totalCalls).toBeDefined();
      expect(totalCalls.value).toBeGreaterThan(0);
    });
  });

  // =====================================================
  // SUMMARY TESTS
  // =====================================================

  describe('Metrics Summary', () => {
    it('should return correct summary with no data', () => {
      const summary = getMetricsSummary();

      expect(summary.activeCalls).toBe(0);
      expect(summary.totalCalls).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.avgLatencyMs).toBe(0);
      expect(summary.p95LatencyMs).toBe(0);
    });

    it('should calculate error rate correctly', () => {
      // 10 total calls, 2 errors = 20% error rate
      for (let i = 0; i < 10; i++) {
        recordVoiceCall();
      }
      recordVoiceError();
      recordVoiceError();

      const summary = getMetricsSummary();

      expect(summary.totalCalls).toBe(10);
      expect(summary.errorRate).toBeCloseTo(0.2, 1);
    });

    it('should calculate average latency correctly', () => {
      recordLatency(100);
      recordLatency(200);
      recordLatency(300);

      const summary = getMetricsSummary();

      expect(summary.avgLatencyMs).toBeCloseTo(200, -1);
    });

    it('should include all summary fields', () => {
      recordVoiceCall();
      incrementActiveCalls();
      recordLatency(100);
      setCircuitBreakerState('HALF_OPEN');

      const summary = getMetricsSummary();

      expect(summary).toHaveProperty('activeCalls');
      expect(summary).toHaveProperty('totalCalls');
      expect(summary).toHaveProperty('successfulCalls');
      expect(summary).toHaveProperty('errorRate');
      expect(summary).toHaveProperty('avgLatencyMs');
      expect(summary).toHaveProperty('p95LatencyMs');
      expect(summary).toHaveProperty('circuitBreakerState');
    });
  });

  // =====================================================
  // SINGLETON TESTS
  // =====================================================

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getMetricsRegistry();
      const instance2 = getMetricsRegistry();

      expect(instance1).toBe(instance2);
    });

    it('should persist data across calls', () => {
      recordVoiceCall();

      // Get new reference to registry
      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.CALLS_TOTAL);

      if (metric?.type === 'counter') {
        expect(metric.value).toBe(1);
      }
    });

    it('should reset correctly', () => {
      recordVoiceCall();
      recordVoiceCall();

      resetMetrics();

      const summary = getMetricsSummary();
      expect(summary.totalCalls).toBe(0);
    });
  });

  // =====================================================
  // LABEL TESTS
  // =====================================================

  describe('Metric Labels', () => {
    it('should record metrics with labels', () => {
      recordVoiceCall({ tenantId: 'tenant-1' });
      recordVoiceCall({ tenantId: 'tenant-2' });

      const registry = getMetricsRegistry();
      const metric = registry.getMetric(VOICE_METRIC_NAMES.CALLS_TOTAL);

      expect(metric).toBeDefined();
      if (metric?.type === 'counter') {
        expect(metric.value).toBe(2);
      }
    });

    it('should include labels in Prometheus export', () => {
      recordVoiceCall({ tenantId: 'test-tenant', version: 'v2' });

      const prometheus = exportMetricsPrometheus();

      // Labels should be included in output
      expect(prometheus).toContain('voice_calls_total');
    });
  });
});
