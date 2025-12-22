-- =====================================================
-- TIS TIS PLATFORM - AI Message Learning System
-- Migration 065: Sistema de aprendizaje automático de mensajes
-- =====================================================
-- Este sistema permite que la IA aprenda automáticamente de los
-- mensajes entrantes para entender mejor cómo funciona cada negocio.
--
-- CARACTERÍSTICAS:
-- - Extrae patrones de los mensajes de clientes
-- - Aprende vocabulario y términos específicos del negocio
-- - Detecta horarios frecuentes, servicios populares, objeciones comunes
-- - Genera insights automáticamente
-- - Es específico por vertical (dental, restaurant, etc.)
-- - Solo disponible para planes Essentials+
-- =====================================================

-- =====================================================
-- 1. TABLA: ai_message_patterns
-- Patrones extraídos de los mensajes
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_message_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de patrón detectado
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'service_request',       -- Solicitudes de servicios específicos
        'pricing_inquiry',       -- Consultas de precios
        'scheduling_preference', -- Preferencias de horarios
        'pain_point',           -- Problemas/dolores expresados
        'objection',            -- Objeciones comunes
        'competitor_mention',   -- Menciones de competencia
        'satisfaction',         -- Expresiones de satisfacción
        'complaint',            -- Quejas
        'referral',             -- Referidos
        'vocabulary',           -- Vocabulario/términos del cliente
        'question_pattern',     -- Patrones de preguntas
        'booking_behavior',     -- Comportamiento de reservas
        'follow_up_need',       -- Necesidades de seguimiento
        'urgency_indicator'     -- Indicadores de urgencia
    )),

    -- Contenido del patrón
    pattern_value TEXT NOT NULL,           -- Valor del patrón (ej: "limpieza dental", "dolor de muela")
    normalized_value TEXT,                 -- Valor normalizado para matching
    context_examples TEXT[],               -- Ejemplos de contexto donde se detectó

    -- Métricas
    occurrence_count INTEGER DEFAULT 1,    -- Veces que se ha detectado
    last_occurrence TIMESTAMPTZ DEFAULT NOW(),
    first_occurrence TIMESTAMPTZ DEFAULT NOW(),

    -- Análisis
    sentiment_avg DECIMAL(3,2),            -- Sentimiento promedio (-1 a 1)
    conversion_rate DECIMAL(5,4),          -- Tasa de conversión asociada
    response_quality_avg DECIMAL(3,2),     -- Calidad de respuesta promedio

    -- Datos adicionales específicos del patrón
    metadata JSONB DEFAULT '{}',

    -- Control
    is_active BOOLEAN DEFAULT true,
    auto_detected BOOLEAN DEFAULT true,    -- Si fue detectado automáticamente
    reviewed BOOLEAN DEFAULT false,        -- Si fue revisado por un humano

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Evitar duplicados
    UNIQUE(tenant_id, pattern_type, normalized_value)
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_patterns_tenant ON ai_message_patterns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON ai_message_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_occurrence ON ai_message_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_active ON ai_message_patterns(tenant_id, is_active) WHERE is_active = true;

-- =====================================================
-- 2. TABLA: ai_learned_vocabulary
-- Vocabulario específico del negocio aprendido
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_learned_vocabulary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- El término y su significado
    term TEXT NOT NULL,                    -- Término como lo usa el cliente
    normalized_term TEXT NOT NULL,         -- Versión normalizada
    meaning TEXT,                          -- Significado en contexto del negocio
    synonyms TEXT[],                       -- Sinónimos detectados

    -- Categorización
    category TEXT CHECK (category IN (
        'service',           -- Nombres de servicios
        'procedure',         -- Procedimientos
        'symptom',           -- Síntomas (para medical/dental)
        'location',          -- Ubicaciones/sucursales
        'staff',             -- Personal/doctores
        'time',              -- Expresiones de tiempo
        'price',             -- Expresiones de precio
        'informal',          -- Lenguaje informal/slang
        'technical',         -- Términos técnicos
        'brand',             -- Marcas/productos
        'other'
    )),

    -- Métricas
    usage_count INTEGER DEFAULT 1,
    last_used TIMESTAMPTZ DEFAULT NOW(),

    -- Control
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, normalized_term)
);

CREATE INDEX IF NOT EXISTS idx_vocabulary_tenant ON ai_learned_vocabulary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_category ON ai_learned_vocabulary(category);

-- =====================================================
-- 3. TABLA: ai_business_insights
-- Insights automáticos sobre el negocio
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_business_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Tipo de insight
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'popular_service',        -- Servicio más solicitado
        'peak_hours',             -- Horas pico de consultas
        'common_objection',       -- Objeción común
        'pricing_sensitivity',    -- Sensibilidad a precios
        'competitor_threat',      -- Amenaza de competidor
        'satisfaction_trend',     -- Tendencia de satisfacción
        'booking_pattern',        -- Patrón de reservas
        'communication_style',    -- Estilo de comunicación preferido
        'follow_up_opportunity',  -- Oportunidad de seguimiento
        'upsell_opportunity',     -- Oportunidad de upsell
        'seasonal_pattern',       -- Patrón estacional
        'demographic_insight',    -- Insight demográfico
        'response_improvement',   -- Mejora sugerida de respuesta
        'custom'
    )),

    -- Contenido del insight
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT[],                       -- Evidencia que soporta el insight
    recommendation TEXT,                    -- Recomendación basada en el insight

    -- Métricas
    confidence_score DECIMAL(3,2),          -- Confianza del insight (0-1)
    impact_score DECIMAL(3,2),              -- Impacto potencial (0-1)
    data_points INTEGER DEFAULT 0,          -- Cantidad de datos que lo soportan

    -- Período de análisis
    analysis_period_start TIMESTAMPTZ,
    analysis_period_end TIMESTAMPTZ,

    -- Control
    is_active BOOLEAN DEFAULT true,
    is_actionable BOOLEAN DEFAULT true,     -- Si se puede actuar sobre él
    was_acted_upon BOOLEAN DEFAULT false,   -- Si ya se actuó
    dismissed BOOLEAN DEFAULT false,        -- Si fue descartado por el usuario

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant ON ai_business_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_business_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_active ON ai_business_insights(tenant_id, is_active, dismissed)
    WHERE is_active = true AND dismissed = false;

-- =====================================================
-- 4. TABLA: ai_learning_config
-- Configuración del sistema de aprendizaje por tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_learning_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Activación
    learning_enabled BOOLEAN DEFAULT false,  -- Solo true para Essentials+

    -- Configuración de qué aprender
    learn_vocabulary BOOLEAN DEFAULT true,
    learn_patterns BOOLEAN DEFAULT true,
    learn_scheduling_preferences BOOLEAN DEFAULT true,
    learn_objections BOOLEAN DEFAULT true,
    learn_competitors BOOLEAN DEFAULT true,

    -- Configuración de procesamiento
    min_occurrences_for_pattern INTEGER DEFAULT 3,      -- Mínimo de ocurrencias para crear patrón
    confidence_threshold DECIMAL(3,2) DEFAULT 0.7,      -- Umbral de confianza mínimo
    insight_generation_frequency TEXT DEFAULT 'weekly', -- daily, weekly, monthly

    -- Configuración de privacidad
    anonymize_data BOOLEAN DEFAULT true,     -- Anonimizar datos de clientes
    retention_days INTEGER DEFAULT 90,       -- Días de retención de datos

    -- Vertical específico
    vertical_config JSONB DEFAULT '{}',      -- Configuración específica del vertical

    -- Última ejecución
    last_learning_run TIMESTAMPTZ,
    last_insight_generation TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_config_tenant ON ai_learning_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_learning_config_enabled ON ai_learning_config(learning_enabled)
    WHERE learning_enabled = true;

-- =====================================================
-- 5. TABLA: ai_learning_queue
-- Cola de mensajes pendientes de procesar para aprendizaje
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_learning_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID,                         -- ID del mensaje a procesar

    -- Contenido
    message_content TEXT NOT NULL,
    message_role TEXT NOT NULL,              -- 'lead' o 'assistant'
    channel TEXT,                            -- whatsapp, instagram, etc.

    -- Contexto
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    detected_intent TEXT,
    detected_signals JSONB,
    ai_response TEXT,                        -- Respuesta que dio el AI (si aplica)

    -- Estado
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Resultados
    patterns_extracted JSONB,                -- Patrones extraídos
    vocabulary_extracted JSONB,              -- Vocabulario extraído

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Índice para evitar duplicados
    UNIQUE(tenant_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_queue_pending ON ai_learning_queue(status, created_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_learning_queue_tenant ON ai_learning_queue(tenant_id, status);

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- ai_message_patterns
ALTER TABLE ai_message_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view patterns"
    ON ai_message_patterns FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can insert patterns"
    ON ai_message_patterns FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can update patterns"
    ON ai_message_patterns FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can delete patterns"
    ON ai_message_patterns FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- Service role needs full access for background processing
CREATE POLICY "Service role full access patterns"
    ON ai_message_patterns FOR ALL
    USING (auth.role() = 'service_role');

-- ai_learned_vocabulary
ALTER TABLE ai_learned_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vocabulary"
    ON ai_learned_vocabulary FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can insert vocabulary"
    ON ai_learned_vocabulary FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can update vocabulary"
    ON ai_learned_vocabulary FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can delete vocabulary"
    ON ai_learned_vocabulary FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- Service role needs full access for background processing
CREATE POLICY "Service role full access vocabulary"
    ON ai_learned_vocabulary FOR ALL
    USING (auth.role() = 'service_role');

-- ai_business_insights
ALTER TABLE ai_business_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights"
    ON ai_business_insights FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can insert insights"
    ON ai_business_insights FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can update insights"
    ON ai_business_insights FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Users can delete insights"
    ON ai_business_insights FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

-- Service role needs full access for background processing
CREATE POLICY "Service role full access insights"
    ON ai_business_insights FOR ALL
    USING (auth.role() = 'service_role');

-- ai_learning_config
ALTER TABLE ai_learning_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view learning config"
    ON ai_learning_config FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    ));

CREATE POLICY "Admins can insert learning config"
    ON ai_learning_config FOR INSERT
    WITH CHECK (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    ));

CREATE POLICY "Admins can update learning config"
    ON ai_learning_config FOR UPDATE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    ));

CREATE POLICY "Admins can delete learning config"
    ON ai_learning_config FOR DELETE
    USING (tenant_id IN (
        SELECT tenant_id FROM user_roles
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    ));

-- Service role needs full access for background processing
CREATE POLICY "Service role full access learning config"
    ON ai_learning_config FOR ALL
    USING (auth.role() = 'service_role');

-- ai_learning_queue (solo service_role)
ALTER TABLE ai_learning_queue ENABLE ROW LEVEL SECURITY;

-- Solo el service_role puede acceder a la cola (usando auth.role() que es la forma correcta)
CREATE POLICY "Service role full access queue"
    ON ai_learning_queue FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- 7. FUNCIÓN: Agregar mensaje a la cola de aprendizaje
-- =====================================================
CREATE OR REPLACE FUNCTION queue_message_for_learning(
    p_tenant_id UUID,
    p_conversation_id UUID,
    p_message_id UUID,
    p_message_content TEXT,
    p_message_role TEXT,
    p_channel TEXT DEFAULT 'whatsapp',
    p_lead_id UUID DEFAULT NULL,
    p_detected_intent TEXT DEFAULT NULL,
    p_detected_signals JSONB DEFAULT NULL,
    p_ai_response TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    config_record RECORD;
    queue_id UUID;
BEGIN
    -- Verificar si el aprendizaje está habilitado para este tenant
    SELECT * INTO config_record
    FROM ai_learning_config
    WHERE tenant_id = p_tenant_id AND learning_enabled = true;

    IF NOT FOUND THEN
        RETURN NULL; -- Aprendizaje no habilitado
    END IF;

    -- Insertar en la cola (ignorar si ya existe)
    INSERT INTO ai_learning_queue (
        tenant_id,
        conversation_id,
        message_id,
        message_content,
        message_role,
        channel,
        lead_id,
        detected_intent,
        detected_signals,
        ai_response
    ) VALUES (
        p_tenant_id,
        p_conversation_id,
        p_message_id,
        p_message_content,
        p_message_role,
        p_channel,
        p_lead_id,
        p_detected_intent,
        p_detected_signals,
        p_ai_response
    )
    ON CONFLICT (tenant_id, message_id) DO NOTHING
    RETURNING id INTO queue_id;

    RETURN queue_id;
END;
$$;

GRANT EXECUTE ON FUNCTION queue_message_for_learning TO authenticated;
GRANT EXECUTE ON FUNCTION queue_message_for_learning TO service_role;

-- =====================================================
-- 8. FUNCIÓN: Actualizar o crear patrón
-- =====================================================
CREATE OR REPLACE FUNCTION upsert_message_pattern(
    p_tenant_id UUID,
    p_pattern_type TEXT,
    p_pattern_value TEXT,
    p_context_example TEXT DEFAULT NULL,
    p_sentiment DECIMAL DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    normalized TEXT;
    pattern_id UUID;
BEGIN
    -- Normalizar el valor
    normalized := lower(trim(p_pattern_value));

    -- Intentar insertar o actualizar
    INSERT INTO ai_message_patterns (
        tenant_id,
        pattern_type,
        pattern_value,
        normalized_value,
        context_examples,
        sentiment_avg,
        metadata
    ) VALUES (
        p_tenant_id,
        p_pattern_type,
        p_pattern_value,
        normalized,
        CASE WHEN p_context_example IS NOT NULL THEN ARRAY[p_context_example] ELSE ARRAY[]::TEXT[] END,
        p_sentiment,
        p_metadata
    )
    ON CONFLICT (tenant_id, pattern_type, normalized_value) DO UPDATE SET
        occurrence_count = ai_message_patterns.occurrence_count + 1,
        last_occurrence = NOW(),
        context_examples = CASE
            WHEN p_context_example IS NOT NULL
                AND NOT p_context_example = ANY(ai_message_patterns.context_examples)
                AND COALESCE(array_length(ai_message_patterns.context_examples, 1), 0) < 10
            THEN array_append(ai_message_patterns.context_examples, p_context_example)
            ELSE ai_message_patterns.context_examples
        END,
        sentiment_avg = CASE
            WHEN p_sentiment IS NOT NULL
            THEN (COALESCE(ai_message_patterns.sentiment_avg, 0) * ai_message_patterns.occurrence_count + p_sentiment)
                 / (ai_message_patterns.occurrence_count + 1)
            ELSE ai_message_patterns.sentiment_avg
        END,
        metadata = ai_message_patterns.metadata || p_metadata,
        updated_at = NOW()
    RETURNING id INTO pattern_id;

    RETURN pattern_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_message_pattern TO service_role;

-- =====================================================
-- 9. FUNCIÓN: Obtener patrones para enriquecer prompts
-- =====================================================
CREATE OR REPLACE FUNCTION get_tenant_learning_context(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    result := jsonb_build_object(
        -- Patrones más frecuentes por tipo
        'top_service_requests', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'service', pattern_value,
                'frequency', occurrence_count
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'service_request'
                AND is_active = true
            LIMIT 10
        ), '[]'::jsonb),

        'common_objections', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'objection', pattern_value,
                'frequency', occurrence_count,
                'examples', context_examples[1:2]
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'objection'
                AND is_active = true
            LIMIT 5
        ), '[]'::jsonb),

        'scheduling_preferences', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'preference', pattern_value,
                'frequency', occurrence_count
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'scheduling_preference'
                AND is_active = true
            LIMIT 5
        ), '[]'::jsonb),

        'pain_points', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'pain', pattern_value,
                'frequency', occurrence_count
            ) ORDER BY occurrence_count DESC)
            FROM ai_message_patterns
            WHERE tenant_id = p_tenant_id
                AND pattern_type = 'pain_point'
                AND is_active = true
            LIMIT 10
        ), '[]'::jsonb),

        -- Vocabulario aprendido
        'learned_vocabulary', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'term', term,
                'meaning', meaning,
                'category', category
            ) ORDER BY usage_count DESC)
            FROM ai_learned_vocabulary
            WHERE tenant_id = p_tenant_id
                AND is_active = true
            LIMIT 20
        ), '[]'::jsonb),

        -- Insights activos
        'active_insights', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'type', insight_type,
                'title', title,
                'recommendation', recommendation
            ) ORDER BY impact_score DESC)
            FROM ai_business_insights
            WHERE tenant_id = p_tenant_id
                AND is_active = true
                AND dismissed = false
            LIMIT 5
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_learning_context TO authenticated;
GRANT EXECUTE ON FUNCTION get_tenant_learning_context TO service_role;

-- =====================================================
-- 10. TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_learning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patterns_updated_at
    BEFORE UPDATE ON ai_message_patterns
    FOR EACH ROW EXECUTE FUNCTION update_learning_updated_at();

CREATE TRIGGER update_vocabulary_updated_at
    BEFORE UPDATE ON ai_learned_vocabulary
    FOR EACH ROW EXECUTE FUNCTION update_learning_updated_at();

CREATE TRIGGER update_insights_updated_at
    BEFORE UPDATE ON ai_business_insights
    FOR EACH ROW EXECUTE FUNCTION update_learning_updated_at();

CREATE TRIGGER update_learning_config_updated_at
    BEFORE UPDATE ON ai_learning_config
    FOR EACH ROW EXECUTE FUNCTION update_learning_updated_at();

-- =====================================================
-- 11. COMENTARIOS
-- =====================================================
COMMENT ON TABLE ai_message_patterns IS
'Patrones extraídos automáticamente de los mensajes de clientes.
Incluye: solicitudes de servicios, objeciones, preferencias de horarios, etc.';

COMMENT ON TABLE ai_learned_vocabulary IS
'Vocabulario específico del negocio aprendido de las conversaciones.
Ayuda al AI a entender términos y expresiones propias de cada negocio.';

COMMENT ON TABLE ai_business_insights IS
'Insights automáticos generados del análisis de mensajes.
Incluye: servicios populares, horarios pico, objeciones comunes, etc.';

COMMENT ON TABLE ai_learning_config IS
'Configuración del sistema de aprendizaje por tenant.
Solo habilitado para planes Essentials+.';

COMMENT ON TABLE ai_learning_queue IS
'Cola de mensajes pendientes de procesar para aprendizaje.
El servicio de aprendizaje procesa estos mensajes en background.';

COMMENT ON FUNCTION queue_message_for_learning IS
'Agrega un mensaje a la cola de aprendizaje si el tenant tiene el aprendizaje habilitado.';

COMMENT ON FUNCTION get_tenant_learning_context IS
'Obtiene el contexto de aprendizaje para enriquecer los prompts del AI.
Incluye patrones, vocabulario e insights más relevantes.';
