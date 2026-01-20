/**
 * TIS TIS Platform - Voice Agent v2.0
 * RAG Node
 *
 * Retrieves relevant context from the business knowledge base
 * to answer user questions about:
 * - Menu/services
 * - Hours of operation
 * - Location
 * - Pricing
 * - Policies
 * - FAQs
 *
 * Now integrates with VoiceRAG for optimized voice responses.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import type { VoiceAgentState, RAGResult } from '../state';
import { recordLatency, addError } from '../state';
import { VoiceRAG, createVoiceRAG, type VoiceRAGConfig, type RAGContext } from '../../rag';

// =====================================================
// TYPES
// =====================================================

/**
 * RAG configuration
 */
export interface RAGConfig {
  /** Maximum number of results to retrieve */
  maxResults?: number;

  /** Minimum similarity score (0-1) */
  minScore?: number;

  /** Whether to rerank results */
  rerank?: boolean;

  /** Model for query reformulation */
  reformulationModel?: string;

  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;

  /** Use VoiceRAG for optimized voice responses */
  useVoiceRAG?: boolean;

  /** VoiceRAG configuration */
  voiceRAGConfig?: VoiceRAGConfig;
}

/**
 * Retrieved document
 */
interface RetrievedDocument {
  id: string;
  content: string;
  similarity: number;
  metadata?: {
    category?: string;
    source?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
}

// =====================================================
// RAG NODE
// =====================================================

/** VoiceRAG singleton instance */
let voiceRAGInstance: VoiceRAG | null = null;

/**
 * Get or create VoiceRAG instance
 */
function getVoiceRAGInstance(config?: VoiceRAGConfig): VoiceRAG {
  if (!voiceRAGInstance) {
    voiceRAGInstance = createVoiceRAG(config);
  }
  return voiceRAGInstance;
}

/**
 * RAG node - retrieves context from knowledge base
 * Supports both legacy mode and VoiceRAG mode
 */
export async function ragNode(
  state: VoiceAgentState,
  config?: RAGConfig
): Promise<Partial<VoiceAgentState>> {
  const startTime = Date.now();

  // Use VoiceRAG if enabled
  if (config?.useVoiceRAG) {
    return ragNodeWithVoiceRAG(state, config, startTime);
  }

  // Legacy mode
  const nodeConfig = {
    maxResults: config?.maxResults ?? 3,
    minScore: config?.minScore ?? 0.7,
    rerank: config?.rerank ?? false,
    reformulationModel: config?.reformulationModel ?? 'gpt-4o-mini',
  };

  const supabase = config?.supabaseClient || createServiceClient();

  try {
    const query = state.normalizedInput || state.currentInput;

    console.log(
      `[RAG] Processing query for tenant: ${state.tenantId}`,
      { query: query.substring(0, 50), subIntent: state.subIntent }
    );

    // Step 1: Reformulate query for better retrieval (optional)
    let searchQuery = query;
    if (state.subIntent) {
      searchQuery = await reformulateQuery(
        query,
        state.subIntent,
        nodeConfig.reformulationModel
      );
    }

    // Step 2: Get embedding for the query
    const embedding = await getQueryEmbedding(supabase, searchQuery);

    if (!embedding) {
      console.warn('[RAG] Failed to get query embedding');
      return {
        ...addError(state, 'rag', 'Failed to generate query embedding', true),
        ...recordLatency(state, 'rag', startTime),
        currentNode: 'rag',
        usedRag: true,
        ragResult: {
          context: '',
          sources: [],
          success: false,
          latencyMs: Date.now() - startTime,
        },
      };
    }

    // Step 3: Search vector store
    const documents = await searchVectorStore(
      supabase,
      state.tenantId,
      embedding,
      nodeConfig.maxResults,
      nodeConfig.minScore
    );

    // Step 4: Format context for response generator
    const ragResult = formatRAGResult(documents, startTime);

    console.log(
      `[RAG] Retrieved ${ragResult.sources.length} documents`,
      { latencyMs: ragResult.latencyMs }
    );

    return {
      ...recordLatency(state, 'rag', startTime),
      currentNode: 'rag',
      usedRag: true,
      ragResult,
    };
  } catch (error) {
    console.error('[RAG] Error:', error);

    return {
      ...addError(state, 'rag', error instanceof Error ? error.message : 'Unknown error', true),
      ...recordLatency(state, 'rag', startTime),
      currentNode: 'rag',
      usedRag: true,
      ragResult: {
        context: '',
        sources: [],
        success: false,
        latencyMs: Date.now() - startTime,
      },
    };
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Create Supabase service client
 */
function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Reformulate query for better retrieval
 */
async function reformulateQuery(
  query: string,
  subIntent: string,
  model: string
): Promise<string> {
  try {
    const llm = new ChatOpenAI({
      modelName: model,
      temperature: 0,
      maxTokens: 100,
    });

    const prompt = `Given the user query and detected intent, create an optimized search query for a business knowledge base.

User query: "${query}"
Detected intent: ${subIntent}

Return ONLY the optimized search query, nothing else.`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    return (response.content as string).trim();
  } catch {
    return query;
  }
}

/**
 * Get embedding for query using OpenAI
 */
async function getQueryEmbedding(
  supabase: SupabaseClient,
  query: string
): Promise<number[] | null> {
  try {
    // Use Supabase Edge Function for embeddings
    const { data, error } = await supabase.functions.invoke('embed-text', {
      body: { text: query },
    });

    if (error || !data?.embedding) {
      // Fallback: use OpenAI directly
      return await getOpenAIEmbedding(query);
    }

    return data.embedding;
  } catch {
    return await getOpenAIEmbedding(query);
  }
}

/**
 * Get embedding using OpenAI API directly
 */
async function getOpenAIEmbedding(text: string): Promise<number[] | null> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    console.warn('[RAG] OPENAI_API_KEY not configured, skipping direct embedding');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      console.warn(`[RAG] OpenAI embedding request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data?.data?.[0]?.embedding || null;
  } catch (error) {
    console.warn('[RAG] Error getting OpenAI embedding:', error);
    return null;
  }
}

/**
 * Search vector store for relevant documents
 */
async function searchVectorStore(
  supabase: SupabaseClient,
  tenantId: string,
  embedding: number[],
  maxResults: number,
  minScore: number
): Promise<RetrievedDocument[]> {
  try {
    // Use Supabase's pgvector similarity search
    const { data, error } = await supabase.rpc('match_business_documents', {
      query_embedding: embedding,
      match_tenant_id: tenantId,
      match_threshold: minScore,
      match_count: maxResults,
    });

    if (error) {
      console.warn('[RAG] Vector search error:', error);
      // Fallback to simple text search
      return await fallbackTextSearch(supabase, tenantId, maxResults);
    }

    return (data || []).map((doc: { id: string; content: string; similarity: number; metadata?: Record<string, unknown> }) => ({
      id: doc.id,
      content: doc.content,
      similarity: doc.similarity,
      metadata: doc.metadata,
    }));
  } catch {
    return await fallbackTextSearch(supabase, tenantId, maxResults);
  }
}

/**
 * Fallback text search when vector search fails
 */
async function fallbackTextSearch(
  supabase: SupabaseClient,
  tenantId: string,
  maxResults: number
): Promise<RetrievedDocument[]> {
  try {
    const { data } = await supabase
      .from('business_knowledge')
      .select('id, content, category, updated_at')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .limit(maxResults);

    return (data || []).map((doc: { id: string; content: string; category: string; updated_at: string }) => ({
      id: doc.id,
      content: doc.content,
      similarity: 0.5, // Unknown similarity for fallback
      metadata: {
        category: doc.category,
        updatedAt: doc.updated_at,
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Format RAG result for state
 */
function formatRAGResult(
  documents: RetrievedDocument[],
  startTime: number
): RAGResult {
  if (documents.length === 0) {
    return {
      context: '',
      sources: [],
      success: false,
      latencyMs: Date.now() - startTime,
    };
  }

  // Build context string
  const context = documents
    .map((doc, i) => {
      const category = doc.metadata?.category ? `[${doc.metadata.category}] ` : '';
      return `${category}${doc.content}`;
    })
    .join('\n\n');

  return {
    context,
    sources: documents.map(doc => ({
      id: doc.id,
      text: doc.content.substring(0, 200),
      score: doc.similarity,
      metadata: doc.metadata,
    })),
    success: true,
    latencyMs: Date.now() - startTime,
  };
}

// =====================================================
// CATEGORY-SPECIFIC RETRIEVAL
// =====================================================

/**
 * Get business hours from knowledge base
 */
export async function getBusinessHours(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('business_knowledge')
      .select('content')
      .eq('tenant_id', tenantId)
      .eq('category', 'hours')
      .eq('active', true)
      .single();

    return data?.content || null;
  } catch {
    return null;
  }
}

/**
 * Get menu/services from knowledge base
 */
export async function getMenuOrServices(
  supabase: SupabaseClient,
  tenantId: string,
  isRestaurant: boolean
): Promise<string | null> {
  try {
    const category = isRestaurant ? 'menu' : 'services';
    const { data } = await supabase
      .from('business_knowledge')
      .select('content')
      .eq('tenant_id', tenantId)
      .eq('category', category)
      .eq('active', true)
      .limit(5);

    if (!data || data.length === 0) return null;

    return data.map((d: { content: string }) => d.content).join('\n\n');
  } catch {
    return null;
  }
}

/**
 * Get location/directions from knowledge base
 */
export async function getLocationInfo(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('business_knowledge')
      .select('content')
      .eq('tenant_id', tenantId)
      .eq('category', 'location')
      .eq('active', true)
      .single();

    return data?.content || null;
  } catch {
    return null;
  }
}

// =====================================================
// VOICE RAG INTEGRATION
// =====================================================

/**
 * RAG node using VoiceRAG for optimized voice responses
 */
async function ragNodeWithVoiceRAG(
  state: VoiceAgentState,
  config: RAGConfig,
  startTime: number
): Promise<Partial<VoiceAgentState>> {
  try {
    const query = state.normalizedInput || state.currentInput;
    const voiceRAG = getVoiceRAGInstance(config.voiceRAGConfig);

    console.log(
      `[RAG/VoiceRAG] Processing query for tenant: ${state.tenantId}`,
      { query: query.substring(0, 50), subIntent: state.subIntent }
    );

    // Build context
    const context: RAGContext = {
      tenantId: state.tenantId,
      locale: state.locale,
      assistantType: state.assistantType,
      callId: state.callId,
      subIntent: state.subIntent,
      entities: state.entities,
    };

    // Execute VoiceRAG query
    const result = await voiceRAG.query(query, context);

    // Convert VoiceRAG result to RAGResult
    const ragResult: RAGResult = {
      context: result.response,
      sources: result.sources.map(s => ({
        id: s.id,
        text: s.text,
        score: s.score,
        metadata: { category: s.category },
      })),
      success: result.success,
      latencyMs: result.latencyMs,
    };

    console.log(
      `[RAG/VoiceRAG] Retrieved ${ragResult.sources.length} documents`,
      {
        latencyMs: ragResult.latencyMs,
        fromCache: result.fromCache,
        intent: result.queryOptimization?.intent,
      }
    );

    return {
      ...recordLatency(state, 'rag', startTime),
      currentNode: 'rag',
      usedRag: true,
      ragResult,
    };

  } catch (error) {
    console.error('[RAG/VoiceRAG] Error:', error);

    return {
      ...addError(state, 'rag', error instanceof Error ? error.message : 'Unknown error', true),
      ...recordLatency(state, 'rag', startTime),
      currentNode: 'rag',
      usedRag: true,
      ragResult: {
        context: '',
        sources: [],
        success: false,
        latencyMs: Date.now() - startTime,
      },
    };
  }
}

/**
 * Reset VoiceRAG instance (for testing)
 */
export function resetVoiceRAGInstance(): void {
  voiceRAGInstance = null;
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create RAG node with configuration
 */
export function createRAGNode(config?: RAGConfig) {
  return (state: VoiceAgentState) => ragNode(state, config);
}

/**
 * Create RAG node with VoiceRAG enabled
 */
export function createVoiceOptimizedRAGNode(config?: Omit<RAGConfig, 'useVoiceRAG'>) {
  return createRAGNode({
    ...config,
    useVoiceRAG: true,
  });
}
