-- =====================================================
-- MIGRATION 043: Sync Leads Branch from Appointments
--
-- PROBLEMA: Los leads tienen branch_id de Sucursal Principal
-- pero tienen citas asignadas a ESVA Tijuana. El lead debe
-- pertenecer a la misma sucursal que sus citas más recientes.
--
-- SOLUCION:
-- Actualizar el branch_id del lead basado en su cita más reciente
-- =====================================================

-- 1. Actualizar leads basándose en su cita más reciente
UPDATE public.leads l
SET branch_id = (
    SELECT a.branch_id
    FROM public.appointments a
    WHERE a.lead_id = l.id
    AND a.branch_id IS NOT NULL
    ORDER BY a.created_at DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.lead_id = l.id
    AND a.branch_id IS NOT NULL
    AND a.branch_id != COALESCE(l.branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 2. Verificación: Mostrar leads actualizados por sucursal
DO $$
DECLARE
    v_record RECORD;
BEGIN
    RAISE NOTICE '=== LEADS POR SUCURSAL ===';
    FOR v_record IN
        SELECT
            b.name as branch_name,
            COUNT(l.id) as lead_count
        FROM public.branches b
        LEFT JOIN public.leads l ON l.branch_id = b.id
        WHERE b.is_active = true
        GROUP BY b.id, b.name
        ORDER BY b.name
    LOOP
        RAISE NOTICE '% : % leads', v_record.branch_name, v_record.lead_count;
    END LOOP;
END $$;

-- 3. Reporte de sincronización
SELECT
    b.name as sucursal,
    COUNT(DISTINCT l.id) as leads,
    COUNT(DISTINCT a.id) as citas
FROM public.branches b
LEFT JOIN public.leads l ON l.branch_id = b.id
LEFT JOIN public.appointments a ON a.branch_id = b.id
WHERE b.is_active = true
GROUP BY b.id, b.name
ORDER BY b.name;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
