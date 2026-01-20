/**
 * TIS TIS Platform - Voice Agent v2.0
 * Restaurant Tool: Get Order Status
 *
 * Retrieves the status of an existing order by order number or phone.
 * Provides real-time updates for pickup and delivery orders.
 */

import type {
  ToolDefinition,
  ToolContext,
  OrderStatusResult,
  GetOrderStatusParams,
} from '../types';

// =====================================================
// ORDER STATUS MAPPING
// =====================================================

const ORDER_STATUS_DISPLAY: Record<string, { es: string; en: string; emoji: string }> = {
  pending: {
    es: 'Pendiente de confirmación',
    en: 'Pending confirmation',
    emoji: '⏳',
  },
  confirmed: {
    es: 'Confirmado',
    en: 'Confirmed',
    emoji: '✅',
  },
  preparing: {
    es: 'En preparación',
    en: 'Being prepared',
    emoji: '👨‍🍳',
  },
  ready: {
    es: 'Listo para recoger',
    en: 'Ready for pickup',
    emoji: '📦',
  },
  out_for_delivery: {
    es: 'En camino',
    en: 'Out for delivery',
    emoji: '🛵',
  },
  delivered: {
    es: 'Entregado',
    en: 'Delivered',
    emoji: '✅',
  },
  cancelled: {
    es: 'Cancelado',
    en: 'Cancelled',
    emoji: '❌',
  },
};

// =====================================================
// TOOL DEFINITION
// =====================================================

export const getOrderStatus: ToolDefinition<GetOrderStatusParams> = {
  name: 'get_order_status',
  description: 'Consulta el estado de un pedido existente',
  category: 'order',

  parameters: {
    type: 'object',
    properties: {
      orderNumber: {
        type: 'string',
        description: 'Número de pedido o código de confirmación',
      },
      customerPhone: {
        type: 'string',
        description: 'Teléfono del cliente para buscar pedidos recientes',
      },
      orderId: {
        type: 'string',
        description: 'ID interno del pedido',
      },
    },
    required: [],
  },

  requiredCapabilities: ['order_status'],
  requiresConfirmation: false,
  enabledFor: ['rest_complete'],
  timeout: 8000,

  handler: async (params, context): Promise<OrderStatusResult> => {
    const { orderNumber, customerPhone, orderId } = params;
    const { supabase, tenantId, branchId, locale } = context;

    try {
      // Validate we have at least one search parameter
      if (!orderNumber && !customerPhone && !orderId) {
        return {
          success: false,
          error: 'Missing search parameter',
          voiceMessage: locale === 'en'
            ? 'I need your order number or phone number to look up your order. Could you provide one of those?'
            : 'Necesito su número de pedido o su número de teléfono para buscar su orden. ¿Podría proporcionarme alguno?',
        };
      }

      // Build query based on available parameters
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          delivery_type,
          delivery_address,
          customer_name,
          customer_phone,
          total_amount,
          estimated_ready_time,
          estimated_delivery_time,
          created_at,
          updated_at,
          items:order_items(
            quantity,
            menu_item:menu_items(name)
          )
        `)
        .eq('tenant_id', tenantId);

      // Apply filters based on available parameters
      if (orderId) {
        query = query.eq('id', orderId);
      } else if (orderNumber) {
        query = query.eq('order_number', orderNumber.toUpperCase().trim());
      } else if (customerPhone) {
        // Get most recent order for this phone number
        const normalizedPhone = normalizePhone(customerPhone);
        query = query
          .eq('customer_phone', normalizedPhone)
          .order('created_at', { ascending: false })
          .limit(1);
      }

      // Filter by branch if applicable
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: orders, error: queryError } = await query;

      if (queryError) {
        console.error('[GetOrderStatus] Query error:', queryError);
        return {
          success: false,
          error: 'Database error',
          voiceMessage: locale === 'en'
            ? "I'm having trouble looking up your order. Please try again."
            : 'Tengo problemas para buscar su pedido. Por favor intente de nuevo.',
        };
      }

      // No order found
      if (!orders || orders.length === 0) {
        if (customerPhone) {
          return {
            success: false,
            error: 'No orders found',
            voiceMessage: locale === 'en'
              ? "I couldn't find any recent orders for that phone number. Do you have your order number?"
              : 'No encontré pedidos recientes con ese número de teléfono. ¿Tiene su número de pedido?',
          };
        }

        return {
          success: false,
          error: 'Order not found',
          voiceMessage: locale === 'en'
            ? "I couldn't find an order with that number. Could you please verify it?"
            : 'No encontré un pedido con ese número. ¿Podría verificarlo por favor?',
        };
      }

      const order = orders[0];
      const status = (order.status || 'pending') as string;
      const statusKey = status as keyof typeof ORDER_STATUS_DISPLAY;
      const statusInfo = ORDER_STATUS_DISPLAY[statusKey] || ORDER_STATUS_DISPLAY.pending;

      // Format items list - handle Supabase nested relation structure
      const rawItems = order.items as unknown as Array<{ quantity: number; menu_item: Array<{ name: string }> | { name: string } }> | undefined;
      const items = (rawItems || [])
        .map(item => {
          // Supabase can return menu_item as array or object depending on query
          const menuItem = Array.isArray(item.menu_item) ? item.menu_item[0] : item.menu_item;
          return {
            name: menuItem?.name || 'Artículo',
            quantity: item.quantity,
          };
        });

      // Calculate estimated time message
      let timeMessage = '';
      if (order.delivery_type === 'delivery' && order.estimated_delivery_time) {
        const estimatedTime = new Date(order.estimated_delivery_time);
        const now = new Date();
        const diffMinutes = Math.round((estimatedTime.getTime() - now.getTime()) / 60000);

        if (diffMinutes > 0) {
          timeMessage = locale === 'en'
            ? ` Your order should arrive in approximately ${diffMinutes} minutes.`
            : ` Su pedido debería llegar en aproximadamente ${diffMinutes} minutos.`;
        }
      } else if (order.delivery_type === 'pickup' && order.estimated_ready_time) {
        const estimatedTime = new Date(order.estimated_ready_time);
        const now = new Date();
        const diffMinutes = Math.round((estimatedTime.getTime() - now.getTime()) / 60000);

        if (diffMinutes > 0) {
          timeMessage = locale === 'en'
            ? ` It should be ready in approximately ${diffMinutes} minutes.`
            : ` Debería estar listo en aproximadamente ${diffMinutes} minutos.`;
        } else if (status === 'ready') {
          timeMessage = locale === 'en'
            ? ' Your order is ready for pickup now!'
            : ' ¡Su pedido está listo para recoger ahora!';
        }
      }

      // Build voice message based on status
      let voiceMessage: string;
      const orderNumDisplay = order.order_number || orderId?.slice(-6).toUpperCase();

      switch (status) {
        case 'pending':
          voiceMessage = locale === 'en'
            ? `Your order ${orderNumDisplay} is pending confirmation. We'll start preparing it shortly.`
            : `Su pedido ${orderNumDisplay} está pendiente de confirmación. Comenzaremos a prepararlo en breve.`;
          break;

        case 'confirmed':
          voiceMessage = locale === 'en'
            ? `Your order ${orderNumDisplay} has been confirmed and will be prepared soon.${timeMessage}`
            : `Su pedido ${orderNumDisplay} ha sido confirmado y será preparado pronto.${timeMessage}`;
          break;

        case 'preparing':
          voiceMessage = locale === 'en'
            ? `Good news! Your order ${orderNumDisplay} is currently being prepared.${timeMessage}`
            : `¡Buenas noticias! Su pedido ${orderNumDisplay} está siendo preparado en este momento.${timeMessage}`;
          break;

        case 'ready':
          voiceMessage = locale === 'en'
            ? `Great news! Your order ${orderNumDisplay} is ready for pickup!`
            : `¡Excelentes noticias! Su pedido ${orderNumDisplay} está listo para recoger.`;
          break;

        case 'out_for_delivery':
          voiceMessage = locale === 'en'
            ? `Your order ${orderNumDisplay} is on its way to you!${timeMessage}`
            : `¡Su pedido ${orderNumDisplay} va en camino hacia usted!${timeMessage}`;
          break;

        case 'delivered':
          voiceMessage = locale === 'en'
            ? `Your order ${orderNumDisplay} has been delivered. Enjoy your meal!`
            : `Su pedido ${orderNumDisplay} ha sido entregado. ¡Que disfrute su comida!`;
          break;

        case 'cancelled':
          voiceMessage = locale === 'en'
            ? `Your order ${orderNumDisplay} was cancelled. If you need assistance, I can transfer you to a representative.`
            : `Su pedido ${orderNumDisplay} fue cancelado. Si necesita ayuda, puedo transferirlo con un representante.`;
          break;

        default:
          voiceMessage = locale === 'en'
            ? `Your order ${orderNumDisplay} status is: ${statusInfo.en}.${timeMessage}`
            : `El estado de su pedido ${orderNumDisplay} es: ${statusInfo.es}.${timeMessage}`;
      }

      // Ensure status is a valid enum value for the type
      type ValidOrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
      const validStatuses: ValidOrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
      const validatedStatus: ValidOrderStatus = validStatuses.includes(status as ValidOrderStatus)
        ? (status as ValidOrderStatus)
        : 'pending';

      return {
        success: true,
        voiceMessage,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          status: validatedStatus,
          statusDisplay: locale === 'en' ? statusInfo.en : statusInfo.es,
          estimatedTime: order.delivery_type === 'delivery'
            ? order.estimated_delivery_time
            : order.estimated_ready_time,
          items,
          total: order.total_amount,
          deliveryAddress: order.delivery_address,
          createdAt: order.created_at,
        },
      };
    } catch (error) {
      console.error('[GetOrderStatus] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        voiceMessage: locale === 'en'
          ? "I'm sorry, I couldn't look up your order status. Please try again."
          : 'Lo siento, no pude consultar el estado de su pedido. Por favor intente de nuevo.',
      };
    }
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Normalize phone number
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export default getOrderStatus;
