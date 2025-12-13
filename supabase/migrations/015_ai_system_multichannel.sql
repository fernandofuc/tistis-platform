-- =====================================================
-- TIS TIS PLATFORM - AI SYSTEM MULTI-CHANNEL
-- Migration: 015_ai_system_multichannel.sql
-- Date: December 12, 2024
-- Version: 1.0
--
-- PURPOSE: Sistema completo de AI para atender clientes
-- a traves de multiples canales (WhatsApp, Instagram,
-- Facebook, TikTok) con procesamiento asincrono y
-- scoring automatico de leads.
--
-- INCLUDES:
-- - Templates de prompts por vertical
-- - Configuracion AI por tenant
-- - Conexiones de canales por tenant
-- - Reglas de scoring automatico
-- - Cola de trabajos asincrona
-- - Logs de uso y costos de AI
-- - Historial de scores de leads
--
-- ARCHITECTURE:
-- Webhook -> Job Queue -> AI Processor -> Response
--                |
--                v
--         Lead Scoring -> Escalation Rules
-- =====================================================

-- =====================================================
-- PARTE A: AI PROMPT TEMPLATES (Base por Vertical)
-- Templates predefinidos que heredan los tenants
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificacion
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN (
        'dental', 'medical', 'restaurant', 'gym', 'services', 'retail', 'other'
    )),
    prompt_key VARCHAR(100) NOT NULL,

    -- Contenido del prompt
    prompt_name VARCHAR(255) NOT NULL,
    prompt_description TEXT,
    prompt_text TEXT NOT NULL,

    -- Variables disponibles para este prompt
    -- Ejemplo: ["clinic_name", "branches", "doctors", "services", "hours", "faqs"]
    available_variables TEXT[] DEFAULT '{}',

    -- Formato de respuesta esperado
    response_format TEXT CHECK (response_format IN (
        'structured', 'free_text', 'json'
    )) DEFAULT 'structured',

    -- Configuracion
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un solo template default por vertical y key
    UNIQUE(vertical, prompt_key, is_default)
);

CREATE INDEX idx_ai_prompt_templates_vertical ON public.ai_prompt_templates(vertical);
CREATE INDEX idx_ai_prompt_templates_key ON public.ai_prompt_templates(vertical, prompt_key);
CREATE INDEX idx_ai_prompt_templates_default ON public.ai_prompt_templates(vertical, is_default) WHERE is_default = true;

COMMENT ON TABLE public.ai_prompt_templates IS
'Templates de prompts de AI predefinidos por vertical. Los tenants heredan estos templates y solo personalizan instrucciones adicionales.';

-- =====================================================
-- PARTE B: AI TENANT CONFIG (Configuracion por Cliente)
-- Cada tenant puede personalizar su agente AI
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_tenant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Estado general del AI
    ai_enabled BOOLEAN DEFAULT true,

    -- Modelo de AI a usar
    ai_model VARCHAR(100) DEFAULT 'claude-3-haiku-20240307' CHECK (ai_model IN (
        'claude-3-haiku-20240307',
        'claude-3-sonnet-20240229',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4-turbo'
    )),

    -- Personalidad del agente
    ai_personality VARCHAR(50) DEFAULT 'professional' CHECK (ai_personality IN (
        'professional',           -- Formal y educado
        'professional_friendly',  -- Profesional pero cercano
        'casual',                 -- Informal y amigable
        'formal'                  -- Muy formal
    )),

    -- Temperatura del modelo (creatividad)
    ai_temperature DECIMAL(2,1) DEFAULT 0.7 CHECK (ai_temperature >= 0 AND ai_temperature <= 1),

    -- Limite de tokens por respuesta
    max_tokens INTEGER DEFAULT 500 CHECK (max_tokens >= 100 AND max_tokens <= 2000),

    -- Instrucciones personalizadas del cliente
    -- Estas se agregan al prompt base
    custom_instructions TEXT,

    -- Palabras clave que disparan escalacion inmediata
    escalation_keywords TEXT[] DEFAULT ARRAY[
        'hablar con persona',
        'speak to human',
        'queja',
        'complaint',
        'emergencia',
        'emergency',
        'urgente',
        'urgent'
    ],

    -- Configuracion de horarios
    -- Fuera de horario: respuesta automatica diferente
    out_of_hours_enabled BOOLEAN DEFAULT true,
    out_of_hours_message TEXT DEFAULT 'Gracias por contactarnos. Nuestro horario de atencion es de Lunes a Viernes de 9:00 AM a 6:00 PM. Te responderemos en cuanto estemos disponibles.',

    -- Configuracion de respuesta
    auto_greeting_enabled BOOLEAN DEFAULT true,
    auto_greeting_message TEXT DEFAULT 'Bienvenido. Soy el asistente virtual. En que puedo ayudarte?',

    -- Limites de conversacion
    max_turns_before_escalation INTEGER DEFAULT 10,
    escalate_on_hot_lead BOOLEAN DEFAULT true,

    -- Idiomas soportados (auto-detecta y responde)
    supported_languages TEXT[] DEFAULT ARRAY['es', 'en'],
    default_language VARCHAR(10) DEFAULT 'es',

    -- Formato de moneda para precios
    currency VARCHAR(3) DEFAULT 'USD',
    currency_format VARCHAR(20) DEFAULT '${amount} USD',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un config por tenant
    UNIQUE(tenant_id)
);

CREATE INDEX idx_ai_tenant_config_tenant ON public.ai_tenant_config(tenant_id);
CREATE INDEX idx_ai_tenant_config_enabled ON public.ai_tenant_config(tenant_id) WHERE ai_enabled = true;

COMMENT ON TABLE public.ai_tenant_config IS
'Configuracion del agente AI personalizada por tenant. El cliente puede ajustar modelo, personalidad, instrucciones especiales, etc.';

-- Trigger para updated_at
CREATE TRIGGER update_ai_tenant_config_updated_at
    BEFORE UPDATE ON public.ai_tenant_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE C: CHANNEL CONNECTIONS (Conexiones por Canal)
-- Cada tenant puede conectar WhatsApp, IG, FB, TikTok
-- =====================================================

CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Tipo de canal
    channel VARCHAR(50) NOT NULL CHECK (channel IN (
        'whatsapp',
        'instagram',
        'facebook',
        'tiktok',
        'webchat'
    )),

    -- Estado de la conexion
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Esperando configuracion
        'configuring',  -- En proceso de conexion
        'connected',    -- Activo y funcionando
        'disconnected', -- Desconectado por el usuario
        'error',        -- Error de conexion
        'suspended'     -- Suspendido por TIS TIS
    )),

    -- AI habilitado para este canal especifico
    ai_enabled BOOLEAN DEFAULT true,

    -- Credenciales y configuracion (encriptadas en produccion)
    -- WhatsApp
    whatsapp_phone_number_id VARCHAR(255),
    whatsapp_business_account_id VARCHAR(255),
    whatsapp_access_token TEXT,
    whatsapp_verify_token VARCHAR(255),
    whatsapp_webhook_url TEXT,

    -- Instagram / Facebook (usan Meta Graph API)
    meta_page_id VARCHAR(255),
    meta_access_token TEXT,
    meta_app_id VARCHAR(255),

    -- TikTok
    tiktok_business_id VARCHAR(255),
    tiktok_access_token TEXT,

    -- Configuracion generica
    webhook_secret VARCHAR(255),

    -- Metadata de la conexion
    connection_name VARCHAR(255),
    connection_metadata JSONB DEFAULT '{}',

    -- Tracking de errores
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    error_count INTEGER DEFAULT 0,

    -- Estadisticas
    messages_received INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,

    -- Timestamps
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un canal por tipo por branch (o tenant si branch es null)
    UNIQUE(tenant_id, branch_id, channel)
);

CREATE INDEX idx_channel_connections_tenant ON public.channel_connections(tenant_id);
CREATE INDEX idx_channel_connections_branch ON public.channel_connections(branch_id);
CREATE INDEX idx_channel_connections_channel ON public.channel_connections(tenant_id, channel);
CREATE INDEX idx_channel_connections_status ON public.channel_connections(tenant_id, status);
CREATE INDEX idx_channel_connections_whatsapp ON public.channel_connections(whatsapp_phone_number_id) WHERE channel = 'whatsapp';

COMMENT ON TABLE public.channel_connections IS
'Conexiones de canales de comunicacion por tenant/branch. Cada sucursal puede tener su propio WhatsApp, o compartir uno a nivel tenant.';

-- Trigger para updated_at
CREATE TRIGGER update_channel_connections_updated_at
    BEFORE UPDATE ON public.channel_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE D: AI SCORING RULES (Reglas de Scoring)
-- Sistema de puntuacion automatica de leads
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_scoring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Si tenant_id es NULL, es regla global (default)
    is_global BOOLEAN DEFAULT false,

    -- Identificacion de la regla
    signal_name VARCHAR(100) NOT NULL,
    signal_display_name VARCHAR(255) NOT NULL,
    signal_description TEXT,

    -- Puntos a sumar/restar
    points INTEGER NOT NULL CHECK (points >= -100 AND points <= 100),

    -- Tipo de deteccion
    detection_type VARCHAR(50) NOT NULL CHECK (detection_type IN (
        'keyword',      -- Detectar palabras clave en mensaje
        'intent',       -- Detectar intencion del AI
        'behavior',     -- Detectar comportamiento (no responde, etc)
        'attribute',    -- Atributo del lead (es de USA, etc)
        'engagement'    -- Nivel de engagement (muchos mensajes, etc)
    )),

    -- Configuracion de deteccion
    -- Para keyword: ["dolor", "duele", "urgente"]
    -- Para intent: ["BOOK_APPOINTMENT", "PRICE_INQUIRY"]
    -- Para behavior: {"type": "no_response", "hours": 24}
    detection_config JSONB NOT NULL DEFAULT '{}',

    -- Categoria para organizacion
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN (
        'urgency',      -- Urgencia/dolor
        'intent',       -- Intencion de compra
        'engagement',   -- Engagement con el chat
        'demographics', -- Caracteristicas del lead
        'negative'      -- Senales negativas
    )),

    -- Orden de evaluacion (menor = primero)
    evaluation_order INTEGER DEFAULT 100,

    -- Estado
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Regla unica por signal_name por tenant
    UNIQUE(tenant_id, signal_name)
);

CREATE INDEX idx_ai_scoring_rules_tenant ON public.ai_scoring_rules(tenant_id);
CREATE INDEX idx_ai_scoring_rules_global ON public.ai_scoring_rules(is_global) WHERE is_global = true;
CREATE INDEX idx_ai_scoring_rules_active ON public.ai_scoring_rules(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_ai_scoring_rules_category ON public.ai_scoring_rules(tenant_id, category);

COMMENT ON TABLE public.ai_scoring_rules IS
'Reglas para scoring automatico de leads. El AI detecta senales en la conversacion y suma/resta puntos al lead.';

-- =====================================================
-- PARTE E: LEAD SCORE HISTORY (Historial de Scores)
-- Auditoria de cambios en score de leads
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

    -- Scores
    previous_score INTEGER NOT NULL,
    new_score INTEGER NOT NULL,
    score_change INTEGER NOT NULL,

    -- Clasificacion
    previous_classification VARCHAR(20),
    new_classification VARCHAR(20),

    -- Que causo el cambio
    change_source VARCHAR(50) NOT NULL CHECK (change_source IN (
        'ai_detection',    -- AI detecto senal
        'manual',          -- Cambio manual por staff
        'rule_trigger',    -- Regla automatica disparo
        'time_decay',      -- Decay por tiempo sin actividad
        'conversion'       -- Lead se convirtio
    )),

    -- Detalles
    signal_name VARCHAR(100),
    reason TEXT,
    triggered_by_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    changed_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamp (inmutable)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_score_history_lead ON public.lead_score_history(lead_id);
CREATE INDEX idx_lead_score_history_created ON public.lead_score_history(lead_id, created_at DESC);
CREATE INDEX idx_lead_score_history_source ON public.lead_score_history(change_source);

COMMENT ON TABLE public.lead_score_history IS
'Historial de todos los cambios de score de leads para auditoria y analisis.';

-- =====================================================
-- PARTE F: JOB QUEUE (Cola de Trabajos Asincrona)
-- Procesamiento asincrono de mensajes y tareas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.job_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Tipo de trabajo
    job_type VARCHAR(100) NOT NULL CHECK (job_type IN (
        'ai_response',           -- Generar respuesta AI
        'send_message',          -- Enviar mensaje por canal
        'update_lead_score',     -- Actualizar score de lead
        'escalate_conversation', -- Escalar a humano
        'send_reminder',         -- Enviar recordatorio de cita
        'daily_report',          -- Generar reporte diario
        'sync_contact',          -- Sincronizar contacto
        'process_media'          -- Procesar media (imagen, audio)
    )),

    -- Prioridad (menor = mas urgente)
    priority INTEGER DEFAULT 100 CHECK (priority >= 1 AND priority <= 1000),

    -- Estado del trabajo
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',     -- Esperando procesamiento
        'processing',  -- En proceso
        'completed',   -- Completado exitosamente
        'failed',      -- Fallo (puede reintentar)
        'dead',        -- Fallo definitivo (no reintentar)
        'cancelled'    -- Cancelado
    )),

    -- Payload del trabajo (datos necesarios)
    payload JSONB NOT NULL DEFAULT '{}',

    -- Resultado del trabajo
    result JSONB,

    -- Control de reintentos
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Error tracking
    error_message TEXT,
    error_stack TEXT,
    last_error_at TIMESTAMPTZ,

    -- Scheduling
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    not_before TIMESTAMPTZ,

    -- Timestamps de procesamiento
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_queue_tenant ON public.job_queue(tenant_id);
CREATE INDEX idx_job_queue_status ON public.job_queue(status);
CREATE INDEX idx_job_queue_pending ON public.job_queue(status, priority, scheduled_for)
    WHERE status = 'pending';
CREATE INDEX idx_job_queue_type ON public.job_queue(job_type, status);
CREATE INDEX idx_job_queue_scheduled ON public.job_queue(scheduled_for)
    WHERE status = 'pending';

COMMENT ON TABLE public.job_queue IS
'Cola de trabajos asincrona para procesamiento de mensajes AI, envios, y tareas programadas.';

-- Trigger para updated_at
CREATE TRIGGER update_job_queue_updated_at
    BEFORE UPDATE ON public.job_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE G: AI USAGE LOGS (Tracking de Uso y Costos)
-- Registro de cada llamada al AI para facturacion
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Referencia a la conversacion/mensaje
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.job_queue(id) ON DELETE SET NULL,

    -- Modelo usado
    ai_model VARCHAR(100) NOT NULL,
    ai_provider VARCHAR(50) NOT NULL CHECK (ai_provider IN (
        'anthropic',   -- Claude
        'openai',      -- GPT
        'google',      -- Gemini
        'local'        -- Modelo local
    )),

    -- Tokens usados
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,

    -- Costo (en USD)
    cost_usd DECIMAL(10, 6) DEFAULT 0,

    -- Tiempo de respuesta
    response_time_ms INTEGER,

    -- Resultado
    was_successful BOOLEAN DEFAULT true,
    error_message TEXT,

    -- Metadata adicional
    -- intent detectado, confidence, signals, etc.
    metadata JSONB DEFAULT '{}',

    -- Timestamp (inmutable para billing)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_logs_tenant ON public.ai_usage_logs(tenant_id);
CREATE INDEX idx_ai_usage_logs_created ON public.ai_usage_logs(tenant_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_conversation ON public.ai_usage_logs(conversation_id);
CREATE INDEX idx_ai_usage_logs_model ON public.ai_usage_logs(tenant_id, ai_model);
CREATE INDEX idx_ai_usage_logs_billing ON public.ai_usage_logs(tenant_id, created_at)
    WHERE was_successful = true;

COMMENT ON TABLE public.ai_usage_logs IS
'Log de cada llamada al AI para tracking de uso, costos, y facturacion por tenant.';

-- =====================================================
-- PARTE H: COLUMNAS ADICIONALES EN TABLAS EXISTENTES
-- Agregar campos necesarios a leads y conversations
-- =====================================================

-- Agregar columnas a leads si no existen
DO $$
BEGIN
    -- Campo para guardar senales detectadas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'scoring_signals') THEN
        ALTER TABLE public.leads ADD COLUMN scoring_signals JSONB DEFAULT '[]';
    END IF;

    -- Campo para fecha de ultimo cambio de score
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'score_updated_at') THEN
        ALTER TABLE public.leads ADD COLUMN score_updated_at TIMESTAMPTZ;
    END IF;

    -- Campo para marcar si fue escalado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'escalated_to_human') THEN
        ALTER TABLE public.leads ADD COLUMN escalated_to_human BOOLEAN DEFAULT false;
    END IF;

    -- Campo para preferencia de sucursal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'preferred_branch_id') THEN
        ALTER TABLE public.leads ADD COLUMN preferred_branch_id UUID REFERENCES public.branches(id);
    END IF;

    -- Campo para idioma preferido
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'leads' AND column_name = 'preferred_language') THEN
        ALTER TABLE public.leads ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'es';
    END IF;
END $$;

-- Agregar columnas a conversations si no existen
DO $$
BEGIN
    -- Campo para canal de origen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conversations' AND column_name = 'channel_connection_id') THEN
        ALTER TABLE public.conversations ADD COLUMN channel_connection_id UUID REFERENCES public.channel_connections(id);
    END IF;

    -- Campo para ultimo intent detectado con confidence
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conversations' AND column_name = 'last_intent_confidence') THEN
        ALTER TABLE public.conversations ADD COLUMN last_intent_confidence DECIMAL(3,2);
    END IF;

    -- Campo para contador de turnos (para escalacion)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'conversations' AND column_name = 'turn_count') THEN
        ALTER TABLE public.conversations ADD COLUMN turn_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Agregar columnas a messages si no existen
DO $$
BEGIN
    -- Campo para intent detectado en este mensaje
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'detected_intent') THEN
        ALTER TABLE public.messages ADD COLUMN detected_intent VARCHAR(100);
    END IF;

    -- Campo para senales detectadas en este mensaje
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'detected_signals') THEN
        ALTER TABLE public.messages ADD COLUMN detected_signals JSONB DEFAULT '[]';
    END IF;

    -- Campo para indicar si fue procesado por AI
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'ai_processed') THEN
        ALTER TABLE public.messages ADD COLUMN ai_processed BOOLEAN DEFAULT false;
    END IF;

    -- Campo para job_id que proceso este mensaje
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'messages' AND column_name = 'processed_by_job_id') THEN
        ALTER TABLE public.messages ADD COLUMN processed_by_job_id UUID REFERENCES public.job_queue(id);
    END IF;
END $$;

-- =====================================================
-- PARTE I: FUNCIONES HELPER
-- =====================================================

-- Funcion para obtener el siguiente job pendiente
CREATE OR REPLACE FUNCTION public.get_next_pending_job(
    p_job_types TEXT[] DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS public.job_queue AS $$
DECLARE
    v_job public.job_queue;
BEGIN
    -- Seleccionar y bloquear el siguiente job
    SELECT * INTO v_job
    FROM public.job_queue
    WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND (p_job_types IS NULL OR job_type = ANY(p_job_types))
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    ORDER BY priority ASC, scheduled_for ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- Si encontramos un job, marcarlo como processing
    IF v_job.id IS NOT NULL THEN
        UPDATE public.job_queue
        SET status = 'processing',
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = v_job.id;

        -- Actualizar el registro devuelto
        v_job.status := 'processing';
        v_job.started_at := NOW();
    END IF;

    RETURN v_job;
END;
$$ LANGUAGE plpgsql;

-- Funcion para completar un job
CREATE OR REPLACE FUNCTION public.complete_job(
    p_job_id UUID,
    p_result JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.job_queue
    SET status = CASE WHEN p_error_message IS NULL THEN 'completed' ELSE 'failed' END,
        result = p_result,
        error_message = p_error_message,
        completed_at = NOW(),
        retry_count = CASE WHEN p_error_message IS NOT NULL THEN retry_count + 1 ELSE retry_count END,
        updated_at = NOW()
    WHERE id = p_job_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Funcion para actualizar score de lead
CREATE OR REPLACE FUNCTION public.update_lead_score(
    p_lead_id UUID,
    p_score_change INTEGER,
    p_signal_name VARCHAR(100),
    p_change_source VARCHAR(50),
    p_reason TEXT DEFAULT NULL,
    p_message_id UUID DEFAULT NULL,
    p_staff_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_current_score INTEGER;
    v_new_score INTEGER;
    v_current_classification VARCHAR(20);
    v_new_classification VARCHAR(20);
BEGIN
    -- Obtener score actual
    SELECT score, classification INTO v_current_score, v_current_classification
    FROM public.leads
    WHERE id = p_lead_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Calcular nuevo score (limitar entre 0 y 100)
    v_new_score := GREATEST(0, LEAST(100, COALESCE(v_current_score, 50) + p_score_change));

    -- Determinar nueva clasificacion
    v_new_classification := CASE
        WHEN v_new_score >= 80 THEN 'hot'
        WHEN v_new_score >= 40 THEN 'warm'
        ELSE 'cold'
    END;

    -- Actualizar lead
    UPDATE public.leads
    SET score = v_new_score,
        classification = v_new_classification,
        score_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- Registrar en historial
    INSERT INTO public.lead_score_history (
        lead_id,
        previous_score,
        new_score,
        score_change,
        previous_classification,
        new_classification,
        change_source,
        signal_name,
        reason,
        triggered_by_message_id,
        changed_by_staff_id
    ) VALUES (
        p_lead_id,
        COALESCE(v_current_score, 50),
        v_new_score,
        p_score_change,
        v_current_classification,
        v_new_classification,
        p_change_source,
        p_signal_name,
        p_reason,
        p_message_id,
        p_staff_id
    );

    RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Funcion para obtener contexto completo de tenant para AI
CREATE OR REPLACE FUNCTION public.get_tenant_ai_context(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_context JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tenant', (
            SELECT jsonb_build_object(
                'id', t.id,
                'name', t.name,
                'slug', t.slug,
                'vertical', t.vertical,
                'settings', t.settings
            )
            FROM public.tenants t
            WHERE t.id = p_tenant_id
        ),
        'ai_config', (
            SELECT row_to_json(ac.*)
            FROM public.ai_tenant_config ac
            WHERE ac.tenant_id = p_tenant_id
        ),
        'branches', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', b.id,
                'name', b.name,
                'address', b.address,
                'city', b.city,
                'phone', b.phone,
                'whatsapp_number', b.whatsapp_number,
                'operating_hours', b.operating_hours,
                'google_maps_url', b.google_maps_url
            )), '[]'::jsonb)
            FROM public.branches b
            WHERE b.tenant_id = p_tenant_id AND b.is_active = true
        ),
        'staff', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', s.id,
                'display_name', s.display_name,
                'first_name', s.first_name,
                'last_name', s.last_name,
                'role', s.role,
                'role_title', s.role_title,
                'specialty', s.specialty
            )), '[]'::jsonb)
            FROM public.staff s
            WHERE s.tenant_id = p_tenant_id AND s.is_active = true
        ),
        'services', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', sv.id,
                'name', sv.name,
                'description', sv.description,
                'short_description', sv.short_description,
                'price_min', sv.price_min,
                'price_max', sv.price_max,
                'price_unit', sv.price_unit,
                'currency', sv.currency,
                'duration_minutes', sv.duration_minutes,
                'category', sv.category,
                'ai_description', sv.ai_description
            ) ORDER BY sv.display_order), '[]'::jsonb)
            FROM public.services sv
            WHERE sv.tenant_id = p_tenant_id AND sv.is_active = true
        ),
        'faqs', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'question', f.question,
                'answer', f.answer,
                'short_answer', f.short_answer,
                'category', f.category,
                'keywords', f.keywords
            ) ORDER BY f.display_order), '[]'::jsonb)
            FROM public.faqs f
            WHERE f.tenant_id = p_tenant_id AND f.is_active = true
        ),
        'scoring_rules', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'signal_name', sr.signal_name,
                'signal_display_name', sr.signal_display_name,
                'points', sr.points,
                'detection_type', sr.detection_type,
                'detection_config', sr.detection_config,
                'category', sr.category
            ) ORDER BY sr.evaluation_order), '[]'::jsonb)
            FROM public.ai_scoring_rules sr
            WHERE (sr.tenant_id = p_tenant_id OR sr.is_global = true) AND sr.is_active = true
        )
    ) INTO v_context;

    RETURN v_context;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_tenant_ai_context IS
'Obtiene todo el contexto necesario para que el AI responda: tenant info, config, branches, staff, services, faqs, scoring rules.';

-- =====================================================
-- PARTE J: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- RLS para ai_tenant_config
ALTER TABLE public.ai_tenant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant AI config"
    ON public.ai_tenant_config FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

CREATE POLICY "Admins can update their tenant AI config"
    ON public.ai_tenant_config FOR UPDATE
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
          AND ur.role IN ('owner', 'admin')
    ));

-- RLS para channel_connections
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant channel connections"
    ON public.channel_connections FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

CREATE POLICY "Admins can manage their tenant channel connections"
    ON public.channel_connections FOR ALL
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
          AND ur.role IN ('owner', 'admin')
    ));

-- RLS para ai_scoring_rules
ALTER TABLE public.ai_scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scoring rules"
    ON public.ai_scoring_rules FOR SELECT
    USING (
        is_global = true
        OR tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.is_active = true
        )
    );

-- RLS para job_queue
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant jobs"
    ON public.job_queue FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

-- RLS para ai_usage_logs
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant AI usage"
    ON public.ai_usage_logs FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

-- RLS para lead_score_history
ALTER TABLE public.lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant lead score history"
    ON public.lead_score_history FOR SELECT
    USING (lead_id IN (
        SELECT l.id FROM public.leads l
        WHERE l.tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.is_active = true
        )
    ));

-- =====================================================
-- PARTE K: DATOS SEED - TEMPLATES Y REGLAS DEFAULT
-- =====================================================

-- K1: Template de prompt para vertical DENTAL
INSERT INTO public.ai_prompt_templates (
    vertical,
    prompt_key,
    prompt_name,
    prompt_description,
    prompt_text,
    available_variables,
    response_format,
    is_default,
    is_active
) VALUES (
    'dental',
    'system_prompt',
    'Asistente de Clinica Dental',
    'Prompt base para asistentes de clinicas dentales. Profesional, empatico, orientado a agendar citas.',
    '# IDENTIDAD
Eres el asistente virtual de {clinic_name}, una clinica dental especializada. Tu objetivo es ayudar a los pacientes potenciales a resolver sus dudas y guiarlos hacia agendar una valoracion.

# PERSONALIDAD
- Profesional y educado en todo momento
- Empatico con las preocupaciones dentales de los pacientes
- Informativo pero conciso (no abrumar con informacion)
- Proactivo en guiar hacia agendar consulta
- Bilingue: detecta el idioma del paciente y responde en el mismo

# INFORMACION DE LA CLINICA

## Nombre
{clinic_name}

## Sucursales
{branches}

## Horarios de Atencion
{operating_hours}

## Equipo Medico
{doctors}

## Servicios y Precios
{services}

# PREGUNTAS FRECUENTES
{faqs}

# INSTRUCCIONES ESPECIALES DEL CLIENTE
{custom_instructions}

# REGLAS DE COMPORTAMIENTO

## SIEMPRE hacer:
1. Responder en el mismo idioma que el paciente
2. Terminar con una pregunta clara o llamado a la accion
3. Guiar hacia agendar valoracion cuando sea apropiado
4. Mantener mensajes de 3-4 parrafos cortos maximo
5. Ser preciso con precios e informacion

## NUNCA hacer:
1. Usar emojis
2. Dar diagnosticos medicos especificos
3. Prometer resultados exactos sin valoracion previa
4. Criticar a otros dentistas o clinicas
5. Enviar mensajes muy largos
6. Ser insistente o agresivo para agendar
7. Inventar informacion que no tengas

# SISTEMA DE DETECCION

Detecta la intencion del mensaje y senales de scoring.

Intenciones posibles:
- GREETING: Saludo inicial
- PRICE_INQUIRY: Pregunta sobre precios
- BOOK_APPOINTMENT: Quiere agendar cita
- PAIN_URGENT: Tiene dolor o urgencia
- HUMAN_REQUEST: Pide hablar con humano
- LOCATION: Pregunta por ubicacion
- HOURS: Pregunta por horarios
- FAQ: Pregunta frecuente general
- UNKNOWN: No se puede determinar

# FORMATO DE RESPUESTA OBLIGATORIO

Responde EXACTAMENTE en este formato:

RESPONSE: [Tu mensaje para el paciente]
INTENT: [GREETING|PRICE_INQUIRY|BOOK_APPOINTMENT|PAIN_URGENT|HUMAN_REQUEST|LOCATION|HOURS|FAQ|UNKNOWN]
SIGNALS: [{"signal": "nombre_signal", "points": numero}, ...]
ESCALATE: [true|false]
ESCALATE_REASON: [Razon si escalas, vacio si no]',
    ARRAY['clinic_name', 'branches', 'operating_hours', 'doctors', 'services', 'faqs', 'custom_instructions'],
    'structured',
    true,
    true
) ON CONFLICT (vertical, prompt_key, is_default) DO UPDATE SET
    prompt_text = EXCLUDED.prompt_text,
    available_variables = EXCLUDED.available_variables,
    updated_at = NOW();

-- K2: Reglas de scoring globales (aplican a todos los tenants)
INSERT INTO public.ai_scoring_rules (
    tenant_id, is_global, signal_name, signal_display_name, signal_description,
    points, detection_type, detection_config, category, evaluation_order, is_active
) VALUES
    -- Senales positivas de urgencia
    (NULL, true, 'urgency_pain', 'Dolor o Urgencia', 'Paciente menciona dolor, emergencia o necesidad urgente',
     35, 'keyword', '{"keywords": ["dolor", "duele", "molestia", "urgente", "emergencia", "pain", "hurts", "emergency", "urgent"]}'::jsonb, 'urgency', 10, true),

    -- Senales de intencion de compra
    (NULL, true, 'wants_appointment', 'Quiere Agendar', 'Paciente solicita explicitamente agendar cita',
     30, 'keyword', '{"keywords": ["agendar", "cita", "appointment", "schedule", "disponibilidad", "availability", "cuando pueden", "horario disponible"]}'::jsonb, 'intent', 20, true),

    (NULL, true, 'date_defined', 'Fecha Definida', 'Paciente menciona fecha especifica para la cita',
     25, 'keyword', '{"keywords": ["manana", "tomorrow", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "esta semana", "this week", "proxima semana", "next week"]}'::jsonb, 'intent', 25, true),

    (NULL, true, 'high_value_treatment', 'Tratamiento Alto Valor', 'Interes en tratamientos de alto valor (carillas, implantes, etc)',
     20, 'keyword', '{"keywords": ["carillas", "veneers", "implantes", "implants", "corona", "crown", "ortodoncia", "orthodontics", "brackets", "invisalign", "blanqueamiento", "whitening"]}'::jsonb, 'intent', 30, true),

    -- Senales demograficas
    (NULL, true, 'usa_patient', 'Paciente de USA', 'Paciente menciona ser de Estados Unidos (dental tourism)',
     25, 'keyword', '{"keywords": ["arizona", "tucson", "phoenix", "california", "texas", "usa", "united states", "from the us", "american", "estadounidense"]}'::jsonb, 'demographics', 40, true),

    -- Senales de engagement
    (NULL, true, 'high_engagement', 'Alto Engagement', 'Paciente hace multiples preguntas o muestra interes activo',
     10, 'behavior', '{"type": "message_count", "threshold": 5}'::jsonb, 'engagement', 50, true),

    (NULL, true, 'complete_info', 'Informacion Completa', 'Paciente proporciona nombre, telefono o email',
     10, 'behavior', '{"type": "provides_contact_info"}'::jsonb, 'engagement', 55, true),

    -- Senales negativas
    (NULL, true, 'just_browsing', 'Solo Explorando', 'Paciente indica que solo esta viendo opciones',
     -15, 'keyword', '{"keywords": ["solo preguntando", "just asking", "para despues", "for later", "solo viendo", "just looking", "no por ahora", "not now"]}'::jsonb, 'negative', 60, true),

    (NULL, true, 'price_shopping', 'Comparando Precios', 'Paciente solo pregunta precio sin mas engagement',
     -10, 'behavior', '{"type": "only_price_question"}'::jsonb, 'negative', 65, true),

    (NULL, true, 'comparing_options', 'Comparando Clinicas', 'Paciente menciona que esta comparando con otras clinicas',
     -10, 'keyword', '{"keywords": ["otras clinicas", "other clinics", "comparando", "comparing", "cotizacion", "quote from"]}'::jsonb, 'negative', 70, true)

ON CONFLICT (tenant_id, signal_name) DO UPDATE SET
    signal_display_name = EXCLUDED.signal_display_name,
    signal_description = EXCLUDED.signal_description,
    points = EXCLUDED.points,
    detection_config = EXCLUDED.detection_config,
    updated_at = NOW();

-- =====================================================
-- FIN DE LA MIGRACION
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform - Schema con sistema AI multi-canal. Migration 015.';
