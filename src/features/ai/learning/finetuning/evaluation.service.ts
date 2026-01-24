// =====================================================
// TIS TIS PLATFORM - EVALUATION SERVICE
// Evaluates fine-tuned models
// =====================================================

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { ModelRegistry, FinetuningDataset } from '../types';
import { datasetService } from './dataset.service';
import { modelRegistryService } from './model-registry.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EvaluationResult {
  modelId: string;
  datasetId: string;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    avgResponseLength?: number;
    avgLatencyMs?: number;
    consistency?: number;
  };
  examples: Array<{
    input: string;
    expected: string;
    actual: string;
    match: boolean;
    score: number;
  }>;
  summary: string;
  evaluatedAt: Date;
}

interface ComparisonResult {
  baseModel: {
    id: string;
    name: string;
    metrics: Record<string, number>;
  };
  challengerModel: {
    id: string;
    name: string;
    metrics: Record<string, number>;
  };
  improvements: Record<string, { absolute: number; relative: number }>;
  recommendation: 'promote' | 'reject' | 'inconclusive';
  reasoning: string;
}

export class EvaluationService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Evaluate a model against a test dataset
   */
  async evaluateModel(
    modelId: string,
    datasetId?: string,
    options?: {
      maxExamples?: number;
      temperature?: number;
    }
  ): Promise<EvaluationResult> {
    const model = await modelRegistryService.getModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }

    // Get test dataset
    let testDatasetId = datasetId;
    if (!testDatasetId && model.finetuningJobId) {
      // Use the job's dataset
      const { data: job } = await this.supabase
        .from('ai_finetuning_jobs')
        .select('dataset_id')
        .eq('id', model.finetuningJobId)
        .single();
      testDatasetId = job?.dataset_id;
    }

    if (!testDatasetId) {
      throw new Error('No dataset available for evaluation');
    }

    const dataset = await datasetService.getDataset(testDatasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    // Get test examples
    const testJsonl = await datasetService.exportJsonl(testDatasetId, 'test');
    const examples = testJsonl
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .slice(0, options?.maxExamples || 50);

    // Run evaluation
    const results: EvaluationResult['examples'] = [];
    let totalLatency = 0;
    let matches = 0;
    let totalLength = 0;

    for (const example of examples) {
      const messages = example.messages;
      // Get all but the last message (which is the expected response)
      const inputMessages = messages.slice(0, -1);
      const expectedOutput = messages[messages.length - 1].content;

      const startTime = Date.now();

      try {
        const response = await this.openai.chat.completions.create({
          model: model.modelId,
          messages: inputMessages,
          temperature: options?.temperature ?? model.temperature,
          max_tokens: model.maxTokens,
        });

        const latency = Date.now() - startTime;
        totalLatency += latency;

        const actualOutput = response.choices[0]?.message?.content || '';
        totalLength += actualOutput.length;

        // Calculate similarity score
        const score = this.calculateSimilarity(expectedOutput, actualOutput);
        const isMatch = score > 0.8;
        if (isMatch) matches++;

        results.push({
          input: inputMessages.map((m: { content: string }) => m.content).join(' | '),
          expected: expectedOutput,
          actual: actualOutput,
          match: isMatch,
          score,
        });
      } catch (error) {
        console.error('[EvaluationService] Error running example:', error);
        results.push({
          input: inputMessages.map((m: { content: string }) => m.content).join(' | '),
          expected: expectedOutput,
          actual: '[Error]',
          match: false,
          score: 0,
        });
      }
    }

    // Calculate metrics
    const totalExamples = results.length;
    const accuracy = matches / totalExamples;
    const avgLatency = totalLatency / totalExamples;
    const avgLength = totalLength / totalExamples;

    // Calculate consistency (variance in scores)
    const scores = results.map((r) => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, s) => acc + Math.pow(s - avgScore, 2), 0) / scores.length;
    const consistency = 1 - Math.sqrt(variance);

    const metrics = {
      accuracy,
      avgResponseLength: avgLength,
      avgLatencyMs: avgLatency,
      consistency,
    };

    // Update model with evaluation metrics
    await modelRegistryService.updateEvaluationMetrics(modelId, metrics);

    // Update evaluation dataset reference
    await this.supabase
      .from('ai_model_registry')
      .update({ evaluation_dataset_id: testDatasetId })
      .eq('id', modelId);

    return {
      modelId,
      datasetId: testDatasetId,
      metrics,
      examples: results.slice(0, 10), // Return sample
      summary: `Evaluated ${totalExamples} examples. Accuracy: ${(accuracy * 100).toFixed(1)}%, Avg latency: ${avgLatency.toFixed(0)}ms`,
      evaluatedAt: new Date(),
    };
  }

  /**
   * Compare two models
   */
  async compareModels(
    baseModelId: string,
    challengerModelId: string,
    datasetId?: string
  ): Promise<ComparisonResult> {
    // Evaluate both models
    const [baseEval, challengerEval] = await Promise.all([
      this.evaluateModel(baseModelId, datasetId),
      this.evaluateModel(challengerModelId, datasetId),
    ]);

    const baseModel = await modelRegistryService.getModel(baseModelId);
    const challengerModel = await modelRegistryService.getModel(challengerModelId);

    // Calculate improvements
    const improvements: Record<string, { absolute: number; relative: number }> = {};
    const baseMetrics = baseEval.metrics;
    const challengerMetrics = challengerEval.metrics;

    for (const key of Object.keys(baseMetrics) as (keyof typeof baseMetrics)[]) {
      const baseValue = baseMetrics[key] || 0;
      const challengerValue = challengerMetrics[key] || 0;

      improvements[key] = {
        absolute: challengerValue - baseValue,
        relative: baseValue !== 0 ? (challengerValue - baseValue) / baseValue : 0,
      };
    }

    // Make recommendation
    let recommendation: 'promote' | 'reject' | 'inconclusive' = 'inconclusive';
    let reasoning = '';

    const accuracyImprovement = improvements.accuracy?.relative || 0;
    const latencyChange = improvements.avgLatencyMs?.absolute || 0;

    if (accuracyImprovement > 0.05) {
      // More than 5% accuracy improvement
      if (latencyChange < 500) {
        // And latency didn't increase much
        recommendation = 'promote';
        reasoning = `Challenger shows ${(accuracyImprovement * 100).toFixed(1)}% accuracy improvement with acceptable latency.`;
      } else {
        recommendation = 'inconclusive';
        reasoning = 'Accuracy improved but latency increased significantly.';
      }
    } else if (accuracyImprovement < -0.03) {
      // More than 3% accuracy decrease
      recommendation = 'reject';
      reasoning = `Challenger shows ${(Math.abs(accuracyImprovement) * 100).toFixed(1)}% accuracy decrease.`;
    } else {
      recommendation = 'inconclusive';
      reasoning = 'No significant difference in performance.';
    }

    return {
      baseModel: {
        id: baseModelId,
        name: baseModel?.name || 'Unknown',
        metrics: baseMetrics as Record<string, number>,
      },
      challengerModel: {
        id: challengerModelId,
        name: challengerModel?.name || 'Unknown',
        metrics: challengerMetrics as Record<string, number>,
      },
      improvements,
      recommendation,
      reasoning,
    };
  }

  /**
   * Run automated evaluation pipeline
   */
  async runAutomatedEvaluation(
    tenantId: string
  ): Promise<{
    evaluated: number;
    comparisons: ComparisonResult[];
    recommendations: string[];
  }> {
    const comparisons: ComparisonResult[] = [];
    const recommendations: string[] = [];

    // Get production model
    const { data: prodModel } = await this.supabase
      .from('ai_model_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('deployment_status', 'production')
      .order('traffic_percentage', { ascending: false })
      .limit(1)
      .single();

    // Get staged models
    const { data: stagedModels } = await this.supabase
      .from('ai_model_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('deployment_status', 'staged')
      .order('created_at', { ascending: false });

    if (!prodModel || !stagedModels || stagedModels.length === 0) {
      return { evaluated: 0, comparisons, recommendations };
    }

    // Compare each staged model with production
    for (const staged of stagedModels) {
      try {
        const comparison = await this.compareModels(prodModel.id, staged.id);
        comparisons.push(comparison);

        if (comparison.recommendation === 'promote') {
          recommendations.push(
            `Consider promoting ${staged.name} v${staged.version}: ${comparison.reasoning}`
          );
        }
      } catch (error) {
        console.error(`[EvaluationService] Error comparing ${staged.id}:`, error);
      }
    }

    return {
      evaluated: comparisons.length,
      comparisons,
      recommendations,
    };
  }

  /**
   * Calculate A/B test statistical significance
   */
  calculateSignificance(
    controlMetrics: { successes: number; total: number },
    treatmentMetrics: { successes: number; total: number }
  ): { significant: boolean; pValue: number; confidenceLevel: number } {
    // Chi-square test for proportions
    const controlRate = controlMetrics.successes / controlMetrics.total;
    const treatmentRate = treatmentMetrics.successes / treatmentMetrics.total;
    const pooledRate =
      (controlMetrics.successes + treatmentMetrics.successes) /
      (controlMetrics.total + treatmentMetrics.total);

    const expectedControl = pooledRate * controlMetrics.total;
    const expectedTreatment = pooledRate * treatmentMetrics.total;

    const chiSquare =
      Math.pow(controlMetrics.successes - expectedControl, 2) / expectedControl +
      Math.pow(controlMetrics.total - controlMetrics.successes - (controlMetrics.total - expectedControl), 2) /
        (controlMetrics.total - expectedControl) +
      Math.pow(treatmentMetrics.successes - expectedTreatment, 2) / expectedTreatment +
      Math.pow(treatmentMetrics.total - treatmentMetrics.successes - (treatmentMetrics.total - expectedTreatment), 2) /
        (treatmentMetrics.total - expectedTreatment);

    // Approximate p-value (chi-square with 1 df)
    const pValue = Math.exp(-chiSquare / 2);
    const significant = pValue < 0.05;
    const confidenceLevel = 1 - pValue;

    return { significant, pValue, confidenceLevel };
  }

  // Private helpers

  private calculateSimilarity(expected: string, actual: string): number {
    // Simple Jaccard similarity
    const expectedWords = new Set(expected.toLowerCase().split(/\s+/));
    const actualWords = new Set(actual.toLowerCase().split(/\s+/));

    const intersection = new Set([...expectedWords].filter((x) => actualWords.has(x)));
    const union = new Set([...expectedWords, ...actualWords]);

    if (union.size === 0) return 1;
    return intersection.size / union.size;
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService();
