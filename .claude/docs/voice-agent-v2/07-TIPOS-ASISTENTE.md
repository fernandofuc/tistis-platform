# VOICE AGENT v2.0 - TIPOS DE ASISTENTE

**Documento:** 07-TIPOS-ASISTENTE.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Especificacion Completa

---

## 1. FILOSOFIA DE TIPOS

### 1.1 Por Que Tipos Predefinidos

En lugar de permitir configuracion libre (que lleva a configuraciones invalidas y soporte complejo), definimos **tipos de asistente predefinidos** que:

1. **Garantizan calidad**: Prompts optimizados por caso de uso
2. **Simplifican configuracion**: El admin solo elige tipo, no configura cada detalle
3. **Facilitan soporte**: Sabemos exactamente que puede hacer cada tipo
4. **Previenen errores**: No se pueden habilitar tools incompatibles

### 1.2 Estructura de Tipos

```
VERTICAL
    |
    +-- TIPO BASICO
    |       |-- Capacidades minimas
    |       |-- Prompt simple
    |       |-- Tools limitados
    |
    +-- TIPO ESTANDAR
    |       |-- Capacidades intermedias
    |       |-- Prompt con mas contexto
    |       |-- Tools adicionales
    |
    +-- TIPO COMPLETO
            |-- Todas las capacidades
            |-- Prompt completo
            |-- Todos los tools
```

---

## 2. TIPOS POR VERTICAL: RESTAURANT

### 2.1 Matriz de Capacidades

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        RESTAURANT - MATRIZ DE CAPACIDADES                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Capacidad                    │ BASICO │ ESTANDAR │ COMPLETO                    │
│  ────────────────────────────────────────────────────────────────               │
│  Verificar disponibilidad     │   ✓    │    ✓     │    ✓                        │
│  Crear reservacion            │   ✓    │    ✓     │    ✓                        │
│  Consultar horarios           │   ✓    │    ✓     │    ✓                        │
│  Informacion del negocio      │   ✓    │    ✓     │    ✓                        │
│  ────────────────────────────────────────────────────────────────               │
│  Consultar menu               │   ✗    │    ✓     │    ✓                        │
│  Dar recomendaciones          │   ✗    │    ✓     │    ✓                        │
│  Informar precios             │   ✗    │    ✓     │    ✓                        │
│  ────────────────────────────────────────────────────────────────               │
│  Tomar pedidos telefonicos    │   ✗    │    ✗     │    ✓                        │
│  Modificar pedidos            │   ✗    │    ✗     │    ✓                        │
│  Estado de pedido/delivery    │   ✗    │    ✗     │    ✓                        │
│  ────────────────────────────────────────────────────────────────               │
│  Escalacion a humano          │   ✓    │    ✓     │    ✓                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 rest_basic - Reservaciones

**ID:** `rest_basic`
**Nombre UI:** "Reservaciones"
**Descripcion:** Solo maneja reservaciones de mesa y consultas basicas del restaurante.

**Capacidades:**
```typescript
enabled_capabilities: [
  'check_availability',
  'create_reservation',
  'get_business_hours',
  'get_business_info',
  'transfer_to_human'
]
```

**Tools Disponibles:**
```typescript
tools: [
  'check_availability',      // Verificar disponibilidad
  'create_reservation',      // Crear reservacion (requiere confirmacion)
  'get_business_hours',      // Consultar horarios
  'get_business_info',       // Info general del restaurante
  'transfer_to_human'        // Escalar a humano
]
```

**Structured Data Schema:**
```json
{
  "reservation_data": {
    "type": "object",
    "properties": {
      "reservation_made": { "type": "boolean" },
      "reservation_date": { "type": "string", "format": "date" },
      "reservation_time": { "type": "string" },
      "party_size": { "type": "integer" },
      "customer_name": { "type": "string" },
      "customer_phone": { "type": "string" },
      "special_requests": { "type": "string" }
    }
  },
  "lead_data": {
    "type": "object",
    "properties": {
      "is_new_customer": { "type": "boolean" },
      "interest_level": { "type": "string", "enum": ["high", "medium", "low"] }
    }
  }
}
```

**Flujo de Conversacion Tipico:**
```
1. Saludo
   "Hola! Gracias por llamar a {restaurante}. En que puedo ayudarte?"

2. Detectar intencion
   Usuario: "Quiero reservar para manana"
   -> Intent: BOOKING

3. Recopilar datos
   "Claro! Para cuantas personas seria?"
   "A que hora te gustaria?"
   "A nombre de quien?"
   "Un telefono de contacto?"

4. Verificar disponibilidad
   -> Tool: check_availability(date, time, party_size)

5. Confirmar antes de crear
   "Perfecto, confirmo: Mesa para 4, manana 20 de enero a las 8pm,
    a nombre de Juan. Es correcto?"

6. Crear reservacion
   -> Tool: create_reservation(...)

7. Confirmar
   "Listo! Tu reservacion esta confirmada. Codigo: RES-1234.
    Te enviamos confirmacion por WhatsApp. Algo mas?"

8. Despedida
   "Gracias por llamar! Te esperamos manana."
```

---

### 2.3 rest_standard - Reservaciones + Menu

**ID:** `rest_standard`
**Nombre UI:** "Reservaciones + Menu"
**Descripcion:** Maneja reservaciones y consultas del menu, precios y recomendaciones.

**Capacidades Adicionales (sobre basico):**
```typescript
additional_capabilities: [
  'get_menu',
  'get_recommendations',
  'get_prices'
]
```

**Tools Adicionales:**
```typescript
additional_tools: [
  'get_menu',            // Consultar menu completo o por categoria
  'get_recommendations', // Dar recomendaciones basadas en preferencias
  'search_menu_item'     // Buscar plato especifico
]
```

**Flujos Adicionales:**

```
FLUJO: Consulta de Menu
─────────────────────────────────────────────

Usuario: "Que tienen de mariscos?"
   |
   v
-> Tool: get_menu(category: 'mariscos')
   |
   v
"Tenemos camarones al ajillo a 280 pesos, ceviche de pescado a 180,
 y torre de mariscos para compartir a 450. El ceviche es muy popular.
 Te gustaria reservar y probar alguno?"

---

FLUJO: Recomendacion
─────────────────────────────────────────────

Usuario: "Que me recomiendas para una cena romantica?"
   |
   v
-> Tool: get_recommendations(occasion: 'romantic_dinner')
   |
   v
"Para una cena romantica te recomiendo nuestra torre de mariscos
 para compartir, y de entrada el carpaccio de salmon. Tenemos un
 area con vista al jardin perfecta para la ocasion. Reservo?"
```

---

### 2.4 rest_complete - Completo

**ID:** `rest_complete`
**Nombre UI:** "Completo"
**Descripcion:** Todo incluido: reservaciones, menu, pedidos telefonicos y seguimiento.

**Capacidades Adicionales (sobre estandar):**
```typescript
additional_capabilities: [
  'create_order',
  'modify_order',
  'get_order_status',
  'calculate_delivery_time'
]
```

**Tools Adicionales:**
```typescript
additional_tools: [
  'create_order',           // Crear pedido telefonico
  'modify_order',           // Modificar pedido existente
  'get_order_status',       // Estado del pedido
  'calculate_delivery_time' // Calcular tiempo de entrega
]
```

**Structured Data Schema Adicional:**
```json
{
  "order_data": {
    "type": "object",
    "properties": {
      "order_placed": { "type": "boolean" },
      "order_items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "item_name": { "type": "string" },
            "quantity": { "type": "integer" },
            "modifications": { "type": "string" }
          }
        }
      },
      "order_total": { "type": "number" },
      "delivery_type": { "type": "string", "enum": ["delivery", "pickup"] },
      "delivery_address": { "type": "string" },
      "estimated_time": { "type": "string" }
    }
  }
}
```

**Flujo de Pedido Telefonico:**
```
1. Detectar intencion de pedido
   Usuario: "Quiero ordenar para llevar"
   -> Intent: ORDER

2. Tomar pedido
   "Claro! Que te gustaria ordenar?"
   Usuario: "Dos tacos de camaron y una michelada"

3. Confirmar items
   -> Tool: get_menu_item('tacos de camaron')
   -> Tool: get_menu_item('michelada')
   "Son dos tacos de camaron a 45 cada uno y una michelada a 80.
    El total seria 170 pesos. Es para llevar o a domicilio?"

4. Datos de entrega (si delivery)
   "A que direccion te lo enviamos?"
   "Un telefono de contacto?"

5. Calcular tiempo
   -> Tool: calculate_delivery_time(address)
   "El tiempo estimado de entrega es 35-45 minutos."

6. Confirmar pedido completo
   "Confirmo: 2 tacos de camaron y 1 michelada, total 170 pesos,
    a entregar en Av. Reforma 123 en aproximadamente 40 minutos.
    Correcto?"

7. Crear pedido
   -> Tool: create_order(...)

8. Confirmar
   "Listo! Tu pedido PED-5678 esta en preparacion.
    Te avisamos cuando salga a entrega. Algo mas?"
```

---

## 3. TIPOS POR VERTICAL: DENTAL

### 3.1 Matriz de Capacidades

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DENTAL - MATRIZ DE CAPACIDADES                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Capacidad                    │ BASICO │ ESTANDAR │ COMPLETO                    │
│  ────────────────────────────────────────────────────────────────               │
│  Verificar disponibilidad     │   ✓    │    ✓     │    ✓                        │
│  Crear cita                   │   ✓    │    ✓     │    ✓                        │
│  Consultar horarios           │   ✓    │    ✓     │    ✓                        │
│  Informacion del negocio      │   ✓    │    ✓     │    ✓                        │
│  ────────────────────────────────────────────────────────────────               │
│  Informar servicios           │   ✗    │    ✓     │    ✓                        │
│  Informar precios aprox.      │   ✗    │    ✓     │    ✓                        │
│  Info de doctores/staff       │   ✗    │    ✓     │    ✓                        │
│  ────────────────────────────────────────────────────────────────               │
│  Reagendar cita               │   ✗    │    ✗     │    ✓                        │
│  Cancelar cita                │   ✗    │    ✗     │    ✓                        │
│  Manejar urgencias            │   ✗    │    ✗     │    ✓                        │
│  Enviar recordatorios         │   ✗    │    ✗     │    ✓                        │
│  ────────────────────────────────────────────────────────────────               │
│  Escalacion a humano          │   ✓    │    ✓     │    ✓                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 dental_basic - Citas Basico

**ID:** `dental_basic`
**Nombre UI:** "Citas Basico"
**Descripcion:** Solo maneja agendamiento de citas y consultas de horarios.

**Capacidades:**
```typescript
enabled_capabilities: [
  'check_availability',
  'create_appointment',
  'get_business_hours',
  'get_business_info',
  'transfer_to_human'
]
```

**Tools:**
```typescript
tools: [
  'check_availability',
  'create_appointment',
  'get_business_hours',
  'get_business_info',
  'transfer_to_human'
]
```

**Structured Data Schema:**
```json
{
  "appointment_data": {
    "type": "object",
    "properties": {
      "appointment_made": { "type": "boolean" },
      "appointment_date": { "type": "string", "format": "date" },
      "appointment_time": { "type": "string" },
      "patient_name": { "type": "string" },
      "patient_phone": { "type": "string" },
      "reason": { "type": "string" },
      "is_first_visit": { "type": "boolean" }
    }
  }
}
```

---

### 3.3 dental_standard - Citas + Servicios

**ID:** `dental_standard`
**Nombre UI:** "Citas + Servicios"
**Descripcion:** Maneja citas y proporciona informacion de servicios y precios aproximados.

**Capacidades Adicionales:**
```typescript
additional_capabilities: [
  'get_services',
  'get_prices',
  'get_staff_info'
]
```

**Tools Adicionales:**
```typescript
additional_tools: [
  'get_services',     // Lista de servicios
  'get_service_info', // Info detallada de un servicio
  'get_prices',       // Precios aproximados
  'get_staff_info'    // Info de doctores
]
```

**Structured Data Schema Adicional:**
```json
{
  "inquiry_data": {
    "type": "object",
    "properties": {
      "services_asked": { "type": "array", "items": { "type": "string" } },
      "price_sensitive": { "type": "boolean" },
      "preferred_doctor": { "type": "string" }
    }
  }
}
```

**Flujo de Consulta de Servicios:**
```
Usuario: "Cuanto cuesta una limpieza?"
   |
   v
-> Tool: get_service_info('limpieza_dental')
   |
   v
"La limpieza dental tiene un costo de 500 a 800 pesos, dependiendo
 del tipo. Incluye revision completa y fluoruro. La primera cita
 siempre incluye valoracion sin costo adicional. Te gustaria agendar?"
```

---

### 3.4 dental_complete - Completo

**ID:** `dental_complete`
**Nombre UI:** "Completo"
**Descripcion:** Todo: citas, servicios, reagendamiento, cancelaciones y manejo de urgencias.

**Capacidades Adicionales:**
```typescript
additional_capabilities: [
  'modify_appointment',
  'cancel_appointment',
  'handle_emergency',
  'send_reminder'
]
```

**Tools Adicionales:**
```typescript
additional_tools: [
  'modify_appointment',  // Reagendar cita
  'cancel_appointment',  // Cancelar cita
  'handle_emergency',    // Evaluar y manejar urgencias
  'send_reminder'        // Enviar recordatorio
]
```

**Structured Data Schema Adicional:**
```json
{
  "emergency_data": {
    "type": "object",
    "properties": {
      "is_emergency": { "type": "boolean" },
      "emergency_type": { "type": "string" },
      "pain_level": { "type": "integer", "minimum": 1, "maximum": 10 },
      "symptoms": { "type": "array", "items": { "type": "string" } },
      "immediate_action_taken": { "type": "boolean" }
    }
  }
}
```

**Flujo de Urgencia:**
```
Usuario: "Me duele mucho una muela, creo que es urgente"
   |
   v
-> Intent: EMERGENCY
   |
   v
"Entiendo que tienes dolor. En una escala del 1 al 10, que tan
 fuerte es el dolor?"
   |
Usuario: "Como 8"
   |
   v
-> Tool: handle_emergency(pain_level: 8, symptoms: ['dolor_muela'])
   |
   v
"Con ese nivel de dolor es importante atenderte pronto. Tenemos
 un espacio de emergencia disponible hoy a las 4pm con el Dr. Garcia.
 Te lo agendo de inmediato?"
   |
   v
-> Tool: create_appointment(type: 'emergency', ...)
   |
   v
"Listo, tu cita de emergencia esta confirmada para hoy a las 4pm.
 Mientras tanto, puedes tomar un analgesico si no eres alergico.
 Te enviamos la direccion por WhatsApp."
```

---

## 4. CONFIGURACION EN UI

### 4.1 Selector de Tipo

```
┌─────────────────────────────────────────────────────────────────┐
│           SELECCIONA EL TIPO DE ASISTENTE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │                 │  │                 │  │                 │ │
│  │  📅 BASICO      │  │  📋 ESTANDAR    │  │  🌟 COMPLETO    │ │
│  │                 │  │                 │  │                 │ │
│  │  Reservaciones  │  │  Reservaciones  │  │  Todo incluido  │ │
│  │                 │  │  + Menu         │  │  + Pedidos      │ │
│  │                 │  │                 │  │                 │ │
│  │  ─────────────  │  │  ─────────────  │  │  ─────────────  │ │
│  │  ✓ Reservar     │  │  ✓ Reservar     │  │  ✓ Reservar     │ │
│  │  ✓ Horarios     │  │  ✓ Horarios     │  │  ✓ Horarios     │ │
│  │  ✓ Info basica  │  │  ✓ Menu         │  │  ✓ Menu         │ │
│  │                 │  │  ✓ Precios      │  │  ✓ Pedidos      │ │
│  │                 │  │  ✓ Recomend.    │  │  ✓ Delivery     │ │
│  │                 │  │                 │  │                 │ │
│  │  [SELECCIONAR]  │  │  [SELECCIONAR]  │  │  [SELECCIONAR]  │ │
│  │                 │  │  Recomendado    │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Logica de Tipo por Vertical

```typescript
// Obtener tipos disponibles para un tenant
async function getAvailableTypes(tenantId: string): Promise<AssistantType[]> {
  const tenant = await getTenant(tenantId);

  const { data: types } = await supabase
    .from('voice_assistant_types')
    .select('*')
    .eq('vertical', tenant.vertical)
    .eq('is_active', true)
    .order('sort_order');

  return types || [];
}

// En el UI
const types = await getAvailableTypes(tenantId);
// Si vertical = 'restaurant', retorna: rest_basic, rest_standard, rest_complete
// Si vertical = 'dental', retorna: dental_basic, dental_standard, dental_complete
```

---

## 5. ESCALABILIDAD A NUEVOS VERTICALES

### 5.1 Agregar Nueva Vertical

Para agregar un nuevo vertical (ej: `gym`):

1. **Definir tipos en seed:**
```sql
INSERT INTO voice_assistant_types VALUES
('gym_basic', 'gym', 'Clases Basico', ...),
('gym_standard', 'gym', 'Clases + Membresias', ...),
('gym_complete', 'gym', 'Completo', ...);
```

2. **Crear prompt templates:**
```
src/features/voice-agent/prompts/templates/
  +-- gym_classes_v1.ts
  +-- gym_standard_v1.ts
  +-- gym_complete_v1.ts
```

3. **Definir tools especificos:**
```typescript
// Nuevos tools para gym
'get_class_schedule',
'book_class',
'get_membership_info',
'check_membership_status'
```

4. **Agregar structured data schemas.**

5. **Sin cambios en el codigo core** - el sistema detecta automaticamente los tipos disponibles por vertical.

---

## 6. CHECKLIST DE IMPLEMENTACION

### 6.1 Por Tipo

- [ ] Definir capacidades exactas
- [ ] Definir tools disponibles
- [ ] Definir structured data schemas
- [ ] Crear prompt template
- [ ] Definir flujos de conversacion
- [ ] Documentar casos edge
- [ ] Tests de integracion

### 6.2 General

- [ ] Seed data para todos los tipos
- [ ] UI de seleccion de tipo
- [ ] Validacion de tipo vs vertical
- [ ] Migracion de configs existentes
- [ ] Documentacion para admins

---

*Este documento es parte de la documentacion de Voice Agent v2.0.*
