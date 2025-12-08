// =====================================================
// TIS TIS PLATFORM - Auth Feature Index
// =====================================================

// Components
export {
  LoginForm,
  AuthProvider,
  useAuthContext,
  AuthLoading,
  ProtectedRoute,
} from './components';

// Hooks
export { useAuth } from './hooks';

// Store
export { useAuthStore, selectIsAuthenticated, selectIsOwner, selectIsAdmin, selectStaffRole } from './store/authStore';

// Services
export * as authService from './services/authService';

// Types
export type {
  AuthState,
  AuthContextValue,
  AuthResult,
  SignInFormData,
  SignUpData,
  ResetPasswordFormData,
  UpdatePasswordFormData,
  ProtectedRouteProps,
} from './types';
