// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Stats API
// GET: Get menu statistics
// Schema: restaurant_menu_items (088_RESTAURANT_VERTICAL_SCHEMA.sql)
// NOTE: restaurant_menu_items does NOT have branch_id column!
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse
} from '@/src/lib/api/auth-helper';

// ======================
// GET - Menu Statistics
// ======================
export async function GET(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;
    const tenantId = userRole.tenant_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get('branch_id');

    // NOTE: restaurant_menu_items does NOT have branch_id column
    // But restaurant_menu_categories DOES have branch_id (optional)
    // We filter items by category's branch_id if needed

    // Get all items for stats calculation
    // Items don't have branch_id, so we get all tenant items
    const { data: items, error: itemsError } = await supabase
      .from('restaurant_menu_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (itemsError) {
      console.error('Error fetching items:', JSON.stringify(itemsError));
      return errorResponse(`Error al cargar items: ${itemsError.message}`, 500);
    }

    const allItems = items || [];

    // Get categories count - categories DO have branch_id
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

      // NOTE: Schema does NOT have 'cost' column - margin stats removed

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

    // NOTE: Schema doesn't have 'cost' column - skipping margin calculations

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

    // Get popular items - use times_ordered from schema
    const popularItems = allItems
      .sort((a, b) => (b.times_ordered || 0) - (a.times_ordered || 0))
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        image_url: i.image_url,
        times_ordered: i.times_ordered || 0,
      }));

    // Map to expected format per MenuStats type
    return successResponse({
      total_categories: stats.total_categories,
      total_items: stats.total_items,
      available_items: stats.available_items,
      unavailable_items: stats.unavailable_items,
      featured_items: stats.featured_items,
      average_price: stats.avg_price,
      most_ordered: popularItems.map(item => ({
        id: item.id,
        name: item.name,
        times_ordered: item.times_ordered,
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
    });

  } catch (error: any) {
    console.error('Menu stats API error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}
