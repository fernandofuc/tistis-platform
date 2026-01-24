// =====================================================
// TIS TIS PLATFORM - Get Delivery Status Tool
// Voice Agent tool for checking delivery order status
// =====================================================
//
// CAPABILITIES: order_status, delivery
// ENABLED_FOR: rest_complete
// REQUIRES_CONFIRMATION: false
//
// SINCRONIZADO CON:
// - SQL: supabase/migrations/156_DELIVERY_SYSTEM.sql
// - Types: src/shared/types/delivery-types.ts
// =====================================================

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import {
  type DeliveryStatus,
  DELIVERY_STATUS_INFO,
} from '@/src/shared/types/delivery-types';

// ======================
// TOOL DEFINITION
// ======================

export const getDeliveryStatusToolDefinition = {
  name: 'get_delivery_status',
  description: `
    Get the current status of a delivery order.
    Use this when a customer asks about their delivery order status.
    Can search by order number or customer phone.
    Returns delivery status, estimated time, and driver information if assigned.
  `,
  parameters: z.object({
    order_number: z.string().optional().describe('The order number (e.g., "D-045")'),
    customer_phone: z.string().optional().describe('Customer phone number'),
    order_id: z.string().uuid().optional().describe('Order UUID if known'),
  }).refine(
    (data) => data.order_number || data.customer_phone || data.order_id,
    { message: 'At least one of order_number, customer_phone, or order_id is required' }
  ),
  requiredCapabilities: ['delivery'] as const,
  requiresConfirmation: false,
  enabledFor: ['rest_complete'] as const,
  timeout: 8000,
};

// ======================
// TOOL SCHEMA
// ======================

export const getDeliveryStatusSchema = getDeliveryStatusToolDefinition.parameters;

export type GetDeliveryStatusParams = z.infer<typeof getDeliveryStatusSchema>;

// ======================
// TOOL IMPLEMENTATION
// ======================

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

export interface GetDeliveryStatusContext {
  tenantId: string;
  branchId?: string;
  language?: 'es' | 'en';
}

export interface GetDeliveryStatusResult {
  success: boolean;
  found: boolean;
  orderNumber?: string;
  orderStatus?: string;
  deliveryStatus?: DeliveryStatus;
  estimatedDeliveryAt?: string;
  estimatedMinutesRemaining?: number;
  driverName?: string;
  driverPhone?: string;
  message: string;
  voiceMessage: string;
}

// Status messages in Spanish
const STATUS_MESSAGES_ES: Record<DeliveryStatus, string> = {
  pending_assignment: 'Tu pedido está confirmado y estamos buscando un repartidor',
  driver_assigned: 'Ya tenemos un repartidor asignado que va en camino al restaurante',
  driver_arrived: 'El repartidor ya llegó al restaurante y está recogiendo tu pedido',
  picked_up: 'El repartidor ya tiene tu pedido y está por salir',
  in_transit: 'Tu pedido está en camino',
  arriving: 'El repartidor está por llegar a tu ubicación',
  delivered: 'Tu pedido ha sido entregado',
  failed: 'Hubo un problema con la entrega',
  returned: 'El pedido fue devuelto al restaurante',
};

// Status messages in English
const STATUS_MESSAGES_EN: Record<DeliveryStatus, string> = {
  pending_assignment: 'Your order is confirmed and we are looking for a driver',
  driver_assigned: 'A driver has been assigned and is heading to the restaurant',
  driver_arrived: 'The driver has arrived at the restaurant and is picking up your order',
  picked_up: 'The driver has your order and is about to leave',
  in_transit: 'Your order is on its way',
  arriving: 'The driver is arriving at your location',
  delivered: 'Your order has been delivered',
  failed: 'There was a problem with the delivery',
  returned: 'The order was returned to the restaurant',
};

export async function getDeliveryStatus(
  params: GetDeliveryStatusParams,
  context: GetDeliveryStatusContext
): Promise<GetDeliveryStatusResult> {
  const { tenantId, language = 'es' } = context;
  const statusMessages = language === 'es' ? STATUS_MESSAGES_ES : STATUS_MESSAGES_EN;

  try {
    const supabase = createServerClient();

    // Build query based on provided params
    let query = supabase
      .from('restaurant_orders')
      .select(`
        id,
        display_number,
        status,
        order_type,
        delivery_status,
        estimated_delivery_at,
        delivery_driver_id,
        delivery_drivers!delivery_driver_id (
          full_name,
          phone
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('order_type', 'delivery');

    if (params.order_id) {
      query = query.eq('id', params.order_id);
    } else if (params.order_number) {
      query = query.ilike('display_number', `%${params.order_number}%`);
    } else if (params.customer_phone) {
      // Search by customer phone - need to join with leads
      query = query
        .not('customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      // Note: For full phone search, you'd need a more complex query or RPC
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return {
        success: true,
        found: false,
        message: 'Pedido no encontrado',
        voiceMessage: language === 'es'
          ? 'No encontré ningún pedido con esos datos. ¿Podrías verificar el número de pedido?'
          : 'I could not find any order with that information. Could you verify the order number?',
      };
    }

    const deliveryStatus = data.delivery_status as DeliveryStatus | null;
    const orderStatus = data.status as string;

    // Calculate remaining time
    let estimatedMinutesRemaining: number | undefined;
    if (data.estimated_delivery_at) {
      const estimatedAt = new Date(data.estimated_delivery_at);
      const now = new Date();
      const diffMs = estimatedAt.getTime() - now.getTime();
      estimatedMinutesRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
    }

    // Get driver info - Supabase returns array for joined data, we need first element
    const driverData = data.delivery_drivers as { full_name: string; phone: string }[] | null;
    const driverInfo = driverData && driverData.length > 0 ? driverData[0] : null;

    // Build voice message
    let voiceMessage: string;

    if (orderStatus === 'cancelled') {
      voiceMessage = language === 'es'
        ? `El pedido ${data.display_number} fue cancelado.`
        : `Order ${data.display_number} was cancelled.`;
    } else if (!deliveryStatus) {
      voiceMessage = language === 'es'
        ? `El pedido ${data.display_number} está siendo procesado.`
        : `Order ${data.display_number} is being processed.`;
    } else {
      const statusMessage = statusMessages[deliveryStatus];
      voiceMessage = language === 'es'
        ? `Tu pedido ${data.display_number}: ${statusMessage}.`
        : `Your order ${data.display_number}: ${statusMessage}.`;

      // Add time estimate if available and not delivered
      if (
        estimatedMinutesRemaining !== undefined &&
        estimatedMinutesRemaining > 0 &&
        !['delivered', 'failed', 'returned'].includes(deliveryStatus)
      ) {
        if (language === 'es') {
          voiceMessage += ` Tiempo estimado de llegada: ${estimatedMinutesRemaining} minutos.`;
        } else {
          voiceMessage += ` Estimated arrival: ${estimatedMinutesRemaining} minutes.`;
        }
      }

      // Add driver info if in transit
      if (driverInfo && ['in_transit', 'arriving'].includes(deliveryStatus)) {
        if (language === 'es') {
          voiceMessage += ` El repartidor es ${driverInfo.full_name}.`;
        } else {
          voiceMessage += ` Your driver is ${driverInfo.full_name}.`;
        }
      }
    }

    return {
      success: true,
      found: true,
      orderNumber: data.display_number,
      orderStatus,
      deliveryStatus: deliveryStatus || undefined,
      estimatedDeliveryAt: data.estimated_delivery_at || undefined,
      estimatedMinutesRemaining,
      driverName: driverInfo?.full_name,
      driverPhone: driverInfo?.phone,
      message: deliveryStatus
        ? DELIVERY_STATUS_INFO[deliveryStatus].label
        : 'Procesando',
      voiceMessage,
    };
  } catch (error) {
    console.error('[Get Delivery Status] Error:', error);
    return {
      success: false,
      found: false,
      message: 'Error al consultar estado',
      voiceMessage: language === 'es'
        ? 'Lo siento, no pude consultar el estado del pedido. ¿Podrías intentar de nuevo?'
        : 'Sorry, I could not check the order status. Could you try again?',
    };
  }
}

export default getDeliveryStatus;
