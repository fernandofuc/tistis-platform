/**
 * TIS TIS Platform - Voice Agent v2.0
 * Circuit Breaker Store (Supabase Implementation)
 *
 * Persists circuit breaker state to Supabase for durability
 * across restarts and horizontal scaling.
 *
 * Features:
 * - In-memory cache to reduce database queries
 * - Automatic state initialization
 * - Support for multiple services per business
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  CircuitBreakerStore,
  CircuitBreakerStoreState,
  CircuitBreakerState,
} from './types';
import { INITIAL_CIRCUIT_BREAKER_STATE } from './types';

// =====================================================
// TYPES
// =====================================================

/**
 * Database row structure matching the migration
 * NOTE: TIS TIS uses tenant_id only, no business_id column exists
 */
interface CircuitBreakerRow {
  id: string;
  tenant_id: string;
  service_name: string;
  state: CircuitBreakerState;
  failure_count: number;
  success_count: number;
  consecutive_failures: number;
  consecutive_successes: number;
  failure_threshold: number;
  success_threshold: number;
  timeout_seconds: number;
  last_failure_time: string | null;
  last_success_time: string | null;
  last_state_change: string;
  opened_at: string | null;
  half_opened_at: string | null;
  last_error_message: string | null;
  last_error_code: string | null;
  window_start: string;
  window_failure_count: number;
  window_success_count: number;
  window_total_count: number;
  updated_at: string;
  created_at: string;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  state: CircuitBreakerStoreState;
  expiresAt: number;
}

/**
 * Store configuration
 */
export interface CircuitBreakerStoreConfig {
  /** Service name to monitor */
  serviceName: string;

  /** Tenant ID for multi-tenancy */
  tenantId: string;

  /** Cache TTL in milliseconds */
  cacheTtlMs: number;

  /** Supabase URL (optional, uses env if not provided) */
  supabaseUrl?: string;

  /** Supabase key (optional, uses env if not provided) */
  supabaseKey?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const TABLE_NAME = 'voice_circuit_breaker_state';
const DEFAULT_CACHE_TTL = 5_000; // 5 seconds
const DEFAULT_SERVICE_NAME = 'voice_agent';

// =====================================================
// SUPABASE CIRCUIT BREAKER STORE
// =====================================================

export class SupabaseCircuitBreakerStore implements CircuitBreakerStore {
  private readonly supabase: SupabaseClient;
  private readonly serviceName: string;
  private readonly tenantId: string;
  private readonly cacheTtlMs: number;
  private readonly cache: Map<string, CacheEntry>;

  constructor(config: Partial<CircuitBreakerStoreConfig> = {}) {
    // Initialize Supabase client
    const supabaseUrl =
      config.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      config.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase URL and key are required for CircuitBreakerStore'
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.serviceName = config.serviceName ?? DEFAULT_SERVICE_NAME;
    this.tenantId = config.tenantId ?? '';
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL;
    this.cache = new Map();
  }

  // =====================================================
  // PUBLIC METHODS
  // =====================================================

  /**
   * Get current state for a business
   */
  async getState(tenantId: string): Promise<CircuitBreakerStoreState> {
    // Check cache first
    const cached = this.getFromCache(tenantId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('service_name', this.serviceName)
      .single();

    if (error) {
      // If no record exists, create initial state
      if (error.code === 'PGRST116') {
        const initialState = await this.createInitialState(tenantId);
        this.setInCache(tenantId, initialState);
        return initialState;
      }
      throw new Error(`Failed to get circuit breaker state: ${error.message}`);
    }

    const state = this.rowToState(data as CircuitBreakerRow);
    this.setInCache(tenantId, state);
    return state;
  }

  /**
   * Set state for a business
   */
  async setState(
    tenantId: string,
    state: CircuitBreakerStoreState
  ): Promise<void> {
    const updateData = this.stateToRow(state);

    const { error } = await this.supabase
      .from(TABLE_NAME)
      .update(updateData)
      .eq('tenant_id', tenantId)
      .eq('service_name', this.serviceName);

    if (error) {
      // If record doesn't exist, insert it
      if (error.code === 'PGRST116' || error.message.includes('0 rows')) {
        await this.createInitialState(tenantId, state);
      } else {
        throw new Error(
          `Failed to set circuit breaker state: ${error.message}`
        );
      }
    }

    // Update cache
    this.setInCache(tenantId, state);
  }

  /**
   * Delete state for a business (for testing/reset)
   */
  async deleteState(tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE_NAME)
      .delete()
      .eq('tenant_id', tenantId)
      .eq('service_name', this.serviceName);

    if (error) {
      throw new Error(
        `Failed to delete circuit breaker state: ${error.message}`
      );
    }

    // Remove from cache
    this.cache.delete(this.getCacheKey(tenantId));
  }

  /**
   * Get all circuit breaker states (for monitoring)
   */
  async getAllStates(): Promise<Map<string, CircuitBreakerStoreState>> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('service_name', this.serviceName);

    if (error) {
      throw new Error(
        `Failed to get all circuit breaker states: ${error.message}`
      );
    }

    const states = new Map<string, CircuitBreakerStoreState>();
    for (const row of data as CircuitBreakerRow[]) {
      states.set(row.tenant_id, this.rowToState(row));
    }

    return states;
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for real rate
    };
  }

  // =====================================================
  // PRIVATE METHODS
  // =====================================================

  /**
   * Create initial state in database
   */
  private async createInitialState(
    tenantId: string,
    initialState?: CircuitBreakerStoreState
  ): Promise<CircuitBreakerStoreState> {
    const state = initialState ?? {
      ...INITIAL_CIRCUIT_BREAKER_STATE,
      lastStateChange: new Date().toISOString(),
    };

    const insertData = {
      tenant_id: this.tenantId || tenantId, // Use config tenantId or parameter as fallback
      service_name: this.serviceName,
      state: state.state,
      failure_count: state.failureCount,
      success_count: state.successCount,
      consecutive_failures: state.failureCount,
      consecutive_successes: state.successCount,
      last_failure_time: state.lastFailureAt,
      last_state_change: state.lastStateChange,
      opened_at: state.openedAt,
      last_error_message: state.lastError,
      window_total_count: state.totalExecutions,
    };

    const { error } = await this.supabase
      .from(TABLE_NAME)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // If duplicate, just fetch existing
      if (error.code === '23505') {
        return this.getState(tenantId);
      }
      throw new Error(
        `Failed to create initial circuit breaker state: ${error.message}`
      );
    }

    return state;
  }

  /**
   * Convert database row to store state
   */
  private rowToState(row: CircuitBreakerRow): CircuitBreakerStoreState {
    return {
      state: row.state,
      failureCount: row.consecutive_failures,
      successCount: row.consecutive_successes,
      openedAt: row.opened_at,
      lastFailureAt: row.last_failure_time,
      lastError: row.last_error_message,
      totalExecutions: row.window_total_count,
      lastStateChange: row.last_state_change,
    };
  }

  /**
   * Convert store state to database row update
   */
  private stateToRow(
    state: CircuitBreakerStoreState
  ): Partial<CircuitBreakerRow> {
    return {
      state: state.state,
      consecutive_failures: state.failureCount,
      consecutive_successes: state.successCount,
      opened_at: state.openedAt,
      last_failure_time: state.lastFailureAt,
      last_error_message: state.lastError,
      window_total_count: state.totalExecutions,
      last_state_change: state.lastStateChange,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get cache key for a business
   */
  private getCacheKey(tenantId: string): string {
    return `${this.serviceName}:${tenantId}`;
  }

  /**
   * Get state from cache if valid
   */
  private getFromCache(tenantId: string): CircuitBreakerStoreState | null {
    const key = this.getCacheKey(tenantId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.state;
  }

  /**
   * Set state in cache
   */
  private setInCache(
    tenantId: string,
    state: CircuitBreakerStoreState
  ): void {
    const key = this.getCacheKey(tenantId);
    this.cache.set(key, {
      state,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }
}

// =====================================================
// IN-MEMORY STORE (For Testing)
// =====================================================

/**
 * In-memory implementation for testing
 */
export class InMemoryCircuitBreakerStore implements CircuitBreakerStore {
  private readonly states: Map<string, CircuitBreakerStoreState>;

  constructor() {
    this.states = new Map();
  }

  async getState(tenantId: string): Promise<CircuitBreakerStoreState> {
    const state = this.states.get(tenantId);
    if (state) {
      return { ...state };
    }

    const initialState = {
      ...INITIAL_CIRCUIT_BREAKER_STATE,
      lastStateChange: new Date().toISOString(),
    };
    this.states.set(tenantId, initialState);
    return initialState;
  }

  async setState(
    tenantId: string,
    state: CircuitBreakerStoreState
  ): Promise<void> {
    this.states.set(tenantId, { ...state });
  }

  async deleteState(tenantId: string): Promise<void> {
    this.states.delete(tenantId);
  }

  async getAllStates(): Promise<Map<string, CircuitBreakerStoreState>> {
    return new Map(this.states);
  }

  /**
   * Clear all states (for testing)
   */
  clear(): void {
    this.states.clear();
  }

  /**
   * Get number of stored states
   */
  size(): number {
    return this.states.size;
  }
}

// =====================================================
// FACTORY FUNCTION
// =====================================================

/**
 * Create a circuit breaker store
 * Uses in-memory store in test environment, Supabase otherwise
 */
export function createCircuitBreakerStore(
  config?: Partial<CircuitBreakerStoreConfig>
): CircuitBreakerStore {
  if (process.env.NODE_ENV === 'test') {
    return new InMemoryCircuitBreakerStore();
  }

  return new SupabaseCircuitBreakerStore(config);
}
