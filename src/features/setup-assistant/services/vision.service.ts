// =====================================================
// TIS TIS PLATFORM - Vision Analysis Service
// Uses Gemini 3.0 Flash for image analysis
// Unified with the main Gemini service
// Now with caching to reduce API costs
// =====================================================

import { geminiService } from './gemini.service';
import { visionCacheService } from './vision-cache.service';
import type { VisionAnalysis } from '../types';

// =====================================================
// ANALYSIS PROMPTS BY CONTEXT
// =====================================================

const MENU_ANALYSIS_PROMPT = `Analiza esta imagen de menú de restaurante.

Extrae TODOS los platillos, bebidas y productos que puedas identificar.

Para cada item, extrae:
- Nombre del platillo/producto
- Precio (si está visible)
- Categoría (Entradas, Platos Fuertes, Bebidas, Postres, etc.)
- Descripción corta (si está visible)

Responde SOLO con JSON válido (sin markdown):
{
  "type": "menu",
  "confidence": 0.0-1.0,
  "description": "Breve descripción de lo que ves",
  "items": [
    {
      "name": "Nombre del platillo",
      "price": 150.00,
      "category": "Platos Fuertes",
      "description": "Descripción si está disponible"
    }
  ],
  "suggestions": ["Sugerencia 1", "Sugerencia 2"]
}`;

const SERVICES_ANALYSIS_PROMPT = `Analiza esta imagen de lista de servicios/precios.

Extrae TODOS los servicios que puedas identificar.

Para cada servicio, extrae:
- Nombre del servicio
- Precio (si está visible)
- Duración (si está indicada, en minutos)
- Categoría

Responde SOLO con JSON válido (sin markdown):
{
  "type": "services",
  "confidence": 0.0-1.0,
  "description": "Breve descripción de lo que ves",
  "items": [
    {
      "name": "Nombre del servicio",
      "price": 500.00,
      "duration": 60,
      "category": "Tratamientos"
    }
  ],
  "suggestions": ["Sugerencia 1"]
}`;

const PROMOTION_ANALYSIS_PROMPT = `Analiza esta imagen de promoción/folleto.

Extrae la información de la promoción:
- Título de la promoción
- Descripción
- Descuento o beneficio
- Condiciones
- Fechas de vigencia (si están visibles)

Responde SOLO con JSON válido (sin markdown):
{
  "type": "promotion",
  "confidence": 0.0-1.0,
  "description": "Breve descripción de la promoción",
  "promotion": {
    "title": "Título",
    "description": "Descripción completa",
    "discount": "20% de descuento",
    "conditions": "Válido en compras mayores a $500",
    "validFrom": "2024-01-01",
    "validTo": "2024-01-31"
  },
  "suggestions": ["Sugerencia 1"]
}`;

const GENERAL_ANALYSIS_PROMPT = `Analiza esta imagen y extrae cualquier información útil para configurar un negocio.

Puede ser:
- Información de contacto
- Horarios de operación
- Políticas del negocio
- Cualquier dato relevante

Responde SOLO con JSON válido (sin markdown):
{
  "type": "general",
  "confidence": 0.0-1.0,
  "description": "Descripción de lo que ves",
  "extractedData": {
    // Datos extraídos
  },
  "suggestions": ["Sugerencia 1"]
}`;

const DETECT_TYPE_PROMPT = `Mira esta imagen y determina qué tipo de contenido es:
- "menu": Menú de restaurante con platillos y precios
- "services": Lista de servicios con precios
- "promotion": Folleto o publicidad de promoción
- "general": Otro tipo de documento

Responde SOLO con JSON: {"type": "menu|services|promotion|general"}`;

// =====================================================
// TYPES
// =====================================================

export type AnalysisContext = 'menu' | 'services' | 'promotion' | 'general';

export interface AnalyzeImageInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType: string;
  context: AnalysisContext;
  additionalContext?: string;
  /** Tenant ID for caching - if provided, results are cached */
  tenantId?: string;
  /** Skip cache lookup (still stores result in cache) */
  skipCache?: boolean;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getPromptForContext(context: AnalysisContext): string {
  switch (context) {
    case 'menu':
      return MENU_ANALYSIS_PROMPT;
    case 'services':
      return SERVICES_ANALYSIS_PROMPT;
    case 'promotion':
      return PROMOTION_ANALYSIS_PROMPT;
    case 'general':
    default:
      return GENERAL_ANALYSIS_PROMPT;
  }
}

function normalizeExtractedData(parsed: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {
    type: parsed.type,
  };

  if (parsed.items && Array.isArray(parsed.items)) {
    data.items = parsed.items;
  }

  if (parsed.promotion) {
    data.promotion = parsed.promotion;
  }

  if (parsed.extractedData && typeof parsed.extractedData === 'object') {
    Object.assign(data, parsed.extractedData);
  }

  return data;
}

// Maximum image size (10MB)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
// Fetch timeout (30 seconds)
const FETCH_TIMEOUT_MS = 30000;

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Check content-length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${contentLength} bytes (max: ${MAX_IMAGE_SIZE})`);
    }

    const buffer = await response.arrayBuffer();

    // Verify actual size
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${buffer.byteLength} bytes (max: ${MAX_IMAGE_SIZE})`);
    }

    return Buffer.from(buffer).toString('base64');
  } finally {
    clearTimeout(timeoutId);
  }
}

// =====================================================
// VISION SERVICE CLASS
// =====================================================

export class VisionService {
  private static instance: VisionService;

  private constructor() {}

  static getInstance(): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService();
    }
    return VisionService.instance;
  }

  /**
   * Analyze an image and extract structured data
   * Uses Gemini 3.0 Flash for vision analysis
   * Results are cached to reduce API costs
   */
  async analyzeImage(input: AnalyzeImageInput): Promise<VisionAnalysis> {
    const {
      imageUrl,
      imageBase64,
      mimeType,
      context,
      additionalContext,
      tenantId,
      skipCache = false,
    } = input;

    // Prepare image data first (needed for cache key)
    let base64Data: string;
    try {
      if (imageBase64) {
        base64Data = imageBase64;
      } else if (imageUrl) {
        base64Data = await fetchImageAsBase64(imageUrl);
      } else {
        throw new Error('Either imageUrl or imageBase64 is required');
      }
    } catch (error) {
      console.error('[VisionService] Error preparing image:', error);
      return {
        description: 'No se pudo cargar la imagen',
        extractedData: {},
        confidence: 0,
        suggestions: ['Verifica que la URL de la imagen sea accesible'],
      };
    }

    // Check cache if tenantId is provided and skipCache is false
    if (tenantId && !skipCache && !additionalContext) {
      // Note: We don't cache when additionalContext is provided
      // because it makes the analysis unique
      const cachedResult = await visionCacheService.get(base64Data, context, tenantId);
      if (cachedResult) {
        console.log('[VisionService] Returning cached analysis');
        return cachedResult;
      }
    }

    // Get appropriate prompt
    let prompt = getPromptForContext(context);
    if (additionalContext) {
      // Sanitize and limit additional context to prevent prompt injection
      const sanitizedContext = additionalContext
        .slice(0, 500) // Limit length
        .replace(/```/g, '') // Remove code blocks
        .replace(/\n{3,}/g, '\n\n'); // Normalize newlines
      prompt += `\n\nCONTEXTO DEL USUARIO: ${sanitizedContext}`;
    }

    try {
      // Use the unified Gemini service for vision
      const result = await geminiService.generateFromImage({
        prompt,
        imageBase64: base64Data,
        mimeType,
        temperature: 0.2, // Lower temperature for more consistent extraction
        maxOutputTokens: 2000,
      });

      // Parse JSON response
      const parsed = geminiService.parseJsonResponse<{
        type: string;
        confidence: number;
        description: string;
        items?: unknown[];
        promotion?: unknown;
        extractedData?: Record<string, unknown>;
        suggestions?: string[];
      }>(result.text);

      if (!parsed) {
        throw new Error('No JSON found in vision response');
      }

      const analysis: VisionAnalysis = {
        description: parsed.description || 'Imagen analizada',
        extractedData: normalizeExtractedData(parsed),
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };

      // Store in cache if tenantId is provided and no additionalContext
      if (tenantId && !additionalContext && analysis.confidence > 0.5) {
        // Only cache high-confidence results
        visionCacheService.set(base64Data, context, tenantId, analysis).catch((err) => {
          console.warn('[VisionService] Failed to cache result:', err);
        });
      }

      return analysis;
    } catch (error) {
      console.error('[VisionService] Error analyzing image:', error);

      return {
        description: 'No se pudo analizar la imagen completamente',
        extractedData: {},
        confidence: 0,
        suggestions: [
          'Intenta con una imagen más clara',
          'Asegúrate de que el texto sea legible',
        ],
      };
    }
  }

  /**
   * Analyze menu image specifically
   */
  async analyzeMenu(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    return this.analyzeImage({
      imageUrl,
      mimeType,
      context: 'menu',
    });
  }

  /**
   * Analyze services list
   */
  async analyzeServices(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    return this.analyzeImage({
      imageUrl,
      mimeType,
      context: 'services',
    });
  }

  /**
   * Analyze promotion image
   */
  async analyzePromotion(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    return this.analyzeImage({
      imageUrl,
      mimeType,
      context: 'promotion',
    });
  }

  /**
   * Auto-detect context and analyze
   */
  async autoAnalyze(imageUrl: string, mimeType: string): Promise<VisionAnalysis> {
    try {
      const base64 = await fetchImageAsBase64(imageUrl);

      // First, detect the type using Gemini
      const detectResult = await geminiService.generateFromImage({
        prompt: DETECT_TYPE_PROMPT,
        imageBase64: base64,
        mimeType,
        temperature: 0.1, // Very low for classification
        maxOutputTokens: 100,
      });

      const typeMatch = detectResult.text.match(/"type":\s*"(\w+)"/);
      const detectedType = (typeMatch?.[1] || 'general') as AnalysisContext;

      // Validate detected type
      const validTypes: AnalysisContext[] = ['menu', 'services', 'promotion', 'general'];
      const context = validTypes.includes(detectedType) ? detectedType : 'general';

      // Now do full analysis with detected context
      return this.analyzeImage({
        imageBase64: base64,
        mimeType,
        context,
      });
    } catch (error) {
      console.error('[VisionService] Error in auto-analyze:', error);
      // Fallback to general analysis
      return this.analyzeImage({
        imageUrl,
        mimeType,
        context: 'general',
      });
    }
  }

  /**
   * Get context suggestion based on vertical
   */
  getContextForVertical(vertical: string): AnalysisContext {
    switch (vertical) {
      case 'restaurant':
        return 'menu';
      case 'dental':
      case 'clinic':
      case 'beauty':
      case 'gym':
      case 'veterinary':
        return 'services';
      default:
        return 'general';
    }
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

export const visionService = VisionService.getInstance();
