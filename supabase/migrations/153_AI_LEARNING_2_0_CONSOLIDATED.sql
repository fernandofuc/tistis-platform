-- =====================================================
-- TIS TIS PLATFORM - AI LEARNING 2.0 SYSTEM
-- Migration: 153_AI_LEARNING_2_0_CONSOLIDATED.sql
-- Date: 2026-01-23
-- Version: 1.0 CONSOLIDATED
--
-- PURPOSE: Sistema completo de AI Learning 2.0 con:
-- - FASE 1: RLHF (Reinforcement Learning from Human Feedback)
-- - FASE 2: Embeddings Semánticos con pgvector
-- - FASE 3: Drift Detection para monitoreo de calidad
-- - FASE 4: Feature Store (Online + Offline)
-- - FASE 5: Fine-tuning Pipeline
-- - FASE 6: XAI (Explainability) con Audit Trail
--
-- ARCHITECTURE:
-- - ai_feedback: Feedback de usuarios (thumbs up/down)
-- - ai_feedback_aggregations: Agregaciones Wilson Score
-- - ai_prompt_variants: Variantes A/B de prompts
-- - ai_ab_tests: Experimentos A/B
-- - ai_pattern_embeddings: Embeddings semánticos (vector 1536)
-- - ai_embedding_cache: Cache de embeddings generados
-- - ai_drift_baselines: Baselines para drift detection
-- - ai_drift_metrics: Métricas recolectadas
-- - ai_drift_alerts: Alertas de drift
-- - ai_feature_definitions: Definiciones de features
-- - ai_feature_values_offline: Feature store offline
-- - ai_feature_values_online: Feature store online (hot table)
-- - ai_finetuning_datasets: Datasets para fine-tuning
-- - ai_finetuning_jobs: Jobs de entrenamiento
-- - ai_model_registry: Registro de modelos
-- - ai_decision_logs: Logs de decisiones AI
-- - ai_decision_evidence: Evidencia de decisiones
-- - ai_audit_trail: Audit trail inmutable
--
-- DEPENDS ON: pgvector extension, tenants, conversations, leads
-- =====================================================

-- =====================================================
-- PRE-FLIGHT CHECKS
-- =====================================================

DO $$
BEGIN
    -- Verificar extensión pgvector
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE NOTICE 'Creating pgvector extension...';
        CREATE EXTENSION IF NOT EXISTS vector;
    END IF;

    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Starting AI Learning 2.0 Migration';
    RAISE NOTICE '======================================================';
END $$;

-- =====================================================
-- PART 1: RLHF TABLES (Feedback & A/B Testing)
-- =====================================================

-- 1.1 ai_feedback: Feedback de usuarios
CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Contexto
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    message_id UUID,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

    -- Tipo de feedback
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN (
        'thumbs_up', 'thumbs_down', 'rating', 'text', 'correction'
    )),

    -- Valores
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_positive BOOLEAN,
    feedback_text TEXT,
    correction_text TEXT,

    -- Dimensiones para análisis
    dimension VARCHAR(50) CHECK (dimension IN (
        'accuracy', 'helpfulness', 'tone', 'speed', 'relevance', 'overall'
    )),

    -- Contexto del mensaje AI
    ai_response_text TEXT,
    ai_model_used VARCHAR(100),
    ai_prompt_variant_id UUID,

    -- Metadata
    channel VARCHAR(20) DEFAULT 'whatsapp',
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Para evitar spam
    CONSTRAINT unique_feedback_per_message UNIQUE(tenant_id, message_id, feedback_type)
);

-- Índices para ai_feedback
CREATE INDEX idx_ai_feedback_tenant_time ON public.ai_feedback(tenant_id, created_at DESC);
CREATE INDEX idx_ai_feedback_conversation ON public.ai_feedback(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_ai_feedback_type ON public.ai_feedback(tenant_id, feedback_type, created_at DESC);
CREATE INDEX idx_ai_feedback_dimension ON public.ai_feedback(tenant_id, dimension) WHERE dimension IS NOT NULL;
CREATE INDEX idx_ai_feedback_positive ON public.ai_feedback(tenant_id, is_positive, created_at DESC) WHERE is_positive IS NOT NULL;
CREATE INDEX idx_ai_feedback_variant ON public.ai_feedback(ai_prompt_variant_id) WHERE ai_prompt_variant_id IS NOT NULL;

COMMENT ON TABLE public.ai_feedback IS 'Feedback de usuarios sobre respuestas AI para RLHF';

-- 1.2 ai_feedback_aggregations: Agregaciones estadísticas
CREATE TABLE IF NOT EXISTS public.ai_feedback_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Período de agregación
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),

    -- Dimensión analizada
    dimension VARCHAR(50),
    segment_key VARCHAR(100), -- e.g., 'intent:booking', 'agent:pricing'

    -- Conteos
    total_feedback INTEGER DEFAULT 0,
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,

    -- Scores calculados
    raw_positive_rate DECIMAL(5,4),
    wilson_lower_bound DECIMAL(5,4),  -- Wilson Score para ranking
    wilson_upper_bound DECIMAL(5,4),

    -- Rating promedio (si aplica)
    avg_rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,

    -- Tendencia vs período anterior
    trend_direction VARCHAR(10) CHECK (trend_direction IN ('up', 'down', 'stable')),
    trend_change DECIMAL(5,4),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unicidad por período y segmento
    UNIQUE(tenant_id, period_type, period_start, dimension, segment_key)
);

-- Índices para ai_feedback_aggregations
CREATE INDEX idx_ai_feedback_agg_tenant_period ON public.ai_feedback_aggregations(tenant_id, period_type, period_start DESC);
CREATE INDEX idx_ai_feedback_agg_wilson ON public.ai_feedback_aggregations(tenant_id, wilson_lower_bound DESC);
CREATE INDEX idx_ai_feedback_agg_segment ON public.ai_feedback_aggregations(tenant_id, segment_key);

COMMENT ON TABLE public.ai_feedback_aggregations IS 'Agregaciones de feedback con Wilson Score para ranking estadístico';

-- 1.3 ai_prompt_variants: Variantes de prompts para A/B testing
CREATE TABLE IF NOT EXISTS public.ai_prompt_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Tipo y contexto
    variant_type VARCHAR(50) NOT NULL CHECK (variant_type IN (
        'system_prompt', 'response_template', 'instruction', 'persona', 'format'
    )),
    agent_type VARCHAR(50), -- 'pricing', 'booking', 'general', etc.

    -- Contenido
    prompt_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- [{name, default_value, description}]

    -- Estado
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    is_control BOOLEAN DEFAULT false, -- Es la variante de control?

    -- Métricas acumuladas
    impressions INTEGER DEFAULT 0,
    positive_feedback INTEGER DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,

    -- Scores
    performance_score DECIMAL(5,4),
    confidence_level DECIMAL(5,4),

    -- Metadata
    created_by UUID,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para ai_prompt_variants
CREATE INDEX idx_ai_prompt_variants_tenant ON public.ai_prompt_variants(tenant_id);
CREATE INDEX idx_ai_prompt_variants_status ON public.ai_prompt_variants(tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_ai_prompt_variants_type ON public.ai_prompt_variants(tenant_id, variant_type, agent_type);
CREATE INDEX idx_ai_prompt_variants_control ON public.ai_prompt_variants(tenant_id, is_control) WHERE is_control = true;

COMMENT ON TABLE public.ai_prompt_variants IS 'Variantes de prompts para A/B testing y optimización';

-- 1.4 ai_ab_tests: Experimentos A/B
CREATE TABLE IF NOT EXISTS public.ai_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hypothesis TEXT,

    -- Configuración
    test_type VARCHAR(50) NOT NULL CHECK (test_type IN (
        'prompt_optimization', 'response_style', 'agent_behavior', 'model_comparison'
    )),

    -- Variantes (referencias)
    control_variant_id UUID NOT NULL REFERENCES public.ai_prompt_variants(id),
    treatment_variant_ids UUID[] NOT NULL,

    -- Traffic allocation (suma debe ser 1.0)
    traffic_allocation JSONB NOT NULL DEFAULT '{}', -- {variant_id: percentage}

    -- Targeting
    target_segments JSONB DEFAULT '[]', -- ['new_users', 'returning', 'high_value']
    target_channels TEXT[] DEFAULT ARRAY['whatsapp'],

    -- Estado
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'running', 'paused', 'completed', 'cancelled'
    )),

    -- Timing
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    scheduled_end_at TIMESTAMPTZ,

    -- Statistical settings
    min_sample_size INTEGER DEFAULT 100,
    confidence_threshold DECIMAL(3,2) DEFAULT 0.95,

    -- Results
    winner_variant_id UUID,
    statistical_significance DECIMAL(5,4),
    effect_size DECIMAL(5,4),
    results_summary JSONB DEFAULT '{}',

    -- Metadata
    created_by UUID,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para ai_ab_tests
CREATE INDEX idx_ai_ab_tests_tenant ON public.ai_ab_tests(tenant_id);
CREATE INDEX idx_ai_ab_tests_status ON public.ai_ab_tests(tenant_id, status) WHERE status = 'running';
CREATE INDEX idx_ai_ab_tests_type ON public.ai_ab_tests(tenant_id, test_type);

COMMENT ON TABLE public.ai_ab_tests IS 'Experimentos A/B para optimización de prompts y comportamiento AI';

-- =====================================================
-- PART 2: EMBEDDINGS TABLES (Semantic Search)
-- =====================================================

-- 2.1 ai_pattern_embeddings: Embeddings de patrones
CREATE TABLE IF NOT EXISTS public.ai_pattern_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Fuente del embedding
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN (
        'message', 'pattern', 'faq', 'knowledge_article', 'service', 'custom_instruction'
    )),
    source_id UUID,

    -- Contenido
    content_text TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 del texto

    -- Vector embedding (1536 dimensiones para OpenAI text-embedding-3-small)
    embedding vector(1536) NOT NULL,

    -- Metadata del embedding
    model_used VARCHAR(100) DEFAULT 'text-embedding-3-small',
    token_count INTEGER,

    -- Clasificación
    intent VARCHAR(100),
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',

    -- Para búsqueda
    language VARCHAR(10) DEFAULT 'es',

    -- Métricas
    search_count INTEGER DEFAULT 0,
    last_searched_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevenir duplicados
    UNIQUE(tenant_id, content_hash)
);

-- HNSW Index para búsqueda vectorial rápida
CREATE INDEX idx_ai_embeddings_hnsw ON public.ai_pattern_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índices adicionales
CREATE INDEX idx_ai_embeddings_tenant ON public.ai_pattern_embeddings(tenant_id);
CREATE INDEX idx_ai_embeddings_source ON public.ai_pattern_embeddings(tenant_id, source_type, source_id);
CREATE INDEX idx_ai_embeddings_intent ON public.ai_pattern_embeddings(tenant_id, intent) WHERE intent IS NOT NULL;
CREATE INDEX idx_ai_embeddings_category ON public.ai_pattern_embeddings(tenant_id, category) WHERE category IS NOT NULL;

COMMENT ON TABLE public.ai_pattern_embeddings IS 'Embeddings semánticos para búsqueda vectorial con pgvector';

-- 2.2 ai_embedding_cache: Cache de embeddings
CREATE TABLE IF NOT EXISTS public.ai_embedding_cache (
    text_hash VARCHAR(64) NOT NULL,
    model VARCHAR(100) NOT NULL,

    -- Vector
    embedding vector(1536) NOT NULL,

    -- Metadata
    text_preview VARCHAR(200),
    token_count INTEGER,

    -- Cache control
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMPTZ,

    PRIMARY KEY (text_hash, model)
);

-- Índices para cache
CREATE INDEX idx_ai_embedding_cache_expires ON public.ai_embedding_cache(expires_at);
CREATE INDEX idx_ai_embedding_cache_hits ON public.ai_embedding_cache(hit_count DESC);

COMMENT ON TABLE public.ai_embedding_cache IS 'Cache de embeddings para evitar llamadas repetidas a OpenAI';

-- =====================================================
-- PART 3: DRIFT DETECTION TABLES
-- =====================================================

-- 3.1 ai_drift_baselines: Baselines de referencia
CREATE TABLE IF NOT EXISTS public.ai_drift_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL CHECK (metric_category IN (
        'input', 'output', 'performance', 'behavior'
    )),

    -- Período de baseline
    baseline_start TIMESTAMPTZ NOT NULL,
    baseline_end TIMESTAMPTZ NOT NULL,

    -- Estadísticas de baseline
    sample_count INTEGER NOT NULL,

    -- Para métricas numéricas (distribución)
    distribution_type VARCHAR(20) CHECK (distribution_type IN ('continuous', 'categorical')),
    mean_value DECIMAL(15,6),
    std_value DECIMAL(15,6),
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    percentiles JSONB, -- {p10, p25, p50, p75, p90, p95, p99}
    histogram_bins JSONB, -- [{bin_start, bin_end, count}]

    -- Para métricas categóricas
    category_distribution JSONB, -- {category: count}

    -- Umbrales de alerta
    warning_threshold DECIMAL(10,6),
    critical_threshold DECIMAL(10,6),

    -- Estado
    is_active BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES public.ai_drift_baselines(id),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unicidad
    UNIQUE(tenant_id, metric_name, baseline_start)
);

-- Índices para baselines
CREATE INDEX idx_ai_drift_baselines_tenant ON public.ai_drift_baselines(tenant_id);
CREATE INDEX idx_ai_drift_baselines_metric ON public.ai_drift_baselines(tenant_id, metric_name) WHERE is_active = true;
CREATE INDEX idx_ai_drift_baselines_category ON public.ai_drift_baselines(tenant_id, metric_category);

COMMENT ON TABLE public.ai_drift_baselines IS 'Baselines de referencia para detección de drift';

-- 3.2 ai_drift_metrics: Métricas recolectadas
CREATE TABLE IF NOT EXISTS public.ai_drift_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL,

    -- Período de métrica
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type VARCHAR(20) DEFAULT 'hourly' CHECK (period_type IN ('hourly', 'daily', 'weekly')),

    -- Valores
    sample_count INTEGER NOT NULL,

    -- Para numéricas
    mean_value DECIMAL(15,6),
    std_value DECIMAL(15,6),
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),

    -- Para categóricas
    category_distribution JSONB,

    -- Tests estadísticos vs baseline
    baseline_id UUID REFERENCES public.ai_drift_baselines(id),
    ks_statistic DECIMAL(10,6),       -- Kolmogorov-Smirnov
    ks_p_value DECIMAL(10,6),
    chi_square_statistic DECIMAL(10,6), -- Chi-Square
    chi_square_p_value DECIMAL(10,6),
    psi_value DECIMAL(10,6),           -- Population Stability Index
    js_divergence DECIMAL(10,6),        -- Jensen-Shannon Divergence

    -- Detección de drift
    drift_detected BOOLEAN DEFAULT false,
    drift_severity VARCHAR(20) CHECK (drift_severity IN ('none', 'low', 'medium', 'high', 'critical')),

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    collected_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (period_start);

-- Crear particiones para los próximos meses
CREATE TABLE public.ai_drift_metrics_2026_01 PARTITION OF public.ai_drift_metrics
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.ai_drift_metrics_2026_02 PARTITION OF public.ai_drift_metrics
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.ai_drift_metrics_2026_03 PARTITION OF public.ai_drift_metrics
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.ai_drift_metrics_2026_04 PARTITION OF public.ai_drift_metrics
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE public.ai_drift_metrics_2026_05 PARTITION OF public.ai_drift_metrics
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.ai_drift_metrics_2026_06 PARTITION OF public.ai_drift_metrics
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Índices para métricas
CREATE INDEX idx_ai_drift_metrics_tenant_period ON public.ai_drift_metrics(tenant_id, period_start DESC);
CREATE INDEX idx_ai_drift_metrics_metric ON public.ai_drift_metrics(tenant_id, metric_name, period_start DESC);
CREATE INDEX idx_ai_drift_metrics_drift ON public.ai_drift_metrics(tenant_id, drift_detected, period_start DESC)
    WHERE drift_detected = true;

COMMENT ON TABLE public.ai_drift_metrics IS 'Métricas de drift recolectadas periódicamente (particionada por mes)';

-- 3.3 ai_drift_alerts: Alertas de drift
CREATE TABLE IF NOT EXISTS public.ai_drift_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Referencia a métrica
    metric_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,

    -- Alerta
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'drift_detected', 'threshold_exceeded', 'trend_change', 'anomaly'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

    -- Descripción
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Valores
    current_value DECIMAL(15,6),
    baseline_value DECIMAL(15,6),
    threshold_value DECIMAL(15,6),
    deviation_percentage DECIMAL(10,4),

    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'active', 'acknowledged', 'resolved', 'dismissed'
    )),

    -- Resolución
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT,

    -- Notificaciones
    notifications_sent JSONB DEFAULT '[]', -- [{channel, sent_at, recipient}]

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para alertas
CREATE INDEX idx_ai_drift_alerts_tenant_status ON public.ai_drift_alerts(tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_ai_drift_alerts_severity ON public.ai_drift_alerts(tenant_id, severity, created_at DESC);
CREATE INDEX idx_ai_drift_alerts_metric ON public.ai_drift_alerts(metric_name, created_at DESC);

COMMENT ON TABLE public.ai_drift_alerts IS 'Alertas generadas por detección de drift';

-- =====================================================
-- PART 4: FEATURE STORE TABLES
-- =====================================================

-- 4.1 ai_feature_definitions: Definiciones de features
CREATE TABLE IF NOT EXISTS public.ai_feature_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL = global

    -- Identificación
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    description TEXT,

    -- Categorización
    feature_group VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
        'conversation', 'lead', 'user', 'tenant', 'message'
    )),

    -- Tipo de dato
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
        'integer', 'float', 'string', 'boolean', 'array', 'json', 'embedding'
    )),

    -- Cálculo
    aggregation_type VARCHAR(50) CHECK (aggregation_type IN (
        'latest', 'sum', 'avg', 'min', 'max', 'count', 'list', 'custom'
    )),
    computation_sql TEXT, -- Query SQL para calcular el feature

    -- Refresh
    refresh_frequency VARCHAR(20) DEFAULT 'hourly' CHECK (refresh_frequency IN (
        'realtime', 'minute', 'hourly', 'daily', 'weekly', 'manual'
    )),

    -- Configuración
    default_value JSONB,
    ttl_seconds INTEGER DEFAULT 3600,

    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_deprecated BOOLEAN DEFAULT false,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unicidad
    UNIQUE(COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID), name)
);

-- Índices para definiciones
CREATE INDEX idx_ai_feature_defs_group ON public.ai_feature_definitions(feature_group);
CREATE INDEX idx_ai_feature_defs_entity ON public.ai_feature_definitions(entity_type);
CREATE INDEX idx_ai_feature_defs_active ON public.ai_feature_definitions(is_active) WHERE is_active = true;

COMMENT ON TABLE public.ai_feature_definitions IS 'Definiciones de features para el feature store';

-- 4.2 ai_feature_values_offline: Feature store offline (histórico)
CREATE TABLE IF NOT EXISTS public.ai_feature_values_offline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Feature
    feature_id UUID NOT NULL REFERENCES public.ai_feature_definitions(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL, -- Denormalizado para queries rápidos

    -- Entidad
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,

    -- Valor
    value_int BIGINT,
    value_float DECIMAL(15,6),
    value_string TEXT,
    value_bool BOOLEAN,
    value_json JSONB,
    value_embedding vector(1536),

    -- Point-in-time
    event_timestamp TIMESTAMPTZ NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Metadata
    metadata JSONB DEFAULT '{}'
) PARTITION BY RANGE (event_timestamp);

-- Crear particiones
CREATE TABLE public.ai_feature_values_offline_2026_01 PARTITION OF public.ai_feature_values_offline
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.ai_feature_values_offline_2026_02 PARTITION OF public.ai_feature_values_offline
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.ai_feature_values_offline_2026_03 PARTITION OF public.ai_feature_values_offline
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.ai_feature_values_offline_2026_04 PARTITION OF public.ai_feature_values_offline
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE public.ai_feature_values_offline_2026_05 PARTITION OF public.ai_feature_values_offline
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.ai_feature_values_offline_2026_06 PARTITION OF public.ai_feature_values_offline
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Índices para offline store
CREATE INDEX idx_ai_features_offline_entity ON public.ai_feature_values_offline(entity_type, entity_id, event_timestamp DESC);
CREATE INDEX idx_ai_features_offline_feature ON public.ai_feature_values_offline(feature_name, entity_id, event_timestamp DESC);
CREATE INDEX idx_ai_features_offline_pit ON public.ai_feature_values_offline(tenant_id, entity_id, event_timestamp DESC);

COMMENT ON TABLE public.ai_feature_values_offline IS 'Feature store offline para training (particionada por mes)';

-- 4.3 ai_feature_values_online: Feature store online (hot table)
CREATE TABLE IF NOT EXISTS public.ai_feature_values_online (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Feature
    feature_name VARCHAR(100) NOT NULL,

    -- Entidad
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,

    -- Valor (solo el tipo relevante tiene valor)
    value_int BIGINT,
    value_float DECIMAL(15,6),
    value_string TEXT,
    value_bool BOOLEAN,
    value_json JSONB,

    -- Cache control
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- Primary key compuesta para upserts eficientes
    PRIMARY KEY (tenant_id, feature_name, entity_type, entity_id)
);

-- Índices para online store
CREATE INDEX idx_ai_features_online_entity ON public.ai_feature_values_online(entity_type, entity_id);
CREATE INDEX idx_ai_features_online_expires ON public.ai_feature_values_online(expires_at);

COMMENT ON TABLE public.ai_feature_values_online IS 'Feature store online para inference en tiempo real (hot table)';

-- =====================================================
-- PART 5: FINE-TUNING TABLES
-- =====================================================

-- 5.1 ai_finetuning_datasets: Datasets para fine-tuning
CREATE TABLE IF NOT EXISTS public.ai_finetuning_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Tipo
    dataset_type VARCHAR(50) NOT NULL CHECK (dataset_type IN (
        'conversation_pairs', 'instruction_response', 'classification', 'custom'
    )),

    -- Formato
    format VARCHAR(20) DEFAULT 'jsonl' CHECK (format IN ('jsonl', 'csv', 'parquet')),

    -- Estadísticas
    total_examples INTEGER DEFAULT 0,
    train_examples INTEGER DEFAULT 0,
    validation_examples INTEGER DEFAULT 0,
    test_examples INTEGER DEFAULT 0,

    -- Calidad
    quality_score DECIMAL(3,2),
    quality_checks JSONB DEFAULT '{}', -- {check_name: {passed, details}}

    -- Storage
    storage_path TEXT, -- S3/GCS path
    file_size_bytes BIGINT,

    -- Estado
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'processing', 'ready', 'archived', 'failed'
    )),

    -- Filtros usados
    filters_applied JSONB DEFAULT '{}', -- {min_rating, date_range, etc.}

    -- Metadata
    created_by UUID,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para datasets
CREATE INDEX idx_ai_finetuning_datasets_tenant ON public.ai_finetuning_datasets(tenant_id);
CREATE INDEX idx_ai_finetuning_datasets_status ON public.ai_finetuning_datasets(tenant_id, status);

COMMENT ON TABLE public.ai_finetuning_datasets IS 'Datasets preparados para fine-tuning';

-- 5.2 ai_finetuning_jobs: Jobs de entrenamiento
CREATE TABLE IF NOT EXISTS public.ai_finetuning_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Dataset
    dataset_id UUID NOT NULL REFERENCES public.ai_finetuning_datasets(id),

    -- Modelo
    base_model VARCHAR(100) NOT NULL, -- 'gpt-4o-mini', 'gpt-3.5-turbo', etc.

    -- Configuración de training
    hyperparameters JSONB NOT NULL DEFAULT '{}', -- {n_epochs, batch_size, learning_rate, etc.}

    -- Estado
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'queued', 'running', 'succeeded', 'failed', 'cancelled'
    )),

    -- OpenAI Job
    openai_job_id VARCHAR(100),
    openai_file_id VARCHAR(100),
    openai_model_id VARCHAR(100), -- Modelo resultante: ft:gpt-4o-mini:...

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion_at TIMESTAMPTZ,

    -- Métricas de training
    training_metrics JSONB DEFAULT '{}', -- {loss, accuracy, etc.}

    -- Error tracking
    error_message TEXT,
    error_details JSONB,

    -- Costo
    estimated_cost_usd DECIMAL(10,4),
    actual_cost_usd DECIMAL(10,4),

    -- Metadata
    created_by UUID,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para jobs
CREATE INDEX idx_ai_finetuning_jobs_tenant ON public.ai_finetuning_jobs(tenant_id);
CREATE INDEX idx_ai_finetuning_jobs_status ON public.ai_finetuning_jobs(tenant_id, status);
CREATE INDEX idx_ai_finetuning_jobs_openai ON public.ai_finetuning_jobs(openai_job_id) WHERE openai_job_id IS NOT NULL;

COMMENT ON TABLE public.ai_finetuning_jobs IS 'Jobs de fine-tuning con OpenAI';

-- 5.3 ai_model_registry: Registro de modelos
CREATE TABLE IF NOT EXISTS public.ai_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Identificación
    name VARCHAR(200) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT,

    -- Modelo
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN (
        'finetuned', 'base', 'ensemble', 'custom'
    )),
    base_model VARCHAR(100),
    model_id VARCHAR(200) NOT NULL, -- ID en OpenAI o path local

    -- Origen
    finetuning_job_id UUID REFERENCES public.ai_finetuning_jobs(id),

    -- Métricas de evaluación
    evaluation_metrics JSONB DEFAULT '{}', -- {accuracy, f1, bleu, human_eval, etc.}
    evaluation_dataset_id UUID,

    -- Estado de deployment
    deployment_status VARCHAR(20) DEFAULT 'staged' CHECK (deployment_status IN (
        'staged', 'canary', 'production', 'deprecated', 'archived'
    )),
    traffic_percentage INTEGER DEFAULT 0 CHECK (traffic_percentage >= 0 AND traffic_percentage <= 100),

    -- Configuración de uso
    use_for_intents TEXT[] DEFAULT '{}', -- ['booking', 'pricing', 'general']
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 500,

    -- Timestamps de deployment
    staged_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,

    -- Metadata
    created_by UUID,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unicidad
    UNIQUE(tenant_id, name, version)
);

-- Índices para registry
CREATE INDEX idx_ai_model_registry_tenant ON public.ai_model_registry(tenant_id);
CREATE INDEX idx_ai_model_registry_status ON public.ai_model_registry(tenant_id, deployment_status);
CREATE INDEX idx_ai_model_registry_production ON public.ai_model_registry(tenant_id, deployment_status, traffic_percentage DESC)
    WHERE deployment_status = 'production';

COMMENT ON TABLE public.ai_model_registry IS 'Registro de modelos con control de versiones y deployment';

-- =====================================================
-- PART 6: XAI (EXPLAINABILITY) TABLES
-- =====================================================

-- 6.1 ai_decision_logs: Logs de decisiones AI
CREATE TABLE IF NOT EXISTS public.ai_decision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Contexto
    conversation_id UUID,
    message_id UUID,
    lead_id UUID,

    -- Tipo de decisión
    decision_type VARCHAR(50) NOT NULL CHECK (decision_type IN (
        'intent_classification', 'response_generation', 'escalation',
        'action', 'routing', 'model_selection'
    )),

    -- Input
    input_text TEXT,
    input_embedding vector(1536),
    input_features JSONB,

    -- Proceso de decisión
    model_used VARCHAR(100) NOT NULL,
    prompt_template TEXT,
    prompt_rendered TEXT,

    -- Candidatos considerados
    candidates JSONB, -- [{option, score, reasoning}]

    -- Decisión final
    decision TEXT NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,
    reasoning TEXT,

    -- Factores de influencia
    influence_factors JSONB, -- [{factor, weight, value, contribution}]

    -- Performance
    latency_ms INTEGER,
    tokens_used INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Crear particiones
CREATE TABLE public.ai_decision_logs_2026_01 PARTITION OF public.ai_decision_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE public.ai_decision_logs_2026_02 PARTITION OF public.ai_decision_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE public.ai_decision_logs_2026_03 PARTITION OF public.ai_decision_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE public.ai_decision_logs_2026_04 PARTITION OF public.ai_decision_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE public.ai_decision_logs_2026_05 PARTITION OF public.ai_decision_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.ai_decision_logs_2026_06 PARTITION OF public.ai_decision_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Índices para decision logs
CREATE INDEX idx_ai_decision_logs_tenant ON public.ai_decision_logs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_decision_logs_conversation ON public.ai_decision_logs(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_ai_decision_logs_type ON public.ai_decision_logs(tenant_id, decision_type);

COMMENT ON TABLE public.ai_decision_logs IS 'Logs de decisiones AI para XAI (particionada por mes)';

-- 6.2 ai_decision_evidence: Evidencia de decisiones
CREATE TABLE IF NOT EXISTS public.ai_decision_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_log_id UUID NOT NULL,

    -- Evidencia extraída
    evidence_items JSONB NOT NULL, -- [{type, content, relevance, explanation}]

    -- Resumen
    summary TEXT NOT NULL,
    confidence DECIMAL(5,4) NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unicidad
    UNIQUE(decision_log_id)
);

-- Índice para evidence
CREATE INDEX idx_ai_decision_evidence_log ON public.ai_decision_evidence(decision_log_id);

COMMENT ON TABLE public.ai_decision_evidence IS 'Evidencia extraída para explicar decisiones AI';

-- 6.3 ai_audit_trail: Audit trail inmutable
CREATE TABLE IF NOT EXISTS public.ai_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Tipo de evento
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'decision', 'model_change', 'config_change', 'feedback', 'escalation'
    )),
    event_subtype VARCHAR(50),

    -- Actor
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('system', 'user', 'admin', 'cron')),
    actor_id UUID,
    actor_name VARCHAR(200),

    -- Recurso afectado
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN (
        'conversation', 'model', 'prompt', 'config', 'pattern'
    )),
    resource_id UUID,

    -- Datos del evento
    action VARCHAR(100) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB,

    -- Trazabilidad
    decision_log_id UUID,
    parent_event_id UUID REFERENCES public.ai_audit_trail(id),

    -- Inmutabilidad
    checksum VARCHAR(64) NOT NULL, -- SHA-256

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para audit trail
CREATE INDEX idx_ai_audit_tenant_time ON public.ai_audit_trail(tenant_id, created_at DESC);
CREATE INDEX idx_ai_audit_resource ON public.ai_audit_trail(resource_type, resource_id);
CREATE INDEX idx_ai_audit_actor ON public.ai_audit_trail(actor_type, actor_id);
CREATE INDEX idx_ai_audit_type ON public.ai_audit_trail(tenant_id, event_type, created_at DESC);

COMMENT ON TABLE public.ai_audit_trail IS 'Audit trail inmutable de todas las acciones AI';

-- Trigger para prevenir modificaciones al audit trail
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit trail records cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_immutable ON public.ai_audit_trail;
CREATE TRIGGER audit_immutable
    BEFORE UPDATE OR DELETE ON public.ai_audit_trail
    FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- =====================================================
-- PART 7: RLS POLICIES
-- =====================================================

-- RLS para todas las tablas
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_pattern_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_embedding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_drift_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_drift_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_drift_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feature_values_offline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feature_values_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_finetuning_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_finetuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decision_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_trail ENABLE ROW LEVEL SECURITY;

-- Función helper para RLS
CREATE OR REPLACE FUNCTION public.user_can_access_ai_data(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND tenant_id = p_tenant_id
        AND role IN ('owner', 'admin', 'manager')
    );
$$;

-- Policies para ai_feedback
CREATE POLICY tenant_isolation_ai_feedback ON public.ai_feedback
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_feedback ON public.ai_feedback
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_feedback_aggregations
CREATE POLICY tenant_isolation_ai_feedback_agg ON public.ai_feedback_aggregations
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_feedback_agg ON public.ai_feedback_aggregations
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_prompt_variants
CREATE POLICY tenant_isolation_ai_prompt_variants ON public.ai_prompt_variants
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_prompt_variants ON public.ai_prompt_variants
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_ab_tests
CREATE POLICY tenant_isolation_ai_ab_tests ON public.ai_ab_tests
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_ab_tests ON public.ai_ab_tests
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_pattern_embeddings
CREATE POLICY tenant_isolation_ai_embeddings ON public.ai_pattern_embeddings
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_embeddings ON public.ai_pattern_embeddings
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_embedding_cache (solo service_role)
CREATE POLICY service_role_ai_embedding_cache ON public.ai_embedding_cache
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_drift_baselines
CREATE POLICY tenant_isolation_ai_drift_baselines ON public.ai_drift_baselines
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_drift_baselines ON public.ai_drift_baselines
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_drift_metrics
CREATE POLICY tenant_isolation_ai_drift_metrics ON public.ai_drift_metrics
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_drift_metrics ON public.ai_drift_metrics
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_drift_alerts
CREATE POLICY tenant_isolation_ai_drift_alerts ON public.ai_drift_alerts
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_drift_alerts ON public.ai_drift_alerts
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_feature_definitions
CREATE POLICY tenant_isolation_ai_feature_defs ON public.ai_feature_definitions
    FOR ALL
    USING (tenant_id IS NULL OR public.user_can_access_ai_data(tenant_id))
    WITH CHECK (tenant_id IS NULL OR public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_feature_defs ON public.ai_feature_definitions
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_feature_values_offline
CREATE POLICY tenant_isolation_ai_features_offline ON public.ai_feature_values_offline
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_features_offline ON public.ai_feature_values_offline
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_feature_values_online
CREATE POLICY tenant_isolation_ai_features_online ON public.ai_feature_values_online
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_features_online ON public.ai_feature_values_online
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_finetuning_datasets
CREATE POLICY tenant_isolation_ai_datasets ON public.ai_finetuning_datasets
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_datasets ON public.ai_finetuning_datasets
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_finetuning_jobs
CREATE POLICY tenant_isolation_ai_jobs ON public.ai_finetuning_jobs
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_jobs ON public.ai_finetuning_jobs
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_model_registry
CREATE POLICY tenant_isolation_ai_models ON public.ai_model_registry
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_models ON public.ai_model_registry
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_decision_logs
CREATE POLICY tenant_isolation_ai_decision_logs ON public.ai_decision_logs
    FOR ALL
    USING (public.user_can_access_ai_data(tenant_id))
    WITH CHECK (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_decision_logs ON public.ai_decision_logs
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_decision_evidence (solo service_role, sensible)
CREATE POLICY service_role_ai_evidence ON public.ai_decision_evidence
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Policies para ai_audit_trail
CREATE POLICY tenant_isolation_ai_audit ON public.ai_audit_trail
    FOR SELECT
    USING (public.user_can_access_ai_data(tenant_id));

CREATE POLICY service_role_ai_audit ON public.ai_audit_trail
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- =====================================================
-- PART 8: HELPER FUNCTIONS
-- =====================================================

-- 8.1 Wilson Score Lower Bound
CREATE OR REPLACE FUNCTION public.wilson_score_lower_bound(
    positive INTEGER,
    total INTEGER,
    confidence DECIMAL DEFAULT 0.95
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    z DECIMAL;
    phat DECIMAL;
    result DECIMAL;
BEGIN
    IF total = 0 THEN RETURN 0; END IF;

    -- Z-score para nivel de confianza (0.95 -> 1.96)
    z := CASE
        WHEN confidence = 0.90 THEN 1.645
        WHEN confidence = 0.95 THEN 1.96
        WHEN confidence = 0.99 THEN 2.576
        ELSE 1.96
    END;

    phat := positive::DECIMAL / total::DECIMAL;

    result := (phat + z*z/(2*total) - z * SQRT((phat*(1-phat) + z*z/(4*total))/total)) / (1 + z*z/total);

    RETURN GREATEST(result, 0);
END;
$$;

COMMENT ON FUNCTION public.wilson_score_lower_bound IS 'Calcula Wilson Score lower bound para ranking estadístico';

-- 8.2 Cosine Similarity (para queries sin pgvector operators)
CREATE OR REPLACE FUNCTION public.cosine_similarity(a vector, b vector)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT 1 - (a <=> b);
$$;

COMMENT ON FUNCTION public.cosine_similarity IS 'Calcula similitud coseno entre dos vectores';

-- 8.3 Get AI Learning Context
CREATE OR REPLACE FUNCTION public.get_ai_learning_context_v2(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    v_result := jsonb_build_object(
        -- Top patterns por categoría
        'top_patterns', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'intent', intent,
                'category', category,
                'count', count
            ))
            FROM (
                SELECT intent, category, COUNT(*) as count
                FROM ai_pattern_embeddings
                WHERE tenant_id = p_tenant_id
                GROUP BY intent, category
                ORDER BY count DESC
                LIMIT 10
            ) p
        ), '[]'::jsonb),

        -- Feedback summary
        'feedback_summary', COALESCE((
            SELECT jsonb_build_object(
                'total', COUNT(*),
                'positive_rate', AVG(CASE WHEN is_positive THEN 1 ELSE 0 END),
                'avg_rating', AVG(rating)
            )
            FROM ai_feedback
            WHERE tenant_id = p_tenant_id
            AND created_at > NOW() - INTERVAL '30 days'
        ), '{}'::jsonb),

        -- Active model
        'active_model', COALESCE((
            SELECT jsonb_build_object(
                'id', id,
                'name', name,
                'version', version,
                'model_id', model_id
            )
            FROM ai_model_registry
            WHERE tenant_id = p_tenant_id
            AND deployment_status = 'production'
            ORDER BY deployed_at DESC
            LIMIT 1
        ), NULL),

        -- Drift status
        'drift_status', COALESCE((
            SELECT jsonb_build_object(
                'alerts_active', COUNT(*) FILTER (WHERE status = 'active'),
                'last_check', MAX(created_at)
            )
            FROM ai_drift_alerts
            WHERE tenant_id = p_tenant_id
            AND created_at > NOW() - INTERVAL '24 hours'
        ), '{}'::jsonb)
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_ai_learning_context_v2 IS 'Obtiene contexto de AI Learning 2.0 para un tenant';

-- 8.4 Semantic Search Function
CREATE OR REPLACE FUNCTION public.semantic_search(
    p_tenant_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5,
    p_similarity_threshold DECIMAL DEFAULT 0.7,
    p_source_type VARCHAR DEFAULT NULL,
    p_intent VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content_text TEXT,
    source_type VARCHAR,
    intent VARCHAR,
    similarity DECIMAL,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content_text,
        e.source_type,
        e.intent,
        (1 - (e.embedding <=> p_query_embedding))::DECIMAL as similarity,
        e.metadata
    FROM ai_pattern_embeddings e
    WHERE e.tenant_id = p_tenant_id
    AND (p_source_type IS NULL OR e.source_type = p_source_type)
    AND (p_intent IS NULL OR e.intent = p_intent)
    AND (1 - (e.embedding <=> p_query_embedding)) >= p_similarity_threshold
    ORDER BY e.embedding <=> p_query_embedding
    LIMIT p_limit;

    -- Update search count
    UPDATE ai_pattern_embeddings
    SET search_count = search_count + 1, last_searched_at = NOW()
    WHERE id IN (
        SELECT e2.id
        FROM ai_pattern_embeddings e2
        WHERE e2.tenant_id = p_tenant_id
        AND (1 - (e2.embedding <=> p_query_embedding)) >= p_similarity_threshold
        ORDER BY e2.embedding <=> p_query_embedding
        LIMIT p_limit
    );
END;
$$;

COMMENT ON FUNCTION public.semantic_search IS 'Búsqueda semántica con embeddings usando pgvector';

-- 8.5 Update Search Stats
CREATE OR REPLACE FUNCTION public.update_search_stats(pattern_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE ai_pattern_embeddings
    SET
        search_count = COALESCE(search_count, 0) + 1,
        last_searched_at = NOW()
    WHERE id = ANY(pattern_ids);
END;
$$;

COMMENT ON FUNCTION public.update_search_stats IS 'Actualiza estadísticas de búsqueda para patterns';

-- 8.6 Log AI Decision
CREATE OR REPLACE FUNCTION public.log_ai_decision(
    p_tenant_id UUID,
    p_decision_type VARCHAR,
    p_input_text TEXT,
    p_decision TEXT,
    p_confidence DECIMAL,
    p_model_used VARCHAR,
    p_conversation_id UUID DEFAULT NULL,
    p_candidates JSONB DEFAULT NULL,
    p_reasoning TEXT DEFAULT NULL,
    p_latency_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO ai_decision_logs (
        tenant_id, decision_type, input_text, decision, confidence,
        model_used, conversation_id, candidates, reasoning, latency_ms
    ) VALUES (
        p_tenant_id, p_decision_type, p_input_text, p_decision, p_confidence,
        p_model_used, p_conversation_id, p_candidates, p_reasoning, p_latency_ms
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_ai_decision IS 'Registra una decisión AI en el log';

-- 8.6 Log AI Audit Event
CREATE OR REPLACE FUNCTION public.log_ai_audit_event(
    p_tenant_id UUID,
    p_event_type VARCHAR,
    p_actor_type VARCHAR,
    p_resource_type VARCHAR,
    p_action VARCHAR,
    p_event_subtype VARCHAR DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_actor_name VARCHAR DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_before_state JSONB DEFAULT NULL,
    p_after_state JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_decision_log_id UUID DEFAULT NULL,
    p_parent_event_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_checksum VARCHAR(64);
    v_data_to_hash TEXT;
BEGIN
    -- Calculate checksum for immutability verification
    v_data_to_hash := CONCAT(
        p_tenant_id::TEXT, '|',
        p_event_type, '|',
        p_actor_type, '|',
        p_resource_type, '|',
        p_action, '|',
        COALESCE(p_before_state::TEXT, ''), '|',
        COALESCE(p_after_state::TEXT, ''), '|',
        NOW()::TEXT
    );
    v_checksum := encode(digest(v_data_to_hash, 'sha256'), 'hex');

    INSERT INTO ai_audit_trail (
        tenant_id, event_type, event_subtype, actor_type, actor_id, actor_name,
        resource_type, resource_id, action, before_state, after_state,
        metadata, decision_log_id, parent_event_id, checksum
    ) VALUES (
        p_tenant_id, p_event_type, p_event_subtype, p_actor_type, p_actor_id, p_actor_name,
        p_resource_type, p_resource_id, p_action, p_before_state, p_after_state,
        p_metadata, p_decision_log_id, p_parent_event_id, v_checksum
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_ai_audit_event IS 'Registra un evento en el audit trail inmutable';

-- =====================================================
-- PART 9: TRIGGERS
-- =====================================================

-- 9.1 Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_ai_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER set_updated_at_ai_prompt_variants
    BEFORE UPDATE ON public.ai_prompt_variants
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_ab_tests
    BEFORE UPDATE ON public.ai_ab_tests
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_pattern_embeddings
    BEFORE UPDATE ON public.ai_pattern_embeddings
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_drift_alerts
    BEFORE UPDATE ON public.ai_drift_alerts
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_feature_definitions
    BEFORE UPDATE ON public.ai_feature_definitions
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_finetuning_datasets
    BEFORE UPDATE ON public.ai_finetuning_datasets
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_finetuning_jobs
    BEFORE UPDATE ON public.ai_finetuning_jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

CREATE TRIGGER set_updated_at_ai_model_registry
    BEFORE UPDATE ON public.ai_model_registry
    FOR EACH ROW EXECUTE FUNCTION public.set_ai_updated_at();

-- =====================================================
-- PART 10: GRANTS
-- =====================================================

-- Grants para funciones
GRANT EXECUTE ON FUNCTION public.wilson_score_lower_bound(INTEGER, INTEGER, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wilson_score_lower_bound(INTEGER, INTEGER, DECIMAL) TO service_role;

GRANT EXECUTE ON FUNCTION public.cosine_similarity(vector, vector) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cosine_similarity(vector, vector) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_ai_learning_context_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_learning_context_v2(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.semantic_search(UUID, vector, INTEGER, DECIMAL, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.semantic_search(UUID, vector, INTEGER, DECIMAL, VARCHAR, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION public.log_ai_decision(UUID, VARCHAR, TEXT, TEXT, DECIMAL, VARCHAR, UUID, JSONB, TEXT, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.log_ai_audit_event(UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, UUID, VARCHAR, UUID, JSONB, JSONB, JSONB, UUID, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_search_stats(UUID[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.user_can_access_ai_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_ai_data(UUID) TO service_role;

-- =====================================================
-- COMPLETION
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Migration 153_AI_LEARNING_2_0_CONSOLIDATED.sql COMPLETED';
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'PHASE 1 - RLHF:';
    RAISE NOTICE '  - ai_feedback';
    RAISE NOTICE '  - ai_feedback_aggregations';
    RAISE NOTICE '  - ai_prompt_variants';
    RAISE NOTICE '  - ai_ab_tests';
    RAISE NOTICE '';
    RAISE NOTICE 'PHASE 2 - EMBEDDINGS:';
    RAISE NOTICE '  - ai_pattern_embeddings (with HNSW index)';
    RAISE NOTICE '  - ai_embedding_cache';
    RAISE NOTICE '';
    RAISE NOTICE 'PHASE 3 - DRIFT DETECTION:';
    RAISE NOTICE '  - ai_drift_baselines';
    RAISE NOTICE '  - ai_drift_metrics (partitioned)';
    RAISE NOTICE '  - ai_drift_alerts';
    RAISE NOTICE '';
    RAISE NOTICE 'PHASE 4 - FEATURE STORE:';
    RAISE NOTICE '  - ai_feature_definitions';
    RAISE NOTICE '  - ai_feature_values_offline (partitioned)';
    RAISE NOTICE '  - ai_feature_values_online';
    RAISE NOTICE '';
    RAISE NOTICE 'PHASE 5 - FINE-TUNING:';
    RAISE NOTICE '  - ai_finetuning_datasets';
    RAISE NOTICE '  - ai_finetuning_jobs';
    RAISE NOTICE '  - ai_model_registry';
    RAISE NOTICE '';
    RAISE NOTICE 'PHASE 6 - XAI:';
    RAISE NOTICE '  - ai_decision_logs (partitioned)';
    RAISE NOTICE '  - ai_decision_evidence';
    RAISE NOTICE '  - ai_audit_trail (immutable)';
    RAISE NOTICE '';
    RAISE NOTICE 'HELPER FUNCTIONS:';
    RAISE NOTICE '  - wilson_score_lower_bound()';
    RAISE NOTICE '  - cosine_similarity()';
    RAISE NOTICE '  - get_ai_learning_context_v2()';
    RAISE NOTICE '  - semantic_search()';
    RAISE NOTICE '  - log_ai_decision()';
    RAISE NOTICE '  - log_ai_audit_event()';
    RAISE NOTICE '======================================================';
END $$;
