// =====================================================
// TIS TIS PLATFORM - Setup Assistant Feature Exports
// Sprint 5: AI-powered configuration assistant
// =====================================================

// Types
export type {
  // Enums
  ConversationStatus,
  MessageRole,
  SetupModule,
  ModuleProgress,
  ActionType,
  ActionStatus,
  AttachmentType,

  // Database types
  SetupConversation,
  SetupMessage,
  MessageAttachment,
  MessageAction,
  VisionAnalysis,
  SetupUsage,

  // API types
  CreateConversationRequest,
  CreateConversationResponse,
  SendMessageRequest,
  SendMessageAttachment,
  SendMessageResponse,
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  UploadResponse,
  UsageInfo,
  DetailedUsageInfo,

  // LangGraph types
  SetupContext,
  SetupIntent,

  // Database row types
  SetupConversationRow,
  SetupMessageRow,
  SetupUsageRow,
} from './types';

// Type converters
export {
  rowToConversation,
  rowToMessage,
  rowToUsage,
} from './types';

// Config
export {
  PLAN_LIMITS,
  PLAN_DISPLAY_INFO,
  getPlanLimits,
  isAtLimit,
  isUnlimitedPlan,
  getLimitPercentage,
  shouldShowUpgradePrompt,
  getUpgradePlan,
  type PlanId,
  type PlanLimits,
} from './config/limits';

// LangGraph State
export {
  SetupAssistantState,
  createInitialSetupState,
  getConfiguredModules,
  type SetupAssistantStateType,
  type SetupStateMessage,
} from './state';

// Services
export {
  SetupAssistantService,
  setupAssistantService,
  type ProcessMessageInput,
  type ProcessMessageOutput,
  // Vision Service
  VisionService,
  visionService,
  type AnalysisContext,
  type AnalyzeImageInput,
  // Usage Service
  UsageService,
  usageService,
  type ActionCheckResult,
  type UpgradeSuggestion,
} from './services';

// Graph
export { setupAssistantGraph, getSetupAssistantGraph, buildSetupAssistantGraph } from './graph';

// Utils
export {
  isValidImageUrl,
  isSecureUrl,
  isSecureImageUrl,
} from './utils';

// Hooks
export { useSetupAssistant } from './hooks';

// Components
export {
  ChatMessage,
  ChatInput,
  TypingIndicator,
  UsageIndicator,
  QuickActionsGrid,
  ProgressPanel,
  UpgradePrompt,
} from './components';

// Integrations
export {
  // Loyalty
  LoyaltyIntegration,
  loyaltyIntegration,
  type CreateLoyaltyProgramInput,
  type CreateLoyaltyRewardInput,
  // Services
  ServicesIntegration,
  servicesIntegration,
  type CreateServiceInput,
  type BulkCreateServicesInput,
  type UpdateServiceInput,
  // Knowledge Base
  KnowledgeBaseIntegration,
  knowledgeBaseIntegration,
  type CreateFAQInput,
  type BulkCreateFAQsInput,
  type CreateKnowledgeArticleInput,
  type CreateBusinessPolicyInput,
  // AI Learning
  AILearningIntegration,
  aiLearningIntegration,
  type SetupFeedback,
  type SetupPattern,
  type SetupInsight,
  // Hub
  HubIntegration,
  hubIntegration,
  type IntegrationSuggestion,
  type IntegrationStatus,
} from './integrations';
