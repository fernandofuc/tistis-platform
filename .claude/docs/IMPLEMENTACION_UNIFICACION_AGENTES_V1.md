# DOCUMENTACIÓN MAESTRA: Unificación de Tipos de Asistente + Sistema de Delivery

**Versión:** 1.0.0
**Fecha:** 2026-01-24
**Autor:** Claude Opus 4.5
**Proyecto:** TIS TIS Platform

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Análisis del Estado Actual](#2-análisis-del-estado-actual)
3. [Arquitectura Propuesta](#3-arquitectura-propuesta)
4. [Plan de Fases](#4-plan-de-fases)
5. [FASE 1: Unificación de Tipos de Asistente](#5-fase-1-unificación-de-tipos-de-asistente)
6. [FASE 2: Sistema de Delivery](#6-fase-2-sistema-de-delivery)
7. [FASE 3: Integración KDS](#7-fase-3-integración-kds)
8. [FASE 4: Testing y Validación](#8-fase-4-testing-y-validación)
9. [Riesgos y Mitigación](#9-riesgos-y-mitigación)
10. [Apéndices](#10-apéndices)

---

## 1. RESUMEN EJECUTIVO

### 1.1 Objetivo Principal

Unificar los tipos de asistente entre **Agente de Voz** y **Agente de Mensajes** para garantizar consistencia en la experiencia del usuario y agregar soporte para **Delivery** en el vertical Restaurant.

### 1.2 Alcance

| Componente | Cambio |
|------------|--------|
| Tipos de Asistente | Unificar nomenclatura y capacidades entre Voz y Mensajes |
| Vertical Restaurant | 3 niveles: Básico, Estándar, Completo |
| Vertical Dental | 2 niveles: Estándar, Completo (eliminar Básico) |
| Sistema de Órdenes | Agregar soporte para Delivery |
| KDS | Nueva pestaña de Delivery |
| Configuración Tenant | Nueva sección de opciones de servicio |

### 1.3 Entregables

1. **Migración SQL** para nuevos campos y constraints
2. **Tipos TypeScript** unificados
3. **Templates de Agente** actualizados
4. **Componentes UI** para configuración
5. **API endpoints** para delivery
6. **Documentación** actualizada

### 1.4 Dependencias Previas

- [x] Migración 154: Eliminar estilo "casual" (COMPLETADO)
- [x] Sistema KDS funcional (EXISTENTE)
- [x] Voice Agent v3.0 operativo (EXISTENTE)
- [x] Messaging Agent LangGraph operativo (EXISTENTE)

---

## 2. ANÁLISIS DEL ESTADO ACTUAL

### 2.1 Inconsistencias Detectadas

#### 2.1.1 Tipos de Asistente - ANTES

**Agente de Mensajes (Perfil Negocio):**
| Tipo | Capacidades |
|------|-------------|
| Servicio Completo | Reservas + Pedidos para recoger |
| Asistente General | Citas + Precios + FAQ + Leads |
| Solo Reservaciones | Solo reservas |
| Solo Pedidos | Solo pedidos para recoger |

**Agente de Voz:**
| Tipo | Capacidades |
|------|-------------|
| Reservaciones | Reservas básicas |
| Reservaciones + Menú | + Consultas menú, precios |
| Completo | + Pedidos telefónicos, **Delivery** |

**Problemas Identificados:**
1. Nomenclatura diferente entre canales
2. Capacidades inconsistentes (Voz tiene Delivery, Mensajes no)
3. Mensajes tiene 4 opciones, Voz tiene 3
4. "Asistente General" no existe en Voz

#### 2.1.2 Vertical Dental - ANTES

| Nivel | Nombre | Capacidades |
|-------|--------|-------------|
| Básico | Solo Citas | Agendar citas, horarios |
| Estándar | Citas + Servicios | + Tratamientos, precios |
| Completo | Servicio Integral | + Leads, objeciones |

**Problema:** El nivel "Básico" es demasiado limitado para uso real.

### 2.2 Archivos Afectados

#### Base de Datos
```
supabase/migrations/
├── 142_VOICE_ASSISTANT_TYPES.sql
├── 144_VOICE_ASSISTANT_CONFIGS.sql
├── 148_VOICE_AGENT_V2_SEED_DATA.sql
└── [NUEVO] 155_UNIFIED_ASSISTANT_TYPES.sql
```

#### TypeScript - Voice Agent
```
lib/voice-agent/types/
├── assistant-types.ts
├── types.ts
├── capability-definitions.ts
└── assistant-type-manager.ts
```

#### TypeScript - Messaging Agent
```
src/shared/config/
├── agent-templates.ts
└── prompt-instruction-compiler.ts

src/features/ai/
├── agents/specialists/*.agent.ts
└── services/prompt-generator.service.ts
```

#### Templates
```
templates/prompts/
├── restaurant/
│   ├── rest_basic.hbs
│   ├── rest_standard.hbs
│   └── rest_complete.hbs
├── dental/
│   ├── dental_standard.hbs (RENOMBRAR)
│   └── dental_complete.hbs
└── messaging/
    └── [ACTUALIZAR según nuevos tipos]
```

#### UI Components
```
components/voice-agent/wizard/steps/
├── StepCustomize.tsx (PERSONALITY_OPTIONS)
└── [NUEVO] AssistantTypeSelector.tsx

src/features/settings/components/
├── AIConfiguration.tsx
└── [NUEVO] ServiceOptionsSection.tsx
```

---

## 3. ARQUITECTURA PROPUESTA

### 3.1 Tipos de Asistente Unificados

#### RESTAURANT (3 niveles)

| Key | Nombre UI | Capacidades | Canal |
|-----|-----------|-------------|-------|
| `rest_basic` | **Reservaciones** | Reservas, horarios, ubicación | Voz + Mensajes |
| `rest_standard` | **Reservaciones + Menú** | + Menú, precios, recomendaciones, **pedidos pickup** | Voz + Mensajes |
| `rest_complete` | **Servicio Completo** | + Delivery (si habilitado), promociones | Voz + Mensajes |

#### DENTAL (2 niveles)

| Key | Nombre UI | Capacidades | Canal |
|-----|-----------|-------------|-------|
| `dental_standard` | **Citas + Servicios** | Citas, horarios, tratamientos, precios, FAQ | Voz + Mensajes |
| `dental_complete` | **Servicio Completo** | + Leads, objeciones, seguros, urgencias | Voz + Mensajes |

### 3.2 Configuración de Tenant - Opciones de Servicio

```typescript
interface TenantServiceOptions {
  // Restaurant
  dine_in_enabled: boolean;      // Comer en restaurante
  pickup_enabled: boolean;       // Pedidos para recoger
  delivery_enabled: boolean;     // Delivery

  // Delivery settings (si delivery_enabled)
  delivery_radius_km: number;    // Radio de entrega
  delivery_fee: number;          // Costo de envío
  delivery_min_order: number;    // Mínimo de compra

  // Dental
  emergency_service: boolean;    // Servicio de urgencias
  insurance_accepted: boolean;   // Acepta seguros
}
```

### 3.3 Estructura de Orden con Delivery

```typescript
interface Order {
  // Existente
  id: string;
  tenant_id: string;
  branch_id: string;
  display_number: number;
  status: OrderStatus;

  // NUEVO: Tipo de orden expandido
  order_type: 'dine_in' | 'pickup' | 'delivery';

  // NUEVO: Datos de delivery
  delivery_address?: DeliveryAddress;
  delivery_status?: DeliveryStatus;
  delivery_driver_id?: string;
  estimated_delivery_time?: Date;
  delivery_fee?: number;
}

interface DeliveryAddress {
  street: string;
  exterior_number: string;
  interior_number?: string;
  colony: string;
  city: string;
  postal_code: string;
  reference?: string;
  contact_phone: string;
  contact_name: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

type DeliveryStatus =
  | 'pending'      // Esperando asignación
  | 'assigned'     // Repartidor asignado
  | 'picked_up'    // Recogido de cocina
  | 'in_transit'   // En camino
  | 'delivered'    // Entregado
  | 'failed';      // Fallido
```

### 3.4 Flujo de Delivery

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ORDEN DELIVERY                       │
└─────────────────────────────────────────────────────────────────┘

     CLIENTE                 AI AGENT              SISTEMA
        │                       │                     │
        │  "Quiero ordenar"     │                     │
        │──────────────────────>│                     │
        │                       │                     │
        │  "¿Para recoger o     │                     │
        │   delivery?"          │                     │
        │<──────────────────────│                     │
        │                       │                     │
        │  "Delivery"           │                     │
        │──────────────────────>│                     │
        │                       │                     │
        │                       │  Verificar          │
        │                       │  delivery_enabled   │
        │                       │────────────────────>│
        │                       │                     │
        │                       │  delivery_enabled   │
        │                       │  = true             │
        │                       │<────────────────────│
        │                       │                     │
        │  "¿Qué deseas         │                     │
        │   ordenar?"           │                     │
        │<──────────────────────│                     │
        │                       │                     │
        │  [Items del menú]     │                     │
        │──────────────────────>│                     │
        │                       │                     │
        │  "¿Dirección de       │                     │
        │   entrega?"           │                     │
        │<──────────────────────│                     │
        │                       │                     │
        │  "Calle X #123..."    │                     │
        │──────────────────────>│                     │
        │                       │                     │
        │                       │  Validar dirección  │
        │                       │  en radio           │
        │                       │────────────────────>│
        │                       │                     │
        │                       │  Calcular tiempo    │
        │                       │  estimado           │
        │                       │<────────────────────│
        │                       │                     │
        │  "Tu pedido llegará   │                     │
        │   en ~45 min.         │                     │
        │   Total: $XXX"        │                     │
        │<──────────────────────│                     │
        │                       │                     │
        │  "Confirmo"           │                     │
        │──────────────────────>│                     │
        │                       │                     │
        │                       │  Crear orden        │
        │                       │  order_type:        │
        │                       │  'delivery'         │
        │                       │────────────────────>│
        │                       │                     │
        │                       │         ┌───────────┴───────────┐
        │                       │         │       KDS             │
        │                       │         │  Badge: 🛵 DELIVERY   │
        │                       │         │  + Dirección visible  │
        │                       │         └───────────────────────┘
        │                       │                     │
        │  "Pedido confirmado   │                     │
        │   #123. Te avisamos   │                     │
        │   cuando salga."      │                     │
        │<──────────────────────│                     │
        │                       │                     │
```

---

## 4. PLAN DE FASES

### 4.1 Visión General

```
┌────────────────────────────────────────────────────────────────────────┐
│                         PLAN DE IMPLEMENTACIÓN                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FASE 1: Unificación de Tipos          ████████░░░░░░░░  40%           │
│  ├─ 1.1 Migración SQL                  ██████████████████  CRÍTICO     │
│  ├─ 1.2 Tipos TypeScript               ██████████████████  CRÍTICO     │
│  ├─ 1.3 Templates Handlebars           ████████████░░░░░░  ALTO        │
│  └─ 1.4 UI Components                  ████████░░░░░░░░░░  ALTO        │
│                                                                         │
│  FASE 2: Sistema de Delivery           ████████░░░░░░░░  40%           │
│  ├─ 2.1 Esquema de BD                  ██████████████████  CRÍTICO     │
│  ├─ 2.2 API Endpoints                  ██████████████░░░░  ALTO        │
│  ├─ 2.3 Tools para Agentes             ████████████░░░░░░  ALTO        │
│  └─ 2.4 Configuración Tenant           ████████░░░░░░░░░░  MEDIO       │
│                                                                         │
│  FASE 3: Integración KDS               ████░░░░░░░░░░░░  15%           │
│  ├─ 3.1 Badge de tipo de orden         ████████████░░░░░░  ALTO        │
│  ├─ 3.2 Pestaña Delivery               ████████████░░░░░░  ALTO        │
│  └─ 3.3 Asignación de repartidor       ████████░░░░░░░░░░  MEDIO       │
│                                                                         │
│  FASE 4: Testing y Validación          ██░░░░░░░░░░░░░░  5%            │
│  ├─ 4.1 Tests unitarios                ████████████░░░░░░  ALTO        │
│  ├─ 4.2 Tests de integración           ████████████░░░░░░  ALTO        │
│  └─ 4.3 Tests E2E                      ████████░░░░░░░░░░  MEDIO       │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Cronograma Detallado

| Fase | Micro-Fase | Prioridad | Dependencias |
|------|------------|-----------|--------------|
| **1** | **Unificación de Tipos** | | |
| 1.1 | Migración SQL | CRÍTICA | - |
| 1.2 | Tipos TypeScript | CRÍTICA | 1.1 |
| 1.3 | Templates Handlebars | ALTA | 1.2 |
| 1.4 | UI Components | ALTA | 1.2 |
| **2** | **Sistema de Delivery** | | |
| 2.1 | Esquema de BD | CRÍTICA | 1.1 |
| 2.2 | API Endpoints | ALTA | 2.1 |
| 2.3 | Tools para Agentes | ALTA | 2.2 |
| 2.4 | Configuración Tenant | MEDIA | 2.1 |
| **3** | **Integración KDS** | | |
| 3.1 | Badge de tipo | ALTA | 2.1 |
| 3.2 | Pestaña Delivery | ALTA | 2.1, 3.1 |
| 3.3 | Asignación repartidor | MEDIA | 3.2 |
| **4** | **Testing** | | |
| 4.1 | Tests unitarios | ALTA | 1-3 |
| 4.2 | Tests integración | ALTA | 4.1 |
| 4.3 | Tests E2E | MEDIA | 4.2 |

---

## 5. FASE 1: UNIFICACIÓN DE TIPOS DE ASISTENTE

### 5.1 Micro-Fase 1.1: Migración SQL

#### Archivo: `supabase/migrations/155_UNIFIED_ASSISTANT_TYPES.sql`

```sql
-- =====================================================
-- TIS TIS PLATFORM - UNIFIED ASSISTANT TYPES
-- Migración 155: Unificación de tipos de asistente
-- =====================================================
--
-- PROPÓSITO:
-- 1. Unificar tipos de asistente entre Voz y Mensajes
-- 2. Actualizar vertical Dental (eliminar básico)
-- 3. Agregar capacidad de pedidos a rest_standard
--
-- CAMBIOS:
-- - Actualizar voice_assistant_types
-- - Crear tabla messaging_assistant_types
-- - Crear tabla unified_assistant_capabilities
-- - Agregar tenant_service_options a tenants
--
-- =====================================================

-- =====================================================
-- PASO 1: TABLA DE OPCIONES DE SERVICIO POR TENANT
-- =====================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS service_options JSONB DEFAULT '{
    "dine_in_enabled": true,
    "pickup_enabled": true,
    "delivery_enabled": false,
    "delivery_radius_km": 5,
    "delivery_fee": 0,
    "delivery_min_order": 0,
    "emergency_service": false,
    "insurance_accepted": false
}'::jsonb;

COMMENT ON COLUMN tenants.service_options IS
'Opciones de servicio del negocio. Controla qué capacidades están disponibles para los agentes.
- dine_in_enabled: Comer en restaurante
- pickup_enabled: Pedidos para recoger
- delivery_enabled: Servicio de delivery
- delivery_radius_km: Radio de entrega en km
- delivery_fee: Costo de envío
- delivery_min_order: Mínimo de compra para delivery
- emergency_service: Servicio de urgencias (dental)
- insurance_accepted: Acepta seguros (dental)';

-- =====================================================
-- PASO 2: ACTUALIZAR VOICE_ASSISTANT_TYPES
-- =====================================================

-- Actualizar rest_standard para incluir pedidos pickup
UPDATE voice_assistant_types
SET
    capabilities = array_append(
        CASE
            WHEN 'create_order' = ANY(capabilities) THEN capabilities
            ELSE array_append(capabilities, 'create_order')
        END,
        'get_order_status'
    ),
    description = 'Asistente intermedio que maneja reservaciones, consultas de menú, precios, recomendaciones y pedidos para recoger.',
    updated_at = NOW()
WHERE assistant_type_key = 'rest_standard';

-- Eliminar dental_basic y migrar a dental_standard
-- Primero actualizar configuraciones existentes
UPDATE voice_assistant_configs
SET assistant_type_key = 'dental_standard'
WHERE assistant_type_key = 'dental_basic';

-- Eliminar el tipo básico de dental
DELETE FROM voice_assistant_types
WHERE assistant_type_key = 'dental_basic';

-- Actualizar dental_standard con capacidades del básico
UPDATE voice_assistant_types
SET
    name = 'Citas + Servicios',
    description = 'Asistente que maneja citas, horarios, información de tratamientos, precios y preguntas frecuentes.',
    capabilities = ARRAY[
        'check_appointment_availability',
        'create_appointment',
        'modify_appointment',
        'cancel_appointment',
        'get_services',
        'get_service_info',
        'get_service_prices',
        'get_doctors',
        'get_doctor_info',
        'get_business_hours',
        'get_business_info',
        'get_faq',
        'transfer_to_human',
        'end_call'
    ],
    updated_at = NOW()
WHERE assistant_type_key = 'dental_standard';

-- =====================================================
-- PASO 3: CREAR TABLA DE TIPOS PARA MESSAGING
-- =====================================================

CREATE TABLE IF NOT EXISTS messaging_assistant_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación
    assistant_type_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Clasificación
    vertical VARCHAR(50) NOT NULL CHECK (vertical IN ('restaurant', 'dental', 'medical', 'general')),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'standard', 'complete')),

    -- Capacidades (mismas que voice)
    capabilities TEXT[] NOT NULL DEFAULT '{}',

    -- Configuración
    recommended BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,

    -- Metadata UI
    icon VARCHAR(50),
    badge_text VARCHAR(50),

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_messaging_assistant_types_vertical
ON messaging_assistant_types(vertical);

CREATE INDEX IF NOT EXISTS idx_messaging_assistant_types_tier
ON messaging_assistant_types(tier);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_messaging_assistant_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_messaging_assistant_types_updated_at ON messaging_assistant_types;
CREATE TRIGGER trigger_messaging_assistant_types_updated_at
    BEFORE UPDATE ON messaging_assistant_types
    FOR EACH ROW
    EXECUTE FUNCTION update_messaging_assistant_types_updated_at();

-- RLS
ALTER TABLE messaging_assistant_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messaging_assistant_types_read_policy" ON messaging_assistant_types;
CREATE POLICY "messaging_assistant_types_read_policy" ON messaging_assistant_types
    FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "messaging_assistant_types_service_role_policy" ON messaging_assistant_types;
CREATE POLICY "messaging_assistant_types_service_role_policy" ON messaging_assistant_types
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- PASO 4: INSERTAR TIPOS DE MESSAGING (UNIFICADOS CON VOZ)
-- =====================================================

INSERT INTO messaging_assistant_types (
    assistant_type_key, name, description, vertical, tier,
    capabilities, recommended, display_order, icon, badge_text
) VALUES
-- RESTAURANT
(
    'rest_basic',
    'Reservaciones',
    'Asistente básico para manejo de reservaciones de mesa y consultas de horarios.',
    'restaurant',
    'basic',
    ARRAY[
        'check_reservation_availability',
        'create_reservation',
        'modify_reservation',
        'cancel_reservation',
        'get_business_hours',
        'get_business_info',
        'transfer_to_human'
    ],
    false,
    1,
    'calendar',
    NULL
),
(
    'rest_standard',
    'Reservaciones + Menú',
    'Asistente que maneja reservaciones, consultas de menú, precios, recomendaciones y pedidos para recoger.',
    'restaurant',
    'standard',
    ARRAY[
        'check_reservation_availability',
        'create_reservation',
        'modify_reservation',
        'cancel_reservation',
        'get_menu',
        'search_menu',
        'get_recommendations',
        'create_order',
        'get_order_status',
        'get_business_hours',
        'get_business_info',
        'get_promotions',
        'transfer_to_human'
    ],
    true,
    2,
    'utensils',
    'Recomendado'
),
(
    'rest_complete',
    'Servicio Completo',
    'Asistente completo con todas las funcionalidades: reservaciones, menú, pedidos para recoger, delivery (si habilitado) y promociones.',
    'restaurant',
    'complete',
    ARRAY[
        'check_reservation_availability',
        'create_reservation',
        'modify_reservation',
        'cancel_reservation',
        'get_menu',
        'search_menu',
        'get_recommendations',
        'create_order',
        'modify_order',
        'cancel_order',
        'get_order_status',
        'calculate_delivery_time',
        'get_business_hours',
        'get_business_info',
        'get_promotions',
        'capture_lead',
        'handle_objection',
        'transfer_to_human'
    ],
    false,
    3,
    'star',
    'Completo'
),
-- DENTAL
(
    'dental_standard',
    'Citas + Servicios',
    'Asistente que maneja citas, horarios, información de tratamientos, precios y preguntas frecuentes.',
    'dental',
    'standard',
    ARRAY[
        'check_appointment_availability',
        'create_appointment',
        'modify_appointment',
        'cancel_appointment',
        'get_services',
        'get_service_info',
        'get_service_prices',
        'get_doctors',
        'get_doctor_info',
        'get_business_hours',
        'get_business_info',
        'get_faq',
        'transfer_to_human'
    ],
    true,
    1,
    'calendar-check',
    'Recomendado'
),
(
    'dental_complete',
    'Servicio Completo',
    'Asistente completo con citas, servicios, manejo de seguros, urgencias, captura de leads y manejo de objeciones.',
    'dental',
    'complete',
    ARRAY[
        'check_appointment_availability',
        'create_appointment',
        'modify_appointment',
        'cancel_appointment',
        'get_services',
        'get_service_info',
        'get_service_prices',
        'get_doctors',
        'get_doctor_info',
        'get_insurance_info',
        'check_insurance_coverage',
        'handle_emergency',
        'get_business_hours',
        'get_business_info',
        'get_faq',
        'capture_lead',
        'handle_objection',
        'send_reminder',
        'transfer_to_human'
    ],
    false,
    2,
    'star',
    'Completo'
)
ON CONFLICT (assistant_type_key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    recommended = EXCLUDED.recommended,
    display_order = EXCLUDED.display_order,
    icon = EXCLUDED.icon,
    badge_text = EXCLUDED.badge_text,
    updated_at = NOW();

-- =====================================================
-- PASO 5: FUNCIÓN PARA OBTENER TIPOS UNIFICADOS
-- =====================================================

CREATE OR REPLACE FUNCTION get_unified_assistant_types(
    p_vertical VARCHAR DEFAULT NULL,
    p_channel VARCHAR DEFAULT 'both' -- 'voice', 'messaging', 'both'
)
RETURNS TABLE (
    assistant_type_key VARCHAR,
    name VARCHAR,
    description TEXT,
    vertical VARCHAR,
    tier VARCHAR,
    capabilities TEXT[],
    recommended BOOLEAN,
    display_order INT,
    icon VARCHAR,
    badge_text VARCHAR,
    available_channels TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH voice_types AS (
        SELECT
            vat.assistant_type_key,
            vat.name,
            vat.description,
            vat.vertical,
            vat.tier,
            vat.capabilities,
            vat.recommended,
            vat.display_order,
            vat.icon,
            vat.badge_text,
            'voice'::TEXT as channel
        FROM voice_assistant_types vat
        WHERE vat.is_active = true
          AND (p_vertical IS NULL OR vat.vertical = p_vertical)
          AND (p_channel IN ('voice', 'both'))
    ),
    messaging_types AS (
        SELECT
            mat.assistant_type_key,
            mat.name,
            mat.description,
            mat.vertical,
            mat.tier,
            mat.capabilities,
            mat.recommended,
            mat.display_order,
            mat.icon,
            mat.badge_text,
            'messaging'::TEXT as channel
        FROM messaging_assistant_types mat
        WHERE mat.is_active = true
          AND (p_vertical IS NULL OR mat.vertical = p_vertical)
          AND (p_channel IN ('messaging', 'both'))
    ),
    combined AS (
        SELECT * FROM voice_types
        UNION ALL
        SELECT * FROM messaging_types
    )
    SELECT
        c.assistant_type_key,
        c.name,
        c.description,
        c.vertical,
        c.tier,
        c.capabilities,
        c.recommended,
        c.display_order,
        c.icon,
        c.badge_text,
        array_agg(DISTINCT c.channel) as available_channels
    FROM combined c
    GROUP BY
        c.assistant_type_key, c.name, c.description, c.vertical, c.tier,
        c.capabilities, c.recommended, c.display_order, c.icon, c.badge_text
    ORDER BY c.vertical, c.display_order;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unified_assistant_types TO authenticated;
GRANT EXECUTE ON FUNCTION get_unified_assistant_types TO service_role;

COMMENT ON FUNCTION get_unified_assistant_types IS
'Retorna los tipos de asistente unificados entre Voz y Mensajes.
Parámetros:
- p_vertical: Filtrar por vertical (restaurant, dental, etc.)
- p_channel: Filtrar por canal (voice, messaging, both)';

-- =====================================================
-- PASO 6: COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE messaging_assistant_types IS
'Tipos de asistente para el canal de mensajería. Unificado con voice_assistant_types
para garantizar consistencia entre canales.

Tipos por vertical:
- RESTAURANT: rest_basic, rest_standard (recomendado), rest_complete
- DENTAL: dental_standard (recomendado), dental_complete

El tipo básico de dental fue eliminado porque era demasiado limitado.';

-- =====================================================
-- FIN DE MIGRACIÓN 155
-- =====================================================
```

### 5.2 Micro-Fase 1.2: Tipos TypeScript

#### Archivo: `src/shared/types/unified-assistant-types.ts`

```typescript
// =====================================================
// TIS TIS PLATFORM - Unified Assistant Types
// Tipos unificados para Voz y Mensajes
// =====================================================

// ======================
// ENUMS Y CONSTANTES
// ======================

export type AssistantVertical = 'restaurant' | 'dental' | 'medical' | 'general';

export type AssistantTier = 'basic' | 'standard' | 'complete';

export type AssistantChannel = 'voice' | 'messaging';

// ======================
// TIPOS DE ASISTENTE
// ======================

export interface UnifiedAssistantType {
  assistant_type_key: string;
  name: string;
  description: string;
  vertical: AssistantVertical;
  tier: AssistantTier;
  capabilities: string[];
  recommended: boolean;
  display_order: number;
  icon: string;
  badge_text: string | null;
  available_channels: AssistantChannel[];
}

// ======================
// CAPACIDADES
// ======================

export type RestaurantCapability =
  | 'check_reservation_availability'
  | 'create_reservation'
  | 'modify_reservation'
  | 'cancel_reservation'
  | 'get_menu'
  | 'search_menu'
  | 'get_recommendations'
  | 'create_order'
  | 'modify_order'
  | 'cancel_order'
  | 'get_order_status'
  | 'calculate_delivery_time'
  | 'get_business_hours'
  | 'get_business_info'
  | 'get_promotions'
  | 'capture_lead'
  | 'handle_objection'
  | 'transfer_to_human';

export type DentalCapability =
  | 'check_appointment_availability'
  | 'create_appointment'
  | 'modify_appointment'
  | 'cancel_appointment'
  | 'get_services'
  | 'get_service_info'
  | 'get_service_prices'
  | 'get_doctors'
  | 'get_doctor_info'
  | 'get_insurance_info'
  | 'check_insurance_coverage'
  | 'handle_emergency'
  | 'get_business_hours'
  | 'get_business_info'
  | 'get_faq'
  | 'capture_lead'
  | 'handle_objection'
  | 'send_reminder'
  | 'transfer_to_human';

// ======================
// OPCIONES DE SERVICIO DEL TENANT
// ======================

export interface TenantServiceOptions {
  // Restaurant
  dine_in_enabled: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_radius_km: number;
  delivery_fee: number;
  delivery_min_order: number;

  // Dental
  emergency_service: boolean;
  insurance_accepted: boolean;
}

export const DEFAULT_SERVICE_OPTIONS: TenantServiceOptions = {
  dine_in_enabled: true,
  pickup_enabled: true,
  delivery_enabled: false,
  delivery_radius_km: 5,
  delivery_fee: 0,
  delivery_min_order: 0,
  emergency_service: false,
  insurance_accepted: false,
};

// ======================
// MAPEO DE TIPOS POR VERTICAL
// ======================

export const ASSISTANT_TYPES_BY_VERTICAL: Record<AssistantVertical, string[]> = {
  restaurant: ['rest_basic', 'rest_standard', 'rest_complete'],
  dental: ['dental_standard', 'dental_complete'],
  medical: ['medical_standard', 'medical_complete'],
  general: ['general_basic', 'general_standard'],
};

// ======================
// METADATA DE UI
// ======================

export interface AssistantTypeUIMetadata {
  key: string;
  name: string;
  description: string;
  icon: string;
  capabilities_summary: string[];
  recommended: boolean;
  badge?: string;
}

export const RESTAURANT_TYPES_UI: AssistantTypeUIMetadata[] = [
  {
    key: 'rest_basic',
    name: 'Reservaciones',
    description: 'Asistente básico para manejo de reservaciones de mesa y consultas de horarios.',
    icon: 'calendar',
    capabilities_summary: ['Reservas', 'Horarios', 'Ubicación'],
    recommended: false,
  },
  {
    key: 'rest_standard',
    name: 'Reservaciones + Menú',
    description: 'Maneja reservaciones, consultas de menú, precios, recomendaciones y pedidos para recoger.',
    icon: 'utensils',
    capabilities_summary: ['Reservas', 'Menú', 'Precios', 'Pedidos pickup'],
    recommended: true,
    badge: 'Recomendado',
  },
  {
    key: 'rest_complete',
    name: 'Servicio Completo',
    description: 'Todas las funcionalidades: reservaciones, menú, pedidos, delivery y promociones.',
    icon: 'star',
    capabilities_summary: ['Todo lo anterior', 'Delivery', 'Promociones', 'Leads'],
    recommended: false,
    badge: 'Completo',
  },
];

export const DENTAL_TYPES_UI: AssistantTypeUIMetadata[] = [
  {
    key: 'dental_standard',
    name: 'Citas + Servicios',
    description: 'Maneja citas, horarios, información de tratamientos, precios y FAQ.',
    icon: 'calendar-check',
    capabilities_summary: ['Citas', 'Servicios', 'Precios', 'FAQ'],
    recommended: true,
    badge: 'Recomendado',
  },
  {
    key: 'dental_complete',
    name: 'Servicio Completo',
    description: 'Todo lo anterior más seguros, urgencias, captura de leads y manejo de objeciones.',
    icon: 'star',
    capabilities_summary: ['Todo lo anterior', 'Seguros', 'Urgencias', 'Leads'],
    recommended: false,
    badge: 'Completo',
  },
];

// ======================
// FUNCIONES HELPER
// ======================

export function getAssistantTypesForVertical(
  vertical: AssistantVertical
): AssistantTypeUIMetadata[] {
  switch (vertical) {
    case 'restaurant':
      return RESTAURANT_TYPES_UI;
    case 'dental':
      return DENTAL_TYPES_UI;
    default:
      return [];
  }
}

export function isCapabilityEnabled(
  capability: string,
  assistantTypeKey: string,
  serviceOptions: TenantServiceOptions
): boolean {
  // Si es delivery y no está habilitado, deshabilitar
  if (
    capability === 'calculate_delivery_time' &&
    !serviceOptions.delivery_enabled
  ) {
    return false;
  }

  // Si es pedidos y no está habilitado pickup ni delivery
  if (
    capability === 'create_order' &&
    !serviceOptions.pickup_enabled &&
    !serviceOptions.delivery_enabled
  ) {
    return false;
  }

  // Si es urgencias y no está habilitado
  if (
    capability === 'handle_emergency' &&
    !serviceOptions.emergency_service
  ) {
    return false;
  }

  // Si es seguros y no está habilitado
  if (
    (capability === 'get_insurance_info' || capability === 'check_insurance_coverage') &&
    !serviceOptions.insurance_accepted
  ) {
    return false;
  }

  return true;
}
```

### 5.3 Micro-Fase 1.3: Actualizar Templates

#### Archivo: `templates/prompts/restaurant/rest_standard.hbs` (ACTUALIZADO)

```handlebars
{{!--
  TIS TIS Platform - Restaurant Standard Template
  Capacidades: Reservaciones, Menú, Precios, Recomendaciones, Pedidos Pickup
  Versión: 2.0.0
--}}

## INFORMACIÓN DE {{businessName}}

Ubicación: {{businessAddress}}
Teléfono: {{businessPhone}}
Horario: {{operatingHours}} ({{operatingDays}})

## TU ROL

Eres {{assistantName}}, el asistente virtual de {{businessName}}. Tu trabajo es ayudar a los clientes con:

1. **Reservaciones de mesa**
2. **Información del menú y precios**
3. **Recomendaciones personalizadas**
4. **Pedidos para recoger en sucursal** {{#if pickupEnabled}}✓ HABILITADO{{else}}✗ NO DISPONIBLE{{/if}}

## PERSONALIDAD

{{> personalities/professional }}

## HERRAMIENTAS DISPONIBLES

### Reservaciones
- `check_reservation_availability`: Verificar disponibilidad
- `create_reservation`: Crear nueva reservación
- `modify_reservation`: Modificar reservación existente
- `cancel_reservation`: Cancelar reservación

### Menú
- `get_menu`: Obtener menú completo o por categoría
- `search_menu`: Buscar platillos específicos
- `get_recommendations`: Obtener recomendaciones

{{#if pickupEnabled}}
### Pedidos para Recoger
- `create_order`: Crear pedido para recoger
- `get_order_status`: Consultar estado de pedido
{{/if}}

### General
- `get_business_hours`: Consultar horarios
- `get_business_info`: Información del negocio
- `get_promotions`: Promociones activas
- `transfer_to_human`: Transferir a humano

## REGLAS IMPORTANTES

1. **Para reservaciones**, SIEMPRE confirma:
   - Fecha y hora
   - Número de personas
   - Nombre para la reservación
   - Teléfono de contacto

{{#if pickupEnabled}}
2. **Para pedidos**, confirma:
   - Platillos y cantidades
   - Modificaciones especiales
   - Hora de recogida aproximada
   - Nombre para el pedido
{{/if}}

3. **NUNCA** inventes precios o disponibilidad
4. **SIEMPRE** usa las herramientas para verificar información
5. Si no puedes ayudar, ofrece transferir a un humano

## SALUDO INICIAL

{{firstMessage}}
```

#### Archivo: `templates/prompts/dental/dental_standard.hbs` (NUEVO - fusión con básico)

```handlebars
{{!--
  TIS TIS Platform - Dental Standard Template
  Capacidades: Citas, Servicios, Precios, Doctores, FAQ
  Versión: 2.0.0
  Nota: Fusiona las capacidades de dental_basic + dental_standard anterior
--}}

## INFORMACIÓN DE {{businessName}}

Ubicación: {{businessAddress}}
Teléfono: {{businessPhone}}
Horario: {{operatingHours}} ({{operatingDays}})

## TU ROL

Eres {{assistantName}}, el asistente virtual de {{businessName}}. Tu trabajo es ayudar a los pacientes con:

1. **Agendar, modificar o cancelar citas**
2. **Información de tratamientos y servicios**
3. **Precios y opciones de pago**
4. **Información de doctores y especialistas**
5. **Preguntas frecuentes**

## PERSONALIDAD

{{> personalities/professional }}

## HERRAMIENTAS DISPONIBLES

### Citas
- `check_appointment_availability`: Verificar disponibilidad de citas
- `create_appointment`: Agendar nueva cita
- `modify_appointment`: Modificar cita existente
- `cancel_appointment`: Cancelar cita

### Servicios
- `get_services`: Listar servicios disponibles
- `get_service_info`: Información detallada de un servicio
- `get_service_prices`: Precios de servicios

### Doctores
- `get_doctors`: Listar doctores
- `get_doctor_info`: Información de un doctor específico

### General
- `get_business_hours`: Consultar horarios
- `get_business_info`: Información de la clínica
- `get_faq`: Preguntas frecuentes
- `transfer_to_human`: Transferir a recepción

## REGLAS IMPORTANTES

1. **Para citas**, SIEMPRE confirma:
   - Fecha y hora deseada
   - Tipo de servicio o motivo de consulta
   - Nombre completo del paciente
   - Teléfono de contacto
   - Si es primera vez o paciente existente

2. **Sobre precios**:
   - Proporciona rangos de precios cuando estén disponibles
   - Menciona que el precio final depende de la valoración
   - Informa sobre opciones de pago si las hay

3. **NUNCA**:
   - Des diagnósticos médicos
   - Recetes medicamentos
   - Inventes precios o disponibilidad

4. **SIEMPRE**:
   - Usa las herramientas para verificar información
   - Sé empático con pacientes nerviosos o con dolor
   - Ofrece transferir a recepción si no puedes ayudar

## SALUDO INICIAL

{{firstMessage}}
```

### 5.4 Micro-Fase 1.4: Componentes UI

#### Archivo: `components/shared/AssistantTypeSelector.tsx` (NUEVO)

```tsx
/**
 * TIS TIS Platform - Unified Assistant Type Selector
 * Selector unificado para tipos de asistente (Voz y Mensajes)
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckIcon } from 'lucide-react';
import {
  type AssistantVertical,
  type AssistantTypeUIMetadata,
  getAssistantTypesForVertical,
} from '@/src/shared/types/unified-assistant-types';

interface AssistantTypeSelectorProps {
  vertical: AssistantVertical;
  selectedType: string;
  onSelect: (typeKey: string) => void;
  channel?: 'voice' | 'messaging';
  disabled?: boolean;
}

export function AssistantTypeSelector({
  vertical,
  selectedType,
  onSelect,
  channel = 'messaging',
  disabled = false,
}: AssistantTypeSelectorProps) {
  const types = getAssistantTypesForVertical(vertical);

  if (types.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500">
        No hay tipos de asistente disponibles para esta vertical.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Tipo de Asistente
      </label>
      <p className="text-sm text-slate-500 mb-4">
        Define las capacidades y herramientas de tu asistente
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {types.map((type) => (
          <AssistantTypeCard
            key={type.key}
            type={type}
            isSelected={selectedType === type.key}
            onSelect={() => onSelect(type.key)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

interface AssistantTypeCardProps {
  type: AssistantTypeUIMetadata;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function AssistantTypeCard({
  type,
  isSelected,
  onSelect,
  disabled,
}: AssistantTypeCardProps) {
  const iconMap: Record<string, string> = {
    calendar: '📅',
    utensils: '🍽️',
    star: '⭐',
    'calendar-check': '✅',
  };

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`
        relative p-4 rounded-xl border-2 text-left transition-all
        ${isSelected
          ? 'border-tis-coral bg-tis-coral-50 ring-2 ring-tis-coral/20'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      whileTap={disabled ? undefined : { scale: 0.98 }}
    >
      {/* Badge */}
      {type.badge && (
        <span className={`
          absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full
          ${type.recommended
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-600'
          }
        `}>
          {type.badge}
        </span>
      )}

      {/* Icon */}
      <div className={`
        w-10 h-10 rounded-lg flex items-center justify-center mb-3
        ${isSelected ? 'bg-tis-coral text-white' : 'bg-slate-100'}
      `}>
        <span className="text-xl">
          {iconMap[type.icon] || '📋'}
        </span>
      </div>

      {/* Content */}
      <h3 className="font-semibold text-slate-900 mb-1">
        {type.name}
      </h3>
      <p className="text-sm text-slate-500 mb-3 line-clamp-2">
        {type.description}
      </p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1">
        {type.capabilities_summary.slice(0, 4).map((cap) => (
          <span
            key={cap}
            className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
          >
            {cap}
          </span>
        ))}
        {type.capabilities_summary.length > 4 && (
          <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
            +{type.capabilities_summary.length - 4}
          </span>
        )}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-tis-coral flex items-center justify-center"
        >
          <CheckIcon className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}

export default AssistantTypeSelector;
```

---

## 6. FASE 2: SISTEMA DE DELIVERY

### 6.1 Micro-Fase 2.1: Esquema de BD

#### Archivo: `supabase/migrations/156_DELIVERY_SYSTEM.sql`

```sql
-- =====================================================
-- TIS TIS PLATFORM - DELIVERY SYSTEM
-- Migración 156: Sistema de Delivery para Restaurantes
-- =====================================================

-- =====================================================
-- PASO 1: EXPANDIR TIPO DE ORDEN
-- =====================================================

-- Actualizar constraint de order_type en restaurant_orders
ALTER TABLE restaurant_orders
DROP CONSTRAINT IF EXISTS restaurant_orders_order_type_check;

ALTER TABLE restaurant_orders
ADD CONSTRAINT restaurant_orders_order_type_check
CHECK (order_type IN ('dine_in', 'pickup', 'delivery', 'drive_thru'));

-- =====================================================
-- PASO 2: CAMPOS DE DELIVERY EN ORDERS
-- =====================================================

-- Dirección de entrega (JSONB para flexibilidad)
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS delivery_address JSONB;

COMMENT ON COLUMN restaurant_orders.delivery_address IS
'Dirección de entrega para pedidos delivery. Estructura:
{
  "street": "Calle Principal",
  "exterior_number": "123",
  "interior_number": "4A",
  "colony": "Centro",
  "city": "Nogales",
  "postal_code": "84000",
  "reference": "Casa azul con portón negro",
  "contact_phone": "+52 631 123 4567",
  "contact_name": "Juan Pérez",
  "coordinates": { "lat": 31.3108, "lng": -110.9442 }
}';

-- Estado de delivery
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20)
CHECK (delivery_status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'));

COMMENT ON COLUMN restaurant_orders.delivery_status IS
'Estado del delivery:
- pending: Esperando asignación de repartidor
- assigned: Repartidor asignado
- picked_up: Pedido recogido de cocina
- in_transit: En camino al cliente
- delivered: Entregado exitosamente
- failed: Entrega fallida';

-- Repartidor asignado
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS delivery_driver_id UUID REFERENCES staff(id);

-- Tiempo estimado de entrega
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;

-- Tiempo real de entrega
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMPTZ;

-- Costo de envío
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;

-- Notas de entrega
ALTER TABLE restaurant_orders
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- =====================================================
-- PASO 3: TABLA DE TRACKING DE DELIVERY
-- =====================================================

CREATE TABLE IF NOT EXISTS delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,

    -- Estado
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'
    )),

    -- Ubicación del repartidor (si disponible)
    driver_location JSONB,
    -- { "lat": 31.3108, "lng": -110.9442 }

    -- Notas del evento
    notes TEXT,

    -- Auditoría
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON delivery_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_status ON delivery_tracking(status);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_created ON delivery_tracking(created_at DESC);

-- RLS
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_tracking_tenant_policy" ON delivery_tracking;
CREATE POLICY "delivery_tracking_tenant_policy" ON delivery_tracking
    FOR ALL
    USING (
        order_id IN (
            SELECT id FROM restaurant_orders
            WHERE tenant_id IN (
                SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "delivery_tracking_service_role_policy" ON delivery_tracking;
CREATE POLICY "delivery_tracking_service_role_policy" ON delivery_tracking
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- PASO 4: ÍNDICES PARA DELIVERY
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_delivery_status
ON restaurant_orders(delivery_status)
WHERE order_type = 'delivery';

CREATE INDEX IF NOT EXISTS idx_orders_delivery_driver
ON restaurant_orders(delivery_driver_id)
WHERE delivery_driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_pending
ON restaurant_orders(tenant_id, created_at DESC)
WHERE order_type = 'delivery' AND delivery_status = 'pending';

-- =====================================================
-- PASO 5: FUNCIÓN PARA CALCULAR TIEMPO DE DELIVERY
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_delivery_time(
    p_tenant_id UUID,
    p_branch_id UUID,
    p_delivery_address JSONB
)
RETURNS TABLE (
    estimated_minutes INT,
    delivery_fee DECIMAL,
    is_within_radius BOOLEAN,
    distance_km DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_coords JSONB;
    v_delivery_coords JSONB;
    v_distance DECIMAL;
    v_service_options JSONB;
    v_radius_km DECIMAL;
    v_fee DECIMAL;
    v_base_time INT := 30; -- Tiempo base de preparación
    v_time_per_km INT := 3; -- Minutos adicionales por km
BEGIN
    -- Obtener opciones de servicio del tenant
    SELECT service_options INTO v_service_options
    FROM tenants
    WHERE id = p_tenant_id;

    -- Verificar si delivery está habilitado
    IF NOT (v_service_options->>'delivery_enabled')::BOOLEAN THEN
        RETURN QUERY SELECT 0, 0::DECIMAL, false, 0::DECIMAL;
        RETURN;
    END IF;

    v_radius_km := (v_service_options->>'delivery_radius_km')::DECIMAL;
    v_fee := (v_service_options->>'delivery_fee')::DECIMAL;

    -- Obtener coordenadas de la sucursal
    SELECT
        jsonb_build_object(
            'lat', COALESCE((settings->>'latitude')::DECIMAL, 0),
            'lng', COALESCE((settings->>'longitude')::DECIMAL, 0)
        )
    INTO v_branch_coords
    FROM branches
    WHERE id = p_branch_id;

    -- Obtener coordenadas de entrega
    v_delivery_coords := p_delivery_address->'coordinates';

    -- Si no hay coordenadas, usar distancia estimada
    IF v_delivery_coords IS NULL OR
       v_delivery_coords->>'lat' IS NULL OR
       v_branch_coords->>'lat' = '0' THEN
        -- Asumir distancia promedio dentro del radio
        v_distance := v_radius_km * 0.6;
    ELSE
        -- Calcular distancia usando fórmula de Haversine simplificada
        -- Para distancias cortas en la misma ciudad
        v_distance := (
            SQRT(
                POWER((v_delivery_coords->>'lat')::DECIMAL - (v_branch_coords->>'lat')::DECIMAL, 2) +
                POWER((v_delivery_coords->>'lng')::DECIMAL - (v_branch_coords->>'lng')::DECIMAL, 2)
            ) * 111 -- Aproximación: 1 grado ≈ 111 km
        );
    END IF;

    RETURN QUERY SELECT
        (v_base_time + (v_distance * v_time_per_km)::INT)::INT as estimated_minutes,
        v_fee as delivery_fee,
        (v_distance <= v_radius_km) as is_within_radius,
        ROUND(v_distance, 2) as distance_km;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_delivery_time TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_delivery_time TO service_role;

-- =====================================================
-- PASO 6: TRIGGER PARA TRACKING AUTOMÁTICO
-- =====================================================

CREATE OR REPLACE FUNCTION track_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo para órdenes de delivery
    IF NEW.order_type != 'delivery' THEN
        RETURN NEW;
    END IF;

    -- Si cambió el estado de delivery
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
        INSERT INTO delivery_tracking (order_id, status, notes, created_by)
        VALUES (
            NEW.id,
            NEW.delivery_status,
            'Estado actualizado automáticamente',
            auth.uid()
        );

        -- Si se entregó, actualizar tiempo real
        IF NEW.delivery_status = 'delivered' AND NEW.actual_delivery_time IS NULL THEN
            NEW.actual_delivery_time := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_track_delivery_status ON restaurant_orders;
CREATE TRIGGER trigger_track_delivery_status
    BEFORE UPDATE ON restaurant_orders
    FOR EACH ROW
    EXECUTE FUNCTION track_delivery_status_change();

-- =====================================================
-- PASO 7: COMENTARIOS
-- =====================================================

COMMENT ON TABLE delivery_tracking IS
'Historial de eventos de delivery. Cada cambio de estado genera un registro
para trazabilidad completa del pedido.';

-- =====================================================
-- FIN DE MIGRACIÓN 156
-- =====================================================
```

### 6.2 Micro-Fase 2.2: API Endpoints

> Ver archivo separado: `IMPLEMENTACION_DELIVERY_API.md`

### 6.3 Micro-Fase 2.3: Tools para Agentes

> Ver archivo separado: `IMPLEMENTACION_DELIVERY_TOOLS.md`

### 6.4 Micro-Fase 2.4: Configuración Tenant

> Ver archivo separado: `IMPLEMENTACION_SERVICE_OPTIONS_UI.md`

---

## 7. FASE 3: INTEGRACIÓN KDS

> Ver archivo separado: `IMPLEMENTACION_KDS_DELIVERY.md`

---

## 8. FASE 4: TESTING Y VALIDACIÓN

> Ver archivo separado: `IMPLEMENTACION_TESTING.md`

---

## 9. RIESGOS Y MITIGACIÓN

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Migración rompe datos existentes | Media | Alto | Backup antes de migrar, scripts de rollback |
| Inconsistencia entre canales | Media | Medio | Tests de integración, validación cruzada |
| Performance en cálculo de delivery | Baja | Medio | Índices optimizados, caching de coordenadas |
| UI no responsiva en móvil | Media | Medio | Testing en dispositivos reales, responsive design |
| Repartidores no asignables | Baja | Alto | Fallback a pickup, notificación a admin |

---

## 10. APÉNDICES

### A. Glosario

| Término | Definición |
|---------|------------|
| **Pickup** | Pedido para recoger en sucursal |
| **Delivery** | Pedido para entregar a domicilio |
| **KDS** | Kitchen Display System - pantalla de cocina |
| **Tier** | Nivel de asistente (basic, standard, complete) |
| **Vertical** | Tipo de negocio (restaurant, dental, etc.) |

### B. Referencias

- `CLAUDE.md` - Guía de desarrollo v4.6.0
- `templates/prompts/` - Templates Handlebars
- `lib/voice-agent/types/` - Tipos de Voice Agent
- `src/shared/config/agent-templates.ts` - Templates de Agentes

### C. Archivos de Implementación Relacionados

1. `155_UNIFIED_ASSISTANT_TYPES.sql`
2. `156_DELIVERY_SYSTEM.sql`
3. `unified-assistant-types.ts`
4. `AssistantTypeSelector.tsx`
5. `ServiceOptionsSection.tsx`
6. `DeliveryPanel.tsx`

---

**Documento generado por Claude Opus 4.5**
**Fecha:** 2026-01-24
**Versión:** 1.0.0
