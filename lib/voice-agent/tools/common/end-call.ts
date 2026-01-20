/**
 * TIS TIS Platform - Voice Agent v2.0
 * Common Tool: End Call
 *
 * Gracefully ends the call with a farewell message.
 */

import type {
  ToolDefinition,
  ToolResult,
  EndCallParams,
} from '../types';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const endCall: ToolDefinition<EndCallParams> = {
  name: 'end_call',
  description: 'Finaliza la llamada de manera amable',
  category: 'call',

  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Razón para finalizar (completed, user_request, error)',
      },
      summary: {
        type: 'string',
        description: 'Resumen de lo que se logró en la llamada',
      },
    },
    required: [],
  },

  requiredCapabilities: [],
  requiresConfirmation: false,
  enabledFor: [
    'rest_basic',
    'rest_complete',
    'dental_basic',
    'dental_complete',
  ],
  timeout: 3000,

  handler: async (params, context): Promise<ToolResult> => {
    const { reason = 'completed', summary } = params;
    const { supabase, tenantId, callId, vapiCallId, locale } = context;

    try {
      // Log call completion
      await supabase
        .from('call_logs')
        .update({
          ended_at: new Date().toISOString(),
          end_reason: reason,
          summary: summary || null,
        })
        .eq('tenant_id', tenantId)
        .eq('vapi_call_id', vapiCallId);

      // Generate appropriate farewell based on reason
      let voiceMessage: string;

      switch (reason) {
        case 'user_request':
          voiceMessage = locale === 'en'
            ? 'Thank you for calling. Have a great day!'
            : '¡Gracias por llamar! Que tenga un excelente día.';
          break;

        case 'completed':
          if (summary) {
            voiceMessage = locale === 'en'
              ? `${summary} Thank you for calling. Goodbye!`
              : `${summary} ¡Gracias por llamar! Hasta pronto.`;
          } else {
            voiceMessage = locale === 'en'
              ? 'Is there anything else I can help you with? If not, thank you for calling!'
              : '¿Hay algo más en que pueda ayudarle? Si no, ¡gracias por llamar!';
          }
          break;

        case 'error':
          voiceMessage = locale === 'en'
            ? "I apologize for the inconvenience. Please try calling again. Goodbye."
            : 'Disculpe las molestias. Por favor intente llamar de nuevo. Hasta pronto.';
          break;

        case 'transferred':
          voiceMessage = locale === 'en'
            ? 'Your call has been transferred. Thank you!'
            : '¡Su llamada ha sido transferida. Gracias!';
          break;

        default:
          voiceMessage = locale === 'en'
            ? 'Thank you for calling. Goodbye!'
            : '¡Gracias por llamar! Hasta pronto.';
      }

      return {
        success: true,
        voiceMessage,
        endCall: true,
        data: {
          callId,
          vapiCallId,
          reason,
          endedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[EndCall] Error:', error);

      // Even on error, try to end gracefully
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? 'Thank you for calling. Goodbye!'
          : '¡Gracias por llamar! Hasta pronto.',
        endCall: true,
        data: {
          reason: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },
};

export default endCall;
