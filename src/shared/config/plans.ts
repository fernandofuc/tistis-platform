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

  // Límites
  branchLimit: number;
  includedBranches: number;

  // Pricing de sucursales extra
  branchExtraPriceCentavos: number;
  branchExtraPricePesos: number;
  branchProgressivePricing?: BranchProgressiveTier[];

  // Features
  conversationsPerMonth: number | 'unlimited';
  features: string[];

  // Metadata
  isPopular?: boolean;
  order: number;
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

    conversationsPerMonth: 500,
    features: [
      'Asistente IA 24/7 en WhatsApp',
      'Hasta 500 conversaciones/mes',
      'Dashboard básico',
      'Soporte por email',
      '1 sucursal incluida',
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

    conversationsPerMonth: 2000,
    features: [
      'Todo lo de Starter',
      'Hasta 2,000 conversaciones/mes',
      'Integración con sistemas existentes',
      'Soporte prioritario',
      'Call de configuración en 30 min',
      'Hasta 8 sucursales',
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

    conversationsPerMonth: 'unlimited',
    features: [
      'Todo lo de Essentials',
      'Conversaciones ilimitadas',
      'Multi-canal (WhatsApp, Web, Email)',
      'Soporte 24/7',
      'Call de configuración en 30 min',
      'Hasta 20 sucursales',
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
// EXPORTS
// ======================

export default PLAN_CONFIG;
