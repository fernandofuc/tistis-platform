// =====================================================
// TIS TIS PLATFORM - Voice Call Messages API
// GET /api/voice-agent/calls/[callId]/messages
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ======================
// AUTH HELPERS
// ======================

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

  return {
    user,
    tenant_id: userRole.tenant_id,
    role: userRole.role,
  };
}

// ======================
// GET - Fetch messages for a call
// ======================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;

    // Auth check
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: 'Token no proporcionado' },
        { status: 401 }
      );
    }

    const supabase = createAuthenticatedClient(accessToken);
    const userContext = await getUserContext(supabase);
    if (!userContext) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify call belongs to tenant
    const { data: call, error: callError } = await supabase
      .from('voice_calls')
      .select('id, tenant_id')
      .eq('id', callId)
      .eq('tenant_id', userContext.tenant_id)
      .single();

    if (callError || !call) {
      return NextResponse.json(
        { success: false, message: 'Llamada no encontrada' },
        { status: 404 }
      );
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('voice_call_messages')
      .select('id, role, content, detected_intent, confidence, sequence_number, created_at')
      .eq('call_id', callId)
      .order('sequence_number', { ascending: true });

    if (messagesError) {
      console.error('[Voice Call Messages] Error:', messagesError);
      return NextResponse.json(
        { success: false, message: 'Error al obtener mensajes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
    });
  } catch (error) {
    console.error('[Voice Call Messages] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
