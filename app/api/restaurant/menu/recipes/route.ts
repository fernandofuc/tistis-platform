// =====================================================
// TIS TIS PLATFORM - Restaurant Menu Recipes API
// GET: Get recipe for item, POST: Create/Update recipe
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  getUserAndTenant,
  isAuthError,
  errorResponse,
  successResponse,
  canWrite,
  canDelete
} from '@/src/lib/api/auth-helper';

// ======================
// GET - Get Recipe for Menu Item
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
    const menuItemId = searchParams.get('menu_item_id');

    if (!menuItemId) {
      return errorResponse('menu_item_id es requerido', 400);
    }

    // Verify menu item belongs to tenant
    const { data: menuItem, error: menuItemError } = await supabase
      .from('restaurant_menu_items')
      .select('id, name, price')
      .eq('id', menuItemId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (menuItemError || !menuItem) {
      return errorResponse('Platillo no encontrado', 404);
    }

    // Get recipe with ingredients
    const { data: recipe, error: recipeError } = await supabase
      .from('menu_item_recipes')
      .select(`
        *,
        ingredients:recipe_ingredients(
          *,
          inventory_item:inventory_items(
            id,
            name,
            sku,
            unit,
            unit_cost,
            current_stock,
            minimum_stock,
            image_url
          )
        )
      `)
      .eq('menu_item_id', menuItemId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (recipeError && recipeError.code !== 'PGRST116') {
      console.error('Error fetching recipe:', JSON.stringify(recipeError));
      return errorResponse(`Error al cargar receta: ${recipeError.message}`, 500);
    }

    // Sort ingredients by display_order
    if (recipe?.ingredients) {
      recipe.ingredients.sort((a: { display_order: number }, b: { display_order: number }) =>
        (a.display_order || 0) - (b.display_order || 0)
      );
    }

    return successResponse({
      menu_item: menuItem,
      recipe: recipe || null,
    });

  } catch (error: any) {
    console.error('Get recipe error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// POST - Create or Update Recipe
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para gestionar recetas', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse body
    const body = await request.json();
    const {
      menu_item_id,
      yield_quantity = 1,
      yield_unit = 'porcion',
      preparation_notes,
      storage_notes,
      ingredients = [],
    } = body;

    // Validate required fields
    if (!menu_item_id) {
      return errorResponse('menu_item_id es requerido', 400);
    }

    // Verify menu item belongs to tenant
    const { data: menuItem, error: menuItemError } = await supabase
      .from('restaurant_menu_items')
      .select('id, name, price')
      .eq('id', menu_item_id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (menuItemError || !menuItem) {
      return errorResponse('Platillo no encontrado', 404);
    }

    // Check if recipe already exists
    const { data: existingRecipe } = await supabase
      .from('menu_item_recipes')
      .select('id')
      .eq('menu_item_id', menu_item_id)
      .eq('tenant_id', tenantId)
      .single();

    let recipeId: string;

    if (existingRecipe) {
      // Update existing recipe
      const { data: updatedRecipe, error: updateError } = await supabase
        .from('menu_item_recipes')
        .update({
          yield_quantity,
          yield_unit,
          preparation_notes: preparation_notes || null,
          storage_notes: storage_notes || null,
          is_active: true,
        })
        .eq('id', existingRecipe.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating recipe:', JSON.stringify(updateError));
        return errorResponse(`Error al actualizar receta: ${updateError.message}`, 500);
      }

      recipeId = updatedRecipe.id;

      // Delete existing ingredients
      await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId);
    } else {
      // Create new recipe
      const { data: newRecipe, error: insertError } = await supabase
        .from('menu_item_recipes')
        .insert({
          tenant_id: tenantId,
          menu_item_id,
          yield_quantity,
          yield_unit,
          preparation_notes: preparation_notes || null,
          storage_notes: storage_notes || null,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating recipe:', JSON.stringify(insertError));
        return errorResponse(`Error al crear receta: ${insertError.message}`, 500);
      }

      recipeId = newRecipe.id;
    }

    // Insert ingredients if provided
    if (ingredients.length > 0) {
      // Verify all inventory items belong to tenant
      const inventoryItemIds = ingredients.map((i: { inventory_item_id: string }) => i.inventory_item_id);
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('id, unit_cost')
        .in('id', inventoryItemIds)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      const validItemIds = new Set(inventoryItems?.map(i => i.id) || []);
      const itemCosts = new Map(inventoryItems?.map(i => [i.id, i.unit_cost || 0]) || []);

      const ingredientsToInsert = ingredients
        .filter((i: { inventory_item_id: string }) => validItemIds.has(i.inventory_item_id))
        .map((ingredient: {
          inventory_item_id: string;
          quantity: number;
          unit: string;
          preparation_notes?: string;
          is_optional?: boolean;
          display_order?: number;
        }, index: number) => {
          const unitCost = itemCosts.get(ingredient.inventory_item_id) || 0;
          return {
            tenant_id: tenantId,
            recipe_id: recipeId,
            inventory_item_id: ingredient.inventory_item_id,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            unit_cost: unitCost,
            total_cost: unitCost * ingredient.quantity,
            preparation_notes: ingredient.preparation_notes || null,
            is_optional: ingredient.is_optional || false,
            display_order: ingredient.display_order ?? index,
          };
        });

      if (ingredientsToInsert.length > 0) {
        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientsToInsert);

        if (ingredientsError) {
          console.error('Error inserting ingredients:', JSON.stringify(ingredientsError));
          return errorResponse(`Error al guardar ingredientes: ${ingredientsError.message}`, 500);
        }
      }
    }

    // Fetch complete recipe with ingredients
    const { data: finalRecipe } = await supabase
      .from('menu_item_recipes')
      .select(`
        *,
        ingredients:recipe_ingredients(
          *,
          inventory_item:inventory_items(
            id,
            name,
            sku,
            unit,
            unit_cost,
            current_stock,
            minimum_stock,
            image_url
          )
        )
      `)
      .eq('id', recipeId)
      .single();

    // Sort ingredients
    if (finalRecipe?.ingredients) {
      finalRecipe.ingredients.sort((a: { display_order: number }, b: { display_order: number }) =>
        (a.display_order || 0) - (b.display_order || 0)
      );
    }

    return successResponse({
      menu_item: menuItem,
      recipe: finalRecipe,
    });

  } catch (error: any) {
    console.error('Save recipe error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}

// ======================
// DELETE - Delete Recipe
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canDelete(userRole.role)) {
      return errorResponse('Sin permisos para eliminar recetas', 403);
    }

    const tenantId = userRole.tenant_id;

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const menuItemId = searchParams.get('menu_item_id');

    if (!menuItemId) {
      return errorResponse('menu_item_id es requerido', 400);
    }

    // Get recipe
    const { data: recipe, error: fetchError } = await supabase
      .from('menu_item_recipes')
      .select('id')
      .eq('menu_item_id', menuItemId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !recipe) {
      return errorResponse('Receta no encontrada', 404);
    }

    // Delete ingredients first
    await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipe.id);

    // Delete recipe
    const { error: deleteError } = await supabase
      .from('menu_item_recipes')
      .delete()
      .eq('id', recipe.id);

    if (deleteError) {
      console.error('Error deleting recipe:', JSON.stringify(deleteError));
      return errorResponse(`Error al eliminar receta: ${deleteError.message}`, 500);
    }

    return successResponse({ deleted: true });

  } catch (error: any) {
    console.error('Delete recipe error:', error);
    return errorResponse(`Error interno: ${error?.message || 'Unknown'}`, 500);
  }
}
