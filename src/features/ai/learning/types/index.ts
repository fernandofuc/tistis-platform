// =====================================================
// TIS TIS PLATFORM - AI LEARNING 2.0 TYPES
// Shared types for all AI Learning modules
// =====================================================

// RLHF Types
export interface FeedbackType {
  type: 'thumbs_up' | 'thumbs_down' | 'rating' | 'text' | 'correction';
}

export interface FeedbackDimension {
  dimension: 'accuracy' | 'helpfulness' | 'tone' | 'speed' | 'relevance' | 'overall';
}

export interface Feedback {
  id: string;
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  leadId?: string;
  feedbackType: FeedbackType['type'];
  /** Rating 1-5, validated via CHECK constraint in SQL */
  rating?: number;
  isPositive?: boolean;
  feedbackText?: string;
  correctionText?: string;
  dimension?: FeedbackDimension['dimension'];
  aiResponseText?: string;
  aiModelUsed?: string;
  aiPromptVariantId?: string;
  channel?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  /** Auto-generated server-side via DEFAULT NOW() */
  createdAt: Date;
}

export interface FeedbackAggregation {
  id: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dimension?: FeedbackDimension['dimension'];
  segmentKey?: string;
  totalFeedback: number;
  positiveCount: number;
  negativeCount: number;
  rawPositiveRate?: number;
  wilsonLowerBound?: number;
  wilsonUpperBound?: number;
  avgRating?: number;
  ratingCount?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  trendChange?: number;
  metadata?: Record<string, unknown>;
  calculatedAt: Date;
}

export interface PromptVariant {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  variantType: 'system_prompt' | 'response_template' | 'instruction' | 'persona' | 'format';
  agentType?: string;
  promptContent: string;
  variables?: Array<{ name: string; defaultValue?: string; description?: string }>;
  status: 'draft' | 'active' | 'paused' | 'archived';
  isControl: boolean;
  impressions: number;
  positiveFeedback: number;
  negativeFeedback: number;
  conversionCount: number;
  performanceScore?: number;
  confidenceLevel?: number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ABTest {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  hypothesis?: string;
  testType: 'prompt_optimization' | 'response_style' | 'agent_behavior' | 'model_comparison';
  controlVariantId: string;
  treatmentVariantIds: string[];
  trafficAllocation: Record<string, number>;
  targetSegments?: string[];
  targetChannels?: string[];
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  startedAt?: Date;
  endedAt?: Date;
  scheduledEndAt?: Date;
  minSampleSize?: number;
  confidenceThreshold?: number;
  winnerVariantId?: string;
  statisticalSignificance?: number;
  effectSize?: number;
  resultsSummary?: Record<string, unknown>;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Embedding Types
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  maxInputTokens: number;
  batchSize: number;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  dimensions: number;
  model: string;
  tokenCount: number;
  cached: boolean;
  processingTimeMs: number;
}

export interface PatternEmbedding {
  id: string;
  tenantId: string;
  sourceType: 'message' | 'pattern' | 'faq' | 'knowledge_article' | 'service' | 'custom_instruction';
  sourceId?: string;
  contentText: string;
  contentHash: string;
  embedding: number[];
  modelUsed: string;
  tokenCount?: number;
  intent?: string;
  category?: string;
  tags?: string[];
  language?: string;
  searchCount?: number;
  lastSearchedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SemanticSearchResult {
  id: string;
  contentText: string;
  sourceType: string;
  intent?: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

/**
 * Embedding cache entry - matches ai_embedding_cache table
 * Primary key: (textHash, model)
 */
export interface EmbeddingCache {
  textHash: string;
  model: string;
  embedding: number[];
  textPreview?: string;
  tokenCount?: number;
  /** Auto-generated server-side via DEFAULT NOW() */
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastHitAt?: Date;
}

// Drift Detection Types
/**
 * Note: SQL metric_category enum differs from TypeScript metricType enum
 * SQL: 'input' | 'output' | 'performance' | 'behavior'
 * TypeScript uses broader categories for flexibility
 */
export interface DriftBaseline {
  id: string;
  tenantId: string;
  metricName: string;
  /** Corresponds to metric_category in SQL */
  metricType: 'performance' | 'quality' | 'input_distribution' | 'output_distribution' | 'custom';
  description?: string;
  /** SQL: baseline_start/baseline_end define the reference period */
  baselineStart?: Date;
  baselineEnd?: Date;
  /** SQL: mean_value */
  baselineMean: number;
  /** SQL: std_value */
  baselineStd: number;
  baselineDistribution: Record<string, number>;
  sampleCount: number;
  /** SQL: calculated from baseline_start to baseline_end */
  windowDays: number;
  /** SQL: distribution_type for stats */
  distributionType?: 'continuous' | 'categorical';
  minValue?: number;
  maxValue?: number;
  /** SQL: percentiles JSONB */
  percentiles?: Record<string, number>;
  /** SQL: histogram_bins JSONB */
  histogramBins?: Array<{ binStart: number; binEnd: number; count: number }>;
  warningThreshold?: number;
  criticalThreshold?: number;
  /** SQL: is_active boolean */
  status: 'active' | 'archived';
  /** SQL: superseded_by UUID for version chain */
  supersededBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DriftMetric - matches ai_drift_metrics table (partitioned by month)
 * SQL table stores aggregated metrics with full statistical information
 */
export interface DriftMetric {
  id: string;
  tenantId: string;
  metricType: DriftBaseline['metricType'];
  metricName: string;
  /** SQL: mean_value - primary metric value */
  metricValue: number;
  /** For real-time collection context */
  conversationId?: string;
  messageId?: string;
  dimensions?: Record<string, string>;
  /** SQL: period_start/period_end for aggregated metrics */
  periodStart?: Date;
  periodEnd?: Date;
  periodType?: 'hourly' | 'daily' | 'weekly';
  /** SQL: sample_count for aggregated data */
  sampleCount?: number;
  /** SQL: std_value */
  stdValue?: number;
  minValue?: number;
  maxValue?: number;
  /** SQL: category_distribution JSONB */
  categoryDistribution?: Record<string, number>;
  /** Statistical test results vs baseline */
  baselineId?: string;
  /** SQL: Kolmogorov-Smirnov test */
  ksStatistic?: number;
  ksPValue?: number;
  /** SQL: Chi-Square test */
  chiSquareStatistic?: number;
  chiSquarePValue?: number;
  /** SQL: Population Stability Index */
  psiValue?: number;
  /** SQL: Jensen-Shannon Divergence */
  jsDivergence?: number;
  driftDetected?: boolean;
  driftSeverity?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
  /** SQL: collected_at */
  recordedAt: Date;
}

export interface DriftAlert {
  id: string;
  tenantId: string;
  /** SQL: alert_type - 'drift_detected' maps to 'drift', etc. */
  alertType: 'drift' | 'threshold' | 'trend' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** SQL: metric_id UUID reference */
  metricId?: string;
  metricName: string;
  metricType: DriftBaseline['metricType'];
  /** SQL: title VARCHAR(255) */
  title?: string;
  /** SQL: description TEXT */
  description?: string;
  currentValue: number;
  baselineValue: number;
  /** SQL: threshold_value */
  threshold: number;
  /** SQL: deviation_percentage */
  deviationPercentage?: number;
  driftScore?: number;
  /** SQL: title + description combined for display */
  message: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  /** SQL: resolution_notes */
  resolution?: string;
  /** SQL: notifications_sent JSONB */
  notificationsSent?: Array<{ channel: string; sentAt: Date; recipient: string }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Feature Store Types
export interface FeatureDefinition {
  id: string;
  tenantId?: string;
  name: string;
  displayName?: string;
  description?: string;
  featureGroup: string;
  entityType: 'conversation' | 'lead' | 'user' | 'tenant' | 'message';
  dataType: 'integer' | 'float' | 'string' | 'boolean' | 'array' | 'json' | 'embedding';
  aggregationType?: 'latest' | 'sum' | 'avg' | 'min' | 'max' | 'count' | 'list' | 'custom';
  computationSql?: string;
  refreshFrequency?: 'realtime' | 'minute' | 'hourly' | 'daily' | 'weekly' | 'manual';
  defaultValue?: unknown;
  ttlSeconds?: number;
  validationRules?: Record<string, unknown>;
  transformations?: Array<{ type: string; params: Record<string, unknown> }>;
  dependencies?: string[];
  status?: 'active' | 'deprecated';
  isActive: boolean;
  isDeprecated: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FeatureValue - matches ai_feature_values_online/offline tables
 * SQL tables have typed columns: value_int, value_float, value_string, value_bool, value_json, value_embedding
 * TypeScript uses discriminated union for type safety
 */
export interface FeatureValue {
  tenantId?: string;
  featureName: string;
  entityType: string;
  entityId: string;
  /** Generic value - actual SQL has typed columns */
  value: unknown;
  /** For typed access, SQL stores in separate columns */
  valueInt?: number;
  valueFloat?: number;
  valueString?: string;
  valueBool?: boolean;
  valueJson?: Record<string, unknown>;
  valueEmbedding?: number[];
  /** SQL: event_timestamp for point-in-time lookup (offline store) */
  eventTimestamp?: Date;
  computedAt: Date;
  expiresAt?: Date;
}

export interface FeatureVector {
  entityType: string;
  entityId: string;
  features: Record<string, unknown>;
  computedAt: Date;
}

// Fine-tuning Types
export interface FinetuningDataset {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  datasetType: 'conversation_pairs' | 'instruction_response' | 'classification' | 'custom';
  format: 'jsonl' | 'csv' | 'parquet';
  totalExamples: number;
  trainExamples: number;
  validationExamples: number;
  testExamples: number;
  qualityScore?: number;
  qualityChecks?: Record<string, { passed: boolean; details?: string }>;
  storagePath?: string;
  fileSizeBytes?: number;
  status: 'draft' | 'processing' | 'ready' | 'archived' | 'failed';
  filtersApplied?: Record<string, unknown>;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinetuningJob {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  datasetId: string;
  baseModel: string;
  hyperparameters: {
    nEpochs?: number;
    batchSize?: number | 'auto';
    learningRateMultiplier?: number | 'auto';
    [key: string]: unknown;
  };
  status: 'pending' | 'validating' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  openaiJobId?: string;
  openaiFileId?: string;
  openaiModelId?: string;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletionAt?: Date;
  trainingMetrics?: Record<string, unknown>;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelRegistry {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  description?: string;
  modelType: 'finetuned' | 'base' | 'ensemble' | 'custom';
  baseModel?: string;
  modelId: string;
  finetuningJobId?: string;
  evaluationMetrics?: Record<string, unknown>;
  evaluationDatasetId?: string;
  deploymentStatus: 'staged' | 'canary' | 'production' | 'deprecated' | 'archived';
  trafficPercentage: number;
  useForIntents?: string[];
  temperature?: number;
  maxTokens?: number;
  stagedAt: Date;
  deployedAt?: Date;
  deprecatedAt?: Date;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// XAI Types
export interface DecisionLog {
  id: string;
  tenantId: string;
  conversationId?: string;
  messageId?: string;
  leadId?: string;
  decisionType: 'intent_classification' | 'response_generation' | 'escalation' | 'action' | 'routing' | 'model_selection';
  inputText?: string;
  inputEmbedding?: number[];
  inputFeatures?: Record<string, unknown>;
  modelUsed: string;
  promptTemplate?: string;
  promptRendered?: string;
  candidates?: Array<{ option: string; score: number; reasoning?: string }>;
  decision: string;
  confidence: number;
  reasoning?: string;
  influenceFactors?: Array<{ factor: string; weight: number; value: unknown; contribution: number }>;
  latencyMs?: number;
  tokensUsed?: number;
  createdAt: Date;
}

export interface DecisionEvidence {
  id: string;
  decisionLogId: string;
  evidenceItems: Array<{
    type: 'text_span' | 'feature' | 'pattern' | 'history';
    content: string;
    relevance: number;
    startIndex?: number;
    endIndex?: number;
    explanation: string;
  }>;
  summary: string;
  confidence: number;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  eventType: 'decision' | 'model_change' | 'config_change' | 'feedback' | 'escalation';
  eventSubtype?: string;
  actorType: 'system' | 'user' | 'admin' | 'cron';
  actorId?: string;
  actorName?: string;
  resourceType: 'conversation' | 'model' | 'prompt' | 'config' | 'pattern';
  resourceId?: string;
  action: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  decisionLogId?: string;
  parentEventId?: string;
  checksum: string;
  createdAt: Date;
}

// AI Learning Context (for LangGraph integration)
export interface AILearningContext {
  tenantId: string;
  conversationId?: string;
  leadId?: string;
  channel?: string;
  detectedIntent?: string;
  intentConfidence?: number;
  modelUsed?: string;
  promptVariantId?: string;
  topPatterns?: Array<{
    intent: string;
    category: string;
    count: number;
  }>;
  feedbackSummary?: {
    total: number;
    positiveRate: number;
    avgRating?: number;
  };
  activeModel?: {
    id: string;
    name: string;
    version: string;
    modelId: string;
  };
  driftStatus?: {
    alertsActive: number;
    lastCheck?: Date;
  };
}
