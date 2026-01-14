// =====================================================
// TIS TIS PLATFORM - Prompt Instruction Compiler
// Compila instrucciones de estilo + tipo en prompts optimizados
// =====================================================
//
// Este archivo compila las instrucciones de estilo de respuesta
// y tipo de asistente en un texto de instrucciones unificado
// para incluir en el meta-prompt del agente.
//
// PRE-COMPILA las 32 combinaciones (4 estilos × 4 tipos × 2 canales)
// para acceso rápido en runtime.
// =====================================================

import {
  type ResponseStyleKey,
  type ChannelContext,
  type ResponseStyleInstructions,
  type StyleInstructionCategory,
  RESPONSE_STYLE_INSTRUCTIONS,
  getStyleInstructions,
  isValidStyle,
} from './response-style-instructions';

import {
  type AssistantTypeKey,
  type AssistantTypeInstructions,
  type TypeInstructionCategory,
  ASSISTANT_TYPE_INSTRUCTIONS,
  getTypeInstructions,
  isValidType,
  isPersonalType,
  mapTemplateKeyToType,
} from './assistant-type-instructions';

// ======================
// TYPES
// ======================

export interface CompiledInstructions {
  /** Identificador único de la combinación */
  key: string;

  /** Metadata de la compilación */
  metadata: {
    styleKey: ResponseStyleKey;
    styleName: string;
    typeKey: AssistantTypeKey;
    typeName: string;
    channel: ChannelContext;
    compiledAt: string;
    totalRules: number;
    estimatedTokens: number;
  };

  /** Texto completo de instrucciones formateado para el prompt */
  fullInstructionText: string;

  /** Secciones individuales para uso granular si es necesario */
  sections: {
    personality: string;
    behavior: string;
    channel: string;
    situations: string;
    vertical: string;
  };
}

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Formatea una categoría de instrucciones en texto Markdown
 */
function formatCategory(
  category: StyleInstructionCategory | TypeInstructionCategory,
  indent: string = ''
): string {
  const lines: string[] = [];
  lines.push(`${indent}### ${category.category}`);

  for (const rule of category.rules) {
    lines.push(`${indent}- ${rule}`);
  }

  return lines.join('\n');
}

/**
 * Cuenta el total de reglas en una lista de categorías
 */
function countRules(categories: (StyleInstructionCategory | TypeInstructionCategory)[]): number {
  return categories.reduce((sum, cat) => sum + cat.rules.length, 0);
}

/**
 * Estima tokens aproximados (1 token ≈ 4 caracteres en español)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ======================
// SECTION BUILDERS
// ======================

/**
 * Construye la sección de PERSONALIDAD Y TONO
 */
function buildPersonalitySection(
  style: ResponseStyleInstructions,
  channel: ChannelContext
): string {
  const lines: string[] = [];

  lines.push('## PERSONALIDAD Y TONO');
  lines.push('');
  lines.push(`> Estilo: **${style.name}** - ${style.shortDescription}`);
  lines.push('');

  // Core personality (aplica a ambos canales)
  lines.push(formatCategory(style.core.treatment));
  lines.push('');
  lines.push(formatCategory(style.core.sentenceStructure));
  lines.push('');
  lines.push(formatCategory(style.core.vocabularyLevel));
  lines.push('');
  lines.push(formatCategory(style.core.emotionalTone));
  lines.push('');
  lines.push(formatCategory(style.core.empathyExpression));
  lines.push('');
  lines.push(formatCategory(style.core.confidenceLevel));

  return lines.join('\n');
}

/**
 * Construye la sección de COMPORTAMIENTO Y CAPACIDADES
 */
function buildBehaviorSection(type: AssistantTypeInstructions): string {
  const lines: string[] = [];

  lines.push('## COMPORTAMIENTO Y CAPACIDADES');
  lines.push('');
  lines.push(`> Tipo: **${type.name}** - ${type.shortDescription}`);
  lines.push('');

  // Core behavior
  lines.push(formatCategory(type.core.primaryMission));
  lines.push('');
  lines.push(formatCategory(type.core.secondaryTasks));
  lines.push('');
  lines.push(formatCategory(type.core.outOfScopeHandling));
  lines.push('');

  // Capabilities
  lines.push(formatCategory(type.capabilities.canProvide));
  lines.push('');
  lines.push(formatCategory(type.capabilities.cannotProvide));
  lines.push('');
  lines.push(formatCategory(type.capabilities.shouldRedirect));

  return lines.join('\n');
}

/**
 * Construye la sección específica del CANAL (voz o mensajería)
 */
function buildChannelSection(
  style: ResponseStyleInstructions,
  channel: ChannelContext
): string {
  const lines: string[] = [];

  if (channel === 'voice') {
    lines.push('## REGLAS ESPECÍFICAS PARA VOZ');
    lines.push('');
    lines.push('> Este canal es para llamadas telefónicas. Usa pausas verbales y muletillas naturales.');
    lines.push('');

    // Secciones de voz
    lines.push(formatCategory(style.voice.fillerPhrases));
    lines.push('');
    lines.push(formatCategory(style.voice.speechPatterns));
    lines.push('');
    lines.push(formatCategory(style.voice.pacing));
    lines.push('');
    lines.push(formatCategory(style.voice.conversationalFlow));
    lines.push('');
    lines.push(formatCategory(style.voice.confirmationStyle));
  } else {
    lines.push('## REGLAS ESPECÍFICAS PARA MENSAJERÍA');
    lines.push('');
    lines.push('> Este canal es para mensajes de texto (WhatsApp, Instagram, etc). NO uses muletillas de voz.');
    lines.push('');

    // Secciones de mensajería
    lines.push(formatCategory(style.messaging.formatting));
    lines.push('');
    lines.push(formatCategory(style.messaging.emojiUsage));
    lines.push('');
    lines.push(formatCategory(style.messaging.responseLength));
    lines.push('');
    lines.push(formatCategory(style.messaging.punctuation));
    lines.push('');
    lines.push(formatCategory(style.messaging.messageStructure));
  }

  return lines.join('\n');
}

/**
 * Construye la sección de MANEJO DE SITUACIONES
 */
function buildSituationsSection(
  style: ResponseStyleInstructions,
  type: AssistantTypeInstructions
): string {
  const lines: string[] = [];

  lines.push('## MANEJO DE SITUACIONES');
  lines.push('');

  // Situaciones del estilo
  lines.push(formatCategory(style.situations.objectionHandling));
  lines.push('');
  lines.push(formatCategory(style.situations.errorMessages));
  lines.push('');
  lines.push(formatCategory(style.situations.escalation));
  lines.push('');
  lines.push(formatCategory(style.situations.closingConversation));
  lines.push('');
  lines.push(formatCategory(style.situations.apologizing));
  lines.push('');
  lines.push(formatCategory(style.situations.handlingUrgency));
  lines.push('');
  lines.push(formatCategory(style.situations.askingForInfo));

  // Comportamiento de ventas del tipo (si aplica)
  // Los tipos personales no tienen comportamiento de ventas
  if (!isPersonalType(type.key)) {
    lines.push('');
    lines.push('## COMPORTAMIENTO DE VENTAS');
    lines.push('');
    lines.push(formatCategory(type.salesBehavior.approach));
    lines.push('');
    lines.push(formatCategory(type.salesBehavior.limitations));

    if (type.key === 'full') {
      lines.push('');
      lines.push(formatCategory(type.salesBehavior.upselling));
    }
  }

  return lines.join('\n');
}

/**
 * Construye la sección de FLUJO DE CONVERSACIÓN
 */
function buildFlowSection(type: AssistantTypeInstructions): string {
  const lines: string[] = [];

  lines.push('## FLUJO DE CONVERSACIÓN');
  lines.push('');

  lines.push(formatCategory(type.responsePatterns.typicalFlow));
  lines.push('');
  lines.push(formatCategory(type.responsePatterns.informationGathering));
  lines.push('');
  lines.push(formatCategory(type.responsePatterns.confirmationPatterns));

  return lines.join('\n');
}

// ======================
// MAIN COMPILER
// ======================

/**
 * Compila las instrucciones para una combinación específica
 */
export function compileInstructions(
  styleKey: ResponseStyleKey,
  typeKey: AssistantTypeKey,
  channel: ChannelContext
): CompiledInstructions {
  const style = getStyleInstructions(styleKey);
  const type = getTypeInstructions(typeKey);

  // Construir secciones individuales
  const personalitySection = buildPersonalitySection(style, channel);
  const behaviorSection = buildBehaviorSection(type);
  const channelSection = buildChannelSection(style, channel);
  const situationsSection = buildSituationsSection(style, type);
  const flowSection = buildFlowSection(type);

  // Construir texto completo
  const fullText = [
    '# INSTRUCCIONES DE COMUNICACIÓN',
    '',
    `Este documento define CÓMO debes comunicarte con los clientes.`,
    `Estilo de respuesta: ${style.name} | Tipo de asistente: ${type.name} | Canal: ${channel === 'voice' ? 'Voz' : 'Mensajería'}`,
    '',
    '---',
    '',
    personalitySection,
    '',
    '---',
    '',
    behaviorSection,
    '',
    '---',
    '',
    flowSection,
    '',
    '---',
    '',
    channelSection,
    '',
    '---',
    '',
    situationsSection,
    '',
    '---',
    '',
    '# FIN DE INSTRUCCIONES DE COMUNICACIÓN',
  ].join('\n');

  // Contar reglas totales
  const styleCoreRules = countRules([
    style.core.treatment,
    style.core.sentenceStructure,
    style.core.vocabularyLevel,
    style.core.emotionalTone,
    style.core.empathyExpression,
    style.core.confidenceLevel,
  ]);

  const channelRules = channel === 'voice'
    ? countRules([
        style.voice.fillerPhrases,
        style.voice.speechPatterns,
        style.voice.pacing,
        style.voice.conversationalFlow,
        style.voice.confirmationStyle,
      ])
    : countRules([
        style.messaging.formatting,
        style.messaging.emojiUsage,
        style.messaging.responseLength,
        style.messaging.punctuation,
        style.messaging.messageStructure,
      ]);

  const situationRules = countRules([
    style.situations.objectionHandling,
    style.situations.errorMessages,
    style.situations.escalation,
    style.situations.closingConversation,
    style.situations.apologizing,
    style.situations.handlingUrgency,
    style.situations.askingForInfo,
  ]);

  const typeRules = countRules([
    type.core.primaryMission,
    type.core.secondaryTasks,
    type.core.outOfScopeHandling,
    type.capabilities.canProvide,
    type.capabilities.cannotProvide,
    type.capabilities.shouldRedirect,
    type.responsePatterns.typicalFlow,
    type.responsePatterns.informationGathering,
    type.responsePatterns.confirmationPatterns,
    type.salesBehavior.approach,
    type.salesBehavior.limitations,
  ]);

  const totalRules = styleCoreRules + channelRules + situationRules + typeRules;

  return {
    key: `${styleKey}_${typeKey}_${channel}`,
    metadata: {
      styleKey,
      styleName: style.name,
      typeKey,
      typeName: type.name,
      channel,
      compiledAt: new Date().toISOString(),
      totalRules,
      estimatedTokens: estimateTokens(fullText),
    },
    fullInstructionText: fullText,
    sections: {
      personality: personalitySection,
      behavior: behaviorSection,
      channel: channelSection,
      situations: situationsSection,
      vertical: '', // Se construye dinámicamente según la vertical del negocio
    },
  };
}

// ======================
// PRE-COMPILED CACHE
// ======================

// Tipos para la caché
type CompiledInstructionsCache = Map<string, CompiledInstructions>;

// Variables de caché
let compiledCache: CompiledInstructionsCache | null = null;
let cacheInitialized = false;

/**
 * Genera la key para la caché
 */
function getCacheKey(
  styleKey: ResponseStyleKey,
  typeKey: AssistantTypeKey,
  channel: ChannelContext
): string {
  return `${styleKey}_${typeKey}_${channel}`;
}

/**
 * Pre-compila todas las 32 combinaciones (4 estilos × 4 tipos × 2 canales)
 */
export function precompileAllCombinations(): CompiledInstructionsCache {
  const cache: CompiledInstructionsCache = new Map();

  const styles: ResponseStyleKey[] = ['professional', 'professional_friendly', 'casual', 'formal'];
  // NOTA: personal_brand omitido porque es alias deprecated de personal_full
  const types: AssistantTypeKey[] = ['full', 'appointments_only', 'personal_full', 'personal_redirect'];
  const channels: ChannelContext[] = ['voice', 'messaging'];

  for (const style of styles) {
    for (const type of types) {
      for (const channel of channels) {
        const key = getCacheKey(style, type, channel);
        cache.set(key, compileInstructions(style, type, channel));
      }
    }
  }

  console.log(`[PromptCompiler] Pre-compiled ${cache.size} instruction combinations`);

  return cache;
}

/**
 * Inicializa la caché (lazy loading)
 */
function initializeCache(): void {
  if (!cacheInitialized) {
    compiledCache = precompileAllCombinations();
    cacheInitialized = true;
  }
}

/**
 * Obtiene instrucciones compiladas desde la caché
 */
export function getCompiledInstructions(
  styleKey: ResponseStyleKey,
  typeKey: AssistantTypeKey,
  channel: ChannelContext
): CompiledInstructions {
  // Inicializar caché si es necesario
  initializeCache();

  const key = getCacheKey(styleKey, typeKey, channel);
  const cached = compiledCache?.get(key);

  if (cached) {
    return cached;
  }

  // Si por alguna razón no está en caché, compilar en tiempo real
  console.warn(`[PromptCompiler] Cache miss for ${key}, compiling on-the-fly`);
  const compiled = compileInstructions(styleKey, typeKey, channel);

  // Guardar en caché para futuras consultas
  compiledCache?.set(key, compiled);

  return compiled;
}

/**
 * Obtiene instrucciones usando template key (helper para prompt-generator)
 */
export function getCompiledInstructionsFromTemplate(
  templateKey: string,
  styleKey: string,
  channel: ChannelContext
): CompiledInstructions | null {
  // Validar estilo
  if (!isValidStyle(styleKey)) {
    console.error(`[PromptCompiler] Invalid style key: ${styleKey}`);
    return null;
  }

  // Mapear template a tipo
  const typeKey = mapTemplateKeyToType(templateKey);

  return getCompiledInstructions(styleKey as ResponseStyleKey, typeKey, channel);
}

// ======================
// VERTICAL INTEGRATION
// ======================

/**
 * Construye instrucciones específicas de vertical
 *
 * IMPORTANTE: Valida que la vertical exista en verticalIntegration
 */
export function buildVerticalInstructions(
  type: AssistantTypeInstructions,
  vertical: 'dental' | 'restaurant' | 'general'
): string {
  // Validar que la vertical existe en el tipo
  const verticalConfig = type.verticalIntegration[vertical];

  // Si no existe la configuración de vertical, usar 'general' como fallback
  if (!verticalConfig || !verticalConfig.rules || verticalConfig.rules.length === 0) {
    console.warn(`[PromptCompiler] No vertical config for ${vertical}, using general`);
    const generalConfig = type.verticalIntegration.general;
    if (!generalConfig) {
      return '## REGLAS ESPECÍFICAS DEL NEGOCIO\n\n- Adapta tu comunicación al tipo de negocio';
    }
    const lines: string[] = [];
    lines.push('## REGLAS ESPECÍFICAS DEL NEGOCIO');
    lines.push('');
    lines.push(formatCategory(generalConfig));
    return lines.join('\n');
  }

  const lines: string[] = [];
  lines.push('## REGLAS ESPECÍFICAS DEL NEGOCIO');
  lines.push('');
  lines.push(formatCategory(verticalConfig));

  return lines.join('\n');
}

/**
 * Obtiene instrucciones completas con vertical específica
 */
export function getFullCompiledInstructions(
  styleKey: ResponseStyleKey,
  typeKey: AssistantTypeKey,
  channel: ChannelContext,
  vertical: 'dental' | 'restaurant' | 'general'
): CompiledInstructions {
  const base = getCompiledInstructions(styleKey, typeKey, channel);
  const type = getTypeInstructions(typeKey);

  // Construir sección de vertical
  const verticalSection = buildVerticalInstructions(type, vertical);

  // Actualizar sección de vertical
  return {
    ...base,
    sections: {
      ...base.sections,
      vertical: verticalSection,
    },
    fullInstructionText: base.fullInstructionText.replace(
      '# FIN DE INSTRUCCIONES DE COMUNICACIÓN',
      `${verticalSection}\n\n---\n\n# FIN DE INSTRUCCIONES DE COMUNICACIÓN`
    ),
  };
}

// ======================
// EXPORTS
// ======================

export {
  ResponseStyleKey,
  AssistantTypeKey,
  ChannelContext,
  mapTemplateKeyToType,
  isValidStyle,
  isValidType,
};

const PromptInstructionCompiler = {
  compileInstructions,
  getCompiledInstructions,
  getCompiledInstructionsFromTemplate,
  getFullCompiledInstructions,
  precompileAllCombinations,
};

export default PromptInstructionCompiler;
