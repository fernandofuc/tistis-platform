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
  type PendingOrder, // SPRINT 3: Orden pendiente de confirmación
  type SecureBookingContext, // Secure Booking v2.2
  type BusinessContext,
  type AgentTrace,
  type ControlFlags,
  type AgentProfileInfo,
  // Branch-Aware Messaging types (v4.9.0)
  type BranchContext,
  type BranchResolutionSource,
  type BranchDisambiguationState,
  // Functions
  createInitialState,
  addAgentTrace,
  shouldEscalate,
  getProcessingTimeMs,
  // Branch-Aware Messaging helpers (v4.9.0)
  needsBranchDisambiguation,
  hasBranchContext,
  getCurrentBranchId,
  isMultiBranch,
  createBranchContextUpdate,
} from './agent-state';
