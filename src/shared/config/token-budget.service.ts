// =====================================================
// TIS TIS PLATFORM - Token Budget Service
// Protege contra saturación de prompts por exceso de KB
// =====================================================
// Este servicio implementa truncado inteligente del contenido
// del Knowledge Base cuando excede el presupuesto de tokens
// del plan del tenant.
//
// PROBLEMA QUE RESUELVE:
// Plan Growth permite 100 artículos × ~125 tokens = 12,500 tokens
// Más instrucciones, políticas, etc. = ~22,000+ tokens potenciales
// Pero maxPromptTokens de Growth = 16,000
// Sin protección, el prompt excedería el límite y saturaría al LLM.
//
// SOLUCIÓN:
// 1. Estimar tokens del contenido KB
// 2. Priorizar por importancia (instrucciones > políticas > artículos)
// 3. Truncar los menos importantes primero
// 4. Respetar el presupuesto del plan
// =====================================================

import { getPlanKBLimits, DEFAULT_KB_LIMITS, type KnowledgeBaseLimits } from './plans';

// ======================
// TYPES
// ======================

export interface KBContent {
  instructions: Array<{ type: string; title: string; instruction: string }>;
  policies: Array<{ type: string; title: string; policy: string }>;
  articles: Array<{ category: string; title: string; content: string; tags?: string[] }>;
  templates: Array<{ triggerType: string; name: string; template: string }>;
  competitors: Array<{ competitorName: string; responseStrategy: string; keyDifferentiators?: string[] }>;
}

export interface TruncatedKBContent extends KBContent {
  // Metadata sobre el truncado
  _tokenBudget: {
    planId: string;
    maxTokens: number;
    estimatedTokensBefore: number;
    estimatedTokensAfter: number;
    wasTruncated: boolean;
    truncationDetails?: {
      instructionsKept: number;
      instructionsTotal: number;
      policiesKept: number;
      policiesTotal: number;
      articlesKept: number;
      articlesTotal: number;
      templatesKept: number;
      templatesTotal: number;
      competitorsKept: number;
      competitorsTotal: number;
    };
  };
}

export interface TokenEstimate {
  total: number;
  breakdown: {
    instructions: number;
    policies: number;
    articles: number;
    templates: number;
    competitors: number;
  };
}

// ======================
// CONSTANTS
// ======================

/**
 * Factor de conversión caracteres → tokens
 * GPT y modelos similares: ~4 caracteres = 1 token
 * Usamos 3.5 para ser más conservadores (mejor subestimar que pasarse)
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Tokens de overhead por item (formato, separadores, etc.)
 * Cada [TYPE] Title: content\n agrega ~15-20 tokens de formato
 */
const OVERHEAD_PER_ITEM = 15;

/**
 * Tokens reservados para el resto del prompt (no-KB)
 * Incluye: meta-prompt, instrucciones, reglas de canal, etc.
 * Aproximadamente 3000-4000 tokens fijos
 */
const RESERVED_BASE_PROMPT_TOKENS = 4000;

/**
 * Prioridad de categorías KB (mayor = más importante, se trunca último)
 * - Instrucciones esenciales (identity, greeting): máxima prioridad
 * - Políticas: alta prioridad (afectan comportamiento legal/negocio)
 * - Competidores: media-alta (diferenciación)
 * - Templates: media (mejoran respuestas pero no son críticos)
 * - Artículos: menor prioridad (información expandida)
 */
const CATEGORY_PRIORITY: Record<keyof KBContent, number> = {
  instructions: 100,  // Crítico - define comportamiento
  policies: 80,       // Alto - reglas de negocio
  competitors: 60,    // Medio-alto - diferenciación
  templates: 40,      // Medio - mejora UX
  articles: 20,       // Bajo - info expandida
};

/**
 * Tipos de instrucciones con prioridad interna
 * Para truncar instrucciones, quitamos las menos críticas primero
 */
const INSTRUCTION_TYPE_PRIORITY: Record<string, number> = {
  identity: 100,        // Quién es el agente - NUNCA truncar
  greeting: 90,         // Cómo saluda - muy importante
  farewell: 85,         // Cómo se despide
  forbidden: 80,        // Lo que NO puede hacer - crítico para safety
  always_mention: 75,   // Lo que siempre debe mencionar
  pricing_policy: 70,   // Cómo manejar precios
  special_cases: 65,    // Casos especiales
  competitors: 60,      // Manejo de competencia
  objections: 55,       // Manejo de objeciones
  upsell: 50,           // Ventas adicionales
  tone_examples: 45,    // Ejemplos de tono
  custom: 40,           // Instrucciones custom - menor prioridad
};

// ======================
// ESTIMATION FUNCTIONS
// ======================

/**
 * Estima tokens de un texto
 */
function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estima tokens de una instrucción formateada
 */
function estimateInstructionTokens(item: { type: string; title: string; instruction: string }): number {
  // Formato: [TYPE] Title: instruction
  const formatted = `[${item.type.toUpperCase()}] ${item.title}: ${item.instruction}`;
  return estimateTokens(formatted) + OVERHEAD_PER_ITEM;
}

/**
 * Estima tokens de una política formateada
 */
function estimatePolicyTokens(item: { type: string; title: string; policy: string }): number {
  const formatted = `[${item.type.toUpperCase()}] ${item.title}: ${item.policy}`;
  return estimateTokens(formatted) + OVERHEAD_PER_ITEM;
}

/**
 * Estima tokens de un artículo formateado
 */
function estimateArticleTokens(item: { category: string; title: string; content: string; tags?: string[] }): number {
  const tagsStr = item.tags?.length ? ` (Tags: ${item.tags.join(', ')})` : '';
  const formatted = `[${item.category.toUpperCase()}] ${item.title}${tagsStr}:\n${item.content}`;
  return estimateTokens(formatted) + OVERHEAD_PER_ITEM;
}

/**
 * Estima tokens de un template formateado
 */
function estimateTemplateTokens(item: { triggerType: string; name: string; template: string }): number {
  const formatted = `[${item.triggerType.toUpperCase()}] ${item.name}:\n"${item.template}"`;
  return estimateTokens(formatted) + OVERHEAD_PER_ITEM;
}

/**
 * Estima tokens de un competidor formateado
 */
function estimateCompetitorTokens(item: { competitorName: string; responseStrategy: string; keyDifferentiators?: string[] }): number {
  const diffStr = item.keyDifferentiators?.length ? `\n  Diferenciadores: ${item.keyDifferentiators.join(', ')}` : '';
  const formatted = `- ${item.competitorName}: ${item.responseStrategy}${diffStr}`;
  return estimateTokens(formatted) + OVERHEAD_PER_ITEM;
}

/**
 * Calcula estimación completa de tokens para todo el KB content
 */
export function estimateKBTokens(content: KBContent): TokenEstimate {
  const instructionsTokens = content.instructions.reduce((sum, i) => sum + estimateInstructionTokens(i), 0);
  const policiesTokens = content.policies.reduce((sum, p) => sum + estimatePolicyTokens(p), 0);
  const articlesTokens = content.articles.reduce((sum, a) => sum + estimateArticleTokens(a), 0);
  const templatesTokens = content.templates.reduce((sum, t) => sum + estimateTemplateTokens(t), 0);
  const competitorsTokens = content.competitors.reduce((sum, c) => sum + estimateCompetitorTokens(c), 0);

  return {
    total: instructionsTokens + policiesTokens + articlesTokens + templatesTokens + competitorsTokens,
    breakdown: {
      instructions: instructionsTokens,
      policies: policiesTokens,
      articles: articlesTokens,
      templates: templatesTokens,
      competitors: competitorsTokens,
    },
  };
}

// ======================
// TRUNCATION FUNCTIONS
// ======================

/**
 * Ordena instrucciones por prioridad (las más importantes primero)
 */
function sortInstructionsByPriority<T extends { type: string }>(instructions: T[]): T[] {
  return [...instructions].sort((a, b) => {
    const priorityA = INSTRUCTION_TYPE_PRIORITY[a.type] ?? 30;
    const priorityB = INSTRUCTION_TYPE_PRIORITY[b.type] ?? 30;
    return priorityB - priorityA; // Mayor prioridad primero
  });
}

/**
 * Trunca un array de items hasta que quepa en el presupuesto
 * Retorna los items que caben, priorizando los primeros
 */
function truncateToTokenBudget<T>(
  items: T[],
  budget: number,
  estimateFn: (item: T) => number
): { kept: T[]; tokensUsed: number } {
  const kept: T[] = [];
  let tokensUsed = 0;

  for (const item of items) {
    const itemTokens = estimateFn(item);
    if (tokensUsed + itemTokens <= budget) {
      kept.push(item);
      tokensUsed += itemTokens;
    } else {
      // No cabe, dejar de agregar
      break;
    }
  }

  return { kept, tokensUsed };
}

// ======================
// MAIN SERVICE FUNCTION
// ======================

/**
 * Trunca el contenido del KB para que quepa en el presupuesto de tokens del plan
 *
 * @param content - Contenido completo del KB
 * @param planId - ID del plan del tenant (starter, essentials, growth)
 * @returns Contenido truncado con metadata
 *
 * @example
 * ```ts
 * const truncated = truncateKBToTokenBudget(kbContent, 'growth');
 * if (truncated._tokenBudget.wasTruncated) {
 *   console.log('KB fue truncado para caber en presupuesto');
 *   console.log('Artículos mantenidos:', truncated._tokenBudget.truncationDetails?.articlesKept);
 * }
 * ```
 */
export function truncateKBToTokenBudget(
  content: KBContent,
  planId: string = 'starter'
): TruncatedKBContent {
  // Obtener límites del plan
  const limits = getPlanKBLimits(planId);
  const maxTokens = limits.maxPromptTokens;

  // Calcular presupuesto disponible para KB (restando base prompt)
  const kbBudget = Math.max(0, maxTokens - RESERVED_BASE_PROMPT_TOKENS);

  // Estimar tokens actuales
  const estimateBefore = estimateKBTokens(content);

  // Si ya cabe, retornar sin modificar
  if (estimateBefore.total <= kbBudget) {
    return {
      ...content,
      _tokenBudget: {
        planId,
        maxTokens,
        estimatedTokensBefore: estimateBefore.total,
        estimatedTokensAfter: estimateBefore.total,
        wasTruncated: false,
      },
    };
  }

  // --- TRUNCADO INTELIGENTE ---
  // Estrategia: Asignar presupuesto proporcional a prioridad
  // Luego truncar cada categoría a su presupuesto

  const totalPriority = Object.values(CATEGORY_PRIORITY).reduce((a, b) => a + b, 0);

  // Calcular presupuesto por categoría basado en prioridad
  const budgets = {
    instructions: Math.floor(kbBudget * (CATEGORY_PRIORITY.instructions / totalPriority)),
    policies: Math.floor(kbBudget * (CATEGORY_PRIORITY.policies / totalPriority)),
    competitors: Math.floor(kbBudget * (CATEGORY_PRIORITY.competitors / totalPriority)),
    templates: Math.floor(kbBudget * (CATEGORY_PRIORITY.templates / totalPriority)),
    articles: Math.floor(kbBudget * (CATEGORY_PRIORITY.articles / totalPriority)),
  };

  // Truncar cada categoría

  // 1. Instrucciones (ordenadas por prioridad interna)
  const sortedInstructions = sortInstructionsByPriority(content.instructions);
  const { kept: keptInstructions, tokensUsed: instructionsUsed } = truncateToTokenBudget(
    sortedInstructions,
    budgets.instructions,
    estimateInstructionTokens
  );

  // 2. Políticas
  const { kept: keptPolicies, tokensUsed: policiesUsed } = truncateToTokenBudget(
    content.policies,
    budgets.policies,
    estimatePolicyTokens
  );

  // 3. Competidores
  const { kept: keptCompetitors, tokensUsed: competitorsUsed } = truncateToTokenBudget(
    content.competitors,
    budgets.competitors,
    estimateCompetitorTokens
  );

  // 4. Templates
  const { kept: keptTemplates, tokensUsed: templatesUsed } = truncateToTokenBudget(
    content.templates,
    budgets.templates,
    estimateTemplateTokens
  );

  // 5. Artículos (menor prioridad - se truncan más)
  // Si sobra espacio de otras categorías, dárselo a artículos
  const usedByOthers = instructionsUsed + policiesUsed + competitorsUsed + templatesUsed;
  const articlesBudget = Math.max(budgets.articles, kbBudget - usedByOthers);

  const { kept: keptArticles, tokensUsed: articlesUsed } = truncateToTokenBudget(
    content.articles,
    articlesBudget,
    estimateArticleTokens
  );

  // Calcular tokens finales
  const estimatedTokensAfter = instructionsUsed + policiesUsed + articlesUsed + templatesUsed + competitorsUsed;

  return {
    instructions: keptInstructions,
    policies: keptPolicies,
    articles: keptArticles,
    templates: keptTemplates,
    competitors: keptCompetitors,
    _tokenBudget: {
      planId,
      maxTokens,
      estimatedTokensBefore: estimateBefore.total,
      estimatedTokensAfter,
      wasTruncated: true,
      truncationDetails: {
        instructionsKept: keptInstructions.length,
        instructionsTotal: content.instructions.length,
        policiesKept: keptPolicies.length,
        policiesTotal: content.policies.length,
        articlesKept: keptArticles.length,
        articlesTotal: content.articles.length,
        templatesKept: keptTemplates.length,
        templatesTotal: content.templates.length,
        competitorsKept: keptCompetitors.length,
        competitorsTotal: content.competitors.length,
      },
    },
  };
}

/**
 * Verifica si el KB content excede el presupuesto de tokens
 */
export function wouldExceedTokenBudget(content: KBContent, planId: string = 'starter'): boolean {
  const limits = getPlanKBLimits(planId);
  const kbBudget = Math.max(0, limits.maxPromptTokens - RESERVED_BASE_PROMPT_TOKENS);
  const estimate = estimateKBTokens(content);
  return estimate.total > kbBudget;
}

/**
 * Obtiene un resumen del estado de tokens para mostrar en UI
 */
export function getTokenBudgetSummary(content: KBContent, planId: string = 'starter'): {
  planId: string;
  maxTokens: number;
  kbBudget: number;
  currentTokens: number;
  percentUsed: number;
  isOverBudget: boolean;
  breakdown: TokenEstimate['breakdown'];
} {
  const limits = getPlanKBLimits(planId);
  const kbBudget = Math.max(0, limits.maxPromptTokens - RESERVED_BASE_PROMPT_TOKENS);
  const estimate = estimateKBTokens(content);
  const percentUsed = kbBudget > 0 ? Math.round((estimate.total / kbBudget) * 100) : 0;

  return {
    planId,
    maxTokens: limits.maxPromptTokens,
    kbBudget,
    currentTokens: estimate.total,
    percentUsed,
    isOverBudget: estimate.total > kbBudget,
    breakdown: estimate.breakdown,
  };
}

// ======================
// EXPORTS
// ======================

export const TokenBudgetService = {
  estimateKBTokens,
  truncateKBToTokenBudget,
  wouldExceedTokenBudget,
  getTokenBudgetSummary,
  CHARS_PER_TOKEN,
  RESERVED_BASE_PROMPT_TOKENS,
  CATEGORY_PRIORITY,
  INSTRUCTION_TYPE_PRIORITY,
};

export default TokenBudgetService;
