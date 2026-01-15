// =====================================================
// TIS TIS PLATFORM - Centralized Plan Configuration
// Single source of truth for all plan-related data
// =====================================================

// ======================
// TYPES
// ======================

export interface PlanConfig {
  id: string;
  name: string;
  displayName: string;

  // Precios en MXN centavos (para Stripe)
  monthlyPriceCentavos: number;

  // Precios en MXN pesos (para display)
  monthlyPricePesos: number;

  // Límites de Sucursales
  branchLimit: number;
  includedBranches: number;

  // Pricing de sucursales extra
  branchExtraPriceCentavos: number;
  branchExtraPricePesos: number;
  branchProgressivePricing?: BranchProgressiveTier[];

  // Límites de Knowledge Base
  knowledgeBaseLimits: KnowledgeBaseLimits;

  // Features
  conversationsPerMonth: number | 'unlimited';
  features: string[];

  // Metadata
  isPopular?: boolean;
  order: number;
}

/**
 * Límites de Knowledge Base por plan
 * Define cuántos items de cada tipo puede crear el usuario
 */
export interface KnowledgeBaseLimits {
  /** Instrucciones personalizadas (identity, greeting, objections, etc.) */
  instructions: number;
  /** Políticas del negocio (cancelación, pagos, garantías) */
  policies: number;
  /** Artículos de conocimiento (about_us, tecnología, etc.) */
  articles: number;
  /** Plantillas de respuesta (greeting, farewell, etc.) */
  templates: number;
  /** Manejo de competidores */
  competitors: number;
  /** Token budget máximo para el prompt generado (previene explosion) */
  maxPromptTokens: number;
}

export interface BranchProgressiveTier {
  branchNumber: number; // 2, 3, 4, 5, etc.
  priceCentavos: number;
  pricePesos: number;
}

// ======================
// PLAN CONFIGURATION
// ======================

export const PLAN_CONFIG: Record<string, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    displayName: 'TIS TIS Starter',

    monthlyPriceCentavos: 349000,
    monthlyPricePesos: 3490,

    branchLimit: 1,
    includedBranches: 1,

    branchExtraPriceCentavos: 159000,
    branchExtraPricePesos: 1590,
    // Starter no tiene pricing progresivo (no puede agregar sucursales)

    // Knowledge Base - Límites conservadores para plan básico
    knowledgeBaseLimits: {
      instructions: 5,      // 5 instrucciones personalizadas
      policies: 3,          // 3 políticas de negocio
      articles: 5,          // 5 artículos de conocimiento
      templates: 3,         // 3 plantillas de respuesta
      competitors: 2,       // 2 competidores
      maxPromptTokens: 4000, // ~4k tokens máximo en prompt
    },

    conversationsPerMonth: 500,
    features: [
      'Asistente IA 24/7 en WhatsApp',
      'Hasta 500 conversaciones/mes',
      'Dashboard básico',
      'Soporte por email',
      '1 sucursal incluida',
      '5 instrucciones personalizadas',
    ],

    order: 1,
  },

  essentials: {
    id: 'essentials',
    name: 'Essentials',
    displayName: 'TIS TIS Essentials',

    monthlyPriceCentavos: 749000,
    monthlyPricePesos: 7490,

    branchLimit: 8,
    includedBranches: 1, // Incluye 1, puede agregar hasta 8 total

    branchExtraPriceCentavos: 199000,
    branchExtraPricePesos: 1990,
    branchProgressivePricing: [
      { branchNumber: 2, priceCentavos: 199000, pricePesos: 1990 },
      { branchNumber: 3, priceCentavos: 179000, pricePesos: 1790 },
      { branchNumber: 4, priceCentavos: 159000, pricePesos: 1590 },
      { branchNumber: 5, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 6, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 7, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 8, priceCentavos: 149000, pricePesos: 1490 },
    ],

    // Knowledge Base - Límites ampliados para negocios en crecimiento
    knowledgeBaseLimits: {
      instructions: 15,     // 15 instrucciones personalizadas
      policies: 10,         // 10 políticas de negocio
      articles: 20,         // 20 artículos de conocimiento
      templates: 10,        // 10 plantillas de respuesta
      competitors: 5,       // 5 competidores
      maxPromptTokens: 8000, // ~8k tokens máximo en prompt
    },

    conversationsPerMonth: 2000,
    features: [
      'Todo lo de Starter',
      'Hasta 2,000 conversaciones/mes',
      'Integración con sistemas existentes',
      'Soporte prioritario',
      'Call de configuración en 30 min',
      'Hasta 8 sucursales',
      '15 instrucciones personalizadas',
      'Base de conocimiento ampliada',
    ],

    isPopular: true,
    order: 2,
  },

  growth: {
    id: 'growth',
    name: 'Growth',
    displayName: 'TIS TIS Growth',

    monthlyPriceCentavos: 1249000,
    monthlyPricePesos: 12490,

    branchLimit: 20,
    includedBranches: 1,

    branchExtraPriceCentavos: 289000,
    branchExtraPricePesos: 2890,
    branchProgressivePricing: [
      { branchNumber: 2, priceCentavos: 289000, pricePesos: 2890 },
      { branchNumber: 3, priceCentavos: 249000, pricePesos: 2490 },
      { branchNumber: 4, priceCentavos: 199000, pricePesos: 1990 },
      { branchNumber: 5, priceCentavos: 159000, pricePesos: 1590 },
      { branchNumber: 6, priceCentavos: 159000, pricePesos: 1590 },
      { branchNumber: 7, priceCentavos: 159000, pricePesos: 1590 },
      { branchNumber: 8, priceCentavos: 159000, pricePesos: 1590 },
      { branchNumber: 9, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 10, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 11, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 12, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 13, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 14, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 15, priceCentavos: 149000, pricePesos: 1490 },
      { branchNumber: 16, priceCentavos: 139000, pricePesos: 1390 },
      { branchNumber: 17, priceCentavos: 139000, pricePesos: 1390 },
      { branchNumber: 18, priceCentavos: 139000, pricePesos: 1390 },
      { branchNumber: 19, priceCentavos: 139000, pricePesos: 1390 },
      { branchNumber: 20, priceCentavos: 139000, pricePesos: 1390 },
    ],

    // Knowledge Base - Límites generosos para empresas grandes
    knowledgeBaseLimits: {
      instructions: 50,     // 50 instrucciones personalizadas
      policies: 25,         // 25 políticas de negocio
      articles: 100,        // 100 artículos de conocimiento
      templates: 30,        // 30 plantillas de respuesta
      competitors: 15,      // 15 competidores
      maxPromptTokens: 16000, // ~16k tokens máximo en prompt
    },

    conversationsPerMonth: 'unlimited',
    features: [
      'Todo lo de Essentials',
      'Conversaciones ilimitadas',
      'Multi-canal (WhatsApp, Web, Email)',
      'Soporte 24/7',
      'Call de configuración en 30 min',
      'Hasta 20 sucursales',
      'Base de conocimiento ilimitada',
      'Instrucciones personalizadas ilimitadas',
    ],

    order: 3,
  },

};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene la configuración de un plan por su ID
 */
export function getPlanConfig(planId: string): PlanConfig | null {
  return PLAN_CONFIG[planId.toLowerCase()] || null;
}

/**
 * Obtiene el límite de sucursales para un plan
 */
export function getPlanBranchLimit(planId: string): number {
  const plan = getPlanConfig(planId);
  return plan?.branchLimit || 1;
}

/**
 * Calcula el costo total de sucursales extra
 * @param planId ID del plan
 * @param totalBranches Número total de sucursales (incluyendo la incluida)
 * @returns Costo en centavos MXN
 */
export function calculateBranchCostCentavos(planId: string, totalBranches: number): number {
  const plan = getPlanConfig(planId);
  if (!plan || totalBranches <= plan.includedBranches) return 0;

  let totalCost = 0;
  const extraBranches = totalBranches - plan.includedBranches;

  if (plan.branchProgressivePricing) {
    for (let i = 0; i < extraBranches; i++) {
      const branchNumber = plan.includedBranches + i + 1; // 2, 3, 4, etc.
      const tier = plan.branchProgressivePricing.find(t => t.branchNumber === branchNumber);

      if (tier) {
        totalCost += tier.priceCentavos;
      } else {
        // Para sucursales más allá de las definidas, usar el último precio conocido
        const lastTier = plan.branchProgressivePricing[plan.branchProgressivePricing.length - 1];
        totalCost += lastTier?.priceCentavos || plan.branchExtraPriceCentavos;
      }
    }
  } else {
    // Precio fijo por sucursal (Starter)
    totalCost = extraBranches * plan.branchExtraPriceCentavos;
  }

  return totalCost;
}

/**
 * Calcula el costo total de sucursales extra en pesos
 */
export function calculateBranchCostPesos(planId: string, totalBranches: number): number {
  return calculateBranchCostCentavos(planId, totalBranches) / 100;
}

/**
 * Obtiene el precio de la siguiente sucursal extra
 * @param planId ID del plan
 * @param currentBranches Número actual de sucursales
 * @returns Precio en pesos MXN de la siguiente sucursal
 */
export function getNextBranchPrice(planId: string, currentBranches: number): number {
  const plan = getPlanConfig(planId);
  if (!plan) return 0;

  // Si ya alcanzó el límite, no puede agregar más
  if (currentBranches >= plan.branchLimit) return 0;

  const nextBranchNumber = currentBranches + 1;

  if (plan.branchProgressivePricing) {
    const tier = plan.branchProgressivePricing.find(t => t.branchNumber === nextBranchNumber);
    if (tier) return tier.pricePesos;

    // Si no hay tier específico, usar el último
    const lastTier = plan.branchProgressivePricing[plan.branchProgressivePricing.length - 1];
    return lastTier?.pricePesos || plan.branchExtraPricePesos;
  }

  return plan.branchExtraPricePesos;
}

/**
 * Verifica si un plan permite agregar más sucursales
 */
export function canAddBranch(planId: string, currentBranches: number): boolean {
  const plan = getPlanConfig(planId);
  if (!plan) return false;
  return currentBranches < plan.branchLimit;
}

/**
 * Obtiene todos los planes ordenados
 */
export function getAllPlans(): PlanConfig[] {
  return Object.values(PLAN_CONFIG).sort((a, b) => a.order - b.order);
}

/**
 * Obtiene el plan recomendado basado en número de sucursales
 */
export function getRecommendedPlan(branchCount: number): PlanConfig {
  const plans = getAllPlans();

  for (const plan of plans) {
    if (branchCount <= plan.branchLimit) {
      return plan;
    }
  }

  // Si ninguno alcanza, retornar Growth (el plan más alto)
  return PLAN_CONFIG.growth;
}

// ======================
// KNOWLEDGE BASE LIMIT HELPERS
// ======================

/** Tipos de items en Knowledge Base */
export type KBItemType = 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors';

/** Límites por defecto (para planes no reconocidos o trial) */
export const DEFAULT_KB_LIMITS: KnowledgeBaseLimits = {
  instructions: 3,
  policies: 2,
  articles: 3,
  templates: 2,
  competitors: 1,
  maxPromptTokens: 2000,
};

/**
 * Obtiene los límites de Knowledge Base para un plan
 * @param planId ID del plan (starter, essentials, growth)
 * @returns Límites de KB o defaults si el plan no existe
 */
export function getPlanKBLimits(planId: string): KnowledgeBaseLimits {
  const plan = getPlanConfig(planId);
  return plan?.knowledgeBaseLimits || DEFAULT_KB_LIMITS;
}

/**
 * Obtiene el límite específico de un tipo de item KB
 * @param planId ID del plan
 * @param itemType Tipo de item (instructions, policies, etc.)
 * @returns Límite numérico para ese tipo
 */
export function getKBItemLimit(planId: string, itemType: KBItemType): number {
  const limits = getPlanKBLimits(planId);
  return limits[itemType];
}

/**
 * Verifica si un plan permite agregar más items de KB
 * @param planId ID del plan
 * @param itemType Tipo de item a agregar
 * @param currentCount Cantidad actual de items de ese tipo
 * @returns true si puede agregar, false si alcanzó el límite
 */
export function canAddKBItem(
  planId: string,
  itemType: KBItemType,
  currentCount: number
): boolean {
  const limit = getKBItemLimit(planId, itemType);
  return currentCount < limit;
}

/**
 * Calcula cuántos items más puede agregar
 * @param planId ID del plan
 * @param itemType Tipo de item
 * @param currentCount Cantidad actual
 * @returns Número de items restantes que puede agregar
 */
export function getRemainingKBItems(
  planId: string,
  itemType: KBItemType,
  currentCount: number
): number {
  const limit = getKBItemLimit(planId, itemType);
  return Math.max(0, limit - currentCount);
}

/**
 * Obtiene el estado de uso de KB para todos los tipos
 * Útil para mostrar en UI el progreso de uso del plan
 */
export interface KBUsageStatus {
  itemType: KBItemType;
  label: string;
  current: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isAtLimit: boolean;
}

/**
 * Labels en español para tipos de KB items
 */
export const KB_ITEM_LABELS: Record<KBItemType, string> = {
  instructions: 'Instrucciones',
  policies: 'Políticas',
  articles: 'Artículos',
  templates: 'Plantillas',
  competitors: 'Competidores',
};

/**
 * Obtiene el estado de uso de KB para un tipo específico
 */
export function getKBUsageStatus(
  planId: string,
  itemType: KBItemType,
  currentCount: number
): KBUsageStatus {
  const limit = getKBItemLimit(planId, itemType);
  const remaining = Math.max(0, limit - currentCount);
  const percentUsed = limit > 0 ? Math.round((currentCount / limit) * 100) : 0;

  return {
    itemType,
    label: KB_ITEM_LABELS[itemType],
    current: currentCount,
    limit,
    remaining,
    percentUsed: Math.min(100, percentUsed),
    isAtLimit: currentCount >= limit,
  };
}

/**
 * Obtiene el estado de uso completo de todos los tipos de KB
 */
export function getFullKBUsageStatus(
  planId: string,
  counts: Record<KBItemType, number>
): KBUsageStatus[] {
  const itemTypes: KBItemType[] = ['instructions', 'policies', 'articles', 'templates', 'competitors'];

  return itemTypes.map(type => getKBUsageStatus(planId, type, counts[type] || 0));
}

/**
 * Verifica si el prompt excedería el límite de tokens del plan
 * @param planId ID del plan
 * @param estimatedTokens Tokens estimados del prompt
 * @returns true si está dentro del límite
 */
export function isWithinTokenBudget(planId: string, estimatedTokens: number): boolean {
  const limits = getPlanKBLimits(planId);
  return estimatedTokens <= limits.maxPromptTokens;
}

/**
 * Obtiene el plan recomendado basado en uso de KB
 * Útil para sugerir upgrade cuando el usuario está cerca del límite
 */
export function getRecommendedPlanForKB(
  counts: Record<KBItemType, number>
): PlanConfig {
  const plans = getAllPlans();

  for (const plan of plans) {
    const limits = plan.knowledgeBaseLimits;
    const fitsAll =
      counts.instructions <= limits.instructions &&
      counts.policies <= limits.policies &&
      counts.articles <= limits.articles &&
      counts.templates <= limits.templates &&
      counts.competitors <= limits.competitors;

    if (fitsAll) {
      return plan;
    }
  }

  // Si ninguno alcanza, retornar Growth (el plan más alto)
  return PLAN_CONFIG.growth;
}

// ======================
// EXPORTS
// ======================

export default PLAN_CONFIG;
