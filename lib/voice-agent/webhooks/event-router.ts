/**
 * TIS TIS Platform - Voice Agent v2.0
 * Webhook Event Router
 *
 * Routes incoming VAPI webhook events to the appropriate handlers.
 * Provides a centralized event dispatch mechanism with:
 * - Type-safe handler registration
 * - Default fallback handlers
 * - Event logging and metrics
 */

import type {
  VapiEventType,
  VapiWebhookPayload,
  VapiWebhookResponse,
  WebhookHandler,
  WebhookHandlerContext,
  HandlerResult,
  AckResponse,
  AssistantRequestPayload,
  ConversationUpdatePayload,
  FunctionCallPayload,
  EndOfCallPayload,
  TranscriptPayload,
  StatusUpdatePayload,
  SpeechUpdatePayload,
  ToolCallsPayload,
} from './types';
import {
  isValidVapiEventType,
  WebhookError,
} from './types';
import {
  unknownEventTypeError,
  handlerNotFoundError,
  handlerError,
} from './error-handler';
import { formatAckResponse } from './response-formatters';

// =====================================================
// EVENT ROUTER TYPES
// =====================================================

/**
 * Handler map for each event type
 */
export interface EventHandlerMap {
  'assistant-request'?: WebhookHandler<AssistantRequestPayload>;
  'conversation-update'?: WebhookHandler<ConversationUpdatePayload>;
  'function-call'?: WebhookHandler<FunctionCallPayload>;
  'tool-calls'?: WebhookHandler<ToolCallsPayload>;
  'end-of-call-report'?: WebhookHandler<EndOfCallPayload>;
  'transcript'?: WebhookHandler<TranscriptPayload>;
  'status-update'?: WebhookHandler<StatusUpdatePayload>;
  'speech-update'?: WebhookHandler<SpeechUpdatePayload>;
  'hang'?: WebhookHandler;
  'transfer-destination-request'?: WebhookHandler;
}

/**
 * Event router configuration
 */
export interface EventRouterConfig {
  /** Whether to log all events */
  logEvents?: boolean;

  /** Whether to allow unknown event types (returns ack instead of error) */
  allowUnknownEvents?: boolean;

  /** Default handler for unregistered event types */
  defaultHandler?: WebhookHandler;

  /** Callback for event metrics */
  onEventProcessed?: (
    eventType: VapiEventType,
    processingTimeMs: number,
    success: boolean
  ) => void;
}

/**
 * Default router configuration
 */
export const DEFAULT_ROUTER_CONFIG: EventRouterConfig = {
  logEvents: true,
  allowUnknownEvents: true,
};

// =====================================================
// EVENT ROUTER CLASS
// =====================================================

/**
 * Webhook Event Router
 *
 * Routes VAPI webhook events to registered handlers.
 * Provides type safety and consistent error handling.
 */
export class WebhookEventRouter {
  private readonly handlers: EventHandlerMap;
  private readonly config: EventRouterConfig;

  constructor(
    handlers: EventHandlerMap = {},
    config: EventRouterConfig = DEFAULT_ROUTER_CONFIG
  ) {
    this.handlers = handlers;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  /**
   * Route an event to the appropriate handler
   */
  async route(
    payload: VapiWebhookPayload,
    context: WebhookHandlerContext
  ): Promise<HandlerResult<VapiWebhookResponse>> {
    const startTime = Date.now();
    const eventType = payload.type;

    // Log event if enabled
    if (this.config.logEvents) {
      this.logEvent(eventType, payload, context);
    }

    try {
      // Validate event type
      if (!isValidVapiEventType(eventType)) {
        if (this.config.allowUnknownEvents) {
          return this.createAckResult(context, eventType);
        }
        throw unknownEventTypeError(eventType);
      }

      // Get handler for this event type
      const handler = this.getHandler(eventType);

      if (!handler) {
        // Use default handler if available
        if (this.config.defaultHandler) {
          return await this.executeHandler(
            this.config.defaultHandler,
            payload,
            context,
            eventType
          );
        }

        // If no handler and unknown events allowed, return ack
        if (this.config.allowUnknownEvents) {
          return this.createAckResult(context, eventType);
        }

        throw handlerNotFoundError(eventType);
      }

      // Execute the handler
      const result = await this.executeHandler(handler, payload, context, eventType);

      // Report metrics
      this.reportMetrics(eventType, startTime, true);

      return result;
    } catch (error) {
      // Report metrics
      this.reportMetrics(eventType, startTime, false);

      // Re-throw if already a WebhookError
      if (error instanceof WebhookError) {
        throw error;
      }

      // Wrap in handler error
      throw handlerError(eventType, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Register a handler for an event type
   */
  registerHandler<T extends VapiEventType>(
    eventType: T,
    handler: EventHandlerMap[T]
  ): void {
    (this.handlers as Record<string, unknown>)[eventType] = handler;
  }

  /**
   * Unregister a handler for an event type
   */
  unregisterHandler(eventType: VapiEventType): void {
    delete this.handlers[eventType];
  }

  /**
   * Check if a handler is registered for an event type
   */
  hasHandler(eventType: VapiEventType): boolean {
    return eventType in this.handlers && this.handlers[eventType] !== undefined;
  }

  /**
   * Get all registered event types
   */
  getRegisteredEventTypes(): VapiEventType[] {
    return Object.keys(this.handlers).filter(
      (key) => this.handlers[key as VapiEventType] !== undefined
    ) as VapiEventType[];
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  /**
   * Get handler for event type
   */
  private getHandler(eventType: VapiEventType): WebhookHandler | undefined {
    return this.handlers[eventType] as WebhookHandler | undefined;
  }

  /**
   * Execute a handler with error handling
   */
  private async executeHandler(
    handler: WebhookHandler,
    payload: VapiWebhookPayload,
    context: WebhookHandlerContext,
    eventType: string
  ): Promise<HandlerResult<VapiWebhookResponse>> {
    try {
      return await handler(payload, context);
    } catch (error) {
      console.error(
        `[Event Router] Handler error for ${eventType}:`,
        error instanceof Error ? error.message : error
      );
      throw error;
    }
  }

  /**
   * Create an acknowledgment result
   */
  private createAckResult(
    context: WebhookHandlerContext,
    eventType: string
  ): HandlerResult<AckResponse> {
    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: false,
      metadata: {
        eventType,
        requestId: context.requestId,
        processingTimeMs: Date.now() - context.startTime,
      },
    };
  }

  /**
   * Log incoming event
   */
  private logEvent(
    eventType: string,
    payload: VapiWebhookPayload,
    context: WebhookHandlerContext
  ): void {
    const callId = payload.call?.id || 'unknown';

    console.log(
      `[Event Router] Received event: ${eventType}`,
      JSON.stringify({
        requestId: context.requestId,
        callId,
        tenantId: context.tenantId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Report event processing metrics
   */
  private reportMetrics(
    eventType: string,
    startTime: number,
    success: boolean
  ): void {
    const processingTimeMs = Date.now() - startTime;

    if (this.config.onEventProcessed && isValidVapiEventType(eventType)) {
      this.config.onEventProcessed(eventType, processingTimeMs, success);
    }
  }
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Create a new event router with handlers
 */
export function createEventRouter(
  handlers: EventHandlerMap,
  config?: EventRouterConfig
): WebhookEventRouter {
  return new WebhookEventRouter(handlers, config);
}

/**
 * Create an event router with default logging handlers
 * Useful for development and testing
 */
export function createLoggingRouter(): WebhookEventRouter {
  const loggingHandler: WebhookHandler = async (payload, context) => {
    console.log(
      `[Logging Router] Event: ${payload.type}`,
      JSON.stringify({
        callId: payload.call?.id,
        requestId: context.requestId,
        payload: process.env.NODE_ENV === 'development' ? payload : '[hidden]',
      })
    );

    return {
      response: formatAckResponse(),
      statusCode: 200,
      shouldLog: true,
    };
  };

  return new WebhookEventRouter(
    {
      'assistant-request': loggingHandler as WebhookHandler<AssistantRequestPayload>,
      'conversation-update': loggingHandler as WebhookHandler<ConversationUpdatePayload>,
      'function-call': loggingHandler as WebhookHandler<FunctionCallPayload>,
      'tool-calls': loggingHandler as WebhookHandler<ToolCallsPayload>,
      'end-of-call-report': loggingHandler as WebhookHandler<EndOfCallPayload>,
      'transcript': loggingHandler as WebhookHandler<TranscriptPayload>,
      'status-update': loggingHandler as WebhookHandler<StatusUpdatePayload>,
      'speech-update': loggingHandler as WebhookHandler<SpeechUpdatePayload>,
    },
    { logEvents: true }
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get priority for event type (for potential prioritization)
 */
export function getEventPriority(eventType: VapiEventType): number {
  const priorities: Record<VapiEventType, number> = {
    'assistant-request': 100, // Highest - must respond quickly
    'conversation-update': 90, // High - user waiting for response
    'function-call': 80, // High - user waiting for result
    'tool-calls': 80, // High - user waiting for result
    'status-update': 50, // Medium
    'transcript': 40, // Medium-low - informational
    'speech-update': 30, // Low - informational
    'end-of-call-report': 20, // Low - can be processed async
    'hang': 10, // Low
    'transfer-destination-request': 70, // High - affects call flow
  };

  return priorities[eventType] ?? 0;
}

/**
 * Check if event type requires synchronous processing
 */
export function requiresSyncProcessing(eventType: VapiEventType): boolean {
  const syncEvents: VapiEventType[] = [
    'assistant-request',
    'conversation-update',
    'function-call',
    'tool-calls',
    'transfer-destination-request',
  ];

  return syncEvents.includes(eventType);
}

/**
 * Check if event type is informational (can be fire-and-forget)
 */
export function isInformationalEvent(eventType: VapiEventType): boolean {
  const informationalEvents: VapiEventType[] = [
    'transcript',
    'status-update',
    'speech-update',
    'hang',
    'end-of-call-report',
  ];

  return informationalEvents.includes(eventType);
}
