// =====================================================
// TIS TIS PLATFORM - AI MODELS CONFIGURATION
// Configuracion centralizada de modelos de IA
// =====================================================

/**
 * MODELOS SELECCIONADOS POR CASO DE USO (Diciembre 2025)
 *
 * | Caso de Uso          | Modelo Principal | Costo Input/Output  |
 * |---------------------|------------------|---------------------|
 * | Chat Bar Discovery  | gpt-5-nano       | $0.05 / $0.40 MTok  |
 * | Mensajes Auto       | gpt-5-mini       | $0.25 / $2.00 MTok  |
 * | Voz VAPI            | gpt-4o           | $5.00 / $15.00 MTok |
 * | Tareas Complejas    | gpt-5            | $1.25 / $10.00 MTok |
 */

// ======================
// MODEL IDS
// ======================

export const AI_MODELS = {
  // GPT-5 Family (Principales)
  GPT_5_NANO: 'gpt-5-nano',
  GPT_5_MINI: 'gpt-5-mini',
  GPT_5: 'gpt-5',
  GPT_5_1: 'gpt-5.1',
  GPT_5_2: 'gpt-5.2',

  // GPT-4.1 Family (Backup economico)
  GPT_4_1_NANO: 'gpt-4.1-nano',
  GPT_4_1_MINI: 'gpt-4.1-mini',
  GPT_4_1: 'gpt-4.1',

  // GPT-4o Family (Para voz)
  GPT_4O: 'gpt-4o',
  GPT_4O_MINI: 'gpt-4o-mini',

  // Claude 4.5 (Alternativas)
  CLAUDE_HAIKU_4_5: 'claude-haiku-4-5-20251001',
  CLAUDE_SONNET_4_5: 'claude-sonnet-4-5-20250929',
  CLAUDE_OPUS_4_5: 'claude-opus-4-5-20251101',
} as const;

export type AIModelId = typeof AI_MODELS[keyof typeof AI_MODELS];

// ======================
// DEFAULT MODELS BY USE CASE
// ======================

export const DEFAULT_MODELS = {
  /** Chat bar en pagina principal/discovery - Ultra rapido y barato */
  CHAT_DISCOVERY: AI_MODELS.GPT_5_NANO,

  /** Mensajes automatizados WhatsApp/Instagram/Facebook/TikTok */
  MESSAGING: AI_MODELS.GPT_5_MINI,

  /** Asistente de voz VAPI - Optimizado para audio I/O */
  VOICE: AI_MODELS.GPT_4O,

  /** Tareas complejas que requieren razonamiento profundo */
  COMPLEX_TASKS: AI_MODELS.GPT_5,

  /** Fallback si el modelo principal falla */
  FALLBACK: AI_MODELS.GPT_4O_MINI,
} as const;

// ======================
// MODEL METADATA
// ======================

export interface ModelInfo {
  id: AIModelId;
  name: string;
  provider: 'openai' | 'anthropic';
  costPerMTokInput: number;
  costPerMTokOutput: number;
  latency: 'ultra-fast' | 'fast' | 'moderate' | 'slow';
  contextWindow: number;
  bestFor: string[];
  supportsVoice: boolean;
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  // GPT-5 Family
  [AI_MODELS.GPT_5_NANO]: {
    id: AI_MODELS.GPT_5_NANO,
    name: 'GPT-5 Nano',
    provider: 'openai',
    costPerMTokInput: 0.05,
    costPerMTokOutput: 0.40,
    latency: 'ultra-fast',
    contextWindow: 272000,
    bestFor: ['chat', 'classification', 'simple-qa'],
    supportsVoice: false,
  },
  [AI_MODELS.GPT_5_MINI]: {
    id: AI_MODELS.GPT_5_MINI,
    name: 'GPT-5 Mini',
    provider: 'openai',
    costPerMTokInput: 0.25,
    costPerMTokOutput: 2.00,
    latency: 'fast',
    contextWindow: 272000,
    bestFor: ['messaging', 'customer-service', 'intent-detection'],
    supportsVoice: false,
  },
  [AI_MODELS.GPT_5]: {
    id: AI_MODELS.GPT_5,
    name: 'GPT-5',
    provider: 'openai',
    costPerMTokInput: 1.25,
    costPerMTokOutput: 10.00,
    latency: 'moderate',
    contextWindow: 272000,
    bestFor: ['complex-reasoning', 'coding', 'analysis'],
    supportsVoice: false,
  },
  // GPT-4o (Voice optimized)
  [AI_MODELS.GPT_4O]: {
    id: AI_MODELS.GPT_4O,
    name: 'GPT-4o',
    provider: 'openai',
    costPerMTokInput: 5.00,
    costPerMTokOutput: 15.00,
    latency: 'fast',
    contextWindow: 128000,
    bestFor: ['voice', 'multimodal', 'real-time'],
    supportsVoice: true,
  },
  [AI_MODELS.GPT_4O_MINI]: {
    id: AI_MODELS.GPT_4O_MINI,
    name: 'GPT-4o Mini',
    provider: 'openai',
    costPerMTokInput: 0.15,
    costPerMTokOutput: 0.60,
    latency: 'fast',
    contextWindow: 128000,
    bestFor: ['voice-budget', 'simple-tasks'],
    supportsVoice: true,
  },
  // Claude 4.5
  [AI_MODELS.CLAUDE_HAIKU_4_5]: {
    id: AI_MODELS.CLAUDE_HAIKU_4_5,
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    costPerMTokInput: 1.00,
    costPerMTokOutput: 5.00,
    latency: 'ultra-fast',
    contextWindow: 200000,
    bestFor: ['messaging', 'spanish', 'customer-service'],
    supportsVoice: false,
  },
  [AI_MODELS.CLAUDE_SONNET_4_5]: {
    id: AI_MODELS.CLAUDE_SONNET_4_5,
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    costPerMTokInput: 3.00,
    costPerMTokOutput: 15.00,
    latency: 'fast',
    contextWindow: 200000,
    bestFor: ['coding', 'analysis', 'complex-tasks'],
    supportsVoice: false,
  },
};

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Obtiene el modelo por defecto para un caso de uso
 */
export function getDefaultModel(useCase: keyof typeof DEFAULT_MODELS): AIModelId {
  return DEFAULT_MODELS[useCase];
}

/**
 * Obtiene la informacion de un modelo
 */
export function getModelInfo(modelId: string): ModelInfo | null {
  return MODEL_INFO[modelId] || null;
}

/**
 * Determina el provider (openai o anthropic) de un modelo
 */
export function getModelProvider(modelId: string): 'openai' | 'anthropic' {
  if (modelId.startsWith('claude')) {
    return 'anthropic';
  }
  return 'openai';
}

/**
 * Verifica si un modelo soporta voz
 */
export function supportsVoice(modelId: string): boolean {
  const info = MODEL_INFO[modelId];
  return info?.supportsVoice ?? false;
}

// ======================
// OPENAI CLIENT CONFIG
// ======================

export const OPENAI_CONFIG = {
  baseURL: 'https://api.openai.com/v1',
  defaultMaxTokens: 500,
  defaultTemperature: 0.7,
};

// ======================
// ANTHROPIC CLIENT CONFIG
// ======================

export const ANTHROPIC_CONFIG = {
  defaultMaxTokens: 500,
  defaultTemperature: 0.7,
};
