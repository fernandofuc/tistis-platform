// =====================================================
// TIS TIS PLATFORM - AI Configuration API
// CRUD operations for AI tenant configuration
// =====================================================

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
// GET - Retrieve AI configuration for tenant
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

    const tenantId = userRole.tenant_id;

    // Fetch AI configuration
    const { data: config, error: configError } = await supabase
      .from('ai_tenant_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    // If no config exists, return default config matching database schema
    if (configError && configError.code === 'PGRST116') {
      return NextResponse.json({
        success: true,
        data: {
          tenant_id: tenantId,
          ai_enabled: true,
          ai_personality: 'professional_friendly',
          ai_temperature: 0.7,
          max_tokens: 500,
          escalation_keywords: ['queja', 'molesto', 'enojado', 'gerente', 'supervisor'],
          max_turns_before_escalation: 10,
          escalate_on_hot_lead: true,
          out_of_hours_enabled: true,
          auto_greeting_enabled: true,
          supported_languages: ['es', 'en'],
          default_language: 'es',
        },
      });
    }

    if (configError) {
      console.error('[AI Config API] GET error:', configError);
      return NextResponse.json(
        { error: 'Error al obtener configuración' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('[AI Config API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración de IA' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create or update AI configuration (upsert)
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

    // Check permissions (only owner, admin can modify AI config)
    if (!['owner', 'admin'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar configuración de IA' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tenant_id: _, id: __, ...configData } = body;

    // First, check if config exists
    const { data: existingConfig } = await supabase
      .from('ai_tenant_config')
      .select('id')
      .eq('tenant_id', userRole.tenant_id)
      .single();

    let result;

    if (existingConfig) {
      // Update existing config
      result = await supabase
        .from('ai_tenant_config')
        .update({
          ...configData,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', userRole.tenant_id)
        .select()
        .single();
    } else {
      // Create new config using service role to bypass RLS INSERT restriction
      // Note: The RLS only allows SELECT and UPDATE, not INSERT
      // For new tenants, we need to use the service role
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      result = await serviceClient
        .from('ai_tenant_config')
        .insert({
          tenant_id: userRole.tenant_id,
          ...configData,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('[AI Config API] Save error:', result.error);
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
    console.error('[AI Config API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al guardar configuración de IA' },
      { status: 500 }
    );
  }
}
