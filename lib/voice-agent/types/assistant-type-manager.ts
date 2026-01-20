/**
 * TIS TIS Platform - Voice Agent v2.0
 * Assistant Type Manager
 *
 * Central manager for assistant types with:
 * - Supabase integration with caching
 * - Fallback to hardcoded types
 * - Configuration validation
 * - UI helper methods
 *
 * Usage:
 * ```typescript
 * const manager = new AssistantTypeManager(supabase);
 * await manager.initialize();
 *
 * const types = manager.getAvailableTypes('restaurant');
 * const type = manager.getTypeById('rest_standard');
 * const validation = manager.validateTypeConfig(config);
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AssistantType,
  AssistantTypeId,
  AssistantTypeConfig,
  AssistantTypeValidationResult,
  AssistantTypeValidationError,
  AssistantTypeDisplayInfo,
  AssistantTypeComparison,
  Capability,
  Tool,
  Vertical,
  PersonalityType,
  AssistantTypeRow,
  ResolvedAssistantConfig,
  AssistantTypeErrorCode,
} from './types';
import {
  isValidAssistantTypeId,
  isValidVertical,
  isValidPersonalityType,
  rowToAssistantType,
  typeToDisplayInfo,
  ASSISTANT_TYPE_IDS,
} from './types';
import {
  ASSISTANT_TYPES,
  ASSISTANT_TYPES_MAP,
  getAssistantTypeById,
  getTypesForVertical,
  getRecommendedType,
} from './assistant-types';
import {
  getCapabilitiesForTypeId,
  getToolsForTypeId,
  isCapabilityValidForVertical,
  isToolValidForVertical,
  getAddedCapabilities,
  getAddedTools,
  getLevelFromTypeId,
} from './capability-definitions';

// =====================================================
// CONSTANTS
// =====================================================

/** Table name for assistant types in Supabase */
const TABLE_NAME = 'voice_assistant_types';

/** Default cache TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Refresh interval in milliseconds (5 minutes) */
const DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// =====================================================
// CACHE TYPES
// =====================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// =====================================================
// ASSISTANT TYPE MANAGER
// =====================================================

/**
 * Manager for assistant types with Supabase integration
 */
export class AssistantTypeManager {
  private readonly supabase: SupabaseClient | null;
  private readonly cacheTtlMs: number;
  private cache: CacheEntry<AssistantType[]> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private useSupabase = true;

  constructor(
    supabase?: SupabaseClient | null,
    options?: {
      cacheTtlMs?: number;
      autoRefresh?: boolean;
      refreshIntervalMs?: number;
    }
  ) {
    this.supabase = supabase ?? null;
    this.cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

    // Start auto-refresh if enabled and Supabase is available
    if (options?.autoRefresh !== false && this.supabase) {
      const interval = options?.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
      this.startAutoRefresh(interval);
    }
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  /**
   * Initialize the manager by loading types from Supabase
   * Falls back to hardcoded types if Supabase fails
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadTypes();
    this.initialized = true;
  }

  /**
   * Load types from Supabase with fallback to hardcoded
   */
  private async loadTypes(): Promise<AssistantType[]> {
    // Check cache first
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTtlMs) {
      return this.cache.data;
    }

    // Try loading from Supabase
    if (this.supabase && this.useSupabase) {
      try {
        const { data, error } = await this.supabase
          .from(TABLE_NAME)
          .select('*')
          .eq('is_active', true)
          .order('vertical')
          .order('sort_order');

        if (!error && data && data.length > 0) {
          // Convert rows, handling individual conversion errors gracefully
          const types: AssistantType[] = [];
          for (const row of data as AssistantTypeRow[]) {
            try {
              types.push(rowToAssistantType(row));
            } catch (conversionError) {
              console.error(
                `[AssistantTypeManager] Failed to convert row ${row.id}:`,
                conversionError instanceof Error
                  ? conversionError.message
                  : 'Unknown error'
              );
              // Continue with other rows
            }
          }

          if (types.length > 0) {
            this.cache = { data: types, timestamp: Date.now() };
            return types;
          }
          // If all conversions failed, fall through to fallback
          console.warn(
            '[AssistantTypeManager] All row conversions failed, using fallback'
          );
        }

        // If no data or error, log and fall back
        if (error) {
          console.warn(
            '[AssistantTypeManager] Supabase error, using fallback:',
            error.message
          );
        }
      } catch (err) {
        console.warn(
          '[AssistantTypeManager] Failed to load from Supabase, using fallback:',
          err instanceof Error ? err.message : 'Unknown error'
        );
      }
    }

    // Fallback to hardcoded types
    this.cache = { data: ASSISTANT_TYPES, timestamp: Date.now() };
    return ASSISTANT_TYPES;
  }

  /**
   * Force refresh types from Supabase
   */
  async refresh(): Promise<void> {
    this.cache = null;
    await this.loadTypes();
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(intervalMs: number): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.refresh().catch((err) => {
        console.error('[AssistantTypeManager] Auto-refresh failed:', err);
      });
    }, intervalMs);

    // Don't prevent Node.js from exiting
    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }
  }

  /**
   * Stop the manager and cleanup
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.cache = null;
    this.initialized = false;
  }

  /**
   * Disable Supabase and use only hardcoded types
   * Useful for testing or when Supabase is unavailable
   */
  disableSupabase(): void {
    this.useSupabase = false;
    this.cache = null;
  }

  /**
   * Enable Supabase loading
   */
  enableSupabase(): void {
    this.useSupabase = true;
    this.cache = null;
  }

  // =====================================================
  // TYPE RETRIEVAL
  // =====================================================

  /**
   * Get all available types, optionally filtered by vertical
   */
  getAvailableTypes(vertical?: Vertical): AssistantType[] {
    const types = this.cache?.data ?? ASSISTANT_TYPES;

    if (vertical) {
      return types.filter((t) => t.vertical === vertical);
    }

    return types;
  }

  /**
   * Get all active types, optionally filtered by vertical
   */
  getActiveTypes(vertical?: Vertical): AssistantType[] {
    return this.getAvailableTypes(vertical).filter((t) => t.isActive);
  }

  /**
   * Get a type by its ID
   */
  getTypeById(typeId: string): AssistantType | null {
    if (!isValidAssistantTypeId(typeId)) {
      return null;
    }

    // Try cache first
    const cached = this.cache?.data?.find((t) => t.id === typeId);
    if (cached) {
      return cached;
    }

    // Fall back to hardcoded
    return getAssistantTypeById(typeId as AssistantTypeId) ?? null;
  }

  /**
   * Get types for a specific vertical
   */
  getTypesForVertical(vertical: Vertical): AssistantType[] {
    return this.getAvailableTypes(vertical);
  }

  /**
   * Get the recommended type for a vertical
   */
  getRecommendedType(vertical: Vertical): AssistantType {
    const types = this.getTypesForVertical(vertical);
    const recommended = types.find((t) => t.isRecommended);
    return recommended ?? types[0] ?? getRecommendedType(vertical);
  }

  // =====================================================
  // CAPABILITY & TOOL QUERIES
  // =====================================================

  /**
   * Get capabilities for a type
   */
  getCapabilitiesForType(typeId: string): Capability[] {
    const type = this.getTypeById(typeId);
    if (type) {
      return type.enabledCapabilities;
    }

    // Fall back to static definitions
    if (isValidAssistantTypeId(typeId)) {
      return getCapabilitiesForTypeId(typeId);
    }

    return [];
  }

  /**
   * Get tools for a type
   */
  getToolsForType(typeId: string): Tool[] {
    const type = this.getTypeById(typeId);
    if (type) {
      return type.availableTools;
    }

    // Fall back to static definitions
    if (isValidAssistantTypeId(typeId)) {
      return getToolsForTypeId(typeId);
    }

    return [];
  }

  /**
   * Check if a type supports a specific capability
   */
  typeSupportsCapability(typeId: string, capability: Capability): boolean {
    const capabilities = this.getCapabilitiesForType(typeId);
    return capabilities.includes(capability);
  }

  /**
   * Check if a type has a specific tool
   */
  typeHasTool(typeId: string, tool: Tool): boolean {
    const tools = this.getToolsForType(typeId);
    return tools.includes(tool);
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  /**
   * Validate an assistant type configuration
   */
  validateTypeConfig(
    config: Partial<AssistantTypeConfig>,
    vertical?: Vertical
  ): AssistantTypeValidationResult {
    const errors: AssistantTypeValidationError[] = [];
    const warnings: string[] = [];

    // Validate type ID
    if (!config.typeId) {
      errors.push({
        field: 'typeId',
        message: 'Type ID is required',
        code: 'INVALID_TYPE_ID',
      });
    } else if (!isValidAssistantTypeId(config.typeId)) {
      errors.push({
        field: 'typeId',
        message: `Invalid type ID: ${config.typeId}. Valid IDs are: ${ASSISTANT_TYPE_IDS.join(', ')}`,
        code: 'INVALID_TYPE_ID',
      });
    } else {
      // Check if type exists and is active
      const type = this.getTypeById(config.typeId);
      if (!type) {
        errors.push({
          field: 'typeId',
          message: `Type not found: ${config.typeId}`,
          code: 'TYPE_NOT_FOUND',
        });
      } else {
        if (!type.isActive) {
          errors.push({
            field: 'typeId',
            message: `Type is not active: ${config.typeId}`,
            code: 'TYPE_INACTIVE',
          });
        }

        // Validate vertical match if provided
        if (vertical && type.vertical !== vertical) {
          errors.push({
            field: 'typeId',
            message: `Type ${config.typeId} is for vertical ${type.vertical}, but expected ${vertical}`,
            code: 'VERTICAL_MISMATCH',
          });
        }
      }
    }

    // Validate custom voice ID if provided
    if (config.customVoiceId && config.useCustomSettings) {
      // Basic validation - should start with a provider prefix
      if (
        !config.customVoiceId.startsWith('elevenlabs-') &&
        !config.customVoiceId.startsWith('deepgram-') &&
        !config.customVoiceId.startsWith('azure-')
      ) {
        warnings.push(
          `Custom voice ID "${config.customVoiceId}" may not be valid. Expected format: provider-name`
        );
      }
    }

    // Validate custom personality if provided
    if (config.customPersonality && config.useCustomSettings) {
      if (!isValidPersonalityType(config.customPersonality)) {
        errors.push({
          field: 'customPersonality',
          message: `Invalid personality: ${config.customPersonality}. Valid options: professional, friendly, energetic, calm`,
          code: 'INVALID_PERSONALITY',
        });
      }
    }

    // Validate custom max duration if provided
    if (config.customMaxDuration !== undefined && config.useCustomSettings) {
      if (config.customMaxDuration < 60) {
        errors.push({
          field: 'customMaxDuration',
          message: 'Max duration must be at least 60 seconds',
          code: 'INVALID_DURATION',
        });
      } else if (config.customMaxDuration > 1800) {
        warnings.push(
          'Max duration over 30 minutes may result in higher costs'
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a list of capabilities against a type
   */
  validateCapabilities(
    typeId: string,
    capabilities: Capability[]
  ): AssistantTypeValidationResult {
    const errors: AssistantTypeValidationError[] = [];
    const warnings: string[] = [];

    const type = this.getTypeById(typeId);
    if (!type) {
      errors.push({
        field: 'typeId',
        message: `Type not found: ${typeId}`,
        code: 'TYPE_NOT_FOUND',
      });
      return { valid: false, errors, warnings };
    }

    const supportedCapabilities = type.enabledCapabilities;

    for (const cap of capabilities) {
      // Check if capability is valid for the vertical
      if (!isCapabilityValidForVertical(cap, type.vertical)) {
        errors.push({
          field: 'capabilities',
          message: `Capability "${cap}" is not valid for vertical ${type.vertical}`,
          code: 'INVALID_CAPABILITY',
        });
        continue;
      }

      // Check if capability is supported by the type
      if (!supportedCapabilities.includes(cap)) {
        errors.push({
          field: 'capabilities',
          message: `Capability "${cap}" is not supported by type ${typeId}`,
          code: 'CAPABILITY_NOT_SUPPORTED',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a list of tools against a type
   */
  validateTools(typeId: string, tools: Tool[]): AssistantTypeValidationResult {
    const errors: AssistantTypeValidationError[] = [];
    const warnings: string[] = [];

    const type = this.getTypeById(typeId);
    if (!type) {
      errors.push({
        field: 'typeId',
        message: `Type not found: ${typeId}`,
        code: 'TYPE_NOT_FOUND',
      });
      return { valid: false, errors, warnings };
    }

    const supportedTools = type.availableTools;

    for (const tool of tools) {
      // Check if tool is valid for the vertical
      if (!isToolValidForVertical(tool, type.vertical)) {
        errors.push({
          field: 'tools',
          message: `Tool "${tool}" is not valid for vertical ${type.vertical}`,
          code: 'INVALID_TOOL',
        });
        continue;
      }

      // Check if tool is supported by the type
      if (!supportedTools.includes(tool)) {
        errors.push({
          field: 'tools',
          message: `Tool "${tool}" is not supported by type ${typeId}`,
          code: 'TOOL_NOT_SUPPORTED',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // =====================================================
  // CONFIGURATION RESOLUTION
  // =====================================================

  /**
   * Resolve a configuration to its effective values
   */
  resolveConfig(config: AssistantTypeConfig): ResolvedAssistantConfig | null {
    const type = this.getTypeById(config.typeId);
    if (!type) {
      return null;
    }

    const useCustom = config.useCustomSettings;

    return {
      type,
      voiceId: (useCustom && config.customVoiceId) || type.defaultVoiceId,
      personality:
        (useCustom && config.customPersonality) || type.defaultPersonality,
      greeting: (useCustom && config.customGreeting) || '',
      maxDurationSeconds:
        (useCustom && config.customMaxDuration) || type.maxCallDurationSeconds,
    };
  }

  // =====================================================
  // UI HELPERS
  // =====================================================

  /**
   * Get types formatted for UI display
   */
  getTypesForDisplay(vertical: Vertical): AssistantTypeDisplayInfo[] {
    const types = this.getActiveTypes(vertical);
    return types.map(typeToDisplayInfo);
  }

  /**
   * Compare two types and show differences
   */
  compareTypes(typeAId: string, typeBId: string): AssistantTypeComparison | null {
    if (
      !isValidAssistantTypeId(typeAId) ||
      !isValidAssistantTypeId(typeBId)
    ) {
      return null;
    }

    const capsA = this.getCapabilitiesForType(typeAId);
    const capsB = this.getCapabilitiesForType(typeBId);
    const toolsA = this.getToolsForType(typeAId);
    const toolsB = this.getToolsForType(typeBId);

    return {
      typeA: typeAId as AssistantTypeId,
      typeB: typeBId as AssistantTypeId,
      capabilitiesOnlyInA: capsA.filter((c) => !capsB.includes(c)),
      capabilitiesOnlyInB: capsB.filter((c) => !capsA.includes(c)),
      sharedCapabilities: capsA.filter((c) => capsB.includes(c)),
      toolsOnlyInA: toolsA.filter((t) => !toolsB.includes(t)),
      toolsOnlyInB: toolsB.filter((t) => !toolsA.includes(t)),
      sharedTools: toolsA.filter((t) => toolsB.includes(t)),
    };
  }

  /**
   * Get upgrade path from one type to another
   */
  getUpgradePath(
    fromTypeId: string,
    toTypeId: string
  ): {
    canUpgrade: boolean;
    reason?: string;
    addedCapabilities: Capability[];
    addedTools: Tool[];
  } | null {
    const fromType = this.getTypeById(fromTypeId);
    const toType = this.getTypeById(toTypeId);

    if (!fromType || !toType) {
      return null;
    }

    // Can only upgrade within same vertical
    if (fromType.vertical !== toType.vertical) {
      return {
        canUpgrade: false,
        reason: 'Cannot upgrade between different verticals',
        addedCapabilities: [],
        addedTools: [],
      };
    }

    // Check if it's actually an upgrade (higher level)
    const levels = ['basic', 'standard', 'complete'];
    const fromLevel = levels.indexOf(fromType.level);
    const toLevel = levels.indexOf(toType.level);

    if (toLevel <= fromLevel) {
      return {
        canUpgrade: false,
        reason:
          toLevel === fromLevel
            ? 'Same level - no upgrade needed'
            : 'Cannot downgrade using upgrade path',
        addedCapabilities: [],
        addedTools: [],
      };
    }

    const addedCaps = getAddedCapabilities(
      fromType.vertical,
      fromType.level,
      toType.level
    );
    const addedTools = getAddedTools(
      fromType.vertical,
      fromType.level,
      toType.level
    );

    return {
      canUpgrade: true,
      addedCapabilities: addedCaps,
      addedTools: addedTools,
    };
  }

  /**
   * Get a summary of all types for a vertical
   */
  getVerticalSummary(vertical: Vertical): {
    vertical: Vertical;
    types: {
      id: AssistantTypeId;
      name: string;
      level: string;
      capabilityCount: number;
      toolCount: number;
      recommended: boolean;
    }[];
    recommendedTypeId: AssistantTypeId;
  } {
    const types = this.getActiveTypes(vertical);
    const recommended = this.getRecommendedType(vertical);

    return {
      vertical,
      types: types.map((t) => ({
        id: t.id,
        name: t.displayName,
        level: t.level,
        capabilityCount: t.enabledCapabilities.length,
        toolCount: t.availableTools.length,
        recommended: t.isRecommended,
      })),
      recommendedTypeId: recommended.id,
    };
  }

  // =====================================================
  // METADATA
  // =====================================================

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    return (
      this.cache !== null &&
      Date.now() - this.cache.timestamp < this.cacheTtlMs
    );
  }

  /**
   * Get cache age in milliseconds
   */
  getCacheAge(): number | null {
    if (!this.cache) {
      return null;
    }
    return Date.now() - this.cache.timestamp;
  }

  /**
   * Get total type count
   */
  getTypeCount(): number {
    return this.getAvailableTypes().length;
  }

  /**
   * Check if using Supabase or fallback
   */
  isUsingSupabase(): boolean {
    return this.useSupabase && this.supabase !== null;
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create an AssistantTypeManager with Supabase
 */
export function createAssistantTypeManager(
  supabase: SupabaseClient,
  options?: {
    cacheTtlMs?: number;
    autoRefresh?: boolean;
    refreshIntervalMs?: number;
  }
): AssistantTypeManager {
  return new AssistantTypeManager(supabase, options);
}

/**
 * Create an AssistantTypeManager without Supabase (uses hardcoded types)
 */
export function createLocalAssistantTypeManager(): AssistantTypeManager {
  const manager = new AssistantTypeManager(null, { autoRefresh: false });
  manager.disableSupabase();
  return manager;
}

/**
 * Create a pre-initialized manager for testing
 */
export async function createInitializedManager(
  supabase?: SupabaseClient | null
): Promise<AssistantTypeManager> {
  const manager = new AssistantTypeManager(supabase, { autoRefresh: false });
  await manager.initialize();
  return manager;
}
