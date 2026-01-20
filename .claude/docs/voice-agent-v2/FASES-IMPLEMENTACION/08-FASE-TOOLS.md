# FASE 08: Sistema de Tools

## Informacion de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 08 |
| **Nombre** | Tool System |
| **Sprint** | 2 - Integracion VAPI |
| **Duracion Estimada** | 2 dias |
| **Dependencias** | Fase 07 (LangGraph) |
| **Documento Referencia** | `08-TOOL-CALLING.md` |

---

## Objetivo

Implementar el sistema unificado de tools para Voice Agent, incluyendo el registry, definiciones de tools para restaurantes y dentales, logica de confirmacion y formateo de resultados para voz.

---

## Microfases

### MICROFASE 8.1: Crear Estructura de Archivos

**Archivos a crear:**
```
lib/voice-agent/
├── tools/
│   ├── index.ts
│   ├── registry.ts
│   ├── types.ts
│   ├── formatters.ts
│   ├── restaurant/
│   │   ├── check-availability.ts
│   │   ├── create-reservation.ts
│   │   ├── get-menu.ts
│   │   └── create-order.ts
│   └── dental/
│       ├── check-availability.ts
│       ├── create-appointment.ts
│       ├── get-services.ts
│       └── transfer-to-human.ts
```

**Que hacer:**
1. Crear estructura de carpetas
2. Crear archivo de types
3. Crear exports

**Verificacion:**
- [ ] Estructura creada
- [ ] Types definidos
- [ ] Exports funcionan

---

### MICROFASE 8.2: Definir Interfaces de Tools

**Archivo:** `lib/voice-agent/tools/types.ts`

**Que hacer:**
1. Definir interfaces:
   ```typescript
   interface ToolDefinition {
     name: string;
     description: string;
     parameters: JSONSchema;
     requiredCapabilities: Capability[];
     requiresConfirmation: boolean;
     confirmationTemplate?: string;
     handler: ToolHandler;
   }

   type ToolHandler = (
     params: Record<string, any>,
     context: ToolContext
   ) => Promise<ToolResult>;

   interface ToolContext {
     businessId: string;
     callId: string;
     language: string;
   }

   interface ToolResult {
     success: boolean;
     data?: any;
     error?: string;
     voiceResponse: string; // Formateado para voz
   }
   ```

**Verificacion:**
- [ ] Interfaces completas
- [ ] Handler type correcto
- [ ] Result incluye voiceResponse

---

### MICROFASE 8.3: Implementar Tool Registry

**Archivo:** `lib/voice-agent/tools/registry.ts`

**Que hacer:**
1. Crear clase ToolRegistry:
   ```typescript
   class ToolRegistry {
     private tools: Map<string, ToolDefinition> = new Map();

     // Registrar un tool
     register(tool: ToolDefinition): void

     // Obtener tool por nombre
     get(name: string): ToolDefinition | undefined

     // Verificar si existe
     has(name: string): boolean

     // Obtener tools por tipo de asistente
     getForType(assistantType: string): ToolDefinition[]

     // Verificar si requiere confirmacion
     requiresConfirmation(name: string): boolean

     // Obtener mensaje de confirmacion
     getConfirmationMessage(name: string, params: Record<string, any>): string

     // Ejecutar tool
     async execute(
       name: string,
       params: Record<string, any>,
       context: ToolContext
     ): Promise<ToolResult>
   }
   ```

2. Implementar singleton pattern
3. Auto-registrar tools al importar

**Verificacion:**
- [ ] Registry funciona
- [ ] Singleton implementado
- [ ] Metodos completos

---

### MICROFASE 8.4: Implementar Tool check_availability (Restaurant)

**Archivo:** `lib/voice-agent/tools/restaurant/check-availability.ts`

**Que hacer:**
1. Definir tool:
   ```typescript
   const checkAvailability: ToolDefinition = {
     name: 'check_availability',
     description: 'Verificar disponibilidad para reservacion',
     parameters: {
       type: 'object',
       properties: {
         date: { type: 'string', description: 'Fecha (YYYY-MM-DD)' },
         time: { type: 'string', description: 'Hora (HH:MM)' },
         party_size: { type: 'number', description: 'Numero de personas' }
       },
       required: ['date', 'time', 'party_size']
     },
     requiredCapabilities: ['reservations'],
     requiresConfirmation: false,
     handler: async (params, context) => {
       // 1. Validar parametros
       // 2. Consultar disponibilidad en DB
       // 3. Si no hay, buscar alternativas
       // 4. Formatear respuesta para voz
     }
   };
   ```

2. Implementar logica de disponibilidad
3. Generar alternativas si no hay espacio

**Verificacion:**
- [ ] Consulta DB correctamente
- [ ] Retorna alternativas
- [ ] Respuesta formateada para voz

---

### MICROFASE 8.5: Implementar Tool create_reservation

**Archivo:** `lib/voice-agent/tools/restaurant/create-reservation.ts`

**Que hacer:**
1. Definir tool con confirmacion:
   ```typescript
   const createReservation: ToolDefinition = {
     name: 'create_reservation',
     description: 'Crear nueva reservacion',
     parameters: {
       type: 'object',
       properties: {
         date: { type: 'string' },
         time: { type: 'string' },
         party_size: { type: 'number' },
         customer_name: { type: 'string' },
         customer_phone: { type: 'string' },
         special_requests: { type: 'string' }
       },
       required: ['date', 'time', 'party_size', 'customer_name', 'customer_phone']
     },
     requiredCapabilities: ['reservations'],
     requiresConfirmation: true,
     confirmationTemplate: 'Voy a reservar para {party_size} personas el {date} a las {time} a nombre de {customer_name}. Confirmas?',
     handler: async (params, context) => {
       // 1. Verificar disponibilidad final
       // 2. Crear reservacion en DB
       // 3. Generar numero de confirmacion
       // 4. Retornar respuesta para voz
     }
   };
   ```

2. Generar numero de confirmacion unico

**Verificacion:**
- [ ] Requiere confirmacion
- [ ] Crea en DB
- [ ] Genera numero de confirmacion
- [ ] Respuesta incluye detalles

---

### MICROFASE 8.6: Implementar Tools get_menu y create_order

**Archivos:**
- `lib/voice-agent/tools/restaurant/get-menu.ts`
- `lib/voice-agent/tools/restaurant/create-order.ts`

**Que hacer:**
1. get_menu:
   - Obtener menu del negocio
   - Formatear para lectura en voz
   - Agrupar por categorias
   - Mencionar precios claramente

2. create_order:
   - Requiere confirmacion
   - Validar items existen
   - Calcular total
   - Crear orden en DB
   - Dar tiempo estimado

**Verificacion:**
- [ ] Menu formateado para voz
- [ ] Orden con confirmacion
- [ ] Total calculado
- [ ] Tiempo estimado

---

### MICROFASE 8.7: Implementar Tools Dentales

**Archivos:**
- `lib/voice-agent/tools/dental/check-availability.ts`
- `lib/voice-agent/tools/dental/create-appointment.ts`
- `lib/voice-agent/tools/dental/get-services.ts`

**Que hacer:**
1. check_availability (dental):
   - Similar a restaurant pero con doctores
   - Considerar duracion de citas
   - Filtrar por especialidad

2. create_appointment:
   - Requiere confirmacion
   - Asociar con doctor
   - Crear en DB
   - Enviar recordatorio (opcional)

3. get_services:
   - Listar servicios
   - Descripcion simple (no tecnica)
   - NO dar precios exactos

**Verificacion:**
- [ ] Disponibilidad por doctor
- [ ] Cita con confirmacion
- [ ] Servicios sin jerga medica

---

### MICROFASE 8.8: Implementar Tool transfer_to_human

**Archivo:** `lib/voice-agent/tools/dental/transfer-to-human.ts` (y uno para restaurant)

**Que hacer:**
1. Tool para transferir a humano:
   ```typescript
   const transferToHuman: ToolDefinition = {
     name: 'transfer_to_human',
     description: 'Transferir llamada a un representante humano',
     parameters: {
       type: 'object',
       properties: {
         reason: { type: 'string', description: 'Motivo de la transferencia' }
       }
     },
     requiredCapabilities: ['human_transfer'],
     requiresConfirmation: false,
     handler: async (params, context) => {
       // 1. Loguear razon de transferencia
       // 2. Retornar instruccion para VAPI de transferir
     }
   };
   ```

2. Retornar formato especial que VAPI entiende para transferir

**Verificacion:**
- [ ] VAPI recibe instruccion de transferir
- [ ] Razon logueada
- [ ] Mensaje de despedida apropiado

---

### MICROFASE 8.9: Implementar Formatters para Voz

**Archivo:** `lib/voice-agent/tools/formatters.ts`

**Que hacer:**
1. Funciones de formateo:
   ```typescript
   // Formatear fecha para voz
   function formatDateForVoice(date: string, language: string): string
   // "2024-01-20" → "lunes veinte de enero"

   // Formatear hora para voz
   function formatTimeForVoice(time: string, language: string): string
   // "19:30" → "siete y media de la noche"

   // Formatear precio para voz
   function formatPriceForVoice(price: number, currency: string): string
   // 150.50 → "ciento cincuenta pesos con cincuenta centavos"

   // Formatear lista para voz
   function formatListForVoice(items: string[]): string
   // ["a", "b", "c"] → "a, b y c"

   // Formatear menu para voz
   function formatMenuForVoice(menu: MenuItem[]): string
   // Agrupado y legible
   ```

**Verificacion:**
- [ ] Fechas naturales
- [ ] Horas naturales
- [ ] Precios claros
- [ ] Listas con "y" final

---

### MICROFASE 8.10: Registrar Todos los Tools

**Archivo:** `lib/voice-agent/tools/index.ts`

**Que hacer:**
1. Importar y registrar todos los tools:
   ```typescript
   import { registry } from './registry';

   // Restaurant
   import { checkAvailability } from './restaurant/check-availability';
   import { createReservation } from './restaurant/create-reservation';
   import { getMenu } from './restaurant/get-menu';
   import { createOrder } from './restaurant/create-order';

   // Dental
   import { checkAvailabilityDental } from './dental/check-availability';
   import { createAppointment } from './dental/create-appointment';
   import { getServices } from './dental/get-services';

   // Common
   import { transferToHuman } from './common/transfer-to-human';
   import { getBusinessHours } from './common/get-business-hours';

   // Registrar
   registry.register(checkAvailability);
   registry.register(createReservation);
   // ... etc

   export { registry };
   ```

**Verificacion:**
- [ ] Todos los tools registrados
- [ ] Registry exportado
- [ ] Sin duplicados

---

### MICROFASE 8.11: Tests de Tools

**Archivo:** `__tests__/voice-agent/tools/`

**Que hacer:**
1. Tests de registry:
   - Registro funciona
   - getForType retorna correctos
   - Confirmacion funciona

2. Tests de cada tool:
   - Parametros validados
   - Handler ejecuta
   - Resultado formateado

3. Tests de formatters:
   - Fechas correctas
   - Horas correctas
   - Precios correctos

**Verificacion:**
- [ ] Coverage > 85%
- [ ] Cada tool testeado
- [ ] Formatters testeados

---

### MICROFASE 8.12: Verificacion Final

**Que hacer:**
1. Verificar todos los tools funcionan
2. Verificar integracion con LangGraph
3. Probar flujos completos
4. Documentar cada tool

**Verificacion:**
- [ ] 8+ tools implementados
- [ ] Formateo para voz correcto
- [ ] Confirmaciones funcionan
- [ ] Documentado

---

## Archivos a Crear

```
lib/voice-agent/tools/
├── index.ts
├── registry.ts
├── types.ts
├── formatters.ts
├── restaurant/
│   ├── check-availability.ts
│   ├── create-reservation.ts
│   ├── modify-reservation.ts
│   ├── cancel-reservation.ts
│   ├── get-menu.ts
│   └── create-order.ts
├── dental/
│   ├── check-availability.ts
│   ├── create-appointment.ts
│   ├── modify-appointment.ts
│   ├── cancel-appointment.ts
│   └── get-services.ts
└── common/
    ├── get-business-hours.ts
    └── transfer-to-human.ts

__tests__/voice-agent/tools/
├── registry.test.ts
├── formatters.test.ts
├── restaurant/
│   └── *.test.ts
└── dental/
    └── *.test.ts
```

---

## Lista de Tools

| Tool | Vertical | Confirmacion | Descripcion |
|------|----------|--------------|-------------|
| check_availability | Restaurant | No | Verificar disponibilidad |
| create_reservation | Restaurant | Si | Crear reservacion |
| modify_reservation | Restaurant | Si | Modificar reservacion |
| cancel_reservation | Restaurant | Si | Cancelar reservacion |
| get_menu | Restaurant | No | Obtener menu |
| create_order | Restaurant | Si | Crear pedido |
| check_availability | Dental | No | Verificar disponibilidad |
| create_appointment | Dental | Si | Crear cita |
| modify_appointment | Dental | Si | Modificar cita |
| cancel_appointment | Dental | Si | Cancelar cita |
| get_services | Dental | No | Obtener servicios |
| get_business_hours | Ambos | No | Obtener horarios |
| transfer_to_human | Ambos | No | Transferir a humano |

---

## Criterios de Exito

- [ ] 10+ tools implementados
- [ ] Registry funcional
- [ ] Confirmaciones funcionan
- [ ] Formateo para voz correcto
- [ ] Integracion con LangGraph
- [ ] Tests con coverage > 85%

---

## Notas Importantes

1. **Siempre confirmar acciones destructivas** - create, modify, cancel
2. **Formateo para voz** - Numeros en palabras, fechas naturales
3. **No dar precios exactos en dental** - Solo aproximados o "consultar"
4. **Logging** - Loguear todas las ejecuciones de tools
