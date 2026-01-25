// =====================================================
// TIS TIS PLATFORM - Shared Services Exports
// Unified services used across features
// =====================================================

export {
  BusinessContextService,
  businessContextService,
  loadBusinessContext,
  loadSetupContext,
  loadChatContext,
  loadVoiceContext,
  type BusinessContext,
  type BusinessContextBase,
  type ServiceInfo,
  type BranchInfo,
  type FAQInfo,
  type PromotionInfo,
  type KnowledgeDocInfo,
  type AIConfig,
  type ContextLoadOptions,
} from './business-context.service';

// Event Bus - Inter-feature communication (FASE 10)
export {
  eventBus,
  emitTenantConfigUpdated,
  emitCacheInvalidation,
  emitVoiceCallEnded,
  emitVoiceUsageUpdated,
  emitSetupCompleted,
  onTenantConfigChange,
  onCacheInvalidation,
  onVoiceUsageChange,
  type EventType,
  type TenantEventType,
  type VoiceEventType,
  type SetupEventType,
  type SystemEventType,
  type PlatformEvent,
  type EventHandler,
  type TenantConfigUpdatedPayload,
  type VoiceCallPayload,
  type VoiceUsagePayload,
  type SetupConversationPayload,
  type CacheInvalidationPayload,
} from './event-bus.service';
