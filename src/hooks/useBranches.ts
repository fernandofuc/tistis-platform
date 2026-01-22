'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/auth';
import { useTenant } from './useTenant';

// ======================
// TYPES
// ======================

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  is_headquarters?: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UseBranchesReturn {
  branches: Branch[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ======================
// HOOK
// ======================

/**
 * Hook to fetch and manage branches for the current tenant
 * Used in API Keys management and other multi-branch features
 *
 * @returns {UseBranchesReturn} Branches data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * const { branches, isLoading, error } = useBranches();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <select>
 *     {branches.map(branch => (
 *       <option key={branch.id} value={branch.id}>
 *         {branch.name}
 *       </option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useBranches(): UseBranchesReturn {
  const { tenant } = useTenant();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = async () => {
    if (!tenant?.id) {
      setError('No tenant found');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('branches')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('is_headquarters', { ascending: false })
        .order('name', { ascending: true });

      if (fetchError) {
        console.error('[useBranches] Error fetching branches:', fetchError);
        setError('Error al cargar sucursales');
        return;
      }

      setBranches(data || []);
    } catch (err) {
      console.error('[useBranches] Unexpected error:', err);
      setError('Error inesperado al cargar sucursales');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when tenant changes
  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  return {
    branches,
    isLoading,
    error,
    refetch: fetchBranches,
  };
}
