-- =====================================================
-- TIS TIS PLATFORM - Webhook Dead Letter Queue
-- Migration 076: Sistema de cola de mensajes fallidos para webhooks
-- =====================================================
-- Este sistema captura webhooks que fallan en su procesamiento
-- para reintentos posteriores y auditoría.
--
-- CARACTERÍSTICAS:
-- - Almacena webhooks fallidos de cualquier canal (whatsapp, stripe, etc.)
-- - Permite reintentos manuales o automáticos
-- - Mantiene historial para debugging y auditoría
-- - Soporta múltiples canales de webhooks
-- =====================================================

-- =====================================================
-- 1. TABLA: webhook_dead_letters
-- Cola de webhooks fallidos para reintento
-- =====================================================
CREATE TABLE IF NOT EXISTS public.webhook_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación del webhook
    channel VARCHAR(50) NOT NULL,              -- whatsapp, stripe, vapi, etc.
    tenant_slug VARCHAR(100),                  -- Slug del tenant (puede ser null para webhooks globales)
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

    -- Payload original
    payload JSONB NOT NULL,                    -- Payload completo del webhook
    headers JSONB DEFAULT '{}',                -- Headers relevantes (sin secrets)

    -- Información del error
    error_message TEXT NOT NULL,               -- Mensaje de error
    error_stack TEXT,                          -- Stack trace si disponible

    -- Control de reintentos
    retry_count INTEGER DEFAULT 0,             -- Número de reintentos realizados
    max_retries INTEGER DEFAULT 3,             -- Máximo de reintentos permitidos
    next_retry_at TIMESTAMPTZ,                 -- Cuándo intentar de nuevo
    last_retry_at TIMESTAMPTZ,                 -- Último intento

    -- Estado
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Pendiente de reintento
        'processing',   -- En proceso de reintento
        'completed',    -- Procesado exitosamente en reintento
        'failed',       -- Fallido después de todos los reintentos
        'dismissed'     -- Descartado manualmente
    )),

    -- Resultado del reintento exitoso
    resolution_notes TEXT,                     -- Notas sobre la resolución
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

-- Índice principal para buscar webhooks pendientes de reintento
CREATE INDEX IF NOT EXISTS idx_dlq_pending_retry
    ON public.webhook_dead_letters(status, next_retry_at)
    WHERE status = 'pending';

-- Índice por canal para filtrar por tipo de webhook
CREATE INDEX IF NOT EXISTS idx_dlq_channel
    ON public.webhook_dead_letters(channel);

-- Índice por tenant para filtrar por cliente
CREATE INDEX IF NOT EXISTS idx_dlq_tenant
    ON public.webhook_dead_letters(tenant_id)
    WHERE tenant_id IS NOT NULL;

-- Índice por tenant_slug para búsqueda rápida en webhooks
CREATE INDEX IF NOT EXISTS idx_dlq_tenant_slug
    ON public.webhook_dead_letters(tenant_slug)
    WHERE tenant_slug IS NOT NULL;

-- Índice por fecha para limpieza y auditoría
CREATE INDEX IF NOT EXISTS idx_dlq_created_at
    ON public.webhook_dead_letters(created_at);

-- Índice para webhooks fallidos (monitoreo)
CREATE INDEX IF NOT EXISTS idx_dlq_failed
    ON public.webhook_dead_letters(status, channel)
    WHERE status = 'failed';

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

ALTER TABLE public.webhook_dead_letters ENABLE ROW LEVEL SECURITY;

-- Service role tiene acceso completo (webhooks usan service role key)
CREATE POLICY "Service role full access to webhook_dead_letters"
    ON public.webhook_dead_letters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Admins del tenant pueden ver sus dead letters
CREATE POLICY "Tenant admins can view their dead letters"
    ON public.webhook_dead_letters
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Admins pueden marcar como dismissed
CREATE POLICY "Tenant admins can update their dead letters"
    ON public.webhook_dead_letters
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- =====================================================
-- 4. TRIGGER: Updated At
-- =====================================================

CREATE OR REPLACE FUNCTION update_dlq_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhook_dead_letters_updated_at
    BEFORE UPDATE ON public.webhook_dead_letters
    FOR EACH ROW EXECUTE FUNCTION update_dlq_updated_at();

-- =====================================================
-- 5. FUNCIÓN: Encolar webhook fallido
-- =====================================================

CREATE OR REPLACE FUNCTION enqueue_dead_letter(
    p_channel VARCHAR(50),
    p_tenant_slug VARCHAR(100) DEFAULT NULL,
    p_payload JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT 'Unknown error',
    p_error_stack TEXT DEFAULT NULL,
    p_headers JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_dlq_id UUID;
    v_next_retry TIMESTAMPTZ;
BEGIN
    -- Intentar obtener tenant_id desde tenant_slug
    IF p_tenant_slug IS NOT NULL THEN
        SELECT id INTO v_tenant_id
        FROM tenants
        WHERE slug = p_tenant_slug;
    END IF;

    -- Calcular próximo reintento (exponential backoff: 1min, 5min, 30min)
    v_next_retry := NOW() + INTERVAL '1 minute';

    -- Insertar en dead letter queue
    INSERT INTO webhook_dead_letters (
        channel,
        tenant_slug,
        tenant_id,
        payload,
        headers,
        error_message,
        error_stack,
        next_retry_at,
        status
    ) VALUES (
        p_channel,
        p_tenant_slug,
        v_tenant_id,
        p_payload,
        p_headers,
        p_error_message,
        p_error_stack,
        v_next_retry,
        'pending'
    )
    RETURNING id INTO v_dlq_id;

    RETURN v_dlq_id;
END;
$$;

GRANT EXECUTE ON FUNCTION enqueue_dead_letter TO service_role;

-- =====================================================
-- 6. FUNCIÓN: Procesar reintento de dead letter
-- =====================================================

CREATE OR REPLACE FUNCTION mark_dlq_for_retry(p_dlq_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_retries INTEGER;
    v_max_retries INTEGER;
    v_next_retry TIMESTAMPTZ;
BEGIN
    -- Obtener estado actual
    SELECT retry_count, max_retries
    INTO v_current_retries, v_max_retries
    FROM webhook_dead_letters
    WHERE id = p_dlq_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Verificar si ya alcanzó máximo de reintentos
    IF v_current_retries >= v_max_retries THEN
        UPDATE webhook_dead_letters
        SET status = 'failed',
            resolution_notes = 'Max retries exceeded'
        WHERE id = p_dlq_id;
        RETURN FALSE;
    END IF;

    -- Calcular próximo reintento con exponential backoff
    -- Retry 1: 5 min, Retry 2: 30 min, Retry 3: 2 hours
    v_next_retry := NOW() + (INTERVAL '5 minutes' * POWER(6, v_current_retries));

    -- Marcar para reintento
    UPDATE webhook_dead_letters
    SET status = 'processing',
        retry_count = retry_count + 1,
        last_retry_at = NOW()
    WHERE id = p_dlq_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_dlq_for_retry TO service_role;

-- =====================================================
-- 7. FUNCIÓN: Marcar dead letter como completado
-- =====================================================

CREATE OR REPLACE FUNCTION resolve_dead_letter(
    p_dlq_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE webhook_dead_letters
    SET status = 'completed',
        resolution_notes = p_notes,
        resolved_at = NOW()
    WHERE id = p_dlq_id;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_dead_letter TO service_role;

-- =====================================================
-- 8. FUNCIÓN: Obtener dead letters pendientes para reintento
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_dead_letters(
    p_channel VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    channel VARCHAR(50),
    tenant_slug VARCHAR(100),
    payload JSONB,
    retry_count INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dl.id,
        dl.channel,
        dl.tenant_slug,
        dl.payload,
        dl.retry_count,
        dl.created_at
    FROM webhook_dead_letters dl
    WHERE dl.status = 'pending'
        AND dl.next_retry_at <= NOW()
        AND (p_channel IS NULL OR dl.channel = p_channel)
    ORDER BY dl.next_retry_at ASC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pending_dead_letters TO service_role;

-- =====================================================
-- 9. FUNCIÓN: Limpiar dead letters antiguos
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_dead_letters(
    p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Eliminar dead letters completados o fallidos más antiguos que X días
    DELETE FROM webhook_dead_letters
    WHERE status IN ('completed', 'failed', 'dismissed')
        AND created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_dead_letters TO service_role;

-- =====================================================
-- 10. ESTADÍSTICAS ÚTILES
-- =====================================================

CREATE OR REPLACE FUNCTION get_dlq_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'total_processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'total_completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'total_failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'by_channel', jsonb_object_agg(
            channel,
            count_per_channel
        )
    ) INTO result
    FROM (
        SELECT
            channel,
            COUNT(*) as count_per_channel,
            status
        FROM webhook_dead_letters
        WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        GROUP BY channel, status
    ) sub;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_dlq_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_dlq_stats TO authenticated;

-- =====================================================
-- 11. COMENTARIOS
-- =====================================================

COMMENT ON TABLE public.webhook_dead_letters IS
'Cola de webhooks fallidos para reintento y auditoría.
Almacena webhooks de cualquier canal (whatsapp, stripe, vapi) que fallaron en su procesamiento.
Permite reintentos automáticos con exponential backoff.';

COMMENT ON COLUMN public.webhook_dead_letters.channel IS
'Canal del webhook: whatsapp, stripe, vapi, etc.';

COMMENT ON COLUMN public.webhook_dead_letters.payload IS
'Payload completo del webhook original en formato JSON';

COMMENT ON COLUMN public.webhook_dead_letters.retry_count IS
'Número de reintentos realizados. Máximo por defecto: 3';

COMMENT ON COLUMN public.webhook_dead_letters.next_retry_at IS
'Timestamp del próximo reintento programado. Usa exponential backoff.';

COMMENT ON FUNCTION enqueue_dead_letter IS
'Encola un webhook fallido para reintento posterior.
Calcula automáticamente el próximo reintento.';

COMMENT ON FUNCTION get_pending_dead_letters IS
'Obtiene webhooks pendientes de reintento.
Usado por el cron job de reintentos.';

COMMENT ON FUNCTION cleanup_old_dead_letters IS
'Limpia dead letters antiguos.
Por defecto mantiene los últimos 30 días.';

-- =====================================================
-- 12. VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  Migration 076: Webhook Dead Letter Queue';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  ';
    RAISE NOTICE '  TABLA CREADA:';
    RAISE NOTICE '  - webhook_dead_letters: Cola de webhooks fallidos';
    RAISE NOTICE '  ';
    RAISE NOTICE '  INDICES:';
    RAISE NOTICE '  - idx_dlq_pending_retry: Búsqueda de pendientes';
    RAISE NOTICE '  - idx_dlq_channel: Filtro por canal';
    RAISE NOTICE '  - idx_dlq_tenant: Filtro por tenant';
    RAISE NOTICE '  - idx_dlq_created_at: Ordenamiento por fecha';
    RAISE NOTICE '  - idx_dlq_failed: Monitoreo de fallidos';
    RAISE NOTICE '  ';
    RAISE NOTICE '  FUNCIONES:';
    RAISE NOTICE '  - enqueue_dead_letter(): Encolar webhook fallido';
    RAISE NOTICE '  - mark_dlq_for_retry(): Marcar para reintento';
    RAISE NOTICE '  - resolve_dead_letter(): Marcar como completado';
    RAISE NOTICE '  - get_pending_dead_letters(): Obtener pendientes';
    RAISE NOTICE '  - cleanup_old_dead_letters(): Limpiar antiguos';
    RAISE NOTICE '  - get_dlq_stats(): Estadísticas del DLQ';
    RAISE NOTICE '  ';
    RAISE NOTICE '  RLS:';
    RAISE NOTICE '  - Service role: Acceso completo';
    RAISE NOTICE '  - Tenant admins: Lectura y actualización';
    RAISE NOTICE '  ';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '  ';
    RAISE NOTICE '  USO DESDE CÓDIGO:';
    RAISE NOTICE '  ';
    RAISE NOTICE '  // En catch de webhook:';
    RAISE NOTICE '  await supabase.from("webhook_dead_letters").insert({';
    RAISE NOTICE '    channel: "whatsapp",';
    RAISE NOTICE '    tenant_slug: tenantSlug,';
    RAISE NOTICE '    payload: payload,';
    RAISE NOTICE '    error_message: error.message,';
    RAISE NOTICE '    status: "pending"';
    RAISE NOTICE '  });';
    RAISE NOTICE '  ';
    RAISE NOTICE '  // O usar la función:';
    RAISE NOTICE '  SELECT enqueue_dead_letter(';
    RAISE NOTICE '    "whatsapp",';
    RAISE NOTICE '    "tenant-slug",';
    RAISE NOTICE '    payload::jsonb,';
    RAISE NOTICE '    "Error message"';
    RAISE NOTICE '  );';
    RAISE NOTICE '  ';
END $$;
