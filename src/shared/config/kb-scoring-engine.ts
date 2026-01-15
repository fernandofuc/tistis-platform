// =====================================================
// TIS TIS PLATFORM - Knowledge Base Scoring Engine
// Motor inteligente de scoring multi-dimensional para KB
// =====================================================

import type { VerticalType } from './verticals';

// ======================
// TYPES - Core Scoring
// ======================

/**
 * Resultado de validación por campo individual
 */
export interface FieldQualityResult {
  fieldKey: string;
  fieldLabel: string;
  category: ScoringCategory;

  // Scores (0-100)
  existenceScore: number;      // ¿Existe y está activo?
  qualityScore: number;        // ¿Es contenido de calidad?
  completenessScore: number;   // ¿Está completo según expectativas?

  // Weighted final score
  weightedScore: number;
  maxPossibleScore: number;

  // Status
  status: FieldStatus;
  issues: QualityIssue[];
  suggestions: string[];

  // Meta
  contentLength: number;
  isPlaceholder: boolean;
  isGeneric: boolean;
}

/**
 * Resultado completo del scoring del KB
 */
export interface KBScoringResult {
  // Score total (0-100)
  totalScore: number;

  // Scores por categoría
  categoryScores: Record<ScoringCategory, CategoryScore>;

  // Resultados por campo
  fieldResults: FieldQualityResult[];

  // Estadísticas
  stats: {
    totalFields: number;
    completedFields: number;
    fieldsWithIssues: number;
    criticalMissing: number;
    placeholdersDetected: number;
  };

  // Recomendaciones ordenadas por impacto
  recommendations: ScoringRecommendation[];

  // Meta
  vertical: VerticalType;
  calculatedAt: string;
  version: string;
}

/**
 * Score por categoría
 */
export interface CategoryScore {
  category: ScoringCategory;
  label: string;
  score: number;           // 0-100
  maxScore: number;        // Peso máximo de la categoría
  earnedPoints: number;    // Puntos ganados
  possiblePoints: number;  // Puntos posibles
  completedFields: number;
  totalFields: number;
  status: CategoryStatus;
}

/**
 * Recomendación de mejora
 */
export interface ScoringRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  fieldKey: string;
  fieldLabel: string;
  category: ScoringCategory;
  message: string;
  suggestion: string;
  estimatedImpact: number;  // Puntos que se ganarían al completar
}

/**
 * Issue de calidad detectado
 */
export interface QualityIssue {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

// ======================
// ENUMS & CONSTANTS
// ======================

/**
 * Categorías de scoring - cada una tiene peso diferente
 */
export type ScoringCategory =
  | 'core_data'          // Datos fundamentales del negocio (30%)
  | 'personality'        // Identidad y tono del asistente (25%)
  | 'policies'           // Políticas y reglas (20%)
  | 'knowledge'          // Contenido informativo (15%)
  | 'advanced';          // Funciones avanzadas (10%)

export type FieldStatus =
  | 'complete'           // Campo completo y de calidad
  | 'partial'            // Existe pero incompleto o baja calidad
  | 'placeholder'        // Detectado como placeholder/test
  | 'missing'            // No existe
  | 'disabled';          // Desactivado (is_active = false)

export type CategoryStatus =
  | 'excellent'          // 90-100%
  | 'good'               // 70-89%
  | 'needs_work'         // 50-69%
  | 'critical';          // <50%

/**
 * Pesos por categoría (deben sumar 100)
 */
export const CATEGORY_WEIGHTS: Record<ScoringCategory, number> = {
  core_data: 30,
  personality: 25,
  policies: 20,
  knowledge: 15,
  advanced: 10,
};

/**
 * Labels de categorías para UI
 */
export const CATEGORY_LABELS: Record<ScoringCategory, string> = {
  core_data: 'Datos del Negocio',
  personality: 'Personalidad',
  policies: 'Políticas',
  knowledge: 'Conocimiento',
  advanced: 'Avanzado',
};

/**
 * Umbrales de calidad
 */
export const QUALITY_THRESHOLDS = {
  // Score mínimo para considerar el KB "listo para producción"
  MIN_PRODUCTION_READY: 70,

  // Score mínimo para generar prompts de calidad
  MIN_PROMPT_QUALITY: 50,

  // Longitudes mínimas por tipo de campo
  MIN_LENGTHS: {
    identity: 80,           // Identidad del asistente
    greeting: 30,           // Saludo
    farewell: 20,           // Despedida
    policy: 50,             // Políticas
    article: 100,           // Artículos
    instruction: 30,        // Instrucciones
    template: 20,           // Templates
    strategy: 50,           // Estrategia de competencia
  },

  // Longitudes ideales (para score máximo)
  IDEAL_LENGTHS: {
    identity: 200,
    greeting: 100,
    farewell: 50,
    policy: 150,
    article: 300,
    instruction: 100,
    template: 80,
    strategy: 150,
  },
};

// ======================
// FIELD DEFINITIONS
// ======================

/**
 * Definición de un campo scoreable
 */
export interface ScoreableField {
  key: string;
  label: string;
  category: ScoringCategory;
  weight: number;              // Peso dentro de su categoría (1-10)
  priority: 'essential' | 'recommended' | 'optional';

  // Validación
  minLength: number;
  idealLength: number;
  mustContainKeywords?: string[];   // Palabras que debería contener

  // Origen de datos
  dataSource: 'instructions' | 'policies' | 'articles' | 'templates' | 'competitors' | 'services' | 'branches' | 'staff';
  filterType?: string;              // instruction_type, policy_type, etc.
  countBased?: boolean;             // true = valida cantidad, no contenido específico
  minCount?: number;                // Mínimo de items (para countBased)

  // Vertical-specific
  verticalOverrides?: Partial<Record<VerticalType, Partial<ScoreableField>>>;
}

/**
 * Definición completa de todos los campos scoreables
 */
export const SCOREABLE_FIELDS: ScoreableField[] = [
  // =====================
  // CORE DATA (30%)
  // =====================
  {
    key: 'services_configured',
    label: 'Servicios configurados',
    category: 'core_data',
    weight: 10,
    priority: 'essential',
    minLength: 0,
    idealLength: 0,
    dataSource: 'services',
    countBased: true,
    minCount: 3,
    verticalOverrides: {
      dental: { minCount: 5, label: 'Tratamientos dentales' },
      restaurant: { minCount: 5, label: 'Platillos/Menú' },
      gym: { minCount: 3, label: 'Membresías/Clases' },
    },
  },
  {
    key: 'branches_configured',
    label: 'Sucursales con horarios',
    category: 'core_data',
    weight: 8,
    priority: 'essential',
    minLength: 0,
    idealLength: 0,
    dataSource: 'branches',
    countBased: true,
    minCount: 1,
  },
  {
    key: 'staff_configured',
    label: 'Personal profesional',
    category: 'core_data',
    weight: 7,
    priority: 'recommended',
    minLength: 0,
    idealLength: 0,
    dataSource: 'staff',
    countBased: true,
    minCount: 1,
    verticalOverrides: {
      dental: { priority: 'essential', label: 'Doctores/Especialistas' },
      clinic: { priority: 'essential', label: 'Médicos' },
    },
  },
  {
    key: 'business_hours',
    label: 'Horarios de atención',
    category: 'core_data',
    weight: 5,
    priority: 'essential',
    minLength: 0,
    idealLength: 0,
    dataSource: 'branches',
    countBased: false,
  },

  // =====================
  // PERSONALITY (25%)
  // =====================
  {
    key: 'identity',
    label: 'Identidad del asistente',
    category: 'personality',
    weight: 10,
    priority: 'essential',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.identity,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.identity,
    dataSource: 'instructions',
    filterType: 'identity',
    mustContainKeywords: ['nombre', 'personalidad', 'tono'],
  },
  {
    key: 'greeting',
    label: 'Saludo configurado',
    category: 'personality',
    weight: 6,
    priority: 'essential',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.greeting,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.greeting,
    dataSource: 'templates',
    filterType: 'greeting',
  },
  {
    key: 'farewell',
    label: 'Despedida configurada',
    category: 'personality',
    weight: 4,
    priority: 'essential',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.farewell,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.farewell,
    dataSource: 'templates',
    filterType: 'farewell',
  },
  {
    key: 'communication_style',
    label: 'Estilo de comunicación',
    category: 'personality',
    weight: 5,
    priority: 'recommended',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.instruction,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.instruction,
    dataSource: 'instructions',
    filterType: 'communication_style',
  },

  // =====================
  // POLICIES (20%)
  // =====================
  {
    key: 'cancellation_policy',
    label: 'Política de cancelación',
    category: 'policies',
    weight: 7,
    priority: 'recommended',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.policy,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.policy,
    dataSource: 'policies',
    filterType: 'cancellation',
    mustContainKeywords: ['cancelar', 'anticipación', 'aviso'],
    verticalOverrides: {
      dental: { priority: 'essential' },
      clinic: { priority: 'essential' },
      beauty: { priority: 'essential' },
    },
  },
  {
    key: 'payment_policy',
    label: 'Política de pagos',
    category: 'policies',
    weight: 6,
    priority: 'recommended',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.policy,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.policy,
    dataSource: 'policies',
    filterType: 'payment',
    mustContainKeywords: ['pago', 'método', 'efectivo', 'tarjeta'],
  },
  {
    key: 'pricing_policy',
    label: 'Política de precios',
    category: 'policies',
    weight: 4,
    priority: 'optional',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.policy,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.policy,
    dataSource: 'policies',
    filterType: 'pricing',
  },
  {
    key: 'warranty_policy',
    label: 'Política de garantía',
    category: 'policies',
    weight: 3,
    priority: 'optional',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.policy,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.policy,
    dataSource: 'policies',
    filterType: 'warranty',
    verticalOverrides: {
      dental: { priority: 'recommended', label: 'Garantía de tratamientos' },
    },
  },

  // =====================
  // KNOWLEDGE (15%)
  // =====================
  {
    key: 'knowledge_articles',
    label: 'Artículos de información',
    category: 'knowledge',
    weight: 6,
    priority: 'recommended',
    minLength: 0,
    idealLength: 0,
    dataSource: 'articles',
    countBased: true,
    minCount: 2,
  },
  {
    key: 'about_us',
    label: 'Acerca de nosotros',
    category: 'knowledge',
    weight: 5,
    priority: 'recommended',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.article,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.article,
    dataSource: 'articles',
    filterType: 'about_us',
  },
  {
    key: 'differentiators',
    label: 'Diferenciadores',
    category: 'knowledge',
    weight: 4,
    priority: 'optional',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.article,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.article,
    dataSource: 'articles',
    filterType: 'differentiators',
  },

  // =====================
  // ADVANCED (10%)
  // =====================
  {
    key: 'competitor_handling',
    label: 'Manejo de competencia',
    category: 'advanced',
    weight: 5,
    priority: 'optional',
    minLength: 0,
    idealLength: 0,
    dataSource: 'competitors',
    countBased: true,
    minCount: 1,
  },
  {
    key: 'upselling_instructions',
    label: 'Instrucciones de upselling',
    category: 'advanced',
    weight: 3,
    priority: 'optional',
    minLength: QUALITY_THRESHOLDS.MIN_LENGTHS.instruction,
    idealLength: QUALITY_THRESHOLDS.IDEAL_LENGTHS.instruction,
    dataSource: 'instructions',
    filterType: 'upselling',
  },
  {
    key: 'response_templates',
    label: 'Templates de respuesta',
    category: 'advanced',
    weight: 2,
    priority: 'optional',
    minLength: 0,
    idealLength: 0,
    dataSource: 'templates',
    countBased: true,
    minCount: 3,
  },
];

// ======================
// DATA INTERFACES
// ======================

/**
 * Datos del KB para scoring (viene del API)
 */
export interface KBDataForScoring {
  instructions: Array<{
    id: string;
    instruction_type?: string;
    title?: string;
    instruction?: string;
    is_active: boolean;
  }>;
  policies: Array<{
    id: string;
    policy_type?: string;
    title?: string;
    policy_text?: string;
    is_active: boolean;
  }>;
  articles: Array<{
    id: string;
    category?: string;
    title?: string;
    content?: string;
    is_active: boolean;
  }>;
  templates: Array<{
    id: string;
    trigger_type?: string;
    name?: string;
    template_text?: string;
    is_active: boolean;
  }>;
  competitors: Array<{
    id: string;
    competitor_name?: string;
    response_strategy?: string;
    is_active: boolean;
  }>;
  // Datos adicionales del negocio
  services?: Array<{
    id: string;
    name?: string;
    description?: string;
    is_active: boolean;
  }>;
  branches?: Array<{
    id: string;
    name?: string;
    operating_hours?: Record<string, unknown>;
    is_active: boolean;
  }>;
  staff?: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    is_active: boolean;
  }>;
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene la definición de campo ajustada por vertical
 */
export function getFieldDefinition(
  fieldKey: string,
  vertical: VerticalType
): ScoreableField | undefined {
  const baseField = SCOREABLE_FIELDS.find(f => f.key === fieldKey);
  if (!baseField) return undefined;

  // Aplicar overrides de vertical si existen
  const overrides = baseField.verticalOverrides?.[vertical];
  if (overrides) {
    return { ...baseField, ...overrides };
  }

  return baseField;
}

/**
 * Obtiene todos los campos para una vertical específica
 */
export function getFieldsForVertical(vertical: VerticalType): ScoreableField[] {
  return SCOREABLE_FIELDS.map(field => {
    const overrides = field.verticalOverrides?.[vertical];
    return overrides ? { ...field, ...overrides } : field;
  });
}

/**
 * Calcula el peso total de una categoría
 */
export function getCategoryTotalWeight(
  category: ScoringCategory,
  vertical: VerticalType
): number {
  const fields = getFieldsForVertical(vertical).filter(f => f.category === category);
  return fields.reduce((sum, field) => sum + field.weight, 0);
}

/**
 * Convierte score numérico a status
 */
export function scoreToStatus(score: number): CategoryStatus {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs_work';
  return 'critical';
}

/**
 * Obtiene color por status (para UI)
 */
export function getStatusColor(status: CategoryStatus | FieldStatus): {
  bg: string;
  text: string;
  border: string;
  light: string;
} {
  const colors = {
    excellent: { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-500', light: 'bg-green-50' },
    complete: { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-500', light: 'bg-green-50' },
    good: { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-500', light: 'bg-blue-50' },
    partial: { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-500', light: 'bg-amber-50' },
    needs_work: { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-500', light: 'bg-amber-50' },
    placeholder: { bg: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-500', light: 'bg-orange-50' },
    critical: { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-500', light: 'bg-red-50' },
    missing: { bg: 'bg-gray-400', text: 'text-gray-600', border: 'border-gray-400', light: 'bg-gray-50' },
    disabled: { bg: 'bg-gray-300', text: 'text-gray-500', border: 'border-gray-300', light: 'bg-gray-50' },
  };

  return colors[status] || colors.missing;
}

/**
 * Obtiene el icono por categoría (para UI)
 */
export function getCategoryIcon(category: ScoringCategory): string {
  const icons: Record<ScoringCategory, string> = {
    core_data: '📊',
    personality: '🎭',
    policies: '📋',
    knowledge: '📚',
    advanced: '⚡',
  };
  return icons[category];
}

// ======================
// EXPORTS
// ======================

export const KBScoringEngine = {
  CATEGORY_WEIGHTS,
  CATEGORY_LABELS,
  QUALITY_THRESHOLDS,
  SCOREABLE_FIELDS,
  getFieldDefinition,
  getFieldsForVertical,
  getCategoryTotalWeight,
  scoreToStatus,
  getStatusColor,
  getCategoryIcon,
};
