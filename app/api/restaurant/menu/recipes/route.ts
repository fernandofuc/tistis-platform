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
  canDelete,
  isValidUUID,
} from '@/src/lib/api/auth-helper';
import { sanitizeText, sanitizeInteger, isSafeKey, LIMITS } from '@/src/lib/api/sanitization-helper';

// Constants for recipe limits
const MAX_INGREDIENTS_PER_RECIPE = 100;
const MAX_QUANTITY = 100000; // Reasonable max for ingredient quantities

// Sanitize a single ingredient entry (H13: prototype pollution protection)
function sanitizeIngredient(
  ingredient: unknown,
  index: number
): {
  inventory_item_id: string;
  quantity: number;
  unit: string;
  preparation_notes: string | null;
  is_optional: boolean;
  display_order: number;
} | null {
  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return null;
  const ing = ingredient as Record<string, unknown>;

  // Check for dangerous keys (prototype pollution)
  for (const key of Object.keys(ing)) {
    if (!isSafeKey(key)) return null;
  }

  // Validate inventory_item_id as UUID
  if (!ing.inventory_item_id || !isValidUUID(ing.inventory_item_id as string)) {
    return null;
  }

  // Sanitize quantity (must be positive)
  const quantity = sanitizeInteger(ing.quantity, 0.001, MAX_QUANTITY, 1);
  if (quantity === undefined || quantity <= 0) return null;

  // Sanitize unit
  const unit = sanitizeText(ing.unit, 50) || 'unidad';

  return {
    inventory_item_id: ing.inventory_item_id as string,
    quantity: typeof ing.quantity === 'number' ? Math.min(Math.max(ing.quantity, 0.001), MAX_QUANTITY) : 1,
    unit,
    preparation_notes: ing.preparation_notes ? sanitizeText(ing.preparation_notes, LIMITS.MAX_TEXT_MEDIUM) : null,
    is_optional: Boolean(ing.is_optional),
    display_order: typeof ing.display_order === 'number' ? sanitizeInteger(ing.display_order, 0, 1000, index) ?? index : index,
  };
}

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

    // Parse query params with UUID validation
    const searchParams = request.nextUrl.searchParams;
    const menuItemId = searchParams.get('menu_item_id');

    if (!menuItemId) {
      return errorResponse('menu_item_id es requerido', 400);
    }

    if (!isValidUUID(menuItemId)) {
      return errorResponse('menu_item_id inválido', 400);
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

    // Validate and sanitize menu_item_id
    const menu_item_id = body.menu_item_id;
    if (!menu_item_id) {
      return errorResponse('menu_item_id es requerido', 400);
    }
    if (!isValidUUID(menu_item_id)) {
      return errorResponse('menu_item_id inválido', 400);
    }

    // Sanitize yield fields
    const yield_quantity = sanitizeInteger(body.yield_quantity, 0.001, MAX_QUANTITY, 1) ?? 1;
    const yield_unit = sanitizeText(body.yield_unit, 50) || 'porcion';

    // Sanitize text fields
    const preparation_notes = body.preparation_notes
      ? sanitizeText(body.preparation_notes, LIMITS.MAX_TEXT_LONG)
      : null;
    const storage_notes = body.storage_notes
      ? sanitizeText(body.storage_notes, LIMITS.MAX_TEXT_LONG)
      : null;

    // Sanitize ingredients array with limit
    const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
    if (rawIngredients.length > MAX_INGREDIENTS_PER_RECIPE) {
      return errorResponse(`Máximo ${MAX_INGREDIENTS_PER_RECIPE} ingredientes por receta`, 400);
    }

    // Filter and sanitize each ingredient
    const sanitizedIngredients = (rawIngredients as unknown[])
      .map((ing: unknown, idx: number) => sanitizeIngredient(ing, idx))
      .filter((ing): ing is NonNullable<ReturnType<typeof sanitizeIngredient>> => ing !== null);

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

    // Insert sanitized ingredients if provided
    if (sanitizedIngredients.length > 0) {
      // Verify all inventory items belong to tenant
      const inventoryItemIds = sanitizedIngredients.map((i) => i.inventory_item_id);
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('id, unit_cost')
        .in('id', inventoryItemIds)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      const validItemIds = new Set(inventoryItems?.map((i: { id: string }) => i.id) || []);
      const itemCosts = new Map(inventoryItems?.map((i: { id: string; unit_cost: number | null }) => [i.id, i.unit_cost || 0]) || []);

      const ingredientsToInsert = sanitizedIngredients
        .filter((i) => validItemIds.has(i.inventory_item_id))
        .map((ingredient) => {
          const unitCost = itemCosts.get(ingredient.inventory_item_id) || 0;
          return {
            tenant_id: tenantId,
            recipe_id: recipeId,
            inventory_item_id: ingredient.inventory_item_id,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            unit_cost: unitCost,
            total_cost: unitCost * ingredient.quantity,
            preparation_notes: ingredient.preparation_notes,
            is_optional: ingredient.is_optional,
            display_order: ingredient.display_order,
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
// DELETE - Soft Delete Recipe
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

    // Parse query params with UUID validation
    const searchParams = request.nextUrl.searchParams;
    const menuItemId = searchParams.get('menu_item_id');

    if (!menuItemId) {
      return errorResponse('menu_item_id es requerido', 400);
    }

    if (!isValidUUID(menuItemId)) {
      return errorResponse('menu_item_id inválido', 400);
    }

    // Get recipe
    const { data: recipe, error: fetchError } = await supabase
      .from('menu_item_recipes')
      .select('id')
      .eq('menu_item_id', menuItemId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (fetchError || !recipe) {
      return errorResponse('Receta no encontrada', 404);
    }

    // Soft delete ingredients (mark as inactive)
    await supabase
      .from('recipe_ingredients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('recipe_id', recipe.id);

    // Soft delete recipe (mark as inactive)
    const { error: deleteError } = await supabase
      .from('menu_item_recipes')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
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
