// =====================================================
// TIS TIS PLATFORM - Inventory Categories API
// GET: List categories, POST: Create category
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
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;
    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('include_items') === 'true';
    const branchId = searchParams.get('branch_id');

    let query = supabase
      .from('inventory_categories')
      .select(includeItems
        ? `*, items:inventory_items(id, name, current_stock, minimum_stock, unit)`
        : '*'
      )
      .eq('tenant_id', userRole.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (branchId) {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }

    const { data: categories, error } = await query;

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener categorías' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: categories });

  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

// ======================
// POST - Create Category
// ======================
export async function POST(request: NextRequest) {
  try {
    const result = await getUserAndTenant(request);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    const { userRole, supabase } = result;

    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json({ success: false, error: 'Sin permisos para crear categorías' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      description,
      parent_id,
      branch_id,
      icon,
      color,
      display_order,
      is_active,
    } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es requerido' }, { status: 400 });
    }

    const finalSlug = slug || slugify(name);

    // Check for duplicate slug
    const { data: existing } = await supabase
      .from('inventory_categories')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .eq('slug', finalSlug)
      .is('deleted_at', null)
      .single();

    if (existing) {
      return NextResponse.json({ success: false, error: 'Ya existe una categoría con ese slug' }, { status: 409 });
    }

    const { data: category, error } = await supabase
      .from('inventory_categories')
      .insert({
        tenant_id: userRole.tenant_id,
        branch_id,
        name,
        slug: finalSlug,
        description,
        parent_id,
        icon,
        color: color || '#64748B',
        display_order: display_order || 0,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ success: false, error: 'Error al crear categoría' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: category }, { status: 201 });

  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
