-- =====================================================
-- Migration 084: Fix Missing Dental Services for Existing Tenants
-- =====================================================
-- This migration adds the full 36-service dental catalog to tenants
-- that only have 7 or fewer services (created before migration 042
-- or after provisioning.ts was updated).
--
-- It uses ON CONFLICT to avoid duplicating existing services.
-- =====================================================

-- Find dental tenants with fewer than 36 services and add missing ones
INSERT INTO public.services (
    tenant_id,
    name,
    slug,
    category,
    is_active,
    display_order,
    duration_minutes,
    price_min,
    price_max,
    price_unit,
    currency,
    lead_priority,
    description
)
SELECT
    t.id as tenant_id,
    s.name,
    s.slug,
    s.category,
    true as is_active,
    s.display_order,
    s.duration_minutes,
    s.price_min,
    s.price_max,
    'per_service' as price_unit,
    'MXN' as currency,
    s.lead_priority,
    s.description
FROM public.tenants t
CROSS JOIN (
    VALUES
    -- DIAGNÓSTICO (COLD)
    ('Consulta de Valoración', 'consulta-valoracion', 'Diagnóstico', 1, 30, 0, 500, 'cold',
     'Evaluación inicial completa del estado de salud bucal'),
    ('Radiografía Panorámica', 'radiografia-panoramica', 'Diagnóstico', 2, 15, 300, 500, 'cold',
     'Imagen completa de ambas arcadas dentales'),
    ('Radiografía Periapical', 'radiografia-periapical', 'Diagnóstico', 3, 10, 100, 200, 'cold',
     'Radiografía de una pieza dental específica'),

    -- PREVENCIÓN (COLD/WARM)
    ('Limpieza Dental Básica', 'limpieza-basica', 'Prevención', 4, 45, 400, 800, 'cold',
     'Profilaxis dental con ultrasonido y pulido'),
    ('Limpieza Profunda', 'limpieza-profunda', 'Prevención', 5, 60, 800, 1500, 'warm',
     'Raspado y alisado radicular por cuadrante'),
    ('Aplicación de Flúor', 'aplicacion-fluor', 'Prevención', 6, 15, 200, 400, 'cold',
     'Tratamiento preventivo con flúor tópico'),
    ('Selladores Dentales', 'selladores-dentales', 'Prevención', 7, 30, 300, 500, 'cold',
     'Sellado de fisuras en molares (por pieza)'),

    -- RESTAURATIVA (WARM/HOT)
    ('Resina Dental Simple', 'resina-simple', 'Restaurativa', 8, 45, 600, 1000, 'warm',
     'Restauración con resina de una superficie'),
    ('Resina Dental Compuesta', 'resina-compuesta', 'Restaurativa', 9, 60, 800, 1500, 'warm',
     'Restauración con resina de múltiples superficies'),
    ('Incrustación Dental', 'incrustacion-dental', 'Restaurativa', 10, 90, 2500, 4000, 'warm',
     'Inlay/Onlay en porcelana o resina'),
    ('Corona Dental Porcelana', 'corona-porcelana', 'Restaurativa', 11, 90, 4000, 7000, 'warm',
     'Corona de porcelana libre de metal'),
    ('Corona Dental Zirconia', 'corona-zirconia', 'Restaurativa', 12, 90, 5000, 8000, 'hot',
     'Corona de zirconia alta estética'),
    ('Puente Dental', 'puente-dental', 'Restaurativa', 13, 120, 12000, 20000, 'hot',
     'Puente fijo de 3 o más unidades'),

    -- ENDODONCIA (WARM)
    ('Endodoncia Anterior', 'endodoncia-anterior', 'Endodoncia', 14, 60, 2500, 4000, 'warm',
     'Tratamiento de conductos en diente anterior'),
    ('Endodoncia Premolar', 'endodoncia-premolar', 'Endodoncia', 15, 90, 3000, 5000, 'warm',
     'Tratamiento de conductos en premolar'),
    ('Endodoncia Molar', 'endodoncia-molar', 'Endodoncia', 16, 120, 4000, 6500, 'warm',
     'Tratamiento de conductos en molar'),
    ('Retratamiento de Conductos', 'retratamiento-conductos', 'Endodoncia', 17, 120, 5000, 8000, 'warm',
     'Reendodoncia de tratamiento previo fallido'),

    -- CIRUGÍA (WARM/HOT)
    ('Extracción Simple', 'extraccion-simple', 'Cirugía', 18, 30, 800, 1500, 'warm',
     'Extracción de pieza dental erupcionada'),
    ('Extracción de Muela del Juicio', 'extraccion-tercer-molar', 'Cirugía', 19, 60, 2500, 5000, 'hot',
     'Extracción quirúrgica de tercer molar'),
    ('Cirugía de Encías', 'cirugia-encias', 'Cirugía', 20, 90, 5000, 10000, 'hot',
     'Cirugía periodontal por sextante'),
    ('Injerto de Hueso', 'injerto-hueso', 'Cirugía', 21, 90, 8000, 15000, 'hot',
     'Regeneración ósea guiada'),

    -- IMPLANTES (HOT)
    ('Implante Dental Unitario', 'implante-unitario', 'Implantes', 22, 90, 15000, 25000, 'hot',
     'Implante de titanio + corona de porcelana'),
    ('Implante con Carga Inmediata', 'implante-carga-inmediata', 'Implantes', 23, 120, 20000, 35000, 'hot',
     'Implante con corona provisional el mismo día'),
    ('All-on-4', 'all-on-4', 'Implantes', 24, 240, 120000, 200000, 'hot',
     'Rehabilitación completa sobre 4 implantes'),
    ('All-on-6', 'all-on-6', 'Implantes', 25, 300, 150000, 250000, 'hot',
     'Rehabilitación completa sobre 6 implantes'),

    -- ORTODONCIA (HOT/WARM)
    ('Ortodoncia Brackets Metálicos', 'ortodoncia-metalica', 'Ortodoncia', 26, 60, 25000, 40000, 'hot',
     'Tratamiento completo con brackets metálicos'),
    ('Ortodoncia Brackets Estéticos', 'ortodoncia-estetica', 'Ortodoncia', 27, 60, 35000, 55000, 'hot',
     'Tratamiento con brackets de zafiro o cerámica'),
    ('Invisalign / Alineadores', 'invisalign', 'Ortodoncia', 28, 45, 45000, 80000, 'hot',
     'Tratamiento con alineadores transparentes'),
    ('Retenedores de Ortodoncia', 'retenedores', 'Ortodoncia', 29, 30, 2000, 5000, 'warm',
     'Retenedores fijos o removibles post-tratamiento'),

    -- ESTÉTICA (WARM/HOT)
    ('Blanqueamiento en Consultorio', 'blanqueamiento-consultorio', 'Estética', 30, 90, 3000, 6000, 'warm',
     'Blanqueamiento profesional con lámpara LED'),
    ('Blanqueamiento Casero', 'blanqueamiento-casero', 'Estética', 31, 30, 2000, 4000, 'warm',
     'Kit de blanqueamiento con guardas personalizadas'),
    ('Carilla de Porcelana', 'carilla-porcelana', 'Estética', 32, 90, 8000, 15000, 'hot',
     'Carilla dental de porcelana (por pieza)'),
    ('Carilla de Resina', 'carilla-resina', 'Estética', 33, 60, 3000, 6000, 'warm',
     'Carilla de resina compuesta (por pieza)'),
    ('Diseño de Sonrisa', 'diseno-sonrisa', 'Estética', 34, 180, 80000, 150000, 'hot',
     'Rehabilitación estética completa con carillas'),

    -- URGENCIAS (WARM/HOT)
    ('Urgencia Dental', 'urgencia-dental', 'Urgencias', 35, 30, 500, 1500, 'hot',
     'Atención de emergencia por dolor o trauma'),
    ('Ajuste de Emergencia', 'ajuste-emergencia', 'Urgencias', 36, 20, 300, 800, 'warm',
     'Ajuste de prótesis, aparato u ortodoncia')

) AS s(name, slug, category, display_order, duration_minutes, price_min, price_max, lead_priority, description)
WHERE t.vertical = 'dental'
ON CONFLICT (tenant_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    display_order = EXCLUDED.display_order,
    duration_minutes = EXCLUDED.duration_minutes,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    lead_priority = EXCLUDED.lead_priority,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = NOW();

-- Also clean up old generic services that may have been created
DELETE FROM public.services
WHERE slug IN (
    'limpieza-dental',
    'consulta-general',
    'blanqueamiento',
    'ortodoncia',
    'implantes',
    'endodoncia',
    'extraccion'
)
AND NOT EXISTS (
    -- Only delete if there's no overlap with real services
    SELECT 1 FROM public.services s2
    WHERE s2.tenant_id = services.tenant_id
    AND s2.slug IN ('consulta-valoracion', 'limpieza-basica', 'blanqueamiento-consultorio')
);

-- =====================================================
-- FIN DE LA MIGRACION
-- =====================================================
