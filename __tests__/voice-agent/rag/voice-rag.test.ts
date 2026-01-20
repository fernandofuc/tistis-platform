/**
 * TIS TIS Platform - Voice Agent v2.0
 * VoiceRAG Core Tests
 */

import {
  VoiceRAG,
  createVoiceRAG,
  getVoiceRAG,
  resetVoiceRAG,
} from '../../../lib/voice-agent/rag/voice-rag';
import { resetCache } from '../../../lib/voice-agent/rag/cache';
import { resetQueryOptimizer } from '../../../lib/voice-agent/rag/query-optimizer';
import { resetResponseFormatter } from '../../../lib/voice-agent/rag/response-formatter';
import type { RAGContext, VoiceRAGConfig } from '../../../lib/voice-agent/rag/types';

// Mock fetch for OpenAI embeddings
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock Supabase
const mockRpc = jest.fn();
const mockFunctionsInvoke = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockLimit = jest.fn();

const mockSupabase = {
  rpc: mockRpc,
  functions: {
    invoke: mockFunctionsInvoke,
  },
  from: mockFrom,
};

// Setup chain for Supabase queries
mockFrom.mockReturnValue({
  select: mockSelect,
});
mockSelect.mockReturnValue({
  eq: mockEq,
});
mockEq.mockReturnValue({
  eq: mockEq,
  in: mockIn,
  limit: mockLimit,
});
mockIn.mockReturnValue({
  limit: mockLimit,
});
mockLimit.mockResolvedValue({ data: [], error: null });

describe('VoiceRAG', () => {
  const defaultContext: RAGContext = {
    tenantId: 'tenant-123',
    locale: 'es',
    assistantType: 'rest_basic',
    callId: 'call-123',
  };

  const mockEmbedding = Array(1536).fill(0.1);

  beforeEach(() => {
    jest.clearAllMocks();
    resetVoiceRAG();
    resetCache();
    resetQueryOptimizer();
    resetResponseFormatter();

    // Default mock responses
    mockFunctionsInvoke.mockResolvedValue({
      data: { embedding: mockEmbedding },
      error: null,
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'doc-1',
          content: 'Abrimos de 9am a 6pm de lunes a viernes.',
          similarity: 0.9,
          category: 'hours',
        },
      ],
      error: null,
    });

    // Mock fetch for OpenAI API fallback
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: mockEmbedding }],
      }),
    });
  });

  describe('constructor', () => {
    it('should create VoiceRAG with default config', () => {
      const rag = new VoiceRAG({
        supabaseClient: mockSupabase as any,
      });

      expect(rag).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const config: VoiceRAGConfig = {
        supabaseClient: mockSupabase as any,
        enableCache: true,
        enableQueryOptimization: true,
        retrieval: {
          maxResults: 5,
          minSimilarity: 0.8,
        },
      };

      const rag = new VoiceRAG(config);

      expect(rag).toBeDefined();
    });
  });

  describe('query', () => {
    let rag: VoiceRAG;

    beforeEach(() => {
      rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
      });
    });

    it('should process a query successfully', async () => {
      const result = await rag.query('¿A qué hora abren?', defaultContext);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should return sources from vector search', async () => {
      const result = await rag.query('¿Cuál es el horario?', defaultContext);

      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0].id).toBe('doc-1');
      expect(result.sources[0].score).toBe(0.9);
    });

    it('should include query optimization info', async () => {
      const result = await rag.query('¿Cuál es el horario?', defaultContext);

      expect(result.queryOptimization).toBeDefined();
      expect(result.queryOptimization?.intent).toBe('hours');
    });

    it('should cache results and return from cache', async () => {
      // First query
      const result1 = await rag.query('¿A qué hora abren?', defaultContext);
      expect(result1.fromCache).toBe(false);

      // Second query - should be cached
      const result2 = await rag.query('¿A qué hora abren?', defaultContext);
      expect(result2.fromCache).toBe(true);
    });

    it('should not use cache when disabled', async () => {
      const noCacheRag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
        enableCache: false,
      });

      await noCacheRag.query('test', defaultContext);
      const result2 = await noCacheRag.query('test', defaultContext);

      expect(result2.fromCache).toBe(false);
    });

    it('should handle embedding failure gracefully', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Embedding failed' },
      });

      // Also fail the OpenAI fallback
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await rag.query('test', defaultContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use fallback search when vector search fails', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      mockLimit.mockResolvedValue({
        data: [
          { id: 'fallback-1', content: 'Fallback content', category: 'general' },
        ],
        error: null,
      });

      const result = await rag.query('test', defaultContext);

      expect(mockFrom).toHaveBeenCalledWith('business_knowledge');
    });

    it('should include latency breakdown', async () => {
      const result = await rag.query('test', defaultContext);

      expect(result.latencyBreakdown).toBeDefined();
      expect(result.latencyBreakdown?.queryOptimization).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown?.retrieval).toBeGreaterThanOrEqual(0);
      expect(result.latencyBreakdown?.formatting).toBeGreaterThanOrEqual(0);
    });
  });

  describe('queryByCategory', () => {
    let rag: VoiceRAG;

    beforeEach(() => {
      rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
      });
    });

    it('should filter by specified categories', async () => {
      await rag.queryByCategory('test', defaultContext, ['hours', 'location']);

      expect(mockRpc).toHaveBeenCalled();
    });
  });

  describe('getBusinessInfo', () => {
    let rag: VoiceRAG;

    beforeEach(() => {
      rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
      });
    });

    it('should get hours info', async () => {
      const result = await rag.getBusinessInfo(defaultContext, 'hours');

      expect(result.queryOptimization?.intent).toBe('hours');
    });

    it('should get location info', async () => {
      const result = await rag.getBusinessInfo(defaultContext, 'location');

      expect(result).toBeDefined();
    });

    it('should get menu info', async () => {
      const result = await rag.getBusinessInfo(defaultContext, 'menu');

      expect(result).toBeDefined();
    });
  });

  describe('invalidateCache', () => {
    let rag: VoiceRAG;

    beforeEach(() => {
      // Ensure mocks work for cache tests
      mockFunctionsInvoke.mockResolvedValue({
        data: { embedding: mockEmbedding },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });
      mockRpc.mockResolvedValue({
        data: [
          { id: 'doc-1', content: 'Test content.', similarity: 0.9 },
        ],
        error: null,
      });

      rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
      });
    });

    it('should invalidate cache for tenant', async () => {
      // Populate cache
      await rag.query('test1', defaultContext);
      await rag.query('test2', defaultContext);

      const count = rag.invalidateCache('tenant-123');

      expect(count).toBe(2);

      // Verify cache is cleared
      const result = await rag.query('test1', defaultContext);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('metrics', () => {
    let rag: VoiceRAG;

    beforeEach(() => {
      // Ensure mocks work for metrics tests
      mockFunctionsInvoke.mockResolvedValue({
        data: { embedding: mockEmbedding },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });
      mockRpc.mockResolvedValue({
        data: [
          { id: 'doc-1', content: 'Test content.', similarity: 0.9 },
        ],
        error: null,
      });

      rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
      });
    });

    it('should track query metrics', async () => {
      await rag.query('test1', defaultContext);
      await rag.query('test2', defaultContext);

      const metrics = rag.getMetrics();

      expect(metrics.totalQueries).toBe(2);
      expect(metrics.successfulQueries).toBe(2);
      // avgLatencyMs may be 0 if mocks resolve instantly, so we just check it's defined and non-negative
      expect(metrics.avgLatencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.avgLatencyMs).toBe('number');
    });

    it('should track failed queries', async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Failed' },
      });

      // Also fail the OpenAI fallback
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await rag.query('test', defaultContext);

      const metrics = rag.getMetrics();

      expect(metrics.failedQueries).toBe(1);
    });

    it('should track queries by intent', async () => {
      await rag.query('¿Cuál es el horario?', defaultContext);
      await rag.query('¿Qué tienen en el menú?', defaultContext);

      const metrics = rag.getMetrics();

      expect(metrics.queriesByIntent['hours']).toBe(1);
      expect(metrics.queriesByIntent['menu']).toBe(1);
    });

    it('should reset metrics', async () => {
      await rag.query('test', defaultContext);

      rag.resetMetrics();

      const metrics = rag.getMetrics();

      expect(metrics.totalQueries).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance with getVoiceRAG', () => {
      const rag1 = getVoiceRAG({ supabaseClient: mockSupabase as any });
      const rag2 = getVoiceRAG();

      expect(rag1).toBe(rag2);
    });

    it('should reset with resetVoiceRAG', () => {
      const rag1 = getVoiceRAG({ supabaseClient: mockSupabase as any });
      resetVoiceRAG();

      // Need to pass config again after reset
      const rag2 = getVoiceRAG({ supabaseClient: mockSupabase as any });

      expect(rag1).not.toBe(rag2);
    });
  });

  describe('no results handling', () => {
    let rag: VoiceRAG;

    beforeEach(() => {
      // Ensure embeddings work but no documents found
      mockFunctionsInvoke.mockResolvedValue({
        data: { embedding: mockEmbedding },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });
      mockRpc.mockResolvedValue({ data: [], error: null });

      rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
      });
    });

    it('should return fallback message when no documents found', async () => {
      const result = await rag.query('obscure query', defaultContext);

      expect(result.success).toBe(false);
      expect(result.response).toContain('información');
    });

    it('should use custom fallback when configured', async () => {
      const customRag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
        noResultsFallback: {
          es: 'No encontré nada sobre eso.',
          en: "I couldn't find anything about that.",
        },
      });

      const result = await customRag.query('test', defaultContext);

      expect(result.response).toBe('No encontré nada sobre eso.');
    });
  });

  describe('English locale', () => {
    it('should handle English queries', async () => {
      // Reset to ensure clean state
      resetVoiceRAG();
      resetCache();

      // Setup mocks for this test
      mockFunctionsInvoke.mockResolvedValue({
        data: { embedding: mockEmbedding },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding }],
        }),
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'doc-1',
            content: 'We are open from 9am to 6pm.',
            similarity: 0.9,
            category: 'hours',
          },
        ],
        error: null,
      });

      const rag = createVoiceRAG({
        supabaseClient: mockSupabase as any,
        queryOptimizer: { locale: 'en' },
        responseFormatter: { locale: 'en' },
      });

      const enContext: RAGContext = {
        ...defaultContext,
        locale: 'en',
      };

      const result = await rag.query('What are your hours?', enContext);

      expect(result.success).toBe(true);
      expect(result.sources.length).toBeGreaterThan(0);
    });
  });
});
