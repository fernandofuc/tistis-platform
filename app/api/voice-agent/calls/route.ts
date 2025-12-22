// =====================================================
// TIS TIS PLATFORM - Voice Agent Calls API
// Gestión de llamadas de voz
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

// Max limits for pagination
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

// ======================
// GET - List calls with pagination
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

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    let limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    let offset = parseInt(searchParams.get('offset') || '0', 10);
    const callId = searchParams.get('call_id');
    const status = searchParams.get('status');
    const outcome = searchParams.get('outcome');

    // Validate and cap limits
    if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    if (isNaN(offset) || offset < 0) offset = 0;

    // Si se solicita una llamada específica
    if (callId) {
      if (!UUID_REGEX.test(callId)) {
        return NextResponse.json(
          { error: 'call_id debe ser un UUID válido' },
          { status: 400 }
        );
      }

      const call = await VoiceAgentService.getCallDetails(callId, tenantId);

      if (!call) {
        return NextResponse.json(
          { error: 'Llamada no encontrada' },
          { status: 404 }
        );
      }

      // Obtener mensajes de la llamada
      const messages = await VoiceAgentService.getCallMessages(callId);

      return NextResponse.json({
        success: true,
        data: {
          call,
          messages,
        },
      });
    }

    // Listar llamadas con filtros
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = serviceSupabase
      .from('voice_calls')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros
    if (status) {
      query = query.eq('status', status);
    }
    if (outcome) {
      query = query.eq('outcome', outcome);
    }

    const { data: calls, count, error } = await query;

    if (error) {
      console.error('[Voice Agent Calls API] GET error:', error);
      return NextResponse.json(
        { error: 'Error al obtener llamadas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: calls || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('[Voice Agent Calls API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener llamadas' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update call (add notes, mark outcome)
// ======================
export async function PATCH(request: NextRequest) {
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON inválido' },
        { status: 400 }
      );
    }

    const { call_id, outcome, outcome_notes } = body;

    // Validar call_id
    if (!call_id || typeof call_id !== 'string' || !UUID_REGEX.test(call_id)) {
      return NextResponse.json(
        { error: 'call_id debe ser un UUID válido' },
        { status: 400 }
      );
    }

    // Validar outcome si se proporciona
    const validOutcomes = [
      'appointment_booked',
      'information_given',
      'escalated_human',
      'callback_requested',
      'not_interested',
      'wrong_number',
      'voicemail',
      'dropped',
      'completed_other',
    ];
    if (outcome && !validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `outcome no válido. Opciones: ${validOutcomes.join(', ')}` },
        { status: 400 }
      );
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar que la llamada pertenece al tenant
    const { data: call } = await serviceSupabase
      .from('voice_calls')
      .select('id')
      .eq('id', call_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!call) {
      return NextResponse.json(
        { error: 'Llamada no encontrada' },
        { status: 404 }
      );
    }

    // Construir actualización
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (outcome) {
      updateData.outcome = outcome;
    }
    if (outcome_notes !== undefined) {
      updateData.outcome_notes = outcome_notes;
    }

    const { error: updateError } = await serviceSupabase
      .from('voice_calls')
      .update(updateData)
      .eq('id', call_id);

    if (updateError) {
      console.error('[Voice Agent Calls API] PATCH error:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar llamada' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      call_id,
    });
  } catch (error) {
    console.error('[Voice Agent Calls API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar llamada' },
      { status: 500 }
    );
  }
}
