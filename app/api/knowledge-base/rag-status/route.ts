// =====================================================
// TIS TIS PLATFORM - RAG Status API
// V7.2: Endpoint para obtener el estado de salud del RAG
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getAuthenticatedContext,
  isAuthError,
  createAuthErrorResponse,
} from '@/src/shared/lib/auth-helper';

// Force dynamic rendering - this API uses request headers
export const dynamic = 'force-dynamic';

// ======================
// TYPES
// ======================

interface RAGHealthStatus {
  status: 'healthy' | 'good' | 'degraded' | 'critical' | 'no_content';
  total_items: number;
  pending_embeddings: number;
  processed_embeddings: number;
  completion_percentage: number;
  details: Array<{
    type: string;
    total: number;
    pending: number;
    processed: number;
  }>;
  last_check: string;
}

// ======================
// GET - Obtener estado del RAG
// ======================

export async function GET(request: NextRequest) {
  try {
    // 1. Autenticar usuario
    const authResult = await getAuthenticatedContext(request);
    if (isAuthError(authResult)) {
      return createAuthErrorResponse(authResult);
    }

    // 2. Obtener tenant_id del query param o del contexto autenticado
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id') || authResult.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'tenant_id requerido' },
        { status: 400 }
      );
    }

    // 3. Crear cliente Supabase con service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. Llamar a la función RPC get_rag_health_status
    const { data, error } = await supabase.rpc('get_rag_health_status', {
      p_tenant_id: tenantId,
    });

    if (error) {
      console.error('[rag-status] RPC error:', error);

      // Si la función no existe, hacer cálculo manual
      if (error.code === '42883') {
        const manualStatus = await calculateRAGStatusManually(supabase, tenantId);
        return NextResponse.json({
          success: true,
          data: manualStatus,
        });
      }

      throw error;
    }

    // 5. Retornar datos
    return NextResponse.json({
      success: true,
      data: data as RAGHealthStatus,
    });
  } catch (error) {
    console.error('[rag-status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener estado del RAG',
      },
      { status: 500 }
    );
  }
}

// ======================
// HELPER: Cálculo manual si RPC no existe
// ======================

async function calculateRAGStatusManually(
  // eslint-disable-next-line
  supabase: any,
  tenantId: string
): Promise<RAGHealthStatus> {
  const details: RAGHealthStatus['details'] = [];
  let totalItems = 0;
  let pendingEmbeddings = 0;

  // Consultar cada tabla
  const tables = [
    { name: 'ai_knowledge_articles', type: 'knowledge_article' },
    { name: 'faqs', type: 'faq' },
    { name: 'ai_business_policies', type: 'policy' },
    { name: 'services', type: 'service' },
  ];

  for (const table of tables) {
    try {
      // Total activos
      const { count: totalCount } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      // Sin embedding
      const { count: pendingCount } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('embedding', null);

      const total = totalCount || 0;
      const pending = pendingCount || 0;
      const processed = total - pending;

      details.push({
        type: table.type,
        total,
        pending,
        processed,
      });

      totalItems += total;
      pendingEmbeddings += pending;
    } catch {
      // Tabla no existe o error, continuar
      continue;
    }
  }

  const processedEmbeddings = totalItems - pendingEmbeddings;
  const completionPercentage = totalItems > 0
    ? Math.round((processedEmbeddings / totalItems) * 100)
    : 100;

  // Determinar estado de salud
  let status: RAGHealthStatus['status'];
  if (totalItems === 0) {
    status = 'no_content';
  } else if (pendingEmbeddings === 0) {
    status = 'healthy';
  } else if (pendingEmbeddings / totalItems < 0.1) {
    status = 'good';
  } else if (pendingEmbeddings / totalItems < 0.5) {
    status = 'degraded';
  } else {
    status = 'critical';
  }

  return {
    status,
    total_items: totalItems,
    pending_embeddings: pendingEmbeddings,
    processed_embeddings: processedEmbeddings,
    completion_percentage: completionPercentage,
    details,
    last_check: new Date().toISOString(),
  };
}
