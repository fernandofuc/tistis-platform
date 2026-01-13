// =====================================================
// TIS TIS PLATFORM - Agent State Exports
// =====================================================

export {
  TISTISAgentState,
  type TISTISAgentStateType,
  type TenantInfo,
  type LeadInfo,
  type ConversationInfo,
  type ExtractedData,
  type BookingResult,
  type OrderResult,
  type BusinessContext,
  type AgentTrace,
  type ControlFlags,
  type AgentProfileInfo,
  createInitialState,
  addAgentTrace,
  shouldEscalate,
  getProcessingTimeMs,
} from './agent-state';
