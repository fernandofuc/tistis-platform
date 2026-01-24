// =====================================================
// TIS TIS PLATFORM - BASELINE SERVICE
// Manages drift detection baselines
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { DriftBaseline } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type MetricType = DriftBaseline['metricType'];

interface CreateBaselineParams {
  tenantId: string;
  metricType: MetricType;
  metricName: string;
  baselineValues: number[];
  description?: string;
  windowDays?: number;
  metadata?: Record<string, unknown>;
}

interface BaselineStats {
  mean: number;
  std: number;
  min: number;
  max: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export class BaselineService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a new baseline from historical data
   */
  async createBaseline(params: CreateBaselineParams): Promise<string> {
    const stats = this.calculateStats(params.baselineValues);
    const distribution = this.calculateDistribution(params.baselineValues);

    const { data, error } = await this.supabase
      .from('ai_drift_baselines')
      .insert({
        tenant_id: params.tenantId,
        metric_type: params.metricType,
        metric_name: params.metricName,
        description: params.description,
        baseline_mean: stats.mean,
        baseline_std: stats.std,
        baseline_distribution: distribution,
        sample_count: params.baselineValues.length,
        window_days: params.windowDays || 30,
        status: 'active',
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[BaselineService] Error creating baseline:', error);
      throw new Error(`Failed to create baseline: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Create baseline from recent metrics data
   */
  async createFromMetrics(
    tenantId: string,
    metricType: MetricType,
    metricName: string,
    windowDays: number = 30
  ): Promise<string> {
    // Get recent metrics
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);

    const { data: metrics, error } = await this.supabase
      .from('ai_drift_metrics')
      .select('metric_value')
      .eq('tenant_id', tenantId)
      .eq('metric_type', metricType)
      .eq('metric_name', metricName)
      .gte('recorded_at', startDate.toISOString())
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('[BaselineService] Error fetching metrics:', error);
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }

    if (!metrics || metrics.length < 10) {
      throw new Error(`Not enough data points (${metrics?.length || 0}). Need at least 10.`);
    }

    const values = metrics.map((m) => m.metric_value);

    return this.createBaseline({
      tenantId,
      metricType,
      metricName,
      baselineValues: values,
      windowDays,
      description: `Auto-generated from ${windowDays} days of data`,
    });
  }

  /**
   * Get active baseline for a metric
   */
  async getBaseline(
    tenantId: string,
    metricType: MetricType,
    metricName: string
  ): Promise<DriftBaseline | null> {
    const { data, error } = await this.supabase
      .from('ai_drift_baselines')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('metric_type', metricType)
      .eq('metric_name', metricName)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return this.mapBaseline(data);
  }

  /**
   * Get all baselines for a tenant
   */
  async getBaselines(
    tenantId: string,
    options?: {
      metricType?: MetricType;
      status?: 'active' | 'archived';
    }
  ): Promise<DriftBaseline[]> {
    let query = this.supabase
      .from('ai_drift_baselines')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.metricType) {
      query = query.eq('metric_type', options.metricType);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[BaselineService] Error fetching baselines:', error);
      return [];
    }

    return (data || []).map(this.mapBaseline);
  }

  /**
   * Update baseline with new data (rolling update)
   */
  async updateBaseline(
    baselineId: string,
    newValues: number[],
    strategy: 'replace' | 'merge' = 'merge'
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('ai_drift_baselines')
      .select('*')
      .eq('id', baselineId)
      .single();

    if (!existing) {
      throw new Error('Baseline not found');
    }

    let combinedValues: number[];

    if (strategy === 'replace') {
      combinedValues = newValues;
    } else {
      // Merge: combine old distribution with new values
      // Reconstruct approximate values from existing distribution
      const existingValues = this.reconstructValues(
        existing.baseline_distribution,
        existing.sample_count
      );
      combinedValues = [...existingValues, ...newValues];

      // Keep only most recent window
      const maxSamples = existing.sample_count * 2;
      if (combinedValues.length > maxSamples) {
        combinedValues = combinedValues.slice(-maxSamples);
      }
    }

    const stats = this.calculateStats(combinedValues);
    const distribution = this.calculateDistribution(combinedValues);

    const { error } = await this.supabase
      .from('ai_drift_baselines')
      .update({
        baseline_mean: stats.mean,
        baseline_std: stats.std,
        baseline_distribution: distribution,
        sample_count: combinedValues.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', baselineId);

    if (error) {
      console.error('[BaselineService] Error updating baseline:', error);
      throw new Error(`Failed to update baseline: ${error.message}`);
    }
  }

  /**
   * Archive a baseline
   */
  async archiveBaseline(baselineId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_drift_baselines')
      .update({ status: 'archived' })
      .eq('id', baselineId);

    if (error) {
      console.error('[BaselineService] Error archiving baseline:', error);
      throw new Error(`Failed to archive baseline: ${error.message}`);
    }
  }

  /**
   * Create default baselines for common metrics
   */
  async createDefaultBaselines(tenantId: string): Promise<string[]> {
    const defaultMetrics: Array<{
      type: MetricType;
      name: string;
      description: string;
    }> = [
      { type: 'performance', name: 'response_latency_ms', description: 'AI response latency' },
      { type: 'performance', name: 'tokens_per_response', description: 'Average tokens generated' },
      { type: 'quality', name: 'positive_feedback_rate', description: 'Positive feedback ratio' },
      { type: 'quality', name: 'escalation_rate', description: 'Escalation to human rate' },
      { type: 'input_distribution', name: 'message_length', description: 'User message length' },
      { type: 'input_distribution', name: 'intent_distribution', description: 'Intent frequency' },
    ];

    const createdIds: string[] = [];

    for (const metric of defaultMetrics) {
      try {
        // Check if baseline already exists
        const existing = await this.getBaseline(tenantId, metric.type, metric.name);
        if (existing) continue;

        // Create with placeholder values (will be updated with real data)
        const id = await this.createBaseline({
          tenantId,
          metricType: metric.type,
          metricName: metric.name,
          baselineValues: [0.5], // Placeholder
          description: metric.description,
          windowDays: 30,
        });
        createdIds.push(id);
      } catch (err) {
        console.warn(`[BaselineService] Failed to create baseline for ${metric.name}:`, err);
      }
    }

    return createdIds;
  }

  // Private helpers

  private calculateStats(values: number[]): BaselineStats {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    return {
      mean,
      std,
      min: sorted[0],
      max: sorted[n - 1],
      p25: sorted[Math.floor(n * 0.25)],
      p50: sorted[Math.floor(n * 0.5)],
      p75: sorted[Math.floor(n * 0.75)],
      p95: sorted[Math.floor(n * 0.95)],
    };
  }

  private calculateDistribution(values: number[]): Record<string, number> {
    // Create histogram with 10 bins
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binSize = range / 10;

    const bins: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      const binKey = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
      bins[binKey] = 0;
    }

    for (const value of values) {
      const binIndex = Math.min(Math.floor((value - min) / binSize), 9);
      const binStart = min + binIndex * binSize;
      const binEnd = min + (binIndex + 1) * binSize;
      const binKey = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
      bins[binKey]++;
    }

    // Normalize to proportions
    const total = values.length;
    for (const key of Object.keys(bins)) {
      bins[key] = bins[key] / total;
    }

    return bins;
  }

  private reconstructValues(
    distribution: Record<string, number>,
    sampleCount: number
  ): number[] {
    const values: number[] = [];

    for (const [range, proportion] of Object.entries(distribution)) {
      const [start, end] = range.split('-').map(Number);
      const midpoint = (start + end) / 2;
      const count = Math.round(proportion * sampleCount);

      for (let i = 0; i < count; i++) {
        values.push(midpoint);
      }
    }

    return values;
  }

  private mapBaseline(row: Record<string, unknown>): DriftBaseline {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      metricType: row.metric_type as MetricType,
      metricName: row.metric_name as string,
      description: row.description as string | undefined,
      baselineMean: row.baseline_mean as number,
      baselineStd: row.baseline_std as number,
      baselineDistribution: row.baseline_distribution as Record<string, number>,
      sampleCount: row.sample_count as number,
      windowDays: row.window_days as number,
      status: row.status as 'active' | 'archived',
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const baselineService = new BaselineService();
