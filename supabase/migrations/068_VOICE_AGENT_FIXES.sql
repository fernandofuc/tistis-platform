-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT FIXES
-- Migration: 068_VOICE_AGENT_FIXES.sql
-- Date: December 2024
-- Version: 1.0
--
-- PURPOSE: Correcciones a la migración 067 de Voice Agent
-- =====================================================

-- =====================================================
-- FIX 1: Policy para INSERT en voice_call_messages
-- El webhook necesita poder insertar mensajes
-- =====================================================

-- Primero dropeamos la política existente si existe
DROP POLICY IF EXISTS "Service role can insert call messages" ON public.voice_call_messages;

-- Creamos una política para que el service role pueda insertar
-- (Esto es redundante porque service_role ya tiene acceso total, pero es más explícito)
CREATE POLICY "Service role can insert call messages"
    ON public.voice_call_messages
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- =====================================================
-- FIX 2: Índice para vapi_call_id
-- Para búsquedas rápidas por VAPI call ID
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_voice_calls_vapi_id
ON public.voice_calls(vapi_call_id)
WHERE vapi_call_id IS NOT NULL;

-- =====================================================
-- FIX 3: Función generate_voice_agent_prompt mejorada
-- Maneja mejor el caso de {specialties}
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_voice_agent_prompt(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_tenant RECORD;
    v_template RECORD;
    v_prompt TEXT;
    v_services TEXT;
    v_doctors TEXT;
    v_specialties TEXT;
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
    WHERE vertical = COALESCE(v_tenant.vertical, 'services')
      AND template_key = 'system_prompt'
      AND is_default = true;

    IF NOT FOUND THEN
        -- Usar template dental como fallback (es el más completo)
        SELECT * INTO v_template
        FROM public.voice_prompt_templates
        WHERE vertical = 'dental'
          AND template_key = 'system_prompt'
          AND is_default = true;
    END IF;

    IF NOT FOUND THEN
        -- Crear un prompt básico si no hay templates
        RETURN 'Eres un asistente de voz profesional de ' || v_tenant.name || '. Ayuda a los clientes con sus consultas de manera amable y eficiente.';
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

    -- Construir lista de doctores/staff con especialidades
    SELECT STRING_AGG(
        '- ' || COALESCE(st.display_name, st.first_name || ' ' || st.last_name) ||
        CASE WHEN st.specialty IS NOT NULL THEN ' (' || st.specialty || ')' ELSE '' END,
        E'\n'
    ) INTO v_doctors
    FROM public.staff st
    WHERE st.tenant_id = p_tenant_id
      AND st.is_active = true
      AND st.role IN ('dentist', 'specialist', 'owner', 'doctor', 'provider');

    -- Construir lista de especialidades únicas
    SELECT STRING_AGG(DISTINCT specialty, ', ')
    INTO v_specialties
    FROM public.staff
    WHERE tenant_id = p_tenant_id
      AND is_active = true
      AND specialty IS NOT NULL;

    -- Construir lista de sucursales
    SELECT STRING_AGG(
        '- ' || b.name || ': ' || COALESCE(b.address, '') ||
        CASE WHEN b.city IS NOT NULL THEN ', ' || b.city ELSE '' END ||
        CASE WHEN b.phone IS NOT NULL THEN ' - Tel: ' || b.phone ELSE '' END,
        E'\n'
    ) INTO v_branches
    FROM public.branches b
    WHERE b.tenant_id = p_tenant_id AND b.is_active = true;

    -- Construir horarios de todas las sucursales
    SELECT STRING_AGG(
        b.name || ': ' ||
        CASE
            WHEN b.operating_hours IS NOT NULL AND b.operating_hours->>'monday' IS NOT NULL
            THEN COALESCE(
                (b.operating_hours->'monday'->>'open') || ' - ' || (b.operating_hours->'monday'->>'close'),
                'Horario no configurado'
            )
            ELSE 'Horario no configurado'
        END,
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
    v_prompt := REPLACE(v_prompt, '{business_name}', COALESCE(v_tenant.name, 'el negocio'));
    v_prompt := REPLACE(v_prompt, '{address}', COALESCE(
        (SELECT address FROM public.branches WHERE tenant_id = p_tenant_id AND is_headquarters = true LIMIT 1),
        (SELECT address FROM public.branches WHERE tenant_id = p_tenant_id LIMIT 1),
        'Dirección no disponible'
    ));
    v_prompt := REPLACE(v_prompt, '{phone}', COALESCE(v_tenant.primary_contact_phone, 'Teléfono no disponible'));
    v_prompt := REPLACE(v_prompt, '{operating_hours}', COALESCE(v_hours, 'Horarios no configurados'));
    v_prompt := REPLACE(v_prompt, '{services}', COALESCE(v_services, 'Servicios no configurados'));
    v_prompt := REPLACE(v_prompt, '{doctors}', COALESCE(v_doctors, 'Personal no configurado'));
    v_prompt := REPLACE(v_prompt, '{specialties}', COALESCE(v_specialties, v_services, 'Sin especialidades configuradas'));
    v_prompt := REPLACE(v_prompt, '{branches}', COALESCE(v_branches, 'Sucursales no configuradas'));
    v_prompt := REPLACE(v_prompt, '{knowledge_base}', COALESCE(v_knowledge_base, 'Sin información adicional'));
    v_prompt := REPLACE(v_prompt, '{custom_instructions}', COALESCE(v_voice_config.custom_instructions, ''));

    -- Variables para restaurant (si aplica)
    v_prompt := REPLACE(v_prompt, '{menu}', COALESCE(v_services, 'Menú no disponible'));

    RETURN v_prompt;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.generate_voice_agent_prompt IS
'Genera automáticamente el prompt del agente de voz basándose en los datos del tenant. Versión mejorada con mejor manejo de nulls.';

-- =====================================================
-- FIX 4: Agregar template para vertical 'services' (fallback)
-- =====================================================

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
    'services',
    'system_prompt',
    'Asistente de Voz Genérico para Servicios',
    '## Personalidad:
Eres {assistant_name}, un asistente de voz IA de {business_name}. Tienes un tono profesional y amigable.

## Tarea:
Tu tarea principal es ayudar a los clientes a agendar citas, responder preguntas sobre servicios, horarios y ubicación.

## Información del Servicio:
### Negocio
- Nombre: {business_name}
- Dirección: {address}
- Teléfono: {phone}
- Horarios: {operating_hours}

### Servicios Disponibles
{services}

### Personal
{doctors}

### Sucursales
{branches}

## Citas:
- Fecha actual: {{now}}
- Hora actual: {{now}}

### Reglas para agendar:
1. Solicitar nombre del cliente
2. Preguntar qué servicio necesita
3. Verificar disponibilidad
4. Confirmar fecha, hora y detalles
5. Solicitar teléfono de contacto
6. Confirmar toda la información

## Base de Conocimiento
{knowledge_base}

## Instrucciones Especiales
{custom_instructions}

## Estilo:
- Se profesional pero amigable
- Usa frases naturales como: "Mmm...", "Claro...", "Déjame ver..."
- Mantén respuestas concisas (2-3 oraciones máximo)
- NUNCA uses emojis
- Si no puedes ayudar, ofrece transferir a un humano',
    ARRAY['assistant_name', 'business_name', 'address', 'phone', 'operating_hours', 'services', 'doctors', 'branches', 'knowledge_base', 'custom_instructions'],
    'Hola, soy {assistant_name} de {business_name}. ¿En qué puedo ayudarte?',
    '{
        "temperature": 0.25,
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

-- =====================================================
-- FIX 5: Agregar más roles válidos para staff en la función
-- El rol 'doctor' también es válido
-- =====================================================

-- Ya corregido en la función de arriba

-- =====================================================
-- FIX 6: Asegurar que las políticas RLS de voice_calls
-- permiten INSERT desde service_role
-- =====================================================

-- El service role ya tiene acceso total, pero verificamos
DROP POLICY IF EXISTS "Service role full access voice_calls" ON public.voice_calls;
CREATE POLICY "Service role full access voice_calls" ON public.voice_calls
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- FIX 7: Función increment_config_version
-- Necesaria para el servicio voice-agent.service.ts
-- =====================================================

-- Nota: La función RPC no funciona de la forma esperada.
-- El servicio debe usar un UPDATE con RETURNING en su lugar.
-- Esta corrección es para documentar que el approach debe cambiar.

-- Crear función helper para obtener la siguiente versión
CREATE OR REPLACE FUNCTION public.get_next_voice_config_version(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_version INTEGER;
BEGIN
    SELECT configuration_version INTO current_version
    FROM public.voice_agent_config
    WHERE tenant_id = p_tenant_id;

    RETURN COALESCE(current_version, 0) + 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_next_voice_config_version IS
'Obtiene la siguiente versión de configuración para un tenant. Usado en actualizaciones de voice_agent_config.';

-- =====================================================
-- FIX 8: Asegurar que voice_calls tiene índice en tenant_id
-- Para queries frecuentes por tenant
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_voice_calls_tenant_created
ON public.voice_calls(tenant_id, created_at DESC);

-- =====================================================
-- FIX 9: Validar que el constraint UNIQUE existe
-- para voice_prompt_templates
-- =====================================================

-- El ON CONFLICT necesita un constraint único
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'voice_prompt_templates_vertical_key_default_unique'
    ) THEN
        ALTER TABLE public.voice_prompt_templates
        ADD CONSTRAINT voice_prompt_templates_vertical_key_default_unique
        UNIQUE (vertical, template_key, is_default);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- El constraint ya existe, ignorar
    NULL;
END $$;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

SELECT '
=====================================================
VOICE AGENT FIXES - Migration 068 Completada
=====================================================

CORRECCIONES APLICADAS:
1. Policy para INSERT en voice_call_messages
2. Índice para vapi_call_id
3. Función generate_voice_agent_prompt mejorada
4. Template fallback para vertical "services"
5. Roles de staff expandidos (doctor, provider)
6. Políticas RLS verificadas para service_role
7. Función helper get_next_voice_config_version
8. Índice compuesto para tenant_id + created_at
9. Constraint UNIQUE para voice_prompt_templates

=====================================================
' as resultado;
