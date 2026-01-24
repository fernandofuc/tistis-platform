// =====================================================
// TIS TIS PLATFORM - OFFLINE STORE SERVICE
// Historical feature storage for batch processing & training
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { FeatureDefinition } from '../types';
import { featureDefinitionService } from './feature-definition.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type EntityType = FeatureDefinition['entityType'];

interface FeatureValue {
  featureId: string;
  featureName: string;
  value: unknown;
  computedAt: Date;
}

interface WriteParams {
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  featureId: string;
  value: unknown;
  eventTime?: Date;
  metadata?: Record<string, unknown>;
}

interface QueryParams {
  tenantId: string;
  entityType: EntityType;
  entityId: string;
  featureIds?: string[];
  pointInTime?: Date;
  startTime?: Date;
  endTime?: Date;
}

interface FeatureVector {
  entityId: string;
  features: Record<string, unknown>;
  timestamp: Date;
}

export class OfflineStoreService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Write a single feature value
   */
  async write(params: WriteParams): Promise<void> {
    // Validate value against feature definition
    const validation = await featureDefinitionService.validateValue(params.featureId, params.value);
    if (!validation.valid) {
      throw new Error(`Invalid feature value: ${validation.errors.join(', ')}`);
    }

    // Get the feature definition to get the name
    const definition = await featureDefinitionService.getFeature(params.featureId);

    const { error } = await this.supabase.from('ai_feature_values_offline').insert({
      tenant_id: params.tenantId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      feature_id: params.featureId, // UUID reference
      feature_name: definition?.name || params.featureId, // Denormalized name
      ...this.getValueColumns(params.value),
      event_timestamp: params.eventTime?.toISOString() || new Date().toISOString(),
      metadata: params.metadata || {},
    });

    if (error) {
      console.error('[OfflineStoreService] Error writing feature:', error);
      throw new Error(`Failed to write feature: ${error.message}`);
    }
  }

  /**
   * Write multiple feature values in batch
   */
  async writeBatch(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    features: Array<{ featureId: string; value: unknown }>,
    eventTime?: Date
  ): Promise<void> {
    const timestamp = eventTime?.toISOString() || new Date().toISOString();

    // Get feature definitions to get names
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const nameMap = new Map(definitions.map((d) => [d.id, d.name]));

    const records = features.map((f) => ({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      feature_id: f.featureId, // UUID reference
      feature_name: nameMap.get(f.featureId) || f.featureId, // Denormalized name
      ...this.getValueColumns(f.value),
      event_timestamp: timestamp,
    }));

    const { error } = await this.supabase.from('ai_feature_values_offline').insert(records);

    if (error) {
      console.error('[OfflineStoreService] Error writing batch:', error);
      throw new Error(`Failed to write batch: ${error.message}`);
    }
  }

  /**
   * Get latest feature values for an entity
   */
  async getLatest(params: QueryParams): Promise<FeatureValue[]> {
    const { tenantId, entityType, entityId, featureIds, pointInTime } = params;

    // Get feature definitions
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const featureMap = new Map(definitions.map((d) => [d.id, d]));

    // Build query - select typed value columns
    let query = this.supabase
      .from('ai_feature_values_offline')
      .select('feature_id, feature_name, value_int, value_float, value_string, value_bool, value_json, event_timestamp')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (featureIds && featureIds.length > 0) {
      query = query.in('feature_id', featureIds);
    }

    if (pointInTime) {
      query = query.lte('event_timestamp', pointInTime.toISOString());
    }

    query = query.order('event_timestamp', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[OfflineStoreService] Error reading features:', error);
      return [];
    }

    // Deduplicate to get only latest per feature
    const latestByFeature = new Map<string, { value: unknown; time: Date; name: string }>();

    for (const row of data || []) {
      if (!latestByFeature.has(row.feature_id)) {
        latestByFeature.set(row.feature_id, {
          value: this.extractValue(row),
          time: new Date(row.event_timestamp),
          name: row.feature_name,
        });
      }
    }

    // Map to result
    const results: FeatureValue[] = [];
    for (const [featureId, rowData] of latestByFeature) {
      const definition = featureMap.get(featureId);
      results.push({
        featureId,
        featureName: definition?.name || rowData.name || featureId,
        value: rowData.value,
        computedAt: rowData.time,
      });
    }

    return results;
  }

  /**
   * Get feature history for an entity
   */
  async getHistory(params: QueryParams): Promise<Array<{ timestamp: Date; features: Record<string, unknown> }>> {
    const { tenantId, entityType, entityId, featureIds, startTime, endTime } = params;

    let query = this.supabase
      .from('ai_feature_values_offline')
      .select('feature_id, feature_name, value_int, value_float, value_string, value_bool, value_json, event_timestamp')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('event_timestamp', { ascending: true });

    if (featureIds && featureIds.length > 0) {
      query = query.in('feature_id', featureIds);
    }
    if (startTime) {
      query = query.gte('event_timestamp', startTime.toISOString());
    }
    if (endTime) {
      query = query.lt('event_timestamp', endTime.toISOString());
    }

    const { data, error } = await query.limit(10000);

    if (error) {
      console.error('[OfflineStoreService] Error reading history:', error);
      return [];
    }

    // Get feature names
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const nameMap = new Map(definitions.map((d) => [d.id, d.name]));

    // Group by timestamp
    const byTimestamp = new Map<string, Record<string, unknown>>();

    for (const row of data || []) {
      const key = row.event_timestamp;
      const existing = byTimestamp.get(key) || {};
      const featureName = nameMap.get(row.feature_id) || row.feature_name || row.feature_id;
      existing[featureName] = this.extractValue(row);
      byTimestamp.set(key, existing);
    }

    return Array.from(byTimestamp.entries()).map(([ts, features]) => ({
      timestamp: new Date(ts),
      features,
    }));
  }

  /**
   * Generate point-in-time feature vectors for training
   */
  async getTrainingData(
    tenantId: string,
    entityType: EntityType,
    entityIds: string[],
    featureIds: string[],
    pointInTime: Date
  ): Promise<FeatureVector[]> {
    const results: FeatureVector[] = [];

    // Get feature names
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const nameMap = new Map(definitions.map((d) => [d.id, d.name]));
    const defaultMap = new Map(definitions.map((d) => [d.id, d.defaultValue]));

    for (const entityId of entityIds) {
      const latestValues = await this.getLatest({
        tenantId,
        entityType,
        entityId,
        featureIds,
        pointInTime,
      });

      // Build feature record with defaults
      const features: Record<string, unknown> = {};

      for (const featureId of featureIds) {
        const featureName = nameMap.get(featureId) || featureId;
        const found = latestValues.find((v) => v.featureId === featureId);
        features[featureName] = found?.value ?? defaultMap.get(featureId);
      }

      results.push({
        entityId,
        features,
        timestamp: pointInTime,
      });
    }

    return results;
  }

  /**
   * Compute and store aggregated features
   */
  async computeAggregates(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    sourceFeatureId: string,
    aggregations: Array<'count' | 'sum' | 'avg' | 'min' | 'max'>,
    windowDays: number = 30
  ): Promise<Record<string, number>> {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - windowDays);

    const { data, error } = await this.supabase
      .from('ai_feature_values_offline')
      .select('value_int, value_float')
      .eq('tenant_id', tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('feature_id', sourceFeatureId)
      .gte('event_timestamp', startTime.toISOString());

    if (error || !data || data.length === 0) {
      return {};
    }

    // Extract numeric values from typed columns
    const values = data
      .map((d) => d.value_float ?? d.value_int)
      .filter((v) => typeof v === 'number') as number[];

    const results: Record<string, number> = {};

    for (const agg of aggregations) {
      let value: number;

      switch (agg) {
        case 'count':
          value = values.length;
          break;
        case 'sum':
          value = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          break;
        case 'min':
          value = values.length > 0 ? Math.min(...values) : 0;
          break;
        case 'max':
          value = values.length > 0 ? Math.max(...values) : 0;
          break;
      }

      results[`${sourceFeatureId}_${agg}_${windowDays}d`] = value;
    }

    return results;
  }

  /**
   * Delete old feature values (retention policy)
   */
  async cleanup(tenantId: string, retentionDays: number = 365): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // First count records to delete
    const { count: recordCount } = await this.supabase
      .from('ai_feature_values_offline')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .lt('event_timestamp', cutoff.toISOString());

    // Then delete
    const { error } = await this.supabase
      .from('ai_feature_values_offline')
      .delete()
      .eq('tenant_id', tenantId)
      .lt('event_timestamp', cutoff.toISOString());

    if (error) {
      console.error('[OfflineStoreService] Cleanup error:', error);
      return 0;
    }

    return recordCount || 0;
  }

  /**
   * Get statistics about stored features
   */
  async getStats(tenantId: string): Promise<{
    totalRecords: number;
    byEntityType: Record<string, number>;
    oldestRecord?: Date;
    newestRecord?: Date;
  }> {
    const { data, count } = await this.supabase
      .from('ai_feature_values_offline')
      .select('entity_type, event_timestamp', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (!data || data.length === 0) {
      return { totalRecords: 0, byEntityType: {} };
    }

    const byEntityType: Record<string, number> = {};
    let oldest: Date | undefined;
    let newest: Date | undefined;

    for (const row of data) {
      byEntityType[row.entity_type] = (byEntityType[row.entity_type] || 0) + 1;

      const time = new Date(row.event_timestamp);
      if (!oldest || time < oldest) oldest = time;
      if (!newest || time > newest) newest = time;
    }

    return {
      totalRecords: count || 0,
      byEntityType,
      oldestRecord: oldest,
      newestRecord: newest,
    };
  }

  // Private helpers

  /**
   * Determine which value columns to set based on value type
   * SQL table has: value_int, value_float, value_string, value_bool, value_json, value_embedding
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
    // Check if it's an embedding (array of numbers)
    if (Array.isArray(value) && value.length > 100 && typeof value[0] === 'number') {
      return { value_embedding: `[${value.join(',')}]` };
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
    if (row.value_embedding !== null && row.value_embedding !== undefined) return row.value_embedding;
    if (row.value_json !== null && row.value_json !== undefined) return row.value_json;
    return null;
  }
}

// Export singleton instance
export const offlineStoreService = new OfflineStoreService();
