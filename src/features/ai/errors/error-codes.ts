// =====================================================
// TIS TIS PLATFORM - LangGraph Structured Error Codes
// Provides standardized error codes for AI agent system
// Enables consistent error handling, logging, and monitoring
// =====================================================

/**
 * Error severity levels for prioritization
 */
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Error categories for grouping
 */
export type ErrorCategory =
  | 'auth'
  | 'validation'
  | 'routing'
  | 'agent'
  | 'tool'
  | 'llm'
  | 'state'
  | 'checkpoint'
  | 'external'
  | 'business_logic'
  | 'rate_limit'
  | 'timeout';

/**
 * Structured error code definition
 */
export interface ErrorCodeDefinition {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  userFacingMessage?: string;
  suggestedAction?: string;
}

/**
 * All LangGraph error codes
 */
export const LANGGRAPH_ERROR_CODES = {
  // ======================
  // AUTH ERRORS (1xxx)
  // ======================
  AUTH_MISSING_TENANT: {
    code: 'LG1001',
    message: 'Tenant ID is missing from context',
    category: 'auth' as ErrorCategory,
    severity: 'critical' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Error de configuración. Por favor contacta a soporte.',
    suggestedAction: 'Verify tenant_id is properly passed to graph',
  },
  AUTH_INVALID_CONTEXT: {
    code: 'LG1002',
    message: 'Invalid authentication context',
    category: 'auth' as ErrorCategory,
    severity: 'critical' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Error de autenticación. Por favor intenta de nuevo.',
  },

  // ======================
  // VALIDATION ERRORS (2xxx)
  // ======================
  VALIDATION_INVALID_MESSAGE: {
    code: 'LG2001',
    message: 'Invalid message format or content',
    category: 'validation' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'No pude entender tu mensaje. ¿Puedes reformularlo?',
  },
  VALIDATION_MISSING_REQUIRED_FIELD: {
    code: 'LG2002',
    message: 'Required field missing in request',
    category: 'validation' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
    suggestedAction: 'Check that all required fields are provided',
  },
  VALIDATION_INVALID_DATE: {
    code: 'LG2003',
    message: 'Invalid date format provided',
    category: 'validation' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'La fecha que mencionaste no es válida. ¿Puedes darme otra fecha?',
  },
  VALIDATION_INVALID_TIME: {
    code: 'LG2004',
    message: 'Invalid time format provided',
    category: 'validation' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'La hora que mencionaste no es válida. ¿Puedes darme otra hora?',
  },

  // ======================
  // ROUTING ERRORS (3xxx)
  // ======================
  ROUTING_NO_INTENT_DETECTED: {
    code: 'LG3001',
    message: 'Could not detect intent from message',
    category: 'routing' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'No estoy seguro de cómo ayudarte. ¿Puedes ser más específico?',
  },
  ROUTING_AGENT_NOT_FOUND: {
    code: 'LG3002',
    message: 'Requested agent not available',
    category: 'routing' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: false,
    suggestedAction: 'Fallback to general agent',
  },
  ROUTING_VERTICAL_MISMATCH: {
    code: 'LG3003',
    message: 'Vertical router received mismatched vertical',
    category: 'routing' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
  },
  ROUTING_MAX_ITERATIONS: {
    code: 'LG3004',
    message: 'Maximum routing iterations exceeded',
    category: 'routing' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Parece que tenemos un problema técnico. Te comunico con un agente humano.',
    suggestedAction: 'Escalate to human',
  },

  // ======================
  // AGENT ERRORS (4xxx)
  // ======================
  AGENT_EXECUTION_FAILED: {
    code: 'LG4001',
    message: 'Agent execution failed',
    category: 'agent' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
    userFacingMessage: 'Hubo un problema procesando tu solicitud. Déjame intentar de nuevo.',
  },
  AGENT_RESPONSE_EMPTY: {
    code: 'LG4002',
    message: 'Agent returned empty response',
    category: 'agent' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
    userFacingMessage: 'No pude generar una respuesta. ¿Puedes repetir tu pregunta?',
  },
  AGENT_HANDOFF_FAILED: {
    code: 'LG4003',
    message: 'Agent handoff failed',
    category: 'agent' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
    suggestedAction: 'Retry handoff or escalate',
  },
  AGENT_PROMPT_TOO_LONG: {
    code: 'LG4004',
    message: 'Agent prompt exceeded token limit',
    category: 'agent' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
    suggestedAction: 'Truncate context or use summarization',
  },

  // ======================
  // TOOL ERRORS (5xxx)
  // ======================
  TOOL_NOT_FOUND: {
    code: 'LG5001',
    message: 'Requested tool not available',
    category: 'tool' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: false,
  },
  TOOL_EXECUTION_FAILED: {
    code: 'LG5002',
    message: 'Tool execution failed',
    category: 'tool' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
    userFacingMessage: 'Hubo un problema al procesar tu solicitud. Déjame intentar de otra forma.',
  },
  TOOL_INVALID_INPUT: {
    code: 'LG5003',
    message: 'Invalid input provided to tool',
    category: 'tool' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'La información que proporcionaste no es válida. ¿Puedes verificarla?',
  },
  TOOL_RATE_LIMITED: {
    code: 'LG5004',
    message: 'Tool rate limit exceeded',
    category: 'tool' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
    suggestedAction: 'Wait and retry with exponential backoff',
  },
  TOOL_TIMEOUT: {
    code: 'LG5005',
    message: 'Tool execution timed out',
    category: 'tool' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
  },

  // ======================
  // LLM ERRORS (6xxx)
  // ======================
  LLM_API_ERROR: {
    code: 'LG6001',
    message: 'LLM API call failed',
    category: 'llm' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
    userFacingMessage: 'Estamos experimentando problemas técnicos. Por favor intenta en unos momentos.',
  },
  LLM_RATE_LIMITED: {
    code: 'LG6002',
    message: 'LLM rate limit exceeded',
    category: 'llm' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
    suggestedAction: 'Implement exponential backoff',
  },
  LLM_CONTEXT_TOO_LONG: {
    code: 'LG6003',
    message: 'Context exceeded LLM token limit',
    category: 'llm' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
    suggestedAction: 'Truncate or summarize context',
  },
  LLM_INVALID_RESPONSE: {
    code: 'LG6004',
    message: 'LLM returned invalid or unparseable response',
    category: 'llm' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
  },
  LLM_CONTENT_FILTER: {
    code: 'LG6005',
    message: 'LLM response blocked by content filter',
    category: 'llm' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'No puedo responder a esa solicitud. ¿Puedo ayudarte con algo más?',
  },

  // ======================
  // STATE ERRORS (7xxx)
  // ======================
  STATE_INVALID: {
    code: 'LG7001',
    message: 'Invalid state detected',
    category: 'state' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: false,
    suggestedAction: 'Reset state and restart conversation',
  },
  STATE_MERGE_FAILED: {
    code: 'LG7002',
    message: 'State merge operation failed',
    category: 'state' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
  },
  STATE_SERIALIZATION_FAILED: {
    code: 'LG7003',
    message: 'State serialization failed',
    category: 'state' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: false,
  },

  // ======================
  // CHECKPOINT ERRORS (8xxx)
  // ======================
  CHECKPOINT_SAVE_FAILED: {
    code: 'LG8001',
    message: 'Failed to save checkpoint',
    category: 'checkpoint' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
    suggestedAction: 'Continue without checkpoint, log for investigation',
  },
  CHECKPOINT_LOAD_FAILED: {
    code: 'LG8002',
    message: 'Failed to load checkpoint',
    category: 'checkpoint' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
    suggestedAction: 'Start fresh conversation',
  },
  CHECKPOINT_CORRUPTED: {
    code: 'LG8003',
    message: 'Checkpoint data is corrupted',
    category: 'checkpoint' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: false,
    suggestedAction: 'Delete checkpoint and start fresh',
  },

  // ======================
  // EXTERNAL ERRORS (9xxx)
  // ======================
  EXTERNAL_SERVICE_UNAVAILABLE: {
    code: 'LG9001',
    message: 'External service is unavailable',
    category: 'external' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
    userFacingMessage: 'Un servicio externo no está disponible. Por favor intenta más tarde.',
  },
  EXTERNAL_API_ERROR: {
    code: 'LG9002',
    message: 'External API returned an error',
    category: 'external' as ErrorCategory,
    severity: 'high' as ErrorSeverity,
    retryable: true,
  },
  EXTERNAL_TIMEOUT: {
    code: 'LG9003',
    message: 'External service timed out',
    category: 'external' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: true,
  },

  // ======================
  // BUSINESS LOGIC ERRORS (Axxx)
  // ======================
  BOOKING_SLOT_UNAVAILABLE: {
    code: 'LGA001',
    message: 'Requested booking slot is not available',
    category: 'business_logic' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Lo siento, ese horario ya no está disponible. ¿Te muestro otras opciones?',
  },
  BOOKING_INVALID_DATE: {
    code: 'LGA002',
    message: 'Invalid booking date',
    category: 'business_logic' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Esa fecha no es válida para citas. Por favor elige otra.',
  },
  BOOKING_OUTSIDE_HOURS: {
    code: 'LGA003',
    message: 'Booking requested outside business hours',
    category: 'business_logic' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Ese horario está fuera de nuestro horario de atención.',
  },
  ORDER_ITEM_UNAVAILABLE: {
    code: 'LGA004',
    message: 'Ordered item is not available',
    category: 'business_logic' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'Lo siento, ese producto no está disponible en este momento.',
  },
  SERVICE_NOT_FOUND: {
    code: 'LGA005',
    message: 'Requested service not found',
    category: 'business_logic' as ErrorCategory,
    severity: 'low' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'No encontré ese servicio. ¿Puedes verificar el nombre?',
  },
  BRANCH_NOT_FOUND: {
    code: 'LGA006',
    message: 'Requested branch not found',
    category: 'business_logic' as ErrorCategory,
    severity: 'medium' as ErrorSeverity,
    retryable: false,
    userFacingMessage: 'No encontré esa sucursal. ¿Puedes verificar el nombre?',
  },
} as const;

/**
 * Type for error code keys
 */
export type LangGraphErrorCode = keyof typeof LANGGRAPH_ERROR_CODES;

/**
 * Structured error class for LangGraph
 */
export class LangGraphError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly userFacingMessage?: string;
  readonly suggestedAction?: string;
  readonly context?: Record<string, unknown>;
  readonly timestamp: string;

  constructor(
    errorCode: LangGraphErrorCode,
    context?: Record<string, unknown>,
    originalError?: Error
  ) {
    const definition = LANGGRAPH_ERROR_CODES[errorCode];
    super(definition.message);

    this.name = 'LangGraphError';
    this.code = definition.code;
    this.category = definition.category;
    this.severity = definition.severity;
    this.retryable = definition.retryable;
    this.userFacingMessage = 'userFacingMessage' in definition
      ? definition.userFacingMessage as string
      : 'Ocurrió un error. Por favor intenta de nuevo.';
    this.suggestedAction = 'suggestedAction' in definition
      ? definition.suggestedAction as string
      : undefined;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Capture original error stack if provided
    if (originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      retryable: this.retryable,
      userFacingMessage: this.userFacingMessage,
      suggestedAction: this.suggestedAction,
      context: this.context,
      timestamp: this.timestamp,
    };
  }

  /**
   * Get user-facing message (for display to end users)
   */
  getUserMessage(): string {
    return this.userFacingMessage || 'Ocurrió un error. Por favor intenta de nuevo.';
  }
}

/**
 * Create a LangGraph error from an error code
 */
export function createLangGraphError(
  errorCode: LangGraphErrorCode,
  context?: Record<string, unknown>,
  originalError?: Error
): LangGraphError {
  return new LangGraphError(errorCode, context, originalError);
}

/**
 * Check if an error is a LangGraph error
 */
export function isLangGraphError(error: unknown): error is LangGraphError {
  return error instanceof LangGraphError;
}

/**
 * Get error code definition
 */
export function getErrorDefinition(
  errorCode: LangGraphErrorCode
): ErrorCodeDefinition {
  return LANGGRAPH_ERROR_CODES[errorCode];
}

/**
 * Wrap a function with error code conversion
 */
export async function withErrorCode<T>(
  fn: () => Promise<T>,
  errorCode: LangGraphErrorCode,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw createLangGraphError(
      errorCode,
      context,
      error instanceof Error ? error : undefined
    );
  }
}
