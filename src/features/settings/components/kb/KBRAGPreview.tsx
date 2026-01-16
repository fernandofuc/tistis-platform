// =====================================================
// TIS TIS PLATFORM - KB RAG Preview
// Visual preview of RAG architecture and semantic search
// Part of Knowledge Base Redesign - FASE 8
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/src/shared/utils';

// ======================
// TYPES
// ======================
// ARQUITECTURA V7: Solo 3 categorías visibles en KB (instructions y templates se gestionan en Agente Mensajes)
interface SearchResult {
  id: string;
  category: 'policies' | 'articles' | 'competitors';
  title: string;
  content: string;
  similarity: number;
  chunk_index?: number;
}

interface Props {
  className?: string;
  onSearch?: (query: string) => Promise<SearchResult[]>;
}

// ======================
// MOCK DATA FOR DEMO
// ======================
// ARQUITECTURA V7: Demo results actualizados para las 3 categorías de KB
const DEMO_RESULTS: SearchResult[] = [
  {
    id: '1',
    category: 'policies',
    title: 'Política de Cancelación',
    content: 'Las citas pueden cancelarse hasta 24 horas antes sin cargo. Cancelaciones con menos anticipación tendrán un cargo del 50%.',
    similarity: 0.92,
    chunk_index: 0,
  },
  {
    id: '2',
    category: 'articles',
    title: 'Proceso de Reservación',
    content: 'Para agendar una cita, el paciente puede llamar, enviar WhatsApp o usar nuestra plataforma online. Se requiere confirmar con 24 hrs de anticipación.',
    similarity: 0.85,
    chunk_index: 1,
  },
  {
    id: '3',
    category: 'competitors',
    title: 'Manejo de Competencia',
    content: 'Cuando mencionen a la competencia, destaca nuestros diferenciadores como garantía extendida y tecnología de punta.',
    similarity: 0.78,
  },
];

// ======================
// CATEGORY CONFIG
// ======================
// ARQUITECTURA V7: Solo 3 categorías visibles en KB
const CATEGORY_CONFIG = {
  policies: { label: 'Política', color: 'emerald', icon: '📋' },
  articles: { label: 'Artículo', color: 'blue', icon: '📖' },
  competitors: { label: 'Competencia', color: 'rose', icon: '🎯' },
};

// ======================
// ARCHITECTURE DIAGRAM
// ======================
function ArchitectureDiagram({ isSearching }: { isSearching: boolean }) {
  return (
    <div className="relative p-4 bg-gray-50 rounded-xl">
      <div className="flex items-center justify-between gap-4 text-sm">
        {/* Input */}
        <motion.div
          animate={{ scale: isSearching ? [1, 1.1, 1] : 1 }}
          transition={{ repeat: isSearching ? Infinity : 0, duration: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isSearching ? 'bg-purple-100' : 'bg-gray-100'
          )}>
            <svg className={cn(
              'w-6 h-6',
              isSearching ? 'text-purple-600' : 'text-gray-500'
            )} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="text-xs text-gray-500">Pregunta</span>
        </motion.div>

        {/* Arrow 1 */}
        <div className="flex-1 flex items-center">
          <motion.div
            animate={{ opacity: isSearching ? [0.3, 1, 0.3] : 0.3 }}
            transition={{ repeat: isSearching ? Infinity : 0, duration: 0.5 }}
            className="w-full h-0.5 bg-gradient-to-r from-gray-300 to-purple-500"
          />
          <svg className="w-4 h-4 text-purple-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Embedding */}
        <motion.div
          animate={{ scale: isSearching ? [1, 1.15, 1] : 1 }}
          transition={{ repeat: isSearching ? Infinity : 0, duration: 1, delay: 0.2 }}
          className="flex flex-col items-center gap-2"
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isSearching ? 'bg-indigo-100' : 'bg-gray-100'
          )}>
            <svg className={cn(
              'w-6 h-6',
              isSearching ? 'text-indigo-600' : 'text-gray-500'
            )} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <span className="text-xs text-gray-500">Embedding</span>
        </motion.div>

        {/* Arrow 2 */}
        <div className="flex-1 flex items-center">
          <motion.div
            animate={{ opacity: isSearching ? [0.3, 1, 0.3] : 0.3 }}
            transition={{ repeat: isSearching ? Infinity : 0, duration: 0.5, delay: 0.4 }}
            className="w-full h-0.5 bg-gradient-to-r from-indigo-500 to-blue-500"
          />
          <svg className="w-4 h-4 text-blue-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Vector DB */}
        <motion.div
          animate={{ scale: isSearching ? [1, 1.15, 1] : 1 }}
          transition={{ repeat: isSearching ? Infinity : 0, duration: 1, delay: 0.4 }}
          className="flex flex-col items-center gap-2"
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isSearching ? 'bg-blue-100' : 'bg-gray-100'
          )}>
            <svg className={cn(
              'w-6 h-6',
              isSearching ? 'text-blue-600' : 'text-gray-500'
            )} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <span className="text-xs text-gray-500">pgvector</span>
        </motion.div>

        {/* Arrow 3 */}
        <div className="flex-1 flex items-center">
          <motion.div
            animate={{ opacity: isSearching ? [0.3, 1, 0.3] : 0.3 }}
            transition={{ repeat: isSearching ? Infinity : 0, duration: 0.5, delay: 0.6 }}
            className="w-full h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500"
          />
          <svg className="w-4 h-4 text-emerald-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Results */}
        <motion.div
          animate={{ scale: isSearching ? [1, 1.1, 1] : 1 }}
          transition={{ repeat: isSearching ? Infinity : 0, duration: 1, delay: 0.8 }}
          className="flex flex-col items-center gap-2"
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isSearching ? 'bg-emerald-100' : 'bg-gray-100'
          )}>
            <svg className={cn(
              'w-6 h-6',
              isSearching ? 'text-emerald-600' : 'text-gray-500'
            )} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs text-gray-500">Resultados</span>
        </motion.div>
      </div>
    </div>
  );
}

// ======================
// SEARCH RESULT CARD
// ======================
function SearchResultCard({ result, index }: { result: SearchResult; index: number }) {
  const config = CATEGORY_CONFIG[result.category];
  const similarityPercent = Math.round(result.similarity * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'p-4 rounded-xl border',
        'bg-white',
        'border-gray-200'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
          index === 0 ? 'bg-emerald-100 text-emerald-700' :
          index === 1 ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        )}>
          #{index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{config.icon}</span>
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded'
            )} style={{
              backgroundColor: config.color === 'violet' ? 'rgb(237, 233, 254)' :
                              config.color === 'emerald' ? 'rgb(209, 250, 229)' :
                              config.color === 'blue' ? 'rgb(219, 234, 254)' :
                              config.color === 'amber' ? 'rgb(254, 243, 199)' : 'rgb(254, 226, 226)',
              color: config.color === 'violet' ? 'rgb(109, 40, 217)' :
                     config.color === 'emerald' ? 'rgb(4, 120, 87)' :
                     config.color === 'blue' ? 'rgb(29, 78, 216)' :
                     config.color === 'amber' ? 'rgb(180, 83, 9)' : 'rgb(190, 18, 60)',
            }}>
              {config.label}
            </span>
            {result.chunk_index !== undefined && (
              <span className="text-xs text-gray-400">
                Chunk #{result.chunk_index}
              </span>
            )}
          </div>

          {/* Title */}
          <h5 className="font-semibold text-gray-900 mb-1">
            {result.title}
          </h5>

          {/* Content */}
          <p className="text-sm text-gray-600 line-clamp-2">
            {result.content}
          </p>
        </div>

        {/* Similarity score */}
        <div className="flex-shrink-0 text-center">
          <div className={cn(
            'text-lg font-bold tabular-nums',
            similarityPercent >= 90 ? 'text-emerald-600' :
            similarityPercent >= 70 ? 'text-blue-600' :
            'text-amber-600'
          )}>
            {similarityPercent}%
          </div>
          <div className="text-xs text-gray-400">similitud</div>
        </div>
      </div>
    </motion.div>
  );
}

// ======================
// MAIN COMPONENT
// ======================
export function KBRAGPreview({ className, onSearch }: Props) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (onSearch) {
      const searchResults = await onSearch(query);
      setResults(searchResults);
    } else {
      // Use demo results
      setResults(DEMO_RESULTS);
    }

    setIsSearching(false);
  }, [query, onSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        'bg-white',
        'border-gray-200',
        className
      )}
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">
              Simulador RAG
            </h3>
            <p className="text-sm text-gray-500">
              Prueba cómo funciona la búsqueda semántica en tu Knowledge Base
            </p>
          </div>
        </div>

        {/* Architecture Diagram */}
        <ArchitectureDiagram isSearching={isSearching} />
      </div>

      {/* Search Input */}
      <div className="p-5">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Ej: ¿Cuál es la política de cancelación?"
            className={cn(
              'flex-1 px-4 py-3 rounded-xl border transition-all',
              'bg-gray-50',
              'border-gray-200',
              'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
              'text-gray-900',
              'placeholder:text-gray-400'
            )}
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className={cn(
              'px-6 py-3 rounded-xl font-semibold text-white transition-all',
              'bg-gradient-to-r from-blue-600 to-indigo-600',
              'shadow-lg shadow-blue-500/25',
              'hover:shadow-xl hover:shadow-blue-500/30',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSearching ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Buscando...
              </span>
            ) : 'Buscar'}
          </motion.button>
        </div>

        {/* Quick suggestions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {['¿Cuál es la política de cancelación?', '¿Qué horarios tienen?', '¿Aceptan tarjeta?'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setQuery(suggestion)}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {hasSearched && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 p-5"
          >
            {isSearching ? (
              <div className="text-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-10 h-10 mx-auto mb-3 border-2 border-blue-200 border-t-blue-600 rounded-full"
                />
                <p className="text-sm text-gray-500">
                  Generando embeddings y buscando en la base de datos vectorial...
                </p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">
                    Resultados encontrados
                  </h4>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    {results.length} matches
                  </span>
                </div>
                {results.map((result, index) => (
                  <SearchResultCard key={result.id} result={result} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500">
                  No se encontraron resultados relevantes
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technical Info Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            Model: text-embedding-3-small
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
              <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
              <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
            </svg>
            pgvector (1536 dims)
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            IVFFlat Index
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ======================
// EXPORTS
// ======================
export type { SearchResult, Props as KBRAGPreviewProps };
