/**
 * TIS TIS Platform - Hybrid Voice Prompt Generation Service
 *
 * Implements the hybrid prompt system for Voice Agent:
 * 1. Template Base: Generates structured prompt using Handlebars templates
 * 2. Gemini Enrichment: Adds Knowledge Base content without modifying structure
 *
 * This ensures Voice Agent prompts have:
 * - Consistent structure (SALUDO, PERSONALIDAD, TAREA, RESERVAS/CITAS, etc.)
 * - Proper first_message
 * - KB enrichment for FAQ, policies, etc.
 *
 * @example
 * ```typescript
 * const result = await generateHybridVoicePrompt(tenantId, voiceConfig, businessContext);
 * console.log(result.firstMessage); // "Hola, soy Javier del restaurante..."
 * console.log(result.prompt); // Full enriched prompt
 * ```
 */

import { createServerClient } from '@/src/shared/lib/supabase';
import {
  generateWithGemini,
  DEFAULT_GEMINI_MODELS,
  isGeminiConfigured,
} from '@/src/shared/lib/gemini';
import {
  TemplatePromptCompilerService,
  type CompiledBasePrompt,
  type VoiceAssistantDbConfig,
} from '@/lib/voice-agent/services';
import type { Capability, Tool } from '@/lib/voice-agent/types';
import type { BusinessContext, PromptGenerationResult } from './prompt-generator.service';

// =====================================================
// TYPES
// =====================================================

export interface HybridVoicePromptResult extends PromptGenerationResult {
  /** First message for the assistant */
  firstMessage: string;
  /** Enabled capabilities */
  capabilities: Capability[];
  /** Available tools */
  tools: Tool[];
  /** Whether KB enrichment was applied */
  kbEnriched: boolean;
  /** Template name used */
  templateName?: string;
}

// =====================================================
// GEMINI ENRICHMENT PROMPT
// =====================================================

/**
 * Meta-prompt for Gemini to enrich the base prompt with Knowledge Base
 * IMPORTANT: Gemini should ONLY add information, not modify structure
 */
const GEMINI_ENRICHMENT_META_PROMPT = `Eres un experto en prompts para asistentes de voz. Tu tarea es ENRIQUECER el siguiente prompt base con la información del Knowledge Base del negocio.

## REGLAS ESTRICTAS (MUY IMPORTANTE):

1. **NO modifiques la estructura del prompt** (secciones, orden, formato)
2. **NO cambies el nombre del asistente ni del negocio**
3. **NO modifiques las instrucciones de reservas/citas**
4. **NO modifiques el SALUDO INICIAL**
5. **NO agregues secciones nuevas**
6. **NO uses emojis**

## LO QUE SÍ DEBES HACER:

1. En la sección "# INFORMACIÓN DEL SERVICIO":
   - Agrega FAQs relevantes como texto natural
   - Incluye información de políticas importantes

2. Si hay promociones activas en el KB:
   - Menciónalas brevemente al final de la sección correspondiente

3. Si hay artículos de conocimiento relevantes:
   - Integra la información más útil en las secciones apropiadas

4. Mantén el tono y estilo del prompt original

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
 * Generate a hybrid voice prompt using templates + Gemini enrichment
 *
 * @param tenantId - The tenant ID
 * @param voiceConfig - Voice assistant configuration (optional, will be loaded if not provided)
 * @param businessContext - Business context with KB data
 * @returns Hybrid prompt result with first_message
 */
export async function generateHybridVoicePrompt(
  tenantId: string,
  voiceConfig?: VoiceAssistantDbConfig,
  businessContext?: BusinessContext
): Promise<HybridVoicePromptResult> {
  const startTime = Date.now();

  console.log(`[HybridVoicePrompt] Starting hybrid generation for tenant ${tenantId}`);

  try {
    // ===== STEP 1: Compile base prompt from templates =====
    let compiledPrompt: CompiledBasePrompt;

    try {
      compiledPrompt = await TemplatePromptCompilerService.compileBasePrompt(
        tenantId,
        voiceConfig || undefined
      );
      console.log(`[HybridVoicePrompt] Template compiled: ${compiledPrompt.templateName}`);
    } catch (templateError) {
      console.error('[HybridVoicePrompt] Template compilation failed:', templateError);

      // Fallback: return minimal prompt without template
      return {
        success: false,
        prompt: '',
        firstMessage: '',
        capabilities: [],
        tools: [],
        error: `Error compilando template: ${templateError instanceof Error ? templateError.message : 'Unknown'}`,
        generatedAt: new Date().toISOString(),
        model: 'template-error',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
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
      console.log(`[HybridVoicePrompt] No KB enrichment needed/available, using template-only`);

      return {
        success: true,
        prompt: compiledPrompt.basePrompt,
        firstMessage: compiledPrompt.firstMessage,
        capabilities: compiledPrompt.capabilities,
        tools: compiledPrompt.tools,
        generatedAt: compiledPrompt.compiledAt,
        model: 'template-only',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        templateName: compiledPrompt.templateName,
      };
    }

    // ===== STEP 3: Build KB sections for enrichment =====
    const kbSections = buildKBSections(businessContext);

    // ===== STEP 4: Enrich with Gemini =====
    const enrichmentPrompt = GEMINI_ENRICHMENT_META_PROMPT
      .replace('{basePrompt}', compiledPrompt.basePrompt)
      .replace('{faqs}', kbSections.faqs || 'No hay FAQs disponibles.')
      .replace('{policies}', kbSections.policies || 'No hay políticas específicas.')
      .replace('{articles}', kbSections.articles || 'No hay artículos de conocimiento.')
      .replace('{customInstructions}', kbSections.customInstructions || 'Sin instrucciones adicionales.');

    console.log(`[HybridVoicePrompt] Calling Gemini for KB enrichment...`);

    const geminiResult = await generateWithGemini(enrichmentPrompt, {
      model: DEFAULT_GEMINI_MODELS.PROMPT_GENERATION,
      temperature: 0.3, // Low temperature for consistent output
      maxOutputTokens: 8192,
    });

    if (!geminiResult.success || !geminiResult.content) {
      console.warn('[HybridVoicePrompt] Gemini enrichment failed, using template-only');

      return {
        success: true,
        prompt: compiledPrompt.basePrompt,
        firstMessage: compiledPrompt.firstMessage,
        capabilities: compiledPrompt.capabilities,
        tools: compiledPrompt.tools,
        generatedAt: compiledPrompt.compiledAt,
        model: 'template-only-gemini-failed',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        templateName: compiledPrompt.templateName,
      };
    }

    // ===== STEP 5: Clean and validate enriched prompt =====
    let enrichedPrompt = geminiResult.content;
    enrichedPrompt = enrichedPrompt.replace(/^```[\w]*\n?/gm, '');
    enrichedPrompt = enrichedPrompt.replace(/\n?```$/gm, '');
    enrichedPrompt = enrichedPrompt.trim();

    // Validate that enriched prompt still has the core sections
    const hasIdentity = enrichedPrompt.includes('# SALUDO INICIAL') ||
                        enrichedPrompt.includes('# PERSONALIDAD');
    const hasInstructions = enrichedPrompt.includes('# TAREA') ||
                           enrichedPrompt.includes('# RESERVAS') ||
                           enrichedPrompt.includes('# CITAS');

    if (!hasIdentity || !hasInstructions) {
      console.warn('[HybridVoicePrompt] Enriched prompt missing core sections, using template-only');

      return {
        success: true,
        prompt: compiledPrompt.basePrompt,
        firstMessage: compiledPrompt.firstMessage,
        capabilities: compiledPrompt.capabilities,
        tools: compiledPrompt.tools,
        generatedAt: compiledPrompt.compiledAt,
        model: 'template-only-validation-failed',
        processingTimeMs: Date.now() - startTime,
        kbEnriched: false,
        templateName: compiledPrompt.templateName,
      };
    }

    const processingTime = Date.now() - startTime;
    console.log(`[HybridVoicePrompt] Successfully enriched prompt in ${processingTime}ms`);

    return {
      success: true,
      prompt: enrichedPrompt,
      firstMessage: compiledPrompt.firstMessage,
      capabilities: compiledPrompt.capabilities,
      tools: compiledPrompt.tools,
      generatedAt: new Date().toISOString(),
      model: geminiResult.model,
      processingTimeMs: processingTime,
      kbEnriched: true,
      templateName: compiledPrompt.templateName,
    };

  } catch (error) {
    console.error('[HybridVoicePrompt] Unexpected error:', error);

    return {
      success: false,
      prompt: '',
      firstMessage: '',
      capabilities: [],
      tools: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      generatedAt: new Date().toISOString(),
      model: 'error',
      processingTimeMs: Date.now() - startTime,
      kbEnriched: false,
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Build KB sections for enrichment prompt
 */
function buildKBSections(context: BusinessContext): {
  faqs: string;
  policies: string;
  articles: string;
  customInstructions: string;
} {
  // FAQs
  let faqs = '';
  if (context.faqs && context.faqs.length > 0) {
    faqs = context.faqs
      .slice(0, 10) // Limit to 10 FAQs
      .map(f => `P: ${f.question}\nR: ${f.answer}`)
      .join('\n\n');
  }

  // Policies
  let policies = '';
  if (context.businessPolicies && context.businessPolicies.length > 0) {
    policies = context.businessPolicies
      .slice(0, 5) // Limit to 5 policies
      .map(p => `**${p.title}:** ${p.policy}`)
      .join('\n\n');
  }

  // Knowledge Articles
  let articles = '';
  if (context.knowledgeArticles && context.knowledgeArticles.length > 0) {
    articles = context.knowledgeArticles
      .slice(0, 5) // Limit to 5 articles
      .map(a => `**${a.title}** (${a.category}):\n${a.content.substring(0, 500)}...`)
      .join('\n\n');
  }

  // Custom Instructions
  let customInstructions = '';
  if (context.customInstructionsList && context.customInstructionsList.length > 0) {
    customInstructions = context.customInstructionsList
      .slice(0, 5) // Limit to 5 instructions
      .map(i => `- ${i.title}: ${i.instruction}`)
      .join('\n');
  }

  return { faqs, policies, articles, customInstructions };
}

// =====================================================
// EXPORTS
// =====================================================

export const HybridVoicePromptService = {
  generateHybridVoicePrompt,
};
