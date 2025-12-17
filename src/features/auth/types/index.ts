// =====================================================
// TIS TIS PLATFORM - Auth Feature Types
// =====================================================

import type { User, Session } from '@supabase/supabase-js';
import type { Staff, Tenant, Branch } from '@/shared/types';

// ======================
// AUTH STATE
// ======================
export interface AuthState {
  user: User | null;
  session: Session | null;
  staff: Staff | null;
  tenant: Tenant | null;
  branches: Branch[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

// ======================
// UPDATE STAFF DATA
// ======================
export interface UpdateStaffData {
  first_name?: string;
  last_name?: string;
  phone?: string;
  whatsapp_number?: string;
  avatar_url?: string;
}

// ======================
// AUTH CONTEXT
// ======================
export interface AuthContextValue extends AuthState {
  // Auth methods
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (data: SignUpData) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;

  // Staff methods
  refetchStaff: () => Promise<void>;
  updateStaff: (data: UpdateStaffData) => Promise<{ success: boolean; error?: string }>;

  // Branch methods
  refetchBranches: () => Promise<void>;

  // Computed
  isAuthenticated: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

// ======================
// AUTH RESULTS
// ======================
export interface AuthResult {
  success: boolean;
  error?: string;
  user?: User;
}

// ======================
// FORM DATA
// ======================
export interface SignInFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ResetPasswordFormData {
  email: string;
}

export interface UpdatePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// ======================
// PROTECTED ROUTE
// ======================
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Staff['role'];
  fallback?: React.ReactNode;
}
