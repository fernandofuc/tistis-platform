// =====================================================
// TIS TIS PLATFORM - Setup Assistant Streaming Service
// Enables streaming responses for better UX
// =====================================================

import { GoogleGenerativeAI, GenerateContentStreamResult } from '@google/generative-ai';

// =====================================================
// TYPES
// =====================================================

export interface StreamingConfig {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StreamChunk {
  type: 'text' | 'done' | 'error';
  content: string;
  isPartial?: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

// =====================================================
// CONSTANTS
// =====================================================

/** Gemini 3.0 Flash Preview model */
const GEMINI_MODEL = 'gemini-3-flash-preview';

/** Default streaming configuration */
const DEFAULT_CONFIG: StreamingConfig = {
  temperature: 0.3,
  maxOutputTokens: 1500,
};

// =====================================================
// LAZY INITIALIZATION
// =====================================================

let _genAI: GoogleGenerativeAI | null = null;

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

// =====================================================
// STREAMING SERVICE CLASS
// =====================================================

export class StreamingService {
  private static instance: StreamingService;

  private constructor() {}

  static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  /**
   * Generate streaming text response
   * Yields chunks as they are generated
   */
  async *streamText(
    prompt: string,
    config: StreamingConfig = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const genAI = getGenAI();
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: finalConfig.temperature,
        maxOutputTokens: finalConfig.maxOutputTokens,
      },
    });

    try {
      const result: GenerateContentStreamResult = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            type: 'text',
            content: text,
            isPartial: true,
          };
        }
      }

      yield {
        type: 'done',
        content: '',
      };
    } catch (error) {
      console.error('[StreamingService] Error streaming text:', error);
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : 'Streaming error',
      };
    }
  }

  /**
   * Generate streaming response with callback
   * Useful for non-generator contexts
   */
  async streamTextWithCallback(
    prompt: string,
    callback: StreamCallback,
    config: StreamingConfig = {}
  ): Promise<string> {
    let fullResponse = '';

    for await (const chunk of this.streamText(prompt, config)) {
      callback(chunk);

      if (chunk.type === 'text') {
        fullResponse += chunk.content;
      }

      if (chunk.type === 'error') {
        throw new Error(chunk.content);
      }
    }

    return fullResponse;
  }

  /**
   * Create a ReadableStream for HTTP streaming responses
   * Use this for Next.js API routes
   */
  createReadableStream(
    prompt: string,
    config: StreamingConfig = {}
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const generator = this.streamText(prompt, config);

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            // Format as Server-Sent Events (SSE)
            const data = JSON.stringify(chunk);
            const sseMessage = `data: ${data}\n\n`;
            controller.enqueue(encoder.encode(sseMessage));

            if (chunk.type === 'done' || chunk.type === 'error') {
              break;
            }
          }
        } catch (error) {
          const errorChunk: StreamChunk = {
            type: 'error',
            content: error instanceof Error ? error.message : 'Stream error',
          };
          const data = JSON.stringify(errorChunk);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } finally {
          controller.close();
        }
      },
    });
  }

  /**
   * Stream with context for Setup Assistant
   * Includes system prompt and conversation context
   */
  async *streamWithContext(
    systemPrompt: string,
    userMessage: string,
    config: StreamingConfig = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const fullPrompt = `${systemPrompt}\n\nMensaje del usuario: ${userMessage}`;

    for await (const chunk of this.streamText(fullPrompt, config)) {
      yield chunk;
    }
  }

  /**
   * Parse streaming response for JSON extraction
   * Useful when expecting structured data in the response
   */
  async streamAndParseJson<T>(
    prompt: string,
    config: StreamingConfig = {}
  ): Promise<{ fullText: string; parsed: T | null }> {
    let fullText = '';

    for await (const chunk of this.streamText(prompt, config)) {
      if (chunk.type === 'text') {
        fullText += chunk.content;
      }

      if (chunk.type === 'error') {
        throw new Error(chunk.content);
      }
    }

    // Try to extract JSON from the response
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return {
          fullText,
          parsed: JSON.parse(jsonMatch[0]) as T,
        };
      }
    } catch {
      console.warn('[StreamingService] Failed to parse JSON from response');
    }

    return { fullText, parsed: null };
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const streamingService = StreamingService.getInstance();

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Create SSE response headers for Next.js
 */
export function createSSEHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
  });
}

/**
 * Parse SSE chunk from client-side
 */
export function parseSSEChunk(data: string): StreamChunk | null {
  try {
    // SSE format: "data: {...}\n\n"
    const jsonMatch = data.match(/^data:\s*(.+)$/m);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as StreamChunk;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}
