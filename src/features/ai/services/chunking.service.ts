/**
 * ChunkingService - División semántica de documentos
 * MEJORA-3.1: Implementación completa
 *
 * Estrategias soportadas:
 * - Recursive: Para texto general
 * - Markdown: Para documentos con formato
 * - Sentence: Para preservar oraciones completas
 * - Paragraph: Para documentos estructurados
 *
 * Este servicio resuelve el problema del truncamiento naive que corta
 * oraciones a la mitad y pierde contexto en los bordes.
 *
 * Nota: Implementación propia de text splitters para evitar dependencias externas.
 */

// ============================================
// TEXT SPLITTER IMPLEMENTATIONS (sin dependencias externas)
// ============================================

interface TextSplitterConfig {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

/**
 * Implementación de RecursiveCharacterTextSplitter
 * Divide texto recursivamente usando múltiples separadores
 */
class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(config: TextSplitterConfig) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
    this.separators = config.separators || ['\n\n', '\n', '. ', ' ', ''];
  }

  async splitText(text: string): Promise<string[]> {
    return this.splitTextRecursive(text, this.separators);
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];

    // Encontrar el primer separador que funciona
    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === '') {
        separator = sep;
        break;
      }
      if (text.includes(sep)) {
        separator = sep;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    // Dividir por el separador
    const splits = separator ? text.split(separator) : Array.from(text);

    // Procesar cada split
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const split of splits) {
      const splitLength = split.length + (separator ? separator.length : 0);

      if (currentLength + splitLength > this.chunkSize && currentChunk.length > 0) {
        // Crear chunk
        const chunk = currentChunk.join(separator);
        if (chunk.length > this.chunkSize && newSeparators.length > 0) {
          // Recursivamente dividir si es muy grande
          finalChunks.push(...this.splitTextRecursive(chunk, newSeparators));
        } else if (chunk.length > 0) {
          finalChunks.push(chunk);
        }

        // FIX: Guardar referencia a chunks anteriores ANTES de limpiar
        const previousChunks = [...currentChunk];

        // Limpiar para el siguiente chunk
        currentChunk = [];
        currentLength = 0;

        // Aplicar overlap: añadir splits del final del chunk anterior
        let overlapLength = 0;
        for (let i = previousChunks.length - 1; i >= 0; i--) {
          const prevSplit = previousChunks[i];
          const prevSplitLength = prevSplit.length + (separator ? separator.length : 0);

          if (overlapLength + prevSplitLength <= this.chunkOverlap) {
            currentChunk.unshift(prevSplit);
            overlapLength += prevSplitLength;
          } else {
            break;
          }
        }
        currentLength = overlapLength;
      }

      currentChunk.push(split);
      currentLength += splitLength;
    }

    // Procesar el último chunk
    if (currentChunk.length > 0) {
      const chunk = currentChunk.join(separator);
      if (chunk.length > this.chunkSize && newSeparators.length > 0) {
        finalChunks.push(...this.splitTextRecursive(chunk, newSeparators));
      } else if (chunk.length > 0) {
        finalChunks.push(chunk);
      }
    }

    return finalChunks;
  }
}

/**
 * Implementación de MarkdownTextSplitter
 * Divide texto usando separadores de Markdown
 */
class MarkdownTextSplitter extends RecursiveCharacterTextSplitter {
  constructor(config: Omit<TextSplitterConfig, 'separators'>) {
    super({
      ...config,
      separators: [
        '\n## ',
        '\n### ',
        '\n#### ',
        '\n##### ',
        '\n###### ',
        '\n\n',
        '\n- ',
        '\n* ',
        '\n1. ',
        '\n',
        '. ',
        ' ',
        '',
      ],
    });
  }
}

// ============================================
// TIPOS
// ============================================

export interface ChunkingConfig {
  strategy: 'recursive' | 'markdown' | 'sentence' | 'paragraph';
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  preserveSentences: boolean;
  addMetadata: boolean;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  index: number;
  totalChunks: number;
}

export interface ChunkMetadata {
  sourceId: string;
  sourceType: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  wordCount: number;
  hasOverlapBefore: boolean;
  hasOverlapAfter: boolean;
  headings?: string[];
  keywords?: string[];
}

export interface ChunkingResult {
  chunks: Chunk[];
  totalChunks: number;
  avgChunkSize: number;
  processingTimeMs: number;
}

// ============================================
// CONFIGURACIONES PREDEFINIDAS
// ============================================

export const CHUNKING_PRESETS = {
  // Para artículos de knowledge base
  knowledgeBase: {
    strategy: 'recursive' as const,
    chunkSize: 1000,
    chunkOverlap: 200, // 20% overlap
    minChunkSize: 100,
    preserveSentences: true,
    addMetadata: true,
  },

  // Para FAQs (chunks más pequeños)
  faq: {
    strategy: 'sentence' as const,
    chunkSize: 500,
    chunkOverlap: 100,
    minChunkSize: 50,
    preserveSentences: true,
    addMetadata: true,
  },

  // Para políticas (documentos largos)
  policy: {
    strategy: 'markdown' as const,
    chunkSize: 1500,
    chunkOverlap: 300,
    minChunkSize: 200,
    preserveSentences: true,
    addMetadata: true,
  },

  // Para descripciones de servicios
  service: {
    strategy: 'paragraph' as const,
    chunkSize: 800,
    chunkOverlap: 150,
    minChunkSize: 100,
    preserveSentences: true,
    addMetadata: true,
  },
} as const;

// ============================================
// SEPARADORES POR IDIOMA
// ============================================

const SPANISH_SEPARATORS = [
  '\n\n', // Párrafos
  '\n', // Líneas
  '. ', // Oraciones
  '? ', // Preguntas
  '! ', // Exclamaciones
  '; ', // Punto y coma
  ', ', // Comas
  ' ', // Espacios
  '', // Caracteres
];

// Nota: MARKDOWN_SEPARATORS están definidos directamente en MarkdownTextSplitter
// para mantener la implementación autocontenida sin dependencias externas

// ============================================
// SERVICIO PRINCIPAL
// ============================================

export class ChunkingService {
  private config: ChunkingConfig;

  constructor(config?: Partial<ChunkingConfig>) {
    this.config = {
      strategy: 'recursive',
      chunkSize: 1000,
      chunkOverlap: 200,
      minChunkSize: 100,
      preserveSentences: true,
      addMetadata: true,
      ...config,
    };
  }

  /**
   * Divide un texto en chunks semánticos
   */
  async chunkText(
    text: string,
    sourceId: string,
    sourceType: string,
    customConfig?: Partial<ChunkingConfig>
  ): Promise<ChunkingResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...customConfig };

    // Preprocesar texto
    const cleanedText = this.preprocessText(text);

    // Si el texto es muy corto, retornarlo como un solo chunk
    if (cleanedText.length <= config.chunkSize) {
      const singleChunk: Chunk = {
        id: `${sourceId}-chunk-0`,
        content: cleanedText,
        metadata: {
          sourceId,
          sourceType,
          chunkIndex: 0,
          startChar: 0,
          endChar: cleanedText.length,
          wordCount: cleanedText.split(/\s+/).length,
          hasOverlapBefore: false,
          hasOverlapAfter: false,
          headings: this.extractHeadings(cleanedText),
          keywords: this.extractKeywords(cleanedText),
        },
        index: 0,
        totalChunks: 1,
      };

      return {
        chunks: [singleChunk],
        totalChunks: 1,
        avgChunkSize: cleanedText.length,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Obtener splitter según estrategia
    const splitter = this.getSplitter(config);

    // Dividir texto
    const rawChunks = await splitter.splitText(cleanedText);

    // Procesar y enriquecer chunks
    const chunks: Chunk[] = rawChunks.map((content: string, index: number) => {
      const startChar = this.findStartPosition(
        cleanedText,
        content,
        index,
        rawChunks
      );

      return {
        id: `${sourceId}-chunk-${index}`,
        content: this.postprocessChunk(content, config),
        metadata: {
          sourceId,
          sourceType,
          chunkIndex: index,
          startChar,
          endChar: startChar + content.length,
          wordCount: content.split(/\s+/).length,
          hasOverlapBefore: index > 0,
          hasOverlapAfter: index < rawChunks.length - 1,
          headings: this.extractHeadings(content),
          keywords: this.extractKeywords(content),
        },
        index,
        totalChunks: rawChunks.length,
      };
    });

    // Filtrar chunks muy pequeños
    const filteredChunks = chunks.filter(
      (chunk) => chunk.content.length >= config.minChunkSize
    );

    // Actualizar totalChunks después del filtrado
    const finalChunks = filteredChunks.map((chunk, idx) => ({
      ...chunk,
      index: idx,
      totalChunks: filteredChunks.length,
    }));

    const avgSize =
      finalChunks.length > 0
        ? finalChunks.reduce((sum, c) => sum + c.content.length, 0) /
          finalChunks.length
        : 0;

    return {
      chunks: finalChunks,
      totalChunks: finalChunks.length,
      avgChunkSize: avgSize,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Chunk múltiples documentos
   */
  async chunkDocuments(
    documents: Array<{ id: string; content: string; type: string }>
  ): Promise<Map<string, ChunkingResult>> {
    const results = new Map<string, ChunkingResult>();

    for (const doc of documents) {
      const preset = this.getPresetForType(doc.type);
      const result = await this.chunkText(doc.content, doc.id, doc.type, preset);
      results.set(doc.id, result);
    }

    return results;
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  private getSplitter(
    config: ChunkingConfig
  ): RecursiveCharacterTextSplitter | MarkdownTextSplitter {
    switch (config.strategy) {
      case 'markdown':
        return new MarkdownTextSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
        });

      case 'sentence':
        return new RecursiveCharacterTextSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
          separators: ['. ', '? ', '! ', '\n', ' '],
        });

      case 'paragraph':
        return new RecursiveCharacterTextSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
          separators: ['\n\n', '\n', '. ', ' '],
        });

      case 'recursive':
      default:
        return new RecursiveCharacterTextSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
          separators: SPANISH_SEPARATORS,
        });
    }
  }

  private preprocessText(text: string): string {
    return (
      text
        // Normalizar saltos de línea primero
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Normalizar múltiples espacios en blanco (pero preservar saltos de línea)
        .replace(/[^\S\n]+/g, ' ')
        // Normalizar múltiples saltos de línea a máximo 2
        .replace(/\n{3,}/g, '\n\n')
        // Remover espacios antes de puntuación
        .replace(/\s+([.,;:!?])/g, '$1')
        // Asegurar espacio después de puntuación
        .replace(/([.,;:!?])([A-Za-zÀ-ÿ])/g, '$1 $2')
        // Trim
        .trim()
    );
  }

  private postprocessChunk(content: string, config: ChunkingConfig): string {
    let processed = content.trim();

    if (config.preserveSentences) {
      // Si el chunk empieza en medio de una oración, añadir "..."
      if (!/^[A-ZÁÉÍÓÚÑ¿¡\d]/.test(processed) && !/^[-•*\d]/.test(processed)) {
        processed = '...' + processed;
      }

      // Si el chunk termina en medio de una oración, añadir "..."
      if (!/[.!?]$/.test(processed) && !/[:;]$/.test(processed)) {
        processed = processed + '...';
      }
    }

    return processed;
  }

  private findStartPosition(
    fullText: string,
    chunk: string,
    index: number,
    allChunks: string[]
  ): number {
    // Aproximación basada en chunks anteriores
    let position = 0;
    for (let i = 0; i < index; i++) {
      position += allChunks[i].length - this.config.chunkOverlap;
    }
    return Math.max(0, position);
  }

  private extractHeadings(content: string): string[] {
    const headings: string[] = [];
    const headingPatterns = [
      /^#+\s+(.+)$/gm, // Markdown headings
      /^([A-ZÁÉÍÓÚÑ][^.!?\n]{10,50})$/gm, // Title-like lines
    ];

    for (const pattern of headingPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const heading = match[1].trim();
        if (heading && !headings.includes(heading)) {
          headings.push(heading);
        }
      }
    }

    return headings.slice(0, 3); // Máximo 3 headings
  }

  private extractKeywords(content: string): string[] {
    // Extraer palabras significativas (>5 chars, no stopwords)
    const stopwords = new Set([
      'para',
      'como',
      'esta',
      'esto',
      'estos',
      'estas',
      'pero',
      'porque',
      'cuando',
      'donde',
      'quien',
      'cual',
      'tiene',
      'tienen',
      'hacer',
      'puede',
      'sobre',
      'entre',
      'desde',
      'hasta',
      'durante',
      'también',
      'además',
      'aunque',
      'mientras',
      'después',
      'antes',
      'siempre',
      'nunca',
      'ahora',
      'aquí',
      'solo',
      'cada',
      'todo',
      'todos',
      'mucho',
      'muchos',
      'poco',
      'pocos',
      'otro',
      'otros',
      'mismo',
      'mismos',
    ]);

    const words = content
      .toLowerCase()
      .replace(/[^\wáéíóúñü\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 5 && !stopwords.has(word));

    // Contar frecuencia
    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    // Retornar top 5 por frecuencia
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private getPresetForType(type: string): Partial<ChunkingConfig> {
    switch (type.toLowerCase()) {
      case 'faq':
      case 'faqs':
        return CHUNKING_PRESETS.faq;
      case 'policy':
      case 'policies':
      case 'ai_business_policies':
        return CHUNKING_PRESETS.policy;
      case 'service':
      case 'services':
        return CHUNKING_PRESETS.service;
      case 'article':
      case 'knowledge':
      case 'ai_knowledge_articles':
      case 'knowledge_article':
      default:
        return CHUNKING_PRESETS.knowledgeBase;
    }
  }

  /**
   * Actualiza configuración
   */
  updateConfig(config: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obtiene configuración actual
   */
  getConfig(): ChunkingConfig {
    return { ...this.config };
  }
}

// ============================================
// SINGLETON
// ============================================

let chunkingServiceInstance: ChunkingService | null = null;

export function getChunkingService(
  config?: Partial<ChunkingConfig>
): ChunkingService {
  if (!chunkingServiceInstance) {
    chunkingServiceInstance = new ChunkingService(config);
  }
  return chunkingServiceInstance;
}

/**
 * Crea una nueva instancia con configuración custom
 * Útil para casos donde se necesitan diferentes configs
 */
export function createChunkingService(
  config?: Partial<ChunkingConfig>
): ChunkingService {
  return new ChunkingService(config);
}

export default ChunkingService;
