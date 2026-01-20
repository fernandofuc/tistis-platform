/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tool: Get Menu
 *
 * Retrieves menu items from the restaurant's knowledge base.
 * Formats items for voice output with optional prices.
 */

import type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  GetMenuParams,
} from '../types';
import {
  formatMenuForVoice,
  formatMenuByCategoryForVoice,
  formatPriceSimple,
  type MenuItem,
} from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getMenu: ToolDefinition<GetMenuParams> = {
  name: 'get_menu',
  description: 'Obtiene información del menú del restaurante',
  category: 'info',

  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Categoría del menú (entradas, platos fuertes, postres, bebidas, etc.)',
      },
      searchTerm: {
        type: 'string',
        description: 'Término de búsqueda para encontrar un platillo específico',
      },
      includePrices: {
        type: 'boolean',
        description: 'Si incluir precios en la respuesta',
        default: true,
      },
      limit: {
        type: 'integer',
        description: 'Número máximo de items a retornar',
        default: 5,
        minimum: 1,
        maximum: 10,
      },
    },
    required: [],
  },

  requiredCapabilities: ['menu_info'],
  requiresConfirmation: false,
  enabledFor: ['rest_standard', 'rest_complete'],
  timeout: 10000,

  handler: async (params, context): Promise<ToolResult> => {
    const { category, searchTerm, includePrices = true, limit = 5 } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // First try to get from menu_items table
      let query = supabase
        .from('menu_items')
        .select('id, name, description, price, category, is_available')
        .eq('tenant_id', tenantId)
        .eq('is_available', true);

      if (branchId) {
        // If branch-specific menu exists
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      if (category) {
        query = query.ilike('category', `%${category}%`);
      }

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      query = query.order('category').limit(limit);

      const { data: menuItems, error } = await query;

      if (error) {
        console.warn('[GetMenu] Query error, falling back to knowledge base:', error);
        return await getMenuFromKnowledgeBase(supabase, tenantId, category, searchTerm, includePrices, limit, locale);
      }

      if (!menuItems || menuItems.length === 0) {
        // Try knowledge base fallback
        return await getMenuFromKnowledgeBase(supabase, tenantId, category, searchTerm, includePrices, limit, locale);
      }

      // Format for voice
      const items: MenuItem[] = menuItems.map(item => ({
        name: item.name,
        price: item.price,
        description: item.description,
        category: item.category,
      }));

      let voiceMessage: string;

      if (category) {
        voiceMessage = formatMenuResponse(items, category, includePrices, locale);
      } else if (searchTerm) {
        voiceMessage = formatSearchResponse(items, searchTerm, includePrices, locale);
      } else {
        voiceMessage = formatGeneralMenuResponse(items, includePrices, locale);
      }

      return {
        success: true,
        voiceMessage,
        data: {
          items,
          totalItems: items.length,
          category: category || null,
          searchTerm: searchTerm || null,
        },
      };
    } catch (error) {
      console.error('[GetMenu] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm having trouble accessing the menu right now. Please try again."
          : 'Tengo problemas para acceder al menú en este momento. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// KNOWLEDGE BASE FALLBACK
// =====================================================

/**
 * Get menu from knowledge base (business_knowledge table)
 */
async function getMenuFromKnowledgeBase(
  supabase: ToolContext['supabase'],
  tenantId: string,
  category: string | undefined,
  searchTerm: string | undefined,
  includePrices: boolean,
  limit: number,
  locale: string
): Promise<ToolResult> {
  try {
    let query = supabase
      .from('business_knowledge')
      .select('content, metadata')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .eq('category', 'menu');

    const { data: knowledge, error } = await query;

    if (error || !knowledge || knowledge.length === 0) {
      return {
        success: true,
        voiceMessage: locale === 'en'
          ? "I don't have detailed menu information available. Would you like me to tell you about our specialties?"
          : 'No tengo información detallada del menú disponible. ¿Le gustaría que le cuente sobre nuestras especialidades?',
        data: {
          items: [],
          totalItems: 0,
        },
      };
    }

    // Parse menu items from knowledge base content
    const items: MenuItem[] = [];

    for (const entry of knowledge) {
      // Try to parse structured content
      if (entry.metadata?.items && Array.isArray(entry.metadata.items)) {
        for (const item of entry.metadata.items) {
          if (items.length >= limit) break;

          // Filter by category if specified
          if (category && item.category && !item.category.toLowerCase().includes(category.toLowerCase())) {
            continue;
          }

          // Filter by search term if specified
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            if (!item.name?.toLowerCase().includes(searchLower) &&
                !item.description?.toLowerCase().includes(searchLower)) {
              continue;
            }
          }

          items.push({
            name: item.name,
            price: item.price,
            description: item.description,
            category: item.category,
          });
        }
      } else {
        // Use raw content if no structured data
        // This is a fallback for unstructured menu descriptions
        if (items.length === 0) {
          const content = entry.content || '';
          // Return a summary if we can't parse items
          return {
            success: true,
            voiceMessage: locale === 'en'
              ? `Here's what I know about our menu: ${content.substring(0, 200)}...`
              : `Esto es lo que sé sobre nuestro menú: ${content.substring(0, 200)}...`,
            data: {
              rawContent: content,
              items: [],
            },
          };
        }
      }
    }

    if (items.length === 0) {
      const noResultsMessage = searchTerm
        ? (locale === 'en'
            ? `I couldn't find anything matching "${searchTerm}" on the menu. Would you like to try a different search?`
            : `No encontré nada con "${searchTerm}" en el menú. ¿Le gustaría buscar otra cosa?`)
        : (locale === 'en'
            ? "I don't have items in that category. Let me tell you what we do have."
            : 'No tengo artículos en esa categoría. Déjeme contarle lo que sí tenemos.');

      return {
        success: true,
        voiceMessage: noResultsMessage,
        data: {
          items: [],
          totalItems: 0,
        },
      };
    }

    const voiceMessage = category
      ? formatMenuResponse(items, category, includePrices, locale)
      : formatGeneralMenuResponse(items, includePrices, locale);

    return {
      success: true,
      voiceMessage,
      data: {
        items,
        totalItems: items.length,
      },
    };
  } catch (error) {
    console.error('[GetMenu] Knowledge base error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voiceMessage: locale === 'en'
        ? "I couldn't retrieve the menu information. Please try again."
        : 'No pude obtener la información del menú. Por favor intente de nuevo.',
    };
  }
}

// =====================================================
// RESPONSE FORMATTERS
// =====================================================

/**
 * Format menu response for a specific category
 */
function formatMenuResponse(
  items: MenuItem[],
  category: string,
  includePrices: boolean,
  locale: string
): string {
  const formattedItems = formatMenuForVoice(items, { includePrices, locale, maxItems: 5 });

  if (locale === 'en') {
    return `In our ${category} section, we have: ${formattedItems}. Would you like more details on any of these?`;
  }

  return `En nuestra sección de ${category}, tenemos: ${formattedItems}. ¿Le gustaría más detalles de alguno?`;
}

/**
 * Format search results response
 */
function formatSearchResponse(
  items: MenuItem[],
  searchTerm: string,
  includePrices: boolean,
  locale: string
): string {
  if (items.length === 1) {
    const item = items[0];
    const priceStr = includePrices && item.price ? ` ${formatPriceSimple(item.price)}` : '';

    if (locale === 'en') {
      return `I found ${item.name}${priceStr}. ${item.description || ''} Would you like to order this?`;
    }

    return `Encontré ${item.name}${priceStr}. ${item.description || ''} ¿Le gustaría ordenarlo?`;
  }

  const formattedItems = formatMenuForVoice(items, { includePrices, locale, maxItems: 4 });

  if (locale === 'en') {
    return `I found these options related to "${searchTerm}": ${formattedItems}. Which one interests you?`;
  }

  return `Encontré estas opciones relacionadas con "${searchTerm}": ${formattedItems}. ¿Cuál le interesa?`;
}

/**
 * Format general menu response
 */
function formatGeneralMenuResponse(
  items: MenuItem[],
  includePrices: boolean,
  locale: string
): string {
  // Group by category if available
  const hasCategories = items.some(item => item.category);

  if (hasCategories) {
    const formatted = formatMenuByCategoryForVoice(items, { includePrices, locale, maxPerCategory: 2 });

    if (locale === 'en') {
      return `Here are some highlights from our menu: ${formatted}. Would you like to hear more about any section?`;
    }

    return `Estos son algunos de los destacados de nuestro menú: ${formatted}. ¿Le gustaría escuchar más de alguna sección?`;
  }

  const formattedItems = formatMenuForVoice(items, { includePrices, locale, maxItems: 5 });

  if (locale === 'en') {
    return `Some of our options include: ${formattedItems}. What sounds good to you?`;
  }

  return `Algunas de nuestras opciones incluyen: ${formattedItems}. ¿Qué le suena bien?`;
}

export default getMenu;
