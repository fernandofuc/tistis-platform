// =====================================================
// TIS TIS PLATFORM - Restaurant Ordering Agent
// Agente especializado en pedidos pickup/delivery
// =====================================================

import { BaseAgent, type AgentResult, formatBranchesForPrompt } from './base.agent';
import type { TISTISAgentStateType, OrderResult } from '../../state';
import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================

interface ParsedOrderItem {
  menu_item_id?: string;
  name: string;
  quantity: number;
  matched_confidence: number;
  unit_price?: number;
  modifiers?: string[];
  special_instructions?: string;
}

interface ParsedOrder {
  items: ParsedOrderItem[];
  order_type: 'pickup' | 'delivery' | 'dine_in';
  pickup_time?: string;
  special_instructions?: string;
  confidence_score: number;
  needs_clarification: boolean;
  clarification_question?: string;
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Parsea un mensaje para extraer items del pedido
 * Usa fuzzy matching con el menú disponible
 */
function parseOrderFromMessage(
  message: string,
  menuItems: NonNullable<TISTISAgentStateType['business_context']>['menu_items']
): ParsedOrder {
  const items: ParsedOrderItem[] = [];
  const messageLower = message.toLowerCase();

  // No menu items available
  if (!menuItems || menuItems.length === 0) {
    return {
      items: [],
      order_type: 'pickup',
      confidence_score: 0,
      needs_clarification: true,
      clarification_question: 'Lo siento, no tengo acceso al menú en este momento. ¿Podrías intentar más tarde?',
    };
  }

  // Detect order type
  let orderType: 'pickup' | 'delivery' | 'dine_in' = 'pickup';
  if (messageLower.includes('domicilio') || messageLower.includes('delivery') || messageLower.includes('enviar')) {
    orderType = 'delivery';
  } else if (messageLower.includes('mesa') || messageLower.includes('comer aquí') || messageLower.includes('comer aqui')) {
    orderType = 'dine_in';
  }

  // Extract pickup time mentions
  let pickupTime: string | undefined;
  const timePatterns = [
    /(?:a las?|para las?)\s*(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|hrs|horas))?)/i,
    /(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|hrs|horas)))/i,
    /(?:en|dentro de)\s*(\d+)\s*(?:minutos?|min)/i,
  ];

  for (const pattern of timePatterns) {
    const match = message.match(pattern);
    if (match) {
      pickupTime = match[1];
      break;
    }
  }

  // Extract quantities and items
  // Common patterns: "2 tacos", "quiero una hamburguesa", "3 órdenes de nachos"
  const quantityPatterns = [
    /(\d+)\s+(?:órdenes?\s+de\s+)?(.+?)(?:,|y\s|$)/gi,
    /(?:una?|dos?|tres|cuatro|cinco)\s+(.+?)(?:,|y\s|$)/gi,
    /(?:quiero|me das?|dame|pedimos?)\s+(?:una?|el|la|los|las)?\s*(.+?)(?:,|y\s|por favor|$)/gi,
  ];

  const numberWords: Record<string, number> = {
    'un': 1, 'una': 1, 'uno': 1,
    'dos': 2,
    'tres': 3,
    'cuatro': 4,
    'cinco': 5,
    'seis': 6,
    'siete': 7,
    'ocho': 8,
    'nueve': 9,
    'diez': 10,
  };

  // Try to match items from the menu
  for (const menuItem of menuItems) {
    const itemNameLower = menuItem.name.toLowerCase();
    const itemWords = itemNameLower.split(/\s+/);

    // Check if message contains this menu item
    let matchScore = 0;
    for (const word of itemWords) {
      if (word.length > 2 && messageLower.includes(word)) {
        matchScore++;
      }
    }

    // Require at least partial match
    if (matchScore > 0 && matchScore >= Math.ceil(itemWords.length * 0.5)) {
      // Try to extract quantity
      let quantity = 1;

      // Check for number before item name
      for (const [word, num] of Object.entries(numberWords)) {
        if (messageLower.includes(`${word} ${itemWords[0]}`) || messageLower.includes(`${word} ${menuItem.name.toLowerCase()}`)) {
          quantity = num;
          break;
        }
      }

      // Check for digit before item name
      const digitMatch = messageLower.match(new RegExp(`(\\d+)\\s+(?:órdenes?\\s+de\\s+)?${itemWords[0]}`, 'i'));
      if (digitMatch) {
        quantity = parseInt(digitMatch[1], 10);
      }

      items.push({
        menu_item_id: menuItem.id,
        name: menuItem.name,
        quantity,
        matched_confidence: matchScore / itemWords.length,
        unit_price: menuItem.base_price,
      });
    }
  }

  // Calculate overall confidence
  const avgConfidence = items.length > 0
    ? items.reduce((sum, item) => sum + item.matched_confidence, 0) / items.length
    : 0;

  // Extract special instructions
  let specialInstructions: string | undefined;
  const instructionPatterns = [
    /(?:sin|extra|con mucho|poco|bien)\s+\w+/gi,
    /(?:por favor|porfa)\s*,?\s*(.+)$/i,
  ];

  for (const pattern of instructionPatterns) {
    const match = message.match(pattern);
    if (match) {
      specialInstructions = (specialInstructions ? specialInstructions + '. ' : '') + match[0];
    }
  }

  // Determine if we need clarification
  const needsClarification = items.length === 0 || avgConfidence < 0.5;

  let clarificationQuestion: string | undefined;
  if (items.length === 0) {
    clarificationQuestion = '¿Qué platillos te gustaría ordenar de nuestro menú?';
  } else if (avgConfidence < 0.5) {
    clarificationQuestion = `¿Confirmamos tu pedido: ${items.map(i => `${i.quantity}x ${i.name}`).join(', ')}?`;
  }

  return {
    items,
    order_type: orderType,
    pickup_time: pickupTime,
    special_instructions: specialInstructions,
    confidence_score: avgConfidence,
    needs_clarification: needsClarification,
    clarification_question: clarificationQuestion,
  };
}

/**
 * Formatea el menú para el prompt del agente
 */
function formatMenuForPrompt(
  menuItems: NonNullable<TISTISAgentStateType['business_context']>['menu_items'],
  menuCategories: NonNullable<TISTISAgentStateType['business_context']>['menu_categories']
): string {
  if (!menuItems || menuItems.length === 0) {
    return '# MENÚ\nNo hay menú disponible.';
  }

  let text = '# MENÚ DISPONIBLE\n\n';

  // Group by category
  const byCategory = new Map<string, typeof menuItems>();

  for (const item of menuItems) {
    const catName = item.category_name || 'Otros';
    if (!byCategory.has(catName)) {
      byCategory.set(catName, []);
    }
    byCategory.get(catName)!.push(item);
  }

  for (const [categoryName, items] of byCategory) {
    text += `## ${categoryName}\n`;
    for (const item of items) {
      const tags = item.tags?.length ? ` [${item.tags.join(', ')}]` : '';
      const popular = item.is_popular ? ' ⭐' : '';
      text += `- ${item.name}${popular}: $${item.base_price.toLocaleString()}${tags}\n`;
      if (item.description) {
        text += `  ${item.description}\n`;
      }
    }
    text += '\n';
  }

  return text;
}

/**
 * Otorga tokens de lealtad por una compra
 * Solo si el tenant tiene el programa de lealtad activo
 */
async function awardLoyaltyTokensForOrder(
  tenantId: string,
  leadId: string | undefined,
  orderTotal: number
): Promise<{ awarded: boolean; tokens?: number; error?: string }> {
  if (!leadId) {
    return { awarded: false, error: 'No lead ID' };
  }

  const supabase = createServerClient();

  try {
    // 1. Check if tenant has active loyalty program
    const { data: program, error: programError } = await supabase
      .from('loyalty_programs')
      .select('id, is_active, tokens_enabled, tokens_per_currency, tokens_currency_threshold')
      .eq('tenant_id', tenantId)
      .single();

    if (programError || !program || !program.is_active || !program.tokens_enabled) {
      return { awarded: false, error: 'No active loyalty program' };
    }

    // 2. Calculate tokens based on order total
    const threshold = program.tokens_currency_threshold || 1;
    const tokensPerCurrency = program.tokens_per_currency || 1;
    const tokensToAward = Math.floor((orderTotal / threshold) * tokensPerCurrency);

    if (tokensToAward <= 0) {
      return { awarded: false, error: 'Order total too low for tokens' };
    }

    // 3. Award tokens using the RPC function
    const { error: awardError } = await supabase.rpc('award_loyalty_tokens', {
      p_program_id: program.id,
      p_lead_id: leadId,
      p_tokens: tokensToAward,
      p_transaction_type: 'earn_purchase',
      p_description: `Puntos por pedido IA - Total: $${orderTotal.toFixed(2)}`,
      p_reference_id: null,
      p_reference_type: 'restaurant_order',
    });

    if (awardError) {
      console.warn('[Ordering Agent] Error awarding tokens:', awardError.message);
      return { awarded: false, error: awardError.message };
    }

    console.log(`[Ordering Agent] Awarded ${tokensToAward} tokens to lead ${leadId}`);
    return { awarded: true, tokens: tokensToAward };
  } catch (err) {
    console.warn('[Ordering Agent] Error in loyalty integration:', err);
    return { awarded: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Valida stock disponible antes de crear la orden
 */
async function validateStock(
  branchId: string,
  items: ParsedOrderItem[]
): Promise<{ valid: boolean; outOfStock: string[]; lowStock: string[] }> {
  const supabase = createServerClient();

  try {
    const itemsJson = items.map(i => ({
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
    }));

    const { data, error } = await supabase.rpc('validate_order_stock', {
      p_branch_id: branchId,
      p_items: itemsJson,
    });

    if (error) {
      console.warn('[Ordering Agent] Stock validation not available:', error.message);
      // Si la función no existe todavía, permitir la orden
      return { valid: true, outOfStock: [], lowStock: [] };
    }

    return {
      valid: data?.[0]?.valid ?? true,
      outOfStock: data?.[0]?.out_of_stock_items ?? [],
      lowStock: data?.[0]?.low_stock_warnings ?? [],
    };
  } catch (err) {
    console.warn('[Ordering Agent] Error validating stock:', err);
    return { valid: true, outOfStock: [], lowStock: [] };
  }
}

/**
 * Crea una orden en la base de datos
 * Incluye campos de trazabilidad AI y notifica a cocina
 */
async function createOrder(
  tenantId: string,
  branchId: string,
  leadId: string | undefined,
  conversationId: string,
  parsedOrder: ParsedOrder,
  channel: string = 'whatsapp'
): Promise<OrderResult> {
  const supabase = createServerClient();

  try {
    // 0. Validar stock antes de crear la orden
    const stockValidation = await validateStock(branchId, parsedOrder.items);

    if (!stockValidation.valid) {
      return {
        success: false,
        order_type: parsedOrder.order_type,
        items: [],
        error: `Lo siento, los siguientes platillos no están disponibles: ${stockValidation.outOfStock.join(', ')}. ¿Te gustaría ordenar algo más?`,
      };
    }

    // 1. Calculate totals (display_number is auto-generated by DB trigger)
    const subtotal = parsedOrder.items.reduce((sum, item) => {
      return sum + (item.unit_price || 0) * item.quantity;
    }, 0);

    const taxRate = 0.16; // 16% IVA in Mexico
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    // Calculate estimated prep time (max of all items or 20 min minimum)
    const estimatedPrepTime = Math.max(
      20,
      ...parsedOrder.items.map(i => 15) // TODO: get from menu items
    );

    // Determine order source based on channel
    const orderSourceMap: Record<string, string> = {
      whatsapp: 'ai_whatsapp',
      voice: 'ai_voice',
      webchat: 'ai_webchat',
    };
    const orderSource = orderSourceMap[channel] || 'ai_whatsapp';

    // Determine if requires human review (low confidence or complex order)
    const requiresHumanReview = parsedOrder.confidence_score < 0.7 || parsedOrder.items.length > 5;
    const humanReviewReason = requiresHumanReview
      ? parsedOrder.confidence_score < 0.7
        ? 'Baja confianza en interpretación del pedido'
        : 'Pedido complejo (más de 5 items)'
      : null;

    // 2. Create the order with AI traceability fields
    // Note: display_number is auto-generated by DB trigger (generate_order_display_number)
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert({
        tenant_id: tenantId,
        branch_id: branchId,
        order_type: parsedOrder.order_type === 'pickup' ? 'takeout' : parsedOrder.order_type,
        customer_id: leadId || null,
        status: 'confirmed', // Set to confirmed so it triggers kitchen notification
        priority: 3,
        subtotal,
        tax_amount: taxAmount,
        total,
        estimated_prep_time: estimatedPrepTime,
        customer_notes: parsedOrder.special_instructions,
        // AI Traceability fields
        conversation_id: conversationId || null,
        order_source: orderSource,
        ai_confidence_score: parsedOrder.confidence_score,
        requires_human_review: requiresHumanReview,
        human_review_reason: humanReviewReason,
        metadata: {
          source: 'ai_agent',
          conversation_id: conversationId,
          ai_confidence_score: parsedOrder.confidence_score,
          created_via: channel,
          items_detected: parsedOrder.items.length,
        },
      })
      .select('id, display_number, ordered_at')
      .single();

    if (orderError || !order) {
      console.error('[Ordering Agent] Error creating order:', orderError);
      return {
        success: false,
        order_type: parsedOrder.order_type,
        items: [],
        error: 'No se pudo crear la orden. Por favor intenta de nuevo.',
      };
    }

    // Create order items with AI traceability
    const orderItems = parsedOrder.items.map(item => ({
      tenant_id: tenantId,
      order_id: order.id,
      menu_item_id: item.menu_item_id || null,
      menu_item_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      subtotal: (item.unit_price || 0) * item.quantity,
      modifiers: item.modifiers ? JSON.stringify(item.modifiers.map(m => ({ type: 'add', item: m }))) : '[]',
      status: 'pending',
      // AI Traceability fields
      ai_match_confidence: item.matched_confidence,
      customer_original_text: item.special_instructions || null,
    }));

    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('[Ordering Agent] Error creating order items:', itemsError);
      // Order was created but items failed - still return success with warning
    }

    // Calculate pickup time
    const now = new Date();
    const pickupTime = new Date(now.getTime() + estimatedPrepTime * 60 * 1000);
    const pickupTimeStr = pickupTime.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    // Award loyalty tokens if available
    const loyaltyResult = await awardLoyaltyTokensForOrder(tenantId, leadId, total);
    const orderDisplayNumber = order.display_number;
    let confirmationMessage = `¡Tu pedido #${orderDisplayNumber} está confirmado! Total: $${total.toFixed(2)}. Estará listo aproximadamente a las ${pickupTimeStr}.`;

    // Add low stock warning if applicable
    if (stockValidation.lowStock.length > 0) {
      console.log(`[Ordering Agent] Low stock warning: ${stockValidation.lowStock.join(', ')}`);
    }

    // Add loyalty bonus to message if tokens were awarded
    if (loyaltyResult.awarded && loyaltyResult.tokens) {
      confirmationMessage += ` Has ganado ${loyaltyResult.tokens} puntos.`;
    }

    return {
      success: true,
      order_id: order.id,
      order_number: orderDisplayNumber,
      order_type: parsedOrder.order_type,
      items: parsedOrder.items.map(i => ({
        menu_item_id: i.menu_item_id || '',
        name: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price || 0,
        subtotal: (i.unit_price || 0) * i.quantity,
        modifiers: i.modifiers,
        special_instructions: i.special_instructions,
      })),
      subtotal,
      tax_amount: taxAmount,
      total,
      estimated_ready_time: pickupTimeStr,
      pickup_time: pickupTimeStr,
      confirmation_message: confirmationMessage,
      ai_confidence_score: parsedOrder.confidence_score,
      tokens_awarded: loyaltyResult.tokens,
    };
  } catch (error) {
    console.error('[Ordering Agent] Unexpected error:', error);
    return {
      success: false,
      order_type: parsedOrder.order_type,
      items: [],
      error: 'Ocurrió un error al procesar tu pedido. Un asesor te ayudará.',
    };
  }
}

// ======================
// ORDERING AGENT
// ======================

/**
 * Agente de Ordering para Restaurantes
 *
 * IMPORTANTE: Este agente solo se activa cuando el cliente
 * explícitamente quiere hacer un pedido para recoger/llevar.
 * No pregunta por platillos durante reservaciones normales.
 *
 * Responsabilidades:
 * 1. Entender qué quiere ordenar el cliente
 * 2. Hacer matching con items del menú
 * 3. Confirmar el pedido
 * 4. Crear la orden en el sistema
 * 5. Dar confirmación con número y tiempo estimado
 */
class OrderingRestaurantAgentClass extends BaseAgent {
  constructor() {
    super({
      name: 'ordering_restaurant',
      description: 'Agente de pedidos pickup/delivery para restaurantes',
      systemPromptTemplate: `Eres el encargado de tomar pedidos en {{TENANT_NAME}}.

# TU ROL
Tu trabajo es ayudar a los clientes a realizar pedidos para recoger (pickup) o llevar.
- Identifica los platillos que quiere el cliente
- Confirma el pedido completo antes de procesarlo
- Da el número de orden y tiempo estimado

# ESTILO DE COMUNICACIÓN
- Responde de manera {{STYLE_DESCRIPTION}}
- Máximo {{MAX_LENGTH}} caracteres
- Sé amable pero eficiente
- NO uses emojis a menos que el cliente los use primero

# PROCESO DE PEDIDO
1. Escucha lo que quiere el cliente
2. Confirma los items, cantidades y cualquier modificación
3. Pregunta si desea agregar algo más
4. Da el total y tiempo estimado

# INSTRUCCIONES ESPECÍFICAS
- Si el cliente menciona un platillo que no reconoces, sugiere opciones similares del menú
- Si hay ambigüedad (ej: "tacos" sin especificar tipo), pregunta para clarificar
- Siempre menciona el tiempo estimado de preparación
- Para pedidos grandes (>5 items), confirma item por item

# EJEMPLO DE INTERACCIÓN
Cliente: "Quiero 2 hamburguesas y unas papas"
Tú: "Perfecto. Te confirmo: 2 hamburguesas clásicas y 1 orden de papas. ¿Deseas alguna bebida o algo más?"

Cliente: "No, es todo"
Tú: "Tu pedido está confirmado. Total: $180. Número de orden: #023. Estará listo en aproximadamente 20 minutos."`,
      temperature: 0.5,
      maxTokens: 400,
      canHandoffTo: ['pricing', 'location', 'escalation'],
      canGenerateResponse: true,
    });
  }

  async execute(state: TISTISAgentStateType): Promise<AgentResult> {
    const tenant = state.tenant;
    const lead = state.lead;
    const business = state.business_context;

    // Get menu context
    const menuItems = business?.menu_items || [];
    const menuCategories = business?.menu_categories || [];

    // Format menu for prompt
    const menuContext = formatMenuForPrompt(menuItems, menuCategories);
    const branchesContext = formatBranchesForPrompt(business);

    // Parse the order from the message
    const parsedOrder = parseOrderFromMessage(state.current_message, menuItems);

    // If we detected items with good confidence, try to create the order
    if (parsedOrder.items.length > 0 && parsedOrder.confidence_score >= 0.6 && !parsedOrder.needs_clarification) {
      // Get branch (use first one if not specified)
      const branchId = lead?.preferred_branch_id || business?.branches?.[0]?.id;

      if (!branchId || !tenant) {
        const { response, tokens } = await this.callLLM(
          state,
          `${menuContext}\n${branchesContext}\n\nNOTA: No se pudo determinar la sucursal. Pregunta al cliente.`
        );
        return { response, tokens_used: tokens };
      }

      // Create the order with channel from state
      const orderResult = await createOrder(
        tenant.tenant_id,
        branchId,
        lead?.lead_id,
        state.conversation?.conversation_id || '',
        parsedOrder,
        state.channel || 'whatsapp'
      );

      if (orderResult.success) {
        // Return the confirmation message
        return {
          response: orderResult.confirmation_message!,
          tokens_used: 0,
        };
      } else {
        // Order failed, use LLM to handle gracefully
        const { response, tokens } = await this.callLLM(
          state,
          `${menuContext}\n\nNOTA: Hubo un problema al crear el pedido: ${orderResult.error}. Discúlpate y ofrece alternativas.`
        );
        return { response, tokens_used: tokens };
      }
    }

    // Need clarification or no items detected - use LLM
    let additionalContext = `${menuContext}\n${branchesContext}`;

    if (parsedOrder.items.length > 0) {
      // We detected some items but need confirmation
      additionalContext += `\n\n# ITEMS DETECTADOS (necesitan confirmación)\n`;
      for (const item of parsedOrder.items) {
        additionalContext += `- ${item.quantity}x ${item.name} (confianza: ${Math.round(item.matched_confidence * 100)}%)\n`;
      }
      additionalContext += `\nConfirma estos items con el cliente antes de procesar el pedido.`;
    } else {
      // No items detected
      additionalContext += `\n\nNOTA: No se detectaron platillos claros en el mensaje. Pregunta qué desea ordenar y ofrece sugerencias del menú.`;
    }

    const { response, tokens } = await this.callLLM(state, additionalContext);

    return {
      response,
      tokens_used: tokens,
    };
  }
}

// Singleton instance
export const OrderingRestaurantAgent = new OrderingRestaurantAgentClass();

// LangGraph node
export const orderingRestaurantNode = OrderingRestaurantAgent.toNode();
