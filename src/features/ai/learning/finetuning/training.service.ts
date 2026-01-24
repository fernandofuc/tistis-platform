// =====================================================
// TIS TIS PLATFORM - TRAINING SERVICE
// Manages fine-tuning jobs with OpenAI
// =====================================================

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import type { FinetuningJob, FinetuningDataset } from '../types';
import { datasetService } from './dataset.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type JobStatus = FinetuningJob['status'];

interface CreateJobParams {
  tenantId: string;
  name: string;
  description?: string;
  datasetId: string;
  baseModel?: string;
  hyperparameters?: {
    nEpochs?: number;
    batchSize?: number | 'auto';
    learningRateMultiplier?: number | 'auto';
  };
  createdBy?: string;
}

interface JobProgress {
  status: JobStatus;
  step?: string;
  trainingLoss?: number;
  validationLoss?: number;
  currentEpoch?: number;
  totalEpochs?: number;
  trainedTokens?: number;
}

export class TrainingService {
  private supabase;
  private openai;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Create a new fine-tuning job
   */
  async createJob(params: CreateJobParams): Promise<string> {
    // Validate dataset
    const dataset = await datasetService.getDataset(params.datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }
    if (dataset.status !== 'ready') {
      throw new Error('Dataset is not ready for training');
    }

    const baseModel = params.baseModel || 'gpt-4o-mini-2024-07-18';

    // Estimate cost
    const estimatedCost = this.estimateCost(dataset, baseModel, params.hyperparameters?.nEpochs);

    const { data, error } = await this.supabase
      .from('ai_finetuning_jobs')
      .insert({
        tenant_id: params.tenantId,
        name: params.name,
        description: params.description,
        dataset_id: params.datasetId,
        base_model: baseModel,
        hyperparameters: params.hyperparameters || {},
        status: 'pending',
        estimated_cost_usd: estimatedCost,
        created_by: params.createdBy,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[TrainingService] Error creating job:', error);
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Start a fine-tuning job
   */
  async startJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    if (job.status !== 'pending') {
      throw new Error(`Cannot start job in status: ${job.status}`);
    }

    const dataset = await datasetService.getDataset(job.datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    try {
      // Update status
      await this.updateJobStatus(jobId, 'validating');

      // 1. Upload training file to OpenAI
      const trainJsonl = await datasetService.exportJsonl(job.datasetId, 'train');
      const trainFile = await this.uploadFile(trainJsonl, `${job.name}-train.jsonl`);

      // 2. Upload validation file if available
      let validationFileId: string | undefined;
      if (dataset.validationExamples > 0) {
        const valJsonl = await datasetService.exportJsonl(job.datasetId, 'validation');
        const valFile = await this.uploadFile(valJsonl, `${job.name}-val.jsonl`);
        validationFileId = valFile.id;
      }

      // 3. Create fine-tuning job in OpenAI
      await this.updateJobStatus(jobId, 'queued');

      const hyperparams: OpenAI.FineTuning.JobCreateParams.Hyperparameters = {};
      if (job.hyperparameters.nEpochs) {
        hyperparams.n_epochs = job.hyperparameters.nEpochs;
      }
      if (job.hyperparameters.batchSize) {
        hyperparams.batch_size = job.hyperparameters.batchSize;
      }
      if (job.hyperparameters.learningRateMultiplier) {
        hyperparams.learning_rate_multiplier = job.hyperparameters.learningRateMultiplier;
      }

      const openaiJob = await this.openai.fineTuning.jobs.create({
        training_file: trainFile.id,
        validation_file: validationFileId,
        model: job.baseModel,
        hyperparameters: Object.keys(hyperparams).length > 0 ? hyperparams : undefined,
        suffix: job.name.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 18),
      });

      // 4. Update job with OpenAI IDs
      await this.supabase
        .from('ai_finetuning_jobs')
        .update({
          openai_job_id: openaiJob.id,
          openai_file_id: trainFile.id,
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (error) {
      console.error('[TrainingService] Error starting job:', error);
      await this.updateJobStatus(jobId, 'failed', String(error));
      throw error;
    }
  }

  /**
   * Check job status and update from OpenAI
   */
  async syncJobStatus(jobId: string): Promise<JobProgress> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (!job.openaiJobId) {
      return { status: job.status };
    }

    try {
      const openaiJob = await this.openai.fineTuning.jobs.retrieve(job.openaiJobId);

      // Map OpenAI status to our status
      let status: JobStatus = job.status;
      let errorMessage: string | undefined;

      switch (openaiJob.status) {
        case 'validating_files':
          status = 'validating';
          break;
        case 'queued':
          status = 'queued';
          break;
        case 'running':
          status = 'running';
          break;
        case 'succeeded':
          status = 'succeeded';
          break;
        case 'failed':
          status = 'failed';
          errorMessage = openaiJob.error?.message;
          break;
        case 'cancelled':
          status = 'cancelled';
          break;
      }

      // Update job
      const updateData: Record<string, unknown> = {
        status,
        openai_model_id: openaiJob.fine_tuned_model,
      };

      if (status === 'succeeded' && openaiJob.fine_tuned_model) {
        updateData.completed_at = new Date().toISOString();
      }
      if (status === 'failed') {
        updateData.error_message = errorMessage;
        updateData.error_details = openaiJob.error;
      }

      // Get training metrics
      const events = await this.openai.fineTuning.jobs.listEvents(job.openaiJobId, { limit: 100 });
      const metrics = this.extractMetrics(events.data);
      if (Object.keys(metrics).length > 0) {
        updateData.training_metrics = metrics;
      }

      await this.supabase
        .from('ai_finetuning_jobs')
        .update(updateData)
        .eq('id', jobId);

      return {
        status,
        step: openaiJob.status,
        trainingLoss: metrics.training_loss,
        validationLoss: metrics.validation_loss,
        trainedTokens: openaiJob.trained_tokens || undefined,
      };
    } catch (error) {
      console.error('[TrainingService] Error syncing job status:', error);
      throw error;
    }
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (!job.openaiJobId) {
      await this.updateJobStatus(jobId, 'cancelled');
      return;
    }

    try {
      await this.openai.fineTuning.jobs.cancel(job.openaiJobId);
      await this.updateJobStatus(jobId, 'cancelled');
    } catch (error) {
      console.error('[TrainingService] Error cancelling job:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(id: string): Promise<FinetuningJob | null> {
    const { data, error } = await this.supabase
      .from('ai_finetuning_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapJob(data);
  }

  /**
   * List jobs for a tenant
   */
  async listJobs(
    tenantId: string,
    options?: {
      status?: JobStatus;
      limit?: number;
    }
  ): Promise<FinetuningJob[]> {
    let query = this.supabase
      .from('ai_finetuning_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const limit = options?.limit || 50;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('[TrainingService] Error listing jobs:', error);
      return [];
    }

    return (data || []).map(this.mapJob);
  }

  /**
   * Get active jobs that need status sync
   */
  async getActiveJobs(): Promise<FinetuningJob[]> {
    const { data } = await this.supabase
      .from('ai_finetuning_jobs')
      .select('*')
      .in('status', ['validating', 'queued', 'running'])
      .not('openai_job_id', 'is', null);

    return (data || []).map(this.mapJob);
  }

  /**
   * Sync all active jobs (for background worker)
   */
  async syncAllActiveJobs(): Promise<{ synced: number; errors: number }> {
    const activeJobs = await this.getActiveJobs();
    let synced = 0;
    let errors = 0;

    for (const job of activeJobs) {
      try {
        await this.syncJobStatus(job.id);
        synced++;
      } catch {
        errors++;
      }
    }

    return { synced, errors };
  }

  // Private helpers

  private async uploadFile(content: string, filename: string): Promise<OpenAI.Files.FileObject> {
    const buffer = Buffer.from(content, 'utf-8');
    const blob = new Blob([buffer], { type: 'application/jsonl' });
    const file = new File([blob], filename);

    const uploadedFile = await this.openai.files.create({
      file,
      purpose: 'fine-tune',
    });

    return uploadedFile;
  }

  private extractMetrics(events: OpenAI.FineTuning.FineTuningJobEvent[]): Record<string, number> {
    const metrics: Record<string, number> = {};

    for (const event of events) {
      if (event.type === 'metrics' && event.data) {
        const data = event.data as Record<string, number>;
        if (data.train_loss !== undefined) {
          metrics.training_loss = data.train_loss;
        }
        if (data.valid_loss !== undefined) {
          metrics.validation_loss = data.valid_loss;
        }
        if (data.step !== undefined) {
          metrics.step = data.step;
        }
      }
    }

    return metrics;
  }

  private estimateCost(
    dataset: FinetuningDataset,
    baseModel: string,
    epochs?: number
  ): number {
    // Rough estimation based on OpenAI pricing
    // gpt-4o-mini: $0.003 per 1K tokens (training)
    // gpt-3.5-turbo: $0.008 per 1K tokens (training)

    const avgTokensPerExample = 150; // Rough estimate
    const totalTokens = dataset.trainExamples * avgTokensPerExample;
    const numEpochs = epochs || 3;

    let costPer1kTokens = 0.003; // Default to gpt-4o-mini
    if (baseModel.includes('gpt-3.5-turbo')) {
      costPer1kTokens = 0.008;
    } else if (baseModel.includes('gpt-4')) {
      costPer1kTokens = 0.025;
    }

    const estimatedCost = (totalTokens * numEpochs / 1000) * costPer1kTokens;
    return Math.round(estimatedCost * 100) / 100;
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.supabase
      .from('ai_finetuning_jobs')
      .update(updateData)
      .eq('id', jobId);
  }

  private mapJob(row: Record<string, unknown>): FinetuningJob {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      datasetId: row.dataset_id as string,
      baseModel: row.base_model as string,
      hyperparameters: row.hyperparameters as {
        nEpochs?: number;
        batchSize?: number | 'auto';
        learningRateMultiplier?: number | 'auto';
      },
      status: row.status as JobStatus,
      openaiJobId: row.openai_job_id as string | undefined,
      openaiFileId: row.openai_file_id as string | undefined,
      openaiModelId: row.openai_model_id as string | undefined,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      estimatedCompletionAt: row.estimated_completion_at
        ? new Date(row.estimated_completion_at as string)
        : undefined,
      trainingMetrics: row.training_metrics as Record<string, number> | undefined,
      errorMessage: row.error_message as string | undefined,
      errorDetails: row.error_details as Record<string, unknown> | undefined,
      estimatedCostUsd: row.estimated_cost_usd as number | undefined,
      actualCostUsd: row.actual_cost_usd as number | undefined,
      createdBy: row.created_by as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const trainingService = new TrainingService();
