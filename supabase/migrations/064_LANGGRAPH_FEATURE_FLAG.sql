-- =====================================================
-- TIS TIS PLATFORM - LANGGRAPH FEATURE FLAG
-- Migration: 064_LANGGRAPH_FEATURE_FLAG.sql
-- Date: December 21, 2024
-- Version: 1.0
--
-- PURPOSE: Agregar soporte para feature flag de LangGraph
-- en la configuración de AI de cada tenant.
--
-- USAGE:
-- Para activar LangGraph para un tenant específico:
-- UPDATE ai_tenant_config SET use_langgraph = true WHERE tenant_id = 'xxx';
--
-- Para activar globalmente (no recomendado sin testing):
-- UPDATE ai_tenant_config SET use_langgraph = true;
-- =====================================================

-- =====================================================
-- 1. Agregar columna use_langgraph a ai_tenant_config
-- =====================================================

ALTER TABLE public.ai_tenant_config
ADD COLUMN IF NOT EXISTS use_langgraph BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.ai_tenant_config.use_langgraph IS
'Feature flag para usar el nuevo sistema LangGraph multi-agente en lugar del sistema legacy. Default: false (usar sistema legacy).';

-- =====================================================
-- 2. Agregar columna langgraph_config para configuración
-- =====================================================

ALTER TABLE public.ai_tenant_config
ADD COLUMN IF NOT EXISTS langgraph_config JSONB DEFAULT '{
  "max_iterations": 5,
  "enable_handoffs": true,
  "enable_booking": true,
  "preferred_agents": [],
  "disabled_agents": []
}'::jsonb;

COMMENT ON COLUMN public.ai_tenant_config.langgraph_config IS
'Configuración específica para el sistema LangGraph: max_iterations, agentes habilitados/deshabilitados, etc.';

-- =====================================================
-- 3. Índice para búsqueda rápida de tenants con LangGraph
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_tenant_config_langgraph
ON public.ai_tenant_config(use_langgraph)
WHERE use_langgraph = true;

-- =====================================================
-- 4. Función helper para verificar si tenant usa LangGraph
-- =====================================================

CREATE OR REPLACE FUNCTION public.tenant_uses_langgraph(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT use_langgraph
     FROM public.ai_tenant_config
     WHERE tenant_id = p_tenant_id
     LIMIT 1),
    false
  );
$$;

COMMENT ON FUNCTION public.tenant_uses_langgraph IS
'Verifica si un tenant tiene habilitado el sistema LangGraph.';

-- =====================================================
-- 5. Log de ejecución
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 064_LANGGRAPH_FEATURE_FLAG completed successfully';
  RAISE NOTICE 'To enable LangGraph for a tenant: UPDATE ai_tenant_config SET use_langgraph = true WHERE tenant_id = ''xxx'';';
END $$;
