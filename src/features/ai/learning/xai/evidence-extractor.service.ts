// =====================================================
// TIS TIS PLATFORM - EVIDENCE EXTRACTOR SERVICE
// Extracts evidence supporting AI decisions
// =====================================================

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { DecisionLog } from '../types';
import { decisionLoggerService } from './decision-logger.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EvidenceItem {
  type: 'text_span' | 'feature' | 'pattern' | 'history' | 'rule';
  content: string;
  relevance: number; // 0-1
  startIndex?: number;
  endIndex?: number;
  explanation: string;
}

interface ExtractionResult {
  decisionLogId: string;
  evidenceItems: EvidenceItem[];
  summary: string;
  confidence: number;
}

export class EvidenceExtractorService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract evidence for a decision log
   */
  async extractEvidence(decisionLogId: string): Promise<ExtractionResult> {
    const log = await decisionLoggerService.getDecision(decisionLogId);
    if (!log) {
      throw new Error('Decision log not found');
    }

    const evidenceItems: EvidenceItem[] = [];

    // Extract evidence from input text
    if (log.inputText) {
      const textEvidence = await this.extractTextEvidence(
        log.inputText,
        log.decision,
        log.decisionType
      );
      evidenceItems.push(...textEvidence);
    }

    // Extract evidence from features
    if (log.inputFeatures) {
      const featureEvidence = this.extractFeatureEvidence(
        log.inputFeatures,
        log.influenceFactors
      );
      evidenceItems.push(...featureEvidence);
    }

    // Extract evidence from candidates
    if (log.candidates) {
      const candidateEvidence = this.extractCandidateEvidence(log.candidates, log.decision);
      evidenceItems.push(...candidateEvidence);
    }

    // Sort by relevance
    evidenceItems.sort((a, b) => b.relevance - a.relevance);

    // Generate summary
    const summary = await this.generateSummary(evidenceItems, log);

    // Calculate overall confidence
    const confidence = this.calculateConfidence(evidenceItems);

    // Store evidence
    await this.supabase.from('ai_decision_evidence').upsert(
      {
        decision_log_id: decisionLogId,
        evidence_items: evidenceItems,
        summary,
        confidence,
      },
      { onConflict: 'decision_log_id' }
    );

    return {
      decisionLogId,
      evidenceItems,
      summary,
      confidence,
    };
  }

  /**
   * Get stored evidence for a decision
   */
  async getEvidence(decisionLogId: string): Promise<ExtractionResult | null> {
    const { data } = await this.supabase
      .from('ai_decision_evidence')
      .select('*')
      .eq('decision_log_id', decisionLogId)
      .single();

    if (!data) return null;

    return {
      decisionLogId: data.decision_log_id,
      evidenceItems: data.evidence_items,
      summary: data.summary,
      confidence: data.confidence,
    };
  }

  /**
   * Extract or get cached evidence
   */
  async getOrExtractEvidence(decisionLogId: string): Promise<ExtractionResult> {
    const cached = await this.getEvidence(decisionLogId);
    if (cached) return cached;

    return this.extractEvidence(decisionLogId);
  }

  /**
   * Generate human-readable explanation
   */
  async generateExplanation(
    decisionLogId: string,
    style: 'technical' | 'simple' | 'detailed' = 'simple'
  ): Promise<string> {
    const evidence = await this.getOrExtractEvidence(decisionLogId);
    const log = await decisionLoggerService.getDecision(decisionLogId);

    if (!log) {
      throw new Error('Decision log not found');
    }

    const topEvidence = evidence.evidenceItems.slice(0, 5);

    const styleInstructions = {
      technical: 'Use technical language appropriate for developers or data scientists.',
      simple: 'Use simple, clear language that anyone can understand. Avoid jargon.',
      detailed: 'Provide a comprehensive explanation with all relevant details.',
    };

    const prompt = `
Generate an explanation for why the AI made this decision.

Style: ${styleInstructions[style]}

Decision Type: ${log.decisionType}
Decision Made: ${log.decision}
Confidence: ${(log.confidence * 100).toFixed(1)}%
${log.reasoning ? `AI Reasoning: ${log.reasoning}` : ''}

Key Evidence:
${topEvidence.map((e) => `- ${e.type}: ${e.content} (relevance: ${(e.relevance * 100).toFixed(0)}%)`).join('\n')}

${log.candidates && log.candidates.length > 1 ? `Other options considered:\n${log.candidates.slice(0, 3).map((c) => `- ${c.option}: ${(c.score * 100).toFixed(1)}%`).join('\n')}` : ''}

Write a ${style === 'simple' ? '2-3 sentence' : style === 'detailed' ? 'detailed paragraph' : '3-4 sentence'} explanation.
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || evidence.summary;
  }

  /**
   * Highlight relevant text spans in input
   */
  async highlightRelevantSpans(
    decisionLogId: string
  ): Promise<Array<{ text: string; relevance: number; start: number; end: number }>> {
    const evidence = await this.getOrExtractEvidence(decisionLogId);

    return evidence.evidenceItems
      .filter((e) => e.type === 'text_span' && e.startIndex !== undefined && e.endIndex !== undefined)
      .map((e) => ({
        text: e.content,
        relevance: e.relevance,
        start: e.startIndex!,
        end: e.endIndex!,
      }));
  }

  // Private extraction methods

  private async extractTextEvidence(
    text: string,
    decision: string,
    decisionType: string
  ): Promise<EvidenceItem[]> {
    const prompt = `
Analyze this text and identify the key phrases that would lead to the decision "${decision}" for a ${decisionType} task.

Text: "${text}"

For each relevant phrase, provide:
1. The exact text
2. Why it's relevant
3. Relevance score (0-1)

Respond in JSON format:
{
  "spans": [
    {
      "text": "<exact span>",
      "explanation": "<why relevant>",
      "relevance": <0-1>
    }
  ]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"spans":[]}');

      return (result.spans || []).map((span: { text: string; explanation: string; relevance: number }) => {
        const startIndex = text.indexOf(span.text);
        return {
          type: 'text_span' as const,
          content: span.text,
          relevance: span.relevance,
          startIndex: startIndex >= 0 ? startIndex : undefined,
          endIndex: startIndex >= 0 ? startIndex + span.text.length : undefined,
          explanation: span.explanation,
        };
      });
    } catch (error) {
      console.error('[EvidenceExtractorService] Text extraction error:', error);
      return [];
    }
  }

  private extractFeatureEvidence(
    features: Record<string, unknown>,
    influenceFactors?: Array<{ factor: string; value: unknown; contribution: number }>
  ): EvidenceItem[] {
    const items: EvidenceItem[] = [];

    // Use influence factors if available
    if (influenceFactors && influenceFactors.length > 0) {
      for (const factor of influenceFactors) {
        items.push({
          type: 'feature',
          content: `${factor.factor}: ${JSON.stringify(factor.value)}`,
          relevance: Math.abs(factor.contribution),
          explanation: `This factor contributed ${(factor.contribution * 100).toFixed(1)}% to the decision`,
        });
      }
    } else {
      // Extract significant features
      for (const [key, value] of Object.entries(features)) {
        if (value !== null && value !== undefined) {
          items.push({
            type: 'feature',
            content: `${key}: ${JSON.stringify(value)}`,
            relevance: 0.5,
            explanation: `Feature "${key}" was considered in the decision`,
          });
        }
      }
    }

    return items;
  }

  private extractCandidateEvidence(
    candidates: Array<{ option: string; score: number; reasoning?: string }>,
    finalDecision: string
  ): EvidenceItem[] {
    return candidates.slice(0, 5).map((candidate) => ({
      type: 'pattern' as const,
      content: candidate.option,
      relevance: candidate.score,
      explanation: candidate.option === finalDecision
        ? `Selected option with score ${(candidate.score * 100).toFixed(1)}%`
        : candidate.reasoning || `Alternative with score ${(candidate.score * 100).toFixed(1)}%`,
    }));
  }

  private async generateSummary(evidenceItems: EvidenceItem[], log: DecisionLog): Promise<string> {
    const topEvidence = evidenceItems.slice(0, 5);

    if (topEvidence.length === 0) {
      return `The AI made the decision "${log.decision}" with ${(log.confidence * 100).toFixed(1)}% confidence.`;
    }

    const prompt = `
Summarize why the AI made this decision in 2-3 sentences for a non-technical user.

Decision Type: ${log.decisionType}
Decision Made: ${log.decision}
Confidence: ${(log.confidence * 100).toFixed(1)}%

Key Evidence:
${topEvidence.map((e) => `- ${e.content}: ${e.explanation}`).join('\n')}

Write a clear, simple explanation.
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || 'Unable to generate summary.';
    } catch {
      return `The AI chose "${log.decision}" based on ${topEvidence.length} key factors with ${(log.confidence * 100).toFixed(1)}% confidence.`;
    }
  }

  private calculateConfidence(evidenceItems: EvidenceItem[]): number {
    if (evidenceItems.length === 0) return 0;

    const avgRelevance = evidenceItems.reduce((sum, e) => sum + e.relevance, 0) / evidenceItems.length;
    const hasHighRelevance = evidenceItems.some((e) => e.relevance > 0.8);

    return Math.min(hasHighRelevance ? avgRelevance + 0.1 : avgRelevance, 1);
  }
}

// Export singleton instance
export const evidenceExtractorService = new EvidenceExtractorService();
