// =====================================================
// TIS TIS PLATFORM - Integrations Feature
// External system integrations (CRM, POS, dental software)
// =====================================================

// Components
export { IntegrationHub } from './components/IntegrationHub';
export { SoftRestaurantConfigModal } from './components/SoftRestaurantConfigModal';

// Types
export * from './types/integration.types';

// Constants
export { SAFE_INTEGRATION_FIELDS, SENSITIVE_CREDENTIAL_FIELDS } from './constants/api-fields';

// Services
export {
  testSoftRestaurantConnection,
  fetchSoftRestaurantMenu,
  SR_CAPABILITY_STATUS,
  SR_ERROR_CODES,
  type SRConnectionTestResult,
  type SRCapabilityKey,
  type SRCapabilityStatus,
} from './services/soft-restaurant-api.service';
