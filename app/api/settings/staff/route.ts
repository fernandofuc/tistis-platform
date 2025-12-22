// =====================================================
// TIS TIS PLATFORM - Staff API
// CRUD operations for tenant staff members
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

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
// GET - Retrieve all staff for tenant
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

    // Fetch staff and their branch assignments
    const [staffResult, branchAssignmentsResult] = await Promise.all([
      supabase
        .from('staff')
        .select('*')
        .eq('tenant_id', userRole.tenant_id)
        .order('last_name'),
      supabase
        .from('staff_branches')
        .select('*')
    ]);

    if (staffResult.error) {
      console.error('[Staff API] GET error:', staffResult.error);
      return NextResponse.json(
        { error: 'Error al obtener personal' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        staff: staffResult.data || [],
        staffBranches: branchAssignmentsResult.data || [],
      },
    });
  } catch (error) {
    console.error('[Staff API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener personal' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create or update staff member
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

    // Check permissions (only owner, admin can modify staff)
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar personal' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, tenant_id: _, branchAssignments, ...staffData } = body;

    // Auto-generate display_name if not provided
    if (!staffData.display_name && (staffData.first_name || staffData.last_name)) {
      staffData.display_name = `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim();
    }

    let staffId = id;
    let result;

    if (id) {
      // Update existing staff
      result = await supabase
        .from('staff')
        .update({
          ...staffData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', userRole.tenant_id)
        .select()
        .single();

      if (result.error) {
        console.error('[Staff API] Update error:', result.error);
        return NextResponse.json(
          { error: result.error.message },
          { status: 400 }
        );
      }
    } else {
      // Create new staff
      result = await supabase
        .from('staff')
        .insert({
          tenant_id: userRole.tenant_id,
          ...staffData,
        })
        .select()
        .single();

      if (result.error) {
        console.error('[Staff API] Create error:', result.error);
        return NextResponse.json(
          { error: result.error.message },
          { status: 400 }
        );
      }

      staffId = result.data.id;
    }

    // Update branch assignments if provided
    if (branchAssignments && Array.isArray(branchAssignments) && staffId) {
      // Remove all existing assignments
      await supabase
        .from('staff_branches')
        .delete()
        .eq('staff_id', staffId);

      // Add new assignments
      if (branchAssignments.length > 0) {
        const assignments = branchAssignments.map((branchId: string, index: number) => ({
          staff_id: staffId,
          branch_id: branchId,
          is_primary: index === 0,
        }));

        const { error: assignError } = await supabase
          .from('staff_branches')
          .insert(assignments);

        if (assignError) {
          console.error('[Staff API] Branch assignment error:', assignError);
          // Don't fail the whole operation if assignment fails
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[Staff API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al guardar personal' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete staff member
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
        { error: 'Sin permisos para eliminar personal' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID de personal requerido' },
        { status: 400 }
      );
    }

    // Delete branch assignments first
    await supabase
      .from('staff_branches')
      .delete()
      .eq('staff_id', id);

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('staff')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (error) {
      console.error('[Staff API] Delete error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Personal eliminado correctamente',
    });
  } catch (error) {
    console.error('[Staff API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar personal' },
      { status: 500 }
    );
  }
}
