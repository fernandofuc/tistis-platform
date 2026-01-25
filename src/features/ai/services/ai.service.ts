// =====================================================
// TIS TIS PLATFORM - AI Service
// GPT-5 Mini powered AI responses for customer messaging
// =====================================================

import OpenAI from 'openai';
import { createServerClient } from '@/src/shared/lib/supabase';
import type { AIResponseFormat, AIIntent, AISignal } from '@/src/shared/types/whatsapp';
import { DEFAULT_MODELS, OPENAI_CONFIG } from '@/src/shared/config/ai-models';
import {
  AppointmentBookingService,
  extractBookingData,
  createBooking,
  generateBookingConfirmation,
  getAvailableSlots,
  type BookingRequest,
} from './appointment-booking.service';
import {
  DataExtractionService,
  performFullExtraction,
  updateLeadWithExtractedData,
  recordServiceInterest,
} from './data-extraction.service';

// ======================
// CONFIGURATION
// ======================

// LLM Timeout: 30 seconds to prevent hanging requests
// If OpenAI doesn't respond within this time, we return a fallback message
const LLM_TIMEOUT_MS = 30000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  timeout: LLM_TIMEOUT_MS, // Global timeout for all requests
  maxRetries: 2, // Retry up to 2 times on transient errors
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
    ai_description?: string;
    price_min: number;
    price_max: number;
    price_note?: string;
    duration_minutes: number;
    category: string;
    special_instructions?: string;
    requires_consultation?: boolean;
    promotion_active?: boolean;
    promotion_text?: string;
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
    city: string;
    phone: string;
    whatsapp_number: string;
    email: string;
    operating_hours: Record<string, { open: string; close: string }>;
    google_maps_url: string;
    is_headquarters: boolean;
    staff_ids: string[];
  }>;
  doctors: Array<{
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    role: string;
    role_title: string;
    email: string;
    phone: string;
    branch_ids: string[];
    specialty: string;
    bio: string;
  }>;
  scoring_rules: Array<{
    signal_name: string;
    points: number;
    keywords: string[];
    category: string;
  }>;
  // =====================================================
  // KNOWLEDGE BASE - Información personalizada del cliente
  // =====================================================
  custom_instructions?: Array<{
    type: string;
    title: string;
    instruction: string;
    examples?: string;
    branch_id?: string;
  }>;
  business_policies?: Array<{
    type: string;
    title: string;
    policy: string;
    short_version?: string;
  }>;
  knowledge_articles?: Array<{
    category: string;
    title: string;
    content: string;
    summary?: string;
    branch_id?: string;
  }>;
  response_templates?: Array<{
    trigger: string;
    name: string;
    template: string;
    variables?: string[];
    branch_id?: string;
  }>;
  competitor_handling?: Array<{
    competitor: string;
    aliases?: string[];
    strategy: string;
    talking_points?: string[];
    avoid_saying?: string[];
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
  // Nuevos campos para acciones transaccionales
  appointment_created?: {
    appointment_id: string;
    scheduled_at: string;
    branch_name: string;
    service_name?: string;
    staff_name?: string;
  };
  lead_data_updated?: string[];
  service_interest_detected?: {
    service_name: string;
    urgency: string;
  };
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
 * @param tenantId - Optional tenant ID for security validation
 */
export async function getConversationContext(
  conversationId: string,
  currentMessage: string,
  tenantId?: string
): Promise<ConversationContext | null> {
  const supabase = createServerClient();

  // Obtener conversación con lead
  // SECURITY: If tenantId provided, validate conversation belongs to tenant
  let query = supabase
    .from('conversations')
    .select(`
      id,
      lead_id,
      tenant_id,
      leads (
        first_name,
        last_name,
        full_name,
        score,
        classification
      )
    `)
    .eq('id', conversationId);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: conversation, error: convError } = await query.single();

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
  // Build lead name from available fields
  const leadName = lead?.full_name || `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim() || 'Cliente';

  return {
    conversation_id: conversationId,
    lead_id: conversation.lead_id,
    lead_name: leadName,
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
 * Incluye Knowledge Base personalizado del cliente
 */
function buildSystemPrompt(tenant: TenantAIContext): string {
  const {
    ai_config,
    services,
    faqs,
    branches,
    doctors,
    custom_instructions,
    business_policies,
    knowledge_articles,
    response_templates,
    competitor_handling,
  } = tenant;

  // =====================================================
  // 1. BASE PROMPT + INSTRUCCIONES PERSONALIZADAS
  // =====================================================
  let systemPrompt = ai_config.system_prompt || '';

  // Agregar instrucciones personalizadas del cliente (Knowledge Base)
  if (custom_instructions && custom_instructions.length > 0) {
    // Agrupar por tipo para mejor organización
    const instructionsByType = custom_instructions.reduce((acc, inst) => {
      if (!acc[inst.type]) acc[inst.type] = [];
      acc[inst.type].push(inst);
      return acc;
    }, {} as Record<string, typeof custom_instructions>);

    // Mapeo de tipos a títulos legibles
    const typeLabels: Record<string, string> = {
      identity: 'IDENTIDAD DEL NEGOCIO',
      greeting: 'CÓMO SALUDAR',
      farewell: 'CÓMO DESPEDIRSE',
      pricing_policy: 'POLÍTICA DE PRECIOS',
      special_cases: 'CASOS ESPECIALES',
      competitors: 'MANEJO DE COMPETENCIA',
      objections: 'MANEJO DE OBJECIONES',
      upsell: 'OPORTUNIDADES DE VENTA ADICIONAL',
      tone_examples: 'EJEMPLOS DE TONO',
      forbidden: 'LO QUE NUNCA DEBES DECIR',
      always_mention: 'SIEMPRE MENCIONAR',
      custom: 'INSTRUCCIONES ADICIONALES',
    };

    systemPrompt += `\n\n# INSTRUCCIONES PERSONALIZADAS DEL NEGOCIO\n`;

    for (const [type, instructions] of Object.entries(instructionsByType)) {
      const label = typeLabels[type] || type.toUpperCase();
      systemPrompt += `\n## ${label}\n`;
      for (const inst of instructions) {
        systemPrompt += `### ${inst.title}\n`;
        systemPrompt += `${inst.instruction}\n`;
        if (inst.examples) {
          systemPrompt += `Ejemplos: ${inst.examples}\n`;
        }
        systemPrompt += '\n';
      }
    }
  }

  // =====================================================
  // 2. POLÍTICAS DEL NEGOCIO
  // =====================================================
  if (business_policies && business_policies.length > 0) {
    systemPrompt += `\n# POLÍTICAS DEL NEGOCIO\n`;
    systemPrompt += `Conoce y comunica estas políticas cuando sea relevante:\n\n`;

    const policyLabels: Record<string, string> = {
      cancellation: 'Cancelación',
      rescheduling: 'Reagendamiento',
      payment: 'Métodos de Pago',
      insurance: 'Seguros',
      warranty: 'Garantías',
      pricing: 'Precios',
      late_arrival: 'Llegadas Tarde',
      deposits: 'Anticipos',
      refunds: 'Reembolsos',
      emergency: 'Emergencias',
      custom: 'Otras Políticas',
    };

    for (const policy of business_policies) {
      const label = policyLabels[policy.type] || policy.title;
      systemPrompt += `## ${label}\n`;
      systemPrompt += `${policy.policy}\n\n`;
    }
  }

  // =====================================================
  // 3. SERVICIOS Y PRECIOS (Mejorado)
  // =====================================================
  if (services.length > 0) {
    systemPrompt += `\n# SERVICIOS Y PRECIOS\n`;

    // Agrupar por categoría
    const servicesByCategory = services.reduce((acc, svc) => {
      const cat = svc.category || 'general';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    }, {} as Record<string, typeof services>);

    for (const [category, categoryServices] of Object.entries(servicesByCategory)) {
      if (Object.keys(servicesByCategory).length > 1) {
        systemPrompt += `\n## ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
      }

      for (const service of categoryServices) {
        // Precio formateado
        let priceStr = '';
        if (service.price_note) {
          priceStr = service.price_note;
        } else if (service.price_min === service.price_max) {
          priceStr = `$${service.price_min.toLocaleString()}`;
        } else {
          priceStr = `$${service.price_min.toLocaleString()} - $${service.price_max.toLocaleString()}`;
        }

        // Indicador de promoción
        const promoTag = service.promotion_active ? ' [EN PROMOCIÓN]' : '';

        systemPrompt += `### ${service.name}${promoTag}\n`;
        systemPrompt += `- Precio: ${priceStr}\n`;
        systemPrompt += `- Duración: ${service.duration_minutes} minutos\n`;

        // Usar ai_description si existe, sino description
        const desc = service.ai_description || service.description;
        if (desc) {
          systemPrompt += `- Descripción: ${desc}\n`;
        }

        if (service.requires_consultation) {
          systemPrompt += `- Requiere consulta previa\n`;
        }

        if (service.promotion_active && service.promotion_text) {
          systemPrompt += `- Promoción: ${service.promotion_text}\n`;
        }

        // Instrucciones especiales para este servicio
        if (service.special_instructions) {
          systemPrompt += `- IMPORTANTE: ${service.special_instructions}\n`;
        }

        systemPrompt += '\n';
      }
    }
  }

  // =====================================================
  // 4. PREGUNTAS FRECUENTES
  // =====================================================
  if (faqs.length > 0) {
    systemPrompt += `\n# PREGUNTAS FRECUENTES\n`;
    systemPrompt += `Usa estas respuestas como referencia:\n\n`;
    for (const faq of faqs) {
      systemPrompt += `P: ${faq.question}\n`;
      systemPrompt += `R: ${faq.answer}\n\n`;
    }
  }

  // =====================================================
  // 5. ARTÍCULOS DE CONOCIMIENTO
  // =====================================================
  if (knowledge_articles && knowledge_articles.length > 0) {
    systemPrompt += `\n# INFORMACIÓN ADICIONAL DEL NEGOCIO\n`;

    const categoryLabels: Record<string, string> = {
      about_us: 'Sobre Nosotros',
      differentiators: 'Lo Que Nos Diferencia',
      certifications: 'Certificaciones',
      technology: 'Tecnología',
      materials: 'Materiales y Productos',
      process: 'Procesos',
      aftercare: 'Cuidados Post-Servicio',
      preparation: 'Preparación Pre-Servicio',
      promotions: 'Promociones Actuales',
      events: 'Eventos',
      testimonials: 'Testimonios',
      awards: 'Premios',
      partnerships: 'Alianzas',
      custom: 'Información General',
    };

    // Agrupar por categoría
    const articlesByCategory = knowledge_articles.reduce((acc, art) => {
      const cat = art.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(art);
      return acc;
    }, {} as Record<string, typeof knowledge_articles>);

    for (const [category, articles] of Object.entries(articlesByCategory)) {
      const label = categoryLabels[category] || category;
      systemPrompt += `\n## ${label}\n`;
      for (const article of articles) {
        systemPrompt += `### ${article.title}\n`;
        systemPrompt += `${article.content}\n\n`;
      }
    }
  }

  // =====================================================
  // 6. SUCURSALES Y UBICACIONES
  // =====================================================
  if (branches.length > 0) {
    systemPrompt += `\n# SUCURSALES Y UBICACIONES\n`;
    for (const branch of branches) {
      const isHQ = branch.is_headquarters ? ' (Principal)' : '';
      systemPrompt += `## ${branch.name}${isHQ}\n`;

      if (branch.address) {
        const fullAddress = branch.city ? `${branch.address}, ${branch.city}` : branch.address;
        systemPrompt += `- Dirección: ${fullAddress}\n`;
      }

      if (branch.phone) {
        systemPrompt += `- Teléfono: ${branch.phone}\n`;
      }
      if (branch.whatsapp_number && branch.whatsapp_number !== branch.phone) {
        systemPrompt += `- WhatsApp: ${branch.whatsapp_number}\n`;
      }

      if (branch.google_maps_url) {
        systemPrompt += `- Ubicación en mapa: ${branch.google_maps_url}\n`;
      }

      // Horarios
      if (branch.operating_hours && Object.keys(branch.operating_hours).length > 0) {
        systemPrompt += `- Horarios:\n`;
        const dayNames: Record<string, string> = {
          monday: 'Lunes',
          tuesday: 'Martes',
          wednesday: 'Miércoles',
          thursday: 'Jueves',
          friday: 'Viernes',
          saturday: 'Sábado',
          sunday: 'Domingo',
        };
        for (const [day, hours] of Object.entries(branch.operating_hours)) {
          if (hours && typeof hours === 'object' && 'open' in hours) {
            const dayName = dayNames[day.toLowerCase()] || day;
            systemPrompt += `  * ${dayName}: ${hours.open} - ${hours.close}\n`;
          }
        }
      }

      // Doctores en esta sucursal
      const branchDoctors = doctors.filter(doc =>
        doc.branch_ids && doc.branch_ids.includes(branch.id)
      );
      if (branchDoctors.length > 0) {
        systemPrompt += `- Especialistas:\n`;
        for (const doc of branchDoctors) {
          const specialty = doc.specialty ? ` - ${doc.specialty}` : '';
          systemPrompt += `  * ${doc.role_title} ${doc.name}${specialty}\n`;
        }
      }

      systemPrompt += '\n';
    }
  }

  // =====================================================
  // 7. EQUIPO MÉDICO
  // =====================================================
  if (doctors.length > 0) {
    systemPrompt += `\n# EQUIPO MÉDICO\n`;
    for (const doc of doctors) {
      systemPrompt += `## ${doc.role_title} ${doc.name}\n`;

      if (doc.specialty) {
        systemPrompt += `- Especialidad: ${doc.specialty}\n`;
      }

      if (doc.bio) {
        systemPrompt += `- ${doc.bio}\n`;
      }

      if (doc.branch_ids && doc.branch_ids.length > 0) {
        const docBranches = branches
          .filter(b => doc.branch_ids.includes(b.id))
          .map(b => b.name);
        if (docBranches.length > 0) {
          systemPrompt += `- Atiende en: ${docBranches.join(', ')}\n`;
        }
      }

      systemPrompt += '\n';
    }
  }

  // =====================================================
  // 8. MANEJO DE COMPETENCIA
  // =====================================================
  if (competitor_handling && competitor_handling.length > 0) {
    systemPrompt += `\n# MANEJO DE MENCIONES DE COMPETENCIA\n`;
    systemPrompt += `Si el cliente menciona alguno de estos competidores, sigue la estrategia indicada:\n\n`;

    for (const comp of competitor_handling) {
      const aliases = comp.aliases && comp.aliases.length > 0
        ? ` (también conocido como: ${comp.aliases.join(', ')})`
        : '';
      systemPrompt += `## ${comp.competitor}${aliases}\n`;
      systemPrompt += `Estrategia: ${comp.strategy}\n`;

      if (comp.talking_points && comp.talking_points.length > 0) {
        systemPrompt += `Puntos a destacar:\n`;
        for (const point of comp.talking_points) {
          systemPrompt += `- ${point}\n`;
        }
      }

      if (comp.avoid_saying && comp.avoid_saying.length > 0) {
        systemPrompt += `EVITAR decir:\n`;
        for (const avoid of comp.avoid_saying) {
          systemPrompt += `- ${avoid}\n`;
        }
      }

      systemPrompt += '\n';
    }
  }

  // =====================================================
  // 9. PLANTILLAS DE RESPUESTA (Como referencia)
  // =====================================================
  if (response_templates && response_templates.length > 0) {
    systemPrompt += `\n# PLANTILLAS DE RESPUESTA SUGERIDAS\n`;
    systemPrompt += `Usa estas plantillas como referencia para mantener consistencia:\n\n`;

    const triggerLabels: Record<string, string> = {
      greeting: 'Saludo inicial',
      after_hours: 'Fuera de horario',
      appointment_confirm: 'Confirmación de cita',
      price_inquiry: 'Consulta de precios',
      location_inquiry: 'Consulta de ubicación',
      emergency: 'Emergencia',
      farewell: 'Despedida',
      thank_you: 'Agradecimiento',
    };

    for (const template of response_templates) {
      const label = triggerLabels[template.trigger] || template.name;
      systemPrompt += `## ${label}\n`;
      systemPrompt += `${template.template}\n\n`;
    }
  }

  // =====================================================
  // 10. INSTRUCCIONES FINALES DE FORMATO
  // =====================================================
  const styleDescriptions: Record<string, string> = {
    professional: 'profesional y directo',
    professional_friendly: 'profesional pero cálido y amigable',
    formal: 'muy formal y respetuoso',
  };

  const styleDesc = styleDescriptions[ai_config.response_style] || 'profesional y directo';

  systemPrompt += `\n# INSTRUCCIONES DE RESPUESTA\n`;
  systemPrompt += `- Responde de manera ${styleDesc}\n`;
  systemPrompt += `- Máximo ${ai_config.max_response_length || 300} caracteres por respuesta\n`;
  systemPrompt += `- NO uses emojis a menos que el cliente los use primero\n`;
  systemPrompt += `- Si no sabes algo con certeza, ofrece conectar con un asesor humano\n`;
  systemPrompt += `- Siempre busca agendar una cita o proporcionar información útil\n`;
  systemPrompt += `- Para ubicaciones, da la dirección completa y el link de Google Maps\n`;
  systemPrompt += `- Para doctores, indica en qué sucursal(es) atienden\n`;
  systemPrompt += `- Para horarios, da información específica de la sucursal relevante\n`;
  systemPrompt += `- Usa la información de las políticas cuando sea relevante\n`;
  systemPrompt += `- Sigue las instrucciones personalizadas del negocio de forma natural\n`;

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
 * MEJORADO: Ahora soporta acciones transaccionales (crear citas, actualizar datos)
 * SECURITY: Validates conversation belongs to tenant to prevent IDOR attacks
 */
export async function generateAIResponse(
  tenantId: string,
  conversationId: string,
  currentMessage: string
): Promise<AIProcessingResult> {
  const startTime = Date.now();

  // SECURITY: First validate conversation belongs to tenant (prevents IDOR)
  const supabase = createServerClient();
  const { data: conversationCheck, error: checkError } = await supabase
    .from('conversations')
    .select('id, tenant_id')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (checkError || !conversationCheck) {
    console.error(`[AI Service] SECURITY: Conversation ${conversationId} does not belong to tenant ${tenantId} or does not exist`);
    throw new Error('Conversation not accessible');
  }

  // 1. Obtener contextos (tenantId already validated above)
  const [tenantContext, conversationContext] = await Promise.all([
    getTenantAIContext(tenantId),
    getConversationContext(conversationId, currentMessage, tenantId),
  ]);

  if (!tenantContext || !conversationContext) {
    console.error(`[AI Service] Context load failed - tenant: ${!!tenantContext}, conversation: ${!!conversationContext}`);
    throw new Error('Could not load AI context');
  }

  // SAFETY: Handle edge case where tenant has no services/branches configured
  if (!tenantContext.services || tenantContext.services.length === 0) {
    console.warn(`[AI Service] Tenant ${tenantId} has no services configured - AI may provide limited responses`);
  }
  if (!tenantContext.branches || tenantContext.branches.length === 0) {
    console.warn(`[AI Service] Tenant ${tenantId} has no branches configured - cannot schedule appointments`);
  }
  if (!tenantContext.ai_config?.system_prompt) {
    console.warn(`[AI Service] Tenant ${tenantId} has no system prompt configured - using minimal response`);
  }

  // 2. Detectar señales e intención (handle missing scoring_rules)
  const scoringRules = tenantContext.scoring_rules || [];
  const { signals, totalPoints } = detectSignals(currentMessage, scoringRules);
  const intent = detectIntent(currentMessage, signals);

  // 3. Verificar escalación (handle missing auto_escalate_keywords)
  const autoEscalateKeywords = tenantContext.ai_config?.auto_escalate_keywords || [];
  const escalationCheck = shouldEscalate(
    intent,
    signals,
    autoEscalateKeywords,
    currentMessage
  );

  // 4. NUEVO: Extraer datos estructurados del mensaje (handle missing services)
  const services = tenantContext.services || [];
  const extractionResult = performFullExtraction(
    currentMessage,
    services.map(s => ({ id: s.id, name: s.name, category: s.category }))
  );

  // Variables para acciones transaccionales
  let appointmentCreated: AIProcessingResult['appointment_created'];
  let leadDataUpdated: string[] = [];
  let serviceInterestDetected: AIProcessingResult['service_interest_detected'];

  // 5. NUEVO: Actualizar datos del lead si se extrajeron nuevos
  if (extractionResult.should_update_lead) {
    const updateResult = await updateLeadWithExtractedData(
      conversationContext.lead_id,
      extractionResult.lead_data
    );
    if (updateResult.success) {
      leadDataUpdated = updateResult.fieldsUpdated;
      console.log(`[AI Service] Lead ${conversationContext.lead_id} updated: ${leadDataUpdated.join(', ')}`);
    }
  }

  // 6. NUEVO: Registrar interés en servicio si se detectó
  if (extractionResult.service_interest) {
    await recordServiceInterest(
      conversationContext.lead_id,
      conversationId,
      extractionResult.service_interest
    );
    serviceInterestDetected = {
      service_name: extractionResult.service_interest.service_name,
      urgency: extractionResult.service_interest.urgency,
    };
    console.log(`[AI Service] Service interest detected: ${extractionResult.service_interest.service_name}`);
  }

  // 7. NUEVO: Intentar crear cita si la intención es BOOK_APPOINTMENT
  //    y hay datos de fecha/hora en el mensaje
  if (intent === 'BOOK_APPOINTMENT') {
    const bookingData = extractBookingData(currentMessage);

    // Solo intentar crear cita si hay fecha/hora o flexibilidad
    if (bookingData.date || bookingData.time || bookingData.is_flexible) {
      // Encontrar sucursal y servicio
      let branchId: string | undefined;
      let serviceId: string | undefined;

      // Buscar sucursal por nombre si se mencionó
      if (extractionResult.preferences.preferred_branch) {
        const branch = tenantContext.branches.find(b =>
          b.name.toLowerCase().includes(extractionResult.preferences.preferred_branch!.toLowerCase())
        );
        if (branch) branchId = branch.id;
      }

      // Usar sucursal por defecto si no se especificó
      if (!branchId && tenantContext.branches.length > 0) {
        const hq = tenantContext.branches.find(b => b.is_headquarters);
        branchId = hq?.id || tenantContext.branches[0].id;
      }

      // Buscar servicio por interés detectado
      if (extractionResult.service_interest?.service_id) {
        serviceId = extractionResult.service_interest.service_id;
      }

      // Intentar crear la cita
      const bookingRequest: BookingRequest = {
        tenant_id: tenantId,
        lead_id: conversationContext.lead_id,
        conversation_id: conversationId,
        branch_id: branchId,
        service_id: serviceId,
        requested_date: bookingData.date,
        requested_time: bookingData.time,
      };

      const bookingResult = await createBooking(bookingRequest);

      if (bookingResult.success) {
        appointmentCreated = {
          appointment_id: bookingResult.appointment_id!,
          scheduled_at: bookingResult.scheduled_at!,
          branch_name: bookingResult.branch_name!,
          service_name: bookingResult.service_name,
          staff_name: bookingResult.staff_name,
        };

        // Usar mensaje de confirmación en lugar de respuesta genérica de AI
        const confirmationMessage = generateBookingConfirmation(bookingResult);

        console.log(`[AI Service] Appointment created: ${bookingResult.appointment_id}`);

        const processingTime = Date.now() - startTime;
        return {
          response: confirmationMessage,
          intent,
          signals,
          score_change: totalPoints + 25, // Bonus por crear cita
          escalate: false, // No escalar si se creó cita exitosamente
          tokens_used: 0,
          model_used: 'booking_service',
          processing_time_ms: processingTime,
          appointment_created: appointmentCreated,
          lead_data_updated: leadDataUpdated.length > 0 ? leadDataUpdated : undefined,
          service_interest_detected: serviceInterestDetected,
        };
      } else if (bookingResult.suggestion) {
        // No se pudo crear cita pero tenemos sugerencia
        console.log(`[AI Service] Booking failed with suggestion: ${bookingResult.suggestion}`);
        // Continuar con AI para manejar la situación
      }
    }
  }

  // 8. Construir prompts para OpenAI
  let systemPrompt = buildSystemPrompt(tenantContext);

  // Agregar contexto de disponibilidad si el intent es BOOK_APPOINTMENT
  if (intent === 'BOOK_APPOINTMENT') {
    const branchId = tenantContext.branches[0]?.id;
    if (branchId) {
      const availableSlots = await getAvailableSlots(tenantId, branchId, undefined, undefined, undefined, 5);
      if (availableSlots.length > 0) {
        systemPrompt += `\n\n# HORARIOS DISPONIBLES ACTUALES\n`;
        systemPrompt += `Ofrece estos horarios disponibles para agendar:\n`;
        for (const slot of availableSlots) {
          const date = new Date(slot.date + 'T12:00:00');
          const dateStr = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
          systemPrompt += `- ${dateStr} a las ${slot.time} en ${slot.branch_name}\n`;
        }
        systemPrompt += `\nSi el cliente confirma uno de estos horarios, responde confirmando la cita con todos los detalles.\n`;
      }
    }
  }

  const messageHistory = buildMessageHistory(conversationContext);

  // 9. Llamar a GPT-5 Mini (OpenAI)
  const model = DEFAULT_MODEL;
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

    response = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu mensaje. Un asesor te contactará pronto.';
    tokensUsed = (completion.usage?.prompt_tokens || 0) + (completion.usage?.completion_tokens || 0);
  } catch (error) {
    // Handle different types of OpenAI errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
    const isRateLimit = errorMessage.includes('rate_limit') || errorMessage.includes('429');

    if (isTimeout) {
      console.error(`[AI Service] OpenAI timeout after ${LLM_TIMEOUT_MS}ms:`, errorMessage);
      response = 'Disculpa, la respuesta está tardando más de lo esperado. Un asesor te contactará en breve.';
    } else if (isRateLimit) {
      console.error('[AI Service] OpenAI rate limit hit:', errorMessage);
      response = 'Estamos experimentando alta demanda. Un asesor te atenderá pronto.';
    } else {
      console.error('[AI Service] OpenAI API error:', error);
      response = 'Disculpa, estoy experimentando dificultades técnicas. Un asesor humano te atenderá en breve.';
    }
    tokensUsed = 0;
  }

  // 10. Calcular tiempo de procesamiento
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
    appointment_created: appointmentCreated,
    lead_data_updated: leadDataUpdated.length > 0 ? leadDataUpdated : undefined,
    service_interest_detected: serviceInterestDetected,
  };
}

// ======================
// SAVE FUNCTIONS
// ======================

/**
 * Guarda la respuesta AI como mensaje
 * SECURITY: tenantId required to prevent cross-tenant writes
 */
export async function saveAIResponse(
  conversationId: string,
  response: string,
  metadata: Record<string, unknown>,
  tenantId?: string
): Promise<string> {
  const supabase = createServerClient();

  // SECURITY: If tenantId provided, validate conversation belongs to tenant before writing
  if (tenantId) {
    const { data: convCheck, error: checkError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (checkError || !convCheck) {
      console.error(`[AI Service] SECURITY: Attempt to write message to conversation ${conversationId} not belonging to tenant ${tenantId}`);
      throw new Error('Cannot write to conversation: access denied');
    }
  }

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

  // Actualizar conversación (already validated above if tenantId was provided)
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
 * SECURITY: tenantId required to validate lead ownership
 */
export async function updateLeadScore(
  leadId: string,
  signals: AISignal[],
  conversationId: string,
  tenantId?: string
): Promise<void> {
  const supabase = createServerClient();

  // SECURITY: If tenantId provided, validate lead belongs to tenant
  if (tenantId) {
    const { data: leadCheck, error: checkError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (checkError || !leadCheck) {
      console.error(`[AI Service] SECURITY: Attempt to update score for lead ${leadId} not belonging to tenant ${tenantId}`);
      throw new Error('Cannot update lead: access denied');
    }
  }

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
 * SECURITY: tenantId required to validate conversation ownership
 */
export async function escalateConversation(
  conversationId: string,
  reason: string,
  tenantId?: string
): Promise<void> {
  const supabase = createServerClient();

  // SECURITY: If tenantId provided, only update if conversation belongs to tenant
  let query = supabase
    .from('conversations')
    .update({
      status: 'escalated',
      ai_handling: false,
      escalation_reason: reason,
      escalated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { error } = await query;

  if (error) {
    console.error(`[AI Service] Error escalating conversation ${conversationId}:`, error);
    throw new Error('Failed to escalate conversation');
  }

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
