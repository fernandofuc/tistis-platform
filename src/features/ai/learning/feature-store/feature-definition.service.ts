// =====================================================
// TIS TIS PLATFORM - FEATURE DEFINITION SERVICE
// Manages feature definitions and schemas
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { FeatureDefinition } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type DataType = FeatureDefinition['dataType'];
type EntityType = FeatureDefinition['entityType'];

interface CreateFeatureParams {
  tenantId?: string; // null for global features
  name: string;
  description?: string;
  entityType: EntityType;
  dataType: DataType;
  defaultValue?: unknown;
  validationRules?: Record<string, unknown>;
  transformations?: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  dependencies?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface FeatureQuery {
  tenantId?: string;
  entityType?: EntityType;
  tags?: string[];
  includeGlobal?: boolean;
  status?: 'active' | 'deprecated';
}

export class FeatureDefinitionService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a new feature definition
   */
  async createFeature(params: CreateFeatureParams): Promise<string> {
    // Check for duplicate names
    const { data: existing } = await this.supabase
      .from('ai_feature_definitions')
      .select('id')
      .eq('name', params.name)
      .eq('entity_type', params.entityType)
      .or(`tenant_id.eq.${params.tenantId || null},tenant_id.is.null`)
      .limit(1)
      .single();

    if (existing) {
      throw new Error(`Feature "${params.name}" already exists for entity type "${params.entityType}"`);
    }

    const { data, error } = await this.supabase
      .from('ai_feature_definitions')
      .insert({
        tenant_id: params.tenantId || null,
        name: params.name,
        description: params.description,
        entity_type: params.entityType,
        data_type: params.dataType,
        default_value: params.defaultValue,
        validation_rules: params.validationRules || {},
        transformations: params.transformations || [],
        dependencies: params.dependencies || [],
        tags: params.tags || [],
        status: 'active',
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[FeatureDefinitionService] Error creating feature:', error);
      throw new Error(`Failed to create feature: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Create multiple feature definitions
   */
  async createFeatures(features: CreateFeatureParams[]): Promise<string[]> {
    const ids: string[] = [];
    for (const feature of features) {
      const id = await this.createFeature(feature);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Get a feature definition by ID
   */
  async getFeature(id: string): Promise<FeatureDefinition | null> {
    const { data, error } = await this.supabase
      .from('ai_feature_definitions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapFeature(data);
  }

  /**
   * Get a feature definition by name
   */
  async getFeatureByName(
    name: string,
    entityType: EntityType,
    tenantId?: string
  ): Promise<FeatureDefinition | null> {
    let query = this.supabase
      .from('ai_feature_definitions')
      .select('*')
      .eq('name', name)
      .eq('entity_type', entityType)
      .eq('status', 'active');

    if (tenantId) {
      query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data } = await query.order('tenant_id', { ascending: false }).limit(1).single();

    if (!data) return null;
    return this.mapFeature(data);
  }

  /**
   * Query feature definitions
   */
  async queryFeatures(params: FeatureQuery): Promise<FeatureDefinition[]> {
    let query = this.supabase
      .from('ai_feature_definitions')
      .select('*')
      .order('name', { ascending: true });

    if (params.tenantId) {
      if (params.includeGlobal !== false) {
        query = query.or(`tenant_id.eq.${params.tenantId},tenant_id.is.null`);
      } else {
        query = query.eq('tenant_id', params.tenantId);
      }
    } else {
      query = query.is('tenant_id', null);
    }

    if (params.entityType) {
      query = query.eq('entity_type', params.entityType);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.tags && params.tags.length > 0) {
      query = query.contains('tags', params.tags);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FeatureDefinitionService] Error querying features:', error);
      return [];
    }

    return (data || []).map(this.mapFeature);
  }

  /**
   * Get all features for an entity type
   */
  async getFeaturesForEntity(
    entityType: EntityType,
    tenantId?: string
  ): Promise<FeatureDefinition[]> {
    return this.queryFeatures({
      tenantId,
      entityType,
      status: 'active',
      includeGlobal: true,
    });
  }

  /**
   * Update a feature definition
   */
  async updateFeature(
    id: string,
    updates: Partial<{
      description: string;
      defaultValue: unknown;
      validationRules: Record<string, unknown>;
      transformations: Array<{ type: string; params: Record<string, unknown> }>;
      tags: string[];
      metadata: Record<string, unknown>;
    }>
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.defaultValue !== undefined) updateData.default_value = updates.defaultValue;
    if (updates.validationRules !== undefined) updateData.validation_rules = updates.validationRules;
    if (updates.transformations !== undefined) updateData.transformations = updates.transformations;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    if (Object.keys(updateData).length === 0) return;

    const { error } = await this.supabase
      .from('ai_feature_definitions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('[FeatureDefinitionService] Error updating feature:', error);
      throw new Error(`Failed to update feature: ${error.message}`);
    }
  }

  /**
   * Deprecate a feature
   */
  async deprecateFeature(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_feature_definitions')
      .update({ status: 'deprecated' })
      .eq('id', id);

    if (error) {
      console.error('[FeatureDefinitionService] Error deprecating feature:', error);
      throw new Error(`Failed to deprecate feature: ${error.message}`);
    }
  }

  /**
   * Delete a feature (only if unused)
   */
  async deleteFeature(id: string): Promise<void> {
    // Check if feature has values
    const { count: offlineCount } = await this.supabase
      .from('ai_feature_values_offline')
      .select('*', { count: 'exact', head: true })
      .eq('feature_id', id);

    const { count: onlineCount } = await this.supabase
      .from('ai_feature_values_online')
      .select('*', { count: 'exact', head: true })
      .eq('feature_id', id);

    if ((offlineCount || 0) > 0 || (onlineCount || 0) > 0) {
      throw new Error('Cannot delete feature with existing values. Deprecate instead.');
    }

    const { error } = await this.supabase
      .from('ai_feature_definitions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[FeatureDefinitionService] Error deleting feature:', error);
      throw new Error(`Failed to delete feature: ${error.message}`);
    }
  }

  /**
   * Validate a feature value against its definition
   */
  async validateValue(featureId: string, value: unknown): Promise<{ valid: boolean; errors: string[] }> {
    const feature = await this.getFeature(featureId);
    if (!feature) {
      return { valid: false, errors: ['Feature not found'] };
    }

    const errors: string[] = [];

    // Type validation
    const typeValid = this.validateType(value, feature.dataType);
    if (!typeValid) {
      errors.push(`Expected type ${feature.dataType}, got ${typeof value}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create default feature definitions for common use cases
   */
  async createDefaultFeatures(tenantId?: string): Promise<string[]> {
    const defaults: CreateFeatureParams[] = [
      // Lead features
      {
        tenantId,
        name: 'lead_message_count',
        description: 'Total messages from lead',
        entityType: 'lead',
        dataType: 'integer',
        defaultValue: 0,
        tags: ['engagement', 'activity'],
      },
      {
        tenantId,
        name: 'lead_response_rate',
        description: 'Response rate to AI messages',
        entityType: 'lead',
        dataType: 'float',
        defaultValue: 0,
        validationRules: { min: 0, max: 1 },
        tags: ['engagement', 'quality'],
      },
      {
        tenantId,
        name: 'lead_sentiment_avg',
        description: 'Average sentiment score',
        entityType: 'lead',
        dataType: 'float',
        defaultValue: 0,
        validationRules: { min: -1, max: 1 },
        tags: ['sentiment', 'quality'],
      },
      {
        tenantId,
        name: 'lead_intent_history',
        description: 'History of detected intents',
        entityType: 'lead',
        dataType: 'json',
        defaultValue: [],
        tags: ['intent', 'history'],
      },
      // Conversation features
      {
        tenantId,
        name: 'conversation_length',
        description: 'Number of messages in conversation',
        entityType: 'conversation',
        dataType: 'integer',
        defaultValue: 0,
        tags: ['metrics', 'activity'],
      },
      {
        tenantId,
        name: 'conversation_duration_minutes',
        description: 'Conversation duration in minutes',
        entityType: 'conversation',
        dataType: 'float',
        defaultValue: 0,
        tags: ['metrics', 'time'],
      },
      {
        tenantId,
        name: 'conversation_escalated',
        description: 'Whether conversation was escalated',
        entityType: 'conversation',
        dataType: 'boolean',
        defaultValue: false,
        tags: ['escalation', 'quality'],
      },
      // Tenant features
      {
        tenantId,
        name: 'tenant_avg_response_time_ms',
        description: 'Average AI response time',
        entityType: 'tenant',
        dataType: 'float',
        defaultValue: 0,
        tags: ['performance', 'metrics'],
      },
      {
        tenantId,
        name: 'tenant_feedback_score',
        description: 'Overall feedback score',
        entityType: 'tenant',
        dataType: 'float',
        defaultValue: 0,
        validationRules: { min: 0, max: 1 },
        tags: ['quality', 'feedback'],
      },
    ];

    return this.createFeatures(defaults);
  }

  // Private helpers

  private validateType(value: unknown, dataType: DataType): boolean {
    switch (dataType) {
      case 'string':
        return typeof value === 'string';
      case 'integer':
        return Number.isInteger(value);
      case 'float':
        return typeof value === 'number' && !Number.isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'json':
        return typeof value === 'object' && value !== null;
      case 'array':
        return Array.isArray(value);
      case 'embedding':
        return Array.isArray(value) && value.every((v) => typeof v === 'number');
      default:
        return true;
    }
  }

  private applyValidationRules(value: unknown, rules: Record<string, unknown>): string[] {
    const errors: string[] = [];

    if (typeof value === 'number') {
      if (rules.min !== undefined && value < (rules.min as number)) {
        errors.push(`Value ${value} is less than minimum ${rules.min}`);
      }
      if (rules.max !== undefined && value > (rules.max as number)) {
        errors.push(`Value ${value} is greater than maximum ${rules.max}`);
      }
    }

    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < (rules.minLength as number)) {
        errors.push(`String length ${value.length} is less than minimum ${rules.minLength}`);
      }
      if (rules.maxLength !== undefined && value.length > (rules.maxLength as number)) {
        errors.push(`String length ${value.length} is greater than maximum ${rules.maxLength}`);
      }
      if (rules.pattern !== undefined && !new RegExp(rules.pattern as string).test(value)) {
        errors.push(`String does not match pattern ${rules.pattern}`);
      }
    }

    if (Array.isArray(value) && rules.maxItems !== undefined && value.length > (rules.maxItems as number)) {
      errors.push(`Array length ${value.length} exceeds maximum ${rules.maxItems}`);
    }

    return errors;
  }

  private mapFeature(row: Record<string, unknown>): FeatureDefinition {
    const status = row.status as 'active' | 'deprecated';
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string | undefined,
      name: row.name as string,
      description: row.description as string | undefined,
      featureGroup: (row.feature_group as string) || 'default',
      entityType: row.entity_type as EntityType,
      dataType: row.data_type as DataType,
      defaultValue: row.default_value,
      validationRules: row.validation_rules as Record<string, unknown> | undefined,
      transformations: row.transformations as Array<{
        type: string;
        params: Record<string, unknown>;
      }> | undefined,
      dependencies: row.dependencies as string[] | undefined,
      tags: row.tags as string[] | undefined,
      status,
      isActive: status === 'active',
      isDeprecated: status === 'deprecated',
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const featureDefinitionService = new FeatureDefinitionService();
