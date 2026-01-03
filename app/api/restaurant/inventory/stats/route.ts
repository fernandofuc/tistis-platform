// =====================================================
// TIS TIS PLATFORM - Inventory Stats API
// GET: Get inventory statistics
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Sin tenant asociado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branch_id');

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'branch_id requerido' }, { status: 400 });
    }

    // Get all items for this tenant/branch
    const { data: items } = await supabase
      .from('inventory_items')
      .select(`
        id,
        name,
        current_stock,
        minimum_stock,
        unit,
        unit_cost,
        category_id,
        category:inventory_categories(id, name)
      `)
      .eq('tenant_id', userRole.tenant_id)
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .eq('is_active', true)
      .is('deleted_at', null);

    // Get categories count
    const { count: categoriesCount } = await supabase
      .from('inventory_categories')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null);

    // Get suppliers count
    const { count: suppliersCount } = await supabase
      .from('inventory_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null);

    // Get movements today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: movementsToday } = await supabase
      .from('inventory_movements')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .gte('performed_at', today.toISOString());

    // Get expiring batches
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    const { data: expiringBatches } = await supabase
      .from('inventory_batches')
      .select(`
        id,
        expiration_date,
        current_quantity,
        item:inventory_items(name)
      `)
      .eq('branch_id', branchId)
      .eq('status', 'available')
      .gt('current_quantity', 0)
      .not('expiration_date', 'is', null)
      .lte('expiration_date', twoWeeksFromNow.toISOString())
      .order('expiration_date', { ascending: true });

    // Calculate stats
    const totalItems = items?.length || 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const lowStockItems: any[] = [];
    const valueByCategory: Record<string, { value: number; items_count: number; category_name: string }> = {};

    items?.forEach(item => {
      const value = item.current_stock * item.unit_cost;
      totalValue += value;

      if (item.current_stock <= 0) {
        outOfStockCount++;
        lowStockCount++;
        lowStockItems.push({
          id: item.id,
          name: item.name,
          current_stock: item.current_stock,
          minimum_stock: item.minimum_stock,
          unit: item.unit,
        });
      } else if (item.current_stock <= item.minimum_stock) {
        lowStockCount++;
        lowStockItems.push({
          id: item.id,
          name: item.name,
          current_stock: item.current_stock,
          minimum_stock: item.minimum_stock,
          unit: item.unit,
        });
      }

      if (item.category_id) {
        const categoryName = (item.category as any)?.name || 'Sin categoría';
        if (!valueByCategory[item.category_id]) {
          valueByCategory[item.category_id] = {
            value: 0,
            items_count: 0,
            category_name: categoryName,
          };
        }
        valueByCategory[item.category_id].value += value;
        valueByCategory[item.category_id].items_count++;
      }
    });

    // Format expiring batches
    const formattedExpiringBatches = expiringBatches?.map(batch => {
      const expDate = new Date(batch.expiration_date!);
      const daysUntil = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return {
        batch_id: batch.id,
        item_name: (batch.item as any)?.name || 'Unknown',
        expiration_date: batch.expiration_date,
        days_until_expiration: daysUntil,
        quantity: batch.current_quantity,
      };
    }) || [];

    const stats = {
      total_items: totalItems,
      total_value: Math.round(totalValue * 100) / 100,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      expiring_soon_count: expiringBatches?.length || 0,
      categories_count: categoriesCount || 0,
      suppliers_count: suppliersCount || 0,
      movements_today: movementsToday || 0,
      value_by_category: Object.entries(valueByCategory).map(([id, data]) => ({
        category_id: id,
        category_name: data.category_name,
        value: Math.round(data.value * 100) / 100,
        items_count: data.items_count,
      })),
      low_stock_items: lowStockItems.slice(0, 10),
      expiring_batches: formattedExpiringBatches.slice(0, 10),
    };

    return NextResponse.json({ success: true, data: stats });

  } catch (error) {
    console.error('Inventory stats error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
