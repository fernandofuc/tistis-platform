// =====================================================
// TIS TIS PLATFORM - LANGGRAPH INTEGRATION SERVICE
// Integrates AI Learning 2.0 with LangGraph agents
// =====================================================

import type { TISTISAgentStateType } from '../../state/agent-state';
import type { AILearningContext, DecisionLog } from '../types';

// Import AI Learning services
import { feedbackService } from '../rlhf/feedback.service';
import { abTestingService } from '../rlhf/ab-testing.service';
import { promptOptimizerService } from '../rlhf/prompt-optimizer.service';
import { semanticSearchService } from '../embeddings/semantic-search.service';
import { vectorStoreService } from '../embeddings/vector-store.service';
import { metricsCollectorService } from '../drift/metrics-collector.service';
import { driftDetectorService } from '../drift/drift-detector.service';
import { featureRetrievalService } from '../feature-store/feature-retrieval.service';
import { onlineStoreService } from '../feature-store/online-store.service';
import { modelRegistryService } from '../finetuning/model-registry.service';
import { decisionLoggerService } from '../xai/decision-logger.service';
import { auditTrailService } from '../xai/audit-trail.service';
import { explainabilityService } from '../xai/explainability.service';

interface IntegrationConfig {
  enableFeedbackCollection: boolean;
  enableABTesting: boolean;
  enableSemanticSearch: boolean;
  enableDriftMonitoring: boolean;
  enableFeatureStore: boolean;
  enableDecisionLogging: boolean;
  enableExplainability: boolean;
}

interface ProcessingContext {
  tenantId: string;
  conversationId: string;
  leadId?: string;
  messageId?: string;
  channel: string;
}

interface EnrichedContext {
  similarPatterns: Array<{
    content: string;
    intent?: string;
    similarity: number;
  }>;
  leadFeatures: Record<string, unknown>;
  conversationFeatures: Record<string, unknown>;
  activeModel?: {
    modelId: string;
    modelName: string;
    reason: string;
  };
  abTestVariant?: {
    variantId: string;
    promptContent: string;
  };
  learningContext: AILearningContext;
}

export class LangGraphIntegrationService {
  private config: IntegrationConfig = {
    enableFeedbackCollection: true,
    enableABTesting: true,
    enableSemanticSearch: true,
    enableDriftMonitoring: true,
    enableFeatureStore: true,
    enableDecisionLogging: true,
    enableExplainability: true,
  };

  /**
   * Configure integration features
   */
  configure(config: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enrich LangGraph state with AI Learning context
   * Called at the start of processing
   */
  async enrichContext(
    state: TISTISAgentStateType,
    context: ProcessingContext
  ): Promise<EnrichedContext> {
    // Validate preconditions
    if (!context.tenantId) {
      console.error('[LangGraphIntegration] tenantId is required');
      throw new Error('tenantId is required for AI Learning context enrichment');
    }

    const enriched: EnrichedContext = {
      similarPatterns: [],
      leadFeatures: {},
      conversationFeatures: {},
      learningContext: {
        tenantId: context.tenantId,
        conversationId: context.conversationId,
        leadId: context.leadId,
        channel: context.channel,
      },
    };

    // Semantic search for similar patterns
    if (this.config.enableSemanticSearch && state.current_message?.trim()) {
      try {
        const results = await semanticSearchService.searchWithIntent(
          context.tenantId,
          state.current_message
        );

        if (results?.results) {
          enriched.similarPatterns = results.results.slice(0, 5).map((r) => ({
            content: r.contentText,
            intent: r.intent,
            similarity: r.similarity,
          }));
        }

        if (results?.detectedIntent) {
          enriched.learningContext.detectedIntent = results.detectedIntent;
          enriched.learningContext.intentConfidence = results.intentConfidence;
        }
      } catch (error) {
        // Log but continue - semantic search is enhancement, not critical
        console.warn('[LangGraphIntegration] Semantic search failed:', error);
      }
    }

    // Feature retrieval
    if (this.config.enableFeatureStore) {
      try {
        // Lead features
        if (context.leadId) {
          const leadFeatureSet = await featureRetrievalService.getFeatures(
            context.tenantId,
            'lead',
            context.leadId
          );
          enriched.leadFeatures = leadFeatureSet.features;
        }

        // Conversation features
        const convFeatureSet = await featureRetrievalService.getFeatures(
          context.tenantId,
          'conversation',
          context.conversationId
        );
        enriched.conversationFeatures = convFeatureSet.features;
      } catch (error) {
        console.warn('[LangGraphIntegration] Feature retrieval failed:', error);
      }
    }

    // Model selection (skip if intent is unknown)
    if (state.detected_intent && state.detected_intent !== 'UNKNOWN') {
      try {
        const modelSelection = await modelRegistryService.selectModel(
          context.tenantId,
          state.detected_intent
        );

        if (modelSelection) {
          enriched.activeModel = {
            modelId: modelSelection.modelId,
            modelName: modelSelection.modelName,
            reason: modelSelection.reason,
          };
          enriched.learningContext.modelUsed = modelSelection.modelId;
        }
      } catch (error) {
        console.warn('[LangGraphIntegration] Model selection failed:', error);
      }
    }

    // A/B Testing
    if (this.config.enableABTesting) {
      try {
        // Get active tests for the tenant
        const activeTests = await abTestingService.getActiveTests(context.tenantId);

        // Find a test that matches the current intent/context
        for (const test of activeTests) {
          // Check if test targets this channel
          if (test.targetChannels && test.targetChannels.length > 0) {
            if (!test.targetChannels.includes(context.channel)) {
              continue;
            }
          }

          // Get variant for this test
          const variant = await abTestingService.getVariantForRequest(test.id, {
            channel: context.channel,
            userId: context.leadId,
          });

          if (variant) {
            enriched.abTestVariant = {
              variantId: variant.variantId,
              promptContent: variant.variant.promptContent,
            };
            enriched.learningContext.promptVariantId = variant.variantId;
            break; // Use first matching test
          }
        }
      } catch (error) {
        console.warn('[LangGraphIntegration] A/B testing failed:', error);
      }
    }

    return enriched;
  }

  /**
   * Log decision after agent processing
   */
  async logDecision(
    state: TISTISAgentStateType,
    context: ProcessingContext,
    decisionInfo: {
      decisionType: DecisionLog['decisionType'];
      decision: string;
      confidence: number;
      reasoning?: string;
      candidates?: Array<{ option: string; score: number; reasoning?: string }>;
      latencyMs?: number;
    }
  ): Promise<string | null> {
    if (!this.config.enableDecisionLogging) return null;

    try {
      const decisionId = await decisionLoggerService.logDecision({
        tenantId: context.tenantId,
        decisionType: decisionInfo.decisionType,
        inputText: state.current_message,
        inputFeatures: {
          detected_intent: state.detected_intent,
          detected_signals: state.detected_signals,
          extracted_data: state.extracted_data,
        },
        modelUsed: state.model_used,
        candidates: decisionInfo.candidates,
        decision: decisionInfo.decision,
        confidence: decisionInfo.confidence,
        reasoning: decisionInfo.reasoning,
        conversationId: context.conversationId,
        leadId: context.leadId,
        messageId: context.messageId,
        latencyMs: decisionInfo.latencyMs,
        tokensUsed: state.tokens_used,
      });

      // Log to audit trail
      await auditTrailService.logDecision(
        context.tenantId,
        decisionId,
        `${decisionInfo.decisionType}: ${decisionInfo.decision}`,
        { confidence: decisionInfo.confidence }
      );

      return decisionId;
    } catch (error) {
      console.error('[LangGraphIntegration] Decision logging failed:', error);
      return null;
    }
  }

  /**
   * Record metrics after processing
   */
  async recordMetrics(
    context: ProcessingContext,
    metrics: {
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      intentDetected?: string;
      wasEscalated?: boolean;
      messageLength?: number;
    }
  ): Promise<void> {
    if (!this.config.enableDriftMonitoring) return;

    try {
      // Response latency
      await metricsCollectorService.recordLatency(
        context.tenantId,
        metrics.latencyMs,
        context.conversationId
      );

      // Token usage
      if (metrics.inputTokens !== undefined && metrics.outputTokens !== undefined) {
        await metricsCollectorService.recordTokens(
          context.tenantId,
          metrics.inputTokens,
          metrics.outputTokens,
          context.conversationId
        );
      }

      // Escalation
      if (metrics.wasEscalated !== undefined) {
        await metricsCollectorService.recordEscalation(
          context.tenantId,
          metrics.wasEscalated,
          context.conversationId
        );
      }

      // Message length (input distribution)
      if (metrics.messageLength !== undefined) {
        await metricsCollectorService.recordInputMetric(
          context.tenantId,
          'message_length',
          metrics.messageLength
        );
      }
    } catch (error) {
      console.error('[LangGraphIntegration] Metrics recording failed:', error);
    }
  }

  /**
   * Update features after processing
   */
  async updateFeatures(
    context: ProcessingContext,
    state: TISTISAgentStateType
  ): Promise<void> {
    if (!this.config.enableFeatureStore) return;

    try {
      // Update lead features
      if (context.leadId) {
        await onlineStoreService.upsertBatch(
          context.tenantId,
          'lead',
          context.leadId,
          [
            {
              featureId: 'lead_last_intent',
              value: state.detected_intent,
            },
            {
              featureId: 'lead_last_activity',
              value: new Date().toISOString(),
            },
          ]
        );
      }

      // Update conversation features
      await onlineStoreService.upsertBatch(
        context.tenantId,
        'conversation',
        context.conversationId,
        [
          {
            featureId: 'conversation_last_intent',
            value: state.detected_intent,
          },
          {
            featureId: 'conversation_message_count',
            value: state.conversation?.message_count || 1,
          },
          {
            featureId: 'conversation_escalated',
            value: state.control.should_escalate,
          },
        ]
      );
    } catch (error) {
      console.error('[LangGraphIntegration] Feature update failed:', error);
    }
  }

  /**
   * Store learned pattern from successful interaction
   */
  async learnPattern(
    context: ProcessingContext,
    pattern: {
      contentText: string;
      intent?: string;
      category?: string;
      tags?: string[];
      sourceType: 'message' | 'pattern' | 'faq' | 'knowledge_article' | 'service' | 'custom_instruction';
    }
  ): Promise<string | null> {
    if (!this.config.enableSemanticSearch) return null;

    try {
      const patternId = await vectorStoreService.store({
        tenantId: context.tenantId,
        sourceType: pattern.sourceType,
        sourceId: context.messageId,
        contentText: pattern.contentText,
        intent: pattern.intent,
        category: pattern.category,
        tags: pattern.tags,
      });

      return patternId;
    } catch (error) {
      console.error('[LangGraphIntegration] Pattern learning failed:', error);
      return null;
    }
  }

  /**
   * Handle user feedback
   */
  async handleFeedback(
    context: ProcessingContext,
    feedback: {
      type: 'thumbs_up' | 'thumbs_down' | 'rating';
      value?: number;
      comment?: string;
      aiResponseText?: string;
      promptVariantId?: string;
    }
  ): Promise<void> {
    if (!this.config.enableFeedbackCollection) return;

    try {
      if (feedback.type === 'thumbs_up') {
        await feedbackService.submitThumbsUp(
          context.tenantId,
          context.messageId || '',
          {
            conversationId: context.conversationId,
            leadId: context.leadId,
            aiResponseText: feedback.aiResponseText,
            channel: context.channel,
          }
        );
      } else if (feedback.type === 'thumbs_down') {
        await feedbackService.submitThumbsDown(
          context.tenantId,
          context.messageId || '',
          {
            conversationId: context.conversationId,
            leadId: context.leadId,
            aiResponseText: feedback.aiResponseText,
            feedbackText: feedback.comment,
            channel: context.channel,
          }
        );
      } else if (feedback.type === 'rating' && feedback.value) {
        await feedbackService.submitRating(
          context.tenantId,
          context.messageId || '',
          feedback.value as 1 | 2 | 3 | 4 | 5,
          {
            conversationId: context.conversationId,
            leadId: context.leadId,
            feedbackText: feedback.comment,
            aiResponseText: feedback.aiResponseText,
            channel: context.channel,
          }
        );
      }

      // Record as quality metric
      const isPositive = feedback.type === 'thumbs_up' ||
        (feedback.value !== undefined && feedback.value >= 4);
      await metricsCollectorService.recordFeedback(
        context.tenantId,
        isPositive,
        context.conversationId
      );

      // Log to audit trail
      await auditTrailService.logFeedback(
        context.tenantId,
        context.leadId || 'anonymous',
        context.conversationId,
        feedback.type,
        feedback.value,
        feedback.comment
      );
    } catch (error) {
      console.error('[LangGraphIntegration] Feedback handling failed:', error);
    }
  }

  /**
   * Check for drift alerts
   */
  async checkDrift(tenantId: string): Promise<{
    hasDrift: boolean;
    alerts: Array<{ metric: string; severity: string; message: string }>;
  }> {
    if (!this.config.enableDriftMonitoring) {
      return { hasDrift: false, alerts: [] };
    }

    try {
      const results = await driftDetectorService.detectAllDrift(tenantId, {
        autoAlert: false,
      });

      const driftAlerts = results
        .filter((r) => r.isDrift)
        .map((r) => ({
          metric: r.metricName,
          severity: r.driftScore > 0.5 ? 'high' : 'medium',
          message: r.details.message,
        }));

      return {
        hasDrift: driftAlerts.length > 0,
        alerts: driftAlerts,
      };
    } catch (error) {
      console.error('[LangGraphIntegration] Drift check failed:', error);
      return { hasDrift: false, alerts: [] };
    }
  }

  /**
   * Get explanation for a decision
   */
  async getExplanation(
    decisionLogId: string,
    style: 'technical' | 'simple' = 'simple'
  ): Promise<string> {
    if (!this.config.enableExplainability) {
      return 'Explanation not available';
    }

    try {
      if (style === 'simple') {
        return await explainabilityService.generateUserFacingExplanation(decisionLogId);
      } else {
        return await explainabilityService.generateTechnicalExplanation(decisionLogId);
      }
    } catch (error) {
      console.error('[LangGraphIntegration] Explanation generation failed:', error);
      return 'Unable to generate explanation';
    }
  }

  /**
   * Get best prompt for an agent type
   */
  async getBestPrompt(
    tenantId: string,
    agentType: string
  ): Promise<{ content: string; variantId?: string } | null> {
    if (!this.config.enableABTesting) return null;

    try {
      const variant = await promptOptimizerService.getBestVariant(tenantId, agentType);

      if (variant) {
        return {
          content: variant.promptContent,
          variantId: variant.id,
        };
      }
      return null;
    } catch (error) {
      console.warn('[LangGraphIntegration] Best prompt retrieval failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const langGraphIntegrationService = new LangGraphIntegrationService();
