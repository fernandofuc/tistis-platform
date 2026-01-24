// =====================================================
// TIS TIS PLATFORM - EXPLAINABILITY SERVICE
// Unified interface for AI explainability
// =====================================================

import type { DecisionLog, AuditEvent } from '../types';
import { decisionLoggerService } from './decision-logger.service';
import { evidenceExtractorService } from './evidence-extractor.service';
import { auditTrailService } from './audit-trail.service';

interface ExplainabilityReport {
  decision: {
    id: string;
    type: string;
    result: string;
    confidence: number;
    timestamp: Date;
  };
  explanation: {
    summary: string;
    detailed?: string;
    evidenceItems: Array<{
      type: string;
      content: string;
      relevance: number;
      explanation: string;
    }>;
  };
  context: {
    input?: string;
    model: string;
    alternatives?: Array<{
      option: string;
      score: number;
      reason?: string;
    }>;
  };
  audit: {
    eventId?: string;
    relatedEvents: AuditEvent[];
  };
  metadata: {
    latencyMs?: number;
    tokensUsed?: number;
    conversationId?: string;
  };
}

interface ConversationExplainability {
  conversationId: string;
  decisions: Array<{
    decisionId: string;
    type: string;
    result: string;
    confidence: number;
    summary: string;
    timestamp: Date;
  }>;
  overallStats: {
    totalDecisions: number;
    avgConfidence: number;
    lowConfidenceCount: number;
    escalated: boolean;
  };
  timeline: Array<{
    timestamp: Date;
    type: 'decision' | 'feedback' | 'escalation';
    description: string;
  }>;
}

export class ExplainabilityService {
  /**
   * Get complete explainability report for a decision
   */
  async getDecisionReport(decisionLogId: string): Promise<ExplainabilityReport> {
    // Get decision log
    const decision = await decisionLoggerService.getDecision(decisionLogId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    // Extract evidence
    const evidence = await evidenceExtractorService.getOrExtractEvidence(decisionLogId);

    // Generate explanations
    const summary = evidence.summary;
    let detailed: string | undefined;

    try {
      detailed = await evidenceExtractorService.generateExplanation(decisionLogId, 'detailed');
    } catch {
      // Non-critical
    }

    // Get related audit events
    const { events: auditEvents } = await auditTrailService.query({
      tenantId: decision.tenantId,
      resourceId: decision.conversationId,
      resourceType: 'conversation',
      limit: 20,
    });

    // Find the audit event for this decision
    const decisionAuditEvent = auditEvents.find((e) => e.decisionLogId === decisionLogId);

    return {
      decision: {
        id: decision.id,
        type: decision.decisionType,
        result: decision.decision,
        confidence: decision.confidence,
        timestamp: decision.createdAt,
      },
      explanation: {
        summary,
        detailed,
        evidenceItems: evidence.evidenceItems.map((e) => ({
          type: e.type,
          content: e.content,
          relevance: e.relevance,
          explanation: e.explanation,
        })),
      },
      context: {
        input: decision.inputText,
        model: decision.modelUsed,
        alternatives: decision.candidates?.map((c) => ({
          option: c.option,
          score: c.score,
          reason: c.reasoning,
        })),
      },
      audit: {
        eventId: decisionAuditEvent?.id,
        relatedEvents: auditEvents,
      },
      metadata: {
        latencyMs: decision.latencyMs,
        tokensUsed: decision.tokensUsed,
        conversationId: decision.conversationId,
      },
    };
  }

  /**
   * Get explainability overview for a conversation
   */
  async getConversationExplainability(
    tenantId: string,
    conversationId: string
  ): Promise<ConversationExplainability> {
    // Get all decisions for conversation
    const { decisions } = await decisionLoggerService.queryDecisions({
      tenantId,
      conversationId,
      limit: 100,
    });

    // Get summaries for each decision
    const decisionSummaries = await Promise.all(
      decisions.map(async (d) => {
        let summary = '';
        try {
          const evidence = await evidenceExtractorService.getEvidence(d.id);
          summary = evidence?.summary || `${d.decisionType}: ${d.decision}`;
        } catch {
          summary = `${d.decisionType}: ${d.decision}`;
        }

        return {
          decisionId: d.id,
          type: d.decisionType,
          result: d.decision,
          confidence: d.confidence,
          summary,
          timestamp: d.createdAt,
        };
      })
    );

    // Calculate stats
    const totalDecisions = decisions.length;
    const avgConfidence =
      totalDecisions > 0
        ? decisions.reduce((sum, d) => sum + d.confidence, 0) / totalDecisions
        : 0;
    const lowConfidenceCount = decisions.filter((d) => d.confidence < 0.7).length;
    const escalated = decisions.some((d) => d.decisionType === 'escalation');

    // Build timeline
    const { events: auditEvents } = await auditTrailService.query({
      tenantId,
      resourceId: conversationId,
      resourceType: 'conversation',
      limit: 50,
    });

    const timeline: ConversationExplainability['timeline'] = [];

    // Add decisions to timeline
    for (const d of decisions) {
      timeline.push({
        timestamp: d.createdAt,
        type: d.decisionType === 'escalation' ? 'escalation' : 'decision',
        description: `${d.decisionType}: ${d.decision} (${(d.confidence * 100).toFixed(0)}% confidence)`,
      });
    }

    // Add feedback events
    for (const e of auditEvents) {
      if (e.eventType === 'feedback') {
        timeline.push({
          timestamp: e.createdAt,
          type: 'feedback',
          description: `User feedback: ${e.action}`,
        });
      }
    }

    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      conversationId,
      decisions: decisionSummaries,
      overallStats: {
        totalDecisions,
        avgConfidence,
        lowConfidenceCount,
        escalated,
      },
      timeline,
    };
  }

  /**
   * Generate natural language explanation for end users
   */
  async generateUserFacingExplanation(decisionLogId: string): Promise<string> {
    return evidenceExtractorService.generateExplanation(decisionLogId, 'simple');
  }

  /**
   * Generate technical explanation for developers
   */
  async generateTechnicalExplanation(decisionLogId: string): Promise<string> {
    return evidenceExtractorService.generateExplanation(decisionLogId, 'technical');
  }

  /**
   * Get highlighted text spans for UI
   */
  async getHighlightedInput(
    decisionLogId: string
  ): Promise<{
    originalText: string;
    highlights: Array<{
      text: string;
      start: number;
      end: number;
      relevance: number;
      color: string;
    }>;
  }> {
    const decision = await decisionLoggerService.getDecision(decisionLogId);
    if (!decision || !decision.inputText) {
      throw new Error('Decision or input text not found');
    }

    const spans = await evidenceExtractorService.highlightRelevantSpans(decisionLogId);

    // Assign colors based on relevance
    const highlights = spans.map((s) => ({
      text: s.text,
      start: s.start,
      end: s.end,
      relevance: s.relevance,
      color: this.relevanceToColor(s.relevance),
    }));

    return {
      originalText: decision.inputText,
      highlights,
    };
  }

  /**
   * Check if a decision needs human review
   */
  async shouldReview(decisionLogId: string): Promise<{
    needsReview: boolean;
    reasons: string[];
  }> {
    const decision = await decisionLoggerService.getDecision(decisionLogId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    const reasons: string[] = [];

    // Low confidence
    if (decision.confidence < 0.7) {
      reasons.push(`Low confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    }

    // Multiple close alternatives
    if (decision.candidates && decision.candidates.length > 1) {
      const scores = decision.candidates.map((c) => c.score).sort((a, b) => b - a);
      if (scores.length > 1 && scores[0] - scores[1] < 0.1) {
        reasons.push('Close alternatives detected');
      }
    }

    // Escalation decision
    if (decision.decisionType === 'escalation') {
      reasons.push('Escalation decision');
    }

    // Sensitive decision types
    if (['action', 'model_selection'].includes(decision.decisionType)) {
      reasons.push(`Sensitive decision type: ${decision.decisionType}`);
    }

    return {
      needsReview: reasons.length > 0,
      reasons,
    };
  }

  /**
   * Get decisions that need review
   */
  async getDecisionsNeedingReview(
    tenantId: string,
    limit: number = 20
  ): Promise<Array<{ decision: DecisionLog; reasons: string[] }>> {
    const lowConfidence = await decisionLoggerService.getLowConfidenceDecisions(
      tenantId,
      0.7,
      limit
    );

    const results: Array<{ decision: DecisionLog; reasons: string[] }> = [];

    for (const decision of lowConfidence) {
      const { needsReview, reasons } = await this.shouldReview(decision.id);
      if (needsReview) {
        results.push({ decision, reasons });
      }
    }

    return results;
  }

  /**
   * Compare explanations between two decisions
   */
  async compareDecisions(
    decisionId1: string,
    decisionId2: string
  ): Promise<{
    similarities: string[];
    differences: string[];
    recommendation: string;
  }> {
    const [report1, report2] = await Promise.all([
      this.getDecisionReport(decisionId1),
      this.getDecisionReport(decisionId2),
    ]);

    const similarities: string[] = [];
    const differences: string[] = [];

    // Compare types
    if (report1.decision.type === report2.decision.type) {
      similarities.push(`Same decision type: ${report1.decision.type}`);
    } else {
      differences.push(`Different types: ${report1.decision.type} vs ${report2.decision.type}`);
    }

    // Compare models
    if (report1.context.model === report2.context.model) {
      similarities.push(`Same model: ${report1.context.model}`);
    } else {
      differences.push(`Different models: ${report1.context.model} vs ${report2.context.model}`);
    }

    // Compare confidence
    const confDiff = Math.abs(report1.decision.confidence - report2.decision.confidence);
    if (confDiff < 0.1) {
      similarities.push(`Similar confidence levels`);
    } else {
      differences.push(
        `Confidence differs: ${(report1.decision.confidence * 100).toFixed(1)}% vs ${(report2.decision.confidence * 100).toFixed(1)}%`
      );
    }

    // Compare evidence types
    const types1 = new Set(report1.explanation.evidenceItems.map((e) => e.type));
    const types2 = new Set(report2.explanation.evidenceItems.map((e) => e.type));
    const commonTypes = [...types1].filter((t) => types2.has(t));

    if (commonTypes.length > 0) {
      similarities.push(`Common evidence types: ${commonTypes.join(', ')}`);
    }

    // Generate recommendation
    let recommendation = '';
    if (report1.decision.result === report2.decision.result) {
      recommendation = 'Both decisions reached the same conclusion, suggesting consistency.';
    } else if (confDiff > 0.2) {
      recommendation =
        'Significant confidence difference suggests the inputs may have different quality or clarity.';
    } else {
      recommendation =
        'Different conclusions with similar confidence levels - consider reviewing the evidence.';
    }

    return { similarities, differences, recommendation };
  }

  // Private helpers

  private relevanceToColor(relevance: number): string {
    if (relevance >= 0.8) return '#22c55e'; // Green
    if (relevance >= 0.6) return '#84cc16'; // Lime
    if (relevance >= 0.4) return '#eab308'; // Yellow
    return '#f97316'; // Orange
  }
}

// Export singleton instance
export const explainabilityService = new ExplainabilityService();
