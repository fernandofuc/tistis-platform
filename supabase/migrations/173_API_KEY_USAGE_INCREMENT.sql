-- =====================================================
-- TIS TIS PLATFORM - API Key Usage Increment Function
-- Migration 135: Función atómica para incremento de uso
-- =====================================================
--
-- PROPÓSITO:
-- Proporcionar una función RPC atómica para incrementar
-- el contador de uso de API keys, evitando race conditions
-- cuando múltiples requests llegan simultáneamente.
--
-- =====================================================

-- =====================================================
-- 1. FUNCIÓN RPC: Incrementar Uso de API Key (Atómico)
-- =====================================================

CREATE OR REPLACE FUNCTION increment_api_key_usage(
    p_key_id UUID,
    p_ip TEXT DEFAULT NULL,
    p_endpoint VARCHAR(255) DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Actualización atómica usando SQL expressions
    -- El trigger reset_api_key_daily_usage se encarga del reset diario
    UPDATE api_keys
    SET
        last_used_at = NOW(),
        last_used_ip = CASE
            WHEN p_ip IS NOT NULL AND p_ip != '' THEN p_ip::INET
            ELSE last_used_ip
        END,
        last_used_endpoint = COALESCE(p_endpoint, last_used_endpoint),
        usage_count = usage_count + 1,
        usage_count_today = CASE
            WHEN usage_reset_date = CURRENT_DATE THEN usage_count_today + 1
            ELSE 1
        END,
        usage_reset_date = CURRENT_DATE
    WHERE id = p_key_id;
END;
$$;

COMMENT ON FUNCTION increment_api_key_usage IS
    'Incrementa atómicamente los contadores de uso de una API key';

-- =====================================================
-- 2. GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION increment_api_key_usage TO service_role;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
