// =====================================================
// TIS TIS PLATFORM - KB Conflict Detector
// Detects potential conflicts and redundancies in KB items
// =====================================================

// ======================
// TYPES
// ======================

export type ConflictSeverity = 'error' | 'warning' | 'info';
export type ConflictCategory = 'duplicate' | 'contradiction' | 'overlap' | 'missing_context';

export interface ConflictItem {
  id: string;
  type: 'instruction' | 'policy' | 'article' | 'template' | 'competitor';
  title: string;
  content: string;
}

export interface DetectedConflict {
  id: string;
  severity: ConflictSeverity;
  category: ConflictCategory;
  message: string;
  suggestion: string;
  items: ConflictItem[];
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  conflicts: DetectedConflict[];
}

// ======================
// KB DATA TYPES
// ======================

interface KBInstruction {
  id: string;
  instruction_type: string;
  title: string;
  instruction: string;
  is_active: boolean;
}

interface KBPolicy {
  id: string;
  policy_type: string;
  title: string;
  policy_text: string;
  is_active: boolean;
}

interface KBArticle {
  id: string;
  category: string;
  title: string;
  content: string;
  is_active: boolean;
}

interface KBTemplate {
  id: string;
  trigger_type: string;
  name: string;
  template_text: string;
  is_active: boolean;
}

interface KBCompetitor {
  id: string;
  competitor_name: string;
  response_strategy: string;
  is_active: boolean;
}

export interface KBData {
  instructions: KBInstruction[];
  policies: KBPolicy[];
  articles: KBArticle[];
  templates: KBTemplate[];
  competitors: KBCompetitor[];
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Calculate similarity between two strings (0-1)
 * Uses Jaccard similarity on word sets
 */
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) =>
    text.toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Check if two texts contain contradictory keywords
 */
function hasContradictoryKeywords(text1: string, text2: string): boolean {
  const contradictions = [
    ['siempre', 'nunca'],
    ['obligatorio', 'opcional'],
    ['gratis', 'costo'],
    ['incluido', 'adicional'],
    ['permitido', 'prohibido'],
    ['sí', 'no'],
    ['aceptamos', 'no aceptamos'],
    ['ofrecemos', 'no ofrecemos'],
  ];

  const t1 = text1.toLowerCase();
  const t2 = text2.toLowerCase();

  for (const [word1, word2] of contradictions) {
    if ((t1.includes(word1) && t2.includes(word2)) ||
        (t1.includes(word2) && t2.includes(word1))) {
      return true;
    }
  }

  return false;
}

/**
 * Generate unique conflict ID
 */
function generateConflictId(items: ConflictItem[], category: ConflictCategory): string {
  const itemIds = items.map(i => i.id).sort().join('-');
  return `${category}-${itemIds.slice(0, 20)}`;
}

// ======================
// CONFLICT DETECTORS
// ======================

/**
 * Detect duplicate templates for the same trigger
 */
function detectDuplicateTemplates(templates: KBTemplate[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const activeTemplates = templates.filter(t => t.is_active);

  // Group by trigger type
  const byTrigger = activeTemplates.reduce((acc, t) => {
    if (!acc[t.trigger_type]) acc[t.trigger_type] = [];
    acc[t.trigger_type].push(t);
    return acc;
  }, {} as Record<string, KBTemplate[]>);

  for (const [trigger, items] of Object.entries(byTrigger)) {
    if (items.length > 1) {
      conflicts.push({
        id: generateConflictId(
          items.map(i => ({ id: i.id, type: 'template', title: i.name, content: i.template_text })),
          'duplicate'
        ),
        severity: 'warning',
        category: 'duplicate',
        message: `Hay ${items.length} plantillas activas para el mismo trigger "${trigger}"`,
        suggestion: 'Considera mantener solo una plantilla por trigger o desactivar las que no uses',
        items: items.map(i => ({
          id: i.id,
          type: 'template',
          title: i.name,
          content: i.template_text,
        })),
      });
    }
  }

  return conflicts;
}

/**
 * Detect similar/duplicate instructions
 */
function detectSimilarInstructions(instructions: KBInstruction[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const activeInstructions = instructions.filter(i => i.is_active);

  for (let i = 0; i < activeInstructions.length; i++) {
    for (let j = i + 1; j < activeInstructions.length; j++) {
      const inst1 = activeInstructions[i];
      const inst2 = activeInstructions[j];

      // Check title similarity
      const titleSimilarity = calculateSimilarity(inst1.title, inst2.title);

      // Check content similarity
      const contentSimilarity = calculateSimilarity(inst1.instruction, inst2.instruction);

      // High similarity = potential duplicate
      if (titleSimilarity > 0.7 || contentSimilarity > 0.6) {
        const items: ConflictItem[] = [
          { id: inst1.id, type: 'instruction', title: inst1.title, content: inst1.instruction },
          { id: inst2.id, type: 'instruction', title: inst2.title, content: inst2.instruction },
        ];

        conflicts.push({
          id: generateConflictId(items, 'duplicate'),
          severity: 'warning',
          category: 'duplicate',
          message: `Las instrucciones "${inst1.title}" y "${inst2.title}" son muy similares`,
          suggestion: 'Considera consolidarlas en una sola instrucción más completa',
          items,
        });
      }

      // Check for contradictions
      if (inst1.instruction_type === inst2.instruction_type &&
          hasContradictoryKeywords(inst1.instruction, inst2.instruction)) {
        const items: ConflictItem[] = [
          { id: inst1.id, type: 'instruction', title: inst1.title, content: inst1.instruction },
          { id: inst2.id, type: 'instruction', title: inst2.title, content: inst2.instruction },
        ];

        conflicts.push({
          id: generateConflictId(items, 'contradiction'),
          severity: 'error',
          category: 'contradiction',
          message: `Las instrucciones "${inst1.title}" y "${inst2.title}" podrían contradecirse`,
          suggestion: 'Revisa ambas instrucciones y asegúrate de que sean consistentes',
          items,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detect similar/overlapping policies
 */
function detectSimilarPolicies(policies: KBPolicy[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const activePolicies = policies.filter(p => p.is_active);

  for (let i = 0; i < activePolicies.length; i++) {
    for (let j = i + 1; j < activePolicies.length; j++) {
      const pol1 = activePolicies[i];
      const pol2 = activePolicies[j];

      // Same policy type = check for overlap
      if (pol1.policy_type === pol2.policy_type) {
        const items: ConflictItem[] = [
          { id: pol1.id, type: 'policy', title: pol1.title, content: pol1.policy_text },
          { id: pol2.id, type: 'policy', title: pol2.title, content: pol2.policy_text },
        ];

        // Check for contradictions
        if (hasContradictoryKeywords(pol1.policy_text, pol2.policy_text)) {
          conflicts.push({
            id: generateConflictId(items, 'contradiction'),
            severity: 'error',
            category: 'contradiction',
            message: `Las políticas "${pol1.title}" y "${pol2.title}" podrían contradecirse`,
            suggestion: 'Ambas son del mismo tipo. Revisa que no tengan información conflictiva',
            items,
          });
        } else {
          conflicts.push({
            id: generateConflictId(items, 'overlap'),
            severity: 'info',
            category: 'overlap',
            message: `Las políticas "${pol1.title}" y "${pol2.title}" cubren el mismo tema`,
            suggestion: 'Considera consolidarlas en una política más completa',
            items,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Detect duplicate competitor entries
 */
function detectDuplicateCompetitors(competitors: KBCompetitor[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const activeCompetitors = competitors.filter(c => c.is_active);

  const seen = new Map<string, KBCompetitor>();

  for (const comp of activeCompetitors) {
    const normalizedName = comp.competitor_name.toLowerCase().trim();

    if (seen.has(normalizedName)) {
      const existing = seen.get(normalizedName)!;
      const items: ConflictItem[] = [
        { id: existing.id, type: 'competitor', title: existing.competitor_name, content: existing.response_strategy },
        { id: comp.id, type: 'competitor', title: comp.competitor_name, content: comp.response_strategy },
      ];

      conflicts.push({
        id: generateConflictId(items, 'duplicate'),
        severity: 'warning',
        category: 'duplicate',
        message: `El competidor "${comp.competitor_name}" está duplicado`,
        suggestion: 'Mantén solo una entrada por competidor y consolida las estrategias',
        items,
      });
    } else {
      seen.set(normalizedName, comp);
    }
  }

  return conflicts;
}

/**
 * Detect missing essential content
 */
function detectMissingEssentials(data: KBData): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const activeInstructions = data.instructions.filter(i => i.is_active);
  const activePolicies = data.policies.filter(p => p.is_active);
  const activeTemplates = data.templates.filter(t => t.is_active);

  // Check for essential instruction types
  // Tipos válidos según DB: identity, greeting, farewell, pricing_policy, special_cases,
  // competitors, objections, upsell, tone_examples, forbidden, always_mention, custom
  const instructionTypes = new Set(activeInstructions.map(i => i.instruction_type));
  const essentialInstructions = ['identity', 'greeting'];

  for (const essential of essentialInstructions) {
    if (!instructionTypes.has(essential)) {
      conflicts.push({
        id: `missing-instruction-${essential}`,
        severity: 'info',
        category: 'missing_context',
        message: `No hay instrucciones de tipo "${essential}"`,
        suggestion: `Considera agregar una instrucción de tipo ${essential} para mejorar las respuestas`,
        items: [],
      });
    }
  }

  // Check for essential policy types
  const policyTypes = new Set(activePolicies.map(p => p.policy_type));
  const essentialPolicies = ['cancellation', 'payment'];

  for (const essential of essentialPolicies) {
    if (!policyTypes.has(essential)) {
      conflicts.push({
        id: `missing-policy-${essential}`,
        severity: 'info',
        category: 'missing_context',
        message: `No hay políticas de tipo "${essential}"`,
        suggestion: 'Esta política es común y ayuda al AI a responder preguntas frecuentes',
        items: [],
      });
    }
  }

  // Check for essential templates
  const templateTypes = new Set(activeTemplates.map(t => t.trigger_type));
  const essentialTemplates = ['greeting', 'farewell'];

  for (const essential of essentialTemplates) {
    if (!templateTypes.has(essential)) {
      conflicts.push({
        id: `missing-template-${essential}`,
        severity: 'info',
        category: 'missing_context',
        message: `No hay plantilla de tipo "${essential}"`,
        suggestion: 'Una plantilla de saludo/despedida ayuda a mantener un tono consistente',
        items: [],
      });
    }
  }

  return conflicts;
}

// ======================
// MAIN DETECTOR
// ======================

/**
 * Detect all conflicts in Knowledge Base data
 */
export function detectKBConflicts(data: KBData): ConflictDetectionResult {
  const allConflicts: DetectedConflict[] = [];

  // Run all detectors
  allConflicts.push(...detectDuplicateTemplates(data.templates));
  allConflicts.push(...detectSimilarInstructions(data.instructions));
  allConflicts.push(...detectSimilarPolicies(data.policies));
  allConflicts.push(...detectDuplicateCompetitors(data.competitors));
  allConflicts.push(...detectMissingEssentials(data));

  // Remove duplicate conflicts (same items)
  const uniqueConflicts = allConflicts.filter((conflict, index, self) =>
    index === self.findIndex(c => c.id === conflict.id)
  );

  // Count by severity
  const errorCount = uniqueConflicts.filter(c => c.severity === 'error').length;
  const warningCount = uniqueConflicts.filter(c => c.severity === 'warning').length;
  const infoCount = uniqueConflicts.filter(c => c.severity === 'info').length;

  return {
    hasConflicts: uniqueConflicts.length > 0,
    errorCount,
    warningCount,
    infoCount,
    conflicts: uniqueConflicts,
  };
}

/**
 * Get severity label in Spanish
 */
export function getSeverityLabel(severity: ConflictSeverity): string {
  const labels: Record<ConflictSeverity, string> = {
    error: 'Error',
    warning: 'Advertencia',
    info: 'Sugerencia',
  };
  return labels[severity];
}

/**
 * Get severity color classes
 */
export function getSeverityColors(severity: ConflictSeverity): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  const colors: Record<ConflictSeverity, { bg: string; text: string; border: string; icon: string }> = {
    error: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200',
      icon: 'text-red-500',
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: 'text-amber-500',
    },
    info: {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      icon: 'text-blue-500',
    },
  };
  return colors[severity];
}
