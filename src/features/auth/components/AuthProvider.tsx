// =====================================================
// TIS TIS PLATFORM - Auth Provider Component
// =====================================================

'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { AuthContextValue } from '../types';

// ======================
// CONTEXT
// ======================
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ======================
// PROVIDER
// ======================
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

// ======================
// HOOK
// ======================
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

// ======================
// LOADING COMPONENT
// ======================
interface AuthLoadingProps {
  children: ReactNode;
  loadingComponent?: ReactNode;
}

export function AuthLoading({ children, loadingComponent }: AuthLoadingProps) {
  const { initialized, loading } = useAuthContext();

  if (!initialized || loading) {
    return (
      loadingComponent || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

// ======================
// PROTECTED ROUTE
// ======================
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'owner' | 'admin' | 'specialist' | 'receptionist' | 'assistant';
  fallback?: ReactNode;
  loadingSkeleton?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallback,
  loadingSkeleton,
}: ProtectedRouteProps) {
  const { isAuthenticated, staff, initialized, loading } = useAuthContext();

  // Still loading - show skeleton if provided for instant visual feedback
  if (!initialized || loading) {
    if (loadingSkeleton) {
      return <>{loadingSkeleton}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;

    // Redirect to login with small delay to avoid RSC prefetch race condition
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.replace('/auth/login');
      }, 50);
    }
    return null;
  }

  // Check role if required
  if (requiredRole && staff) {
    const roleHierarchy = ['assistant', 'receptionist', 'specialist', 'admin', 'owner'];
    const requiredLevel = roleHierarchy.indexOf(requiredRole);
    const userLevel = roleHierarchy.indexOf(staff.role);

    if (userLevel < requiredLevel) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Acceso Denegado
            </h2>
            <p className="text-gray-600 mb-6">
              No tienes permisos para acceder a esta sección.
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volver al Dashboard
            </a>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
