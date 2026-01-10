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
  canWrite,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizeInteger, sanitizePrice, LIMITS } from '@/src/lib/api/sanitization-helper';

// Valid movement types
const VALID_MOVEMENT_TYPES = [
  'purchase', 'sale', 'consumption', 'waste', 'adjustment',
  'transfer_in', 'transfer_out', 'return', 'production'
];

// Movement types that require manager+ permissions
const RESTRICTED_MOVEMENT_TYPES = ['adjustment', 'waste'];

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
    const limit = sanitizeInteger(searchParams.get('limit'), 1, LIMITS.MAX_QUERY_LIMIT, 100);

    // Validate required branch_id
    if (!branchId || !isValidUUID(branchId)) {
      return errorResponse('branch_id requerido e inválido', 400);
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

    // Validate optional item_id
    if (itemId) {
      if (!isValidUUID(itemId)) {
        return errorResponse('item_id inválido', 400);
      }
      query = query.eq('item_id', itemId);
    }

    // Validate movement_type
    if (movementType) {
      if (!VALID_MOVEMENT_TYPES.includes(movementType)) {
        return errorResponse(`Tipo de movimiento inválido. Permitidos: ${VALID_MOVEMENT_TYPES.join(', ')}`, 400);
      }
      query = query.eq('movement_type', movementType);
    }

    // Validate date filters
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return errorResponse('start_date inválido', 400);
      }
      query = query.gte('performed_at', start.toISOString());
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return errorResponse('end_date inválido', 400);
      }
      query = query.lte('performed_at', end.toISOString());
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

    // Validate required UUIDs
    if (!body.branch_id || !isValidUUID(body.branch_id)) {
      return errorResponse('branch_id inválido', 400);
    }

    if (!body.item_id || !isValidUUID(body.item_id)) {
      return errorResponse('item_id inválido', 400);
    }

    // Validate movement_type
    if (!body.movement_type || !VALID_MOVEMENT_TYPES.includes(body.movement_type)) {
      return errorResponse(`Tipo de movimiento inválido. Permitidos: ${VALID_MOVEMENT_TYPES.join(', ')}`, 400);
    }

    // Validate quantity (must exist and be a number)
    if (body.quantity === undefined || body.quantity === null) {
      return errorResponse('quantity es requerido', 400);
    }
    const quantity = sanitizeInteger(body.quantity, -999999, 999999, 0);
    if (quantity === 0) {
      return errorResponse('quantity no puede ser 0', 400);
    }

    // Check permissions for restricted movement types
    if (RESTRICTED_MOVEMENT_TYPES.includes(body.movement_type)) {
      if (!canWrite(userRole.role)) {
        return errorResponse('Sin permisos para este tipo de movimiento', 403);
      }
    }

    // Validate optional batch_id
    if (body.batch_id && !isValidUUID(body.batch_id)) {
      return errorResponse('batch_id inválido', 400);
    }

    // Validate optional reference_id
    if (body.reference_id && !isValidUUID(body.reference_id)) {
      return errorResponse('reference_id inválido', 400);
    }

    // Sanitize text fields
    const reason = sanitizeText(body.reason, LIMITS.MAX_TEXT_MEDIUM);
    const notes = sanitizeText(body.notes, LIMITS.MAX_TEXT_LONG);
    const referenceType = sanitizeText(body.reference_type, 50);

    // Sanitize numeric fields
    const unitCost = body.unit_cost !== undefined ? sanitizePrice(body.unit_cost) : null;

    // Use atomic function to create movement with FOR UPDATE lock
    // This prevents race conditions where two requests could read same stock
    const { data: result, error: rpcError } = await supabase.rpc('create_inventory_movement', {
      p_tenant_id: userRole.tenant_id,
      p_branch_id: body.branch_id,
      p_item_id: body.item_id,
      p_batch_id: body.batch_id || null,
      p_movement_type: body.movement_type,
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_reason: reason,
      p_notes: notes,
      p_reference_type: referenceType,
      p_reference_id: body.reference_id || null,
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
    const isOutbound = ['sale', 'consumption', 'waste', 'transfer_out'].includes(body.movement_type);
    if (body.batch_id && isValidUUID(body.batch_id) && isOutbound) {
      // Get current batch quantity first
      const { data: batch } = await supabase
        .from('inventory_batches')
        .select('current_quantity')
        .eq('id', body.batch_id)
        .eq('tenant_id', userRole.tenant_id) // Ensure batch belongs to same tenant
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
          .eq('id', body.batch_id)
          .eq('tenant_id', userRole.tenant_id); // Ensure tenant isolation
      }
    }

    return successResponse(movement, 201);

  } catch (error) {
    console.error('Create movement error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
