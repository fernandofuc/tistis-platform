// =====================================================
// TIS TIS PLATFORM - Knowledge Base API
// CRUD operations for AI Knowledge Base
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
// TYPES
// ======================

interface KnowledgeBasePayload {
  type: 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors';
  data: Record<string, unknown>;
}

// ======================
// GET - Retrieve all Knowledge Base data for tenant
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

    // Fetch all Knowledge Base data in parallel
    const [
      instructionsRes,
      policiesRes,
      articlesRes,
      templatesRes,
      competitorsRes,
    ] = await Promise.all([
      supabase
        .from('ai_custom_instructions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false }),
      supabase
        .from('ai_business_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('policy_type'),
      supabase
        .from('ai_knowledge_articles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('category')
        .order('display_order'),
      supabase
        .from('ai_response_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('trigger_type'),
      supabase
        .from('ai_competitor_handling')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('competitor_name'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        instructions: instructionsRes.data || [],
        policies: policiesRes.data || [],
        articles: articlesRes.data || [],
        templates: templatesRes.data || [],
        competitors: competitorsRes.data || [],
      },
    });
  } catch (error) {
    console.error('[Knowledge Base API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener Knowledge Base' },
      { status: 500 }
    );
  }
}

// ======================
// POST - Create new Knowledge Base item
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

    // Check permissions (only owner, admin, manager can modify)
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar Knowledge Base' },
        { status: 403 }
      );
    }

    const body: KnowledgeBasePayload = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Tipo y datos requeridos' },
        { status: 400 }
      );
    }

    // Map type to table
    const tableMap: Record<string, string> = {
      instructions: 'ai_custom_instructions',
      policies: 'ai_business_policies',
      articles: 'ai_knowledge_articles',
      templates: 'ai_response_templates',
      competitors: 'ai_competitor_handling',
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return NextResponse.json(
        { error: 'Tipo de Knowledge Base inválido' },
        { status: 400 }
      );
    }

    // Build insert data - only ai_custom_instructions has created_by column
    // DB Schema per table:
    // - ai_custom_instructions: has created_by
    // - ai_business_policies: NO created_by
    // - ai_knowledge_articles: NO created_by
    // - ai_response_templates: NO created_by
    const insertData: Record<string, unknown> = {
      ...data,
      tenant_id: userRole.tenant_id,
    };

    // Only add created_by for instructions table (the only one that has this column)
    if (type === 'instructions') {
      insertData.created_by = user.id;
    }

    const { data: inserted, error: insertError } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[Knowledge Base API] Insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: inserted,
    });
  } catch (error) {
    console.error('[Knowledge Base API] POST error:', error);
    return NextResponse.json(
      { error: 'Error al crear item de Knowledge Base' },
      { status: 500 }
    );
  }
}

// ======================
// PATCH - Update Knowledge Base item
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
      .single();

    if (roleError || !userRole) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      );
    }

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar Knowledge Base' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, id, data } = body;

    if (!type || !id || !data) {
      return NextResponse.json(
        { error: 'Tipo, ID y datos requeridos' },
        { status: 400 }
      );
    }

    // Map type to table
    const tableMap: Record<string, string> = {
      instructions: 'ai_custom_instructions',
      policies: 'ai_business_policies',
      articles: 'ai_knowledge_articles',
      templates: 'ai_response_templates',
      competitors: 'ai_competitor_handling',
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return NextResponse.json(
        { error: 'Tipo de Knowledge Base inválido' },
        { status: 400 }
      );
    }

    // Update (RLS will ensure tenant_id matches)
    const { data: updated, error: updateError } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id)
      .select()
      .single();

    if (updateError) {
      console.error('[Knowledge Base API] Update error:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[Knowledge Base API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar item de Knowledge Base' },
      { status: 500 }
    );
  }
}

// ======================
// DELETE - Delete Knowledge Base item
// ======================
export async function DELETE(request: NextRequest) {
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

    // Check permissions
    if (!['owner', 'admin', 'manager'].includes(userRole.role)) {
      return NextResponse.json(
        { error: 'Sin permisos para modificar Knowledge Base' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Tipo e ID requeridos' },
        { status: 400 }
      );
    }

    // Map type to table
    const tableMap: Record<string, string> = {
      instructions: 'ai_custom_instructions',
      policies: 'ai_business_policies',
      articles: 'ai_knowledge_articles',
      templates: 'ai_response_templates',
      competitors: 'ai_competitor_handling',
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return NextResponse.json(
        { error: 'Tipo de Knowledge Base inválido' },
        { status: 400 }
      );
    }

    // Delete (RLS will ensure tenant_id matches)
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('tenant_id', userRole.tenant_id);

    if (deleteError) {
      console.error('[Knowledge Base API] Delete error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Item eliminado correctamente',
    });
  } catch (error) {
    console.error('[Knowledge Base API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar item de Knowledge Base' },
      { status: 500 }
    );
  }
}
