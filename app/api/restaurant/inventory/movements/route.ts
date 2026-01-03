// =====================================================
// TIS TIS PLATFORM - Inventory Movements API
// GET: List movements, POST: Create movement
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getUserAndTenant(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 };
  }
  const token = authHeader.substring(7);

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: 'Token inválido', status: 401 };
  }

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!userRole) {
    return { error: 'Sin tenant asociado', status: 403 };
  }

  return { user, userRole, supabase };
}

// ======================
// GET - List Movements
// ======================
export async function GET(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get('branch_id');
    const itemId = searchParams.get('item_id');
    const movementType = searchParams.get('movement_type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
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

    if (itemId) {
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
      return NextResponse.json({ success: false, error: 'Error al obtener movimientos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: movements });

  } catch (error) {
    console.error('Get movements error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Movement
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { user, userRole, supabase } = result;

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

    if (!branch_id || !item_id || !movement_type || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'branch_id, item_id, movement_type y quantity son requeridos'
      }, { status: 400 });
    }

    // Validate movement type
    const validTypes = ['purchase', 'sale', 'consumption', 'waste', 'adjustment', 'transfer_in', 'transfer_out', 'return', 'production'];
    if (!validTypes.includes(movement_type)) {
      return NextResponse.json({ success: false, error: 'Tipo de movimiento inválido' }, { status: 400 });
    }

    // Check permissions for certain movement types
    const restrictedTypes = ['adjustment', 'waste'];
    if (restrictedTypes.includes(movement_type) && !['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para este tipo de movimiento' }, { status: 403 });
    }

    // Get current stock
    const { data: item } = await supabase
      .from('inventory_items')
      .select('current_stock, unit_cost')
      .eq('id', item_id)
      .single();

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 });
    }

    const previousStock = item.current_stock || 0;
    const finalQuantity = ['sale', 'consumption', 'waste', 'transfer_out'].includes(movement_type)
      ? -Math.abs(quantity)
      : Math.abs(quantity);
    const newStock = previousStock + finalQuantity;

    // Prevent negative stock
    if (newStock < 0) {
      return NextResponse.json({
        success: false,
        error: `Stock insuficiente. Disponible: ${previousStock}`
      }, { status: 400 });
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
      return NextResponse.json({ success: false, error: 'Error al crear movimiento' }, { status: 500 });
    }

    // Update batch quantity if batch_id provided
    if (batch_id && finalQuantity < 0) {
      await supabase
        .from('inventory_batches')
        .update({
          current_quantity: supabase.rpc('decrement_quantity', {
            row_id: batch_id,
            amount: Math.abs(finalQuantity)
          })
        })
        .eq('id', batch_id);
    }

    return NextResponse.json({ success: true, data: movement }, { status: 201 });

  } catch (error) {
    console.error('Create movement error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
