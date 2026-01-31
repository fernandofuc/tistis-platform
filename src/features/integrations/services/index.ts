// =====================================================
// TIS TIS PLATFORM - Integrations Services Barrel Export
// =====================================================

// Agent Manager Service
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
} from './agent-manager.service';

// Soft Restaurant Services
export {
  SoftRestaurantWebhookService,
  type SRWebhookPayload,
  type SRVentaPayload,
  type SRConceptoPayload,
  type SRPagoPayload,
  type SaleProcessingResult,
  type WebhookProcessingResult,
  type SRWebhookCredentials,
} from './soft-restaurant-webhook.service';

export {
  SR_ERROR_CODES,
  SR_CAPABILITY_STATUS,
  type SRCapabilityKey,
  type SRCapabilityStatus,
  type SRConnectionTestResult,
  type SRMenuResponse,
  type SRMenuItemResponse,
} from './soft-restaurant-api.service';

// Job Queue Service
export {
  SRJobQueueService,
} from './sr-job-queue.service';

// Soft Restaurant Processor
export {
  SoftRestaurantProcessor,
} from './soft-restaurant-processor';

// Recipe Deduction Service
export {
  RecipeDeductionService,
} from './recipe-deduction.service';

// Inventory Movement Service
export {
  InventoryMovementService,
} from './inventory-movement.service';

// Low Stock Alert Service
export {
  LowStockAlertService,
} from './low-stock-alert.service';

// Schema Validator Service
export {
  getSchemaValidatorService,
  SchemaValidatorService,
} from './schema-validator.service';
