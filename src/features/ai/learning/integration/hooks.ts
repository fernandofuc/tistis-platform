// =====================================================
// TIS TIS PLATFORM - AI LEARNING HOOKS
// React-style hooks for AI Learning features
// =====================================================

import { langGraphIntegrationService } from './langgraph-integration.service';
import { feedbackService } from '../rlhf/feedback.service';
import { semanticSearchService } from '../embeddings/semantic-search.service';
import { explainabilityService } from '../xai/explainability.service';
import { driftDetectorService } from '../drift/drift-detector.service';
import { alertService } from '../drift/alert.service';

interface UseAILearningOptions {
  tenantId: string;
  conversationId?: string;
  leadId?: string;
}

interface FeedbackHook {
  submitThumbsUp: (messageId: string, aiResponse: string, variantId?: string) => Promise<void>;
  submitThumbsDown: (messageId: string, aiResponse: string, comment?: string, variantId?: string) => Promise<void>;
  submitRating: (messageId: string, rating: 1 | 2 | 3 | 4 | 5, aiResponse?: string, comment?: string) => Promise<void>;
}

interface SearchHook {
  search: (query: string, options?: { limit?: number; threshold?: number }) => Promise<Array<{
    content: string;
    intent?: string;
    similarity: number;
  }>>;
  searchWithIntent: (query: string) => Promise<{
    results: Array<{ content: string; similarity: number }>;
    detectedIntent?: string;
    confidence?: number;
  }>;
}

interface ExplainabilityHook {
  getExplanation: (decisionId: string, style?: 'simple' | 'technical' | 'detailed') => Promise<string>;
  getDecisionReport: (decisionId: string) => Promise<{
    decision: { type: string; result: string; confidence: number };
    summary: string;
    evidenceItems: Array<{ type: string; content: string; relevance: number }>;
  } | null>;
  needsReview: (decisionId: string) => Promise<{ needsReview: boolean; reasons: string[] }>;
}

interface MonitoringHook {
  checkDrift: () => Promise<{ hasDrift: boolean; alerts: Array<{ metric: string; severity: string; message: string }> }>;
  getActiveAlerts: () => Promise<Array<{ id: string; severity: string; message: string; createdAt: Date }>>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string, resolution?: string) => Promise<void>;
}

/**
 * AI Learning Hooks - Easy-to-use functions for common AI Learning operations
 */
export class AILearningHooks {
  /**
   * Create feedback hooks for a context
   */
  useFeedback(options: UseAILearningOptions): FeedbackHook {
    const { tenantId, conversationId, leadId } = options;

    return {
      submitThumbsUp: async (messageId, aiResponse, variantId) => {
        await langGraphIntegrationService.handleFeedback(
          {
            tenantId,
            conversationId: conversationId || '',
            leadId,
            messageId,
            channel: 'whatsapp',
          },
          {
            type: 'thumbs_up',
            aiResponseText: aiResponse,
            promptVariantId: variantId,
          }
        );
      },

      submitThumbsDown: async (messageId, aiResponse, comment, variantId) => {
        await langGraphIntegrationService.handleFeedback(
          {
            tenantId,
            conversationId: conversationId || '',
            leadId,
            messageId,
            channel: 'whatsapp',
          },
          {
            type: 'thumbs_down',
            aiResponseText: aiResponse,
            comment,
            promptVariantId: variantId,
          }
        );
      },

      submitRating: async (messageId, rating, aiResponse, comment) => {
        await langGraphIntegrationService.handleFeedback(
          {
            tenantId,
            conversationId: conversationId || '',
            leadId,
            messageId,
            channel: 'whatsapp',
          },
          {
            type: 'rating',
            value: rating,
            aiResponseText: aiResponse,
            comment,
          }
        );
      },
    };
  }

  /**
   * Create semantic search hooks for a tenant
   */
  useSearch(tenantId: string): SearchHook {
    return {
      search: async (query, options) => {
        const results = await semanticSearchService.search({
          tenantId,
          query,
          limit: options?.limit || 5,
          threshold: options?.threshold || 0.7,
        });

        return results.map((r) => ({
          content: r.contentText,
          intent: r.intent,
          similarity: r.similarity,
        }));
      },

      searchWithIntent: async (query) => {
        const result = await semanticSearchService.searchWithIntent(tenantId, query);

        return {
          results: result.results.map((r) => ({
            content: r.contentText,
            similarity: r.similarity,
          })),
          detectedIntent: result.detectedIntent,
          confidence: result.intentConfidence,
        };
      },
    };
  }

  /**
   * Create explainability hooks
   */
  useExplainability(): ExplainabilityHook {
    return {
      getExplanation: async (decisionId, style = 'simple') => {
        return langGraphIntegrationService.getExplanation(decisionId, style === 'detailed' ? 'technical' : style);
      },

      getDecisionReport: async (decisionId) => {
        try {
          const report = await explainabilityService.getDecisionReport(decisionId);

          return {
            decision: {
              type: report.decision.type,
              result: report.decision.result,
              confidence: report.decision.confidence,
            },
            summary: report.explanation.summary,
            evidenceItems: report.explanation.evidenceItems,
          };
        } catch {
          return null;
        }
      },

      needsReview: async (decisionId) => {
        return explainabilityService.shouldReview(decisionId);
      },
    };
  }

  /**
   * Create monitoring hooks for a tenant
   */
  useMonitoring(tenantId: string): MonitoringHook {
    return {
      checkDrift: async () => {
        return langGraphIntegrationService.checkDrift(tenantId);
      },

      getActiveAlerts: async () => {
        const alerts = await alertService.getActiveAlerts(tenantId);
        return alerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          createdAt: a.createdAt,
        }));
      },

      acknowledgeAlert: async (alertId) => {
        await alertService.acknowledgeAlert(alertId);
      },

      resolveAlert: async (alertId, resolution) => {
        await alertService.resolveAlert(alertId, resolution);
      },
    };
  }

  /**
   * Create context for an entire conversation
   */
  useConversationContext(options: UseAILearningOptions) {
    return {
      feedback: this.useFeedback(options),
      search: this.useSearch(options.tenantId),
      explain: this.useExplainability(),
      monitor: this.useMonitoring(options.tenantId),
    };
  }

  /**
   * Get conversation explainability summary
   */
  async getConversationSummary(tenantId: string, conversationId: string) {
    return explainabilityService.getConversationExplainability(tenantId, conversationId);
  }

  /**
   * Get decisions needing review for a tenant
   */
  async getDecisionsNeedingReview(tenantId: string, limit?: number) {
    const decisions = await explainabilityService.getDecisionsNeedingReview(tenantId, limit);
    return decisions.map((d) => ({
      decisionId: d.decision.id,
      type: d.decision.decisionType,
      result: d.decision.decision,
      confidence: d.decision.confidence,
      reasons: d.reasons,
      timestamp: d.decision.createdAt,
    }));
  }

  /**
   * Record feedback from WhatsApp quick reply buttons
   */
  async handleQuickReplyFeedback(
    tenantId: string,
    conversationId: string,
    quickReply: 'positive' | 'negative',
    messageId?: string,
    aiResponse?: string
  ) {
    const feedback = this.useFeedback({
      tenantId,
      conversationId,
    });

    if (quickReply === 'positive') {
      await feedback.submitThumbsUp(messageId || '', aiResponse || '');
    } else {
      await feedback.submitThumbsDown(messageId || '', aiResponse || '');
    }
  }
}

// Export singleton instance
export const aiLearningHooks = new AILearningHooks();
