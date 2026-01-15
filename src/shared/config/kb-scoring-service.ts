// =====================================================
// TIS TIS PLATFORM - Knowledge Base Scoring Service
// Servicio principal que calcula el score completo del KB
// =====================================================

import type { VerticalType } from './verticals';
import {
  type KBScoringResult,
  type CategoryScore,
  type ScoringRecommendation,
  type ScoringCategory,
  type KBDataForScoring,
  type FieldQualityResult,
  CATEGORY_WEIGHTS,
  CATEGORY_LABELS,
  QUALITY_THRESHOLDS,
  getFieldsForVertical,
  scoreToStatus,
  getCategoryIcon,
} from './kb-scoring-engine';
import {
  validateAllFields,
  calculateCategoryScore,
  calculateTotalScore,
} from './kb-quality-validators';

// ======================
// MAIN SCORING FUNCTION
// ======================

/**
 * Calcula el score completo del Knowledge Base
 * Esta es la función principal que debe llamarse desde el componente
 */
export function calculateKBScore(
  data: KBDataForScoring,
  vertical: VerticalType = 'dental'
): KBScoringResult {
  // Validar todos los campos
  const fieldResults = validateAllFields(data, vertical);

  // Calcular scores por categoría
  const categories: ScoringCategory[] = ['core_data', 'personality', 'policies', 'knowledge', 'advanced'];

  // Issue #7: Construir objeto de scores de forma segura
  const categoryScores = {} as Record<ScoringCategory, CategoryScore>;

  for (const category of categories) {
    const categoryResult = calculateCategoryScore(category, fieldResults);
    // CICLO 2: Fallback a 0 (no 1) para categorías sin definición
    const weight = CATEGORY_WEIGHTS[category] ?? 0;

    // Guardias contra NaN
    const safeScore = Number.isFinite(categoryResult.score) ? categoryResult.score : 0;
    const safeWeight = Number.isFinite(weight) ? weight : 1;

    categoryScores[category] = {
      category,
      label: CATEGORY_LABELS[category],
      score: safeScore,
      maxScore: safeWeight,
      earnedPoints: Math.round((safeScore / 100) * safeWeight),
      possiblePoints: safeWeight,
      completedFields: categoryResult.completedFields,
      totalFields: categoryResult.totalFields,
      status: scoreToStatus(safeScore),
    };
  }

  // Calcular score total con guardia NaN
  const rawTotalScore = calculateTotalScore(fieldResults);
  const totalScore = Number.isFinite(rawTotalScore) ? rawTotalScore : 0;

  // Calcular estadísticas
  const stats = calculateStats(fieldResults);

  // Generar recomendaciones ordenadas por impacto
  const recommendations = generateRecommendations(fieldResults, vertical);

  return {
    totalScore,
    categoryScores,
    fieldResults,
    stats,
    recommendations,
    vertical,
    calculatedAt: new Date().toISOString(),
    version: '2.0.0',
  };
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Calcula estadísticas del KB
 */
function calculateStats(fieldResults: FieldQualityResult[]): KBScoringResult['stats'] {
  return {
    totalFields: fieldResults.length,
    completedFields: fieldResults.filter(f => f.status === 'complete').length,
    fieldsWithIssues: fieldResults.filter(f => f.issues.length > 0).length,
    criticalMissing: fieldResults.filter(
      f => f.status === 'missing' && f.maxPossibleScore >= 5
    ).length,
    placeholdersDetected: fieldResults.filter(f => f.isPlaceholder).length,
  };
}

/**
 * Genera recomendaciones ordenadas por impacto potencial
 */
function generateRecommendations(
  fieldResults: FieldQualityResult[],
  vertical: VerticalType
): ScoringRecommendation[] {
  const recommendations: ScoringRecommendation[] = [];
  const fields = getFieldsForVertical(vertical);

  for (const result of fieldResults) {
    const field = fields.find(f => f.key === result.fieldKey);
    if (!field) continue;

    // Calcular impacto potencial (puntos que se ganarían)
    const potentialGain = result.maxPossibleScore - result.weightedScore;

    if (potentialGain <= 0) continue;

    // Determinar prioridad
    let priority: ScoringRecommendation['priority'] = 'low';

    if (result.status === 'missing' && field.priority === 'essential') {
      priority = 'critical';
    } else if (result.status === 'placeholder') {
      priority = 'critical';
    } else if (result.status === 'missing' && field.priority === 'recommended') {
      priority = 'high';
    } else if (result.issues.some(i => i.severity === 'critical')) {
      priority = 'high';
    } else if (potentialGain >= 5) {
      priority = 'medium';
    }

    // Generar mensaje y sugerencia
    let message = '';
    let suggestion = '';

    switch (result.status) {
      case 'missing':
        message = `${result.fieldLabel} no está configurado`;
        suggestion = `Configura ${result.fieldLabel} para mejorar las respuestas del agente`;
        break;
      case 'placeholder':
        message = `${result.fieldLabel} contiene contenido de prueba`;
        suggestion = 'Reemplaza con información real y específica de tu negocio';
        break;
      case 'partial':
        // Guardia contra división por cero
        const maxScore = result.maxPossibleScore || 1;
        const percentage = Math.round((result.weightedScore / maxScore) * 100);
        message = `${result.fieldLabel} está incompleto (${percentage}%)`;
        suggestion = result.suggestions[0] || 'Completa con más detalles';
        break;
      default:
        if (result.isGeneric) {
          message = `${result.fieldLabel} es muy genérico`;
          suggestion = 'Personaliza con detalles específicos de tu negocio';
        } else if (result.issues.length > 0) {
          message = result.issues[0].message;
          suggestion = result.issues[0].suggestion || 'Revisa y mejora el contenido';
        }
    }

    if (message) {
      recommendations.push({
        priority,
        fieldKey: result.fieldKey,
        fieldLabel: result.fieldLabel,
        category: result.category,
        message,
        suggestion,
        estimatedImpact: potentialGain,
      });
    }
  }

  // Ordenar por prioridad e impacto
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.estimatedImpact - a.estimatedImpact;
  });
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Determina si el KB está listo para producción
 */
export function isProductionReady(result: KBScoringResult): boolean {
  return result.totalScore >= QUALITY_THRESHOLDS.MIN_PRODUCTION_READY &&
         result.stats.criticalMissing === 0 &&
         result.stats.placeholdersDetected === 0;
}

/**
 * Determina si el KB puede generar prompts de calidad aceptable
 */
export function canGenerateQualityPrompts(result: KBScoringResult): boolean {
  return result.totalScore >= QUALITY_THRESHOLDS.MIN_PROMPT_QUALITY;
}

/**
 * Obtiene el siguiente paso más importante a completar
 */
export function getNextStep(result: KBScoringResult): ScoringRecommendation | null {
  return result.recommendations[0] || null;
}

/**
 * Formatea el score para mostrar en UI
 */
export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Obtiene un resumen de texto del estado del KB
 */
export function getKBStatusSummary(result: KBScoringResult): {
  title: string;
  description: string;
  emoji: string;
  color: 'green' | 'blue' | 'amber' | 'red';
} {
  if (result.totalScore >= 90) {
    return {
      title: 'Excelente',
      description: 'Tu Base de Conocimiento está completa y optimizada',
      emoji: '🌟',
      color: 'green',
    };
  }

  if (result.totalScore >= 70) {
    return {
      title: 'Bueno',
      description: 'Tu agente tiene buena información, pero puede mejorar',
      emoji: '✅',
      color: 'blue',
    };
  }

  if (result.totalScore >= 50) {
    return {
      title: 'En Progreso',
      description: 'Completa más campos para mejorar las respuestas',
      emoji: '🔄',
      color: 'amber',
    };
  }

  return {
    title: 'Requiere Atención',
    description: 'Tu agente necesita más información para responder bien',
    emoji: '⚠️',
    color: 'red',
  };
}

/**
 * Convierte los datos del API al formato necesario para scoring
 * Función de compatibilidad con la estructura actual de KnowledgeBase.tsx
 * Issue #28: Agregar guardias para arrays undefined
 */
export function convertKBDataForScoring(data: {
  instructions?: Array<{ instruction_type?: string; is_active: boolean; instruction?: string; title?: string; id?: string }>;
  policies?: Array<{ policy_type?: string; is_active: boolean; policy_text?: string; title?: string; id?: string }>;
  articles?: Array<{ category?: string; is_active: boolean; content?: string; title?: string; id?: string }>;
  templates?: Array<{ trigger_type?: string; is_active: boolean; template_text?: string; name?: string; id?: string }>;
  competitors?: Array<{ is_active: boolean; competitor_name?: string; response_strategy?: string; id?: string }>;
}, additionalData?: {
  services?: Array<{ id: string; name?: string; is_active: boolean }>;
  branches?: Array<{ id: string; name?: string; operating_hours?: Record<string, unknown>; is_active: boolean }>;
  staff?: Array<{ id: string; first_name?: string; last_name?: string; role?: string; is_active: boolean }>;
}): KBDataForScoring {
  // Guardias contra arrays undefined
  const safeInstructions = data?.instructions ?? [];
  const safePolicies = data?.policies ?? [];
  const safeArticles = data?.articles ?? [];
  const safeTemplates = data?.templates ?? [];
  const safeCompetitors = data?.competitors ?? [];

  return {
    instructions: safeInstructions.map(i => ({
      id: i.id || '',
      instruction_type: i.instruction_type,
      title: i.title,
      instruction: i.instruction,
      is_active: i.is_active ?? false,
    })),
    policies: safePolicies.map(p => ({
      id: p.id || '',
      policy_type: p.policy_type,
      title: p.title,
      policy_text: p.policy_text,
      is_active: p.is_active ?? false,
    })),
    articles: safeArticles.map(a => ({
      id: a.id || '',
      category: a.category,
      title: a.title,
      content: a.content,
      is_active: a.is_active ?? false,
    })),
    templates: safeTemplates.map(t => ({
      id: t.id || '',
      trigger_type: t.trigger_type,
      name: t.name,
      template_text: t.template_text,
      is_active: t.is_active ?? false,
    })),
    competitors: safeCompetitors.map(c => ({
      id: c.id || '',
      competitor_name: c.competitor_name,
      response_strategy: c.response_strategy,
      is_active: c.is_active ?? false,
    })),
    services: additionalData?.services ?? [],
    branches: additionalData?.branches ?? [],
    staff: additionalData?.staff ?? [],
  };
}

// ======================
// EXPORTS
// ======================

export const KBScoringService = {
  calculateKBScore,
  isProductionReady,
  canGenerateQualityPrompts,
  getNextStep,
  formatScore,
  getKBStatusSummary,
  convertKBDataForScoring,
};
