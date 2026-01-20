/**
 * TIS TIS Platform - Voice Agent v2.0
 * Response Formatter
 *
 * Formats RAG results for natural voice output:
 * - Summarizes long content
 * - Limits to 2-3 sentences
 * - Removes technical jargon
 * - Adds natural speech patterns
 */

import type {
  FormattedResponse,
  ResponseFormatterConfig,
  RetrievedDocument,
  QueryIntent,
} from './types';

// =====================================================
// CONSTANTS
// =====================================================

/** Default max response length */
const DEFAULT_MAX_LENGTH = 300;

/** Default max sentences */
const DEFAULT_MAX_SENTENCES = 3;

/** Sentence end patterns */
const SENTENCE_END = /[.!?。！？]/;

/** Technical terms to simplify */
const TECHNICAL_TERMS: Record<string, { es: string; en: string }> = {
  'profilaxis': { es: 'limpieza dental', en: 'dental cleaning' },
  'endodoncia': { es: 'tratamiento de conducto', en: 'root canal' },
  'periodoncia': { es: 'tratamiento de encías', en: 'gum treatment' },
  'ortodoncia': { es: 'tratamiento de alineación', en: 'teeth alignment' },
  'blanqueamiento dental': { es: 'aclaramiento de dientes', en: 'teeth whitening' },
  'empaste': { es: 'relleno', en: 'filling' },
  'extracción': { es: 'sacar un diente', en: 'tooth removal' },
  'radiografía': { es: 'rayos x', en: 'x-ray' },
  'anestesia local': { es: 'anestesia', en: 'numbing' },
};

/** Filler phrases for natural speech */
const FILLER_INTROS: Record<string, string[]> = {
  es: [
    'Claro, ',
    'Por supuesto, ',
    'Con gusto le informo que ',
    'Le cuento que ',
    '',  // Sometimes no filler
  ],
  en: [
    'Sure, ',
    'Of course, ',
    "I'd be happy to tell you that ",
    'Let me share that ',
    '',
  ],
};

/** Confidence phrases */
const CONFIDENCE_PHRASES: Record<string, { high: string; medium: string; low: string }> = {
  es: {
    high: '',
    medium: 'Según la información disponible, ',
    low: 'No estoy completamente seguro, pero creo que ',
  },
  en: {
    high: '',
    medium: 'Based on available information, ',
    low: "I'm not entirely sure, but I believe ",
  },
};

// =====================================================
// RESPONSE FORMATTER CLASS
// =====================================================

/**
 * Formats RAG results for voice output
 */
export class ResponseFormatter {
  private config: Required<ResponseFormatterConfig>;

  constructor(config?: ResponseFormatterConfig) {
    this.config = {
      maxLength: config?.maxLength ?? DEFAULT_MAX_LENGTH,
      maxSentences: config?.maxSentences ?? DEFAULT_MAX_SENTENCES,
      locale: config?.locale ?? 'es',
      includeSources: config?.includeSources ?? false,
      simplifyTerms: config?.simplifyTerms ?? true,
      style: config?.style ?? 'conversational',
    };
  }

  /**
   * Format retrieved documents into a voice-friendly response
   */
  format(
    documents: RetrievedDocument[],
    intent?: QueryIntent
  ): FormattedResponse {
    if (documents.length === 0) {
      return this.createNoResultsResponse();
    }

    // Combine document content
    const combinedContent = this.combineDocuments(documents);
    const originalLength = combinedContent.length;

    // Simplify technical terms if enabled
    let processedContent = combinedContent;
    if (this.config.simplifyTerms) {
      processedContent = this.simplifyTechnicalTerms(processedContent);
    }

    // Extract most relevant sentences
    const sentences = this.extractSentences(processedContent);
    const selectedSentences = this.selectBestSentences(sentences, intent);

    // Build response
    let text = selectedSentences.join(' ');

    // Apply style
    text = this.applyStyle(text, documents[0].similarity);

    // Truncate if too long
    const wasTruncated = text.length > this.config.maxLength;
    if (wasTruncated) {
      text = this.truncateText(text);
    }

    // Create summary (first sentence or shorter version)
    const summary = this.createSummary(selectedSentences);

    // Determine confidence
    const confidence = this.determineConfidence(documents);

    return {
      text,
      summary,
      wasTruncated,
      originalLength,
      sources: documents.map(d => d.id),
      confidence,
    };
  }

  /**
   * Format a single document
   */
  formatSingle(document: RetrievedDocument): FormattedResponse {
    return this.format([document]);
  }

  /**
   * Create no results response
   */
  private createNoResultsResponse(): FormattedResponse {
    const text = this.config.locale === 'en'
      ? "I don't have specific information about that. Would you like to ask something else?"
      : 'No tengo información específica sobre eso. ¿Le gustaría preguntar algo más?';

    return {
      text,
      summary: text,
      wasTruncated: false,
      originalLength: 0,
      sources: [],
      confidence: 'low',
    };
  }

  /**
   * Combine multiple documents into coherent text
   */
  private combineDocuments(documents: RetrievedDocument[]): string {
    // Sort by similarity
    const sorted = [...documents].sort((a, b) => b.similarity - a.similarity);

    // Take top documents and combine
    const parts: string[] = [];

    for (const doc of sorted) {
      // Clean content
      let content = doc.content.trim();

      // Remove redundant category prefixes
      content = content.replace(/^\[.*?\]\s*/g, '');

      // Skip if very similar to existing parts
      const isDuplicate = parts.some(p =>
        this.similarity(p.toLowerCase(), content.toLowerCase()) > 0.8
      );

      if (!isDuplicate) {
        parts.push(content);
      }
    }

    return parts.join(' ');
  }

  /**
   * Simplify technical terms (preserves original case structure)
   */
  private simplifyTechnicalTerms(text: string): string {
    let result = text;

    for (const [term, replacements] of Object.entries(TECHNICAL_TERMS)) {
      const replacement = this.config.locale === 'en'
        ? replacements.en
        : replacements.es;

      // Replace case-insensitively but preserve sentence structure
      const pattern = new RegExp(term, 'gi');
      result = result.replace(pattern, (match) => {
        // If original was capitalized, capitalize replacement
        if (match[0] === match[0].toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }

    return result;
  }

  /**
   * Extract sentences from text
   */
  private extractSentences(text: string): string[] {
    const sentences: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      current += text[i];

      if (SENTENCE_END.test(text[i]) && current.trim().length > 10) {
        sentences.push(current.trim());
        current = '';
      }
    }

    // Add remaining text if substantial
    if (current.trim().length > 10) {
      sentences.push(current.trim());
    }

    return sentences;
  }

  /**
   * Select best sentences based on intent
   */
  private selectBestSentences(sentences: string[], intent?: QueryIntent): string[] {
    if (sentences.length <= this.config.maxSentences) {
      return sentences;
    }

    // Score sentences based on relevance to intent
    const scored = sentences.map((sentence, index) => ({
      sentence,
      score: this.scoreSentence(sentence, index, intent),
    }));

    // Sort by score and take top N
    scored.sort((a, b) => b.score - a.score);

    return scored
      .slice(0, this.config.maxSentences)
      .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
      .map(s => s.sentence);
  }

  /**
   * Score a sentence for relevance
   */
  private scoreSentence(sentence: string, position: number, intent?: QueryIntent): number {
    let score = 0;

    // Prefer earlier sentences (more likely to be important)
    score += Math.max(0, 10 - position);

    // Check for intent-related keywords
    if (intent) {
      const intentKeywords = this.getIntentKeywords(intent);
      for (const keyword of intentKeywords) {
        if (sentence.toLowerCase().includes(keyword)) {
          score += 5;
        }
      }
    }

    // Prefer sentences with specific information
    if (/\d/.test(sentence)) score += 3;  // Contains numbers
    if (/:/.test(sentence)) score += 2;   // Contains colons (times, lists)
    if (/pesos?|dollars?|\$|€/i.test(sentence)) score += 3;  // Contains prices

    // Penalize very short sentences
    if (sentence.length < 30) score -= 2;

    // Penalize sentences that are just questions
    if (/^(¿|what|how|when|where)/i.test(sentence)) score -= 5;

    return score;
  }

  /**
   * Get keywords for an intent
   */
  private getIntentKeywords(intent: QueryIntent): string[] {
    const keywords: Record<QueryIntent, string[]> = {
      menu: ['menú', 'menu', 'platillo', 'dish', 'comida', 'food', 'precio', 'price'],
      services: ['servicio', 'service', 'tratamiento', 'treatment', 'procedimiento'],
      hours: ['horario', 'hours', 'abierto', 'open', 'cerrado', 'closed', 'hora'],
      location: ['dirección', 'address', 'ubicación', 'location', 'calle', 'street'],
      pricing: ['precio', 'price', 'costo', 'cost', 'pesos', 'dollars', '$'],
      policies: ['política', 'policy', 'cancelación', 'cancellation', 'regla', 'rule'],
      availability: ['disponible', 'available', 'espacio', 'space', 'lugar'],
      contact: ['teléfono', 'phone', 'email', 'contacto', 'contact'],
      promotions: ['promoción', 'promotion', 'descuento', 'discount', 'oferta', 'offer'],
      general: [],
    };

    return keywords[intent] || [];
  }

  /**
   * Apply conversational style
   */
  private applyStyle(text: string, similarity: number): string {
    if (this.config.style === 'concise') {
      return text;
    }

    const locale = this.config.locale as 'es' | 'en';

    // Add confidence prefix if needed
    const confidence = similarity > 0.85 ? 'high' : similarity > 0.7 ? 'medium' : 'low';
    const confidencePhrase = CONFIDENCE_PHRASES[locale]?.[confidence] || CONFIDENCE_PHRASES['es'][confidence] || '';

    // Add natural intro for conversational style (deterministic - first non-empty intro)
    let intro = '';
    if (this.config.style === 'conversational' && confidence === 'high') {
      const intros = FILLER_INTROS[locale] || FILLER_INTROS['es'];
      // Use first non-empty intro for deterministic behavior
      intro = intros.find(i => i.length > 0) || '';
    }

    return `${intro}${confidencePhrase}${text}`;
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string): string {
    if (text.length <= this.config.maxLength) {
      return text;
    }

    // Find last sentence end before limit
    let truncateAt = this.config.maxLength;

    for (let i = this.config.maxLength; i > this.config.maxLength / 2; i--) {
      if (SENTENCE_END.test(text[i])) {
        truncateAt = i + 1;
        break;
      }
    }

    let truncated = text.substring(0, truncateAt).trim();

    // Add ellipsis if we cut mid-sentence
    if (!SENTENCE_END.test(truncated[truncated.length - 1])) {
      // Find last complete word
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > truncated.length / 2) {
        truncated = truncated.substring(0, lastSpace);
      }
      truncated += '...';
    }

    return truncated;
  }

  /**
   * Create summary from sentences
   */
  private createSummary(sentences: string[]): string {
    if (sentences.length === 0) {
      return '';
    }

    const firstSentence = sentences[0];

    // If first sentence is short enough, use it
    if (firstSentence.length <= 100) {
      return firstSentence;
    }

    // Otherwise truncate
    return this.truncateText(firstSentence);
  }

  /**
   * Determine confidence level from document scores
   */
  private determineConfidence(
    documents: RetrievedDocument[]
  ): 'high' | 'medium' | 'low' {
    if (documents.length === 0) return 'low';

    const avgSimilarity = documents.reduce((sum, d) => sum + d.similarity, 0) / documents.length;
    const topSimilarity = documents[0]?.similarity || 0;

    if (topSimilarity > 0.85 && avgSimilarity > 0.75) return 'high';
    if (topSimilarity > 0.7 && avgSimilarity > 0.6) return 'medium';
    return 'low';
  }

  /**
   * Simple string similarity (Jaccard-like)
   */
  private similarity(a: string, b: string): number {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));

    let intersection = 0;
    for (const word of setA) {
      if (setB.has(word)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ResponseFormatterConfig> {
    return { ...this.config };
  }
}

// =====================================================
// SPECIALIZED FORMATTERS
// =====================================================

/**
 * Format menu items for voice
 */
export function formatMenuForVoice(
  items: Array<{ name: string; price?: number; description?: string }>,
  locale: string = 'es',
  maxItems: number = 3
): string {
  if (items.length === 0) {
    return locale === 'en'
      ? 'No menu items found.'
      : 'No encontré artículos en el menú.';
  }

  const limited = items.slice(0, maxItems);
  const parts = limited.map(item => {
    if (item.price) {
      return locale === 'en'
        ? `${item.name} for ${item.price} pesos`
        : `${item.name} a ${item.price} pesos`;
    }
    return item.name;
  });

  let result = parts.join(', ');

  if (items.length > maxItems) {
    const more = items.length - maxItems;
    result += locale === 'en'
      ? `, and ${more} more options`
      : `, y ${more} opciones más`;
  }

  return result;
}

/**
 * Format hours for voice
 */
export function formatHoursForVoice(
  hours: { open: string; close: string; day?: string },
  locale: string = 'es'
): string {
  const { open, close, day } = hours;

  if (day) {
    return locale === 'en'
      ? `On ${day}, we're open from ${open} to ${close}.`
      : `El ${day} abrimos de ${open} a ${close}.`;
  }

  return locale === 'en'
    ? `We're open from ${open} to ${close}.`
    : `Abrimos de ${open} a ${close}.`;
}

/**
 * Format location for voice
 */
export function formatLocationForVoice(
  location: { address: string; reference?: string; parking?: string },
  locale: string = 'es'
): string {
  let result = locale === 'en'
    ? `We're located at ${location.address}.`
    : `Estamos ubicados en ${location.address}.`;

  if (location.reference) {
    result += locale === 'en'
      ? ` ${location.reference}`
      : ` ${location.reference}`;
  }

  if (location.parking) {
    result += locale === 'en'
      ? ` For parking, ${location.parking.toLowerCase()}.`
      : ` Para estacionamiento, ${location.parking.toLowerCase()}.`;
  }

  return result;
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a response formatter instance
 */
export function createResponseFormatter(
  config?: ResponseFormatterConfig
): ResponseFormatter {
  return new ResponseFormatter(config);
}

// =====================================================
// DEFAULT INSTANCE
// =====================================================

let defaultFormatter: ResponseFormatter | null = null;

/**
 * Get the default response formatter instance
 */
export function getResponseFormatter(
  config?: ResponseFormatterConfig
): ResponseFormatter {
  if (!defaultFormatter) {
    defaultFormatter = createResponseFormatter(config);
  }
  return defaultFormatter;
}

/**
 * Reset the default formatter (for testing)
 */
export function resetResponseFormatter(): void {
  defaultFormatter = null;
}
