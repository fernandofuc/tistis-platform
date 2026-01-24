// =====================================================
// TIS TIS PLATFORM - DECISION LOGGER SERVICE
// Logs AI decisions for explainability
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { DecisionLog } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type DecisionType = DecisionLog['decisionType'];

interface LogDecisionParams {
  tenantId: string;
  decisionType: DecisionType;
  inputText?: string;
  inputFeatures?: Record<string, unknown>;
  modelUsed: string;
  promptTemplate?: string;
  promptRendered?: string;
  candidates?: Array<{
    option: string;
    score: number;
    reasoning?: string;
  }>;
  decision: string;
  confidence: number;
  reasoning?: string;
  influenceFactors?: Array<{
    factor: string;
    value: unknown;
    contribution: number;
  }>;
  conversationId?: string;
  messageId?: string;
  leadId?: string;
  latencyMs?: number;
  tokensUsed?: number;
  metadata?: Record<string, unknown>;
}

interface DecisionQuery {
  tenantId: string;
  decisionType?: DecisionType;
  conversationId?: string;
  modelUsed?: string;
  startDate?: Date;
  endDate?: Date;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

interface DecisionStats {
  total: number;
  byType: Record<string, number>;
  avgConfidence: number;
  avgLatencyMs: number;
  lowConfidenceCount: number;
}

export class DecisionLoggerService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Log an AI decision
   */
  async logDecision(params: LogDecisionParams): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_decision_logs')
      .insert({
        tenant_id: params.tenantId,
        decision_type: params.decisionType,
        input_text: params.inputText,
        input_features: params.inputFeatures,
        model_used: params.modelUsed,
        prompt_template: params.promptTemplate,
        prompt_rendered: params.promptRendered,
        candidates: params.candidates,
        decision: params.decision,
        confidence: params.confidence,
        reasoning: params.reasoning,
        influence_factors: params.influenceFactors,
        conversation_id: params.conversationId,
        message_id: params.messageId,
        lead_id: params.leadId,
        latency_ms: params.latencyMs,
        token_count: params.tokensUsed,
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[DecisionLoggerService] Error logging decision:', error);
      throw new Error(`Failed to log decision: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Log an intent classification decision
   */
  async logIntentClassification(params: {
    tenantId: string;
    inputText: string;
    detectedIntent: string;
    confidence: number;
    alternativeIntents?: Array<{ intent: string; score: number }>;
    modelUsed: string;
    conversationId?: string;
    latencyMs?: number;
  }): Promise<string> {
    const candidates = params.alternativeIntents?.map((alt) => ({
      option: alt.intent,
      score: alt.score,
    })) || [];

    // Add detected intent if not in alternatives
    if (!candidates.find((c) => c.option === params.detectedIntent)) {
      candidates.unshift({ option: params.detectedIntent, score: params.confidence });
    }

    return this.logDecision({
      tenantId: params.tenantId,
      decisionType: 'intent_classification',
      inputText: params.inputText,
      modelUsed: params.modelUsed,
      candidates,
      decision: params.detectedIntent,
      confidence: params.confidence,
      conversationId: params.conversationId,
      latencyMs: params.latencyMs,
    });
  }

  /**
   * Log a response generation decision
   */
  async logResponseGeneration(params: {
    tenantId: string;
    inputText: string;
    generatedResponse: string;
    modelUsed: string;
    promptTemplate?: string;
    promptRendered?: string;
    confidence?: number;
    conversationId?: string;
    latencyMs?: number;
    tokensUsed?: number;
  }): Promise<string> {
    return this.logDecision({
      tenantId: params.tenantId,
      decisionType: 'response_generation',
      inputText: params.inputText,
      modelUsed: params.modelUsed,
      promptTemplate: params.promptTemplate,
      promptRendered: params.promptRendered,
      decision: params.generatedResponse.substring(0, 500), // Truncate for storage
      confidence: params.confidence || 1.0,
      conversationId: params.conversationId,
      latencyMs: params.latencyMs,
      tokensUsed: params.tokensUsed,
      metadata: {
        fullResponse: params.generatedResponse,
      },
    });
  }

  /**
   * Log an escalation decision
   */
  async logEscalation(params: {
    tenantId: string;
    reason: string;
    confidence: number;
    factors: Array<{ factor: string; value: unknown; contribution: number }>;
    conversationId: string;
    modelUsed?: string;
  }): Promise<string> {
    return this.logDecision({
      tenantId: params.tenantId,
      decisionType: 'escalation',
      modelUsed: params.modelUsed || 'rule_based',
      decision: 'escalate',
      confidence: params.confidence,
      reasoning: params.reason,
      influenceFactors: params.factors,
      conversationId: params.conversationId,
    });
  }

  /**
   * Log a routing decision
   */
  async logRouting(params: {
    tenantId: string;
    inputText: string;
    selectedAgent: string;
    confidence: number;
    availableAgents: Array<{ agent: string; score: number }>;
    modelUsed: string;
    conversationId?: string;
  }): Promise<string> {
    return this.logDecision({
      tenantId: params.tenantId,
      decisionType: 'routing',
      inputText: params.inputText,
      modelUsed: params.modelUsed,
      candidates: params.availableAgents.map((a) => ({
        option: a.agent,
        score: a.score,
      })),
      decision: params.selectedAgent,
      confidence: params.confidence,
      conversationId: params.conversationId,
    });
  }

  /**
   * Log a model selection decision
   */
  async logModelSelection(params: {
    tenantId: string;
    selectedModel: string;
    reason: string;
    availableModels: Array<{ model: string; score: number }>;
    conversationId?: string;
  }): Promise<string> {
    return this.logDecision({
      tenantId: params.tenantId,
      decisionType: 'model_selection',
      modelUsed: 'router',
      candidates: params.availableModels.map((m) => ({
        option: m.model,
        score: m.score,
      })),
      decision: params.selectedModel,
      confidence: 1.0,
      reasoning: params.reason,
      conversationId: params.conversationId,
    });
  }

  /**
   * Get a decision log by ID
   */
  async getDecision(id: string): Promise<DecisionLog | null> {
    const { data, error } = await this.supabase
      .from('ai_decision_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapDecisionLog(data);
  }

  /**
   * Query decision logs
   */
  async queryDecisions(params: DecisionQuery): Promise<{
    decisions: DecisionLog[];
    total: number;
  }> {
    let query = this.supabase
      .from('ai_decision_logs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', params.tenantId)
      .order('created_at', { ascending: false });

    if (params.decisionType) {
      query = query.eq('decision_type', params.decisionType);
    }
    if (params.conversationId) {
      query = query.eq('conversation_id', params.conversationId);
    }
    if (params.modelUsed) {
      query = query.eq('model_used', params.modelUsed);
    }
    if (params.startDate) {
      query = query.gte('created_at', params.startDate.toISOString());
    }
    if (params.endDate) {
      query = query.lt('created_at', params.endDate.toISOString());
    }
    if (params.minConfidence !== undefined) {
      query = query.gte('confidence', params.minConfidence);
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('[DecisionLoggerService] Error querying decisions:', error);
      return { decisions: [], total: 0 };
    }

    return {
      decisions: (data || []).map(this.mapDecisionLog),
      total: count || 0,
    };
  }

  /**
   * Get decisions for a conversation
   */
  async getConversationDecisions(
    tenantId: string,
    conversationId: string
  ): Promise<DecisionLog[]> {
    const { decisions } = await this.queryDecisions({
      tenantId,
      conversationId,
      limit: 100,
    });
    return decisions;
  }

  /**
   * Get low confidence decisions (for review)
   */
  async getLowConfidenceDecisions(
    tenantId: string,
    confidenceThreshold: number = 0.7,
    limit: number = 50
  ): Promise<DecisionLog[]> {
    const { data } = await this.supabase
      .from('ai_decision_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .lt('confidence', confidenceThreshold)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []).map(this.mapDecisionLog);
  }

  /**
   * Get decision statistics
   */
  async getStats(tenantId: string, days: number = 30): Promise<DecisionStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, count } = await this.supabase
      .from('ai_decision_logs')
      .select('decision_type, confidence, latency_ms', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (!data) {
      return {
        total: 0,
        byType: {},
        avgConfidence: 0,
        avgLatencyMs: 0,
        lowConfidenceCount: 0,
      };
    }

    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let lowConfidenceCount = 0;

    for (const row of data) {
      byType[row.decision_type] = (byType[row.decision_type] || 0) + 1;
      totalConfidence += row.confidence;
      if (row.latency_ms) {
        totalLatency += row.latency_ms;
        latencyCount++;
      }
      if (row.confidence < 0.7) {
        lowConfidenceCount++;
      }
    }

    return {
      total: count || 0,
      byType,
      avgConfidence: data.length > 0 ? totalConfidence / data.length : 0,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      lowConfidenceCount,
    };
  }

  /**
   * Delete old decision logs (retention policy)
   */
  async cleanup(tenantId: string, retentionDays: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // First count records to delete
    const { count: recordCount } = await this.supabase
      .from('ai_decision_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .lt('created_at', cutoff.toISOString());

    // Then delete
    const { error } = await this.supabase
      .from('ai_decision_logs')
      .delete()
      .eq('tenant_id', tenantId)
      .lt('created_at', cutoff.toISOString());

    if (error) {
      console.error('[DecisionLoggerService] Cleanup error:', error);
      return 0;
    }

    return recordCount || 0;
  }

  // Private helpers

  private mapDecisionLog(row: Record<string, unknown>): DecisionLog {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      decisionType: row.decision_type as DecisionType,
      inputText: row.input_text as string | undefined,
      inputFeatures: row.input_features as Record<string, unknown> | undefined,
      modelUsed: row.model_used as string,
      promptTemplate: row.prompt_template as string | undefined,
      promptRendered: row.prompt_rendered as string | undefined,
      candidates: row.candidates as Array<{
        option: string;
        score: number;
        reasoning?: string;
      }> | undefined,
      decision: row.decision as string,
      confidence: row.confidence as number,
      reasoning: row.reasoning as string | undefined,
      influenceFactors: row.influence_factors as Array<{
        factor: string;
        weight: number;
        value: unknown;
        contribution: number;
      }> | undefined,
      conversationId: row.conversation_id as string | undefined,
      messageId: row.message_id as string | undefined,
      leadId: row.lead_id as string | undefined,
      latencyMs: row.latency_ms as number | undefined,
      tokensUsed: row.token_count as number | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Export singleton instance
export const decisionLoggerService = new DecisionLoggerService();
