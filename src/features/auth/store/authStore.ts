// =====================================================
// TIS TIS PLATFORM - Auth Store (Zustand)
// =====================================================

import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';
import type { Staff, Tenant, Branch } from '@/shared/types';

// ======================
// TYPES
// ======================
interface AuthStore {
  user: User | null;
  session: Session | null;
  staff: Staff | null;
  tenant: Tenant | null;
  branches: Branch[];
  loading: boolean;
  initialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setStaff: (staff: Staff | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setBranches: (branches: Branch[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

// ======================
// INITIAL STATE
// ======================
const initialState = {
  user: null,
  session: null,
  staff: null,
  tenant: null,
  branches: [],
  loading: true,
  initialized: false,
};

// ======================
// STORE
// ======================
export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setStaff: (staff) => set({ staff }),
  setTenant: (tenant) => set({ tenant }),
  setBranches: (branches) => set({ branches }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),
  reset: () => set(initialState),
}));

// ======================
// SELECTORS
// ======================
export const selectIsAuthenticated = (state: AuthStore) => !!state.session;
export const selectIsOwner = (state: AuthStore) => state.staff?.role === 'owner';
export const selectIsAdmin = (state: AuthStore) =>
  ['owner', 'admin'].includes(state.staff?.role || '');
export const selectStaffRole = (state: AuthStore) => state.staff?.role || null;
