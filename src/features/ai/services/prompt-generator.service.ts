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
import {
  validateGeneratedPrompt,
  formatValidationReport,
  generateCorrectionInstructions,
  isAutoCorrectible,
  getMaxCorrectionAttempts,
  type ValidationResult,
} from './prompt-validator.service';
import {
  SafetyResilienceService,
} from './safety-resilience.service';
import {
  getFullCompiledInstructions,
  mapTemplateKeyToType,
  isValidStyle,
  type ChannelContext,
  type ResponseStyleKey,
  type AssistantTypeKey,
} from '@/src/shared/config/prompt-instruction-compiler';
import {
  truncateKBToTokenBudget,
  getTokenBudgetSummary,
  type KBContent,
} from '@/src/shared/config/token-budget.service';

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
  // Template del agente (determina tipo de asistente)
  template_key?: string;
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
  // Voice-specific config
  useFillerPhrases?: boolean;
  fillerPhrases?: string[];
}

export interface PromptGenerationResult {
  success: boolean;
  prompt: string;
  error?: string;
  generatedAt: string;
  model: string;
  processingTimeMs: number;
  validation?: ValidationResult;  // Resultado de validación post-generación
  validationReport?: string;      // Reporte legible de validación
  correctionAttempts?: number;    // FASE 4: Número de intentos de auto-corrección
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
    let useFillerPhrases = true;  // Default: activado
    let fillerPhrases: string[] = [];

    if (promptType === 'voice') {
      const { data: voiceConfig } = await supabase
        .from('voice_agent_config')
        .select('assistant_name, assistant_personality, custom_instructions, escalation_enabled, escalation_phone, goodbye_message, use_filler_phrases, filler_phrases')
        .eq('tenant_id', tenantId)
        .single();

      if (voiceConfig) {
        assistantName = voiceConfig.assistant_name || assistantName;
        assistantPersonality = voiceConfig.assistant_personality || assistantPersonality;
        customInstructions = voiceConfig.custom_instructions || '';
        escalationEnabled = voiceConfig.escalation_enabled || false;
        escalationPhone = voiceConfig.escalation_phone || '';
        goodbyeMessage = voiceConfig.goodbye_message || '';
        useFillerPhrases = voiceConfig.use_filler_phrases ?? true;  // Default true si no existe
        fillerPhrases = voiceConfig.filler_phrases || [];
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
      useFillerPhrases,
      fillerPhrases,
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

    // 2. Obtener el Agent Profile activo para business (configuración del agente)
    const { data: agentProfile } = await supabase
      .from('agent_profiles')
      .select('agent_template, response_style')
      .eq('tenant_id', tenantId)
      .eq('profile_type', 'business')
      .eq('is_active', true)
      .single();

    // 3. Obtener configuración específica según el tipo de prompt
    let assistantName = 'Asistente';
    // Priorizar Agent Profile > ai_config para response_style
    let assistantPersonality = agentProfile?.response_style || rpcData.ai_config?.response_style || 'professional_friendly';
    let customInstructions = rpcData.ai_config?.system_prompt || '';
    let escalationEnabled = false;
    let escalationPhone = '';
    let goodbyeMessage = '';
    let useFillerPhrases = true;  // Default: activado
    let fillerPhrases: string[] = [];
    // Template del agente desde Agent Profile
    let agentTemplateKey = agentProfile?.agent_template || undefined;

    if (promptType === 'voice') {
      // Para voice, obtener config específica de voice_agent_config
      const { data: voiceConfig } = await supabase
        .from('voice_agent_config')
        .select('assistant_name, assistant_personality, custom_instructions, escalation_enabled, escalation_phone, goodbye_message, use_filler_phrases, filler_phrases')
        .eq('tenant_id', tenantId)
        .single();

      if (voiceConfig) {
        assistantName = voiceConfig.assistant_name || assistantName;
        assistantPersonality = voiceConfig.assistant_personality || assistantPersonality;
        customInstructions = voiceConfig.custom_instructions || customInstructions;
        escalationEnabled = voiceConfig.escalation_enabled || false;
        escalationPhone = voiceConfig.escalation_phone || '';
        goodbyeMessage = voiceConfig.goodbye_message || '';
        useFillerPhrases = voiceConfig.use_filler_phrases ?? true;  // Default true si no existe
        fillerPhrases = voiceConfig.filler_phrases || [];
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
      // Priorizar Agent Profile > ai_config para template_key
      template_key: agentTemplateKey || rpcData.ai_config?.agent_template || undefined,
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
      useFillerPhrases,
      fillerPhrases,
    };

  } catch (error) {
    console.error('[PromptGenerator] Error collecting context:', error);
    return null;
  }
}

// ======================
// RETRY & RESILIENCE UTILITIES (FIX B.1)
// ======================

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,  // 1 segundo
  maxDelayMs: 10000,     // 10 segundos máximo
  backoffMultiplier: 2,  // Duplicar delay cada intento
};

/**
 * Ejecuta una función con retry exponencial
 */
async function withExponentialRetry<T>(
  operation: () => Promise<T>,
  isSuccess: (result: T) => boolean,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ result: T; attempts: number; totalWaitMs: number }> {
  // P1-C4 FIX: Inicialización explícita para evitar undefined behavior
  let lastResult: T | undefined = undefined;
  let lastError: Error | undefined = undefined;
  let attempt = 0;
  let totalWaitMs = 0;

  while (attempt < config.maxAttempts) {
    attempt++;

    try {
      lastResult = await operation();
      lastError = undefined; // Limpiar error si operación exitosa

      if (isSuccess(lastResult)) {
        console.log(`[Retry] ${operationName} succeeded on attempt ${attempt}`);
        return { result: lastResult, attempts: attempt, totalWaitMs };
      }

      console.warn(`[Retry] ${operationName} failed on attempt ${attempt}/${config.maxAttempts}`);
    } catch (error) {
      console.error(`[Retry] ${operationName} threw exception on attempt ${attempt}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Si es el último intento, propagar la excepción
      if (attempt >= config.maxAttempts) {
        throw lastError;
      }
    }

    // Si no es el último intento, esperar con backoff exponencial
    if (attempt < config.maxAttempts) {
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      );

      console.log(`[Retry] Waiting ${delay}ms before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      totalWaitMs += delay;
    }
  }

  // P1-C4 FIX: Manejo explícito si lastResult aún es undefined
  if (lastResult === undefined) {
    throw lastError || new Error(`${operationName} failed after ${attempt} attempts without result`);
  }

  // Retornar el último resultado (fallido pero existente)
  return { result: lastResult, attempts: attempt, totalWaitMs };
}

// ======================
// FASE 6: SENSITIVE DATA SANITIZATION
// ======================

/**
 * Patrones de datos sensibles que deben sanitizarse antes de enviar a Gemini
 */
const SENSITIVE_PATTERNS = {
  // Tarjetas de crédito/débito (16 dígitos con o sin espacios/guiones)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  // CVV (3-4 dígitos después de palabra clave)
  cvv: /\b(?:cvv|cvc|cv2|security code)[:\s]*\d{3,4}\b/gi,
  // Contraseñas (después de palabras clave)
  password: /\b(?:password|contraseña|clave|pwd)[:\s=]*['"]?[\w!@#$%^&*]{4,}['"]?\b/gi,
  // Tokens/API Keys (formatos comunes)
  apiKey: /\b(?:api[_-]?key|token|secret|bearer)[:\s=]*['"]?[a-zA-Z0-9_-]{20,}['"]?\b/gi,
  // SSN americano (XXX-XX-XXXX con guiones obligatorios o palabra clave)
  // P2 FIX: Más específico para evitar falsos positivos con fechas
  ssn: /\b(?:ssn|social security|seguro social)[:\s]*\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
  // CURP mexicana (18 caracteres con formato específico)
  curp: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi,
  // RFC mexicano (12-13 caracteres con formato específico)
  rfc: /\b[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}\b/gi,
  // Correos electrónicos privados (solo sanitizar en contextos específicos)
  privateEmail: /\b[a-zA-Z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|icloud)\.[a-zA-Z]{2,}\b/gi,
  // IPs privadas
  privateIp: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
  // CLABE mexicana (18 dígitos con palabra clave para evitar falsos positivos)
  // P3 FIX: Solo matchea si tiene contexto de cuenta bancaria
  clabe: /\b(?:clabe|cuenta|transferencia)[:\s]*\d{18}\b/gi,
};

/**
 * Reemplazos seguros para cada tipo de dato sensible
 */
const SANITIZATION_REPLACEMENTS: Record<keyof typeof SENSITIVE_PATTERNS, string> = {
  creditCard: '[TARJETA_REDACTADA]',
  cvv: '[CVV_REDACTADO]',
  password: '[CONTRASEÑA_REDACTADA]',
  apiKey: '[TOKEN_REDACTADO]',
  ssn: '[SSN_REDACTADO]',
  curp: '[CURP_REDACTADA]',
  rfc: '[RFC_REDACTADO]',
  privateEmail: '[EMAIL_PERSONAL_REDACTADO]',
  privateIp: '[IP_PRIVADA_REDACTADA]',
  clabe: '[CLABE_REDACTADA]',
};

/**
 * Sanitiza datos sensibles de un texto antes de enviarlo a Gemini
 * @param text - Texto a sanitizar
 * @param options - Opciones de sanitización
 * @returns Texto sanitizado y conteo de redacciones
 */
export function sanitizeSensitiveData(
  text: string | null | undefined,
  options: {
    sanitizeEmails?: boolean;  // Por defecto false (emails de negocio son útiles)
    logRedactions?: boolean;   // Por defecto true en desarrollo
  } = {}
): { sanitized: string; redactionCount: number; redactedTypes: string[] } {
  // P4 FIX: Manejo de null/undefined
  if (!text || typeof text !== 'string') {
    return { sanitized: '', redactionCount: 0, redactedTypes: [] };
  }

  const {
    sanitizeEmails = false,
    logRedactions = process.env.NODE_ENV === 'development',
  } = options;

  let sanitized = text;
  let redactionCount = 0;
  const redactedTypes: string[] = [];

  // Aplicar cada patrón de sanitización
  for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    // Saltar emails si no se solicita
    if (patternName === 'privateEmail' && !sanitizeEmails) continue;

    const replacement = SANITIZATION_REPLACEMENTS[patternName as keyof typeof SENSITIVE_PATTERNS];
    const matches = sanitized.match(pattern);

    if (matches && matches.length > 0) {
      sanitized = sanitized.replace(pattern, replacement);
      redactionCount += matches.length;
      redactedTypes.push(patternName);

      if (logRedactions) {
        console.log(`[Sanitizer] Redacted ${matches.length} ${patternName} instance(s)`);
      }
    }
  }

  return { sanitized, redactionCount, redactedTypes };
}

/**
 * Sanitiza un objeto BusinessContext completo
 * Aplica sanitización a todos los campos de texto
 */
export function sanitizeBusinessContext(
  context: BusinessContext
): { sanitizedContext: BusinessContext; totalRedactions: number } {
  let totalRedactions = 0;

  // Crear copia profunda para no mutar el original
  const sanitizedContext: BusinessContext = JSON.parse(JSON.stringify(context));

  // Sanitizar campos de texto principales
  if (sanitizedContext.customInstructions) {
    const { sanitized, redactionCount } = sanitizeSensitiveData(sanitizedContext.customInstructions);
    sanitizedContext.customInstructions = sanitized;
    totalRedactions += redactionCount;
  }

  if (sanitizedContext.goodbyeMessage) {
    const { sanitized, redactionCount } = sanitizeSensitiveData(sanitizedContext.goodbyeMessage);
    sanitizedContext.goodbyeMessage = sanitized;
    totalRedactions += redactionCount;
  }

  // Sanitizar arrays de strings
  if (sanitizedContext.fillerPhrases) {
    sanitizedContext.fillerPhrases = sanitizedContext.fillerPhrases.map(phrase => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(phrase);
      totalRedactions += redactionCount;
      return sanitized;
    });
  }

  // Sanitizar FAQs
  if (sanitizedContext.faqs) {
    sanitizedContext.faqs = sanitizedContext.faqs.map(faq => {
      const { sanitized: sanitizedQ, redactionCount: countQ } = sanitizeSensitiveData(faq.question);
      const { sanitized: sanitizedA, redactionCount: countA } = sanitizeSensitiveData(faq.answer);
      totalRedactions += countQ + countA;
      return { ...faq, question: sanitizedQ, answer: sanitizedA };
    });
  }

  // Sanitizar specialInstructions por servicio
  if (sanitizedContext.services) {
    sanitizedContext.services = sanitizedContext.services.map(service => {
      if (service.specialInstructions) {
        const { sanitized, redactionCount } = sanitizeSensitiveData(service.specialInstructions);
        totalRedactions += redactionCount;
        return { ...service, specialInstructions: sanitized };
      }
      return service;
    });
  }

  // Sanitizar responseTemplates (es un array de objetos)
  if (sanitizedContext.responseTemplates) {
    sanitizedContext.responseTemplates = sanitizedContext.responseTemplates.map(template => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(template.template);
      totalRedactions += redactionCount;
      return { ...template, template: sanitized };
    });
  }

  // Sanitizar competitorHandling (es un array de objetos)
  if (sanitizedContext.competitorHandling) {
    sanitizedContext.competitorHandling = sanitizedContext.competitorHandling.map(comp => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(comp.responseStrategy);
      totalRedactions += redactionCount;
      return { ...comp, responseStrategy: sanitized };
    });
  }

  // Sanitizar customInstructionsList
  if (sanitizedContext.customInstructionsList) {
    sanitizedContext.customInstructionsList = sanitizedContext.customInstructionsList.map(item => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(item.instruction);
      totalRedactions += redactionCount;
      return { ...item, instruction: sanitized };
    });
  }

  // Sanitizar businessPolicies
  if (sanitizedContext.businessPolicies) {
    sanitizedContext.businessPolicies = sanitizedContext.businessPolicies.map(policy => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(policy.policy);
      totalRedactions += redactionCount;
      return { ...policy, policy: sanitized };
    });
  }

  // Sanitizar knowledgeArticles
  if (sanitizedContext.knowledgeArticles) {
    sanitizedContext.knowledgeArticles = sanitizedContext.knowledgeArticles.map(article => {
      const { sanitized, redactionCount } = sanitizeSensitiveData(article.content);
      totalRedactions += redactionCount;
      return { ...article, content: sanitized };
    });
  }

  if (totalRedactions > 0) {
    console.log(`[Sanitizer] Total redactions in context: ${totalRedactions}`);
  }

  return { sanitizedContext, totalRedactions };
}

// ======================
// PROMPT GENERATION
// ======================

/**
 * Genera un prompt profesional usando Gemini 3.0
 *
 * P34 FIX: Circuit breaker para proteger contra fallos de Gemini API
 */
export async function generatePromptWithAI(
  context: BusinessContext,
  promptType: PromptType
): Promise<PromptGenerationResult> {
  const CIRCUIT_NAME = 'gemini-prompt-generation';

  // P34 FIX: Check circuit breaker before attempting API call
  if (SafetyResilienceService.isCircuitOpen(CIRCUIT_NAME)) {
    console.warn(`[PromptGenerator] Circuit breaker OPEN for ${CIRCUIT_NAME}. Skipping API call.`);
    return {
      success: false,
      prompt: '',
      error: 'Servicio de generación temporalmente no disponible. El sistema reintentará automáticamente en unos minutos.',
      generatedAt: new Date().toISOString(),
      model: 'circuit-breaker-open',
      processingTimeMs: 0,
    };
  }

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

  // FASE 6: Sanitizar datos sensibles antes de enviar a Gemini
  const { sanitizedContext, totalRedactions } = sanitizeBusinessContext(context);
  if (totalRedactions > 0) {
    console.log(`[PromptGenerator] Sanitized ${totalRedactions} sensitive data items before Gemini call`);
  }

  // Construir el meta-prompt para Gemini 3.0 (usando contexto sanitizado)
  const metaPrompt = buildMetaPrompt(sanitizedContext, promptType, verticalConfig, currentDate);

  // Generar con Gemini 3.0 usando retry exponencial (FASE 3 - B.1)
  const startTime = Date.now();
  let result: Awaited<ReturnType<typeof generateWithGemini>>;
  let retryAttempts = 0;
  let totalRetryWaitMs = 0;

  try {
    // Envolver la llamada a Gemini con retry exponencial
    const retryResult = await withExponentialRetry(
      async () => {
        try {
          return await generateWithGemini(metaPrompt, {
            model: DEFAULT_GEMINI_MODELS.PROMPT_GENERATION,
            temperature: 0.7,
            maxOutputTokens: 8192,
          });
        } catch (error) {
          // Convertir excepciones en resultado de error para el retry
          console.warn(`[PromptGenerator] Gemini API exception on attempt:`, error);
          return {
            success: false as const,
            content: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            model: 'error',
            processingTimeMs: 0,
          };
        }
      },
      // Criterio de éxito: result.success === true Y content no vacío
      (res) => res.success && res.content.trim().length > 100,
      'generatePromptWithAI',
      {
        maxAttempts: 3,
        initialDelayMs: 1500,
        maxDelayMs: 8000,
        backoffMultiplier: 2,
      }
    );

    result = retryResult.result;
    retryAttempts = retryResult.attempts;
    totalRetryWaitMs = retryResult.totalWaitMs;

    // Log de métricas de retry
    if (retryAttempts > 1) {
      console.log(`[PromptGenerator] Gemini succeeded after ${retryAttempts} attempts (total wait: ${totalRetryWaitMs}ms)`);
    }

  } catch (error) {
    // P34 FIX: Record failure in circuit breaker
    SafetyResilienceService.recordCircuitFailure(CIRCUIT_NAME);
    console.error(`[PromptGenerator] Gemini API exhausted all retries (circuit breaker notified):`, error);
    return {
      success: false,
      prompt: '',
      error: `Error de conexión con Gemini después de múltiples intentos: ${error instanceof Error ? error.message : 'Unknown'}`,
      generatedAt: new Date().toISOString(),
      model: 'error',
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Verificar si después de los reintentos aún falló
  if (!result.success) {
    // P34 FIX: Record failure in circuit breaker
    SafetyResilienceService.recordCircuitFailure(CIRCUIT_NAME);
    console.warn(`[PromptGenerator] Gemini API failed after ${retryAttempts} attempts:`, result.error);
    return {
      success: false,
      prompt: '',
      error: `${result.error} (después de ${retryAttempts} intentos)`,
      generatedAt: new Date().toISOString(),
      model: result.model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Verificar contenido mínimo
  if (!result.content || result.content.trim().length < 100) {
    SafetyResilienceService.recordCircuitFailure(CIRCUIT_NAME);
    console.warn(`[PromptGenerator] Gemini returned empty/short content after ${retryAttempts} attempts`);
    return {
      success: false,
      prompt: '',
      error: `Gemini generó contenido insuficiente (${result.content?.length || 0} chars) después de ${retryAttempts} intentos`,
      generatedAt: new Date().toISOString(),
      model: result.model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // P34 FIX: Record success in circuit breaker (resets failure count)
  SafetyResilienceService.recordCircuitSuccess(CIRCUIT_NAME);

  // Limpiar el prompt generado (quitar markdown code blocks si existen)
  let cleanedPrompt = result.content;
  cleanedPrompt = cleanedPrompt.replace(/^```[\w]*\n?/gm, '');
  cleanedPrompt = cleanedPrompt.replace(/\n?```$/gm, '');
  cleanedPrompt = cleanedPrompt.trim();

  // 🔍 VALIDACIÓN POST-GENERACIÓN (CRÍTICO)
  // P9 FIX: Usar sanitizedContext para consistencia con el prompt generado
  let validationResult = validateGeneratedPrompt(
    cleanedPrompt,
    promptType,
    sanitizedContext.assistantPersonality || 'professional_friendly',
    {
      tenantName: sanitizedContext.tenantName,
      services: sanitizedContext.services.map(s => s.name),
      branches: sanitizedContext.branches.map(b => b.name),
      useFillerPhrases: sanitizedContext.useFillerPhrases,
      customFillerPhrases: sanitizedContext.fillerPhrases,
    }
  );

  // Log validación para debugging
  console.log(`[PromptGenerator] Validation for ${promptType}:`, {
    score: validationResult.score,
    valid: validationResult.valid,
    errors: validationResult.errors.length,
    warnings: validationResult.warnings.length,
  });

  // ========================================
  // FASE 4: AUTO-CORRECCIÓN DE PROMPTS
  // ========================================
  // Si la validación falla pero es corregible, intentar corregir automáticamente
  let correctionAttempts = 0;
  const maxCorrectionAttempts = validationResult.valid ? 0 : getMaxCorrectionAttempts(validationResult);

  while (
    !validationResult.valid &&
    isAutoCorrectible(validationResult) &&
    correctionAttempts < maxCorrectionAttempts
  ) {
    correctionAttempts++;
    console.log(`[PromptGenerator] Auto-correction attempt ${correctionAttempts}/${maxCorrectionAttempts}`);

    // Generar instrucciones de corrección
    const correctionInstructions = generateCorrectionInstructions(
      validationResult,
      promptType,
      cleanedPrompt
    );

    // Construir prompt de corrección
    const correctionMetaPrompt = `${metaPrompt}

---

## PROMPT GENERADO ANTERIORMENTE (CON ERRORES):

${cleanedPrompt}

---

${correctionInstructions}

---

## INSTRUCCIÓN FINAL:
Genera una versión CORREGIDA del prompt anterior, arreglando TODOS los errores mencionados.
Devuelve SOLO el prompt corregido, sin explicaciones adicionales.`;

    try {
      const correctionResult = await generateWithGemini(correctionMetaPrompt, {
        model: DEFAULT_GEMINI_MODELS.PROMPT_GENERATION,
        temperature: 0.5, // Menor temperatura para correcciones más precisas
        maxOutputTokens: 8192,
      });

      if (correctionResult.success && correctionResult.content) {
        // Limpiar el prompt corregido
        let correctedPrompt = correctionResult.content;
        correctedPrompt = correctedPrompt.replace(/^```[\w]*\n?/gm, '');
        correctedPrompt = correctedPrompt.replace(/\n?```$/gm, '');
        correctedPrompt = correctedPrompt.trim();

        // Re-validar (P6 FIX: usar sanitizedContext para consistencia)
        const newValidation = validateGeneratedPrompt(
          correctedPrompt,
          promptType,
          sanitizedContext.assistantPersonality || 'professional_friendly',
          {
            tenantName: sanitizedContext.tenantName,
            services: sanitizedContext.services.map(s => s.name),
            branches: sanitizedContext.branches.map(b => b.name),
            useFillerPhrases: sanitizedContext.useFillerPhrases,
            customFillerPhrases: sanitizedContext.fillerPhrases,
          }
        );

        console.log(`[PromptGenerator] Correction attempt ${correctionAttempts} result:`, {
          oldScore: validationResult.score,
          newScore: newValidation.score,
          improved: newValidation.score > validationResult.score,
          nowValid: newValidation.valid,
        });

        // Solo aceptar si mejoró
        if (newValidation.score > validationResult.score) {
          cleanedPrompt = correctedPrompt;
          validationResult = newValidation;
        } else {
          console.warn(`[PromptGenerator] Correction did not improve score, keeping original`);
          break;
        }
      }
    } catch (correctionError) {
      console.error(`[PromptGenerator] Auto-correction failed:`, correctionError);
      break;
    }
  }

  // Generar reporte final
  const validationReport = formatValidationReport(validationResult);

  // Si después de correcciones aún hay errores críticos, logear
  if (!validationResult.valid) {
    console.error(`[PromptGenerator] VALIDATION FAILED (after ${correctionAttempts} corrections):\n${validationReport}`);
  } else if (correctionAttempts > 0) {
    console.log(`[PromptGenerator] Prompt auto-corrected successfully after ${correctionAttempts} attempt(s)`);
  }

  return {
    success: true,
    prompt: cleanedPrompt,
    generatedAt: new Date().toISOString(),
    model: result.model,
    processingTimeMs: Date.now() - startTime,
    validation: validationResult,
    validationReport,
    correctionAttempts, // FASE 4: Incluir intentos de corrección en el resultado
  };
}

/**
 * Construye la sección de instrucciones compiladas de estilo y tipo
 * para incluir en el meta-prompt
 *
 * INCLUYE: Instrucciones específicas de VERTICAL (dental vs restaurant vs general)
 */
function buildCompiledInstructionsSection(
  context: BusinessContext,
  promptType: PromptType
): string {
  // Determinar el canal para las instrucciones compiladas
  const channel: ChannelContext = promptType === 'voice' ? 'voice' : 'messaging';

  // Obtener el template key o usar default basado en vertical
  const templateKey = context.template_key ||
    (context.vertical === 'dental' ? 'dental_full' :
     context.vertical === 'restaurant' ? 'resto_full' : 'general_full');

  // Obtener el estilo de respuesta y validarlo
  const styleKey = context.assistantPersonality || 'professional_friendly';

  // Validar estilo
  if (!isValidStyle(styleKey)) {
    console.error(`[PromptGenerator] Invalid style key: ${styleKey}, using professional_friendly`);
  }

  // Mapear template a tipo de asistente
  const assistantType: AssistantTypeKey = mapTemplateKeyToType(templateKey);

  // Determinar vertical normalizada
  const vertical: 'dental' | 'restaurant' | 'general' =
    context.vertical === 'dental' ? 'dental' :
    context.vertical === 'restaurant' ? 'restaurant' : 'general';

  // Usar la versión COMPLETA que incluye instrucciones de vertical
  const validStyleKey: ResponseStyleKey = isValidStyle(styleKey)
    ? styleKey as ResponseStyleKey
    : 'professional_friendly';

  const compiledInstructions = getFullCompiledInstructions(
    validStyleKey,
    assistantType,
    channel,
    vertical
  );

  if (!compiledInstructions) {
    // Fallback: instrucciones básicas si no se pueden compilar
    console.warn(`[PromptGenerator] Could not compile instructions for ${styleKey}/${templateKey}/${channel}/${vertical}`);
    return `
   ### CANAL: ${channel === 'voice' ? 'VOZ (LLAMADAS TELEFÓNICAS)' : 'MENSAJERÍA (TEXTO ESCRITO)'}

   **Personalidad configurada:** ${styleKey}
   **Vertical del negocio:** ${vertical}

   - Mantén un tono ${styleKey === 'casual' ? 'informal y cercano' : styleKey === 'formal' ? 'muy formal y respetuoso' : 'profesional pero cálido'}
   ${channel === 'voice' ? '- Usa muletillas conversacionales naturales para que suene humano' : '- NO uses muletillas de voz (es texto escrito)'}
   ${channel === 'voice' ? '- Las respuestas deben ser CONCISAS (2-3 oraciones por turno)' : '- Las respuestas pueden ser más detalladas (es texto, pueden releerlo)'}
   ${channel === 'voice' ? '- NUNCA uses emojis (es una llamada de voz)' : '- Solo usa emojis funcionales: ✅ ❌ 📍 📞 ⏰ 📅'}
   `;
  }

  // Descripción del tipo de asistente
  const typeDescription = assistantType === 'appointments_only'
    ? 'Este asistente está configurado para SOLO AGENDAR CITAS. Redirige todas las demás consultas hacia la cita.'
    : assistantType === 'personal_redirect'
    ? 'Este asistente es para PERFIL PERSONAL - SOLO DERIVACIÓN. NO responde consultas, SOLO redirige al negocio oficial.'
    : assistantType === 'personal_brand'
    ? 'Este asistente es para PERFIL PERSONAL - MARCA PERSONAL. Responde preguntas educativas, comparte tips y redirige servicios/citas/precios al negocio oficial.'
    : assistantType === 'personal_complete'
    ? 'Este asistente es para PERFIL PERSONAL - COMPLETO. Tiene TODAS las capacidades: agendar citas, dar precios, capturar leads, responder FAQs, todo desde la cuenta personal del profesional.'
    : assistantType === 'personal_full' // DEPRECATED alias
    ? 'Este asistente es para PERFIL PERSONAL - MARCA PERSONAL. Responde preguntas educativas, comparte tips y redirige servicios/citas/precios al negocio oficial.'
    : 'Este asistente tiene CAPACIDADES COMPLETAS: puede agendar citas, dar precios, responder FAQs y más.';

  // Descripción de la vertical
  const verticalDescription =
    vertical === 'dental' ? 'CLÍNICA DENTAL: Prioriza urgencias de dolor, no diagnostiques, recomienda valoración.'
    : vertical === 'restaurant' ? 'RESTAURANTE: Confirma personas, pregunta alergias, ofrece alternativas de horario.'
    : 'NEGOCIO GENERAL: Adapta vocabulario al tipo de servicio.';

  // Construir sección con instrucciones compiladas
  return `
   ### CANAL: ${channel === 'voice' ? 'VOZ (LLAMADAS TELEFÓNICAS)' : 'MENSAJERÍA (TEXTO ESCRITO)'}

   **Estilo de comunicación:** ${compiledInstructions.metadata.styleName}
   **Tipo de asistente:** ${compiledInstructions.metadata.typeName}
   **Vertical del negocio:** ${vertical.toUpperCase()}
   **${typeDescription}**
   **${verticalDescription}**

   === INSTRUCCIONES DETALLADAS DE COMUNICACIÓN ===

   A continuación se incluyen las instrucciones EXHAUSTIVAS que el asistente DEBE seguir.
   Estas instrucciones definen CÓMO debe comunicarse según el estilo, tipo y vertical configurados.
   Las reglas de VERTICAL ya están incluidas al final del documento de instrucciones.

   IMPORTANTE:
   - Las instrucciones son aproximadamente ${compiledInstructions.metadata.totalRules} reglas organizadas
   - INCLUYE reglas específicas de la vertical (${vertical}) al final
   - Incluye el texto completo de estas instrucciones en el prompt generado
   - El asistente DEBE seguir estas reglas en cada interacción

   --- INICIO DE INSTRUCCIONES DE COMUNICACIÓN ---

${compiledInstructions.fullInstructionText}

   --- FIN DE INSTRUCCIONES DE COMUNICACIÓN ---

   ${channel === 'voice' && context.useFillerPhrases === false ? `
   **EXCEPCIÓN CONFIGURADA POR EL CLIENTE:**
   - NO usar muletillas conversacionales (el cliente lo desactivó)
   ` : ''}

   ${channel === 'voice' && context.fillerPhrases && context.fillerPhrases.length > 0 ? `
   **MULETILLAS PERSONALIZADAS POR EL CLIENTE:**
   Usa estas frases específicas en lugar de las genéricas:
   ${context.fillerPhrases.map(p => `- "${p}"`).join('\n   ')}
   ` : ''}
`;
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

  // ========================================
  // ADVERTENCIAS CRÍTICAS POR CANAL (FASE 6)
  // ========================================
  const voiceCriticalRules = `
⚠️ ⚠️ ⚠️ ADVERTENCIAS CRÍTICAS PARA PROMPT DE VOZ ⚠️ ⚠️ ⚠️

Este prompt es para un ASISTENTE DE VOZ (llamadas telefónicas). El cliente NO PUEDE VER texto, solo ESCUCHA.
Las siguientes reglas son OBLIGATORIAS y NO NEGOCIABLES:

1. **NUNCA USES EMOJIS** - Es una llamada telefónica, los emojis no se pueden escuchar.
   El prompt generado NO DEBE contener ningún emoji.

2. **NUNCA USES FORMATO MARKDOWN** - No bullets (- *), no negritas (**), no listas.
   En voz todo debe ser oraciones naturales habladas.
   ❌ MAL: "Nuestros servicios son: - Limpieza - Blanqueamiento - Ortodoncia"
   ✅ BIEN: "Ofrecemos limpieza dental, blanqueamiento y ortodoncia, entre otros servicios."

3. **NÚMEROS COMO PALABRAS** - Los precios y cantidades deben escribirse como se hablan.
   ❌ MAL: "$1,500" o "1500 pesos"
   ✅ BIEN: "mil quinientos pesos" o "alrededor de mil quinientos pesos"

4. **RESPUESTAS CORTAS** - Máximo 2-3 oraciones por turno. Voz es más lenta que texto.

5. **DELETREO DE EMAILS** - Si mencionas emails, indica que deben deletrearse letra por letra.

6. **PAUSAS EN DATOS** - Teléfonos y direcciones deben decirse lentamente con pausas.

7. **MULETILLAS CONVERSACIONALES** - ${context.useFillerPhrases !== false
    ? `INCLUYE muletillas como "${(context.fillerPhrases && context.fillerPhrases.length > 0)
        ? context.fillerPhrases.slice(0, 3).join('", "')
        : 'Claro...', 'Mmm, déjame ver...', 'Entiendo...'}" para sonar natural.`
    : 'El cliente DESACTIVÓ las muletillas. NO las incluyas en el prompt.'}

8. **CONFIRMACIONES FRECUENTES** - Repite datos importantes y pide confirmación.

⚠️ Si no cumples estas reglas, el prompt será RECHAZADO por el validador.
`;

  const messagingCriticalRules = `
📱 REGLAS PARA PROMPT DE MENSAJERÍA 📱

Este prompt es para un ASISTENTE DE MENSAJERÍA (WhatsApp, Instagram, etc.). El cliente PUEDE VER y LEER el texto.

1. **EMOJIS FUNCIONALES PERMITIDOS** - Solo estos: ✅ ❌ 📍 📞 ⏰ 📅
   NO uses emojis de caritas (😊 😂 etc.) ni gestos (👍 🙏 etc.)

2. **FORMATO MARKDOWN PERMITIDO** - Puedes usar bullets, negritas, listas cuando ayuden a organizar.

3. **NO USES MULETILLAS DE VOZ** - Nada de "Mmm...", "Bueno...", "Pues...". Es texto escrito, no conversación hablada.

4. **RESPUESTAS MÁS DETALLADAS** - Puedes dar información más completa, el cliente puede releerla.

5. **NÚMEROS EN FORMATO ESTÁNDAR** - Puedes usar "$1,500" o "1500 pesos" normalmente.
`;

  const channelCriticalRules = isVoice ? voiceCriticalRules : messagingCriticalRules;

  // Construir el meta-prompt
  return `Eres un experto en diseño de prompts para asistentes de IA conversacionales. Tu tarea es crear un prompt de sistema PROFESIONAL y COMPLETO para un ${isVoice ? 'asistente de voz (llamadas telefónicas)' : 'asistente de mensajería (WhatsApp, Instagram, etc.)'}.

${channelCriticalRules}

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

2. **TONO, ESTILO Y COMPORTAMIENTO:**
   ${buildCompiledInstructionsSection(context, promptType)}

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
 *
 * IMPORTANTE: Incluye template_key y vertical porque afectan las instrucciones compiladas
 */
export function calculateBusinessContextHash(context: BusinessContext): string {
  // Crear un objeto normalizado con los datos relevantes para el hash
  const dataForHash = {
    tenantName: context.tenantName,
    vertical: context.vertical,
    // CRÍTICO: template_key afecta el tipo de asistente y las instrucciones
    template_key: context.template_key,
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
    // Voice-specific config (afecta generación de prompt Voice)
    useFillerPhrases: context.useFillerPhrases,
    fillerPhrases: context.fillerPhrases,
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
 * Guarda un prompt generado en el caché CON VALIDACIÓN
 *
 * P5 FIX: Rechaza prompts que fallen validación crítica
 */
export async function saveCachedPrompt(
  tenantId: string,
  channel: CacheChannel,
  generatedPrompt: string,
  systemPrompt: string,
  sourceDataHash: string,
  generatorModel: string = 'gemini-2.0-flash-exp',
  tokensEstimated?: number,
  validationResult?: ValidationResult
): Promise<{ promptId: string | null; rejected: boolean; error?: string }> {
  const supabase = createServerClient();

  try {
    // P5 FIX: Use the new validated save function if validation is provided
    if (validationResult) {
      const { data, error } = await supabase.rpc('save_validated_prompt', {
        p_tenant_id: tenantId,
        p_channel: channel,
        p_generated_prompt: generatedPrompt,
        p_source_data_hash: sourceDataHash,
        p_generator_model: generatorModel,
        p_validation_score: validationResult.score,
        p_validation_errors: JSON.stringify(validationResult.errors),
        p_min_valid_score: 70, // Minimum acceptable score
      });

      if (error) {
        console.error('[PromptCache] Error saving validated prompt:', error);
        return { promptId: null, rejected: false, error: error.message };
      }

      const result = data?.[0];
      if (result?.was_rejected) {
        console.warn(`[PromptCache] Prompt REJECTED for ${channel}: ${result.error_message}`);
        return {
          promptId: result.prompt_id,
          rejected: true,
          error: result.error_message,
        };
      }

      console.log(`[PromptCache] Validated prompt saved for tenant ${tenantId}, channel ${channel}`);
      return { promptId: result?.prompt_id, rejected: false };
    }

    // Fallback to original method if no validation provided
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
      return { promptId: null, rejected: false, error: error.message };
    }

    console.log(`[PromptCache] Saved prompt for tenant ${tenantId}, channel ${channel}`);
    return { promptId: data, rejected: false };
  } catch (error) {
    console.error('[PromptCache] Exception saving cached prompt:', error);
    return { promptId: null, rejected: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Genera y cachea un prompt para un canal específico
 * Esta es la función principal que se llama cuando el usuario guarda cambios en Business IA
 *
 * P22 FIX: Prevents concurrent generation for same tenant/channel
 */
export async function generateAndCachePrompt(
  tenantId: string,
  channel: CacheChannel
): Promise<PromptGenerationResult> {
  const supabase = createServerClient();
  console.log(`[PromptCache] Generating and caching prompt for tenant ${tenantId}, channel ${channel}`);

  // P22 FIX: Try to acquire generation lock to prevent concurrent generations
  const { data: lockResult } = await supabase.rpc('acquire_prompt_generation_lock', {
    p_tenant_id: tenantId,
    p_channel: channel,
    p_locked_by: `server-${process.env.HOSTNAME || 'unknown'}`,
  });

  const lockAcquired = lockResult?.[0]?.acquired ?? true; // Default to true if RPC not available
  const waitSeconds = lockResult?.[0]?.wait_seconds ?? 0;

  if (!lockAcquired && waitSeconds > 0) {
    console.log(`[PromptCache] Generation already in progress, waiting ${waitSeconds}s`);
    // Wait for the other generation to complete, then return cached
    await new Promise(resolve => setTimeout(resolve, Math.min(waitSeconds * 1000, 30000)));

    // Try to get the freshly generated prompt
    const freshPrompt = await getCachedPrompt(tenantId, channel);
    if (freshPrompt.found && freshPrompt.generated_prompt) {
      return {
        success: true,
        prompt: freshPrompt.generated_prompt,
        generatedAt: freshPrompt.last_updated || new Date().toISOString(),
        model: 'concurrent-cached',
        processingTimeMs: waitSeconds * 1000,
      };
    }
    // If still no prompt, continue with generation
  }

  try {
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

    // P5 FIX: Pass validation result to saveCachedPrompt
    // This will REJECT prompts that fail critical validation
    const saveResult = await saveCachedPrompt(
      tenantId,
      channel,
      result.prompt,
      result.prompt, // El system_prompt es el mismo que el generated_prompt por ahora
      sourceDataHash,
      result.model,
      Math.ceil(result.prompt.length / 4), // Estimación aproximada de tokens
      result.validation // Pass validation result for P5 fix
    );

    if (saveResult.rejected) {
      console.error(`[PromptCache] Prompt REJECTED by validation for ${channel}`);
      return {
        ...result,
        success: false,
        error: `Prompt rechazado por validación: ${saveResult.error}`,
      };
    }

    if (!saveResult.promptId) {
      console.warn('[PromptCache] Could not save to cache, but prompt was generated');
    }

    console.log(`[PromptCache] Successfully generated and cached prompt for channel ${channel}`);
    return result;
  } finally {
    // P22 FIX: Release the generation lock
    if (lockAcquired) {
      try {
        await supabase.rpc('release_prompt_generation_lock', {
          p_tenant_id: tenantId,
          p_channel: channel,
        });
      } catch (releaseErr) {
        console.warn('[PromptCache] Failed to release generation lock:', releaseErr);
      }
    }
  }
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
// FALLBACK PROMPT SYSTEM (CRITICAL FIX F.1)
// ======================

/**
 * Prompt de fallback ABSOLUTO - Usado cuando todo lo demás falla
 * Este prompt garantiza que el agente NUNCA esté sin instrucciones
 */
const ABSOLUTE_FALLBACK_PROMPT = `# Asistente de Atención al Cliente

Eres un asistente virtual profesional y amable.

## Tu Rol
- Ayudar a los clientes con sus consultas
- Proporcionar información útil y precisa
- Ofrecer agendar citas o consultas cuando sea apropiado

## Reglas Importantes
- SIEMPRE sé profesional y respetuoso
- Si NO sabes algo, admítelo honestamente: "No tengo esa información disponible, pero puedo ayudarte a conectar con alguien que la tenga"
- NUNCA inventes información que no tengas
- Prioriza resolver las necesidades del cliente

## Comportamiento
- Saluda de manera cálida
- Escucha y comprende la necesidad
- Ofrece soluciones o alternativas
- Cierra la conversación de manera profesional

## Limitaciones
Este es un prompt de emergencia. Si estás viendo esto, significa que hubo un problema técnico.
Trata de ayudar al cliente lo mejor posible con información general.`;

/**
 * Construye un prompt de fallback basado en el contexto disponible
 * Usado cuando Gemini falla pero tenemos datos del negocio
 */
function buildFallbackPrompt(
  context: BusinessContext | null,
  promptType: PromptType
): string {
  // Si no hay contexto, usar fallback absoluto
  if (!context) {
    console.warn('[PromptGenerator] No context available, using ABSOLUTE_FALLBACK_PROMPT');
    return ABSOLUTE_FALLBACK_PROMPT;
  }

  const isVoice = promptType === 'voice';
  const channelDesc = isVoice
    ? 'asistente de voz para llamadas telefónicas'
    : 'asistente virtual de mensajería';

  // Construir servicios
  const servicesSection = context.services.length > 0
    ? context.services.map(s => {
        let line = `- ${s.name}`;
        if (s.priceMin) {
          line += isVoice
            ? ` (precio disponible al consultar)`
            : ` ($${s.priceMin}${s.priceMax && s.priceMax !== s.priceMin ? ` - $${s.priceMax}` : ''})`;
        }
        return line;
      }).join('\n')
    : '(Servicios no configurados - ofrecer consulta general)';

  // Construir sucursales
  const branchesSection = context.branches.length > 0
    ? context.branches.map(b => {
        let line = `- ${b.name}`;
        if (b.address) line += `: ${b.address}`;
        if (b.phone) line += ` | Tel: ${b.phone}`;
        return line;
      }).join('\n')
    : '(Sucursales no configuradas)';

  // Construir staff
  const staffSection = context.staff.length > 0
    ? context.staff.map(s => `- ${s.name}${s.specialty ? ` (${s.specialty})` : ''}`).join('\n')
    : '';

  // Reglas específicas del canal
  const channelRules = isVoice
    ? `## Reglas de Voz
- Mantén respuestas CONCISAS (2-3 oraciones máximo)
- NUNCA uses emojis (es una llamada telefónica)
- Los precios deben decirse como palabras cuando sea posible
- Usa un tono conversacional natural
- Confirma información importante repitiendo al cliente`
    : `## Reglas de Mensajería
- Puedes usar emojis funcionales: ✅ ❌ 📍 📞 ⏰ 📅
- Respuestas pueden ser más detalladas (el cliente puede releerlas)
- Usa formato estructurado cuando ayude a la claridad`;

  return `# ${context.tenantName} - ${channelDesc}

## Tu Identidad
Eres ${context.assistantName || 'el asistente virtual'} de ${context.tenantName}.
${context.assistantPersonality === 'casual' ? 'Usa un tono informal y cercano.' :
  context.assistantPersonality === 'formal' ? 'Mantén un tono muy formal y respetuoso.' :
  'Mantén un tono profesional pero cálido.'}

## Servicios Disponibles
${servicesSection}

## Ubicaciones
${branchesSection}

${staffSection ? `## Equipo\n${staffSection}` : ''}

${channelRules}

## Comportamiento General
- SIEMPRE sé profesional y respetuoso
- Si NO sabes algo, admítelo: "Déjame verificar esa información"
- NUNCA inventes información
- Ofrece agendar citas cuando sea relevante
- Prioriza ayudar al cliente

## Nota Técnica
Este es un prompt de respaldo generado automáticamente.
Los datos pueden estar incompletos. Ofrece conectar con un agente humano si es necesario.`;
}

/**
 * Valida si el contexto del negocio tiene suficiente información
 * para generar un prompt útil (FIX A.1)
 */
export interface KBCompletenessResult {
  isComplete: boolean;
  isEmpty: boolean;
  missingCritical: string[];
  missingOptional: string[];
  completenessScore: number; // 0-100
  canGeneratePrompt: boolean;
}

export function validateBusinessContextCompleteness(
  context: BusinessContext | null
): KBCompletenessResult {
  if (!context) {
    return {
      isComplete: false,
      isEmpty: true,
      missingCritical: ['tenantId', 'tenantName', 'services', 'branches'],
      missingOptional: ['staff', 'faqs', 'customInstructions'],
      completenessScore: 0,
      canGeneratePrompt: false,
    };
  }

  const missingCritical: string[] = [];
  const missingOptional: string[] = [];

  // Campos críticos
  if (!context.tenantName || context.tenantName.trim() === '') {
    missingCritical.push('Nombre del negocio');
  }
  if (!context.services || context.services.length === 0) {
    missingCritical.push('Servicios');
  }
  if (!context.branches || context.branches.length === 0) {
    missingCritical.push('Sucursales');
  }

  // Campos opcionales pero recomendados
  if (!context.staff || context.staff.length === 0) {
    missingOptional.push('Equipo/Personal');
  }
  if (!context.faqs || context.faqs.length === 0) {
    missingOptional.push('Preguntas frecuentes');
  }
  if (!context.assistantName) {
    missingOptional.push('Nombre del asistente');
  }
  if (!context.customInstructions && (!context.customInstructionsList || context.customInstructionsList.length === 0)) {
    missingOptional.push('Instrucciones personalizadas');
  }

  // Calcular score
  let score = 100;
  score -= missingCritical.length * 25; // Críticos penalizan más
  score -= missingOptional.length * 5;  // Opcionales penalizan menos
  score = Math.max(0, Math.min(100, score));

  // Determinar si está vacío
  const isEmpty = missingCritical.length >= 3;

  // Determinar si puede generar prompt
  // Necesita al menos: nombre del negocio Y (servicios O sucursales)
  const canGeneratePrompt: boolean = Boolean(
    context.tenantName &&
    context.tenantName.trim() !== '' &&
    ((context.services && context.services.length > 0) ||
     (context.branches && context.branches.length > 0))
  );

  return {
    isComplete: missingCritical.length === 0,
    isEmpty,
    missingCritical,
    missingOptional,
    completenessScore: score,
    canGeneratePrompt,
  };
}

/**
 * VERSIÓN SEGURA de getOptimizedPrompt
 * GARANTIZA que NUNCA retornará un prompt vacío
 *
 * Esta es la función que los servicios LangGraph y Voice DEBEN usar
 */
export async function getOptimizedPromptSafe(
  tenantId: string,
  channel: CacheChannel
): Promise<{
  prompt: string;
  fromCache: boolean;
  version?: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  warning?: string;
}> {
  const promptType: PromptType = channel === 'voice' ? 'voice' : 'messaging';
  let context: BusinessContext | null = null;

  try {
    // 1. Intentar obtener del caché
    const cached = await getCachedPrompt(tenantId, channel);

    if (cached.found && cached.generated_prompt && cached.generated_prompt.trim() !== '') {
      // P7 FIX: Verificar si necesita regeneración con try-catch
      let needsRegen = false;
      try {
        needsRegen = await checkNeedsRegeneration(tenantId, channel);
      } catch (regenCheckError) {
        // Si falla la verificación, asumir que el caché es válido
        console.warn(`[PromptCacheSafe] checkNeedsRegeneration failed, using cached:`, regenCheckError);
        needsRegen = false;
      }

      if (!needsRegen) {
        console.log(`[PromptCacheSafe] Using cached prompt v${cached.prompt_version} for ${channel}`);
        return {
          prompt: cached.generated_prompt,
          fromCache: true,
          version: cached.prompt_version,
          fallbackUsed: false,
        };
      }

      console.log(`[PromptCacheSafe] Cached prompt outdated, regenerating for ${channel}`);
    }

    // 2. No hay caché válido, intentar generar nuevo prompt
    console.log(`[PromptCacheSafe] Generating fresh prompt for ${channel}`);

    // Obtener contexto para posible fallback
    context = await collectBusinessContext(tenantId, promptType);

    // Validar completud del KB
    const completeness = validateBusinessContextCompleteness(context);

    if (!completeness.canGeneratePrompt) {
      console.warn(`[PromptCacheSafe] KB incomplete for ${tenantId}:`, completeness.missingCritical);

      // Si KB está muy vacío, usar fallback con advertencia
      const fallbackPrompt = buildFallbackPrompt(context, promptType);
      return {
        prompt: fallbackPrompt,
        fromCache: false,
        fallbackUsed: true,
        fallbackReason: 'Knowledge Base incompleto',
        warning: `Configura tu Knowledge Base para mejores resultados. Falta: ${completeness.missingCritical.join(', ')}`,
      };
    }

    // Intentar generar con Gemini
    const result = await generateAndCachePrompt(tenantId, channel);

    if (result.success && result.prompt && result.prompt.trim() !== '') {
      return {
        prompt: result.prompt,
        fromCache: false,
        fallbackUsed: false,
      };
    }

    // 3. Si falló generación pero hay caché antiguo, usarlo
    if (cached.found && cached.generated_prompt && cached.generated_prompt.trim() !== '') {
      console.warn(`[PromptCacheSafe] Using stale cache as fallback for ${channel}`);
      return {
        prompt: cached.generated_prompt,
        fromCache: true,
        version: cached.prompt_version,
        fallbackUsed: true,
        fallbackReason: 'Generación falló, usando caché anterior',
        warning: result.error || 'Error al regenerar prompt',
      };
    }

    // 4. No hay caché, generación falló - usar fallback basado en contexto
    console.warn(`[PromptCacheSafe] No cache, generation failed. Building fallback for ${channel}`);
    const fallbackPrompt = buildFallbackPrompt(context, promptType);

    return {
      prompt: fallbackPrompt,
      fromCache: false,
      fallbackUsed: true,
      fallbackReason: 'Error de generación, usando prompt de respaldo',
      warning: result.error || 'No se pudo generar el prompt optimizado',
    };

  } catch (error) {
    // 5. Error catastrófico - usar fallback absoluto
    console.error('[PromptCacheSafe] Catastrophic error:', error);

    const fallbackPrompt = buildFallbackPrompt(context, promptType);

    return {
      prompt: fallbackPrompt,
      fromCache: false,
      fallbackUsed: true,
      fallbackReason: 'Error del sistema',
      warning: `Error crítico: ${error instanceof Error ? error.message : 'Unknown error'}. Usando prompt de emergencia.`,
    };
  }
}

// ======================
// ARQUITECTURA V6: PROMPT MINIMAL + TOOLS DINÁMICOS
// ======================
// Este sistema genera prompts MÍNIMOS (~1,200-1,500 tokens) que contienen:
// 1. Identidad del agente (nombre, negocio, vertical)
// 2. Personalidad compilada (estilo + tipo de asistente)
// 3. Instrucciones críticas (solo las marcadas include_in_prompt)
// 4. Declaración de tools disponibles
// 5. Reglas de seguridad por vertical
//
// Los datos del negocio (servicios, sucursales, staff, KB) se acceden
// dinámicamente via Tools cuando el agente los necesita.
// ======================

/**
 * Interfaz para instrucciones críticas que van en el prompt
 */
export interface CriticalInstruction {
  id: string;
  type: string;
  title: string;
  instruction: string;
  priority: number;
}

/**
 * Obtiene las instrucciones críticas que deben ir en el prompt inicial
 * Solo retorna instrucciones con include_in_prompt = true
 * Máximo 5 instrucciones, máximo ~300 tokens
 */
export async function getCriticalInstructions(
  tenantId: string
): Promise<CriticalInstruction[]> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('ai_custom_instructions')
      .select('id, instruction_type, title, instruction, priority')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('include_in_prompt', true)
      .order('priority', { ascending: false })
      .limit(5);

    if (error) {
      console.warn('[MinimalPrompt] Error fetching critical instructions:', error);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      type: d.instruction_type,
      title: d.title,
      instruction: d.instruction,
      priority: d.priority || 0,
    }));
  } catch (error) {
    console.error('[MinimalPrompt] Exception fetching critical instructions:', error);
    return [];
  }
}

/**
 * Construye la sección de IDENTIDAD del agente (~100 tokens)
 */
export function buildIdentitySection(
  context: BusinessContext,
  promptType: PromptType
): string {
  const channelLabel = promptType === 'voice' ? 'VOZ (Llamadas)' : 'MENSAJERÍA (Texto)';
  const verticalLabel = VERTICAL_CONFIGS[context.vertical]?.type || 'negocio';

  return `# IDENTIDAD

Eres **${context.assistantName || 'el asistente virtual'}** de **${context.tenantName}**.
- **Canal:** ${channelLabel}
- **Vertical:** ${verticalLabel}
- **Tenant ID:** ${context.tenantId}`;
}

/**
 * Construye la sección de HERRAMIENTAS DISPONIBLES (~150 tokens)
 * Le indica al agente qué tools tiene disponibles y cuándo usarlas
 */
export function buildToolsDeclaration(
  assistantType: AssistantTypeKey,
  vertical: string
): string {
  // Tools base disponibles para todos los tipos
  const baseTools = [
    'get_service_info - Obtiene información detallada de un servicio específico',
    'list_services - Lista todos los servicios disponibles con precios',
    'get_branch_info - Obtiene información de sucursales (dirección, teléfono, horarios)',
    'get_staff_info - Obtiene información del equipo/especialistas',
    'get_operating_hours - Obtiene horarios de operación',
    'get_business_policy - Obtiene políticas del negocio (cancelación, pago, etc.)',
    'search_knowledge_base - Busca en la base de conocimiento (RAG semántico)',
    'get_faq_answer - Busca respuesta en preguntas frecuentes',
  ];

  // Tools de acción (solo para tipos que pueden agendar)
  const actionTools = assistantType !== 'personal_redirect' ? [
    'get_available_slots - Obtiene horarios disponibles para agendar',
    'create_appointment - Crea una cita para el cliente',
    'update_lead_info - Actualiza información del cliente',
  ] : [];

  // Tools de loyalty (si aplica)
  const loyaltyTools = assistantType === 'full' || assistantType === 'personal_complete' ? [
    'get_loyalty_balance - Obtiene balance de puntos del cliente',
    'get_available_rewards - Lista recompensas canjeables',
    'redeem_reward - Canjea una recompensa',
  ] : [];

  // Tools específicas de restaurant
  const restaurantTools = vertical === 'restaurant' ? [
    'get_menu_items - Obtiene items del menú',
    'get_menu_categories - Lista categorías del menú',
    'check_item_availability - Verifica disponibilidad de items',
    'get_active_promotions - Obtiene promociones vigentes',
  ] : [];

  const allTools = [...baseTools, ...actionTools, ...loyaltyTools, ...restaurantTools];

  return `# HERRAMIENTAS DISPONIBLES

Tienes acceso a estas tools para obtener información en tiempo real:

${allTools.map(t => `- ${t}`).join('\n')}

## REGLAS DE USO DE TOOLS

1. **USA las tools** cuando necesites información específica del negocio
2. **NO inventes datos** - siempre consulta via tools si no estás seguro
3. **Combina información** de múltiples tools cuando sea necesario
4. **Prioriza la precisión** sobre la velocidad`;
}

/**
 * Construye las reglas de SEGURIDAD específicas de la vertical (~100 tokens)
 */
export function buildSafetyRules(vertical: string): string {
  const verticalConfig = VERTICAL_CONFIGS[vertical] || VERTICAL_CONFIGS.general;

  const baseRules = [
    'NUNCA inventes información que no tengas',
    'Si no sabes algo, admítelo y ofrece alternativas',
    'Respeta la privacidad del cliente en todo momento',
    'Escala a un humano si la situación lo requiere',
  ];

  const verticalRules = verticalConfig.specialConsiderations.length > 0
    ? verticalConfig.specialConsiderations
    : [];

  return `# REGLAS DE SEGURIDAD

## Reglas Generales
${baseRules.map(r => `- ${r}`).join('\n')}

${verticalRules.length > 0 ? `## Reglas Específicas de ${verticalConfig.type.toUpperCase()}
${verticalRules.map(r => `- ${r}`).join('\n')}` : ''}`;
}

/**
 * Formatea las instrucciones críticas para el prompt (~200-300 tokens máx)
 */
function formatCriticalInstructions(instructions: CriticalInstruction[]): string {
  if (instructions.length === 0) {
    return '';
  }

  const formatted = instructions
    .slice(0, 5) // Máximo 5
    .map((inst, idx) => `${idx + 1}. **${inst.title}**: ${inst.instruction}`)
    .join('\n');

  return `# INSTRUCCIONES CRÍTICAS

Estas reglas son OBLIGATORIAS y tienen prioridad máxima:

${formatted}`;
}

/**
 * GENERA UN PROMPT MINIMAL según la arquitectura v6
 *
 * Este prompt contiene SOLO lo esencial (~1,200-1,500 tokens):
 * - Identidad del agente
 * - Personalidad compilada (estilo + tipo)
 * - Instrucciones críticas (solo include_in_prompt=true)
 * - Declaración de tools
 * - Reglas de seguridad
 *
 * Los datos del negocio (servicios, precios, sucursales, KB) se
 * obtienen dinámicamente via Tools cuando el agente los necesita.
 */
export async function generateMinimalPrompt(
  context: BusinessContext,
  promptType: PromptType
): Promise<{ prompt: string; tokenEstimate: number; sections: Record<string, string> }> {
  const channel: ChannelContext = promptType === 'voice' ? 'voice' : 'messaging';

  // 1. Obtener el tipo de asistente desde el template
  const templateKey = context.template_key ||
    (context.vertical === 'dental' ? 'dental_full' :
     context.vertical === 'restaurant' ? 'resto_full' : 'general_full');
  const assistantType: AssistantTypeKey = mapTemplateKeyToType(templateKey);

  // 2. Obtener el estilo de respuesta
  const styleKey: ResponseStyleKey = isValidStyle(context.assistantPersonality || '')
    ? context.assistantPersonality as ResponseStyleKey
    : 'professional_friendly';

  // 3. Construir secciones del prompt

  // Sección 1: Identidad (~100 tokens)
  const identitySection = buildIdentitySection(context, promptType);

  // Sección 2: Personalidad compilada (~600-800 tokens)
  const compiledInstructions = getFullCompiledInstructions(
    styleKey,
    assistantType,
    channel,
    context.vertical as 'dental' | 'restaurant' | 'general'
  );

  const personalitySection = compiledInstructions
    ? `# PERSONALIDAD Y COMPORTAMIENTO

> Estilo: **${compiledInstructions.metadata.styleName}**
> Tipo: **${compiledInstructions.metadata.typeName}**

${compiledInstructions.fullInstructionText}`
    : buildCompiledInstructionsSection(context, promptType);

  // Sección 3: Instrucciones críticas (~200-300 tokens)
  const criticalInstructions = await getCriticalInstructions(context.tenantId);
  const criticalSection = formatCriticalInstructions(criticalInstructions);

  // Sección 4: Tools disponibles (~150 tokens)
  const toolsSection = buildToolsDeclaration(assistantType, context.vertical);

  // Sección 5: Reglas de seguridad (~100 tokens)
  const safetySection = buildSafetyRules(context.vertical);

  // Sección especial: Reglas de canal
  const channelRulesSection = promptType === 'voice'
    ? `# REGLAS ESPECÍFICAS DE VOZ

- Respuestas CONCISAS (2-3 oraciones máximo)
- NUNCA uses emojis (es una llamada telefónica)
- Precios como palabras: "mil quinientos pesos"
- Usa muletillas naturales${context.useFillerPhrases === false ? ' (DESACTIVADO por cliente)' : ''}
- Confirma datos importantes repitiendo al cliente`
    : `# REGLAS ESPECÍFICAS DE MENSAJERÍA

- Emojis funcionales permitidos: ✅ ❌ 📍 📞 ⏰ 📅
- NO uses muletillas de voz (es texto escrito)
- Respuestas pueden ser más detalladas
- Usa formato estructurado cuando ayude`;

  // Combinar todas las secciones
  const sections: Record<string, string> = {
    identity: identitySection,
    personality: personalitySection,
    critical: criticalSection,
    tools: toolsSection,
    safety: safetySection,
    channel: channelRulesSection,
  };

  const fullPrompt = [
    identitySection,
    personalitySection,
    criticalSection,
    toolsSection,
    safetySection,
    channelRulesSection,
  ].filter(s => s.trim() !== '').join('\n\n---\n\n');

  // Estimar tokens (~4 chars por token en español)
  const tokenEstimate = Math.ceil(fullPrompt.length / 4);

  console.log(`[MinimalPrompt] Generated minimal prompt: ${tokenEstimate} tokens estimated (${fullPrompt.length} chars)`);

  return {
    prompt: fullPrompt,
    tokenEstimate,
    sections,
  };
}

/**
 * Calcula hash SOLO de los datos que afectan el prompt MINIMAL
 * Excluye datos dinámicos que se obtienen via Tools
 *
 * Esto reduce las regeneraciones innecesarias del prompt
 */
export function calculateMinimalPromptHash(context: BusinessContext): string {
  // Solo incluir datos que REALMENTE van en el prompt minimal
  const dataForHash = {
    // Identidad (siempre en prompt)
    tenantId: context.tenantId,
    tenantName: context.tenantName,
    vertical: context.vertical,
    assistantName: context.assistantName,

    // Personalidad (afecta instrucciones compiladas)
    assistantPersonality: context.assistantPersonality,
    template_key: context.template_key,

    // Config de voz (afecta reglas de canal)
    useFillerPhrases: context.useFillerPhrases,

    // NO incluir: services, branches, staff, faqs, policies, articles, templates, competitors
    // Esos datos se obtienen via Tools dinámicamente
  };

  const jsonString = JSON.stringify(dataForHash, Object.keys(dataForHash).sort());
  return crypto.createHash('sha256').update(jsonString).digest('hex').substring(0, 16);
}

/**
 * Genera y cachea un prompt MINIMAL para un canal específico
 * Esta función reemplaza generateAndCachePrompt para la arquitectura v6
 */
export async function generateAndCacheMinimalPrompt(
  tenantId: string,
  channel: CacheChannel
): Promise<PromptGenerationResult> {
  console.log(`[MinimalPrompt] Generating minimal prompt for tenant ${tenantId}, channel ${channel}`);

  const startTime = Date.now();
  const promptType: PromptType = channel === 'voice' ? 'voice' : 'messaging';

  try {
    // 1. Recopilar contexto básico (sin KB completa)
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

    // 2. Calcular hash de datos que afectan el prompt minimal
    const sourceDataHash = calculateMinimalPromptHash(context);

    // 3. Verificar si ya existe un prompt con el mismo hash
    const existingPrompt = await getCachedPrompt(tenantId, channel);
    if (existingPrompt.found && existingPrompt.source_data_hash === sourceDataHash) {
      console.log(`[MinimalPrompt] Prompt already up-to-date for channel ${channel}`);
      return {
        success: true,
        prompt: existingPrompt.generated_prompt || '',
        generatedAt: existingPrompt.last_updated || new Date().toISOString(),
        model: 'cached-minimal',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 4. Generar nuevo prompt minimal (sin llamar a Gemini)
    const { prompt, tokenEstimate } = await generateMinimalPrompt(context, promptType);

    // 5. Guardar en caché
    const supabase = createServerClient();
    const { error: saveError } = await supabase
      .from('ai_generated_prompts')
      .upsert({
        tenant_id: tenantId,
        channel,
        generated_prompt: prompt,
        system_prompt: prompt,
        source_data_hash: sourceDataHash,
        generator_model: 'minimal-v6',
        tokens_estimated: tokenEstimate,
        prompt_version: (existingPrompt.prompt_version || 0) + 1,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,channel',
      });

    if (saveError) {
      console.error('[MinimalPrompt] Error saving to cache:', saveError);
    }

    console.log(`[MinimalPrompt] Generated minimal prompt: ${tokenEstimate} tokens in ${Date.now() - startTime}ms`);

    return {
      success: true,
      prompt,
      generatedAt: new Date().toISOString(),
      model: 'minimal-v6',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[MinimalPrompt] Exception generating prompt:', error);
    return {
      success: false,
      prompt: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      generatedAt: new Date().toISOString(),
      model: 'error',
      processingTimeMs: Date.now() - startTime,
    };
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
  getOptimizedPromptSafe, // NUEVA: versión segura
  invalidatePromptCache,
  calculateBusinessContextHash,

  // Funciones de validación y fallback (NUEVAS - FASE 1/2)
  validateBusinessContextCompleteness,
  buildFallbackPrompt,

  // Funciones de sanitización (NUEVAS - FASE 6)
  sanitizeSensitiveData,
  sanitizeBusinessContext,

  // =====================================================
  // ARQUITECTURA V6: PROMPT MINIMAL + TOOLS DINÁMICOS
  // =====================================================
  // Estas funciones implementan la nueva arquitectura donde:
  // - El prompt inicial es MÍNIMO (~1,200-1,500 tokens)
  // - Los datos del negocio se obtienen via Tools dinámicamente
  // - Solo instrucciones críticas van en el prompt inicial
  generateMinimalPrompt,
  generateAndCacheMinimalPrompt,
  calculateMinimalPromptHash,
  getCriticalInstructions,
  buildIdentitySection,
  buildToolsDeclaration,
  buildSafetyRules,
};
