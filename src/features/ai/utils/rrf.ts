/**
 * Reciprocal Rank Fusion (RRF)
 * MEJORA-3.3: Combinación robusta de rankings
 *
 * RRF es un algoritmo para combinar múltiples listas de resultados rankeados.
 * Es superior a la combinación lineal porque:
 * - Es robusto a outliers en scores
 * - No requiere normalización de scores
 * - Favorece documentos rankeados bien en múltiples fuentes
 *
 * Fórmula: RRF(d) = Σ weight(source) / (k + rank(d, source))
 * donde k es una constante (típicamente 60)
 *
 * Referencias:
 * - Cormack, Clarke, Buettcher (2009) "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"
 */

// ============================================
// TIPOS
// ============================================

export interface RankedDocument<T = unknown> {
  id: string;
  document: T;
  rank?: number;
  score?: number;
}

export interface RRFResult<T = unknown> {
  id: string;
  document: T;
  rrfScore: number;
  ranks: RankInfo[];
}

export interface RankInfo {
  source: string;
  rank: number;
  originalScore?: number;
}

export interface RRFConfig {
  /** Constante de suavizado (default: 60). Mayor k = menos peso al ranking absoluto */
  k: number;
  /** Pesos por fuente (default: 1 para todas) */
  weights?: Record<string, number>;
}

// ============================================
// IMPLEMENTACIÓN RRF
// ============================================

/**
 * Fusiona múltiples listas rankeadas usando RRF
 *
 * @param rankedLists - Objeto con listas rankeadas por fuente
 * @param config - Configuración de RRF
 * @returns Lista fusionada ordenada por score RRF
 *
 * @example
 * const semanticResults = [{ id: 'doc1', document: {...}, score: 0.95 }, ...]
 * const keywordResults = [{ id: 'doc2', document: {...}, score: 0.80 }, ...]
 *
 * const fused = reciprocalRankFusion({
 *   semantic: semanticResults,
 *   keyword: keywordResults
 * }, { k: 60, weights: { semantic: 1.2, keyword: 1.0 } });
 */
export function reciprocalRankFusion<T>(
  rankedLists: Record<string, RankedDocument<T>[]>,
  config: RRFConfig = { k: 60 }
): RRFResult<T>[] {
  const { k, weights = {} } = config;

  // Map para acumular scores y documentos
  const documentScores = new Map<
    string,
    {
      document: T;
      rrfScore: number;
      ranks: RankInfo[];
    }
  >();

  // Procesar cada lista
  for (const [source, documents] of Object.entries(rankedLists)) {
    const sourceWeight = weights[source] || 1;

    documents.forEach((doc, index) => {
      const rank = index + 1; // Rank empieza en 1
      const rrfContribution = sourceWeight / (k + rank);

      if (documentScores.has(doc.id)) {
        const existing = documentScores.get(doc.id)!;
        existing.rrfScore += rrfContribution;
        existing.ranks.push({
          source,
          rank,
          originalScore: doc.score,
        });
      } else {
        documentScores.set(doc.id, {
          document: doc.document,
          rrfScore: rrfContribution,
          ranks: [
            {
              source,
              rank,
              originalScore: doc.score,
            },
          ],
        });
      }
    });
  }

  // Convertir a array y ordenar por score RRF
  const results: RRFResult<T>[] = Array.from(documentScores.entries())
    .map(([id, { document, rrfScore, ranks }]) => ({
      id,
      document,
      rrfScore,
      ranks,
    }))
    .sort((a, b) => b.rrfScore - a.rrfScore);

  return results;
}

/**
 * Versión simplificada para fusionar dos listas
 *
 * @example
 * const fused = fuseTwoLists(semanticResults, keywordResults, 1.2, 1.0);
 */
export function fuseTwoLists<T>(
  semanticResults: RankedDocument<T>[],
  keywordResults: RankedDocument<T>[],
  semanticWeight: number = 1,
  keywordWeight: number = 1,
  k: number = 60
): RRFResult<T>[] {
  return reciprocalRankFusion(
    {
      semantic: semanticResults,
      keyword: keywordResults,
    },
    {
      k,
      weights: {
        semantic: semanticWeight,
        keyword: keywordWeight,
      },
    }
  );
}

/**
 * Fusiona tres listas (semántica + keywords + chunks)
 */
export function fuseThreeLists<T>(
  semanticResults: RankedDocument<T>[],
  keywordResults: RankedDocument<T>[],
  chunkResults: RankedDocument<T>[],
  weights: { semantic: number; keyword: number; chunk: number } = {
    semantic: 1.2,
    keyword: 1.0,
    chunk: 0.8,
  },
  k: number = 60
): RRFResult<T>[] {
  return reciprocalRankFusion(
    {
      semantic: semanticResults,
      keyword: keywordResults,
      chunk: chunkResults,
    },
    {
      k,
      weights,
    }
  );
}

/**
 * Calcula el score RRF individual de un documento dado sus ranks
 */
export function calculateRRFScore(
  ranks: number[],
  k: number = 60,
  weights?: number[]
): number {
  return ranks.reduce((sum, rank, index) => {
    const weight = weights?.[index] || 1;
    return sum + weight / (k + rank);
  }, 0);
}

/**
 * Normaliza scores RRF al rango 0-1
 */
export function normalizeRRFScores<T>(results: RRFResult<T>[]): RRFResult<T>[] {
  if (results.length === 0) return [];

  const maxScore = results[0].rrfScore;
  const minScore = results[results.length - 1].rrfScore;
  const range = maxScore - minScore;

  if (range === 0) {
    // Todos tienen el mismo score, normalizar a 1
    return results.map((r) => ({ ...r, rrfScore: 1 }));
  }

  return results.map((r) => ({
    ...r,
    rrfScore: (r.rrfScore - minScore) / range,
  }));
}

/**
 * Calcula métricas de fusión para debugging
 */
export function calculateFusionMetrics<T>(
  results: RRFResult<T>[],
  sourceNames: string[]
): {
  totalDocuments: number;
  documentsPerSource: Record<string, number>;
  overlappingDocuments: number;
  avgRanksPerDocument: number;
  topDocumentSources: string[];
} {
  const documentsPerSource: Record<string, number> = {};
  let totalRanks = 0;
  let overlapping = 0;

  for (const source of sourceNames) {
    documentsPerSource[source] = 0;
  }

  for (const result of results) {
    totalRanks += result.ranks.length;
    if (result.ranks.length > 1) {
      overlapping++;
    }
    for (const rankInfo of result.ranks) {
      documentsPerSource[rankInfo.source]++;
    }
  }

  const topDoc = results[0];
  const topDocumentSources = topDoc ? topDoc.ranks.map((r) => r.source) : [];

  return {
    totalDocuments: results.length,
    documentsPerSource,
    overlappingDocuments: overlapping,
    avgRanksPerDocument: results.length > 0 ? totalRanks / results.length : 0,
    topDocumentSources,
  };
}

export default reciprocalRankFusion;
