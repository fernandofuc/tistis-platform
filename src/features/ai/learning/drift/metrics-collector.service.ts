// =====================================================
// TIS TIS PLATFORM - METRICS COLLECTOR SERVICE
// Collects and stores AI metrics for drift detection
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { DriftMetric, DriftBaseline } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type MetricType = DriftBaseline['metricType'];

interface RecordMetricParams {
  tenantId: string;
  metricType: MetricType;
  metricName: string;
  metricValue: number;
  conversationId?: string;
  messageId?: string;
  dimensions?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

interface MetricQuery {
  tenantId: string;
  metricType?: MetricType;
  metricName?: string;
  startDate?: Date;
  endDate?: Date;
  dimensions?: Record<string, string>;
  limit?: number;
}

interface MetricAggregation {
  metricName: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
}

export class MetricsCollectorService {
  private supabase;
  private buffer: RecordMetricParams[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.startFlushInterval();
  }

  /**
   * Record a single metric
   */
  async record(params: RecordMetricParams): Promise<void> {
    this.buffer.push(params);

    if (this.buffer.length >= this.BUFFER_SIZE) {
      await this.flush();
    }
  }

  /**
   * Record multiple metrics at once
   *
   * NOTE: The SQL table ai_drift_metrics stores AGGREGATED metrics per period.
   * This method aggregates metrics by name before inserting.
   *
   * SQL columns:
   * - metric_category (maps from metricType)
   * - period_start, period_end, period_type
   * - mean_value, std_value, min_value, max_value
   * - sample_count
   * - collected_at
   */
  async recordBatch(metrics: RecordMetricParams[]): Promise<void> {
    // Group metrics by name for aggregation
    const grouped = new Map<string, { tenantId: string; metricType: MetricType; values: number[] }>();

    for (const m of metrics) {
      const key = `${m.tenantId}:${m.metricType}:${m.metricName}`;
      const existing = grouped.get(key) || {
        tenantId: m.tenantId,
        metricType: m.metricType,
        values: [],
      };
      existing.values.push(m.metricValue);
      grouped.set(key, existing);
    }

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setMinutes(0, 0, 0); // Round to hour
    const periodEnd = new Date(periodStart);
    periodEnd.setHours(periodEnd.getHours() + 1);

    const records = Array.from(grouped.entries()).map(([key, data]) => {
      const [, , metricName] = key.split(':');
      const values = data.values;
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;

      return {
        tenant_id: data.tenantId,
        metric_category: this.mapMetricTypeToCategory(data.metricType),
        metric_name: metricName,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        period_type: 'hourly',
        sample_count: n,
        mean_value: mean,
        std_value: Math.sqrt(variance),
        min_value: Math.min(...values),
        max_value: Math.max(...values),
        metadata: {},
      };
    });

    // Use upsert to aggregate into existing period records
    const { error } = await this.supabase.from('ai_drift_metrics').upsert(records, {
      onConflict: 'tenant_id,metric_name,period_start',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error('[MetricsCollectorService] Error recording batch:', error);
      throw new Error(`Failed to record metrics: ${error.message}`);
    }
  }

  /**
   * Map TypeScript metricType to SQL metric_category
   */
  private mapMetricTypeToCategory(
    metricType: MetricType
  ): 'input' | 'output' | 'performance' | 'behavior' {
    switch (metricType) {
      case 'performance':
        return 'performance';
      case 'quality':
        return 'behavior';
      case 'input_distribution':
        return 'input';
      case 'output_distribution':
        return 'output';
      case 'custom':
        return 'behavior';
      default:
        return 'performance';
    }
  }

  /**
   * Record response latency
   */
  async recordLatency(
    tenantId: string,
    latencyMs: number,
    conversationId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.record({
      tenantId,
      metricType: 'performance',
      metricName: 'response_latency_ms',
      metricValue: latencyMs,
      conversationId,
      metadata,
    });
  }

  /**
   * Record token usage
   */
  async recordTokens(
    tenantId: string,
    inputTokens: number,
    outputTokens: number,
    conversationId?: string
  ): Promise<void> {
    await this.record({
      tenantId,
      metricType: 'performance',
      metricName: 'input_tokens',
      metricValue: inputTokens,
      conversationId,
    });

    await this.record({
      tenantId,
      metricType: 'performance',
      metricName: 'output_tokens',
      metricValue: outputTokens,
      conversationId,
    });
  }

  /**
   * Record feedback rate
   */
  async recordFeedback(
    tenantId: string,
    isPositive: boolean,
    conversationId?: string
  ): Promise<void> {
    await this.record({
      tenantId,
      metricType: 'quality',
      metricName: 'feedback_score',
      metricValue: isPositive ? 1 : 0,
      conversationId,
    });
  }

  /**
   * Record escalation event
   */
  async recordEscalation(
    tenantId: string,
    wasEscalated: boolean,
    conversationId?: string,
    reason?: string
  ): Promise<void> {
    await this.record({
      tenantId,
      metricType: 'quality',
      metricName: 'escalation',
      metricValue: wasEscalated ? 1 : 0,
      conversationId,
      metadata: reason ? { reason } : undefined,
    });
  }

  /**
   * Record input distribution metric
   */
  async recordInputMetric(
    tenantId: string,
    metricName: string,
    value: number,
    dimensions?: Record<string, string>
  ): Promise<void> {
    await this.record({
      tenantId,
      metricType: 'input_distribution',
      metricName,
      metricValue: value,
      dimensions,
    });
  }

  /**
   * Record output distribution metric
   */
  async recordOutputMetric(
    tenantId: string,
    metricName: string,
    value: number,
    dimensions?: Record<string, string>
  ): Promise<void> {
    await this.record({
      tenantId,
      metricType: 'output_distribution',
      metricName,
      metricValue: value,
      dimensions,
    });
  }

  /**
   * Query metrics
   *
   * NOTE: SQL table stores aggregated metrics per period.
   * Query results contain mean values for each time period.
   */
  async query(params: MetricQuery): Promise<DriftMetric[]> {
    let query = this.supabase
      .from('ai_drift_metrics')
      .select('*')
      .eq('tenant_id', params.tenantId)
      .order('period_start', { ascending: false });

    if (params.metricType) {
      const category = this.mapMetricTypeToCategory(params.metricType);
      query = query.eq('metric_category', category);
    }
    if (params.metricName) {
      query = query.eq('metric_name', params.metricName);
    }
    if (params.startDate) {
      query = query.gte('period_start', params.startDate.toISOString());
    }
    if (params.endDate) {
      query = query.lt('period_end', params.endDate.toISOString());
    }
    // Note: dimensions filter not supported in SQL schema

    const limit = params.limit || 1000;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[MetricsCollectorService] Error querying metrics:', error);
      return [];
    }

    return (data || []).map((row) => this.mapMetric(row));
  }

  /**
   * Get aggregated metrics for a time window
   */
  async aggregate(
    tenantId: string,
    metricType: MetricType,
    startDate: Date,
    endDate: Date
  ): Promise<MetricAggregation[]> {
    const metrics = await this.query({
      tenantId,
      metricType,
      startDate,
      endDate,
      limit: 10000,
    });

    // Group by metric name
    const grouped = new Map<string, number[]>();
    for (const metric of metrics) {
      const values = grouped.get(metric.metricName) || [];
      values.push(metric.metricValue);
      grouped.set(metric.metricName, values);
    }

    // Calculate aggregations
    const aggregations: MetricAggregation[] = [];
    for (const [metricName, values] of grouped) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const n = sorted.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;

      aggregations.push({
        metricName,
        count: n,
        mean,
        std: Math.sqrt(variance),
        min: sorted[0],
        max: sorted[n - 1],
        p50: sorted[Math.floor(n * 0.5)],
        p95: sorted[Math.floor(n * 0.95)],
      });
    }

    return aggregations;
  }

  /**
   * Get recent values for a specific metric
   */
  async getRecentValues(
    tenantId: string,
    metricType: MetricType,
    metricName: string,
    hours: number = 24
  ): Promise<number[]> {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const metrics = await this.query({
      tenantId,
      metricType,
      metricName,
      startDate,
      limit: 5000,
    });

    return metrics.map((m) => m.metricValue);
  }

  /**
   * Get time series data for charting
   */
  async getTimeSeries(
    tenantId: string,
    metricType: MetricType,
    metricName: string,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<Array<{ timestamp: Date; value: number; count: number }>> {
    const metrics = await this.query({
      tenantId,
      metricType,
      metricName,
      startDate,
      endDate,
      limit: 50000,
    });

    // Group by time bucket
    const buckets = new Map<string, { sum: number; count: number }>();

    for (const metric of metrics) {
      const bucketKey = this.getBucketKey(metric.recordedAt, granularity);

      const existing = buckets.get(bucketKey) || { sum: 0, count: 0 };
      existing.sum += metric.metricValue;
      existing.count++;
      buckets.set(bucketKey, existing);
    }

    // Convert to array
    const result: Array<{ timestamp: Date; value: number; count: number }> = [];
    for (const [key, data] of buckets) {
      result.push({
        timestamp: new Date(key),
        value: data.sum / data.count,
        count: data.count,
      });
    }

    return result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Flush buffered metrics to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const toFlush = [...this.buffer];
    this.buffer = [];

    try {
      await this.recordBatch(toFlush);
    } catch (error) {
      // Re-add to buffer on failure
      this.buffer.unshift(...toFlush);
      console.error('[MetricsCollectorService] Flush failed:', error);
    }
  }

  /**
   * Cleanup old metrics
   */
  async cleanup(tenantId: string, retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // First count records to delete
    const { count: recordCount } = await this.supabase
      .from('ai_drift_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .lt('period_start', cutoffDate.toISOString());

    // Then delete
    const { error } = await this.supabase
      .from('ai_drift_metrics')
      .delete()
      .eq('tenant_id', tenantId)
      .lt('period_start', cutoffDate.toISOString());

    const count = recordCount;

    if (error) {
      console.error('[MetricsCollectorService] Cleanup error:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Stop the flush interval
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // Private helpers

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error);
    }, this.FLUSH_INTERVAL_MS);
  }

  private getBucketKey(date: Date, granularity: 'hour' | 'day' | 'week'): string {
    const d = new Date(date);

    switch (granularity) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week':
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - d.getDay());
        break;
    }

    return d.toISOString();
  }

  /**
   * Map SQL row to DriftMetric type
   * SQL uses: metric_category, mean_value, period_start, collected_at
   */
  private mapMetric(row: Record<string, unknown>): DriftMetric {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      metricType: this.mapCategoryToMetricType(row.metric_category as string),
      metricName: row.metric_name as string,
      metricValue: row.mean_value as number,
      periodStart: row.period_start ? new Date(row.period_start as string) : undefined,
      periodEnd: row.period_end ? new Date(row.period_end as string) : undefined,
      periodType: row.period_type as 'hourly' | 'daily' | 'weekly' | undefined,
      sampleCount: row.sample_count as number | undefined,
      stdValue: row.std_value as number | undefined,
      minValue: row.min_value as number | undefined,
      maxValue: row.max_value as number | undefined,
      categoryDistribution: row.category_distribution as Record<string, number> | undefined,
      baselineId: row.baseline_id as string | undefined,
      ksStatistic: row.ks_statistic as number | undefined,
      ksPValue: row.ks_p_value as number | undefined,
      chiSquareStatistic: row.chi_square_statistic as number | undefined,
      chiSquarePValue: row.chi_square_p_value as number | undefined,
      psiValue: row.psi_value as number | undefined,
      jsDivergence: row.js_divergence as number | undefined,
      driftDetected: row.drift_detected as boolean | undefined,
      driftSeverity: row.drift_severity as 'none' | 'low' | 'medium' | 'high' | 'critical' | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      recordedAt: new Date((row.collected_at || row.period_start) as string),
    };
  }

  /**
   * Map SQL metric_category back to TypeScript metricType
   */
  private mapCategoryToMetricType(category: string): MetricType {
    switch (category) {
      case 'performance':
        return 'performance';
      case 'behavior':
        return 'quality';
      case 'input':
        return 'input_distribution';
      case 'output':
        return 'output_distribution';
      default:
        return 'performance';
    }
  }
}

// Export singleton instance
export const metricsCollectorService = new MetricsCollectorService();
