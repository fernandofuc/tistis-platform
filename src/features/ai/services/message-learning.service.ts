// =====================================================
// TIS TIS PLATFORM - Message Learning Service
// Servicio de aprendizaje automático de mensajes
// =====================================================
// Este servicio analiza los mensajes entrantes para:
// - Extraer patrones de comportamiento
// - Aprender vocabulario específico del negocio
// - Detectar preferencias de horarios
// - Identificar objeciones comunes
// - Generar insights automáticos
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';

// ======================
// TYPES
// ======================

export interface LearningConfig {
  learning_enabled: boolean;
  learn_vocabulary: boolean;
  learn_patterns: boolean;
  learn_scheduling_preferences: boolean;
  learn_objections: boolean;
  learn_competitors: boolean;
  min_occurrences_for_pattern: number;
  confidence_threshold: number;
  anonymize_data: boolean;
}

export interface ExtractedPattern {
  type: string;
  value: string;
  context?: string;
  sentiment?: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractedVocabulary {
  term: string;
  meaning?: string;
  category: string;
  synonyms?: string[];
}

export interface ProcessingResult {
  success: boolean;
  patterns_extracted: number;
  vocabulary_extracted: number;
  error?: string;
}

// ======================
// PATTERN DETECTION
// ======================

/**
 * Patrones de regex para detectar diferentes tipos de información
 * Específico para español y el contexto de negocios de servicios
 */
const PATTERN_DETECTORS: Record<string, RegExp[]> = {
  // Solicitudes de servicios
  service_request: [
    /(?:quiero|necesito|busco|me interesa|cotiza[rn]?|información sobre|precio de)\s+(?:una?\s+)?(.+?)(?:\?|\.|,|$)/gi,
    /(?:cuánto cuesta|cuál es el precio de|tienen)\s+(.+?)(?:\?|\.|,|$)/gi,
  ],

  // Preferencias de horarios
  scheduling_preference: [
    /(?:prefiero|me gustaría|puedo|mejor)\s+(?:en\s+)?(?:la\s+)?(mañana|tarde|noche)/gi,
    /(?:entre|de)\s+(\d{1,2})\s*(?:y|a)\s*(\d{1,2})/gi,
    /(?:después de|antes de|a las)\s+(\d{1,2}(?::\d{2})?)/gi,
    /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)s?/gi,
    /(fin de semana|entre semana)/gi,
  ],

  // Puntos de dolor (symptoms for dental/medical)
  pain_point: [
    /(?:me duele|tengo dolor|molestia en|problema con|me lastimé?)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:dolor|molestia|sensibilidad|inflamación)\s+(?:de|en)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:desde hace|hace)\s+(\d+\s+(?:días?|semanas?|meses?))/gi,
  ],

  // Objeciones
  objection: [
    /(?:es muy|está muy|me parece)\s+(caro|costoso|elevado)/gi,
    /(?:no tengo|no cuento con)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:tengo que|necesito)\s+(?:pensarlo|consultarlo|ver)/gi,
    /(?:otro lugar|otra clínica|la competencia)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:no estoy seguro|no sé si|dudo)/gi,
  ],

  // Menciones de competencia
  competitor_mention: [
    /(?:en|de|con)\s+(\w+\s+(?:dental|clínica|consultorio))/gi,
    /(?:fui a|estuve en|me atendieron en)\s+(.+?)(?:\?|\.|,|pero|$)/gi,
  ],

  // Indicadores de urgencia
  urgency_indicator: [
    /(?:urgente|emergencia|lo antes posible|hoy mismo|ahora)/gi,
    /(?:muy|bastante|mucho)\s+dolor/gi,
    /(?:no puedo|no aguanto|insoportable)/gi,
  ],

  // Satisfacción
  satisfaction: [
    /(?:gracias|excelente|muy bien|perfecto|genial|me encanta)/gi,
    /(?:buen|excelente|muy buena?)\s+(?:servicio|atención|trato)/gi,
  ],

  // Quejas
  complaint: [
    /(?:mal servicio|mala atención|no me gustó|queja|reclamo)/gi,
    /(?:tardaron mucho|esperé|no me atendieron)/gi,
    /(?:decepcionado|molesto|frustrado)/gi,
  ],

  // Referidos
  referral: [
    /(?:me recomendó|me refirió|me dijeron de)\s+(.+?)(?:\?|\.|,|$)/gi,
    /(?:un amigo|mi amiga|familiar|conocido)\s+(?:me|les)/gi,
  ],
};

/**
 * Extrae patrones de un mensaje
 */
export function extractPatterns(
  message: string,
  vertical: string = 'general'
): ExtractedPattern[] {
  // Validar entrada
  if (!message || typeof message !== 'string') {
    return [];
  }

  // Limitar longitud del mensaje para evitar problemas de rendimiento
  const MAX_MESSAGE_LENGTH = 5000;
  const truncatedMessage = message.length > MAX_MESSAGE_LENGTH
    ? message.substring(0, MAX_MESSAGE_LENGTH)
    : message;

  const patterns: ExtractedPattern[] = [];
  const messageLower = truncatedMessage.toLowerCase();
  const MAX_PATTERNS_PER_TYPE = 10; // Límite de patrones por tipo

  for (const [patternType, regexes] of Object.entries(PATTERN_DETECTORS)) {
    let patternsOfType = 0;

    for (const regex of regexes) {
      if (patternsOfType >= MAX_PATTERNS_PER_TYPE) break;

      // Crear nueva instancia para evitar problemas con lastIndex
      const re = new RegExp(regex.source, regex.flags);
      let match;
      let lastIndex = -1;
      let iterations = 0;
      const MAX_ITERATIONS = 100; // Protección contra loops infinitos

      while ((match = re.exec(messageLower)) !== null && iterations < MAX_ITERATIONS) {
        iterations++;

        // Protección contra loops infinitos (regex que no avanza)
        if (match.index === lastIndex) {
          re.lastIndex++;
          continue;
        }
        lastIndex = match.index;

        // El valor capturado es el primer grupo o el match completo
        const value = (match[1] || match[0]).trim();

        // Evitar valores muy cortos o muy largos
        if (value.length >= 3 && value.length <= 100) {
          patterns.push({
            type: patternType,
            value: value,
            context: truncatedMessage.substring(
              Math.max(0, match.index - 20),
              Math.min(truncatedMessage.length, match.index + match[0].length + 20)
            ),
          });
          patternsOfType++;
          if (patternsOfType >= MAX_PATTERNS_PER_TYPE) break;
        }
      }
    }
  }

  // Detectar sentimiento básico
  const sentiment = detectSentiment(truncatedMessage);
  if (sentiment !== 0) {
    patterns.forEach(p => {
      p.sentiment = sentiment;
    });
  }

  return patterns;
}

/**
 * Detección de sentimiento muy básica (-1 a 1)
 */
function detectSentiment(message: string): number {
  const positive = /gracias|excelente|perfecto|genial|muy bien|me encanta|feliz|contento/gi;
  const negative = /mal|peor|terrible|horrible|enojado|molesto|frustrado|queja|problema/gi;

  const positiveMatches = (message.match(positive) || []).length;
  const negativeMatches = (message.match(negative) || []).length;

  if (positiveMatches > negativeMatches) {
    return Math.min(1, positiveMatches * 0.3);
  } else if (negativeMatches > positiveMatches) {
    return Math.max(-1, -negativeMatches * 0.3);
  }

  return 0;
}

// ======================
// VOCABULARY EXTRACTION
// ======================

/**
 * Categorías de vocabulario por vertical
 */
const VOCABULARY_CATEGORIES: Record<string, Record<string, RegExp[]>> = {
  dental: {
    symptom: [
      /(dolor de muelas?|sensibilidad|sangrado de encías?|mal aliento|bruxismo)/gi,
      /(caries|infección|absceso|flemón)/gi,
    ],
    procedure: [
      /(limpieza|blanqueamiento|extracción|endodoncia|ortodoncia|implante)/gi,
      /(corona|puente|carilla|resina|amalgama)/gi,
    ],
    technical: [
      /(molar|premolar|incisivo|canino|cordal|muela del juicio)/gi,
      /(encía|esmalte|dentina|pulpa|raíz)/gi,
    ],
  },
  restaurant: {
    service: [
      /(mesa|reservación|evento|catering|delivery|para llevar)/gi,
    ],
    time: [
      /(desayuno|comida|almuerzo|cena|brunch)/gi,
    ],
  },
  general: {
    time: [
      /(cita|consulta|valoración|sesión|turno)/gi,
    ],
  },
};

/**
 * Extrae vocabulario específico del negocio
 */
export function extractVocabulary(
  message: string,
  vertical: string = 'general'
): ExtractedVocabulary[] {
  // Validar entrada
  if (!message || typeof message !== 'string') {
    return [];
  }

  // Limitar longitud del mensaje
  const MAX_MESSAGE_LENGTH = 5000;
  const truncatedMessage = message.length > MAX_MESSAGE_LENGTH
    ? message.substring(0, MAX_MESSAGE_LENGTH)
    : message;

  const vocabulary: ExtractedVocabulary[] = [];
  const messageLower = truncatedMessage.toLowerCase();
  const MAX_VOCABULARY = 50; // Límite de términos

  // Obtener patrones del vertical específico + general
  const verticalPatterns = VOCABULARY_CATEGORIES[vertical] || {};
  const generalPatterns = VOCABULARY_CATEGORIES.general || {};
  const allPatterns = { ...generalPatterns, ...verticalPatterns };

  for (const [category, regexes] of Object.entries(allPatterns)) {
    if (vocabulary.length >= MAX_VOCABULARY) break;

    for (const regex of regexes) {
      if (vocabulary.length >= MAX_VOCABULARY) break;

      const re = new RegExp(regex.source, regex.flags);
      let match;
      let lastIndex = -1;
      let iterations = 0;
      const MAX_ITERATIONS = 100;

      while ((match = re.exec(messageLower)) !== null && iterations < MAX_ITERATIONS) {
        iterations++;

        // Protección contra loops infinitos
        if (match.index === lastIndex) {
          re.lastIndex++;
          continue;
        }
        lastIndex = match.index;

        const term = (match[1] || match[0]).trim();

        // Evitar duplicados y términos vacíos
        if (term.length >= 2 && !vocabulary.some(v => v.term === term)) {
          vocabulary.push({
            term,
            category,
          });
          if (vocabulary.length >= MAX_VOCABULARY) break;
        }
      }
    }
  }

  return vocabulary;
}

// ======================
// MAIN SERVICE
// ======================

/**
 * Verifica si el aprendizaje está habilitado para un tenant
 */
export async function isLearningEnabled(tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('ai_learning_config')
    .select('learning_enabled')
    .eq('tenant_id', tenantId)
    .single();

  return data?.learning_enabled ?? false;
}

/**
 * Obtiene la configuración de aprendizaje de un tenant
 */
export async function getLearningConfig(tenantId: string): Promise<LearningConfig | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('ai_learning_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as LearningConfig;
}

/**
 * Encola un mensaje para procesamiento de aprendizaje
 */
export async function queueMessageForLearning(
  tenantId: string,
  conversationId: string,
  messageId: string,
  messageContent: string,
  messageRole: 'lead' | 'assistant',
  options?: {
    channel?: string;
    leadId?: string;
    detectedIntent?: string;
    detectedSignals?: Record<string, unknown>;
    aiResponse?: string;
  }
): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('queue_message_for_learning', {
    p_tenant_id: tenantId,
    p_conversation_id: conversationId,
    p_message_id: messageId,
    p_message_content: messageContent,
    p_message_role: messageRole,
    p_channel: options?.channel || 'whatsapp',
    // Asegurar que valores vacíos se conviertan a null para tipos UUID
    p_lead_id: options?.leadId && options.leadId.trim() !== '' ? options.leadId : null,
    p_detected_intent: options?.detectedIntent || null,
    p_detected_signals: options?.detectedSignals || null,
    p_ai_response: options?.aiResponse || null,
  });

  if (error) {
    console.error('[Learning Service] Error queuing message:', error);
    return false;
  }

  return true;
}

/**
 * Procesa un mensaje de la cola de aprendizaje
 */
export async function processLearningMessage(
  queueItemId: string
): Promise<ProcessingResult> {
  const supabase = createServerClient();

  try {
    // 1. Obtener el item de la cola
    const { data: queueItem, error: fetchError } = await supabase
      .from('ai_learning_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    if (fetchError || !queueItem) {
      return { success: false, patterns_extracted: 0, vocabulary_extracted: 0, error: 'Queue item not found' };
    }

    // 2. Marcar como procesando
    await supabase
      .from('ai_learning_queue')
      .update({ status: 'processing', processing_started_at: new Date().toISOString() })
      .eq('id', queueItemId);

    // 3. Obtener configuración del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('vertical')
      .eq('id', queueItem.tenant_id)
      .single();

    const vertical = tenant?.vertical || 'general';

    // 4. Extraer patrones del mensaje
    const patterns = extractPatterns(queueItem.message_content, vertical);

    // 5. Extraer vocabulario
    const vocabulary = extractVocabulary(queueItem.message_content, vertical);

    // 6. Guardar patrones en la base de datos
    for (const pattern of patterns) {
      await supabase.rpc('upsert_message_pattern', {
        p_tenant_id: queueItem.tenant_id,
        p_pattern_type: pattern.type,
        p_pattern_value: pattern.value,
        p_context_example: pattern.context,
        p_sentiment: pattern.sentiment,
        p_metadata: pattern.metadata || {},
      });
    }

    // 7. Guardar vocabulario con upsert que incrementa contador
    for (const vocab of vocabulary) {
      const normalizedTerm = vocab.term.toLowerCase().trim();

      // Primero verificar si ya existe
      const { data: existing } = await supabase
        .from('ai_learned_vocabulary')
        .select('id, usage_count')
        .eq('tenant_id', queueItem.tenant_id)
        .eq('normalized_term', normalizedTerm)
        .single();

      if (existing) {
        // Actualizar contador y timestamp
        await supabase
          .from('ai_learned_vocabulary')
          .update({
            usage_count: (existing.usage_count || 1) + 1,
            last_used: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        // Insertar nuevo
        await supabase
          .from('ai_learned_vocabulary')
          .insert({
            tenant_id: queueItem.tenant_id,
            term: vocab.term,
            normalized_term: normalizedTerm,
            meaning: vocab.meaning,
            category: vocab.category,
            synonyms: vocab.synonyms,
            usage_count: 1,
            last_used: new Date().toISOString(),
          });
      }
    }

    // 8. Marcar como completado
    await supabase
      .from('ai_learning_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        patterns_extracted: patterns,
        vocabulary_extracted: vocabulary,
      })
      .eq('id', queueItemId);

    return {
      success: true,
      patterns_extracted: patterns.length,
      vocabulary_extracted: vocabulary.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Learning Service] Error processing queue item ${queueItemId}:`, errorMessage);

    // Intentar marcar como fallido (con try-catch para evitar error silencioso)
    try {
      await supabase
        .from('ai_learning_queue')
        .update({
          status: 'failed',
          error_message: errorMessage,
        })
        .eq('id', queueItemId);
    } catch (updateError) {
      console.error('[Learning Service] Error updating failed status:', updateError);
    }

    return {
      success: false,
      patterns_extracted: 0,
      vocabulary_extracted: 0,
      error: errorMessage,
    };
  }
}

/**
 * Procesa todos los mensajes pendientes en la cola
 */
export async function processLearningQueue(limit: number = 100): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  const supabase = createServerClient();

  // Obtener mensajes pendientes
  const { data: pendingItems } = await supabase
    .from('ai_learning_queue')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pendingItems || pendingItems.length === 0) {
    return { processed: 0, successful: 0, failed: 0 };
  }

  let successful = 0;
  let failed = 0;

  for (const item of pendingItems) {
    const result = await processLearningMessage(item.id);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    processed: pendingItems.length,
    successful,
    failed,
  };
}

/**
 * Obtiene el contexto de aprendizaje para enriquecer prompts
 */
export async function getLearningContext(tenantId: string): Promise<{
  topServiceRequests: Array<{ service: string; frequency: number }>;
  commonObjections: Array<{ objection: string; frequency: number }>;
  schedulingPreferences: Array<{ preference: string; frequency: number }>;
  painPoints: Array<{ pain: string; frequency: number }>;
  learnedVocabulary: Array<{ term: string; meaning: string; category: string }>;
} | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('get_tenant_learning_context', {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error('[Learning Service] Error getting learning context:', error);
    return null;
  }

  return {
    topServiceRequests: data.top_service_requests || [],
    commonObjections: data.common_objections || [],
    schedulingPreferences: data.scheduling_preferences || [],
    painPoints: data.pain_points || [],
    learnedVocabulary: data.learned_vocabulary || [],
  };
}

/**
 * Habilita el aprendizaje para un tenant (requiere plan Essentials+)
 */
export async function enableLearning(
  tenantId: string,
  config?: Partial<LearningConfig>
): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_learning_config')
    .upsert({
      tenant_id: tenantId,
      learning_enabled: true,
      learn_vocabulary: config?.learn_vocabulary ?? true,
      learn_patterns: config?.learn_patterns ?? true,
      learn_scheduling_preferences: config?.learn_scheduling_preferences ?? true,
      learn_objections: config?.learn_objections ?? true,
      learn_competitors: config?.learn_competitors ?? true,
      min_occurrences_for_pattern: config?.min_occurrences_for_pattern ?? 3,
      confidence_threshold: config?.confidence_threshold ?? 0.7,
      anonymize_data: config?.anonymize_data ?? true,
    }, {
      onConflict: 'tenant_id',
    });

  if (error) {
    console.error('[Learning Service] Error enabling learning:', error);
    return false;
  }

  return true;
}

/**
 * Deshabilita el aprendizaje para un tenant
 */
export async function disableLearning(tenantId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('ai_learning_config')
    .update({ learning_enabled: false })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('[Learning Service] Error disabling learning:', error);
    return false;
  }

  return true;
}

// ======================
// EXPORTS
// ======================

export const MessageLearningService = {
  // Config
  isLearningEnabled,
  getLearningConfig,
  enableLearning,
  disableLearning,

  // Processing
  queueMessageForLearning,
  processLearningMessage,
  processLearningQueue,

  // Extraction
  extractPatterns,
  extractVocabulary,

  // Context
  getLearningContext,
};
