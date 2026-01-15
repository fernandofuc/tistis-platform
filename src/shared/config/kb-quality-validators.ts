// =====================================================
// TIS TIS PLATFORM - Knowledge Base Quality Validators
// Validadores de calidad para contenido del KB
// =====================================================

import type { VerticalType } from './verticals';
import {
  type ScoreableField,
  type FieldQualityResult,
  type FieldStatus,
  type QualityIssue,
  type KBDataForScoring,
  type ScoringCategory,
  QUALITY_THRESHOLDS,
  getFieldsForVertical,
  CATEGORY_WEIGHTS,
} from './kb-scoring-engine';
import {
  detectPlaceholder,
  detectGenericContent,
  type PlaceholderDetectionResult,
} from './kb-placeholder-detection';

// ======================
// TYPES
// ======================

interface ContentExtraction {
  content: string;
  exists: boolean;
  isActive: boolean;
  itemCount: number;
}

// ======================
// CONTENT EXTRACTION
// ======================

/**
 * Extrae el contenido relevante para un campo específico
 */
function extractFieldContent(
  field: ScoreableField,
  data: KBDataForScoring
): ContentExtraction {
  const { dataSource, filterType, countBased } = field;

  let items: Array<{ is_active: boolean; [key: string]: unknown }> = [];
  let contentField = '';

  switch (dataSource) {
    case 'instructions':
      items = data.instructions || [];
      contentField = 'instruction';
      break;
    case 'policies':
      items = data.policies || [];
      contentField = 'policy_text';
      break;
    case 'articles':
      items = data.articles || [];
      contentField = 'content';
      break;
    case 'templates':
      items = data.templates || [];
      contentField = 'template_text';
      break;
    case 'competitors':
      items = data.competitors || [];
      contentField = 'response_strategy';
      break;
    case 'services':
      items = data.services || [];
      contentField = 'name';
      break;
    case 'branches':
      items = data.branches || [];
      contentField = 'name';
      break;
    case 'staff':
      items = data.staff || [];
      contentField = 'first_name';
      break;
  }

  // Filtrar por tipo si aplica
  let filteredItems = items;
  if (filterType) {
    const typeField = dataSource === 'instructions' ? 'instruction_type' :
                     dataSource === 'policies' ? 'policy_type' :
                     dataSource === 'articles' ? 'category' :
                     dataSource === 'templates' ? 'trigger_type' : null;

    if (typeField) {
      filteredItems = items.filter(item =>
        item[typeField] === filterType
      );
    }
  }

  // Filtrar solo activos
  const activeItems = filteredItems.filter(item => item.is_active);

  if (countBased) {
    return {
      content: '',
      exists: activeItems.length > 0,
      isActive: activeItems.length > 0,
      itemCount: activeItems.length,
    };
  }

  // Para campos de contenido único, tomar el primero activo
  const firstActive = activeItems[0];
  const content = firstActive
    ? String(firstActive[contentField] || '')
    : '';

  return {
    content,
    exists: activeItems.length > 0,
    isActive: activeItems.length > 0 && !!content,
    itemCount: activeItems.length,
  };
}

/**
 * Valida si un branch tiene horarios configurados
 */
function validateBranchHours(data: KBDataForScoring): boolean {
  const branches = data.branches || [];
  const activeBranches = branches.filter(b => b.is_active);

  for (const branch of activeBranches) {
    const hours = branch.operating_hours;
    if (hours && typeof hours === 'object' && Object.keys(hours).length > 0) {
      return true;
    }
  }

  return false;
}

// ======================
// SCORE CALCULATIONS
// ======================

/**
 * Calcula existence score (20% del score del campo)
 * - 100 si existe y está activo
 * - 50 si existe pero está desactivado
 * - 0 si no existe
 */
function calculateExistenceScore(
  extraction: ContentExtraction,
  field: ScoreableField
): number {
  if (field.countBased) {
    if (extraction.itemCount >= (field.minCount || 1)) {
      return 100;
    }
    if (extraction.itemCount > 0) {
      return 50;
    }
    return 0;
  }

  if (!extraction.exists) return 0;
  if (!extraction.isActive) return 50;
  return 100;
}

/**
 * Calcula quality score (50% del score del campo)
 * Evalúa:
 * - Longitud del contenido
 * - No es placeholder
 * - No es genérico
 * - Contiene keywords esperados
 */
function calculateQualityScore(
  extraction: ContentExtraction,
  field: ScoreableField,
  placeholderResult: PlaceholderDetectionResult
): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];

  // Guardia: asegurar que field.label siempre tiene valor
  const fieldLabel = field.label || field.key || 'Campo';

  // Para campos count-based, verificar cantidad
  if (field.countBased) {
    const minCount = Math.max(1, field.minCount || 1); // Guardia contra valores <= 0
    const idealCount = Math.max(minCount + 1, minCount * 2);  // Ideal es el doble del mínimo, pero al menos +1

    if (extraction.itemCount === 0) {
      return { score: 0, issues: [{ code: 'NO_ITEMS', severity: 'critical', message: `No hay ${fieldLabel} configurados` }] };
    }

    if (extraction.itemCount < minCount) {
      issues.push({
        code: 'INSUFFICIENT_ITEMS',
        severity: 'warning',
        message: `Solo ${extraction.itemCount} de ${minCount} ${fieldLabel} recomendados`,
      });
      // Guardia: minCount siempre >= 1 aquí, división segura
      return { score: Math.round((extraction.itemCount / minCount) * 70), issues };
    }

    if (extraction.itemCount >= idealCount) {
      return { score: 100, issues };
    }

    // Score lineal entre minCount y idealCount
    // Guardia: idealCount siempre > minCount aquí por la asignación anterior
    const range = idealCount - minCount;
    const ratio = range > 0 ? (extraction.itemCount - minCount) / range : 1;
    return { score: Math.round(70 + ratio * 30), issues };
  }

  // Para campos de contenido
  const { content } = extraction;

  if (!content) {
    return { score: 0, issues: [{ code: 'EMPTY_CONTENT', severity: 'critical', message: 'Contenido vacío' }] };
  }

  // Verificar placeholder
  if (placeholderResult.isPlaceholder) {
    issues.push({
      code: 'PLACEHOLDER_DETECTED',
      severity: 'critical',
      message: `Contenido detectado como placeholder: ${placeholderResult.matchedPatterns.join(', ')}`,
      suggestion: 'Reemplaza con contenido real y específico de tu negocio',
    });
    return { score: 10, issues };
  }

  // Verificar genérico
  if (placeholderResult.isGeneric) {
    issues.push({
      code: 'GENERIC_CONTENT',
      severity: 'warning',
      message: 'Contenido muy genérico detectado',
      suggestion: 'Personaliza con detalles específicos de tu negocio',
    });
  }

  let score = 100;

  // Penalizar por longitud insuficiente
  const contentLength = content.length;
  // Guardias contra valores inválidos (Issue #1, #10: división por cero y score máximo)
  const safeMinLength = Math.max(1, field.minLength || 1);
  const safeIdealLength = Math.max(safeMinLength + 1, field.idealLength || safeMinLength + 1);

  if (contentLength < safeMinLength) {
    // Score 0-70 si no alcanza mínimo (permitir llegar a 100 si supera ideal)
    const ratio = contentLength / safeMinLength;
    score = Math.round(ratio * 70);
    issues.push({
      code: 'TOO_SHORT',
      severity: contentLength < safeMinLength / 2 ? 'critical' : 'warning',
      message: `Contenido muy corto (${contentLength} caracteres, mínimo ${safeMinLength})`,
      suggestion: `Expande a al menos ${safeMinLength} caracteres con más detalles`,
    });
  } else if (contentLength < safeIdealLength) {
    // Score 70-100 entre mínimo e ideal (Issue #10: permitir 100%)
    const range = safeIdealLength - safeMinLength;
    const ratio = range > 0 ? (contentLength - safeMinLength) / range : 1;
    score = Math.round(70 + ratio * 30);
  }
  // else: contentLength >= safeIdealLength → score permanece 100

  // Verificar keywords esperados
  if (field.mustContainKeywords && field.mustContainKeywords.length > 0) {
    const contentLower = content.toLowerCase();
    const missingKeywords = field.mustContainKeywords.filter(
      keyword => !contentLower.includes(keyword.toLowerCase())
    );

    if (missingKeywords.length > 0) {
      const keywordPenalty = (missingKeywords.length / field.mustContainKeywords.length) * 15;
      score = Math.max(0, score - keywordPenalty);
      issues.push({
        code: 'MISSING_KEYWORDS',
        severity: 'info',
        message: `Considera mencionar: ${missingKeywords.join(', ')}`,
      });
    }
  }

  // Penalizar contenido genérico
  if (placeholderResult.isGeneric) {
    score = Math.max(0, score - 20);
  }

  return { score: Math.round(score), issues };
}

/**
 * Calcula completeness score (30% del score del campo)
 * Evalúa qué tan completo está el contenido según expectativas
 */
function calculateCompletenessScore(
  extraction: ContentExtraction,
  field: ScoreableField
): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];

  // Guardia: asegurar que field.label siempre tiene valor
  const fieldLabel = field.label || field.key || 'Campo';

  if (field.countBased) {
    const minCount = Math.max(1, field.minCount || 1); // Guardia contra valores <= 0
    if (extraction.itemCount >= minCount) {
      return { score: 100, issues };
    }
    return {
      score: Math.round((extraction.itemCount / minCount) * 100),
      issues: extraction.itemCount === 0 ? [{
        code: 'INCOMPLETE',
        severity: 'warning',
        message: `Falta configurar ${fieldLabel}`,
      }] : [],
    };
  }

  const { content } = extraction;
  if (!content) {
    return { score: 0, issues: [{ code: 'NOT_CONFIGURED', severity: 'critical', message: `${fieldLabel} no configurado` }] };
  }

  // Guardias contra valores inválidos de longitud
  const minLength = Math.max(1, field.minLength || 1);
  const idealLength = Math.max(minLength + 1, field.idealLength || minLength + 1);

  // Verificar longitud ideal
  if (content.length >= idealLength) {
    return { score: 100, issues };
  }

  if (content.length >= minLength) {
    // Guardia: idealLength siempre > minLength aquí
    const range = idealLength - minLength;
    const ratio = range > 0 ? (content.length - minLength) / range : 1;
    return { score: Math.round(70 + ratio * 30), issues };
  }

  return {
    score: Math.round((content.length / minLength) * 70),
    issues: [{
      code: 'INCOMPLETE',
      severity: 'warning',
      message: `${fieldLabel} podría tener más detalle`,
      suggestion: `Ideal: ${idealLength} caracteres. Actual: ${content.length}`,
    }],
  };
}

// ======================
// MAIN VALIDATION FUNCTION
// ======================

/**
 * Valida un campo específico y retorna su resultado de calidad
 */
export function validateField(
  field: ScoreableField,
  data: KBDataForScoring
): FieldQualityResult {
  // Caso especial: business_hours
  // CICLO 2: Aplicar guardias de seguridad a field.weight
  if (field.key === 'business_hours') {
    const hasHours = validateBranchHours(data);
    const status: FieldStatus = hasHours ? 'complete' : 'missing';
    const safeWeight = Number.isFinite(field.weight) && field.weight > 0 ? field.weight : 1;

    return {
      fieldKey: field.key,
      fieldLabel: field.label || field.key || 'Horarios',
      category: field.category,
      existenceScore: hasHours ? 100 : 0,
      qualityScore: hasHours ? 100 : 0,
      completenessScore: hasHours ? 100 : 0,
      weightedScore: hasHours ? safeWeight : 0,
      maxPossibleScore: safeWeight,
      status,
      issues: hasHours ? [] : [{
        code: 'NO_HOURS',
        severity: 'critical',
        message: 'Sin horarios de atención configurados',
        suggestion: 'Configura los horarios de operación en tus sucursales',
      }],
      suggestions: hasHours ? [] : ['Agrega horarios de atención a al menos una sucursal'],
      contentLength: 0,
      isPlaceholder: false,
      isGeneric: false,
    };
  }

  // Extraer contenido
  const extraction = extractFieldContent(field, data);

  // Detectar placeholders y contenido genérico
  const placeholderResult = field.countBased
    ? { isPlaceholder: false, isGeneric: false, confidence: 0, matchedPatterns: [] }
    : detectPlaceholder(extraction.content);

  // Calcular scores individuales
  const existenceScore = calculateExistenceScore(extraction, field);
  const { score: qualityScore, issues: qualityIssues } = calculateQualityScore(
    extraction,
    field,
    placeholderResult
  );
  const { score: completenessScore, issues: completenessIssues } = calculateCompletenessScore(
    extraction,
    field
  );

  // Combinar issues
  const allIssues = [...qualityIssues, ...completenessIssues];

  // Calcular score ponderado del campo
  // Existence: 20%, Quality: 50%, Completeness: 30%
  // Guardias contra NaN: asegurar que todos los scores son números válidos
  const safeExistenceScore = Number.isFinite(existenceScore) ? existenceScore : 0;
  const safeQualityScore = Number.isFinite(qualityScore) ? qualityScore : 0;
  const safeCompletenessScore = Number.isFinite(completenessScore) ? completenessScore : 0;

  const fieldScore = Math.round(
    safeExistenceScore * 0.20 +
    safeQualityScore * 0.50 +
    safeCompletenessScore * 0.30
  );

  // Calcular weighted score (contribución al score total de la categoría)
  // Guardia adicional contra fieldScore o weight inválidos
  const safeFieldScore = Number.isFinite(fieldScore) ? fieldScore : 0;
  const safeWeight = Number.isFinite(field.weight) && field.weight > 0 ? field.weight : 1;
  const weightedScore = Math.round((safeFieldScore / 100) * safeWeight);

  // Determinar status
  let status: FieldStatus = 'complete';
  if (!extraction.exists) {
    status = 'missing';
  } else if (!extraction.isActive && !field.countBased) {
    status = 'disabled';
  } else if (placeholderResult.isPlaceholder) {
    status = 'placeholder';
  } else if (fieldScore < 50) {
    status = 'partial';
  }

  // Generar sugerencias
  const suggestions: string[] = [];
  const contentLength = extraction.content?.length ?? 0;
  const safeMinLength = Math.max(1, field.minLength || 1);

  if (status === 'missing') {
    suggestions.push(`Configura ${field.label} para mejorar las respuestas del agente`);
  } else if (status === 'placeholder') {
    suggestions.push(`Reemplaza el contenido de prueba con información real`);
  } else if (safeFieldScore < 70) {
    if (contentLength < safeMinLength && !field.countBased) {
      suggestions.push(`Expande ${field.label} a al menos ${safeMinLength} caracteres`);
    }
    if (placeholderResult.isGeneric) {
      suggestions.push(`Personaliza ${field.label} con detalles específicos de tu negocio`);
    }
  }

  return {
    fieldKey: field.key,
    fieldLabel: field.label,
    category: field.category,
    existenceScore: safeExistenceScore,
    qualityScore: safeQualityScore,
    completenessScore: safeCompletenessScore,
    weightedScore,
    maxPossibleScore: safeWeight,
    status,
    issues: allIssues,
    suggestions,
    contentLength,
    isPlaceholder: placeholderResult.isPlaceholder,
    isGeneric: placeholderResult.isGeneric,
  };
}

/**
 * Valida todos los campos para una vertical y retorna resultados completos
 */
export function validateAllFields(
  data: KBDataForScoring,
  vertical: VerticalType
): FieldQualityResult[] {
  const fields = getFieldsForVertical(vertical);
  return fields.map(field => validateField(field, data));
}

/**
 * Calcula el score de una categoría basado en sus campos
 */
export function calculateCategoryScore(
  category: ScoringCategory,
  fieldResults: FieldQualityResult[]
): {
  score: number;
  earnedPoints: number;
  possiblePoints: number;
  completedFields: number;
  totalFields: number;
} {
  const categoryFields = fieldResults.filter(f => f.category === category);
  const totalFields = categoryFields.length;

  // Categoría vacía = no perjudica el score total (intencional)
  // Esto permite que verticales diferentes tengan campos opcionales sin penalización
  if (totalFields === 0) {
    return { score: 100, earnedPoints: 0, possiblePoints: 0, completedFields: 0, totalFields: 0 };
  }

  // Calcular puntos con guardias contra NaN
  const earnedPoints = categoryFields.reduce((sum, f) => {
    const safeScore = Number.isFinite(f.weightedScore) ? f.weightedScore : 0;
    return sum + safeScore;
  }, 0);

  const possiblePoints = categoryFields.reduce((sum, f) => {
    const safeMax = Number.isFinite(f.maxPossibleScore) ? f.maxPossibleScore : 0;
    return sum + safeMax;
  }, 0);

  // CICLO 2: Usar tolerancia de 0.69 (en vez de 0.7) para manejar redondeos
  const completedFields = categoryFields.filter(
    f => f.status === 'complete' &&
         Number.isFinite(f.weightedScore) &&
         Number.isFinite(f.maxPossibleScore) &&
         f.maxPossibleScore > 0 &&
         f.weightedScore >= f.maxPossibleScore * 0.69
  ).length;

  // Guardia contra división por cero y NaN
  const score = possiblePoints > 0
    ? Math.round((earnedPoints / possiblePoints) * 100)
    : 100;

  const safeScore = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;

  return {
    score: safeScore,
    earnedPoints: Number.isFinite(earnedPoints) ? earnedPoints : 0,
    possiblePoints: Number.isFinite(possiblePoints) ? possiblePoints : 0,
    completedFields,
    totalFields,
  };
}

/**
 * Calcula el score total del KB
 */
export function calculateTotalScore(
  fieldResults: FieldQualityResult[]
): number {
  const categories: ScoringCategory[] = ['core_data', 'personality', 'policies', 'knowledge', 'advanced'];

  let totalScore = 0;

  for (const category of categories) {
    const categoryWeight = CATEGORY_WEIGHTS[category] || 0;
    const { score } = calculateCategoryScore(category, fieldResults);

    // Guardias contra NaN
    const safeScore = Number.isFinite(score) ? score : 0;
    const safeWeight = Number.isFinite(categoryWeight) ? categoryWeight : 0;

    totalScore += (safeScore / 100) * safeWeight;
  }

  // Guardia final contra NaN
  const finalScore = Number.isFinite(totalScore) ? totalScore : 0;
  return Math.round(finalScore);
}

// ======================
// EXPORTS
// ======================

export const KBQualityValidators = {
  validateField,
  validateAllFields,
  calculateCategoryScore,
  calculateTotalScore,
};
