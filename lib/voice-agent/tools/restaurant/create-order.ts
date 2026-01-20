/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tool: Create Order
 *
 * Creates a phone/voice order for pickup or delivery.
 * Requires confirmation before processing.
 */

import type {
  ToolDefinition,
  ToolContext,
  OrderResult,
  CreateOrderParams,
} from '../types';
import {
  formatPriceForVoice,
  formatDurationForVoice,
  formatListForVoice,
  formatConfirmationCodeForVoice,
} from '../formatters';

// =====================================================
// TOOL DEFINITION
// =====================================================

export const createOrder: ToolDefinition<CreateOrderParams> = {
  name: 'create_order',
  description: 'Crea un pedido telefónico para recoger o entrega a domicilio',
  category: 'order',

  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Lista de artículos a ordenar',
        items: {
          type: 'object',
          properties: {
            menuItemId: {
              type: 'string',
              description: 'ID del artículo del menú',
            },
            quantity: {
              type: 'integer',
              description: 'Cantidad',
              minimum: 1,
            },
            modifications: {
              type: 'string',
              description: 'Modificaciones (ej: sin cebolla)',
            },
          },
          required: ['menuItemId', 'quantity'],
        },
      },
      deliveryType: {
        type: 'string',
        enum: ['delivery', 'pickup'],
        description: 'Tipo de entrega: a domicilio o para recoger',
      },
      deliveryAddress: {
        type: 'string',
        description: 'Dirección de entrega (requerido para delivery)',
      },
      customerName: {
        type: 'string',
        description: 'Nombre del cliente',
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente',
      },
      specialInstructions: {
        type: 'string',
        description: 'Instrucciones especiales para el pedido',
      },
      paymentMethod: {
        type: 'string',
        enum: ['cash', 'card', 'online'],
        description: 'Método de pago',
      },
    },
    required: ['items', 'deliveryType', 'customerName', 'customerPhone'],
  },

  requiredCapabilities: ['orders'],
  requiresConfirmation: true,
  enabledFor: ['rest_complete'],
  timeout: 20000,

  confirmationMessage: (params) => {
    const deliveryTypeStr = params.deliveryType === 'delivery'
      ? 'para entrega a domicilio'
      : 'para recoger';

    // Build items summary
    const itemsSummary = params.items
      .map(item => `${item.quantity} ${item.menuItemId}`)
      .slice(0, 3)
      .join(', ');

    let message = `Voy a ordenar ${itemsSummary} ${deliveryTypeStr}`;

    if (params.deliveryType === 'delivery' && params.deliveryAddress) {
      message += ` en ${params.deliveryAddress}`;
    }

    message += `. ¿Confirma el pedido?`;

    return message;
  },

  handler: async (params, context): Promise<OrderResult> => {
    const {
      items,
      deliveryType,
      deliveryAddress,
      customerName,
      customerPhone,
      specialInstructions,
      paymentMethod = 'cash',
    } = params;
    const { supabase, tenantId, branchId, callId, channel, locale } = context;

    try {
      // Validate delivery address for delivery orders
      if (deliveryType === 'delivery' && !deliveryAddress) {
        return {
          success: false,
          error: 'Delivery address required',
          voiceMessage: locale === 'en'
            ? 'I need a delivery address for this order. What is the address?'
            : 'Necesito una dirección de entrega para este pedido. ¿Cuál es la dirección?',
        };
      }

      // Get menu items to validate and get prices
      const menuItemIds = items.map(i => i.menuItemId);
      const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, price, is_available')
        .eq('tenant_id', tenantId)
        .in('id', menuItemIds);

      if (menuError || !menuItems) {
        console.error('[CreateOrder] Menu items error:', menuError);

        // Fallback: create order without validation
        return await createOrderWithoutValidation(
          supabase,
          tenantId,
          branchId,
          items,
          deliveryType,
          deliveryAddress,
          customerName,
          customerPhone,
          specialInstructions,
          paymentMethod,
          callId,
          channel,
          locale
        );
      }

      // Check availability and calculate total
      const menuItemMap = new Map(menuItems.map(m => [m.id, m]));
      const orderItems: Array<{ name: string; quantity: number; price: number; modifications?: string }> = [];
      let total = 0;

      for (const item of items) {
        const menuItem = menuItemMap.get(item.menuItemId);

        if (!menuItem) {
          // Item not found - might be using name instead of ID
          orderItems.push({
            name: item.menuItemId, // Use as name
            quantity: item.quantity,
            price: 0, // Unknown price
            modifications: item.modifications,
          });
          continue;
        }

        if (!menuItem.is_available) {
          return {
            success: false,
            error: 'Item not available',
            voiceMessage: locale === 'en'
              ? `I'm sorry, ${menuItem.name} is not available right now. Would you like something else?`
              : `Lo siento, ${menuItem.name} no está disponible en este momento. ¿Le gustaría otra cosa?`,
          };
        }

        const itemTotal = menuItem.price * item.quantity;
        total += itemTotal;

        orderItems.push({
          name: menuItem.name,
          quantity: item.quantity,
          price: menuItem.price,
          modifications: item.modifications,
        });
      }

      // Generate order number
      const orderNumber = generateOrderNumber();

      // Calculate estimated time
      const estimatedTime = deliveryType === 'delivery' ? 45 : 25; // minutes

      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenantId,
          branch_id: branchId || null,
          order_number: orderNumber,
          customer_name: customerName,
          customer_phone: normalizePhone(customerPhone),
          delivery_type: deliveryType,
          delivery_address: deliveryAddress || null,
          items: orderItems,
          subtotal: total,
          total: total, // Could add tax, delivery fee, etc.
          status: 'pending',
          payment_method: paymentMethod,
          special_instructions: specialInstructions || null,
          estimated_time_minutes: estimatedTime,
          source: channel,
          source_call_id: callId,
          created_at: new Date().toISOString(),
        })
        .select('id, order_number')
        .single();

      if (orderError) {
        console.error('[CreateOrder] Insert error:', orderError);
        return {
          success: false,
          error: orderError.message,
          voiceMessage: locale === 'en'
            ? 'There was a problem creating your order. Please try again.'
            : 'Hubo un problema al crear su pedido. Por favor intente de nuevo.',
        };
      }

      // Format success message
      const voiceMessage = formatOrderConfirmation(
        order.order_number,
        orderItems,
        total,
        deliveryType,
        estimatedTime,
        locale
      );

      return {
        success: true,
        voiceMessage,
        forwardToClient: true,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          total,
          estimatedTime,
          items: orderItems,
        },
      };
    } catch (error) {
      console.error('[CreateOrder] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't complete your order. Please try again."
          : 'Lo siento, no pude completar su pedido. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create order without menu validation (fallback)
 */
async function createOrderWithoutValidation(
  supabase: ToolContext['supabase'],
  tenantId: string,
  branchId: string | undefined,
  items: CreateOrderParams['items'],
  deliveryType: string,
  deliveryAddress: string | undefined,
  customerName: string,
  customerPhone: string,
  specialInstructions: string | undefined,
  paymentMethod: string,
  callId: string,
  channel: string,
  locale: string
): Promise<OrderResult> {
  const orderNumber = generateOrderNumber();
  const estimatedTime = deliveryType === 'delivery' ? 45 : 25;

  const orderItems = items.map(item => ({
    name: item.menuItemId,
    quantity: item.quantity,
    price: 0,
    modifications: item.modifications,
  }));

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId || null,
      order_number: orderNumber,
      customer_name: customerName,
      customer_phone: normalizePhone(customerPhone),
      delivery_type: deliveryType,
      delivery_address: deliveryAddress || null,
      items: orderItems,
      subtotal: 0,
      total: 0,
      status: 'pending',
      payment_method: paymentMethod,
      special_instructions: specialInstructions || null,
      estimated_time_minutes: estimatedTime,
      source: channel,
      source_call_id: callId,
      needs_price_confirmation: true,
      created_at: new Date().toISOString(),
    })
    .select('id, order_number')
    .single();

  if (error) {
    return {
      success: false,
      error: error.message,
      voiceMessage: locale === 'en'
        ? 'There was a problem creating your order. Please try again.'
        : 'Hubo un problema al crear su pedido. Por favor intente de nuevo.',
    };
  }

  const itemNames = items.map(i => `${i.quantity} ${i.menuItemId}`);
  const itemsList = formatListForVoice(itemNames, locale);

  const voiceMessage = locale === 'en'
    ? `Your order for ${itemsList} has been received. Order number is ${order.order_number}. Someone will confirm the total and estimated time shortly.`
    : `Su pedido de ${itemsList} ha sido recibido. El número de orden es ${order.order_number}. En breve alguien le confirmará el total y tiempo estimado.`;

  return {
    success: true,
    voiceMessage,
    forwardToClient: true,
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      total: 0,
      estimatedTime,
      items: orderItems,
    },
  };
}

/**
 * Generate unique order number
 */
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).toUpperCase().slice(2, 4);
  return `ORD-${timestamp}${random}`;
}

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Format order confirmation message
 */
function formatOrderConfirmation(
  orderNumber: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  total: number,
  deliveryType: string,
  estimatedTime: number,
  locale: string
): string {
  const orderCode = formatConfirmationCodeForVoice(orderNumber, locale);
  const totalStr = formatPriceForVoice(total, 'MXN', locale);
  const timeStr = formatDurationForVoice(estimatedTime, locale);

  const itemSummary = items.slice(0, 3).map(i => `${i.quantity} ${i.name}`);
  const itemsList = formatListForVoice(itemSummary, locale);

  if (locale === 'en') {
    const deliveryStr = deliveryType === 'delivery' ? 'for delivery' : 'for pickup';
    return `Your order is confirmed! ${itemsList} ${deliveryStr}. ` +
      `Order number ${orderCode}. Total is ${totalStr}. ` +
      `Estimated time is ${timeStr}. Thank you for your order!`;
  }

  const deliveryStr = deliveryType === 'delivery' ? 'para entrega' : 'para recoger';
  return `¡Su pedido está confirmado! ${itemsList} ${deliveryStr}. ` +
    `Número de orden ${orderCode}. El total es ${totalStr}. ` +
    `Tiempo estimado ${timeStr}. ¡Gracias por su pedido!`;
}

export default createOrder;
