// =====================================================
// TIS TIS PLATFORM - useGlobalSearch Hook
// Hook para búsqueda global en la plataforma
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { supabase } from '@/shared/lib/supabase';

// Search result type
export interface SearchResult {
  id: string;
  type: 'lead' | 'patient' | 'appointment';
  title: string;
  subtitle: string;
  url: string;
  metadata?: Record<string, unknown>;
}

interface UseGlobalSearchOptions {
  debounceMs?: number;
  minChars?: number;
  limit?: number;
}

interface UseGlobalSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

export function useGlobalSearch(options: UseGlobalSearchOptions = {}): UseGlobalSearchReturn {
  const {
    debounceMs = 300,
    minChars = 2,
    limit = 10,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < minChars) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('No autenticado');
        setResults([]);
        return;
      }

      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error en la búsqueda');
      }

      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
      } else {
        setError(data.error || 'Error desconocido');
        setResults([]);
      }
    } catch (err) {
      console.error('[useGlobalSearch] Error:', err);
      setError('Error al realizar la búsqueda');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [minChars, limit]);

  // Perform search when debounced query changes
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const clearResults = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearResults,
  };
}

// Type icon mapping
export function getSearchResultIcon(type: SearchResult['type']): string {
  switch (type) {
    case 'lead':
      return 'user-plus';
    case 'patient':
      return 'user';
    case 'appointment':
      return 'calendar';
    default:
      return 'search';
  }
}

// Type label mapping
export function getSearchResultLabel(type: SearchResult['type']): string {
  switch (type) {
    case 'lead':
      return 'Lead';
    case 'patient':
      return 'Paciente';
    case 'appointment':
      return 'Cita';
    default:
      return 'Resultado';
  }
}
