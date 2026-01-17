// =====================================================
// TIS TIS PLATFORM - Tools Index
// Exportaciones centralizadas del sistema de tools
// =====================================================

// Definiciones
export {
  TOOL_NAMES,
  TOOL_DESCRIPTIONS,
  TOOLS_BY_AGENT,
  getToolsForAgent,
  type ToolName,
  // Common Schemas
  GetServiceInfoSchema,
  ListServicesSchema,
  GetAvailableSlotsSchema,
  GetBranchInfoSchema,
  GetBusinessPolicySchema,
  SearchKnowledgeBaseSchema,
  GetStaffInfoSchema,
  CreateAppointmentSchema,
  UpdateLeadInfoSchema,
  GetOperatingHoursSchema,
  GetFaqAnswerSchema,
  // Restaurant Schemas
  GetMenuItemsSchema,
  GetMenuCategoriesSchema,
  CreateOrderSchema,
  CheckItemAvailabilitySchema,
  GetActivePromotionsSchema,
  // Common Response types
  type ServiceInfo,
  type ServiceListItem,
  type AvailableSlot,
  type BranchInfo,
  type PolicyInfo,
  type KnowledgeBaseResult,
  type StaffInfo,
  type AppointmentResult,
  type LeadUpdateResult,
  type OperatingHours,
  type FaqAnswer,
  // Restaurant Response types
  type MenuItem,
  type MenuItemModifier,
  type MenuCategory,
  type OrderResult,
  type OrderItem,
  type ItemAvailability,
  type Promotion,
} from './definitions';

// Handlers
export {
  type ToolContext,
  toolHandlers,
  // V7.1: RAG thresholds por vertical
  RAG_THRESHOLDS,
  // Common handlers
  handleGetServiceInfo,
  handleListServices,
  handleGetAvailableSlots,
  handleGetBranchInfo,
  handleGetBusinessPolicy,
  handleSearchKnowledgeBase,
  handleGetStaffInfo,
  handleCreateAppointment,
  handleUpdateLeadInfo,
  handleGetOperatingHours,
  handleGetFaqAnswer,
  // Restaurant handlers
  handleGetMenuItems,
  handleGetMenuCategories,
  handleCreateOrder,
  handleCheckItemAvailability,
  handleGetActivePromotions,
  // Loyalty handlers (v5.5.1)
  handleGetLoyaltyBalance,
  handleGetAvailableRewards,
  handleGetMembershipInfo,
  handleRedeemReward,
} from './handlers';

// Factory
export {
  createToolsForAgent,
  createTools,
  createAllTools,
  extractToolContext,
} from './tool-factory';

// Default export
import ToolFactory from './tool-factory';
export default ToolFactory;
