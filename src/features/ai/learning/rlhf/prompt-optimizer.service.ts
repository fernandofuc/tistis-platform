// =====================================================
// TIS TIS PLATFORM - PROMPT OPTIMIZER SERVICE
// Generates and optimizes prompt variants using feedback
// =====================================================

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { PromptVariant, Feedback } from '../types';
import { aggregatorService } from './aggregator.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface GenerateVariantsParams {
  tenantId: string;
  baseVariantId: string;
  count?: number;
  strategy?: 'tone' | 'structure' | 'length' | 'specificity' | 'all';
  useNegativeFeedback?: boolean;
}

interface OptimizationSuggestion {
  aspect: string;
  currentIssue: string;
  suggestedChange: string;
  confidence: number;
  basedOn: string[];
}

export class PromptOptimizerService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Create a new prompt variant
   */
  async createVariant(params: {
    tenantId: string;
    name: string;
    variantType: PromptVariant['variantType'];
    promptContent: string;
    agentType?: string;
    description?: string;
    variables?: PromptVariant['variables'];
    isControl?: boolean;
    createdBy?: string;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_prompt_variants')
      .insert({
        tenant_id: params.tenantId,
        name: params.name,
        variant_type: params.variantType,
        prompt_content: params.promptContent,
        agent_type: params.agentType,
        description: params.description,
        variables: params.variables || [],
        is_control: params.isControl || false,
        created_by: params.createdBy,
        status: 'draft',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[PromptOptimizerService] Error creating variant:', error);
      throw new Error(`Failed to create variant: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Generate new variants based on feedback analysis
   */
  async generateVariants(params: GenerateVariantsParams): Promise<string[]> {
    const count = params.count || 2;

    // Get base variant
    const { data: baseVariant, error } = await this.supabase
      .from('ai_prompt_variants')
      .select('*')
      .eq('id', params.baseVariantId)
      .single();

    if (error || !baseVariant) {
      throw new Error('Base variant not found');
    }

    // Get negative feedback for insights
    let feedbackInsights = '';
    if (params.useNegativeFeedback) {
      const insights = await this.analyzeFeedbackForOptimization(params.tenantId, baseVariant.id);
      feedbackInsights = insights
        .map((i) => `- ${i.aspect}: ${i.currentIssue} -> ${i.suggestedChange}`)
        .join('\n');
    }

    // Generate variants using LLM
    const generatedVariants = await this.generateWithLLM(
      baseVariant.prompt_content,
      count,
      params.strategy || 'all',
      feedbackInsights
    );

    // Save variants
    const variantIds: string[] = [];
    for (let i = 0; i < generatedVariants.length; i++) {
      const variant = generatedVariants[i];
      const id = await this.createVariant({
        tenantId: params.tenantId,
        name: `${baseVariant.name} - Variant ${i + 1}`,
        variantType: baseVariant.variant_type,
        promptContent: variant.content,
        agentType: baseVariant.agent_type,
        description: variant.description,
        variables: baseVariant.variables,
        isControl: false,
      });
      variantIds.push(id);
    }

    return variantIds;
  }

  /**
   * Analyze feedback to suggest optimizations
   */
  async analyzeFeedbackForOptimization(
    tenantId: string,
    variantId?: string
  ): Promise<OptimizationSuggestion[]> {
    // Get negative feedback
    let query = this.supabase
      .from('ai_feedback')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_positive', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (variantId) {
      query = query.eq('ai_prompt_variant_id', variantId);
    }

    const { data: negativeFeedback } = await query;

    if (!negativeFeedback || negativeFeedback.length === 0) {
      return [];
    }

    // Analyze with LLM
    const feedbackTexts = negativeFeedback
      .filter((f) => f.feedback_text || f.correction_text)
      .map((f) => ({
        text: f.feedback_text || '',
        correction: f.correction_text || '',
        dimension: f.dimension,
        response: f.ai_response_text?.substring(0, 200) || '',
      }));

    if (feedbackTexts.length === 0) {
      return [];
    }

    const suggestions = await this.analyzeFeedbackWithLLM(feedbackTexts);
    return suggestions;
  }

  /**
   * Get best performing variant for an agent type
   */
  async getBestVariant(
    tenantId: string,
    agentType: string
  ): Promise<PromptVariant | null> {
    const { data, error } = await this.supabase
      .from('ai_prompt_variants')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('agent_type', agentType)
      .eq('status', 'active')
      .order('performance_score', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Fallback to control variant
      const { data: control } = await this.supabase
        .from('ai_prompt_variants')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('agent_type', agentType)
        .eq('is_control', true)
        .single();

      return control ? this.mapVariant(control) : null;
    }

    return this.mapVariant(data);
  }

  /**
   * Update variant performance scores
   * Should be called after aggregation
   */
  async updatePerformanceScores(tenantId: string): Promise<number> {
    // Get all active variants
    const { data: variants } = await this.supabase
      .from('ai_prompt_variants')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (!variants || variants.length === 0) {
      return 0;
    }

    let updated = 0;
    for (const variant of variants) {
      const total = variant.positive_feedback + variant.negative_feedback;
      if (total === 0) continue;

      // Calculate Wilson Score
      const wilson = aggregatorService.calculateWilsonScore(variant.positive_feedback, total);

      // Confidence based on sample size
      const confidence = Math.min(total / 100, 1); // Max confidence at 100 samples

      // Performance score = Wilson Lower * Confidence
      const performanceScore = wilson.lower * confidence;

      await this.supabase
        .from('ai_prompt_variants')
        .update({
          performance_score: performanceScore,
          confidence_level: confidence,
        })
        .eq('id', variant.id);

      updated++;
    }

    return updated;
  }

  /**
   * Archive underperforming variants
   */
  async archiveUnderperformers(
    tenantId: string,
    threshold: number = 0.3,
    minSamples: number = 50
  ): Promise<string[]> {
    const { data: variants } = await this.supabase
      .from('ai_prompt_variants')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('is_control', false);

    if (!variants) return [];

    const archived: string[] = [];
    for (const variant of variants) {
      const total = variant.positive_feedback + variant.negative_feedback;
      if (total < minSamples) continue;

      const wilson = aggregatorService.calculateWilsonScore(variant.positive_feedback, total);
      if (wilson.upper < threshold) {
        await this.supabase
          .from('ai_prompt_variants')
          .update({ status: 'archived' })
          .eq('id', variant.id);
        archived.push(variant.id);
      }
    }

    return archived;
  }

  // Private helpers

  private async generateWithLLM(
    basePrompt: string,
    count: number,
    strategy: string,
    feedbackInsights: string
  ): Promise<Array<{ content: string; description: string }>> {
    const strategyInstructions: Record<string, string> = {
      tone: 'Focus on varying the tone (more friendly, more professional, more empathetic)',
      structure: 'Focus on restructuring the prompt (bullet points, different order, clearer sections)',
      length: 'Focus on length variations (more concise or more detailed)',
      specificity: 'Focus on specificity (more examples, clearer instructions, edge cases)',
      all: 'Consider all aspects: tone, structure, length, and specificity',
    };

    const systemPrompt = `You are an expert prompt engineer. Your task is to generate ${count} improved variants of a given prompt.

Strategy: ${strategyInstructions[strategy]}

${feedbackInsights ? `User feedback insights to address:\n${feedbackInsights}\n` : ''}

For each variant:
1. Make meaningful changes that could improve performance
2. Preserve the core functionality and intent
3. Keep similar length unless length is the focus
4. Provide a brief description of what changed

Respond in JSON format:
{
  "variants": [
    {
      "content": "The improved prompt text...",
      "description": "Brief description of changes made"
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Original prompt:\n\n${basePrompt}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"variants":[]}');
      return result.variants || [];
    } catch (error) {
      console.error('[PromptOptimizerService] LLM generation error:', error);
      return [];
    }
  }

  private async analyzeFeedbackWithLLM(
    feedback: Array<{ text: string; correction: string; dimension?: string; response: string }>
  ): Promise<OptimizationSuggestion[]> {
    const systemPrompt = `You are an expert at analyzing user feedback to improve AI prompts.

Analyze the following negative feedback and suggest concrete improvements.

For each suggestion, provide:
1. The aspect being criticized (tone, accuracy, helpfulness, etc.)
2. What the current issue is
3. A specific suggested change
4. Confidence level (0-1)

Respond in JSON format:
{
  "suggestions": [
    {
      "aspect": "tone",
      "currentIssue": "Responses feel too robotic",
      "suggestedChange": "Add more conversational elements and empathy",
      "confidence": 0.8,
      "basedOn": ["feedback_1", "feedback_3"]
    }
  ]
}`;

    const feedbackText = feedback
      .map((f, i) => `Feedback ${i + 1}: "${f.text}" ${f.correction ? `Correction: "${f.correction}"` : ''} ${f.dimension ? `(${f.dimension})` : ''}`)
      .join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: feedbackText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"suggestions":[]}');
      return result.suggestions || [];
    } catch (error) {
      console.error('[PromptOptimizerService] Feedback analysis error:', error);
      return [];
    }
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
}

// Export singleton instance
export const promptOptimizerService = new PromptOptimizerService();
