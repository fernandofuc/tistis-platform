// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Stats API
// GET: Get menu statistics
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ======================
// GET - Menu Statistics
// ======================
export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get user and tenant
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 });
    }

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userRole) {
      return NextResponse.json({ success: false, error: 'Sin tenant asociado' }, { status: 403 });
    }

    const tenantId = userRole.tenant_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branch_id');

    // Build base query filters
    const itemFilters: Record<string, any> = { tenant_id: tenantId, deleted_at: null };
    const categoryFilters: Record<string, any> = { tenant_id: tenantId, deleted_at: null };

    if (branchId) {
      itemFilters.branch_id = branchId;
      categoryFilters.branch_id = branchId;
    }

    // Get all items for stats calculation
    let itemsQuery = supabase
      .from('restaurant_menu_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (branchId) {
      itemsQuery = itemsQuery.eq('branch_id', branchId);
    }

    const { data: items } = await itemsQuery;
    const allItems = items || [];

    // Get categories count
    let categoriesQuery = supabase
      .from('restaurant_menu_categories')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (branchId) {
      categoriesQuery = categoriesQuery.eq('branch_id', branchId);
    }

    const { count: totalCategories } = await categoriesQuery;

    // Calculate item stats
    const stats = {
      total_items: allItems.length,
      total_categories: totalCategories || 0,
      available_items: allItems.filter(i => i.is_available).length,
      unavailable_items: allItems.filter(i => !i.is_available).length,
      featured_items: allItems.filter(i => i.is_featured).length,

      // Dietary stats
      vegetarian_items: allItems.filter(i => i.is_vegetarian).length,
      vegan_items: allItems.filter(i => i.is_vegan).length,
      gluten_free_items: allItems.filter(i => i.is_gluten_free).length,

      // Price stats
      avg_price: 0,
      min_price: 0,
      max_price: 0,
      price_ranges: {
        under_100: 0,
        '100_to_200': 0,
        '200_to_500': 0,
        over_500: 0,
      },

      // Profitability (if cost data available)
      items_with_cost: 0,
      avg_margin_percent: 0,
      low_margin_items: 0, // < 30%

      // Allergen stats
      allergens_distribution: {} as Record<string, number>,

      // Items by category
      items_by_category: {} as Record<string, { name: string; count: number }>,
    };

    // Calculate price stats
    const prices = allItems.map(i => i.price).filter(p => p > 0);
    if (prices.length > 0) {
      stats.avg_price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      stats.min_price = Math.min(...prices);
      stats.max_price = Math.max(...prices);

      // Price ranges
      prices.forEach(price => {
        if (price < 100) stats.price_ranges.under_100++;
        else if (price < 200) stats.price_ranges['100_to_200']++;
        else if (price < 500) stats.price_ranges['200_to_500']++;
        else stats.price_ranges.over_500++;
      });
    }

    // Calculate margin stats
    const itemsWithCost = allItems.filter(i => i.cost && i.cost > 0);
    stats.items_with_cost = itemsWithCost.length;

    if (itemsWithCost.length > 0) {
      const margins = itemsWithCost.map(i => {
        const margin = ((i.price - i.cost) / i.price) * 100;
        return margin;
      });

      stats.avg_margin_percent = Math.round(margins.reduce((a, b) => a + b, 0) / margins.length);
      stats.low_margin_items = margins.filter(m => m < 30).length;
    }

    // Allergen distribution
    allItems.forEach(item => {
      if (item.allergens && Array.isArray(item.allergens)) {
        item.allergens.forEach((allergen: string) => {
          stats.allergens_distribution[allergen] = (stats.allergens_distribution[allergen] || 0) + 1;
        });
      }
    });

    // Get categories for items_by_category
    let categoriesDataQuery = supabase
      .from('restaurant_menu_categories')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (branchId) {
      categoriesDataQuery = categoriesDataQuery.eq('branch_id', branchId);
    }

    const { data: categories } = await categoriesDataQuery;

    // Count items by category
    (categories || []).forEach(cat => {
      const count = allItems.filter(i => i.category_id === cat.id).length;
      stats.items_by_category[cat.id] = {
        name: cat.name,
        count,
      };
    });

    // Get popular items (would need order data - placeholder for now)
    const popularItems = allItems
      .filter(i => i.is_featured || i.is_available)
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        image_url: i.image_url,
      }));

    // Low margin items list
    const lowMarginItemsList = itemsWithCost
      .filter(i => {
        const margin = ((i.price - i.cost) / i.price) * 100;
        return margin < 30;
      })
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        cost: i.cost,
        margin_percent: Math.round(((i.price - i.cost) / i.price) * 100),
      }));

    // Map to expected format per MenuStats type
    return NextResponse.json({
      success: true,
      data: {
        total_categories: stats.total_categories,
        total_items: stats.total_items,
        available_items: stats.available_items,
        unavailable_items: stats.unavailable_items,
        featured_items: stats.featured_items,
        average_price: stats.avg_price,
        most_ordered: popularItems.map(item => ({
          id: item.id,
          name: item.name,
          times_ordered: 0, // TODO: Get from actual order data
          image_url: item.image_url,
        })),
        categories_breakdown: Object.entries(stats.items_by_category).map(([id, data]) => ({
          id,
          name: (data as { name: string; count: number }).name,
          items_count: (data as { name: string; count: number }).count,
        })),
        dietary_counts: {
          vegetarian: stats.vegetarian_items,
          vegan: stats.vegan_items,
          gluten_free: stats.gluten_free_items,
        },
      },
    });

  } catch (error) {
    console.error('Menu stats API error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
