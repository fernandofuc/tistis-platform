// =====================================================
// TIS TIS PLATFORM - Branches API (Settings)
// CRUD operations for tenant branches
// NOTE: For creating new branches, use /api/branches instead
// This endpoint should only be used for updates
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlanConfig } from '@/src/shared/config/plans';

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

// Service role client for admin operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      // ============================================
      // SECURITY: Validate branch limits before creating
      // ============================================
      const supabaseAdmin = getSupabaseAdmin();

      // Get client_id for this tenant
      const { data: clientData } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('tenant_id', userRole.tenant_id)
        .single();

      if (!clientData) {
        return NextResponse.json(
          { error: 'No se encontró cliente asociado al tenant' },
          { status: 404 }
        );
      }

      // Get subscription for this client
      const { data: subscriptionData } = await supabaseAdmin
        .from('subscriptions')
        .select('id, plan, max_branches, current_branches')
        .eq('client_id', clientData.id)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!subscriptionData) {
        return NextResponse.json(
          { error: 'No se encontró una suscripción activa' },
          { status: 404 }
        );
      }

      const plan = subscriptionData.plan?.toLowerCase() || 'starter';
      const planConfig = getPlanConfig(plan);
      const planLimit = planConfig?.branchLimit || 1;
      const contractedBranches = subscriptionData.max_branches || 1;
      const currentBranches = subscriptionData.current_branches || 1;

      // Check 1: If at the plan's absolute limit, cannot add more
      if (currentBranches >= planLimit) {
        return NextResponse.json({
          error: 'plan_limit_reached',
          message: `El plan ${plan} permite máximo ${planLimit} sucursales. Mejora tu plan para agregar más.`,
          current: currentBranches,
          max: planLimit,
          plan: plan,
          upgrade_required: true,
        }, { status: 403 });
      }

      // Check 2: If at contracted limit, need to pay for extra branch
      if (currentBranches >= contractedBranches) {
        if (plan === 'starter') {
          return NextResponse.json({
            error: 'plan_not_allowed',
            message: 'El plan Starter solo permite 1 sucursal. Mejora tu plan para agregar más.',
            current: currentBranches,
            max: contractedBranches,
            plan: plan,
            upgrade_required: true,
          }, { status: 403 });
        }

        // Other plans: redirect to add-extra endpoint for billing
        return NextResponse.json({
          error: 'extra_branch_required',
          message: 'Has usado todas las sucursales contratadas. Para agregar más, se requiere un cobro adicional.',
          current: currentBranches,
          contracted: contractedBranches,
          plan_limit: planLimit,
          plan: plan,
          use_endpoint: '/api/branches/add-extra',
          requires_payment: true,
        }, { status: 402 }); // 402 Payment Required
      }

      // Can create: still have contracted branches available
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
