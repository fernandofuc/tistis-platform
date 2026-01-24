// =====================================================
// TIS TIS PLATFORM - ONLINE STORE SERVICE
// Low-latency feature storage for real-time inference
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { FeatureDefinition } from '../types';
import { featureDefinitionService } from './feature-definition.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type EntityType = FeatureDefinition['entityType'];

interface OnlineFeature {
  featureId: string;
  featureName: string;
  value: unknown;
  updatedAt: Date;
  version: number;
}

interface UpsertParams {
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  featureId: string;
  value: unknown;
  ttlSeconds?: number;
}

// In-memory cache for ultra-low latency
interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export class OnlineStoreService {
  private supabase;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_CACHE_TTL_MS = 60000; // 1 minute
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.startCacheCleanup();
  }

  /**
   * Upsert a feature value (update if exists, insert if not)
   */
  async upsert(params: UpsertParams): Promise<void> {
    const expiresAt = params.ttlSeconds
      ? new Date(Date.now() + params.ttlSeconds * 1000).toISOString()
      : null;

    // Determine value type and set appropriate column
    const valueColumns = this.getValueColumns(params.value);

    const { error } = await this.supabase.from('ai_feature_values_online').upsert(
      {
        tenant_id: params.tenantId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        feature_name: params.featureId, // SQL uses feature_name, not feature_id
        ...valueColumns,
        expires_at: expiresAt,
      },
      {
        onConflict: 'tenant_id,feature_name,entity_type,entity_id',
      }
    );

    if (error) {
      console.error('[OnlineStoreService] Error upserting feature:', error);
      throw new Error(`Failed to upsert feature: ${error.message}`);
    }

    // Update cache
    const cacheKey = this.getCacheKey(params.tenantId, params.entityType, params.entityId, params.featureId);
    this.cache.set(cacheKey, {
      value: params.value,
      expiresAt: params.ttlSeconds ? Date.now() + params.ttlSeconds * 1000 : Date.now() + this.DEFAULT_CACHE_TTL_MS,
    });
  }

  /**
   * Upsert multiple features for an entity
   */
  async upsertBatch(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    features: Array<{ featureId: string; value: unknown }>,
    ttlSeconds?: number
  ): Promise<void> {
    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000).toISOString()
      : null;

    const records = features.map((f) => ({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      feature_name: f.featureId, // SQL uses feature_name, not feature_id
      ...this.getValueColumns(f.value),
      expires_at: expiresAt,
    }));

    const { error } = await this.supabase.from('ai_feature_values_online').upsert(records, {
      onConflict: 'tenant_id,feature_name,entity_type,entity_id',
    });

    if (error) {
      console.error('[OnlineStoreService] Error upserting batch:', error);
      throw new Error(`Failed to upsert batch: ${error.message}`);
    }

    // Update cache
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : Date.now() + this.DEFAULT_CACHE_TTL_MS;
    for (const f of features) {
      const cacheKey = this.getCacheKey(tenantId, entityType, entityId, f.featureId);
      this.cache.set(cacheKey, { value: f.value, expiresAt: expiry });
    }
  }

  /**
   * Get a single feature value (with cache)
   */
  async get(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureId: string
  ): Promise<OnlineFeature | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(tenantId, entityType, entityId, featureId);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      const definition = await featureDefinitionService.getFeature(featureId);
      return {
        featureId,
        featureName: definition?.name || featureId,
        value: cached.value,
        updatedAt: new Date(),
        version: 0,
      };
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from('ai_feature_values_online')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('feature_name', featureId) // SQL uses feature_name
      .single();

    if (error || !data) return null;

    // Check TTL
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Expired - delete and return null
      await this.delete(tenantId, entityType, entityId, featureId);
      return null;
    }

    // Get the value from typed columns
    const value = this.extractValue(data);

    // Update cache
    this.cache.set(cacheKey, {
      value,
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + this.DEFAULT_CACHE_TTL_MS,
    });

    const definition = await featureDefinitionService.getFeature(featureId);

    return {
      featureId: data.feature_name, // SQL uses feature_name
      featureName: definition?.name || data.feature_name,
      value,
      updatedAt: new Date(data.computed_at),
      version: 0, // SQL table doesn't have version column
    };
  }

  /**
   * Get multiple features for an entity (optimized batch)
   */
  async getMany(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureIds: string[]
  ): Promise<OnlineFeature[]> {
    const results: OnlineFeature[] = [];
    const toFetch: string[] = [];

    // Check cache for each
    for (const featureId of featureIds) {
      const cacheKey = this.getCacheKey(tenantId, entityType, entityId, featureId);
      const cached = this.cache.get(cacheKey);

      if (cached && cached.expiresAt > Date.now()) {
        results.push({
          featureId,
          featureName: featureId, // Will be enriched below
          value: cached.value,
          updatedAt: new Date(),
          version: 0,
        });
      } else {
        toFetch.push(featureId);
      }
    }

    // Fetch missing from database
    if (toFetch.length > 0) {
      const { data } = await this.supabase
        .from('ai_feature_values_online')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .in('feature_name', toFetch); // SQL uses feature_name

      for (const row of data || []) {
        // Skip expired
        if (row.expires_at && new Date(row.expires_at) < new Date()) continue;

        const value = this.extractValue(row);

        results.push({
          featureId: row.feature_name, // SQL uses feature_name
          featureName: row.feature_name, // Will be enriched below
          value,
          updatedAt: new Date(row.computed_at),
          version: 0,
        });

        // Update cache
        const cacheKey = this.getCacheKey(tenantId, entityType, entityId, row.feature_name);
        this.cache.set(cacheKey, {
          value,
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : Date.now() + this.DEFAULT_CACHE_TTL_MS,
        });
      }
    }

    // Enrich with feature names
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const nameMap = new Map(definitions.map((d) => [d.id, d.name]));

    for (const result of results) {
      result.featureName = nameMap.get(result.featureId) || result.featureId;
    }

    return results;
  }

  /**
   * Get all features for an entity
   */
  async getAllForEntity(
    tenantId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<OnlineFeature[]> {
    const { data, error } = await this.supabase
      .from('ai_feature_values_online')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      console.error('[OnlineStoreService] Error reading features:', error);
      return [];
    }

    const now = new Date();
    const results: OnlineFeature[] = [];

    for (const row of data || []) {
      // Skip expired
      if (row.expires_at && new Date(row.expires_at) < now) continue;

      results.push({
        featureId: row.feature_name, // SQL uses feature_name
        featureName: row.feature_name,
        value: this.extractValue(row),
        updatedAt: new Date(row.computed_at),
        version: 0,
      });
    }

    // Enrich with feature names
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const nameMap = new Map(definitions.map((d) => [d.id, d.name]));

    for (const result of results) {
      result.featureName = nameMap.get(result.featureId) || result.featureId;
    }

    return results;
  }

  /**
   * Delete a feature value
   */
  async delete(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureId: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ai_feature_values_online')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('feature_name', featureId); // SQL uses feature_name

    if (error) {
      console.error('[OnlineStoreService] Error deleting feature:', error);
    }

    // Remove from cache
    const cacheKey = this.getCacheKey(tenantId, entityType, entityId, featureId);
    this.cache.delete(cacheKey);
  }

  /**
   * Delete all features for an entity
   */
  async deleteEntity(tenantId: string, entityType: EntityType, entityId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_feature_values_online')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      console.error('[OnlineStoreService] Error deleting entity features:', error);
    }

    // Clear cache entries for this entity
    const prefix = `${tenantId}:${entityType}:${entityId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean up expired features
   */
  async cleanupExpired(tenantId?: string): Promise<number> {
    // First count expired records
    let countQuery = this.supabase
      .from('ai_feature_values_online')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null);

    if (tenantId) {
      countQuery = countQuery.eq('tenant_id', tenantId);
    }

    const { count: recordCount } = await countQuery;

    // Then delete
    let deleteQuery = this.supabase
      .from('ai_feature_values_online')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .not('expires_at', 'is', null);

    if (tenantId) {
      deleteQuery = deleteQuery.eq('tenant_id', tenantId);
    }

    const { error } = await deleteQuery;

    if (error) {
      console.error('[OnlineStoreService] Cleanup error:', error);
      return 0;
    }

    return recordCount || 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for real implementation
    };
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Stop background tasks
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Private helpers

  private getCacheKey(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureId: string
  ): string {
    return `${tenantId}:${entityType}:${entityId}:${featureId}`;
  }

  /**
   * Determine which value columns to set based on value type
   * SQL table has: value_int, value_float, value_string, value_bool, value_json
   */
  private getValueColumns(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) {
      return { value_json: null };
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { value_int: value };
      }
      return { value_float: value };
    }
    if (typeof value === 'boolean') {
      return { value_bool: value };
    }
    if (typeof value === 'string') {
      return { value_string: value };
    }
    // Objects and arrays go to JSON
    return { value_json: value };
  }

  /**
   * Extract value from typed columns
   */
  private extractValue(row: Record<string, unknown>): unknown {
    if (row.value_int !== null && row.value_int !== undefined) return row.value_int;
    if (row.value_float !== null && row.value_float !== undefined) return row.value_float;
    if (row.value_bool !== null && row.value_bool !== undefined) return row.value_bool;
    if (row.value_string !== null && row.value_string !== undefined) return row.value_string;
    if (row.value_json !== null && row.value_json !== undefined) return row.value_json;
    return null;
  }

  private startCacheCleanup(): void {
    // Clean expired cache entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }
}

// Export singleton instance
export const onlineStoreService = new OnlineStoreService();
