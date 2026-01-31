// =====================================================
// TIS TIS PLATFORM - Integrations Feature
// External system integrations (CRM, POS, dental software)
// =====================================================

// Components
export { IntegrationHub } from './components/IntegrationHub';
export {
  SoftRestaurantConfigModal,
  SR_WEBHOOK_CAPABILITIES,
  SR_AGENT_CAPABILITIES,
  type SRCapabilityStatus as SRModalCapabilityStatus,
  type SRCapabilityKey as SRModalCapabilityKey,
} from './components/SoftRestaurantConfigModal';
export { LocalAgentSetupWizard } from './components/LocalAgentSetupWizard';
export { AgentStatusCard } from './components/AgentStatusCard';
export { SchemaValidationStatus, type SchemaValidationData } from './components/SchemaValidationStatus';
export { CredentialsGuide } from './components/CredentialsGuide';

// Types
export * from './types/integration.types';
export {
  SR_EXPECTED_SCHEMA,
  SR_KNOWN_VERSIONS,
  getRequiredTablesForSync,
  getTablesForSync,
  isTypeMatch,
  type TableDefinition,
  type ColumnDefinition,
  type SchemaValidationResult,
  type ValidateSchemaRequest,
  type ValidateSchemaResponse,
  type SRVersionInfo,
} from './types/schema-validation.types';

// Constants
export { SAFE_INTEGRATION_FIELDS, SENSITIVE_CREDENTIAL_FIELDS } from './constants/api-fields';

// Services - Legacy API (deprecated, kept for compatibility)
export {
  testSoftRestaurantConnection,
  fetchSoftRestaurantMenu,
  SR_CAPABILITY_STATUS,
  SR_ERROR_CODES,
  type SRConnectionTestResult,
  type SRCapabilityKey,
  type SRCapabilityStatus,
} from './services/soft-restaurant-api.service';

// Services - Webhook (new model)
export {
  getSoftRestaurantWebhookService,
  SoftRestaurantWebhookService,
  type SRWebhookPayload,
  type SRVentaPayload,
  type SRConceptoPayload,
  type SRPagoPayload,
  type SaleProcessingResult,
  type WebhookProcessingResult,
  type SRWebhookCredentials,
} from './services/soft-restaurant-webhook.service';

// Services - Agent Manager (Local Agent)
export {
  getAgentManagerService,
  AgentManagerService,
  AGENT_ERROR_CODES,
  type CreateAgentResult,
  type ValidateTokenResult,
  type HeartbeatResult,
  type CreateSyncLogResult,
  type CompleteSyncResult,
  type AgentStats,
  type SyncLogEntry,
} from './services/agent-manager.service';

// Services - Schema Validator
export {
  getSchemaValidatorService,
  SchemaValidatorService,
} from './services/schema-validator.service';

// Services - Soft Restaurant Processor (sr_sales → restaurant_orders)
export {
  SoftRestaurantProcessor,
} from './services/soft-restaurant-processor';
