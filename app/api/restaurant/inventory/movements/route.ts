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

    // Use atomic function to create movement with FOR UPDATE lock
    // This prevents race conditions where two requests could read same stock
    const { data: result, error: rpcError } = await supabase.rpc('create_inventory_movement', {
      p_tenant_id: userRole.tenant_id,
      p_branch_id: branch_id,
      p_item_id: item_id,
      p_batch_id: batch_id || null,
      p_movement_type: movement_type,
      p_quantity: quantity,
      p_unit_cost: unit_cost || null,
      p_reason: reason || null,
      p_notes: notes || null,
      p_reference_type: reference_type || null,
      p_reference_id: reference_id || null,
      p_performed_by: user.id,
    });

    if (rpcError) {
      console.error('Error creating movement (RPC):', rpcError);
      return errorResponse('Error al crear movimiento', 500);
    }

    const movementResult = result?.[0];
    if (!movementResult?.success) {
      return errorResponse(movementResult?.error_message || 'Error al crear movimiento', 400);
    }

    // Fetch the full movement data with relations
    const { data: movement, error: fetchError } = await supabase
      .from('inventory_movements')
      .select(`
        *,
        item:inventory_items(id, name, sku, unit)
      `)
      .eq('id', movementResult.movement_id)
      .single();

    if (fetchError) {
      console.error('Error fetching movement:', fetchError);
      // Movement was created successfully, just couldn't fetch full data
      return successResponse({
        id: movementResult.movement_id,
        previous_stock: movementResult.previous_stock,
        new_stock: movementResult.new_stock,
      }, 201);
    }

    // Update batch quantity if batch_id provided and it was an outbound movement
    const isOutbound = ['sale', 'consumption', 'waste', 'transfer_out'].includes(movement_type);
    if (batch_id && isValidUUID(batch_id) && isOutbound) {
      // Get current batch quantity first
      const { data: batch } = await supabase
        .from('inventory_batches')
        .select('current_quantity')
        .eq('id', batch_id)
        .single();

      if (batch) {
        const newBatchQuantity = Math.max(0, (batch.current_quantity || 0) - Math.abs(quantity));
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
