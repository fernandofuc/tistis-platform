// =====================================================
// TIS TIS PLATFORM - Event Bus Service
// Sistema de eventos para comunicación entre features
// Used by: Setup Assistant, Chat AI, Voice Agent
// FASE 10: Event-driven updates
// =====================================================

import { EventEmitter } from 'events';

// =====================================================
// EVENT TYPES
// =====================================================

export type TenantEventType =
  | 'tenant.config.updated'
  | 'tenant.services.updated'
  | 'tenant.branches.updated'
  | 'tenant.faqs.updated'
  | 'tenant.knowledge.updated'
  | 'tenant.ai_config.updated'
  | 'tenant.prompt.regenerated'
  | 'tenant.cache.invalidated';

export type VoiceEventType =
  | 'voice.call.started'
  | 'voice.call.ended'
  | 'voice.usage.updated'
  | 'voice.limit.exceeded'
  | 'voice.policy.updated';

export type SetupEventType =
  | 'setup.conversation.started'
  | 'setup.conversation.completed'
  | 'setup.image.analyzed'
  | 'setup.data.imported';

export type SystemEventType =
  | 'system.cache.cleared'
  | 'system.maintenance.started'
  | 'system.maintenance.ended';

export type EventType =
  | TenantEventType
  | VoiceEventType
  | SetupEventType
  | SystemEventType;

// =====================================================
// EVENT PAYLOADS
// =====================================================

export interface TenantConfigUpdatedPayload {
  tenantId: string;
  updatedFields: string[];
  source: 'setup_assistant' | 'dashboard' | 'api' | 'webhook';
  timestamp: Date;
}

export interface VoiceCallPayload {
  tenantId: string;
  callId: string;
  duration?: number;
  outcome?: string;
  minutesUsed?: number;
  isOverage?: boolean;
  timestamp: Date;
}

export interface VoiceUsagePayload {
  tenantId: string;
  totalMinutesUsed: number;
  includedMinutes: number;
  usagePercent: number;
  isBlocked: boolean;
  timestamp: Date;
}

export interface SetupConversationPayload {
  tenantId: string;
  conversationId: string;
  itemsConfigured?: string[];
  timestamp: Date;
}

export interface CacheInvalidationPayload {
  tenantId: string;
  cacheTypes: ('business_context' | 'prompt' | 'vision' | 'all')[];
  reason: string;
  timestamp: Date;
}

export type EventPayload =
  | TenantConfigUpdatedPayload
  | VoiceCallPayload
  | VoiceUsagePayload
  | SetupConversationPayload
  | CacheInvalidationPayload
  | Record<string, unknown>;

// =====================================================
// EVENT INTERFACE
// =====================================================

export interface PlatformEvent<T extends EventPayload = EventPayload> {
  type: EventType;
  payload: T;
  metadata: {
    eventId: string;
    timestamp: Date;
    source: string;
    correlationId?: string;
  };
}

export type EventHandler<T extends EventPayload = EventPayload> = (
  event: PlatformEvent<T>
) => void | Promise<void>;

// =====================================================
// EVENT BUS CLASS
// =====================================================

class EventBusService {
  private static instance: EventBusService;
  private emitter: EventEmitter;
  private eventHistory: PlatformEvent[];
  private maxHistorySize: number = 100;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Allow more listeners
    this.eventHistory = [];
  }

  static getInstance(): EventBusService {
    if (!EventBusService.instance) {
      EventBusService.instance = new EventBusService();
    }
    return EventBusService.instance;
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T extends EventPayload>(
    type: EventType,
    payload: T,
    options: {
      source?: string;
      correlationId?: string;
    } = {}
  ): void {
    const event: PlatformEvent<T> = {
      type,
      payload,
      metadata: {
        eventId: this.generateEventId(),
        timestamp: new Date(),
        source: options.source || 'unknown',
        correlationId: options.correlationId,
      },
    };

    // Store in history
    this.addToHistory(event as PlatformEvent);

    // Log for debugging
    console.log(`[EventBus] Emitting: ${type}`, {
      eventId: event.metadata.eventId,
      source: event.metadata.source,
    });

    // Emit to all listeners
    this.emitter.emit(type, event);
    this.emitter.emit('*', event); // Wildcard for global listeners
  }

  /**
   * Subscribe to a specific event type
   */
  on<T extends EventPayload>(
    type: EventType | '*',
    handler: EventHandler<T>
  ): () => void {
    this.emitter.on(type, handler);

    // Return unsubscribe function
    return () => {
      this.emitter.off(type, handler);
    };
  }

  /**
   * Subscribe to an event type only once
   */
  once<T extends EventPayload>(
    type: EventType,
    handler: EventHandler<T>
  ): void {
    this.emitter.once(type, handler);
  }

  /**
   * Unsubscribe from an event type
   */
  off<T extends EventPayload>(
    type: EventType | '*',
    handler: EventHandler<T>
  ): void {
    this.emitter.off(type, handler);
  }

  /**
   * Get recent events from history
   */
  getRecentEvents(limit: number = 10): PlatformEvent[] {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by type from history
   */
  getEventsByType(type: EventType, limit: number = 10): PlatformEvent[] {
    return this.eventHistory
      .filter((e) => e.type === type)
      .slice(-limit);
  }

  /**
   * Get events for a specific tenant
   */
  getEventsForTenant(tenantId: string, limit: number = 10): PlatformEvent[] {
    return this.eventHistory
      .filter((e) => {
        const payload = e.payload as Record<string, unknown>;
        return payload.tenantId === tenantId;
      })
      .slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get listener count for a specific event type
   */
  listenerCount(type: EventType | '*'): number {
    return this.emitter.listenerCount(type);
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}_${random}`;
  }

  private addToHistory(event: PlatformEvent): void {
    this.eventHistory.push(event);

    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const eventBus = EventBusService.getInstance();

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Emit a tenant configuration updated event
 */
export function emitTenantConfigUpdated(
  tenantId: string,
  updatedFields: string[],
  source: TenantConfigUpdatedPayload['source'] = 'api'
): void {
  eventBus.emit<TenantConfigUpdatedPayload>(
    'tenant.config.updated',
    {
      tenantId,
      updatedFields,
      source,
      timestamp: new Date(),
    },
    { source }
  );
}

/**
 * Emit a cache invalidation event
 */
export function emitCacheInvalidation(
  tenantId: string,
  cacheTypes: CacheInvalidationPayload['cacheTypes'],
  reason: string
): void {
  eventBus.emit<CacheInvalidationPayload>(
    'tenant.cache.invalidated',
    {
      tenantId,
      cacheTypes,
      reason,
      timestamp: new Date(),
    },
    { source: 'cache_service' }
  );
}

/**
 * Emit a voice call ended event
 */
export function emitVoiceCallEnded(
  tenantId: string,
  callId: string,
  duration: number,
  minutesUsed: number,
  isOverage: boolean
): void {
  eventBus.emit<VoiceCallPayload>(
    'voice.call.ended',
    {
      tenantId,
      callId,
      duration,
      minutesUsed,
      isOverage,
      timestamp: new Date(),
    },
    { source: 'voice_agent' }
  );
}

/**
 * Emit a voice usage updated event
 */
export function emitVoiceUsageUpdated(
  tenantId: string,
  totalMinutesUsed: number,
  includedMinutes: number,
  isBlocked: boolean
): void {
  const usagePercent = includedMinutes > 0
    ? (totalMinutesUsed / includedMinutes) * 100
    : 0;

  eventBus.emit<VoiceUsagePayload>(
    'voice.usage.updated',
    {
      tenantId,
      totalMinutesUsed,
      includedMinutes,
      usagePercent,
      isBlocked,
      timestamp: new Date(),
    },
    { source: 'voice_agent' }
  );
}

/**
 * Emit a setup conversation completed event
 */
export function emitSetupCompleted(
  tenantId: string,
  conversationId: string,
  itemsConfigured: string[]
): void {
  eventBus.emit<SetupConversationPayload>(
    'setup.conversation.completed',
    {
      tenantId,
      conversationId,
      itemsConfigured,
      timestamp: new Date(),
    },
    { source: 'setup_assistant' }
  );
}

// =====================================================
// LISTENER HELPERS
// =====================================================

/**
 * Subscribe to tenant config changes for a specific tenant
 */
export function onTenantConfigChange(
  tenantId: string,
  handler: (payload: TenantConfigUpdatedPayload) => void
): () => void {
  return eventBus.on<TenantConfigUpdatedPayload>(
    'tenant.config.updated',
    (event) => {
      if (event.payload.tenantId === tenantId) {
        handler(event.payload);
      }
    }
  );
}

/**
 * Subscribe to cache invalidation events for a specific tenant
 */
export function onCacheInvalidation(
  tenantId: string,
  handler: (payload: CacheInvalidationPayload) => void
): () => void {
  return eventBus.on<CacheInvalidationPayload>(
    'tenant.cache.invalidated',
    (event) => {
      if (event.payload.tenantId === tenantId) {
        handler(event.payload);
      }
    }
  );
}

/**
 * Subscribe to voice usage updates for a specific tenant
 */
export function onVoiceUsageChange(
  tenantId: string,
  handler: (payload: VoiceUsagePayload) => void
): () => void {
  return eventBus.on<VoiceUsagePayload>(
    'voice.usage.updated',
    (event) => {
      if (event.payload.tenantId === tenantId) {
        handler(event.payload);
      }
    }
  );
}
