// =====================================================
// TIS TIS PLATFORM - Global App Store (Zustand)
// =====================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Branch, Staff, ToastMessage } from '../types';

// ======================
// TYPES
// ======================
interface AppState {
  // UI State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;

  // Branch Selection
  selectedBranchId: string | null;
  branches: Branch[];

  // Current Staff (logged in user)
  currentStaff: Staff | null;

  // Toast Notifications
  toasts: ToastMessage[];

  // Loading States
  isLoading: boolean;
  loadingMessage: string | null;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSelectedBranchId: (branchId: string | null) => void;
  setBranches: (branches: Branch[]) => void;
  setCurrentStaff: (staff: Staff | null) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  reset: () => void;
}

// ======================
// INITIAL STATE
// ======================
const initialState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  selectedBranchId: null,
  branches: [],
  currentStaff: null,
  toasts: [],
  isLoading: false,
  loadingMessage: null,
};

// ======================
// STORE
// ======================
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      setSelectedBranchId: (branchId) => set({ selectedBranchId: branchId }),

      setBranches: (branches) => set({ branches }),

      setCurrentStaff: (staff) => set({ currentStaff: staff }),

      addToast: (toast) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newToast: ToastMessage = {
          ...toast,
          id,
          duration: toast.duration || 5000,
        };

        set({ toasts: [...get().toasts, newToast] });

        // Auto remove after duration
        if (newToast.duration && newToast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, newToast.duration);
        }
      },

      removeToast: (id) => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
      },

      setLoading: (isLoading, message) => {
        set({
          isLoading,
          loadingMessage: isLoading ? message || null : null,
        });
      },

      reset: () => set(initialState),
    }),
    {
      name: 'tistis-app-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        selectedBranchId: state.selectedBranchId,
      }),
    }
  )
);

// ======================
// HELPER HOOKS
// ======================
export const useToast = () => {
  const addToast = useAppStore((state) => state.addToast);
  const removeToast = useAppStore((state) => state.removeToast);

  return {
    success: (title: string, message?: string) =>
      addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      addToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) =>
      addToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) =>
      addToast({ type: 'info', title, message }),
    remove: removeToast,
  };
};

export const useBranch = () => {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId);
  const branches = useAppStore((state) => state.branches);
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || null;

  return {
    selectedBranchId,
    selectedBranch,
    branches,
    setSelectedBranchId,
  };
};

export const useCurrentStaff = () => {
  const currentStaff = useAppStore((state) => state.currentStaff);
  const setCurrentStaff = useAppStore((state) => state.setCurrentStaff);

  return {
    currentStaff,
    setCurrentStaff,
    isOwner: currentStaff?.role === 'owner',
    isAdmin: ['owner', 'admin'].includes(currentStaff?.role || ''),
    isSpecialist: ['owner', 'admin', 'specialist'].includes(currentStaff?.role || ''),
  };
};
