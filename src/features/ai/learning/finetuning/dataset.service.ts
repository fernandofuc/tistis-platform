// =====================================================
// TIS TIS PLATFORM - DATASET SERVICE
// Manages datasets for fine-tuning
// =====================================================

import { createClient } from '@supabase/supabase-js';
import type { FinetuningDataset, Feedback } from '../types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type DatasetType = FinetuningDataset['datasetType'];
type DatasetStatus = FinetuningDataset['status'];

interface DatasetExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  metadata?: Record<string, unknown>;
}

interface CreateDatasetParams {
  tenantId: string;
  name: string;
  description?: string;
  datasetType: DatasetType;
  filters?: {
    minRating?: number;
    isPositive?: boolean;
    startDate?: Date;
    endDate?: Date;
    intents?: string[];
    channels?: string[];
  };
  metadata?: Record<string, unknown>;
}

interface QualityCheck {
  name: string;
  passed: boolean;
  details: string;
  severity: 'error' | 'warning' | 'info';
}

export class DatasetService {
  private supabase;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a new dataset from feedback data
   */
  async createDataset(params: CreateDatasetParams): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_finetuning_datasets')
      .insert({
        tenant_id: params.tenantId,
        name: params.name,
        description: params.description,
        dataset_type: params.datasetType,
        filters_applied: params.filters || {},
        status: 'draft',
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[DatasetService] Error creating dataset:', error);
      throw new Error(`Failed to create dataset: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Generate dataset examples from feedback
   */
  async generateExamples(
    datasetId: string,
    systemPrompt?: string
  ): Promise<{ totalExamples: number; errors: string[] }> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    // Update status
    await this.updateStatus(datasetId, 'processing');

    const filters = dataset.filtersApplied as CreateDatasetParams['filters'] || {};
    const errors: string[] = [];
    const examples: DatasetExample[] = [];

    try {
      // Query feedback based on filters
      let query = this.supabase
        .from('ai_feedback')
        .select(`
          *,
          conversations(messages)
        `)
        .eq('tenant_id', dataset.tenantId)
        .not('ai_response_text', 'is', null);

      if (filters.minRating) {
        query = query.gte('rating', filters.minRating);
      }
      if (filters.isPositive !== undefined) {
        query = query.eq('is_positive', filters.isPositive);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lt('created_at', filters.endDate);
      }
      if (filters.channels && filters.channels.length > 0) {
        query = query.in('channel', filters.channels);
      }

      query = query.order('created_at', { ascending: false }).limit(10000);

      const { data: feedbackData } = await query;

      // Generate examples based on dataset type
      for (const feedback of feedbackData || []) {
        try {
          const example = this.feedbackToExample(feedback, dataset.datasetType, systemPrompt);
          if (example) {
            examples.push(example);
          }
        } catch (err) {
          errors.push(`Error processing feedback ${feedback.id}: ${err}`);
        }
      }

      // Split into train/validation/test
      const shuffled = this.shuffleArray([...examples]);
      const trainSize = Math.floor(shuffled.length * 0.8);
      const valSize = Math.floor(shuffled.length * 0.1);

      const trainExamples = shuffled.slice(0, trainSize);
      const valExamples = shuffled.slice(trainSize, trainSize + valSize);
      const testExamples = shuffled.slice(trainSize + valSize);

      // Generate JSONL content
      const trainJsonl = trainExamples.map((e) => JSON.stringify(e)).join('\n');
      const valJsonl = valExamples.map((e) => JSON.stringify(e)).join('\n');
      const testJsonl = testExamples.map((e) => JSON.stringify(e)).join('\n');

      // Calculate file size
      const totalSize =
        Buffer.byteLength(trainJsonl, 'utf-8') +
        Buffer.byteLength(valJsonl, 'utf-8') +
        Buffer.byteLength(testJsonl, 'utf-8');

      // Update dataset
      await this.supabase
        .from('ai_finetuning_datasets')
        .update({
          total_examples: examples.length,
          train_examples: trainExamples.length,
          validation_examples: valExamples.length,
          test_examples: testExamples.length,
          file_size_bytes: totalSize,
          status: 'ready',
          metadata: {
            ...dataset.metadata,
            train_jsonl: trainJsonl,
            validation_jsonl: valJsonl,
            test_jsonl: testJsonl,
            generated_at: new Date().toISOString(),
          },
        })
        .eq('id', datasetId);

      return {
        totalExamples: examples.length,
        errors,
      };
    } catch (error) {
      await this.updateStatus(datasetId, 'failed');
      throw error;
    }
  }

  /**
   * Get dataset by ID
   */
  async getDataset(id: string): Promise<FinetuningDataset | null> {
    const { data, error } = await this.supabase
      .from('ai_finetuning_datasets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapDataset(data);
  }

  /**
   * List datasets for a tenant
   */
  async listDatasets(
    tenantId: string,
    options?: {
      status?: DatasetStatus;
      limit?: number;
    }
  ): Promise<FinetuningDataset[]> {
    let query = this.supabase
      .from('ai_finetuning_datasets')
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
      console.error('[DatasetService] Error listing datasets:', error);
      return [];
    }

    return (data || []).map(this.mapDataset);
  }

  /**
   * Run quality checks on dataset
   */
  async runQualityChecks(datasetId: string): Promise<QualityCheck[]> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const checks: QualityCheck[] = [];

    // Check 1: Minimum examples
    const minExamples = 10;
    checks.push({
      name: 'minimum_examples',
      passed: dataset.totalExamples >= minExamples,
      details: `Dataset has ${dataset.totalExamples} examples (minimum: ${minExamples})`,
      severity: dataset.totalExamples >= minExamples ? 'info' : 'error',
    });

    // Check 2: Recommended examples for fine-tuning
    const recommendedExamples = 100;
    checks.push({
      name: 'recommended_examples',
      passed: dataset.totalExamples >= recommendedExamples,
      details: `Dataset has ${dataset.totalExamples} examples (recommended: ${recommendedExamples}+)`,
      severity: dataset.totalExamples >= recommendedExamples ? 'info' : 'warning',
    });

    // Check 3: Train/validation split
    const hasValidation = dataset.validationExamples > 0;
    checks.push({
      name: 'validation_split',
      passed: hasValidation,
      details: hasValidation
        ? `${dataset.validationExamples} validation examples`
        : 'No validation examples',
      severity: hasValidation ? 'info' : 'warning',
    });

    // Check 4: File size within limits (OpenAI limit is 1GB)
    const maxSize = 100 * 1024 * 1024; // 100MB recommended
    const sizeOk = (dataset.fileSizeBytes || 0) <= maxSize;
    checks.push({
      name: 'file_size',
      passed: sizeOk,
      details: `File size: ${((dataset.fileSizeBytes || 0) / 1024 / 1024).toFixed(2)}MB`,
      severity: sizeOk ? 'info' : 'warning',
    });

    // Calculate quality score
    const passed = checks.filter((c) => c.passed).length;
    const qualityScore = passed / checks.length;

    // Update dataset with quality info
    await this.supabase
      .from('ai_finetuning_datasets')
      .update({
        quality_score: qualityScore,
        quality_checks: checks.reduce(
          (acc, c) => ({
            ...acc,
            [c.name]: { passed: c.passed, details: c.details },
          }),
          {}
        ),
      })
      .eq('id', datasetId);

    return checks;
  }

  /**
   * Get dataset content for preview
   */
  async previewExamples(datasetId: string, limit: number = 5): Promise<DatasetExample[]> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const trainJsonl = dataset.metadata?.train_jsonl as string;
    if (!trainJsonl) {
      return [];
    }

    const lines = trainJsonl.split('\n').slice(0, limit);
    return lines.map((line) => JSON.parse(line));
  }

  /**
   * Export dataset as JSONL
   */
  async exportJsonl(
    datasetId: string,
    split: 'train' | 'validation' | 'test' = 'train'
  ): Promise<string> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) {
      throw new Error('Dataset not found');
    }

    const key = `${split}_jsonl`;
    const content = dataset.metadata?.[key] as string;

    if (!content) {
      throw new Error(`No ${split} data available`);
    }

    return content;
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId: string): Promise<void> {
    // Check if dataset is used by any jobs
    const { count } = await this.supabase
      .from('ai_finetuning_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId);

    if ((count || 0) > 0) {
      throw new Error('Cannot delete dataset that is used by training jobs');
    }

    const { error } = await this.supabase
      .from('ai_finetuning_datasets')
      .delete()
      .eq('id', datasetId);

    if (error) {
      console.error('[DatasetService] Error deleting dataset:', error);
      throw new Error(`Failed to delete dataset: ${error.message}`);
    }
  }

  /**
   * Archive a dataset
   */
  async archiveDataset(datasetId: string): Promise<void> {
    await this.updateStatus(datasetId, 'archived');
  }

  // Private helpers

  private async updateStatus(datasetId: string, status: DatasetStatus): Promise<void> {
    await this.supabase
      .from('ai_finetuning_datasets')
      .update({ status })
      .eq('id', datasetId);
  }

  private feedbackToExample(
    feedback: Record<string, unknown>,
    datasetType: DatasetType,
    systemPrompt?: string
  ): DatasetExample | null {
    const messages: DatasetExample['messages'] = [];

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    switch (datasetType) {
      case 'conversation_pairs':
        // Use conversation context if available
        const conversationData = feedback.conversations as { messages?: Array<{ role: string; content: string }> } | undefined;
        const conversationMessages = conversationData?.messages;

        if (conversationMessages && conversationMessages.length > 0) {
          for (const msg of conversationMessages.slice(-5)) {
            messages.push({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content,
            });
          }
        }
        break;

      case 'instruction_response':
        // Simple instruction-response pair
        if (feedback.ai_response_text) {
          messages.push({
            role: 'user',
            content: String(feedback.correction_text || feedback.feedback_text || 'How can I help you?'),
          });
          messages.push({
            role: 'assistant',
            content: String(feedback.ai_response_text),
          });
        }
        break;

      case 'classification':
        // Classification format
        // Would need intent labels
        break;

      case 'custom':
        // Custom format handling
        break;
    }

    if (messages.length < 2) {
      return null;
    }

    return {
      messages,
      metadata: {
        feedback_id: feedback.id,
        rating: feedback.rating,
        is_positive: feedback.is_positive,
      },
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private mapDataset(row: Record<string, unknown>): FinetuningDataset {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      datasetType: row.dataset_type as DatasetType,
      format: row.format as 'jsonl' | 'csv' | 'parquet',
      totalExamples: row.total_examples as number,
      trainExamples: row.train_examples as number,
      validationExamples: row.validation_examples as number,
      testExamples: row.test_examples as number,
      qualityScore: row.quality_score as number | undefined,
      qualityChecks: row.quality_checks as Record<string, { passed: boolean; details: string }> | undefined,
      storagePath: row.storage_path as string | undefined,
      fileSizeBytes: row.file_size_bytes as number | undefined,
      status: row.status as DatasetStatus,
      filtersApplied: row.filters_applied as Record<string, unknown>,
      createdBy: row.created_by as string | undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

// Export singleton instance
export const datasetService = new DatasetService();
