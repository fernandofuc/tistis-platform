// =====================================================
// TIS TIS PLATFORM - AI Learning Data API
// Endpoint para obtener datos de AI Learning (patrones y vocabulario)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  getClientIP,
  publicAPILimiter,
  rateLimitExceeded,
} from '@/src/shared/lib/rate-limit';

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
// TYPES
// ======================

interface MessagePattern {
  id: string;
  pattern_type: string;
  pattern_value: string;
  occurrence_count: number;
  last_occurrence: string;
  first_occurrence: string;
  context_examples: string[];
  sentiment_avg: number | null;
}

interface LearnedVocabulary {
  id: string;
  term: string;
  meaning: string | null;
  category: string;
  usage_count: number;
  synonyms: string[];
}

interface AILearningStats {
  total_patterns: number;
  total_vocabulary: number;
  patterns_by_type: Record<string, number>;
  high_priority_patterns: number;
  last_learning_run: string | null;
}

// Pattern type labels in Spanish
const PATTERN_TYPE_LABELS: Record<string, string> = {
  service_request: 'Solicitud de Servicio',
  pricing_inquiry: 'Consulta de Precio',
  scheduling_preference: 'Preferencia de Horario',
  pain_point: 'Problema/Dolor',
  objection: 'Objeción',
  competitor_mention: 'Mención de Competencia',
  satisfaction: 'Satisfacción',
  complaint: 'Queja',
  referral: 'Referido',
  vocabulary: 'Vocabulario',
  question_pattern: 'Patrón de Pregunta',
  booking_behavior: 'Comportamiento de Reserva',
  follow_up_need: 'Necesidad de Seguimiento',
  urgency_indicator: 'Indicador de Urgencia',
};

// High priority pattern types (for alerts)
const HIGH_PRIORITY_TYPES = ['urgency_indicator', 'complaint', 'objection', 'pain_point'];

// ======================
// GET - Retrieve AI Learning data
// ======================
export async function GET(request: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(clientIP, publicAPILimiter);

  if (!rateLimitResult.success) {
    return rateLimitExceeded(rateLimitResult);
  }

  try {
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No autenticado - Token no proporcionado' },
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

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, vertical')
      .eq('id', tenantId)
      .single();

    // Only available for Essentials+ plans and dental/restaurant verticals
    if (tenant?.plan === 'starter') {
      return NextResponse.json({
        success: true,
        status: 'blocked',
        reason: 'AI Learning no disponible en plan Starter',
        plan: 'starter',
        patterns: [],
        vocabulary: [],
        stats: null,
      });
    }

    // Only for dental and restaurant verticals
    if (tenant?.vertical !== 'dental' && tenant?.vertical !== 'restaurant') {
      return NextResponse.json({
        success: true,
        status: 'not_applicable',
        reason: 'AI Learning solo disponible para verticales dental y restaurante',
        vertical: tenant?.vertical,
        patterns: [],
        vocabulary: [],
        stats: null,
      });
    }

    // Get learning config
    const { data: learningConfig } = await supabase
      .from('ai_learning_config')
      .select('learning_enabled, last_learning_run')
      .eq('tenant_id', tenantId)
      .single();

    // Get message patterns (top 50 by occurrence)
    const { data: patterns } = await supabase
      .from('ai_message_patterns')
      .select('id, pattern_type, pattern_value, occurrence_count, last_occurrence, first_occurrence, context_examples, sentiment_avg')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('occurrence_count', { ascending: false })
      .limit(50);

    // Get learned vocabulary (top 30 by usage)
    const { data: vocabulary } = await supabase
      .from('ai_learned_vocabulary')
      .select('id, term, meaning, category, usage_count, synonyms')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(30);

    // Calculate stats
    const patternsByType: Record<string, number> = {};
    let highPriorityCount = 0;

    (patterns || []).forEach((p: MessagePattern) => {
      patternsByType[p.pattern_type] = (patternsByType[p.pattern_type] || 0) + 1;
      if (HIGH_PRIORITY_TYPES.includes(p.pattern_type)) {
        highPriorityCount++;
      }
    });

    const stats: AILearningStats = {
      total_patterns: patterns?.length || 0,
      total_vocabulary: vocabulary?.length || 0,
      patterns_by_type: patternsByType,
      high_priority_patterns: highPriorityCount,
      last_learning_run: learningConfig?.last_learning_run || null,
    };

    // Add Spanish labels to patterns
    const enrichedPatterns = (patterns || []).map((p: MessagePattern) => ({
      ...p,
      pattern_type_label: PATTERN_TYPE_LABELS[p.pattern_type] || p.pattern_type,
      is_high_priority: HIGH_PRIORITY_TYPES.includes(p.pattern_type),
    }));

    return NextResponse.json({
      success: true,
      status: learningConfig?.learning_enabled ? 'active' : 'inactive',
      plan: tenant?.plan || 'essentials',
      vertical: tenant?.vertical,
      patterns: enrichedPatterns,
      vocabulary: vocabulary || [],
      stats,
      pattern_type_labels: PATTERN_TYPE_LABELS,
    });
  } catch (error) {
    console.error('[AI Learning API] GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de AI Learning' },
      { status: 500 }
    );
  }
}
