/**
 * TIS TIS Platform - Voice Agent v2.0
 * Common Tool: Transfer to Human
 *
 * Transfers the call to a human agent.
 * Requires confirmation before transfer.
 */

import type {
  ToolDefinition,
  ToolResult,
  TransferToHumanParams,
} from '../types';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const transferToHuman: ToolDefinition<TransferToHumanParams> = {
  name: 'transfer_to_human',
  description: 'Transfiere la llamada a un agente humano',
  category: 'transfer',

  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Razón de la transferencia',
      },
      department: {
        type: 'string',
        enum: ['general', 'sales', 'support', 'billing', 'manager'],
        description: 'Departamento al que transferir',
      },
      priority: {
        type: 'string',
        enum: ['normal', 'high', 'urgent'],
        description: 'Prioridad de la transferencia',
      },
      context: {
        type: 'string',
        description: 'Contexto de la conversación para el agente',
      },
    },
    required: ['reason'],
  },

  requiredCapabilities: ['human_transfer'],
  requiresConfirmation: true,
  enabledFor: [
    'rest_basic',
    'rest_standard',
    'rest_complete',
    'dental_basic',
    'dental_standard',
    'dental_complete',
  ],
  timeout: 5000,

  confirmationMessage: (params) => {
    const deptMap: Record<string, string> = {
      general: 'un agente',
      sales: 'el departamento de ventas',
      support: 'soporte técnico',
      billing: 'facturación',
      manager: 'un supervisor',
    };

    const dept = deptMap[params.department || 'general'] || 'un agente';
    return `Voy a transferirle con ${dept}. ¿Desea que lo transfiera?`;
  },

  handler: async (params, context): Promise<ToolResult> => {
    const { reason, department = 'general', priority = 'normal', context: conversationContext } = params;
    const { supabase, tenantId, branchId, callId, vapiCallId, channel, locale } = context;

    try {
      // Get transfer configuration for tenant
      const { data: transferConfig } = await supabase
        .from('voice_configs')
        .select('transfer_config')
        .eq('tenant_id', tenantId)
        .single();

      const config = transferConfig?.transfer_config as {
        enabled?: boolean;
        departments?: Record<string, { phone?: string; extension?: string }>;
        fallback_phone?: string;
        max_wait_time?: number;
      } | null;

      // Check if transfers are enabled
      if (!config?.enabled) {
        return {
          success: false,
          error: 'Transfers not enabled',
          voiceMessage: locale === 'en'
            ? "I'm sorry, I cannot transfer the call right now. Is there anything else I can help you with?"
            : 'Lo siento, no puedo transferir la llamada en este momento. ¿Hay algo más en que pueda ayudarle?',
        };
      }

      // Get department transfer destination
      let transferDestination = config.departments?.[department]?.phone
        || config.departments?.[department]?.extension
        || config.fallback_phone;

      if (!transferDestination) {
        return {
          success: false,
          error: 'No transfer destination',
          voiceMessage: locale === 'en'
            ? "I'm sorry, I cannot transfer to that department right now. Can I help you with something else?"
            : 'Lo siento, no puedo transferir a ese departamento en este momento. ¿Puedo ayudarle con algo más?',
        };
      }

      // Log the transfer request
      const { data: transferLog, error: logError } = await supabase
        .from('call_transfers')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId || null,
          call_id: callId,
          vapi_call_id: vapiCallId,
          source: channel,
          reason,
          department,
          priority,
          conversation_context: conversationContext || null,
          destination: transferDestination,
          status: 'pending',
          requested_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (logError) {
        console.warn('[TransferToHuman] Log error:', logError);
      }

      // Format department name for voice
      const deptNames: Record<string, { en: string; es: string }> = {
        general: { en: 'an agent', es: 'un agente' },
        sales: { en: 'our sales team', es: 'nuestro equipo de ventas' },
        support: { en: 'technical support', es: 'soporte técnico' },
        billing: { en: 'our billing department', es: 'facturación' },
        manager: { en: 'a supervisor', es: 'un supervisor' },
      };

      const deptName = locale === 'en'
        ? deptNames[department]?.en || 'an agent'
        : deptNames[department]?.es || 'un agente';

      // Generate transfer message based on priority
      let waitMessage = '';
      if (priority === 'urgent') {
        waitMessage = locale === 'en'
          ? 'This is being marked as urgent.'
          : 'Esto se está marcando como urgente.';
      } else if (priority === 'high') {
        waitMessage = locale === 'en'
          ? 'This is being prioritized.'
          : 'Esto se está priorizando.';
      }

      const voiceMessage = locale === 'en'
        ? `I'm transferring you to ${deptName} now. ${waitMessage} Please hold while I connect you.`
        : `Le estoy transfiriendo con ${deptName}. ${waitMessage} Por favor espere mientras lo conecto.`;

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        endCall: false, // Don't end, VAPI will handle the transfer
        data: {
          transferId: transferLog?.id,
          destination: transferDestination,
          department,
          priority,
          action: 'transfer',
          // Special VAPI action to trigger transfer
          vapiAction: {
            type: 'transfer',
            destination: transferDestination,
            message: voiceMessage,
          },
        },
      };
    } catch (error) {
      console.error('[TransferToHuman] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I'm having trouble transferring the call. Please try again or call back."
          : 'Lo siento, tengo problemas para transferir la llamada. Por favor intente de nuevo o llame más tarde.',
      };
    }
  },
};

export default transferToHuman;
