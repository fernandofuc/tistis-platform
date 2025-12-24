// =====================================================
// TIS TIS PLATFORM - Gemini 3.0 Client Configuration
// Cliente centralizado para Google Gemini AI
// =====================================================

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// ======================
// CONFIGURATION
// ======================

/**
 * Modelos Gemini disponibles (Diciembre 2025)
 *
 * | Modelo                  | Uso Recomendado                       |
 * |-------------------------|---------------------------------------|
 * | gemini-3-pro-preview    | Razonamiento complejo, agentes        |
 * | gemini-3-flash-preview  | Velocidad + calidad, prompts          |
 */
export const GEMINI_MODELS = {
  // Gemini 3 - Modelos de razonamiento avanzado (Diciembre 2025)
  GEMINI_3_PRO: 'gemini-3-pro-preview',
  GEMINI_3_FLASH: 'gemini-3-flash-preview',
} as const;

export type GeminiModelId = typeof GEMINI_MODELS[keyof typeof GEMINI_MODELS];

/**
 * Modelo por defecto para todos los casos de uso
 */
export const DEFAULT_GEMINI_MODELS = {
  /** Generación de prompts profesionales */
  PROMPT_GENERATION: GEMINI_MODELS.GEMINI_3_PRO,

  /** Análisis de negocios y generación de insights */
  BUSINESS_INSIGHTS: GEMINI_MODELS.GEMINI_3_PRO,

  /** Tareas generales */
  GENERAL: GEMINI_MODELS.GEMINI_3_PRO,
} as const;

// ======================
// CLIENT SINGLETON
// ======================

let geminiClientInstance: GoogleGenerativeAI | null = null;

/**
 * Obtiene el cliente de Gemini (singleton)
 * Retorna null si no está configurado
 */
export function getGeminiClient(): GoogleGenerativeAI | null {
  if (geminiClientInstance) {
    return geminiClientInstance;
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('[Gemini] GOOGLE_GEMINI_API_KEY no está configurado');
    return null;
  }

  geminiClientInstance = new GoogleGenerativeAI(apiKey);
  return geminiClientInstance;
}

/**
 * Obtiene un modelo específico de Gemini
 */
export function getGeminiModel(modelId: GeminiModelId = GEMINI_MODELS.GEMINI_3_PRO): GenerativeModel | null {
  const client = getGeminiClient();

  if (!client) {
    return null;
  }

  return client.getGenerativeModel({ model: modelId });
}

// ======================
// HELPER FUNCTIONS
// ======================

export interface GeminiGenerateOptions {
  /** Modelo a usar */
  model?: GeminiModelId;
  /** Temperatura (0-1, default 0.7) */
  temperature?: number;
  /** Máximo de tokens de salida */
  maxOutputTokens?: number;
  /** Formato de salida esperado */
  responseFormat?: 'text' | 'json';
}

export interface GeminiGenerateResult {
  success: boolean;
  content: string;
  error?: string;
  model: string;
  processingTimeMs: number;
}

/**
 * Genera contenido con Gemini con manejo de errores robusto
 *
 * @param prompt - El prompt a enviar
 * @param options - Opciones de configuración
 * @returns Resultado con contenido o error
 */
export async function generateWithGemini(
  prompt: string,
  options: GeminiGenerateOptions = {}
): Promise<GeminiGenerateResult> {
  const startTime = Date.now();
  const modelId = options.model || DEFAULT_GEMINI_MODELS.PROMPT_GENERATION;

  try {
    const model = getGeminiModel(modelId);

    if (!model) {
      return {
        success: false,
        content: '',
        error: 'Cliente Gemini no disponible. Verifica GOOGLE_GEMINI_API_KEY.',
        model: modelId,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Configurar generación
    const generationConfig = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    });

    const response = result.response;
    const text = response.text();

    // Validar respuesta
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        content: '',
        error: 'Gemini retornó una respuesta vacía',
        model: modelId,
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      content: text,
      model: modelId,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Gemini] Error en generateContent:', error);

    return {
      success: false,
      content: '',
      error: errorMessage,
      model: modelId,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Genera contenido JSON con Gemini
 * Extrae automáticamente el JSON de la respuesta
 */
export async function generateJsonWithGemini<T>(
  prompt: string,
  options: Omit<GeminiGenerateOptions, 'responseFormat'> = {}
): Promise<{ success: boolean; data: T | null; error?: string; processingTimeMs: number }> {
  const result = await generateWithGemini(prompt, { ...options, responseFormat: 'json' });

  if (!result.success) {
    return {
      success: false,
      data: null,
      error: result.error,
      processingTimeMs: result.processingTimeMs,
    };
  }

  try {
    // Intentar extraer JSON de la respuesta
    const jsonMatch = result.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

    if (!jsonMatch) {
      return {
        success: false,
        data: null,
        error: 'No se encontró JSON válido en la respuesta',
        processingTimeMs: result.processingTimeMs,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as T;

    return {
      success: true,
      data: parsed,
      processingTimeMs: result.processingTimeMs,
    };

  } catch (parseError) {
    const errorMsg = parseError instanceof Error ? parseError.message : 'Error de parsing';
    console.error('[Gemini] Error parsing JSON:', parseError);
    console.error('[Gemini] Raw content:', result.content.substring(0, 500));

    return {
      success: false,
      data: null,
      error: `Error parsing JSON: ${errorMsg}`,
      processingTimeMs: result.processingTimeMs,
    };
  }
}

// ======================
// VALIDATION
// ======================

/**
 * Verifica si Gemini está configurado correctamente
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GOOGLE_GEMINI_API_KEY;
}

/**
 * Log de estado de configuración (solo en desarrollo)
 */
export function logGeminiStatus(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Gemini] Status:', {
      configured: isGeminiConfigured(),
      defaultModel: DEFAULT_GEMINI_MODELS.PROMPT_GENERATION,
    });
  }
}
