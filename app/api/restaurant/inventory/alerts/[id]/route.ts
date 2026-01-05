// =====================================================
// TIS TIS PLATFORM - Low Stock Alert Detail API
// GET: Get alert, PUT: Update status, DELETE: Dismiss
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

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// ======================
// GET - Get Alert
// ======================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de alerta inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    const { data: alert, error } = await supabase
      .from('low_stock_alerts')
      .select(`
        *,
        item:inventory_items(
          id,
          name,
          sku,
          unit,
          current_stock,
          minimum_stock,
          preferred_supplier_id,
          reorder_quantity,
          category:inventory_categories(id, name)
        ),
        suggested_supplier:inventory_suppliers(id, name, whatsapp, phone, email),
        associated_order:restock_orders(id, order_number, status, created_at),
        branch:branches(id, name)
      `)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .single();

    if (error || !alert) {
      return NextResponse.json({ success: false, error: 'Alerta no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: alert });

  } catch (error) {
    console.error('Get alert error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// PUT - Update Alert (Acknowledge, Resolve, etc.)
// ======================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de alerta inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { user, userRole, supabase } = result;

    const body = await request.json();
    const { action, associated_order_id, ...updateData } = body;

    // Manejar acciones específicas
    if (action) {
      switch (action) {
        case 'acknowledge':
          updateData.status = 'acknowledged';
          updateData.acknowledged_by = user.id;
          updateData.acknowledged_at = new Date().toISOString();
          break;

        case 'mark_ordered':
          updateData.status = 'ordered';
          if (associated_order_id) {
            updateData.associated_order_id = associated_order_id;
          }
          break;

        case 'resolve':
          updateData.status = 'resolved';
          updateData.resolved_by = user.id;
          updateData.resolved_at = new Date().toISOString();
          break;

        case 'reopen':
          updateData.status = 'open';
          updateData.resolved_by = null;
          updateData.resolved_at = null;
          break;

        default:
          return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
      }
    }

    const { data: alert, error } = await supabase
      .from('low_stock_alerts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select(`
        *,
        item:inventory_items(id, name, sku, unit, current_stock),
        suggested_supplier:inventory_suppliers(id, name, whatsapp)
      `)
      .single();

    if (error || !alert) {
      console.error('Error updating alert:', error);
      return NextResponse.json({ success: false, error: 'Error al actualizar alerta' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: alert });

  } catch (error) {
    console.error('Update alert error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// DELETE - Dismiss/Delete Alert
// ======================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID de alerta inválido' }, { status: 400 });
    }

    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para eliminar alertas' }, { status: 403 });
    }

    // Soft delete - marcar como resuelta y descartada
    const { error } = await supabase
      .from('low_stock_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        metadata: { dismissed: true, dismissed_at: new Date().toISOString() },
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('Error dismissing alert:', error);
      return NextResponse.json({ success: false, error: 'Error al descartar alerta' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Alerta descartada' });

  } catch (error) {
    console.error('Delete alert error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
