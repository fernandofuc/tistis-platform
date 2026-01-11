-- =====================================================
-- Migration 116: Fix Prompt Generation Critical Issues
-- REVISIÓN 4.8 - Escenarios Críticos de Prompts
-- =====================================================
-- Fixes:
-- P1: Prompt generation fails but UI shows success
-- P3: Voice config changes but cache not invalidated
-- P5: Invalid prompt saved despite validation failure
-- P8: Multiple messaging channels out of sync
-- P10: RPC returns partial data
-- =====================================================

-- =====================================================
-- P1 FIX: Track prompt generation status explicitly
-- =====================================================

-- Add generation_status to ai_generated_prompts
ALTER TABLE IF EXISTS public.ai_generated_prompts
ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'pending'
  CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed', 'validation_failed'));

ALTER TABLE IF EXISTS public.ai_generated_prompts
ADD COLUMN IF NOT EXISTS generation_error TEXT;

ALTER TABLE IF EXISTS public.ai_generated_prompts
ADD COLUMN IF NOT EXISTS validation_score INTEGER;

ALTER TABLE IF EXISTS public.ai_generated_prompts
ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ai_generated_prompts.generation_status IS 'Status of prompt generation: pending, generating, completed, failed, validation_failed';
COMMENT ON COLUMN public.ai_generated_prompts.validation_score IS 'Validation score 0-100 from prompt validator';
COMMENT ON COLUMN public.ai_generated_prompts.validation_errors IS 'Array of validation errors if any';

-- =====================================================
-- P3 FIX: Auto-invalidate prompt cache on config change
-- =====================================================

-- Function to invalidate voice prompt cache when voice_agent_config changes
CREATE OR REPLACE FUNCTION public.invalidate_voice_prompt_on_config_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If any prompt-affecting field changed, invalidate cache
  IF (
    OLD.assistant_name IS DISTINCT FROM NEW.assistant_name OR
    OLD.assistant_personality IS DISTINCT FROM NEW.assistant_personality OR
    OLD.custom_instructions IS DISTINCT FROM NEW.custom_instructions OR
    OLD.use_filler_phrases IS DISTINCT FROM NEW.use_filler_phrases OR
    OLD.filler_phrases IS DISTINCT FROM NEW.filler_phrases OR
    OLD.escalation_enabled IS DISTINCT FROM NEW.escalation_enabled OR
    OLD.escalation_phone IS DISTINCT FROM NEW.escalation_phone OR
    OLD.goodbye_message IS DISTINCT FROM NEW.goodbye_message
  ) THEN
    -- Mark voice prompt as needing regeneration
    UPDATE public.ai_generated_prompts
    SET
      generation_status = 'pending',
      updated_at = NOW()
    WHERE tenant_id = NEW.tenant_id
      AND channel = 'voice'
      AND status = 'active';

    -- Log the invalidation
    -- FIX: audit_logs table uses 'metadata' column, not 'changes'
    INSERT INTO public.audit_logs (
      tenant_id,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    ) VALUES (
      NEW.tenant_id,
      'prompt_cache_invalidated',
      'voice_agent_config',
      NEW.id,
      jsonb_build_object(
        'reason', 'voice_config_changed',
        'changed_fields', jsonb_build_object(
          'assistant_name_changed', OLD.assistant_name IS DISTINCT FROM NEW.assistant_name,
          'personality_changed', OLD.assistant_personality IS DISTINCT FROM NEW.assistant_personality,
          'filler_phrases_changed', OLD.use_filler_phrases IS DISTINCT FROM NEW.use_filler_phrases
        )
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger (if not exists pattern)
DROP TRIGGER IF EXISTS trg_invalidate_voice_prompt_on_config_change ON public.voice_agent_config;
CREATE TRIGGER trg_invalidate_voice_prompt_on_config_change
  AFTER UPDATE ON public.voice_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION public.invalidate_voice_prompt_on_config_change();

-- =====================================================
-- P5 FIX: Function to safely save prompt with validation
-- =====================================================

CREATE OR REPLACE FUNCTION public.save_validated_prompt(
  p_tenant_id UUID,
  p_channel TEXT,
  p_generated_prompt TEXT,
  p_source_data_hash TEXT,
  p_generator_model TEXT,
  p_validation_score INTEGER,
  p_validation_errors JSONB DEFAULT '[]'::jsonb,
  p_min_valid_score INTEGER DEFAULT 70
)
RETURNS TABLE(
  success BOOLEAN,
  prompt_id UUID,
  error_message TEXT,
  was_rejected BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prompt_id UUID;
  v_generation_status TEXT;
  v_has_critical_errors BOOLEAN;
BEGIN
  -- Check for critical validation errors
  v_has_critical_errors := EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_validation_errors) AS err
    WHERE err->>'severity' = 'critical'
  );

  -- Determine status based on validation
  IF v_has_critical_errors THEN
    v_generation_status := 'validation_failed';
  ELSIF p_validation_score < p_min_valid_score THEN
    v_generation_status := 'validation_failed';
  ELSE
    v_generation_status := 'completed';
  END IF;

  -- Only save to active cache if validation passed
  IF v_generation_status = 'completed' THEN
    -- Archive existing active prompt
    UPDATE public.ai_generated_prompts
    SET status = 'archived', updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND channel = p_channel
      AND status = 'active';

    -- Insert new active prompt
    INSERT INTO public.ai_generated_prompts (
      tenant_id,
      channel,
      generated_prompt,
      system_prompt,
      source_data_hash,
      generator_model,
      generation_status,
      validation_score,
      validation_errors,
      status,
      prompt_version,
      created_at,
      updated_at
    ) VALUES (
      p_tenant_id,
      p_channel,
      p_generated_prompt,
      p_generated_prompt,
      p_source_data_hash,
      p_generator_model,
      v_generation_status,
      p_validation_score,
      p_validation_errors,
      'active',
      COALESCE((
        SELECT MAX(prompt_version) + 1
        FROM public.ai_generated_prompts
        WHERE tenant_id = p_tenant_id AND channel = p_channel
      ), 1),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_prompt_id;

    RETURN QUERY SELECT
      TRUE AS success,
      v_prompt_id AS prompt_id,
      NULL::TEXT AS error_message,
      FALSE AS was_rejected;
  ELSE
    -- Save to history but NOT as active (for debugging)
    INSERT INTO public.ai_generated_prompts (
      tenant_id,
      channel,
      generated_prompt,
      system_prompt,
      source_data_hash,
      generator_model,
      generation_status,
      generation_error,
      validation_score,
      validation_errors,
      status,
      prompt_version,
      created_at,
      updated_at
    ) VALUES (
      p_tenant_id,
      p_channel,
      p_generated_prompt,
      p_generated_prompt,
      p_source_data_hash,
      p_generator_model,
      v_generation_status,
      'Validation failed: score=' || p_validation_score || ', critical_errors=' || v_has_critical_errors::TEXT,
      p_validation_score,
      p_validation_errors,
      'rejected',  -- Special status for failed validations
      0,  -- Version 0 indicates rejected
      NOW(),
      NOW()
    )
    RETURNING id INTO v_prompt_id;

    RETURN QUERY SELECT
      FALSE AS success,
      v_prompt_id AS prompt_id,
      'Prompt validation failed: score=' || p_validation_score ||
        CASE WHEN v_has_critical_errors THEN ' (has critical errors)' ELSE '' END AS error_message,
      TRUE AS was_rejected;
  END IF;
END;
$$;

-- =====================================================
-- P8 FIX: Sync all messaging channel prompts
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_messaging_prompts(
  p_tenant_id UUID,
  p_generated_prompt TEXT,
  p_source_data_hash TEXT,
  p_generator_model TEXT,
  p_validation_score INTEGER DEFAULT 100,
  p_validation_errors JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE(
  channel TEXT,
  success BOOLEAN,
  prompt_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_channel TEXT;
  v_messaging_channels TEXT[] := ARRAY['whatsapp', 'instagram', 'facebook', 'tiktok', 'webchat'];
  v_result RECORD;
BEGIN
  -- Sync to all messaging channels atomically
  FOREACH v_channel IN ARRAY v_messaging_channels
  LOOP
    SELECT * INTO v_result FROM public.save_validated_prompt(
      p_tenant_id,
      v_channel,
      p_generated_prompt,
      p_source_data_hash,
      p_generator_model,
      p_validation_score,
      p_validation_errors
    );

    RETURN QUERY SELECT v_channel, v_result.success, v_result.prompt_id;
  END LOOP;
END;
$$;

-- =====================================================
-- P10 FIX: Validate RPC response completeness
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_tenant_ai_context_validated(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_validation_warnings TEXT[] := '{}';
BEGIN
  -- Get the base context
  SELECT row_to_json(r)::JSONB INTO v_result
  FROM (
    SELECT * FROM public.get_tenant_ai_context(p_tenant_id)
  ) r;

  -- Validate critical fields
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Tenant context is NULL for tenant_id: %', p_tenant_id;
  END IF;

  IF v_result->>'tenant_name' IS NULL THEN
    v_validation_warnings := array_append(v_validation_warnings, 'tenant_name is missing');
  END IF;

  IF jsonb_array_length(COALESCE(v_result->'branches', '[]'::jsonb)) = 0 THEN
    v_validation_warnings := array_append(v_validation_warnings, 'no branches configured');
  END IF;

  IF jsonb_array_length(COALESCE(v_result->'services', '[]'::jsonb)) = 0 THEN
    v_validation_warnings := array_append(v_validation_warnings, 'no services configured');
  END IF;

  -- Add validation metadata to response
  v_result := v_result || jsonb_build_object(
    '_validation', jsonb_build_object(
      'is_complete', array_length(v_validation_warnings, 1) IS NULL OR array_length(v_validation_warnings, 1) = 0,
      'warnings', v_validation_warnings,
      'validated_at', NOW()
    )
  );

  RETURN v_result;
END;
$$;

-- =====================================================
-- P6 FIX: Ensure voice fallback uses voice-specific data
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_voice_fallback_prompt(
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prompt TEXT;
  v_voice_config RECORD;
  v_tenant_name TEXT;
BEGIN
  -- Get tenant name
  SELECT name INTO v_tenant_name
  FROM public.tenants
  WHERE id = p_tenant_id;

  -- Get voice config
  SELECT * INTO v_voice_config
  FROM public.voice_agent_config
  WHERE tenant_id = p_tenant_id
    AND voice_enabled = TRUE;

  IF v_voice_config IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build minimal voice-specific fallback prompt
  v_prompt := format(
    E'## Eres %s, asistente de voz de %s\n\n' ||
    E'### IMPORTANTE: LLAMADA DE VOZ\n' ||
    E'- Respuestas CORTAS (2-3 oraciones máximo)\n' ||
    E'- NO uses emojis\n' ||
    E'- Habla de forma natural y conversacional\n' ||
    E'%s\n\n' ||
    E'### Personalidad: %s\n' ||
    E'### Si no puedes ayudar, ofrece transferir a un humano.',
    COALESCE(v_voice_config.assistant_name, 'Asistente'),
    COALESCE(v_tenant_name, 'la empresa'),
    CASE WHEN v_voice_config.use_filler_phrases
      THEN E'- Usa muletillas como "Claro...", "Mmm...", "Déjame ver..."'
      ELSE E'- NO uses muletillas conversacionales'
    END,
    COALESCE(v_voice_config.assistant_personality, 'professional_friendly')
  );

  RETURN v_prompt;
END;
$$;

-- =====================================================
-- View: Prompt generation health dashboard
-- =====================================================

CREATE OR REPLACE VIEW public.v_prompt_health_dashboard AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  agp.channel,
  agp.generation_status,
  agp.validation_score,
  agp.prompt_version,
  agp.updated_at AS last_updated,
  CASE
    WHEN agp.generation_status = 'validation_failed' THEN 'CRITICAL'
    WHEN agp.generation_status = 'failed' THEN 'ERROR'
    WHEN agp.generation_status = 'pending' THEN 'STALE'
    WHEN agp.validation_score < 70 THEN 'WARNING'
    WHEN agp.generated_prompt IS NULL OR LENGTH(agp.generated_prompt) < 500 THEN 'WARNING'
    ELSE 'OK'
  END AS health_status,
  LENGTH(COALESCE(agp.generated_prompt, '')) AS prompt_length,
  jsonb_array_length(COALESCE(agp.validation_errors, '[]'::jsonb)) AS error_count
FROM public.tenants t
LEFT JOIN public.ai_generated_prompts agp
  ON t.id = agp.tenant_id
  AND agp.status = 'active'
WHERE t.deleted_at IS NULL
ORDER BY
  CASE agp.generation_status
    WHEN 'validation_failed' THEN 1
    WHEN 'failed' THEN 2
    WHEN 'pending' THEN 3
    ELSE 4
  END,
  t.name,
  agp.channel;

-- Grant permissions
GRANT SELECT ON public.v_prompt_health_dashboard TO authenticated;

-- =====================================================
-- Backfill: Set generation_status for existing prompts
-- =====================================================

UPDATE public.ai_generated_prompts
SET generation_status = 'completed'
WHERE generation_status IS NULL
  AND status = 'active'
  AND generated_prompt IS NOT NULL
  AND LENGTH(generated_prompt) > 500;

UPDATE public.ai_generated_prompts
SET generation_status = 'failed'
WHERE generation_status IS NULL
  AND (generated_prompt IS NULL OR LENGTH(generated_prompt) < 100);

-- =====================================================
-- Index for faster prompt health queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_generated_prompts_health
ON public.ai_generated_prompts (tenant_id, channel, generation_status, status)
WHERE status = 'active';

-- Log migration
-- FIX: audit_logs table uses 'metadata' column, not 'changes'
INSERT INTO public.audit_logs (action, entity_type, metadata, created_at)
VALUES (
  'migration_applied',
  'database',
  jsonb_build_object(
    'migration', '116_FIX_PROMPT_GENERATION_CRITICAL_ISSUES',
    'fixes', ARRAY['P1', 'P3', 'P5', 'P6', 'P8', 'P10'],
    'description', 'Critical prompt generation and validation fixes'
  ),
  NOW()
);
