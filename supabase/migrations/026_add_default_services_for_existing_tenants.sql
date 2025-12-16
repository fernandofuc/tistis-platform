-- =====================================================
-- Migration 026: Add Default Services for Existing Tenants
-- =====================================================
-- Problem: Tenants created before provisioning code was updated
-- don't have any services, so the appointments modal shows
-- "Seleccionar servicio" with no options.
--
-- Solution: Insert default services for tenants that have 0 services.
-- =====================================================

-- Insert default services for tenants that don't have any services
INSERT INTO public.services (tenant_id, name, slug, category, is_active, display_order, duration_minutes, price_min, price_max, price_unit, currency)
SELECT
    t.id as tenant_id,
    s.name,
    s.slug,
    'General' as category,
    true as is_active,
    s.display_order,
    30 as duration_minutes,
    0 as price_min,
    0 as price_max,
    'per_service' as price_unit,
    'MXN' as currency
FROM public.tenants t
CROSS JOIN (
    VALUES
        ('Consulta General', 'consulta-general', 0),
        ('Servicio Básico', 'servicio-basico', 1),
        ('Servicio Premium', 'servicio-premium', 2),
        ('Asesoría', 'asesoria', 3),
        ('Seguimiento', 'seguimiento', 4)
) AS s(name, slug, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM public.services srv WHERE srv.tenant_id = t.id
);

-- =====================================================
-- Verify: Check if services were added
-- =====================================================
-- SELECT tenant_id, COUNT(*) as services_count
-- FROM public.services
-- GROUP BY tenant_id;

-- =====================================================
-- Applied: 2024-12-15
-- This migration adds default services to existing tenants
-- that were created before the provisioning code was updated.
-- =====================================================
