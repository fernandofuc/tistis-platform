// =====================================================
// TIS TIS PLATFORM - Token Counter Service
// Professional token counting with js-tiktoken support
// =====================================================
//
// This service provides accurate token counting for LLM prompts.
// Uses js-tiktoken when available, with graceful fallback to
// character-based estimation.
//
// MODELS SUPPORTED:
// - GPT-4, GPT-4 Turbo, GPT-4o (cl100k_base encoding)
// - GPT-3.5 Turbo (cl100k_base encoding)
// - Claude 3 (uses cl100k_base as approximation)
// - Text-embedding-ada-002 (cl100k_base encoding)
//
// USAGE:
// ```ts
// import { countTokens, estimateTokens, TokenCounter } from '@/src/shared/lib/token-counter';
//
// // Quick count
// const tokens = countTokens("Hello world");
//
// // With model specification
// const tokens = countTokens("Hello world", { model: 'gpt-4' });
//
// // Estimate (faster, less accurate)
// const estimated = estimateTokens("Hello world");
//
// // Using singleton
// const count = TokenCounter.count("Hello world");
// ```
// =====================================================

// ======================
// TYPES
// ======================

export type ModelName =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'text-embedding-ada-002'
  | 'text-embedding-3-small'
  | 'text-embedding-3-large';

export type EncodingName = 'cl100k_base' | 'p50k_base' | 'r50k_base' | 'o200k_base';

export interface TokenCountOptions {
  /** Model to use for tokenization (defaults to gpt-4) */
  model?: ModelName;
  /** Whether to use cache (defaults to true) */
  useCache?: boolean;
  /** Force estimation mode even if tiktoken is available */
  forceEstimation?: boolean;
}

export interface TokenCountResult {
  /** Total token count */
  count: number;
  /** Method used: 'tiktoken' or 'estimation' */
  method: 'tiktoken' | 'estimation';
  /** Model/encoding used */
  encoding: EncodingName | 'char-ratio';
  /** Whether result was cached */
  cached: boolean;
  /** Processing time in milliseconds */
  processingMs: number;
}

export interface BatchTokenCountResult {
  /** Individual results */
  results: TokenCountResult[];
  /** Total tokens across all texts */
  totalTokens: number;
  /** Average tokens per text */
  averageTokens: number;
  /** Total processing time */
  totalProcessingMs: number;
}

// ======================
// CONSTANTS
// ======================

/**
 * Model to encoding mapping
 * All GPT-4 and Claude 3 models use cl100k_base
 * GPT-4o uses o200k_base
 */
const MODEL_TO_ENCODING: Record<ModelName, EncodingName> = {
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'claude-3-opus': 'cl100k_base',      // Approximation - Claude uses different tokenizer
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  'text-embedding-ada-002': 'cl100k_base',
  'text-embedding-3-small': 'cl100k_base',
  'text-embedding-3-large': 'cl100k_base',
};

/**
 * Characters per token ratio for estimation
 * Based on empirical analysis of various texts:
 * - English: ~4 chars/token
 * - Spanish: ~3.5 chars/token (more special chars)
 * - Mixed content: ~3.8 chars/token
 * Using 3.5 for Spanish-first platform (conservative)
 */
const CHARS_PER_TOKEN_BY_LANGUAGE: Record<string, number> = {
  en: 4.0,
  es: 3.5,
  mixed: 3.8,
  default: 3.5,
};

/**
 * Cache configuration
 */
const CACHE_MAX_SIZE = 10000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ======================
// TIKTOKEN LOADER
// ======================

// Tiktoken encoder cache
let tiktokenModule: typeof import('js-tiktoken') | null = null;
let tiktokenLoadAttempted = false;
let tiktokenAvailable = false;

// Encoder cache by encoding name
const encoderCache = new Map<EncodingName, ReturnType<typeof import('js-tiktoken')['getEncoding']>>();

/**
 * Attempts to load js-tiktoken module
 * Only tries once to avoid repeated failures
 */
async function loadTiktoken(): Promise<boolean> {
  if (tiktokenLoadAttempted) {
    return tiktokenAvailable;
  }

  tiktokenLoadAttempted = true;

  try {
    // Dynamic import to avoid build errors if not installed
    tiktokenModule = await import('js-tiktoken');
    tiktokenAvailable = true;
    console.log('[TokenCounter] js-tiktoken loaded successfully');
    return true;
  } catch {
    console.log('[TokenCounter] js-tiktoken not available, using estimation mode');
    tiktokenAvailable = false;
    return false;
  }
}

/**
 * Gets or creates an encoder for the specified encoding
 */
function getEncoder(encoding: EncodingName): ReturnType<typeof import('js-tiktoken')['getEncoding']> | null {
  if (!tiktokenModule) return null;

  if (encoderCache.has(encoding)) {
    return encoderCache.get(encoding)!;
  }

  try {
    const encoder = tiktokenModule.getEncoding(encoding);
    encoderCache.set(encoding, encoder);
    return encoder;
  } catch (error) {
    console.error(`[TokenCounter] Failed to create encoder for ${encoding}:`, error);
    return null;
  }
}

// ======================
// TOKEN COUNT CACHE
// ======================

interface CacheEntry {
  count: number;
  timestamp: number;
}

// LRU-ish cache using Map (maintains insertion order)
const tokenCountCache = new Map<string, CacheEntry>();

/**
 * Generates cache key from text and options
 */
function getCacheKey(text: string, encoding: EncodingName | 'estimation'): string {
  // Use first 100 chars + length + hash-like suffix for uniqueness
  const prefix = text.slice(0, 100);
  const suffix = text.slice(-50);
  return `${encoding}:${text.length}:${prefix}:${suffix}`;
}

/**
 * Gets cached token count if available and not expired
 */
function getCachedCount(key: string): number | null {
  const entry = tokenCountCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    tokenCountCache.delete(key);
    return null;
  }

  return entry.count;
}

/**
 * Sets cached token count
 */
function setCachedCount(key: string, count: number): void {
  // Evict oldest entries if cache is full
  if (tokenCountCache.size >= CACHE_MAX_SIZE) {
    const keysToDelete = Array.from(tokenCountCache.keys()).slice(0, CACHE_MAX_SIZE / 10);
    for (const k of keysToDelete) {
      tokenCountCache.delete(k);
    }
  }

  tokenCountCache.set(key, { count, timestamp: Date.now() });
}

/**
 * Clears the token count cache
 */
export function clearTokenCache(): void {
  tokenCountCache.clear();
  console.log('[TokenCounter] Cache cleared');
}

// ======================
// ESTIMATION FUNCTIONS
// ======================

/**
 * Detects the primary language of text
 * Simple heuristic based on character patterns
 */
function detectLanguage(text: string): 'en' | 'es' | 'mixed' {
  // Spanish-specific characters and patterns
  const spanishPattern = /[áéíóúüñ¿¡]/gi;
  const spanishMatches = (text.match(spanishPattern) || []).length;

  // If more than 1% Spanish characters, consider it Spanish
  if (spanishMatches > text.length * 0.01) {
    return 'es';
  }

  // Check for Spanish common words
  const spanishWords = /\b(el|la|los|las|de|que|y|en|un|una|es|por|con|para|no|si|se|su|al|lo|como|más|pero|sus|le|ya|o|este|sí|porque|esta|entre|cuando|muy|sin|sobre|también|me|hasta|hay|donde|quien|desde|todo|nos|durante|todos|uno|les|ni|contra|otros|ese|eso|ante|ellos|e|esto|mí|antes|algunos|qué|unos|yo|otro|otras|otra|él|tanto|esa|estos|mucho|quienes|nada|muchos|cual|poco|ella|estar|estas|algunas|algo|nosotros)\b/gi;
  const spanishWordMatches = (text.match(spanishWords) || []).length;

  if (spanishWordMatches > 5) {
    return 'es';
  }

  // Default to English if text is primarily ASCII
  const asciiRatio = (text.match(/[\x00-\x7F]/g) || []).length / text.length;
  if (asciiRatio > 0.95) {
    return 'en';
  }

  return 'mixed';
}

/**
 * Estimates token count using character ratio
 * More accurate than simple division by accounting for language
 */
export function estimateTokens(text: string, language?: 'en' | 'es' | 'mixed'): number {
  if (!text) return 0;

  const lang = language || detectLanguage(text);
  const charsPerToken = CHARS_PER_TOKEN_BY_LANGUAGE[lang] || CHARS_PER_TOKEN_BY_LANGUAGE.default;

  // Base calculation
  let estimate = Math.ceil(text.length / charsPerToken);

  // Adjust for special patterns that use more tokens
  // - Numbers use more tokens (each digit often = 1 token)
  const numberMatches = (text.match(/\d+/g) || []);
  for (const num of numberMatches) {
    // Numbers longer than 3 digits use ~1 token per 1-3 digits
    if (num.length > 3) {
      estimate += Math.ceil(num.length / 3) - 1;
    }
  }

  // - URLs and emails use many tokens
  const urlMatches = (text.match(/https?:\/\/[^\s]+/g) || []).length;
  const emailMatches = (text.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).length;
  estimate += (urlMatches + emailMatches) * 5;

  // - Code/technical content uses more tokens
  const codePatterns = (text.match(/[{}[\]()=><;:]/g) || []).length;
  if (codePatterns > text.length * 0.05) {
    estimate = Math.ceil(estimate * 1.2);
  }

  return estimate;
}

/**
 * Estimates tokens for a message with role (for chat completions)
 * Accounts for message overhead (~4 tokens per message)
 */
export function estimateMessageTokens(
  content: string,
  role: 'system' | 'user' | 'assistant' = 'user'
): number {
  const contentTokens = estimateTokens(content);
  // Each message has overhead: role, name, etc. (~4 tokens)
  const messageOverhead = 4;
  return contentTokens + messageOverhead;
}

/**
 * Estimates tokens for a conversation (array of messages)
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;

  for (const msg of messages) {
    total += estimateMessageTokens(
      msg.content,
      msg.role as 'system' | 'user' | 'assistant'
    );
  }

  // Conversation overhead (~3 tokens)
  total += 3;

  return total;
}

// ======================
// MAIN TOKEN COUNTING
// ======================

/**
 * Counts tokens using tiktoken (synchronous, requires prior initialization)
 */
function countTokensWithTiktoken(text: string, encoding: EncodingName): number | null {
  const encoder = getEncoder(encoding);
  if (!encoder) return null;

  try {
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    console.error('[TokenCounter] Tiktoken encoding error:', error);
    return null;
  }
}

/**
 * Counts tokens in text with full options
 * Returns detailed result with metadata
 */
export async function countTokensDetailed(
  text: string,
  options: TokenCountOptions = {}
): Promise<TokenCountResult> {
  const startTime = performance.now();
  const {
    model = 'gpt-4',
    useCache = true,
    forceEstimation = false,
  } = options;

  // Handle empty text
  if (!text) {
    return {
      count: 0,
      method: 'estimation',
      encoding: 'char-ratio',
      cached: false,
      processingMs: performance.now() - startTime,
    };
  }

  const encoding = MODEL_TO_ENCODING[model];

  // Check cache first
  if (useCache) {
    const cacheKey = getCacheKey(text, forceEstimation ? 'estimation' : encoding);
    const cachedCount = getCachedCount(cacheKey);

    if (cachedCount !== null) {
      return {
        count: cachedCount,
        method: forceEstimation ? 'estimation' : 'tiktoken',
        encoding: forceEstimation ? 'char-ratio' : encoding,
        cached: true,
        processingMs: performance.now() - startTime,
      };
    }
  }

  // Try tiktoken if not forcing estimation
  if (!forceEstimation) {
    await loadTiktoken();

    if (tiktokenAvailable) {
      const count = countTokensWithTiktoken(text, encoding);

      if (count !== null) {
        if (useCache) {
          setCachedCount(getCacheKey(text, encoding), count);
        }

        return {
          count,
          method: 'tiktoken',
          encoding,
          cached: false,
          processingMs: performance.now() - startTime,
        };
      }
    }
  }

  // Fallback to estimation
  const count = estimateTokens(text);

  if (useCache) {
    setCachedCount(getCacheKey(text, 'estimation'), count);
  }

  return {
    count,
    method: 'estimation',
    encoding: 'char-ratio',
    cached: false,
    processingMs: performance.now() - startTime,
  };
}

/**
 * Simple token count function (async)
 * Returns just the count number
 */
export async function countTokens(
  text: string,
  options: TokenCountOptions = {}
): Promise<number> {
  const result = await countTokensDetailed(text, options);
  return result.count;
}

/**
 * Synchronous token count using estimation only
 * Use when you need immediate results without async
 */
export function countTokensSync(text: string): number {
  if (!text) return 0;

  // Check cache first
  const cacheKey = getCacheKey(text, 'estimation');
  const cachedCount = getCachedCount(cacheKey);
  if (cachedCount !== null) return cachedCount;

  // Estimate
  const count = estimateTokens(text);
  setCachedCount(cacheKey, count);

  return count;
}

/**
 * Batch token counting for multiple texts
 */
export async function countTokensBatch(
  texts: string[],
  options: TokenCountOptions = {}
): Promise<BatchTokenCountResult> {
  const startTime = performance.now();
  const results: TokenCountResult[] = [];

  // Process in parallel with limit
  const BATCH_SIZE = 100;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(text => countTokensDetailed(text, options))
    );
    results.push(...batchResults);
  }

  const totalTokens = results.reduce((sum, r) => sum + r.count, 0);

  return {
    results,
    totalTokens,
    averageTokens: texts.length > 0 ? Math.round(totalTokens / texts.length) : 0,
    totalProcessingMs: performance.now() - startTime,
  };
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Checks if tiktoken is available
 */
export async function isTiktokenAvailable(): Promise<boolean> {
  await loadTiktoken();
  return tiktokenAvailable;
}

/**
 * Gets token count statistics for debugging
 */
export function getTokenCounterStats(): {
  tiktokenAvailable: boolean;
  cacheSize: number;
  encodersCached: number;
} {
  return {
    tiktokenAvailable,
    cacheSize: tokenCountCache.size,
    encodersCached: encoderCache.size,
  };
}

/**
 * Truncates text to fit within token limit
 * Binary search for optimal truncation point
 */
export async function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  options: TokenCountOptions = {}
): Promise<{ text: string; tokens: number; truncated: boolean }> {
  const currentTokens = await countTokens(text, options);

  if (currentTokens <= maxTokens) {
    return { text, tokens: currentTokens, truncated: false };
  }

  // Binary search for optimal truncation point
  let low = 0;
  let high = text.length;
  let bestLength = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const truncated = text.slice(0, mid);
    const tokens = await countTokens(truncated, { ...options, useCache: false });

    if (tokens <= maxTokens) {
      bestLength = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const truncatedText = text.slice(0, bestLength);
  const finalTokens = await countTokens(truncatedText, options);

  return {
    text: truncatedText,
    tokens: finalTokens,
    truncated: true,
  };
}

/**
 * Splits text into chunks that fit within token limit
 */
export async function splitByTokenLimit(
  text: string,
  maxTokensPerChunk: number,
  options: TokenCountOptions = {}
): Promise<string[]> {
  const totalTokens = await countTokens(text, options);

  if (totalTokens <= maxTokensPerChunk) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const { text: chunk, truncated } = await truncateToTokenLimit(
      remaining,
      maxTokensPerChunk,
      options
    );

    if (chunk.length === 0) {
      // Can't fit anything, force at least some content
      chunks.push(remaining.slice(0, 100));
      remaining = remaining.slice(100);
    } else {
      chunks.push(chunk);
      remaining = truncated ? remaining.slice(chunk.length) : '';
    }
  }

  return chunks;
}

// ======================
// SINGLETON SERVICE
// ======================

/**
 * TokenCounter singleton for convenient access
 */
export const TokenCounter = {
  /** Count tokens (async) */
  count: countTokens,

  /** Count tokens with details */
  countDetailed: countTokensDetailed,

  /** Count tokens synchronously (estimation only) */
  countSync: countTokensSync,

  /** Count tokens for batch of texts */
  countBatch: countTokensBatch,

  /** Estimate tokens (fast, less accurate) */
  estimate: estimateTokens,

  /** Estimate message tokens with overhead */
  estimateMessage: estimateMessageTokens,

  /** Estimate conversation tokens */
  estimateConversation: estimateConversationTokens,

  /** Truncate text to token limit */
  truncate: truncateToTokenLimit,

  /** Split text by token limit */
  split: splitByTokenLimit,

  /** Check if tiktoken is available */
  isAccurate: isTiktokenAvailable,

  /** Get stats */
  getStats: getTokenCounterStats,

  /** Clear cache */
  clearCache: clearTokenCache,
};

export default TokenCounter;
