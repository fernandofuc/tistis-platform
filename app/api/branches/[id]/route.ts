// =====================================================
// TIS TIS PLATFORM - Single Branch API Route
// Update and Delete (soft) operations
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ======================
// GET - Fetch single branch
// ======================
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: branchId } = await context.params;
    const { user, supabase } = await getUserFromRequest(request);

    // Authenticate user
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single() as { data: { tenant_id: string } | null };

    if (!userRole?.tenant_id) {
      return NextResponse.json({ error: 'No tenant found' }, { status: 404 });
    }

    const tenantId = userRole.tenant_id;

    const { data: branch, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    return NextResponse.json({ data: branch });
  } catch (error) {
    console.error('Get branch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ======================
// PUT - Update branch
// ======================
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: branchId } = await context.params;
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

    // Only admins can update branches
    if (!['admin', 'owner'].includes(userRoleType)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden editar sucursales' },
        { status: 403 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify branch belongs to tenant
    const { data: existingBranch } = await supabaseAdmin
      .from('branches')
      .select('id, tenant_id, is_headquarters')
      .eq('id', branchId)
      .eq('tenant_id', tenantId)
      .single();

    if (!existingBranch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Build update object (only allowed fields)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'name', 'city', 'state', 'country', 'address', 'postal_code',
      'phone', 'whatsapp_number', 'email', 'timezone', 'operating_hours',
      'coordinates', 'metadata'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update slug if name changed (not for HQ)
    if (body.name && !existingBranch.is_headquarters) {
      const baseSlug = body.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
      updateData.slug = baseSlug;
    }

    const { data: updatedBranch, error: updateError } = await supabaseAdmin
      .from('branches')
      .update(updateData)
      .eq('id', branchId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating branch:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar sucursal' },
        { status: 500 }
      );
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'branch_updated',
      entity_type: 'branch',
      entity_id: branchId,
      old_data: existingBranch,
      new_data: updateData,
    });

    console.log('✅ Branch updated:', branchId);

    return NextResponse.json({
      success: true,
      data: updatedBranch,
      message: 'Sucursal actualizada exitosamente',
    });

  } catch (error) {
    console.error('Update branch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ======================
// DELETE - Soft delete branch
// ======================
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: branchId } = await context.params;
    const { user, supabase } = await getUserFromRequest(request);
    const { searchParams } = new URL(request.url);
    const migrateData = searchParams.get('migrate') !== 'false'; // Default: migrate data

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

    // Verify branch belongs to tenant
    const { data: branchToDelete } = await supabaseAdmin
      .from('branches')
      .select('id, tenant_id, name, is_headquarters')
      .eq('id', branchId)
      .eq('tenant_id', tenantId)
      .single();

    if (!branchToDelete) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // Cannot delete headquarters
    if (branchToDelete.is_headquarters) {
      return NextResponse.json({
        error: 'cannot_delete_hq',
        message: 'No puedes eliminar la sucursal principal. Debe existir al menos una sucursal.',
      }, { status: 403 });
    }

    // Get HQ branch for data migration
    const { data: hqBranch } = await supabaseAdmin
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_headquarters', true)
      .single();

    if (!hqBranch) {
      return NextResponse.json({
        error: 'No headquarters branch found for data migration',
      }, { status: 500 });
    }

    // Migrate data to HQ if requested
    if (migrateData && hqBranch.id !== branchId) {
      console.log(`📦 Migrating data from branch ${branchId} to HQ ${hqBranch.id}...`);

      // Count items before migration
      const { count: leadsCount } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId);

      const { count: appointmentsCount } = await supabaseAdmin
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId);

      const { count: conversationsCount } = await supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId);

      // Migrate leads
      await supabaseAdmin
        .from('leads')
        .update({ branch_id: hqBranch.id, updated_at: new Date().toISOString() })
        .eq('branch_id', branchId);

      // Migrate appointments
      await supabaseAdmin
        .from('appointments')
        .update({ branch_id: hqBranch.id, updated_at: new Date().toISOString() })
        .eq('branch_id', branchId);

      // Migrate conversations
      await supabaseAdmin
        .from('conversations')
        .update({ branch_id: hqBranch.id, updated_at: new Date().toISOString() })
        .eq('branch_id', branchId);

      console.log(`✅ Migrated: ${leadsCount || 0} leads, ${appointmentsCount || 0} appointments, ${conversationsCount || 0} conversations`);
    }

    // Soft delete: set is_active = false
    const { error: deleteError } = await supabaseAdmin
      .from('branches')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        metadata: {
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          data_migrated_to: migrateData ? hqBranch.id : null,
        },
      })
      .eq('id', branchId);

    if (deleteError) {
      console.error('Error deleting branch:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar sucursal' },
        { status: 500 }
      );
    }

    // Log the action
    await supabaseAdmin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'branch_deleted',
      entity_type: 'branch',
      entity_id: branchId,
      old_data: branchToDelete,
      new_data: {
        deleted_at: new Date().toISOString(),
        data_migrated_to: migrateData ? hqBranch.id : null,
      },
    });

    console.log('✅ Branch deleted (soft):', branchId, branchToDelete.name);

    return NextResponse.json({
      success: true,
      message: 'Sucursal eliminada exitosamente',
      data_migrated: migrateData,
      migrated_to: migrateData ? hqBranch.id : null,
    });

  } catch (error) {
    console.error('Delete branch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
