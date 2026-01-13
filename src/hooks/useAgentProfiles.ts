// =====================================================
// TIS TIS PLATFORM - useAgentProfiles Hook
// Hook para gestionar perfiles de agentes de IA
// =====================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/src/shared/lib/supabase';
import type {
  AgentProfileWithChannels,
  AgentProfileInput,
  GetProfilesResponse,
} from '@/src/shared/types/agent-profiles';
import type { ProfileType, VerticalType } from '@/src/shared/config/agent-templates';

// ======================
// TYPES
// ======================

interface UseAgentProfilesState {
  business: AgentProfileWithChannels | null;
  personal: AgentProfileWithChannels | null;
  loading: boolean;
  error: string | null;
}

interface UseAgentProfilesReturn extends UseAgentProfilesState {
  refresh: () => Promise<void>;
  createProfile: (type: ProfileType, data: AgentProfileInput) => Promise<boolean>;
  updateProfile: (type: ProfileType, data: Partial<AgentProfileInput>) => Promise<boolean>;
  toggleProfile: (type: ProfileType, isActive: boolean) => Promise<boolean>;
  deleteProfile: (type: ProfileType) => Promise<boolean>;
}

// ======================
// HELPER
// ======================

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ======================
// HOOK
// ======================

export function useAgentProfiles(): UseAgentProfilesReturn {
  const [state, setState] = useState<UseAgentProfilesState>({
    business: null,
    personal: null,
    loading: true,
    error: null,
  });

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const headers = await getAuthHeaders();
      const response = await fetch('/api/agent-profiles', { headers });
      const result: GetProfilesResponse = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener perfiles');
      }

      setState({
        business: result.data.business,
        personal: result.data.personal,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('[useAgentProfiles] Error:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Create profile
  const createProfile = useCallback(async (
    type: ProfileType,
    data: AgentProfileInput
  ): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/agent-profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({ profile_type: type, ...data }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      await fetchProfiles();
      return true;
    } catch (err) {
      console.error('[useAgentProfiles] Create error:', err);
      return false;
    }
  }, [fetchProfiles]);

  // Update profile
  const updateProfile = useCallback(async (
    type: ProfileType,
    data: Partial<AgentProfileInput>
  ): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/agent-profiles/${type}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      await fetchProfiles();
      return true;
    } catch (err) {
      console.error('[useAgentProfiles] Update error:', err);
      return false;
    }
  }, [fetchProfiles]);

  // Toggle profile active state
  const toggleProfile = useCallback(async (
    type: ProfileType,
    isActive: boolean
  ): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/agent-profiles/${type}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_active: isActive }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      await fetchProfiles();
      return true;
    } catch (err) {
      console.error('[useAgentProfiles] Toggle error:', err);
      return false;
    }
  }, [fetchProfiles]);

  // Delete profile
  const deleteProfile = useCallback(async (type: ProfileType): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/agent-profiles/${type}`, {
        method: 'DELETE',
        headers,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      await fetchProfiles();
      return true;
    } catch (err) {
      console.error('[useAgentProfiles] Delete error:', err);
      return false;
    }
  }, [fetchProfiles]);

  return {
    ...state,
    refresh: fetchProfiles,
    createProfile,
    updateProfile,
    toggleProfile,
    deleteProfile,
  };
}

export default useAgentProfiles;
