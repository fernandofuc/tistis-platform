/**
 * TIS TIS Platform - Voice Agent v2.2
 * Secure Booking Tool: Release Secure Hold
 *
 * Releases an active hold, making the slot available again.
 * Used when customer cancels or conversation ends without confirmation.
 */

import type {
  ToolDefinition,
  ToolContext,
  ReleaseSecureHoldParams,
  ReleaseHoldResult,
  HoldStatus,
} from '../types';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const releaseSecureHold: ToolDefinition<ReleaseSecureHoldParams> = {
  name: 'release_secure_hold',
  description: 'Libera un hold activo para que el horario esté disponible nuevamente',
  category: 'secure_booking',

  parameters: {
    type: 'object',
    properties: {
      holdId: {
        type: 'string',
        description: 'ID del hold a liberar',
      },
      reason: {
        type: 'string',
        description: 'Razón de la liberación',
        enum: ['customer_cancelled', 'timeout', 'staff_cancelled', 'other'],
      },
    },
    required: ['holdId'],
  },

  requiredCapabilities: ['booking_holds', 'secure_booking'],
  requiresConfirmation: false,
  enabledFor: ['dental_basic', 'dental_standard', 'dental_complete', 'rest_basic', 'rest_standard', 'rest_complete'],
  timeout: 10000,

  handler: async (params, context): Promise<ReleaseHoldResult> => {
    const { holdId, reason = 'other' } = params;
    const { supabase, tenantId, locale } = context;

    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(holdId)) {
        return {
          success: false,
          error: 'Invalid hold ID format',
          voiceMessage: locale === 'en'
            ? 'There was an issue with the hold reference. Please try again.'
            : 'Hubo un problema con la referencia del hold. Por favor intente de nuevo.',
        };
      }

      // Get current hold status
      const { data: hold, error: fetchError } = await supabase
        .from('booking_holds')
        .select('id, status, tenant_id')
        .eq('id', holdId)
        .single();

      if (fetchError || !hold) {
        return {
          success: false,
          error: 'Hold not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find that hold. It may have already expired."
            : 'No encontré ese hold. Es posible que ya haya expirado.',
        };
      }

      // Verify tenant ownership
      if (hold.tenant_id !== tenantId) {
        return {
          success: false,
          error: 'Unauthorized',
          voiceMessage: locale === 'en'
            ? 'Unable to release that hold.'
            : 'No se puede liberar ese hold.',
        };
      }

      const previousStatus = hold.status as HoldStatus;

      // Check if already released or converted
      if (previousStatus !== 'active') {
        const statusMessage = previousStatus === 'converted'
          ? (locale === 'en' ? 'That hold has already been converted to a booking.' : 'Ese hold ya fue convertido a una reservación.')
          : (locale === 'en' ? 'That hold has already been released.' : 'Ese hold ya fue liberado.');

        return {
          success: true,
          voiceMessage: statusMessage,
          data: {
            released: false,
            holdId,
            previousStatus,
          },
        };
      }

      // Release the hold
      const { error: updateError } = await supabase
        .from('booking_holds')
        .update({
          status: 'released',
          released_at: new Date().toISOString(),
          release_reason: reason,
        })
        .eq('id', holdId)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('[ReleaseSecureHold] Update error:', updateError);
        return {
          success: false,
          error: updateError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem releasing the hold. Please try again.'
            : 'Hubo un problema al liberar el hold. Por favor intente de nuevo.',
        };
      }

      return {
        success: true,
        voiceMessage: locale === 'en'
          ? 'The time slot has been released and is now available.'
          : 'El horario ha sido liberado y ahora está disponible.',
        data: {
          released: true,
          holdId,
          previousStatus,
        },
      };
    } catch (error) {
      console.error('[ReleaseSecureHold] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't release the hold. Please try again."
          : 'Lo siento, no pude liberar el hold. Por favor intente de nuevo.',
      };
    }
  },
};

export default releaseSecureHold;
