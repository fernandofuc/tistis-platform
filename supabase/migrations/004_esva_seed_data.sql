-- =====================================================
-- ESVA DENTAL CLINIC - SEED DATA v2.0
-- Migration: 004_esva_seed_data.sql
-- Ejecutar DESPUÉS del schema v2 (003_esva_schema_v2.sql)
-- =====================================================

-- =====================================================
-- TENANT: ESVA (Cliente de TIS TIS)
-- =====================================================
INSERT INTO tenants (
    id,
    name,
    slug,
    legal_name,
    vertical,
    plan,
    plan_started_at,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone,
    status,
    settings,
    features_enabled
) VALUES (
    'a0000000-0000-0000-0000-000000000001', -- ID fijo para referencias
    'ESVA Dental Clinic',
    'esva',
    'ESVA Estética Dental S.A. de C.V.',
    'dental',
    'growth', -- Plan recomendado TIS TIS
    NOW(),
    'Dr. Alberto Estrella',
    'contacto@esva.dental',
    '+526621234567',
    'active',
    '{
        "branding": {
            "primary_color": "#0066CC",
            "secondary_color": "#00AAFF",
            "logo_url": null
        },
        "ai": {
            "personality": "professional_warm",
            "response_style": "conversational",
            "max_message_length": 500
        },
        "notifications": {
            "escalation_timeout_minutes": 15,
            "daily_report_time": "08:00"
        }
    }',
    '["whatsapp_ai", "lead_scoring", "appointment_booking", "reminders", "daily_reports", "analytics"]'
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    settings = EXCLUDED.settings,
    features_enabled = EXCLUDED.features_enabled,
    updated_at = NOW();

-- Variable para tenant_id
DO $$
DECLARE
    v_tenant_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_nogales_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_tijuana_id UUID := 'b0000000-0000-0000-0000-000000000002';
    v_hermosillo_id UUID := 'b0000000-0000-0000-0000-000000000003';
    v_lab_id UUID := 'b0000000-0000-0000-0000-000000000004';
BEGIN

-- =====================================================
-- SUCURSALES ESVA
-- =====================================================
INSERT INTO branches (id, tenant_id, name, slug, branch_code, city, state, country, address, phone, whatsapp_number, email, timezone, operating_hours, google_maps_url, is_headquarters, appointment_duration_default, advance_booking_days) VALUES
(
    v_nogales_id,
    v_tenant_id,
    'ESVA Nogales',
    'nogales',
    'NOG-001',
    'Nogales',
    'Sonora',
    'MX',
    'Boulevard Luis Donaldo Colosio #123, Col. Centro',
    '+526316001234',
    '+526316001234',
    'nogales@esva.dental',
    'America/Hermosillo',
    '{
        "monday": {"open": "09:30", "close": "18:00", "enabled": true},
        "tuesday": {"open": "09:30", "close": "18:00", "enabled": true},
        "wednesday": {"open": "09:30", "close": "18:00", "enabled": true},
        "thursday": {"open": "09:30", "close": "18:00", "enabled": true},
        "friday": {"open": "09:30", "close": "18:00", "enabled": true},
        "saturday": {"open": "10:00", "close": "14:00", "enabled": true},
        "sunday": {"open": null, "close": null, "enabled": false}
    }',
    'https://maps.google.com/?q=ESVA+Nogales',
    true, -- Headquarters
    60,
    30
),
(
    v_tijuana_id,
    v_tenant_id,
    'ESVA Tijuana',
    'tijuana',
    'TIJ-001',
    'Tijuana',
    'Baja California',
    'MX',
    'Zona Río, Av. Paseo de los Héroes #456',
    '+526641234567',
    '+526641234567',
    'tijuana@esva.dental',
    'America/Tijuana',
    '{
        "monday": {"open": "09:30", "close": "18:00", "enabled": true},
        "tuesday": {"open": "09:30", "close": "18:00", "enabled": true},
        "wednesday": {"open": "09:30", "close": "18:00", "enabled": true},
        "thursday": {"open": "09:30", "close": "18:00", "enabled": true},
        "friday": {"open": "09:30", "close": "18:00", "enabled": true},
        "saturday": {"open": "10:00", "close": "14:00", "enabled": true},
        "sunday": {"open": null, "close": null, "enabled": false}
    }',
    'https://maps.google.com/?q=ESVA+Tijuana',
    false,
    60,
    30
),
(
    v_hermosillo_id,
    v_tenant_id,
    'ESVA Hermosillo',
    'hermosillo',
    'HMO-001',
    'Hermosillo',
    'Sonora',
    'MX',
    'Boulevard Solidaridad #789, Col. Las Quintas',
    '+526621987654',
    '+526621987654',
    'hermosillo@esva.dental',
    'America/Hermosillo',
    '{
        "monday": {"open": "09:30", "close": "18:00", "enabled": true},
        "tuesday": {"open": "09:30", "close": "18:00", "enabled": true},
        "wednesday": {"open": "09:30", "close": "18:00", "enabled": true},
        "thursday": {"open": "09:30", "close": "18:00", "enabled": true},
        "friday": {"open": "09:30", "close": "18:00", "enabled": true},
        "saturday": {"open": "10:00", "close": "14:00", "enabled": true},
        "sunday": {"open": null, "close": null, "enabled": false}
    }',
    'https://maps.google.com/?q=ESVA+Hermosillo',
    false,
    60,
    30
),
(
    v_lab_id,
    v_tenant_id,
    'ESVA Lab',
    'lab',
    'LAB-001',
    'Nogales',
    'Sonora',
    'MX',
    'Parque Industrial Nogales',
    '+526316009999',
    NULL, -- El lab no recibe WhatsApp directo
    'lab@esva.dental',
    'America/Hermosillo',
    NULL, -- No aplica horario de citas
    NULL,
    false,
    NULL,
    NULL
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    operating_hours = EXCLUDED.operating_hours,
    updated_at = NOW();

-- Desactivar el lab para citas
UPDATE branches SET is_active = false WHERE id = v_lab_id;

-- =====================================================
-- STAFF ESVA
-- =====================================================
INSERT INTO staff (id, tenant_id, first_name, last_name, display_name, email, phone, whatsapp_number, role, role_title, notification_preferences) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    v_tenant_id,
    'Alberto',
    'Estrella',
    'Dr. Alberto Estrella',
    'dr.estrella@esva.dental',
    '+526621111111',
    '+526621111111',
    'owner',
    'Director Médico / Especialista en Estética Dental',
    '{
        "channels": ["whatsapp"],
        "types": {
            "hot_leads": true,
            "new_appointments": true,
            "cancellations": true,
            "escalations": true,
            "daily_report": true,
            "weekly_report": true
        },
        "quiet_hours": {"start": "22:00", "end": "07:00", "enabled": true}
    }'
),
(
    'c0000000-0000-0000-0000-000000000002',
    v_tenant_id,
    'María',
    'González',
    'María González',
    'maria@esva.dental',
    '+526622222222',
    '+526622222222',
    'receptionist',
    'Coordinadora de Citas',
    '{
        "channels": ["whatsapp"],
        "types": {
            "hot_leads": true,
            "new_appointments": true,
            "cancellations": true,
            "escalations": true,
            "daily_report": true,
            "weekly_report": false
        },
        "quiet_hours": {"start": "20:00", "end": "08:00", "enabled": true}
    }'
),
(
    'c0000000-0000-0000-0000-000000000003',
    v_tenant_id,
    'Carlos',
    'Mendoza',
    'Dr. Carlos Mendoza',
    'dr.mendoza@esva.dental',
    '+526623333333',
    '+526623333333',
    'specialist',
    'Odontólogo / Equipo ESVA',
    '{
        "channels": ["whatsapp"],
        "types": {
            "hot_leads": false,
            "new_appointments": true,
            "cancellations": true,
            "escalations": false,
            "daily_report": false,
            "weekly_report": false
        },
        "quiet_hours": {"start": "21:00", "end": "07:00", "enabled": true}
    }'
) ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    notification_preferences = EXCLUDED.notification_preferences,
    updated_at = NOW();

-- Staff-Branches (quién trabaja dónde)
INSERT INTO staff_branches (staff_id, branch_id, is_primary) VALUES
('c0000000-0000-0000-0000-000000000001', v_nogales_id, true),
('c0000000-0000-0000-0000-000000000001', v_tijuana_id, false),
('c0000000-0000-0000-0000-000000000001', v_hermosillo_id, false),
('c0000000-0000-0000-0000-000000000002', v_nogales_id, true),
('c0000000-0000-0000-0000-000000000003', v_nogales_id, true),
('c0000000-0000-0000-0000-000000000003', v_hermosillo_id, false)
ON CONFLICT (staff_id, branch_id) DO UPDATE SET
    is_primary = EXCLUDED.is_primary;

-- Perfiles dentales del staff
INSERT INTO staff_dental_profile (staff_id, license_number, license_state, specialty, sub_specialties, dental_school, graduation_year, bio_short, service_tier) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'DGP-12345',
    'Sonora',
    'Estética Dental y Rehabilitación Oral',
    ARRAY['Carillas', 'Diseño Digital de Sonrisa', 'Implantes'],
    'Universidad de Guadalajara',
    2005,
    'Fundador de ESVA con más de 18 años de experiencia en estética dental. Especialista en transformaciones de sonrisa con carillas de porcelana.',
    'exclusive'
),
(
    'c0000000-0000-0000-0000-000000000003',
    'DGP-67890',
    'Sonora',
    'Odontología General y Estética',
    ARRAY['Carillas', 'Blanqueamiento'],
    'Universidad Autónoma de Baja California',
    2015,
    'Odontólogo del equipo ESVA especializado en procedimientos estéticos y atención al paciente.',
    'esva_team'
) ON CONFLICT (staff_id) DO UPDATE SET
    specialty = EXCLUDED.specialty,
    sub_specialties = EXCLUDED.sub_specialties,
    bio_short = EXCLUDED.bio_short,
    updated_at = NOW();

END $$;

-- =====================================================
-- SERVICIOS ESVA
-- =====================================================
INSERT INTO services (tenant_id, name, slug, sku, description, short_description, category, subcategory, price_min, price_max, price_unit, currency, price_variants, duration_minutes, sessions_required, requires_consultation, is_featured, display_order, keywords, ai_description) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'Carillas Dentales de Porcelana',
    'carillas',
    'SRV-CAR-001',
    'Carillas de porcelana Emax de alta estética fabricadas en nuestro propio ESVA Lab. Diseño 100% personalizado para cada paciente utilizando tecnología de Diseño Digital de Sonrisa (DSD). Las carillas transforman completamente tu sonrisa corrigiendo color, forma, tamaño y alineación de tus dientes.',
    'Carillas de porcelana Emax desde $295 USD por diente. Diseño personalizado en nuestro ESVA Lab.',
    'Estética Dental',
    'Carillas',
    295.00,
    850.00,
    'per_tooth',
    'USD',
    '[
        {
            "name": "Estándar",
            "price": 295,
            "currency": "USD",
            "description": "Porcelana Emax de alta calidad con nuestro proceso estándar"
        },
        {
            "name": "Equipo ESVA",
            "price": 395,
            "currency": "USD",
            "description": "Mayor nivel de detalle y acabado premium con nuestro equipo especializado"
        },
        {
            "name": "Exclusividad Dr. Alberto Estrella",
            "price": 850,
            "currency": "USD",
            "description": "Máxima personalización con atención directa del Dr. Estrella en todo el proceso"
        }
    ]',
    90,
    2, -- Prep + Colocación
    true,
    true,
    1,
    ARRAY['carillas', 'veneers', 'porcelana', 'emax', 'sonrisa', 'estetica', 'dientes', 'smile makeover', 'dental tourism'],
    'Las carillas son láminas ultrafinas de porcelana que se adhieren a la superficie de los dientes para mejorar su apariencia. En ESVA usamos porcelana Emax, el material más avanzado, y fabricamos todo en nuestro propio laboratorio. Tenemos 3 opciones de precio según el nivel de personalización.'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'Valoración Dental Completa',
    'valoracion',
    'SRV-VAL-001',
    'Valoración integral que incluye fotografías clínicas profesionales, Diseño Digital de Sonrisa (DSD) donde puedes ver cómo quedará tu nueva sonrisa ANTES del tratamiento, diagnóstico estético completo y cotización personalizada sin compromiso.',
    'Valoración gratuita con Diseño Digital de Sonrisa. Ve tu nueva sonrisa antes de empezar.',
    'Consulta',
    'Valoración',
    0,
    0,
    'per_treatment',
    'USD',
    '[]',
    60,
    1,
    false, -- No requiere consulta previa, ES la consulta
    true,
    0,
    ARRAY['valoracion', 'consulta', 'cita', 'evaluacion', 'diagnostico', 'dsd', 'diseño digital', 'cotizacion', 'gratis'],
    'La valoración es una consulta completa donde fotografiamos tu sonrisa, hacemos un Diseño Digital para que veas el resultado esperado, y te damos una cotización personalizada. Es gratuita y sin compromiso.'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'Blanqueamiento Dental Profesional',
    'blanqueamiento',
    'SRV-BLA-001',
    'Blanqueamiento dental en consultorio con tecnología LED de última generación. Resultados visibles desde la primera sesión con aclaramiento de hasta 8 tonos.',
    'Blanqueamiento profesional con resultados inmediatos. Hasta 8 tonos más blanco.',
    'Estética Dental',
    'Blanqueamiento',
    NULL,
    NULL,
    'per_treatment',
    'USD',
    '[]',
    60,
    1,
    true,
    false,
    2,
    ARRAY['blanqueamiento', 'whitening', 'blanco', 'dientes blancos', 'manchas', 'aclarar'],
    'El blanqueamiento profesional aclara el color de tus dientes de manera segura y rápida. Los resultados son inmediatos.'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'Implantes Dentales',
    'implantes',
    'SRV-IMP-001',
    'Implantes de titanio de alta calidad con corona personalizada de porcelana. Solución permanente y natural para reemplazar dientes perdidos.',
    'Implantes de titanio con corona. Solución permanente para dientes perdidos.',
    'Implantología',
    'Implantes',
    NULL,
    NULL,
    'per_tooth',
    'USD',
    '[]',
    120,
    3, -- Consulta, Cirugía, Corona
    true,
    false,
    3,
    ARRAY['implante', 'implantes', 'titanio', 'corona', 'diente perdido', 'protesis', 'muela'],
    'Los implantes dentales son raíces artificiales de titanio que se colocan en el hueso para sostener coronas que reemplazan dientes perdidos. Es una solución permanente.'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'Limpieza Dental Profesional',
    'limpieza',
    'SRV-LIM-001',
    'Limpieza dental profesional con ultrasonido. Elimina sarro, placa y manchas superficiales. Incluye pulido y fluorización.',
    'Limpieza profesional con ultrasonido. Elimina sarro y manchas.',
    'Preventivo',
    'Limpieza',
    NULL,
    NULL,
    'per_treatment',
    'USD',
    '[]',
    45,
    1,
    false,
    false,
    4,
    ARRAY['limpieza', 'profilaxis', 'sarro', 'higiene', 'placa'],
    'La limpieza dental profesional elimina el sarro y la placa que no se puede quitar con el cepillado normal.'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'Ortodoncia',
    'ortodoncia',
    'SRV-ORT-001',
    'Tratamientos de ortodoncia con brackets metálicos, cerámicos o alineadores invisibles. Corrige la posición de tus dientes para una sonrisa perfecta.',
    'Brackets o alineadores invisibles para corregir la posición de tus dientes.',
    'Ortodoncia',
    'Ortodoncia',
    NULL,
    NULL,
    'per_treatment',
    'USD',
    '[]',
    60,
    24, -- Aproximado de visitas en 2 años
    true,
    false,
    5,
    ARRAY['ortodoncia', 'brackets', 'alineadores', 'invisalign', 'dientes chuecos', 'alinear'],
    'La ortodoncia corrige la posición de los dientes usando brackets tradicionales o alineadores invisibles. El tratamiento dura entre 12 y 24 meses.'
) ON CONFLICT (slug, tenant_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    price_variants = EXCLUDED.price_variants,
    updated_at = NOW();

-- =====================================================
-- FAQs (Knowledge Base para el AI)
-- =====================================================
INSERT INTO faqs (tenant_id, question, answer, short_answer, category, keywords, question_variations, language, display_order) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Cuánto cuestan las carillas dentales?',
    'Nuestras carillas de porcelana Emax tienen tres opciones de precio por diente:

• **Estándar: $295 USD** - Porcelana Emax de alta calidad con nuestro proceso estándar
• **Equipo ESVA: $395 USD** - Mayor detalle y acabado premium con equipo especializado
• **Exclusividad Dr. Estrella: $850 USD** - Máxima personalización con atención directa del doctor principal

El número de carillas que necesitas depende de tu sonrisa. Normalmente se hacen entre 6 y 10 carillas superiores. En tu valoración te damos un presupuesto exacto basado en tu caso específico.',
    'Desde $295 USD por diente. Tenemos 3 opciones: Estándar ($295), Equipo ESVA ($395), y Exclusividad Dr. Estrella ($850).',
    'Precios',
    ARRAY['precio', 'costo', 'cuanto', 'carillas', 'cuestan', 'valen', 'cobran'],
    ARRAY['¿Cuánto cuestan las carillas?', '¿Cuál es el precio de las carillas?', 'How much do veneers cost?', '¿Qué precio tienen las carillas?', 'precio carillas'],
    'es',
    1
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿El procedimiento de carillas duele?',
    'No, el procedimiento es prácticamente indoloro. Utilizamos anestesia local para tu comodidad durante la preparación de los dientes. La mayoría de nuestros pacientes reportan que es mucho más cómodo de lo que esperaban.

Después del procedimiento puede haber una ligera sensibilidad que desaparece en unos días. Te proporcionamos todas las indicaciones para un post-operatorio cómodo.',
    'No duele. Usamos anestesia local y la mayoría de pacientes dice que es más cómodo de lo esperado.',
    'Procedimiento',
    ARRAY['dolor', 'duele', 'doloroso', 'molestia', 'anestesia', 'miedo'],
    ARRAY['¿Duele ponerse carillas?', '¿Es doloroso el procedimiento?', 'Does it hurt?', '¿Me va a doler?', 'tengo miedo'],
    'es',
    2
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Las carillas se ven naturales?',
    '¡Absolutamente! Trabajamos exclusivamente con porcelana Emax, el material más avanzado para carillas estéticas. Cada carilla es diseñada 100% personalizada en nuestro propio ESVA Lab.

Lo que hace especial nuestro trabajo:
• Diseño Digital de Sonrisa para planificar cada detalle
• Fabricación en nuestro laboratorio propio (control total de calidad)
• Personalización del color, forma y translucidez para cada paciente

El resultado es tan natural que nadie nota que llevas carillas - solo ven una sonrisa hermosa.',
    'Sí, trabajamos con porcelana Emax y diseño 100% personalizado. Se ven completamente naturales.',
    'Procedimiento',
    ARRAY['natural', 'naturales', 'falso', 'artificial', 'se nota', 'postizo'],
    ARRAY['¿Se ven falsas?', '¿Se nota que son carillas?', '¿Quedan naturales?', 'Do they look natural?', '¿Se ven artificiales?'],
    'es',
    3
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Cuánto tiempo duran las carillas?',
    'Las carillas de porcelana Emax duran entre 10 y 15 años con los cuidados adecuados. Muchos de nuestros pacientes mantienen sus carillas en perfecto estado por más de 15 años.

Para maximizar la duración:
• Mantén buena higiene dental
• Evita morder objetos duros (hielo, plumas, uñas)
• Usa protector nocturno si rechinas los dientes
• Visítanos para revisiones periódicas

Te damos todas las instrucciones de cuidado después del tratamiento.',
    'Entre 10 y 15 años con cuidados adecuados. Muchos pacientes las mantienen más de 15 años.',
    'Procedimiento',
    ARRAY['duracion', 'duran', 'tiempo', 'años', 'vida util', 'cuanto duran'],
    ARRAY['¿Cuánto duran?', '¿Por cuánto tiempo sirven?', 'How long do veneers last?', '¿Cuántos años duran las carillas?'],
    'es',
    4
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Qué incluye la valoración dental?',
    'Nuestra valoración es una consulta completa que incluye:

✓ **Fotografías clínicas profesionales** de tu sonrisa actual
✓ **Diseño Digital de Sonrisa (DSD)** - Ves cómo quedará tu nueva sonrisa ANTES del tratamiento
✓ **Diagnóstico estético completo** de tu caso
✓ **Plan de tratamiento personalizado** con todas las opciones
✓ **Cotización detallada** sin compromiso

Es gratuita y sin presión. Queremos que tomes una decisión informada.',
    'Fotografías, Diseño Digital de Sonrisa (ves el resultado antes), diagnóstico y cotización. Gratis y sin compromiso.',
    'Consulta',
    ARRAY['valoracion', 'incluye', 'consulta', 'cita', 'que incluye', 'gratis'],
    ARRAY['¿Qué incluye la consulta?', '¿Qué me hacen en la valoración?', 'What is included?', '¿Es gratis la valoración?'],
    'es',
    5
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Cuál es la diferencia entre los planes de carillas?',
    'Los tres planes usan el mismo material de primera calidad (porcelana Emax). La diferencia está en el nivel de personalización y atención:

**Estándar ($295/diente)**
Proceso con nuestro equipo general. Excelente calidad y resultados hermosos.

**Equipo ESVA ($395/diente)**
Mayor nivel de detalle en el acabado. Atención más personalizada y tiempo adicional de diseño.

**Exclusividad Dr. Estrella ($850/diente)**
El Dr. Alberto Estrella atiende personalmente todo el proceso. Máxima personalización para casos que buscan la perfección absoluta.

Todos los planes incluyen la misma garantía y seguimiento post-tratamiento.',
    'Misma calidad de material en todos. La diferencia es el nivel de personalización y quién realiza el proceso.',
    'Precios',
    ARRAY['diferencia', 'planes', 'opciones', 'cual', 'mejor', 'comparar'],
    ARRAY['¿Cuál plan es mejor?', '¿Qué plan me conviene?', '¿Por qué hay diferentes precios?', 'What is the difference?'],
    'es',
    6
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Atienden pacientes de Estados Unidos?',
    '¡Sí! Nuestra clínica de Nogales está ubicada a solo minutos de la frontera con Arizona. Somos especialistas en dental tourism.

Beneficios para pacientes de USA:
• **Ubicación conveniente** - A minutos de Nogales, AZ
• **Misma calidad** que encontrarías en Estados Unidos
• **Ahorro significativo** - Hasta 70% menos que precios en USA
• **Atención en inglés** disponible
• **Fácil acceso** - Cruzando la frontera

Muchos de nuestros pacientes vienen de Phoenix, Tucson y todo Arizona. Podemos ayudarte a planificar tu visita.',
    'Sí, estamos a minutos de la frontera en Nogales. Ideales para dental tourism desde Arizona. Atención en inglés disponible.',
    'General',
    ARRAY['usa', 'estados unidos', 'arizona', 'frontera', 'americano', 'turismo dental', 'english'],
    ARRAY['Do you accept US patients?', '¿Aceptan pacientes americanos?', '¿Están cerca de la frontera?', 'Dental tourism', 'Do you speak English?'],
    'es',
    7
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Las carillas se manchan?',
    'No, la porcelana Emax que utilizamos no absorbe pigmentos. A diferencia de los dientes naturales, la porcelana mantiene su color y brillo durante toda su vida útil.

Puedes disfrutar café, vino, té y otros alimentos sin preocuparte por manchas. Tus carillas mantendrán el mismo color blanco y brillante que tenían el primer día.

Solo necesitas mantener una buena higiene dental normal.',
    'No se manchan. La porcelana no absorbe pigmentos como los dientes naturales. Mantienen su color siempre.',
    'Procedimiento',
    ARRAY['manchan', 'manchas', 'color', 'cafe', 'vino', 'amarillo', 'decoloran'],
    ARRAY['¿Se manchan con el café?', '¿Cambian de color?', '¿Se ponen amarillas?', 'Do veneers stain?'],
    'es',
    8
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Puedo ver cómo quedará mi sonrisa antes de empezar?',
    '¡Claro que sí! Esta es una de las ventajas más importantes de ESVA.

Con nuestro **Diseño Digital de Sonrisa (DSD)** puedes ver una simulación realista de cómo quedará tu nueva sonrisa ANTES de comenzar cualquier procedimiento.

El proceso:
1. Tomamos fotografías profesionales de tu sonrisa
2. Diseñamos digitalmente tu nueva sonrisa
3. Te mostramos el resultado esperado
4. Hacemos ajustes según tus preferencias
5. Solo cuando estés 100% satisfecho, procedemos

Es parte de la valoración gratuita. No hay sorpresas.',
    'Sí, con nuestro Diseño Digital de Sonrisa ves exactamente cómo quedarás ANTES de empezar.',
    'Procedimiento',
    ARRAY['ver', 'antes', 'simulacion', 'preview', 'dsd', 'diseño digital', 'resultado'],
    ARRAY['¿Cómo sé cómo voy a quedar?', '¿Hay preview?', '¿Puedo ver el resultado antes?', 'Can I see the result before?'],
    'es',
    9
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Tienen opciones de pago o financiamiento?',
    'Sí, ofrecemos diferentes opciones de pago para tu conveniencia:

• **Efectivo** - Pago en pesos o dólares
• **Tarjetas de crédito/débito** - Visa, Mastercard, American Express
• **Transferencia bancaria**
• **Planes de pago** - Podemos dividir el costo en pagos

En tu valoración te explicamos todas las opciones disponibles y encontramos la que mejor funcione para ti. Queremos que el costo no sea un obstáculo para tu nueva sonrisa.',
    'Sí, aceptamos efectivo, tarjeta, transferencia y podemos hacer planes de pago. Te explicamos opciones en la valoración.',
    'Precios',
    ARRAY['financiamiento', 'pago', 'meses', 'tarjeta', 'credito', 'efectivo', 'pagar'],
    ARRAY['¿Aceptan tarjeta?', '¿Tienen meses sin intereses?', '¿Puedo pagar en partes?', 'Payment options?', '¿Cómo puedo pagar?'],
    'es',
    10
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Cuáles son los horarios de atención?',
    'Nuestros horarios de atención son:

📅 **Lunes a Viernes:** 9:30 AM a 6:00 PM
📅 **Sábados:** 10:00 AM a 2:00 PM
📅 **Domingos:** Cerrado

Estos horarios aplican para todas nuestras sucursales:
• Nogales, Sonora
• Tijuana, Baja California
• Hermosillo, Sonora

¿Te gustaría agendar una cita?',
    'Lunes a Viernes 9:30am-6pm, Sábados 10am-2pm. Domingos cerrado.',
    'General',
    ARRAY['horario', 'horarios', 'atencion', 'abierto', 'cerrado', 'hora', 'cuando'],
    ARRAY['¿A qué hora abren?', '¿Cuándo atienden?', '¿Están abiertos los sábados?', 'What are your hours?', '¿Trabajan domingos?'],
    'es',
    11
),
(
    'a0000000-0000-0000-0000-000000000001',
    '¿Dónde están ubicados?',
    'Tenemos 3 clínicas para tu conveniencia:

📍 **Nogales, Sonora** (Clínica Principal)
Boulevard Luis Donaldo Colosio #123, Col. Centro
A minutos de la frontera con Arizona - Ideal para pacientes de USA

📍 **Tijuana, Baja California**
Zona Río, Av. Paseo de los Héroes #456
Accesible desde San Diego

📍 **Hermosillo, Sonora**
Boulevard Solidaridad #789, Col. Las Quintas

Además contamos con nuestro propio laboratorio (ESVA Lab) en Nogales donde fabricamos todas las carillas.

¿Cuál sucursal te queda más cerca?',
    'Nogales (Sonora), Tijuana (BC) y Hermosillo (Sonora). Nogales está a minutos de la frontera con Arizona.',
    'General',
    ARRAY['ubicacion', 'direccion', 'donde', 'sucursal', 'clinica', 'llegar'],
    ARRAY['¿Dónde están?', '¿Cuál es la dirección?', '¿Tienen sucursales?', 'Where are you located?', '¿Cómo llego?'],
    'es',
    12
) ON CONFLICT (question, tenant_id) DO UPDATE SET
    answer = EXCLUDED.answer,
    short_answer = EXCLUDED.short_answer,
    keywords = EXCLUDED.keywords,
    updated_at = NOW();

-- =====================================================
-- CONFIGURACIÓN DEL AI AGENT
-- =====================================================
INSERT INTO ai_config (tenant_id, config_key, config_value, description) VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'system_prompt_version',
    '"2.0.0"',
    'Versión actual del system prompt'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'ai_model',
    '{
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "temperature": 0.7,
        "max_tokens": 1024,
        "fallback_model": "claude-haiku-4-5-20251001"
    }',
    'Configuración del modelo de IA'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'lead_scoring_weights',
    '{
        "positive": {
            "urgency_pain": 35,
            "wants_appointment": 30,
            "date_defined": 25,
            "usa_patient": 25,
            "high_value_treatment": 20,
            "budget_confirmed": 15,
            "referral": 15,
            "complete_info": 10,
            "high_engagement": 10,
            "returning_patient": 20
        },
        "negative": {
            "just_browsing": -15,
            "price_shopping": -10,
            "comparing_options": -10,
            "no_response_24h": -20,
            "no_response_48h": -30,
            "cancelled_appointment": -25
        }
    }',
    'Pesos para el sistema de lead scoring'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'classification_thresholds',
    '{
        "hot": {"min": 80, "max": 100},
        "warm": {"min": 40, "max": 79},
        "cold": {"min": 0, "max": 39}
    }',
    'Umbrales de clasificación de leads'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'escalation_rules',
    '{
        "auto_escalate_on": ["pain", "emergency", "human_request", "new_hot_lead", "usa_patient_ready"],
        "max_ai_turns": 10,
        "escalation_timeout_minutes": 15,
        "notify_channels": ["whatsapp"],
        "business_hours_only": false
    }',
    'Reglas de escalamiento a humano'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'business_hours',
    '{
        "timezone": "America/Hermosillo",
        "weekdays": {"start": "09:30", "end": "18:00"},
        "saturday": {"start": "10:00", "end": "14:00"},
        "sunday": null,
        "holidays": [],
        "out_of_hours_message": "¡Gracias por tu mensaje! 🦷 Nuestro horario de atención es Lunes a Viernes de 9:30am a 6pm y Sábados de 10am a 2pm. Te responderemos en cuanto abramos. Si es una emergencia dental, por favor llama al +526316001234."
    }',
    'Horarios de negocio'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'notification_settings',
    '{
        "hot_lead_notify_immediately": true,
        "appointment_reminder_24h": true,
        "appointment_reminder_2h": true,
        "daily_report_enabled": true,
        "daily_report_time": "08:00",
        "weekly_report_enabled": true,
        "weekly_report_day": "monday"
    }',
    'Configuración de notificaciones'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'conversation_settings',
    '{
        "greeting_new_lead": true,
        "max_message_length": 500,
        "use_emojis": true,
        "emoji_frequency": "moderate",
        "signature": "- Equipo ESVA 🦷",
        "default_language": "es",
        "auto_detect_language": true
    }',
    'Configuración de conversación'
),
(
    'a0000000-0000-0000-0000-000000000001',
    'intent_patterns',
    '{
        "GREETING": ["hola", "buenos dias", "buenas tardes", "hi", "hello", "que tal"],
        "PRICE_INQUIRY": ["precio", "costo", "cuanto", "cuestan", "valen", "cobran", "how much", "price"],
        "BOOK_APPOINTMENT": ["cita", "agendar", "programar", "appointment", "cuando", "disponible", "valoracion"],
        "PAIN_URGENT": ["dolor", "duele", "urgente", "emergencia", "pain", "hurt", "emergency"],
        "HUMAN_REQUEST": ["humano", "persona", "hablar con alguien", "recepcion", "operador", "human"],
        "LOCATION": ["donde", "direccion", "ubicacion", "llegar", "where", "location", "address"],
        "HOURS": ["horario", "hora", "abren", "cierran", "cuando", "hours", "schedule"],
        "DURATION": ["duran", "tiempo", "años", "duracion", "how long", "last"],
        "PAYMENT": ["pago", "tarjeta", "financiamiento", "meses", "payment", "card"],
        "FAQ": ["pregunta", "duda", "informacion", "question"]
    }',
    'Patrones para detección de intents'
) ON CONFLICT (tenant_id, config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =====================================================
-- FIN SEED DATA v2
-- =====================================================

SELECT 'ESVA Seed Data v2 cargado correctamente!' as status;
