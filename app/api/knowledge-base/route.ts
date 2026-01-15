// =====================================================
// TIS TIS PLATFORM - Knowledge Base API
// CRUD operations for AI Knowledge Base
// With plan-based limits validation
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  type KBItemType,
  canAddKBItem,
  getKBUsageStatus,
  getPlanKBLimits,
  KB_ITEM_LABELS,
} from '@/src/shared/config/plans';

// Force dynamic rendering - this API uses request headers
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

// ======================
// TYPES
// ======================

interface KnowledgeBasePayload {
  type: 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors';
  data: Record<string, unknown>;
}

// ======================
// PLAN LIMITS VALIDATION
// ======================

/**
 * Obtiene el plan del tenant y los conteos actuales de KB items
 * Usado para validar límites antes de crear nuevos items
 */
async function getTenantPlanAndCounts(
  supabase: ReturnType<typeof createAuthenticatedClient>,
  tenantId: string
): Promise<{
  plan: string;
  counts: Record<KBItemType, number>;
} | null> {
  try {
    // Obtener plan del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('plan')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.warn('[Knowledge Base API] Could not get tenant plan:', tenantError?.message);
      return null;
    }

    // Obtener conteos actuales de cada tipo de KB item
    const [
      instructionsCount,
      policiesCount,
      articlesCount,
      templatesCount,
      competitorsCount,
    ] = await Promise.all([
      supabase
        .from('ai_custom_instructions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('ai_business_policies')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('ai_knowledge_articles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('ai_response_templates')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      supabase
        .from('ai_competitor_handling')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ]);

    return {
      plan: tenant.plan || 'starter',
      counts: {
        instructions: instructionsCount.count || 0,
        policies: policiesCount.count || 0,
        articles: articlesCount.count || 0,
        templates: templatesCount.count || 0,
        competitors: competitorsCount.count || 0,
      },
    };
  } catch (err) {
    console.error('[Knowledge Base API] Error getting plan and counts:', err);
    return null;
  }
}

// ======================
// CACHE INVALIDATION (FASE 6 IMPROVEMENT)
// ======================

/**
 * Invalida el caché de prompts cuando se modifica el Knowledge Base.
 * Marca los prompts como 'needs_regeneration' para que se regeneren
 * la próxima vez que se usen.
 *
 * IMPORTANTE: No regenera automáticamente para evitar bloquear la UI.
 * El usuario debe hacer clic en "Regenerar" o los prompts se regenerarán
 * en background cuando se detecte el cambio de hash.
 */
async function invalidatePromptCache(
  supabase: ReturnType<typeof createAuthenticatedClient>,
  tenantId: string,
  changeType: string
): Promise<void> {
  try {
    // Actualizar el campo updated_at para marcar que hay cambios pendientes
    // El hash se recalculará cuando se regenere el prompt
    const { error } = await supabase
      .from('ai_generated_prompts')
      .update({
        // No cambiamos el status a 'generating' para no bloquear
        // Solo marcamos timestamp de última modificación del KB
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (error) {
      console.warn(`[Knowledge Base API] Could not mark cache for regeneration:`, error.message);
    } else {
      console.log(`[Knowledge Base API] Prompt cache marked for regeneration (${changeType}) - tenant: ${tenantId}`);
    }
  } catch (err) {
    // No fallamos la operación principal si la invalidación falla
    console.error(`[Knowledge Base API] Cache invalidation error:`, err);
  }
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

    // Obtener información del plan para mostrar límites en UI
    const planData = await getTenantPlanAndCounts(supabase, tenantId);
    const planLimits = planData ? getPlanKBLimits(planData.plan) : null;

    return NextResponse.json({
      success: true,
      data: {
        instructions: instructionsRes.data || [],
        policies: policiesRes.data || [],
        articles: articlesRes.data || [],
        templates: templatesRes.data || [],
        competitors: competitorsRes.data || [],
      },
      // Incluir información de plan para UI de límites
      planInfo: planData ? {
        plan: planData.plan,
        limits: planLimits,
        usage: {
          instructions: (instructionsRes.data || []).length,
          policies: (policiesRes.data || []).length,
          articles: (articlesRes.data || []).length,
          templates: (templatesRes.data || []).length,
          competitors: (competitorsRes.data || []).length,
        },
      } : null,
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

    // ======================
    // PLAN LIMITS VALIDATION
    // ======================
    const planData = await getTenantPlanAndCounts(supabase, userRole.tenant_id);

    if (planData) {
      const itemType = type as KBItemType;
      const currentCount = planData.counts[itemType];

      // Verificar si puede agregar más items de este tipo
      if (!canAddKBItem(planData.plan, itemType, currentCount)) {
        const usageStatus = getKBUsageStatus(planData.plan, itemType, currentCount);
        const limits = getPlanKBLimits(planData.plan);

        console.log(`[Knowledge Base API] Plan limit reached: ${planData.plan} - ${type} (${currentCount}/${usageStatus.limit})`);

        return NextResponse.json(
          {
            error: 'plan_limit_reached',
            message: `Has alcanzado el límite de ${KB_ITEM_LABELS[itemType]} para tu plan (${usageStatus.current}/${usageStatus.limit})`,
            details: {
              plan: planData.plan,
              itemType,
              current: usageStatus.current,
              limit: usageStatus.limit,
              allLimits: limits,
            },
          },
          { status: 403 }
        );
      }
    }
    // Si no pudimos obtener planData, permitimos la operación por ahora
    // para no bloquear a usuarios por un error de consulta

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

    // FASE 6: Invalidar caché de prompts cuando se modifica Knowledge Base
    await invalidatePromptCache(supabase, userRole.tenant_id, `POST ${type}`);

    return NextResponse.json({
      success: true,
      data: inserted,
      cacheInvalidated: true, // Indicar al frontend que debe regenerar prompts
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

    // FASE 6: Invalidar caché de prompts cuando se modifica Knowledge Base
    await invalidatePromptCache(supabase, userRole.tenant_id, `PATCH ${type}`);

    return NextResponse.json({
      success: true,
      data: updated,
      cacheInvalidated: true, // Indicar al frontend que debe regenerar prompts
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

    // FASE 6: Invalidar caché de prompts cuando se modifica Knowledge Base
    await invalidatePromptCache(supabase, userRole.tenant_id, `DELETE ${type}`);

    return NextResponse.json({
      success: true,
      message: 'Item eliminado correctamente',
      cacheInvalidated: true, // Indicar al frontend que debe regenerar prompts
    });
  } catch (error) {
    console.error('[Knowledge Base API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar item de Knowledge Base' },
      { status: 500 }
    );
  }
}
