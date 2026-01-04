// =====================================================
// TIS TIS PLATFORM - Gemini Ticket Extraction Service
// Uses Gemini 2.0 Flash for OCR and data extraction from tickets
// =====================================================

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type {
  TicketExtractedData,
  ExtractedItem,
  ValidationError,
  ProcessTicketResponse,
} from '../types';

// ======================
// CONFIGURATION
// ======================

const GEMINI_MODEL = 'gemini-2.0-flash-exp';

const EXTRACTION_PROMPT = `Eres un experto en extraer información de tickets/recibos de restaurantes mexicanos.

TAREA: Analiza la imagen del ticket y extrae TODA la información visible de manera estructurada.

INSTRUCCIONES:
1. Identifica el nombre del restaurante y su dirección si aparece
2. Extrae el número de ticket/folio
3. Extrae la fecha y hora exactas
4. Lista TODOS los items consumidos con:
   - Descripción exacta del producto
   - Cantidad
   - Precio unitario
   - Total por item
5. Identifica subtotal, impuestos (IVA), propina y total
6. Si hay información del mesero o mesa, inclúyela
7. Identifica el método de pago si aparece

FORMATO DE RESPUESTA (JSON estricto):
{
  "restaurant_name": "Nombre del restaurante",
  "restaurant_address": "Dirección si aparece",
  "ticket_number": "Número de ticket/folio",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "items": [
    {
      "description": "Nombre del producto",
      "quantity": 1,
      "unit_price": 100.00,
      "total": 100.00,
      "notes": "Notas adicionales si las hay"
    }
  ],
  "subtotal": 100.00,
  "tax": 16.00,
  "tip": 0.00,
  "total": 116.00,
  "payment_method": "efectivo|tarjeta|transferencia",
  "table_number": "Mesa 5",
  "server_name": "Nombre del mesero",
  "additional_info": {
    "campo": "valor"
  }
}

REGLAS IMPORTANTES:
- Si un campo no es visible o legible, usa null
- Los precios deben ser números decimales (sin símbolos de moneda)
- La fecha debe estar en formato ISO (YYYY-MM-DD)
- La hora en formato 24 horas (HH:MM)
- Asegúrate de que subtotal + tax + tip = total (o muy cercano)
- Si hay items ilegibles, incluye lo que puedas leer con "notes": "parcialmente legible"

RESPONDE ÚNICAMENTE CON EL JSON, sin explicaciones adicionales.`;

// ======================
// SERVICE CLASS
// ======================

export class GeminiExtractionService {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!key) {
      throw new Error('Gemini API key not configured. Set GOOGLE_AI_API_KEY or GEMINI_API_KEY environment variable.');
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for accuracy
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });
  }

  /**
   * Extract data from a ticket image
   * @param imageSource - URL or base64 encoded image
   * @returns Extracted ticket data
   */
  async extractFromTicket(imageSource: string): Promise<{
    data: TicketExtractedData | null;
    confidence: number;
    errors: ValidationError[];
    tokens: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];

    try {
      // Prepare the image part
      const imagePart = await this.prepareImagePart(imageSource);

      // Call Gemini
      const result = await this.model.generateContent([
        { text: EXTRACTION_PROMPT },
        imagePart,
      ]);

      const response = result.response;
      const text = response.text();

      // Parse JSON response
      let extractedData: TicketExtractedData;
      try {
        extractedData = JSON.parse(text);
      } catch {
        // Try to extract JSON from response if wrapped in markdown
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Failed to parse Gemini response as JSON');
        }
      }

      // Validate and clean the extracted data
      const { data: cleanedData, validationErrors } = this.validateAndClean(extractedData);
      errors.push(...validationErrors);

      // Calculate confidence score
      const confidence = this.calculateConfidence(cleanedData, errors);

      // Get token usage
      const tokens = response.usageMetadata?.totalTokenCount || 0;

      return {
        data: cleanedData,
        confidence,
        errors,
        tokens,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        field: 'extraction',
        message: `Error en extracción: ${errorMessage}`,
        severity: 'error',
      });

      return {
        data: null,
        confidence: 0,
        errors,
        tokens: 0,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Prepare image for Gemini API
   */
  private async prepareImagePart(imageSource: string): Promise<{
    inlineData: { data: string; mimeType: string };
  }> {
    // Check if it's a URL or base64
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
      // Fetch the image and convert to base64
      const response = await fetch(imageSource);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';

      return {
        inlineData: {
          data: base64,
          mimeType,
        },
      };
    } else if (imageSource.startsWith('data:')) {
      // Data URL format: data:image/jpeg;base64,/9j/4AAQ...
      const matches = imageSource.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }
      return {
        inlineData: {
          data: matches[2],
          mimeType: matches[1],
        },
      };
    } else {
      // Assume it's already base64
      return {
        inlineData: {
          data: imageSource,
          mimeType: 'image/jpeg',
        },
      };
    }
  }

  /**
   * Validate and clean extracted data
   */
  private validateAndClean(data: TicketExtractedData): {
    data: TicketExtractedData;
    validationErrors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    // Ensure items array exists
    if (!data.items || !Array.isArray(data.items)) {
      data.items = [];
      errors.push({
        field: 'items',
        message: 'No se detectaron items en el ticket',
        severity: 'warning',
      });
    }

    // Clean and validate items
    data.items = data.items.map((item, index) => {
      const cleanItem: ExtractedItem = {
        description: item.description || `Item ${index + 1}`,
        quantity: this.parseNumber(item.quantity) || 1,
        unit_price: this.parseNumber(item.unit_price) || 0,
        total: this.parseNumber(item.total) || 0,
        notes: item.notes,
      };

      // Validate item total
      const expectedTotal = cleanItem.quantity * cleanItem.unit_price;
      if (Math.abs(expectedTotal - cleanItem.total) > 0.01 && cleanItem.total !== 0) {
        // Use the extracted total if quantity * price doesn't match
        // This handles discounts or special pricing
      }

      return cleanItem;
    });

    // Validate amounts
    const subtotal = this.parseNumber(data.subtotal);
    const tax = this.parseNumber(data.tax);
    const tip = this.parseNumber(data.tip) || 0;
    const total = this.parseNumber(data.total);

    data.subtotal = subtotal || undefined;
    data.tax = tax || undefined;
    data.tip = tip || undefined;
    data.total = total || undefined;

    // Calculate expected total
    if (subtotal && total) {
      const calculatedTotal = subtotal + (tax || 0) + tip;
      const diff = Math.abs(calculatedTotal - total);

      if (diff > 1) {
        errors.push({
          field: 'total',
          message: `El total calculado ($${calculatedTotal.toFixed(2)}) no coincide con el extraído ($${total.toFixed(2)})`,
          severity: 'warning',
        });
      }
    }

    // Validate date format
    if (data.date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.date)) {
        // Try to parse and format
        const parsedDate = this.parseDate(data.date);
        if (parsedDate) {
          data.date = parsedDate;
        } else {
          errors.push({
            field: 'date',
            message: 'Formato de fecha no reconocido',
            severity: 'warning',
          });
        }
      }
    }

    // Validate time format
    if (data.time) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(data.time)) {
        const parsedTime = this.parseTime(data.time);
        if (parsedTime) {
          data.time = parsedTime;
        }
      }
    }

    return { data, validationErrors: errors };
  }

  /**
   * Calculate confidence score based on data quality
   */
  private calculateConfidence(
    data: TicketExtractedData | null,
    errors: ValidationError[]
  ): number {
    if (!data) return 0;

    let score = 100;

    // Deduct for missing critical fields
    if (!data.total) score -= 20;
    if (!data.items || data.items.length === 0) score -= 25;
    if (!data.date) score -= 10;
    if (!data.ticket_number) score -= 5;

    // Deduct for validation errors
    const errorDeductions = errors.reduce((total, error) => {
      return total + (error.severity === 'error' ? 15 : 5);
    }, 0);
    score -= errorDeductions;

    // Deduct for items without prices
    const itemsWithoutPrices = data.items?.filter((i) => !i.unit_price || i.unit_price === 0) || [];
    score -= itemsWithoutPrices.length * 5;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score)) / 100;
  }

  /**
   * Parse number from various formats
   */
  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove currency symbols and spaces
      const cleaned = value.replace(/[$,\s]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): string | null {
    // Try common Mexican date formats
    const formats = [
      /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/, // DD/MM/YYYY or DD-MM-YYYY
      /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})/, // DD/MM/YY
    ];

    for (const regex of formats) {
      const match = dateStr.match(regex);
      if (match) {
        let year: number;
        let month: number;
        let day: number;

        if (match[1].length === 4) {
          // YYYY-MM-DD
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else if (match[3].length === 4) {
          // DD/MM/YYYY
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
        } else {
          // DD/MM/YY
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = 2000 + parseInt(match[3]);
        }

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
      }
    }

    return null;
  }

  /**
   * Parse time from various formats
   */
  private parseTime(timeStr: string): string | null {
    // Match HH:MM or H:MM, with optional AM/PM
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M?))?/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const ampm = match[3]?.toUpperCase();

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }

    return null;
  }
}

// ======================
// SINGLETON EXPORT
// ======================

let instance: GeminiExtractionService | null = null;

export function getGeminiExtractionService(): GeminiExtractionService {
  if (!instance) {
    instance = new GeminiExtractionService();
  }
  return instance;
}

// ======================
// HELPER FUNCTION
// ======================

/**
 * Process a ticket image and return extraction results
 */
export async function processTicketImage(
  imageSource: string
): Promise<ProcessTicketResponse & {
  extracted_data?: TicketExtractedData;
  tokens?: number;
  processing_time_ms?: number;
}> {
  const service = getGeminiExtractionService();
  const result = await service.extractFromTicket(imageSource);

  return {
    extraction_id: '', // Will be set by the API route after DB save
    status: result.data ? (result.errors.some((e) => e.severity === 'error') ? 'failed' : 'completed') : 'failed',
    extracted_data: result.data || undefined,
    confidence_score: result.confidence,
    validation_errors: result.errors,
    tokens: result.tokens,
    processing_time_ms: result.processingTime,
  };
}
