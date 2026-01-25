// =====================================================
// TIS TIS PLATFORM - Unified Gemini Service
// Gemini 3.0 Flash for all Setup Assistant operations
// Supports both text generation and vision analysis
// =====================================================

import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';

// =====================================================
// TYPES
// =====================================================

export interface GeminiTextRequest {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiVisionRequest {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface GeminiConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

// =====================================================
// CONSTANTS
// =====================================================

/** Gemini 3.0 Flash Preview - Latest model */
const GEMINI_MODEL = 'gemini-3-flash-preview';

/** Default configuration for text generation */
const DEFAULT_TEXT_CONFIG: GeminiConfig = {
  temperature: 0.3,
  maxOutputTokens: 1500,
  topP: 0.95,
};

/** Default configuration for vision tasks */
const DEFAULT_VISION_CONFIG: GeminiConfig = {
  temperature: 0.2,
  maxOutputTokens: 2000,
  topP: 0.95,
};

// =====================================================
// LAZY INITIALIZATION
// =====================================================

let _genAI: GoogleGenerativeAI | null = null;
let _textModel: GenerativeModel | null = null;
let _visionModel: GenerativeModel | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

function getTextModel(): GenerativeModel {
  if (!_textModel) {
    const genAI = getGenAI();
    _textModel = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: DEFAULT_TEXT_CONFIG.temperature,
        maxOutputTokens: DEFAULT_TEXT_CONFIG.maxOutputTokens,
        topP: DEFAULT_TEXT_CONFIG.topP,
      },
    });
  }
  return _textModel;
}

function getVisionModel(): GenerativeModel {
  if (!_visionModel) {
    const genAI = getGenAI();
    _visionModel = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: DEFAULT_VISION_CONFIG.temperature,
        maxOutputTokens: DEFAULT_VISION_CONFIG.maxOutputTokens,
        topP: DEFAULT_VISION_CONFIG.topP,
      },
    });
  }
  return _visionModel;
}

// =====================================================
// GEMINI SERVICE CLASS
// =====================================================

export class GeminiService {
  private static instance: GeminiService;

  private constructor() {}

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Generate text response using Gemini 2.5 Flash
   * Used for: intent detection, config handlers, response generation
   */
  async generateText(request: GeminiTextRequest): Promise<GeminiResponse> {
    const { prompt, temperature, maxOutputTokens } = request;

    try {
      const genAI = getGenAI();

      // Create model with custom config if provided
      const model = (temperature !== undefined || maxOutputTokens !== undefined)
        ? genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
              temperature: temperature ?? DEFAULT_TEXT_CONFIG.temperature,
              maxOutputTokens: maxOutputTokens ?? DEFAULT_TEXT_CONFIG.maxOutputTokens,
              topP: DEFAULT_TEXT_CONFIG.topP,
            },
          })
        : getTextModel();

      const result = await model.generateContent(prompt);
      const response = result.response;

      return {
        text: response.text(),
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (error) {
      console.error('[GeminiService] Text generation error:', error);
      throw error;
    }
  }

  /**
   * Generate response from image + text prompt
   * Used for: menu analysis, services extraction, promotion detection
   */
  async generateFromImage(request: GeminiVisionRequest): Promise<GeminiResponse> {
    const { prompt, imageBase64, mimeType, temperature, maxOutputTokens } = request;

    try {
      const genAI = getGenAI();

      // Create model with custom config if provided
      const model = (temperature !== undefined || maxOutputTokens !== undefined)
        ? genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
              temperature: temperature ?? DEFAULT_VISION_CONFIG.temperature,
              maxOutputTokens: maxOutputTokens ?? DEFAULT_VISION_CONFIG.maxOutputTokens,
              topP: DEFAULT_VISION_CONFIG.topP,
            },
          })
        : getVisionModel();

      // Prepare image part
      const imagePart: Part = {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = result.response;

      return {
        text: response.text(),
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (error) {
      console.error('[GeminiService] Vision generation error:', error);
      throw error;
    }
  }

  /**
   * Parse JSON from Gemini response
   * Handles both clean JSON and markdown-wrapped JSON
   */
  parseJsonResponse<T>(text: string): T | null {
    try {
      // Try to find JSON in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }

      // Try to parse the whole response as JSON
      return JSON.parse(text) as T;
    } catch {
      console.warn('[GeminiService] Failed to parse JSON from response');
      return null;
    }
  }

  /**
   * Get model info
   */
  getModelInfo(): { model: string; capabilities: string[] } {
    return {
      model: GEMINI_MODEL,
      capabilities: ['text-generation', 'vision', 'reasoning', 'code'],
    };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const geminiService = GeminiService.getInstance();

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Quick text generation
 */
export async function generateText(prompt: string, config?: Partial<GeminiConfig>): Promise<GeminiResponse> {
  return geminiService.generateText({
    prompt,
    temperature: config?.temperature,
    maxOutputTokens: config?.maxOutputTokens,
  });
}

/**
 * Quick vision analysis
 */
export async function analyzeImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  config?: Partial<GeminiConfig>
): Promise<GeminiResponse> {
  return geminiService.generateFromImage({
    prompt,
    imageBase64,
    mimeType,
    temperature: config?.temperature,
    maxOutputTokens: config?.maxOutputTokens,
  });
}
