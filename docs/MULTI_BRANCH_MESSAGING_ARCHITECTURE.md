# TIS TIS Platform - Arquitectura de Mensajeria Multi-Sucursal

## Analisis Exhaustivo y Solucion Propuesta

**Fecha:** 31 de Enero, 2026
**Version:** v4.9.0 (Propuesta)
**Autor:** Analisis de Arquitectura

---

## Indice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Diagnostico del Estado Actual](#diagnostico-del-estado-actual)
3. [Gaps y Problemas Identificados](#gaps-y-problemas-identificados)
4. [Arquitectura Propuesta](#arquitectura-propuesta)
5. [Implementacion por Vertical](#implementacion-por-vertical)
6. [Flujo de Perfiles: Business vs Personal](#flujo-de-perfiles)
7. [Plan de Migracion](#plan-de-migracion)
8. [Diagramas de Flujo](#diagramas-de-flujo)

---

## 1. Resumen Ejecutivo

### El Problema

El sistema actual de TIS TIS tiene soporte **teorico** para multi-sucursal (campos `branch_id` en tablas), pero la implementacion practica tiene varios gaps criticos que causan:

1. **Conversaciones huerfanas**: No aparecen en el filtro de ninguna sucursal
2. **Agente de IA sin contexto de sucursal**: El agente recibe TODAS las sucursales sin saber cual aplica
3. **Bookings/Reservaciones incorrectas**: Van a la sucursal por defecto (HQ) en lugar de la correcta
4. **Confusion en Inbox**: Cuando se filtra por sucursal, algunas conversaciones desaparecen

### La Solucion

Un sistema de **Branch-Aware Messaging** que:

1. **Asegura que toda conversacion tenga branch_id** (never NULL)
2. **Propaga branch_id al agente de IA** como contexto obligatorio
3. **Detecta sucursal del cliente** en el mensaje si no esta asignada
4. **Filtra contexto de negocio por sucursal** (servicios, horarios, staff)

---

## 2. Diagnostico del Estado Actual

### 2.1 Esquema de Base de Datos

```
channel_connections
├── tenant_id (FK) NOT NULL
├── branch_id (FK) NULLABLE  ⚠️ PROBLEMA: Puede ser NULL
├── channel (whatsapp, instagram, facebook, tiktok)
└── status (connected, etc.)

leads
├── tenant_id (FK) NOT NULL
├── branch_id (FK) NULLABLE  ⚠️ PROBLEMA: Hereda NULL de channel_connections
├── phone_normalized (identificador unico)
└── preferred_branch_id ❌ NO EXISTE (deberia)

conversations
├── tenant_id (FK) NOT NULL
├── branch_id (FK) NULLABLE  ⚠️ PROBLEMA: Hereda NULL de channel_connections
├── lead_id (FK)
├── channel
└── status
```

### 2.2 Flujo Actual de Webhook (WhatsApp)

```
1. POST /api/webhook recibe mensaje
   |
2. getTenantContext(phoneNumberId)
   |-- SELECT * FROM channel_connections WHERE phone_number_id = ?
   |-- Retorna: { tenant_id, branch_id: NULL, channel_connection_id }
   |
3. find_or_create_channel_lead(tenant_id, NULL, phone, name)
   |-- Crea lead con branch_id = NULL
   |
4. find_or_create_channel_conversation(tenant_id, NULL, lead_id, channel)
   |-- Crea conversation con branch_id = NULL
   |
5. AI procesa mensaje
   |-- get_tenant_ai_context(tenant_id) ← SIN branch_id
   |-- Recibe TODAS las branches
   |-- Usa primera branch (HQ) para booking
```

### 2.3 Estado del Agente de IA

```typescript
// agent-state.ts - ConversationInfo actual
export interface ConversationInfo {
  conversation_id: string;
  channel: 'whatsapp' | 'instagram' | '...';
  status: 'active' | 'escalated' | 'closed';
  ai_handling: boolean;
  message_count: number;
  started_at: string;
  last_message_at: string;
  // ❌ FALTA: branch_id
}
```

### 2.4 RPC get_tenant_ai_context()

```sql
-- Actual: Retorna TODAS las branches
CREATE FUNCTION get_tenant_ai_context(p_tenant_id UUID)
-- ❌ NO acepta p_branch_id
RETURNS JSONB
AS $$
  SELECT jsonb_build_object(
    'branches', (
      SELECT jsonb_agg(...)
      FROM branches b
      WHERE b.tenant_id = p_tenant_id  -- SIN filtro de branch
    ),
    ...
  );
$$;
```

---

## 3. Gaps y Problemas Identificados

### GAP 1: channel_connections.branch_id NULLABLE

**Impacto:** CRITICO
**Descripcion:** Cuando un tenant tiene un numero de WhatsApp "central" compartido entre sucursales, `channel_connections.branch_id` queda NULL.

**Consecuencia:**
- Todas las conversaciones de ese numero quedan sin sucursal
- No aparecen al filtrar por sucursal en Inbox

### GAP 2: ConversationInfo sin branch_id

**Impacto:** ALTO
**Descripcion:** El estado del agente no incluye `branch_id`, por lo que el agente no sabe a que sucursal pertenece la conversacion actual.

**Consecuencia:**
- Agente no puede filtrar servicios/staff por sucursal
- Bookings van a sucursal incorrecta

### GAP 3: get_tenant_ai_context sin filtro de branch

**Impacto:** ALTO
**Descripcion:** El RPC retorna TODAS las branches del tenant sin filtrar por la sucursal actual.

**Consecuencia:**
- Agente muestra informacion de todas las sucursales
- Cliente recibe horarios/direcciones incorrectas

### GAP 4: No hay deteccion de sucursal en mensaje

**Impacto:** MEDIO
**Descripcion:** El Supervisor no detecta menciones de sucursal ("sucursal norte", "la del centro", etc.)

**Consecuencia:**
- Cliente debe especificar sucursal manualmente
- Agente no pregunta por sucursal proactivamente

### GAP 5: Leads sin preferred_branch_id persistente

**Impacto:** MEDIO
**Descripcion:** Aunque ExtractedData tiene `preferred_branch`, este dato no se persiste en la tabla leads ni se usa para routing futuro.

**Consecuencia:**
- Cada nueva conversacion inicia sin contexto de sucursal
- Cliente debe repetir su sucursal preferida

---

## 4. Arquitectura Propuesta

### 4.1 Modelo de Datos Actualizado

```sql
-- CAMBIO 1: channel_connections con branch obligatorio o flag de multi-branch
ALTER TABLE channel_connections
ADD COLUMN is_multi_branch BOOLEAN DEFAULT false;

-- Si is_multi_branch = true, branch_id puede ser NULL (numero central)
-- Si is_multi_branch = false, branch_id debe ser NOT NULL

-- CAMBIO 2: leads con preferred_branch_id
ALTER TABLE leads
ADD COLUMN preferred_branch_id UUID REFERENCES branches(id);

-- CAMBIO 3: conversations con branch_id NOT NULL (con fallback)
-- Para nuevas: COALESCE(channel_branch, lead_preferred_branch, hq_branch)
```

### 4.2 ConversationInfo Actualizado

```typescript
export interface ConversationInfo {
  conversation_id: string;
  channel: 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'webchat' | 'voice';
  status: 'active' | 'escalated' | 'closed';
  ai_handling: boolean;
  message_count: number;
  started_at: string;
  last_message_at: string;
  // ✅ NUEVO: branch_id obligatorio
  branch_id: string;
  branch_name: string;
}
```

### 4.3 RPC get_tenant_ai_context Actualizado

```sql
CREATE OR REPLACE FUNCTION get_tenant_ai_context(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL  -- ✅ NUEVO parametro
)
RETURNS JSONB AS $$
DECLARE
  v_branch_filter UUID;
BEGIN
  -- Si no se especifica branch, usar HQ
  IF p_branch_id IS NULL THEN
    SELECT id INTO v_branch_filter
    FROM branches
    WHERE tenant_id = p_tenant_id AND is_headquarters = true
    LIMIT 1;
  ELSE
    v_branch_filter := p_branch_id;
  END IF;

  RETURN jsonb_build_object(
    -- Branch actual (solo una)
    'current_branch', (
      SELECT jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'address', b.address,
        'phone', b.phone,
        'operating_hours', b.operating_hours
      )
      FROM branches b
      WHERE b.id = v_branch_filter
    ),

    -- Otras branches (para ofrecer alternativas)
    'other_branches', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'name', b.name,
        'city', b.city
      ))
      FROM branches b
      WHERE b.tenant_id = p_tenant_id
        AND b.id != v_branch_filter
        AND b.is_active = true
    ),

    -- Staff filtrado por branch
    'staff', (
      SELECT jsonb_agg(...)
      FROM staff s
      WHERE s.tenant_id = p_tenant_id
        AND (v_branch_filter = ANY(s.branch_ids) OR s.branch_ids IS NULL)
    ),

    -- Servicios pueden ser globales o por branch
    'services', (
      SELECT jsonb_agg(...)
      FROM services s
      WHERE s.tenant_id = p_tenant_id
        AND (s.branch_id IS NULL OR s.branch_id = v_branch_filter)
    ),

    ...
  );
END;
$$;
```

### 4.4 Flujo de Deteccion de Sucursal

```
FASE 1: Webhook recibe mensaje
├── Si channel_connections.is_multi_branch = false
│   └── Usar channel_connections.branch_id directamente
│
└── Si channel_connections.is_multi_branch = true
    ├── Buscar lead.preferred_branch_id
    │   └── Si existe → Usar preferred_branch_id
    │
    └── Si no existe preferred_branch
        └── Marcar conversation.branch_pending = true
            └── Agente preguntara por sucursal

FASE 2: Supervisor detecta sucursal
├── Analizar mensaje: "sucursal norte", "la del centro", etc.
├── Si detecta sucursal
│   └── Actualizar conversation.branch_id + lead.preferred_branch_id
│
└── Si no detecta y branch_pending = true
    └── Preguntar: "Veo que tenemos varias sucursales. ¿A cual te gustaria acudir?"

FASE 3: Booking/Reservacion
├── Usar conversation.branch_id como contexto
└── Confirmar: "Tu cita es en nuestra sucursal [X] ubicada en [direccion]"
```

### 4.5 Algoritmo de Asignacion de Branch

```typescript
function determineConversationBranch(context: WebhookContext): BranchAssignment {
  const { channelConnection, lead, tenant, message } = context;

  // PRIORIDAD 1: Canal dedicado a una sucursal
  if (!channelConnection.is_multi_branch && channelConnection.branch_id) {
    return {
      branch_id: channelConnection.branch_id,
      source: 'channel_connection',
      confirmed: true,
    };
  }

  // PRIORIDAD 2: Lead tiene sucursal preferida
  if (lead?.preferred_branch_id) {
    return {
      branch_id: lead.preferred_branch_id,
      source: 'lead_preference',
      confirmed: true,
    };
  }

  // PRIORIDAD 3: Detectar sucursal en mensaje
  const detectedBranch = detectBranchFromMessage(message, tenant.branches);
  if (detectedBranch) {
    return {
      branch_id: detectedBranch.id,
      source: 'message_detection',
      confirmed: false, // Confirmar con cliente
    };
  }

  // PRIORIDAD 4: Tenant tiene solo una sucursal
  if (tenant.branches.length === 1) {
    return {
      branch_id: tenant.branches[0].id,
      source: 'single_branch_tenant',
      confirmed: true,
    };
  }

  // FALLBACK: Asignar HQ temporalmente, marcar para pregunta
  return {
    branch_id: tenant.branches.find(b => b.is_headquarters)?.id || tenant.branches[0].id,
    source: 'fallback_hq',
    confirmed: false,
    pending_confirmation: true, // Agente debe preguntar
  };
}
```

---

## 5. Implementacion por Vertical

### 5.1 Vertical DENTAL

**Escenario:** Clinica dental con 3 sucursales (Centro, Norte, Sur)

**Configuracion de Canales:**

| Canal | Numero | Sucursal | is_multi_branch |
|-------|--------|----------|-----------------|
| WhatsApp Business Principal | +52 55 1234 5678 | NULL | true (central) |
| WhatsApp Sucursal Norte | +52 55 8765 4321 | Norte | false |
| Instagram | @clinica_dental | NULL | true (central) |

**Flujo de Conversacion:**

```
Cliente escribe a WhatsApp Central:
"Hola, quiero una limpieza dental"

SUPERVISOR:
├── Detecta intent: BOOKING
├── Detecta branch: NULL (no menciono)
├── is_multi_branch = true
└── Action: PREGUNTAR_SUCURSAL

AGENTE:
"Hola! Con gusto te ayudo a agendar tu limpieza dental.
Tenemos 3 sucursales disponibles:
- Centro: Av. Reforma 123
- Norte: Plaza Satelite Local 45
- Sur: Perisur Nivel 2

¿Cual te queda mas comodo?"

Cliente: "La de reforma"

SUPERVISOR:
├── Detecta: "reforma" → Sucursal Centro
├── Actualiza: conversation.branch_id = centro_uuid
├── Actualiza: lead.preferred_branch_id = centro_uuid
└── Action: PROCEDER_BOOKING

AGENTE:
"Perfecto! Te agendo en nuestra sucursal Centro (Av. Reforma 123).
¿Para cuando te gustaria la cita?"
```

**Perfil Personal (Dentista Individual):**

```
Dentista Dr. Garcia usa su WhatsApp personal.
Tiene configurado perfil "personal" con template "dental_personal_full".

Comportamiento:
- Captura datos del cliente
- Responde FAQs basicas
- Para agendar: "Te comunico con mi asistente de la clinica"
- Para urgencias: "Por favor llama a la clinica: [numero]"

NO pregunta por sucursal (el dentista trabaja en una sola).
```

### 5.2 Vertical CLINIC (Clinica Medica General)

**Escenario:** Clinica medica con 2 sucursales (Polanco, Coyoacan)

**Configuracion Recomendada:**

```typescript
// Cada sucursal con su propio numero
const channelConnections = [
  { phone: '+52 55 1111 1111', branch_id: 'polanco', is_multi_branch: false },
  { phone: '+52 55 2222 2222', branch_id: 'coyoacan', is_multi_branch: false },
];
```

**Flujo de Conversacion:**

```
Cliente escribe al numero de Polanco:
"Necesito una cita con el dermatologo"

SUPERVISOR:
├── Detecta intent: BOOKING
├── Detecta branch: Polanco (via channel_connection)
├── confirmed: true
└── Action: VERIFICAR_DISPONIBILIDAD

AGENTE (ya sabe que es Polanco):
"Hola! Te ayudo a agendar con nuestro dermatologo en Polanco.
Tenemos disponibilidad:
- Lunes 3 de febrero a las 10:00
- Martes 4 de febrero a las 16:00

¿Cual prefieres?"
```

**Perfil Personal (Medico Individual):**

Similar a dental - el medico usa su WhatsApp personal para:
- Resolver dudas basicas de pacientes existentes
- Derivar a la clinica para citas
- Emergencias: instrucciones claras de a donde ir

### 5.3 Vertical RESTAURANT

**Nota Importante:** Los restaurantes NO tienen perfil personal (no aplica WhatsApp personal del chef).

**Escenario:** Restaurante con 2 sucursales (Roma, Condesa)

**Configuracion Recomendada:**

```typescript
// Opcion A: Numero central con deteccion
const channelConnections = [
  { phone: '+52 55 5555 5555', branch_id: null, is_multi_branch: true },
];

// Opcion B: Numero por sucursal (recomendado)
const channelConnections = [
  { phone: '+52 55 5555 0001', branch_id: 'roma', is_multi_branch: false },
  { phone: '+52 55 5555 0002', branch_id: 'condesa', is_multi_branch: false },
];
```

**Flujo de Reservacion (Opcion A - Numero Central):**

```
Cliente escribe:
"Quiero reservar para 4 personas el sabado"

SUPERVISOR:
├── Detecta intent: BOOKING_RESERVATION
├── Detecta branch: NULL
├── is_multi_branch = true
└── Action: PREGUNTAR_SUCURSAL

AGENTE:
"Hola! Con gusto te reservo mesa para 4 personas.
¿En cual de nuestras sucursales?
- Roma Norte: Calle Orizaba 123 (terraza disponible)
- Condesa: Av. Tamaulipas 456 (salon privado disponible)"

Cliente: "En Roma"

SUPERVISOR:
├── Detecta: "Roma" → Sucursal Roma
├── Actualiza: conversation.branch_id = roma_uuid
└── Action: PROCEDER_RESERVACION

AGENTE:
"Perfecto! Mesa para 4 en Roma Norte para el sabado.
¿A que hora te gustaria? Tenemos disponibilidad de 14:00 a 22:00."
```

**Flujo de Pedido (Pickup/Delivery):**

```
Cliente escribe a numero de Condesa:
"Quiero ordenar 2 tacos al pastor para recoger"

SUPERVISOR:
├── Detecta intent: ORDERING_PICKUP
├── Detecta branch: Condesa (via channel_connection)
├── confirmed: true
└── Action: PROCESAR_ORDEN

AGENTE (ya sabe que es Condesa):
"Perfecto! 2 tacos al pastor para recoger en Condesa.
Precio: $90 MXN
Tiempo estimado: 15 minutos
¿Confirmo tu pedido?"
```

---

## 6. Flujo de Perfiles: Business vs Personal

### 6.1 Comparativa

| Aspecto | Perfil Business | Perfil Personal |
|---------|-----------------|-----------------|
| **Canal** | WhatsApp Business API | WhatsApp Personal (via Twilio/API) |
| **Multi-sucursal** | SI - pregunta/detecta | NO - dentista trabaja en una sucursal |
| **Booking completo** | SI - agenda directamente | NO - deriva a la clinica |
| **Precios** | SI - informa precios | LIMITADO - "contacta la clinica" |
| **Urgencias** | SI - protocolo completo | SI - "llama a emergencias" |
| **Horarios** | SI - de todas las sucursales | SI - solo de su consultorio |

### 6.2 Configuracion de Perfil Personal

```typescript
// src/shared/config/agent-templates.ts
const DENTAL_PERSONAL_TEMPLATES: AgentTemplate[] = [
  {
    key: 'dental_personal_full',
    name: 'Asistente Personal Completo',
    description: 'Para dentistas que atienden por WhatsApp personal',
    vertical: 'dental',
    profileType: 'personal',
    capabilities: [
      'basic_info',           // Info basica
      'faq',                  // Responder dudas
      'redirect_to_clinic',   // Derivar para citas
      'lead_capture',         // Capturar datos
    ],
    promptTemplate: `Eres el asistente personal del Dr./Dra. {{doctor_name}}.

REGLAS ESPECIALES:
1. NUNCA agendar citas directamente - siempre derivar a la clinica
2. Para emergencias dentales: indicar llamar a la clinica {{clinic_phone}}
3. Puedes responder dudas generales sobre procedimientos
4. Capturar nombre y telefono del paciente para seguimiento

CUANDO PIDAN CITA:
"Con gusto! Para agendar, te comunico con mi equipo de la clinica.
Puedes escribirles directamente al {{clinic_whatsapp}} o llamar al {{clinic_phone}}.
Diles que vienes de mi parte!"`,
    customizableVariables: [
      'doctor_name',
      'clinic_name',
      'clinic_phone',
      'clinic_whatsapp',
      'doctor_specialty',
    ],
    displayOrder: 1,
    isDefault: true,
    icon: '👨‍⚕️',
  },
];
```

### 6.3 Flujo de Perfil Personal

```
CASO: Paciente escribe al WhatsApp personal de Dr. Garcia

Paciente: "Doctor, me duele una muela desde ayer"

PERFIL PERSONAL DETECTA:
├── profile_type: 'personal'
├── Intent: PAIN_REPORT
├── Severidad: MEDIA (dolor desde ayer, no urgencia inmediata)

AGENTE (Perfil Personal):
"Hola! Entiendo que tienes dolor de muela.

Si el dolor es muy intenso o tienes hinchazon, te recomiendo
ir a urgencias de la Clinica Dental [X] al [telefono].

Si puedes esperar, te sugiero agendar una cita de revision.
Escribe a mi asistente al [WhatsApp clinica] o llama al [telefono].
Diles que vienes de mi parte para que te den prioridad.

¿Como te sientes actualmente?"
```

### 6.4 Matriz de Capacidades por Vertical y Perfil

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CAPACIDADES POR VERTICAL/PERFIL                  │
├──────────────┬──────────────────────────┬───────────────────────────┤
│   Vertical   │    Perfil Business       │    Perfil Personal        │
├──────────────┼──────────────────────────┼───────────────────────────┤
│   DENTAL     │ ✅ Booking completo       │ ❌ Solo deriva a clinica  │
│              │ ✅ Precios                │ ⚠️ "Pregunta en clinica"  │
│              │ ✅ Multi-sucursal         │ ❌ N/A (una sucursal)     │
│              │ ✅ Urgencias protocoladas │ ✅ Urgencias → llamar     │
│              │ ✅ FAQ completo           │ ✅ FAQ basico             │
├──────────────┼──────────────────────────┼───────────────────────────┤
│   CLINIC     │ ✅ Booking completo       │ ❌ Solo deriva a clinica  │
│              │ ✅ Precios                │ ⚠️ "Pregunta en clinica"  │
│              │ ✅ Multi-sucursal         │ ❌ N/A (una sucursal)     │
│              │ ✅ Urgencias protocoladas │ ✅ Urgencias → 911        │
│              │ ✅ FAQ completo           │ ✅ FAQ basico             │
├──────────────┼──────────────────────────┼───────────────────────────┤
│  RESTAURANT  │ ✅ Reservaciones          │ ❌ NO APLICA              │
│              │ ✅ Pedidos pickup/delivery│    (no hay perfil         │
│              │ ✅ Menu e info            │     personal para         │
│              │ ✅ Multi-sucursal         │     restaurantes)         │
│              │ ❌ No hay urgencias       │                           │
└──────────────┴──────────────────────────┴───────────────────────────┘
```

---

## 7. Plan de Migracion

### FASE 1: Base de Datos (1-2 dias)

```sql
-- Migration 185_MULTI_BRANCH_MESSAGING_SUPPORT.sql

-- 1. Agregar is_multi_branch a channel_connections
ALTER TABLE channel_connections
ADD COLUMN is_multi_branch BOOLEAN DEFAULT false;

-- 2. Actualizar existentes: si branch_id es NULL, es multi-branch
UPDATE channel_connections
SET is_multi_branch = (branch_id IS NULL);

-- 3. Agregar preferred_branch_id a leads
ALTER TABLE leads
ADD COLUMN preferred_branch_id UUID REFERENCES branches(id);

-- 4. Crear indice para busqueda rapida
CREATE INDEX idx_leads_preferred_branch
ON leads(tenant_id, preferred_branch_id)
WHERE preferred_branch_id IS NOT NULL;

-- 5. Agregar branch_pending a conversations
ALTER TABLE conversations
ADD COLUMN branch_pending BOOLEAN DEFAULT false;

-- 6. Backfill: asignar HQ a conversaciones sin branch
UPDATE conversations c
SET branch_id = (
  SELECT b.id FROM branches b
  WHERE b.tenant_id = c.tenant_id AND b.is_headquarters = true
  LIMIT 1
)
WHERE c.branch_id IS NULL;
```

### FASE 2: RPC Updates (1 dia)

```sql
-- Migration 186_UPDATE_AI_CONTEXT_WITH_BRANCH.sql

-- Actualizar get_tenant_ai_context para aceptar branch_id
CREATE OR REPLACE FUNCTION get_tenant_ai_context(
  p_tenant_id UUID,
  p_branch_id UUID DEFAULT NULL
)
...
```

### FASE 3: Agent State (1 dia)

```typescript
// Actualizar ConversationInfo en agent-state.ts
export interface ConversationInfo {
  conversation_id: string;
  channel: '...';
  status: '...';
  ai_handling: boolean;
  message_count: number;
  started_at: string;
  last_message_at: string;
  // NUEVOS CAMPOS
  branch_id: string;
  branch_name: string;
  branch_pending: boolean;
}
```

### FASE 4: Supervisor Update (2 dias)

```typescript
// Actualizar supervisor.agent.ts

// Agregar deteccion de sucursal
function detectBranchFromMessage(
  message: string,
  branches: Branch[]
): Branch | null {
  const branchKeywords = branches.flatMap(b => [
    b.name.toLowerCase(),
    b.city?.toLowerCase(),
    b.address?.toLowerCase(),
    // Aliases comunes
    ...getBranchAliases(b)
  ]).filter(Boolean);

  const messageLower = message.toLowerCase();

  for (const branch of branches) {
    const keywords = [branch.name, branch.city, ...getBranchAliases(branch)];
    if (keywords.some(k => messageLower.includes(k.toLowerCase()))) {
      return branch;
    }
  }

  return null;
}

// En supervisorNode:
if (state.conversation?.branch_pending) {
  // Intentar detectar sucursal del mensaje
  const detectedBranch = detectBranchFromMessage(
    state.current_message,
    state.business_context?.branches || []
  );

  if (detectedBranch) {
    // Actualizar conversation y lead
    await updateConversationBranch(
      state.conversation.conversation_id,
      detectedBranch.id
    );
  } else {
    // Marcar para que agente pregunte
    nextAgent = 'branch_selector';
  }
}
```

### FASE 5: UI Updates (1 dia)

```typescript
// Actualizar Inbox para mostrar indicador de branch_pending
{conversation.branch_pending && (
  <Badge variant="warning">
    Sin sucursal asignada
  </Badge>
)}

// Filtro de sucursal incluye opcion "Sin asignar"
<Select>
  <Option value="all">Todas las sucursales</Option>
  <Option value="unassigned">Sin asignar</Option>
  {branches.map(b => (
    <Option value={b.id}>{b.name}</Option>
  ))}
</Select>
```

---

## 8. Diagramas de Flujo

### 8.1 Flujo de Asignacion de Sucursal

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE ASIGNACION DE SUCURSAL                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐                                                       │
│  │ Webhook  │                                                       │
│  │ recibe   │                                                       │
│  │ mensaje  │                                                       │
│  └────┬─────┘                                                       │
│       │                                                             │
│       ▼                                                             │
│  ┌──────────────────────────┐                                       │
│  │ channel_connection tiene │                                       │
│  │ branch_id?               │                                       │
│  └────┬──────────┬──────────┘                                       │
│       │ SI       │ NO (is_multi_branch)                             │
│       ▼          ▼                                                  │
│  ┌────────┐   ┌──────────────────────────┐                          │
│  │ Usar   │   │ Lead tiene               │                          │
│  │ branch │   │ preferred_branch_id?     │                          │
│  │ del    │   └────┬──────────┬──────────┘                          │
│  │ canal  │        │ SI       │ NO                                  │
│  └────────┘        ▼          ▼                                     │
│                ┌────────┐  ┌──────────────────────────┐             │
│                │ Usar   │  │ Detectar sucursal        │             │
│                │ prefer │  │ en mensaje?              │             │
│                │ encia  │  └────┬──────────┬──────────┘             │
│                │ del    │       │ SI       │ NO                     │
│                │ lead   │       ▼          ▼                        │
│                └────────┘  ┌────────┐  ┌──────────────────────┐     │
│                            │ Asignar│  │ Tenant tiene         │     │
│                            │ branch │  │ solo 1 sucursal?     │     │
│                            │ detect │  └────┬──────────┬──────┘     │
│                            │ ado    │       │ SI       │ NO         │
│                            └────────┘       ▼          ▼            │
│                                        ┌────────┐  ┌────────────┐   │
│                                        │ Usar   │  │ Asignar HQ │   │
│                                        │ unica  │  │ + marcar   │   │
│                                        │ branch │  │ pending    │   │
│                                        └────────┘  └────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Flujo del Agente con Branch-Awareness

```
┌─────────────────────────────────────────────────────────────────────┐
│                FLUJO DEL AGENTE CON BRANCH-AWARENESS                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐     ┌─────────────────────────────────────┐          │
│  │ Mensaje  │────▶│         SUPERVISOR                  │          │
│  │ entrante │     │ - Detecta intent                    │          │
│  └──────────┘     │ - Detecta branch en mensaje         │          │
│                   │ - Verifica branch_pending           │          │
│                   └────────────┬────────────────────────┘          │
│                                │                                    │
│                    ┌───────────┼───────────┐                        │
│                    ▼           ▼           ▼                        │
│               ┌────────┐  ┌────────┐  ┌────────────┐               │
│               │ Branch │  │ Branch │  │ Branch     │               │
│               │ known  │  │ detect │  │ unknown    │               │
│               │        │  │ ed     │  │ (pending)  │               │
│               └───┬────┘  └───┬────┘  └───┬────────┘               │
│                   │           │           │                         │
│                   │           │           ▼                         │
│                   │           │      ┌────────────┐                 │
│                   │           │      │ BRANCH     │                 │
│                   │           │      │ SELECTOR   │                 │
│                   │           │      │ "¿Cual     │                 │
│                   │           │      │ sucursal?" │                 │
│                   │           │      └───┬────────┘                 │
│                   │           │          │                          │
│                   ▼           ▼          ▼                          │
│              ┌─────────────────────────────────────┐                │
│              │         VERTICAL ROUTER             │                │
│              │ get_tenant_ai_context(              │                │
│              │   tenant_id,                        │                │
│              │   branch_id  ← AHORA FILTRADO       │                │
│              │ )                                   │                │
│              └───────────────┬─────────────────────┘                │
│                              │                                      │
│                              ▼                                      │
│              ┌─────────────────────────────────────┐                │
│              │       AGENTE ESPECIALIZADO          │                │
│              │ - Solo servicios de esta branch     │                │
│              │ - Solo staff de esta branch         │                │
│              │ - Horarios de esta branch           │                │
│              └─────────────────────────────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Resumen de Cambios Requeridos

| Componente | Cambio | Prioridad | Esfuerzo |
|------------|--------|-----------|----------|
| **Migracion SQL** | Agregar campos, backfill | CRITICO | 2 horas |
| **RPC get_tenant_ai_context** | Agregar p_branch_id | CRITICO | 2 horas |
| **agent-state.ts** | Agregar branch_id a ConversationInfo | ALTO | 1 hora |
| **supervisor.agent.ts** | Agregar deteccion de branch | ALTO | 4 horas |
| **webhook/route.ts** | Usar nuevo algoritmo de asignacion | ALTO | 2 horas |
| **langgraph-ai.service.ts** | Propagar branch_id a contexto | ALTO | 2 horas |
| **inbox/page.tsx** | Filtro "Sin asignar", badge | MEDIO | 2 horas |
| **agent-templates.ts** | Templates personal con derivacion | MEDIO | 2 horas |

**Estimacion Total:** 15-20 horas de desarrollo

---

*Este documento es la guia maestra para implementar Branch-Aware Messaging en TIS TIS Platform.*
