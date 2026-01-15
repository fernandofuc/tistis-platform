// =====================================================
// TIS TIS PLATFORM - Knowledge Base Scoring System
// Exportaciones centralizadas del sistema de scoring
// =====================================================

// ======================
// CORE ENGINE
// ======================
export {
  // Types
  type FieldQualityResult,
  type KBScoringResult,
  type CategoryScore,
  type ScoringRecommendation,
  type QualityIssue,
  type ScoringCategory,
  type FieldStatus,
  type CategoryStatus,
  type ScoreableField,
  type KBDataForScoring,

  // Constants
  CATEGORY_WEIGHTS,
  CATEGORY_LABELS,
  QUALITY_THRESHOLDS,
  SCOREABLE_FIELDS,

  // Functions
  getFieldDefinition,
  getFieldsForVertical,
  getCategoryTotalWeight,
  scoreToStatus,
  getStatusColor,
  getCategoryIcon,

  // Namespace export
  KBScoringEngine,
} from '../kb-scoring-engine';

// ======================
// QUALITY VALIDATORS
// ======================
export {
  validateField,
  validateAllFields,
  calculateCategoryScore,
  calculateTotalScore,
  KBQualityValidators,
} from '../kb-quality-validators';

// ======================
// PLACEHOLDER DETECTION
// ======================
export {
  type PlaceholderDetectionResult,
  detectPlaceholder,
  detectGenericContent,
  analyzeContentQuality,
  PlaceholderDetection,
} from '../kb-placeholder-detection';

// ======================
// SCORING SERVICE (Main API)
// ======================
export {
  calculateKBScore,
  isProductionReady,
  canGenerateQualityPrompts,
  getNextStep,
  formatScore,
  getKBStatusSummary,
  convertKBDataForScoring,
  KBScoringService,
} from '../kb-scoring-service';
