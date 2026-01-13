// =====================================================
// TIS TIS PLATFORM - Agent Profile by Type API
// GET: Obtener perfil específico
// PUT: Actualizar perfil
// DELETE: Eliminar perfil (solo personal)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AgentProfileService } from '@/src/features/ai/services/agent-profile.service';
import type { ProfileType } from '@/src/shared/config/agent-templates';

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

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole?.tenant_id) {
    return { error: 'Usuario sin tenant asignado', status: 403 };
  }

  return {
    user,
    role: userRole.role,
    tenantId: userRole.tenant_id,
  };
}

// =====================================================
// GET - Obtener perfil específico
// =====================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileType: string }> }
) {
  try {
    const { profileType } = await params;

    if (!['business', 'personal'].includes(profileType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de perfil inválido' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedTenant(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const profile = await AgentProfileService.getProfile(
      auth.tenantId,
      profileType as ProfileType
    );

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Perfil no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[API agent-profiles] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener perfil' },
      { status: 500 }
    );
  }
}

// =====================================================
// PUT - Actualizar perfil
// =====================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ profileType: string }> }
) {
  try {
    const { profileType } = await params;

    if (!['business', 'personal'].includes(profileType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de perfil inválido' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedTenant(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Solo owners y admins pueden actualizar
    if (!['owner', 'admin'].includes(auth.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para actualizar perfiles' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const profile = await AgentProfileService.updateProfile(
      auth.tenantId,
      profileType as ProfileType,
      body
    );

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[API agent-profiles] PUT error:', error);
    const message = error instanceof Error ? error.message : 'Error al actualizar perfil';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// =====================================================
// PATCH - Toggle perfil (activar/desactivar)
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileType: string }> }
) {
  try {
    const { profileType } = await params;

    if (!['business', 'personal'].includes(profileType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de perfil inválido' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedTenant(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    if (!['owner', 'admin'].includes(auth.role)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para modificar perfiles' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Campo is_active requerido' },
        { status: 400 }
      );
    }

    const result = await AgentProfileService.toggleProfile(
      auth.tenantId,
      profileType as ProfileType,
      is_active
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API agent-profiles] PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al modificar perfil' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE - Eliminar perfil (solo personal)
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileType: string }> }
) {
  try {
    const { profileType } = await params;

    if (profileType !== 'personal') {
      return NextResponse.json(
        { success: false, error: 'Solo se puede eliminar el perfil personal' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedTenant(request);
    if ('error' in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    // Solo owners pueden eliminar
    if (auth.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede eliminar perfiles' },
        { status: 403 }
      );
    }

    const result = await AgentProfileService.deleteProfile(
      auth.tenantId,
      'personal'
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API agent-profiles] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar perfil' },
      { status: 500 }
    );
  }
}
