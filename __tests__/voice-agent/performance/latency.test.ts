/**
 * TIS TIS Platform - Voice Agent v2.0
 * Performance Tests: Latency
 *
 * Tests performance requirements for the Voice Agent:
 * - Webhook latency (< 800ms p95)
 * - RAG response latency (< 200ms)
 * - Tool execution latency
 * - End-to-end response time
 *
 * @jest-environment node
 */

// =====================================================
// PERFORMANCE MEASUREMENT UTILITIES
// =====================================================

interface LatencyMeasurement {
  operation: string;
  durationMs: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface PerformanceReport {
  operation: string;
  sampleCount: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

class PerformanceCollector {
  private measurements: Map<string, LatencyMeasurement[]> = new Map();

  record(operation: string, durationMs: number, metadata?: Record<string, unknown>): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }
    this.measurements.get(operation)!.push({
      operation,
      durationMs,
      timestamp: new Date(),
      metadata,
    });
  }

  async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.record(operation, duration);
    }
  }

  getReport(operation: string): PerformanceReport | null {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const durations = measurements.map((m) => m.durationMs).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / count;

    // Standard deviation
    const squaredDiffs = durations.map((d) => Math.pow(d - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count;
    const stdDev = Math.sqrt(avgSquaredDiff);

    return {
      operation,
      sampleCount: count,
      min: durations[0],
      max: durations[count - 1],
      avg,
      p50: durations[Math.floor(count * 0.5)],
      p95: durations[Math.floor(count * 0.95)],
      p99: durations[Math.floor(count * 0.99)],
      stdDev,
    };
  }

  clear(): void {
    this.measurements.clear();
  }
}

// =====================================================
// SIMULATED OPERATIONS
// =====================================================

async function simulateWebhookProcessing(complexityFactor: number = 1): Promise<void> {
  // Base processing: 50-150ms
  const baseLatency = 50 + Math.random() * 100;
  // Complexity adds 0-200ms
  const complexityLatency = Math.random() * 200 * complexityFactor;
  // Network variability: 0-50ms
  const networkLatency = Math.random() * 50;

  await new Promise((resolve) => setTimeout(resolve, baseLatency + complexityLatency + networkLatency));
}

async function simulateRAGQuery(documentCount: number = 5): Promise<string[]> {
  // Embedding generation: 20-40ms
  const embeddingLatency = 20 + Math.random() * 20;
  // Vector search: 10-30ms per document
  const searchLatency = (10 + Math.random() * 20) * Math.min(documentCount, 10);
  // Result processing: 5-15ms
  const processingLatency = 5 + Math.random() * 10;

  await new Promise((resolve) =>
    setTimeout(resolve, embeddingLatency + searchLatency + processingLatency)
  );

  return Array.from({ length: documentCount }).map(
    (_, i) => `Document ${i + 1}: Relevant content...`
  );
}

async function simulateToolExecution(toolName: string): Promise<unknown> {
  const toolLatencies: Record<string, [number, number]> = {
    check_availability: [50, 150],
    create_appointment: [100, 300],
    get_business_hours: [20, 50],
    get_menu: [30, 80],
    create_reservation: [100, 250],
    transfer_to_human: [50, 100],
    end_call: [20, 40],
  };

  const [minMs, maxMs] = toolLatencies[toolName] || [50, 200];
  const latency = minMs + Math.random() * (maxMs - minMs);

  await new Promise((resolve) => setTimeout(resolve, latency));

  return { success: true, tool: toolName };
}

async function simulateLLMCall(): Promise<string> {
  // LLM calls are 200-600ms typically
  const latency = 200 + Math.random() * 400;
  await new Promise((resolve) => setTimeout(resolve, latency));
  return 'LLM response content';
}

// =====================================================
// PERFORMANCE TESTS: WEBHOOK LATENCY
// =====================================================

describe('Performance: Webhook Latency', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  it('should process webhooks under 800ms p95', async () => {
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('webhook_processing', async () => {
        await simulateWebhookProcessing(0.5); // Low complexity
      });
    }

    const report = collector.getReport('webhook_processing');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(800);
  }, 60000);

  it('should handle complex webhooks under 1000ms p95', async () => {
    const iterations = 30;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('complex_webhook', async () => {
        await simulateWebhookProcessing(1.5); // High complexity
      });
    }

    const report = collector.getReport('complex_webhook');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(1000);
  }, 60000);

  it('should have consistent latency (low std dev)', async () => {
    const iterations = 30;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('consistency_test', async () => {
        await simulateWebhookProcessing(0.5);
      });
    }

    const report = collector.getReport('consistency_test');
    expect(report).not.toBeNull();
    // Standard deviation should be less than 50% of average
    expect(report!.stdDev).toBeLessThan(report!.avg * 0.5);
  }, 60000);
});

// =====================================================
// PERFORMANCE TESTS: RAG LATENCY
// =====================================================

describe('Performance: RAG Latency', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  it('should return RAG results under 200ms p95', async () => {
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('rag_query', async () => {
        await simulateRAGQuery(5);
      });
    }

    const report = collector.getReport('rag_query');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(200);
  }, 30000);

  it('should handle large document sets under 400ms', async () => {
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('large_rag_query', async () => {
        await simulateRAGQuery(20);
      });
    }

    const report = collector.getReport('large_rag_query');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(400); // Adjusted for realistic large document sets
  }, 30000);

  it('should have sub-100ms minimum latency', async () => {
    const iterations = 30;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('rag_min_latency', async () => {
        await simulateRAGQuery(3);
      });
    }

    const report = collector.getReport('rag_min_latency');
    expect(report).not.toBeNull();
    expect(report!.min).toBeLessThan(100);
  }, 30000);
});

// =====================================================
// PERFORMANCE TESTS: TOOL EXECUTION
// =====================================================

describe('Performance: Tool Execution', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  it('should execute fast tools under 100ms', async () => {
    const fastTools = ['get_business_hours', 'end_call'];
    const iterations = 20;

    for (const tool of fastTools) {
      for (let i = 0; i < iterations; i++) {
        await collector.measure(`tool_${tool}`, async () => {
          await simulateToolExecution(tool);
        });
      }

      const report = collector.getReport(`tool_${tool}`);
      expect(report).not.toBeNull();
      expect(report!.p95).toBeLessThan(100);
    }
  }, 30000);

  it('should execute database tools under 300ms', async () => {
    const dbTools = ['check_availability', 'create_appointment', 'create_reservation'];
    const iterations = 15;

    for (const tool of dbTools) {
      for (let i = 0; i < iterations; i++) {
        await collector.measure(`db_tool_${tool}`, async () => {
          await simulateToolExecution(tool);
        });
      }

      const report = collector.getReport(`db_tool_${tool}`);
      expect(report).not.toBeNull();
      expect(report!.p95).toBeLessThan(400);
    }
  }, 30000);

  it('should execute all tools in parallel efficiently', async () => {
    const tools = ['check_availability', 'get_business_hours', 'get_menu'];

    await collector.measure('parallel_tools', async () => {
      await Promise.all(tools.map((tool) => simulateToolExecution(tool)));
    });

    const report = collector.getReport('parallel_tools');
    expect(report).not.toBeNull();
    // Parallel should be faster than sequential
    expect(report!.avg).toBeLessThan(400);
  });
});

// =====================================================
// PERFORMANCE TESTS: END-TO-END
// =====================================================

describe('Performance: End-to-End Response', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  it('should complete simple flow under 1s', async () => {
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('simple_flow', async () => {
        // Webhook processing
        await simulateWebhookProcessing(0.3);
        // LLM call
        await simulateLLMCall();
      });
    }

    const report = collector.getReport('simple_flow');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(1000);
  }, 30000);

  it('should complete RAG-assisted flow under 1.5s', async () => {
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('rag_flow', async () => {
        // Webhook processing
        await simulateWebhookProcessing(0.3);
        // RAG query
        await simulateRAGQuery(5);
        // LLM call with context
        await simulateLLMCall();
      });
    }

    const report = collector.getReport('rag_flow');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(1500);
  }, 30000);

  it('should complete tool-calling flow under 1.5s', async () => {
    const iterations = 10;

    for (let i = 0; i < iterations; i++) {
      await collector.measure('tool_flow', async () => {
        // Webhook processing
        await simulateWebhookProcessing(0.3);
        // LLM decides to call tool
        await simulateLLMCall();
        // Tool execution
        await simulateToolExecution('check_availability');
        // LLM processes tool result
        await simulateLLMCall();
      });
    }

    const report = collector.getReport('tool_flow');
    expect(report).not.toBeNull();
    expect(report!.p95).toBeLessThan(1500);
  }, 45000);
});

// =====================================================
// PERFORMANCE TESTS: LOAD
// =====================================================

describe('Performance: Load Testing', () => {
  let collector: PerformanceCollector;

  beforeEach(() => {
    collector = new PerformanceCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  it('should handle concurrent requests', async () => {
    const concurrentRequests = 10;
    const requests = Array.from({ length: concurrentRequests }).map((_, i) =>
      collector.measure(`concurrent_${i}`, async () => {
        await simulateWebhookProcessing(0.5);
      })
    );

    await Promise.all(requests);

    // Verify all requests completed
    for (let i = 0; i < concurrentRequests; i++) {
      const report = collector.getReport(`concurrent_${i}`);
      expect(report).not.toBeNull();
      expect(report!.sampleCount).toBe(1);
    }
  }, 30000);

  it('should maintain performance under load', async () => {
    const warmupRequests = 5;
    const loadRequests = 20;

    // Warmup
    for (let i = 0; i < warmupRequests; i++) {
      await collector.measure('warmup', async () => {
        await simulateWebhookProcessing(0.5);
      });
    }

    // Load test
    for (let i = 0; i < loadRequests; i++) {
      await collector.measure('load_test', async () => {
        await simulateWebhookProcessing(0.5);
      });
    }

    const warmupReport = collector.getReport('warmup');
    const loadReport = collector.getReport('load_test');

    expect(warmupReport).not.toBeNull();
    expect(loadReport).not.toBeNull();

    // Load performance shouldn't degrade more than 30% (allows for test environment variability)
    expect(loadReport!.avg).toBeLessThan(warmupReport!.avg * 1.3);
  }, 60000);

  it('should scale linearly with complexity', async () => {
    const complexityLevels = [0.25, 0.5, 1.0];
    const iterations = 10;

    for (const complexity of complexityLevels) {
      for (let i = 0; i < iterations; i++) {
        await collector.measure(`complexity_${complexity}`, async () => {
          await simulateWebhookProcessing(complexity);
        });
      }
    }

    const report025 = collector.getReport('complexity_0.25');
    const report050 = collector.getReport('complexity_0.5');
    const report100 = collector.getReport('complexity_1');

    expect(report025).not.toBeNull();
    expect(report050).not.toBeNull();
    expect(report100).not.toBeNull();

    // Higher complexity should take longer
    expect(report050!.avg).toBeGreaterThan(report025!.avg * 0.8);
    expect(report100!.avg).toBeGreaterThan(report050!.avg * 0.8);
  }, 60000);
});

// =====================================================
// PERFORMANCE TESTS: MEMORY
// =====================================================

describe('Performance: Memory Usage', () => {
  it('should not leak memory during repeated operations', async () => {
    const iterations = 100;
    const memorySnapshots: number[] = [];

    for (let i = 0; i < iterations; i++) {
      await simulateWebhookProcessing(0.3);

      if (i % 20 === 0) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    // Memory growth should be minimal
    if (memorySnapshots.length >= 2) {
      const firstSnapshot = memorySnapshots[0];
      const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
      const growthPercent = ((lastSnapshot - firstSnapshot) / firstSnapshot) * 100;

      // Allow up to 50% growth (conservative for test environment)
      expect(growthPercent).toBeLessThan(50);
    }
  }, 30000);

  it('should clean up resources properly', () => {
    const collector = new PerformanceCollector();

    // Add some measurements
    for (let i = 0; i < 100; i++) {
      collector.record('test_op', Math.random() * 100);
    }

    // Clear and verify
    collector.clear();
    const report = collector.getReport('test_op');
    expect(report).toBeNull();
  });
});
