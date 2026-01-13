// =====================================================
// TIS TIS PLATFORM - Agent Profiles API
// GET: Obtener perfiles del tenant
// POST: Crear nuevo perfil
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AgentProfileService } from '@/src/features/ai/services/agent-profile.service';
import type { ProfileType, VerticalType } from '@/src/shared/config/agent-templates';

// =====================================================
// AUTH HELPER
// =====================================================

async function getAuthenticatedTenant(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Token no proporcionado', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: 'No autorizado', status: 401 };
  }

  // Obtener tenant del usuario
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole?.tenant_id) {
    return { error: 'Usuario sin tenant asignado', status: 403 };
  }

  // Obtener info del tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, vertical')
    .eq('id', userRole.tenant_id)
    .single();

  return {
    user,
    tenant,
    role: userRole.role,
    tenantId: userRole.tenant_id,
  };
}

// =====================================================
// GET - Obtener perfiles
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedTenant(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { tenantId, tenant } = auth;

    // Obtener perfiles
    const profiles = await AgentProfileService.getProfiles(tenantId);

    // Si no existe el perfil business, crearlo
    if (!profiles.business && tenant) {
      const newProfile = await AgentProfileService.ensureDefaultProfile(
        tenantId,
        tenant.name,
        (tenant.vertical || 'general') as VerticalType,
        auth.user.id
      );

      // Re-obtener con los datos completos
      const updatedProfiles = await AgentProfileService.getProfiles(tenantId);
      return NextResponse.json({
        success: true,
        data: updatedProfiles,
      });
    }

    return NextResponse.json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    console.error('[API agent-profiles] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener perfiles' },
      { status: 500 }
    );
  }
}

// =====================================================
// POST - Crear perfil
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedTenant(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Solo owners y admins pueden crear perfiles
    if (!['owner', 'admin'].includes(auth.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para crear perfiles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { profile_type, ...profileData } = body;

    if (!profile_type || !['business', 'personal'].includes(profile_type)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de perfil inválido' },
        { status: 400 }
      );
    }

    // Crear perfil
    const profile = await AgentProfileService.createProfile(
      auth.tenantId,
      profile_type as ProfileType,
      profileData,
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[API agent-profiles] POST error:', error);
    const message = error instanceof Error ? error.message : 'Error al crear perfil';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
