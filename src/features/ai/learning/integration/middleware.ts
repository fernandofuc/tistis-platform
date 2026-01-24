// =====================================================
// TIS TIS PLATFORM - AI LEARNING MIDDLEWARE
// Middleware functions for LangGraph nodes
// =====================================================

import type { TISTISAgentStateType, AgentTrace } from '../../state/agent-state';
import { langGraphIntegrationService } from './langgraph-integration.service';

type AgentFunction = (state: TISTISAgentStateType) => Promise<Partial<TISTISAgentStateType>>;

interface MiddlewareOptions {
  logDecisions?: boolean;
  recordMetrics?: boolean;
  updateFeatures?: boolean;
  learnPatterns?: boolean;
}

/**
 * Middleware that wraps agent functions with AI Learning capabilities
 */
export class AILearningMiddleware {
  private options: Required<MiddlewareOptions> = {
    logDecisions: true,
    recordMetrics: true,
    updateFeatures: true,
    learnPatterns: false,
  };

  /**
   * Configure middleware options
   */
  configure(options: Partial<MiddlewareOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Wrap an agent function with AI Learning middleware
   */
  wrap(agentName: string, agentFn: AgentFunction): AgentFunction {
    return async (state: TISTISAgentStateType): Promise<Partial<TISTISAgentStateType>> => {
      const startTime = Date.now();

      // Extract context
      const context = {
        tenantId: state.tenant?.tenant_id || '',
        conversationId: state.conversation?.conversation_id || '',
        leadId: state.lead?.lead_id,
        channel: state.channel || 'whatsapp',
      };

      // Skip if no tenant
      if (!context.tenantId) {
        return agentFn(state);
      }

      try {
        // Execute agent
        const result = await agentFn(state);
        const latencyMs = Date.now() - startTime;

        // Record metrics
        if (this.options.recordMetrics) {
          await langGraphIntegrationService.recordMetrics(context, {
            latencyMs,
            messageLength: state.current_message?.length,
            intentDetected: state.detected_intent,
            wasEscalated: result.control?.should_escalate,
          });
        }

        // Log decision if response was generated
        if (this.options.logDecisions && result.final_response) {
          await langGraphIntegrationService.logDecision(state, context, {
            decisionType: 'response_generation',
            decision: result.final_response.substring(0, 200),
            confidence: 0.9,
            latencyMs,
          });
        }

        // Update features
        if (this.options.updateFeatures) {
          await langGraphIntegrationService.updateFeatures(context, {
            ...state,
            ...result,
          } as TISTISAgentStateType);
        }

        // Learn pattern from successful response
        if (this.options.learnPatterns && result.final_response && !result.control?.should_escalate) {
          await langGraphIntegrationService.learnPattern(context, {
            contentText: state.current_message,
            intent: state.detected_intent,
            sourceType: 'message',
            tags: [agentName],
          });
        }

        // Add agent trace with learning info
        const trace: AgentTrace = {
          agent_name: `${agentName}[ai_learning]`,
          timestamp: new Date().toISOString(),
          input_summary: state.current_message?.substring(0, 100) || '',
          output_summary: result.final_response?.substring(0, 100) || '',
          decision: result.next_agent || 'end',
          duration_ms: latencyMs,
        };

        return {
          ...result,
          agent_trace: [trace],
        };
      } catch (error) {
        console.error(`[AILearningMiddleware] Error in ${agentName}:`, error);
        throw error;
      }
    };
  }

  /**
   * Create pre-processing middleware (enriches context before agent runs)
   */
  createPreProcessor(): AgentFunction {
    return async (state: TISTISAgentStateType): Promise<Partial<TISTISAgentStateType>> => {
      const context = {
        tenantId: state.tenant?.tenant_id || '',
        conversationId: state.conversation?.conversation_id || '',
        leadId: state.lead?.lead_id,
        channel: state.channel || 'whatsapp',
      };

      if (!context.tenantId) {
        return {};
      }

      try {
        const enriched = await langGraphIntegrationService.enrichContext(state, context);

        // Add enriched data to metadata
        return {
          metadata: {
            ...state.metadata,
            ai_learning: {
              similarPatterns: enriched.similarPatterns,
              leadFeatures: enriched.leadFeatures,
              conversationFeatures: enriched.conversationFeatures,
              activeModel: enriched.activeModel,
              abTestVariant: enriched.abTestVariant,
            },
          },
          // Use recommended model if available
          model_used: enriched.activeModel?.modelId || state.model_used,
        };
      } catch (error) {
        console.error('[AILearningMiddleware] Pre-processing error:', error);
        return {};
      }
    };
  }

  /**
   * Create post-processing middleware (runs after all agents)
   */
  createPostProcessor(): AgentFunction {
    return async (state: TISTISAgentStateType): Promise<Partial<TISTISAgentStateType>> => {
      const context = {
        tenantId: state.tenant?.tenant_id || '',
        conversationId: state.conversation?.conversation_id || '',
        leadId: state.lead?.lead_id,
        channel: state.channel || 'whatsapp',
      };

      if (!context.tenantId) {
        return {};
      }

      // Calculate total processing time
      const totalLatency = state.agent_trace.reduce((sum, t) => sum + t.duration_ms, 0);

      // Record overall metrics
      await langGraphIntegrationService.recordMetrics(context, {
        latencyMs: totalLatency,
        inputTokens: Math.floor(state.tokens_used * 0.3),
        outputTokens: Math.floor(state.tokens_used * 0.7),
        wasEscalated: state.control.should_escalate,
      });

      return {};
    };
  }
}

// Export singleton instance
export const aiLearningMiddleware = new AILearningMiddleware();
