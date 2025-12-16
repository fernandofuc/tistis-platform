// =====================================================
// TIS TIS PLATFORM - Services API Route
// Multi-tenant with Lead Priority Support
// =====================================================

export const dynamic = 'force-dynamic';

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
// GET - Fetch services for tenant
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
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('services')
      .select('*')
      .eq('tenant_id', userRole.tenant_id)
      .is('deleted_at', null);

    if (category) {
      query = query.eq('category', category);
    }
    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    query = query.order('category').order('display_order').order('name');

    const { data, error } = await query;

    if (error) {
      console.error('[Services API] GET error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Group by category if requested
    if (searchParams.get('group_by_category') === 'true') {
      const grouped = data?.reduce((acc, service) => {
        const cat = service.category || 'Otros';
        if (!acc[cat]) {
          acc[cat] = [];
        }
        acc[cat].push(service);
        return acc;
      }, {} as Record<string, typeof data>);

      return NextResponse.json({ success: true, data: grouped });
    }

    // Group by lead_priority if requested
    if (searchParams.get('group_by_priority') === 'true') {
      const grouped = {
        hot: data?.filter(s => s.lead_priority === 'hot') || [],
        warm: data?.filter(s => s.lead_priority === 'warm') || [],
        cold: data?.filter(s => s.lead_priority === 'cold') || [],
      };
      return NextResponse.json({ success: true, data: grouped });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Services API] GET error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update service lead priority
// ======================
export async function PATCH(request: NextRequest) {
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
      .eq('is_active', true)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Check permissions (only owner, admin can modify services)
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar servicios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, lead_priority } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de servicio requerido' },
        { status: 400 }
      );
    }

    // Validate lead_priority
    if (lead_priority && !['hot', 'warm', 'cold'].includes(lead_priority)) {
      return NextResponse.json(
        { error: 'lead_priority debe ser: hot, warm, o cold' },
        { status: 400 }
      );
    }

    // Update service
    const { data, error } = await supabase
      .from('services')
      .update({
        lead_priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (error) {
      console.error('[Services API] PATCH error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Servicio actualizado a prioridad: ${lead_priority?.toUpperCase()}`,
    });
  } catch (error) {
    console.error('[Services API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ======================
// PUT - Bulk update service priorities
// ======================
export async function PUT(request: NextRequest) {
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
      .eq('is_active', true)
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Check permissions (only owner, admin can modify services)
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar servicios' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { updates } = body; // Array of { id, lead_priority }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Se requiere un array de updates' },
        { status: 400 }
      );
    }

    // Validate all priorities
    for (const update of updates) {
      if (!update.id || !update.lead_priority) {
        return NextResponse.json(
          { error: 'Cada update debe tener id y lead_priority' },
          { status: 400 }
        );
      }
      if (!['hot', 'warm', 'cold'].includes(update.lead_priority)) {
        return NextResponse.json(
          { error: `lead_priority inválido: ${update.lead_priority}` },
          { status: 400 }
        );
      }
    }

    // Update each service
    const results = [];
    for (const update of updates) {
      const { error } = await supabase
        .from('services')
        .update({
          lead_priority: update.lead_priority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', update.id)
        .eq('tenant_id', userRole.tenant_id);

      if (error) {
        console.error(`[Services API] Error updating ${update.id}:`, error);
        results.push({ id: update.id, success: false, error: error.message });
      } else {
        results.push({ id: update.id, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: true,
      message: `${successCount}/${updates.length} servicios actualizados`,
      results,
    });
  } catch (error) {
    console.error('[Services API] PUT error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
