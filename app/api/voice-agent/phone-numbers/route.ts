// =====================================================
// TIS TIS PLATFORM - Voice Agent Phone Numbers API
// Gestión de números de teléfono virtuales
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  VoiceAgentService,
} from '@/src/features/voice-agent/services/voice-agent.service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

// Get user context (user + tenant)
async function getUserContext(supabase: ReturnType<typeof createAuthenticatedClient>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: userRole } = await supabase
    .from('user_roles')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .single();

  if (!userRole) return null;

  return { user, userRole };
}

// ======================
// GET - List phone numbers
// ======================
export async function GET(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Verificar acceso
    const accessCheck = await VoiceAgentService.canAccessVoiceAgent(tenantId);
    if (!accessCheck.canAccess) {
      return NextResponse.json(
        { error: accessCheck.reason },
        { status: 403 }
      );
    }

    const phoneNumbers = await VoiceAgentService.getPhoneNumbers(tenantId);

    return NextResponse.json({
      success: true,
      data: phoneNumbers,
    });
  } catch (error) {
    console.error('[Voice Agent Phone Numbers API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener números de teléfono' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Request new phone number
// ======================
export async function POST(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Solo admin/owner pueden solicitar números
    if (!['admin', 'owner'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden solicitar números de teléfono' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    // Verificar acceso
    const accessCheck = await VoiceAgentService.canAccessVoiceAgent(tenantId);
    if (!accessCheck.canAccess) {
      return NextResponse.json(
        { error: accessCheck.reason },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    const { area_code, branch_id } = body;

    // Validar area_code
    if (!area_code || typeof area_code !== 'string') {
      return NextResponse.json(
        { error: 'area_code es requerido' },
        { status: 400 }
      );
    }

    // Validar formato de LADA (2-4 dígitos)
    if (!/^\d{2,4}$/.test(area_code)) {
      return NextResponse.json(
        { error: 'area_code debe ser 2-4 dígitos (ej: 631, 55, 81)' },
        { status: 400 }
      );
    }

    // Validar branch_id si se proporciona
    if (branch_id) {
      if (typeof branch_id !== 'string' || !UUID_REGEX.test(branch_id)) {
        return NextResponse.json(
          { error: 'branch_id debe ser un UUID válido' },
          { status: 400 }
        );
      }

      // Verificar que el branch pertenece al tenant
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!branch) {
        return NextResponse.json(
          { error: 'Sucursal no encontrada' },
          { status: 404 }
        );
      }
    }

    const result = await VoiceAgentService.requestPhoneNumber(
      tenantId,
      area_code,
      branch_id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      phone_number: result.phoneNumber,
      message: 'Solicitud de número de teléfono creada. El número será provisionado en las próximas horas.',
    });
  } catch (error) {
    console.error('[Voice Agent Phone Numbers API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al solicitar número de teléfono' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Release phone number
// ======================
export async function DELETE(request: NextRequest) {
  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const context = await getUserContext(supabase);

    if (!context) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Solo admin/owner pueden liberar números
    if (!['admin', 'owner'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Solo administradores pueden liberar números de teléfono' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    const { phone_number_id } = body;

    // Validar phone_number_id
    if (!phone_number_id || typeof phone_number_id !== 'string' || !UUID_REGEX.test(phone_number_id)) {
      return NextResponse.json(
        { error: 'phone_number_id debe ser un UUID válido' },
        { status: 400 }
      );
    }

    // Usar el servicio para liberar el número (incluye VAPI)
    const result = await VoiceAgentService.releasePhoneNumber(phone_number_id, tenantId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al liberar número' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Número de teléfono liberado exitosamente',
    });
  } catch (error) {
    console.error('[Voice Agent Phone Numbers API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al liberar número de teléfono' },
      { status: 500 }
    );
  }
}
