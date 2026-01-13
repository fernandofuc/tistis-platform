// Hooks exports
export { useTenant } from './useTenant';
export type { Tenant, Branch, UserRole, VerticalConfig, TenantContextValue } from './useTenant';

export { useFeatureFlags, MODULE_FLAGS, canAccessModule } from './useFeatureFlags';
export type { FeatureFlag, UseFeatureFlagsReturn } from './useFeatureFlags';

export { useVerticalTerminology, EXTENDED_TERMINOLOGY, DEFAULT_TERMINOLOGY } from './useVerticalTerminology';
export type { ExtendedTerminology, UseVerticalTerminologyReturn } from './useVerticalTerminology';

export { useAgentProfiles } from './useAgentProfiles';
