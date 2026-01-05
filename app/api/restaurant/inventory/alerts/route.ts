// =====================================================
// TIS TIS PLATFORM - Low Stock Alerts API
// GET: List alerts, POST: Create alert (manual/auto)
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
// GET - List Low Stock Alerts
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
    const status = searchParams.get('status');
    const alertType = searchParams.get('alert_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeResolved = searchParams.get('include_resolved') === 'true';

    let query = supabase
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
        suggested_supplier:inventory_suppliers(id, name, whatsapp, phone),
        associated_order:restock_orders(id, order_number, status),
        acknowledged_by_user:auth.users!low_stock_alerts_acknowledged_by_fkey(email),
        resolved_by_user:auth.users!low_stock_alerts_resolved_by_fkey(email)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (status) {
      query = query.eq('status', status);
    } else if (!includeResolved) {
      // Por defecto excluir resueltas
      query = query.in('status', ['open', 'acknowledged', 'ordered']);
    }

    if (alertType) {
      query = query.eq('alert_type', alertType);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener alertas' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: alerts });

  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Alert or Scan for Low Stock
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    const body = await request.json();
    const { action, branch_id } = body;

    // Acción especial: escanear inventario y crear alertas automáticamente
    if (action === 'scan') {
      if (!branch_id) {
        return NextResponse.json({ success: false, error: 'branch_id es requerido para escanear' }, { status: 400 });
      }

      // Obtener items con stock bajo
      const { data: lowStockItems, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name, current_stock, minimum_stock, preferred_supplier_id, reorder_quantity')
        .eq('tenant_id', userRole.tenant_id)
        .eq('branch_id', branch_id)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (itemsError) {
        console.error('Error scanning items:', itemsError);
        return NextResponse.json({ success: false, error: 'Error al escanear inventario' }, { status: 500 });
      }

      // Filtrar items con stock bajo
      const itemsBelowMinimum = (lowStockItems || []).filter(
        item => item.current_stock !== null &&
                item.minimum_stock !== null &&
                item.current_stock <= item.minimum_stock
      );

      // Obtener alertas existentes abiertas para estos items
      const existingAlertsQuery = await supabase
        .from('low_stock_alerts')
        .select('item_id')
        .eq('tenant_id', userRole.tenant_id)
        .eq('branch_id', branch_id)
        .in('status', ['open', 'acknowledged', 'ordered']);

      const existingAlertItemIds = new Set(
        (existingAlertsQuery.data || []).map(a => a.item_id)
      );

      // Crear alertas solo para items sin alerta existente
      const newAlerts = [];
      for (const item of itemsBelowMinimum) {
        if (!existingAlertItemIds.has(item.id)) {
          const alertType = item.current_stock <= (item.minimum_stock * 0.25) ? 'critical' : 'warning';
          const suggestedQuantity = item.reorder_quantity ||
            (item.minimum_stock - item.current_stock + (item.minimum_stock * 0.5));

          newAlerts.push({
            tenant_id: userRole.tenant_id,
            branch_id,
            item_id: item.id,
            alert_type: alertType,
            status: 'open',
            current_stock: item.current_stock,
            minimum_stock: item.minimum_stock,
            suggested_supplier_id: item.preferred_supplier_id,
            suggested_quantity: suggestedQuantity,
          });
        }
      }

      if (newAlerts.length > 0) {
        const { error: insertError } = await supabase
          .from('low_stock_alerts')
          .insert(newAlerts);

        if (insertError) {
          console.error('Error creating alerts:', insertError);
          return NextResponse.json({ success: false, error: 'Error al crear alertas' }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          scanned_items: lowStockItems?.length || 0,
          items_below_minimum: itemsBelowMinimum.length,
          new_alerts_created: newAlerts.length,
          existing_alerts: existingAlertItemIds.size,
        },
      });
    }

    // Crear alerta manual
    const {
      item_id,
      current_stock,
      minimum_stock,
      alert_type = 'warning',
      suggested_supplier_id,
      suggested_quantity,
    } = body;

    if (!branch_id || !item_id || current_stock === undefined || minimum_stock === undefined) {
      return NextResponse.json({ success: false, error: 'Datos incompletos' }, { status: 400 });
    }

    const { data: alert, error } = await supabase
      .from('low_stock_alerts')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        item_id,
        alert_type,
        status: 'open',
        current_stock,
        minimum_stock,
        suggested_supplier_id,
        suggested_quantity,
      })
      .select(`
        *,
        item:inventory_items(id, name, sku, unit)
      `)
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json({ success: false, error: 'Error al crear alerta' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: alert }, { status: 201 });

  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
