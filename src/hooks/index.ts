// Hooks exports
export { useTenant } from './useTenant';
export type { Tenant, Branch, UserRole, VerticalConfig, TenantContextValue } from './useTenant';

export { useFeatureFlags, MODULE_FLAGS, canAccessModule } from './useFeatureFlags';
export type { FeatureFlag, UseFeatureFlagsReturn } from './useFeatureFlags';
