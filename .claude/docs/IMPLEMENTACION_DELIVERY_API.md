# FASE 2.2: API Endpoints para Delivery

**Versión:** 1.0.0
**Fecha:** 2026-01-24
**Documento Padre:** IMPLEMENTACION_UNIFICACION_AGENTES_V1.md

---

## ÍNDICE

1. [Endpoints Nuevos](#1-endpoints-nuevos)
2. [Modificaciones a Endpoints Existentes](#2-modificaciones-a-endpoints-existentes)
3. [Schemas de Request/Response](#3-schemas-de-requestresponse)
4. [Implementación](#4-implementación)

---

## 1. ENDPOINTS NUEVOS

### 1.1 Calcular Tiempo de Delivery

```
POST /api/restaurant/delivery/calculate
```

**Propósito:** Calcular tiempo estimado y costo de delivery.

**Request:**
```typescript
{
  branch_id: string;
  delivery_address: {
    street: string;
    exterior_number: string;
    interior_number?: string;
    colony: string;
    city: string;
    postal_code: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    estimated_minutes: number;
    delivery_fee: number;
    is_within_radius: boolean;
    distance_km: number;
    available: boolean;
    message?: string; // Si no disponible, razón
  };
}
```

### 1.2 Actualizar Estado de Delivery

```
PATCH /api/restaurant/delivery/[orderId]/status
```

**Propósito:** Actualizar estado de entrega.

**Request:**
```typescript
{
  status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
  driver_id?: string;
  notes?: string;
  driver_location?: {
    lat: number;
    lng: number;
  };
}
```

**Response:**
```typescript
{
  success: true;
  data: {
    order_id: string;
    delivery_status: string;
    updated_at: string;
  };
}
```

### 1.3 Obtener Órdenes de Delivery

```
GET /api/restaurant/delivery/orders
```

**Query params:**
- `branch_id` (required)
- `status`: 'pending' | 'assigned' | 'in_transit' | 'all'
- `limit`: number (default 50)
- `offset`: number (default 0)

**Response:**
```typescript
{
  success: true;
  data: {
    orders: DeliveryOrder[];
    total: number;
    has_more: boolean;
  };
}
```

### 1.4 Asignar Repartidor

```
POST /api/restaurant/delivery/[orderId]/assign
```

**Request:**
```typescript
{
  driver_id: string;
  notes?: string;
}
```

### 1.5 Historial de Tracking

```
GET /api/restaurant/delivery/[orderId]/tracking
```

**Response:**
```typescript
{
  success: true;
  data: {
    order_id: string;
    current_status: string;
    history: Array<{
      status: string;
      timestamp: string;
      notes?: string;
      driver_location?: { lat: number; lng: number };
    }>;
  };
}
```

---

## 2. MODIFICACIONES A ENDPOINTS EXISTENTES

### 2.1 POST /api/restaurant/kitchen/orders

**Cambios:**
- Aceptar `order_type: 'delivery'`
- Aceptar `delivery_address` en el body
- Calcular `delivery_fee` automáticamente
- Calcular `estimated_delivery_time`

**Request Body Actualizado:**
```typescript
{
  // Existente
  branch_id: string;
  order_type: 'dine_in' | 'pickup' | 'delivery';
  items: OrderItem[];
  customer_notes?: string;

  // NUEVO para delivery
  delivery_address?: {
    street: string;
    exterior_number: string;
    interior_number?: string;
    colony: string;
    city: string;
    postal_code: string;
    reference?: string;
    contact_phone: string;
    contact_name: string;
    coordinates?: { lat: number; lng: number };
  };
}
```

### 2.2 GET /api/restaurant/kitchen/kds

**Cambios:**
- Incluir badge de tipo de orden
- Incluir dirección resumida para delivery
- Filtro opcional por `order_type`

**Response Actualizado:**
```typescript
{
  order_id: string;
  display_number: number;
  order_type: 'dine_in' | 'pickup' | 'delivery';
  order_type_badge: '🍽️' | '🛍️' | '🛵'; // NUEVO
  delivery_summary?: { // NUEVO, solo para delivery
    contact_name: string;
    address_short: string; // "Calle X #123, Col. Centro"
    estimated_time: string; // "45 min"
  };
  // ... resto igual
}
```

---

## 3. SCHEMAS DE REQUEST/RESPONSE

### 3.1 DeliveryAddress Schema

```typescript
// src/shared/types/delivery.ts

export interface DeliveryAddress {
  street: string;
  exterior_number: string;
  interior_number?: string;
  colony: string;
  city: string;
  postal_code: string;
  reference?: string;
  contact_phone: string;
  contact_name: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface DeliveryAddressValidation {
  isValid: boolean;
  errors: string[];
}

export function validateDeliveryAddress(
  address: Partial<DeliveryAddress>
): DeliveryAddressValidation {
  const errors: string[] = [];

  if (!address.street?.trim()) {
    errors.push('La calle es requerida');
  }
  if (!address.exterior_number?.trim()) {
    errors.push('El número exterior es requerido');
  }
  if (!address.colony?.trim()) {
    errors.push('La colonia es requerida');
  }
  if (!address.city?.trim()) {
    errors.push('La ciudad es requerida');
  }
  if (!address.contact_phone?.trim()) {
    errors.push('El teléfono de contacto es requerido');
  }
  if (!address.contact_name?.trim()) {
    errors.push('El nombre de contacto es requerido');
  }

  // Validar formato de teléfono mexicano
  if (address.contact_phone) {
    const phoneRegex = /^(\+52)?[\s]?[\d]{10}$/;
    if (!phoneRegex.test(address.contact_phone.replace(/[\s-]/g, ''))) {
      errors.push('El formato del teléfono no es válido');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

### 3.2 DeliveryOrder Schema

```typescript
export interface DeliveryOrder {
  order_id: string;
  display_number: number;
  status: OrderStatus;
  delivery_status: DeliveryStatus;
  delivery_address: DeliveryAddress;
  delivery_fee: number;
  estimated_delivery_time: string;
  actual_delivery_time?: string;
  driver?: {
    id: string;
    name: string;
    phone: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    special_instructions?: string;
  }>;
  subtotal: number;
  total: number;
  created_at: string;
  customer_notes?: string;
}

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed';
```

---

## 4. IMPLEMENTACIÓN

### 4.1 Archivo: `app/api/restaurant/delivery/calculate/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Delivery Calculation API
// Calculate delivery time and fee
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { isValidUUID } from '@/src/lib/api/auth-helper';
import {
  validateDeliveryAddress,
  type DeliveryAddress,
} from '@/src/shared/types/delivery';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Autenticación
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const { client: supabase, tenantId } = authResult;

    // Parse body
    const body = await request.json();
    const { branch_id, delivery_address } = body;

    // Validar branch_id
    if (!branch_id || !isValidUUID(branch_id)) {
      return NextResponse.json(
        { error: 'branch_id inválido' },
        { status: 400 }
      );
    }

    // Validar dirección
    const addressValidation = validateDeliveryAddress(delivery_address);
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { error: 'Dirección inválida', details: addressValidation.errors },
        { status: 400 }
      );
    }

    // Verificar que el tenant tiene delivery habilitado
    const { data: tenant } = await supabase
      .from('tenants')
      .select('service_options')
      .eq('id', tenantId)
      .single();

    if (!tenant?.service_options?.delivery_enabled) {
      return NextResponse.json({
        success: true,
        data: {
          available: false,
          message: 'El servicio de delivery no está habilitado para este negocio',
          estimated_minutes: 0,
          delivery_fee: 0,
          is_within_radius: false,
          distance_km: 0,
        },
      });
    }

    // Calcular usando la función de Supabase
    const { data: calculation, error } = await supabase
      .rpc('calculate_delivery_time', {
        p_tenant_id: tenantId,
        p_branch_id: branch_id,
        p_delivery_address: delivery_address,
      });

    if (error) {
      console.error('[Delivery Calculate] RPC error:', error);
      return NextResponse.json(
        { error: 'Error al calcular delivery' },
        { status: 500 }
      );
    }

    const result = calculation[0];

    return NextResponse.json({
      success: true,
      data: {
        available: result.is_within_radius,
        estimated_minutes: result.estimated_minutes,
        delivery_fee: result.delivery_fee,
        is_within_radius: result.is_within_radius,
        distance_km: result.distance_km,
        message: result.is_within_radius
          ? undefined
          : 'La dirección está fuera del radio de entrega',
      },
    });
  } catch (error) {
    console.error('[Delivery Calculate] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

### 4.2 Archivo: `app/api/restaurant/delivery/[orderId]/status/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Delivery Status Update API
// Update delivery status for an order
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { isValidUUID } from '@/src/lib/api/auth-helper';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // Autenticación
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const { client: supabase, tenantId, role } = authResult;

    // Verificar permisos (solo admin, owner, o staff con rol de delivery)
    if (!['owner', 'admin', 'staff'].includes(role)) {
      return NextResponse.json(
        { error: 'Sin permisos para actualizar estado de delivery' },
        { status: 403 }
      );
    }

    // Validar orderId
    if (!orderId || !isValidUUID(orderId)) {
      return NextResponse.json(
        { error: 'orderId inválido' },
        { status: 400 }
      );
    }

    // Parse body
    const body = await request.json();
    const { status, driver_id, notes, driver_location } = body;

    // Validar status
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Verificar que la orden existe y es del tenant
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('id, order_type, delivery_status')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    if (order.order_type !== 'delivery') {
      return NextResponse.json(
        { error: 'Esta orden no es de tipo delivery' },
        { status: 400 }
      );
    }

    // Construir actualización
    const updates: Record<string, unknown> = {
      delivery_status: status,
      updated_at: new Date().toISOString(),
    };

    if (driver_id && isValidUUID(driver_id)) {
      updates.delivery_driver_id = driver_id;
    }

    if (notes) {
      updates.delivery_notes = notes;
    }

    if (status === 'delivered') {
      updates.actual_delivery_time = new Date().toISOString();
    }

    // Actualizar orden
    const { data: updatedOrder, error: updateError } = await supabase
      .from('restaurant_orders')
      .update(updates)
      .eq('id', orderId)
      .select('id, delivery_status, updated_at')
      .single();

    if (updateError) {
      console.error('[Delivery Status] Update error:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar estado' },
        { status: 500 }
      );
    }

    // Insertar tracking manual si hay ubicación
    if (driver_location) {
      await supabase
        .from('delivery_tracking')
        .insert({
          order_id: orderId,
          status,
          driver_location,
          notes,
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: updatedOrder.id,
        delivery_status: updatedOrder.delivery_status,
        updated_at: updatedOrder.updated_at,
      },
    });
  } catch (error) {
    console.error('[Delivery Status] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

### 4.3 Archivo: `app/api/restaurant/delivery/orders/route.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Delivery Orders List API
// Get delivery orders for KDS/Delivery panel
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';
import { isValidUUID } from '@/src/lib/api/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Autenticación
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }
    const { client: supabase, tenantId } = authResult;

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const branch_id = searchParams.get('branch_id');
    const status = searchParams.get('status') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validar branch_id
    if (!branch_id || !isValidUUID(branch_id)) {
      return NextResponse.json(
        { error: 'branch_id es requerido' },
        { status: 400 }
      );
    }

    // Construir query
    let query = supabase
      .from('restaurant_orders')
      .select(`
        id,
        display_number,
        status,
        delivery_status,
        delivery_address,
        delivery_fee,
        estimated_delivery_time,
        actual_delivery_time,
        delivery_driver_id,
        customer_notes,
        created_at,
        restaurant_order_items (
          id,
          menu_item_name,
          quantity,
          special_instructions
        ),
        staff:delivery_driver_id (
          id,
          first_name,
          last_name,
          phone
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branch_id)
      .eq('order_type', 'delivery')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por estado si no es 'all'
    if (status !== 'all') {
      query = query.eq('delivery_status', status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      console.error('[Delivery Orders] Query error:', error);
      return NextResponse.json(
        { error: 'Error al obtener órdenes' },
        { status: 500 }
      );
    }

    // Formatear respuesta
    const formattedOrders = orders?.map((order) => ({
      order_id: order.id,
      display_number: order.display_number,
      status: order.status,
      delivery_status: order.delivery_status,
      delivery_address: order.delivery_address,
      delivery_fee: order.delivery_fee,
      estimated_delivery_time: order.estimated_delivery_time,
      actual_delivery_time: order.actual_delivery_time,
      driver: order.staff ? {
        id: order.staff.id,
        name: `${order.staff.first_name} ${order.staff.last_name}`,
        phone: order.staff.phone,
      } : null,
      items: order.restaurant_order_items?.map((item: Record<string, unknown>) => ({
        name: item.menu_item_name,
        quantity: item.quantity,
        special_instructions: item.special_instructions,
      })) || [],
      customer_notes: order.customer_notes,
      created_at: order.created_at,
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        orders: formattedOrders,
        total: count || 0,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('[Delivery Orders] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

---

## Siguientes Pasos

1. Implementar los endpoints listados
2. Actualizar el endpoint de crear orden para soportar delivery
3. Agregar tests unitarios
4. Documentar en Swagger/OpenAPI

---

**Documento generado por Claude Opus 4.5**
**Fecha:** 2026-01-24
