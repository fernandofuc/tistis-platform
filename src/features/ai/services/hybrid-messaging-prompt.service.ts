/**
 * TIS TIS Platform - Hybrid Messaging Prompt Generation Service
 *
 * Implements the hybrid prompt system for MESSAGING Agents (WhatsApp/SMS/Chat):
 * 1. Template Base: Generates structured prompt using Handlebars templates
 * 2. Gemini Enrichment: Adds Knowledge Base content without modifying structure
 *
 * KEY DIFFERENCES FROM VOICE:
 * - Emojis funcionales are allowed
 * - Markdown formatting (bold, lists) is supported
 * - No voice filler phrases (muletillas)
 * - Responses can be more detailed
 * - Uses messaging-specific templates from 'templates/prompts/messaging/'
 *
 * @example
 * ```typescript
 * const result = await generateHybridMessagingPrompt(tenantId, config, businessContext);
 * console.log(result.greetingMessage); // "¡Hola! 👋 Soy Javier de..."
 * console.log(result.prompt); // Full enriched prompt
 * ```
 */

import {
  generateWithGemini,
  DEFAULT_GEMINI_MODELS,
  isGeminiConfigured,
} from '@/src/shared/lib/gemini';
import {
  TemplateMessagingCompilerService,
  type CompiledMessagingPrompt,
  type MessagingAssistantConfig,
} from '@/lib/messaging-agent/services';
import type { Capability, Tool } from '@/lib/voice-agent/types';
import type { BusinessContext, PromptGenerationResult } from './prompt-generator.service';

// =====================================================
// TYPES
// =====================================================

export interface HybridMessagingPromptResult extends PromptGenerationResult {
  /** Greeting message for first contact */
  greetingMessage: string;
  /** Enabled capabilities */
  capabilities: Capability[];
  /** Available tools */
  tools: Tool[];
  /** Whether KB enrichment was applied */
  kbEnriched: boolean;
  /** Template name used */
  templateName?: string;
  /** Channel identifier */
  channel: 'messaging';
}

// =====================================================
// GEMINI ENRICHMENT PROMPT (Messaging-specific)
// =====================================================

/**
 * Meta-prompt for Gemini to enrich the messaging base prompt with Knowledge Base
 * IMPORTANT: Gemini should ONLY add information, not modify structure
 *
 * KEY DIFFERENCES FROM VOICE META-PROMPT:
 * - Allows emojis funcionales
 * - Encourages structured formatting
 * - Permits longer, more detailed additions
 */
const GEMINI_MESSAGING_ENRICHMENT_META_PROMPT = `Eres un experto en prompts para asistentes de mensajería (WhatsApp, SMS, Chat). Tu tarea es ENRIQUECER el siguiente prompt base con la información del Knowledge Base del negocio.

## REGLAS ESTRICTAS (MUY IMPORTANTE):

1. **NO modifiques la estructura del prompt** (secciones, orden, formato)
2. **NO cambies el nombre del asistente ni del negocio**
3. **NO modifiques las instrucciones de reservas/citas**
4. **NO modifiques la sección # CANAL DE COMUNICACIÓN**
5. **NO agregues secciones nuevas**

## LO QUE SÍ DEBES HACER:

1. En la sección "# INFORMACIÓN DEL NEGOCIO" o "# INFORMACIÓN DEL SERVICIO":
   - Agrega FAQs relevantes como texto natural
   - Incluye información de políticas importantes
   - Puedes usar emojis funcionales con moderación (✅, ❌, 📍, 📞, ⏰, 📅)

2. Si hay promociones activas en el KB:
   - Menciónalas en la sección correspondiente
   - Puedes usar formato: **nombre de promoción** - descripción

3. Si hay artículos de conocimiento relevantes:
   - Integra la información más útil en las secciones apropiadas
   - Puedes usar listas con viñetas para mejor legibilidad

4. Mantén el tono y estilo del prompt original (profesional pero accesible para chat)

## PROMPT BASE A ENRIQUECER:

{basePrompt}

## KNOWLEDGE BASE DEL NEGOCIO:

### FAQs:
{faqs}

### Políticas del Negocio:
{policies}

### Artículos de Conocimiento:
{articles}

### Instrucciones Especiales:
{customInstructions}

---

## INSTRUCCIÓN FINAL:
Retorna el prompt COMPLETO enriquecido, manteniendo EXACTAMENTE el mismo formato y estructura.
Solo agrega información del KB donde sea relevante, sin modificar la estructura base.
Si no hay información relevante que agregar, retorna el prompt base sin cambios.`;

// =====================================================
// MAIN FUNCTION
// =====================================================

/**
 * Generate a hybrid messaging prompt using templates + Gemini enrichment
 *
 * @param tenantId - The tenant ID
 * @param assistantConfig - Assistant configuration (optional, will be loaded if not provided)
 * @param businessContext - Business context with KB data
 * @returns Hybrid messaging prompt result with greeting message
 */
export async function generateHybridMessagingPrompt(
  tenantId: string,
  assistantConfig?: MessagingAssistantConfig,
  businessContext?: BusinessContext
): Promise<HybridMessagingPromptResult> {
  const startTime = Date.now();

  console.log(`[HybridMessagingPrompt] Starting hybrid generation for tenant ${tenantId}`);

  try {
    // ===== STEP 1: Compile base prompt from messaging templates =====
    let compiledPrompt: CompiledMessagingPrompt;

    try {
      compiledPrompt = await TemplateMessagingCompilerService.compileBasePrompt(
        tenantId,
        assistantConfig
      );
      console.log(`[HybridMessagingPrompt] Template compiled: ${compiledPrompt.templateName}`);
    } catch (templateError) {
      console.error('[HybridMessagingPrompt] Template compilation failed:', templateError);

      // Fallback: return minimal prompt without template
      return {
        success: false,
        prompt: '',
        greetingMessage: '',
        capabilities: [],
        tools: [],
        error: `Error compilando template de mensajería: ${templateError instanceof Error ? templateError.message : 'Unknown'}`,
        generatedAt: new Date().toISOString(),
        model: 'template-error',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        channel: 'messaging',
      };
    }

    // ===== STEP 2: Check if we have KB content to enrich =====
    const hasKBContent = businessContext && (
      (businessContext.faqs && businessContext.faqs.length > 0) ||
      (businessContext.businessPolicies && businessContext.businessPolicies.length > 0) ||
      (businessContext.knowledgeArticles && businessContext.knowledgeArticles.length > 0) ||
      (businessContext.customInstructionsList && businessContext.customInstructionsList.length > 0)
    );

    // If no KB content or Gemini not configured, return template-only prompt
    if (!hasKBContent || !isGeminiConfigured()) {
      console.log(`[HybridMessagingPrompt] No KB enrichment needed/available, using template-only`);

      return {
        success: true,
        prompt: compiledPrompt.basePrompt,
        greetingMessage: compiledPrompt.greetingMessage,
        capabilities: compiledPrompt.capabilities,
        tools: compiledPrompt.tools,
        generatedAt: compiledPrompt.compiledAt,
        model: 'template-only',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        templateName: compiledPrompt.templateName,
        channel: 'messaging',
      };
    }

    // ===== STEP 3: Build KB sections for enrichment =====
    const kbSections = buildKBSections(businessContext);

    // ===== STEP 4: Enrich with Gemini =====
    const enrichmentPrompt = GEMINI_MESSAGING_ENRICHMENT_META_PROMPT
      .replace('{basePrompt}', compiledPrompt.basePrompt)
      .replace('{faqs}', kbSections.faqs || 'No hay FAQs disponibles.')
      .replace('{policies}', kbSections.policies || 'No hay políticas específicas.')
      .replace('{articles}', kbSections.articles || 'No hay artículos de conocimiento.')
      .replace('{customInstructions}', kbSections.customInstructions || 'Sin instrucciones adicionales.');

    console.log(`[HybridMessagingPrompt] Calling Gemini for KB enrichment...`);

    const geminiResult = await generateWithGemini(enrichmentPrompt, {
      model: DEFAULT_GEMINI_MODELS.PROMPT_GENERATION,
      temperature: 0.3, // Low temperature for consistent output
      maxOutputTokens: 10000, // Messaging prompts can be longer
    });

    if (!geminiResult.success || !geminiResult.content) {
      console.warn('[HybridMessagingPrompt] Gemini enrichment failed, using template-only');

      return {
        success: true,
        prompt: compiledPrompt.basePrompt,
        greetingMessage: compiledPrompt.greetingMessage,
        capabilities: compiledPrompt.capabilities,
        tools: compiledPrompt.tools,
        generatedAt: compiledPrompt.compiledAt,
        model: 'template-only-gemini-failed',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        templateName: compiledPrompt.templateName,
        channel: 'messaging',
      };
    }

    // ===== STEP 5: Clean and validate enriched prompt =====
    let enrichedPrompt = geminiResult.content;
    enrichedPrompt = enrichedPrompt.replace(/^```[\w]*\n?/gm, '');
    enrichedPrompt = enrichedPrompt.replace(/\n?```$/gm, '');
    enrichedPrompt = enrichedPrompt.trim();

    // Validate that enriched prompt still has the core sections
    const hasIdentity = enrichedPrompt.includes('# IDENTIDAD') ||
                        enrichedPrompt.includes('# CANAL DE COMUNICACIÓN');
    const hasInstructions = enrichedPrompt.includes('# CAPACIDADES') ||
                           enrichedPrompt.includes('# RESERVAS') ||
                           enrichedPrompt.includes('# CITAS');

    if (!hasIdentity || !hasInstructions) {
      console.warn('[HybridMessagingPrompt] Enriched prompt missing core sections, using template-only');

      return {
        success: true,
        prompt: compiledPrompt.basePrompt,
        greetingMessage: compiledPrompt.greetingMessage,
        capabilities: compiledPrompt.capabilities,
        tools: compiledPrompt.tools,
        generatedAt: compiledPrompt.compiledAt,
        model: 'template-only-validation-failed',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        templateName: compiledPrompt.templateName,
        channel: 'messaging',
      };
    }

    const processingTime = Date.now() - startTime;
    console.log(`[HybridMessagingPrompt] Successfully enriched prompt in ${processingTime}ms`);

    return {
      success: true,
      prompt: enrichedPrompt,
      greetingMessage: compiledPrompt.greetingMessage,
      capabilities: compiledPrompt.capabilities,
      tools: compiledPrompt.tools,
      generatedAt: new Date().toISOString(),
      model: geminiResult.model,
      processingTimeMs: processingTime,
      kbEnriched: true,
      templateName: compiledPrompt.templateName,
      channel: 'messaging',
    };

  } catch (error) {
    console.error('[HybridMessagingPrompt] Unexpected error:', error);

    return {
      success: false,
      prompt: '',
      greetingMessage: '',
      capabilities: [],
      tools: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      generatedAt: new Date().toISOString(),
      model: 'error',
      processingTimeMs: Date.now() - startTime,
      kbEnriched: false,
      channel: 'messaging',
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Build KB sections for enrichment prompt
 * Note: For messaging, we can include more content since responses can be detailed
 */
function buildKBSections(context: BusinessContext): {
  faqs: string;
  policies: string;
  articles: string;
  customInstructions: string;
} {
  // FAQs - messaging can handle more FAQs
  let faqs = '';
  if (context.faqs && context.faqs.length > 0) {
    faqs = context.faqs
      .slice(0, 15) // More FAQs than voice (15 vs 10)
      .map(f => `P: ${f.question}\nR: ${f.answer}`)
      .join('\n\n');
  }

  // Policies - can include more detail for messaging
  let policies = '';
  if (context.businessPolicies && context.businessPolicies.length > 0) {
    policies = context.businessPolicies
      .slice(0, 7) // More policies than voice (7 vs 5)
      .map(p => `**${p.title}:** ${p.policy}`)
      .join('\n\n');
  }

  // Knowledge Articles - can include more content
  let articles = '';
  if (context.knowledgeArticles && context.knowledgeArticles.length > 0) {
    articles = context.knowledgeArticles
      .slice(0, 7) // More articles than voice (7 vs 5)
      .map(a => `**${a.title}** (${a.category}):\n${a.content.substring(0, 800)}...`) // More content per article
      .join('\n\n');
  }

  // Custom Instructions
  let customInstructions = '';
  if (context.customInstructionsList && context.customInstructionsList.length > 0) {
    customInstructions = context.customInstructionsList
      .slice(0, 7) // More instructions than voice
      .map(i => `- ${i.title}: ${i.instruction}`)
      .join('\n');
  }

  return { faqs, policies, articles, customInstructions };
}

// =====================================================
// EXPORTS
// =====================================================

export const HybridMessagingPromptService = {
  generateHybridMessagingPrompt,
};
