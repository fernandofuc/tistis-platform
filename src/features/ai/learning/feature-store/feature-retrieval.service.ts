// =====================================================
// TIS TIS PLATFORM - FEATURE RETRIEVAL SERVICE
// Unified feature retrieval for inference
// =====================================================

import type { FeatureDefinition } from '../types';
import { featureDefinitionService } from './feature-definition.service';
import { onlineStoreService } from './online-store.service';
import { offlineStoreService } from './offline-store.service';

type EntityType = FeatureDefinition['entityType'];

interface FeatureSet {
  entityId: string;
  entityType: EntityType;
  features: Record<string, unknown>;
  metadata: {
    fetchedAt: Date;
    source: 'online' | 'offline' | 'mixed';
    missingFeatures: string[];
  };
}

interface RetrievalOptions {
  preferOnline?: boolean;
  fallbackToOffline?: boolean;
  includeDefaults?: boolean;
  pointInTime?: Date;
}

interface TransformationResult {
  original: unknown;
  transformed: unknown;
  transformationType: string;
}

export class FeatureRetrievalService {
  /**
   * Get features for a single entity
   */
  async getFeatures(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureNames?: string[],
    options?: RetrievalOptions
  ): Promise<FeatureSet> {
    const opts: Required<RetrievalOptions> = {
      preferOnline: true,
      fallbackToOffline: true,
      includeDefaults: true,
      pointInTime: new Date(),
      ...options,
    };

    // Get feature definitions
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);

    // Filter by requested names if provided
    const targetFeatures = featureNames
      ? definitions.filter((d) => featureNames.includes(d.name))
      : definitions;

    const featureIds = targetFeatures.map((d) => d.id);
    const nameMap = new Map(definitions.map((d) => [d.id, d.name]));
    const defaultMap = new Map(definitions.map((d) => [d.name, d.defaultValue]));

    const result: Record<string, unknown> = {};
    const missingFeatures: string[] = [];
    let source: 'online' | 'offline' | 'mixed' = 'online';

    if (opts.preferOnline) {
      // Try online store first
      const onlineFeatures = await onlineStoreService.getMany(
        tenantId,
        entityType,
        entityId,
        featureIds
      );

      const foundIds = new Set(onlineFeatures.map((f) => f.featureId));

      for (const feature of onlineFeatures) {
        result[feature.featureName] = feature.value;
      }

      // Check for missing features
      const missing = featureIds.filter((id) => !foundIds.has(id));

      if (missing.length > 0 && opts.fallbackToOffline) {
        // Fallback to offline store
        const offlineFeatures = await offlineStoreService.getLatest({
          tenantId,
          entityType,
          entityId,
          featureIds: missing,
          pointInTime: opts.pointInTime,
        });

        if (offlineFeatures.length > 0) {
          source = 'mixed';
          for (const feature of offlineFeatures) {
            result[feature.featureName] = feature.value;
          }
        }
      }
    } else {
      // Use offline store directly
      source = 'offline';
      const offlineFeatures = await offlineStoreService.getLatest({
        tenantId,
        entityType,
        entityId,
        featureIds,
        pointInTime: opts.pointInTime,
      });

      for (const feature of offlineFeatures) {
        result[feature.featureName] = feature.value;
      }
    }

    // Apply defaults for missing features
    for (const feature of targetFeatures) {
      if (!(feature.name in result)) {
        if (opts.includeDefaults && feature.defaultValue !== undefined) {
          result[feature.name] = feature.defaultValue;
        } else {
          missingFeatures.push(feature.name);
        }
      }
    }

    return {
      entityId,
      entityType,
      features: result,
      metadata: {
        fetchedAt: new Date(),
        source,
        missingFeatures,
      },
    };
  }

  /**
   * Get features for multiple entities (batch)
   */
  async getFeaturesBatch(
    tenantId: string,
    entityType: EntityType,
    entityIds: string[],
    featureNames?: string[],
    options?: RetrievalOptions
  ): Promise<FeatureSet[]> {
    // Process in parallel with concurrency limit
    const batchSize = 10;
    const results: FeatureSet[] = [];

    for (let i = 0; i < entityIds.length; i += batchSize) {
      const batch = entityIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((id) => this.getFeatures(tenantId, entityType, id, featureNames, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get features with transformations applied
   */
  async getTransformedFeatures(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureNames?: string[],
    options?: RetrievalOptions
  ): Promise<FeatureSet> {
    const featureSet = await this.getFeatures(tenantId, entityType, entityId, featureNames, options);

    // Get definitions for transformation rules
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);
    const defMap = new Map(definitions.map((d) => [d.name, d]));

    // Apply transformations
    const transformedFeatures: Record<string, unknown> = {};

    for (const [name, value] of Object.entries(featureSet.features)) {
      const definition = defMap.get(name);

      if (definition?.transformations && definition.transformations.length > 0) {
        let transformed = value;
        for (const transform of definition.transformations) {
          transformed = this.applyTransformation(transformed, transform);
        }
        transformedFeatures[name] = transformed;
      } else {
        transformedFeatures[name] = value;
      }
    }

    return {
      ...featureSet,
      features: transformedFeatures,
    };
  }

  /**
   * Get feature vector for ML inference (numeric array)
   */
  async getFeatureVector(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    featureNames: string[],
    options?: RetrievalOptions
  ): Promise<{ vector: number[]; featureNames: string[] }> {
    const featureSet = await this.getTransformedFeatures(
      tenantId,
      entityType,
      entityId,
      featureNames,
      options
    );

    const vector: number[] = [];
    const orderedNames: string[] = [];

    for (const name of featureNames) {
      const value = featureSet.features[name];

      if (typeof value === 'number') {
        vector.push(value);
        orderedNames.push(name);
      } else if (typeof value === 'boolean') {
        vector.push(value ? 1 : 0);
        orderedNames.push(name);
      } else if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
        // Flatten arrays (embeddings)
        vector.push(...(value as number[]));
        for (let i = 0; i < value.length; i++) {
          orderedNames.push(`${name}_${i}`);
        }
      } else {
        // Skip non-numeric features or use 0 as placeholder
        vector.push(0);
        orderedNames.push(name);
      }
    }

    return { vector, featureNames: orderedNames };
  }

  /**
   * Compute derived features on-the-fly
   */
  async computeDerivedFeature(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    derivation: {
      name: string;
      expression: string; // e.g., "feature_a / feature_b"
      dependencies: string[];
    }
  ): Promise<{ name: string; value: unknown }> {
    const featureSet = await this.getFeatures(
      tenantId,
      entityType,
      entityId,
      derivation.dependencies
    );

    // Simple expression evaluation
    // In production, use a proper expression parser
    let value: unknown;

    try {
      const context: Record<string, unknown> = featureSet.features;

      // Very simple expression evaluation (replace feature names with values)
      let expr = derivation.expression;
      for (const [name, val] of Object.entries(context)) {
        expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
      }

      // eslint-disable-next-line no-eval
      value = eval(expr);
    } catch (error) {
      console.error('[FeatureRetrievalService] Error computing derived feature:', error);
      value = null;
    }

    return {
      name: derivation.name,
      value,
    };
  }

  /**
   * Sync online store from offline store (materialize features)
   */
  async materializeToOnline(
    tenantId: string,
    entityType: EntityType,
    entityIds: string[],
    featureNames?: string[]
  ): Promise<{ materialized: number; errors: number }> {
    const definitions = await featureDefinitionService.getFeaturesForEntity(entityType, tenantId);

    const targetFeatures = featureNames
      ? definitions.filter((d) => featureNames.includes(d.name))
      : definitions;

    const featureIds = targetFeatures.map((d) => d.id);

    let materialized = 0;
    let errors = 0;

    for (const entityId of entityIds) {
      try {
        const offlineValues = await offlineStoreService.getLatest({
          tenantId,
          entityType,
          entityId,
          featureIds,
        });

        if (offlineValues.length > 0) {
          const features = offlineValues.map((v) => ({
            featureId: v.featureId,
            value: v.value,
          }));

          await onlineStoreService.upsertBatch(tenantId, entityType, entityId, features);
          materialized += features.length;
        }
      } catch (error) {
        console.error(`[FeatureRetrievalService] Error materializing ${entityId}:`, error);
        errors++;
      }
    }

    return { materialized, errors };
  }

  // Private helpers

  private applyTransformation(
    value: unknown,
    transform: { type: string; params: Record<string, unknown> }
  ): unknown {
    if (value === null || value === undefined) return value;

    switch (transform.type) {
      case 'normalize':
        if (typeof value === 'number') {
          const min = (transform.params.min as number) || 0;
          const max = (transform.params.max as number) || 1;
          return (value - min) / (max - min);
        }
        break;

      case 'log':
        if (typeof value === 'number' && value > 0) {
          return Math.log(value);
        }
        break;

      case 'clip':
        if (typeof value === 'number') {
          const min = (transform.params.min as number) ?? -Infinity;
          const max = (transform.params.max as number) ?? Infinity;
          return Math.min(Math.max(value, min), max);
        }
        break;

      case 'bucketize':
        if (typeof value === 'number') {
          const boundaries = (transform.params.boundaries as number[]) || [];
          for (let i = 0; i < boundaries.length; i++) {
            if (value < boundaries[i]) return i;
          }
          return boundaries.length;
        }
        break;

      case 'one_hot':
        if (typeof value === 'string' || typeof value === 'number') {
          const categories = (transform.params.categories as string[]) || [];
          const vector = new Array(categories.length).fill(0);
          const idx = categories.indexOf(String(value));
          if (idx >= 0) vector[idx] = 1;
          return vector;
        }
        break;

      case 'embedding_lookup':
        // This would look up a pre-computed embedding
        // For now, just return the value
        break;

      default:
        console.warn(`[FeatureRetrievalService] Unknown transformation: ${transform.type}`);
    }

    return value;
  }
}

// Export singleton instance
export const featureRetrievalService = new FeatureRetrievalService();
