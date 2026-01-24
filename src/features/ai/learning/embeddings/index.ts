// =====================================================
// TIS TIS PLATFORM - EMBEDDINGS MODULE
// Semantic embeddings and vector search
// =====================================================

export { EmbeddingService, embeddingService } from './embedding.service';
export { VectorStoreService, vectorStoreService } from './vector-store.service';
export { SemanticSearchService, semanticSearchService } from './semantic-search.service';

// Re-export types
export type {
  EmbeddingConfig,
  EmbeddingResult,
  PatternEmbedding,
  SemanticSearchResult,
} from '../types';
