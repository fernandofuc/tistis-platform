// =====================================================
// TIS TIS PLATFORM - AI Prompt Generator Service
// Sistema de Caché de Prompts Pre-Generados
// =====================================================
// Este servicio implementa un sistema de caché inteligente
// donde los prompts se generan UNA SOLA VEZ cuando el usuario
// guarda cambios en Business IA, y se reutilizan en cada
// mensaje/llamada subsecuente.
//
// BENEFICIOS:
// 1. Reducción de tokens por request (de ~5000 a ~1500)
// 2. Prompts optimizados por canal (voice vs chat)
// 3. Menor latencia en respuestas
// 4. Costo reducido por mensaje
//
// FLUJO:
// Usuario guarda cambios → Gemini genera prompt optimizado →
// Se cachea en DB → Se usa en cada mensaje/llamada
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  generateWithGemini,
  DEFAULT_GEMINI_MODELS,
  isGeminiConfigured,
} from '@/src/shared/lib/gemini';
import crypto from 'crypto';

// ======================
// TYPES
// ======================

export type PromptType = 'voice' | 'messaging';

// Canales soportados para caché (alineado con el sistema existente)
export type CacheChannel = 'voice' | 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat';

// Mapeo de PromptType a canales de caché
const PROMPT_TYPE_TO_CHANNELS: Record<PromptType, CacheChannel[]> = {
  voice: ['voice'],
  messaging: ['whatsapp', 'instagram', 'facebook', 'tiktok', 'webchat'],
};

// Resultado de obtener prompt cacheado
export interface CachedPromptResult {
  found: boolean;
  prompt_id?: string;
  generated_prompt?: string;
  system_prompt?: string;
  prompt_version?: number;
  source_data_hash?: string;
  last_updated?: string;
  needs_regeneration?: boolean;
}

export interface BusinessContext {
  tenantId: string;
  tenantName: string;
  vertical: string;
  // Configuración específica
  assistantName?: string;
  assistantPersonality?: string;
  customInstructions?: string;
  // Datos del negocio
  branches: Array<{
    name: string;
    address?: string;
    city?: string;
    phone?: string;
    operatingHours?: Record<string, { open: string; close: string }>;
    isHeadquarters?: boolean;
  }>;
  services: Array<{
    name: string;
    description?: string;
    priceMin?: number;
    priceMax?: number;
    priceNote?: string;
    durationMinutes?: number;
    category?: string;
    specialInstructions?: string;
    requiresConsultation?: boolean;
    promotionActive?: boolean;
    promotionText?: string;
  }>;
  staff: Array<{
    name: string;
    role?: string;
    specialty?: string;
    branchNames?: string[];
  }>;
  faqs?: Array<{
    question: string;
    answer: string;
  }>;
  // Knowledge Base - Instrucciones Personalizadas
  customInstructionsList?: Array<{
    type: string;
    title: string;
    instruction: string;
  }>;
  // Knowledge Base - Políticas del Negocio
  businessPolicies?: Array<{
    type: string;
    title: string;
    policy: string;
  }>;
  // Knowledge Base - Artículos de Conocimiento (NUEVO)
  knowledgeArticles?: Array<{
    category: string;
    title: string;
    content: string;
    tags?: string[];
  }>;
  // Knowledge Base - Templates de Respuesta (NUEVO)
  responseTemplates?: Array<{
    triggerType: string;
    name: string;
    template: string;
    variables?: string[];
  }>;
  // Knowledge Base - Manejo de Competidores (NUEVO)
  competitorHandling?: Array<{
    competitorName: string;
    responseStrategy: string;
    keyDifferentiators?: string[];
  }>;
  // Configuración adicional
  escalationEnabled?: boolean;
  escalationPhone?: string;
  goodbyeMessage?: string;
}

export interface PromptGenerationResult {
  success: boolean;
  prompt: string;
  error?: string;
  generatedAt: string;
  model: string;
  processingTimeMs: number;
}

// ======================
// VERTICAL CONFIGURATIONS
// ======================

const VERTICAL_CONFIGS: Record<string, {
  type: string;
  roleDescVoice: string;
  roleDescMessaging: string;
  mainTaskVoice: string;
  mainTaskMessaging: string;
  specialConsiderations: string[];
}> = {
  dental: {
    type: 'consultorio dental',
    roleDescVoice: 'asistente de voz IA especializado en atención dental',
    roleDescMessaging: 'asistente virtual especializado en atención dental',
    mainTaskVoice: 'ayudar a los pacientes a agendar citas dentales, responder preguntas sobre tratamientos y procedimientos, y proporcionar información sobre los servicios de la clínica',
    mainTaskMessaging: 'responder consultas sobre tratamientos dentales, agendar citas y proporcionar información útil sobre los servicios de la clínica',
    specialConsiderations: [
      'NUNCA des diagnósticos dentales ni recomendaciones de tratamiento específicas',
      'Siempre sugiere una valoración presencial para casos complejos',
      'Si el paciente menciona dolor severo o emergencia, prioriza la atención urgente',
      'Respeta la privacidad del paciente en todo momento',
    ],
  },
  medical: {
    type: 'consultorio médico',
    roleDescVoice: 'asistente de voz IA especializado en atención médica',
    roleDescMessaging: 'asistente virtual especializado en atención médica',
    mainTaskVoice: 'ayudar a los pacientes a agendar consultas médicas y proporcionar información general sobre los servicios',
    mainTaskMessaging: 'responder consultas generales, agendar consultas y proporcionar información sobre los servicios médicos disponibles',
    specialConsiderations: [
      'IMPORTANTE: NUNCA proporciones consejos médicos ni diagnósticos',
      'IMPORTANTE: NUNCA recetes ni sugieras medicamentos',
      'Si el paciente describe síntomas graves, indica que debe acudir a urgencias',
      'Siempre recomienda consulta presencial para evaluación médica',
      'Mantén estricta confidencialidad de la información del paciente',
    ],
  },
  restaurant: {
    type: 'restaurante',
    roleDescVoice: 'asistente de voz IA especializado en reservaciones de restaurante',
    roleDescMessaging: 'asistente virtual especializado en reservaciones y atención al cliente',
    mainTaskVoice: 'ayudar a los clientes a hacer reservaciones, responder preguntas sobre el menú, horarios y servicios especiales',
    mainTaskMessaging: 'gestionar reservaciones, responder consultas sobre el menú y proporcionar información del restaurante',
    specialConsiderations: [
      'Siempre confirma el número de personas para la reservación',
      'Pregunta si hay alergias alimentarias o restricciones dietéticas',
      'Menciona promociones vigentes cuando sea relevante',
      'Ofrece alternativas si el horario solicitado no está disponible',
    ],
  },
  gym: {
    type: 'gimnasio o centro deportivo',
    roleDescVoice: 'asistente de voz IA especializado en fitness y bienestar',
    roleDescMessaging: 'asistente virtual especializado en membresías y servicios deportivos',
    mainTaskVoice: 'ayudar a los clientes con información sobre membresías, clases y servicios del gimnasio',
    mainTaskMessaging: 'responder consultas sobre membresías, horarios de clases y servicios disponibles',
    specialConsiderations: [
      'Enfatiza los beneficios de cada tipo de membresía',
      'Ofrece tours por las instalaciones para nuevos clientes',
      'Menciona las clases más populares y horarios disponibles',
    ],
  },
  services: {
    type: 'negocio de servicios profesionales',
    roleDescVoice: 'asistente de voz IA profesional',
    roleDescMessaging: 'asistente virtual profesional',
    mainTaskVoice: 'ayudar a los clientes a agendar citas y obtener información sobre los servicios disponibles',
    mainTaskMessaging: 'responder consultas sobre servicios, disponibilidad y precios',
    specialConsiderations: [
      'Mantén un tono profesional y cortés',
      'Proporciona información clara sobre los servicios',
    ],
  },
  general: {
    type: 'negocio',
    roleDescVoice: 'asistente de voz IA',
    roleDescMessaging: 'asistente virtual',
    mainTaskVoice: 'ayudar a los clientes a agendar citas y responder preguntas sobre los servicios',
    mainTaskMessaging: 'responder consultas y proporcionar información útil a los clientes',
    specialConsiderations: [],
  },
};

// ======================
// DATA COLLECTION
// ======================

/**
 * Fallback: Recopila contexto usando queries directas cuando el RPC falla
 */
async function collectBusinessContextFallback(
  tenantId: string,
  promptType: PromptType,
  supabase: ReturnType<typeof createServerClient>
): Promise<BusinessContext | null> {
  try {
    // 1. Obtener información del tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, vertical')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      console.error('[PromptGenerator Fallback] Tenant not found:', tenantId);
      return null;
    }

    // 2. Configuración según tipo de prompt
    let assistantName = 'Asistente';
    let assistantPersonality = 'professional_friendly';
    let customInstructions = '';
    let escalationEnabled = false;
    let escalationPhone = '';
    let goodbyeMessage = '';

    if (promptType === 'voice') {
      const { data: voiceConfig } = await supabase
        .from('voice_agent_config')
        .select('assistant_name, assistant_personality, custom_instructions, escalation_enabled, escalation_phone, goodbye_message')
        .eq('tenant_id', tenantId)
        .single();

      if (voiceConfig) {
        assistantName = voiceConfig.assistant_name || assistantName;
        assistantPersonality = voiceConfig.assistant_personality || assistantPersonality;
        customInstructions = voiceConfig.custom_instructions || '';
        escalationEnabled = voiceConfig.escalation_enabled || false;
        escalationPhone = voiceConfig.escalation_phone || '';
        goodbyeMessage = voiceConfig.goodbye_message || '';
      }
    }

    // 3. Sucursales
    const { data: branchesData } = await supabase
      .from('branches')
      .select('name, address, city, phone, operating_hours, is_headquarters')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false })
      .limit(10);

    // 4. Servicios
    const { data: servicesData } = await supabase
      .from('services')
      .select('name, description, ai_description, price_min, price_max, price_note, duration_minutes, category, special_instructions, requires_consultation, promotion_active, promotion_text')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(50);

    // 5. Staff
    const { data: staffData } = await supabase
      .from('staff')
      .select('first_name, last_name, display_name, role, specialty')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['dentist', 'specialist', 'owner', 'manager', 'doctor'])
      .limit(20);

    // 6. FAQs
    const { data: faqsData } = await supabase
      .from('faqs')
      .select('question, answer')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(20);

    // 7-11. Knowledge Base tables
    const { data: instructionsData } = await supabase
      .from('ai_custom_instructions')
      .select('instruction_type, title, instruction')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(30);

    const { data: policiesData } = await supabase
      .from('ai_business_policies')
      .select('policy_type, title, policy_text')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(20);

    const { data: articlesData } = await supabase
      .from('ai_knowledge_articles')
      .select('category, title, content')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(50);

    const { data: templatesData } = await supabase
      .from('ai_response_templates')
      .select('trigger_type, name, template_text, variables_available')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(30);

    const { data: competitorsData } = await supabase
      .from('ai_competitor_handling')
      .select('competitor_name, response_strategy, key_differentiators')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(20);

    console.log('[PromptGenerator Fallback] Data loaded:', {
      branches: (branchesData || []).length,
      services: (servicesData || []).length,
      staff: (staffData || []).length,
      faqs: (faqsData || []).length,
    });

    return {
      tenantId,
      tenantName: tenant.name,
      vertical: tenant.vertical || 'general',
      assistantName,
      assistantPersonality,
      customInstructions,
      branches: (branchesData || []).map(b => ({
        name: b.name,
        address: b.address,
        city: b.city,
        phone: b.phone,
        operatingHours: b.operating_hours,
        isHeadquarters: b.is_headquarters,
      })),
      services: (servicesData || []).map(s => ({
        name: s.name,
        description: s.ai_description || s.description,
        priceMin: s.price_min,
        priceMax: s.price_max,
        priceNote: s.price_note,
        durationMinutes: s.duration_minutes,
        category: s.category,
        specialInstructions: s.special_instructions,
        requiresConsultation: s.requires_consultation,
        promotionActive: s.promotion_active,
        promotionText: s.promotion_text,
      })),
      staff: (staffData || []).map(s => ({
        name: s.display_name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        role: s.role,
        specialty: s.specialty,
      })),
      faqs: (faqsData || []).map(f => ({
        question: f.question,
        answer: f.answer,
      })),
      customInstructionsList: (instructionsData || []).map(i => ({
        type: i.instruction_type,
        title: i.title,
        instruction: i.instruction,
      })),
      businessPolicies: (policiesData || []).map(p => ({
        type: p.policy_type,
        title: p.title,
        policy: p.policy_text,
      })),
      knowledgeArticles: (articlesData || []).map(a => ({
        category: a.category,
        title: a.title,
        content: a.content,
      })),
      responseTemplates: (templatesData || []).map(t => ({
        triggerType: t.trigger_type,
        name: t.name,
        template: t.template_text,
        variables: t.variables_available,
      })),
      competitorHandling: (competitorsData || []).map(c => ({
        competitorName: c.competitor_name,
        responseStrategy: c.response_strategy,
        keyDifferentiators: c.key_differentiators,
      })),
      escalationEnabled,
      escalationPhone,
      goodbyeMessage,
    };
  } catch (error) {
    console.error('[PromptGenerator Fallback] Error:', error);
    return null;
  }
}

/**
 * Recopila todo el contexto del negocio para generar un prompt
 *
 * OPTIMIZACIÓN: Usa el RPC get_tenant_ai_context que obtiene TODO en una sola llamada
 * Esto es más eficiente que hacer 11 queries separadas y mantiene consistencia
 * con el sistema LangGraph que usa el mismo RPC.
 */
export async function collectBusinessContext(
  tenantId: string,
  promptType: PromptType
): Promise<BusinessContext | null> {
  const supabase = createServerClient();

  try {
    // 1. Usar el RPC optimizado que trae TODO el contexto en una llamada
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_tenant_ai_context', {
      p_tenant_id: tenantId,
    });

    if (rpcError || !rpcData) {
      console.error('[PromptGenerator] Error calling get_tenant_ai_context:', rpcError);
      console.log('[PromptGenerator] Falling back to direct queries...');
      // Fallback: usar queries directas si el RPC falla
      return await collectBusinessContextFallback(tenantId, promptType, supabase);
    }

    // Debug: Log data counts from RPC
    console.log('[PromptGenerator] RPC Response for tenant:', tenantId, {
      tenant_name: rpcData.tenant_name,
      branches_count: (rpcData.branches || []).length,
      services_count: (rpcData.services || []).length,
      doctors_count: (rpcData.doctors || []).length,
      faqs_count: (rpcData.faqs || []).length,
      custom_instructions_count: (rpcData.custom_instructions || []).length,
      business_policies_count: (rpcData.business_policies || []).length,
      knowledge_articles_count: (rpcData.knowledge_articles || []).length,
      response_templates_count: (rpcData.response_templates || []).length,
      competitor_handling_count: (rpcData.competitor_handling || []).length,
    });

    // 2. Obtener configuración específica según el tipo de prompt
    let assistantName = 'Asistente';
    let assistantPersonality = rpcData.ai_config?.response_style || 'professional_friendly';
    let customInstructions = rpcData.ai_config?.system_prompt || '';
    let escalationEnabled = false;
    let escalationPhone = '';
    let goodbyeMessage = '';

    if (promptType === 'voice') {
      // Para voice, obtener config específica de voice_agent_config
      const { data: voiceConfig } = await supabase
        .from('voice_agent_config')
        .select('assistant_name, assistant_personality, custom_instructions, escalation_enabled, escalation_phone, goodbye_message')
        .eq('tenant_id', tenantId)
        .single();

      if (voiceConfig) {
        assistantName = voiceConfig.assistant_name || assistantName;
        assistantPersonality = voiceConfig.assistant_personality || assistantPersonality;
        customInstructions = voiceConfig.custom_instructions || customInstructions;
        escalationEnabled = voiceConfig.escalation_enabled || false;
        escalationPhone = voiceConfig.escalation_phone || '';
        goodbyeMessage = voiceConfig.goodbye_message || '';
      }
    }

    // 3. Mapear datos del RPC al formato BusinessContext
    // El RPC ya trae: services, branches, doctors, faqs, custom_instructions,
    // business_policies, knowledge_articles, response_templates, competitor_handling

    const branches = (rpcData.branches || []).map((b: Record<string, unknown>) => ({
      name: b.name as string,
      address: (b.address as string) || undefined,
      city: (b.city as string) || undefined,
      phone: (b.phone as string) || undefined,
      operatingHours: b.operating_hours as Record<string, { open: string; close: string }> | undefined,
      isHeadquarters: (b.is_headquarters as boolean) || false,
    }));

    const services = (rpcData.services || []).map((s: Record<string, unknown>) => ({
      name: s.name as string,
      description: (s.ai_description as string) || (s.description as string) || undefined,
      priceMin: (s.price_min as number) || undefined,
      priceMax: (s.price_max as number) || undefined,
      priceNote: (s.price_note as string) || undefined,
      durationMinutes: (s.duration_minutes as number) || undefined,
      category: (s.category as string) || undefined,
      specialInstructions: (s.special_instructions as string) || undefined,
      requiresConsultation: (s.requires_consultation as boolean) || false,
      promotionActive: (s.promotion_active as boolean) || false,
      promotionText: (s.promotion_text as string) || undefined,
    }));

    // RPC usa 'doctors' en lugar de 'staff'
    const staff = (rpcData.doctors || []).map((s: Record<string, unknown>) => ({
      name: (s.name as string) || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Staff',
      role: (s.role_title as string) || (s.role as string) || undefined,
      specialty: (s.specialty as string) || undefined,
    }));

    const faqs = (rpcData.faqs || []).map((f: Record<string, unknown>) => ({
      question: f.question as string,
      answer: f.answer as string,
    }));

    const customInstructionsList = (rpcData.custom_instructions || []).map((i: Record<string, unknown>) => ({
      type: i.type as string,
      title: i.title as string,
      instruction: i.instruction as string,
    }));

    const businessPolicies = (rpcData.business_policies || []).map((p: Record<string, unknown>) => ({
      type: p.type as string,
      title: p.title as string,
      policy: p.policy as string,
    }));

    const knowledgeArticles = (rpcData.knowledge_articles || []).map((a: Record<string, unknown>) => ({
      category: a.category as string,
      title: a.title as string,
      content: a.content as string,
      tags: undefined, // RPC no incluye tags, pero no es crítico
    }));

    const responseTemplates = (rpcData.response_templates || []).map((t: Record<string, unknown>) => ({
      triggerType: t.trigger as string,
      name: t.name as string,
      template: t.template as string,
      variables: t.variables as string[] | undefined,
    }));

    const competitorHandling = (rpcData.competitor_handling || []).map((c: Record<string, unknown>) => ({
      competitorName: c.competitor as string,
      responseStrategy: c.strategy as string,
      keyDifferentiators: c.talking_points as string[] | undefined,
    }));

    return {
      tenantId,
      tenantName: rpcData.tenant_name,
      vertical: rpcData.vertical || 'general',
      assistantName,
      assistantPersonality,
      customInstructions,
      branches,
      services,
      staff,
      faqs,
      customInstructionsList,
      businessPolicies,
      knowledgeArticles,
      responseTemplates,
      competitorHandling,
      escalationEnabled,
      escalationPhone,
      goodbyeMessage,
    };

  } catch (error) {
    console.error('[PromptGenerator] Error collecting context:', error);
    return null;
  }
}

// ======================
// PROMPT GENERATION
// ======================

/**
 * Genera un prompt profesional usando Gemini 3.0
 */
export async function generatePromptWithAI(
  context: BusinessContext,
  promptType: PromptType
): Promise<PromptGenerationResult> {
  // Verificar que Gemini está configurado
  if (!isGeminiConfigured()) {
    return {
      success: false,
      prompt: '',
      error: 'Gemini no está configurado. Verifica GOOGLE_GEMINI_API_KEY.',
      generatedAt: new Date().toISOString(),
      model: 'none',
      processingTimeMs: 0,
    };
  }

  const verticalConfig = VERTICAL_CONFIGS[context.vertical] || VERTICAL_CONFIGS.general;
  const currentDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Construir el meta-prompt para Gemini 3.0
  const metaPrompt = buildMetaPrompt(context, promptType, verticalConfig, currentDate);

  // Generar con Gemini 3.0
  const result = await generateWithGemini(metaPrompt, {
    model: DEFAULT_GEMINI_MODELS.PROMPT_GENERATION,
    temperature: 0.7,
    maxOutputTokens: 8192,
  });

  if (!result.success) {
    return {
      success: false,
      prompt: '',
      error: result.error,
      generatedAt: new Date().toISOString(),
      model: result.model,
      processingTimeMs: result.processingTimeMs,
    };
  }

  // Limpiar el prompt generado (quitar markdown code blocks si existen)
  let cleanedPrompt = result.content;
  cleanedPrompt = cleanedPrompt.replace(/^```[\w]*\n?/gm, '');
  cleanedPrompt = cleanedPrompt.replace(/\n?```$/gm, '');
  cleanedPrompt = cleanedPrompt.trim();

  return {
    success: true,
    prompt: cleanedPrompt,
    generatedAt: new Date().toISOString(),
    model: result.model,
    processingTimeMs: result.processingTimeMs,
  };
}

/**
 * Construye el meta-prompt para que Gemini genere el prompt del agente
 */
function buildMetaPrompt(
  context: BusinessContext,
  promptType: PromptType,
  verticalConfig: typeof VERTICAL_CONFIGS[string],
  currentDate: string
): string {
  const isVoice = promptType === 'voice';
  const roleDesc = isVoice ? verticalConfig.roleDescVoice : verticalConfig.roleDescMessaging;
  const mainTask = isVoice ? verticalConfig.mainTaskVoice : verticalConfig.mainTaskMessaging;

  // Formatear servicios
  const servicesText = context.services.length > 0
    ? context.services.map(s => {
      let priceStr = '';
      if (s.priceNote) {
        priceStr = s.priceNote;
      } else if (s.priceMin) {
        priceStr = s.priceMax && s.priceMax !== s.priceMin
          ? `$${s.priceMin} - $${s.priceMax}`
          : `$${s.priceMin}`;
      }
      return `- ${s.name}${priceStr ? ` (${priceStr})` : ''}${s.durationMinutes ? ` - ${s.durationMinutes} min` : ''}${s.description ? `: ${s.description}` : ''}${s.promotionActive && s.promotionText ? ` [PROMOCIÓN: ${s.promotionText}]` : ''}`;
    }).join('\n')
    : 'No hay servicios configurados.';

  // Formatear sucursales
  const branchesText = context.branches.length > 0
    ? context.branches.map(b => {
      let text = `- ${b.name}${b.isHeadquarters ? ' (Principal)' : ''}`;
      if (b.address) text += `: ${b.address}`;
      if (b.city) text += `, ${b.city}`;
      if (b.phone) text += ` | Tel: ${b.phone}`;
      return text;
    }).join('\n')
    : 'No hay sucursales configuradas.';

  // Formatear staff
  const staffText = context.staff.length > 0
    ? context.staff.map(s => `- ${s.name}${s.specialty ? ` (${s.specialty})` : ''}`).join('\n')
    : 'No hay personal configurado.';

  // Formatear FAQs
  const faqsText = context.faqs && context.faqs.length > 0
    ? context.faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')
    : '';

  // Formatear instrucciones personalizadas
  const customInstructionsText = context.customInstructionsList && context.customInstructionsList.length > 0
    ? context.customInstructionsList.map(i => `[${i.type.toUpperCase()}] ${i.title}: ${i.instruction}`).join('\n')
    : '';

  // Formatear políticas
  const policiesText = context.businessPolicies && context.businessPolicies.length > 0
    ? context.businessPolicies.map(p => `[${p.type.toUpperCase()}] ${p.title}: ${p.policy}`).join('\n')
    : '';

  // Formatear artículos de conocimiento (NUEVO)
  const knowledgeArticlesText = context.knowledgeArticles && context.knowledgeArticles.length > 0
    ? context.knowledgeArticles.map(a => {
        const tagsStr = a.tags && a.tags.length > 0 ? ` (Tags: ${a.tags.join(', ')})` : '';
        return `[${a.category.toUpperCase()}] ${a.title}${tagsStr}:\n${a.content}`;
      }).join('\n\n')
    : '';

  // Formatear templates de respuesta (NUEVO)
  const responseTemplatesText = context.responseTemplates && context.responseTemplates.length > 0
    ? context.responseTemplates.map(t => {
        const varsStr = t.variables && t.variables.length > 0 ? ` (Variables: ${t.variables.join(', ')})` : '';
        return `[${t.triggerType.toUpperCase()}] ${t.name}${varsStr}:\n"${t.template}"`;
      }).join('\n\n')
    : '';

  // Formatear manejo de competidores (NUEVO)
  const competitorHandlingText = context.competitorHandling && context.competitorHandling.length > 0
    ? context.competitorHandling.map(c => {
        const diffStr = c.keyDifferentiators && c.keyDifferentiators.length > 0
          ? `\n  Diferenciadores: ${c.keyDifferentiators.join(', ')}`
          : '';
        return `- ${c.competitorName}: ${c.responseStrategy}${diffStr}`;
      }).join('\n')
    : '';

  // Consideraciones especiales de la vertical
  const specialConsiderations = verticalConfig.specialConsiderations.length > 0
    ? verticalConfig.specialConsiderations.map(c => `- ${c}`).join('\n')
    : '';

  // Construir el meta-prompt
  return `Eres un experto en diseño de prompts para asistentes de IA conversacionales. Tu tarea es crear un prompt de sistema PROFESIONAL y COMPLETO para un ${isVoice ? 'asistente de voz (llamadas telefónicas)' : 'asistente de mensajería (WhatsApp, Instagram, etc.)'}.

=== INFORMACIÓN DEL NEGOCIO ===

**Nombre del negocio:** ${context.tenantName}
**Tipo de negocio:** ${verticalConfig.type}
**Nombre del asistente:** ${context.assistantName}
**Personalidad configurada:** ${context.assistantPersonality}
**Fecha actual:** ${currentDate}

**SUCURSALES:**
${branchesText}

**SERVICIOS:**
${servicesText}

**EQUIPO/PERSONAL:**
${staffText}

${faqsText ? `**PREGUNTAS FRECUENTES:**\n${faqsText}` : ''}

${customInstructionsText ? `**INSTRUCCIONES PERSONALIZADAS DEL CLIENTE:**\n${customInstructionsText}` : ''}

${policiesText ? `**POLÍTICAS DEL NEGOCIO:**\n${policiesText}` : ''}

${knowledgeArticlesText ? `**BASE DE CONOCIMIENTO (ARTÍCULOS):**\n${knowledgeArticlesText}` : ''}

${responseTemplatesText ? `**TEMPLATES DE RESPUESTA PREDEFINIDOS:**\n${responseTemplatesText}` : ''}

${competitorHandlingText ? `**MANEJO DE COMPETIDORES:**\nCuando el cliente mencione estos competidores, responde así:\n${competitorHandlingText}` : ''}

${context.customInstructions ? `**INSTRUCCIONES ADICIONALES:**\n${context.customInstructions}` : ''}

${specialConsiderations ? `**CONSIDERACIONES ESPECIALES PARA ESTA VERTICAL:**\n${specialConsiderations}` : ''}

${context.escalationEnabled ? `**ESCALACIÓN:** Habilitada. Teléfono de escalación: ${context.escalationPhone || 'No configurado'}` : ''}

${context.goodbyeMessage ? `**MENSAJE DE DESPEDIDA PERSONALIZADO:** "${context.goodbyeMessage}"` : ''}

=== INSTRUCCIONES PARA GENERAR EL PROMPT ===

Genera un prompt de sistema completo y profesional siguiendo estas directrices:

1. **ESTRUCTURA DEL PROMPT:**
   - Comienza con una sección ## PERSONALIDAD que defina claramente quién es el asistente
   - Incluye una sección ## TAREA con los objetivos principales
   - Agrega ## INFORMACIÓN DEL NEGOCIO con todos los datos relevantes (sucursales, servicios, equipo)
   ${isVoice ? '- Incluye ## RESERVACIONES / CITAS con instrucciones paso a paso para agendar' : '- Incluye instrucciones para guiar hacia citas o consultas'}
   ${context.escalationEnabled ? '- Agrega ## ESCALACIÓN con las condiciones para transferir a un humano' : ''}
   - Finaliza con ## ESTILO DE COMUNICACIÓN y ## FINALIZACIÓN

2. **TONO Y ESTILO:**
   ${isVoice ? `
   - El tono debe ser CONVERSACIONAL y NATURAL (es una llamada telefónica)
   - Incluye muletillas naturales como "Mmm...", "Bueno...", "Claro...", "Déjame ver..."
   - Las respuestas deben ser CONCISAS (no más de 2-3 oraciones por turno)
   - Evita listas largas o información muy detallada de una sola vez
   - El asistente debe tener un acento mexicano amigable y profesional` : `
   - El tono debe ser ${context.assistantPersonality === 'casual' ? 'informal y cercano' : context.assistantPersonality === 'formal' ? 'muy formal y respetuoso' : 'profesional pero cálido'}
   - Las respuestas pueden ser un poco más detalladas que en voz
   - Puede usar formato con bullets cuando sea útil
   - Evita emojis a menos que el cliente los use primero`}

3. **CONTENIDO OBLIGATORIO:**
   - Toda la información de servicios y precios debe estar incluida
   - Las sucursales con direcciones y teléfonos
   - Los nombres del personal/especialistas si están disponibles
   - Las políticas relevantes del negocio
   - Las instrucciones personalizadas del cliente
   - Los artículos de la base de conocimiento cuando existan
   - Los templates de respuesta para situaciones específicas
   - Las estrategias de manejo de competidores si están configuradas

4. **REGLAS IMPORTANTES:**
   - El asistente NUNCA debe inventar información que no tenga
   - Si no sabe algo, debe admitirlo honestamente
   - Debe priorizar agendar citas o proporcionar información útil
   - Debe respetar las consideraciones especiales de la vertical

5. **FORMATO DE SALIDA:**
   - Genera SOLO el prompt, sin explicaciones adicionales
   - Usa formato markdown con secciones ##
   - No incluyas bloques de código ni etiquetas

Ahora genera el prompt completo para este ${isVoice ? 'asistente de voz' : 'asistente de mensajería'}:`;
}

// ======================
// HIGH-LEVEL FUNCTIONS
// ======================

/**
 * Genera y guarda un prompt para Voice Agent
 */
export async function generateVoiceAgentPrompt(tenantId: string): Promise<PromptGenerationResult> {
  const supabase = createServerClient();

  // Recopilar contexto
  const context = await collectBusinessContext(tenantId, 'voice');

  if (!context) {
    return {
      success: false,
      prompt: '',
      error: 'No se pudo obtener el contexto del negocio',
      generatedAt: new Date().toISOString(),
      model: 'none',
      processingTimeMs: 0,
    };
  }

  // Generar prompt con IA
  const result = await generatePromptWithAI(context, 'voice');

  if (!result.success) {
    return result;
  }

  // Guardar en la base de datos
  const { error: updateError } = await supabase
    .from('voice_agent_config')
    .update({
      system_prompt: result.prompt,
      system_prompt_generated_at: result.generatedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (updateError) {
    console.error('[PromptGenerator] Error saving voice prompt:', updateError);
    return {
      ...result,
      success: false,
      error: `Prompt generado pero error al guardar: ${updateError.message}`,
    };
  }

  console.log(`[PromptGenerator] Voice prompt generated for tenant ${tenantId} in ${result.processingTimeMs}ms`);

  return result;
}

/**
 * Genera y guarda un prompt para AI Agent (Mensajería)
 */
export async function generateMessagingAgentPrompt(tenantId: string): Promise<PromptGenerationResult> {
  const supabase = createServerClient();

  // Recopilar contexto
  const context = await collectBusinessContext(tenantId, 'messaging');

  if (!context) {
    return {
      success: false,
      prompt: '',
      error: 'No se pudo obtener el contexto del negocio',
      generatedAt: new Date().toISOString(),
      model: 'none',
      processingTimeMs: 0,
    };
  }

  // Generar prompt con IA
  const result = await generatePromptWithAI(context, 'messaging');

  if (!result.success) {
    return result;
  }

  // Guardar en la base de datos
  const { error: updateError } = await supabase
    .from('ai_tenant_config')
    .update({
      custom_instructions: result.prompt,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (updateError) {
    console.error('[PromptGenerator] Error saving messaging prompt:', updateError);
    return {
      ...result,
      success: false,
      error: `Prompt generado pero error al guardar: ${updateError.message}`,
    };
  }

  console.log(`[PromptGenerator] Messaging prompt generated for tenant ${tenantId} in ${result.processingTimeMs}ms`);

  return result;
}

// ======================
// CACHE SYSTEM FUNCTIONS
// ======================

/**
 * Calcula un hash SHA256 del contexto del negocio para detectar cambios
 * Si el hash cambia, significa que los datos fueron modificados y el prompt debe regenerarse
 */
export function calculateBusinessContextHash(context: BusinessContext): string {
  // Crear un objeto normalizado con los datos relevantes para el hash
  const dataForHash = {
    tenantName: context.tenantName,
    vertical: context.vertical,
    assistantName: context.assistantName,
    assistantPersonality: context.assistantPersonality,
    customInstructions: context.customInstructions,
    branches: context.branches.map(b => ({
      name: b.name,
      address: b.address,
      phone: b.phone,
      operatingHours: b.operatingHours,
    })),
    services: context.services.map(s => ({
      name: s.name,
      description: s.description,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      priceNote: s.priceNote,
      durationMinutes: s.durationMinutes,
      specialInstructions: s.specialInstructions,
      promotionActive: s.promotionActive,
      promotionText: s.promotionText,
    })),
    staff: context.staff.map(s => ({
      name: s.name,
      role: s.role,
      specialty: s.specialty,
    })),
    faqs: context.faqs,
    customInstructionsList: context.customInstructionsList,
    businessPolicies: context.businessPolicies,
    knowledgeArticles: context.knowledgeArticles,
    responseTemplates: context.responseTemplates,
    competitorHandling: context.competitorHandling,
    escalationEnabled: context.escalationEnabled,
    escalationPhone: context.escalationPhone,
    goodbyeMessage: context.goodbyeMessage,
  };

  // Convertir a JSON estable (ordenado) y calcular hash
  const jsonString = JSON.stringify(dataForHash, Object.keys(dataForHash).sort());
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Obtiene el prompt cacheado para un tenant y canal específico
 * Esta función es usada en cada mensaje/llamada para obtener el prompt sin regenerar
 */
export async function getCachedPrompt(
  tenantId: string,
  channel: CacheChannel
): Promise<CachedPromptResult> {
  const supabase = createServerClient();

  try {
    // Usar el RPC que actualiza estadísticas de uso automáticamente
    const { data, error } = await supabase.rpc('get_cached_prompt', {
      p_tenant_id: tenantId,
      p_channel: channel,
    });

    if (error) {
      console.error('[PromptCache] Error fetching cached prompt:', error);
      return { found: false };
    }

    if (!data || data.length === 0) {
      console.log(`[PromptCache] No cached prompt found for tenant ${tenantId}, channel ${channel}`);
      return { found: false, needs_regeneration: true };
    }

    const cachedPrompt = data[0];
    return {
      found: true,
      prompt_id: cachedPrompt.prompt_id,
      generated_prompt: cachedPrompt.generated_prompt,
      system_prompt: cachedPrompt.system_prompt,
      prompt_version: cachedPrompt.prompt_version,
      source_data_hash: cachedPrompt.source_data_hash,
      last_updated: cachedPrompt.last_updated,
    };
  } catch (error) {
    console.error('[PromptCache] Exception fetching cached prompt:', error);
    return { found: false };
  }
}

/**
 * Verifica si el prompt necesita regenerarse (datos cambiaron)
 */
export async function checkNeedsRegeneration(
  tenantId: string,
  channel: CacheChannel
): Promise<boolean> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase.rpc('check_prompt_needs_regeneration', {
      p_tenant_id: tenantId,
      p_channel: channel,
    });

    if (error) {
      console.error('[PromptCache] Error checking regeneration:', error);
      return true; // Si hay error, asumir que necesita regeneración
    }

    return data === true;
  } catch (error) {
    console.error('[PromptCache] Exception checking regeneration:', error);
    return true;
  }
}

/**
 * Guarda un prompt generado en el caché
 */
export async function saveCachedPrompt(
  tenantId: string,
  channel: CacheChannel,
  generatedPrompt: string,
  systemPrompt: string,
  sourceDataHash: string,
  generatorModel: string = 'gemini-2.0-flash-exp',
  tokensEstimated?: number
): Promise<string | null> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase.rpc('upsert_generated_prompt', {
      p_tenant_id: tenantId,
      p_channel: channel,
      p_generated_prompt: generatedPrompt,
      p_system_prompt: systemPrompt,
      p_source_data_hash: sourceDataHash,
      p_generator_model: generatorModel,
      p_tokens_estimated: tokensEstimated || null,
      p_generation_config: {},
    });

    if (error) {
      console.error('[PromptCache] Error saving cached prompt:', error);
      return null;
    }

    console.log(`[PromptCache] Saved prompt for tenant ${tenantId}, channel ${channel}`);
    return data;
  } catch (error) {
    console.error('[PromptCache] Exception saving cached prompt:', error);
    return null;
  }
}

/**
 * Genera y cachea un prompt para un canal específico
 * Esta es la función principal que se llama cuando el usuario guarda cambios en Business IA
 */
export async function generateAndCachePrompt(
  tenantId: string,
  channel: CacheChannel
): Promise<PromptGenerationResult> {
  console.log(`[PromptCache] Generating and caching prompt for tenant ${tenantId}, channel ${channel}`);

  // 1. Determinar el tipo de prompt basado en el canal
  const promptType: PromptType = channel === 'voice' ? 'voice' : 'messaging';

  // 2. Recopilar contexto del negocio
  const context = await collectBusinessContext(tenantId, promptType);

  if (!context) {
    return {
      success: false,
      prompt: '',
      error: 'No se pudo obtener el contexto del negocio',
      generatedAt: new Date().toISOString(),
      model: 'none',
      processingTimeMs: 0,
    };
  }

  // 3. Calcular hash de los datos actuales
  const sourceDataHash = calculateBusinessContextHash(context);

  // 4. Verificar si ya existe un prompt con el mismo hash (sin cambios)
  const existingPrompt = await getCachedPrompt(tenantId, channel);
  if (existingPrompt.found && existingPrompt.source_data_hash === sourceDataHash) {
    console.log(`[PromptCache] Prompt already up-to-date for channel ${channel}`);
    return {
      success: true,
      prompt: existingPrompt.generated_prompt || '',
      generatedAt: existingPrompt.last_updated || new Date().toISOString(),
      model: 'cached',
      processingTimeMs: 0,
    };
  }

  // 5. Generar nuevo prompt con Gemini
  const result = await generatePromptWithAI(context, promptType);

  if (!result.success) {
    return result;
  }

  // 6. Guardar en caché
  const promptId = await saveCachedPrompt(
    tenantId,
    channel,
    result.prompt,
    result.prompt, // El system_prompt es el mismo que el generated_prompt por ahora
    sourceDataHash,
    result.model,
    Math.ceil(result.prompt.length / 4) // Estimación aproximada de tokens
  );

  if (!promptId) {
    console.warn('[PromptCache] Could not save to cache, but prompt was generated');
  }

  console.log(`[PromptCache] Successfully generated and cached prompt for channel ${channel}`);
  return result;
}

/**
 * Genera y cachea prompts para TODOS los canales de un tipo
 * Por ejemplo, si promptType = 'messaging', genera para whatsapp, instagram, etc.
 */
export async function generateAndCacheAllPrompts(
  tenantId: string,
  promptType: PromptType
): Promise<{ success: boolean; channels: Record<CacheChannel, boolean>; errors: string[] }> {
  const channels = PROMPT_TYPE_TO_CHANNELS[promptType];
  const results: Record<CacheChannel, boolean> = {} as Record<CacheChannel, boolean>;
  const errors: string[] = [];

  console.log(`[PromptCache] Generating prompts for ${promptType} channels:`, channels);

  for (const channel of channels) {
    try {
      const result = await generateAndCachePrompt(tenantId, channel);
      results[channel] = result.success;
      if (!result.success && result.error) {
        errors.push(`${channel}: ${result.error}`);
      }
    } catch (error) {
      results[channel] = false;
      errors.push(`${channel}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const allSuccess = Object.values(results).every(v => v);
  return { success: allSuccess, channels: results, errors };
}

/**
 * Obtiene el prompt optimizado para usar en runtime
 * Si existe en caché y está actualizado, lo usa. Si no, regenera.
 *
 * Esta es la función que los servicios LangGraph y Voice deben llamar
 * en cada mensaje/llamada en vez de generar el prompt desde cero.
 */
export async function getOptimizedPrompt(
  tenantId: string,
  channel: CacheChannel
): Promise<{ prompt: string; fromCache: boolean; version?: number }> {
  // 1. Intentar obtener del caché
  const cached = await getCachedPrompt(tenantId, channel);

  if (cached.found && cached.generated_prompt) {
    // Verificar si necesita regeneración (datos cambiaron)
    const needsRegen = await checkNeedsRegeneration(tenantId, channel);

    if (!needsRegen) {
      console.log(`[PromptCache] Using cached prompt v${cached.prompt_version} for ${channel}`);
      return {
        prompt: cached.generated_prompt,
        fromCache: true,
        version: cached.prompt_version,
      };
    }

    console.log(`[PromptCache] Cached prompt outdated, regenerating for ${channel}`);
  }

  // 2. No hay caché válido, generar nuevo prompt
  console.log(`[PromptCache] Generating fresh prompt for ${channel}`);
  const result = await generateAndCachePrompt(tenantId, channel);

  if (result.success) {
    return {
      prompt: result.prompt,
      fromCache: false,
    };
  }

  // 3. Si falló la generación pero hay caché antiguo, usarlo como fallback
  if (cached.found && cached.generated_prompt) {
    console.warn(`[PromptCache] Using stale cache as fallback for ${channel}`);
    return {
      prompt: cached.generated_prompt,
      fromCache: true,
      version: cached.prompt_version,
    };
  }

  // 4. No hay caché ni se pudo generar, retornar prompt vacío
  console.error(`[PromptCache] No prompt available for ${channel}`);
  return {
    prompt: '',
    fromCache: false,
  };
}

/**
 * Invalida el caché de prompts para un tenant (fuerza regeneración)
 * Útil cuando se hacen cambios masivos o hay errores
 */
export async function invalidatePromptCache(
  tenantId: string,
  channel?: CacheChannel
): Promise<boolean> {
  const supabase = createServerClient();

  try {
    let query = supabase
      .from('ai_generated_prompts')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { error } = await query;

    if (error) {
      console.error('[PromptCache] Error invalidating cache:', error);
      return false;
    }

    console.log(`[PromptCache] Cache invalidated for tenant ${tenantId}${channel ? `, channel ${channel}` : ''}`);
    return true;
  } catch (error) {
    console.error('[PromptCache] Exception invalidating cache:', error);
    return false;
  }
}

// ======================
// EXPORTS
// ======================

export const PromptGeneratorService = {
  // Funciones originales
  collectBusinessContext,
  generatePromptWithAI,
  generateVoiceAgentPrompt,
  generateMessagingAgentPrompt,

  // Funciones de caché
  getCachedPrompt,
  checkNeedsRegeneration,
  saveCachedPrompt,
  generateAndCachePrompt,
  generateAndCacheAllPrompts,
  getOptimizedPrompt,
  invalidatePromptCache,
  calculateBusinessContextHash,
};
