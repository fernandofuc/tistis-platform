# VOICE AGENT v2.0 - TOOL CALLING UNIFICADO

**Documento:** 08-TOOL-CALLING.md
**Version:** 2.0.0
**Fecha:** 2026-01-19
**Estado:** Especificacion Completa

---

## 1. FILOSOFIA DE TOOL CALLING

### 1.1 Principios

1. **Unificado**: Los mismos tools funcionan para Voice y Chat
2. **Con confirmacion**: Actions destructivas requieren confirmacion del usuario
3. **Atomico**: Operaciones criticas (booking) son atomicas
4. **Contextual**: Tools reciben contexto completo (tenant, branch, channel)
5. **Loggeado**: Todas las ejecuciones se registran

### 1.2 Diferencia vs v1

| Aspecto | v1 (Actual) | v2 (Propuesto) |
|---------|-------------|----------------|
| Ejecucion | Solo detecta intent | Ejecuta realmente |
| Confirmacion | No hay | Antes de actions destructivas |
| Unificacion | Separado voice/chat | Mismo sistema |
| Resultado | Intent string | Resultado de operacion |
| Rollback | No hay | Transacciones atomicas |

---

## 2. ARQUITECTURA DE TOOL CALLING

### 2.1 Flujo de Ejecucion

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOOL CALLING FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER INPUT                                                      │
│  "Quiero reservar para manana a las 8, somos 4"                │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               LANGGRAPH ROUTER                           │    │
│  │  1. Parse intent: BOOKING                               │    │
│  │  2. Extract entities: date=tomorrow, time=20:00, size=4 │    │
│  │  3. Determine tools needed                               │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               TOOL REGISTRY                              │    │
│  │  - Validate tool exists                                  │    │
│  │  - Validate tool enabled for assistant type             │    │
│  │  - Validate parameters                                   │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          TOOL: check_availability                        │    │
│  │  Input: { date, time, party_size }                      │    │
│  │  Output: { available: true, slots: [...] }              │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         LLM RESPONSE GENERATION                          │    │
│  │  "Tengo disponible a las 8! A nombre de quien?"         │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│         ... usuario proporciona nombre y telefono ...           │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         CONFIRMATION REQUIRED                            │    │
│  │  "Confirmo: Mesa para 4, manana a las 8pm,              │    │
│  │   a nombre de Juan. Es correcto?"                       │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│         Usuario: "Si, correcto"                                 │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │          TOOL: create_reservation                        │    │
│  │  Input: { date, time, party_size, name, phone }         │    │
│  │  Output: { success: true, confirmation: "RES-1234" }    │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │                                      │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         FINAL RESPONSE                                   │    │
│  │  "Listo! Tu reservacion RES-1234 esta confirmada."      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. CATALOGO DE TOOLS

### 3.1 Tools de Disponibilidad

#### check_availability

```typescript
{
  name: 'check_availability',
  description: 'Verifica disponibilidad para una fecha/hora especifica',
  category: 'booking',
  requires_confirmation: false,
  enabled_for: ['rest_basic', 'rest_standard', 'rest_complete',
                'dental_basic', 'dental_standard', 'dental_complete'],

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Fecha en formato YYYY-MM-DD'
      },
      time: {
        type: 'string',
        description: 'Hora en formato HH:MM (24h)'
      },
      duration_minutes: {
        type: 'integer',
        default: 60,
        description: 'Duracion en minutos'
      },
      party_size: {
        type: 'integer',
        description: 'Numero de personas (para restaurantes)'
      },
      service_id: {
        type: 'string',
        description: 'ID del servicio (para dental/clinica)'
      },
      staff_id: {
        type: 'string',
        description: 'ID del staff preferido (opcional)'
      }
    },
    required: ['date', 'time']
  },

  handler: async (params, context) => {
    const result = await BookingService.checkAvailability({
      tenant_id: context.tenant_id,
      branch_id: context.branch_id,
      ...params
    });

    return {
      available: result.available,
      requested_slot: { date: params.date, time: params.time },
      alternative_slots: result.alternatives || [],
      message: result.available
        ? `Disponible para ${params.date} a las ${params.time}`
        : `No disponible. Alternativas: ${result.alternatives?.join(', ')}`
    };
  }
}
```

---

### 3.2 Tools de Reservacion/Cita

#### create_reservation (Restaurant)

```typescript
{
  name: 'create_reservation',
  description: 'Crea una reservacion de mesa en el restaurante',
  category: 'booking',
  requires_confirmation: true,  // IMPORTANTE
  enabled_for: ['rest_basic', 'rest_standard', 'rest_complete'],

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        description: 'Fecha de la reservacion'
      },
      time: {
        type: 'string',
        description: 'Hora de la reservacion'
      },
      party_size: {
        type: 'integer',
        description: 'Numero de personas'
      },
      customer_name: {
        type: 'string',
        description: 'Nombre del cliente'
      },
      customer_phone: {
        type: 'string',
        description: 'Telefono del cliente'
      },
      special_requests: {
        type: 'string',
        description: 'Solicitudes especiales (opcional)'
      }
    },
    required: ['date', 'time', 'party_size', 'customer_name', 'customer_phone']
  },

  // Mensaje de confirmacion antes de ejecutar
  confirmation_message: (params) =>
    `Confirmo: Mesa para ${params.party_size} personas, ` +
    `${formatDate(params.date)} a las ${params.time}, ` +
    `a nombre de ${params.customer_name}. ¿Es correcto?`,

  handler: async (params, context) => {
    // Usar RPC atomico para evitar race conditions
    const result = await supabase.rpc('create_reservation_atomic', {
      p_tenant_id: context.tenant_id,
      p_branch_id: context.branch_id,
      p_date: params.date,
      p_time: params.time,
      p_party_size: params.party_size,
      p_customer_name: params.customer_name,
      p_customer_phone: params.customer_phone,
      p_special_requests: params.special_requests,
      p_source: context.channel, // 'voice' o 'whatsapp'
      p_source_call_id: context.call_id
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
        message: 'No se pudo crear la reservacion. Por favor intenta de nuevo.'
      };
    }

    return {
      success: true,
      reservation_id: result.data.reservation_id,
      confirmation_code: result.data.confirmation_code,
      message: `Reservacion confirmada! Tu codigo es ${result.data.confirmation_code}`
    };
  }
}
```

#### create_appointment (Dental)

```typescript
{
  name: 'create_appointment',
  description: 'Crea una cita en la clinica dental',
  category: 'booking',
  requires_confirmation: true,
  enabled_for: ['dental_basic', 'dental_standard', 'dental_complete'],

  parameters: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date'
      },
      time: {
        type: 'string'
      },
      service_id: {
        type: 'string',
        description: 'ID del servicio (opcional, puede ser valoracion general)'
      },
      staff_id: {
        type: 'string',
        description: 'ID del doctor preferido (opcional)'
      },
      patient_name: {
        type: 'string'
      },
      patient_phone: {
        type: 'string'
      },
      reason: {
        type: 'string',
        description: 'Motivo de la cita'
      },
      is_first_visit: {
        type: 'boolean',
        default: false
      },
      is_emergency: {
        type: 'boolean',
        default: false
      }
    },
    required: ['date', 'time', 'patient_name', 'patient_phone']
  },

  confirmation_message: (params) =>
    `Confirmo: Cita para ${params.patient_name}, ` +
    `${formatDate(params.date)} a las ${params.time}` +
    (params.reason ? ` por ${params.reason}` : '') +
    `. ¿Es correcto?`,

  handler: async (params, context) => {
    const result = await supabase.rpc('create_appointment_atomic', {
      p_tenant_id: context.tenant_id,
      p_branch_id: context.branch_id,
      p_date: params.date,
      p_time: params.time,
      p_service_id: params.service_id,
      p_staff_id: params.staff_id,
      p_patient_name: params.patient_name,
      p_patient_phone: params.patient_phone,
      p_reason: params.reason,
      p_is_first_visit: params.is_first_visit,
      p_is_emergency: params.is_emergency,
      p_source: context.channel,
      p_source_call_id: context.call_id
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message
      };
    }

    return {
      success: true,
      appointment_id: result.data.appointment_id,
      confirmation_code: result.data.confirmation_code,
      message: `Cita confirmada! Tu codigo es ${result.data.confirmation_code}`
    };
  }
}
```

---

### 3.3 Tools de Informacion

#### get_business_hours

```typescript
{
  name: 'get_business_hours',
  description: 'Obtiene los horarios del negocio',
  category: 'info',
  requires_confirmation: false,
  enabled_for: ['*'],  // Todos los tipos

  parameters: {
    type: 'object',
    properties: {
      branch_id: {
        type: 'string',
        description: 'ID de la sucursal (opcional)'
      },
      day: {
        type: 'string',
        description: 'Dia especifico (opcional)'
      }
    }
  },

  handler: async (params, context) => {
    const hours = await BusinessService.getHours(
      context.tenant_id,
      params.branch_id || context.branch_id
    );

    // Formatear para voz
    const formatted = formatHoursForVoice(hours, params.day);

    return {
      hours: hours,
      formatted_message: formatted
    };
  }
}
```

#### get_menu

```typescript
{
  name: 'get_menu',
  description: 'Obtiene el menu del restaurante',
  category: 'info',
  requires_confirmation: false,
  enabled_for: ['rest_standard', 'rest_complete'],

  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Categoria del menu (entradas, platos_fuertes, etc)'
      },
      search_term: {
        type: 'string',
        description: 'Buscar plato especifico'
      },
      include_prices: {
        type: 'boolean',
        default: true
      }
    }
  },

  handler: async (params, context) => {
    const menu = await MenuService.getMenu(
      context.tenant_id,
      params.category,
      params.search_term
    );

    // Limitar items para respuesta de voz (max 5)
    const limitedMenu = menu.slice(0, 5);

    return {
      items: limitedMenu,
      total_items: menu.length,
      formatted_message: formatMenuForVoice(limitedMenu, params.include_prices)
    };
  }
}
```

#### get_services (Dental)

```typescript
{
  name: 'get_services',
  description: 'Obtiene lista de servicios dentales',
  category: 'info',
  requires_confirmation: false,
  enabled_for: ['dental_standard', 'dental_complete'],

  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Categoria (limpieza, ortodoncia, etc)'
      },
      include_prices: {
        type: 'boolean',
        default: true
      }
    }
  },

  handler: async (params, context) => {
    const services = await ServiceService.list(
      context.tenant_id,
      params.category
    );

    return {
      services: services,
      formatted_message: formatServicesForVoice(services, params.include_prices)
    };
  }
}
```

---

### 3.4 Tools de Pedidos (Restaurant Complete)

#### create_order

```typescript
{
  name: 'create_order',
  description: 'Crea un pedido telefonico',
  category: 'order',
  requires_confirmation: true,
  enabled_for: ['rest_complete'],

  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            menu_item_id: { type: 'string' },
            quantity: { type: 'integer' },
            modifications: { type: 'string' }
          },
          required: ['menu_item_id', 'quantity']
        }
      },
      delivery_type: {
        type: 'string',
        enum: ['delivery', 'pickup']
      },
      delivery_address: {
        type: 'string',
        description: 'Requerido si delivery_type es delivery'
      },
      customer_name: {
        type: 'string'
      },
      customer_phone: {
        type: 'string'
      },
      special_instructions: {
        type: 'string'
      }
    },
    required: ['items', 'delivery_type', 'customer_name', 'customer_phone']
  },

  confirmation_message: (params) => {
    const itemsSummary = params.items
      .map(i => `${i.quantity}x ${i.menu_item_id}`)
      .join(', ');
    return `Confirmo pedido: ${itemsSummary}, ` +
      (params.delivery_type === 'delivery'
        ? `a entregar en ${params.delivery_address}`
        : 'para recoger') +
      `. ¿Es correcto?`;
  },

  handler: async (params, context) => {
    const result = await OrderService.createPhoneOrder({
      tenant_id: context.tenant_id,
      branch_id: context.branch_id,
      items: params.items,
      delivery_type: params.delivery_type,
      delivery_address: params.delivery_address,
      customer_name: params.customer_name,
      customer_phone: params.customer_phone,
      special_instructions: params.special_instructions,
      source: context.channel,
      source_call_id: context.call_id
    });

    return {
      success: result.success,
      order_id: result.order_id,
      order_number: result.order_number,
      estimated_time: result.estimated_time,
      total: result.total,
      message: result.success
        ? `Pedido ${result.order_number} confirmado! ` +
          `Total: $${result.total}. Tiempo estimado: ${result.estimated_time} minutos.`
        : 'No se pudo crear el pedido.'
    };
  }
}
```

---

### 3.5 Tools de Escalacion

#### transfer_to_human

```typescript
{
  name: 'transfer_to_human',
  description: 'Solicita transferencia a un agente humano',
  category: 'escalation',
  requires_confirmation: false,
  enabled_for: ['*'],

  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Razon de la transferencia'
      },
      urgency: {
        type: 'string',
        enum: ['low', 'medium', 'high']
      },
      context_summary: {
        type: 'string',
        description: 'Resumen del contexto para el agente'
      }
    },
    required: ['reason']
  },

  handler: async (params, context) => {
    // Registrar solicitud de escalacion
    await EscalationService.requestTransfer({
      call_id: context.call_id,
      tenant_id: context.tenant_id,
      reason: params.reason,
      urgency: params.urgency || 'medium',
      context_summary: params.context_summary,
      conversation_history: context.conversation_history
    });

    // Obtener numero de escalacion
    const config = await getVoiceConfig(context.tenant_id);

    return {
      should_transfer: true,
      transfer_number: config.escalation_phone,
      message: config.transfer_message ||
        'Entiendo, te voy a transferir con alguien del equipo que pueda ayudarte mejor.'
    };
  }
}
```

---

## 4. TOOL REGISTRY

### 4.1 Implementacion

```typescript
// src/features/ai/tools/registry.ts

import { ToolDefinition, ToolContext, ToolResult } from './types';
import { voiceLogger } from '@/lib/logger/voice-logger';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    // Registrar todos los tools al inicializar
    this.registerAll();
  }

  private registerAll(): void {
    // Importar y registrar cada tool
    const allTools = [
      // Disponibilidad
      checkAvailabilityTool,
      // Reservaciones
      createReservationTool,
      createAppointmentTool,
      modifyAppointmentTool,
      cancelAppointmentTool,
      // Info
      getBusinessHoursTool,
      getBusinessInfoTool,
      getMenuTool,
      getServicesTool,
      getStaffInfoTool,
      // Pedidos
      createOrderTool,
      getOrderStatusTool,
      // Escalacion
      transferToHumanTool,
    ];

    allTools.forEach(tool => this.tools.set(tool.name, tool));
  }

  // Obtener tools habilitados para un tipo de asistente
  getToolsForType(assistantTypeId: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool =>
      tool.enabled_for.includes('*') ||
      tool.enabled_for.includes(assistantTypeId)
    );
  }

  // Obtener definicion de un tool
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  // Verificar si tool requiere confirmacion
  requiresConfirmation(name: string): boolean {
    return this.tools.get(name)?.requires_confirmation ?? false;
  }

  // Generar mensaje de confirmacion
  getConfirmationMessage(name: string, params: Record<string, unknown>): string | null {
    const tool = this.tools.get(name);
    if (!tool?.requires_confirmation || !tool.confirmation_message) {
      return null;
    }
    return tool.confirmation_message(params);
  }

  // Ejecutar tool
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`
      };
    }

    // Validar que tool esta habilitado para el tipo de asistente
    if (!tool.enabled_for.includes('*') &&
        !tool.enabled_for.includes(context.assistant_type_id)) {
      return {
        success: false,
        error: `Tool '${name}' not enabled for assistant type '${context.assistant_type_id}'`
      };
    }

    try {
      const result = await tool.handler(params, context);

      voiceLogger.toolExecuted({
        tenant_id: context.tenant_id,
        call_id: context.call_id,
        tool_name: name,
        success: true,
        duration_ms: Date.now() - startTime,
        result: result
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      voiceLogger.toolExecuted({
        tenant_id: context.tenant_id,
        call_id: context.call_id,
        tool_name: name,
        success: false,
        duration_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Singleton
export const toolRegistry = new ToolRegistry();
```

---

## 5. FLUJO DE CONFIRMACION

### 5.1 Estado de Confirmacion Pendiente

```typescript
// Estado en LangGraph para tracking de confirmaciones pendientes

interface PendingConfirmation {
  tool_name: string;
  params: Record<string, unknown>;
  confirmation_message: string;
  created_at: Date;
  expires_at: Date;  // 2 minutos
}

// En el estado de la conversacion
interface ConversationState {
  // ... otros campos
  pending_confirmation?: PendingConfirmation;
}
```

### 5.2 Flujo en LangGraph

```typescript
// Nodo de procesamiento de tools

async function processToolCall(state: ConversationState): Promise<ConversationState> {
  const { tool_name, params } = state.current_tool_call;

  // Verificar si hay confirmacion pendiente
  if (state.pending_confirmation) {
    // El usuario ya confirmo?
    if (isConfirmation(state.last_user_message)) {
      // Ejecutar tool pendiente
      const result = await toolRegistry.execute(
        state.pending_confirmation.tool_name,
        state.pending_confirmation.params,
        state.context
      );

      return {
        ...state,
        pending_confirmation: undefined,
        tool_result: result
      };
    } else if (isDenial(state.last_user_message)) {
      // Usuario cancelo
      return {
        ...state,
        pending_confirmation: undefined,
        response: 'Entendido, no hay problema. ¿En que mas puedo ayudarte?'
      };
    }
  }

  // Nuevo tool call - verificar si requiere confirmacion
  if (toolRegistry.requiresConfirmation(tool_name)) {
    const confirmationMessage = toolRegistry.getConfirmationMessage(tool_name, params);

    return {
      ...state,
      pending_confirmation: {
        tool_name,
        params,
        confirmation_message: confirmationMessage!,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 2 * 60 * 1000)
      },
      response: confirmationMessage
    };
  }

  // Tool sin confirmacion - ejecutar directamente
  const result = await toolRegistry.execute(tool_name, params, state.context);

  return {
    ...state,
    tool_result: result
  };
}

// Helper para detectar confirmacion
function isConfirmation(message: string): boolean {
  const confirmationPatterns = [
    /^s[ií]/i,
    /correcto/i,
    /confirmo/i,
    /de acuerdo/i,
    /ok/i,
    /esta bien/i,
    /adelante/i,
    /hazlo/i
  ];
  return confirmationPatterns.some(p => p.test(message));
}

// Helper para detectar negacion
function isDenial(message: string): boolean {
  const denialPatterns = [
    /^no/i,
    /cancelar/i,
    /espera/i,
    /momento/i,
    /incorrecto/i,
    /error/i,
    /cambiar/i
  ];
  return denialPatterns.some(p => p.test(message));
}
```

---

## 6. FORMATEO PARA VOZ

### 6.1 Helpers de Formateo

```typescript
// src/features/voice-agent/utils/format-for-voice.ts

// Formatear numeros para voz
export function formatNumberForVoice(num: number): string {
  // 123 -> "uno dos tres"
  // Para precios mantener como numero
  if (num >= 100) {
    return num.toString();
  }
  return num.toString().split('').join(' ');
}

// Formatear fecha para voz
export function formatDateForVoice(date: string | Date): string {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  };
  return d.toLocaleDateString('es-MX', options);
  // "martes 20 de enero"
}

// Formatear hora para voz
export function formatTimeForVoice(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const m = parseInt(minutes);

  const period = h >= 12 ? 'de la tarde' : 'de la manana';
  const hour12 = h > 12 ? h - 12 : h;

  if (m === 0) {
    return `${hour12} ${period}`;
  } else if (m === 30) {
    return `${hour12} y media ${period}`;
  } else {
    return `${hour12} con ${m} ${period}`;
  }
  // "8 de la noche", "3 y media de la tarde"
}

// Formatear menu para voz (maximo 3-5 items)
export function formatMenuForVoice(
  items: MenuItem[],
  includePrices: boolean
): string {
  const limited = items.slice(0, 4);

  const formatted = limited.map(item => {
    if (includePrices) {
      return `${item.name} a ${item.price} pesos`;
    }
    return item.name;
  });

  if (formatted.length === 1) {
    return formatted[0];
  }

  const last = formatted.pop();
  return formatted.join(', ') + ' y ' + last;
  // "tacos a 45 pesos, quesadillas a 50 pesos y tortas a 60 pesos"
}

// Formatear lista de horarios disponibles
export function formatSlotsForVoice(slots: string[]): string {
  const limited = slots.slice(0, 4);

  const formatted = limited.map(slot => formatTimeForVoice(slot));

  if (formatted.length === 1) {
    return formatted[0];
  }

  const last = formatted.pop();
  return formatted.join(', ') + ' o ' + last;
  // "3 de la tarde, 4 de la tarde o 5 de la tarde"
}
```

---

## 7. CHECKLIST DE IMPLEMENTACION

### 7.1 Por Tool

- [ ] Definir schema de parametros
- [ ] Implementar handler
- [ ] Definir mensaje de confirmacion (si aplica)
- [ ] Implementar formateo para voz
- [ ] Tests unitarios
- [ ] Tests de integracion

### 7.2 General

- [ ] Implementar ToolRegistry
- [ ] Integrar con LangGraph
- [ ] Implementar flujo de confirmacion
- [ ] Implementar helpers de formateo
- [ ] Logging de ejecuciones
- [ ] Documentar cada tool

---

*Este documento es parte de la documentacion de Voice Agent v2.0.*
