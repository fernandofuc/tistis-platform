// =====================================================
// TIS TIS PLATFORM - MODEL REGISTRY SERVICE
// Manages fine-tuned models and deployment
// =====================================================

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { ModelRegistry, FinetuningJob } from '../types';
import { trainingService } from './training.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ModelType = ModelRegistry['modelType'];
type DeploymentStatus = ModelRegistry['deploymentStatus'];

interface RegisterModelParams {
  tenantId: string;
  name: string;
  version: string;
  description?: string;
  modelType: ModelType;
  baseModel: string;
  modelId: string;
  finetuningJobId?: string;
  evaluationMetrics?: Record<string, unknown>;
  useForIntents?: string[];
  temperature?: number;
  maxTokens?: number;
  createdBy?: string;
}

interface ModelSelection {
  modelId: string;
  modelName: string;
  version: string;
  reason: string;
}

export class ModelRegistryService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Register a model from a completed fine-tuning job
   */
  async registerFromJob(
    jobId: string,
    params: {
      name: string;
      version: string;
      description?: string;
      useForIntents?: string[];
      createdBy?: string;
    }
  ): Promise<string> {
    const job = await trainingService.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    if (job.status !== 'succeeded') {
      throw new Error('Job has not succeeded');
    }
    if (!job.openaiModelId) {
      throw new Error('No model ID from OpenAI');
    }

    return this.registerModel({
      tenantId: job.tenantId,
      name: params.name,
      version: params.version,
      description: params.description,
      modelType: 'finetuned',
      baseModel: job.baseModel,
      modelId: job.openaiModelId,
      finetuningJobId: jobId,
      evaluationMetrics: job.trainingMetrics,
      useForIntents: params.useForIntents,
      createdBy: params.createdBy,
    });
  }

  /**
   * Register a new model
   */
  async registerModel(params: RegisterModelParams): Promise<string> {
    // Check for existing version
    const { data: existing } = await this.supabase
      .from('ai_model_registry')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .eq('name', params.name)
      .eq('version', params.version)
      .single();

    if (existing) {
      throw new Error(`Model ${params.name} v${params.version} already exists`);
    }

    const { data, error } = await this.supabase
      .from('ai_model_registry')
      .insert({
        tenant_id: params.tenantId,
        name: params.name,
        version: params.version,
        description: params.description,
        model_type: params.modelType,
        base_model: params.baseModel,
        model_id: params.modelId,
        finetuning_job_id: params.finetuningJobId,
        evaluation_metrics: params.evaluationMetrics || {},
        deployment_status: 'staged',
        traffic_percentage: 0,
        use_for_intents: params.useForIntents || [],
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 500,
        created_by: params.createdBy,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[ModelRegistryService] Error registering model:', error);
      throw new Error(`Failed to register model: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get model by ID
   */
  async getModel(id: string): Promise<ModelRegistry | null> {
    const { data, error } = await this.supabase
      .from('ai_model_registry')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapModel(data);
  }

  /**
   * List models for a tenant
   */
  async listModels(
    tenantId: string,
    options?: {
      deploymentStatus?: DeploymentStatus;
      modelType?: ModelType;
      limit?: number;
    }
  ): Promise<ModelRegistry[]> {
    let query = this.supabase
      .from('ai_model_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.deploymentStatus) {
      query = query.eq('deployment_status', options.deploymentStatus);
    }
    if (options?.modelType) {
      query = query.eq('model_type', options.modelType);
    }

    const limit = options?.limit || 50;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[ModelRegistryService] Error listing models:', error);
      return [];
    }

    return (data || []).map(this.mapModel);
  }

  /**
   * Deploy a model to production
   */
  async deployModel(
    modelId: string,
    trafficPercentage: number = 100
  ): Promise<void> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }

    // Validate model exists in OpenAI
    if (model.modelType === 'finetuned') {
      try {
        await this.openai.models.retrieve(model.modelId);
      } catch {
        throw new Error('Model not found in OpenAI');
      }
    }

    // If deploying at 100%, deprecate other production models
    if (trafficPercentage === 100) {
      await this.supabase
        .from('ai_model_registry')
        .update({
          deployment_status: 'deprecated',
          traffic_percentage: 0,
          deprecated_at: new Date().toISOString(),
        })
        .eq('tenant_id', model.tenantId)
        .eq('deployment_status', 'production')
        .neq('id', modelId);
    }

    // Deploy the model
    await this.supabase
      .from('ai_model_registry')
      .update({
        deployment_status: 'production',
        traffic_percentage: trafficPercentage,
        deployed_at: new Date().toISOString(),
      })
      .eq('id', modelId);
  }

  /**
   * Deploy model as canary (gradual rollout)
   */
  async deployCanary(modelId: string, initialTrafficPercentage: number = 10): Promise<void> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }

    // Reduce traffic on current production
    const { data: currentProd } = await this.supabase
      .from('ai_model_registry')
      .select('id, traffic_percentage')
      .eq('tenant_id', model.tenantId)
      .eq('deployment_status', 'production')
      .order('traffic_percentage', { ascending: false })
      .limit(1)
      .single();

    if (currentProd) {
      const newTraffic = Math.max(currentProd.traffic_percentage - initialTrafficPercentage, 0);
      await this.supabase
        .from('ai_model_registry')
        .update({ traffic_percentage: newTraffic })
        .eq('id', currentProd.id);
    }

    // Deploy canary
    await this.supabase
      .from('ai_model_registry')
      .update({
        deployment_status: 'canary',
        traffic_percentage: initialTrafficPercentage,
        deployed_at: new Date().toISOString(),
      })
      .eq('id', modelId);
  }

  /**
   * Promote canary to production
   */
  async promoteCanary(modelId: string): Promise<void> {
    const model = await this.getModel(modelId);
    if (!model || model.deploymentStatus !== 'canary') {
      throw new Error('Model is not a canary deployment');
    }

    // Full deployment
    await this.deployModel(modelId, 100);
  }

  /**
   * Rollback to previous model
   */
  async rollback(tenantId: string): Promise<string | null> {
    // Find the most recently deprecated model
    const { data: previousModel } = await this.supabase
      .from('ai_model_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('deployment_status', 'deprecated')
      .order('deprecated_at', { ascending: false })
      .limit(1)
      .single();

    if (!previousModel) {
      return null;
    }

    // Deploy the previous model
    await this.deployModel(previousModel.id, 100);
    return previousModel.id;
  }

  /**
   * Select model for inference
   */
  async selectModel(tenantId: string, intent?: string): Promise<ModelSelection | null> {
    // Get production models
    const { data: models } = await this.supabase
      .from('ai_model_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('deployment_status', ['production', 'canary'])
      .gt('traffic_percentage', 0)
      .order('traffic_percentage', { ascending: false });

    if (!models || models.length === 0) {
      return null;
    }

    // If intent specified, find model specifically for that intent
    if (intent) {
      const intentModel = models.find(
        (m) => m.use_for_intents && m.use_for_intents.includes(intent)
      );
      if (intentModel) {
        return {
          modelId: intentModel.model_id,
          modelName: intentModel.name,
          version: intentModel.version,
          reason: `Selected for intent: ${intent}`,
        };
      }
    }

    // Traffic-based selection (weighted random)
    const totalTraffic = models.reduce((sum, m) => sum + m.traffic_percentage, 0);
    const random = Math.random() * totalTraffic;
    let cumulative = 0;

    for (const model of models) {
      cumulative += model.traffic_percentage;
      if (random <= cumulative) {
        return {
          modelId: model.model_id,
          modelName: model.name,
          version: model.version,
          reason: model.deployment_status === 'canary' ? 'Canary deployment' : 'Production',
        };
      }
    }

    // Fallback to first
    const fallback = models[0];
    return {
      modelId: fallback.model_id,
      modelName: fallback.name,
      version: fallback.version,
      reason: 'Fallback',
    };
  }

  /**
   * Update model evaluation metrics
   */
  async updateEvaluationMetrics(
    modelId: string,
    metrics: Record<string, number>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('ai_model_registry')
      .update({
        evaluation_metrics: metrics,
      })
      .eq('id', modelId);

    if (error) {
      console.error('[ModelRegistryService] Error updating metrics:', error);
      throw new Error(`Failed to update metrics: ${error.message}`);
    }
  }

  /**
   * Archive a model
   */
  async archiveModel(modelId: string): Promise<void> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }

    if (model.deploymentStatus === 'production' && model.trafficPercentage > 0) {
      throw new Error('Cannot archive model currently serving traffic');
    }

    await this.supabase
      .from('ai_model_registry')
      .update({
        deployment_status: 'archived',
        traffic_percentage: 0,
      })
      .eq('id', modelId);
  }

  /**
   * Delete a fine-tuned model from OpenAI
   */
  async deleteOpenAIModel(modelId: string): Promise<void> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }

    if (model.modelType !== 'finetuned') {
      throw new Error('Can only delete fine-tuned models');
    }

    if (model.deploymentStatus !== 'archived') {
      throw new Error('Model must be archived before deletion');
    }

    try {
      // Use OpenAI's fine-tuning delete endpoint for fine-tuned models
      await this.openai.fineTuning.jobs.cancel(model.finetuningJobId || '');
      // Note: Fine-tuned models cannot be deleted via API, they are managed by OpenAI
      // We only delete from our registry
    } catch (error) {
      // Log but don't fail - model may already be cancelled or doesn't exist on OpenAI
      console.warn('[ModelRegistryService] Error cancelling OpenAI fine-tuning job:', error);
    }

    // Delete from registry
    await this.supabase
      .from('ai_model_registry')
      .delete()
      .eq('id', modelId);
  }

  // Private helpers

  private mapModel(row: Record<string, unknown>): ModelRegistry {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      version: row.version as string,
      description: row.description as string | undefined,
      modelType: row.model_type as ModelType,
      baseModel: row.base_model as string | undefined,
      modelId: row.model_id as string,
      finetuningJobId: row.finetuning_job_id as string | undefined,
      evaluationMetrics: row.evaluation_metrics as Record<string, number> | undefined,
      evaluationDatasetId: row.evaluation_dataset_id as string | undefined,
      deploymentStatus: row.deployment_status as DeploymentStatus,
      trafficPercentage: row.traffic_percentage as number,
      useForIntents: row.use_for_intents as string[] | undefined,
      temperature: row.temperature as number,
      maxTokens: row.max_tokens as number,
      stagedAt: new Date(row.staged_at as string),
      deployedAt: row.deployed_at ? new Date(row.deployed_at as string) : undefined,
      deprecatedAt: row.deprecated_at ? new Date(row.deprecated_at as string) : undefined,
      createdBy: row.created_by as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const modelRegistryService = new ModelRegistryService();
