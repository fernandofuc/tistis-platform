// =====================================================
// TIS TIS PLATFORM - Kitchen Item Station API
// PATCH: Assign item to kitchen station
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { VALID_KITCHEN_STATIONS, type KitchenStation } from '@/src/lib/api/sanitization-helper';

// ======================
// PATCH - Assign Station
// ======================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de item inválido' }, { status: 400 });
    }

    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { user, userRole, supabase } = auth;

    const body = await request.json();
    const { kitchen_station } = body;

    // Validate station value
    if (!kitchen_station || !VALID_KITCHEN_STATIONS.includes(kitchen_station as KitchenStation)) {
      return NextResponse.json({
        success: false,
        error: `Estación inválida. Valores permitidos: ${VALID_KITCHEN_STATIONS.join(', ')}`
      }, { status: 400 });
    }

    // Get current item with order info
    const { data: item, error: itemError } = await supabase
      .from('restaurant_order_items')
      .select(`
        *,
        order:restaurant_orders!inner(id, branch_id, tenant_id)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 });
    }

    // Don't allow station change for served/cancelled items
    if (item.status === 'served' || item.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: `No se puede cambiar estación de items ${item.status === 'served' ? 'servidos' : 'cancelados'}`
      }, { status: 400 });
    }

    const previousStation = item.kitchen_station;

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('restaurant_order_items')
      .update({
        kitchen_station,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating item station:', updateError);
      return NextResponse.json({ success: false, error: 'Error al asignar estación' }, { status: 500 });
    }

    // Log activity
    await supabase.from('kds_activity_log').insert({
      tenant_id: userRole.tenant_id,
      branch_id: item.order.branch_id,
      order_id: item.order_id,
      order_item_id: id,
      action: 'station_assigned',
      performed_by: user.id,
      previous_status: previousStation,
      new_status: kitchen_station,
    });

    return NextResponse.json({
      success: true,
      data: updatedItem,
      message: `Asignado a estación: ${kitchen_station}`
    });

  } catch (error) {
    console.error('Assign station error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
