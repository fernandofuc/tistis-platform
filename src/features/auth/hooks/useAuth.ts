// =====================================================
// TIS TIS PLATFORM - useAuth Hook
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { Staff, Branch, Tenant } from '@/shared/types';
import type { AuthState, SignUpData, AuthResult, UpdateStaffData } from '../types';
import * as authService from '../services/authService';
import { withTimeout } from '../utils/networkHelpers';

// ======================
// INITIAL STATE
// ======================
const initialState: AuthState = {
  user: null,
  session: null,
  staff: null,
  tenant: null,
  branches: [],
  loading: true,
  error: null,
  initialized: false,
};

// ======================
// SYNC TENANT METADATA (runs in background)
// ======================
async function syncTenantMetadata(accessToken: string): Promise<void> {
  try {
    // Add timeout to prevent hanging background request (10 seconds)
    const response = await withTimeout(
      fetch('/api/admin/sync-tenant-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      }),
      10000 // 10 second timeout for background operation
    );

    if (response.ok) {
      const result = await response.json();
      if (result.needs_refresh) {
        console.log('🔄 [Auth] Tenant metadata synced - refresh may be needed');
      }
    }
  } catch (error) {
    // Silent fail - this is a background optimization
    console.debug('[Auth] Metadata sync failed (non-critical):', error);
  }
}

// ======================
// HOOK
// ======================
export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  // ======================
  // INITIALIZE
  // ======================
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get current session
        const session = await authService.getSession();

        if (!mounted) return;

        if (session?.user) {
          // Sync tenant metadata in background (non-blocking)
          if (session.access_token) {
            syncTenantMetadata(session.access_token);
          }

          // Fetch all data in parallel
          const [staff, tenant, branches] = await Promise.all([
            authService.fetchStaffByEmail(session.user.email || ''),
            authService.fetchTenant(),
            authService.fetchBranches(),
          ]);

          if (!mounted) return;

          setState({
            user: session.user,
            session,
            staff,
            tenant,
            branches,
            loading: false,
            error: null,
            initialized: true,
          });
        } else {
          setState({
            ...initialState,
            loading: false,
            initialized: true,
          });
        }
      } catch (err) {
        console.error('🔴 Auth initialization error:', err);
        if (mounted) {
          setState({
            ...initialState,
            loading: false,
            error: 'Error al inicializar autenticación',
            initialized: true,
          });
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const subscription = authService.onAuthStateChange(async (newSession) => {
      const session = newSession as Session | null;

      if (!mounted) return;

      if (session?.user) {
        const [staff, tenant, branches] = await Promise.all([
          authService.fetchStaffByEmail(session.user.email || ''),
          authService.fetchTenant(),
          authService.fetchBranches(),
        ]);

        if (!mounted) return;

        setState((prev) => ({
          ...prev,
          user: session.user,
          session,
          staff,
          tenant,
          branches,
          loading: false,
          error: null,
        }));
      } else {
        setState({
          ...initialState,
          loading: false,
          initialized: true,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ======================
  // SIGN IN
  // ======================
  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await authService.signIn(email, password);

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Error al iniciar sesión',
        }));
      }

      return result;
    },
    []
  );

  // ======================
  // SIGN UP
  // ======================
  const signUp = useCallback(
    async (data: SignUpData): Promise<AuthResult> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result = await authService.signUp(data);

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Error al registrarse',
        }));
      }

      return result;
    },
    []
  );

  // ======================
  // SIGN OUT
  // ======================
  const signOut = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      await authService.signOut();
      setState({
        ...initialState,
        loading: false,
        initialized: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cerrar sesión';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    }
  }, []);

  // ======================
  // PASSWORD RESET
  // ======================
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: string | null }> => {
      return authService.resetPassword(email);
    },
    []
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: string | null }> => {
      return authService.updatePassword(newPassword);
    },
    []
  );

  // ======================
  // REFETCH STAFF (and tenant - critical for plan updates)
  // ======================
  const refetchStaff = useCallback(async (): Promise<void> => {
    if (!state.user?.email) return;

    // Refetch both staff AND tenant in parallel
    // This is critical because plan changes update tenant.plan, not staff
    const [staff, tenant] = await Promise.all([
      authService.fetchStaffByEmail(state.user.email),
      authService.fetchTenant(),
    ]);

    setState((prev) => ({ ...prev, staff, tenant }));
  }, [state.user?.email]);

  // ======================
  // REFETCH BRANCHES
  // ======================
  const refetchBranches = useCallback(async (): Promise<void> => {
    const branches = await authService.fetchBranches();
    setState((prev) => ({ ...prev, branches }));
  }, []);

  // ======================
  // UPDATE STAFF PROFILE
  // ======================
  const updateStaff = useCallback(
    async (data: UpdateStaffData): Promise<{ success: boolean; error?: string }> => {
      if (!state.staff?.id) {
        return { success: false, error: 'No hay perfil de staff' };
      }

      const result = await authService.updateStaff(state.staff.id, data);

      if (result.success && result.staff) {
        // Update local state with new staff data
        setState((prev) => ({ ...prev, staff: result.staff! }));
      }

      return { success: result.success, error: result.error };
    },
    [state.staff?.id]
  );

  // ======================
  // COMPUTED VALUES
  // ======================
  const isAuthenticated = useMemo(() => !!state.session, [state.session]);

  const isOwner = useMemo(
    () => state.staff?.role === 'owner',
    [state.staff?.role]
  );

  const isAdmin = useMemo(
    () => ['owner', 'admin'].includes(state.staff?.role || ''),
    [state.staff?.role]
  );

  // ======================
  // RETURN
  // ======================
  return {
    // State
    user: state.user,
    session: state.session,
    staff: state.staff,
    tenant: state.tenant,
    branches: state.branches,
    loading: state.loading,
    error: state.error,
    initialized: state.initialized,

    // Methods
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    refetchStaff,
    refetchBranches,
    updateStaff,

    // Computed
    isAuthenticated,
    isOwner,
    isAdmin,
  };
}
