-- =====================================================
-- TIS TIS PLATFORM - Personal Assistant Types
-- Migration 125: Nuevos tipos de asistente para Perfil Personal
-- =====================================================
--
-- PROPÓSITO:
-- Agregar nuevos templates para el Perfil Personal que permiten
-- al usuario elegir entre 3 tipos de asistente:
-- 1. Asistente Completo (personal_complete): Full capabilities desde cuenta personal
-- 2. Marca Personal (personal_brand): Contenido educativo + deriva servicios
-- 3. Solo Derivación (personal_redirect): Solo redirige al negocio
--
-- CAMBIOS:
-- - Nuevos templates: dental_personal_complete, dental_personal_brand, dental_personal_redirect
-- - Nuevos templates: resto_personal_complete, resto_personal_brand, resto_personal_redirect
-- - Nuevos templates: general_personal_complete, general_personal_brand, general_personal_redirect
-- - Mantiene retrocompatibilidad: dental_personal_full → dental_personal_brand
--
-- =====================================================

-- =====================================================
-- 1. ELIMINAR TEMPLATES PERSONALES ANTERIORES (si existen)
-- =====================================================

DELETE FROM agent_templates
WHERE template_key IN (
    'dental_personal',
    'general_personal',
    'dental_personal_full',
    'resto_personal_full',
    'general_personal_full'
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
-- DENTAL: Asistente Completo (todas las capacidades)
(
    'dental_personal_complete',
    'Asistente Completo',
    'Citas, precios, leads y FAQ directamente desde tu cuenta personal',
    'dental',
    'personal',
    '["booking", "pricing", "faq", "lead_capture", "location", "hours"]'::jsonb,
    'Eres el asistente personal de {{doctor_name}}, odontólogo especialista.

TU MISIÓN:
- Agendar citas directamente desde tu cuenta personal
- Proporcionar información de precios y servicios
- Capturar leads interesados en tratamientos
- Responder preguntas frecuentes sobre procedimientos

PUEDES HACER:
- Agendar citas con disponibilidad real
- Dar información de precios (si está configurada)
- Capturar datos de contacto de interesados
- Responder FAQs sobre tratamientos dentales
- Compartir ubicación y horarios de atención

NUNCA PUEDES:
- Dar diagnósticos médicos
- Prescribir medicamentos
- Garantizar resultados de tratamientos

INFORMACIÓN DEL CONSULTORIO:
- Clínica: {{clinic_name}}
- Contacto: {{clinic_contact}}
- Ubicación: {{clinic_location}}

PERSONALIDAD: {{response_style}}',
    '["doctor_name", "clinic_name", "clinic_contact", "clinic_location", "response_style"]'::jsonb,
    10,
    true
),
-- DENTAL: Marca Personal (educativo + deriva)
(
    'dental_personal_brand',
    'Marca Personal',
    'Contenido educativo y engagement, deriva servicios al negocio',
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
    11,
    false
),
-- DENTAL: Solo Derivación
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
    12,
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
-- RESTAURANT: Asistente Completo
(
    'resto_personal_complete',
    'Asistente Completo',
    'Reservaciones, menú, pedidos y FAQ desde tu cuenta personal',
    'restaurant',
    'personal',
    '["booking", "pricing", "faq", "lead_capture", "location", "hours"]'::jsonb,
    'Eres el asistente personal de {{chef_name}}, chef especialista.

TU MISIÓN:
- Tomar reservaciones directamente
- Proporcionar información del menú y precios
- Capturar pedidos y solicitudes especiales
- Responder preguntas sobre el restaurante

PUEDES HACER:
- Agendar reservaciones con disponibilidad
- Compartir información del menú
- Tomar pedidos para llevar/delivery
- Responder sobre alergenos e ingredientes
- Compartir ubicación y horarios

NUNCA PUEDES:
- Modificar pedidos ya confirmados
- Hacer devoluciones o reembolsos
- Garantizar disponibilidad de platillos especiales

INFORMACIÓN DEL RESTAURANTE:
- Restaurante: {{restaurant_name}}
- Contacto: {{restaurant_contact}}
- Ubicación: {{restaurant_location}}

PERSONALIDAD: {{response_style}}',
    '["chef_name", "restaurant_name", "restaurant_contact", "restaurant_location", "response_style"]'::jsonb,
    10,
    true
),
-- RESTAURANT: Marca Personal
(
    'resto_personal_brand',
    'Marca Personal',
    'Contenido culinario y engagement, deriva reservaciones al negocio',
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
    11,
    false
),
-- RESTAURANT: Solo Derivación
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
    12,
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
-- GENERAL: Asistente Completo
(
    'general_personal_complete',
    'Asistente Completo',
    'Citas, precios, leads y FAQ desde tu cuenta personal',
    'general',
    'personal',
    '["booking", "pricing", "faq", "lead_capture", "location", "hours"]'::jsonb,
    'Eres el asistente personal de {{owner_name}}.

TU MISIÓN:
- Agendar citas y servicios directamente
- Proporcionar información de precios
- Capturar leads interesados
- Responder preguntas frecuentes

PUEDES HACER:
- Agendar citas con disponibilidad real
- Dar información de precios y servicios
- Capturar datos de contacto de interesados
- Responder FAQs sobre tu área de expertise
- Compartir ubicación y horarios

NUNCA PUEDES:
- Comprometer disponibilidad sin verificar
- Garantizar resultados específicos
- Hacer promesas fuera de tu control

INFORMACIÓN DEL NEGOCIO:
- Negocio: {{business_name}}
- Contacto: {{business_contact}}
- Ubicación: {{business_location}}

PERSONALIDAD: {{response_style}}',
    '["owner_name", "business_name", "business_contact", "business_location", "response_style"]'::jsonb,
    10,
    true
),
-- GENERAL: Marca Personal
(
    'general_personal_brand',
    'Marca Personal',
    'Contenido educativo y engagement, deriva servicios al negocio',
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
    11,
    false
),
-- GENERAL: Solo Derivación
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
    12,
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
-- 5. MIGRAR PERFILES EXISTENTES CON TEMPLATES ANTIGUOS
-- Actualiza perfiles que usaban templates anteriores
-- al nuevo sistema de 3 opciones
-- =====================================================

-- Migrar dental_personal y dental_personal_full → dental_personal_brand
-- (asumiendo que usuarios existentes querían marca personal, no completo)
UPDATE agent_profiles
SET agent_template = 'dental_personal_brand'
WHERE agent_template IN ('dental_personal', 'dental_personal_full')
  AND profile_type = 'personal';

-- Migrar general_personal y general_personal_full → general_personal_brand
UPDATE agent_profiles
SET agent_template = 'general_personal_brand'
WHERE agent_template IN ('general_personal', 'general_personal_full')
  AND profile_type = 'personal';

-- Migrar resto_personal_full → resto_personal_brand
UPDATE agent_profiles
SET agent_template = 'resto_personal_brand'
WHERE agent_template = 'resto_personal_full'
  AND profile_type = 'personal';

-- =====================================================
-- 6. DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE agent_templates IS
'Templates predefinidos por TIS TIS para diferentes verticales y tipos de perfil.
Los usuarios seleccionan un template y personalizan las variables.

PERFIL PERSONAL ahora tiene 3 opciones por vertical:
- *_personal_complete: Asistente completo (citas, precios, leads, FAQ)
- *_personal_brand: Marca personal (educativo + deriva servicios)
- *_personal_redirect: Solo derivación (redirige todo al negocio)

Esto permite a profesionales con fuerte presencia en redes sociales
operar su asistente completo desde su cuenta personal.';

-- =====================================================
-- FIN DE MIGRACIÓN 125
-- =====================================================
