// =====================================================
// TIS TIS PLATFORM - AI Learning Integration
// Sprint 5: Setup Assistant feedback loop and learning
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import type { SetupModule } from '../types';

// =====================================================
// TYPES
// =====================================================

export interface SetupFeedback {
  conversationId: string;
  messageId: string;
  tenantId: string;
  rating: 'positive' | 'negative';
  feedback?: string;
  actionsTaken?: Array<{ type: string; success: boolean }>;
}

export interface SetupPattern {
  intent: string;
  successRate: number;
  commonFollowUps: string[]; // TODO: Implement follow-up tracking in future iteration
  avgActionsPerMessage: number;
}

export interface SetupInsight {
  type: string;
  title: string;
  description: string;
  recommendation?: string;
  confidence: number;
}

// =====================================================
// AI LEARNING INTEGRATION CLASS
// =====================================================

export class AILearningIntegration {
  private supabase = createServerClient();

  // ======================
  // RECORD FEEDBACK
  // ======================

  /**
   * Record feedback for a setup assistant interaction
   */
  async recordFeedback(feedback: SetupFeedback): Promise<void> {
    try {
      // Store in AI learning queue for analysis
      await this.supabase.from('ai_learning_queue').insert({
        tenant_id: feedback.tenantId,
        conversation_id: feedback.conversationId,
        message_id: feedback.messageId,
        message_content: feedback.feedback || '',
        message_role: 'lead', // User feedback
        channel: 'setup_assistant',
        detected_intent: feedback.rating === 'positive' ? 'positive_feedback' : 'negative_feedback',
        detected_signals: {
          source: 'setup_assistant',
          rating: feedback.rating,
          feedback: feedback.feedback,
          actionsTaken: feedback.actionsTaken,
        },
        status: 'pending',
      });

      console.log('[AILearningIntegration] Feedback recorded:', {
        conversationId: feedback.conversationId,
        rating: feedback.rating,
      });
    } catch (error) {
      console.error('[AILearningIntegration] Error recording feedback:', error);
    }
  }

  // ======================
  // GET SETUP PATTERNS
  // ======================

  /**
   * Get setup patterns for a tenant (what works well)
   */
  async getSetupPatterns(tenantId: string): Promise<SetupPattern[]> {
    try {
      // Get recent successful interactions from setup assistant
      const { data: interactions } = await this.supabase
        .from('setup_assistant_messages')
        .select('content, actions_taken')
        .eq('tenant_id', tenantId)
        .eq('role', 'assistant')
        .not('actions_taken', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!interactions || interactions.length === 0) {
        return [];
      }

      // Aggregate patterns
      const patterns = new Map<string, { success: number; total: number; followUps: string[] }>();

      for (const interaction of interactions) {
        const actions = interaction.actions_taken as Array<{ type: string; status: string; module?: string }>;

        if (!actions || !Array.isArray(actions)) continue;

        for (const action of actions) {
          const key = `${action.module || 'general'}/${action.type}`;
          const existing = patterns.get(key) || { success: 0, total: 0, followUps: [] };

          existing.total++;
          if (action.status === 'success') {
            existing.success++;
          }

          patterns.set(key, existing);
        }
      }

      return Array.from(patterns.entries()).map(([intent, data]) => ({
        intent,
        successRate: data.total > 0 ? data.success / data.total : 0,
        commonFollowUps: data.followUps.slice(0, 5),
        avgActionsPerMessage: data.total / Math.max(interactions.length, 1),
      }));
    } catch (error) {
      console.error('[AILearningIntegration] Error getting patterns:', error);
      return [];
    }
  }

  // ======================
  // UPDATE BUSINESS INSIGHTS
  // ======================

  /**
   * Update business insights based on setup completion
   */
  async updateBusinessInsights(
    tenantId: string,
    setupProgress: Record<SetupModule, string>
  ): Promise<void> {
    try {
      const completedModules = Object.entries(setupProgress)
        .filter(([_, status]) => status === 'completed')
        .map(([module]) => module);

      const totalModules = Object.keys(setupProgress).length;
      const completionPercentage = totalModules > 0
        ? Math.round((completedModules.length / totalModules) * 100)
        : 0;

      // Upsert business insight for setup completion
      await this.supabase.from('ai_business_insights').upsert(
        {
          tenant_id: tenantId,
          insight_type: 'custom',
          title: 'Progreso de configuración con asistente IA',
          description: `El asistente ha completado ${completedModules.length} de ${totalModules} módulos de configuración (${completionPercentage}%).`,
          recommendation: completionPercentage < 100
            ? 'Continúa configurando los módulos restantes para aprovechar al máximo la plataforma.'
            : 'Configuración completa. Tu sistema está listo para operar.',
          confidence_score: 1.0,
          impact_score: completionPercentage < 50 ? 0.8 : 0.5,
          data_points: completedModules.length,
          is_active: true,
          is_actionable: completionPercentage < 100,
          metadata: {
            source: 'setup_assistant',
            completedModules,
            completionPercentage,
            lastUpdated: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,insight_type',
        }
      );

      console.log('[AILearningIntegration] Business insights updated:', {
        tenantId,
        completionPercentage,
      });
    } catch (error) {
      console.error('[AILearningIntegration] Error updating insights:', error);
    }
  }

  // ======================
  // GET INSIGHTS
  // ======================

  /**
   * Get active insights for a tenant
   */
  async getInsights(tenantId: string, limit = 5): Promise<SetupInsight[]> {
    try {
      const { data: insights } = await this.supabase
        .from('ai_business_insights')
        .select('insight_type, title, description, recommendation, confidence_score')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
        .limit(limit);

      if (!insights) return [];

      return insights.map(i => ({
        type: i.insight_type,
        title: i.title,
        description: i.description,
        recommendation: i.recommendation,
        confidence: i.confidence_score,
      }));
    } catch (error) {
      console.error('[AILearningIntegration] Error getting insights:', error);
      return [];
    }
  }

  // ======================
  // RECORD SETUP COMPLETION
  // ======================

  /**
   * Record when a setup module is completed
   */
  async recordModuleCompletion(
    tenantId: string,
    module: SetupModule,
    actionsCount: number
  ): Promise<void> {
    try {
      // Add to learning queue for pattern analysis
      await this.supabase.from('ai_learning_queue').insert({
        tenant_id: tenantId,
        message_content: `Module ${module} completed`,
        message_role: 'assistant',
        channel: 'setup_assistant',
        detected_intent: 'module_completion',
        detected_signals: {
          source: 'setup_assistant',
          module,
          actionsCount,
          completedAt: new Date().toISOString(),
        },
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AILearningIntegration] Error recording module completion:', error);
    }
  }

  // ======================
  // GET LEARNING STATUS
  // ======================

  /**
   * Check if AI learning is enabled for a tenant
   */
  async isLearningEnabled(tenantId: string): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('ai_learning_config')
        .select('learning_enabled')
        .eq('tenant_id', tenantId)
        .single();

      return data?.learning_enabled || false;
    } catch {
      return false;
    }
  }
}

// Singleton instance export
export const aiLearningIntegration = new AILearningIntegration();
