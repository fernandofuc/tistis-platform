// =====================================================
// TIS TIS PLATFORM - Setup Assistant Integrations
// Sprint 5: Module integration exports
// =====================================================

// Loyalty Integration
export {
  LoyaltyIntegration,
  loyaltyIntegration,
  type CreateLoyaltyProgramInput,
  type CreateLoyaltyRewardInput,
} from './loyalty.integration';

// Services Integration
export {
  ServicesIntegration,
  servicesIntegration,
  type CreateServiceInput,
  type BulkCreateServicesInput,
  type UpdateServiceInput,
} from './services.integration';

// Knowledge Base Integration
export {
  KnowledgeBaseIntegration,
  knowledgeBaseIntegration,
  type CreateFAQInput,
  type BulkCreateFAQsInput,
  type CreateKnowledgeArticleInput,
  type CreateBusinessPolicyInput,
} from './knowledge-base.integration';

// AI Learning Integration
export {
  AILearningIntegration,
  aiLearningIntegration,
  type SetupFeedback,
  type SetupPattern,
  type SetupInsight,
} from './ai-learning.integration';

// Hub Integration
export {
  HubIntegration,
  hubIntegration,
  type IntegrationSuggestion,
  type IntegrationStatus,
} from './hub.integration';
