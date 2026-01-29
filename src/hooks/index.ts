// Hooks exports
export { useTenant } from './useTenant';
export type { Tenant, Branch, UserRole, VerticalConfig, TenantContextValue } from './useTenant';

export { useBranches } from './useBranches';
export type { UseBranchesReturn } from './useBranches';

export { useFeatureFlags, MODULE_FLAGS, canAccessModule } from './useFeatureFlags';
export type { FeatureFlag, UseFeatureFlagsReturn } from './useFeatureFlags';

export { useVerticalTerminology, EXTENDED_TERMINOLOGY, DEFAULT_TERMINOLOGY } from './useVerticalTerminology';
export type { ExtendedTerminology, UseVerticalTerminologyReturn } from './useVerticalTerminology';

export { useAgentProfiles } from './useAgentProfiles';

export { useVideoScrollSync } from './useVideoScrollSync';
export type { VideoScrollSyncConfig, VideoScrollSyncReturn } from './useVideoScrollSync';

export { useImageScrollSync } from './useImageScrollSync';
export type { ImageScrollSyncConfig, ImageScrollSyncReturn } from './useImageScrollSync';
