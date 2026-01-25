// =====================================================
// TIS TIS PLATFORM - Voice Agent Services Export
// =====================================================

// Core Voice Agent Service
export { VoiceAgentService, generateVAPIConfig } from './voice-agent.service';

// VAPI Integration
export {
  VAPIApiService,
  type VAPIAssistantCreateRequest,
  type VAPIAssistant,
  type VAPIPhoneNumberCreateRequest,
  type VAPIPhoneNumber,
  type VAPIError,
  type ProvisioningResult,
} from './vapi-api.service';

// LangGraph Integration
export {
  processVoiceMessage,
  type VoiceAgentContext,
  type VoiceResponseResult,
} from './voice-langgraph.service';

// Voice Test Service
export {
  VoiceTestService,
  type TestMessageInput,
  type TestMessageResult,
} from './voice-test.service';

// Minute Limits Service
export {
  MinuteLimitService,
  formatMinutes,
  formatPriceMXN,
  calculateOverageCost,
  calculateUsagePercent,
  getUsageProgressColor,
  getOveragePolicyMessage,
} from './minute-limit.service';

// Minute Alerts Service (Email)
export {
  MinuteAlertService,
  sendMinuteAlert,
  checkAndSendAlert,
  sendBlockedAlert,
} from './minute-alerts.service';

// Voice Alert Service (Multi-channel - FASE 11)
export {
  VoiceAlertService,
  voiceAlertService,
  type AlertThreshold,
  type AlertChannel,
  type AlertSeverity,
  type VoiceUsageAlert,
  type AlertConfig,
  type SendAlertInput,
  type SendAlertResult,
} from './voice-alert.service';

// Voice Billing Service
export {
  VoiceBillingService,
  voiceBillingService,
} from './voice-billing.service';

// Voice Sync Service (FASE 5)
export {
  VoiceSyncService,
  voiceSyncService,
  type SyncVoiceLimitsInput,
  type SyncResult,
  type ResetUsageInput,
  type ResetResult,
} from './voice-sync.service';
