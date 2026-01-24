// =====================================================
// TIS TIS PLATFORM - AGGREGATOR SERVICE
// Aggregates feedback with Wilson Score for ranking
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { FeedbackAggregation } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type PeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface AggregationResult {
  aggregationsCreated: number;
  periodStart: Date;
  periodEnd: Date;
  segments: string[];
}

export class AggregatorService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Run aggregation for a tenant
   * Should be called by cron job
   */
  async runAggregation(
    tenantId: string,
    periodType: PeriodType = 'hourly'
  ): Promise<AggregationResult> {
    const { periodStart, periodEnd } = this.calculatePeriod(periodType);

    // Get all feedback for this period
    const { data: feedback, error } = await this.supabase
      .from('ai_feedback')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString());

    if (error) {
      console.error('[AggregatorService] Error fetching feedback:', error);
      throw new Error(`Failed to fetch feedback: ${error.message}`);
    }

    if (!feedback || feedback.length === 0) {
      return {
        aggregationsCreated: 0,
        periodStart,
        periodEnd,
        segments: [],
      };
    }

    // Group feedback by segment
    const segments = this.groupBySegments(feedback);
    const segments_created: string[] = [];

    // Create aggregations for each segment
    for (const [segmentKey, items] of Object.entries(segments)) {
      const dimension = this.extractDimension(segmentKey);

      const aggregation = this.calculateAggregation(
        items as Array<{ is_positive: boolean; rating?: number }>
      );

      // Get previous period for trend calculation
      const previousAggregation = await this.getPreviousAggregation(
        tenantId,
        periodType,
        periodStart,
        dimension,
        segmentKey
      );

      const trend = this.calculateTrend(aggregation.wilsonLowerBound, previousAggregation?.wilson_lower_bound as number | undefined);

      // Upsert aggregation
      const { error: upsertError } = await this.supabase
        .from('ai_feedback_aggregations')
        .upsert({
          tenant_id: tenantId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          period_type: periodType,
          dimension,
          segment_key: segmentKey,
          total_feedback: aggregation.total,
          positive_count: aggregation.positiveCount,
          negative_count: aggregation.negativeCount,
          raw_positive_rate: aggregation.rawRate,
          wilson_lower_bound: aggregation.wilsonLowerBound,
          wilson_upper_bound: aggregation.wilsonUpperBound,
          avg_rating: aggregation.avgRating,
          rating_count: aggregation.ratingCount,
          trend_direction: trend.direction,
          trend_change: trend.change,
          calculated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,period_type,period_start,dimension,segment_key',
        });

      if (upsertError) {
        console.error('[AggregatorService] Error upserting aggregation:', upsertError);
      } else {
        segments_created.push(segmentKey);
      }
    }

    return {
      aggregationsCreated: segments_created.length,
      periodStart,
      periodEnd,
      segments: segments_created,
    };
  }

  /**
   * Get aggregations for a tenant
   */
  async getAggregations(
    tenantId: string,
    options?: {
      periodType?: PeriodType;
      dimension?: string;
      segmentKey?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<FeedbackAggregation[]> {
    let query = this.supabase
      .from('ai_feedback_aggregations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('period_start', { ascending: false });

    if (options?.periodType) {
      query = query.eq('period_type', options.periodType);
    }
    if (options?.dimension) {
      query = query.eq('dimension', options.dimension);
    }
    if (options?.segmentKey) {
      query = query.eq('segment_key', options.segmentKey);
    }
    if (options?.startDate) {
      query = query.gte('period_start', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lt('period_start', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[AggregatorService] Error getting aggregations:', error);
      throw new Error(`Failed to get aggregations: ${error.message}`);
    }

    return (data || []).map(this.mapAggregation);
  }

  /**
   * Get top performing segments by Wilson Score
   */
  async getTopSegments(
    tenantId: string,
    periodType: PeriodType = 'daily',
    limit: number = 10
  ): Promise<FeedbackAggregation[]> {
    // Get the most recent period
    const { periodStart, periodEnd } = this.calculatePeriod(periodType);
    const previousPeriodStart = this.subtractPeriod(periodStart, periodType);

    const { data, error } = await this.supabase
      .from('ai_feedback_aggregations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('period_type', periodType)
      .gte('period_start', previousPeriodStart.toISOString())
      .order('wilson_lower_bound', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AggregatorService] Error getting top segments:', error);
      throw new Error(`Failed to get top segments: ${error.message}`);
    }

    return (data || []).map(this.mapAggregation);
  }

  /**
   * Get segments with declining performance
   */
  async getDecliningSegments(
    tenantId: string,
    periodType: PeriodType = 'daily',
    threshold: number = -0.1
  ): Promise<FeedbackAggregation[]> {
    const { data, error } = await this.supabase
      .from('ai_feedback_aggregations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('period_type', periodType)
      .eq('trend_direction', 'down')
      .lt('trend_change', threshold)
      .order('trend_change', { ascending: true })
      .limit(20);

    if (error) {
      console.error('[AggregatorService] Error getting declining segments:', error);
      throw new Error(`Failed to get declining segments: ${error.message}`);
    }

    return (data || []).map(this.mapAggregation);
  }

  /**
   * Calculate Wilson Score bounds
   * https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval
   */
  calculateWilsonScore(
    positive: number,
    total: number,
    confidence: number = 0.95
  ): { lower: number; upper: number } {
    if (total === 0) {
      return { lower: 0, upper: 0 };
    }

    // Z-score for confidence level
    const z = confidence === 0.90 ? 1.645 : confidence === 0.95 ? 1.96 : 2.576;
    const phat = positive / total;
    const denominator = 1 + (z * z) / total;

    const center = phat + (z * z) / (2 * total);
    const offset = z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total);

    return {
      lower: Math.max(0, (center - offset) / denominator),
      upper: Math.min(1, (center + offset) / denominator),
    };
  }

  // Private helpers

  private calculatePeriod(periodType: PeriodType): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (periodType) {
      case 'hourly':
        periodStart = new Date(now);
        periodStart.setMinutes(0, 0, 0);
        periodStart.setHours(periodStart.getHours() - 1);
        periodEnd = new Date(periodStart);
        periodEnd.setHours(periodEnd.getHours() + 1);
        break;
      case 'daily':
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        periodStart.setDate(periodStart.getDate() - 1);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 1);
        break;
      case 'weekly':
        periodStart = new Date(now);
        periodStart.setHours(0, 0, 0, 0);
        const dayOfWeek = periodStart.getDay();
        periodStart.setDate(periodStart.getDate() - dayOfWeek - 7);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { periodStart, periodEnd };
  }

  private subtractPeriod(date: Date, periodType: PeriodType): Date {
    const result = new Date(date);
    switch (periodType) {
      case 'hourly':
        result.setHours(result.getHours() - 1);
        break;
      case 'daily':
        result.setDate(result.getDate() - 1);
        break;
      case 'weekly':
        result.setDate(result.getDate() - 7);
        break;
      case 'monthly':
        result.setMonth(result.getMonth() - 1);
        break;
    }
    return result;
  }

  private groupBySegments(
    feedback: Array<Record<string, unknown>>
  ): Record<string, Array<Record<string, unknown>>> {
    const segments: Record<string, Array<Record<string, unknown>>> = {
      'overall': [], // Always include overall
    };

    for (const item of feedback) {
      // Add to overall
      segments['overall'].push(item);

      // Group by dimension
      const dimension = (item.dimension as string) || 'overall';
      const dimKey = `dimension:${dimension}`;
      if (!segments[dimKey]) segments[dimKey] = [];
      segments[dimKey].push(item);

      // Group by channel
      const channel = item.channel as string;
      if (channel) {
        const channelKey = `channel:${channel}`;
        if (!segments[channelKey]) segments[channelKey] = [];
        segments[channelKey].push(item);
      }

      // Group by model
      const model = item.ai_model_used as string;
      if (model) {
        const modelKey = `model:${model}`;
        if (!segments[modelKey]) segments[modelKey] = [];
        segments[modelKey].push(item);
      }
    }

    return segments;
  }

  private extractDimension(segmentKey: string): string | null {
    if (segmentKey.startsWith('dimension:')) {
      return segmentKey.replace('dimension:', '');
    }
    return null;
  }

  private calculateAggregation(
    items: Array<{ is_positive: boolean; rating?: number }>
  ): {
    total: number;
    positiveCount: number;
    negativeCount: number;
    rawRate: number;
    wilsonLowerBound: number;
    wilsonUpperBound: number;
    avgRating?: number;
    ratingCount: number;
  } {
    const total = items.length;
    const positiveCount = items.filter((i) => i.is_positive === true).length;
    const negativeCount = items.filter((i) => i.is_positive === false).length;
    const ratings = items.filter((i) => i.rating != null).map((i) => i.rating!);

    const rawRate = total > 0 ? positiveCount / total : 0;
    const wilson = this.calculateWilsonScore(positiveCount, total);

    return {
      total,
      positiveCount,
      negativeCount,
      rawRate,
      wilsonLowerBound: wilson.lower,
      wilsonUpperBound: wilson.upper,
      avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      ratingCount: ratings.length,
    };
  }

  private async getPreviousAggregation(
    tenantId: string,
    periodType: PeriodType,
    currentPeriodStart: Date,
    dimension: string | null,
    segmentKey: string
  ): Promise<Record<string, unknown> | null> {
    const previousPeriodStart = this.subtractPeriod(currentPeriodStart, periodType);

    let query = this.supabase
      .from('ai_feedback_aggregations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('period_type', periodType)
      .eq('period_start', previousPeriodStart.toISOString())
      .eq('segment_key', segmentKey);

    if (dimension) {
      query = query.eq('dimension', dimension);
    } else {
      query = query.is('dimension', null);
    }

    const { data } = await query.single();
    return data;
  }

  private calculateTrend(
    currentScore: number,
    previousScore?: number
  ): { direction: 'up' | 'down' | 'stable'; change: number } {
    if (previousScore == null) {
      return { direction: 'stable', change: 0 };
    }

    const change = currentScore - previousScore;
    const threshold = 0.05; // 5% change threshold

    if (change > threshold) {
      return { direction: 'up', change };
    } else if (change < -threshold) {
      return { direction: 'down', change };
    } else {
      return { direction: 'stable', change };
    }
  }

  private mapAggregation(row: Record<string, unknown>): FeedbackAggregation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      periodType: row.period_type as 'hourly' | 'daily' | 'weekly' | 'monthly',
      dimension: row.dimension as FeedbackAggregation['dimension'],
      segmentKey: row.segment_key as string | undefined,
      totalFeedback: row.total_feedback as number,
      positiveCount: row.positive_count as number,
      negativeCount: row.negative_count as number,
      rawPositiveRate: row.raw_positive_rate as number | undefined,
      wilsonLowerBound: row.wilson_lower_bound as number | undefined,
      wilsonUpperBound: row.wilson_upper_bound as number | undefined,
      avgRating: row.avg_rating as number | undefined,
      ratingCount: row.rating_count as number | undefined,
      trendDirection: row.trend_direction as 'up' | 'down' | 'stable' | undefined,
      trendChange: row.trend_change as number | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      calculatedAt: new Date(row.calculated_at as string),
    };
  }
}

// Export singleton instance
export const aggregatorService = new AggregatorService();
