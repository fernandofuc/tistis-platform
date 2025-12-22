-- =====================================================
-- Migration 066: Business Insights Enhancement
-- Adds new insight types for Business IA feature
-- =====================================================

-- 1. Drop and recreate the CHECK constraint to add new insight types
ALTER TABLE ai_business_insights
DROP CONSTRAINT IF EXISTS ai_business_insights_insight_type_check;

ALTER TABLE ai_business_insights
ADD CONSTRAINT ai_business_insights_insight_type_check
CHECK (insight_type IN (
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
    'lead_conversion',        -- Oportunidad de conversión de leads (NUEVO)
    'loyalty_insight',        -- Insight del programa de lealtad (NUEVO)
    'custom'
));

-- 2. Add updated_at column if not exists (for UI tracking)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_business_insights'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE ai_business_insights
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Create index on metadata for seen_at queries (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_insights_unseen
ON ai_business_insights(tenant_id)
WHERE is_active = true
AND dismissed = false
AND (metadata IS NULL OR metadata->>'seen_at' IS NULL);

-- =====================================================
-- END OF MIGRATION
-- =====================================================
