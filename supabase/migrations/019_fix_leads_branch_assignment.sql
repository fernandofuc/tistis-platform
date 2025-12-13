-- =====================================================
-- MIGRATION 019: Fix Leads Branch Assignment
--
-- PROBLEMA: Los leads existentes tienen branch_id = NULL
-- porque fueron creados antes de implementar multi-sucursal.
-- Esto causa que al filtrar por sucursal específica no
-- aparezcan leads.
--
-- SOLUCION:
-- 1. Asignar branch_id a leads existentes (sucursal HQ del tenant)
-- 2. Mantener lógica que permita leads sin sucursal
-- =====================================================

-- 1. Crear función helper para obtener sucursal HQ de un tenant
CREATE OR REPLACE FUNCTION get_tenant_headquarters(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_branch_id UUID;
BEGIN
    -- Primero buscar la sucursal marcada como headquarters
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE tenant_id = p_tenant_id
    AND is_headquarters = true
    AND is_active = true
    LIMIT 1;

    -- Si no hay headquarters, tomar la primera sucursal activa
    IF v_branch_id IS NULL THEN
        SELECT id INTO v_branch_id
        FROM public.branches
        WHERE tenant_id = p_tenant_id
        AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Actualizar leads existentes que no tienen branch_id asignado
-- Les asignamos la sucursal headquarters de su tenant
UPDATE public.leads
SET branch_id = get_tenant_headquarters(tenant_id)
WHERE branch_id IS NULL
AND tenant_id IN (
    SELECT DISTINCT tenant_id
    FROM public.branches
    WHERE is_active = true
);

-- 3. Verificación: Mostrar cuántos leads fueron actualizados
DO $$
DECLARE
    v_updated_count INTEGER;
    v_remaining_null INTEGER;
BEGIN
    -- Contar leads con branch_id asignado
    SELECT COUNT(*) INTO v_updated_count
    FROM public.leads
    WHERE branch_id IS NOT NULL;

    -- Contar leads aún sin branch_id (tenants sin sucursales)
    SELECT COUNT(*) INTO v_remaining_null
    FROM public.leads
    WHERE branch_id IS NULL;

    RAISE NOTICE 'Leads con branch_id asignado: %', v_updated_count;
    RAISE NOTICE 'Leads sin branch_id (tenants sin sucursales): %', v_remaining_null;
END $$;

-- 4. También actualizar appointments sin branch_id
UPDATE public.appointments
SET branch_id = (
    SELECT branch_id
    FROM public.leads
    WHERE leads.id = appointments.lead_id
)
WHERE branch_id IS NULL
AND lead_id IS NOT NULL
AND EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = appointments.lead_id
    AND leads.branch_id IS NOT NULL
);

-- 5. Actualizar conversations sin branch_id
UPDATE public.conversations
SET branch_id = (
    SELECT branch_id
    FROM public.leads
    WHERE leads.id = conversations.lead_id
)
WHERE branch_id IS NULL
AND lead_id IS NOT NULL
AND EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = conversations.lead_id
    AND leads.branch_id IS NOT NULL
);

-- 6. Reporte final
SELECT
    'leads' as table_name,
    COUNT(*) as total,
    COUNT(branch_id) as with_branch,
    COUNT(*) - COUNT(branch_id) as without_branch
FROM public.leads
UNION ALL
SELECT
    'appointments' as table_name,
    COUNT(*) as total,
    COUNT(branch_id) as with_branch,
    COUNT(*) - COUNT(branch_id) as without_branch
FROM public.appointments
UNION ALL
SELECT
    'conversations' as table_name,
    COUNT(*) as total,
    COUNT(branch_id) as with_branch,
    COUNT(*) - COUNT(branch_id) as without_branch
FROM public.conversations;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
