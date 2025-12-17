// =====================================================
// TIS TIS PLATFORM - Branches API Route
// Full CRUD with billing validation
// =====================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/src/shared/lib/supabase-server';

// Service role client for admin operations
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ======================
// GET - Fetch branches
// ======================
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('include_stats') === 'true';
    const tenantId = searchParams.get('tenant_id');

    // Get current user's tenant
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant from user_roles
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as { data: { tenant_id: string } | null };

    const effectiveTenantId = tenantId || userRole?.tenant_id;
    if (!effectiveTenantId) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const { data: branches, error } = await supabase
      .from('branches')
      .select(`
        *,
        staff:staff(id, display_name, role, is_active)
      `)
      .eq('tenant_id', effectiveTenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false })
      .order('name');

    if (error) {
      console.error('Error fetching branches:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If stats requested, fetch counts for each branch
    if (includeStats && branches) {
      const branchesWithStats = await Promise.all(
        branches.map(async (branch) => {
          const [leadsResult, appointmentsResult, conversationsResult] = await Promise.all([
            supabase
              .from('leads')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id),
            supabase
              .from('appointments')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id)
              .in('status', ['scheduled', 'confirmed']),
            supabase
              .from('conversations')
              .select('*', { count: 'exact', head: true })
              .eq('branch_id', branch.id)
              .eq('status', 'active'),
          ]);

          return {
            ...branch,
            stats: {
              total_leads: leadsResult.count || 0,
              pending_appointments: appointmentsResult.count || 0,
              active_conversations: conversationsResult.count || 0,
            },
          };
        })
      );

      return NextResponse.json({ data: branchesWithStats });
    }

    return NextResponse.json({ data: branches });
  } catch (error) {
    console.error('Branches API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ======================
// POST - Create new branch
// ======================
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getUserFromRequest(request);
    const body = await request.json();

    // Authenticate user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant and role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as { data: { tenant_id: string; role: string } | null };

    if (!userRole?.tenant_id || !userRole?.role) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const tenantId = userRole.tenant_id;
    const userRoleType = userRole.role;

    // Only admins can create branches
    if (!['admin', 'owner'].includes(userRoleType)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden crear sucursales' },
        { status: 403 }
      );
    }

    // Check branch limit using the database function
    const supabaseAdmin = getSupabaseAdmin();
    const { data: limitCheck, error: limitError } = await supabaseAdmin
      .rpc('check_branch_limit', { p_tenant_id: tenantId });

    if (limitError) {
      console.error('Error checking branch limit:', limitError);
      return NextResponse.json(
        { error: 'Error al verificar límite de sucursales' },
        { status: 500 }
      );
    }

    const limit = limitCheck?.[0];
    if (!limit?.can_create) {
      return NextResponse.json({
        error: 'branch_limit_reached',
        message: limit?.message || 'Has alcanzado el límite de sucursales de tu plan',
        current: limit?.current_count || 0,
        max: limit?.max_allowed || 1,
        plan: limit?.subscription_plan,
        upgrade_required: true,
      }, { status: 403 });
    }

    // Generate unique slug
    const baseSlug = (body.name || 'sucursal')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);

    // Check for slug uniqueness within tenant
    const { data: existingSlugs } = await supabase
      .from('branches')
      .select('slug')
      .eq('tenant_id', userRole.tenant_id)
      .like('slug', `${baseSlug}%`);

    let slug = baseSlug;
    if (existingSlugs && existingSlugs.length > 0) {
      slug = `${baseSlug}-${existingSlugs.length + 1}`;
    }

    // Create the branch using admin client (bypasses RLS)
    const { data: newBranch, error: createError } = await supabaseAdmin
      .from('branches')
      .insert({
        tenant_id: userRole.tenant_id,
        name: body.name || 'Nueva Sucursal',
        slug: slug,
        city: body.city || 'Por configurar',
        state: body.state || 'Por configurar',
        country: body.country || 'Mexico',
        address: body.address || '',
        phone: body.phone || '',
        whatsapp_number: body.whatsapp_number || '',
        is_headquarters: false, // Never create HQ via API
        is_active: true,
        timezone: body.timezone || 'America/Mexico_City',
        operating_hours: body.operating_hours || {
          monday: { open: '09:00', close: '18:00', enabled: true },
          tuesday: { open: '09:00', close: '18:00', enabled: true },
          wednesday: { open: '09:00', close: '18:00', enabled: true },
          thursday: { open: '09:00', close: '18:00', enabled: true },
          friday: { open: '09:00', close: '18:00', enabled: true },
          saturday: { open: '09:00', close: '14:00', enabled: true },
          sunday: { enabled: false },
        },
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating branch:', createError);
      return NextResponse.json(
        { error: 'Error al crear sucursal', details: createError.message },
        { status: 500 }
      );
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: userRole.tenant_id,
      user_id: user.id,
      action: 'branch_created',
      entity_type: 'branch',
      entity_id: newBranch.id,
      new_data: { branch_name: newBranch.name, branch_id: newBranch.id },
    });

    console.log('✅ Branch created:', newBranch.id, newBranch.name);

    return NextResponse.json({
      success: true,
      data: newBranch,
      message: 'Sucursal creada exitosamente',
    });

  } catch (error) {
    console.error('Create branch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete branch (soft delete)
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('id');

    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID required' }, { status: 400 });
    }

    // Authenticate user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant and role
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as { data: { tenant_id: string; role: string } | null };

    if (!userRole?.tenant_id || !userRole?.role) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const tenantId = userRole.tenant_id;
    const userRoleType = userRole.role;

    // Only admins can delete branches
    if (!['admin', 'owner'].includes(userRoleType)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden eliminar sucursales' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get the branch to verify ownership and check if it's HQ
    const { data: branch, error: fetchError } = await supabaseAdmin
      .from('branches')
      .select('id, name, tenant_id, is_headquarters')
      .eq('id', branchId)
      .single();

    if (fetchError || !branch) {
      return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 });
    }

    // Verify branch belongs to user's tenant
    if (branch.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Cannot delete headquarters
    if (branch.is_headquarters) {
      return NextResponse.json({
        error: 'No se puede eliminar la sucursal principal',
        message: 'La sucursal principal no puede ser eliminada. Contacta soporte si necesitas cambiarla.',
      }, { status: 403 });
    }

    // Soft delete: set is_active = false
    const { error: deleteError } = await supabaseAdmin
      .from('branches')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', branchId);

    if (deleteError) {
      console.error('Error deleting branch:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar sucursal', details: deleteError.message },
        { status: 500 }
      );
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: userRole.tenant_id,
      user_id: user.id,
      action: 'branch_deleted',
      entity_type: 'branch',
      entity_id: branchId,
      old_data: { branch_name: branch.name, branch_id: branchId },
    });

    console.log('🗑️ Branch deleted (soft):', branchId, branch.name);

    return NextResponse.json({
      success: true,
      message: 'Sucursal eliminada exitosamente',
    });

  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
