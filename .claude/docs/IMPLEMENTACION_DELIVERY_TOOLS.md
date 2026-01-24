# FASE 2.3: Tools de AI Agent para Delivery

**Version:** 1.0.0
**Fecha:** 2026-01-24
**Documento Padre:** IMPLEMENTACION_UNIFICACION_AGENTES_V1.md

---

## INDICE

1. [Nuevas Tools para Delivery](#1-nuevas-tools-para-delivery)
2. [Modificaciones a Tools Existentes](#2-modificaciones-a-tools-existentes)
3. [Integracion con LangGraph](#3-integracion-con-langgraph)
4. [Integracion con Voice Agent](#4-integracion-con-voice-agent)
5. [Flujos de Conversacion](#5-flujos-de-conversacion)

---

## 1. NUEVAS TOOLS PARA DELIVERY

### 1.1 Tool: calculate_delivery_time

**Proposito:** Verificar disponibilidad y calcular tiempo/costo de delivery.

#### Archivo: `src/features/ai/tools/restaurant/calculate-delivery-time.tool.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Calculate Delivery Time Tool
// Para Messaging Agent (LangGraph)
// =====================================================

import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createServiceRoleClient } from '@/src/shared/lib/supabase-clients';

// Schema de entrada
const CalculateDeliveryInputSchema = z.object({
  street: z.string().describe('Calle de entrega'),
  exterior_number: z.string().describe('Numero exterior'),
  interior_number: z.string().optional().describe('Numero interior o departamento'),
  colony: z.string().describe('Colonia'),
  city: z.string().optional().default('Nogales').describe('Ciudad'),
  postal_code: z.string().optional().describe('Codigo postal'),
  reference: z.string().optional().describe('Referencias para encontrar el lugar'),
});

type CalculateDeliveryInput = z.infer<typeof CalculateDeliveryInputSchema>;

interface CalculateDeliveryConfig {
  tenantId: string;
  branchId: string;
}

export function createCalculateDeliveryTimeTool(config: CalculateDeliveryConfig) {
  return new DynamicStructuredTool({
    name: 'calculate_delivery_time',
    description: `Calcula el tiempo estimado y costo de delivery a una direccion.
Usa esta herramienta cuando el cliente quiera ordenar para delivery.
Verifica si la direccion esta dentro del radio de entrega.
Retorna tiempo estimado, costo de envio, y si esta disponible.`,
    schema: CalculateDeliveryInputSchema,
    func: async (input: CalculateDeliveryInput) => {
      const supabase = createServiceRoleClient();

      try {
        // Construir direccion
        const deliveryAddress = {
          street: input.street,
          exterior_number: input.exterior_number,
          interior_number: input.interior_number || null,
          colony: input.colony,
          city: input.city || 'Nogales',
          postal_code: input.postal_code || '',
          reference: input.reference || null,
        };

        // Llamar RPC de calculo
        const { data, error } = await supabase.rpc('calculate_delivery_time', {
          p_tenant_id: config.tenantId,
          p_branch_id: config.branchId,
          p_delivery_address: deliveryAddress,
        });

        if (error) {
          console.error('[calculate_delivery_time] Error:', error);
          return JSON.stringify({
            success: false,
            available: false,
            message: 'Error al calcular delivery. Por favor intenta de nuevo.',
          });
        }

        const result = data[0];

        if (!result.is_within_radius) {
          return JSON.stringify({
            success: true,
            available: false,
            message: `Lo siento, la direccion esta fuera de nuestro radio de entrega (${result.distance_km.toFixed(1)} km). Solo entregamos dentro de un radio de entrega limitado. Te ofrecemos la opcion de pedido para recoger en nuestra sucursal.`,
            distance_km: result.distance_km,
          });
        }

        return JSON.stringify({
          success: true,
          available: true,
          estimated_minutes: result.estimated_minutes,
          delivery_fee: result.delivery_fee,
          distance_km: result.distance_km,
          message: `El delivery esta disponible a esa direccion. Tiempo estimado: ${result.estimated_minutes} minutos. Costo de envio: $${result.delivery_fee.toFixed(2)} MXN.`,
        });
      } catch (error) {
        console.error('[calculate_delivery_time] Exception:', error);
        return JSON.stringify({
          success: false,
          available: false,
          message: 'Error al calcular delivery.',
        });
      }
    },
  });
}
```

### 1.2 Tool: create_delivery_order

**Proposito:** Crear un pedido de delivery con todos los datos.

#### Archivo: `src/features/ai/tools/restaurant/create-delivery-order.tool.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Create Delivery Order Tool
// Para Messaging Agent (LangGraph)
// =====================================================

import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createServiceRoleClient } from '@/src/shared/lib/supabase-clients';

const DeliveryAddressSchema = z.object({
  street: z.string(),
  exterior_number: z.string(),
  interior_number: z.string().optional(),
  colony: z.string(),
  city: z.string().default('Nogales'),
  postal_code: z.string().optional(),
  reference: z.string().optional(),
  contact_name: z.string(),
  contact_phone: z.string(),
});

const OrderItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  special_instructions: z.string().optional(),
});

const CreateDeliveryOrderInputSchema = z.object({
  items: z.array(OrderItemSchema).min(1).describe('Items del pedido'),
  delivery_address: DeliveryAddressSchema.describe('Direccion de entrega'),
  customer_notes: z.string().optional().describe('Notas adicionales del cliente'),
});

type CreateDeliveryOrderInput = z.infer<typeof CreateDeliveryOrderInputSchema>;

interface CreateDeliveryOrderConfig {
  tenantId: string;
  branchId: string;
  conversationId?: string;
  contactId?: string;
}

export function createCreateDeliveryOrderTool(config: CreateDeliveryOrderConfig) {
  return new DynamicStructuredTool({
    name: 'create_delivery_order',
    description: `Crea un pedido para delivery.
Usa esta herramienta SOLO despues de:
1. Haber verificado disponibilidad con calculate_delivery_time
2. El cliente ha confirmado su pedido completo
3. Tienes todos los datos de entrega (direccion, nombre, telefono)

Requiere: items del menu, direccion completa, nombre y telefono de contacto.`,
    schema: CreateDeliveryOrderInputSchema,
    func: async (input: CreateDeliveryOrderInput) => {
      const supabase = createServiceRoleClient();

      try {
        // Verificar disponibilidad de delivery una vez mas
        const { data: calcResult } = await supabase.rpc('calculate_delivery_time', {
          p_tenant_id: config.tenantId,
          p_branch_id: config.branchId,
          p_delivery_address: input.delivery_address,
        });

        if (!calcResult?.[0]?.is_within_radius) {
          return JSON.stringify({
            success: false,
            message: 'La direccion esta fuera de nuestro radio de entrega.',
          });
        }

        // Obtener siguiente numero de orden
        const { data: nextNumber } = await supabase.rpc('get_next_order_number', {
          p_tenant_id: config.tenantId,
          p_branch_id: config.branchId,
        });

        // Calcular totales
        const itemIds = input.items.map((i) => i.menu_item_id);
        const { data: menuItems } = await supabase
          .from('menu_items')
          .select('id, name, price')
          .in('id', itemIds);

        if (!menuItems || menuItems.length === 0) {
          return JSON.stringify({
            success: false,
            message: 'No se encontraron los items del menu.',
          });
        }

        let subtotal = 0;
        const itemsWithPrices = input.items.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menu_item_id);
          const itemTotal = (menuItem?.price || 0) * item.quantity;
          subtotal += itemTotal;
          return {
            menu_item_id: item.menu_item_id,
            menu_item_name: menuItem?.name || 'Item',
            quantity: item.quantity,
            unit_price: menuItem?.price || 0,
            total_price: itemTotal,
            special_instructions: item.special_instructions,
          };
        });

        const deliveryFee = calcResult[0].delivery_fee;
        const total = subtotal + deliveryFee;

        // Crear la orden
        const { data: order, error: orderError } = await supabase
          .from('restaurant_orders')
          .insert({
            tenant_id: config.tenantId,
            branch_id: config.branchId,
            display_number: nextNumber || 1,
            order_type: 'delivery',
            status: 'pending',
            delivery_status: 'pending',
            delivery_address: input.delivery_address,
            delivery_fee: deliveryFee,
            estimated_delivery_time: new Date(
              Date.now() + calcResult[0].estimated_minutes * 60 * 1000
            ).toISOString(),
            subtotal,
            total,
            customer_notes: input.customer_notes,
            source: 'ai_agent',
            conversation_id: config.conversationId,
            contact_id: config.contactId,
          })
          .select('id, display_number')
          .single();

        if (orderError || !order) {
          console.error('[create_delivery_order] Order error:', orderError);
          return JSON.stringify({
            success: false,
            message: 'Error al crear el pedido.',
          });
        }

        // Insertar items
        const orderItems = itemsWithPrices.map((item) => ({
          order_id: order.id,
          ...item,
        }));

        const { error: itemsError } = await supabase
          .from('restaurant_order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('[create_delivery_order] Items error:', itemsError);
          // Revertir orden si fallan los items
          await supabase
            .from('restaurant_orders')
            .delete()
            .eq('id', order.id);

          return JSON.stringify({
            success: false,
            message: 'Error al agregar items al pedido.',
          });
        }

        // Formatear resumen de items
        const itemsSummary = itemsWithPrices
          .map((i) => `${i.quantity}x ${i.menu_item_name}`)
          .join(', ');

        return JSON.stringify({
          success: true,
          order_id: order.id,
          order_number: order.display_number,
          items_summary: itemsSummary,
          subtotal,
          delivery_fee: deliveryFee,
          total,
          estimated_minutes: calcResult[0].estimated_minutes,
          message: `Pedido #${order.display_number} creado exitosamente. ${itemsSummary}. Subtotal: $${subtotal.toFixed(2)}, Envio: $${deliveryFee.toFixed(2)}, Total: $${total.toFixed(2)} MXN. Tiempo estimado de entrega: ${calcResult[0].estimated_minutes} minutos.`,
        });
      } catch (error) {
        console.error('[create_delivery_order] Exception:', error);
        return JSON.stringify({
          success: false,
          message: 'Error al crear el pedido de delivery.',
        });
      }
    },
  });
}
```

### 1.3 Tool: get_delivery_status

**Proposito:** Consultar el estado de un pedido de delivery.

#### Archivo: `src/features/ai/tools/restaurant/get-delivery-status.tool.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Get Delivery Status Tool
// Para Messaging Agent (LangGraph)
// =====================================================

import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { createServiceRoleClient } from '@/src/shared/lib/supabase-clients';

const GetDeliveryStatusInputSchema = z.object({
  order_number: z.number().int().positive().optional()
    .describe('Numero de orden del pedido'),
  order_id: z.string().uuid().optional()
    .describe('ID unico del pedido'),
  contact_phone: z.string().optional()
    .describe('Telefono del cliente para buscar su pedido mas reciente'),
});

type GetDeliveryStatusInput = z.infer<typeof GetDeliveryStatusInputSchema>;

interface GetDeliveryStatusConfig {
  tenantId: string;
  branchId: string;
  contactId?: string;
}

const DELIVERY_STATUS_MESSAGES: Record<string, string> = {
  pending: 'Tu pedido esta siendo preparado y pronto asignaremos un repartidor.',
  assigned: 'Un repartidor ha sido asignado a tu pedido y lo recogeremos pronto.',
  picked_up: 'El repartidor ya recogio tu pedido de la cocina.',
  in_transit: 'Tu pedido esta en camino.',
  delivered: 'Tu pedido ha sido entregado. Gracias por tu preferencia.',
  failed: 'Hubo un problema con la entrega. Un agente te contactara.',
};

export function createGetDeliveryStatusTool(config: GetDeliveryStatusConfig) {
  return new DynamicStructuredTool({
    name: 'get_delivery_status',
    description: `Consulta el estado de un pedido de delivery.
Puedes buscar por:
- Numero de orden (ej: #123)
- ID del pedido
- Telefono del cliente (busca su pedido mas reciente)

Retorna el estado actual y ubicacion estimada.`,
    schema: GetDeliveryStatusInputSchema,
    func: async (input: GetDeliveryStatusInput) => {
      const supabase = createServiceRoleClient();

      try {
        // Construir query base
        let query = supabase
          .from('restaurant_orders')
          .select(`
            id,
            display_number,
            status,
            order_type,
            delivery_status,
            delivery_address,
            estimated_delivery_time,
            actual_delivery_time,
            delivery_fee,
            total,
            created_at,
            staff:delivery_driver_id (
              first_name,
              phone
            )
          `)
          .eq('tenant_id', config.tenantId)
          .eq('order_type', 'delivery')
          .is('deleted_at', null);

        // Filtrar segun input
        if (input.order_id) {
          query = query.eq('id', input.order_id);
        } else if (input.order_number) {
          query = query.eq('display_number', input.order_number);
        } else if (config.contactId) {
          // Buscar por contactId del contexto
          query = query
            .eq('contact_id', config.contactId)
            .order('created_at', { ascending: false })
            .limit(1);
        } else if (input.contact_phone) {
          // Buscar por telefono en direccion
          query = query
            .filter('delivery_address->contact_phone', 'ilike', `%${input.contact_phone}%`)
            .order('created_at', { ascending: false })
            .limit(1);
        } else {
          return JSON.stringify({
            success: false,
            message: 'Necesito el numero de pedido o tu telefono para buscar tu orden.',
          });
        }

        const { data: orders, error } = await query;

        if (error) {
          console.error('[get_delivery_status] Error:', error);
          return JSON.stringify({
            success: false,
            message: 'Error al buscar el pedido.',
          });
        }

        if (!orders || orders.length === 0) {
          return JSON.stringify({
            success: false,
            message: 'No encontre ningun pedido de delivery con esos datos. Verifica el numero de pedido.',
          });
        }

        const order = orders[0];
        const statusMessage = DELIVERY_STATUS_MESSAGES[order.delivery_status] ||
          'Estado del pedido desconocido.';

        // Calcular tiempo restante estimado
        let timeRemaining = null;
        if (order.estimated_delivery_time && !order.actual_delivery_time) {
          const estimatedTime = new Date(order.estimated_delivery_time);
          const now = new Date();
          const diffMinutes = Math.round((estimatedTime.getTime() - now.getTime()) / 60000);
          if (diffMinutes > 0) {
            timeRemaining = `${diffMinutes} minutos aproximadamente`;
          }
        }

        // Construir respuesta
        const response: Record<string, unknown> = {
          success: true,
          order_number: order.display_number,
          delivery_status: order.delivery_status,
          status_message: statusMessage,
          total: order.total,
          delivery_fee: order.delivery_fee,
        };

        if (timeRemaining) {
          response.time_remaining = timeRemaining;
        }

        if (order.actual_delivery_time) {
          response.delivered_at = order.actual_delivery_time;
        }

        // Info del repartidor si esta asignado
        if (order.staff && order.delivery_status !== 'pending') {
          response.driver = {
            name: order.staff.first_name,
            phone: order.staff.phone,
          };
        }

        // Mensaje formateado para el cliente
        let message = `Pedido #${order.display_number}: ${statusMessage}`;
        if (timeRemaining) {
          message += ` Tiempo estimado de llegada: ${timeRemaining}.`;
        }
        if (order.staff && order.delivery_status === 'in_transit') {
          message += ` Tu repartidor es ${order.staff.first_name}.`;
        }

        response.message = message;

        return JSON.stringify(response);
      } catch (error) {
        console.error('[get_delivery_status] Exception:', error);
        return JSON.stringify({
          success: false,
          message: 'Error al consultar el estado del pedido.',
        });
      }
    },
  });
}
```

---

## 2. MODIFICACIONES A TOOLS EXISTENTES

### 2.1 Modificar: create_order.tool.ts

Agregar soporte para `order_type: 'delivery'` a la tool existente de crear pedidos.

#### Cambios en `src/features/ai/tools/restaurant/create-order.tool.ts`:

```typescript
// ANTES:
const CreateOrderInputSchema = z.object({
  items: z.array(OrderItemSchema),
  order_type: z.enum(['dine_in', 'pickup']).default('pickup'),
  customer_notes: z.string().optional(),
});

// DESPUES:
const CreateOrderInputSchema = z.object({
  items: z.array(OrderItemSchema),
  order_type: z.enum(['dine_in', 'pickup', 'delivery']).default('pickup'),
  customer_notes: z.string().optional(),
  // Nuevos campos opcionales para delivery
  delivery_address: DeliveryAddressSchema.optional()
    .describe('Direccion de entrega (requerido si order_type es delivery)'),
});

// Agregar validacion en la funcion:
func: async (input) => {
  // Validar que delivery tenga direccion
  if (input.order_type === 'delivery') {
    if (!input.delivery_address) {
      return JSON.stringify({
        success: false,
        message: 'Para pedidos de delivery necesito la direccion de entrega.',
      });
    }

    // Delegar a create_delivery_order internamente
    // O retornar instruccion de usar la tool especifica
    return JSON.stringify({
      success: false,
      message: 'Por favor usa la herramienta create_delivery_order para pedidos de delivery.',
      redirect_to: 'create_delivery_order',
    });
  }

  // ... resto del codigo existente para dine_in y pickup
}
```

### 2.2 Agregar al Tool Registry

#### Archivo: `src/features/ai/tools/restaurant/index.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Restaurant Tools Registry
// =====================================================

// Exportar tools existentes
export * from './check-reservation-availability.tool';
export * from './create-reservation.tool';
export * from './modify-reservation.tool';
export * from './cancel-reservation.tool';
export * from './get-menu.tool';
export * from './search-menu.tool';
export * from './create-order.tool';
export * from './get-order-status.tool';

// NUEVAS TOOLS DE DELIVERY
export * from './calculate-delivery-time.tool';
export * from './create-delivery-order.tool';
export * from './get-delivery-status.tool';

// Factory function actualizada
import { createCalculateDeliveryTimeTool } from './calculate-delivery-time.tool';
import { createCreateDeliveryOrderTool } from './create-delivery-order.tool';
import { createGetDeliveryStatusTool } from './get-delivery-status.tool';

export interface RestaurantToolsConfig {
  tenantId: string;
  branchId: string;
  conversationId?: string;
  contactId?: string;
  serviceOptions?: {
    pickup_enabled?: boolean;
    delivery_enabled?: boolean;
  };
}

export function createRestaurantTools(config: RestaurantToolsConfig) {
  const tools = [
    // ... tools existentes
  ];

  // Agregar tools de delivery solo si esta habilitado
  if (config.serviceOptions?.delivery_enabled) {
    tools.push(
      createCalculateDeliveryTimeTool({
        tenantId: config.tenantId,
        branchId: config.branchId,
      }),
      createCreateDeliveryOrderTool({
        tenantId: config.tenantId,
        branchId: config.branchId,
        conversationId: config.conversationId,
        contactId: config.contactId,
      }),
      createGetDeliveryStatusTool({
        tenantId: config.tenantId,
        branchId: config.branchId,
        contactId: config.contactId,
      })
    );
  }

  return tools;
}
```

---

## 3. INTEGRACION CON LANGGRAPH

### 3.1 Actualizar Agent State

#### Archivo: `src/features/ai/state/agent-state.ts`

```typescript
// Agregar campos relacionados a delivery en el estado
export interface AgentState {
  // ... campos existentes

  // NUEVO: Estado de delivery en curso
  pending_delivery?: {
    address_collected: boolean;
    address: DeliveryAddress | null;
    items_collected: boolean;
    items: OrderItem[];
    delivery_available: boolean;
    estimated_minutes?: number;
    delivery_fee?: number;
  };
}
```

### 3.2 Actualizar Specialist Agent para Delivery

Crear un nuevo nodo especialista para manejar el flujo de delivery:

#### Archivo: `src/features/ai/agents/specialists/delivery.agent.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Delivery Specialist Agent
// Maneja el flujo completo de pedidos delivery
// =====================================================

import { StateGraph } from '@langchain/langgraph';
import type { AgentState } from '../../state/agent-state';

/**
 * Delivery Specialist Agent
 *
 * Flujo:
 * 1. Verificar que delivery este habilitado
 * 2. Recopilar direccion de entrega
 * 3. Verificar disponibilidad con calculate_delivery_time
 * 4. Si no disponible, ofrecer pickup
 * 5. Recopilar items del pedido
 * 6. Confirmar con el cliente
 * 7. Crear orden con create_delivery_order
 */

export const DELIVERY_SPECIALIST_PROMPT = `
Eres un asistente especializado en pedidos para delivery.

Tu flujo de trabajo es:
1. PRIMERO pregunta la direccion de entrega (calle, numero, colonia)
2. Usa calculate_delivery_time para verificar disponibilidad
3. Si NO esta disponible, ofrece amablemente la opcion de pedido para recoger
4. Si esta disponible, informa el tiempo estimado y costo de envio
5. Pregunta que desea ordenar
6. Confirma el pedido completo: items, direccion, total
7. Pide nombre y telefono de contacto para la entrega
8. Usa create_delivery_order para crear el pedido

REGLAS:
- NUNCA crees un pedido sin antes verificar disponibilidad
- SIEMPRE confirma el total antes de crear el pedido
- Si el cliente cambia de opinion a pickup, transfierelo al flujo de pickup
- Se amable si la direccion esta fuera del radio de entrega

DATOS DEL NEGOCIO:
- Restaurante: {{businessName}}
- Direccion de sucursal: {{businessAddress}}
`;

export function createDeliverySpecialistNode() {
  // Implementacion del nodo
  // Usa las tools de delivery
  return async (state: AgentState) => {
    // ...
  };
}
```

---

## 4. INTEGRACION CON VOICE AGENT

### 4.1 Tool Definitions para VAPI

Las tools de delivery tambien deben exponerse para el Voice Agent via VAPI.

#### Archivo: `lib/voice-agent/tools/delivery-tools.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Voice Agent Delivery Tools
// Tool definitions para VAPI
// =====================================================

import type { VapiToolDefinition } from '../types/tools';

export const CALCULATE_DELIVERY_TIME_TOOL: VapiToolDefinition = {
  type: 'function',
  function: {
    name: 'calculate_delivery_time',
    description: 'Calcula el tiempo estimado y costo de delivery a una direccion. Verifica si esta dentro del radio de entrega.',
    parameters: {
      type: 'object',
      properties: {
        street: {
          type: 'string',
          description: 'Nombre de la calle',
        },
        number: {
          type: 'string',
          description: 'Numero de casa o edificio',
        },
        colony: {
          type: 'string',
          description: 'Nombre de la colonia',
        },
        reference: {
          type: 'string',
          description: 'Referencias adicionales para encontrar el lugar',
        },
      },
      required: ['street', 'number', 'colony'],
    },
  },
  server: {
    url: '{{VAPI_WEBHOOK_URL}}/tools/calculate-delivery-time',
  },
};

export const CREATE_DELIVERY_ORDER_TOOL: VapiToolDefinition = {
  type: 'function',
  function: {
    name: 'create_delivery_order',
    description: 'Crea un pedido para delivery. Solo usar despues de confirmar disponibilidad y el cliente ha confirmado.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Lista de items del pedido',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'integer' },
              special_instructions: { type: 'string' },
            },
            required: ['name', 'quantity'],
          },
        },
        delivery_address: {
          type: 'object',
          description: 'Direccion de entrega',
          properties: {
            street: { type: 'string' },
            number: { type: 'string' },
            colony: { type: 'string' },
            reference: { type: 'string' },
            contact_name: { type: 'string' },
            contact_phone: { type: 'string' },
          },
          required: ['street', 'number', 'colony', 'contact_name', 'contact_phone'],
        },
      },
      required: ['items', 'delivery_address'],
    },
  },
  server: {
    url: '{{VAPI_WEBHOOK_URL}}/tools/create-delivery-order',
  },
};

export const GET_DELIVERY_STATUS_TOOL: VapiToolDefinition = {
  type: 'function',
  function: {
    name: 'get_delivery_status',
    description: 'Consulta el estado de un pedido de delivery por numero de orden o telefono.',
    parameters: {
      type: 'object',
      properties: {
        order_number: {
          type: 'integer',
          description: 'Numero del pedido',
        },
        phone: {
          type: 'string',
          description: 'Telefono del cliente para buscar su pedido mas reciente',
        },
      },
    },
  },
  server: {
    url: '{{VAPI_WEBHOOK_URL}}/tools/get-delivery-status',
  },
};

// Exportar todas las tools de delivery
export const DELIVERY_TOOLS = [
  CALCULATE_DELIVERY_TIME_TOOL,
  CREATE_DELIVERY_ORDER_TOOL,
  GET_DELIVERY_STATUS_TOOL,
];
```

### 4.2 Webhook Handlers para Voice Agent

#### Archivo: `app/api/voice-agent/tools/calculate-delivery-time/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Voice Agent Tool Handler
// calculate_delivery_time webhook
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/src/shared/lib/supabase-clients';
import { validateVapiSignature } from '@/lib/voice-agent/utils/vapi-signature';

export async function POST(request: NextRequest) {
  // Validar firma de VAPI
  const isValid = await validateVapiSignature(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = await request.json();
  const { call, toolCallId, functionName, functionArguments } = body;

  // Extraer configuracion del metadata de la llamada
  const { tenantId, branchId } = call.metadata || {};

  if (!tenantId || !branchId) {
    return NextResponse.json({
      results: [{
        toolCallId,
        result: JSON.stringify({
          success: false,
          message: 'Configuracion de llamada incompleta.',
        }),
      }],
    });
  }

  const supabase = createServiceRoleClient();

  try {
    const { street, number, colony, reference } = functionArguments;

    const deliveryAddress = {
      street,
      exterior_number: number,
      colony,
      reference: reference || null,
      city: 'Nogales', // Default para voice
    };

    const { data, error } = await supabase.rpc('calculate_delivery_time', {
      p_tenant_id: tenantId,
      p_branch_id: branchId,
      p_delivery_address: deliveryAddress,
    });

    if (error || !data?.[0]) {
      return NextResponse.json({
        results: [{
          toolCallId,
          result: JSON.stringify({
            success: false,
            message: 'Error al verificar disponibilidad de delivery.',
          }),
        }],
      });
    }

    const result = data[0];

    if (!result.is_within_radius) {
      return NextResponse.json({
        results: [{
          toolCallId,
          result: JSON.stringify({
            success: true,
            available: false,
            message: `Lo siento, esa direccion esta fuera de nuestro radio de entrega. Esta a ${result.distance_km.toFixed(1)} kilometros. Te puedo ofrecer pedido para recoger en nuestra sucursal.`,
          }),
        }],
      });
    }

    return NextResponse.json({
      results: [{
        toolCallId,
        result: JSON.stringify({
          success: true,
          available: true,
          estimated_minutes: result.estimated_minutes,
          delivery_fee: result.delivery_fee,
          message: `Perfecto, si podemos entregar a esa direccion. El tiempo estimado es de ${result.estimated_minutes} minutos y el costo de envio es de ${result.delivery_fee} pesos.`,
        }),
      }],
    });
  } catch (error) {
    console.error('[Voice Tool] calculate_delivery_time error:', error);
    return NextResponse.json({
      results: [{
        toolCallId,
        result: JSON.stringify({
          success: false,
          message: 'Hubo un error al verificar el delivery.',
        }),
      }],
    });
  }
}
```

---

## 5. FLUJOS DE CONVERSACION

### 5.1 Flujo de Delivery - Messaging

```
Usuario: "Quiero ordenar para delivery"

Agente: "Con gusto te ayudo con tu pedido para delivery.
        Para verificar que podamos entregar en tu zona,
        me podrias dar tu direccion? (calle, numero y colonia)"

Usuario: "Calle Sonora 123, colonia Centro"

[Agente usa calculate_delivery_time]

Agente: "Excelente, si llegamos a esa direccion.
        El tiempo estimado de entrega es de 45 minutos
        y el costo de envio es de $35 MXN.
        Que te gustaria ordenar?"

Usuario: "2 hamburguesas clasicas y unas papas grandes"

Agente: "Perfecto, tu pedido seria:
        - 2x Hamburguesa Clasica ($150 c/u) = $300
        - 1x Papas Grandes = $65

        Subtotal: $365
        Envio: $35
        Total: $400 MXN

        Para completar tu pedido necesito tu nombre
        y un telefono de contacto para el repartidor."

Usuario: "Juan Perez, 6311234567"

Agente: "Perfecto! Confirmo tu pedido:
        2 hamburguesas clasicas y papas grandes
        Direccion: Calle Sonora 123, Col. Centro
        Contacto: Juan Perez - 6311234567
        Total: $400 MXN

        Confirmas el pedido?"

Usuario: "Si, confirmo"

[Agente usa create_delivery_order]

Agente: "Listo! Tu pedido #47 ha sido creado.
        Tiempo estimado de llegada: 45 minutos.
        Te avisaremos cuando el repartidor salga.
        Gracias por tu pedido!"
```

### 5.2 Flujo de Delivery - Fuera de Radio

```
Usuario: "Quiero delivery a calle Arizona 500, colonia Kennedy"

[Agente usa calculate_delivery_time]

Agente: "Lo siento, esa direccion esta fuera de nuestro
        radio de entrega (esta a 8.5 km).

        Te puedo ofrecer la opcion de pedido para recoger
        en nuestra sucursal en [direccion].

        Te gustaria ordenar para recoger?"
```

### 5.3 Flujo de Consulta de Estado

```
Usuario: "Donde va mi pedido?"

Agente: "Claro, me puedes dar el numero de tu pedido?"

Usuario: "Es el 47"

[Agente usa get_delivery_status]

Agente: "Tu pedido #47 esta en camino.
        Tu repartidor es Carlos y deberia llegar
        en aproximadamente 15 minutos.

        Si necesitas contactarlo, su numero es 631-XXX-XXXX"
```

---

## Validacion

### Checklist de Implementacion

- [ ] Tool `calculate_delivery_time` creada y probada
- [ ] Tool `create_delivery_order` creada y probada
- [ ] Tool `get_delivery_status` creada y probada
- [ ] Tools registradas en Restaurant Tools Registry
- [ ] Factory function actualizada con flag de delivery_enabled
- [ ] Integracion con LangGraph state
- [ ] Tool definitions para VAPI creadas
- [ ] Webhook handlers para Voice Agent
- [ ] Tests unitarios
- [ ] Tests de integracion

---

**Documento generado por Claude Opus 4.5**
**Fecha:** 2026-01-24
