// =====================================================
// TIS TIS PLATFORM - Business Insights Service
// Generación de insights de negocio usando Gemini 3.0
// =====================================================
// Este servicio analiza los datos del tenant para generar
// insights automáticos y accionables cada 3 días.
//
// IMPORTANTE: Cada tenant tiene su propio algoritmo aislado.
// Los datos NUNCA se mezclan entre tenants diferentes.
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  generateWithGemini,
  DEFAULT_GEMINI_MODELS,
  isGeminiConfigured,
} from '@/src/shared/lib/gemini';
import { SafetyResilienceService } from './safety-resilience.service';

// REVISIÓN 5.2 G-B4: Circuit breaker name for Gemini insights
const GEMINI_INSIGHTS_CIRCUIT = 'gemini-business-insights';

// ======================
// TYPES
// ======================

export interface BusinessInsight {
  insight_type: InsightType;
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
  confidence_score: number;
  impact_score: number;
  data_points: number;
  metadata: Record<string, unknown>;
}

export type InsightType =
  | 'popular_service'
  | 'peak_hours'
  | 'common_objection'
  | 'pricing_sensitivity'
  | 'competitor_threat'
  | 'satisfaction_trend'
  | 'booking_pattern'
  | 'communication_style'
  | 'follow_up_opportunity'
  | 'upsell_opportunity'
  | 'seasonal_pattern'
  | 'response_improvement'
  | 'lead_conversion'
  | 'loyalty_insight';

export interface TenantAnalyticsData {
  tenantId: string;
  tenantName: string;
  vertical: string;
  plan: string;
  // Conversaciones
  totalConversations: number;
  conversationsLast30Days: number;
  // Leads
  totalLeads: number;
  leadsConverted: number;
  conversionRate: number;
  // Patrones
  topServiceRequests: Array<{ service: string; count: number }>;
  commonObjections: Array<{ objection: string; count: number; examples: string[] }>;
  schedulingPreferences: Array<{ preference: string; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  peakDays: Array<{ day: string; count: number }>;
  // Lealtad
  loyaltyMembers?: number;
  avgPointsPerMember?: number;
  redemptionRate?: number;
  // Sentimiento
  avgSentiment: number;
  satisfactionMentions: number;
  complaintMentions: number;
}

export interface InsightGenerationResult {
  success: boolean;
  tenantId: string;
  insightsGenerated: number;
  insightsExpired: number;
  error?: string;
}

// ======================
// CONFIGURATION
// ======================

const MIN_CONVERSATIONS_FOR_INSIGHTS = 50;
const INSIGHTS_EXPIRY_DAYS = 7;
const MAX_INSIGHTS_PER_PLAN: Record<string, number> = {
  starter: 0,      // Bloqueado
  essentials: 5,   // 3-5 insights
  growth: 10,      // 8-10 insights
};

// ======================
// REVISIÓN 5.3 G-B18: LÍMITES DE DATOS PARA PROMPT
// ======================
// Previene overflow del context window de Gemini
// limitando la cantidad de datos enviados en el prompt

const PROMPT_DATA_LIMITS = {
  max_service_requests: 15,      // Top 15 servicios más solicitados
  max_objections: 8,             // Top 8 objeciones más comunes
  max_scheduling_prefs: 8,       // Top 8 preferencias de horario
  max_peak_hours: 5,             // Top 5 horas pico
  max_peak_days: 7,              // Todos los días de la semana
  max_objection_examples: 2,     // Máx 2 ejemplos por objeción
  max_prompt_chars: 15000,       // Límite total de caracteres del prompt
};

/**
 * REVISIÓN 5.3 G-B18: Limita los datos analíticos para evitar overflow del prompt
 * Aplica límites a cada tipo de dato para mantener el prompt dentro del context window
 */
function limitAnalyticsForPrompt(data: TenantAnalyticsData): TenantAnalyticsData {
  return {
    ...data,
    // Limitar arrays a los top N más relevantes
    topServiceRequests: data.topServiceRequests.slice(0, PROMPT_DATA_LIMITS.max_service_requests),
    commonObjections: data.commonObjections
      .slice(0, PROMPT_DATA_LIMITS.max_objections)
      .map(obj => ({
        ...obj,
        // Limitar ejemplos por objeción
        examples: obj.examples.slice(0, PROMPT_DATA_LIMITS.max_objection_examples),
      })),
    schedulingPreferences: data.schedulingPreferences.slice(0, PROMPT_DATA_LIMITS.max_scheduling_prefs),
    peakHours: data.peakHours.slice(0, PROMPT_DATA_LIMITS.max_peak_hours),
    peakDays: data.peakDays.slice(0, PROMPT_DATA_LIMITS.max_peak_days),
  };
}

/**
 * REVISIÓN 5.3 G-B18: Trunca el prompt si excede el límite de caracteres
 * Esto es una última línea de defensa si limitAnalyticsForPrompt no es suficiente
 */
function truncatePromptIfNeeded(prompt: string): string {
  if (prompt.length <= PROMPT_DATA_LIMITS.max_prompt_chars) {
    return prompt;
  }

  console.warn(`[Business Insights] G-B18: Prompt truncated from ${prompt.length} to ${PROMPT_DATA_LIMITS.max_prompt_chars} chars`);

  // Encontrar un punto de corte seguro (al final de una línea)
  const truncated = prompt.substring(0, PROMPT_DATA_LIMITS.max_prompt_chars);
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastNewline > PROMPT_DATA_LIMITS.max_prompt_chars * 0.8) {
    return truncated.substring(0, lastNewline) + '\n\n[Datos truncados por límite de tamaño]';
  }

  return truncated + '\n\n[Datos truncados por límite de tamaño]';
}

// ======================
// DATA COLLECTION
// ======================

/**
 * Recopila todos los datos analíticos del tenant para análisis
 * IMPORTANTE: Solo recopila datos del tenant específico (aislamiento)
 */
export async function collectTenantAnalytics(tenantId: string): Promise<TenantAnalyticsData | null> {
  const supabase = createServerClient();

  try {
    // 1. Obtener información del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, vertical, plan')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[Business Insights] Tenant not found:', tenantId);
      return null;
    }

    // 2. Contar conversaciones totales y últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: totalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { count: conversationsLast30Days } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    // 3. Estadísticas de leads
    const { count: totalLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { count: leadsConverted } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['converted', 'won', 'customer']);

    const conversionRate = totalLeads && totalLeads > 0
      ? ((leadsConverted || 0) / totalLeads) * 100
      : 0;

    // 4. Obtener patrones de mensajes aprendidos
    const { data: patterns } = await supabase
      .from('ai_message_patterns')
      .select('pattern_type, pattern_value, occurrence_count, context_examples')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('occurrence_count', { ascending: false });

    // Procesar patrones por tipo
    const topServiceRequests = (patterns || [])
      .filter(p => p.pattern_type === 'service_request')
      .slice(0, 10)
      .map(p => ({ service: p.pattern_value, count: p.occurrence_count }));

    const commonObjections = (patterns || [])
      .filter(p => p.pattern_type === 'objection')
      .slice(0, 5)
      .map(p => ({
        objection: p.pattern_value,
        count: p.occurrence_count,
        examples: (p.context_examples || []).slice(0, 2),
      }));

    const schedulingPreferences = (patterns || [])
      .filter(p => p.pattern_type === 'scheduling_preference')
      .slice(0, 5)
      .map(p => ({ preference: p.pattern_value, count: p.occurrence_count }));

    // 5. Analizar horarios pico (de mensajes)
    const { data: messageTimestamps } = await supabase
      .from('messages')
      .select('created_at')
      .eq('tenant_id', tenantId)
      .eq('sender_type', 'contact')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1000);

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    (messageTimestamps || []).forEach(m => {
      const date = new Date(m.created_at);
      const hour = date.getHours();
      const day = dayNames[date.getDay()];
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const peakDays = Object.entries(dayCounts)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count);

    // 6. Datos de lealtad (si aplica)
    let loyaltyMembers = 0;
    let avgPointsPerMember = 0;
    let redemptionRate = 0;

    const { count: loyaltyCount } = await supabase
      .from('loyalty_members')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (loyaltyCount && loyaltyCount > 0) {
      loyaltyMembers = loyaltyCount;

      const { data: loyaltyStats } = await supabase
        .from('loyalty_members')
        .select('points_balance')
        .eq('tenant_id', tenantId);

      if (loyaltyStats && loyaltyStats.length > 0) {
        const totalPoints = loyaltyStats.reduce((sum, m) => sum + (m.points_balance || 0), 0);
        avgPointsPerMember = Math.round(totalPoints / loyaltyStats.length);
      }

      // Calcular tasa de redención
      const { count: totalRewards } = await supabase
        .from('loyalty_rewards')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const { count: redeemedRewards } = await supabase
        .from('loyalty_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('transaction_type', 'redeem');

      redemptionRate = totalRewards && totalRewards > 0
        ? ((redeemedRewards || 0) / totalRewards) * 100
        : 0;
    }

    // 7. Análisis de sentimiento de patrones
    const satisfactionPatterns = (patterns || [])
      .filter(p => p.pattern_type === 'satisfaction');
    const complaintPatterns = (patterns || [])
      .filter(p => p.pattern_type === 'complaint');

    const satisfactionMentions = satisfactionPatterns
      .reduce((sum, p) => sum + (p.occurrence_count || 0), 0);
    const complaintMentions = complaintPatterns
      .reduce((sum, p) => sum + (p.occurrence_count || 0), 0);

    const totalMentions = satisfactionMentions + complaintMentions;
    const avgSentiment = totalMentions > 0
      ? (satisfactionMentions - complaintMentions) / totalMentions
      : 0;

    return {
      tenantId,
      tenantName: tenant.name,
      vertical: tenant.vertical,
      plan: tenant.plan,
      totalConversations: totalConversations || 0,
      conversationsLast30Days: conversationsLast30Days || 0,
      totalLeads: totalLeads || 0,
      leadsConverted: leadsConverted || 0,
      conversionRate,
      topServiceRequests,
      commonObjections,
      schedulingPreferences,
      peakHours,
      peakDays,
      loyaltyMembers,
      avgPointsPerMember,
      redemptionRate,
      avgSentiment,
      satisfactionMentions,
      complaintMentions,
    };
  } catch (error) {
    console.error('[Business Insights] Error collecting analytics:', error);
    return null;
  }
}

// ======================
// INSIGHT GENERATION
// ======================

/**
 * Genera insights de negocio usando Gemini 3.0
 * El análisis es específico para el tenant y su vertical
 *
 * REVISIÓN 5.2 G-B4: Incluye circuit breaker para proteger contra fallos repetidos
 * REVISIÓN 5.3 G-B18: Limita datos para evitar overflow del context window
 */
async function generateInsightsWithGemini(
  data: TenantAnalyticsData,
  maxInsights: number
): Promise<BusinessInsight[]> {
  // REVISIÓN 5.2 G-B4: Verificar circuit breaker antes de llamar a Gemini
  if (SafetyResilienceService.isCircuitOpen(GEMINI_INSIGHTS_CIRCUIT)) {
    console.warn('[Business Insights] Circuit breaker OPEN - skipping Gemini call');
    return [];
  }

  // Verificar que Gemini está configurado
  if (!isGeminiConfigured()) {
    console.error('[Business Insights] Gemini not configured');
    return [];
  }

  // REVISIÓN 5.3 G-B18: Limitar datos para evitar overflow del context window
  const limitedData = limitAnalyticsForPrompt(data);

  // REVISIÓN 5.3 G-B18: Construir prompt con datos limitados
  const rawPrompt = `Eres un analista de negocios experto para empresas de servicios en México.
Analiza los siguientes datos de un negocio tipo "${limitedData.vertical}" llamado "${limitedData.tenantName}" y genera EXACTAMENTE ${maxInsights} insights accionables.

DATOS DEL NEGOCIO:
- Conversaciones totales: ${limitedData.totalConversations}
- Conversaciones últimos 30 días: ${limitedData.conversationsLast30Days}
- Leads totales: ${limitedData.totalLeads}
- Leads convertidos: ${limitedData.leadsConverted}
- Tasa de conversión: ${limitedData.conversionRate.toFixed(1)}%
- Miembros de lealtad: ${limitedData.loyaltyMembers}
- Puntos promedio por miembro: ${limitedData.avgPointsPerMember}
- Sentimiento promedio: ${limitedData.avgSentiment.toFixed(2)} (-1 negativo a +1 positivo)
- Menciones de satisfacción: ${limitedData.satisfactionMentions}
- Menciones de quejas: ${limitedData.complaintMentions}

SERVICIOS MÁS SOLICITADOS:
${limitedData.topServiceRequests.map(s => `- ${s.service}: ${s.count} veces`).join('\n') || 'Sin datos suficientes'}

OBJECIONES COMUNES:
${limitedData.commonObjections.map(o => `- "${o.objection}" (${o.count} veces)`).join('\n') || 'Sin datos suficientes'}

PREFERENCIAS DE HORARIO:
${limitedData.schedulingPreferences.map(p => `- ${p.preference}: ${p.count} veces`).join('\n') || 'Sin datos suficientes'}

HORAS PICO DE MENSAJES:
${limitedData.peakHours.map(h => `- ${h.hour}:00 hrs: ${h.count} mensajes`).join('\n') || 'Sin datos suficientes'}

DÍAS MÁS ACTIVOS:
${limitedData.peakDays.map(d => `- ${d.day}: ${d.count} mensajes`).join('\n') || 'Sin datos suficientes'}

REGLAS PARA GENERAR INSIGHTS:
1. Cada insight debe ser ESPECÍFICO y ACCIONABLE para este negocio
2. La recomendación debe ser algo que el dueño pueda implementar esta semana
3. Usa lenguaje claro y directo en español de México
4. Prioriza insights que puedan aumentar ingresos o mejorar experiencia del cliente
5. Incluye números específicos cuando sea posible

TIPOS DE INSIGHTS A CONSIDERAR:
- popular_service: Servicios más demandados
- peak_hours: Horas/días de mayor actividad
- common_objection: Objeciones frecuentes y cómo manejarlas
- pricing_sensitivity: Sensibilidad a precios detectada
- lead_conversion: Oportunidades de mejorar conversión
- loyalty_insight: Insights del programa de lealtad
- follow_up_opportunity: Oportunidades de seguimiento
- upsell_opportunity: Oportunidades de venta cruzada
- response_improvement: Mejoras en respuestas del AI

RESPONDE EN FORMATO JSON (array de objetos):
[
  {
    "insight_type": "tipo_del_insight",
    "title": "Título corto y llamativo (máx 60 chars)",
    "description": "Descripción detallada del hallazgo (2-3 oraciones)",
    "evidence": ["Dato 1 que soporta el insight", "Dato 2"],
    "recommendation": "Acción específica a tomar",
    "confidence_score": 0.85,
    "impact_score": 0.75
  }
]

Genera SOLO el JSON, sin texto adicional.`;

  // REVISIÓN 5.3 G-B18: Aplicar truncación si es necesario
  const prompt = truncatePromptIfNeeded(rawPrompt);

  // Usar el cliente centralizado de Gemini 3.0
  // REVISIÓN 5.2 G-B4: Envolver en try-catch para circuit breaker
  let result;
  try {
    result = await generateWithGemini(prompt, {
      model: DEFAULT_GEMINI_MODELS.BUSINESS_INSIGHTS,
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    if (!result.success) {
      // REVISIÓN 5.2 G-B4: Registrar fallo en circuit breaker
      SafetyResilienceService.recordCircuitFailure(GEMINI_INSIGHTS_CIRCUIT);
      console.error('[Business Insights] Gemini generation failed:', result.error);
      return [];
    }

    // REVISIÓN 5.2 G-B4: Registrar éxito en circuit breaker
    SafetyResilienceService.recordCircuitSuccess(GEMINI_INSIGHTS_CIRCUIT);
  } catch (error) {
    // REVISIÓN 5.2 G-B4: Registrar excepción como fallo
    SafetyResilienceService.recordCircuitFailure(GEMINI_INSIGHTS_CIRCUIT);
    console.error('[Business Insights] Gemini call threw exception:', error);
    return [];
  }

  const text = result.content;

  // Extraer JSON de la respuesta
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('[Business Insights] No JSON found in Gemini response');
    console.error('[Business Insights] Raw response:', text.substring(0, 500));
    return [];
  }

  let parsedInsights: unknown[];
  try {
    parsedInsights = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('[Business Insights] JSON parse error:', parseError);
    console.error('[Business Insights] Invalid JSON:', jsonMatch[0].substring(0, 500));
    return [];
  }

  // Validar que es un array
  if (!Array.isArray(parsedInsights)) {
    console.error('[Business Insights] Parsed result is not an array');
    return [];
  }

  // Validar y enriquecer cada insight con type guard
  const validInsights: BusinessInsight[] = [];
  for (const item of parsedInsights) {
    if (
      item &&
      typeof item === 'object' &&
      'insight_type' in item &&
      'title' in item &&
      'description' in item &&
      'recommendation' in item
    ) {
      validInsights.push({
        insight_type: String(item.insight_type) as InsightType,
        title: String(item.title).substring(0, 100), // Limitar longitud
        description: String(item.description),
        evidence: Array.isArray((item as Record<string, unknown>).evidence)
          ? ((item as Record<string, unknown>).evidence as string[]).map(String)
          : [],
        recommendation: String(item.recommendation),
        confidence_score: Math.min(1, Math.max(0, Number((item as Record<string, unknown>).confidence_score) || 0.5)),
        impact_score: Math.min(1, Math.max(0, Number((item as Record<string, unknown>).impact_score) || 0.5)),
        data_points: data.totalConversations,
        metadata: {
          generated_at: new Date().toISOString(),
          model: result.model,
          tenant_vertical: data.vertical,
          processing_time_ms: result.processingTimeMs,
        },
      });
    }
  }

  if (validInsights.length === 0) {
    console.warn('[Business Insights] No valid insights after validation');
  }

  return validInsights;
}

// ======================
// MAIN SERVICE FUNCTIONS
// ======================

/**
 * Verifica si un tenant tiene suficientes datos para generar insights
 */
export async function canGenerateInsights(tenantId: string): Promise<{
  canGenerate: boolean;
  reason?: string;
  conversationCount: number;
  requiredCount: number;
}> {
  const supabase = createServerClient();

  // Verificar plan del tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    return {
      canGenerate: false,
      reason: 'Tenant no encontrado',
      conversationCount: 0,
      requiredCount: MIN_CONVERSATIONS_FOR_INSIGHTS,
    };
  }

  // Plan Starter bloqueado
  if (tenant.plan === 'starter') {
    return {
      canGenerate: false,
      reason: 'Business IA no disponible en plan Starter. Actualiza a Essentials.',
      conversationCount: 0,
      requiredCount: MIN_CONVERSATIONS_FOR_INSIGHTS,
    };
  }

  // Contar conversaciones
  const { count: conversationCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  const count = conversationCount || 0;

  if (count < MIN_CONVERSATIONS_FOR_INSIGHTS) {
    return {
      canGenerate: false,
      reason: `Necesitas ${MIN_CONVERSATIONS_FOR_INSIGHTS - count} conversaciones más para activar Business IA`,
      conversationCount: count,
      requiredCount: MIN_CONVERSATIONS_FOR_INSIGHTS,
    };
  }

  return {
    canGenerate: true,
    conversationCount: count,
    requiredCount: MIN_CONVERSATIONS_FOR_INSIGHTS,
  };
}

// REVISIÓN 5.2 G-B3: Umbrales mínimos de data_points por tipo de insight
const MIN_DATA_POINTS_BY_TYPE: Partial<Record<InsightType, number>> = {
  popular_service: 20,      // Necesita suficientes solicitudes
  peak_hours: 50,           // Necesita suficientes mensajes para patrón
  common_objection: 10,     // Al menos 10 objeciones similares
  pricing_sensitivity: 15,  // Suficientes menciones de precio
  lead_conversion: 30,      // Datos de conversión significativos
  loyalty_insight: 20,      // Datos de lealtad
  follow_up_opportunity: 15,
  upsell_opportunity: 15,
  response_improvement: 25,
};

const DEFAULT_MIN_DATA_POINTS = 10;

/**
 * Genera insights de negocio para un tenant específico
 * Esta función es el punto de entrada principal
 *
 * REVISIÓN 5.2:
 * - G-B3: Valida data_points mínimos por tipo de insight
 * - G-B8: Guarda snapshot de vertical al momento de generación
 */
export async function generateBusinessInsights(tenantId: string): Promise<InsightGenerationResult> {
  const supabase = createServerClient();

  try {
    // 1. Verificar si puede generar insights
    const { canGenerate, reason } = await canGenerateInsights(tenantId);
    if (!canGenerate) {
      return {
        success: false,
        tenantId,
        insightsGenerated: 0,
        insightsExpired: 0,
        error: reason,
      };
    }

    // 2. Obtener plan y vertical del tenant
    // REVISIÓN 5.2 G-B8: Incluir vertical para snapshot
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, vertical')
      .eq('id', tenantId)
      .single();

    const maxInsights = MAX_INSIGHTS_PER_PLAN[tenant?.plan || 'essentials'] || 5;
    const tenantVertical = tenant?.vertical || 'general'; // G-B8: Capturar vertical

    // 3. Recopilar datos analíticos del tenant
    const analyticsData = await collectTenantAnalytics(tenantId);
    if (!analyticsData) {
      return {
        success: false,
        tenantId,
        insightsGenerated: 0,
        insightsExpired: 0,
        error: 'Error al recopilar datos analíticos',
      };
    }

    // 4. Expirar insights antiguos (más de 7 días)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - INSIGHTS_EXPIRY_DAYS);

    const { data: expiredData } = await supabase
      .from('ai_business_insights')
      .update({ is_active: false })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .lt('created_at', expiryDate.toISOString())
      .select('id');

    const expiredCount = expiredData?.length || 0;

    // 5. Generar nuevos insights con Gemini
    const insights = await generateInsightsWithGemini(analyticsData, maxInsights);

    if (insights.length === 0) {
      return {
        success: false,
        tenantId,
        insightsGenerated: 0,
        insightsExpired: expiredCount || 0,
        error: 'No se pudieron generar insights con Gemini',
      };
    }

    // 6. Guardar insights en la base de datos
    // REVISIÓN 5.2 G-B3: Validar y marcar data_points mínimos
    // REVISIÓN 5.2 G-B8: Incluir snapshot de vertical
    const now = new Date().toISOString();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const insightsToInsert = insights.map(insight => {
      // G-B3: Verificar si cumple data_points mínimos para su tipo
      const minRequired = MIN_DATA_POINTS_BY_TYPE[insight.insight_type] || DEFAULT_MIN_DATA_POINTS;
      const meetsMinDataPoints = insight.data_points >= minRequired;

      // G-B3: Ajustar confidence si no cumple mínimos
      const adjustedConfidence = meetsMinDataPoints
        ? insight.confidence_score
        : Math.min(insight.confidence_score, 0.5); // Limitar confianza si datos insuficientes

      return {
        tenant_id: tenantId,
        insight_type: insight.insight_type,
        title: insight.title,
        description: insight.description,
        evidence: insight.evidence,
        recommendation: insight.recommendation,
        confidence_score: adjustedConfidence,
        impact_score: insight.impact_score,
        data_points: insight.data_points,
        metadata: {
          ...insight.metadata,
          min_data_points_required: minRequired,
          meets_min_data_points: meetsMinDataPoints,
        },
        analysis_period_start: thirtyDaysAgo.toISOString(),
        analysis_period_end: now,
        is_active: true,
        is_actionable: true,
        was_acted_upon: false,
        dismissed: false,
        // G-B3: Marcar si cumple data_points mínimos
        min_data_points_met: meetsMinDataPoints,
        // G-B8: Snapshot de vertical al momento de generación
        vertical_at_generation: tenantVertical,
      };
    });

    const { error: insertError } = await supabase
      .from('ai_business_insights')
      .insert(insightsToInsert);

    if (insertError) {
      console.error('[Business Insights] Error inserting insights:', insertError);
      return {
        success: false,
        tenantId,
        insightsGenerated: 0,
        insightsExpired: expiredCount || 0,
        error: insertError.message,
      };
    }

    // 7. Actualizar timestamp de última generación (upsert para crear si no existe)
    await supabase
      .from('ai_learning_config')
      .upsert({
        tenant_id: tenantId,
        last_insight_generation: now,
        learning_enabled: true,
        updated_at: now,
      }, {
        onConflict: 'tenant_id',
        ignoreDuplicates: false,
      });

    return {
      success: true,
      tenantId,
      insightsGenerated: insights.length,
      insightsExpired: expiredCount || 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Business Insights] Error generating insights:', error);
    return {
      success: false,
      tenantId,
      insightsGenerated: 0,
      insightsExpired: 0,
      error: errorMessage,
    };
  }
}

/**
 * Obtiene los insights activos de un tenant
 *
 * REVISIÓN 5.2 G-B7: Filtra insights expirados en tiempo de lectura
 * Esto previene mostrar insights stale aunque is_active sea true
 */
export async function getActiveInsights(tenantId: string): Promise<BusinessInsight[]> {
  const supabase = createServerClient();

  // REVISIÓN 5.2 G-B7: Calcular fecha de expiración para filtro
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - INSIGHTS_EXPIRY_DAYS);

  const { data: insights, error } = await supabase
    .from('ai_business_insights')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('dismissed', false)
    .gte('created_at', expiryDate.toISOString()) // G-B7: Solo insights no expirados
    .order('impact_score', { ascending: false })
    .order('confidence_score', { ascending: false });

  if (error) {
    console.error('[Business Insights] Error fetching insights:', error);
    return [];
  }

  return insights || [];
}

/**
 * Marca un insight como visto/leído
 * IMPORTANTE: Hace merge con metadata existente para no perder datos
 */
export async function markInsightAsSeen(insightId: string, tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  // Primero obtener metadata existente
  const { data: existing } = await supabase
    .from('ai_business_insights')
    .select('metadata')
    .eq('id', insightId)
    .eq('tenant_id', tenantId)
    .single();

  const { error } = await supabase
    .from('ai_business_insights')
    .update({
      metadata: {
        ...(existing?.metadata || {}),
        seen_at: new Date().toISOString(),
      },
    })
    .eq('id', insightId)
    .eq('tenant_id', tenantId);

  return !error;
}

/**
 * Descarta un insight (el usuario no lo considera útil)
 */
export async function dismissInsight(insightId: string, tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_business_insights')
    .update({ dismissed: true })
    .eq('id', insightId)
    .eq('tenant_id', tenantId);

  return !error;
}

/**
 * Marca que se actuó sobre un insight
 */
export async function markInsightActedUpon(insightId: string, tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_business_insights')
    .update({ was_acted_upon: true })
    .eq('id', insightId)
    .eq('tenant_id', tenantId);

  return !error;
}

/**
 * Obtiene el conteo de insights no vistos (para notificación)
 * Nota: Usa approach alternativo ya que filtrar JSONB con .is() puede ser problemático
 *
 * REVISIÓN 5.2 G-B7: También filtra insights expirados
 */
export async function getUnseenInsightsCount(tenantId: string): Promise<number> {
  const supabase = createServerClient();

  // REVISIÓN 5.2 G-B7: Calcular fecha de expiración
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - INSIGHTS_EXPIRY_DAYS);

  // Obtener todos los insights activos y filtrar en código
  // ya que el filtro JSONB .is('metadata->seen_at', null) no es confiable
  const { data: insights } = await supabase
    .from('ai_business_insights')
    .select('metadata, created_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('dismissed', false)
    .gte('created_at', expiryDate.toISOString()); // G-B7: Solo no expirados

  if (!insights) return 0;

  // Contar los que no tienen seen_at en metadata
  return insights.filter(i => !i.metadata?.seen_at).length;
}

// ======================
// EXPORTS
// ======================

export const BusinessInsightsService = {
  // Data collection
  collectTenantAnalytics,

  // Insight generation
  canGenerateInsights,
  generateBusinessInsights,

  // Insight retrieval
  getActiveInsights,
  getUnseenInsightsCount,

  // Insight actions
  markInsightAsSeen,
  dismissInsight,
  markInsightActedUpon,
};
