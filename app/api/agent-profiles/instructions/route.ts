// =====================================================
// TIS TIS PLATFORM - Agent Profile Instructions API
// CRUD operations for prompt instructions by profile
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
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
// GET - List instructions for a profile type
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

    // Get profile_type from query params
    const { searchParams } = new URL(request.url);
    const profileType = searchParams.get('profile_type') || 'business';

    // Fetch instructions for this tenant and profile type
    // Using existing ai_custom_instructions table
    const { data: instructions, error } = await supabase
      .from('ai_custom_instructions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Instructions API] Fetch error:', error);
      return NextResponse.json(
        { error: 'Error al obtener instrucciones' },
        { status: 500 }
      );
    }

    // Filter by profile type if the column exists
    // Note: profile_type may not exist yet in older schemas
    const filteredInstructions = instructions?.filter((inst: Record<string, unknown>) => {
      // If profile_type column exists and is set, filter by it
      if (inst.profile_type) {
        return inst.profile_type === profileType;
      }
      // Otherwise, show all for business profile (legacy behavior)
      return profileType === 'business';
    }) || [];

    return NextResponse.json({
      success: true,
      profile_type: profileType,
      instructions: filteredInstructions,
      total: filteredInstructions.length,
    });
  } catch (error) {
    console.error('[Instructions API] GET Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener instrucciones' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create new instruction
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

    // Only owner and admin can create instructions
    if (!['owner', 'admin'].includes(context.userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para crear instrucciones' },
        { status: 403 }
      );
    }

    const tenantId = context.userRole.tenant_id;
    const body = await request.json();

    // Validate required fields
    if (!body.instruction_type || !body.title || !body.instruction) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Check include_in_prompt limit (max 5)
    if (body.include_in_prompt) {
      const { count } = await supabase
        .from('ai_custom_instructions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('include_in_prompt', true);

      if (count && count >= 5) {
        return NextResponse.json(
          { error: 'Máximo 5 instrucciones pueden incluirse en el prompt' },
          { status: 400 }
        );
      }
    }

    // Create instruction
    const { data: instruction, error } = await supabase
      .from('ai_custom_instructions')
      .insert({
        tenant_id: tenantId,
        instruction_type: body.instruction_type,
        title: body.title,
        instruction: body.instruction,
        examples: body.examples || null,
        priority: body.priority || 0,
        include_in_prompt: body.include_in_prompt ?? true,
        is_active: true,
        created_by: context.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('[Instructions API] Create error:', error);
      return NextResponse.json(
        { error: 'Error al crear instrucción' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      instruction,
    });
  } catch (error) {
    console.error('[Instructions API] POST Error:', error);
    return NextResponse.json(
      { error: 'Error al crear instrucción' },
      { status: 500 }
    );
  }
}
