/**
 * TIS TIS Platform - Voice Agent v2.0
 * Function Call Handler
 *
 * Handles function-call events from VAPI when the assistant
 * wants to execute a tool/function.
 *
 * Responsibilities:
 * 1. Extract function name and parameters
 * 2. Validate function exists and is allowed
 * 3. Execute function (placeholder for LangGraph integration in Fase 07)
 * 4. Format result for voice output
 * 5. Return result to VAPI
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  FunctionCallPayload,
  FunctionCallResponse,
  WebhookHandlerContext,
  HandlerResult,
  ToolCallsPayload,
  ToolCallsResponse,
} from '../types';
import {
  formatFunctionCallResponse,
  formatFunctionCallError,
  formatToolCallsResponse,
  formatResultForVoice,
  formatErrorForVoice,
} from '../response-formatters';
// Error factory functions - reserved for Fase 07 LangGraph integration
// import { functionNotFoundError, functionExecutionError, callNotFoundError } from '../error-handler';
import type { Tool } from '../../types/types';

// =====================================================
// TYPES
// =====================================================

/**
 * Function executor type
 */
export type FunctionExecutor = (
  name: string,
  parameters: Record<string, unknown>,
  context: FunctionExecutionContext
) => Promise<FunctionExecutionResult>;

/**
 * Context passed to function executors
 */
export interface FunctionExecutionContext {
  /** Tenant ID */
  tenantId: string;

  /** Internal call ID */
  callId: string;

  /** VAPI call ID */
  vapiCallId: string;

  /** Language/locale for responses */
  locale: string;

  /** Voice config ID */
  voiceConfigId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from function execution
 */
export interface FunctionExecutionResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data */
  result?: unknown;

  /** Error message if failed */
  error?: string;

  /** Whether to forward result to client */
  forwardToClient?: boolean;

  /** Voice-formatted message (if different from result) */
  voiceMessage?: string;

  /** Whether this action requires confirmation */
  requiresConfirmation?: boolean;

  /** Confirmation message to ask */
  confirmationMessage?: string;
}

/**
 * Handler options
 */
export interface FunctionCallHandlerOptions {
  /** Custom function executor */
  functionExecutor?: FunctionExecutor;

  /** List of allowed functions */
  allowedFunctions?: string[];

  /** Default locale for voice responses */
  defaultLocale?: string;

  /** Custom Supabase client (for testing) */
  supabaseClient?: SupabaseClient;
}

// =====================================================
// DEFAULT FUNCTION EXECUTOR
// =====================================================

/**
 * Default function executor (placeholder for LangGraph integration)
 * This will be replaced in Fase 07 with LangGraph execution
 */
const defaultFunctionExecutor: FunctionExecutor = async (
  name,
  parameters,
  context
) => {
  console.log(
    `[Function Call] Executing function: ${name}`,
    JSON.stringify({ parameters, tenantId: context.tenantId, callId: context.callId })
  );

  // Placeholder responses for common functions
  // In Fase 07, this will route to LangGraph
  switch (name) {
    case 'get_business_hours':
      return {
        success: true,
        result: {
          message: 'Nuestro horario es de lunes a viernes de 9 a 6, y sábados de 10 a 2.',
        },
        voiceMessage: 'Nuestro horario es de lunes a viernes de 9 a 6, y sábados de 10 a 2.',
      };

    case 'get_business_info':
      return {
        success: true,
        result: {
          message: 'Somos un negocio dedicado a brindarte el mejor servicio.',
        },
        voiceMessage: 'Somos un negocio dedicado a brindarte el mejor servicio.',
      };

    case 'check_availability':
      return {
        success: true,
        result: {
          available: true,
          message: 'Sí, tenemos disponibilidad para esa fecha y hora.',
        },
        voiceMessage: 'Sí, tenemos disponibilidad para esa fecha y hora. ¿Deseas que haga la reservación?',
      };

    case 'check_appointment_availability':
      return {
        success: true,
        result: {
          available: true,
          message: 'Tenemos citas disponibles para esa fecha.',
        },
        voiceMessage: 'Sí, tenemos citas disponibles para esa fecha. ¿Quieres que te agende?',
      };

    case 'create_reservation':
    case 'create_appointment':
      return {
        success: true,
        result: {
          confirmed: true,
          confirmationNumber: `RES-${Date.now()}`,
        },
        voiceMessage: 'Perfecto, tu reservación ha sido confirmada. Te enviaremos un mensaje con los detalles.',
        requiresConfirmation: true,
        confirmationMessage: '¿Confirmas que deseas hacer esta reservación?',
      };

    case 'transfer_to_human':
      return {
        success: true,
        result: {
          transferred: true,
        },
        voiceMessage: 'Entendido, te voy a transferir con uno de nuestros agentes. Por favor espera un momento.',
      };

    case 'get_menu':
    case 'get_services':
      return {
        success: true,
        result: {
          items: ['Opción 1', 'Opción 2', 'Opción 3'],
        },
        voiceMessage: 'Tenemos varias opciones disponibles. ¿Te gustaría que te dé más detalles de alguna en particular?',
      };

    default:
      // For unknown functions, return a generic message
      // In production with LangGraph, this would execute the actual function
      console.warn(`[Function Call] Unknown function: ${name} - Using placeholder`);
      return {
        success: true,
        result: {
          message: `Función ${name} ejecutada correctamente.`,
        },
        voiceMessage: 'He procesado tu solicitud. ¿Hay algo más en lo que pueda ayudarte?',
      };
  }
};

// =====================================================
// MAIN HANDLER FUNCTIONS
// =====================================================

/**
 * Handle function-call event
 */
export async function handleFunctionCall(
  payload: FunctionCallPayload,
  context: WebhookHandlerContext,
  options: FunctionCallHandlerOptions = {}
): Promise<HandlerResult<FunctionCallResponse>> {
  const supabase = options.supabaseClient || createServiceClient();
  const executor = options.functionExecutor || defaultFunctionExecutor;
  const locale = options.defaultLocale || 'es';

  // Extract function info
  const functionName = payload.functionCall?.name;
  const parameters = payload.functionCall?.parameters || {};
  const vapiCallId = payload.call?.id || '';

  console.log(
    `[Function Call] Processing function: ${functionName}`,
    JSON.stringify({
      vapiCallId,
      parameters: Object.keys(parameters),
      requestId: context.requestId,
    })
  );

  try {
    // Validate function name
    if (!functionName) {
      return {
        response: formatFunctionCallError('Function name is required'),
        statusCode: 400,
        shouldLog: true,
        metadata: { error: 'missing_function_name' },
      };
    }

    // Check if function is in allowed list (if specified)
    if (options.allowedFunctions && !options.allowedFunctions.includes(functionName)) {
      console.warn(`[Function Call] Function not allowed: ${functionName}`);
      return {
        response: formatFunctionCallError(`Function ${functionName} is not available`),
        statusCode: 403,
        shouldLog: true,
        metadata: { error: 'function_not_allowed', functionName },
      };
    }

    // Get call info for context
    const callInfo = await getCallInfo(supabase, vapiCallId);

    if (!callInfo) {
      console.warn(`[Function Call] Call not found: ${vapiCallId}`);
      // Don't fail - try to execute anyway with minimal context
    }

    // Build execution context
    const execContext: FunctionExecutionContext = {
      tenantId: context.tenantId || callInfo?.tenant_id || '',
      callId: context.callId || callInfo?.id || '',
      vapiCallId,
      locale,
      voiceConfigId: context.voiceConfigId,
      metadata: context.metadata,
    };

    // Execute the function
    const executionResult = await executor(functionName, parameters, execContext);

    // Log function execution
    await logFunctionExecution(
      supabase,
      execContext.callId,
      functionName,
      parameters,
      executionResult
    );

    // Format response
    if (!executionResult.success) {
      const errorMessage = executionResult.error
        ? formatErrorForVoice(executionResult.error, locale)
        : formatErrorForVoice('Function execution failed', locale);

      return {
        response: formatFunctionCallError(errorMessage),
        statusCode: 200, // VAPI expects 200 even for function errors
        shouldLog: true,
        metadata: {
          functionName,
          error: executionResult.error,
          processingTimeMs: Date.now() - context.startTime,
        },
      };
    }

    // Get voice-formatted result
    const voiceResult = executionResult.voiceMessage ||
      formatResultForVoice(functionName, executionResult.result, locale);

    return {
      response: formatFunctionCallResponse(voiceResult, executionResult.forwardToClient),
      statusCode: 200,
      shouldLog: true,
      metadata: {
        functionName,
        success: true,
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  } catch (error) {
    console.error(`[Function Call] Error executing ${functionName}:`, error);

    const errorMessage = formatErrorForVoice(
      error instanceof Error ? error : 'Unknown error',
      locale
    );

    return {
      response: formatFunctionCallError(errorMessage),
      statusCode: 200, // VAPI expects 200
      shouldLog: true,
      metadata: {
        functionName,
        error: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  }
}

/**
 * Handle tool-calls event (multiple tools at once)
 */
export async function handleToolCalls(
  payload: ToolCallsPayload,
  context: WebhookHandlerContext,
  options: FunctionCallHandlerOptions = {}
): Promise<HandlerResult<ToolCallsResponse>> {
  const supabase = options.supabaseClient || createServiceClient();
  const executor = options.functionExecutor || defaultFunctionExecutor;
  const locale = options.defaultLocale || 'es';

  const toolCallList = payload.toolCallList || [];
  const vapiCallId = payload.call?.id || '';

  console.log(
    `[Tool Calls] Processing ${toolCallList.length} tools`,
    JSON.stringify({
      vapiCallId,
      tools: toolCallList.map(t => t.function.name),
      requestId: context.requestId,
    })
  );

  // Get call info for context
  const callInfo = await getCallInfo(supabase, vapiCallId);

  const execContext: FunctionExecutionContext = {
    tenantId: context.tenantId || callInfo?.tenant_id || '',
    callId: context.callId || callInfo?.id || '',
    vapiCallId,
    locale,
    voiceConfigId: context.voiceConfigId,
    metadata: context.metadata,
  };

  // Execute all tool calls
  const results = await Promise.all(
    toolCallList.map(async (toolCall) => {
      const functionName = toolCall.function.name;

      try {
        // Parse arguments
        let parameters: Record<string, unknown> = {};
        try {
          parameters = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          console.warn(`[Tool Calls] Failed to parse arguments for ${functionName}`);
        }

        // Execute
        const executionResult = await executor(functionName, parameters, execContext);

        // Log execution
        await logFunctionExecution(
          supabase,
          execContext.callId,
          functionName,
          parameters,
          executionResult
        );

        if (!executionResult.success) {
          return {
            toolCallId: toolCall.id,
            error: executionResult.error || 'Function execution failed',
          };
        }

        const voiceResult = executionResult.voiceMessage ||
          formatResultForVoice(functionName, executionResult.result, locale);

        return {
          toolCallId: toolCall.id,
          result: voiceResult,
        };
      } catch (error) {
        console.error(`[Tool Calls] Error executing ${functionName}:`, error);
        return {
          toolCallId: toolCall.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return {
    response: formatToolCallsResponse(results),
    statusCode: 200,
    shouldLog: true,
    metadata: {
      toolCount: toolCallList.length,
      successCount: results.filter(r => !r.error).length,
      processingTimeMs: Date.now() - context.startTime,
    },
  };
}

// =====================================================
// DATABASE FUNCTIONS
// =====================================================

/**
 * Create Supabase service client
 */
function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get call info from database
 */
async function getCallInfo(
  supabase: SupabaseClient,
  vapiCallId: string
): Promise<{ id: string; tenant_id: string } | null> {
  try {
    const { data } = await supabase
      .from('voice_calls')
      .select('id, tenant_id')
      .eq('vapi_call_id', vapiCallId)
      .single();

    return data;
  } catch {
    return null;
  }
}

/**
 * Log function execution to database
 */
async function logFunctionExecution(
  supabase: SupabaseClient,
  callId: string,
  functionName: string,
  parameters: Record<string, unknown>,
  result: FunctionExecutionResult
): Promise<void> {
  if (!callId) return;

  try {
    // Update call with function execution info
    // This could be expanded to a separate function_executions table
    await supabase
      .from('voice_calls')
      .update({
        last_function_called: functionName,
        last_function_result: result.success ? 'success' : 'error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId);
  } catch (error) {
    // Log but don't fail
    console.warn('[Function Call] Failed to log execution:', error);
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a function call handler with options
 */
export function createFunctionCallHandler(
  options: FunctionCallHandlerOptions = {}
): (
  payload: FunctionCallPayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<FunctionCallResponse>> {
  return (payload, context) => handleFunctionCall(payload, context, options);
}

/**
 * Create a tool calls handler with options
 */
export function createToolCallsHandler(
  options: FunctionCallHandlerOptions = {}
): (
  payload: ToolCallsPayload,
  context: WebhookHandlerContext
) => Promise<HandlerResult<ToolCallsResponse>> {
  return (payload, context) => handleToolCalls(payload, context, options);
}
