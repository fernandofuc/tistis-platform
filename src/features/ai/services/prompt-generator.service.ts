// =====================================================
// TIS TIS PLATFORM - AI Prompt Generator Service
// Genera prompts profesionales usando Gemini 3.0
// =====================================================
// Este servicio utiliza Gemini 3.0 para generar prompts
// de alta calidad para los agentes de voz y mensajería.
// El razonamiento avanzado de Gemini 3.0 permite crear
// prompts personalizados y naturales para cada negocio.
// =====================================================

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  generateWithGemini,
  DEFAULT_GEMINI_MODELS,
  isGeminiConfigured,
} from '@/src/shared/lib/gemini';

// ======================
// TYPES
// ======================

export type PromptType = 'voice' | 'messaging';

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
 * Recopila todo el contexto del negocio para generar un prompt
 */
export async function collectBusinessContext(
  tenantId: string,
  promptType: PromptType
): Promise<BusinessContext | null> {
  const supabase = createServerClient();

  try {
    // 1. Obtener información del tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, vertical')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[PromptGenerator] Tenant not found:', tenantId);
      return null;
    }

    // 2. Obtener configuración específica según el tipo
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
    } else {
      const { data: aiConfig } = await supabase
        .from('ai_tenant_config')
        .select('ai_personality, custom_instructions')
        .eq('tenant_id', tenantId)
        .single();

      if (aiConfig) {
        assistantPersonality = aiConfig.ai_personality || assistantPersonality;
        customInstructions = aiConfig.custom_instructions || '';
      }
    }

    // 3. Obtener sucursales
    const { data: branchesData } = await supabase
      .from('branches')
      .select('name, address, city, phone, operating_hours, is_headquarters')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_headquarters', { ascending: false })
      .limit(10);

    const branches = (branchesData || []).map(b => ({
      name: b.name,
      address: b.address,
      city: b.city,
      phone: b.phone,
      operatingHours: b.operating_hours,
      isHeadquarters: b.is_headquarters,
    }));

    // 4. Obtener servicios
    const { data: servicesData } = await supabase
      .from('services')
      .select('name, description, short_description, ai_description, price_min, price_max, price_note, duration_minutes, category, special_instructions, requires_consultation, promotion_active, promotion_text')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(50);

    const services = (servicesData || []).map(s => ({
      name: s.name,
      description: s.ai_description || s.short_description || s.description,
      priceMin: s.price_min,
      priceMax: s.price_max,
      priceNote: s.price_note,
      durationMinutes: s.duration_minutes,
      category: s.category,
      specialInstructions: s.special_instructions,
      requiresConsultation: s.requires_consultation,
      promotionActive: s.promotion_active,
      promotionText: s.promotion_text,
    }));

    // 5. Obtener staff (solo roles relevantes)
    const { data: staffData } = await supabase
      .from('staff')
      .select('first_name, last_name, display_name, role, specialty')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('role', ['dentist', 'specialist', 'owner', 'manager', 'doctor'])
      .limit(20);

    const staff = (staffData || [])
      .filter(s => s.first_name || s.last_name || s.display_name)
      .map(s => ({
        name: s.display_name || `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        role: s.role,
        specialty: s.specialty,
      }));

    // 6. Obtener FAQs
    const { data: faqsData } = await supabase
      .from('faqs')
      .select('question, answer')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(20);

    const faqs = (faqsData || []).map(f => ({
      question: f.question,
      answer: f.answer,
    }));

    // 7. Obtener Knowledge Base (instrucciones personalizadas)
    const { data: instructionsData } = await supabase
      .from('ai_custom_instructions')
      .select('instruction_type, title, instruction')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(30);

    const customInstructionsList = (instructionsData || []).map(i => ({
      type: i.instruction_type,
      title: i.title,
      instruction: i.instruction,
    }));

    // 8. Obtener políticas del negocio
    const { data: policiesData } = await supabase
      .from('ai_business_policies')
      .select('policy_type, title, policy_text')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(20);

    const businessPolicies = (policiesData || []).map(p => ({
      type: p.policy_type,
      title: p.title,
      policy: p.policy_text,
    }));

    // 9. Obtener artículos de conocimiento (Knowledge Base)
    const { data: articlesData } = await supabase
      .from('ai_knowledge_articles')
      .select('category, title, content, tags')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category')
      .order('display_order', { ascending: true })
      .limit(50);

    const knowledgeArticles = (articlesData || []).map(a => ({
      category: a.category,
      title: a.title,
      content: a.content,
      tags: a.tags,
    }));

    // 10. Obtener templates de respuesta
    const { data: templatesData } = await supabase
      .from('ai_response_templates')
      .select('trigger_type, name, template, variables')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('trigger_type')
      .limit(30);

    const responseTemplates = (templatesData || []).map(t => ({
      triggerType: t.trigger_type,
      name: t.name,
      template: t.template,
      variables: t.variables,
    }));

    // 11. Obtener manejo de competidores
    const { data: competitorsData } = await supabase
      .from('ai_competitor_handling')
      .select('competitor_name, response_strategy, key_differentiators')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(20);

    const competitorHandling = (competitorsData || []).map(c => ({
      competitorName: c.competitor_name,
      responseStrategy: c.response_strategy,
      keyDifferentiators: c.key_differentiators,
    }));

    return {
      tenantId,
      tenantName: tenant.name,
      vertical: tenant.vertical || 'general',
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
// EXPORTS
// ======================

export const PromptGeneratorService = {
  collectBusinessContext,
  generatePromptWithAI,
  generateVoiceAgentPrompt,
  generateMessagingAgentPrompt,
};
