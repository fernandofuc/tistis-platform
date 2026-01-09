// =====================================================
// TIS TIS PLATFORM - AI Feature
// AI-powered customer service and lead scoring
// =====================================================

// ======================
// LEGACY SERVICES (Original AI System)
// ======================
export { JobProcessor } from './services/job-processor.service';
export {
  getNextPendingJob,
  markJobProcessing,
  completeJob,
  failJob,
  getQueueStats,
  cleanupOldJobs,
} from './services/job-processor.service';

export { AIService } from './services/ai.service';
export {
  getTenantAIContext,
  getConversationContext,
  generateAIResponse,
  saveAIResponse,
  logAIUsage,
  updateLeadScore,
  escalateConversation,
} from './services/ai.service';

// ======================
// LANGGRAPH SYSTEM (New Multi-Agent Architecture)
// ======================
export { LangGraphAIService } from './services/langgraph-ai.service';
export {
  generateAIResponseWithGraph,
  generateAIResponseSmart,
  shouldUseLangGraph,
} from './services/langgraph-ai.service';

// Graph exports
export { TISTISGraph, executeGraph } from './graph';
export type { GraphExecutionInput, GraphExecutionResult } from './graph';

// State exports
export { TISTISAgentState, createInitialState } from './state';
export type {
  TISTISAgentStateType,
  TenantInfo,
  LeadInfo,
  ConversationInfo,
  ExtractedData,
  BookingResult,
  BusinessContext,
  AgentTrace,
  ControlFlags,
} from './state';

// ======================
// LEGACY TYPES
// ======================
export type {
  Job,
  ProcessResult,
} from './services/job-processor.service';

export type {
  TenantAIContext,
  ConversationContext,
  AIProcessingResult,
} from './services/ai.service';

// ======================
// REVISIÓN 5.0: SAFETY & RESILIENCE
// ======================
export { SafetyResilienceService } from './services/safety-resilience.service';
export type {
  EmergencyType,
  SafetyCategory,
  ConfigCompleteness,
  SpecialEventType,
  EmergencyDetectionResult,
  SafetyDetectionResult,
  SpecialEventDetectionResult,
  CallReconnectionContext,
  EscalationFallbackResult,
} from './services/safety-resilience.service';

// ======================
// REVISIÓN 5.1: DATABASE LOGGING FUNCTIONS
// ======================
export {
  logSafetyIncident,
  logSpecialEventRequest,
  createEscalationCallbackTask,
} from './services/safety-resilience.service';
export type {
  SafetyIncidentType,
  SafetyActionTaken,
} from './services/safety-resilience.service';
