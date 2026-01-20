# Sistema de Prompts Híbridos (Template + Gemini) - Voice & Messaging Agents

**Fecha:** 2026-01-20
**Versión:** 2.0
**Estado:** IMPLEMENTADO Y VALIDADO
**Ultima Actualizacion:** Commit `de92953`

## Implementación Completada

### Archivos Creados:

| Archivo | Descripción |
|---------|-------------|
| `templates/prompts/restaurant/rest_basic.hbs` | Template básico para restaurantes (reservaciones) |
| `templates/prompts/restaurant/rest_standard.hbs` | Template estándar para restaurantes (reservaciones + menú) |
| `templates/prompts/restaurant/rest_complete.hbs` | Template completo para restaurantes (reservaciones + menú + pedidos) |
| `templates/prompts/dental/dental_basic.hbs` | Template básico para dental (citas) |
| `templates/prompts/dental/dental_standard.hbs` | Template estándar para dental (citas + servicios + doctores) |
| `templates/prompts/dental/dental_complete.hbs` | Template completo para dental (citas + servicios + emergencias + seguros) |
| `templates/prompts/general/general_basic.hbs` | Template genérico para verticales no soportadas |
| `templates/prompts/personalities/professional.hbs` | Estilo de personalidad profesional |
| `templates/prompts/personalities/friendly.hbs` | Estilo de personalidad amigable |
| `templates/prompts/personalities/energetic.hbs` | Estilo de personalidad energético |
| `templates/prompts/personalities/calm.hbs` | Estilo de personalidad calmado |
| `lib/voice-agent/services/template-prompt-compiler.types.ts` | Tipos para el compilador de templates |
| `lib/voice-agent/services/template-prompt-compiler.service.ts` | Servicio de compilación de templates |
| `lib/voice-agent/services/index.ts` | Índice de exportaciones |
| `src/features/ai/services/hybrid-voice-prompt.service.ts` | Servicio de generación híbrida (template + Gemini) |

### Archivos Modificados:

| Archivo | Cambios |
|---------|---------|
| `src/features/ai/services/prompt-generator.service.ts` | Integración del sistema híbrido para canal 'voice' |
| `lib/voice-agent/webhooks/handlers/assistant-request.handler.ts` | Generación dinámica de first_message |

---

## Objetivo

Implementar sistema híbrido donde:
1. **Template Base** genera prompt estructurado con formato específico para voz
2. **Gemini** enriquece con Knowledge Base dinámico
3. **Voice Agent** responde mediante Tools + RAG igual que el agente de mensajes

---

## FORMATO DE PROMPT BASE (Ejemplo de referencia)

El prompt debe seguir esta estructura exacta, adaptada por vertical y tipo:

```
# SALUDO INICIAL
"Hola, soy {assistant_name} del {business_type} {business_name}. ¿Cómo puedo ayudarte el día de hoy?"

# PERSONALIDAD
Eres {assistant_name}, un asistente de voz IA del {business_type} {business_name}.
Tienes un acento {accent} elegante de México. Te encargas de la comunicación con los clientes.
Te caracterizan tu profesionalismo, actitud positiva y amplia experiencia brindando experiencias de cliente de alta calidad.
No proporciones información de la que no dispongas.

# TAREA
Tu tarea principal es mantener una conversación profesional, positiva y abierta con los clientes,
responder a sus preguntas y ayudarlos a {main_task} si lo solicitan.

# INFORMACIÓN DEL SERVICIO
Utiliza la información de la base de conocimientos para responder preguntas sobre {business_type}.

# {CAPABILITY_SECTION}
{capability_instructions}

# FINALIZACIÓN
Cuando termines la conversación, finaliza la llamada.

# ESCALANDO
Puedes transferir la llamada al Encargado si:
- El cliente lo pide directamente.
- El cliente no está satisfecho con tu servicio.
Dile: "Voy a intentar conectarte con el Encargado" y transfiere la llamada.

# ESTILO
- Sé informal pero profesional, con frases como: "Mmm...", "Bueno...", "Claro..." y "Quiero decir...".
- Usa un tono {personality_tone}.
```

---

## FASE 1: Crear Templates Base por Vertical y Tipo

### Microfase 1.1: Crear template base para RESTAURANT
**Archivo:** `templates/prompts/restaurant_base.hbs`

Tipos a cubrir:
- `rest_basic` - Solo reservaciones y horarios
- `rest_standard` - Reservaciones + información del menú
- `rest_complete` - Reservaciones + menú + pedidos + promociones

### Microfase 1.2: Crear template base para DENTAL
**Archivo:** `templates/prompts/dental_base.hbs`

Tipos a cubrir:
- `dental_basic` - Solo citas y horarios
- `dental_standard` - Citas + información de servicios + doctores
- `dental_complete` - Citas + servicios + emergencias + seguros

### Microfase 1.3: Crear secciones de capacidades por tipo

**Restaurant - rest_basic:**
```
# RESERVAS
{business_name} permite crear reservas para el restaurante.
Aceptamos reservas de {dias_operacion} entre {hora_apertura} y {hora_cierre}.

-Fecha actual: {current_date}
-Hora actual: {current_time}

Instrucciones para crear una reserva:
Si el cliente quiere reservar:
1. Primero necesitas saber: el día, la hora, y para cuántas personas.
2. Consulta disponibilidad con **checkAvailability**.
3. Mientras consultas, sé natural: "Un segundo, reviso disponibilidad..."
4. Informa disponibilidad o alternativas.
5. Pregunta el nombre del cliente.
6. Confirma: "Genial, quedamos así. Te reservo para el [día] a las [hora]."
```

**Restaurant - rest_complete (agrega):**
```
# MENÚ Y PEDIDOS
Puedes informar sobre el menú y tomar pedidos para llevar o delivery.
- Consulta el menú con **getMenu**
- Para pedidos, necesitas: los platillos, cantidad, y datos de entrega/recogida.
```

**Dental - dental_basic:**
```
# CITAS
{business_name} permite agendar citas dentales.
Horario de atención: {dias_operacion} de {hora_apertura} a {hora_cierre}.

-Fecha actual: {current_date}
-Hora actual: {current_time}

Instrucciones para agendar una cita:
Si el cliente quiere agendar:
1. Pregunta el motivo de la cita (revisión, limpieza, dolor, etc.)
2. Pregunta preferencia de fecha y hora.
3. Consulta disponibilidad con **checkAppointmentAvailability**.
4. Mientras consultas: "Déjame revisar la agenda..."
5. Informa disponibilidad o alternativas.
6. Pregunta el nombre del paciente.
7. Confirma: "Perfecto, tu cita queda agendada para el [día] a las [hora]."
```

---

## FASE 2: Crear Servicio de Compilación de Template

### Microfase 2.1: Crear TemplatePromptCompilerService
**Archivo nuevo:** `lib/voice-agent/services/template-prompt-compiler.service.ts`

```typescript
export class TemplatePromptCompilerService {
  /**
   * Compila el prompt base usando el template correspondiente al tipo
   */
  static async compileBasePrompt(
    tenantId: string,
    voiceConfig: VoiceAssistantConfig
  ): Promise<CompiledBasePrompt> {
    // 1. Cargar tipo de asistente
    const assistantType = await this.loadAssistantType(voiceConfig.assistant_type_id);

    // 2. Cargar contexto del negocio
    const businessContext = await this.loadBusinessContext(tenantId);

    // 3. Construir variables del template
    const templateVars = this.buildTemplateVariables(
      voiceConfig,
      assistantType,
      businessContext
    );

    // 4. Renderizar template
    const templateName = this.getTemplateName(assistantType.vertical, assistantType.name);
    const renderedPrompt = await this.renderTemplate(templateName, templateVars);

    // 5. Generar first_message
    const firstMessage = this.generateFirstMessage(templateVars);

    return {
      basePrompt: renderedPrompt,
      firstMessage,
      capabilities: assistantType.enabled_capabilities,
      tools: assistantType.available_tools,
    };
  }

  private static generateFirstMessage(vars: TemplateVariables): string {
    return `Hola, soy ${vars.assistant_name} del ${vars.business_type} ${vars.business_name}. ¿Cómo puedo ayudarte el día de hoy?`;
  }
}
```

### Microfase 2.2: Crear tipos
**Archivo nuevo:** `lib/voice-agent/services/template-prompt-compiler.types.ts`

```typescript
export interface CompiledBasePrompt {
  basePrompt: string;
  firstMessage: string;
  capabilities: string[];
  tools: string[];
  templateVersion: number;
  compiledAt: string;
}

export interface TemplateVariables {
  assistant_name: string;
  business_name: string;
  business_type: string;  // "restaurante" | "consultorio dental"
  accent: string;
  personality_tone: string;
  main_task: string;  // "crear reservas" | "agendar citas"
  current_date: string;
  current_time: string;
  dias_operacion: string;
  hora_apertura: string;
  hora_cierre: string;
  special_instructions?: string;
}
```

---

## FASE 3: Modificar PromptGeneratorService para Híbrido

### Microfase 3.1: Agregar función generateHybridVoicePrompt
**Archivo:** `src/features/ai/services/prompt-generator.service.ts`

```typescript
async function generateHybridVoicePrompt(
  tenantId: string,
  voiceConfig: VoiceAssistantConfig,
  businessContext: BusinessContext
): Promise<PromptGenerationResult> {

  // 1. Compilar prompt base con template
  const { basePrompt, firstMessage, capabilities, tools } =
    await TemplatePromptCompilerService.compileBasePrompt(tenantId, voiceConfig);

  // 2. Construir KB para enriquecimiento
  const knowledgeBase = buildKnowledgeBaseSection(businessContext);

  // 3. Enriquecer con Gemini (SOLO agrega KB, no modifica estructura)
  const enrichedPrompt = await enrichPromptWithGemini(basePrompt, knowledgeBase);

  return {
    success: true,
    prompt: enrichedPrompt,
    firstMessage,
    capabilities,
    tools,
  };
}
```

### Microfase 3.2: Nuevo meta-prompt para Gemini (enriquecimiento)
```typescript
const GEMINI_ENRICHMENT_PROMPT = `
Tienes el siguiente PROMPT BASE para un asistente de voz de {vertical}.
Tu tarea es ENRIQUECERLO con la información del Knowledge Base.

REGLAS ESTRICTAS:
1. NO modifiques la estructura del prompt (secciones, orden, formato)
2. NO cambies el nombre del asistente ni del negocio
3. NO modifiques las instrucciones de reservas/citas
4. SOLO agrega información relevante del KB en los lugares apropiados:
   - Después de "INFORMACIÓN DEL SERVICIO": agrega FAQs relevantes
   - Si hay promociones activas: agrégalas al final de la sección correspondiente
   - Si hay horarios especiales: actualiza la información de horarios

PROMPT BASE:
{basePrompt}

KNOWLEDGE BASE DEL NEGOCIO:
{knowledgeBase}

Retorna el prompt enriquecido manteniendo exactamente el mismo formato.
`;
```

### Microfase 3.3: Modificar generateAndCachePrompt
**Archivo:** `src/features/ai/services/prompt-generator.service.ts`

```typescript
// En generateAndCachePrompt():
if (promptType === 'voice') {
  // Cargar voice config
  const voiceConfig = await loadVoiceConfig(tenantId);

  // Usar flujo híbrido
  const result = await generateHybridVoicePrompt(tenantId, voiceConfig, context);

  // Guardar en cache con metadata adicional
  await cachePrompt(tenantId, 'voice', {
    prompt: result.prompt,
    firstMessage: result.firstMessage,
    capabilities: result.capabilities,
    tools: result.tools,
  });

  return result;
}
```

---

## FASE 4: Integrar con VoiceLangGraphService

### Microfase 4.1: Modificar processVoiceMessage
**Archivo:** `src/features/voice-agent/services/voice-langgraph.service.ts`

```typescript
export async function processVoiceMessage(
  context: VoiceAgentContext,
  transcribedMessage: string
): Promise<VoiceResponseResult> {

  // 1. Cargar prompt híbrido cacheado
  const cachedPrompt = await getCachedHybridPrompt(context.tenant_id);

  // 2. Si no hay cache, compilar en tiempo real
  const compiledPrompt = cachedPrompt?.prompt ||
    await TemplatePromptCompilerService.compileBasePrompt(
      context.tenant_id,
      context.voice_config
    );

  // 3. Crear input para el grafo con prompt y capabilities
  const graphInput: GraphExecutionInput = {
    tenant_id: context.tenant_id,
    current_message: transcribedMessage,
    compiledPrompt: compiledPrompt.basePrompt,
    availableTools: compiledPrompt.tools,
    enabledCapabilities: compiledPrompt.capabilities,
  };

  // 4. Ejecutar grafo
  return await executeVoiceGraph(graphInput);
}
```

### Microfase 4.2: Agregar campos al state
**Archivo:** `lib/voice-agent/langgraph/state.ts`

```typescript
export interface VoiceAgentState {
  // ... campos existentes ...

  /** Prompt base compilado del template */
  compiledPrompt: string;

  /** Tools disponibles para este tipo de asistente */
  availableTools: string[];

  /** Capabilities habilitadas */
  enabledCapabilities: string[];
}
```

### Microfase 4.3: Usar compiledPrompt en response-generator
**Archivo:** `lib/voice-agent/langgraph/nodes/response-generator.ts`

```typescript
export async function responseGeneratorNode(
  state: VoiceAgentState,
  config?: ResponseGeneratorConfig
): Promise<Partial<VoiceAgentState>> {

  // Usar prompt compilado como system prompt
  const systemPrompt = state.compiledPrompt || DEFAULT_VOICE_SYSTEM_PROMPT;

  // Generar respuesta con el prompt correcto
  const response = await generateResponse(state, systemPrompt);

  return { response };
}
```

---

## FASE 5: Verificar y Conectar Tools + RAG

### Microfase 5.1: Filtrar tools por availableTools
**Archivo:** `lib/voice-agent/langgraph/nodes/router.ts`

```typescript
// Agregar validación de tools disponibles
if (detectedIntent === 'tool') {
  const requestedTool = detectRequestedTool(state.currentInput);

  if (!state.availableTools.includes(requestedTool)) {
    return {
      intent: 'direct',
      response: generateUnavailableToolResponse(requestedTool, state.locale),
    };
  }
}
```

### Microfase 5.2: Verificar RAG funciona con KB
**Archivo:** `lib/voice-agent/langgraph/nodes/rag.ts`

- Verificar que `ragNodeWithVoiceRAG` se usa
- Verificar búsqueda en `business_knowledge` por tenant_id

---

## FASE 6: Punto de Entrada - Assistant Request

### Microfase 6.1: Modificar assistant-request handler
**Archivo:** `lib/voice-agent/webhooks/handlers/assistant-request.handler.ts`

```typescript
export async function handleAssistantRequest(
  payload: AssistantRequestPayload,
  context: WebhookContext
): Promise<AssistantRequestResponse> {

  // 1. Cargar voice config
  const voiceConfig = await getVoiceConfig(context.tenantId);

  // 2. Compilar prompt híbrido (o cargar de cache)
  const compiled = await TemplatePromptCompilerService.compileBasePrompt(
    context.tenantId,
    voiceConfig
  );

  // 3. Construir respuesta para VAPI
  return {
    assistant: {
      model: {
        messages: [{
          role: 'system',
          content: compiled.basePrompt,
        }],
      },
      firstMessage: compiled.firstMessage,
      // ... otras configs
    },
  };
}
```

---

## Archivos a Crear/Modificar

| Acción | Archivo |
|--------|---------|
| CREAR | `templates/prompts/restaurant_base.hbs` |
| CREAR | `templates/prompts/restaurant_sections/reservations.hbs` |
| CREAR | `templates/prompts/restaurant_sections/menu_orders.hbs` |
| CREAR | `templates/prompts/dental_base.hbs` |
| CREAR | `templates/prompts/dental_sections/appointments.hbs` |
| CREAR | `templates/prompts/dental_sections/services.hbs` |
| CREAR | `lib/voice-agent/services/template-prompt-compiler.service.ts` |
| CREAR | `lib/voice-agent/services/template-prompt-compiler.types.ts` |
| MODIFICAR | `src/features/ai/services/prompt-generator.service.ts` |
| MODIFICAR | `src/features/voice-agent/services/voice-langgraph.service.ts` |
| MODIFICAR | `lib/voice-agent/langgraph/state.ts` |
| MODIFICAR | `lib/voice-agent/langgraph/nodes/response-generator.ts` |
| MODIFICAR | `lib/voice-agent/langgraph/nodes/router.ts` |
| MODIFICAR | `lib/voice-agent/webhooks/handlers/assistant-request.handler.ts` |

---

## Verificación por Fase

### Después de Fase 1-2:
- Test: TemplatePromptCompilerService compila prompt con formato correcto
- Verificar: first_message = "Hola, soy {name} del {business}..."
- Verificar: Secciones PERSONALIDAD, TAREA, RESERVAS/CITAS presentes

### Después de Fase 3:
- Test: generateHybridVoicePrompt retorna prompt con KB enriquecido
- Verificar: Estructura base NO modificada por Gemini
- Verificar: FAQs y promociones agregadas correctamente

### Después de Fase 4:
- Test: VoiceLangGraphService pasa compiledPrompt al state
- Verificar: response-generator usa el prompt compilado

### Después de Fase 5:
- Test: Router valida tools según availableTools
- Test: RAG retorna contexto del KB

### Después de Fase 6:
- Test E2E: Llamada VAPI → prompt híbrido → tools → respuesta

---

## Testing Final

### Test 1: First message correcto
```
Input: Nueva llamada entrante
Expected: "Hola, soy [nombre] del restaurante [negocio]. ¿Cómo puedo ayudarte?"
```

### Test 2: Reservación restaurant
```
Input: "Quiero hacer una reservación para 4 personas mañana a las 8"
Expected:
1. "Un segundo, reviso disponibilidad..."
2. checkAvailability tool ejecutado
3. "Perfecto, quedamos así. Te reservo para mañana a las 8pm."
```

### Test 3: Cita dental
```
Input: "Necesito una cita para limpieza"
Expected:
1. "¿Para qué fecha te gustaría la cita?"
2. checkAppointmentAvailability tool ejecutado
3. "Tu cita queda agendada para el [fecha] a las [hora]."
```

### Test 4: Tool no disponible (rest_basic pidiendo menú)
```
Input: "¿Qué tienen en el menú?"
Expected: "Por el momento no tengo acceso a esa información, pero puedo ayudarte con reservaciones."
```

### Test 5: RAG para información del negocio
```
Input: "¿Cuál es el horario?"
Expected: Respuesta con horarios del KB, tono natural de voz
```

---

## Notas de Implementación

- Los templates existentes en `/templates/` pueden servir como base pero necesitan adaptarse al nuevo formato
- El VoiceTemplateEngine existente se reutilizará para el renderizado de Handlebars
- El sistema mantiene compatibilidad hacia atrás con prompts cacheados existentes

---

## MEJORAS ENERO 2026

### Fixes Criticos Aplicados

1. **Sincronización de Capabilities**
   - `ToolCapability` en `tools/types.ts` ahora está sincronizado con `Capability` en `types/types.ts`
   - Eliminados capabilities fantasma que causaban errores de TypeScript

2. **requiredCapabilities Corregidos**
   - `transfer-to-human.ts`: `'transfers'` → `'human_transfer'`
   - `get-doctors.ts`: `'doctors'` → `'doctor_info'`
   - `get-insurance-info.ts`: `'insurance'` → `'insurance_info'`
   - `get-menu.ts`: `'menu'` → `'menu_info'`

3. **Nuevas Capabilities y Tools**
   ```typescript
   // Capability agregada
   'invoicing' // Para facturación CFDI mexicana

   // Tools agregados
   'request_invoice' // Solicitar factura fiscal
   'end_call'        // Finalizar llamada programáticamente
   ```

4. **Descripciones Actualizadas**
   ```typescript
   CAPABILITY_DESCRIPTIONS['invoicing'] = 'Solicitar y gestionar facturas'
   TOOL_DESCRIPTIONS['request_invoice'] = 'Solicitar factura fiscal'
   TOOL_DESCRIPTIONS['end_call'] = 'Finalizar la llamada'
   ```

### Sistema de Capabilities Completo

```typescript
// 17 Capabilities totales
Capability =
  // Shared (5)
  | 'business_hours' | 'business_info' | 'human_transfer' | 'faq' | 'invoicing'
  // Restaurant (6)
  | 'reservations' | 'menu_info' | 'recommendations' | 'orders' | 'order_status' | 'promotions'
  // Dental (6)
  | 'appointments' | 'services_info' | 'doctor_info' | 'insurance_info' | 'appointment_management' | 'emergencies'
```

### Sistema de Tools Completo

```typescript
// 32 Tools totales
Tool =
  // Common (5)
  | 'get_business_hours' | 'get_business_info' | 'transfer_to_human' | 'request_invoice' | 'end_call'
  // Restaurant (14)
  | 'check_availability' | 'create_reservation' | 'modify_reservation' | 'cancel_reservation'
  | 'get_menu' | 'get_menu_item' | 'search_menu' | 'get_recommendations'
  | 'create_order' | 'modify_order' | 'cancel_order' | 'get_order_status' | 'calculate_delivery_time' | 'get_promotions'
  // Dental (13)
  | 'check_appointment_availability' | 'create_appointment' | 'modify_appointment' | 'cancel_appointment'
  | 'get_services' | 'get_service_info' | 'get_service_prices'
  | 'get_doctors' | 'get_doctor_info'
  | 'get_insurance_info' | 'check_insurance_coverage'
  | 'handle_emergency' | 'send_reminder'
```

### Verificación TypeScript

```bash
# Todos los archivos del voice-agent compilan sin errores
npx tsc --noEmit
# ✓ lib/voice-agent/types/types.ts
# ✓ lib/voice-agent/types/capability-definitions.ts
# ✓ lib/voice-agent/tools/types.ts
# ✓ lib/voice-agent/tools/*/\*.ts
```

---

## Documentación Relacionada

- [ARQUITECTURA-AGENTES-V3.md](./ARQUITECTURA-AGENTES-V3.md) - Arquitectura completa de ambos agentes
- [voice-agent-v2/04-ARQUITECTURA-PROPUESTA.md](./voice-agent-v2/04-ARQUITECTURA-PROPUESTA.md) - Arquitectura Voice Agent v2
- [voice-agent-v2/08-TOOL-CALLING.md](./voice-agent-v2/08-TOOL-CALLING.md) - Sistema de Tool Calling
