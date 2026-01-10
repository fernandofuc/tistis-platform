// =====================================================
// TIS TIS PLATFORM - Restaurant Kitchen Orders API
// GET: List orders, POST: Create order
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  isValidUUID,
} from '@/src/lib/api/auth-helper';

// ======================
// SECURITY HELPERS
// ======================

// Sanitize text to prevent XSS - strips HTML tags and limits length
function sanitizeText(text: unknown, maxLength = 1000): string | null {
  if (text === null || text === undefined) return null;
  if (typeof text !== 'string') return null;

  // Remove HTML tags and trim
  const sanitized = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '')    // Remove any remaining angle brackets
    .trim();

  // Limit length
  return sanitized.slice(0, maxLength) || null;
}

// Validate and sanitize numeric values
function sanitizeNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (value === null || value === undefined) return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

// Validate positive price (prevents negative prices)
function sanitizePrice(value: unknown, maxValue = 999999.99): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return 0;
  // Round to 2 decimal places and clamp
  return Math.max(0, Math.min(maxValue, Math.round(num * 100) / 100));
}

// Valid order types
const VALID_ORDER_TYPES = ['dine_in', 'takeout', 'delivery', 'drive_thru', 'catering'] as const;

// Valid kitchen stations
const VALID_STATIONS = ['main', 'grill', 'fry', 'salad', 'sushi', 'pizza', 'dessert', 'bar', 'expeditor', 'prep', 'assembly'] as const;

// Limits
const MAX_ITEMS_PER_ORDER = 50;
const MAX_QUERY_LIMIT = 200;
const MAX_ADDONS_PER_ITEM = 20;

// Sanitize delivery address JSONB
function sanitizeDeliveryAddress(address: unknown): Record<string, unknown> | null {
  if (!address || typeof address !== 'object') return null;
  const addr = address as Record<string, unknown>;

  return {
    street: sanitizeText(addr.street, 255) || '',
    number: sanitizeText(addr.number, 50) || '',
    apartment: sanitizeText(addr.apartment, 50) || null,
    city: sanitizeText(addr.city, 100) || '',
    postal_code: sanitizeText(addr.postal_code, 20) || '',
    lat: typeof addr.lat === 'number' && isFinite(addr.lat) ? Math.max(-90, Math.min(90, addr.lat)) : null,
    lng: typeof addr.lng === 'number' && isFinite(addr.lng) ? Math.max(-180, Math.min(180, addr.lng)) : null,
  };
}

// Sanitize add-on object
function sanitizeAddOn(addon: unknown): { name: string; price: number; quantity?: number } | null {
  if (!addon || typeof addon !== 'object') return null;
  const a = addon as Record<string, unknown>;
  const name = sanitizeText(a.name, 100);
  if (!name) return null;
  return {
    name,
    price: sanitizePrice(a.price),
    quantity: a.quantity !== undefined ? sanitizeNumber(a.quantity, 1, 10, 1) : undefined,
  };
}

// Sanitize modifier object
function sanitizeModifier(mod: unknown): { type: string; item: string; notes?: string } | null {
  if (!mod || typeof mod !== 'object') return null;
  const m = mod as Record<string, unknown>;
  const validTypes = ['remove', 'extra', 'substitute'];
  const type = typeof m.type === 'string' && validTypes.includes(m.type) ? m.type : null;
  const item = sanitizeText(m.item, 100);
  if (!type || !item) return null;
  return {
    type,
    item,
    notes: sanitizeText(m.notes, 200) || undefined,
  };
}

// ======================
// GET - List Orders
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const status = searchParams.get('status')?.split(',');
    const orderType = searchParams.get('order_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limitParam = parseInt(searchParams.get('limit') || '50');
    // Validate limit to prevent DoS
    const limit = Math.max(1, Math.min(limitParam, MAX_QUERY_LIMIT));

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    let query = supabase
      .from('restaurant_orders')
      .select(`
        *,
        table:restaurant_tables(table_number, zone),
        items:restaurant_order_items(*)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('ordered_at', { ascending: false })
      .limit(limit);

    if (status?.length) {
      query = query.in('status', status);
    }

    if (orderType) {
      query = query.eq('order_type', orderType);
    }

    if (dateFrom) {
      query = query.gte('ordered_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('ordered_at', dateTo);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return errorResponse('Error al obtener órdenes', 500);
    }

    return successResponse(orders);

  } catch (error) {
    console.error('Get orders error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Order
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const body = await request.json();

    const {
      branch_id,
      order_type,
      table_id,
      customer_id,
      server_id,
      priority,
      estimated_prep_time,
      customer_notes,
      kitchen_notes,
      internal_notes,
      delivery_address,
      delivery_instructions,
      delivery_fee,
      items,
    } = body;

    if (!branch_id || !isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (!items?.length) {
      return errorResponse('Debe incluir al menos un item', 400);
    }

    // Validate items count to prevent DoS
    if (items.length > MAX_ITEMS_PER_ORDER) {
      return errorResponse(`Máximo ${MAX_ITEMS_PER_ORDER} items por orden`, 400);
    }

    // Validate order_type
    const validatedOrderType = VALID_ORDER_TYPES.includes(order_type) ? order_type : 'dine_in';

    // Validate optional UUIDs
    if (table_id && !isValidUUID(table_id)) {
      return errorResponse('table_id inválido', 400);
    }
    if (customer_id && !isValidUUID(customer_id)) {
      return errorResponse('customer_id inválido', 400);
    }
    if (server_id && !isValidUUID(server_id)) {
      return errorResponse('server_id inválido', 400);
    }

    // Sanitize numeric values
    const sanitizedPriority = sanitizeNumber(priority, 1, 5, 3);
    const sanitizedPrepTime = estimated_prep_time ? sanitizeNumber(estimated_prep_time, 1, 480, 30) : null;
    const sanitizedDeliveryFee = sanitizePrice(delivery_fee);

    // Sanitize text fields (XSS prevention)
    const sanitizedCustomerNotes = sanitizeText(customer_notes, 500);
    const sanitizedKitchenNotes = sanitizeText(kitchen_notes, 500);
    const sanitizedInternalNotes = sanitizeText(internal_notes, 1000);
    const sanitizedDeliveryInstructions = sanitizeText(delivery_instructions, 500);
    const sanitizedDeliveryAddress = sanitizeDeliveryAddress(delivery_address);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        order_type: validatedOrderType,
        table_id: table_id || null,
        customer_id: customer_id || null,
        server_id: server_id || null,
        priority: sanitizedPriority,
        estimated_prep_time: sanitizedPrepTime,
        customer_notes: sanitizedCustomerNotes,
        kitchen_notes: sanitizedKitchenNotes,
        internal_notes: sanitizedInternalNotes,
        delivery_address: sanitizedDeliveryAddress,
        delivery_instructions: sanitizedDeliveryInstructions,
        delivery_fee: sanitizedDeliveryFee,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return errorResponse('Error al crear orden', 500);
    }

    // Create order items with sanitization
    const orderItems = items.map((item: any, index: number) => {
      // Validate menu_item_id if provided
      const menuItemId = item.menu_item_id && isValidUUID(item.menu_item_id) ? item.menu_item_id : null;

      // Sanitize prices and quantities
      const quantity = sanitizeNumber(item.quantity, 1, 100, 1);
      const unitPrice = sanitizePrice(item.unit_price);
      const variantPrice = sanitizePrice(item.variant_price);
      const sizePrice = sanitizePrice(item.size_price);

      // Calculate subtotal safely (prevent overflow)
      const subtotal = sanitizePrice(quantity * unitPrice + variantPrice + sizePrice);

      // Validate kitchen station
      const kitchenStation = VALID_STATIONS.includes(item.kitchen_station) ? item.kitchen_station : 'main';

      // Sanitize add_ons array deeply
      const sanitizedAddOns = Array.isArray(item.add_ons)
        ? item.add_ons.slice(0, MAX_ADDONS_PER_ITEM).map(sanitizeAddOn).filter(Boolean)
        : [];

      // Sanitize modifiers array deeply
      const sanitizedModifiers = Array.isArray(item.modifiers)
        ? item.modifiers.slice(0, MAX_ADDONS_PER_ITEM).map(sanitizeModifier).filter(Boolean)
        : [];

      return {
        tenant_id: userRole.tenant_id,
        order_id: order.id,
        menu_item_id: menuItemId,
        menu_item_name: sanitizeText(item.menu_item_name, 255) || 'Item sin nombre',
        quantity,
        unit_price: unitPrice,
        subtotal,
        variant_name: sanitizeText(item.variant_name, 100),
        variant_price: variantPrice,
        size_name: sanitizeText(item.size_name, 50),
        size_price: sizePrice,
        add_ons: sanitizedAddOns,
        modifiers: sanitizedModifiers,
        kitchen_station: kitchenStation,
        special_instructions: sanitizeText(item.special_instructions, 500),
        allergen_notes: sanitizeText(item.allergen_notes, 255),
        is_complimentary: Boolean(item.is_complimentary),
        complimentary_reason: sanitizeText(item.complimentary_reason, 255),
        display_order: sanitizeNumber(item.display_order, 0, 999, index),
        status: 'pending',
      };
    });

    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback order
      await supabase.from('restaurant_orders').delete().eq('id', order.id);
      return errorResponse('Error al crear items de orden', 500);
    }

    // Fetch complete order with items
    const { data: completeOrder } = await supabase
      .from('restaurant_orders')
      .select(`
        *,
        table:restaurant_tables(table_number, zone),
        items:restaurant_order_items(*)
      `)
      .eq('id', order.id)
      .single();

    return successResponse(completeOrder, 201);

  } catch (error) {
    console.error('Create order error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
