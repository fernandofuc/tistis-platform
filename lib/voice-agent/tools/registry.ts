/**
 * TIS TIS Platform - Voice Agent v2.0
 * Tool Registry
 *
 * Central registry for all voice agent tools.
 * Provides registration, lookup, validation, and execution.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  ToolDefinition,
  ToolContext,
  ToolResult,
  ToolCategory,
  IToolRegistry,
  VAPIFunctionDefinition,
  JSONSchema,
  ValidationResult,
  ValidationError,
} from './types';

// =====================================================
// TOOL REGISTRY CLASS
// =====================================================

/**
 * Tool Registry - manages all registered tools
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ToolDefinition<Record<string, unknown>>> = new Map();
  private executionTimeout: number;
  private logExecutions: boolean;

  constructor(options: { executionTimeout?: number; logExecutions?: boolean } = {}) {
    this.executionTimeout = options.executionTimeout ?? 30000; // 30 seconds default
    this.logExecutions = options.logExecutions ?? true;
  }

  // =====================================================
  // REGISTRATION
  // =====================================================

  /**
   * Register a tool
   */
  register<T = Record<string, unknown>>(tool: ToolDefinition<T>): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Tool '${tool.name}' already registered, overwriting`);
    }

    // Validate tool definition
    this.validateToolDefinition(tool as ToolDefinition<Record<string, unknown>>);

    this.tools.set(tool.name, tool as ToolDefinition<Record<string, unknown>>);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools at once
   */
  registerMany<T = Record<string, unknown>>(tools: ToolDefinition<T>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  // =====================================================
  // LOOKUP
  // =====================================================

  /**
   * Get tool by name
   */
  get(name: string): ToolDefinition<Record<string, unknown>> | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools for a specific assistant type
   */
  getForType(assistantType: string): ToolDefinition<Record<string, unknown>>[] {
    return Array.from(this.tools.values()).filter(tool =>
      tool.enabledFor.includes('*') ||
      tool.enabledFor.includes(assistantType as never)
    );
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ToolDefinition<Record<string, unknown>>[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.category === category
    );
  }

  /**
   * Get all tools
   */
  getAll(): ToolDefinition<Record<string, unknown>>[] {
    return Array.from(this.tools.values());
  }

  // =====================================================
  // CONFIRMATION
  // =====================================================

  /**
   * Check if tool requires confirmation
   */
  requiresConfirmation(name: string): boolean {
    return this.tools.get(name)?.requiresConfirmation ?? false;
  }

  /**
   * Get confirmation message for a tool
   */
  getConfirmationMessage(
    name: string,
    params: Record<string, unknown>
  ): string | null {
    const tool = this.tools.get(name);

    if (!tool?.requiresConfirmation) {
      return null;
    }

    // Use dynamic confirmation message function if available
    if (tool.confirmationMessage) {
      return tool.confirmationMessage(params);
    }

    // Use template with placeholder replacement
    if (tool.confirmationTemplate) {
      let message = tool.confirmationTemplate;

      for (const [key, value] of Object.entries(params)) {
        message = message.replace(
          new RegExp(`\\{${key}\\}`, 'g'),
          String(value ?? '')
        );
      }

      return message;
    }

    // Default confirmation message
    return '¿Desea proceder con esta acción?';
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  /**
   * Validate tool definition
   */
  private validateToolDefinition(tool: ToolDefinition): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.handler || typeof tool.handler !== 'function') {
      throw new Error(`Tool '${tool.name}' must have a valid handler function`);
    }

    if (!tool.parameters || tool.parameters.type !== 'object') {
      throw new Error(`Tool '${tool.name}' must have valid parameters schema`);
    }

    if (!Array.isArray(tool.enabledFor) || tool.enabledFor.length === 0) {
      throw new Error(`Tool '${tool.name}' must specify enabledFor assistant types`);
    }
  }

  /**
   * Validate parameters against tool schema
   */
  validateParameters(
    name: string,
    params: Record<string, unknown>
  ): ValidationResult {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        valid: false,
        errors: [{ field: '', message: `Tool '${name}' not found`, code: 'custom' }],
      };
    }

    return this.validateAgainstSchema(params, tool.parameters);
  }

  /**
   * Validate params against JSON Schema
   */
  private validateAgainstSchema(
    params: Record<string, unknown>,
    schema: JSONSchema
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (params[field] === undefined || params[field] === null) {
          errors.push({
            field,
            message: `Field '${field}' is required`,
            code: 'required',
          });
        }
      }
    }

    // Validate each property
    for (const [field, value] of Object.entries(params)) {
      const propSchema = schema.properties[field];

      if (!propSchema) {
        continue; // Unknown property, skip
      }

      // Type validation
      if (value !== undefined && value !== null) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        const expectedType = propSchema.type;

        // Handle number/integer
        if (expectedType === 'integer' && actualType === 'number') {
          if (!Number.isInteger(value)) {
            errors.push({
              field,
              message: `Field '${field}' must be an integer`,
              code: 'type',
            });
          }
        } else if (expectedType !== actualType && actualType !== 'object') {
          errors.push({
            field,
            message: `Field '${field}' must be of type ${expectedType}`,
            code: 'type',
          });
        }

        // Enum validation
        if (propSchema.enum && !propSchema.enum.includes(value as string)) {
          errors.push({
            field,
            message: `Field '${field}' must be one of: ${propSchema.enum.join(', ')}`,
            code: 'enum',
          });
        }

        // Range validation for numbers
        if (typeof value === 'number') {
          if (propSchema.minimum !== undefined && value < propSchema.minimum) {
            errors.push({
              field,
              message: `Field '${field}' must be at least ${propSchema.minimum}`,
              code: 'range',
            });
          }
          if (propSchema.maximum !== undefined && value > propSchema.maximum) {
            errors.push({
              field,
              message: `Field '${field}' must be at most ${propSchema.maximum}`,
              code: 'range',
            });
          }
        }

        // String length validation
        if (typeof value === 'string') {
          if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
            errors.push({
              field,
              message: `Field '${field}' must be at least ${propSchema.minLength} characters`,
              code: 'range',
            });
          }
          if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
            errors.push({
              field,
              message: `Field '${field}' must be at most ${propSchema.maxLength} characters`,
              code: 'range',
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =====================================================
  // EXECUTION
  // =====================================================

  /**
   * Execute a tool
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(name);

    // Tool not found
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        errorCode: 'TOOL_NOT_FOUND',
        voiceMessage: 'Lo siento, no puedo realizar esa acción en este momento.',
      };
    }

    // Validate tool is enabled for assistant type
    if (
      !tool.enabledFor.includes('*') &&
      !tool.enabledFor.includes(context.assistantType as never)
    ) {
      return {
        success: false,
        error: `Tool '${name}' not enabled for assistant type '${context.assistantType}'`,
        errorCode: 'TOOL_NOT_ENABLED',
        voiceMessage: 'Esta función no está disponible.',
      };
    }

    // Validate parameters
    const validation = this.validateParameters(name, params);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => e.message).join(', ');
      return {
        success: false,
        error: `Invalid parameters: ${errorMessages}`,
        errorCode: 'INVALID_PARAMS',
        voiceMessage: 'Faltan algunos datos necesarios. ¿Podría proporcionarlos?',
        metadata: { validationErrors: validation.errors },
      };
    }

    // Execute with timeout
    const timeout = tool.timeout ?? this.executionTimeout;
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const resultPromise = tool.handler(params, context);

      const timeoutPromise = new Promise<ToolResult>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Tool execution timeout')),
          timeout
        );
      });

      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Log execution if enabled
      if (this.logExecutions) {
        await this.logExecution(name, params, context, result, startTime);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage === 'Tool execution timeout';

      const result: ToolResult = {
        success: false,
        error: errorMessage,
        errorCode: isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR',
        voiceMessage: isTimeout
          ? 'La operación está tardando demasiado. Por favor intente de nuevo.'
          : 'Hubo un error al procesar su solicitud. Por favor intente de nuevo.',
      };

      // Log failed execution
      if (this.logExecutions) {
        await this.logExecution(name, params, context, result, startTime);
      }

      return result;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Log tool execution
   */
  private async logExecution(
    toolName: string,
    params: Record<string, unknown>,
    context: ToolContext,
    result: ToolResult,
    startTime: number
  ): Promise<void> {
    const durationMs = Date.now() - startTime;

    console.log(
      `[ToolRegistry] Executed ${toolName}:`,
      {
        success: result.success,
        durationMs,
        tenantId: context.tenantId,
        callId: context.callId,
      }
    );

    // Log to database if available
    try {
      await context.supabase
        .from('voice_call_events')
        .insert({
          call_id: context.callId,
          event_type: 'tool_executed',
          event_data: {
            tool_name: toolName,
            parameters: params,
            success: result.success,
            error: result.error,
            duration_ms: durationMs,
          },
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.warn('[ToolRegistry] Failed to log tool execution to database:', error);
    }
  }

  // =====================================================
  // VAPI INTEGRATION
  // =====================================================

  /**
   * Get tools as VAPI function definitions
   */
  getVAPIFunctions(assistantType: string): VAPIFunctionDefinition[] {
    return this.getForType(assistantType).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Get tools as OpenAI function definitions
   */
  getOpenAIFunctions(assistantType: string): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: JSONSchema;
    };
  }> {
    return this.getForType(assistantType).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  // =====================================================
  // METRICS
  // =====================================================

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    toolsByCategory: Record<string, number>;
    toolsRequiringConfirmation: number;
  } {
    const tools = Array.from(this.tools.values());

    const toolsByCategory: Record<string, number> = {};
    for (const tool of tools) {
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;
    }

    return {
      totalTools: tools.length,
      toolsByCategory,
      toolsRequiringConfirmation: tools.filter(t => t.requiresConfirmation).length,
    };
  }
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let defaultRegistryInstance: ToolRegistry | null = null;

/**
 * Get or create the default tool registry
 */
export function getToolRegistry(options?: { executionTimeout?: number; logExecutions?: boolean }): ToolRegistry {
  if (!defaultRegistryInstance) {
    defaultRegistryInstance = new ToolRegistry(options);
  }
  return defaultRegistryInstance;
}

/**
 * Default tool registry singleton
 */
export const toolRegistry = getToolRegistry();

/**
 * Reset the default registry (for testing)
 */
export function resetToolRegistry(): void {
  defaultRegistryInstance = null;
}

/**
 * Create a new tool registry instance
 */
export function createToolRegistry(options?: { executionTimeout?: number; logExecutions?: boolean }): ToolRegistry {
  return new ToolRegistry(options);
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a Supabase client for tool context
 */
export function createToolSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Create a tool context from common parameters
 */
export function createToolContext(params: {
  tenantId: string;
  callId: string;
  assistantType: string;
  locale?: string;
  channel?: 'voice' | 'whatsapp' | 'chat';
  branchId?: string;
  vapiCallId?: string;
  voiceConfigId?: string;
  entities?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): ToolContext {
  return {
    tenantId: params.tenantId,
    callId: params.callId,
    assistantType: params.assistantType,
    locale: params.locale ?? 'es',
    channel: params.channel ?? 'voice',
    branchId: params.branchId,
    vapiCallId: params.vapiCallId,
    voiceConfigId: params.voiceConfigId,
    entities: params.entities ?? {},
    supabase: params.supabase ?? createToolSupabaseClient(),
  };
}
