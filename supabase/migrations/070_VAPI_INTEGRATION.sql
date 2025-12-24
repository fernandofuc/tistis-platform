-- =====================================================
-- TIS TIS PLATFORM - Migration 070: VAPI Integration
-- Agrega columna vapi_assistant_id para integración VAPI oculta
-- =====================================================

-- Agregar columna vapi_assistant_id a voice_phone_numbers
-- Esta columna almacena el ID del asistente creado en VAPI
-- que se usa para manejar las llamadas de este número

ALTER TABLE voice_phone_numbers
ADD COLUMN IF NOT EXISTS vapi_assistant_id TEXT;

-- Comentario explicativo
COMMENT ON COLUMN voice_phone_numbers.vapi_assistant_id IS
'ID del asistente en VAPI asociado a este número. Se usa para Server-Side Response Mode donde TIS TIS genera las respuestas de IA.';

-- Actualizar el tipo de telephony_provider para incluir 'vapi'
-- Primero verificamos si ya existe el constraint
DO $$
BEGIN
  -- Intentar eliminar el constraint existente si existe
  ALTER TABLE voice_phone_numbers
  DROP CONSTRAINT IF EXISTS voice_phone_numbers_telephony_provider_check;

  -- Crear nuevo constraint que incluye 'vapi'
  ALTER TABLE voice_phone_numbers
  ADD CONSTRAINT voice_phone_numbers_telephony_provider_check
  CHECK (telephony_provider IN ('twilio', 'vonage', 'telnyx', 'bandwidth', 'vapi'));
EXCEPTION
  WHEN others THEN
    -- Si falla (ej: constraint no existe con ese nombre), lo ignoramos
    NULL;
END $$;

-- Índice para búsquedas por vapi_assistant_id
CREATE INDEX IF NOT EXISTS idx_voice_phone_numbers_vapi_assistant_id
ON voice_phone_numbers(vapi_assistant_id)
WHERE vapi_assistant_id IS NOT NULL;

-- =====================================================
-- NOTA DE CONFIGURACIÓN
-- =====================================================
-- Para que VAPI Oculto funcione, necesitas agregar en tu .env:
--
-- VAPI_API_KEY=vapi_xxxxx (API Key de VAPI para TIS TIS Platform)
-- VAPI_WEBHOOK_SECRET=tu-secreto-webhook (opcional pero recomendado)
--
-- Obtén tu API Key en: https://dashboard.vapi.ai
-- =====================================================
