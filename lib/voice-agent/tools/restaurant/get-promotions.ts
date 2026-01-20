/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tool: Get Promotions
 *
 * Retrieves active promotions and special offers from the restaurant.
 * Formats promotions for both voice and messaging channels.
 */

import type {
  ToolDefinition,
  ToolContext,
  PromotionsResult,
  GetPromotionsParams,
} from '../types';
import { formatListForVoice } from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getPromotions: ToolDefinition<GetPromotionsParams> = {
  name: 'get_promotions',
  description: 'Obtiene las promociones activas del restaurante',
  category: 'promotion',

  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filtrar por categoría (comida, bebidas, combos, etc.)',
      },
      activeOnly: {
        type: 'boolean',
        description: 'Solo mostrar promociones activas (default: true)',
        default: true,
      },
      includeExpired: {
        type: 'boolean',
        description: 'Incluir promociones expiradas (para referencia)',
        default: false,
      },
      limit: {
        type: 'integer',
        description: 'Número máximo de promociones a retornar',
        default: 5,
        minimum: 1,
        maximum: 10,
      },
    },
    required: [],
  },

  requiredCapabilities: ['promotions'],
  requiresConfirmation: false,
  enabledFor: ['rest_standard', 'rest_complete'],
  timeout: 8000,

  handler: async (params, context): Promise<PromotionsResult> => {
    const { category, activeOnly = true, includeExpired = false, limit = 5 } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Build query for promotions
      let query = supabase
        .from('promotions')
        .select('id, name, description, discount_type, discount_value, conditions, promo_code, valid_from, valid_until, category, is_active')
        .eq('tenant_id', tenantId)
        .order('is_active', { ascending: false })
        .order('valid_until', { ascending: true })
        .limit(limit);

      // Filter by branch if applicable
      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      // Filter by active status
      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      // Filter by date validity
      const today = new Date().toISOString().split('T')[0];
      if (!includeExpired) {
        query = query.or(`valid_until.gte.${today},valid_until.is.null`);
      }

      // Filter by category if specified
      if (category) {
        query = query.ilike('category', `%${category}%`);
      }

      const { data: promotions, error: queryError } = await query;

      if (queryError) {
        console.error('[GetPromotions] Query error:', queryError);
        // Try fallback to business_knowledge
        return await getPromotionsFromKnowledge(supabase, tenantId, category, limit, locale);
      }

      // If no promotions found, try knowledge base
      if (!promotions || promotions.length === 0) {
        return await getPromotionsFromKnowledge(supabase, tenantId, category, limit, locale);
      }

      // Format promotions for response
      const formattedPromotions = formatPromotions(promotions, locale);

      return {
        success: true,
        voiceMessage: formattedPromotions.voiceMessage,
        data: {
          promotions: formattedPromotions.promotions,
          totalActive: promotions.filter(p => p.is_active).length,
        },
      };
    } catch (error) {
      console.error('[GetPromotions] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble getting our promotions right now. Please try again."
          : 'Tengo problemas para obtener nuestras promociones en este momento. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface PromotionRow {
  id: string;
  name: string;
  description: string | null;
  discount_type: string | null;
  discount_value: number | null;
  conditions: string | null;
  promo_code: string | null;
  valid_from: string | null;
  valid_until: string | null;
  category: string | null;
  is_active: boolean;
}

interface FormattedPromotion {
  id: string;
  name: string;
  description: string;
  discount?: string;
  validUntil?: string;
  conditions?: string;
  code?: string;
}

/**
 * Format promotions for voice/messaging response
 */
function formatPromotions(
  promotions: PromotionRow[],
  locale: string
): { voiceMessage: string; promotions: FormattedPromotion[] } {
  const formattedList: FormattedPromotion[] = [];

  for (const promo of promotions) {
    const formatted: FormattedPromotion = {
      id: promo.id,
      name: promo.name,
      description: promo.description || '',
    };

    // Format discount
    if (promo.discount_type && promo.discount_value) {
      if (promo.discount_type === 'percentage') {
        formatted.discount = `${promo.discount_value}%`;
      } else if (promo.discount_type === 'fixed') {
        formatted.discount = `$${promo.discount_value}`;
      } else if (promo.discount_type === 'bogo') {
        formatted.discount = '2x1';
      }
    }

    // Format validity
    if (promo.valid_until) {
      formatted.validUntil = formatDateSimple(promo.valid_until, locale);
    }

    // Add conditions and code
    if (promo.conditions) {
      formatted.conditions = promo.conditions;
    }
    if (promo.promo_code) {
      formatted.code = promo.promo_code;
    }

    formattedList.push(formatted);
  }

  // Generate voice message
  let voiceMessage: string;

  if (formattedList.length === 0) {
    voiceMessage = locale === 'en'
      ? "We don't have any active promotions at the moment, but we're always working on new offers. Is there anything else I can help you with?"
      : 'No tenemos promociones activas en este momento, pero siempre estamos preparando nuevas ofertas. ¿Hay algo más en que pueda ayudarle?';
  } else if (formattedList.length === 1) {
    const promo = formattedList[0];
    const discountStr = promo.discount ? ` con ${promo.discount} de descuento` : '';
    const validStr = promo.validUntil ? ` válida hasta ${promo.validUntil}` : '';

    voiceMessage = locale === 'en'
      ? `We currently have one promotion: ${promo.name}${discountStr}. ${promo.description}${validStr}. Would you like to take advantage of this offer?`
      : `Actualmente tenemos una promoción: ${promo.name}${discountStr}. ${promo.description}${validStr}. ¿Le gustaría aprovechar esta oferta?`;
  } else {
    // Multiple promotions - list top 3
    const topPromos = formattedList.slice(0, 3);
    const promoNames = topPromos.map(p => {
      const discount = p.discount ? ` (${p.discount})` : '';
      return `${p.name}${discount}`;
    });

    const promoList = formatListForVoice(promoNames, locale);

    voiceMessage = locale === 'en'
      ? `We have ${formattedList.length} active promotions. Here are some highlights: ${promoList}. Would you like more details about any of these?`
      : `Tenemos ${formattedList.length} promociones activas. Algunas de ellas son: ${promoList}. ¿Le gustaría más detalles sobre alguna?`;
  }

  return { voiceMessage, promotions: formattedList };
}

/**
 * Fallback: Get promotions from business_knowledge table
 */
async function getPromotionsFromKnowledge(
  supabase: ToolContext['supabase'],
  tenantId: string,
  category: string | undefined,
  limit: number,
  locale: string
): Promise<PromotionsResult> {
  try {
    const { data: knowledge, error } = await supabase
      .from('business_knowledge')
      .select('content, metadata')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .or('category.eq.promotions,category.eq.ofertas,category.eq.promo')
      .limit(1);

    if (error || !knowledge || knowledge.length === 0) {
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? "We don't have any promotions at the moment. Would you like to hear about our menu instead?"
          : 'No tenemos promociones en este momento. ¿Le gustaría que le cuente sobre nuestro menú?',
        data: {
          promotions: [],
          totalActive: 0,
        },
      };
    }

    // Try to parse promotions from knowledge content
    const entry = knowledge[0];
    const promotions: FormattedPromotion[] = [];

    if (entry.metadata?.promotions && Array.isArray(entry.metadata.promotions)) {
      for (const promo of entry.metadata.promotions.slice(0, limit)) {
        promotions.push({
          id: promo.id || `kb-${Math.random().toString(36).slice(2, 8)}`,
          name: promo.name || 'Promoción especial',
          description: promo.description || '',
          discount: promo.discount,
          validUntil: promo.valid_until,
          conditions: promo.conditions,
          code: promo.code,
        });
      }
    }

    if (promotions.length === 0 && entry.content) {
      // Raw text fallback
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? `Here are our current promotions: ${entry.content.substring(0, 300)}...`
          : `Estas son nuestras promociones actuales: ${entry.content.substring(0, 300)}...`,
        data: {
          promotions: [],
          totalActive: 0,
        },
      };
    }

    const promoNames = promotions.slice(0, 3).map(p => p.name);
    const promoList = formatListForVoice(promoNames, locale);

    return {
      success: true,
      voiceMessage: locale === 'en'
        ? `Our current promotions include: ${promoList}. Would you like more details?`
        : `Nuestras promociones actuales incluyen: ${promoList}. ¿Le gustaría más detalles?`,
      data: {
        promotions,
        totalActive: promotions.length,
      },
    };
  } catch (error) {
    console.error('[GetPromotions] Knowledge base error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voiceMessage: locale === 'en'
        ? "I couldn't retrieve promotion information. Please try again."
        : 'No pude obtener la información de promociones. Por favor intente de nuevo.',
    };
  }
}

/**
 * Format date for display
 */
function formatDateSimple(dateStr: string, locale: string): string {
  try {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
    };

    // Add year if not current year
    const currentYear = new Date().getFullYear();
    if (date.getFullYear() !== currentYear) {
      options.year = 'numeric';
    }

    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX', options);
  } catch {
    return dateStr;
  }
}

export default getPromotions;
