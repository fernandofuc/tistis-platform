// =====================================================
// TIS TIS PLATFORM - Inventory Categories API
// GET: List categories, POST: Create category
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ======================
// GET - List Categories
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

    // Simple query - fetch all categories for tenant
    let query = supabase
      .from('inventory_categories')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (branchId && isValidUUID(branchId)) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('[Categories API] Error fetching:', error);
      return errorResponse(`Error al obtener categorías: ${error.message || 'Unknown'}`, 500);
    }

    return successResponse(categories || []);

  } catch (error) {
    console.error('[Categories API] Unexpected error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}

// ======================
// POST - Create Category
// ======================
export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndTenant(request);
    if (isAuthError(auth)) {
      return errorResponse(auth.error, auth.status);
    }

    const { userRole, supabase } = auth;

    if (!canWrite(userRole.role)) {
      return errorResponse('Sin permisos para crear categorías', 403);
    }

    const body = await request.json();
    const { name, description, branch_id, color } = body;

    if (!name) {
      return errorResponse('El nombre es requerido', 400);
    }

    const slug = slugify(name);

    // Build insert data with only essential fields
    const insertData: Record<string, unknown> = {
      tenant_id: userRole.tenant_id,
      name,
      slug,
    };

    // Add optional fields only if they have values
    if (branch_id && isValidUUID(branch_id)) insertData.branch_id = branch_id;
    if (description) insertData.description = description;
    if (color) insertData.color = color;

    console.log('[Categories API] Creating category:', insertData);

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Categories API] Error creating:', error);
      return errorResponse(`Error al crear categoría: ${error.message || error.code || 'Unknown'}`, 500);
    }

    console.log('[Categories API] Category created:', category?.id);
    return successResponse(category, 201);

  } catch (error) {
    console.error('[Categories API] Unexpected error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
