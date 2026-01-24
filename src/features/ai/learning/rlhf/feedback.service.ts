// =====================================================
// TIS TIS PLATFORM - FEEDBACK SERVICE
// Handles user feedback collection for RLHF
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { Feedback, FeedbackType, FeedbackDimension } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SubmitFeedbackParams {
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  leadId?: string;
  feedbackType: FeedbackType['type'];
  rating?: number;
  isPositive?: boolean;
  feedbackText?: string;
  correctionText?: string;
  dimension?: FeedbackDimension['dimension'];
  aiResponseText?: string;
  aiModelUsed?: string;
  aiPromptVariantId?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

interface FeedbackStats {
  total: number;
  positiveCount: number;
  negativeCount: number;
  positiveRate: number;
  avgRating?: number;
  byDimension: Record<string, { positive: number; negative: number; rate: number }>;
}

export class FeedbackService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Submit user feedback for an AI response
   */
  async submitFeedback(params: SubmitFeedbackParams): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_feedback')
      .insert({
        tenant_id: params.tenantId,
        conversation_id: params.conversationId,
        message_id: params.messageId,
        lead_id: params.leadId,
        feedback_type: params.feedbackType,
        rating: params.rating,
        is_positive: params.isPositive ?? this.inferPositive(params),
        feedback_text: params.feedbackText,
        correction_text: params.correctionText,
        dimension: params.dimension || 'overall',
        ai_response_text: params.aiResponseText,
        ai_model_used: params.aiModelUsed,
        ai_prompt_variant_id: params.aiPromptVariantId,
        channel: params.channel || 'whatsapp',
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[FeedbackService] Error submitting feedback:', error);
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }

    // Update prompt variant stats if applicable
    if (params.aiPromptVariantId) {
      await this.updateVariantStats(
        params.aiPromptVariantId,
        params.isPositive ?? this.inferPositive(params)
      );
    }

    return data.id;
  }

  /**
   * Submit thumbs up feedback (simplified)
   */
  async submitThumbsUp(
    tenantId: string,
    messageId: string,
    options?: {
      conversationId?: string;
      leadId?: string;
      aiResponseText?: string;
      aiModelUsed?: string;
      channel?: string;
    }
  ): Promise<string> {
    return this.submitFeedback({
      tenantId,
      messageId,
      feedbackType: 'thumbs_up',
      isPositive: true,
      ...options,
    });
  }

  /**
   * Submit thumbs down feedback (simplified)
   */
  async submitThumbsDown(
    tenantId: string,
    messageId: string,
    options?: {
      conversationId?: string;
      leadId?: string;
      feedbackText?: string;
      correctionText?: string;
      aiResponseText?: string;
      aiModelUsed?: string;
      channel?: string;
    }
  ): Promise<string> {
    return this.submitFeedback({
      tenantId,
      messageId,
      feedbackType: 'thumbs_down',
      isPositive: false,
      ...options,
    });
  }

  /**
   * Submit rating feedback (1-5 scale)
   */
  async submitRating(
    tenantId: string,
    messageId: string,
    rating: number,
    options?: {
      conversationId?: string;
      leadId?: string;
      dimension?: FeedbackDimension['dimension'];
      feedbackText?: string;
      aiResponseText?: string;
      aiModelUsed?: string;
      channel?: string;
    }
  ): Promise<string> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    return this.submitFeedback({
      tenantId,
      messageId,
      feedbackType: 'rating',
      rating,
      isPositive: rating >= 4,
      ...options,
    });
  }

  /**
   * Get feedback for a conversation
   */
  async getConversationFeedback(conversationId: string): Promise<Feedback[]> {
    const { data, error } = await this.supabase
      .from('ai_feedback')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FeedbackService] Error getting conversation feedback:', error);
      throw new Error(`Failed to get feedback: ${error.message}`);
    }

    return (data || []).map(this.mapFeedback);
  }

  /**
   * Get feedback statistics for a tenant
   */
  async getFeedbackStats(
    tenantId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      channel?: string;
    }
  ): Promise<FeedbackStats> {
    let query = this.supabase
      .from('ai_feedback')
      .select('is_positive, rating, dimension')
      .eq('tenant_id', tenantId);

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lt('created_at', options.endDate.toISOString());
    }
    if (options?.channel) {
      query = query.eq('channel', options.channel);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FeedbackService] Error getting feedback stats:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    const feedback = data || [];
    const total = feedback.length;
    const positiveCount = feedback.filter((f) => f.is_positive).length;
    const negativeCount = feedback.filter((f) => f.is_positive === false).length;
    const ratings = feedback.filter((f) => f.rating != null).map((f) => f.rating);

    // Group by dimension
    const byDimension: Record<string, { positive: number; negative: number; rate: number }> = {};
    for (const f of feedback) {
      const dim = f.dimension || 'overall';
      if (!byDimension[dim]) {
        byDimension[dim] = { positive: 0, negative: 0, rate: 0 };
      }
      if (f.is_positive) {
        byDimension[dim].positive++;
      } else if (f.is_positive === false) {
        byDimension[dim].negative++;
      }
    }

    // Calculate rates
    for (const dim of Object.keys(byDimension)) {
      const dimTotal = byDimension[dim].positive + byDimension[dim].negative;
      byDimension[dim].rate = dimTotal > 0 ? byDimension[dim].positive / dimTotal : 0;
    }

    return {
      total,
      positiveCount,
      negativeCount,
      positiveRate: total > 0 ? positiveCount / total : 0,
      avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
      byDimension,
    };
  }

  /**
   * Get recent feedback for review
   */
  async getRecentFeedback(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ feedback: Feedback[]; total: number }> {
    const { data, count, error } = await this.supabase
      .from('ai_feedback')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[FeedbackService] Error getting recent feedback:', error);
      throw new Error(`Failed to get feedback: ${error.message}`);
    }

    return {
      feedback: (data || []).map(this.mapFeedback),
      total: count || 0,
    };
  }

  /**
   * Get negative feedback for improvement analysis
   */
  async getNegativeFeedback(
    tenantId: string,
    options?: {
      limit?: number;
      startDate?: Date;
      withCorrections?: boolean;
    }
  ): Promise<Feedback[]> {
    let query = this.supabase
      .from('ai_feedback')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_positive', false)
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.withCorrections) {
      query = query.not('correction_text', 'is', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FeedbackService] Error getting negative feedback:', error);
      throw new Error(`Failed to get feedback: ${error.message}`);
    }

    return (data || []).map(this.mapFeedback);
  }

  // Private helpers

  private inferPositive(params: SubmitFeedbackParams): boolean {
    if (params.feedbackType === 'thumbs_up') return true;
    if (params.feedbackType === 'thumbs_down') return false;
    if (params.rating != null) return params.rating >= 4;
    return true; // Default to positive for text feedback without other signals
  }

  private async updateVariantStats(variantId: string, isPositive: boolean): Promise<void> {
    const field = isPositive ? 'positive_feedback' : 'negative_feedback';

    const { error } = await this.supabase.rpc('increment_variant_feedback', {
      p_variant_id: variantId,
      p_field: field,
    });

    if (error) {
      // Non-critical, just log
      console.warn('[FeedbackService] Failed to update variant stats:', error);
    }
  }

  private mapFeedback(row: Record<string, unknown>): Feedback {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      conversationId: row.conversation_id as string | undefined,
      messageId: row.message_id as string | undefined,
      leadId: row.lead_id as string | undefined,
      feedbackType: row.feedback_type as FeedbackType['type'],
      rating: row.rating as number | undefined,
      isPositive: row.is_positive as boolean | undefined,
      feedbackText: row.feedback_text as string | undefined,
      correctionText: row.correction_text as string | undefined,
      dimension: row.dimension as FeedbackDimension['dimension'] | undefined,
      aiResponseText: row.ai_response_text as string | undefined,
      aiModelUsed: row.ai_model_used as string | undefined,
      aiPromptVariantId: row.ai_prompt_variant_id as string | undefined,
      channel: row.channel as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();
