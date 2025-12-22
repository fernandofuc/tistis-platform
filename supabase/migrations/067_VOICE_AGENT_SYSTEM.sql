-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT SYSTEM
-- Migration: 067_VOICE_AGENT_SYSTEM.sql
-- Date: December 2024
-- Version: 1.0
--
-- PURPOSE: Sistema completo de AI Agent por Voz
-- integrado con VAPI, Twilio y LangGraph existente.
--
-- FEATURES:
-- - Configuración de Voice Agent por tenant
-- - Integración con proveedores de telefonía (Twilio)
-- - Sistema de auto-generación de prompts por vertical
-- - Registro de llamadas y transcripciones
-- - Análisis de llamadas (structured data extraction)
-- - Métricas y billing de uso de voz
--
-- ARCHITECTURE:
-- Twilio Webhook -> Voice Agent Config -> VAPI/Custom ->
--     STT (Deepgram) -> LangGraph -> TTS (ElevenLabs) ->
--     Response -> Call Log + Lead Score Update
-- =====================================================

-- =====================================================
-- PARTE A: VOICE AGENT CONFIGURATION
-- Configuración principal del agente de voz por tenant
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_agent_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Estado del Voice Agent
    voice_enabled BOOLEAN DEFAULT false,
    voice_status VARCHAR(50) DEFAULT 'inactive' CHECK (voice_status IN (
        'inactive',      -- No configurado
        'configuring',   -- En proceso de configuración
        'active',        -- Activo y funcionando
        'suspended',     -- Suspendido por TIS TIS
        'error'          -- Error de configuración
    )),

    -- Información del asistente
    assistant_name VARCHAR(100) NOT NULL DEFAULT 'Asistente',
    assistant_personality VARCHAR(50) DEFAULT 'professional_friendly' CHECK (assistant_personality IN (
        'professional',           -- Formal y educado
        'professional_friendly',  -- Profesional pero cercano (recomendado)
        'casual',                 -- Informal y amigable
        'formal'                  -- Muy formal
    )),

    -- Primer mensaje (greeting)
    first_message TEXT NOT NULL DEFAULT 'Hola, soy {assistant_name} de {business_name}. ¿Cómo puedo ayudarte el día de hoy?',
    first_message_mode VARCHAR(20) DEFAULT 'assistant_speaks_first' CHECK (first_message_mode IN (
        'assistant_speaks_first',  -- El asistente saluda primero
        'wait_for_user'            -- Espera que el usuario hable
    )),

    -- Configuración de voz (ElevenLabs)
    voice_provider VARCHAR(50) DEFAULT 'elevenlabs' CHECK (voice_provider IN (
        'elevenlabs',    -- ElevenLabs (recomendado)
        'google',        -- Google TTS
        'azure',         -- Azure Cognitive Services
        'openai'         -- OpenAI TTS
    )),
    voice_id VARCHAR(100) DEFAULT 'LegCbmbXKbT5PUp3QFWv', -- Voz masculina por defecto
    voice_model VARCHAR(100) DEFAULT 'eleven_turbo_v2_5',
    voice_stability DECIMAL(3,2) DEFAULT 0.50 CHECK (voice_stability >= 0 AND voice_stability <= 1),
    voice_similarity_boost DECIMAL(3,2) DEFAULT 0.75 CHECK (voice_similarity_boost >= 0 AND voice_similarity_boost <= 1),
    voice_style DECIMAL(3,2) DEFAULT 0.00,
    voice_use_speaker_boost BOOLEAN DEFAULT true,

    -- Configuración de transcripción (STT)
    transcription_provider VARCHAR(50) DEFAULT 'deepgram' CHECK (transcription_provider IN (
        'deepgram',      -- Deepgram (recomendado)
        'google',        -- Google Speech-to-Text
        'azure',         -- Azure Speech
        'whisper'        -- OpenAI Whisper
    )),
    transcription_model VARCHAR(100) DEFAULT 'nova-2',
    transcription_language VARCHAR(10) DEFAULT 'es',
    transcription_confidence_threshold DECIMAL(3,2) DEFAULT 0.40,

    -- Configuración del modelo de IA
    ai_model VARCHAR(100) DEFAULT 'gpt-4o' CHECK (ai_model IN (
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'claude-3-5-sonnet-20241022',
        'claude-3-haiku-20240307'
    )),
    ai_temperature DECIMAL(3,2) DEFAULT 0.20 CHECK (ai_temperature >= 0 AND ai_temperature <= 1),
    ai_max_tokens INTEGER DEFAULT 250 CHECK (ai_max_tokens >= 50 AND ai_max_tokens <= 500),

    -- Start Speaking Plan (timing para respuestas naturales)
    wait_seconds DECIMAL(3,2) DEFAULT 0.40,
    on_punctuation_seconds DECIMAL(3,2) DEFAULT 0.10,
    on_no_punctuation_seconds DECIMAL(3,2) DEFAULT 1.50,

    -- Configuración de llamada
    max_call_duration_seconds INTEGER DEFAULT 600 CHECK (max_call_duration_seconds >= 60 AND max_call_duration_seconds <= 1800),
    silence_timeout_seconds INTEGER DEFAULT 30 CHECK (silence_timeout_seconds >= 10 AND silence_timeout_seconds <= 60),
    response_delay_seconds DECIMAL(3,2) DEFAULT 0.20,
    interruption_threshold DECIMAL(3,2) DEFAULT 0.50,

    -- Grabación y privacidad
    recording_enabled BOOLEAN DEFAULT true,
    transcription_stored BOOLEAN DEFAULT true,
    hipaa_enabled BOOLEAN DEFAULT false,
    pci_enabled BOOLEAN DEFAULT false,

    -- Frases naturales para evitar silencios
    -- Basado en: "Mmm...", "Bueno...", "Claro...", "Quiero decir..."
    filler_phrases TEXT[] DEFAULT ARRAY[
        'Mmm...',
        'Bueno...',
        'Claro...',
        'Déjame ver...',
        'Un momento...'
    ],
    use_filler_phrases BOOLEAN DEFAULT true,

    -- End Call Phrases
    end_call_phrases TEXT[] DEFAULT ARRAY[
        'adiós',
        'hasta luego',
        'gracias, bye',
        'eso es todo',
        'goodbye',
        'bye bye'
    ],

    -- Prompt auto-generado (se genera automáticamente basándose en datos del tenant)
    system_prompt TEXT,
    system_prompt_generated_at TIMESTAMPTZ,
    custom_instructions TEXT, -- Instrucciones adicionales del cliente

    -- Metadatos de configuración
    last_configured_at TIMESTAMPTZ,
    last_configured_by UUID REFERENCES public.staff(id),
    configuration_version INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un config por tenant
    UNIQUE(tenant_id)
);

CREATE INDEX idx_voice_agent_config_tenant ON public.voice_agent_config(tenant_id);
CREATE INDEX idx_voice_agent_config_enabled ON public.voice_agent_config(tenant_id) WHERE voice_enabled = true;
CREATE INDEX idx_voice_agent_config_status ON public.voice_agent_config(voice_status);

COMMENT ON TABLE public.voice_agent_config IS
'Configuración del agente de voz AI por tenant. Incluye voz, transcripción, timing y prompt.';

-- Trigger para updated_at
CREATE TRIGGER update_voice_agent_config_updated_at
    BEFORE UPDATE ON public.voice_agent_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE B: VOICE PHONE NUMBERS
-- Números de teléfono asignados a tenants
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    voice_agent_config_id UUID REFERENCES public.voice_agent_config(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,

    -- Información del número
    phone_number VARCHAR(20) NOT NULL UNIQUE, -- E.164 format: +526311234567
    phone_number_display VARCHAR(30), -- Formato display: (631) 123-4567
    area_code VARCHAR(10), -- LADA: 631
    country_code VARCHAR(5) DEFAULT '+52', -- México

    -- Proveedor de telefonía
    telephony_provider VARCHAR(50) DEFAULT 'twilio' CHECK (telephony_provider IN (
        'twilio',
        'vonage',
        'telnyx',
        'bandwidth'
    )),
    provider_phone_sid VARCHAR(100), -- ID del número en el proveedor
    provider_account_sid VARCHAR(100),

    -- Estado
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Esperando aprovisionamiento
        'provisioning', -- Provisionando con el carrier
        'active',       -- Activo y recibiendo llamadas
        'suspended',    -- Suspendido
        'released'      -- Liberado/Cancelado
    )),

    -- Configuración de webhooks
    webhook_url TEXT,
    webhook_status_callback TEXT,

    -- Costo
    monthly_cost_usd DECIMAL(10,2),
    per_minute_cost_usd DECIMAL(10,4),

    -- Estadísticas
    total_calls INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    last_call_at TIMESTAMPTZ,

    -- Timestamps
    provisioned_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_phone_numbers_tenant ON public.voice_phone_numbers(tenant_id);
CREATE INDEX idx_voice_phone_numbers_number ON public.voice_phone_numbers(phone_number);
CREATE INDEX idx_voice_phone_numbers_status ON public.voice_phone_numbers(status);
CREATE INDEX idx_voice_phone_numbers_branch ON public.voice_phone_numbers(branch_id);

COMMENT ON TABLE public.voice_phone_numbers IS
'Números de teléfono virtuales asignados a tenants para Voice Agent.';

-- Trigger para updated_at
CREATE TRIGGER update_voice_phone_numbers_updated_at
    BEFORE UPDATE ON public.voice_phone_numbers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE C: VOICE CALLS
-- Registro de todas las llamadas de voz
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    voice_agent_config_id UUID REFERENCES public.voice_agent_config(id) ON DELETE SET NULL,
    phone_number_id UUID REFERENCES public.voice_phone_numbers(id) ON DELETE SET NULL,

    -- Vinculación con lead/conversación
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,

    -- Información de la llamada
    call_direction VARCHAR(20) NOT NULL DEFAULT 'inbound' CHECK (call_direction IN (
        'inbound',   -- Llamada entrante (cliente llama)
        'outbound'   -- Llamada saliente (sistema llama)
    )),
    caller_phone VARCHAR(20) NOT NULL,
    called_phone VARCHAR(20) NOT NULL,

    -- IDs externos
    provider_call_sid VARCHAR(100), -- Twilio Call SID
    vapi_call_id VARCHAR(100),      -- VAPI Call ID (si usamos VAPI)

    -- Estado de la llamada
    status VARCHAR(50) DEFAULT 'initiated' CHECK (status IN (
        'initiated',    -- Iniciada
        'ringing',      -- Sonando
        'in_progress',  -- En progreso
        'completed',    -- Completada normalmente
        'busy',         -- Ocupado
        'no_answer',    -- Sin respuesta
        'failed',       -- Falló
        'canceled',     -- Cancelada
        'escalated'     -- Escalada a humano
    )),

    -- Timing
    started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    billable_seconds INTEGER DEFAULT 0,

    -- Grabación
    recording_url TEXT,
    recording_duration_seconds INTEGER,
    recording_status VARCHAR(50),

    -- Transcripción completa
    transcription TEXT,
    transcription_segments JSONB DEFAULT '[]'::jsonb, -- [{speaker, text, start, end}]

    -- Análisis de la llamada (Structured Data Extraction)
    analysis JSONB DEFAULT '{}'::jsonb,
    -- Ejemplo: {
    --   "customer_name": "Juan Pérez",
    --   "customer_phone": "6311234567",
    --   "appointment_requested": true,
    --   "appointment_date": "2024-12-25",
    --   "appointment_time": "10:00",
    --   "service_requested": "Limpieza dental",
    --   "sentiment": "positive",
    --   "urgency": "low"
    -- }

    -- Detección de intents y señales
    primary_intent VARCHAR(100),
    detected_intents TEXT[] DEFAULT '{}',
    detected_signals JSONB DEFAULT '[]'::jsonb,

    -- Resultado
    outcome VARCHAR(50) CHECK (outcome IN (
        'appointment_booked', -- Cita agendada
        'information_given',  -- Info proporcionada
        'escalated_human',    -- Escalado a humano
        'callback_requested', -- Pidió que le llamen
        'not_interested',     -- No interesado
        'wrong_number',       -- Número equivocado
        'voicemail',          -- Buzón de voz
        'dropped',            -- Llamada caída
        'completed_other'     -- Otro resultado
    )),
    outcome_notes TEXT,

    -- Cambios en lead score
    lead_score_change INTEGER DEFAULT 0,
    lead_score_signals JSONB DEFAULT '[]'::jsonb,

    -- Escalación
    escalated BOOLEAN DEFAULT false,
    escalated_at TIMESTAMPTZ,
    escalated_reason TEXT,
    escalated_to_staff_id UUID REFERENCES public.staff(id),

    -- Costos
    cost_usd DECIMAL(10,4) DEFAULT 0,
    ai_tokens_used INTEGER DEFAULT 0,

    -- Calidad y métricas
    audio_quality_score DECIMAL(3,2), -- 0-1
    latency_avg_ms INTEGER,           -- Latencia promedio de respuesta
    interruptions_count INTEGER DEFAULT 0,
    turns_count INTEGER DEFAULT 0,    -- Número de turnos en la conversación

    -- Error tracking
    error_message TEXT,
    error_code VARCHAR(50),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_calls_tenant ON public.voice_calls(tenant_id);
CREATE INDEX idx_voice_calls_lead ON public.voice_calls(lead_id);
CREATE INDEX idx_voice_calls_conversation ON public.voice_calls(conversation_id);
CREATE INDEX idx_voice_calls_status ON public.voice_calls(status);
CREATE INDEX idx_voice_calls_created ON public.voice_calls(tenant_id, created_at DESC);
CREATE INDEX idx_voice_calls_caller ON public.voice_calls(caller_phone);
CREATE INDEX idx_voice_calls_outcome ON public.voice_calls(tenant_id, outcome);
CREATE INDEX idx_voice_calls_provider_sid ON public.voice_calls(provider_call_sid);

COMMENT ON TABLE public.voice_calls IS
'Registro de todas las llamadas de voz con transcripción, análisis y resultado.';

-- Trigger para updated_at
CREATE TRIGGER update_voice_calls_updated_at
    BEFORE UPDATE ON public.voice_calls
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PARTE D: VOICE CALL MESSAGES
-- Mensajes individuales dentro de una llamada
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_call_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.voice_calls(id) ON DELETE CASCADE,

    -- Rol del mensaje
    role VARCHAR(20) NOT NULL CHECK (role IN (
        'user',        -- El cliente habló
        'assistant',   -- El asistente respondió
        'system'       -- Mensaje del sistema
    )),

    -- Contenido
    content TEXT NOT NULL,
    audio_url TEXT,           -- URL del audio de este segmento

    -- Timing
    start_time_seconds DECIMAL(10,2), -- Tiempo desde inicio de llamada
    end_time_seconds DECIMAL(10,2),
    duration_seconds DECIMAL(10,2),

    -- Análisis de este mensaje
    detected_intent VARCHAR(100),
    confidence DECIMAL(3,2),
    detected_signals JSONB DEFAULT '[]'::jsonb,

    -- Latencia (solo para assistant)
    response_latency_ms INTEGER,

    -- Tokens usados (solo para assistant)
    tokens_used INTEGER DEFAULT 0,

    -- Orden del mensaje en la llamada
    sequence_number INTEGER NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_call_messages_call ON public.voice_call_messages(call_id);
CREATE INDEX idx_voice_call_messages_sequence ON public.voice_call_messages(call_id, sequence_number);

COMMENT ON TABLE public.voice_call_messages IS
'Mensajes individuales dentro de una llamada de voz para análisis detallado.';

-- =====================================================
-- PARTE E: VOICE USAGE LOGS
-- Tracking de uso para billing
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.voice_calls(id) ON DELETE SET NULL,

    -- Tipo de uso
    usage_type VARCHAR(50) NOT NULL CHECK (usage_type IN (
        'call_minutes',       -- Minutos de llamada
        'transcription',      -- Transcripción
        'tts',                -- Text-to-Speech
        'ai_tokens',          -- Tokens de AI
        'recording_storage',  -- Almacenamiento de grabación
        'phone_number'        -- Costo mensual del número
    )),

    -- Cantidad
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'minutes', 'tokens', 'mb', 'number'

    -- Costo
    unit_cost_usd DECIMAL(10,6) NOT NULL,
    total_cost_usd DECIMAL(10,4) NOT NULL,

    -- Proveedor
    provider VARCHAR(50),
    provider_ref VARCHAR(100),

    -- Periodo de facturación
    billing_period_start DATE,
    billing_period_end DATE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_usage_logs_tenant ON public.voice_usage_logs(tenant_id);
CREATE INDEX idx_voice_usage_logs_call ON public.voice_usage_logs(call_id);
CREATE INDEX idx_voice_usage_logs_type ON public.voice_usage_logs(tenant_id, usage_type);
CREATE INDEX idx_voice_usage_logs_billing ON public.voice_usage_logs(tenant_id, billing_period_start, billing_period_end);
CREATE INDEX idx_voice_usage_logs_created ON public.voice_usage_logs(created_at);

COMMENT ON TABLE public.voice_usage_logs IS
'Log detallado de uso de Voice Agent para facturación y analytics.';

-- =====================================================
-- PARTE F: VOICE PROMPT TEMPLATES
-- Templates de prompt por vertical para auto-generación
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Vertical y tipo
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN (
        'dental', 'medical', 'restaurant', 'gym', 'services', 'retail', 'other'
    )),
    template_key VARCHAR(100) NOT NULL,
    template_name VARCHAR(255) NOT NULL,

    -- Template del prompt (con variables)
    template_text TEXT NOT NULL,

    -- Variables disponibles
    -- Ejemplo: ["business_name", "assistant_name", "services", "doctors", "branches", "hours"]
    available_variables TEXT[] DEFAULT '{}',

    -- Template del primer mensaje
    first_message_template TEXT NOT NULL,

    -- Configuración recomendada
    recommended_config JSONB DEFAULT '{}'::jsonb,
    -- Ejemplo: {
    --   "temperature": 0.2,
    --   "max_tokens": 250,
    --   "voice_stability": 0.5,
    --   "use_filler_phrases": true
    -- }

    -- Estado
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Un template default por vertical y key
    UNIQUE(vertical, template_key, is_default)
);

CREATE INDEX idx_voice_prompt_templates_vertical ON public.voice_prompt_templates(vertical);
CREATE INDEX idx_voice_prompt_templates_key ON public.voice_prompt_templates(vertical, template_key);

COMMENT ON TABLE public.voice_prompt_templates IS
'Templates de prompts de voz predefinidos por vertical para auto-generación.';

-- =====================================================
-- PARTE G: AGREGAR COLUMNA A channel_connections
-- Agregar 'voice' como canal válido
-- =====================================================

-- Primero eliminar el constraint existente
ALTER TABLE public.channel_connections
DROP CONSTRAINT IF EXISTS channel_connections_channel_check;

-- Crear nuevo constraint con 'voice' incluido
ALTER TABLE public.channel_connections
ADD CONSTRAINT channel_connections_channel_check
CHECK (channel IN (
    'whatsapp',
    'instagram',
    'facebook',
    'tiktok',
    'webchat',
    'voice'
));

-- =====================================================
-- PARTE H: AGREGAR COLUMNA use_voice A ai_tenant_config
-- Para habilitar/deshabilitar voice a nivel de AI config
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_tenant_config' AND column_name = 'voice_enabled') THEN
        ALTER TABLE public.ai_tenant_config
        ADD COLUMN voice_enabled BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'ai_tenant_config' AND column_name = 'voice_agent_config_id') THEN
        ALTER TABLE public.ai_tenant_config
        ADD COLUMN voice_agent_config_id UUID REFERENCES public.voice_agent_config(id);
    END IF;
END $$;

-- =====================================================
-- PARTE I: AGREGAR booking_source 'voice' a appointments
-- =====================================================

ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_booking_source_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_booking_source_check
CHECK (booking_source IN (
    'manual', 'whatsapp', 'website', 'phone', 'walk_in', 'voice', 'ai_chat'
));

-- =====================================================
-- PARTE J: RLS POLICIES
-- =====================================================

-- RLS para voice_agent_config
ALTER TABLE public.voice_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant voice config"
    ON public.voice_agent_config FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

CREATE POLICY "Admins can manage their tenant voice config"
    ON public.voice_agent_config FOR ALL
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
          AND ur.role IN ('owner', 'admin')
    ));

-- RLS para voice_phone_numbers
ALTER TABLE public.voice_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant phone numbers"
    ON public.voice_phone_numbers FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

CREATE POLICY "Admins can manage their tenant phone numbers"
    ON public.voice_phone_numbers FOR ALL
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
          AND ur.role IN ('owner', 'admin')
    ));

-- RLS para voice_calls
ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant voice calls"
    ON public.voice_calls FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

CREATE POLICY "Staff can manage voice calls"
    ON public.voice_calls FOR ALL
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

-- RLS para voice_call_messages
ALTER TABLE public.voice_call_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant call messages"
    ON public.voice_call_messages FOR SELECT
    USING (call_id IN (
        SELECT vc.id FROM public.voice_calls vc
        WHERE vc.tenant_id IN (
            SELECT ur.tenant_id FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.is_active = true
        )
    ));

-- RLS para voice_usage_logs
ALTER TABLE public.voice_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant voice usage"
    ON public.voice_usage_logs FOR SELECT
    USING (tenant_id IN (
        SELECT ur.tenant_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.is_active = true
    ));

-- RLS para voice_prompt_templates (todos pueden leer)
ALTER TABLE public.voice_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view voice prompt templates"
    ON public.voice_prompt_templates FOR SELECT
    USING (true);

-- Service role full access para todas las tablas de voice
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT unnest(ARRAY[
            'voice_agent_config',
            'voice_phone_numbers',
            'voice_calls',
            'voice_call_messages',
            'voice_usage_logs',
            'voice_prompt_templates'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "Service role full access %I" ON public.%I;
            CREATE POLICY "Service role full access %I" ON public.%I
            FOR ALL TO service_role USING (true) WITH CHECK (true);
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- =====================================================
-- PARTE K: SEED DATA - VOICE PROMPT TEMPLATES
-- =====================================================

-- Template para DENTAL
INSERT INTO public.voice_prompt_templates (
    vertical,
    template_key,
    template_name,
    template_text,
    available_variables,
    first_message_template,
    recommended_config,
    is_default,
    is_active
) VALUES (
    'dental',
    'system_prompt',
    'Asistente de Voz para Clínica Dental',
    '## Personalidad:
Eres {assistant_name}, un asistente de voz IA de {business_name}. Tienes un acento mexicano neutro y profesional.

## Tarea:
Tu tarea principal es ayudar a los pacientes a agendar citas dentales, responder preguntas sobre servicios, horarios y ubicación.

## Información del Servicio:
### Clínica
- Nombre: {business_name}
- Dirección: {address}
- Teléfono: {phone}
- Horarios: {operating_hours}

### Servicios Disponibles
{services}

### Doctores
{doctors}

### Sucursales
{branches}

## Citas:
- Fecha actual: {{now}}
- Hora actual: {{now}}

### Reglas para agendar:
1. Solicitar nombre del paciente
2. Solicitar tipo de servicio requerido
3. Verificar disponibilidad con herramienta checkAvailability
4. Confirmar fecha, hora y doctor
5. Solicitar teléfono de contacto
6. Confirmar toda la información antes de agendar

### Restricciones:
- No agendar citas con menos de 2 horas de anticipación
- Máximo agendar hasta 30 días en el futuro
- Verificar que el horario esté dentro de horarios de operación

## Base de Conocimiento
{knowledge_base}

## Instrucciones Especiales del Cliente
{custom_instructions}

## Estilo:
- Se informal pero profesional, con frases como: "Mmm...", "Bueno...", "Claro..." y "Quiero decir..."
- Mantén las respuestas concisas, máximo 2-3 oraciones
- Siempre confirma la información antes de proceder
- NUNCA uses emojis en tus respuestas
- Si no sabes algo, ofrece transferir a un humano

## Escalación:
Si el paciente pide hablar con un humano, tiene una emergencia dental, o el asistente no puede resolver su duda después de 3 intentos, escala la llamada.',
    ARRAY['assistant_name', 'business_name', 'address', 'phone', 'operating_hours', 'services', 'doctors', 'branches', 'knowledge_base', 'custom_instructions'],
    'Hola, soy {assistant_name} de {business_name}. ¿Cómo puedo ayudarte el día de hoy?',
    '{
        "temperature": 0.2,
        "max_tokens": 250,
        "voice_stability": 0.5,
        "voice_similarity_boost": 0.75,
        "use_filler_phrases": true,
        "max_call_duration_seconds": 600
    }'::jsonb,
    true,
    true
) ON CONFLICT (vertical, template_key, is_default) DO UPDATE SET
    template_text = EXCLUDED.template_text,
    available_variables = EXCLUDED.available_variables,
    first_message_template = EXCLUDED.first_message_template,
    recommended_config = EXCLUDED.recommended_config,
    updated_at = NOW();

-- Template para RESTAURANT
INSERT INTO public.voice_prompt_templates (
    vertical,
    template_key,
    template_name,
    template_text,
    available_variables,
    first_message_template,
    recommended_config,
    is_default,
    is_active
) VALUES (
    'restaurant',
    'system_prompt',
    'Asistente de Voz para Restaurante',
    '## Personalidad:
Eres {assistant_name}, un asistente de voz IA del restaurante {business_name}. Tienes un acento mexicano amigable y cordial.

## Tarea:
Tu tarea principal es ayudar a los clientes a hacer reservaciones de mesa, tomar pedidos para recoger, y responder preguntas sobre el menú y horarios.

## Información del Servicio:
### Restaurante
- Nombre: {business_name}
- Dirección: {address}
- Teléfono: {phone}
- Horarios: {operating_hours}

### Menú
{menu}

### Especialidades
{specialties}

## Reservaciones:
- Fecha actual: {{now}}
- Hora actual: {{now}}

### Reglas para reservar mesa:
1. Solicitar nombre del cliente
2. Preguntar número de personas
3. Preguntar fecha y hora deseada
4. Verificar disponibilidad
5. Confirmar todos los detalles
6. Pedir teléfono de contacto

### Reglas para pedidos:
1. Tomar el pedido completo
2. Repetir el pedido al cliente
3. Dar tiempo estimado de preparación
4. Confirmar número de teléfono

## Base de Conocimiento
{knowledge_base}

## Instrucciones Especiales
{custom_instructions}

## Estilo:
- Se amigable y cordial, con frases como: "Mmm...", "Claro que sí...", "Con gusto..."
- Mantén las respuestas concisas
- Si mencionan alergias, siempre confirmar con la cocina
- NUNCA uses emojis',
    ARRAY['assistant_name', 'business_name', 'address', 'phone', 'operating_hours', 'menu', 'specialties', 'knowledge_base', 'custom_instructions'],
    'Hola, gracias por llamar a {business_name}. Soy {assistant_name}. ¿En qué puedo ayudarte?',
    '{
        "temperature": 0.3,
        "max_tokens": 250,
        "voice_stability": 0.5,
        "voice_similarity_boost": 0.75,
        "use_filler_phrases": true,
        "max_call_duration_seconds": 480
    }'::jsonb,
    true,
    true
) ON CONFLICT (vertical, template_key, is_default) DO UPDATE SET
    template_text = EXCLUDED.template_text,
    available_variables = EXCLUDED.available_variables,
    first_message_template = EXCLUDED.first_message_template,
    recommended_config = EXCLUDED.recommended_config,
    updated_at = NOW();

-- Template para MEDICAL (genérico)
INSERT INTO public.voice_prompt_templates (
    vertical,
    template_key,
    template_name,
    template_text,
    available_variables,
    first_message_template,
    recommended_config,
    is_default,
    is_active
) VALUES (
    'medical',
    'system_prompt',
    'Asistente de Voz para Clínica Médica',
    '## Personalidad:
Eres {assistant_name}, un asistente de voz IA de {business_name}. Tienes un tono profesional, empático y tranquilizador.

## Tarea:
Tu tarea principal es ayudar a los pacientes a agendar consultas médicas, proporcionar información sobre servicios y horarios.

## Información del Servicio:
### Clínica
- Nombre: {business_name}
- Dirección: {address}
- Teléfono: {phone}
- Horarios: {operating_hours}

### Especialidades
{specialties}

### Doctores
{doctors}

### Sucursales
{branches}

## Citas:
- Fecha actual: {{now}}
- Hora actual: {{now}}

### Reglas para agendar:
1. Solicitar nombre del paciente
2. Preguntar el motivo de la consulta (sin pedir detalles médicos)
3. Preguntar si tiene preferencia de doctor
4. Verificar disponibilidad
5. Confirmar fecha, hora y doctor
6. Solicitar teléfono de contacto

### IMPORTANTE:
- NUNCA dar consejos médicos
- NUNCA diagnosticar
- Si mencionan emergencia, indicar que llamen al 911 o vayan a urgencias

## Base de Conocimiento
{knowledge_base}

## Instrucciones Especiales
{custom_instructions}

## Estilo:
- Se profesional y empático
- Usa frases como: "Entiendo...", "Claro...", "Permítame verificar..."
- Transmite calma y confianza
- NUNCA uses emojis',
    ARRAY['assistant_name', 'business_name', 'address', 'phone', 'operating_hours', 'specialties', 'doctors', 'branches', 'knowledge_base', 'custom_instructions'],
    'Buenos días, {business_name}, le atiende {assistant_name}. ¿En qué puedo ayudarle?',
    '{
        "temperature": 0.2,
        "max_tokens": 250,
        "voice_stability": 0.6,
        "voice_similarity_boost": 0.75,
        "use_filler_phrases": true,
        "max_call_duration_seconds": 600
    }'::jsonb,
    true,
    true
) ON CONFLICT (vertical, template_key, is_default) DO UPDATE SET
    template_text = EXCLUDED.template_text,
    available_variables = EXCLUDED.available_variables,
    first_message_template = EXCLUDED.first_message_template,
    recommended_config = EXCLUDED.recommended_config,
    updated_at = NOW();

-- =====================================================
-- PARTE L: FUNCIÓN PARA GENERAR PROMPT DE VOZ
-- Auto-genera el prompt basándose en datos del tenant
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_voice_agent_prompt(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_tenant RECORD;
    v_template RECORD;
    v_prompt TEXT;
    v_services TEXT;
    v_doctors TEXT;
    v_branches TEXT;
    v_hours TEXT;
    v_knowledge_base TEXT;
    v_voice_config RECORD;
BEGIN
    -- Obtener datos del tenant
    SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
    END IF;

    -- Obtener config de voz
    SELECT * INTO v_voice_config FROM public.voice_agent_config WHERE tenant_id = p_tenant_id;

    -- Obtener template para la vertical
    SELECT * INTO v_template
    FROM public.voice_prompt_templates
    WHERE vertical = v_tenant.vertical
      AND template_key = 'system_prompt'
      AND is_default = true;

    IF NOT FOUND THEN
        -- Usar template genérico
        SELECT * INTO v_template
        FROM public.voice_prompt_templates
        WHERE vertical = 'services'
          AND template_key = 'system_prompt'
          AND is_default = true;
    END IF;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Construir lista de servicios
    SELECT STRING_AGG(
        '- ' || s.name ||
        CASE WHEN s.price_min IS NOT NULL THEN ' ($' || s.price_min::TEXT || '-$' || COALESCE(s.price_max, s.price_min)::TEXT || ' MXN)' ELSE '' END ||
        CASE WHEN s.duration_minutes IS NOT NULL THEN ' - ' || s.duration_minutes || ' min' ELSE '' END,
        E'\n'
    ) INTO v_services
    FROM public.services s
    WHERE s.tenant_id = p_tenant_id AND s.is_active = true
    ORDER BY s.display_order;

    -- Construir lista de doctores/staff
    SELECT STRING_AGG(
        '- ' || COALESCE(st.display_name, st.first_name || ' ' || st.last_name) ||
        CASE WHEN st.specialty IS NOT NULL THEN ' (' || st.specialty || ')' ELSE '' END,
        E'\n'
    ) INTO v_doctors
    FROM public.staff st
    WHERE st.tenant_id = p_tenant_id
      AND st.is_active = true
      AND st.role IN ('dentist', 'specialist', 'owner');

    -- Construir lista de sucursales
    SELECT STRING_AGG(
        '- ' || b.name || ': ' || COALESCE(b.address, '') || ', ' || b.city ||
        CASE WHEN b.phone IS NOT NULL THEN ' - Tel: ' || b.phone ELSE '' END,
        E'\n'
    ) INTO v_branches
    FROM public.branches b
    WHERE b.tenant_id = p_tenant_id AND b.is_active = true;

    -- Construir horarios
    SELECT STRING_AGG(
        b.name || ': ' ||
        COALESCE(
            (b.operating_hours->>'monday')::jsonb->>'open' || ' - ' || (b.operating_hours->>'monday')::jsonb->>'close',
            'No disponible'
        ),
        E'\n'
    ) INTO v_hours
    FROM public.branches b
    WHERE b.tenant_id = p_tenant_id AND b.is_active = true;

    -- Construir knowledge base
    SELECT STRING_AGG(
        '### ' || ci.title || E'\n' || ci.instruction,
        E'\n\n'
    ) INTO v_knowledge_base
    FROM public.ai_custom_instructions ci
    WHERE ci.tenant_id = p_tenant_id AND ci.is_active = true
    ORDER BY ci.priority;

    -- Reemplazar variables en el template
    v_prompt := v_template.template_text;
    v_prompt := REPLACE(v_prompt, '{assistant_name}', COALESCE(v_voice_config.assistant_name, 'Asistente'));
    v_prompt := REPLACE(v_prompt, '{business_name}', v_tenant.name);
    v_prompt := REPLACE(v_prompt, '{address}', COALESCE((SELECT address FROM public.branches WHERE tenant_id = p_tenant_id AND is_headquarters = true LIMIT 1), 'Dirección no disponible'));
    v_prompt := REPLACE(v_prompt, '{phone}', COALESCE(v_tenant.primary_contact_phone, 'Teléfono no disponible'));
    v_prompt := REPLACE(v_prompt, '{operating_hours}', COALESCE(v_hours, 'Horarios no configurados'));
    v_prompt := REPLACE(v_prompt, '{services}', COALESCE(v_services, 'Servicios no configurados'));
    v_prompt := REPLACE(v_prompt, '{doctors}', COALESCE(v_doctors, 'Personal no configurado'));
    v_prompt := REPLACE(v_prompt, '{branches}', COALESCE(v_branches, 'Sucursales no configuradas'));
    v_prompt := REPLACE(v_prompt, '{knowledge_base}', COALESCE(v_knowledge_base, 'Sin información adicional'));
    v_prompt := REPLACE(v_prompt, '{custom_instructions}', COALESCE(v_voice_config.custom_instructions, ''));

    -- Variables para restaurant (si aplica)
    v_prompt := REPLACE(v_prompt, '{menu}', COALESCE(v_services, 'Menú no disponible'));
    v_prompt := REPLACE(v_prompt, '{specialties}', COALESCE(v_services, 'Especialidades no disponibles'));

    RETURN v_prompt;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_voice_agent_prompt IS
'Genera automáticamente el prompt del agente de voz basándose en los datos del tenant (servicios, doctores, sucursales, KB).';

-- =====================================================
-- PARTE M: FUNCIÓN PARA OBTENER CONTEXTO COMPLETO DE VOZ
-- Similar a get_tenant_ai_context pero para voz
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_voice_agent_context(p_tenant_id UUID)
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
                'plan', t.plan
            )
            FROM public.tenants t
            WHERE t.id = p_tenant_id
        ),
        'voice_config', (
            SELECT row_to_json(vc.*)
            FROM public.voice_agent_config vc
            WHERE vc.tenant_id = p_tenant_id
        ),
        'phone_numbers', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', pn.id,
                'phone_number', pn.phone_number,
                'area_code', pn.area_code,
                'status', pn.status,
                'branch_id', pn.branch_id
            )), '[]'::jsonb)
            FROM public.voice_phone_numbers pn
            WHERE pn.tenant_id = p_tenant_id AND pn.status = 'active'
        ),
        'branches', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', b.id,
                'name', b.name,
                'address', b.address,
                'city', b.city,
                'phone', b.phone,
                'operating_hours', b.operating_hours,
                'is_headquarters', b.is_headquarters
            )), '[]'::jsonb)
            FROM public.branches b
            WHERE b.tenant_id = p_tenant_id AND b.is_active = true
        ),
        'staff', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', s.id,
                'display_name', COALESCE(s.display_name, s.first_name || ' ' || s.last_name),
                'role', s.role,
                'specialty', s.specialty
            )), '[]'::jsonb)
            FROM public.staff s
            WHERE s.tenant_id = p_tenant_id
              AND s.is_active = true
              AND s.role IN ('dentist', 'specialist', 'owner', 'manager')
        ),
        'services', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', sv.id,
                'name', sv.name,
                'description', sv.short_description,
                'price_min', sv.price_min,
                'price_max', sv.price_max,
                'duration_minutes', sv.duration_minutes,
                'category', sv.category
            ) ORDER BY sv.display_order), '[]'::jsonb)
            FROM public.services sv
            WHERE sv.tenant_id = p_tenant_id AND sv.is_active = true
        ),
        'generated_prompt', public.generate_voice_agent_prompt(p_tenant_id),
        'recent_calls_summary', (
            SELECT jsonb_build_object(
                'total_today', COUNT(*) FILTER (WHERE vc.created_at >= CURRENT_DATE),
                'total_week', COUNT(*) FILTER (WHERE vc.created_at >= CURRENT_DATE - INTERVAL '7 days'),
                'avg_duration_seconds', ROUND(AVG(vc.duration_seconds)),
                'escalation_rate', ROUND(100.0 * COUNT(*) FILTER (WHERE vc.escalated) / NULLIF(COUNT(*), 0), 2)
            )
            FROM public.voice_calls vc
            WHERE vc.tenant_id = p_tenant_id
              AND vc.created_at >= CURRENT_DATE - INTERVAL '30 days'
        )
    ) INTO v_context;

    RETURN v_context;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_voice_agent_context IS
'Obtiene todo el contexto necesario para el Voice Agent: config, números, branches, staff, services, prompt generado.';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

COMMENT ON SCHEMA public IS
'TIS TIS Platform - Schema con sistema Voice Agent. Migration 067.';

SELECT '
=====================================================
VOICE AGENT SYSTEM - Migration 067 Completada
=====================================================

TABLAS CREADAS:
- voice_agent_config: Configuración del agente de voz por tenant
- voice_phone_numbers: Números de teléfono virtuales
- voice_calls: Registro de llamadas
- voice_call_messages: Mensajes dentro de llamadas
- voice_usage_logs: Tracking de uso para billing
- voice_prompt_templates: Templates de prompt por vertical

COLUMNAS AGREGADAS:
- channel_connections.channel: Ahora incluye "voice"
- ai_tenant_config.voice_enabled
- ai_tenant_config.voice_agent_config_id
- appointments.booking_source: Ahora incluye "voice"

FUNCIONES:
- generate_voice_agent_prompt(tenant_id): Auto-genera prompt
- get_voice_agent_context(tenant_id): Contexto completo para Voice Agent

RLS POLICIES:
- Configuradas para todas las tablas de voice

SEED DATA:
- Templates de prompt para: dental, restaurant, medical

PRÓXIMOS PASOS:
1. Configurar API keys de Twilio
2. Configurar API keys de ElevenLabs
3. Configurar API keys de Deepgram
4. Crear endpoints de webhook para Twilio
5. Implementar UI de configuración
=====================================================
' as resultado;
