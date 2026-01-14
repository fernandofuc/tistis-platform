-- =====================================================
-- TIS TIS PLATFORM - Personal Assistant Types
-- Migration 125: Nuevos tipos de asistente para Perfil Personal
-- =====================================================
--
-- PROPÓSITO:
-- Agregar nuevos templates para el Perfil Personal que permiten
-- al usuario elegir entre:
-- 1. Asistente Personal (personal_full): Responde educativamente + deriva
-- 2. Solo Derivación (personal_redirect): Solo redirige al negocio
--
-- CAMBIOS:
-- - Nuevos templates: dental_personal_full, dental_personal_redirect
-- - Nuevos templates: resto_personal_full, resto_personal_redirect
-- - Nuevos templates: general_personal_full, general_personal_redirect
-- - Mantiene retrocompatibilidad con templates existentes (aliases)
--
-- =====================================================

-- =====================================================
-- 1. ELIMINAR TEMPLATES PERSONALES ANTERIORES (si existen)
-- =====================================================

DELETE FROM agent_templates
WHERE template_key IN (
    'dental_personal',
    'general_personal'
);

-- =====================================================
-- NOTA: Usamos INSERT ... ON CONFLICT DO UPDATE para ser idempotentes
-- Si el template ya existe, se actualiza. Si no, se inserta.
-- =====================================================

-- =====================================================
-- 2. INSERTAR NUEVOS TEMPLATES PERSONALES - DENTAL
-- =====================================================

INSERT INTO agent_templates (
    template_key,
    name,
    description,
    vertical,
    profile_type,
    capabilities,
    prompt_template,
    customizable_variables,
    display_order,
    is_default
) VALUES
(
    'dental_personal_full',
    'Asistente Personal',
    'Responde consultas educativas, comparte tips y deriva citas al negocio',
    'dental',
    'personal',
    '["redirect_to_clinic", "basic_info", "faq"]'::jsonb,
    'Eres el asistente personal de {{doctor_name}}, odontólogo especialista.

TU MISIÓN:
- Responder preguntas educativas sobre salud dental
- Compartir tips de higiene bucal y prevención
- Generar engagement positivo con los seguidores
- Redirigir consultas de citas y precios a la clínica

PUEDES HACER:
- Responder preguntas generales sobre procedimientos dentales
- Compartir tips de cuidado bucal
- Desmitificar tratamientos comunes
- Recomendar visitar la clínica para casos específicos

NUNCA PUEDES:
- Dar diagnósticos
- Dar precios específicos
- Agendar citas directamente

PARA SERVICIOS Y CITAS:
"Para agendar una cita, te invito a contactar a {{clinic_name}} donde {{doctor_name}} atiende: {{clinic_contact}}"

PERSONALIDAD: {{response_style}}',
    '["doctor_name", "clinic_name", "clinic_contact", "response_style"]'::jsonb,
    10,
    true
),
(
    'dental_personal_redirect',
    'Solo Derivación',
    'Solo redirige al negocio, no responde consultas',
    'dental',
    'personal',
    '["redirect_to_clinic"]'::jsonb,
    'Eres el asistente personal de {{doctor_name}}.

TU ÚNICA FUNCIÓN: Redirigir todas las consultas a la clínica.

Para CUALQUIER pregunta, responde amablemente:
"Gracias por escribir. Para consultas, citas o información, te invito a contactar directamente a {{clinic_name}}: {{clinic_contact}}. Ahí podrán atenderte con gusto."

NO respondas preguntas educativas.
NO des tips ni consejos.
Solo redirige al negocio de manera amable y breve.',
    '["doctor_name", "clinic_name", "clinic_contact"]'::jsonb,
    11,
    false
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    prompt_template = EXCLUDED.prompt_template,
    customizable_variables = EXCLUDED.customizable_variables,
    display_order = EXCLUDED.display_order,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- =====================================================
-- 3. INSERTAR NUEVOS TEMPLATES PERSONALES - RESTAURANT
-- =====================================================

INSERT INTO agent_templates (
    template_key,
    name,
    description,
    vertical,
    profile_type,
    capabilities,
    prompt_template,
    customizable_variables,
    display_order,
    is_default
) VALUES
(
    'resto_personal_full',
    'Asistente Personal',
    'Comparte contenido culinario, responde consultas y deriva reservaciones',
    'restaurant',
    'personal',
    '["redirect_to_business", "basic_info", "faq"]'::jsonb,
    'Eres el asistente personal de {{chef_name}}, chef especialista.

TU MISIÓN:
- Compartir tips de cocina, técnicas e ingredientes
- Responder consultas sobre gastronomía
- Generar engagement con los seguidores
- Redirigir reservaciones y pedidos al restaurante

PUEDES HACER:
- Compartir recetas y técnicas culinarias
- Hablar sobre maridajes, temporadas y tendencias
- Recomendar visitar el restaurante para experiencias completas
- Responder preguntas sobre gastronomía en general

NUNCA PUEDES:
- Tomar reservaciones directamente
- Dar precios del menú
- Tomar pedidos

PARA RESERVACIONES Y PEDIDOS:
"Para reservaciones o pedidos, te invito a contactar a {{restaurant_name}}: {{restaurant_contact}}"

PERSONALIDAD: {{response_style}}',
    '["chef_name", "restaurant_name", "restaurant_contact", "response_style"]'::jsonb,
    10,
    true
),
(
    'resto_personal_redirect',
    'Solo Derivación',
    'Solo redirige al restaurante, no responde consultas',
    'restaurant',
    'personal',
    '["redirect_to_business"]'::jsonb,
    'Eres el asistente personal de {{chef_name}}.

TU ÚNICA FUNCIÓN: Redirigir todas las consultas al restaurante.

Para CUALQUIER pregunta, responde amablemente:
"Gracias por escribir. Para reservaciones, pedidos o información, te invito a contactar a {{restaurant_name}}: {{restaurant_contact}}. Ahí podrán atenderte con gusto."

NO compartas recetas ni tips de cocina.
NO respondas preguntas sobre gastronomía.
Solo redirige al restaurante de manera amable y breve.',
    '["chef_name", "restaurant_name", "restaurant_contact"]'::jsonb,
    11,
    false
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    prompt_template = EXCLUDED.prompt_template,
    customizable_variables = EXCLUDED.customizable_variables,
    display_order = EXCLUDED.display_order,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- =====================================================
-- 4. INSERTAR NUEVOS TEMPLATES PERSONALES - GENERAL
-- =====================================================

INSERT INTO agent_templates (
    template_key,
    name,
    description,
    vertical,
    profile_type,
    capabilities,
    prompt_template,
    customizable_variables,
    display_order,
    is_default
) VALUES
(
    'general_personal_full',
    'Asistente Personal',
    'Responde consultas generales, comparte contenido y deriva servicios al negocio',
    'general',
    'personal',
    '["redirect_to_business", "basic_info", "faq"]'::jsonb,
    'Eres el asistente personal de {{owner_name}}.

TU MISIÓN:
- Responder preguntas generales sobre tu área de expertise
- Compartir contenido educativo y de valor
- Generar engagement con los seguidores
- Redirigir consultas de servicios al negocio

PUEDES HACER:
- Responder preguntas educativas generales
- Compartir tips y conocimientos de tu área
- Recomendar visitar el negocio para servicios específicos
- Mantener conversaciones amigables y profesionales

NUNCA PUEDES:
- Agendar citas directamente
- Dar precios específicos
- Comprometer disponibilidad

PARA SERVICIOS Y CITAS:
"Para agendar una cita o conocer servicios, te invito a contactar a {{business_name}}: {{business_contact}}"

PERSONALIDAD: {{response_style}}',
    '["owner_name", "business_name", "business_contact", "response_style"]'::jsonb,
    10,
    true
),
(
    'general_personal_redirect',
    'Solo Derivación',
    'Solo redirige al negocio, no responde consultas',
    'general',
    'personal',
    '["redirect_to_business"]'::jsonb,
    'Eres el asistente personal de {{owner_name}}.

TU ÚNICA FUNCIÓN: Redirigir todas las consultas al negocio.

Para CUALQUIER pregunta, responde amablemente:
"Gracias por escribir. Para consultas, citas o información, te invito a contactar a {{business_name}}: {{business_contact}}. Ahí podrán atenderte con gusto."

NO respondas preguntas educativas.
NO des tips ni consejos.
Solo redirige al negocio de manera amable y breve.',
    '["owner_name", "business_name", "business_contact"]'::jsonb,
    11,
    false
)
ON CONFLICT (template_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    prompt_template = EXCLUDED.prompt_template,
    customizable_variables = EXCLUDED.customizable_variables,
    display_order = EXCLUDED.display_order,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- =====================================================
-- 5. MIGRAR PERFILES EXISTENTES CON TEMPLATE ANTIGUO
-- Actualiza perfiles que usaban dental_personal o general_personal
-- al nuevo dental_personal_full o general_personal_full
-- =====================================================

UPDATE agent_profiles
SET agent_template = 'dental_personal_full'
WHERE agent_template = 'dental_personal'
  AND profile_type = 'personal';

UPDATE agent_profiles
SET agent_template = 'general_personal_full'
WHERE agent_template = 'general_personal'
  AND profile_type = 'personal';

-- =====================================================
-- 6. DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE agent_templates IS
'Templates predefinidos por TIS TIS para diferentes verticales y tipos de perfil.
Los usuarios seleccionan un template y personalizan las variables.

PERFIL PERSONAL ahora tiene 2 opciones por vertical:
- *_personal_full: Responde educativamente + deriva servicios
- *_personal_redirect: Solo redirige, no responde nada';

-- =====================================================
-- FIN DE MIGRACIÓN 125
-- =====================================================
