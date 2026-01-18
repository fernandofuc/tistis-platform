// =====================================================
// TIS TIS PLATFORM - API Settings Hooks
// Barrel exports for all hooks
// =====================================================

export {
  useAPIKeys,
  useAPIKeyDetail,
  useAPIKeyUsage,
  useScopeSelector,
  type UseAPIKeysReturn,
  type UseAPIKeyDetailReturn,
  type UseAPIKeyUsageReturn,
  type UseScopeSelectorReturn,
} from './useAPIKeys';

// Audit hooks
export {
  useAuditLogs,
  useKeyAuditLogs,
  useAuditStatistics,
  useSecurityAlerts,
  type UseAuditLogsReturn,
  type UseKeyAuditLogsReturn,
  type UseAuditStatisticsReturn,
  type UseSecurityAlertsReturn,
} from './useAudit';
