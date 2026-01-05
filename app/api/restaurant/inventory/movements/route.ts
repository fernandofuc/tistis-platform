// =====================================================
// TIS TIS PLATFORM - Inventory Movements API
// GET: List movements, POST: Create movement
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
// GET - List Movements
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
    const itemId = searchParams.get('item_id');
    const movementType = searchParams.get('movement_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido', 400);
    }

    let query = supabase
      .from('inventory_movements')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit),
        batch:inventory_batches(id, batch_number, expiration_date)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .eq('branch_id', branchId)
      .order('performed_at', { ascending: false })
      .limit(limit);

    if (itemId && isValidUUID(itemId)) {
      query = query.eq('item_id', itemId);
    }

    if (movementType) {
      query = query.eq('movement_type', movementType);
    }

    if (startDate) {
      query = query.gte('performed_at', startDate);
    }

    if (endDate) {
      query = query.lte('performed_at', endDate);
    }

    const { data: movements, error } = await query;

    if (error) {
      console.error('Error fetching movements:', error);
      return errorResponse('Error al obtener movimientos', 500);
    }

    return successResponse(movements);

  } catch (error) {
    console.error('Get movements error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Movement
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { user, userRole, supabase } = auth;

    const body = await request.json();
    const {
      branch_id,
      item_id,
      batch_id,
      movement_type,
      quantity,
      unit_cost,
      reason,
      notes,
      reference_type,
      reference_id,
    } = body;

    if (!branch_id || !isValidUUID(branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (!item_id || !isValidUUID(item_id)) {
      return errorResponse('item_id inválido', 400);
    }

    if (!movement_type || quantity === undefined) {
      return errorResponse('movement_type y quantity son requeridos', 400);
    }

    // Validate movement type
    const validTypes = ['purchase', 'sale', 'consumption', 'waste', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'production'];
    if (!validTypes.includes(movement_type)) {
      return errorResponse('Tipo de movimiento inválido', 400);
    }

    // Check permissions for certain movement types
    const restrictedTypes = ['adjustment', 'waste'];
    if (restrictedTypes.includes(movement_type) && !['owner', 'admin', 'manager'].includes(userRole.role)) {
      return errorResponse('Sin permisos para este tipo de movimiento', 403);
    }

    // Get current stock
    const { data: item } = await supabase
      .from('inventory_items')
      .select('current_stock, unit_cost')
      .eq('id', item_id)
      .single();

    if (!item) {
      return errorResponse('Item no encontrado', 404);
    }

    const previousStock = item.current_stock || 0;
    const finalQuantity = ['sale', 'consumption', 'waste', 'transfer_out'].includes(movement_type)
      ? -Math.abs(quantity)
      : Math.abs(quantity);
    const newStock = previousStock + finalQuantity;

    // Prevent negative stock
    if (newStock < 0) {
      return errorResponse(`Stock insuficiente. Disponible: ${previousStock}`, 400);
    }

    const totalCost = Math.abs(finalQuantity) * (unit_cost || item.unit_cost || 0);

    // Create movement (trigger will update stock)
    const { data: movement, error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        item_id,
        batch_id,
        movement_type,
        quantity: finalQuantity,
        previous_stock: previousStock,
        new_stock: newStock,
        unit_cost: unit_cost || item.unit_cost,
        total_cost: totalCost,
        reference_type,
        reference_id,
        performed_by: user.id,
        reason,
        notes,
      })
      .select(`
        *,
        item:inventory_items(id, name, sku, unit)
      `)
      .single();

    if (movementError) {
      console.error('Error creating movement:', movementError);
      return errorResponse('Error al crear movimiento', 500);
    }

    // Update batch quantity if batch_id provided
    if (batch_id && isValidUUID(batch_id) && finalQuantity < 0) {
      // Get current batch quantity first
      const { data: batch } = await supabase
        .from('inventory_batches')
        .select('current_quantity')
        .eq('id', batch_id)
        .single();

      if (batch) {
        const newBatchQuantity = Math.max(0, (batch.current_quantity || 0) - Math.abs(finalQuantity));
        await supabase
          .from('inventory_batches')
          .update({
            current_quantity: newBatchQuantity,
            status: newBatchQuantity <= 0 ? 'consumed' : 'available',
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch_id);
      }
    }

    return successResponse(movement, 201);

  } catch (error) {
    console.error('Create movement error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
