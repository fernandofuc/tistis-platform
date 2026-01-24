// =====================================================
// TIS TIS PLATFORM - A/B TESTING SERVICE
// Manages A/B tests for prompt optimization
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { ABTest, PromptVariant } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface CreateTestParams {
  tenantId: string;
  name: string;
  description?: string;
  hypothesis?: string;
  testType: ABTest['testType'];
  controlVariantId: string;
  treatmentVariantIds: string[];
  trafficAllocation?: Record<string, number>;
  targetSegments?: string[];
  targetChannels?: string[];
  minSampleSize?: number;
  confidenceThreshold?: number;
  scheduledEndAt?: Date;
  createdBy?: string;
}

interface TestResults {
  testId: string;
  status: ABTest['status'];
  variants: Array<{
    id: string;
    name: string;
    isControl: boolean;
    impressions: number;
    positiveFeedback: number;
    negativeFeedback: number;
    conversionRate: number;
    wilsonLower: number;
    wilsonUpper: number;
  }>;
  winner?: {
    id: string;
    name: string;
    improvement: number;
  };
  statisticalSignificance?: number;
  effectSize?: number;
  canConclude: boolean;
  recommendedAction: 'continue' | 'conclude_winner' | 'conclude_no_winner' | 'increase_traffic';
}

export class ABTestingService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a new A/B test
   */
  async createTest(params: CreateTestParams): Promise<string> {
    // Validate variants exist
    const allVariantIds = [params.controlVariantId, ...params.treatmentVariantIds];
    const { data: variants } = await this.supabase
      .from('ai_prompt_variants')
      .select('id')
      .in('id', allVariantIds);

    if (!variants || variants.length !== allVariantIds.length) {
      throw new Error('One or more variants not found');
    }

    // Default traffic allocation: equal split
    const trafficAllocation = params.trafficAllocation || this.equalSplit(allVariantIds);

    // Validate traffic allocation sums to 1
    const totalTraffic = Object.values(trafficAllocation).reduce((a, b) => a + b, 0);
    if (Math.abs(totalTraffic - 1) > 0.01) {
      throw new Error('Traffic allocation must sum to 1.0');
    }

    const { data, error } = await this.supabase
      .from('ai_ab_tests')
      .insert({
        tenant_id: params.tenantId,
        name: params.name,
        description: params.description,
        hypothesis: params.hypothesis,
        test_type: params.testType,
        control_variant_id: params.controlVariantId,
        treatment_variant_ids: params.treatmentVariantIds,
        traffic_allocation: trafficAllocation,
        target_segments: params.targetSegments || [],
        target_channels: params.targetChannels || ['whatsapp'],
        min_sample_size: params.minSampleSize || 100,
        confidence_threshold: params.confidenceThreshold || 0.95,
        scheduled_end_at: params.scheduledEndAt?.toISOString(),
        created_by: params.createdBy,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ABTestingService] Error creating test:', error);
      throw new Error(`Failed to create test: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string): Promise<void> {
    // Get test
    const { data: test, error: fetchError } = await this.supabase
      .from('ai_ab_tests')
      .select('*, ai_prompt_variants!control_variant_id(*)')
      .eq('id', testId)
      .single();

    if (fetchError || !test) {
      throw new Error('Test not found');
    }

    if (test.status !== 'draft' && test.status !== 'paused') {
      throw new Error(`Cannot start test in ${test.status} status`);
    }

    // Activate all variants
    const allVariantIds = [test.control_variant_id, ...test.treatment_variant_ids];
    await this.supabase
      .from('ai_prompt_variants')
      .update({ status: 'active' })
      .in('id', allVariantIds);

    // Update test status
    const { error } = await this.supabase
      .from('ai_ab_tests')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', testId);

    if (error) {
      console.error('[ABTestingService] Error starting test:', error);
      throw new Error(`Failed to start test: ${error.message}`);
    }
  }

  /**
   * Pause an A/B test
   */
  async pauseTest(testId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_ab_tests')
      .update({ status: 'paused' })
      .eq('id', testId)
      .eq('status', 'running');

    if (error) {
      console.error('[ABTestingService] Error pausing test:', error);
      throw new Error(`Failed to pause test: ${error.message}`);
    }
  }

  /**
   * Get variant for a request (traffic allocation)
   */
  async getVariantForRequest(
    testId: string,
    options?: {
      segment?: string;
      channel?: string;
      userId?: string;
    }
  ): Promise<{ variantId: string; variant: PromptVariant } | null> {
    // Get test
    const { data: test } = await this.supabase
      .from('ai_ab_tests')
      .select('*')
      .eq('id', testId)
      .eq('status', 'running')
      .single();

    if (!test) {
      return null;
    }

    // Check targeting
    if (options?.segment && test.target_segments?.length > 0) {
      if (!test.target_segments.includes(options.segment)) {
        return null;
      }
    }
    if (options?.channel && test.target_channels?.length > 0) {
      if (!test.target_channels.includes(options.channel)) {
        return null;
      }
    }

    // Select variant based on traffic allocation
    const allocation = test.traffic_allocation as Record<string, number>;
    const variantId = this.selectVariant(allocation, options?.userId);

    // Get variant details
    const { data: variant } = await this.supabase
      .from('ai_prompt_variants')
      .select('*')
      .eq('id', variantId)
      .single();

    if (!variant) {
      return null;
    }

    // Increment impressions
    await this.supabase
      .from('ai_prompt_variants')
      .update({ impressions: variant.impressions + 1 })
      .eq('id', variantId);

    return {
      variantId,
      variant: this.mapVariant(variant),
    };
  }

  /**
   * Get test results and analysis
   */
  async getTestResults(testId: string): Promise<TestResults> {
    // Get test
    const { data: test, error } = await this.supabase
      .from('ai_ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !test) {
      throw new Error('Test not found');
    }

    // Get all variants
    const allVariantIds = [test.control_variant_id, ...test.treatment_variant_ids];
    const { data: variants } = await this.supabase
      .from('ai_prompt_variants')
      .select('*')
      .in('id', allVariantIds);

    if (!variants) {
      throw new Error('Variants not found');
    }

    // Calculate stats for each variant
    const variantStats = variants.map((v) => {
      const total = v.positive_feedback + v.negative_feedback;
      const conversionRate = total > 0 ? v.positive_feedback / total : 0;
      const wilson = this.calculateWilsonScore(v.positive_feedback, total);

      return {
        id: v.id,
        name: v.name,
        isControl: v.id === test.control_variant_id,
        impressions: v.impressions,
        positiveFeedback: v.positive_feedback,
        negativeFeedback: v.negative_feedback,
        conversionRate,
        wilsonLower: wilson.lower,
        wilsonUpper: wilson.upper,
      };
    });

    // Sort by Wilson lower bound
    variantStats.sort((a, b) => b.wilsonLower - a.wilsonLower);

    // Determine winner
    const control = variantStats.find((v) => v.isControl)!;
    const bestTreatment = variantStats.find((v) => !v.isControl);

    let winner: TestResults['winner'];
    let canConclude = false;
    let recommendedAction: TestResults['recommendedAction'] = 'continue';
    let statisticalSignificance: number | undefined;
    let effectSize: number | undefined;

    if (bestTreatment) {
      // Check if we have enough samples
      const minSamples = test.min_sample_size || 100;
      const totalSamples = variantStats.reduce((sum, v) => sum + v.impressions, 0);

      if (totalSamples >= minSamples * allVariantIds.length) {
        // Calculate statistical significance
        const significance = this.calculateSignificance(control, bestTreatment);
        statisticalSignificance = significance.pValue;
        effectSize = significance.effectSize;

        if (statisticalSignificance <= (1 - (test.confidence_threshold || 0.95))) {
          canConclude = true;

          if (bestTreatment.wilsonLower > control.wilsonUpper) {
            winner = {
              id: bestTreatment.id,
              name: bestTreatment.name,
              improvement: (bestTreatment.conversionRate - control.conversionRate) / control.conversionRate,
            };
            recommendedAction = 'conclude_winner';
          } else if (control.wilsonLower > bestTreatment.wilsonUpper) {
            winner = {
              id: control.id,
              name: control.name,
              improvement: 0,
            };
            recommendedAction = 'conclude_no_winner';
          }
        } else {
          recommendedAction = 'increase_traffic';
        }
      }
    }

    return {
      testId,
      status: test.status,
      variants: variantStats,
      winner,
      statisticalSignificance,
      effectSize,
      canConclude,
      recommendedAction,
    };
  }

  /**
   * Conclude test with winner
   */
  async concludeTest(
    testId: string,
    winnerVariantId: string | null,
    notes?: string
  ): Promise<void> {
    const results = await this.getTestResults(testId);

    // Update test
    const { error } = await this.supabase
      .from('ai_ab_tests')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        winner_variant_id: winnerVariantId,
        statistical_significance: results.statisticalSignificance,
        effect_size: results.effectSize,
        results_summary: {
          variants: results.variants,
          winner: results.winner,
          notes,
        },
      })
      .eq('id', testId);

    if (error) {
      console.error('[ABTestingService] Error concluding test:', error);
      throw new Error(`Failed to conclude test: ${error.message}`);
    }

    // If winner, mark other variants as archived
    if (winnerVariantId) {
      const { data: test } = await this.supabase
        .from('ai_ab_tests')
        .select('control_variant_id, treatment_variant_ids')
        .eq('id', testId)
        .single();

      if (test) {
        const allVariantIds = [test.control_variant_id, ...test.treatment_variant_ids];
        const loserIds = allVariantIds.filter((id) => id !== winnerVariantId);

        await this.supabase
          .from('ai_prompt_variants')
          .update({ status: 'archived' })
          .in('id', loserIds);
      }
    }
  }

  /**
   * Get active tests for a tenant
   */
  async getActiveTests(tenantId: string): Promise<ABTest[]> {
    const { data, error } = await this.supabase
      .from('ai_ab_tests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'running')
      .order('started_at', { ascending: false });

    if (error) {
      console.error('[ABTestingService] Error getting active tests:', error);
      throw new Error(`Failed to get tests: ${error.message}`);
    }

    return (data || []).map(this.mapTest);
  }

  // Private helpers

  private equalSplit(variantIds: string[]): Record<string, number> {
    const allocation: Record<string, number> = {};
    const share = 1 / variantIds.length;
    for (const id of variantIds) {
      allocation[id] = share;
    }
    return allocation;
  }

  private selectVariant(allocation: Record<string, number>, seed?: string): string {
    // Use deterministic selection if seed provided (for consistent user experience)
    let random: number;
    if (seed) {
      // Simple hash to number between 0-1
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      random = Math.abs(hash) / 2147483647;
    } else {
      random = Math.random();
    }

    let cumulative = 0;
    for (const [variantId, weight] of Object.entries(allocation)) {
      cumulative += weight;
      if (random <= cumulative) {
        return variantId;
      }
    }

    // Fallback to first variant
    return Object.keys(allocation)[0];
  }

  private calculateWilsonScore(
    positive: number,
    total: number,
    confidence: number = 0.95
  ): { lower: number; upper: number } {
    if (total === 0) {
      return { lower: 0, upper: 0 };
    }

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

  private calculateSignificance(
    control: { positiveFeedback: number; impressions: number },
    treatment: { positiveFeedback: number; impressions: number }
  ): { pValue: number; effectSize: number } {
    // Two-proportion z-test
    const n1 = control.impressions;
    const n2 = treatment.impressions;
    const p1 = n1 > 0 ? control.positiveFeedback / n1 : 0;
    const p2 = n2 > 0 ? treatment.positiveFeedback / n2 : 0;

    const pooledP = (control.positiveFeedback + treatment.positiveFeedback) / (n1 + n2);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

    if (se === 0) {
      return { pValue: 1, effectSize: 0 };
    }

    const z = (p2 - p1) / se;
    // Approximate p-value from z-score (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    // Cohen's h for effect size
    const effectSize = 2 * (Math.asin(Math.sqrt(p2)) - Math.asin(Math.sqrt(p1)));

    return { pValue, effectSize };
  }

  private normalCDF(x: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private mapVariant(row: Record<string, unknown>): PromptVariant {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      variantType: row.variant_type as PromptVariant['variantType'],
      agentType: row.agent_type as string | undefined,
      promptContent: row.prompt_content as string,
      variables: row.variables as PromptVariant['variables'],
      status: row.status as PromptVariant['status'],
      isControl: row.is_control as boolean,
      impressions: row.impressions as number,
      positiveFeedback: row.positive_feedback as number,
      negativeFeedback: row.negative_feedback as number,
      conversionCount: row.conversion_count as number,
      performanceScore: row.performance_score as number | undefined,
      confidenceLevel: row.confidence_level as number | undefined,
      createdBy: row.created_by as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapTest(row: Record<string, unknown>): ABTest {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      hypothesis: row.hypothesis as string | undefined,
      testType: row.test_type as ABTest['testType'],
      controlVariantId: row.control_variant_id as string,
      treatmentVariantIds: row.treatment_variant_ids as string[],
      trafficAllocation: row.traffic_allocation as Record<string, number>,
      targetSegments: row.target_segments as string[] | undefined,
      targetChannels: row.target_channels as string[] | undefined,
      status: row.status as ABTest['status'],
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      endedAt: row.ended_at ? new Date(row.ended_at as string) : undefined,
      scheduledEndAt: row.scheduled_end_at ? new Date(row.scheduled_end_at as string) : undefined,
      minSampleSize: row.min_sample_size as number | undefined,
      confidenceThreshold: row.confidence_threshold as number | undefined,
      winnerVariantId: row.winner_variant_id as string | undefined,
      statisticalSignificance: row.statistical_significance as number | undefined,
      effectSize: row.effect_size as number | undefined,
      resultsSummary: row.results_summary as Record<string, unknown> | undefined,
      createdBy: row.created_by as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const abTestingService = new ABTestingService();
