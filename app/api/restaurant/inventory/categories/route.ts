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
import { sanitizeText, sanitizeColor, sanitizeInteger, LIMITS } from '@/src/lib/api/sanitization-helper';

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

    // Use separate queries for branch-specific and global categories
    // PostgREST's .or() doesn't combine well with other AND conditions
    if (branchId && isValidUUID(branchId)) {
      const [branchResult, globalResult] = await Promise.all([
        supabase
          .from('inventory_categories')
          .select('*')
          .eq('tenant_id', userRole.tenant_id)
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
        supabase
          .from('inventory_categories')
          .select('*')
          .eq('tenant_id', userRole.tenant_id)
          .is('branch_id', null)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('name', { ascending: true }),
      ]);

      const error = branchResult.error || globalResult.error;
      if (error) {
        console.error('[Categories API] Error fetching:', JSON.stringify(error, null, 2));
        if (error.code === '42P01') {
          return errorResponse('Sistema de inventario no configurado - ejecute las migraciones', 500);
        }
        return errorResponse(`Error al obtener categorías: ${error.message || error.code || 'Unknown'}`, 500);
      }

      const categories = [...(branchResult.data || []), ...(globalResult.data || [])];
      return successResponse(categories);
    }

    // No branchId - fetch all tenant categories
    const { data: categories, error } = await supabase
      .from('inventory_categories')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Categories API] Error fetching:', JSON.stringify(error, null, 2));
      // Handle table not exists error
      if (error.code === '42P01') {
        return errorResponse('Sistema de inventario no configurado - ejecute las migraciones', 500);
      }
      return errorResponse(`Error al obtener categorías: ${error.message || error.code || 'Unknown'}`, 500);
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

    // Sanitize and validate required fields
    const name = sanitizeText(body.name, LIMITS.MAX_TEXT_MEDIUM);
    if (!name) {
      return errorResponse('El nombre es requerido', 400);
    }

    const slug = slugify(name);

    // Validate branch_id if provided
    if (body.branch_id && !isValidUUID(body.branch_id)) {
      return errorResponse('ID de sucursal inválido', 400);
    }

    // Build insert data with sanitized fields
    const insertData: Record<string, unknown> = {
      tenant_id: userRole.tenant_id,
      name,
      slug,
    };

    // Add optional fields only if they have values (sanitized)
    if (body.branch_id && isValidUUID(body.branch_id)) {
      insertData.branch_id = body.branch_id;
    }
    if (body.description) {
      insertData.description = sanitizeText(body.description, LIMITS.MAX_TEXT_LONG);
    }
    if (body.color) {
      insertData.color = sanitizeColor(body.color);
    }

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Categories API] Error creating:', JSON.stringify(error, null, 2));
      // Handle specific Supabase errors
      if (error.code === '23505') {
        return errorResponse('Ya existe una categoría con ese nombre', 400);
      }
      if (error.code === '42P01') {
        return errorResponse('Tabla no encontrada - contacte soporte', 500);
      }
      return errorResponse(`Error al crear categoría: ${error.message || error.code || 'Unknown'}`, 500);
    }

    return successResponse(category, 201);

  } catch (error) {
    console.error('[Categories API] Unexpected error:', error);
    return errorResponse('Error interno del servidor', 500);
  }
}
