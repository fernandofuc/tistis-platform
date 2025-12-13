// =====================================================
// TIS TIS PLATFORM - AI Feature
// AI-powered customer service and lead scoring
// =====================================================

// Services
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

// Types
export type {
  Job,
  ProcessResult,
} from './services/job-processor.service';

export type {
  TenantAIContext,
  ConversationContext,
  AIProcessingResult,
} from './services/ai.service';
