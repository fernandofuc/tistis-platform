// =====================================================
// TIS TIS PLATFORM - Tool Factory
// Crea instancias de tools de LangChain con contexto
// =====================================================
//
// Este archivo crea las tools de LangChain que pueden ser
// vinculadas al LLM usando bindTools().
//
// IMPORTANTE: Las tools necesitan acceso al contexto del negocio
// que viene del estado del grafo. Por eso usamos una factory
// que recibe el contexto y retorna las tools configuradas.
// =====================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { TISTISAgentStateType } from '../state';
import {
  TOOL_NAMES,
  TOOL_DESCRIPTIONS,
  type ToolName,
  getToolsForAgent,
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
  // Loyalty Schemas (v5.5.1)
  GetLoyaltyBalanceSchema,
  GetAvailableRewardsSchema,
  GetMembershipInfoSchema,
  RedeemRewardSchema,
} from './definitions';

import {
  type ToolContext,
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

// ======================
// CONTEXT EXTRACTOR
// ======================

/**
 * Extrae el contexto necesario para las tools desde el estado del grafo
 * V7.1: Ahora incluye vertical para thresholds por vertical en RAG
 */
export function extractToolContext(state: TISTISAgentStateType): ToolContext {
  return {
    tenant_id: state.tenant?.tenant_id || '',
    lead_id: state.lead?.lead_id || '',
    business_context: state.business_context,
    lead: state.lead,
    vertical: state.tenant?.vertical,
  };
}

// ======================
// TOOL FACTORY
// ======================

/**
 * Crea una tool de LangChain con el contexto del negocio
 */
function createToolWithContext(
  toolName: ToolName,
  context: ToolContext
): DynamicStructuredTool | null {
  switch (toolName) {
    case TOOL_NAMES.GET_SERVICE_INFO:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_SERVICE_INFO,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_SERVICE_INFO],
        schema: GetServiceInfoSchema,
        func: async (params) => {
          const result = await handleGetServiceInfo(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.LIST_SERVICES:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.LIST_SERVICES,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.LIST_SERVICES],
        schema: ListServicesSchema,
        func: async (params) => {
          const result = await handleListServices(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_AVAILABLE_SLOTS:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_AVAILABLE_SLOTS,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_AVAILABLE_SLOTS],
        schema: GetAvailableSlotsSchema,
        func: async (params) => {
          const result = await handleGetAvailableSlots(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_BRANCH_INFO:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_BRANCH_INFO,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_BRANCH_INFO],
        schema: GetBranchInfoSchema,
        func: async (params) => {
          const result = await handleGetBranchInfo(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_BUSINESS_POLICY:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_BUSINESS_POLICY,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_BUSINESS_POLICY],
        schema: GetBusinessPolicySchema,
        func: async (params) => {
          const result = await handleGetBusinessPolicy(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.SEARCH_KNOWLEDGE_BASE:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.SEARCH_KNOWLEDGE_BASE,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.SEARCH_KNOWLEDGE_BASE],
        schema: SearchKnowledgeBaseSchema,
        func: async (params) => {
          const result = await handleSearchKnowledgeBase(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_STAFF_INFO:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_STAFF_INFO,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_STAFF_INFO],
        schema: GetStaffInfoSchema,
        func: async (params) => {
          const result = await handleGetStaffInfo(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.CREATE_APPOINTMENT:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.CREATE_APPOINTMENT,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.CREATE_APPOINTMENT],
        schema: CreateAppointmentSchema,
        func: async (params) => {
          const result = await handleCreateAppointment(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.UPDATE_LEAD_INFO:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.UPDATE_LEAD_INFO,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.UPDATE_LEAD_INFO],
        schema: UpdateLeadInfoSchema,
        func: async (params) => {
          const result = await handleUpdateLeadInfo(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_OPERATING_HOURS:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_OPERATING_HOURS,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_OPERATING_HOURS],
        schema: GetOperatingHoursSchema,
        func: async (params) => {
          const result = await handleGetOperatingHours(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_FAQ_ANSWER:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_FAQ_ANSWER,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_FAQ_ANSWER],
        schema: GetFaqAnswerSchema,
        func: async (params) => {
          const result = await handleGetFaqAnswer(params, context);
          return JSON.stringify(result);
        },
      });

    // ===========================
    // RESTAURANT-SPECIFIC TOOLS
    // ===========================

    case TOOL_NAMES.GET_MENU_ITEMS:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_MENU_ITEMS,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_MENU_ITEMS],
        schema: GetMenuItemsSchema,
        func: async (params) => {
          const result = await handleGetMenuItems(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_MENU_CATEGORIES:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_MENU_CATEGORIES,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_MENU_CATEGORIES],
        schema: GetMenuCategoriesSchema,
        func: async (params) => {
          const result = await handleGetMenuCategories(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.CREATE_ORDER:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.CREATE_ORDER,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.CREATE_ORDER],
        schema: CreateOrderSchema,
        func: async (params) => {
          const result = await handleCreateOrder(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.CHECK_ITEM_AVAILABILITY:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.CHECK_ITEM_AVAILABILITY,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.CHECK_ITEM_AVAILABILITY],
        schema: CheckItemAvailabilitySchema,
        func: async (params) => {
          const result = await handleCheckItemAvailability(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_ACTIVE_PROMOTIONS:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_ACTIVE_PROMOTIONS,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_ACTIVE_PROMOTIONS],
        schema: GetActivePromotionsSchema,
        func: async (params) => {
          const result = await handleGetActivePromotions(params, context);
          return JSON.stringify(result);
        },
      });

    // ===========================
    // LOYALTY-SPECIFIC TOOLS (v5.5.1)
    // ===========================

    case TOOL_NAMES.GET_LOYALTY_BALANCE:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_LOYALTY_BALANCE,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_LOYALTY_BALANCE],
        schema: GetLoyaltyBalanceSchema,
        func: async () => {
          const result = await handleGetLoyaltyBalance({}, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_AVAILABLE_REWARDS:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_AVAILABLE_REWARDS,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_AVAILABLE_REWARDS],
        schema: GetAvailableRewardsSchema,
        func: async (params) => {
          const result = await handleGetAvailableRewards(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.GET_MEMBERSHIP_INFO:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.GET_MEMBERSHIP_INFO,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.GET_MEMBERSHIP_INFO],
        schema: GetMembershipInfoSchema,
        func: async (params) => {
          const result = await handleGetMembershipInfo(params, context);
          return JSON.stringify(result);
        },
      });

    case TOOL_NAMES.REDEEM_REWARD:
      return new DynamicStructuredTool({
        name: TOOL_NAMES.REDEEM_REWARD,
        description: TOOL_DESCRIPTIONS[TOOL_NAMES.REDEEM_REWARD],
        schema: RedeemRewardSchema,
        func: async (params) => {
          const result = await handleRedeemReward(params, context);
          return JSON.stringify(result);
        },
      });

    default:
      console.warn(`[ToolFactory] Unknown tool: ${toolName}`);
      return null;
  }
}

/**
 * Crea todas las tools disponibles para un agente específico
 */
export function createToolsForAgent(
  agentName: string,
  state: TISTISAgentStateType
): DynamicStructuredTool[] {
  const toolNames = getToolsForAgent(agentName);
  const context = extractToolContext(state);

  const tools: DynamicStructuredTool[] = [];

  for (const toolName of toolNames) {
    const tool = createToolWithContext(toolName, context);
    if (tool) {
      tools.push(tool);
    }
  }

  console.log(`[ToolFactory] Created ${tools.length} tools for agent "${agentName}"`);

  return tools;
}

/**
 * Crea un conjunto específico de tools
 */
export function createTools(
  toolNames: ToolName[],
  state: TISTISAgentStateType
): DynamicStructuredTool[] {
  const context = extractToolContext(state);
  const tools: DynamicStructuredTool[] = [];

  for (const toolName of toolNames) {
    const tool = createToolWithContext(toolName, context);
    if (tool) {
      tools.push(tool);
    }
  }

  return tools;
}

/**
 * Crea todas las tools disponibles
 */
export function createAllTools(
  state: TISTISAgentStateType
): DynamicStructuredTool[] {
  const allToolNames = Object.values(TOOL_NAMES);
  return createTools(allToolNames, state);
}

// ======================
// EXPORTS
// ======================

export {
  TOOL_NAMES,
  TOOL_DESCRIPTIONS,
  getToolsForAgent,
  type ToolName,
  type ToolContext,
};

const ToolFactory = {
  createToolsForAgent,
  createTools,
  createAllTools,
  extractToolContext,
};

export default ToolFactory;
