// =====================================================
// TIS TIS PLATFORM - Branches API
// CRUD operations for tenant branches
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with user's access token
function createAuthenticatedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Extract Bearer token from Authorization header
function getAccessToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// ======================
// GET - Retrieve all branches for tenant
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado - Token no proporcionado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado - Token inválido' },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Fetch branches
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .order('is_headquarters', { ascending: false });

    if (error) {
      console.error('[Branches API] GET error:', error);
      return NextResponse.json(
        { error: 'Error al obtener sucursales' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: branches || [],
    });
  } catch (error) {
    console.error('[Branches API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener sucursales' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create or update branch (upsert)
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado - Token no proporcionado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado - Token inválido' },
        { status: 401 }
      );
    }

    // Get user's tenant and verify permissions
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Check permissions (only owner, admin, manager can modify)
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar sucursales' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, tenant_id: _, ...branchData } = body;

    let result;

    if (id) {
      // Update existing branch
      result = await supabase
        .from('branches')
        .update({
          ...branchData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', userRole.tenant_id)
        .select()
        .single();
    } else {
      // Create new branch
      result = await supabase
        .from('branches')
        .insert({
          tenant_id: userRole.tenant_id,
          ...branchData,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('[Branches API] Save error:', result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[Branches API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al guardar sucursal' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete branch
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado - Token no proporcionado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado - Token inválido' },
        { status: 401 }
      );
    }

    // Get user's tenant and verify permissions
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Check permissions (only owner, admin can delete)
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para eliminar sucursales' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de sucursal requerido' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('branches')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('[Branches API] Delete error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Sucursal eliminada correctamente',
    });
  } catch (error) {
    console.error('[Branches API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar sucursal' },
      { status: 500 }
    );
  }
}
