// =====================================================
// TIS TIS PLATFORM - API Keys Hook
// React hook for API Keys state management
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import type {
  APIKeyListItem,
  APIKeyWithCreator,
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
  UpdateAPIKeyRequest,
  APIKeyUsageResponse,
  APIKeysListResponse,
  RotateAPIKeyResponse,
  Vertical,
  ScopeGroup,
  APIScope,
  ScopeDefinition,
} from '../types';
import {
  getScopesGroupedByCategory,
  getCommonScopes,
  SCOPE_PRESETS,
} from '../constants/scopes';

// ======================
// API CLIENT FUNCTIONS
// ======================

/**
 * Fetch API with authentication token from Supabase session
 */
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la solicitud');
  }

  return data;
}

// ======================
// MAIN API KEYS HOOK
// ======================

export interface UseAPIKeysReturn {
  // State
  keys: APIKeyListItem[];
  loading: boolean;
  error: string | null;

  // Computed
  activeKeysCount: number;
  totalKeysCount: number;

  // Actions
  refresh: () => Promise<void>;
  createKey: (data: CreateAPIKeyRequest) => Promise<CreateAPIKeyResponse>;
  updateKey: (id: string, data: UpdateAPIKeyRequest) => Promise<APIKeyListItem>;
  revokeKey: (id: string, reason?: string) => Promise<void>;
  rotateKey: (id: string, gracePeriodHours?: number) => Promise<RotateAPIKeyResponse>;
  getKeyById: (id: string) => APIKeyListItem | undefined;
}

export function useAPIKeys(): UseAPIKeysReturn {
  const [keys, setKeys] = useState<APIKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all API keys
  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI<APIKeysListResponse>('/api/settings/api-keys');
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar API Keys');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Create new API key
  const createKey = useCallback(
    async (data: CreateAPIKeyRequest): Promise<CreateAPIKeyResponse> => {
      const response = await fetchAPI<CreateAPIKeyResponse>(
        '/api/settings/api-keys',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      );
      // Add the new key to the list (without the secret)
      setKeys((prev) => [response.key, ...prev]);
      return response;
    },
    []
  );

  // Update API key
  const updateKey = useCallback(
    async (id: string, data: UpdateAPIKeyRequest): Promise<APIKeyListItem> => {
      const response = await fetchAPI<{ key: APIKeyListItem }>(
        `/api/settings/api-keys/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      );
      // Update the key in the list
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? response.key : k))
      );
      return response.key;
    },
    []
  );

  // Revoke API key
  const revokeKey = useCallback(
    async (id: string, reason?: string): Promise<void> => {
      await fetchAPI(`/api/settings/api-keys/${id}`, {
        method: 'DELETE',
        body: reason ? JSON.stringify({ reason }) : undefined,
      });
      // Update the key status in the list
      setKeys((prev) =>
        prev.map((k) =>
          k.id === id ? { ...k, is_active: false } : k
        )
      );
    },
    []
  );

  // Rotate API key
  const rotateKey = useCallback(
    async (id: string, gracePeriodHours?: number): Promise<RotateAPIKeyResponse> => {
      const response = await fetchAPI<RotateAPIKeyResponse>(
        `/api/settings/api-keys/${id}/rotate`,
        {
          method: 'POST',
          body: JSON.stringify({ grace_period_hours: gracePeriodHours }),
        }
      );
      // Add the new key to the list and refresh to get updated states
      await fetchKeys();
      return response;
    },
    [fetchKeys]
  );

  // Get key by ID
  const getKeyById = useCallback(
    (id: string): APIKeyListItem | undefined => {
      return keys.find((k) => k.id === id);
    },
    [keys]
  );

  // Helper to check if key is expired
  const isKeyExpired = useCallback((expiresAt: string | null | undefined): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }, []);

  // Computed values - active means is_active AND not expired
  const activeKeysCount = useMemo(
    () => keys.filter((k) => k.is_active && !isKeyExpired(k.expires_at)).length,
    [keys, isKeyExpired]
  );

  const totalKeysCount = useMemo(() => keys.length, [keys]);

  return {
    keys,
    loading,
    error,
    activeKeysCount,
    totalKeysCount,
    refresh: fetchKeys,
    createKey,
    updateKey,
    revokeKey,
    rotateKey,
    getKeyById,
  };
}

// ======================
// API KEY DETAIL HOOK
// ======================

export interface UseAPIKeyDetailReturn {
  key: APIKeyWithCreator | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAPIKeyDetail(keyId: string | null): UseAPIKeyDetailReturn {
  const [key, setKey] = useState<APIKeyWithCreator | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeyDetail = useCallback(async () => {
    if (!keyId) {
      setKey(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI<{ key: APIKeyWithCreator }>(
        `/api/settings/api-keys/${keyId}`
      );
      setKey(data.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar detalles');
    } finally {
      setLoading(false);
    }
  }, [keyId]);

  useEffect(() => {
    fetchKeyDetail();
  }, [fetchKeyDetail]);

  return {
    key,
    loading,
    error,
    refresh: fetchKeyDetail,
  };
}

// ======================
// API KEY USAGE HOOK
// ======================

export interface UseAPIKeyUsageReturn {
  usage: APIKeyUsageResponse | null;
  loading: boolean;
  error: string | null;
  refresh: (days?: number) => Promise<void>;
}

export function useAPIKeyUsage(
  keyId: string | null,
  initialDays: number = 30
): UseAPIKeyUsageReturn {
  const [usage, setUsage] = useState<APIKeyUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(
    async (days: number = initialDays) => {
      if (!keyId) {
        setUsage(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchAPI<APIKeyUsageResponse>(
          `/api/settings/api-keys/${keyId}/usage?days=${days}`
        );
        setUsage(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Error al cargar estadísticas'
        );
      } finally {
        setLoading(false);
      }
    },
    [keyId, initialDays]
  );

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    error,
    refresh: fetchUsage,
  };
}

// ======================
// SCOPES HELPER HOOK
// ======================

export interface UseScopeSelectorReturn {
  scopeGroups: ScopeGroup[];
  commonScopes: ScopeDefinition[];
  presets: typeof SCOPE_PRESETS;
  selectedScopes: APIScope[];
  toggleScope: (scope: APIScope) => void;
  selectPreset: (presetKey: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  setScopes: (scopes: APIScope[]) => void;
}

export function useScopeSelector(
  vertical: Vertical = 'dental',
  initialScopes: APIScope[] = []
): UseScopeSelectorReturn {
  const [selectedScopes, setSelectedScopes] = useState<APIScope[]>(initialScopes);

  // Get scope groups for the vertical
  const scopeGroups = useMemo(
    () => getScopesGroupedByCategory(vertical),
    [vertical]
  );

  // Get common scopes
  const commonScopes = useMemo(() => getCommonScopes(), []);

  // Toggle a single scope
  const toggleScope = useCallback((scope: APIScope) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  }, []);

  // Select a preset
  const selectPreset = useCallback((presetKey: string) => {
    const preset = SCOPE_PRESETS[presetKey];
    if (preset) {
      setSelectedScopes(preset.scopes);
    }
  }, []);

  // Select all scopes
  const selectAll = useCallback(() => {
    const allScopes: APIScope[] = [];
    scopeGroups.forEach((group) => {
      group.scopes.forEach((scope) => {
        allScopes.push(scope.key);
      });
    });
    setSelectedScopes(allScopes);
  }, [scopeGroups]);

  // Clear all scopes
  const clearAll = useCallback(() => {
    setSelectedScopes([]);
  }, []);

  // Set scopes directly
  const setScopes = useCallback((scopes: APIScope[]) => {
    setSelectedScopes(scopes);
  }, []);

  return {
    scopeGroups,
    commonScopes,
    presets: SCOPE_PRESETS,
    selectedScopes,
    toggleScope,
    selectPreset,
    selectAll,
    clearAll,
    setScopes,
  };
}
