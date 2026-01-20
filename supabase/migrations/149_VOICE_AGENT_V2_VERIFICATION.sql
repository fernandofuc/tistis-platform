-- =====================================================
-- TIS TIS PLATFORM - VOICE AGENT v2.0
-- Migration: 149_VOICE_AGENT_V2_VERIFICATION.sql
-- Date: January 2025
-- Version: 2.0
--
-- PURPOSE: Script de verificacion para Voice Agent v2.0
-- Verifica que todas las tablas, funciones y seed data
-- estan correctamente instalados.
--
-- PARTE DE: Voice Agent v2.0 - FASE 01 - MICROFASE 1.9
-- =====================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_function_count INTEGER;
    v_type_count INTEGER;
    v_voice_count INTEGER;
    v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VOICE AGENT v2.0 - VERIFICACION FINAL';
    RAISE NOTICE '========================================';

    -- =====================================================
    -- VERIFICAR TABLAS
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '1. Verificando tablas...';

    -- voice_assistant_types
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_assistant_types' AND table_schema = 'public') THEN
        RAISE NOTICE '   [OK] voice_assistant_types';
    ELSE
        v_errors := array_append(v_errors, 'TABLA FALTANTE: voice_assistant_types');
        RAISE WARNING '   [FALTA] voice_assistant_types';
    END IF;

    -- voice_catalog
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_catalog' AND table_schema = 'public') THEN
        RAISE NOTICE '   [OK] voice_catalog';
    ELSE
        v_errors := array_append(v_errors, 'TABLA FALTANTE: voice_catalog');
        RAISE WARNING '   [FALTA] voice_catalog';
    END IF;

    -- voice_assistant_configs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_assistant_configs' AND table_schema = 'public') THEN
        RAISE NOTICE '   [OK] voice_assistant_configs';
    ELSE
        v_errors := array_append(v_errors, 'TABLA FALTANTE: voice_assistant_configs');
        RAISE WARNING '   [FALTA] voice_assistant_configs';
    END IF;

    -- voice_assistant_metrics
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_assistant_metrics' AND table_schema = 'public') THEN
        RAISE NOTICE '   [OK] voice_assistant_metrics';
    ELSE
        v_errors := array_append(v_errors, 'TABLA FALTANTE: voice_assistant_metrics');
        RAISE WARNING '   [FALTA] voice_assistant_metrics';
    END IF;

    -- voice_circuit_breaker_state
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_circuit_breaker_state' AND table_schema = 'public') THEN
        RAISE NOTICE '   [OK] voice_circuit_breaker_state';
    ELSE
        v_errors := array_append(v_errors, 'TABLA FALTANTE: voice_circuit_breaker_state');
        RAISE WARNING '   [FALTA] voice_circuit_breaker_state';
    END IF;

    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN (
            'voice_assistant_types',
            'voice_catalog',
            'voice_assistant_configs',
            'voice_assistant_metrics',
            'voice_circuit_breaker_state'
        );

    RAISE NOTICE '   Total tablas v2: %/5', v_table_count;

    -- =====================================================
    -- VERIFICAR FUNCIONES
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '2. Verificando funciones...';

    -- get_voice_config_for_call
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_voice_config_for_call') THEN
        RAISE NOTICE '   [OK] get_voice_config_for_call';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: get_voice_config_for_call');
        RAISE WARNING '   [FALTA] get_voice_config_for_call';
    END IF;

    -- get_voice_business_context
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_voice_business_context') THEN
        RAISE NOTICE '   [OK] get_voice_business_context';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: get_voice_business_context');
        RAISE WARNING '   [FALTA] get_voice_business_context';
    END IF;

    -- check_voice_availability
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_voice_availability') THEN
        RAISE NOTICE '   [OK] check_voice_availability';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: check_voice_availability');
        RAISE WARNING '   [FALTA] check_voice_availability';
    END IF;

    -- create_voice_appointment
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_voice_appointment') THEN
        RAISE NOTICE '   [OK] create_voice_appointment';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: create_voice_appointment');
        RAISE WARNING '   [FALTA] create_voice_appointment';
    END IF;

    -- create_voice_reservation
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_voice_reservation') THEN
        RAISE NOTICE '   [OK] create_voice_reservation';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: create_voice_reservation');
        RAISE WARNING '   [FALTA] create_voice_reservation';
    END IF;

    -- record_circuit_breaker_success
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_circuit_breaker_success') THEN
        RAISE NOTICE '   [OK] record_circuit_breaker_success';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: record_circuit_breaker_success');
        RAISE WARNING '   [FALTA] record_circuit_breaker_success';
    END IF;

    -- record_circuit_breaker_failure
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_circuit_breaker_failure') THEN
        RAISE NOTICE '   [OK] record_circuit_breaker_failure';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: record_circuit_breaker_failure');
        RAISE WARNING '   [FALTA] record_circuit_breaker_failure';
    END IF;

    -- can_make_request
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_make_request') THEN
        RAISE NOTICE '   [OK] can_make_request';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: can_make_request');
        RAISE WARNING '   [FALTA] can_make_request';
    END IF;

    -- aggregate_voice_metrics
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aggregate_voice_metrics') THEN
        RAISE NOTICE '   [OK] aggregate_voice_metrics';
    ELSE
        v_errors := array_append(v_errors, 'FUNCION FALTANTE: aggregate_voice_metrics');
        RAISE WARNING '   [FALTA] aggregate_voice_metrics';
    END IF;

    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            'get_voice_config_for_call',
            'get_voice_business_context',
            'check_voice_availability',
            'create_voice_appointment',
            'create_voice_reservation',
            'record_circuit_breaker_success',
            'record_circuit_breaker_failure',
            'can_make_request',
            'aggregate_voice_metrics'
        );

    RAISE NOTICE '   Total funciones v2: %/9', v_function_count;

    -- =====================================================
    -- VERIFICAR SEED DATA
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '3. Verificando seed data...';

    -- Tipos de asistente
    SELECT COUNT(*) INTO v_type_count FROM public.voice_assistant_types;
    IF v_type_count >= 6 THEN
        RAISE NOTICE '   [OK] Tipos de asistente: %', v_type_count;
    ELSE
        v_errors := array_append(v_errors, 'SEED DATA: Se esperaban 6+ tipos, hay ' || v_type_count);
        RAISE WARNING '   [INCOMPLETO] Tipos de asistente: % (esperado: 6)', v_type_count;
    END IF;

    -- Voces
    SELECT COUNT(*) INTO v_voice_count FROM public.voice_catalog;
    IF v_voice_count >= 4 THEN
        RAISE NOTICE '   [OK] Voces en catalogo: %', v_voice_count;
    ELSE
        v_errors := array_append(v_errors, 'SEED DATA: Se esperaban 4+ voces, hay ' || v_voice_count);
        RAISE WARNING '   [INCOMPLETO] Voces en catalogo: % (esperado: 4+)', v_voice_count;
    END IF;

    -- =====================================================
    -- VERIFICAR RLS
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '4. Verificando RLS...';

    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'voice_assistant_configs'
            AND rowsecurity = true
    ) THEN
        RAISE NOTICE '   [OK] RLS habilitado en voice_assistant_configs';
    ELSE
        v_errors := array_append(v_errors, 'RLS no habilitado en voice_assistant_configs');
        RAISE WARNING '   [FALTA] RLS en voice_assistant_configs';
    END IF;

    -- =====================================================
    -- RESULTADO FINAL
    -- =====================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    IF array_length(v_errors, 1) IS NULL OR array_length(v_errors, 1) = 0 THEN
        RAISE NOTICE 'RESULTADO: VERIFICACION EXITOSA';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE 'Voice Agent v2.0 instalado correctamente:';
        RAISE NOTICE '  - 5 tablas nuevas';
        RAISE NOTICE '  - 9+ funciones SQL';
        RAISE NOTICE '  - 6 tipos de asistente';
        RAISE NOTICE '  - 6 voces en catalogo';
        RAISE NOTICE '';
        RAISE NOTICE 'Listo para FASE 02: Seguridad';
    ELSE
        RAISE NOTICE 'RESULTADO: VERIFICACION CON ERRORES';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE 'Errores encontrados:';
        FOR i IN 1..array_length(v_errors, 1) LOOP
            RAISE WARNING '  - %', v_errors[i];
        END LOOP;
        RAISE NOTICE '';
        RAISE NOTICE 'Por favor corrija los errores antes de continuar.';
    END IF;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VISTA: Resumen de Voice Agent v2 Config
-- =====================================================

CREATE OR REPLACE VIEW public.v_voice_agent_v2_summary AS
SELECT
    vac.id as config_id,
    t.name as business_name,
    vat.name as assistant_type,
    vat.vertical,
    vc.display_name as voice_name,
    vac.personality_type,
    vac.is_active,
    vac.status,
    vac.phone_number,
    vac.created_at,
    vac.updated_at
FROM public.voice_assistant_configs vac
JOIN public.tenants t ON vac.tenant_id = t.id
JOIN public.voice_assistant_types vat ON vac.assistant_type_id = vat.id
LEFT JOIN public.voice_catalog vc ON vac.voice_id = vc.id;

COMMENT ON VIEW public.v_voice_agent_v2_summary IS
'Vista resumen de configuraciones de Voice Agent v2.0';

-- =====================================================
-- FIN MIGRACION 149
-- =====================================================
