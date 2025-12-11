'use client';

import React from 'react';
import { useFeatureFlags, MODULE_FLAGS } from '@/src/hooks/useFeatureFlags';
import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ConditionalModuleProps {
  // Module name (matches MODULE_FLAGS keys) - optional if featureFlag is provided
  moduleName?: string;

  // Alternative: direct feature flag key
  featureFlag?: string;

  // Content to render if enabled
  children: React.ReactNode;

  // What to show when disabled (optional)
  fallback?: React.ReactNode;

  // Show upgrade prompt instead of nothing
  showUpgradePrompt?: boolean;

  // Loading state
  loadingFallback?: React.ReactNode;
}

// Default loading skeleton
function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
    </div>
  );
}

// Default upgrade prompt
function UpgradePrompt({ moduleName }: { moduleName: string }) {
  const moduleNames: Record<string, string> = {
    patients: 'Gestión de Pacientes',
    quotes: 'Cotizaciones',
    analytics: 'Analytics Avanzados',
    clinical_history: 'Historial Clínico',
    ai_chat: 'Chat con IA',
  };

  const displayName = moduleNames[moduleName] || moduleName;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100">
      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-purple-500" />
      </div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        {displayName}
      </h3>
      <p className="text-gray-600 text-center mb-6 max-w-md">
        Esta funcionalidad no está incluida en tu plan actual.
        Actualiza tu plan para desbloquear {displayName.toLowerCase()}.
      </p>
      <Link
        href="/dashboard/settings?tab=billing"
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        <Sparkles className="w-5 h-5" />
        Ver Planes Disponibles
      </Link>
    </div>
  );
}

// Main component
export function ConditionalModule({
  moduleName,
  featureFlag,
  children,
  fallback,
  showUpgradePrompt = true,
  loadingFallback,
}: ConditionalModuleProps) {
  const { flags, flagsLoading, isEnabled } = useFeatureFlags();

  // Determine which flag to check
  const flagKey = featureFlag || (moduleName ? MODULE_FLAGS[moduleName] : null) || moduleName || '';

  // Show loading state
  if (flagsLoading) {
    return <>{loadingFallback || <LoadingSkeleton />}</>;
  }

  // Check if enabled
  const moduleEnabled = isEnabled(flagKey);

  if (moduleEnabled) {
    return <>{children}</>;
  }

  // Not enabled - show fallback or upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt && moduleName) {
    return <UpgradePrompt moduleName={moduleName} />;
  }

  // Return nothing if no fallback and no upgrade prompt
  return null;
}

// HOC version for wrapping entire pages
export function withFeatureFlag<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureFlag: string,
  FallbackComponent?: React.ComponentType
) {
  return function WithFeatureFlagComponent(props: P) {
    return (
      <ConditionalModule
        featureFlag={featureFlag}
        fallback={FallbackComponent ? <FallbackComponent /> : undefined}
      >
        <WrappedComponent {...props} />
      </ConditionalModule>
    );
  };
}

// Hook for conditional rendering in components
export function useModuleAccess(moduleName: string): {
  hasAccess: boolean;
  isLoading: boolean;
} {
  const { flags, flagsLoading, isEnabled } = useFeatureFlags();
  const flagKey = MODULE_FLAGS[moduleName] || moduleName;

  return {
    hasAccess: isEnabled(flagKey),
    isLoading: flagsLoading,
  };
}
