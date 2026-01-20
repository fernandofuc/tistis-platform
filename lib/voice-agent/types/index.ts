/**
 * TIS TIS Platform - Voice Agent v2.0
 * Types Module Exports
 *
 * Provides the complete assistant type system:
 * - 6 predefined types (3 restaurant, 3 dental)
 * - Capability and tool definitions
 * - AssistantTypeManager for queries and validation
 * - UI helpers for display
 *
 * @example
 * ```typescript
 * import {
 *   AssistantTypeManager,
 *   createLocalAssistantTypeManager,
 *   REST_STANDARD,
 *   DENTAL_COMPLETE,
 *   type AssistantType,
 *   type Capability,
 * } from '@/lib/voice-agent/types';
 *
 * // Create manager (local or with Supabase)
 * const manager = createLocalAssistantTypeManager();
 *
 * // Get types for a vertical
 * const restaurantTypes = manager.getAvailableTypes('restaurant');
 *
 * // Get recommended type
 * const recommended = manager.getRecommendedType('dental');
 *
 * // Validate configuration
 * const validation = manager.validateTypeConfig({
 *   typeId: 'rest_standard',
 *   useCustomSettings: false,
 * });
 * ```
 */

// =====================================================
// TYPES MODULE - MAIN EXPORTS
// =====================================================

// Types and Interfaces
export type {
  // Core types
  Vertical,
  Capability,
  RestaurantCapability,
  DentalCapability,
  Tool,
  PersonalityType,
  AssistantTypeLevel,
  AssistantTypeId,
  AssistantType,

  // Configuration
  AssistantTypeConfig,
  ResolvedAssistantConfig,

  // Validation
  AssistantTypeValidationResult,
  AssistantTypeValidationError,
  AssistantTypeErrorCode,

  // UI helpers
  AssistantTypeDisplayInfo,
  AssistantTypeComparison,

  // Database
  AssistantTypeRow,
} from './types';

// Constants and validators
export {
  VERTICALS,
  ASSISTANT_TYPE_IDS,
  ALL_CAPABILITIES,
  ALL_TOOLS,
  PERSONALITY_DESCRIPTIONS,
  LEVEL_DESCRIPTIONS,
  isValidVertical,
  isValidAssistantTypeId,
  isValidCapability,
  isValidTool,
  isValidPersonalityType,
  isValidAssistantTypeLevel,
  rowToAssistantType,
  typeToDisplayInfo,
} from './types';

// =====================================================
// CAPABILITY DEFINITIONS
// =====================================================

export {
  // Descriptions
  CAPABILITY_DESCRIPTIONS,
  TOOL_DESCRIPTIONS,

  // Restaurant definitions
  RESTAURANT_CAPABILITIES,
  RESTAURANT_TOOLS,

  // Dental definitions
  DENTAL_CAPABILITIES,
  DENTAL_TOOLS,

  // Mapping
  CAPABILITY_TOOLS,

  // Helper functions
  getCapabilitiesForLevel,
  getToolsForLevel,
  getCapabilitiesForTypeId,
  getToolsForTypeId,
  getVerticalFromTypeId,
  getLevelFromTypeId,
  isCapabilityValidForVertical,
  isToolValidForVertical,
  getToolsForCapability,
  getAddedCapabilities,
  getAddedTools,
} from './capability-definitions';

// =====================================================
// ASSISTANT TYPE DEFINITIONS
// =====================================================

export {
  // Individual types
  REST_BASIC,
  REST_STANDARD,
  REST_COMPLETE,
  DENTAL_BASIC,
  DENTAL_STANDARD,
  DENTAL_COMPLETE,

  // Collections
  ASSISTANT_TYPES,
  ASSISTANT_TYPES_MAP,
  RESTAURANT_TYPES,
  DENTAL_TYPES,

  // Helper functions
  getAssistantTypeById,
  getTypesForVertical,
  getRecommendedType,
  getActiveTypes,
  getActiveTypesForVertical,
  typeExists,
  getTypeIdsForVertical,
} from './assistant-types';

// =====================================================
// ASSISTANT TYPE MANAGER
// =====================================================

export {
  AssistantTypeManager,
  createAssistantTypeManager,
  createLocalAssistantTypeManager,
  createInitializedManager,
} from './assistant-type-manager';
