// =====================================================
// TIS TIS PLATFORM - AI Service
// GPT-5 Mini powered AI responses for customer messaging
// =====================================================

import OpenAI from 'openai';
import { createServerClient } from '@/src/shared/lib/supabase';
import type { AIResponseFormat, AIIntent, AISignal } from '@/src/shared/types/whatsapp';
import { DEFAULT_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';

// ======================
// CONFIGURATION
// ======================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// GPT-5 Mini: Optimizado para mensajeria automatizada (WhatsApp, Instagram, etc.)
// - Costo: $0.25/$2.00 per 1M tokens
// - Latencia: ~800ms (excelente para chat)
// - Calidad: Superior a GPT-4o-mini, ideal para respuestas naturales
const DEFAULT_MODEL = DEFAULT_MODELS.MESSAGING; // gpt-5-mini
const MAX_TOKENS = OPENAI_CONFIG.defaultMaxTokens;

// ======================
// TYPES
// ======================

export interface TenantAIContext {
  tenant_id: string;
  tenant_name: string;
  vertical: string;
  timezone: string;
  ai_config: {
    system_prompt: string;
    model: string;
    temperature: number;
    response_style: string;
    max_response_length: number;
    enable_scoring: boolean;
    auto_escalate_keywords: string[];
    business_hours: {
      start: string;
      end: string;
      days: number[];
    };
  };
  services: Array<{
    id: string;
    name: string;
    description: string;
    price_min: number;
    price_max: number;
    duration_minutes: number;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
  branches: Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
  }>;
  scoring_rules: Array<{
    signal_name: string;
    points: number;
    keywords: string[];
    category: string;
  }>;
}

export interface ConversationContext {
  conversation_id: string;
  lead_id: string;
  lead_name: string;
  lead_score: number;
  lead_classification: string;
  message_count: number;
  last_messages: Array<{
    role: 'lead' | 'ai' | 'staff';
    content: string;
    timestamp: string;
  }>;
  current_message: string;
}

export interface AIProcessingResult {
  response: string;
  intent: AIIntent;
  signals: AISignal[];
  score_change: number;
  escalate: boolean;
  escalate_reason?: string;
  tokens_used: number;
  model_used: string;
  processing_time_ms: number;
}

// ======================
// CONTEXT FUNCTIONS
// ======================

/**
 * Obtiene el contexto completo de AI para un tenant
 */
export async function getTenantAIContext(tenantId: string): Promise<TenantAIContext | null> {
  const supabase = createServerClient();

  // Usar la función SQL que ya creamos
  const { data, error } = await supabase.rpc('get_tenant_ai_context', {
    p_tenant_id: tenantId,
  });

  if (error || !data) {
    console.error('[AI Service] Error getting tenant context:', error);
    return null;
  }

  return data as TenantAIContext;
}

/**
 * Obtiene el contexto de la conversación actual
 */
export async function getConversationContext(
  conversationId: string,
  currentMessage: string
): Promise<ConversationContext | null> {
  const supabase = createServerClient();

  // Obtener conversación con lead
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select(`
      id,
      lead_id,
      leads (
        name,
        score,
        classification
      )
    `)
    .eq('id', conversationId)
    .single();

  if (convError || !conversation) {
    console.error('[AI Service] Error getting conversation:', convError);
    return null;
  }

  // Obtener últimos mensajes (para contexto)
  const { data: messages } = await supabase
    .from('messages')
    .select('sender_type, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  const lastMessages = (messages || [])
    .reverse()
    .map((m) => ({
      role: m.sender_type as 'lead' | 'ai' | 'staff',
      content: m.content,
      timestamp: m.created_at,
    }));

  const lead = conversation.leads as any;

  return {
    conversation_id: conversationId,
    lead_id: conversation.lead_id,
    lead_name: lead?.name || 'Cliente',
    lead_score: lead?.score || 50,
    lead_classification: lead?.classification || 'warm',
    message_count: lastMessages.length,
    last_messages: lastMessages,
    current_message: currentMessage,
  };
}

// ======================
// PROMPT BUILDING
// ======================

/**
 * Construye el system prompt completo para GPT-5 Mini
 */
function buildSystemPrompt(tenant: TenantAIContext): string {
  const { ai_config, services, faqs, branches } = tenant;

  // Base prompt from tenant config
  let systemPrompt = ai_config.system_prompt;

  // Agregar información de servicios
  if (services.length > 0) {
    systemPrompt += `\n\n## SERVICIOS Y PRECIOS\n`;
    for (const service of services) {
      const priceRange =
        service.price_min === service.price_max
          ? `$${service.price_min}`
          : `$${service.price_min} - $${service.price_max}`;
      systemPrompt += `- ${service.name}: ${priceRange} (${service.duration_minutes} min)\n`;
      if (service.description) {
        systemPrompt += `  ${service.description}\n`;
      }
    }
  }

  // Agregar FAQs
  if (faqs.length > 0) {
    systemPrompt += `\n\n## PREGUNTAS FRECUENTES\n`;
    for (const faq of faqs) {
      systemPrompt += `P: ${faq.question}\nR: ${faq.answer}\n\n`;
    }
  }

  // Agregar información de sucursales
  if (branches.length > 0) {
    systemPrompt += `\n\n## UBICACIONES\n`;
    for (const branch of branches) {
      systemPrompt += `- ${branch.name}: ${branch.address}`;
      if (branch.phone) {
        systemPrompt += ` | Tel: ${branch.phone}`;
      }
      systemPrompt += '\n';
    }
  }

  // Agregar instrucciones de formato
  systemPrompt += `\n\n## INSTRUCCIONES DE RESPUESTA
- Responde de manera ${ai_config.response_style || 'profesional y amable'}
- Maximo ${ai_config.max_response_length || 300} caracteres por respuesta
- NO uses emojis
- Si no sabes algo, ofrece conectar con un asesor humano
- Siempre busca agendar una cita o dar informacion util`;

  return systemPrompt;
}

/**
 * Construye el historial de mensajes para OpenAI
 */
function buildMessageHistory(context: ConversationContext): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  for (const msg of context.last_messages) {
    const role = msg.role === 'lead' ? 'user' : 'assistant';
    messages.push({
      role,
      content: msg.content,
    });
  }

  // Agregar mensaje actual
  messages.push({
    role: 'user',
    content: context.current_message,
  });

  return messages;
}

// ======================
// SIGNAL DETECTION
// ======================

/**
 * Detecta señales de intención en el mensaje
 */
function detectSignals(
  message: string,
  scoringRules: TenantAIContext['scoring_rules']
): { signals: AISignal[]; totalPoints: number } {
  const signals: AISignal[] = [];
  let totalPoints = 0;
  const messageLower = message.toLowerCase();

  for (const rule of scoringRules) {
    for (const keyword of rule.keywords) {
      if (messageLower.includes(keyword.toLowerCase())) {
        signals.push({
          signal: rule.signal_name,
          points: rule.points,
        });
        totalPoints += rule.points;
        break; // Solo contar una vez por regla
      }
    }
  }

  return { signals, totalPoints };
}

/**
 * Detecta la intención principal del mensaje
 */
function detectIntent(message: string, signals: AISignal[]): AIIntent {
  const messageLower = message.toLowerCase();

  // Prioridad por señales detectadas
  const signalNames = signals.map((s) => s.signal.toLowerCase());

  if (signalNames.some((s) => s.includes('dolor') || s.includes('urgente') || s.includes('emergencia'))) {
    return 'PAIN_URGENT';
  }

  if (signalNames.some((s) => s.includes('cita') || s.includes('agendar') || s.includes('reservar'))) {
    return 'BOOK_APPOINTMENT';
  }

  if (signalNames.some((s) => s.includes('precio') || s.includes('costo') || s.includes('cuanto'))) {
    return 'PRICE_INQUIRY';
  }

  // Fallback por keywords directos
  if (/hola|buenos|buenas|hi|hello/i.test(messageLower)) {
    return 'GREETING';
  }

  if (/precio|costo|cuanto|valor|cotiz/i.test(messageLower)) {
    return 'PRICE_INQUIRY';
  }

  if (/cita|agendar|reservar|disponib|horario/i.test(messageLower)) {
    return 'BOOK_APPOINTMENT';
  }

  if (/dolor|duele|molest|urgen|emergen/i.test(messageLower)) {
    return 'PAIN_URGENT';
  }

  if (/humano|persona|asesor|gerente|encargado/i.test(messageLower)) {
    return 'HUMAN_REQUEST';
  }

  if (/donde|ubicacion|direccion|llegar|mapa/i.test(messageLower)) {
    return 'LOCATION';
  }

  if (/horario|abren|cierran|atienden/i.test(messageLower)) {
    return 'HOURS';
  }

  return 'UNKNOWN';
}

/**
 * Determina si se debe escalar la conversación
 */
function shouldEscalate(
  intent: AIIntent,
  signals: AISignal[],
  autoEscalateKeywords: string[],
  message: string
): { escalate: boolean; reason?: string } {
  // Escalación por intención
  if (intent === 'HUMAN_REQUEST') {
    return { escalate: true, reason: 'Cliente solicitó hablar con un humano' };
  }

  if (intent === 'PAIN_URGENT') {
    return { escalate: true, reason: 'Situación de dolor/urgencia detectada' };
  }

  // Escalación por keywords específicos
  const messageLower = message.toLowerCase();
  for (const keyword of autoEscalateKeywords) {
    if (messageLower.includes(keyword.toLowerCase())) {
      return { escalate: true, reason: `Keyword de escalación detectado: ${keyword}` };
    }
  }

  // Escalación por score muy alto (lead muy caliente)
  const highValueSignals = signals.filter((s) => s.points >= 15);
  if (highValueSignals.length >= 2) {
    return { escalate: true, reason: 'Lead de alto valor detectado' };
  }

  return { escalate: false };
}

// ======================
// MAIN AI FUNCTION
// ======================

/**
 * Genera una respuesta AI para un mensaje de cliente
 */
export async function generateAIResponse(
  tenantId: string,
  conversationId: string,
  currentMessage: string
): Promise<AIProcessingResult> {
  const startTime = Date.now();

  // 1. Obtener contextos
  const [tenantContext, conversationContext] = await Promise.all([
    getTenantAIContext(tenantId),
    getConversationContext(conversationId, currentMessage),
  ]);

  if (!tenantContext || !conversationContext) {
    throw new Error('Could not load AI context');
  }

  // 2. Detectar señales e intención
  const { signals, totalPoints } = detectSignals(currentMessage, tenantContext.scoring_rules);
  const intent = detectIntent(currentMessage, signals);

  // 3. Verificar escalación
  const escalationCheck = shouldEscalate(
    intent,
    signals,
    tenantContext.ai_config.auto_escalate_keywords,
    currentMessage
  );

  // 4. Construir prompts
  const systemPrompt = buildSystemPrompt(tenantContext);
  const messageHistory = buildMessageHistory(conversationContext);

  // 5. Llamar a GPT-5 Mini (OpenAI)
  const model = DEFAULT_MODEL; // Siempre usar gpt-5-mini para mensajeria
  const temperature = tenantContext.ai_config.temperature || OPENAI_CONFIG.defaultTemperature;

  let response: string;
  let tokensUsed = 0;

  try {
    const completion = await openai.chat.completions.create({
      model,
      max_tokens: MAX_TOKENS,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messageHistory,
      ],
    });

    // Extraer respuesta
    response = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje. Un asesor te contactará pronto.';
    tokensUsed = (completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0);
  } catch (error) {
    console.error('[AI Service] OpenAI API error:', error);
    response = 'Disculpa, estoy experimentando dificultades técnicas. Un asesor humano te atenderá en breve.';
    tokensUsed = 0;
  }

  // 6. Calcular tiempo de procesamiento
  const processingTime = Date.now() - startTime;

  return {
    response,
    intent,
    signals,
    score_change: totalPoints,
    escalate: escalationCheck.escalate,
    escalate_reason: escalationCheck.reason,
    tokens_used: tokensUsed,
    model_used: model,
    processing_time_ms: processingTime,
  };
}

// ======================
// SAVE FUNCTIONS
// ======================

/**
 * Guarda la respuesta AI como mensaje
 */
export async function saveAIResponse(
  conversationId: string,
  response: string,
  metadata: Record<string, unknown>
): Promise<string> {
  const supabase = createServerClient();

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'ai',
      content: response,
      message_type: 'text',
      channel: 'whatsapp',
      status: 'pending', // Pendiente de envío
      metadata,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[AI Service] Error saving response:', error);
    throw new Error(`Failed to save AI response: ${error.message}`);
  }

  // Actualizar conversación
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return message.id;
}

/**
 * Registra el uso de AI para analytics/billing
 */
export async function logAIUsage(
  tenantId: string,
  conversationId: string,
  result: AIProcessingResult
): Promise<void> {
  const supabase = createServerClient();

  await supabase.from('ai_usage_logs').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    model_used: result.model_used,
    tokens_input: Math.floor(result.tokens_used * 0.7), // Aproximación
    tokens_output: Math.floor(result.tokens_used * 0.3),
    processing_time_ms: result.processing_time_ms,
    intent_detected: result.intent,
    escalated: result.escalate,
    metadata: {
      signals: result.signals,
      score_change: result.score_change,
    },
  });
}

/**
 * Actualiza el score del lead basado en las señales
 */
export async function updateLeadScore(
  leadId: string,
  signals: AISignal[],
  conversationId: string
): Promise<void> {
  const supabase = createServerClient();

  for (const signal of signals) {
    await supabase.rpc('update_lead_score', {
      p_lead_id: leadId,
      p_score_change: signal.points,
      p_signal_name: signal.signal,
      p_change_source: 'ai_detection',
      p_conversation_id: conversationId,
    });
  }
}

/**
 * Escala una conversación a un humano
 */
export async function escalateConversation(
  conversationId: string,
  reason: string
): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from('conversations')
    .update({
      status: 'escalated',
      ai_handling: false,
      escalation_reason: reason,
      escalated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  console.log(`[AI Service] Conversation ${conversationId} escalated: ${reason}`);
}

// ======================
// EXPORTS
// ======================
export const AIService = {
  getTenantAIContext,
  getConversationContext,
  generateAIResponse,
  saveAIResponse,
  logAIUsage,
  updateLeadScore,
  escalateConversation,
  detectSignals,
  detectIntent,
};
